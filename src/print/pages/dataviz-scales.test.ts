/**
 * Unit tests for the code-track data-viz maths (Phase 1, "honest data-viz" kit).
 *
 * The contract these pin is *honesty*, because the whole reason the data pieces
 * are code-rendered (not image-gen) is that the geometry must be derived from the
 * numbers, not invented:
 *   • a circle's AREA — not its radius — is its value (the hero sistema solar);
 *   • a value floored to stay visible is REPORTED, never silently enlarged;
 *   • linear/log axes place values where they truly fall and round-trip on invert;
 *   • labels and the sources caption read the way the spec writes them ("$49 bn").
 *
 * Tests assert invariants and behaviour (ratios, monotonicity, round-trips), not
 * a re-pasted table, so a regression can't make the test agree with broken maths.
 */

import { describe, expect, it } from 'vitest'
import {
  circleAreaScale,
  formatCompact,
  formatMoney,
  logTicks,
  niceTicks,
  scaleLinear,
  scaleLog,
  sourceHost,
  sourcesCaption,
  SCALE_NOTE_ES,
  ENLARGED_NOTE_ES,
  type Datum,
} from './dataviz-scales'

describe('circleAreaScale — area is proportional to value', () => {
  const s = circleAreaScale({ maxValue: 1_000, maxRadius: 100 })

  it('maps the max value to the max radius', () => {
    expect(s.radius(1_000)).toBeCloseTo(100, 6)
  })

  it('radius grows as √value (half the area at half the value)', () => {
    // value/2 → radius·1/√2, not radius/2 (that would make AREA ∝ value² — the classic lie).
    expect(s.radius(500)).toBeCloseTo(100 / Math.SQRT2, 6)
  })

  it('AREA ratio equals VALUE ratio for any two on-scale values', () => {
    const ratio = s.area(800) / s.area(200)
    expect(ratio).toBeCloseTo(800 / 200, 6)
  })

  it('area is linear in value', () => {
    // area(v) / v is a constant across the domain.
    const k1 = s.area(123) / 123
    const k2 = s.area(777) / 777
    expect(k1).toBeCloseTo(k2, 6)
  })

  it('is monotonic and pins zero / negative to nothing', () => {
    expect(s.radius(10)).toBeLessThan(s.radius(20))
    expect(s.radius(0)).toBe(0)
    expect(s.radius(-5)).toBe(0)
  })

  it('reports everything on-scale when there is no floor', () => {
    expect(s.toScale(1)).toBe(true)
    expect(s.toScale(1_000)).toBe(true)
  })

  describe('with a minRadius floor (tiny marbles stay visible)', () => {
    const floored = circleAreaScale({ maxValue: 1_000_000, maxRadius: 200, minRadius: 12 })

    it('enlarges a sub-floor value up to the floor', () => {
      // honest radius of 1 is 200·√(1/1e6) = 0.2 px → floored to 12.
      expect(floored.radius(1)).toBe(12)
    })

    it('flags an enlarged value as NOT to scale', () => {
      expect(floored.toScale(1)).toBe(false)
    })

    it('leaves a value above the floor honest and on-scale', () => {
      const big = 1_000_000
      expect(floored.radius(big)).toBeCloseTo(200, 6)
      expect(floored.toScale(big)).toBe(true)
    })

    it('keeps area honest among on-scale values only', () => {
      // pick two clearly-above-floor values; their area ratio still tracks value ratio.
      expect(floored.area(900_000) / floored.area(300_000)).toBeCloseTo(3, 6)
    })
  })

  it('rejects nonsensical configuration', () => {
    expect(() => circleAreaScale({ maxValue: 0, maxRadius: 10 })).toThrow()
    expect(() => circleAreaScale({ maxValue: 100, maxRadius: 0 })).toThrow()
    expect(() => circleAreaScale({ maxValue: 100, maxRadius: 10, minRadius: -1 })).toThrow()
  })
})

describe('scaleLinear', () => {
  const s = scaleLinear({ domain: [0, 100], range: [0, 500] })

  it('maps domain endpoints to range endpoints', () => {
    expect(s(0)).toBe(0)
    expect(s(100)).toBe(500)
  })

  it('is linear at the midpoint', () => {
    expect(s(50)).toBe(250)
  })

  it('invert round-trips', () => {
    for (const v of [0, 12.5, 33, 100]) expect(s.invert(s(v))).toBeCloseTo(v, 9)
  })

  it('supports an inverted range (pixel-down axes)', () => {
    const down = scaleLinear({ domain: [0, 10], range: [400, 0] })
    expect(down(0)).toBe(400)
    expect(down(10)).toBe(0)
    expect(down(5)).toBe(200)
  })

  it('produces nice ticks inside the domain', () => {
    const t = s.ticks(5)
    expect(t[0]).toBeGreaterThanOrEqual(0)
    expect(t[t.length - 1]).toBeLessThanOrEqual(100)
    expect(t).toEqual([0, 20, 40, 60, 80, 100])
  })

  it('throws on a degenerate domain', () => {
    expect(() => scaleLinear({ domain: [5, 5], range: [0, 1] })).toThrow()
  })
})

describe('scaleLog', () => {
  const s = scaleLog({ domain: [1, 1_000], range: [0, 300] })

  it('maps domain endpoints to range endpoints', () => {
    expect(s(1)).toBeCloseTo(0, 9)
    expect(s(1_000)).toBeCloseTo(300, 9)
  })

  it('gives equal pixel steps for equal multiplicative steps (the log property)', () => {
    // ×10 in value → the same pixel advance everywhere on the axis.
    const stepA = s(10) - s(1)
    const stepB = s(100) - s(10)
    const stepC = s(1_000) - s(100)
    expect(stepB).toBeCloseTo(stepA, 6)
    expect(stepC).toBeCloseTo(stepA, 6)
    expect(stepA).toBeCloseTo(100, 6) // 3 decades across 300 px
  })

  it('invert round-trips', () => {
    for (const v of [1, 7, 42, 999]) expect(s.invert(s(v))).toBeCloseTo(v, 6)
  })

  it('ticks are the powers of the base within the domain', () => {
    expect(s.ticks()).toEqual([1, 10, 100, 1_000])
  })

  it('rejects non-positive domains and values', () => {
    expect(() => scaleLog({ domain: [0, 100], range: [0, 1] })).toThrow()
    expect(() => scaleLog({ domain: [-1, 100], range: [0, 1] })).toThrow()
    expect(() => s(0)).toThrow()
    expect(() => s(-5)).toThrow()
  })
})

describe('niceTicks / logTicks', () => {
  it('niceTicks snaps to 1·2·5·10ᵏ steps', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10])
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
  })

  it('niceTicks stays within the bounds it is given', () => {
    const t = niceTicks(3, 97, 5)
    expect(t[0]).toBeGreaterThanOrEqual(3)
    expect(t[t.length - 1]).toBeLessThanOrEqual(97)
  })

  it('niceTicks avoids floating-point dust', () => {
    // 0.1 + 0.2 territory — ticks must read cleanly, not 0.30000000004.
    for (const v of niceTicks(0, 0.5, 5)) {
      expect(v).toBe(Number(v.toFixed(10)))
    }
  })

  it('logTicks returns powers within the bounds', () => {
    expect(logTicks(1, 1_000)).toEqual([1, 10, 100, 1_000])
    expect(logTicks(50, 5_000)).toEqual([100, 1_000])
  })

  it('logTicks rejects non-positive bounds', () => {
    expect(() => logTicks(0, 100)).toThrow()
  })
})

describe('formatCompact / formatMoney', () => {
  it('uses K / M / bn / T short-scale suffixes', () => {
    expect(formatCompact(850)).toBe('850')
    expect(formatCompact(1_000)).toBe('1 K')
    expect(formatCompact(2_500_000)).toBe('2.5 M')
    expect(formatCompact(49_000_000_000)).toBe('49 bn')
    expect(formatCompact(1_300_000_000_000)).toBe('1.3 T')
  })

  it('trims trailing zeros in the mantissa', () => {
    expect(formatCompact(2_000_000)).toBe('2 M')
    expect(formatCompact(3_400_000_000)).toBe('3.4 bn')
  })

  it('handles zero and negatives', () => {
    expect(formatCompact(0)).toBe('0')
    expect(formatCompact(-49_000_000_000)).toBe('-49 bn')
  })

  it('respects the digits option', () => {
    expect(formatCompact(1_234_000_000_000, { digits: 2 })).toBe('1.23 T')
  })

  it('prefixes money with the currency, sign in front of the mark', () => {
    expect(formatMoney(49_000_000_000)).toBe('$49 bn')
    expect(formatMoney(340_000_000_000, { currency: '€' })).toBe('€340 bn')
    expect(formatMoney(-1_300_000_000_000)).toBe('-$1.3 T')
  })
})

describe('sources', () => {
  const data: Datum[] = [
    { figure: 'OpenAI valuation', value: 300e9, date: '2025-10', sourceURL: 'https://www.bloomberg.com/news/x' },
    { figure: 'Anthropic valuation', value: 183e9, date: '2025-09', sourceURL: 'https://techcrunch.com/y' },
    { figure: 'IBEX 35', value: 700e9, date: '2026-03', sourceURL: 'https://www.bolsasymercados.es/z' },
    { figure: 'Spain GDP', value: 1_600e9, date: '2025-12', sourceURL: 'bolsasymercados.es/dup' }, // same host, bare
  ]

  it('extracts a clean hostname without www', () => {
    expect(sourceHost('https://www.bloomberg.com/news/x')).toBe('bloomberg.com')
    expect(sourceHost('https://techcrunch.com/y')).toBe('techcrunch.com')
  })

  it('tolerates a bare host that is not a full URL', () => {
    expect(sourceHost('bolsasymercados.es/dup')).toBe('bolsasymercados.es')
  })

  it('builds a deduped caption with the most recent date', () => {
    const cap = sourcesCaption(data)
    expect(cap).toBe('Fuentes: bloomberg.com, techcrunch.com, bolsasymercados.es · 2026-03')
  })

  it('preserves first-seen host order and dedupes repeats', () => {
    const cap = sourcesCaption(data)
    expect(cap.indexOf('bloomberg.com')).toBeLessThan(cap.indexOf('techcrunch.com'))
    // bolsasymercados.es appears once despite two data points.
    expect(cap.match(/bolsasymercados\.es/g)).toHaveLength(1)
  })

  it('honours a custom label and empty input', () => {
    expect(sourcesCaption(data, 'Sources')).toMatch(/^Sources: /)
    expect(sourcesCaption([])).toBe('')
  })
})

describe('annotation constants', () => {
  it('carry the museographic Spanish stamps', () => {
    expect(SCALE_NOTE_ES).toMatch(/escala/i)
    expect(ENLARGED_NOTE_ES).toMatch(/no a escala/i)
  })
})
