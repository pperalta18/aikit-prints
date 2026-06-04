import { describe, expect, it } from 'vitest'
import {
  layoutModelTimeline,
  parseYear,
  summarizeGrowth,
  type ModelDatum,
  type ModelTimelineLayout,
} from './model-sizes'
import { dataForWall, pieceByInvId } from '../space/wall-data'

/**
 * model-sizes (#8) — honest-geometry unit tests.
 * ──────────────────────────────────────────────
 * The code track exists because a text-to-image model invents axes; here the
 * chart is *derived* from researched figures and must be provably honest. The
 * non-negotiable invariant is the **logarithmic** read: a perceptron (512) and
 * GPT-4 (~1.8 T) only coexist on one axis if equal *ratios* render as equal
 * *distances*. These tests pin that (a decade is a constant pixel height), the
 * linear-in-year x-axis, the orientation (bigger model = higher), determinism,
 * the growth summary, and that the **real wall-8 data** lays out honestly.
 */

const EPS = 1e-6

/** Clean synthetic set: strictly increasing in both year and value, exact decades. */
const SAMPLE: ModelDatum[] = [
  { id: 'a', label: 'A', value: 1e2, date: '2000' },
  { id: 'b', label: 'B', value: 1e4, date: '2005' },
  { id: 'c', label: 'C', value: 1e6, date: '2010' },
  { id: 'd', label: 'D', value: 1e9, date: '2020' },
]

const BOX = { width: 6000, height: 2000 } as const

function pairs<T>(xs: readonly T[]): Array<[T, T]> {
  const out: Array<[T, T]> = []
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) out.push([xs[i], xs[j]])
  return out
}

function assertInBounds(layout: ModelTimelineLayout) {
  for (const p of layout.points) {
    expect(p.x).toBeGreaterThanOrEqual(-EPS)
    expect(p.x).toBeLessThanOrEqual(layout.width + EPS)
    expect(p.y).toBeGreaterThanOrEqual(-EPS)
    expect(p.y).toBeLessThanOrEqual(layout.height + EPS)
  }
}

/* ── parseYear ────────────────────────────────────────────────────────────────── */

describe('parseYear', () => {
  it('reads the calendar year at every ISO precision', () => {
    expect(parseYear('1958')).toBe(1958)
    expect(parseYear('2019-02')).toBe(2019)
    expect(parseYear('2025-07-15')).toBe(2025)
  })

  it('throws on a date with no leading 4-digit year (never silently year 0)', () => {
    expect(() => parseYear('')).toThrow()
    expect(() => parseYear('July 2025')).toThrow()
    expect(() => parseYear('25-07')).toThrow()
  })
})

/* ── summarizeGrowth ──────────────────────────────────────────────────────────── */

describe('summarizeGrowth', () => {
  it('reports the min→max value factor, its orders of magnitude, and the year span', () => {
    const g = summarizeGrowth(SAMPLE)!
    expect(g.from.id).toBe('a') // smallest value
    expect(g.to.id).toBe('d') // largest value
    expect(g.growthFactor).toBeCloseTo(1e9 / 1e2, 6) // 1e7
    expect(g.ordersOfMagnitude).toBeCloseTo(7, 6)
    expect(g.yearSpan).toBe(20) // 2000 → 2020
  })

  it('picks from/to by value, not by time, and ignores invalid values', () => {
    const data: ModelDatum[] = [
      { id: 'big', label: 'big', value: 1e12, date: '2000' }, // earliest but largest
      { id: 'small', label: 'small', value: 1e3, date: '2024' }, // latest but smallest
      { id: 'bad', label: 'bad', value: -1, date: '2010' },
    ]
    const g = summarizeGrowth(data)!
    expect(g.from.id).toBe('small')
    expect(g.to.id).toBe('big')
    expect(g.growthFactor).toBeCloseTo(1e9, 6)
  })

  it('returns null for an empty / all-invalid set', () => {
    expect(summarizeGrowth([])).toBeNull()
    expect(summarizeGrowth([{ id: 'x', label: 'x', value: 0, date: '2020' }])).toBeNull()
  })
})

/* ── the logarithmic read (the honesty invariant) ─────────────────────────────── */

describe('logarithmic y-axis (equal ratios → equal distances)', () => {
  const layout = layoutModelTimeline(SAMPLE, BOX)

  it('places a fixed pixel height per decade across every pair of points', () => {
    // (yi - yj) / (log10 vi - log10 vj) must be one constant (the per-decade px).
    const slopes = pairs(layout.points).map(([a, b]) => (a.y - b.y) / (Math.log10(a.value) - Math.log10(b.value)))
    const first = slopes[0]
    for (const s of slopes) expect(s).toBeCloseTo(first, 6)
  })

  it('orients bigger models higher (smaller y) — never an inverted axis', () => {
    const byValue = [...layout.points].sort((a, b) => a.value - b.value)
    for (let i = 1; i < byValue.length; i++) {
      expect(byValue[i].y).toBeLessThan(byValue[i - 1].y) // larger value → higher on screen
    }
  })

  it('reports growthFactor and ordersOfMagnitude from the data (max/min)', () => {
    expect(layout.growthFactor).toBeCloseTo(1e9 / 1e2, 6)
    expect(layout.ordersOfMagnitude).toBeCloseTo(7, 6)
  })
})

describe('linear year x-axis', () => {
  const layout = layoutModelTimeline(SAMPLE, BOX)

  it('spaces points by exactly their year gap (constant px / year)', () => {
    const rates = pairs(layout.points).map(([a, b]) => (a.x - b.x) / (a.year - b.year))
    const first = rates[0]
    for (const r of rates) expect(r).toBeCloseTo(first, 6)
  })

  it('places the earliest model at x=0 and the latest at x=width (no padYears)', () => {
    const sorted = [...layout.points].sort((a, b) => a.year - b.year)
    expect(sorted[0].x).toBeCloseTo(0, 6)
    expect(sorted[sorted.length - 1].x).toBeCloseTo(layout.width, 6)
  })
})

/* ── ordering, bounds, ticks ──────────────────────────────────────────────────── */

describe('layout structure', () => {
  const layout = layoutModelTimeline(SAMPLE, BOX)

  it('orders points chronologically (year, then value)', () => {
    for (let i = 1; i < layout.points.length; i++) {
      const prev = layout.points[i - 1]
      const cur = layout.points[i]
      expect(prev.year <= cur.year).toBe(true)
      if (prev.year === cur.year) expect(prev.value <= cur.value).toBe(true)
    }
  })

  it('keeps every point inside the plot box', () => assertInBounds(layout))

  it('emits decade rungs that are powers of ten inside the padded domain, placed on the same scale', () => {
    expect(layout.yTicks.length).toBeGreaterThan(0)
    for (const t of layout.yTicks) {
      const k = Math.log10(t.value)
      expect(k).toBeCloseTo(Math.round(k), 6) // exact power of ten
      expect(t.value).toBeGreaterThanOrEqual(layout.yDomain[0] - EPS)
      expect(t.value).toBeLessThanOrEqual(layout.yDomain[1] + EPS)
      expect(t.y).toBeGreaterThanOrEqual(-EPS)
      expect(t.y).toBeLessThanOrEqual(layout.height + EPS)
    }
    // A datum whose value equals a tick lands exactly on that rung (one scale).
    const tickE4 = layout.yTicks.find((t) => Math.abs(t.value - 1e4) < EPS)!
    const pointB = layout.points.find((p) => p.value === 1e4)!
    expect(tickE4.y).toBeCloseTo(pointB.y, 6)
  })

  it('spaces consecutive decade rungs equally (a decade is a constant height)', () => {
    const ys = layout.yTicks.map((t) => t.y)
    const gaps = ys.slice(1).map((y, i) => y - ys[i])
    for (const g of gaps) expect(Math.abs(g)).toBeCloseTo(Math.abs(gaps[0]), 6)
  })
})

/* ── filtering, edge cases, determinism ───────────────────────────────────────── */

describe('robustness', () => {
  it('drops non-positive / non-finite values and lays out the rest', () => {
    const data: ModelDatum[] = [
      { id: 'ok', label: 'ok', value: 1e6, date: '2015' },
      { id: 'zero', label: 'zero', value: 0, date: '2016' },
      { id: 'neg', label: 'neg', value: -3, date: '2017' },
      { id: 'nan', label: 'nan', value: Number.NaN, date: '2018' },
      { id: 'inf', label: 'inf', value: Number.POSITIVE_INFINITY, date: '2019' },
      { id: 'ok2', label: 'ok2', value: 1e9, date: '2020' },
    ]
    const layout = layoutModelTimeline(data, BOX)
    expect(layout.points.map((p) => p.id)).toEqual(['ok', 'ok2'])
  })

  it('returns an empty layout for empty data', () => {
    const layout = layoutModelTimeline([], BOX)
    expect(layout.points).toEqual([])
    expect(layout.yTicks).toEqual([])
  })

  it('handles a single point without throwing (manufactures a valid domain)', () => {
    const layout = layoutModelTimeline([{ id: 'one', label: 'one', value: 1e6, date: '2020' }], BOX)
    expect(layout.points).toHaveLength(1)
    assertInBounds(layout)
    // x-domain was expanded around the single year, so it isn't degenerate.
    expect(layout.xDomain[0]).toBeLessThan(layout.xDomain[1])
  })

  it('throws on a non-positive canvas', () => {
    expect(() => layoutModelTimeline(SAMPLE, { width: 0, height: 100 })).toThrow()
    expect(() => layoutModelTimeline(SAMPLE, { width: 100, height: -1 })).toThrow()
  })

  it('is deterministic — same input, identical layout', () => {
    const a = layoutModelTimeline(SAMPLE, BOX)
    const b = layoutModelTimeline(SAMPLE, BOX)
    expect(b.points).toEqual(a.points)
    expect(b.yTicks).toEqual(a.yTicks)
  })
})

/* ── the real wall-8 data lays out honestly ───────────────────────────────────── */

describe('real model-size data — dataForWall(8)', () => {
  const data = dataForWall(8)

  it('points at the S2 model-size piece with its researched figures', () => {
    const piece = pieceByInvId(8)
    expect(piece?.slug).toBe('tamano-de-modelos')
    expect(data.length).toBe(6)
    for (const id of ['perceptron', 'alexnet', 'gpt2', 'gpt3', 'gpt4', 'kimi-k2']) {
      expect(data.find((d) => d.id === id)).toBeTruthy()
    }
  })

  it('spans ~10 orders of magnitude (Perceptrón 512 → GPT-4 ~1.8 T)', () => {
    const layout = layoutModelTimeline(data, BOX)
    expect(layout.growthFactor).toBeCloseTo(1.8e12 / 512, 0)
    expect(layout.ordersOfMagnitude).toBeGreaterThan(9)
    expect(layout.ordersOfMagnitude).toBeLessThan(10)
  })

  it('lays out honestly: chronological, in bounds, fixed px/decade', () => {
    const layout = layoutModelTimeline(data, BOX)
    expect(layout.points.map((p) => p.id)).toEqual(['perceptron', 'alexnet', 'gpt2', 'gpt3', 'gpt4', 'kimi-k2'])
    assertInBounds(layout)
    const slopes = pairs(layout.points).map(([a, b]) => (a.y - b.y) / (Math.log10(a.value) - Math.log10(b.value)))
    for (const s of slopes) expect(s).toBeCloseTo(slopes[0], 5)
  })

  it('rises strictly through the classic era, then dips at Kimi K2 (MoE total params) — honest, not monotone-forced', () => {
    const layout = layoutModelTimeline(data, BOX)
    // Perceptrón → GPT-4 strictly increase; the final point (Kimi K2) is smaller.
    const classic = layout.points.slice(0, 5)
    for (let i = 1; i < classic.length; i++) {
      expect(classic[i].value).toBeGreaterThan(classic[i - 1].value)
    }
    const last = layout.points[layout.points.length - 1]
    expect(last.id).toBe('kimi-k2')
    expect(last.value).toBeLessThan(classic[classic.length - 1].value) // < GPT-4
  })
})
