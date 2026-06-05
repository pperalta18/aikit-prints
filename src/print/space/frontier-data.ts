/**
 * frontier-data — the "Frontier Language Model Intelligence over Time" dataset,
 * faithful to Artificial Analysis (artificialanalysis.ai, Intelligence Index).
 * ──────────────────────────────────────────────────────────────────────────
 * Plots each model's Artificial Analysis Intelligence Index (y) against its
 * release date (x). Square markers coloured by lab; each lab draws its own
 * rising **stepped** progression line (its best index so far), exactly as on AA.
 *
 * The points + provider colours are AUTO-GENERATED from the AA API by
 * `npm run frontier:fetch` (see scripts/fetch-frontier.mjs) into
 * `frontier-data.generated.ts`. This module only adds types, the decimal-year
 * conversion and the chart helpers. Source to cite: Artificial Analysis.
 */
import {
  FRONTIER_RAW,
  FRONTIER_PROVIDERS,
  FRONTIER_GENERATED_AT,
  FRONTIER_INDEX_VERSION,
  type FrontierProvider,
} from './frontier-data.generated'

export { FRONTIER_PROVIDERS, FRONTIER_GENERATED_AT, FRONTIER_INDEX_VERSION }
export type { FrontierProvider }

export type FrontierPoint = {
  id: string
  /** Model family name, e.g. "GPT-5.5". */
  label: string
  provider: FrontierProvider
  /** Release date as a decimal year (e.g. 2025.6 ≈ Aug 2025). */
  date: number
  /** Release date as YYYY-MM-DD (for tooltips / sorting). */
  dateISO: string
  /** Artificial Analysis Intelligence Index. */
  index: number
  /** Reasoning model (AA marks these with a lightbulb). */
  reasoning: boolean
}

/** Decimal year from a YYYY-MM-DD string (day-accurate enough to plot). */
export function decimalYear(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return y + ((m - 1) + (d - 1) / 31) / 12
}

/** Every charted model, oldest first. */
export const FRONTIER_POINTS: FrontierPoint[] = FRONTIER_RAW.map((r) => ({
  id: r.id,
  label: r.label,
  provider: r.provider,
  date: decimalYear(r.date),
  dateISO: r.date,
  index: r.index,
  reasoning: r.reasoning,
})).sort((a, b) => a.date - b.date)

/** Real data now — no longer the provisional hand-typed anchors. */
export const FRONTIER_PROVISIONAL = false

/** A lab's stepped progression line (best index so far) as SVG-ready points. */
export type FrontierLabLine = {
  provider: FrontierProvider
  /** Polyline points [{ date, index }, …] tracing the staircase. */
  points: Array<{ date: number; index: number }>
}

/**
 * Per-lab staircase: each lab's running-best index over time, as a step line
 * (horizontal until a new best ships, then a vertical jump). This is the
 * signature AA look — one rising coloured line per lab, not a global envelope.
 */
export function frontierLabLines(points: FrontierPoint[] = FRONTIER_POINTS): FrontierLabLine[] {
  const byProvider = new Map<FrontierProvider, FrontierPoint[]>()
  for (const p of points) {
    const arr = byProvider.get(p.provider) ?? []
    arr.push(p)
    byProvider.set(p.provider, arr)
  }

  const out: FrontierLabLine[] = []
  // Emit in the legend (generated) provider order for stable z-order/legend.
  for (const provider of Object.keys(FRONTIER_PROVIDERS) as FrontierProvider[]) {
    const lab = byProvider.get(provider)
    if (!lab || lab.length === 0) continue
    const sorted = [...lab].sort((a, b) => a.date - b.date)
    const line: Array<{ date: number; index: number }> = []
    let best = -Infinity
    for (const p of sorted) {
      if (p.index > best) {
        if (line.length > 0) line.push({ date: p.date, index: best }) // horizontal run to the new release…
        line.push({ date: p.date, index: p.index }) // …then the step up
        best = p.index
      }
    }
    if (line.length > 0) out.push({ provider, points: line })
  }
  return out
}

/** The global frontier line: the running best index across all labs. */
export function frontierEnvelope(points: FrontierPoint[] = FRONTIER_POINTS): FrontierPoint[] {
  const sorted = [...points].sort((a, b) => a.date - b.date)
  const out: FrontierPoint[] = []
  let best = -Infinity
  for (const p of sorted) {
    if (p.index >= best) {
      out.push(p)
      best = p.index
    }
  }
  return out
}

/** Distinct providers present, in legend order (for the legend). */
export function frontierProvidersPresent(points: FrontierPoint[] = FRONTIER_POINTS): FrontierProvider[] {
  const present = new Set(points.map((p) => p.provider))
  return (Object.keys(FRONTIER_PROVIDERS) as FrontierProvider[]).filter((p) => present.has(p))
}

/** [min, max] decimal-year span of the data (for the x-axis domain). */
export function frontierDateExtent(points: FrontierPoint[] = FRONTIER_POINTS): [number, number] {
  const ds = points.map((p) => p.date)
  return [Math.min(...ds), Math.max(...ds)]
}

/** Highest index in the data (for the y-axis headroom). */
export function frontierMaxIndex(points: FrontierPoint[] = FRONTIER_POINTS): number {
  return Math.max(...points.map((p) => p.index))
}
