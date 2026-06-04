/**
 * model-sizes — the honest geometry behind the #8 piece "Tamaño de modelos"
 * (wall 8 / `wall-7`, S2 "Intro IA").
 * ──────────────────────────────────────────────────────────────────────────
 * Pure functions (no React, no DOM) so the honesty of the chart is *unit-tested*,
 * not eyeballed. The room's message is "no es magia, es multiplicación de
 * matrices" — the matrices *are* the parameters, and they grew ~10 orders of
 * magnitude in ~70 years (Perceptrón 1958 → frontier 2025). A model's parameter
 * count is never area∝value here: a perceptron (512) next to GPT-4 (~1.8 T) on a
 * linear scale would be a single invisible dot, so the only honest read is a
 * **logarithmic** axis. This module:
 *
 *   • parses each datum's year (`parseYear`) and lays the models out on a
 *     timeline — **linear in year** (x), **logarithmic in parameters** (y), so a
 *     decade of parameters is a constant pixel height and equal ratios read as
 *     equal distances (`layoutModelTimeline`);
 *   • emits the log-axis decade rungs (`logTicks`) already placed in y, so the
 *     page draws gridlines without re-deriving the scale;
 *   • summarises the growth the room is meant to *feel* — the multiplicative
 *     factor and the number of orders of magnitude across the data
 *     (`summarizeGrowth`).
 *
 * It reuses the unit-tested scale primitives from `dataviz-scales` (one source of
 * truth for "what does this number look like on the wall"). Layout units are
 * abstract (the page passes millimetres from `geo`); the maths is scale-free.
 * Figures come from `src/print/space/wall-data.ts` — never AI-invented. See
 * `specs/wall-graphics.md` (Methodology · #8).
 */

import { scaleLinear, scaleLog, logTicks } from './dataviz-scales'

/* ── inputs / outputs ─────────────────────────────────────────────────────────── */

/**
 * The minimal datum the timeline needs. `WallDatum` (from `wall-data`) satisfies
 * it structurally, so a page passes `dataForWall(8)` straight in; tests can pass
 * synthetic models. `value` is the parameter count (> 0); `date` is its ISO year.
 */
export type ModelDatum = {
  id: string
  label: string
  value: number
  /** ISO date (`YYYY` / `YYYY-MM` / `YYYY-MM-DD`); only the year drives x. */
  date: string
}

/** A laid-out model point: its datum + parsed year + resolved plot position. */
export type ModelPoint = ModelDatum & {
  /** Numeric calendar year parsed from `date`. */
  year: number
  /** x in plot units (linear in year, 0 = left, `width` = right). */
  x: number
  /** y in plot units (log in value; 0 = top = most parameters, `height` = bottom). */
  y: number
}

/** A log-axis rung: a power-of-ten value and its placed y (plot units). */
export type ModelTick = { value: number; y: number }

export type ModelTimelineLayout = {
  width: number
  height: number
  /** Points in chronological order (by year, then by value). */
  points: ModelPoint[]
  /** Decade rungs of the log y-axis, already placed in y. */
  yTicks: ModelTick[]
  /** Year axis extent actually used (after any padding), `[minYear, maxYear]`. */
  xDomain: readonly [number, number]
  /** Value axis extent actually used (after decade padding), `[lo, hi]`. */
  yDomain: readonly [number, number]
  /** log₁₀(maxValue / minValue) of the **data** — the span the room should feel. */
  ordersOfMagnitude: number
  /** maxValue / minValue of the **data** — the multiplicative growth across it. */
  growthFactor: number
}

export type ModelTimelineOpts = {
  width: number
  height: number
  /**
   * Pad the value (y) domain by this many decades beyond the data on each side so
   * the extreme points don't sit on the frame. Default 0.5.
   */
  padDecades?: number
  /**
   * Pad the year (x) domain by this many years on each side. Default 0 (the first
   * and last models land on the axis ends; the page insets the plot box instead).
   */
  padYears?: number
}

/* ── year parsing ─────────────────────────────────────────────────────────────── */

/**
 * The calendar year of an ISO date string (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`).
 * Throws on anything without a leading 4-digit year, so a malformed date fails a
 * test rather than silently placing a model at year 0.
 */
export function parseYear(date: string): number {
  const m = /^(\d{4})\b/.exec(String(date))
  if (!m) throw new Error(`model-sizes: cannot parse a year from date '${date}'`)
  return Number(m[1])
}

/* ── growth summary (the narrative the wall carries) ──────────────────────────── */

export type GrowthSummary = {
  /** Smallest / largest model in the set. */
  from: ModelDatum
  to: ModelDatum
  /** maxValue / minValue. */
  growthFactor: number
  /** log₁₀(growthFactor). */
  ordersOfMagnitude: number
  /** Calendar years from the earliest to the latest model. */
  yearSpan: number
}

/**
 * Summarise the growth across a model set: the multiplicative factor, the orders
 * of magnitude, and the year span — the honest "≈N órdenes de magnitud en ~M
 * años" hook. `from`/`to` are the **smallest- and largest-valued** models (not
 * necessarily first/last in time). Returns `null` for an empty / all-invalid set.
 */
export function summarizeGrowth(data: ReadonlyArray<ModelDatum>): GrowthSummary | null {
  const valid = data.filter((d) => Number.isFinite(d.value) && d.value > 0)
  if (valid.length === 0) return null
  const from = valid.reduce((m, d) => (d.value < m.value ? d : m), valid[0])
  const to = valid.reduce((m, d) => (d.value > m.value ? d : m), valid[0])
  const growthFactor = to.value / from.value
  const years = valid.map((d) => parseYear(d.date))
  return {
    from,
    to,
    growthFactor,
    ordersOfMagnitude: Math.log10(growthFactor),
    yearSpan: Math.max(...years) - Math.min(...years),
  }
}

/* ── layout ───────────────────────────────────────────────────────────────────── */

const EMPTY = (width: number, height: number): ModelTimelineLayout => ({
  width,
  height,
  points: [],
  yTicks: [],
  xDomain: [0, 0],
  yDomain: [1, 1],
  ordersOfMagnitude: 0,
  growthFactor: 1,
})

/**
 * Lay the models out on the log timeline. Non-positive / non-finite values are
 * dropped; the rest are sorted chronologically (by year, then value) and placed
 * with a **linear** year x-axis and a **logarithmic** parameter y-axis (y = 0 at
 * the top, so a bigger model sits higher). The y-domain is padded by `padDecades`
 * so the extreme models clear the frame; the decade rungs (`logTicks`) come back
 * already placed. Deterministic — same input, identical layout. Throws only on a
 * non-positive canvas.
 */
export function layoutModelTimeline(
  data: ReadonlyArray<ModelDatum>,
  opts: ModelTimelineOpts,
): ModelTimelineLayout {
  const { width, height, padDecades = 0.5, padYears = 0 } = opts
  if (!(width > 0) || !(height > 0)) throw new Error('layoutModelTimeline: width/height must be > 0')
  if (padDecades < 0) throw new Error('layoutModelTimeline: padDecades must be >= 0')

  const valid = data
    .filter((d) => Number.isFinite(d.value) && d.value > 0)
    .map((d) => ({ ...d, year: parseYear(d.date) }))
  if (valid.length === 0) return EMPTY(width, height)

  valid.sort((a, b) => a.year - b.year || a.value - b.value)

  const years = valid.map((p) => p.year)
  const values = valid.map((p) => p.value)
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)

  // ── x domain (linear, in years) — expand a degenerate single-year span ──
  let minYear = Math.min(...years) - padYears
  let maxYear = Math.max(...years) + padYears
  if (minYear === maxYear) {
    minYear -= 1
    maxYear += 1
  }

  // ── y domain (log, in parameters) — padded by decades, kept strictly ordered ──
  let lo = dataMin / Math.pow(10, padDecades)
  let hi = dataMax * Math.pow(10, padDecades)
  if (!(lo < hi)) {
    // single distinct value with padDecades 0 → manufacture a one-decade window.
    lo = dataMin / 10
    hi = dataMax * 10
  }

  const x = scaleLinear({ domain: [minYear, maxYear], range: [0, width] })
  // Range [height, 0]: the smallest value sits at the bottom, the largest at top.
  const y = scaleLog({ domain: [lo, hi], range: [height, 0] })

  const points: ModelPoint[] = valid.map((p) => ({ ...p, x: x(p.year), y: y(p.value) }))
  const yTicks: ModelTick[] = logTicks(lo, hi).map((v) => ({ value: v, y: y(v) }))

  return {
    width,
    height,
    points,
    yTicks,
    xDomain: [minYear, maxYear],
    yDomain: [lo, hi],
    ordersOfMagnitude: Math.log10(dataMax / dataMin),
    growthFactor: dataMax / dataMin,
  }
}
