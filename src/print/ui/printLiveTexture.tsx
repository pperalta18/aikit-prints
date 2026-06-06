import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { invalidate } from '@react-three/fiber'
import { getFontEmbedCSS, toCanvas } from 'html-to-image'
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from 'three'
import { buildGeometry } from '../geometry'
import { getPrintPage } from '../pages'
import { PrintStage } from '../PrintRenderer'
import type { PrintDoc } from '../types'

/**
 * printLiveTexture — paint the **live print component** into a WebGL texture for the
 * event-space viewer's *realista* mode.
 * ──────────────────────────────────────────────────────────────────────────────
 * The flat preview already shows the live React page (`<Html transform>`); realista
 * mode wants the *same* picture but as a genuine, depth-tested, room-lit mesh so a
 * wall in front occludes it. Rather than read a baked PNG off disk (`printFaceTexture`,
 * which goes stale the moment the page or its `doc` changes), we rasterise the exact
 * same `PrintStage`+page render the preview uses — so realista tracks the design
 * automatically, with no manual export.
 *
 * How: render the page into an off-screen, trim-sized host (the media offset by
 * `-bleed`, so only the trim shows), wait for fonts + images, snapshot it with
 * html-to-image, and wrap the canvas in a {@link CanvasTexture}. The texture maps the
 * trim 1:1 onto the plane (no bleed-crop UV needed). On any failure the caller falls
 * back to the plain white plate (still correctly occluded).
 */

/** Long-edge px the page is rasterised at — matches the live-preview cap. */
const FACE_LONG_PX = 2048

/** Font embedding is the slow part and identical across faces — compute it once. */
let fontEmbedCss: Promise<string> | null = null

/**
 * Cap how many faces rasterise at once. Each raster mounts a React root and runs an
 * `html-to-image` SVG serialisation of a 2048px page (very heavy for image-track
 * prints). Placing many image prints would otherwise fire N conversions in parallel
 * and freeze the main thread — the "va petadísimo" symptom. A small semaphore runs
 * them a couple at a time, so the UI stays responsive and faces pop in progressively.
 */
const MAX_CONCURRENT_RASTERS = 2
let activeRasters = 0
const rasterWaiters: Array<() => void> = []

async function acquireRasterSlot(): Promise<void> {
  if (activeRasters < MAX_CONCURRENT_RASTERS) {
    activeRasters++
    return
  }
  await new Promise<void>((resolve) => rasterWaiters.push(resolve))
  activeRasters++
}

function releaseRasterSlot(): void {
  activeRasters = Math.max(0, activeRasters - 1)
  rasterWaiters.shift()?.()
}

/** Wait two frames so React has committed and the browser has laid the host out. */
const twoFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

/** Resolve once every <img> inside the host has decoded (image-track prints). */
async function imagesReady(host: HTMLElement): Promise<void> {
  const imgs = Array.from(host.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {}))))
}

/**
 * Render `doc`'s live page to a three {@link Texture}, cropped to the trim. Mounts a
 * throwaway React root off-screen, snapshots it, then tears the root down. Rejects if
 * the page is unknown or the snapshot fails, so callers can fall back to the plate.
 */
export async function renderLivePrintTexture(doc: PrintDoc): Promise<Texture> {
  const page = getPrintPage(doc.pageComponentId)
  if (!page) throw new Error(`renderLivePrintTexture: no page for "${doc.pageComponentId}"`)
  const geo = buildGeometry(doc.dimensions, doc.dpi)

  // Output size: long edge capped to FACE_LONG_PX, trim aspect preserved.
  const aspect = geo.trimWidthPx / geo.trimHeightPx
  const longPx = Math.min(FACE_LONG_PX, Math.round(Math.max(geo.trimWidthPx, geo.trimHeightPx)))
  const outW = aspect >= 1 ? longPx : Math.round(longPx * aspect)
  const outH = aspect >= 1 ? Math.round(longPx / aspect) : longPx

  // Gate the heavy work behind the semaphore so a burst of placements doesn't run all
  // their html-to-image conversions at once and stall the main thread.
  await acquireRasterSlot()
  try {
    // An off-screen *wrapper* holds the captured host out of view; the host itself
    // must stay in normal flow (position:relative). html-to-image inlines the captured
    // node's own computed style onto the foreignObject root — a `position:fixed;
    // left:-100000px` host would render blank (pushed off the SVG viewport).
    const wrapper = document.createElement('div')
    wrapper.setAttribute('aria-hidden', 'true')
    wrapper.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;'
    // host = a trim-sized clip box; the media (PrintStage) is offset by -bleed so only
    // the trim is captured — exactly the live-preview framing.
    const host = document.createElement('div')
    host.style.cssText = [
      'position:relative',
      `width:${geo.trimWidthPx}px`,
      `height:${geo.trimHeightPx}px`,
      'overflow:hidden',
      'background:#ffffff',
    ].join(';')
    wrapper.appendChild(host)
    document.body.appendChild(wrapper)

    const root = createRoot(host)
    try {
      root.render(
        <div style={{ position: 'absolute', left: -geo.bleedPx, top: -geo.bleedPx }}>
          <PrintStage doc={doc}>{page({ doc, geo })}</PrintStage>
        </div>,
      )
      await twoFrames()
      await document.fonts?.ready
      await imagesReady(host)

      if (!fontEmbedCss) fontEmbedCss = getFontEmbedCSS(host).catch(() => '')
      const embedded = await fontEmbedCss

      const canvas = await toCanvas(host, {
        canvasWidth: outW,
        canvasHeight: outH,
        pixelRatio: 1,
        backgroundColor: '#ffffff',
        fontEmbedCSS: embedded || undefined,
        cacheBust: true,
      })

      const tex = new CanvasTexture(canvas)
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 8
      tex.magFilter = LinearFilter
      // Mipmaps: a 2048px face drawn small/angled on a wall would otherwise thrash the
      // GPU texture cache (and shimmer) when orbiting. Trilinear sampling fixes both.
      tex.minFilter = LinearMipmapLinearFilter
      tex.generateMipmaps = true
      tex.needsUpdate = true
      return tex
    } finally {
      root.unmount()
      wrapper.remove()
    }
  } finally {
    releaseRasterSlot()
  }
}

/**
 * Live realista texture for `doc`, re-rasterised whenever the `doc` or its page
 * component changes (the latter flips identity on HMR, so editing a page updates the
 * 3D view too). Returns null until the first raster lands or if it fails — the mesh
 * shows the white plate meanwhile. Disposes the previous texture only once the next
 * is in place (no flicker) and the last one on unmount.
 */
export function useLivePrintFaceTexture(doc: PrintDoc, enabled: boolean): Texture | null {
  const page = getPrintPage(doc.pageComponentId)
  const [tex, setTex] = useState<Texture | null>(null)
  const current = useRef<Texture | null>(null)

  useEffect(() => {
    if (!enabled) {
      setTex(null)
      return
    }
    let alive = true
    renderLivePrintTexture(doc)
      .then((t) => {
        if (!alive) {
          t.dispose()
          return
        }
        const prev = current.current
        current.current = t
        setTex(t)
        prev?.dispose()
        invalidate() // demand mode: redraw now that the face texture is ready
      })
      .catch((e) => {
        // Fall back to the plain plate; surface the cause for debugging.
        // eslint-disable-next-line no-console
        console.warn(`[printLiveTexture] ${doc.id} render failed`, e)
        if (alive) setTex(null)
      })
    return () => {
      alive = false
    }
    // `page` identity is a dep on purpose: it changes on HMR → re-raster on edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, page, enabled])

  // Dispose the last texture when the consumer unmounts.
  useEffect(
    () => () => {
      current.current?.dispose()
      current.current = null
    },
    [],
  )

  return tex
}
