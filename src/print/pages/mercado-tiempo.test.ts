import { describe, expect, it } from 'vitest'
import { GALAXY_SUN } from '../space/galaxy-data'
import {
  MARKET_YEARS,
  marketMaxValue,
  marketYearColor,
  ringLayout,
  moneyEs,
  moneyUs,
  marketSourcesCaption,
  projectExponential,
  PROJECTION_YEAR,
} from './mercado-tiempo'
import { KIT_BLUE } from '@/lib/neumorphism'

/**
 * mercado-tiempo — «El mercado de la IA, año a año» pure-logic tests
 * ─────────────────────────────────────────────────────────────────
 * The honesty link (the 2026 ring IS the live wall sphere), the series shape
 * (one ring per year 2019→2026, strictly growing), the area∝value ring geometry
 * with its legibility floor (only inner years nudged + flagged, outer years exact),
 * and the Spanish long-scale money labels.
 */

describe('series — identity & honesty', () => {
  it('covers 2019 → 2026, one entry per year, value-ascending', () => {
    const years = MARKET_YEARS.map((y) => y.year)
    expect(years).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
    for (let i = 1; i < MARKET_YEARS.length; i++) {
      expect(MARKET_YEARS[i].value).toBeGreaterThan(MARKET_YEARS[i - 1].value)
    }
  })

  it('wires the 2026 ring to the LIVE wall sphere (cannot drift from the installation)', () => {
    const y2026 = MARKET_YEARS.find((y) => y.year === 2026)!
    expect(y2026.value).toBe(GALAXY_SUN.value)
    expect(marketMaxValue()).toBe(GALAXY_SUN.value)
  })

  it('every year carries a value, an ISO date and a source URL', () => {
    for (const y of MARKET_YEARS) {
      expect(y.value).toBeGreaterThan(0)
      expect(y.date).toMatch(/^\d{4}(-\d{2}){0,2}$/)
      expect(() => new URL(y.sourceURL)).not.toThrow()
    }
  })

  it('paints 2026 in the brand primary; every year has a distinct colour', () => {
    expect(marketYearColor(2026)).toBe(KIT_BLUE)
    const colors = MARKET_YEARS.map((y) => marketYearColor(y.year))
    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('ringLayout — area ∝ value, with a legibility floor', () => {
  it('orders rings small→large; the largest (2026) is exactly maxRadius and to scale', () => {
    const rings = ringLayout({ maxRadiusMm: 1180 })
    expect(rings.map((r) => r.year)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
    const outer = rings[rings.length - 1]
    expect(outer.year).toBe(2026)
    expect(outer.r).toBeCloseTo(1180, 6)
    expect(outer.toScale).toBe(true)
  })

  it('makes a circle AREA proportional to its value for every to-scale ring', () => {
    const maxR = 1180
    const rings = ringLayout({ maxRadiusMm: maxR })
    const max = marketMaxValue()
    for (const r of rings.filter((x) => x.toScale)) {
      // r = maxR·√(v/max)  ⇔  (r/maxR)² = v/max
      expect((r.r / maxR) ** 2).toBeCloseTo(r.value / max, 6)
    }
  })

  it('only the smallest years are nudged out by the floor; outer years stay honest', () => {
    const rings = ringLayout({ maxRadiusMm: 1180, minInnerRadiusMm: 34, minGapMm: 16 })
    const nudged = rings.filter((r) => !r.toScale).map((r) => r.year)
    // the floor may only bite on the tiny early rings, never on 2024/2025/2026
    expect(nudged).not.toContain(2024)
    expect(nudged).not.toContain(2025)
    expect(nudged).not.toContain(2026)
    expect(nudged).toContain(2019)
    // radii strictly increase and clear the requested gap
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i].r).toBeGreaterThanOrEqual(rings[i - 1].r + 16 - 1e-6)
    }
  })

  it('rejects a non-positive maxRadius', () => {
    expect(() => ringLayout({ maxRadiusMm: 0 })).toThrow()
  })
})

describe('projectExponential — extrapolate the printed series', () => {
  it('2027 continues the exponential: bigger than 2026, ~3× year-over-year', () => {
    const { value, factor } = projectExponential(PROJECTION_YEAR)
    expect(value).toBeGreaterThan(marketMaxValue()) // past the 2026 sphere
    expect(factor).toBeGreaterThan(2.5)
    expect(factor).toBeLessThan(3.5)
    // log-linear fit over 2019→2026 lands the 2027 sphere in the multi-trillion range
    expect(value).toBeGreaterThan(4e12)
    expect(value).toBeLessThan(10e12)
  })

  it('reading the fit one year on is ≈ the per-year growth factor', () => {
    const a = projectExponential(PROJECTION_YEAR)
    const b = projectExponential(PROJECTION_YEAR + 1)
    expect(b.value / a.value).toBeCloseTo(a.factor, 4)
  })
})

describe('ringLayout — with the 2027 projection', () => {
  it('appends 2027 as the new outermost, dashed-elsewhere ring at full radius', () => {
    const rings = ringLayout({ maxRadiusMm: 1180, includeProjection: true })
    expect(rings.map((r) => r.year)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027])
    const outer = rings[rings.length - 1]
    expect(outer.year).toBe(PROJECTION_YEAR)
    expect(outer.projected).toBe(true)
    expect(outer.r).toBeCloseTo(1180, 6)
    // the projection rescales the others: 2026 is now strictly inside the 2027 ring
    const y2026 = rings.find((r) => r.year === 2026)!
    expect(y2026.projected).toBe(false)
    expect(y2026.r).toBeLessThan(outer.r)
  })

  it('keeps the historical-only layout unchanged when projection is off', () => {
    const rings = ringLayout({ maxRadiusMm: 1180 })
    expect(rings.every((r) => !r.projected)).toBe(true)
    expect(rings[rings.length - 1].year).toBe(2026)
  })
})

describe('moneyEs — Spanish long-scale labels', () => {
  it('formats trillions as «billones», thousands-of-millions and millions', () => {
    expect(moneyEs(2.33e12)).toBe('$2,3 B')
    expect(moneyEs(820e9)).toBe('$820 mil M')
    expect(moneyEs(265e9)).toBe('$265 mil M')
    expect(moneyEs(15e9)).toBe('$15 mil M')
    expect(moneyEs(1.5e9)).toBe('$1,5 mil M')
    expect(moneyEs(1.0e9)).toBe('$1 mil M')
  })
})

describe('moneyUs — American short-scale labels', () => {
  it('formats trillions as «T», billions as «B» and millions as «M» (period decimals)', () => {
    expect(moneyUs(2.33e12)).toBe('$2.3T')
    expect(moneyUs(6.8e12)).toBe('$6.8T')
    expect(moneyUs(2e12)).toBe('$2T')
    expect(moneyUs(820e9)).toBe('$820B')
    expect(moneyUs(265e9)).toBe('$265B')
    expect(moneyUs(15e9)).toBe('$15B')
    expect(moneyUs(1.5e9)).toBe('$1.5B')
    expect(moneyUs(1.0e9)).toBe('$1B')
    expect(moneyUs(5e6)).toBe('$5M')
  })
})

describe('marketSourcesCaption', () => {
  it('lists deduped source hosts and the latest date', () => {
    const cap = marketSourcesCaption()
    expect(cap.startsWith('Fuentes: ')).toBe(true)
    expect(cap).toMatch(/· \d{4}/)
  })
})
