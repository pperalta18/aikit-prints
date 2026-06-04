/**
 * frontier-data — the "Frontier Language Model Intelligence over Time" dataset,
 * styled after Artificial Analysis (artificialanalysis.ai, Intelligence Index v4.0).
 * ──────────────────────────────────────────────────────────────────────────
 * Plots each frontier model's Artificial Analysis Intelligence Index (y) against
 * its release date (x), with a rising frontier line — square markers coloured by
 * provider, as on AA.
 *
 * ⚠ PROVISIONAL: the recent anchors (Gemini 3.1 Pro 57, Claude Opus 4.7 57, Opus 4.6
 * 53, Sonnet 4.6 51) are from public reporting (mid-2026); the earlier index values
 * are approximate and will be replaced with Pablo's exact Artificial Analysis export.
 * The chart renders a visible "datos provisionales" note until then. Source to cite:
 * Artificial Analysis — https://artificialanalysis.ai
 */

export type FrontierProvider = 'openai' | 'anthropic' | 'google' | 'xai' | 'meta' | 'deepseek' | 'mistral'

export type FrontierPoint = {
  id: string
  /** Short label, e.g. "GPT-5". */
  label: string
  provider: FrontierProvider
  /** Release date as a decimal year (e.g. 2025.6 ≈ Aug 2025). */
  date: number
  /** Artificial Analysis Intelligence Index (v4.0). */
  index: number
  /** Reasoning model (AA marks these with a lightbulb). */
  reasoning?: boolean
}

/** Provider display + the AA-style accent colour for its square markers. */
export const FRONTIER_PROVIDERS: Record<FrontierProvider, { label: string; color: string }> = {
  openai: { label: 'OpenAI', color: '#0f9d8c' },
  anthropic: { label: 'Anthropic', color: '#cc785c' },
  google: { label: 'Google', color: '#3b6fd4' },
  xai: { label: 'xAI', color: '#1f1f1f' },
  meta: { label: 'Meta', color: '#4267b2' },
  deepseek: { label: 'DeepSeek', color: '#6b5ce0' },
  mistral: { label: 'Mistral', color: '#e8642a' },
}

/** Decimal year from yyyy-mm. */
const ym = (y: number, m: number) => y + (m - 0.5) / 12

/** ⚠ PROVISIONAL points — recent indices reported, earlier ones approximate. */
export const FRONTIER_POINTS: FrontierPoint[] = [
  { id: 'gpt-4', label: 'GPT-4', provider: 'openai', date: ym(2023, 3), index: 25 },
  { id: 'claude-3-opus', label: 'Claude 3 Opus', provider: 'anthropic', date: ym(2024, 3), index: 30 },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', date: ym(2024, 5), index: 33 },
  { id: 'claude-35-sonnet', label: 'Claude 3.5 Sonnet', provider: 'anthropic', date: ym(2024, 6), index: 35 },
  { id: 'gemini-2', label: 'Gemini 2.0', provider: 'google', date: ym(2024, 12), index: 38 },
  { id: 'o1', label: 'o1', provider: 'openai', date: ym(2024, 12), index: 40, reasoning: true },
  { id: 'claude-37-sonnet', label: 'Claude 3.7 Sonnet', provider: 'anthropic', date: ym(2025, 2), index: 42, reasoning: true },
  { id: 'gemini-25-pro', label: 'Gemini 2.5 Pro', provider: 'google', date: ym(2025, 3), index: 45, reasoning: true },
  { id: 'o3', label: 'o3', provider: 'openai', date: ym(2025, 4), index: 47, reasoning: true },
  { id: 'grok-4', label: 'Grok 4', provider: 'xai', date: ym(2025, 7), index: 48, reasoning: true },
  { id: 'gpt-5', label: 'GPT-5', provider: 'openai', date: ym(2025, 8), index: 50, reasoning: true },
  { id: 'deepseek-v3', label: 'DeepSeek V3.2', provider: 'deepseek', date: ym(2025, 9), index: 44, reasoning: true },
  { id: 'gemini-3-pro', label: 'Gemini 3 Pro', provider: 'google', date: ym(2025, 11), index: 54, reasoning: true },
  { id: 'opus-46', label: 'Claude Opus 4.6', provider: 'anthropic', date: ym(2026, 2), index: 53, reasoning: true },
  { id: 'gemini-31-pro', label: 'Gemini 3.1 Pro', provider: 'google', date: ym(2026, 4), index: 57, reasoning: true },
  { id: 'opus-47', label: 'Claude Opus 4.7', provider: 'anthropic', date: ym(2026, 5), index: 57, reasoning: true },
]

/** True until Pablo's exact Artificial Analysis data replaces the approximate points. */
export const FRONTIER_PROVISIONAL = true

/** The frontier line: the running best index over time (the record-setters). */
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

/** Distinct providers present, in first-seen order (for the legend). */
export function frontierProvidersPresent(points: FrontierPoint[] = FRONTIER_POINTS): FrontierProvider[] {
  const seen: FrontierProvider[] = []
  for (const p of points) if (!seen.includes(p.provider)) seen.push(p.provider)
  return seen
}
