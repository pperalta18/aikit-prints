import { describe, expect, it } from 'vitest'
import {
  COMFORT_CAP_CM_PER_METRE,
  EVENT_TYPE_RATIO,
  TEXT_CAP_RATIO,
  bodyMeasureMm,
  eventTypeScale,
} from './tipografia'
import {
  CAP_CM_PER_METRE,
  DISPLAY_CAP_RATIO,
  fontPtToCapHeightMm,
  isLegibleAtDistance,
  minCapHeightMm,
} from './wayfinding'

/**
 * tipografia — event type-system unit tests
 * ─────────────────────────────────────────
 * The presentation lives in `tipografia-kit.tsx` / `tipografia.tsx`; the honest,
 * measurable part is here: the three headings are a modular chord, body is sized to
 * the comfortable-reading target and clamped into the hierarchy, and **no level ever
 * drops below the museographic legibility floor** for the wall's reading distance.
 */

const BASE = { trimHeightMm: 2500, readingDistanceM: 3 }

describe('eventTypeScale — the four-heading chord', () => {
  it('sizes H1 by wall proportion and steps H2/H3/H4 down one modular ratio', () => {
    const s = eventTypeScale({ ...BASE, ratio: 1.9, h1CapFraction: 0.15 })
    expect(s.capHeights.h1Mm).toBeCloseTo(2500 * 0.15, 9)
    expect(s.capHeights.h2Mm).toBeCloseTo(s.capHeights.h1Mm / 1.9, 9)
    expect(s.capHeights.h3Mm).toBeCloseTo(s.capHeights.h1Mm / (1.9 * 1.9), 9)
    expect(s.capHeights.h4Mm).toBeCloseTo(s.capHeights.h1Mm / (1.9 * 1.9 * 1.9), 9)
    expect(s.ratio).toBe(1.9)
  })

  it('defaults to the major-sixth ratio', () => {
    const s = eventTypeScale(BASE)
    expect(s.ratio).toBe(EVENT_TYPE_RATIO)
    expect(s.capHeights.h2Mm).toBeCloseTo(s.capHeights.h1Mm / EVENT_TYPE_RATIO, 9)
  })

  it('keeps a strict descending hierarchy H1 > H2 > H3 > H4 ≥ body', () => {
    const s = eventTypeScale(BASE)
    expect(s.capHeights.h1Mm).toBeGreaterThan(s.capHeights.h2Mm)
    expect(s.capHeights.h2Mm).toBeGreaterThan(s.capHeights.h3Mm)
    expect(s.capHeights.h3Mm).toBeGreaterThan(s.capHeights.h4Mm)
    expect(s.capHeights.h4Mm).toBeGreaterThanOrEqual(s.capHeights.bodyMm)
    expect(s.capHeights.bodyMm).toBeGreaterThan(0)
    // points follow the same order
    expect(s.h1Pt).toBeGreaterThan(s.h2Pt)
    expect(s.h2Pt).toBeGreaterThan(s.h3Pt)
    expect(s.h3Pt).toBeGreaterThan(s.h4Pt)
  })
})

describe('eventTypeScale — distance-anchored body + comfort vs floor', () => {
  it('reports the museographic floor (1 cm / 3 m) and the comfort target (1 in / 10 ft)', () => {
    const s = eventTypeScale(BASE)
    expect(s.minCapHeightMm).toBeCloseTo(minCapHeightMm(3, CAP_CM_PER_METRE), 9)
    expect(s.comfortCapHeightMm).toBeCloseTo(minCapHeightMm(3, COMFORT_CAP_CM_PER_METRE), 9)
    // comfort is ~2.5× the bare floor, and always strictly larger
    expect(s.comfortCapHeightMm).toBeGreaterThan(s.minCapHeightMm)
    expect(s.comfortCapHeightMm / s.minCapHeightMm).toBeCloseTo(2.5, 1)
  })

  it('sizes body to the comfort target when it fits under H4', () => {
    const s = eventTypeScale(BASE) // tall wall → H4 ≫ comfort, so body == comfort
    expect(s.capHeights.bodyMm).toBeCloseTo(s.comfortCapHeightMm, 9)
    expect(s.capHeights.bodyMm).toBeLessThanOrEqual(s.capHeights.h4Mm)
  })

  it('clamps body down to H4 on a tiny band where comfort would break the hierarchy', () => {
    // A short band + far wall: comfort would exceed H4 → body pinned to H4.
    const s = eventTypeScale({ trimHeightMm: 300, readingDistanceM: 8, ratio: 1.7, h1CapFraction: 0.5 })
    expect(s.comfortCapHeightMm).toBeGreaterThan(s.capHeights.h4Mm)
    expect(s.capHeights.bodyMm).toBeCloseTo(s.capHeights.h4Mm, 9)
  })

  it('never drops any level below the legibility floor', () => {
    const s = eventTypeScale({ ...BASE, readingDistanceM: 5 })
    for (const cap of Object.values(s.capHeights)) {
      expect(isLegibleAtDistance(cap, 5)).toBe(true)
      expect(cap).toBeGreaterThanOrEqual(s.minCapHeightMm - 1e-9)
    }
  })

  it('sizes the eyebrow as a fraction of body, floored to legibility', () => {
    const s = eventTypeScale(BASE)
    // body * 0.7 stays above the floor at this distance → eyebrow == body * 0.7
    expect(s.capHeights.eyebrowMm).toBeCloseTo(s.capHeights.bodyMm * 0.7, 9)
    expect(s.capHeights.eyebrowMm).toBeGreaterThanOrEqual(s.minCapHeightMm - 1e-9)
  })
})

describe('eventTypeScale — pt ⇄ cap round-trips and determinism', () => {
  it('each point size renders back to its reported cap-height (per face)', () => {
    const s = eventTypeScale(BASE)
    expect(fontPtToCapHeightMm(s.h1Pt, DISPLAY_CAP_RATIO)).toBeCloseTo(s.capHeights.h1Mm, 6)
    expect(fontPtToCapHeightMm(s.h2Pt, DISPLAY_CAP_RATIO)).toBeCloseTo(s.capHeights.h2Mm, 6)
    expect(fontPtToCapHeightMm(s.h3Pt, DISPLAY_CAP_RATIO)).toBeCloseTo(s.capHeights.h3Mm, 6)
    expect(fontPtToCapHeightMm(s.h4Pt, DISPLAY_CAP_RATIO)).toBeCloseTo(s.capHeights.h4Mm, 6)
    expect(fontPtToCapHeightMm(s.bodyPt, TEXT_CAP_RATIO)).toBeCloseTo(s.capHeights.bodyMm, 6)
    expect(fontPtToCapHeightMm(s.eyebrowPt, TEXT_CAP_RATIO)).toBeCloseTo(s.capHeights.eyebrowMm, 6)
  })

  it('is deterministic', () => {
    expect(JSON.stringify(eventTypeScale(BASE))).toBe(JSON.stringify(eventTypeScale(BASE)))
  })

  it('throws on invalid inputs', () => {
    expect(() => eventTypeScale({ trimHeightMm: 0, readingDistanceM: 3 })).toThrow()
    expect(() => eventTypeScale({ trimHeightMm: 2500, readingDistanceM: 0 })).toThrow()
    expect(() => eventTypeScale({ ...BASE, ratio: 1 })).toThrow()
    expect(() => eventTypeScale({ ...BASE, h1CapFraction: 0 })).toThrow()
    expect(() => eventTypeScale({ ...BASE, h1CapFraction: 1.2 })).toThrow()
    expect(() => eventTypeScale({ ...BASE, eyebrowBodyFraction: 0 })).toThrow()
  })
})

describe('bodyMeasureMm — line length', () => {
  it('is positive and grows with the character target', () => {
    const s = eventTypeScale(BASE)
    const narrow = bodyMeasureMm(s.bodyPt, { chars: 45 })
    const wide = bodyMeasureMm(s.bodyPt, { chars: 75 })
    expect(narrow).toBeGreaterThan(0)
    expect(wide).toBeGreaterThan(narrow)
  })

  it('scales with the body font size', () => {
    expect(bodyMeasureMm(200)).toBeCloseTo(2 * bodyMeasureMm(100), 6)
  })

  it('throws on invalid inputs', () => {
    expect(() => bodyMeasureMm(0)).toThrow()
    expect(() => bodyMeasureMm(100, { chars: 0 })).toThrow()
    expect(() => bodyMeasureMm(100, { avgCharEm: 0 })).toThrow()
  })
})
