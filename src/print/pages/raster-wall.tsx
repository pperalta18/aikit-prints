import { type CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { PrintPageProps } from '../types'
import { resolveRasterImage } from './raster'

/**
 * raster-wall — the image-track print page.
 * ─────────────────────────────────────────
 * A full-bleed raster (PNG/JPG) mounted to the print canvas. This is the single
 * reusable page behind every image-track wall graphic (combustion, Naranja
 * Mecánica light-box, salones, real-world photo refs…): each wall is just a
 * `doc.json` whose `props.src` points at its committed asset under
 * `public/prints/<id>/assets/`. See `resolveRasterImage` for the props contract.
 *
 * Uses Remotion's `<Img>` (not a bare `<img>`) so the deterministic `renderStill`
 * export *waits* for the bitmap to decode before capturing the still — a plain
 * tag can be screenshotted blank. `staticFile` keeps the same path working in the
 * Vite preview and the bundled export.
 *
 * For photographic content set the doc's `color.renderIntent: 'perceptual'`, so
 * the sRGB→CMYK conversion compresses the whole gamut smoothly instead of
 * clipping (clipping is for flat, vivid brand colour — see `PrintColor`).
 */
export function RasterWall({ doc }: PrintPageProps) {
  const img = resolveRasterImage(doc)
  const src = staticFile(img.src)
  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: img.fit,
    objectPosition: img.position,
    display: 'block',
  }
  // Remotion's <Img> delays the still until the bitmap decodes — essential for the
  // deterministic renderStill export, but it needs a composition context and so
  // throws in the plain browser preview (PrintsApp). Use it only while rendering;
  // a bare <img> is correct (and crash-free) for the live preview.
  return getRemotionEnvironment().isRendering ? (
    <Img src={src} alt={img.alt ?? ''} style={style} />
  ) : (
    <img src={src} alt={img.alt ?? ''} style={style} />
  )
}
