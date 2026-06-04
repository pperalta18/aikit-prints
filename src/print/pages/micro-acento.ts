/**
 * micro-acento — the layout logic behind the #14 piece "Micro-acento S5/S6"
 * (wall 14 / `wall-13`, the tiny 1.5 m typographic accent at the S5→S6 hinge).
 * ──────────────────────────────────────────────────────────────────────────
 * The brief: a «pieza diminuta (1.5 m): acento tipográfico / señalética; una frase
 * fuerte, sin datos por tamaño». As the visitor leaves S5 (Cuellos de botella — the
 * juice game, "human marginal cost → 0", *tiene sentido*) and turns toward S6
 * (Pobreza histórica — *ya pasó antes*), this micro-wall does one job: land **one
 * strong phrase**. It carries no data (`research: false`); like the other
 * typographic code pages (#10 wayfinding, #3 umbral) the only things to keep honest
 * are **legibility** and the fact that a multi-word phrase **fits** the narrow band.
 *
 * Two pure, unit-testable concerns live here (no React, no DOM — the same split the
 * other pages use, so the geometry is tested, not eyeballed):
 *
 *   • `wrapPhrase` — break the phrase into balanced lines (order preserved, at most
 *     `maxLines`) by minimising the longest line, so a short quote stacks cleanly on
 *     a 1.5 m wall instead of overflowing a single line.
 *   • `microAcentoTypeScale` — extend the museographic `wayfindingTypeScale` (the
 *     ≈1 cm cap-height / 3 m rule) so the protagonist phrase is sized to **fit its
 *     line count** inside a target band of the wall, never below the legibility
 *     floor — more lines ⇒ a smaller (or equal) cap, fewer lines ⇒ bigger.
 *
 * Layout units are scale-free (millimetres + points only). See `micro-acento.tsx`
 * for the rendering and `wayfinding.ts` for the museographic primitives this reuses.
 */

import {
  CAP_CM_PER_METRE,
  DISPLAY_CAP_RATIO,
  capHeightMmToFontPt,
  minCapHeightMm,
  wayfindingTypeScale,
  type WayfindingTypeScale,
} from './wayfinding'

/** Inventory id of the Micro-acento S5/S6 wall. */
export const MICRO_ACENTO_INV_ID = 14

/* ── balanced phrase wrapping (a short quote, stacked on a narrow wall) ─────────── */

/**
 * Break a phrase into at most `maxLines` balanced lines. Words keep their order; the
 * split minimises the **longest** line (by character count, counting one space
 * between words), so the lines read as an even stack rather than one long line and a
 * short one. Collapses runs of whitespace. Returns `[]` for an empty/blank phrase,
 * `[phrase]` for a single word. Deterministic. Throws on a non-integer / `< 1`
 * `maxLines` or a non-string phrase.
 */
export function wrapPhrase(phrase: string, opts: { maxLines?: number } = {}): string[] {
  const { maxLines = 2 } = opts
  if (typeof phrase !== 'string') throw new Error('wrapPhrase: phrase must be a string')
  if (!(Number.isInteger(maxLines) && maxLines >= 1)) {
    throw new Error(`wrapPhrase: maxLines must be an integer >= 1 (got ${maxLines})`)
  }

  const words = phrase.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines = Math.min(maxLines, words.length)
  if (lines === 1) return [words.join(' ')]

  // Minimise the longest line: binary-search the smallest line-width capacity that
  // still packs the words into `lines` (or fewer) lines, then build with it.
  const lengths = words.map((w) => w.length)
  const maxWord = Math.max(...lengths)
  const totalLine = lengths.reduce((a, b) => a + b, 0) + (words.length - 1) // all on one line

  let lo = maxWord
  let hi = totalLine
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (fitsInLines(lengths, lines, mid)) hi = mid
    else lo = mid + 1
  }
  return buildLines(words, lengths, lo)
}

/** Can the words be packed into `≤ maxLines` lines, each ≤ `cap` characters wide? */
function fitsInLines(lengths: readonly number[], maxLines: number, cap: number): boolean {
  let used = 1
  let cur = 0
  for (const len of lengths) {
    if (len > cap) return false
    const next = cur === 0 ? len : cur + 1 + len
    if (next <= cap) {
      cur = next
    } else {
      used += 1
      cur = len
      if (used > maxLines) return false
    }
  }
  return used <= maxLines
}

/** Greedily pack words into lines no wider than `cap` (after the cap is proven feasible). */
function buildLines(words: readonly string[], lengths: readonly number[], cap: number): string[] {
  const out: string[] = []
  let cur: string[] = []
  let curLen = 0
  for (let i = 0; i < words.length; i++) {
    const len = lengths[i]
    const next = cur.length === 0 ? len : curLen + 1 + len
    if (cur.length > 0 && next > cap) {
      out.push(cur.join(' '))
      cur = [words[i]]
      curLen = len
    } else {
      cur.push(words[i])
      curLen = next
    }
  }
  if (cur.length > 0) out.push(cur.join(' '))
  return out
}

/* ── type scale (one big phrase that fits its line count, + eyebrow + footer) ───── */

/** Default fraction of the trim height the phrase block may occupy. */
export const MICRO_PHRASE_BAND_FRACTION = 0.5
/** Default ceiling on the phrase cap-height as a fraction of trim height (1 line). */
export const MICRO_PHRASE_MAX_CAP_FRACTION = 0.3
/** Line-height the page renders the phrase at (matches `wayDisplay`). */
export const MICRO_LINE_HEIGHT = 0.92

export type MicroAcentoScaleOpts = {
  /** The print canvas (trim) height in mm — the micro-accent band height. */
  trimHeightMm: number
  /** The real reading distance to this wall in metres. */
  readingDistanceM: number
  /** How many lines the phrase wraps to (from {@link wrapPhrase}). Default 1. */
  lineCount?: number
  /** Fraction of the trim height the phrase block may fill. Default {@link MICRO_PHRASE_BAND_FRACTION}. */
  phraseBandFraction?: number
  /** Ceiling on the phrase cap as a fraction of trim height. Default {@link MICRO_PHRASE_MAX_CAP_FRACTION}. */
  maxPhraseCapFraction?: number
  /** Line-height used to fit the lines. Default {@link MICRO_LINE_HEIGHT}. */
  lineHeight?: number
  /** Display face cap-height ÷ em. Default {@link DISPLAY_CAP_RATIO}. */
  capRatio?: number
  /** Override the museographic cm-per-metre constant. Default {@link CAP_CM_PER_METRE}. */
  cmPerMetre?: number
}

export type MicroAcentoTypeScale = WayfindingTypeScale & {
  /** Font-size (pt) for the protagonist phrase. */
  phrasePt: number
  /** The cap-height (mm) the phrase renders to. */
  phraseCapMm: number
  /** Echoed back: the line count the phrase was sized for. */
  lineCount: number
}

/**
 * Resolve the type scale for the micro-accent. The phrase is the protagonist, but on
 * a tiny wall it must also **fit**: its cap-height is the largest that keeps
 * `lineCount` lines inside `phraseBandFraction` of the trim height, capped at
 * `maxPhraseCapFraction` (so a one-liner doesn't grow absurdly) and floored at the
 * museographic minimum for the reading distance (so it is never sub-legible). The
 * eyebrow/footer levels follow the phrase via the underlying {@link wayfindingTypeScale}
 * (each clamped up to the same floor). Reports point sizes (for `geo.pt`) and the
 * rendered cap-heights (mm) for the Phase-6 QA control table. Deterministic; throws
 * via the underlying scale on a non-positive trim height / distance.
 */
export function microAcentoTypeScale(opts: MicroAcentoScaleOpts): MicroAcentoTypeScale {
  const {
    trimHeightMm,
    readingDistanceM,
    lineCount = 1,
    phraseBandFraction = MICRO_PHRASE_BAND_FRACTION,
    maxPhraseCapFraction = MICRO_PHRASE_MAX_CAP_FRACTION,
    lineHeight = MICRO_LINE_HEIGHT,
    capRatio = DISPLAY_CAP_RATIO,
    cmPerMetre = CAP_CM_PER_METRE,
  } = opts

  if (!(trimHeightMm > 0)) throw new Error(`microAcentoTypeScale: trimHeightMm must be > 0 (got ${trimHeightMm})`)
  if (!(Number.isInteger(lineCount) && lineCount >= 1)) {
    throw new Error(`microAcentoTypeScale: lineCount must be an integer >= 1 (got ${lineCount})`)
  }
  for (const [k, v] of [
    ['phraseBandFraction', phraseBandFraction],
    ['maxPhraseCapFraction', maxPhraseCapFraction],
  ] as const) {
    if (!(v > 0 && v <= 1)) throw new Error(`microAcentoTypeScale: ${k} must be in (0, 1] (got ${v})`)
  }
  if (!(lineHeight > 0)) throw new Error(`microAcentoTypeScale: lineHeight must be > 0 (got ${lineHeight})`)

  // Validates readingDistanceM > 0 and gives the legibility floor.
  const floorMm = minCapHeightMm(readingDistanceM, cmPerMetre)

  // The cap that fits `lineCount` lines inside the phrase band: each line's rendered
  // box is ≈ cap/capRatio · lineHeight tall, and the block must clear the band.
  const fitCapMm = (trimHeightMm * phraseBandFraction * capRatio) / (lineCount * lineHeight)
  const maxCapMm = trimHeightMm * maxPhraseCapFraction
  const phraseCapMm = Math.max(floorMm, Math.min(maxCapMm, fitCapMm))

  // The phrase rides the destination slot; this also sizes the eyebrow/footer above the floor.
  const base = wayfindingTypeScale({
    trimHeightMm,
    readingDistanceM,
    destinationCapFraction: Math.min(1, phraseCapMm / trimHeightMm),
    capRatio,
    cmPerMetre,
  })

  return {
    ...base,
    // Canonical phrase metrics — exact, not via the fraction round-trip.
    destinationPt: capHeightMmToFontPt(phraseCapMm, capRatio),
    capHeights: { ...base.capHeights, destinationMm: phraseCapMm },
    phrasePt: capHeightMmToFontPt(phraseCapMm, capRatio),
    phraseCapMm,
    lineCount,
  }
}
