import { describe, expect, it } from 'vitest'
import {
  ACELERACION_INV_ID,
  ACELERACION_LAYOUT,
  chartInputFor,
  formatChartValue,
  formatDuration,
  planAccelerationLayout,
  planAccelerationPanels,
  type ChartInput,
} from './aceleracion'
import { piecesByInvId } from '../space/wall-data'

/**
 * aceleracion (#11) — honest-geometry unit tests.
 * ──────────────────────────────────────────────
 * Wall 11 carries two acceleration charts (task horizon in seconds, context window
 * in tokens) side by side. The page composes the unit-tested `layoutModelTimeline`
 * (log-value timeline) with a column splitter and a unit-aware value formatter.
 * These tests pin the *new* logic: the duration formatter, the per-unit label
 * choice, the zoned-column tiling (columns cover the canvas, equal widths, gap
 * respected, each column an honest log timeline), and that the **real wall-11 data**
 * lays out honestly as two logarithmic series.
 */

const EPS = 1e-6

/** Two clean synthetic charts: distinct years + values, exact decades. */
const CHART_A: ChartInput = {
  slug: 'a',
  title: 'A',
  unit: 'seconds',
  data: [
    { id: 'a1', label: 'A1', value: 1e0, date: '2019' },
    { id: 'a2', label: 'A2', value: 1e2, date: '2021' },
    { id: 'a3', label: 'A3', value: 1e4, date: '2025' },
  ],
}
const CHART_B: ChartInput = {
  slug: 'b',
  title: 'B',
  unit: 'tokens',
  data: [
    { id: 'b1', label: 'B1', value: 1e3, date: '2020' },
    { id: 'b2', label: 'B2', value: 1e6, date: '2024' },
  ],
}

const BOX = { width: 5000, height: 1500, gap: 300 } as const

function pairs<T>(xs: readonly T[]): Array<[T, T]> {
  const out: Array<[T, T]> = []
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) out.push([xs[i], xs[j]])
  return out
}

/* ── formatDuration ───────────────────────────────────────────────────────────── */

describe('formatDuration', () => {
  it('formats seconds / minutes / hours the way the wall reads them', () => {
    expect(formatDuration(2)).toBe('2 s')
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(60)).toBe('1 min')
    expect(formatDuration(240)).toBe('4 min')
    expect(formatDuration(2280)).toBe('38 min')
    expect(formatDuration(3600)).toBe('1 h')
    expect(formatDuration(7200)).toBe('2 h')
    expect(formatDuration(7260)).toBe('2 h 1 min')
  })

  it('rolls a minute that rounds to 60 into the next hour (never "1 h 60 min")', () => {
    expect(formatDuration(7170)).toBe('2 h') // 1 h + 59.5 min → 2 h
  })

  it('returns a dash for non-positive / non-finite input rather than a wrong label', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(-5)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

/* ── formatChartValue ─────────────────────────────────────────────────────────── */

describe('formatChartValue', () => {
  it('uses a duration for the seconds chart and a compact magnitude otherwise', () => {
    expect(formatChartValue(240, 'seconds')).toBe('4 min')
    expect(formatChartValue(7260, 'seconds')).toBe('2 h 1 min')
    expect(formatChartValue(2048, 'tokens')).toBe('2 K')
    expect(formatChartValue(200000, 'tokens')).toBe('200 K')
    expect(formatChartValue(1000000, 'tokens')).toBe('1 M')
  })
})

/* ── chartInputFor ────────────────────────────────────────────────────────────── */

describe('chartInputFor', () => {
  it('lifts the piece unit from its first datum', () => {
    const ci = chartInputFor({ slug: 's', title: 'T', data: [{ id: 'x', label: 'X', value: 5, date: '2024', unit: 'tokens' }] })
    expect(ci).toMatchObject({ slug: 's', title: 'T', unit: 'tokens' })
    expect(ci.data).toHaveLength(1)
  })

  it('degrades to an empty unit when a piece has no data (never throws)', () => {
    expect(chartInputFor({ slug: 's', title: 'T', data: [] }).unit).toBe('')
  })
})

/* ── planAccelerationPanels (zoned columns) ───────────────────────────────────── */

describe('planAccelerationPanels', () => {
  const panels = planAccelerationPanels([CHART_A, CHART_B], BOX)

  it('returns one panel per chart, in input order', () => {
    expect(panels.map((p) => p.slug)).toEqual(['a', 'b'])
  })

  it('tiles the canvas width exactly: first at x=0, last edge pinned to width', () => {
    expect(panels[0].x).toBeCloseTo(0, 6)
    const last = panels[panels.length - 1]
    expect(last.x + last.width).toBeCloseTo(BOX.width, 6)
  })

  it('gives every column an equal width', () => {
    const w0 = panels[0].width
    for (const p of panels) expect(p.width).toBeCloseTo(w0, 6)
  })

  it('separates adjacent columns by exactly the gap', () => {
    for (let i = 1; i < panels.length; i++) {
      const gap = panels[i].x - (panels[i - 1].x + panels[i - 1].width)
      expect(gap).toBeCloseTo(BOX.gap, 6)
    }
  })

  it('lays each column out as an honest log timeline (in-bounds, constant px/decade)', () => {
    for (const panel of panels) {
      for (const pt of panel.timeline.points) {
        expect(pt.x).toBeGreaterThanOrEqual(-EPS)
        expect(pt.x).toBeLessThanOrEqual(panel.width + EPS)
        expect(pt.y).toBeGreaterThanOrEqual(-EPS)
        expect(pt.y).toBeLessThanOrEqual(panel.height + EPS)
      }
      const slopes = pairs(panel.timeline.points).map(([a, b]) => (a.y - b.y) / (Math.log10(a.value) - Math.log10(b.value)))
      for (const s of slopes) expect(s).toBeCloseTo(slopes[0], 6)
    }
  })

  it('reports each column growth (factor + orders + year span)', () => {
    const [a, b] = panels
    expect(a.growth?.growthFactor).toBeCloseTo(1e4, 6)
    expect(a.growth?.ordersOfMagnitude).toBeCloseTo(4, 6)
    expect(a.growth?.yearSpan).toBe(6) // 2019 → 2025
    expect(b.growth?.growthFactor).toBeCloseTo(1e3, 6)
    expect(b.growth?.yearSpan).toBe(4) // 2020 → 2024
  })

  it('handles a single chart (one full-width column) and an empty set', () => {
    const one = planAccelerationPanels([CHART_A], { width: 4000, height: 1000 })
    expect(one).toHaveLength(1)
    expect(one[0].x).toBeCloseTo(0, 6)
    expect(one[0].width).toBeCloseTo(4000, 6)
    expect(planAccelerationPanels([], BOX)).toEqual([])
  })

  it('is deterministic — same input, identical panels', () => {
    const a = planAccelerationPanels([CHART_A, CHART_B], BOX)
    const b = planAccelerationPanels([CHART_A, CHART_B], BOX)
    expect(b.map((p) => [p.x, p.width, p.timeline.points])).toEqual(a.map((p) => [p.x, p.width, p.timeline.points]))
  })

  it('throws on a non-positive canvas or a gap that leaves no column width', () => {
    expect(() => planAccelerationPanels([CHART_A], { width: 0, height: 100 })).toThrow()
    expect(() => planAccelerationPanels([CHART_A], { width: 100, height: -1 })).toThrow()
    expect(() => planAccelerationPanels([CHART_A, CHART_B], { width: 100, height: 100, gap: 200 })).toThrow()
    expect(() => planAccelerationPanels([CHART_A], { width: 100, height: 100, gap: -1 })).toThrow()
  })
})

/* ── planAccelerationLayout (authored insets) ─────────────────────────────────── */

describe('planAccelerationLayout', () => {
  it('resolves the authored plot-area insets from the trim fractions', () => {
    const W = 6000
    const H = 2000
    const layout = planAccelerationLayout([CHART_A, CHART_B], W, H)
    expect(layout.chartsLeftMm).toBeCloseTo(W * ACELERACION_LAYOUT.chartsLeftFrac, 6)
    expect(layout.chartsTopMm).toBeCloseTo(H * ACELERACION_LAYOUT.chartsTopFrac, 6)
    expect(layout.chartsBottomMm).toBeCloseTo(H * ACELERACION_LAYOUT.chartsBottomFrac, 6)
    expect(layout.panels).toHaveLength(2)
  })

  it('packs the columns inside the plot area (gaps + columns cover the inner width)', () => {
    const W = 6000
    const H = 2000
    const layout = planAccelerationLayout([CHART_A, CHART_B], W, H)
    const innerW = W * ACELERACION_LAYOUT.chartsRightFrac - W * ACELERACION_LAYOUT.chartsLeftFrac
    const last = layout.panels[layout.panels.length - 1]
    expect(last.x + last.width).toBeCloseTo(innerW, 4)
    const gap = layout.panels[1].x - (layout.panels[0].x + layout.panels[0].width)
    expect(gap).toBeCloseTo(W * ACELERACION_LAYOUT.gapFrac, 4)
  })
})

/* ── the real wall-11 data lays out honestly ──────────────────────────────────── */

describe('real acceleration data — piecesByInvId(11)', () => {
  const pieces = piecesByInvId(ACELERACION_INV_ID)
  const charts = pieces.map(chartInputFor)

  it('is the two zoned S3 charts (task horizon in seconds, context in tokens)', () => {
    expect(ACELERACION_INV_ID).toBe(11)
    expect(pieces.map((p) => p.slug)).toEqual(['horizonte-de-tareas', 'ventana-de-contexto'])
    expect(charts.map((c) => c.unit)).toEqual(['seconds', 'tokens'])
  })

  it('lays both charts out honestly at the authored 6000×2000 canvas', () => {
    const { panels } = planAccelerationLayout(charts, 6000, 2000)
    expect(panels).toHaveLength(2)
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i]
      // every point in-bounds on its column
      for (const pt of panel.timeline.points) {
        expect(pt.x).toBeGreaterThanOrEqual(-EPS)
        expect(pt.x).toBeLessThanOrEqual(panel.width + EPS)
        expect(pt.y).toBeGreaterThanOrEqual(-EPS)
        expect(pt.y).toBeLessThanOrEqual(panel.height + EPS)
      }
      // honest logarithmic read: equal ratios → equal pixel distances (values all distinct)
      const slopes = pairs(panel.timeline.points).map(([a, b]) => (a.y - b.y) / (Math.log10(a.value) - Math.log10(b.value)))
      for (const s of slopes) expect(s).toBeCloseTo(slopes[0], 4)
      // points are chronological and the series rises with time (acceleration)
      const pts = panel.timeline.points
      expect(pts.length).toBe(pieces[i].data.length)
      for (let k = 1; k < pts.length; k++) {
        expect(pts[k - 1].year).toBeLessThanOrEqual(pts[k].year)
        expect(pts[k].value).toBeGreaterThan(pts[k - 1].value)
      }
    }
  })

  it('matches the researched growth: task horizon ≈×3630 (~3.6 órdenes), context ≈×488 (~2.7 órdenes)', () => {
    const { panels } = planAccelerationLayout(charts, 6000, 2000)
    const [horizon, context] = panels
    expect(horizon.growth?.growthFactor).toBeCloseTo(7260 / 2, 3)
    expect(horizon.growth?.ordersOfMagnitude).toBeGreaterThan(3.5)
    expect(horizon.growth?.ordersOfMagnitude).toBeLessThan(3.6)
    expect(context.growth?.growthFactor).toBeCloseTo(1000000 / 2048, 3)
    expect(context.growth?.ordersOfMagnitude).toBeGreaterThan(2.6)
    expect(context.growth?.ordersOfMagnitude).toBeLessThan(2.7)
  })

  it('formats the real endpoint values the way the wall reads them', () => {
    const horizon = pieces[0].data
    const context = pieces[1].data
    expect(formatChartValue(horizon[horizon.length - 1].value, 'seconds')).toBe('2 h 1 min') // o3
    expect(formatChartValue(context[context.length - 1].value, 'tokens')).toBe('1 M') // Gemini 1.5 Pro
  })
})
