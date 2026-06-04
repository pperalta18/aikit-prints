import { PT_PER_MM } from '../geometry'
import {
  CAP_CM_PER_METRE,
  DISPLAY_CAP_RATIO,
  capHeightMmToFontPt,
  minCapHeightMm,
} from './wayfinding'

/**
 * tipografia — the AiKit Live **event typographic system**.
 * ──────────────────────────────────────────────────────────────────────────
 * The expo's words need one coherent type voice across every wall: a small set
 * of levels (four headings + body + a locator eyebrow) whose **sizes are anchored
 * to how far away the wall is read**, not picked by eye. This module is the pure,
 * unit-testable heart of that voice — the same split the data pages use
 * (`dataviz-scales.ts`) and the wayfinding walls use (`wayfinding.ts`); the
 * presentation lives in `tipografia-kit.tsx`, the page in `tipografia.tsx`.
 *
 * Grounded in environmental-graphics practice (researched):
 *   • the museographic **legibility floor** — a cap-height of ≈**1 cm per 3 m** of
 *     reading distance (the `CAP_CM_PER_METRE` rule already in `wayfinding.ts`):
 *     the bare minimum nothing may drop below;
 *   • the **comfort** target — the exhibition rule of thumb of ≈**1 inch of
 *     cap-height per 10 ft** (~25 mm per 3 m, ~2.5× the floor): body copy is sized
 *     to *comfort* so a wall reads without effort, never to the minimum;
 *   • a **modular heading scale** — exhibition type guides put a section title at
 *     ~1.6–1.9× the level beneath it; H1 dominates by wall proportion and H2/H3
 *     step down a single ratio, so the three headings sing as one chord.
 *
 * The maths is scale-free (millimetres + points only): a page passes its trim
 * height and the wall's reading distance and gets back point sizes for `geo.pt(...)`
 * plus the rendered cap-heights in mm (so the page — and the QA pass — can document
 * the real cm sizes). Headings render in Universal Sans Display, body/eyebrow in
 * Universal Sans Text; each face only differs by its cap-height ratio.
 */

/** The wall this system is first proven on: #5 (`wall-4`), the S5→S6 bridge. */
export const TIPOGRAFIA_INV_ID = 5

/**
 * Universal Sans **Text** cap-height ÷ em (≈0.70). The display face has its own
 * ratio in `wayfinding.ts` (`DISPLAY_CAP_RATIO` ≈ 0.72); body and eyebrow use this
 * one. A different face only needs its ratio passed in — the maths is unchanged.
 */
export const TEXT_CAP_RATIO = 0.7

/**
 * Comfortable-reading cap-height, expressed (like `CAP_CM_PER_METRE`) as **cm of
 * cap-height per metre of distance**: the environmental-graphics rule of thumb of
 * ≈**1 inch of cap per 10 ft** of viewing distance = 2.54 cm / 3.048 m ≈ 0.83 cm/m.
 * About 2.5× the bare museographic floor (1 cm / 3 m). Body copy targets this.
 */
export const COMFORT_CAP_CM_PER_METRE = 2.54 / 3.048

/**
 * Default modular-scale ratio between successive heading levels — a "major sixth"
 * (~1.6), sitting in the band observed across exhibition type guides. H1 is sized
 * by wall proportion; H2 = H1 / ratio; H3 = H1 / ratio². A page may pass a larger
 * ratio for a wide, short wall where the headings should separate faster.
 */
export const EVENT_TYPE_RATIO = 1.6

/* ── the event type scale ─────────────────────────────────────────────────────── */

export type EventTypeScaleOpts = {
  /** The print canvas (trim) height in mm. */
  trimHeightMm: number
  /** The real reading distance to this wall in metres. */
  readingDistanceM: number
  /** H1 cap-height as a fraction of the trim height. Default 0.15. */
  h1CapFraction?: number
  /** Modular ratio between heading levels (> 1). Default {@link EVENT_TYPE_RATIO}. */
  ratio?: number
  /** Eyebrow cap-height as a fraction of the body cap. Default 0.7. */
  eyebrowBodyFraction?: number
  /** Body cap target as cm-per-metre. Default {@link COMFORT_CAP_CM_PER_METRE}. */
  bodyCmPerMetre?: number
  /** Display face cap ÷ em. Default {@link DISPLAY_CAP_RATIO}. */
  displayCapRatio?: number
  /** Text face cap ÷ em. Default {@link TEXT_CAP_RATIO}. */
  textCapRatio?: number
  /** Legibility-floor cm-per-metre. Default {@link CAP_CM_PER_METRE}. */
  cmPerMetre?: number
}

/** Rendered cap-heights (mm) for each level — the documented cm sizes (QA). */
export type EventTypeCapHeights = {
  h1Mm: number
  h2Mm: number
  h3Mm: number
  h4Mm: number
  bodyMm: number
  eyebrowMm: number
}

export type EventTypeScale = {
  /** Font-size (pt) for the protagonist H1. */
  h1Pt: number
  /** Font-size (pt) for the secondary H2. */
  h2Pt: number
  /** Font-size (pt) for the tertiary H3 / deck. */
  h3Pt: number
  /** Font-size (pt) for the quaternary H4 — the smallest heading. */
  h4Pt: number
  /** Font-size (pt) for body / paragraph snippets. */
  bodyPt: number
  /** Font-size (pt) for the locator eyebrow. */
  eyebrowPt: number
  /** The cap-height (mm) each level actually renders to. */
  capHeights: EventTypeCapHeights
  /** The museographic minimum cap-height (mm) at this distance (1 cm / 3 m). */
  minCapHeightMm: number
  /** The comfortable-reading cap-height (mm) at this distance (1 in / 10 ft). */
  comfortCapHeightMm: number
  /** Echoed back for the control table / QA. */
  readingDistanceM: number
  /** The modular ratio that was used. */
  ratio: number
}

/**
 * Resolve the complete event type scale for a wall graphic.
 *
 * The **four headings** are a modular chord: H1 dominates by wall proportion
 * (`h1CapFraction` of the trim height), H2 = H1 / ratio, H3 = H1 / ratio², H4 = H1 /
 * ratio³ — a single ratio so they read as one system. **Body** is sized to the
 * comfortable-reading target for the wall's distance, then clamped so it is never
 * larger than H4
 * (hierarchy holds) nor smaller than the museographic floor (always legible). The
 * **eyebrow** is a small tracked locator, a fraction of body, also floored. The
 * result reports point sizes (for `geo.pt`) and the rendered cap-heights in mm.
 * Deterministic; throws on a non-positive trim height / distance, a ratio ≤ 1, or
 * out-of-range fractions.
 */
export function eventTypeScale(opts: EventTypeScaleOpts): EventTypeScale {
  const {
    trimHeightMm,
    readingDistanceM,
    h1CapFraction = 0.15,
    ratio = EVENT_TYPE_RATIO,
    eyebrowBodyFraction = 0.7,
    bodyCmPerMetre = COMFORT_CAP_CM_PER_METRE,
    displayCapRatio = DISPLAY_CAP_RATIO,
    textCapRatio = TEXT_CAP_RATIO,
    cmPerMetre = CAP_CM_PER_METRE,
  } = opts

  if (!(trimHeightMm > 0)) throw new Error(`eventTypeScale: trimHeightMm must be > 0 (got ${trimHeightMm})`)
  if (!(readingDistanceM > 0)) throw new Error(`eventTypeScale: readingDistanceM must be > 0 (got ${readingDistanceM})`)
  if (!(ratio > 1)) throw new Error(`eventTypeScale: ratio must be > 1 (got ${ratio})`)
  if (!(h1CapFraction > 0 && h1CapFraction <= 1)) {
    throw new Error(`eventTypeScale: h1CapFraction must be in (0, 1] (got ${h1CapFraction})`)
  }
  if (!(eyebrowBodyFraction > 0 && eyebrowBodyFraction <= 1)) {
    throw new Error(`eventTypeScale: eyebrowBodyFraction must be in (0, 1] (got ${eyebrowBodyFraction})`)
  }

  const floorMm = minCapHeightMm(readingDistanceM, cmPerMetre)
  const comfortMm = minCapHeightMm(readingDistanceM, bodyCmPerMetre)

  // The four-heading chord: H1 by proportion, H2/H3/H4 step down one modular ratio.
  const h1Mm = trimHeightMm * h1CapFraction
  const h2Mm = h1Mm / ratio
  const h3Mm = h1Mm / (ratio * ratio)
  const h4Mm = h1Mm / (ratio * ratio * ratio)

  // Body: the comfort size, never above H4 (hierarchy holds) nor below the floor.
  const bodyMm = Math.max(floorMm, Math.min(comfortMm, h4Mm))
  // Eyebrow: a small tracked locator — a fraction of body, never below the floor.
  const eyebrowMm = Math.max(floorMm, bodyMm * eyebrowBodyFraction)

  return {
    h1Pt: capHeightMmToFontPt(h1Mm, displayCapRatio),
    h2Pt: capHeightMmToFontPt(h2Mm, displayCapRatio),
    h3Pt: capHeightMmToFontPt(h3Mm, displayCapRatio),
    h4Pt: capHeightMmToFontPt(h4Mm, displayCapRatio),
    bodyPt: capHeightMmToFontPt(bodyMm, textCapRatio),
    eyebrowPt: capHeightMmToFontPt(eyebrowMm, textCapRatio),
    capHeights: { h1Mm, h2Mm, h3Mm, h4Mm, bodyMm, eyebrowMm },
    minCapHeightMm: floorMm,
    comfortCapHeightMm: comfortMm,
    readingDistanceM,
    ratio,
  }
}

/* ── body measure (line length) ───────────────────────────────────────────────── */

export type MeasureOpts = {
  /** Target characters per line (the classic 45–75 measure; ~60 ideal). Default 60. */
  chars?: number
  /** Average glyph advance as a fraction of the em (≈0.5 for Universal Sans Text). Default 0.5. */
  avgCharEm?: number
}

/**
 * The recommended **column width (mm)** for a body paragraph at `bodyPt`, so a line
 * holds about `chars` characters — keeps paragraph snippets from running too wide
 * on a long wall. Throws on a non-positive input.
 */
export function bodyMeasureMm(bodyPt: number, opts: MeasureOpts = {}): number {
  if (!(bodyPt > 0)) throw new Error(`bodyMeasureMm: bodyPt must be > 0 (got ${bodyPt})`)
  const { chars = 60, avgCharEm = 0.5 } = opts
  if (!(chars > 0)) throw new Error(`bodyMeasureMm: chars must be > 0 (got ${chars})`)
  if (!(avgCharEm > 0)) throw new Error(`bodyMeasureMm: avgCharEm must be > 0 (got ${avgCharEm})`)
  const emMm = bodyPt / PT_PER_MM
  return chars * avgCharEm * emMm
}
