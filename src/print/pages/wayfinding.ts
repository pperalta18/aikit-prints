/**
 * wayfinding — the honest museographic type-sizing behind the AiKit Live
 * **typographic / wayfinding** wall graphics: the code-track pieces that carry no
 * data, only words (the S1→S2 "name + arrow" threshold #10, and the future
 * Umbral S2→S3 title-band #3 and the micro-acento #14).
 * ──────────────────────────────────────────────────────────────────────────
 * These walls have no chart to keep honest, but they *do* have a legibility
 * contract the brief makes explicit: «titular cap-height ≈ **1 cm per 3 m** of
 * reading distance» and «document the real **cm sizes** so all walls stay
 * coherent» (`specs/wall-graphics.md` · Format / museographic standards). That is
 * a measurable, unit-testable property — so it lives here as pure functions
 * (no React, no DOM), the same split the data pages use (`dataviz-scales.ts`).
 *
 * This module turns a wall's real **reading distance** into:
 *   • the **minimum legible cap-height** every text level must clear
 *     (`minCapHeightMm` — the 1 cm / 3 m rule);
 *   • the conversion between a chosen cap-height and a CSS **font-size in points**
 *     (`capHeightMmToFontPt` / `fontPtToCapHeightMm`, inverses of each other) —
 *     cap-height, not em, is what the eye actually resolves at distance;
 *   • a complete, ordered **type scale** for a piece (`wayfindingTypeScale`):
 *     the protagonist destination word, the eyebrow/locator and the discreet
 *     lockup, each guaranteed ≥ the museographic minimum, with the rendered
 *     cm sizes reported so a page (and the Phase-6 QA pass) can document them.
 *
 * The maths is scale-free (millimetres + points only); a page passes its trim
 * height and the wall's reading distance and gets back point sizes it feeds to
 * `geo.pt(...)`. See `wayfinding-kit.tsx` for the rendering.
 */

import { PT_PER_MM } from '../geometry'

const EPS = 1e-9

/* ── museographic constants ───────────────────────────────────────────────────── */

/**
 * The museographic rule of thumb: a titular cap-height of about **1 cm per 3 m**
 * of reading distance stays comfortably legible. Expressed as cm of cap-height
 * per metre of distance (1 cm / 3 m = 0.333… cm/m).
 */
export const CAP_CM_PER_METRE = 1 / 3

/** Millimetres per centimetre. */
export const MM_PER_CM = 10

/**
 * Cap-height ÷ em for the display face (Universal Sans Display ≈ 0.72). The eye
 * resolves the cap-height; CSS sizes the em, so `font-size = capHeight / ratio`.
 * A different face only needs its own ratio passed in — the maths is unchanged.
 */
export const DISPLAY_CAP_RATIO = 0.72

/* ── distance ⇄ cap-height ⇄ font size ────────────────────────────────────────── */

/**
 * The minimum legible **cap-height in millimetres** for a reading distance (m),
 * per the 1 cm / 3 m museographic rule. Throws on a non-positive distance so a
 * bad caller fails a test rather than silently producing a zero-height floor.
 */
export function minCapHeightMm(distanceM: number, cmPerMetre: number = CAP_CM_PER_METRE): number {
  if (!(distanceM > 0)) throw new Error(`minCapHeightMm: distanceM must be > 0 (got ${distanceM})`)
  if (!(cmPerMetre > 0)) throw new Error(`minCapHeightMm: cmPerMetre must be > 0 (got ${cmPerMetre})`)
  return distanceM * cmPerMetre * MM_PER_CM
}

/**
 * A cap-height (mm) → the CSS **font-size in points** that renders it, given the
 * face's cap-height ratio. Inverse of {@link fontPtToCapHeightMm}.
 */
export function capHeightMmToFontPt(capHeightMm: number, capRatio: number = DISPLAY_CAP_RATIO): number {
  if (!(capHeightMm >= 0)) throw new Error(`capHeightMmToFontPt: capHeightMm must be >= 0 (got ${capHeightMm})`)
  if (!(capRatio > 0)) throw new Error(`capHeightMmToFontPt: capRatio must be > 0 (got ${capRatio})`)
  return (capHeightMm / capRatio) * PT_PER_MM
}

/**
 * A font-size (pt) → the **cap-height it renders** in millimetres. Inverse of
 * {@link capHeightMmToFontPt}. Use it to audit a chosen pt size against the
 * museographic minimum, and to report the real cm sizes for the control table.
 */
export function fontPtToCapHeightMm(fontPt: number, capRatio: number = DISPLAY_CAP_RATIO): number {
  if (!(fontPt >= 0)) throw new Error(`fontPtToCapHeightMm: fontPt must be >= 0 (got ${fontPt})`)
  if (!(capRatio > 0)) throw new Error(`fontPtToCapHeightMm: capRatio must be > 0 (got ${capRatio})`)
  return (fontPt / PT_PER_MM) * capRatio
}

/** The minimum legible **font-size in points** for a reading distance (m). */
export function minFontPtForDistance(
  distanceM: number,
  opts: { cmPerMetre?: number; capRatio?: number } = {},
): number {
  const { cmPerMetre = CAP_CM_PER_METRE, capRatio = DISPLAY_CAP_RATIO } = opts
  return capHeightMmToFontPt(minCapHeightMm(distanceM, cmPerMetre), capRatio)
}

/**
 * Is a chosen cap-height (mm) legible at a reading distance (m)? — i.e. is it at
 * least the museographic minimum. Tolerant of float dust at the boundary.
 */
export function isLegibleAtDistance(
  capHeightMm: number,
  distanceM: number,
  cmPerMetre: number = CAP_CM_PER_METRE,
): boolean {
  return capHeightMm + EPS >= minCapHeightMm(distanceM, cmPerMetre)
}

/* ── a piece's full type scale ────────────────────────────────────────────────── */

export type WayfindingScaleOpts = {
  /** The print canvas (trim) height in mm — the wall-graphic band height. */
  trimHeightMm: number
  /** The real reading distance to this wall in metres. */
  readingDistanceM: number
  /** Destination word cap-height as a fraction of the trim height. Default 0.42. */
  destinationCapFraction?: number
  /** Eyebrow/locator cap-height as a fraction of the destination cap. Default 0.16. */
  eyebrowCapFraction?: number
  /** Lockup/footer cap-height as a fraction of the destination cap. Default 0.09. */
  footerCapFraction?: number
  /** Display face cap-height ÷ em. Default {@link DISPLAY_CAP_RATIO}. */
  capRatio?: number
  /** Override the museographic cm-per-metre constant. Default {@link CAP_CM_PER_METRE}. */
  cmPerMetre?: number
}

/** Rendered cap-heights (mm) for each level — the documented cm sizes (Phase 6 QA). */
export type WayfindingCapHeights = {
  destinationMm: number
  eyebrowMm: number
  footerMm: number
}

export type WayfindingTypeScale = {
  /** Font-size (pt) for the protagonist destination word. */
  destinationPt: number
  /** Font-size (pt) for the eyebrow / locator. */
  eyebrowPt: number
  /** Font-size (pt) for the discreet lockup / footer. */
  footerPt: number
  /** The cap-height (mm) each level actually renders to. */
  capHeights: WayfindingCapHeights
  /** The museographic minimum cap-height (mm) at this reading distance. */
  minCapHeightMm: number
  /** Echoed back for the control table / QA. */
  readingDistanceM: number
}

/**
 * Resolve the complete, ordered type scale for a typographic wall graphic.
 *
 * The destination word is the protagonist — sized by wall **proportion**
 * (`destinationCapFraction` of the trim height), because it should dominate the
 * band, not merely meet a floor. The eyebrow and footer are sized as fractions of
 * the destination but **clamped up to the museographic minimum** for the wall's
 * reading distance, so no text level is ever sub-legible. The result reports both
 * the point sizes (for `geo.pt`) and the rendered cap-heights in mm (so the page
 * and the QA pass can document the real cm sizes). Deterministic; throws on a
 * non-positive trim height / distance or out-of-range fractions.
 */
export function wayfindingTypeScale(opts: WayfindingScaleOpts): WayfindingTypeScale {
  const {
    trimHeightMm,
    readingDistanceM,
    destinationCapFraction = 0.42,
    eyebrowCapFraction = 0.16,
    footerCapFraction = 0.09,
    capRatio = DISPLAY_CAP_RATIO,
    cmPerMetre = CAP_CM_PER_METRE,
  } = opts

  if (!(trimHeightMm > 0)) throw new Error(`wayfindingTypeScale: trimHeightMm must be > 0 (got ${trimHeightMm})`)
  if (!(readingDistanceM > 0)) throw new Error(`wayfindingTypeScale: readingDistanceM must be > 0 (got ${readingDistanceM})`)
  for (const [k, v] of [
    ['destinationCapFraction', destinationCapFraction],
    ['eyebrowCapFraction', eyebrowCapFraction],
    ['footerCapFraction', footerCapFraction],
  ] as const) {
    if (!(v > 0 && v <= 1)) throw new Error(`wayfindingTypeScale: ${k} must be in (0, 1] (got ${v})`)
  }
  if (!(eyebrowCapFraction >= footerCapFraction)) {
    throw new Error('wayfindingTypeScale: eyebrowCapFraction must be >= footerCapFraction (hierarchy)')
  }

  const floorMm = minCapHeightMm(readingDistanceM, cmPerMetre)
  const destinationMm = trimHeightMm * destinationCapFraction
  // Secondary levels follow the destination but never drop below the legibility floor.
  const eyebrowMm = Math.max(floorMm, destinationMm * eyebrowCapFraction)
  const footerMm = Math.max(floorMm, destinationMm * footerCapFraction)

  return {
    destinationPt: capHeightMmToFontPt(destinationMm, capRatio),
    eyebrowPt: capHeightMmToFontPt(eyebrowMm, capRatio),
    footerPt: capHeightMmToFontPt(footerMm, capRatio),
    capHeights: { destinationMm, eyebrowMm, footerMm },
    minCapHeightMm: floorMm,
    readingDistanceM,
  }
}
