import type { PrintDoc } from '../types'

/**
 * raster — pure resolution logic for the image-track print page.
 * ──────────────────────────────────────────────────────────────
 * The image-track wall graphics (combustion, Naranja Mecánica light-box,
 * salones, real-world photo refs…) are all the *same* React page — a full-bleed
 * raster — differing only by which committed PNG/JPG they mount. This module
 * turns a `PrintDoc`'s `props` into a normalised image descriptor; the maths is
 * JSX-free so it unit-tests in the node project (same split as `dataviz-scales`).
 *
 * Contract (the `raster-wall` page + every image-track `doc.json` rely on it):
 *   • `props.src`      path relative to `public/`, for Remotion `staticFile()`.
 *                      Absent → the convention `prints/<id>/assets/<id>.png`.
 *   • `props.fit`      'cover' (full-bleed, default) | 'contain'.
 *   • `props.position` CSS object-position (default 'center').
 *   • `props.alt`      description (sources note / accessibility).
 */

/** How a raster fills its print canvas. `cover` = full-bleed (default). */
export type RasterFit = 'cover' | 'contain'

export type RasterImage = {
  /** Path relative to `public/`, ready for Remotion `staticFile()`. */
  src: string
  fit: RasterFit
  /** CSS object-position, e.g. 'center' or '50% 30%'. */
  position: string
  /** Optional description (carried for accessibility / the sources note). */
  alt?: string
}

/** The slice of a `PrintDoc` the raster resolver needs (id + props). */
export type PrintDocLike = Pick<PrintDoc, 'id' | 'props'>

const FITS: readonly RasterFit[] = ['cover', 'contain']

/** Convention asset location for a raster print: `prints/<id>/assets/<id>.png`. */
export function defaultRasterSrc(id: string): string {
  return `prints/${id}/assets/${id}.png`
}

/**
 * Normalise a `staticFile`-relative path. `staticFile('prints/x.png')` expects a
 * path *relative* to `public/`, so a leading "/" or an accidental "public/"
 * prefix would resolve to the wrong place; collapse `//` runs too. Returns the
 * path unchanged otherwise.
 */
export function normalizeRasterSrc(src: string): string {
  return String(src)
    .trim()
    .replace(/^\/+/, '') // no leading slash — staticFile wants a relative path
    .replace(/^public\//, '') // public/ is the staticFile root, not part of the path
    .replace(/\/{2,}/g, '/') // collapse accidental double slashes
}

/**
 * Resolve the raster image descriptor from a print doc. Falls back to the
 * convention path when `props.src` is absent (so a doc can be as small as
 * `{ pageComponentId: 'raster-wall' }`), defaults to full-bleed `cover`, and
 * ignores an unknown `fit` value rather than passing junk to CSS. Pure: no DOM,
 * no `staticFile` — the component layers those on top.
 */
export function resolveRasterImage(doc: PrintDocLike): RasterImage {
  const props = (doc.props ?? {}) as Record<string, unknown>
  const rawSrc =
    typeof props.src === 'string' && props.src.trim() ? props.src : defaultRasterSrc(doc.id)
  const fit: RasterFit = FITS.includes(props.fit as RasterFit) ? (props.fit as RasterFit) : 'cover'
  const position =
    typeof props.position === 'string' && props.position.trim() ? props.position.trim() : 'center'
  const alt = typeof props.alt === 'string' ? props.alt : undefined
  return { src: normalizeRasterSrc(rawSrc), fit, position, alt }
}
