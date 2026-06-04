import { describe, expect, it } from 'vitest'
import {
  CODIGO_INV_ID,
  CODIGO_LAYOUT,
  barStats,
  codigoChartInputFor,
  formatBarValue,
  formatMinutes,
  formatPercent,
  layoutBars,
  niceCeil,
  planCodigoLayout,
  planCodigoPanels,
  planColumns,
  type CodigoChartInput,
} from './codigo'
import { piecesByInvId } from '../space/wall-data'

/**
 * codigo (#16) — honest-geometry unit tests.
 * ──────────────────────────────────────────
 * Wall 16 carries two bar charts side by side: development time (con IA vs sin IA,
 * in minutes) and the share of code written by AI (percent). Unlike #8/#11 these
 * are NOT exponentials, so the honest read is a **zero-based bar chart**, not a log
 * timeline. These tests pin the new logic: the minutes / percent value formats, the
 * nice-ceiling axis top, the zero-based bar layout (height ∝ value, never clipped,
 * a truncated axis impossible), the percent anchor to 0–100, the zoned-column
 * tiling, the computed series stats, and that the **real wall-16 data** lays out
 * honestly.
 */

const EPS = 1e-6

const CHART_TIME: CodigoChartInput = {
  slug: 'tiempo',
  title: 'Tiempo',
  unit: 'minutes',
  data: [
    { id: 'sin', label: 'Sin', value: 160 },
    { id: 'con', label: 'Con', value: 80 },
  ],
}
const CHART_PCT: CodigoChartInput = {
  slug: 'pct',
  title: 'Pct',
  unit: 'percent',
  data: [
    { id: 'a', label: 'A', value: 40 },
    { id: 'b', label: 'B', value: 20 },
    { id: 'c', label: 'C', value: 10 },
  ],
}

function pairs<T>(xs: readonly T[]): Array<[T, T]> {
  const out: Array<[T, T]> = []
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) out.push([xs[i], xs[j]])
  return out
}

/* ── formatMinutes ────────────────────────────────────────────────────────────── */

describe('formatMinutes', () => {
  it('formats minutes the way the wall reads them', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(71)).toBe('1 h 11 min')
    expect(formatMinutes(90)).toBe('1 h 30 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatMinutes(161)).toBe('2 h 41 min')
  })

  it('rolls a minute that rounds to 60 into the next hour (never "1 h 60 min")', () => {
    expect(formatMinutes(119.7)).toBe('2 h')
  })

  it('returns a dash for non-positive / non-finite input rather than a wrong label', () => {
    expect(formatMinutes(0)).toBe('—')
    expect(formatMinutes(-5)).toBe('—')
    expect(formatMinutes(Number.NaN)).toBe('—')
    expect(formatMinutes(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

/* ── formatPercent / formatBarValue ───────────────────────────────────────────── */

describe('formatPercent', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercent(46)).toBe('46 %')
    expect(formatPercent(25.4)).toBe('25 %')
    expect(formatPercent(0)).toBe('0 %')
  })
  it('returns a dash for non-finite input', () => {
    expect(formatPercent(Number.NaN)).toBe('—')
  })
})

describe('formatBarValue', () => {
  it('uses a duration for minutes, a percent for percent, a compact magnitude otherwise', () => {
    expect(formatBarValue(161, 'minutes')).toBe('2 h 41 min')
    expect(formatBarValue(46, 'percent')).toBe('46 %')
    expect(formatBarValue(2048, 'tokens')).toBe('2 K')
  })
})

/* ── niceCeil ─────────────────────────────────────────────────────────────────── */

describe('niceCeil', () => {
  it('returns the smallest 1·2·5·10ᵏ ceiling ≥ max', () => {
    expect(niceCeil(161)).toBe(200)
    expect(niceCeil(46)).toBe(50)
    expect(niceCeil(100)).toBe(100)
    expect(niceCeil(7)).toBe(10)
    expect(niceCeil(1)).toBe(1)
    expect(niceCeil(0.4)).toBe(0.5)
  })
  it('is always ≥ its input and degrades gracefully on non-positive input', () => {
    for (const v of [3, 12, 88, 999, 1234]) expect(niceCeil(v)).toBeGreaterThanOrEqual(v)
    expect(niceCeil(0)).toBe(1)
    expect(niceCeil(-5)).toBe(1)
  })
})

/* ── planColumns (zoned columns) ──────────────────────────────────────────────── */

describe('planColumns', () => {
  const cols = planColumns(2, { width: 5000, height: 1500, gap: 300 })

  it('returns one column per count, tiling the width exactly (last edge pinned)', () => {
    expect(cols).toHaveLength(2)
    expect(cols[0].x).toBeCloseTo(0, 6)
    const last = cols[cols.length - 1]
    expect(last.x + last.width).toBeCloseTo(5000, 6)
  })

  it('gives equal widths and separates adjacent columns by exactly the gap', () => {
    expect(cols[0].width).toBeCloseTo(cols[1].width, 6)
    expect(cols[1].x - (cols[0].x + cols[0].width)).toBeCloseTo(300, 6)
  })

  it('handles a single full-width column and a zero/negative count', () => {
    const one = planColumns(1, { width: 4000, height: 1000 })
    expect(one).toHaveLength(1)
    expect(one[0].width).toBeCloseTo(4000, 6)
    expect(planColumns(0, { width: 4000, height: 1000 })).toEqual([])
    expect(planColumns(-2, { width: 4000, height: 1000 })).toEqual([])
  })

  it('throws on a non-positive canvas, a negative gap, or a gap that leaves no width', () => {
    expect(() => planColumns(2, { width: 0, height: 100 })).toThrow()
    expect(() => planColumns(2, { width: 100, height: -1 })).toThrow()
    expect(() => planColumns(2, { width: 100, height: 100, gap: -1 })).toThrow()
    expect(() => planColumns(2, { width: 100, height: 100, gap: 200 })).toThrow()
  })
})

/* ── layoutBars (zero-based, height ∝ value) ──────────────────────────────────── */

describe('layoutBars', () => {
  const box = { width: 1000, height: 600 } as const

  it('places one bar per datum, in input order, all in-bounds', () => {
    const layout = layoutBars(CHART_TIME.data, box)
    expect(layout.bars.map((b) => b.id)).toEqual(['sin', 'con'])
    for (const b of layout.bars) {
      expect(b.x).toBeGreaterThanOrEqual(-EPS)
      expect(b.x + b.width).toBeLessThanOrEqual(box.width + EPS)
      expect(b.top).toBeGreaterThanOrEqual(-EPS)
      expect(b.barHeight).toBeGreaterThanOrEqual(-EPS)
      expect(b.top + b.barHeight).toBeCloseTo(box.height, 6) // stands on the baseline
      expect(b.barHeight).toBeLessThanOrEqual(box.height + EPS)
    }
    expect(layout.baseline).toBeCloseTo(box.height, 6)
  })

  it('is honest: bar height is proportional to value from a ZERO baseline', () => {
    const layout = layoutBars(CHART_PCT.data, { ...box, max: 100 })
    for (const [a, b] of pairs(layout.bars)) {
      // ratio of heights equals ratio of values — only true for a zero-based axis
      expect(a.barHeight / b.barHeight).toBeCloseTo(a.value / b.value, 6)
    }
    // and the absolute height matches value / domainMax · plotHeight
    for (const b of layout.bars) {
      expect(b.barHeight).toBeCloseTo((b.value / layout.domainMax) * box.height, 6)
    }
  })

  it('anchors a percent chart to a full 0–100 axis (46 reads as under half)', () => {
    const layout = layoutBars([{ id: 'x', label: 'X', value: 46 }], { ...box, max: 100 })
    expect(layout.domainMax).toBe(100)
    expect(layout.bars[0].barHeight).toBeCloseTo(0.46 * box.height, 6)
    expect(layout.bars[0].barHeight).toBeLessThan(box.height / 2)
  })

  it('defaults the axis top to a nice ceiling ≥ the data max (no explicit max)', () => {
    expect(layoutBars(CHART_TIME.data, box).domainMax).toBe(200) // niceCeil(160)
  })

  it('never clips: an explicit max below the data max falls back to a safe ceiling', () => {
    const layout = layoutBars(CHART_TIME.data, { ...box, max: 100 }) // 100 < 160
    expect(layout.domainMax).toBe(200)
    for (const b of layout.bars) expect(b.barHeight).toBeLessThanOrEqual(box.height + EPS)
  })

  it('emits grid rungs from 0 to domainMax, placed in y (0 at baseline, domainMax at top)', () => {
    const layout = layoutBars(CHART_PCT.data, { ...box, max: 100 })
    const values = layout.yTicks.map((t) => t.value)
    expect(values[0]).toBe(0)
    expect(values[values.length - 1]).toBe(layout.domainMax)
    const zero = layout.yTicks.find((t) => t.value === 0)
    const top = layout.yTicks.find((t) => t.value === layout.domainMax)
    expect(zero?.y).toBeCloseTo(box.height, 6)
    expect(top?.y).toBeCloseTo(0, 6)
  })

  it('gives every bar an equal width (equal slots)', () => {
    const layout = layoutBars(CHART_PCT.data, box)
    const w0 = layout.bars[0].width
    for (const b of layout.bars) expect(b.width).toBeCloseTo(w0, 6)
  })

  it('drops non-finite / negative values', () => {
    const layout = layoutBars(
      [
        { id: 'a', label: 'A', value: Number.NaN },
        { id: 'b', label: 'B', value: -5 },
        { id: 'c', label: 'C', value: Number.POSITIVE_INFINITY },
        { id: 'd', label: 'D', value: 10 },
      ],
      box,
    )
    expect(layout.bars.map((b) => b.id)).toEqual(['d'])
  })

  it('returns an empty layout (never throws) for an empty series', () => {
    const layout = layoutBars([], box)
    expect(layout.bars).toEqual([])
    expect(layout.yTicks).toEqual([])
  })

  it('is deterministic — same input, identical layout', () => {
    const a = layoutBars(CHART_PCT.data, { ...box, max: 100 })
    const b = layoutBars(CHART_PCT.data, { ...box, max: 100 })
    expect(b.bars).toEqual(a.bars)
    expect(b.yTicks).toEqual(a.yTicks)
  })

  it('throws on a non-positive canvas, a bad barFrac, a negative gap, or a too-large gap', () => {
    expect(() => layoutBars(CHART_PCT.data, { width: 0, height: 100 })).toThrow()
    expect(() => layoutBars(CHART_PCT.data, { width: 100, height: -1 })).toThrow()
    expect(() => layoutBars(CHART_PCT.data, { ...box, barFrac: 0 })).toThrow()
    expect(() => layoutBars(CHART_PCT.data, { ...box, barFrac: 1.2 })).toThrow()
    expect(() => layoutBars(CHART_PCT.data, { ...box, gap: -1 })).toThrow()
    expect(() => layoutBars(CHART_PCT.data, { width: 10, height: 100, gap: 100 })).toThrow()
  })
})

/* ── barStats (the computed hook) ─────────────────────────────────────────────── */

describe('barStats', () => {
  it('reports min/max, ratio, reduction and the under-half flag', () => {
    const stats = barStats([
      { id: 'a', label: 'A', value: 100 },
      { id: 'b', label: 'B', value: 40 },
    ])!
    expect(stats.maxValue).toBe(100)
    expect(stats.minValue).toBe(40)
    expect(stats.ratio).toBeCloseTo(2.5, 6)
    expect(stats.reductionPct).toBeCloseTo(60, 6)
    expect(stats.lessThanHalf).toBe(true) // 40/100 < 0.5
  })

  it('reports lessThanHalf=false when the smallest is at least half the largest', () => {
    const stats = barStats([
      { id: 'a', label: 'A', value: 100 },
      { id: 'b', label: 'B', value: 60 },
    ])!
    expect(stats.lessThanHalf).toBe(false)
  })

  it('nulls the ratio when the smallest value is 0 (no divide-by-zero)', () => {
    const stats = barStats([
      { id: 'a', label: 'A', value: 50 },
      { id: 'b', label: 'B', value: 0 },
    ])!
    expect(stats.ratio).toBeNull()
    expect(stats.reductionPct).toBeCloseTo(100, 6)
  })

  it('returns null for an empty / all-invalid series', () => {
    expect(barStats([])).toBeNull()
    expect(barStats([{ id: 'a', label: 'A', value: Number.NaN }])).toBeNull()
  })
})

/* ── codigoChartInputFor ──────────────────────────────────────────────────────── */

describe('codigoChartInputFor', () => {
  it('lifts the piece unit from its first datum', () => {
    const ci = codigoChartInputFor({ slug: 's', title: 'T', data: [{ id: 'x', label: 'X', value: 5, unit: 'percent' }] })
    expect(ci).toMatchObject({ slug: 's', title: 'T', unit: 'percent' })
  })
  it('degrades to an empty unit when a piece has no data (never throws)', () => {
    expect(codigoChartInputFor({ slug: 's', title: 'T', data: [] }).unit).toBe('')
  })
})

/* ── planCodigoPanels / planCodigoLayout (zoned charts) ───────────────────────── */

describe('planCodigoPanels', () => {
  const panels = planCodigoPanels([CHART_TIME, CHART_PCT], { width: 5000, height: 1500, gap: 300 })

  it('returns one panel per chart, in input order, tiling the canvas', () => {
    expect(panels.map((p) => p.slug)).toEqual(['tiempo', 'pct'])
    expect(panels[0].x).toBeCloseTo(0, 6)
    const last = panels[panels.length - 1]
    expect(last.x + last.width).toBeCloseTo(5000, 6)
  })

  it('anchors the percent chart to a 0–100 axis and the minutes chart to a nice ceiling', () => {
    expect(panels[0].bars.domainMax).toBe(200) // minutes: niceCeil(160)
    expect(panels[1].bars.domainMax).toBe(100) // percent: full 0–100
  })

  it('attaches a stats summary to each chart', () => {
    expect(panels[0].stats?.maxValue).toBe(160)
    expect(panels[1].stats?.maxValue).toBe(40)
  })
})

describe('planCodigoLayout', () => {
  it('resolves the authored plot-area insets from the trim fractions', () => {
    const W = 3200
    const H = 1800
    const layout = planCodigoLayout([CHART_TIME, CHART_PCT], W, H)
    expect(layout.chartsLeftMm).toBeCloseTo(W * CODIGO_LAYOUT.chartsLeftFrac, 6)
    expect(layout.chartsTopMm).toBeCloseTo(H * CODIGO_LAYOUT.chartsTopFrac, 6)
    expect(layout.chartsBottomMm).toBeCloseTo(H * CODIGO_LAYOUT.chartsBottomFrac, 6)
    expect(layout.panels).toHaveLength(2)
  })

  it('packs the columns inside the plot area (gap + columns cover the inner width)', () => {
    const W = 3200
    const H = 1800
    const layout = planCodigoLayout([CHART_TIME, CHART_PCT], W, H)
    const innerW = W * CODIGO_LAYOUT.chartsRightFrac - W * CODIGO_LAYOUT.chartsLeftFrac
    const last = layout.panels[layout.panels.length - 1]
    expect(last.x + last.width).toBeCloseTo(innerW, 4)
    const gap = layout.panels[1].x - (layout.panels[0].x + layout.panels[0].width)
    expect(gap).toBeCloseTo(W * CODIGO_LAYOUT.gapFrac, 4)
  })
})

/* ── the real wall-16 data lays out honestly ──────────────────────────────────── */

describe('real code-gen data — piecesByInvId(16)', () => {
  const pieces = piecesByInvId(CODIGO_INV_ID)
  const charts = pieces.map(codigoChartInputFor)

  it('is the two zoned S3 charts (dev time in minutes, AI-written share in percent)', () => {
    expect(CODIGO_INV_ID).toBe(16)
    expect(pieces.map((p) => p.slug)).toEqual(['tiempo-de-desarrollo', 'codigo-escrito-por-ia'])
    expect(charts.map((c) => c.unit)).toEqual(['minutes', 'percent'])
  })

  it('lays both charts out honestly at the authored 3200×1800 canvas', () => {
    const { panels } = planCodigoLayout(charts, 3200, 1800)
    expect(panels).toHaveLength(2)
    for (const panel of panels) {
      expect(panel.bars.bars.length).toBe(panel.bars.bars.length) // present
      for (const b of panel.bars.bars) {
        expect(b.x).toBeGreaterThanOrEqual(-EPS)
        expect(b.x + b.width).toBeLessThanOrEqual(panel.width + EPS)
        expect(b.top).toBeGreaterThanOrEqual(-EPS)
        expect(b.top + b.barHeight).toBeCloseTo(panel.height, 4) // zero baseline
        expect(b.barHeight).toBeLessThanOrEqual(panel.height + EPS)
      }
      // zero-based honesty: equal value ratios → equal height ratios
      for (const [a, b] of pairs(panel.bars.bars)) {
        if (b.value > 0) expect(a.barHeight / b.barHeight).toBeCloseTo(a.value / b.value, 6)
      }
    }
  })

  it('matches the researched figures: time 161→71 (under half), adoption peaks at 46 %', () => {
    const { panels } = planCodigoLayout(charts, 3200, 1800)
    const [time, pct] = panels
    expect(time.stats?.maxValue).toBe(161) // sin IA
    expect(time.stats?.minValue).toBe(71) // con IA
    expect(time.stats?.lessThanHalf).toBe(true) // 71/161 < 0.5
    expect(time.bars.domainMax).toBe(200)
    expect(pct.stats?.maxValue).toBe(46) // GitHub Copilot
    expect(pct.bars.domainMax).toBe(100) // anchored to a full 0–100
  })

  it('formats the real values the way the wall reads them', () => {
    const time = pieces[0].data
    const pct = pieces[1].data
    expect(formatBarValue(time.find((d) => d.id === 'sin-ia')!.value, 'minutes')).toBe('2 h 41 min')
    expect(formatBarValue(time.find((d) => d.id === 'con-ia')!.value, 'minutes')).toBe('1 h 11 min')
    expect(formatBarValue(pct.find((d) => d.id === 'github-copilot')!.value, 'percent')).toBe('46 %')
  })
})
