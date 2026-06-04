/**
 * dataviz-scales — the honest maths behind the AiKit Live code-track data-viz.
 * ──────────────────────────────────────────────────────────────────────────
 * Pure functions (no React, no DOM) so they unit-test in the node project and
 * so the *rendering* kit (`dataviz-kit.tsx`) and every data page share ONE
 * source of truth for "what does this number look like on the wall".
 *
 * The whole point of the code track is honesty: a text-to-image model invents
 * axes and bubble sizes; here the geometry is derived from the data. Three
 * primitives:
 *   • `circleAreaScale` — area ∝ value (the hero "sistema solar": a ball's AREA,
 *     not its radius, is the money). Radius = maxRadius·√(value/maxValue).
 *   • `scaleLinear` / `scaleLog` — value → pixel along an axis, with nice ticks.
 *   • `formatCompact` / `formatMoney` / source helpers — legible labels + the
 *     discreet sources caption every data piece must carry.
 *
 * When a value is too small to be seen it may be floored to a minimum size, but
 * the scale reports that (`toScale(value) === false`) so the page can stamp
 * "ampliado, no a escala" — never a silent lie. See `specs/wall-graphics.md`.
 */

/* ── on-piece scale annotations (Spanish, museographic register) ─────────────── */

/** Stamp for an honest, area-true figure. */
export const SCALE_NOTE_ES = 'Representado a escala · área ∝ valor'
/** Stamp for any element enlarged past its honest size so it stays visible. */
export const ENLARGED_NOTE_ES = 'Ampliado, no a escala'

/* ── circle area scale (area ∝ value) ────────────────────────────────────────── */

export type AreaScale = {
  /** Rendered radius (px) for a value. Area is proportional to value. */
  radius(value: number): number
  /** Rendered area (px²) for a value — π·r². Honest only where `toScale` is true. */
  area(value: number): number
  /**
   * True when the value renders at honest area scale; false when it was floored
   * to `minRadius` to stay visible (→ annotate "ampliado, no a escala").
   */
  toScale(value: number): boolean
  readonly maxValue: number
  readonly maxRadius: number
  readonly minRadius: number
}

/**
 * Build a scale where a circle's **area** is proportional to its value, so the
 * hero balls read as money the eye can compare. `radius = maxRadius·√(v/maxValue)`.
 *
 * `minRadius` (default 0) keeps tiny "marble" references visible; any value whose
 * honest radius falls below it is enlarged and reported via `toScale === false`.
 */
export function circleAreaScale(opts: {
  maxValue: number
  maxRadius: number
  minRadius?: number
}): AreaScale {
  const { maxValue, maxRadius, minRadius = 0 } = opts
  if (!(maxValue > 0)) throw new Error('circleAreaScale: maxValue must be > 0')
  if (!(maxRadius > 0)) throw new Error('circleAreaScale: maxRadius must be > 0')
  if (minRadius < 0) throw new Error('circleAreaScale: minRadius must be >= 0')

  const honest = (value: number) => (value <= 0 ? 0 : maxRadius * Math.sqrt(value / maxValue))

  const radius = (value: number) => {
    if (value <= 0) return 0
    return Math.max(honest(value), minRadius)
  }

  return {
    radius,
    area: (value: number) => {
      const r = radius(value)
      return Math.PI * r * r
    },
    // A positive value is "to scale" only if its honest size already clears the floor.
    toScale: (value: number) => value <= 0 || honest(value) >= minRadius,
    maxValue,
    maxRadius,
    minRadius,
  }
}

/* ── continuous axis scales (value → pixel) ──────────────────────────────────── */

export type Scale = {
  (value: number): number
  /** Inverse: pixel → value. */
  invert(px: number): number
  /** ~`count` human-friendly ticks within the domain. */
  ticks(count?: number): number[]
  readonly domain: readonly [number, number]
  readonly range: readonly [number, number]
}

/** Linear value → pixel scale with "nice" (1·2·5·10ᵏ) ticks. */
export function scaleLinear(opts: { domain: [number, number]; range: [number, number] }): Scale {
  const [d0, d1] = opts.domain
  const [r0, r1] = opts.range
  if (d0 === d1) throw new Error('scaleLinear: domain endpoints must differ')

  const scale = ((value: number) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0)) as Scale
  Object.assign(scale, {
    invert: (px: number) => d0 + ((px - r0) / (r1 - r0)) * (d1 - d0),
    ticks: (count = 5) => niceTicks(Math.min(d0, d1), Math.max(d0, d1), count),
    domain: [d0, d1] as const,
    range: [r0, r1] as const,
  })
  return scale
}

/** Logarithmic value → pixel scale (for the hockey-stick exponentials). Domain must be > 0. */
export function scaleLog(opts: {
  domain: [number, number]
  range: [number, number]
  base?: number
}): Scale {
  const [d0, d1] = opts.domain
  const [r0, r1] = opts.range
  const base = opts.base ?? 10
  if (!(d0 > 0) || !(d1 > 0)) throw new Error('scaleLog: domain must be strictly positive')
  if (d0 === d1) throw new Error('scaleLog: domain endpoints must differ')
  if (!(base > 1)) throw new Error('scaleLog: base must be > 1')

  const logb = (v: number) => Math.log(v) / Math.log(base)
  const l0 = logb(d0)
  const l1 = logb(d1)

  const scale = ((value: number) => {
    if (!(value > 0)) throw new Error('scaleLog: value must be > 0')
    return r0 + ((logb(value) - l0) / (l1 - l0)) * (r1 - r0)
  }) as Scale
  Object.assign(scale, {
    invert: (px: number) => Math.pow(base, l0 + ((px - r0) / (r1 - r0)) * (l1 - l0)),
    ticks: () => logTicks(Math.min(d0, d1), Math.max(d0, d1), base),
    domain: [d0, d1] as const,
    range: [r0, r1] as const,
  })
  return scale
}

/* ── tick generators ─────────────────────────────────────────────────────────── */

/** Round to the same decimal precision as `step` so ticks read 0.2, not 0.20000004. */
function snap(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  return Number(value.toFixed(Math.min(decimals, 12)))
}

function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / Math.pow(10, exponent)
  let nice: number
  if (round) {
    if (fraction < 1.5) nice = 1
    else if (fraction < 3) nice = 2
    else if (fraction < 7) nice = 5
    else nice = 10
  } else {
    if (fraction <= 1) nice = 1
    else if (fraction <= 2) nice = 2
    else if (fraction <= 5) nice = 5
    else nice = 10
  }
  return nice * Math.pow(10, exponent)
}

/** "Nice" linear ticks (multiples of 1·2·5·10ᵏ) within [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (count < 2) count = 2
  if (max === min) return [snap(min, 1)]
  const step = niceNum((max - min) / (count - 1), true)
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(snap(v, step))
  return out
}

/** Powers of `base` within [min, max] inclusive — the rungs of a log axis. */
export function logTicks(min: number, max: number, base = 10): number[] {
  if (!(min > 0) || !(max > 0)) throw new Error('logTicks: bounds must be > 0')
  const logb = (v: number) => Math.log(v) / Math.log(base)
  const k0 = Math.ceil(logb(min) - 1e-9)
  const k1 = Math.floor(logb(max) + 1e-9)
  const out: number[] = []
  for (let k = k0; k <= k1; k++) out.push(snap(Math.pow(base, k), Math.pow(base, k)))
  return out
}

/* ── compact number / money formatting ───────────────────────────────────────── */

/** Suffix scale: short-scale, English "bn" (the convention the spec writes, e.g. "$49 bn"). */
const COMPACT_UNITS: ReadonlyArray<{ at: number; suffix: string }> = [
  { at: 1e12, suffix: 'T' },
  { at: 1e9, suffix: 'bn' },
  { at: 1e6, suffix: 'M' },
  { at: 1e3, suffix: 'K' },
]

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

/**
 * Compact a number into a legible label: 49_000_000_000 → "49 bn",
 * 1_300_000_000_000 → "1.3 T", 850 → "850". Negative-safe; `digits` (default 1)
 * caps fractional precision of the mantissa.
 */
export function formatCompact(value: number, opts: { digits?: number } = {}): string {
  const { digits = 1 } = opts
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const unit = COMPACT_UNITS.find((u) => abs >= u.at)
  if (!unit) return sign + trimZeros(abs.toFixed(Math.min(digits, 20)))
  const mantissa = trimZeros((abs / unit.at).toFixed(digits))
  return `${sign}${mantissa} ${unit.suffix}`
}

/**
 * Money label = currency prefix + compact magnitude, e.g. ("$", 49e9) → "$49 bn".
 * `currency` is any prefix string ("$", "€", "£"); default "$".
 */
export function formatMoney(value: number, opts: { currency?: string; digits?: number } = {}): string {
  const { currency = '$', digits } = opts
  const compact = formatCompact(value, digits == null ? {} : { digits })
  // Keep the sign in front of the currency mark: -$1.2 bn, not $-1.2 bn.
  if (compact.startsWith('-')) return `-${currency}${compact.slice(1)}`
  return `${currency}${compact}`
}

/* ── sources (every data piece must carry a discreet caption) ─────────────────── */

/** One researched datum, the contract the sourced data file (Phase 3) exports. */
export type Datum = {
  /** What the number measures, e.g. "OpenAI valuation". */
  figure: string
  value: number
  /** ISO date the figure is true as of (YYYY-MM or YYYY-MM-DD). */
  date: string
  /** Where it came from. */
  sourceURL: string
}

/** Hostname of a source URL without the `www.` prefix, e.g. "https://www.bloomberg.com/x" → "bloomberg.com". */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    // Tolerate a bare host ("bloomberg.com/x") that isn't a full URL.
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

/** Latest ISO date in a list (lexical compare is correct for zero-padded ISO). */
function latestDate(data: ReadonlyArray<Datum>): string | undefined {
  return data.reduce<string | undefined>((acc, d) => (acc == null || d.date > acc ? d.date : acc), undefined)
}

/**
 * The discreet source caption for a data piece: deduped source hosts (in first-
 * seen order) and the most recent figure date, e.g.
 *   [bloomberg, openai 2025-10; ine 2026-03]  →  "Fuentes: bloomberg.com, openai.com, ine.es · 2026-03"
 */
export function sourcesCaption(data: ReadonlyArray<Datum>, label = 'Fuentes'): string {
  if (data.length === 0) return ''
  const hosts: string[] = []
  for (const d of data) {
    const h = sourceHost(d.sourceURL)
    if (h && !hosts.includes(h)) hosts.push(h)
  }
  const date = latestDate(data)
  return `${label}: ${hosts.join(', ')}${date ? ` · ${date}` : ''}`
}
