/**
 * codigo — the honest geometry behind the #16 piece "El valor del código"
 * (wall 16 / `wall-15`, S3 "Divisoria 2 TEXT+CODE").
 * ──────────────────────────────────────────────────────────────────────────
 * S3's second divisoria carries the code-generation message: what a real team
 * did slowly and for money, an AI assistant now does in a fraction of the time,
 * and it already writes a large share of production code. The honesty principle
 * forbids inventing a bespoke "3 líneas → app de 37 archivos = N ingenieros × €X"
 * quote (no primary source), so the wall is anchored on **two hard, sourced
 * datasets** (a `piecesByInvId(16)` family — the wall-11 pattern):
 *
 *   • Chart A — **tiempo de desarrollo (con IA vs sin IA)**, in minutes: GitHub's
 *     controlled study (same HTTP-server task, 95 devs) 161 → 71 min;
 *   • Chart B — **código que ya escribe la IA**, in percent: GitHub Copilot 46 %,
 *     Microsoft 30 %, Google 25 %.
 *
 * Neither is an exponential-over-time, so unlike #8/#11 the honest read is **not**
 * a log timeline but a **bar chart with a zero baseline** — a truncated axis would
 * exaggerate the differences, so the bars are sized linearly from 0 (`layoutBars`)
 * and the percent chart is anchored to a full 0–100 scale so "46 %" visibly reads
 * as *less than half*. This module is pure (no React, no DOM) so the honesty of the
 * layout is *unit-tested*, not eyeballed. It:
 *
 *   • lays each series out as zero-based bars whose **height ∝ value**
 *     (`layoutBars`), reporting the decade/grid ticks already placed in y;
 *   • splits the canvas into one column per chart (`planColumns` /
 *     `planCodigoPanels`) so the two charts read as a zoned pair, never a stretched
 *     poster;
 *   • formats each value for the wall by unit (`formatBarValue`): a duration for
 *     the time chart ("2 h 41 min"), a percent for the adoption chart ("46 %");
 *   • summarises each series so the page can stamp a computed (never hard-coded)
 *     hook — the time chart's "menos de la mitad del tiempo", the adoption chart's
 *     "hasta el 46 %" (`barStats`).
 *
 * Layout units are abstract (the page passes millimetres from `geo`); the maths
 * is scale-free. Figures come from `src/print/space/wall-data.ts` — never
 * AI-invented. See `specs/wall-graphics.md` (Methodology · #16).
 */

import { formatCompact, niceTicks } from './dataviz-scales'

/** Inventory id of the code-gen value wall — `piecesByInvId(16)`. */
export const CODIGO_INV_ID = 16

/* ── value formatting (per chart, by unit) ────────────────────────────────────── */

/**
 * Format a duration in **minutes** as a compact human label for the time chart:
 * 45 → "45 min", 60 → "1 h", 71 → "1 h 11 min", 161 → "2 h 41 min". A minute that
 * rounds to 60 rolls into the next hour (never "1 h 60 min"). Non-finite /
 * non-positive input returns "—" rather than a misleading label.
 */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  if (minutes < 60) return `${Math.round(minutes)} min`
  let h = Math.floor(minutes / 60)
  let m = Math.round(minutes % 60)
  if (m === 60) {
    h += 1
    m = 0
  }
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Format a percentage value as a whole-percent label ("46 %"); "—" if non-finite. */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${Math.round(value)} %`
}

/**
 * The on-wall label for a bar value, chosen by its unit: `minutes` → a duration
 * ("2 h 41 min"), `percent` → a whole percent ("46 %"), anything else → the
 * compact magnitude.
 */
export function formatBarValue(value: number, unit: string): string {
  if (unit === 'minutes') return formatMinutes(value)
  if (unit === 'percent') return formatPercent(value)
  return formatCompact(value)
}

/* ── nice ceiling (zero-based axis top) ───────────────────────────────────────── */

/**
 * The smallest "nice" number (1·2·5·10ᵏ) that is ≥ `max` — the honest top of a
 * zero-based bar axis (e.g. 161 → 200, 46 → 50, 100 → 100). Non-positive → 1.
 */
export function niceCeil(max: number): number {
  if (!(max > 0)) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(max)))
  const norm = max / mag // 1 ≤ norm < 10
  let nice: number
  if (norm <= 1) nice = 1
  else if (norm <= 2) nice = 2
  else if (norm <= 5) nice = 5
  else nice = 10
  return nice * mag
}

/* ── bar layout (zero-based, height ∝ value) ──────────────────────────────────── */

/**
 * The minimal datum a bar needs. `WallDatum` (from `wall-data`) satisfies it
 * structurally, so a page passes `dataForWall(16)` straight in; tests pass
 * synthetic bars. `value` is in the chart's single unit (minutes / percent / …).
 */
export type BarDatum = {
  id: string
  label: string
  value: number
  unit?: string
}

/** A laid-out bar: its datum + resolved rectangle (plot units, 0 = top/left). */
export type Bar = {
  id: string
  label: string
  value: number
  /** Left edge of the bar (plot units). */
  x: number
  /** Bar width (plot units). */
  width: number
  /** Bar height (plot units) — proportional to `value` from a **zero** baseline. */
  barHeight: number
  /** y of the bar's top (0 = plot top, `height` = baseline at the bottom). */
  top: number
  /** Centre x of the bar's slot — anchor for the name / value labels. */
  center: number
}

/** A y-axis rung: a tick value and its placed y (plot units, 0 = top). */
export type BarTick = { value: number; y: number }

export type BarLayout = {
  width: number
  height: number
  /** One bar per (valid) datum, in input order. */
  bars: Bar[]
  /** Baseline y (= `height`); every bar grows up from here. */
  baseline: number
  /** Axis top actually used (≥ the data max) — bars are `value / domainMax`. */
  domainMax: number
  /** Grid rungs from 0 to `domainMax`, already placed in y. */
  yTicks: BarTick[]
}

export type BarOpts = {
  width: number
  height: number
  /**
   * Explicit axis ceiling (e.g. 100 for a percent chart so "46 %" reads as less
   * than half). Honoured only when ≥ the data max (never clips a bar); otherwise a
   * nice ceiling ≥ the data max is used.
   */
  max?: number
  /** Horizontal gap between bar slots (plot units). Default 0. */
  gap?: number
  /** Fraction of each slot the bar fills (0 < frac ≤ 1). Default 0.58. */
  barFrac?: number
  /** Approximate gridline count. Default 4. */
  tickCount?: number
}

const EMPTY_BARS = (width: number, height: number, domainMax: number): BarLayout => ({
  width,
  height,
  bars: [],
  baseline: height,
  domainMax,
  yTicks: [],
})

/**
 * Lay a series out as **zero-based** bars in a `width × height` plot: equal slots
 * left→right (separated by `gap`), each bar centred in its slot at `barFrac` of the
 * slot width, its height proportional to the value (`barHeight = value/domainMax ·
 * height`). The axis top `domainMax` is the caller's `max` (when ≥ the data max) or
 * a nice ceiling ≥ the data max, so the bars never clip and the proportions are
 * honest. Non-finite / negative values are dropped. Deterministic. Throws only on a
 * non-positive canvas, a negative gap, an out-of-range `barFrac`, or a gap that
 * leaves no slot width.
 */
export function layoutBars(data: ReadonlyArray<BarDatum>, opts: BarOpts): BarLayout {
  const { width, height, max, gap = 0, barFrac = 0.58, tickCount = 4 } = opts
  if (!(width > 0) || !(height > 0)) throw new Error('layoutBars: width/height must be > 0')
  if (gap < 0) throw new Error('layoutBars: gap must be >= 0')
  if (!(barFrac > 0 && barFrac <= 1)) throw new Error('layoutBars: barFrac must be in (0, 1]')

  const valid = data.filter((d) => Number.isFinite(d.value) && d.value >= 0)
  const n = valid.length
  // A safe axis top even for the empty case (so callers can read domainMax).
  const fallbackMax = max != null && max > 0 ? max : 1
  if (n === 0) return EMPTY_BARS(width, height, fallbackMax)

  const dataMax = Math.max(...valid.map((d) => d.value))
  const niceMax = niceCeil(dataMax)
  // Honour an explicit max only when it cannot clip a bar; else a nice ceiling.
  const domainMax = max != null && max > 0 && max >= dataMax ? max : niceMax

  const slotW = (width - gap * (n - 1)) / n
  if (!(slotW > 0)) throw new Error('layoutBars: gap too large for the canvas width')
  const barW = slotW * barFrac

  const bars: Bar[] = valid.map((d, i) => {
    const slotX = i * (slotW + gap)
    const barHeight = (d.value / domainMax) * height
    return {
      id: d.id,
      label: d.label,
      value: d.value,
      x: slotX + (slotW - barW) / 2,
      width: barW,
      barHeight,
      top: height - barHeight,
      center: slotX + slotW / 2,
    }
  })

  const yTicks: BarTick[] = niceTicks(0, domainMax, tickCount).map((v) => ({
    value: v,
    y: height - (v / domainMax) * height,
  }))

  return { width, height, bars, baseline: height, domainMax, yTicks }
}

/* ── series summary (the computed, never hard-coded, hook) ─────────────────────── */

export type BarStats = {
  /** Smallest- and largest-valued datums. */
  min: BarDatum
  max: BarDatum
  minValue: number
  maxValue: number
  /** maxValue / minValue (the speed-up factor); null when minValue ≤ 0. */
  ratio: number | null
  /** Percent reduction from max to min: (max − min) / max · 100; null when max ≤ 0. */
  reductionPct: number | null
  /** True when the smallest value is under half the largest (the bars read so). */
  lessThanHalf: boolean
}

/**
 * Summarise a series for an honest, computed hook: the min/max datums, their
 * ratio, the percent reduction from max to min, and whether the smallest bar is
 * under half the tallest. Drops non-finite / negative values; `null` for an empty
 * / all-invalid set. The page reads this — it never hard-codes a headline number.
 */
export function barStats(data: ReadonlyArray<BarDatum>): BarStats | null {
  const valid = data.filter((d) => Number.isFinite(d.value) && d.value >= 0)
  if (valid.length === 0) return null
  const max = valid.reduce((m, d) => (d.value > m.value ? d : m), valid[0])
  const min = valid.reduce((m, d) => (d.value < m.value ? d : m), valid[0])
  return {
    min,
    max,
    minValue: min.value,
    maxValue: max.value,
    ratio: min.value > 0 ? max.value / min.value : null,
    reductionPct: max.value > 0 ? ((max.value - min.value) / max.value) * 100 : null,
    lessThanHalf: max.value > 0 && min.value / max.value < 0.5,
  }
}

/* ── zoned columns (one per chart) ────────────────────────────────────────────── */

/** A column rect within the canvas (same units as opts.width/height). */
export type Column = { x: number; y: number; width: number; height: number }

/**
 * Split a `width × height` canvas into `count` equal columns, left→right, separated
 * by `gap`. The columns tile `[0, width]` exactly — `n·colW + (n−1)·gap = width`,
 * last edge pinned to `width` — so the charts read as a zoned sequence. Returns []
 * for a non-positive count. Throws on a non-positive canvas, a negative gap, or a
 * gap that leaves no column width.
 */
export function planColumns(count: number, opts: { width: number; height: number; gap?: number }): Column[] {
  const { width, height, gap = 0 } = opts
  if (!(width > 0) || !(height > 0)) throw new Error('planColumns: width/height must be > 0')
  if (gap < 0) throw new Error('planColumns: gap must be >= 0')
  if (!(count > 0)) return []
  const colW = (width - gap * (count - 1)) / count
  if (!(colW > 0)) throw new Error('planColumns: gap too large for the canvas width')
  return Array.from({ length: count }, (_, i) => ({ x: i * (colW + gap), y: 0, width: colW, height }))
}

/** A single bar chart to place: its identity + the series to plot. */
export type CodigoChartInput = {
  slug: string
  title: string
  /** Unit of the series values ('minutes' | 'percent' | …) — picks the format + axis. */
  unit: string
  data: ReadonlyArray<BarDatum>
}

/** One chart placed in its column: column rect + the inner bar layout + stats. */
export type CodigoChartPanel = {
  slug: string
  title: string
  unit: string
  x: number
  y: number
  width: number
  height: number
  /** Inner bar layout (panel-local coords: 0..width, 0..height). */
  bars: BarLayout
  /** Series summary for the computed hook (null for an empty series). */
  stats: BarStats | null
}

/** Build the `CodigoChartInput` for a piece (its single unit is `data[0].unit`). */
export function codigoChartInputFor(piece: {
  slug: string
  title: string
  data: ReadonlyArray<BarDatum & { unit?: string }>
}): CodigoChartInput {
  return {
    slug: piece.slug,
    title: piece.title,
    unit: piece.data[0]?.unit ?? '',
    data: piece.data,
  }
}

/** The honest axis ceiling for a unit — percent charts anchor to a full 0–100. */
function domainMaxForUnit(unit: string): number | undefined {
  return unit === 'percent' ? 100 : undefined
}

export type CodigoPanelsOpts = {
  width: number
  height: number
  /** Horizontal gap between columns. Default 0. */
  gap?: number
  /** Bar fill fraction within each slot. Default from `layoutBars`. */
  barFrac?: number
}

/**
 * Place one zoned column per chart and lay each chart out as zero-based bars in its
 * column. The columns tile `[0, width]` exactly (via `planColumns`); a percent chart
 * is anchored to a 0–100 axis. Deterministic. Throws on a non-positive canvas or a
 * gap that leaves no column room.
 */
export function planCodigoPanels(
  charts: ReadonlyArray<CodigoChartInput>,
  opts: CodigoPanelsOpts,
): CodigoChartPanel[] {
  const { width, height, gap = 0, barFrac } = opts
  const cols = planColumns(charts.length, { width, height, gap })
  return charts.map((c, i) => {
    const col = cols[i]
    return {
      slug: c.slug,
      title: c.title,
      unit: c.unit,
      x: col.x,
      y: col.y,
      width: col.width,
      height: col.height,
      bars: layoutBars(c.data, { width: col.width, height: col.height, max: domainMaxForUnit(c.unit), barFrac }),
      stats: barStats(c.data),
    }
  })
}

/* ── authored plot-area layout (single source for the page + its doc test) ─────── */

/**
 * Fractional plot-area insets within the trim. Kept here (pure) so the page and the
 * doc test compute the **same** authored layout from one source — no fraction drift.
 */
export const CODIGO_LAYOUT = {
  chartsLeftFrac: 0.05,
  chartsRightFrac: 0.95,
  chartsTopFrac: 0.4,
  chartsBottomFrac: 0.8,
  gapFrac: 0.06,
  barFrac: 0.5,
} as const

export type CodigoLayout = {
  chartsLeftMm: number
  chartsTopMm: number
  chartsBottomMm: number
  panels: CodigoChartPanel[]
}

/**
 * Resolve the authored chart-area layout for a `W×H` mm trim from a set of charts:
 * the plot-area insets + one zoned `CodigoChartPanel` per chart. The page renders
 * from this; the doc test replays it to prove the *authored* dimensions lay the
 * real, sourced data out honestly.
 */
export function planCodigoLayout(charts: ReadonlyArray<CodigoChartInput>, W: number, H: number): CodigoLayout {
  const L = CODIGO_LAYOUT
  const chartsLeftMm = W * L.chartsLeftFrac
  const chartsRightMm = W * L.chartsRightFrac
  const chartsTopMm = H * L.chartsTopFrac
  const chartsBottomMm = H * L.chartsBottomFrac
  return {
    chartsLeftMm,
    chartsTopMm,
    chartsBottomMm,
    panels: planCodigoPanels(charts, {
      width: chartsRightMm - chartsLeftMm,
      height: chartsBottomMm - chartsTopMm,
      gap: W * L.gapFrac,
      barFrac: L.barFrac,
    }),
  }
}
