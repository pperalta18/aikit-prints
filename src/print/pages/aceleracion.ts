/**
 * aceleracion — the honest geometry behind the #11 piece "Aceleración"
 * (wall 11 / `wall-10`, S3 "Nave E").
 * ──────────────────────────────────────────────────────────────────────────
 * The S3 "Nave E" is a 23 m light-box whose message is **es inevitable: la
 * velocidad**. The brief asks for *acceleration charts zoned per camera* rather
 * than one stretched poster, so the wall carries a **family** of single-unit
 * charts (each its own `PieceData` on `invId 11`, retrieved with `piecesByInvId`):
 *
 *   • Chart A — **horizonte de tareas (METR)**: the length of human work a model
 *     finishes autonomously, in seconds (2 s → 2 h in ~6 years);
 *   • Chart B — **ventana de contexto**: the token window each milestone shipped
 *     with (2K → 1M in ~4 years).
 *
 * Both are exponentials over time, so the only honest read is a **logarithmic**
 * y-axis (a linear axis would crush the early models into the floor). This module
 * is pure (no React, no DOM) so the honesty of the layout is *unit-tested*, not
 * eyeballed. It:
 *
 *   • reuses the unit-tested `layoutModelTimeline` (linear-year x, log-value y)
 *     from `model-sizes` — both acceleration series satisfy `ModelDatum`
 *     structurally, so one tested timeline serves all of them;
 *   • splits the canvas into one column per chart (`planAccelerationPanels`),
 *     so the charts read as a zoned sequence, not a single stretched plot;
 *   • formats each series' values for the wall by unit (`formatChartValue`):
 *     a duration for the capability chart ("4 min", "1 h"), a compact magnitude
 *     for the context chart ("200 K", "1 M").
 *
 * Layout units are abstract (the page passes millimetres from `geo`); the maths
 * is scale-free. Figures come from `src/print/space/wall-data.ts` — never
 * AI-invented. See `specs/wall-graphics.md` (Methodology · #11).
 */

import { formatCompact } from './dataviz-scales'
import {
  layoutModelTimeline,
  summarizeGrowth,
  type GrowthSummary,
  type ModelDatum,
  type ModelTimelineLayout,
} from './model-sizes'

/** Inventory id of the acceleration wall — `piecesByInvId(11)`. */
export const ACELERACION_INV_ID = 11

/* ── value formatting (per chart, by unit) ────────────────────────────────────── */

/**
 * Format a duration in **seconds** as a compact human label for the capability
 * (task-horizon) chart: 2 → "2 s", 240 → "4 min", 3600 → "1 h", 7260 → "2 h 1 min".
 * Sub-hour values round to whole seconds / minutes; an hour shows trailing minutes
 * only when non-zero (and a rounding that lands on 60 min rolls into the next hour).
 * Non-finite / non-positive input returns "—" rather than a misleading label.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds < 60) return `${Math.round(seconds)} s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  let h = Math.floor(seconds / 3600)
  let m = Math.round((seconds % 3600) / 60)
  if (m === 60) {
    h += 1
    m = 0
  }
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/**
 * The on-wall label for a chart value, chosen by its unit: `seconds` → a duration
 * ("4 min"), anything else (tokens, …) → the compact magnitude ("200 K", "1 M").
 */
export function formatChartValue(value: number, unit: string): string {
  return unit === 'seconds' ? formatDuration(value) : formatCompact(value)
}

/* ── chart inputs / placed panels ─────────────────────────────────────────────── */

/** A single acceleration chart to place: its identity + the series to plot. */
export type ChartInput = {
  slug: string
  title: string
  /** Unit of the series values ('seconds' | 'tokens' | …) — picks the label format. */
  unit: string
  /** The series — `WallDatum` satisfies `ModelDatum` structurally. */
  data: ReadonlyArray<ModelDatum>
}

/** One chart placed in its column: panel rect + the inner log-timeline + growth. */
export type ChartPanel = {
  slug: string
  title: string
  unit: string
  /** Column rect within the canvas (same units as opts.width/height). */
  x: number
  y: number
  width: number
  height: number
  /** Inner log-timeline layout (panel-local coords: 0..width, 0..height). */
  timeline: ModelTimelineLayout
  /** Growth across the series (× factor, orders of magnitude, year span). */
  growth: GrowthSummary | null
}

export type AccelerationOpts = {
  width: number
  height: number
  /** Horizontal gap between columns (same units). Default 0. */
  gap?: number
  /** Decade padding of each chart's log y-domain. Default 0.5. */
  padDecades?: number
}

/**
 * Split the canvas into one equal column per chart (left→right in input order),
 * separated by `gap`, and lay each chart out as a log timeline in its own column.
 * The columns tile `[0, width]` exactly — `n·panelW + (n−1)·gap = width`, last edge
 * pinned to `width` — so the charts read as a zoned sequence, never a stretched
 * poster. Deterministic. Throws on a non-positive canvas or a gap that leaves no
 * room for the columns.
 */
export function planAccelerationPanels(
  charts: ReadonlyArray<ChartInput>,
  opts: AccelerationOpts,
): ChartPanel[] {
  const { width, height, gap = 0, padDecades = 0.5 } = opts
  if (!(width > 0) || !(height > 0)) throw new Error('planAccelerationPanels: width/height must be > 0')
  if (gap < 0) throw new Error('planAccelerationPanels: gap must be >= 0')
  const n = charts.length
  if (n === 0) return []
  const panelW = (width - gap * (n - 1)) / n
  if (!(panelW > 0)) throw new Error('planAccelerationPanels: gap too large for the canvas width')

  return charts.map((c, i) => ({
    slug: c.slug,
    title: c.title,
    unit: c.unit,
    x: i * (panelW + gap),
    y: 0,
    width: panelW,
    height,
    timeline: layoutModelTimeline(c.data, { width: panelW, height, padDecades }),
    growth: summarizeGrowth(c.data),
  }))
}

/* ── authored plot-area layout (single source for the page + its doc test) ─────── */

/**
 * Fractional plot-area insets within the trim. Kept here (pure) so the page and the
 * doc test compute the **same** authored layout from one source — no fraction drift.
 */
export const ACELERACION_LAYOUT = {
  chartsLeftFrac: 0.05,
  chartsRightFrac: 0.965,
  chartsTopFrac: 0.34,
  chartsBottomFrac: 0.8,
  gapFrac: 0.06,
  padDecades: 0.5,
} as const

export type AccelerationLayout = {
  chartsLeftMm: number
  chartsTopMm: number
  chartsBottomMm: number
  panels: ChartPanel[]
}

/**
 * Resolve the authored chart-area layout for a `W×H` mm trim from a set of charts:
 * the plot-area insets + one zoned `ChartPanel` per chart. The page renders from
 * this; the doc test replays it to prove the *authored* dimensions lay the real,
 * sourced data out honestly.
 */
export function planAccelerationLayout(charts: ReadonlyArray<ChartInput>, W: number, H: number): AccelerationLayout {
  const L = ACELERACION_LAYOUT
  const chartsLeftMm = W * L.chartsLeftFrac
  const chartsRightMm = W * L.chartsRightFrac
  const chartsTopMm = H * L.chartsTopFrac
  const chartsBottomMm = H * L.chartsBottomFrac
  return {
    chartsLeftMm,
    chartsTopMm,
    chartsBottomMm,
    panels: planAccelerationPanels(charts, {
      width: chartsRightMm - chartsLeftMm,
      height: chartsBottomMm - chartsTopMm,
      gap: W * L.gapFrac,
      padDecades: L.padDecades,
    }),
  }
}

/** Build the `ChartInput` for a piece (its single unit is `data[0].unit`). */
export function chartInputFor(piece: {
  slug: string
  title: string
  data: ReadonlyArray<ModelDatum & { unit?: string }>
}): ChartInput {
  return {
    slug: piece.slug,
    title: piece.title,
    unit: piece.data[0]?.unit ?? '',
    data: piece.data,
  }
}
