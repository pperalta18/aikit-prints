import { describe, expect, it } from 'vitest'
import { PT_PER_MM } from '../geometry'
import {
  CAP_CM_PER_METRE,
  DISPLAY_CAP_RATIO,
  capHeightMmToFontPt,
  fontPtToCapHeightMm,
  isLegibleAtDistance,
  minCapHeightMm,
  minFontPtForDistance,
  wayfindingTypeScale,
} from './wayfinding'

/**
 * wayfinding — museographic type-sizing unit tests.
 * ─────────────────────────────────────────────────
 * A typographic wall has no chart to keep honest, but it has a legibility
 * contract the brief makes explicit — «titular cap-height ≈ 1 cm per 3 m of
 * reading distance». These tests pin that rule (`minCapHeightMm`), the
 * cap-height ⇄ font-size conversion (an exact inverse pair, since cap-height is
 * what the eye resolves at distance), and the full piece type scale: every text
 * level clears the museographic floor, the hierarchy is ordered, the rendered cm
 * sizes are self-consistent with the point sizes, and it is deterministic.
 */

const EPS = 1e-9

/* ── the 1 cm / 3 m rule ──────────────────────────────────────────────────────── */

describe('minCapHeightMm — the museographic floor', () => {
  it('is ~1 cm of cap-height per 3 m of reading distance', () => {
    expect(minCapHeightMm(3)).toBeCloseTo(10, 9) // 1 cm
    expect(minCapHeightMm(6)).toBeCloseTo(20, 9) // 2 cm
    expect(minCapHeightMm(9)).toBeCloseTo(30, 9) // 3 cm
    expect(minCapHeightMm(1.5)).toBeCloseTo(5, 9)
  })

  it('scales linearly with distance and honours a custom cm-per-metre constant', () => {
    expect(minCapHeightMm(12) / minCapHeightMm(6)).toBeCloseTo(2, 9)
    // A more generous standard (1 cm / 2 m) ⇒ taller minimum.
    expect(minCapHeightMm(6, 1 / 2)).toBeCloseTo(30, 9)
    expect(CAP_CM_PER_METRE).toBeCloseTo(1 / 3, 12)
  })

  it('throws on a non-positive distance or cm-per-metre (never a zero floor)', () => {
    expect(() => minCapHeightMm(0)).toThrow()
    expect(() => minCapHeightMm(-4)).toThrow()
    expect(() => minCapHeightMm(4, 0)).toThrow()
    expect(() => minCapHeightMm(4, -1)).toThrow()
  })
})

/* ── cap-height ⇄ font size ────────────────────────────────────────────────────── */

describe('capHeightMmToFontPt / fontPtToCapHeightMm', () => {
  it('match the cap-height ÷ em relationship and the pt-per-mm constant', () => {
    // font-size(mm) = cap / ratio; pt = mm * PT_PER_MM.
    const cap = 10
    const expectedPt = (cap / DISPLAY_CAP_RATIO) * PT_PER_MM
    expect(capHeightMmToFontPt(cap)).toBeCloseTo(expectedPt, 9)
  })

  it('are exact inverses (round-trips both ways)', () => {
    for (const cap of [1, 5, 10, 42, 576]) {
      expect(fontPtToCapHeightMm(capHeightMmToFontPt(cap))).toBeCloseTo(cap, 9)
    }
    for (const pt of [8, 12, 40, 200, 2000]) {
      expect(capHeightMmToFontPt(fontPtToCapHeightMm(pt))).toBeCloseTo(pt, 9)
    }
  })

  it('respects a non-default cap ratio in both directions', () => {
    const cap = 20
    const ratio = 0.66
    expect(fontPtToCapHeightMm(capHeightMmToFontPt(cap, ratio), ratio)).toBeCloseTo(cap, 9)
  })

  it('throws on a non-positive cap ratio', () => {
    expect(() => capHeightMmToFontPt(10, 0)).toThrow()
    expect(() => fontPtToCapHeightMm(40, -0.5)).toThrow()
  })
})

describe('minFontPtForDistance', () => {
  it('is the font size that renders the minimum legible cap-height', () => {
    expect(minFontPtForDistance(6)).toBeCloseTo(capHeightMmToFontPt(minCapHeightMm(6)), 9)
    // The cap-height that font size renders is exactly the museographic floor.
    expect(fontPtToCapHeightMm(minFontPtForDistance(9))).toBeCloseTo(minCapHeightMm(9), 9)
  })
})

describe('isLegibleAtDistance', () => {
  it('passes at or above the floor and fails below it', () => {
    expect(isLegibleAtDistance(20, 6)).toBe(true) // exactly the floor
    expect(isLegibleAtDistance(25, 6)).toBe(true)
    expect(isLegibleAtDistance(19.9, 6)).toBe(false)
    expect(isLegibleAtDistance(10, 6)).toBe(false)
  })
})

/* ── the full piece type scale ────────────────────────────────────────────────── */

describe('wayfindingTypeScale', () => {
  const base = { trimHeightMm: 1800, readingDistanceM: 4 }

  it('sizes the destination word by wall proportion (fraction × trim height)', () => {
    const s = wayfindingTypeScale({ ...base, destinationCapFraction: 0.32 })
    expect(s.capHeights.destinationMm).toBeCloseTo(1800 * 0.32, 9)
    // ...and the point size renders exactly that cap-height.
    expect(fontPtToCapHeightMm(s.destinationPt)).toBeCloseTo(s.capHeights.destinationMm, 6)
  })

  it('keeps an ordered hierarchy with every level ≥ the museographic floor', () => {
    const s = wayfindingTypeScale(base)
    expect(s.minCapHeightMm).toBeCloseTo(minCapHeightMm(4), 9)
    expect(s.capHeights.destinationMm).toBeGreaterThan(s.capHeights.eyebrowMm)
    expect(s.capHeights.eyebrowMm).toBeGreaterThanOrEqual(s.capHeights.footerMm)
    expect(s.capHeights.footerMm + EPS).toBeGreaterThanOrEqual(s.minCapHeightMm)
    // every level is legible at the reading distance
    for (const cap of [s.capHeights.destinationMm, s.capHeights.eyebrowMm, s.capHeights.footerMm]) {
      expect(isLegibleAtDistance(cap, base.readingDistanceM)).toBe(true)
    }
  })

  it('the point sizes are self-consistent with the reported cap-heights', () => {
    const s = wayfindingTypeScale(base)
    expect(fontPtToCapHeightMm(s.destinationPt)).toBeCloseTo(s.capHeights.destinationMm, 6)
    expect(fontPtToCapHeightMm(s.eyebrowPt)).toBeCloseTo(s.capHeights.eyebrowMm, 6)
    expect(fontPtToCapHeightMm(s.footerPt)).toBeCloseTo(s.capHeights.footerMm, 6)
  })

  it('clamps a sub-floor secondary level up to the museographic minimum', () => {
    // Far reading distance: the eyebrow/footer fractions fall below the floor and
    // must be lifted to it (the destination, proportion-driven, still clears it).
    const s = wayfindingTypeScale({ trimHeightMm: 1000, readingDistanceM: 24 })
    expect(s.minCapHeightMm).toBeCloseTo(minCapHeightMm(24), 9) // 80 mm
    expect(1000 * 0.42 * 0.16).toBeLessThan(s.minCapHeightMm) // 67.2 < 80 → clamped
    expect(s.capHeights.eyebrowMm).toBeCloseTo(s.minCapHeightMm, 9)
    expect(s.capHeights.footerMm).toBeCloseTo(s.minCapHeightMm, 9)
    expect(s.capHeights.destinationMm).toBeGreaterThan(s.minCapHeightMm)
  })

  it('is deterministic — same input, identical scale', () => {
    expect(wayfindingTypeScale(base)).toEqual(wayfindingTypeScale(base))
  })

  it('validates its inputs', () => {
    expect(() => wayfindingTypeScale({ trimHeightMm: 0, readingDistanceM: 4 })).toThrow()
    expect(() => wayfindingTypeScale({ trimHeightMm: 1800, readingDistanceM: 0 })).toThrow()
    expect(() => wayfindingTypeScale({ ...base, destinationCapFraction: 0 })).toThrow()
    expect(() => wayfindingTypeScale({ ...base, destinationCapFraction: 1.2 })).toThrow()
    // eyebrow must not be smaller than footer (would invert the hierarchy)
    expect(() => wayfindingTypeScale({ ...base, eyebrowCapFraction: 0.05, footerCapFraction: 0.09 })).toThrow()
  })
})
