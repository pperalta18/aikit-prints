import { describe, expect, it } from 'vitest'
import {
  MICRO_ACENTO_INV_ID,
  MICRO_LINE_HEIGHT,
  MICRO_PHRASE_BAND_FRACTION,
  MICRO_PHRASE_MAX_CAP_FRACTION,
  microAcentoTypeScale,
  wrapPhrase,
} from './micro-acento'
import { capHeightMmToFontPt, fontPtToCapHeightMm, isLegibleAtDistance, minCapHeightMm } from './wayfinding'

/**
 * micro-acento (#14) — pure layout logic tests
 * ────────────────────────────────────────────
 * Two unbiased, render-free concerns: that `wrapPhrase` breaks a phrase into
 * balanced lines (order preserved, never more than asked, minimising the longest
 * line so it stacks cleanly on the 1.5 m wall), and that `microAcentoTypeScale`
 * sizes the protagonist phrase to fit its line count while keeping every text level
 * legible at the wall's reading distance. The museographic primitives
 * (`wayfinding.ts`) have their own tests; here we only prove what #14 adds.
 */

describe('micro-acento — identity', () => {
  it('targets wall 14', () => {
    expect(MICRO_ACENTO_INV_ID).toBe(14)
  })
})

describe('wrapPhrase — balanced, order-preserving line breaking', () => {
  it('keeps a single word on one line', () => {
    expect(wrapPhrase('Inevitable', { maxLines: 2 })).toEqual(['Inevitable'])
  })

  it('preserves every word in order across the lines', () => {
    const phrase = 'Ya pasó antes y volverá a pasar'
    const lines = wrapPhrase(phrase, { maxLines: 3 })
    expect(lines.join(' ').split(/\s+/)).toEqual(phrase.split(/\s+/))
  })

  it('never returns more than maxLines lines', () => {
    for (const maxLines of [1, 2, 3, 4]) {
      const lines = wrapPhrase('uno dos tres cuatro cinco seis', { maxLines })
      expect(lines.length).toBeLessThanOrEqual(maxLines)
      expect(lines.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('minimises the longest line — balances a 3-word ASCII phrase into 2 lines', () => {
    // "data is destiny" → ["data is", "destiny"] (max 7) beats ["data", "is destiny"] (max 9)
    expect(wrapPhrase('data is destiny', { maxLines: 2 })).toEqual(['data is', 'destiny'])
  })

  it('forces one line per word at maxLines high enough, still in order', () => {
    expect(wrapPhrase('a bb ccc', { maxLines: 3 })).toEqual(['a', 'bb', 'ccc'])
  })

  it('collapses runs of whitespace and trims', () => {
    expect(wrapPhrase('  Ya   pasó   antes  ', { maxLines: 1 })).toEqual(['Ya pasó antes'])
  })

  it('returns [] for an empty or blank phrase', () => {
    expect(wrapPhrase('', { maxLines: 2 })).toEqual([])
    expect(wrapPhrase('   ', { maxLines: 2 })).toEqual([])
  })

  it('defaults to 2 lines and is deterministic', () => {
    expect(wrapPhrase('uno dos tres')).toEqual(wrapPhrase('uno dos tres', { maxLines: 2 }))
    expect(wrapPhrase('Ya pasó antes')).toEqual(wrapPhrase('Ya pasó antes'))
  })

  it('never splits an individual word (the longest word fits a line)', () => {
    const lines = wrapPhrase('internacionalización es larga', { maxLines: 3 })
    expect(lines).toContain('internacionalización')
  })

  it('throws on an invalid maxLines or a non-string phrase', () => {
    expect(() => wrapPhrase('x', { maxLines: 0 })).toThrow()
    expect(() => wrapPhrase('x', { maxLines: 1.5 })).toThrow()
    // @ts-expect-error — guarding runtime callers
    expect(() => wrapPhrase(42)).toThrow()
  })
})

describe('microAcentoTypeScale — a phrase sized to fit its lines, legibly', () => {
  const opts = { trimHeightMm: 1000, readingDistanceM: 3 }

  it('clears the museographic floor on every level, with a dominant phrase', () => {
    const s = microAcentoTypeScale({ ...opts, lineCount: 2 })
    expect(s.minCapHeightMm).toBeCloseTo(minCapHeightMm(opts.readingDistanceM), 9)
    for (const cap of [s.phraseCapMm, s.capHeights.eyebrowMm, s.capHeights.footerMm]) {
      expect(isLegibleAtDistance(cap, opts.readingDistanceM)).toBe(true)
    }
    // the phrase is the protagonist
    expect(s.phraseCapMm).toBeGreaterThan(s.capHeights.eyebrowMm)
    expect(s.phraseCapMm).toBeGreaterThan(s.capHeights.footerMm)
    // destination metrics mirror the phrase exactly
    expect(s.capHeights.destinationMm).toBeCloseTo(s.phraseCapMm, 9)
    expect(s.destinationPt).toBeCloseTo(s.phrasePt, 9)
  })

  it('fits the phrase block inside the band fraction for the given line count', () => {
    for (const lineCount of [1, 2, 3]) {
      const s = microAcentoTypeScale({ ...opts, lineCount })
      // rendered block height ≈ lineCount · (cap / capRatio) · lineHeight
      const blockMm = lineCount * (s.phraseCapMm / 0.72) * MICRO_LINE_HEIGHT
      const bandMm = opts.trimHeightMm * MICRO_PHRASE_BAND_FRACTION
      // never overflow the band (floats: allow a hair)
      expect(blockMm).toBeLessThanOrEqual(bandMm + 1e-6)
    }
  })

  it('shrinks (never grows) the phrase cap as the line count rises', () => {
    const one = microAcentoTypeScale({ ...opts, lineCount: 1 }).phraseCapMm
    const two = microAcentoTypeScale({ ...opts, lineCount: 2 }).phraseCapMm
    const three = microAcentoTypeScale({ ...opts, lineCount: 3 }).phraseCapMm
    expect(one).toBeGreaterThanOrEqual(two)
    expect(two).toBeGreaterThanOrEqual(three)
  })

  it('caps a single line at the max cap fraction (no absurd growth)', () => {
    const s = microAcentoTypeScale({ ...opts, lineCount: 1 })
    expect(s.phraseCapMm).toBeLessThanOrEqual(opts.trimHeightMm * MICRO_PHRASE_MAX_CAP_FRACTION + 1e-9)
  })

  it('clamps the phrase up to the legibility floor on a tiny, far wall', () => {
    const far = microAcentoTypeScale({ trimHeightMm: 120, readingDistanceM: 20, lineCount: 3 })
    const floor = minCapHeightMm(20)
    expect(far.phraseCapMm).toBeCloseTo(floor, 9)
    expect(isLegibleAtDistance(far.phraseCapMm, 20)).toBe(true)
  })

  it('reports a phrase pt consistent with its cap-height (round-trip)', () => {
    const s = microAcentoTypeScale({ ...opts, lineCount: 2 })
    expect(s.phrasePt).toBeCloseTo(capHeightMmToFontPt(s.phraseCapMm), 9)
    expect(fontPtToCapHeightMm(s.phrasePt)).toBeCloseTo(s.phraseCapMm, 9)
  })

  it('is deterministic and throws on invalid input', () => {
    expect(microAcentoTypeScale({ ...opts, lineCount: 2 })).toEqual(microAcentoTypeScale({ ...opts, lineCount: 2 }))
    expect(() => microAcentoTypeScale({ trimHeightMm: 0, readingDistanceM: 3 })).toThrow()
    expect(() => microAcentoTypeScale({ trimHeightMm: 1000, readingDistanceM: 0 })).toThrow()
    expect(() => microAcentoTypeScale({ ...opts, lineCount: 0 })).toThrow()
    expect(() => microAcentoTypeScale({ ...opts, lineCount: 2.5 })).toThrow()
    expect(() => microAcentoTypeScale({ ...opts, phraseBandFraction: 0 })).toThrow()
    expect(() => microAcentoTypeScale({ ...opts, maxPhraseCapFraction: 1.5 })).toThrow()
  })
})
