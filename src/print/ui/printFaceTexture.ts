import { LinearFilter, SRGBColorSpace, Texture, TextureLoader } from 'three'

/**
 * printFaceTexture — turn a print into a **real, depth-tested WebGL texture** for the
 * event-space viewer's *realista* mode.
 * ──────────────────────────────────────────────────────────────────────────
 * In edit mode the scene paints the live React page onto each wall with a drei
 * `<Html occlude>` overlay — which floats *on top* of the geometry instead of being
 * hidden by walls in front (it is a DOM layer, not a 3D object). For "ver el espacio
 * como en la vida real" the print must be a genuine mesh texture: then the GPU depth
 * test hides whatever the eye can't see, exactly like a real vinyl on a wall.
 *
 * The texture is the print's **exported PNG** (`/api/prints-output/<id>.png`, the
 * `out/prints/<id>.png` raster the dev server renders + serves). The PNG is the full
 * *media* (trim + bleed); the wall plane is the *trim*, so the bleed is cropped with
 * a UV offset/repeat — the pure, unit-tested {@link faceCropUV} below. The loader is
 * cached per id and renders the PNG on demand (serialised, so we never spawn a dozen
 * heavy Remotion renders at once) when it isn't on disk yet.
 *
 * Dev-only: the `/api/*` endpoints come from `vite-plugin-prints`, so realista mode
 * has its textures under `npm run dev`; a static production build falls back to the
 * plain substrate plate (still occluded, just untextured).
 */

/* ── pure: crop the bleed off the media PNG so the trim fills the plane ─────────── */

export type FaceCropInput = {
  /** Full media width in px (trim + 2·bleed) — the exported PNG width. */
  mediaWidthPx: number
  /** Full media height in px (trim + 2·bleed) — the exported PNG height. */
  mediaHeightPx: number
  /** Trim (visible face) width in px. */
  trimWidthPx: number
  /** Trim (visible face) height in px. */
  trimHeightPx: number
  /** Bleed in px (the symmetric margin cropped from every edge). */
  bleedPx: number
}

export type FaceCropUV = {
  /** Texture offset [u, v] (origin bottom-left; bleed is symmetric so u === v here). */
  offset: [number, number]
  /** Texture repeat [u, v] — the trim's fraction of the media. */
  repeat: [number, number]
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * The UV offset/repeat that maps the **trim** rectangle out of the full **media**
 * PNG, so a unit plane shows the visible face with the bleed cropped away. Degrades
 * gracefully: a zero/blank media falls back to the trim size (→ full image, no crop).
 * Pure and deterministic.
 */
export function faceCropUV(g: FaceCropInput): FaceCropUV {
  const mw = g.mediaWidthPx > 0 ? g.mediaWidthPx : g.trimWidthPx
  const mh = g.mediaHeightPx > 0 ? g.mediaHeightPx : g.trimHeightPx
  if (!(mw > 0) || !(mh > 0)) return { offset: [0, 0], repeat: [1, 1] }
  const bleed = g.bleedPx > 0 ? g.bleedPx : 0
  return {
    offset: [clamp01(bleed / mw), clamp01(bleed / mh)],
    repeat: [clamp01(g.trimWidthPx / mw), clamp01(g.trimHeightPx / mh)],
  }
}

/* ── loader: exported PNG → cached three Texture (renders on demand) ───────────── */

const faceUrl = (id: string) => `/api/prints-output/${id}.png`

const loader = new TextureLoader()
const cache = new Map<string, Promise<Texture>>()

/** Serialise on-demand exports — one heavy Remotion render at a time, never a swarm. */
let exportChain: Promise<unknown> = Promise.resolve()

function queueExport(id: string): Promise<string | null> {
  const run = (): Promise<string | null> =>
    fetch('/api/export-print', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, format: 'png' }),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; output?: string | null }) => (j.ok && j.output ? j.output : null))
      .catch(() => null)
  const p = exportChain.then(run, run)
  exportChain = p.catch(() => {})
  return p
}

function loadTexture(url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = SRGBColorSpace
        tex.anisotropy = 8
        tex.magFilter = LinearFilter
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

/**
 * Load the print's face as a three {@link Texture}, cached by id. Tries the already
 * exported PNG first; if it isn't on disk, asks the dev server to render it (queued)
 * and then loads it. Rejects if no PNG can be produced (e.g. a static build with no
 * `/api`), so callers can fall back to the plain plate.
 */
export function loadPrintFaceTexture(id: string): Promise<Texture> {
  let p = cache.get(id)
  if (!p) {
    p = loadTexture(faceUrl(id)).catch(async () => {
      const url = await queueExport(id)
      if (!url) throw new Error(`printFaceTexture: no exported PNG for "${id}"`)
      return loadTexture(url)
    })
    // Don't cache a rejection — let a later attempt retry (e.g. after a manual export).
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}
