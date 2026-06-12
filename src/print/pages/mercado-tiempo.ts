/**
 * mercado-tiempo — the honest data + geometry behind «El mercado de la IA, año a año».
 * ──────────────────────────────────────────────────────────────────────────
 * A free-standing companion to the «Galaxia de mercados» walls. Those walls show the
 * AI **sphere** (the combined valuation of the independent frontier labs — the ones
 * that build the models — ~$2,3 B / trillón) sized against whole nations and brands.
 * This print shows that SAME sphere **through time**: one concentric circle per year
 * (2019 → 2026), the area of each ∝ the combined lab valuation that year, so the eye
 * reads the explosive growth as rings expanding outward — the outermost (2026) is the
 * sphere on the wall, the inner ones the years before it.
 *
 * Honesty contract (same as `galaxy-data.ts`): every figure is absolute USD with an
 * as-of date + source. The 2026 ring is wired to the LIVE wall sphere (`GALAXY_SUN`),
 * so it can never drift from the installation. 2019–2025 are the combined year-end
 * valuations of the labs in that sphere, valued at each lab's most-recent round as of
 * Dec 31 (a lab counts only once it had a documented valuation). The early years are
 * genuinely SPARSE and SOFT — in 2019/2020 no independent lab had a public valuation,
 * so the figure is an order-of-magnitude floor; that sparseness IS the story. Sources
 * researched + cross-checked June 2026.
 *
 * Pure functions (no React/DOM) so the geometry is unit-tested, not eyeballed.
 */

import { BRAND, KIT_BLUE } from '@/lib/neumorphism'
import { GALAXY_SUN } from '../space/galaxy-data'

/* ── the sourced series ───────────────────────────────────────────────────────── */

export type MarketYear = {
  year: number
  /** Combined valuation of the independent frontier labs, USD, as of Dec 31 of `year`. */
  value: number
  /** What the figure sums (the dominant contributors). */
  figure: string
  /** ISO date the figure is true as of (year-end, or the dominant round's date). */
  date: string
  /** A representative source (the dominant lab's round). */
  sourceURL: string
  /** 'firm' = closed rounds with stated valuations; 'soft' = estimate / no public valuation. */
  confidence: 'firm' | 'soft'
  note?: string
}

/**
 * 2019 → 2025 combined year-end valuations of the independent frontier AI labs (the
 * model-makers; Google DeepMind & Meta excluded — already inside their parents' caps).
 * Each year sums every such lab that had a documented valuation by Dec 31, at its most
 * recent round. The dominant contributors + a representative source are recorded here;
 * the full per-lab research is summarised in `figure`/`note`. 2026 is appended from the
 * live wall sphere below, so the outer ring always equals the installation.
 */
const SERIES_BEFORE_2026: MarketYear[] = [
  {
    year: 2019,
    value: 1.0e9,
    figure: 'Sin valoración pública: ningún laboratorio independiente estaba valorado. Proxy ≈ la inversión de $1.000 M de Microsoft en OpenAI',
    date: '2019-07',
    sourceURL: 'https://techcrunch.com/2019/07/22/microsoft-invests-1-billion-in-openai-in-new-multiyear-partnership/',
    confidence: 'soft',
    note: 'OpenAI no publicó valoración; AI21 (semilla $9,5 M) y Cohere aún sin valorar. Anthropic, xAI y Mistral no existían. Cifra = suelo de orden de magnitud.',
  },
  {
    year: 2020,
    value: 1.5e9,
    figure: 'GPT-3 se comercializa, pero aún sin rondas con valoración pública (estimación)',
    date: '2020-12',
    sourceURL: 'https://openai.com/index/openai-api/',
    confidence: 'soft',
    note: 'Sin nuevas rondas valoradas en 2020; estimación a partir del despegue comercial de OpenAI. Anthropic se funda en enero de 2021.',
  },
  {
    year: 2021,
    value: 15e9,
    figure: 'OpenAI ~$14.000 M (tender) + Anthropic $550 M (Serie A) + AI21 $400 M',
    date: '2021',
    sourceURL: 'https://news.crunchbase.com/ai-robotics/openai-chatgpt-tender-offer/',
    confidence: 'soft',
    note: 'OpenAI valorado en ~$14.000 M en su oferta de compra (tender) de 2021; el resto, rondas pequeñas. Cifra dominada por OpenAI.',
  },
  {
    year: 2022,
    value: 20e9,
    figure: 'OpenAI ~$14–20.000 M + Anthropic $4.000 M + Cohere $1.000 M + AI21 $664 M',
    date: '2022',
    sourceURL: 'https://www.anthropic.com/news/anthropic-raises-series-b-to-build-safe-reliable-ai',
    confidence: 'soft',
    note: 'La ronda de $29.000 M de OpenAI con Microsoft se cerró en enero de 2023, ya fuera de año. xAI y Mistral aún no existían.',
  },
  {
    year: 2023,
    value: 40e9,
    figure: 'OpenAI $29.000 M + Anthropic $4.100 M + Cohere $2.200 M + Mistral $2.000 M + AI21 $1.400 M + xAI',
    date: '2023-01',
    sourceURL: 'https://techcrunch.com/2023/01/23/microsoft-invests-billions-more-dollars-in-openai-extends-partnership/',
    confidence: 'firm',
    note: 'Año de ChatGPT. Anthropic a $4.100 M es la última ronda cerrada con valoración antes del cierre de año (la Serie D de $18.400 M se cerró en febrero de 2024).',
  },
  {
    year: 2024,
    value: 265e9,
    figure: 'OpenAI $157.000 M + xAI $50.000 M + Anthropic $18.400 M + Perplexity $9.000 M + Mistral $6.200 M + Cohere $5.500 M + SSI $5.000 M + …',
    date: '2024-10',
    sourceURL: 'https://techcrunch.com/2024/10/02/openai-raises-6-6b-and-is-now-valued-at-157b/',
    confidence: 'firm',
    note: 'Suma de 14 laboratorios. OpenAI ($157.000 M) y xAI ($50.000 M) son el grueso.',
  },
  {
    year: 2025,
    value: 820e9,
    figure: 'OpenAI $300.000 M + xAI $200.000 M + Anthropic $183.000 M + SSI $32.000 M + Perplexity $20.000 M + Mistral $13.800 M + Thinking Machines $12.000 M + …',
    date: '2025-09',
    sourceURL: 'https://www.anthropic.com/news/anthropic-raises-series-f-at-usd183b-post-money-valuation',
    confidence: 'firm',
    note: 'Suma de 15 laboratorios a cierre de año. OpenAI $300.000 M (ronda SoftBank, marzo) es la cifra firme; un secundario posterior llegó a ~$500.000 M.',
  },
]

/** The whole series — 2019…2025 plus the LIVE 2026 wall sphere as the outer ring. */
export const MARKET_YEARS: MarketYear[] = [
  ...SERIES_BEFORE_2026,
  {
    year: 2026,
    value: GALAXY_SUN.value,
    figure: GALAXY_SUN.figure,
    date: GALAXY_SUN.date,
    sourceURL: GALAXY_SUN.sourceURL,
    confidence: 'firm',
    note: 'La esfera de la IA en la pared: valoración combinada de los 16 laboratorios, hoy.',
  },
]

/** Global max valuation across the HISTORICAL series — the shared area∝value reference (= 2026). */
export function marketMaxValue(): number {
  return Math.max(...MARKET_YEARS.map((y) => y.value))
}

/* ── exponential projection (where the trend lands next) ──────────────────────── */

/** The year the print projects forward to if the exponential trend holds. */
export const PROJECTION_YEAR = 2027

/**
 * Fit an exponential to the WHOLE printed series (log-linear regression of ln(value)
 * on year) and read it at `targetYear`. "Si lo tomamos como un gráfico exponencial,
 * ¿dónde cae el año que viene?" — derived only from the data on the print, not invented.
 * Returns both the value and the average year-over-year growth factor (e^slope).
 */
export function projectExponential(targetYear: number): { value: number; factor: number } {
  const n = MARKET_YEARS.length
  let sx = 0
  let sy = 0
  let sxy = 0
  let sxx = 0
  for (const y of MARKET_YEARS) {
    const lx = y.year
    const ly = Math.log(y.value)
    sx += lx
    sy += ly
    sxy += lx * ly
    sxx += lx * lx
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  const intercept = (sy - slope * sx) / n
  return { value: Math.exp(intercept + slope * targetYear), factor: Math.exp(slope) }
}

/* ── per-year brand colour (old → new sweeps cool → KIT_BLUE; 2026 = brand primary) ── */

/**
 * Each ring a brand colour, oldest cool → newest the brand primary. Yellow is omitted
 * (a thin stroke of it reads poorly on white). 2026 is always KIT_BLUE — it is the hero
 * (the sphere on the wall).
 */
export const MARKET_YEAR_COLOR: Record<number, string> = {
  2019: BRAND.purple,
  2020: BRAND.violet,
  2021: BRAND.pink,
  2022: BRAND.red,
  2023: BRAND.orange,
  2024: BRAND.teal,
  2025: BRAND.green,
  2026: KIT_BLUE,
}

export function marketYearColor(year: number): string {
  return MARKET_YEAR_COLOR[year] ?? KIT_BLUE
}

/* ── concentric ring layout (area ∝ value, with a legibility floor) ───────────── */

export type Ring = {
  year: number
  value: number
  color: string
  /** Honest radius (mm) at area∝value — `maxRadius·√(v/maxValue)`. */
  rHonest: number
  /** Rendered radius (mm): honest, unless nudged out to clear the inner floor / min gap. */
  r: number
  /** True when the ring renders at honest area scale; false when it was enlarged. */
  toScale: boolean
  /** True for the extrapolated future ring (the projection), not measured data. */
  projected: boolean
}

export type RingLayoutOpts = {
  /** Radius (mm) of the largest ring — the area∝value reference. */
  maxRadiusMm: number
  /** Floor for the innermost ring so it isn't a dot. Default 0. */
  minInnerRadiusMm?: number
  /** Minimum radial gap (mm) between consecutive rings, so strokes don't merge. Default 0. */
  minGapMm?: number
  /** Append the exponential projection (`PROJECTION_YEAR`) as the new outermost ring. Default false. */
  includeProjection?: boolean
}

/**
 * Build the concentric rings, value-ascending (so the largest = the current year). A
 * circle's AREA is its valuation (`r = maxRadius·√(v/maxValue)`); the inner years are
 * tiny by design. Two protections keep them legible WITHOUT lying about the big years:
 * an inner-radius floor and a minimum gap, applied from the inside out. Any ring whose
 * radius is pushed past its honest size is flagged `toScale=false` (→ annotate). The
 * outer rings — where the real growth is — stay exactly area-true.
 */
export function ringLayout(opts: RingLayoutOpts): Ring[] {
  const { maxRadiusMm, minInnerRadiusMm = 0, minGapMm = 0, includeProjection = false } = opts
  if (!(maxRadiusMm > 0)) throw new Error('ringLayout: maxRadiusMm must be > 0')

  const series: { year: number; value: number; projected: boolean }[] = MARKET_YEARS.map((y) => ({ year: y.year, value: y.value, projected: false }))
  if (includeProjection) {
    series.push({ year: PROJECTION_YEAR, value: projectExponential(PROJECTION_YEAR).value, projected: true })
  }
  // The largest ring sets the area scale (the projection, when shown, else 2026).
  const maxValue = Math.max(...series.map((s) => s.value))
  const ordered = series.sort((a, b) => a.value - b.value)

  const rings: Ring[] = []
  let prevR = 0
  for (let i = 0; i < ordered.length; i++) {
    const y = ordered[i]
    const rHonest = maxRadiusMm * Math.sqrt(y.value / maxValue)
    const floor = i === 0 ? Math.max(minInnerRadiusMm, prevR + minGapMm) : prevR + minGapMm
    const r = Math.max(rHonest, floor)
    rings.push({
      year: y.year,
      value: y.value,
      color: marketYearColor(y.year),
      rHonest,
      r,
      // honest when the floor didn't bite (within a hair, to absorb float error)
      toScale: r <= rHonest + 1e-6,
      projected: y.projected,
    })
    prevR = r
  }
  return rings
}

/* ── money labels ─────────────────────────────────────────────────────────────── */

function trimComma(s: string): string {
  return s.replace(/,0$/, '')
}

function trimDot(s: string): string {
  return s.replace(/\.0$/, '')
}

/**
 * Compact USD in Spanish long-scale: 2.33e12 → "$2,3 B" (billones), 265e9 → "$265 mil M",
 * 1.5e9 → "$1,5 mil M". Deterministic (no `toLocaleString`) so it is SSR/export-safe.
 */
export function moneyEs(value: number): string {
  if (value >= 1e12) return `$${trimComma((value / 1e12).toFixed(1).replace('.', ','))} B`
  if (value >= 1e9) {
    const v = value / 1e9
    const str = v >= 10 ? String(Math.round(v)) : trimComma(v.toFixed(1).replace('.', ','))
    return `$${str} mil M`
  }
  return `$${Math.round(value / 1e6)} M`
}

/**
 * Compact USD in American short-scale: 2.33e12 → "$2.3T" (trillion), 265e9 → "$265B"
 * (billion), 1.5e9 → "$1.5B", 5e6 → "$5M". Period decimal separator, no thin space.
 * The short-scale twin of `moneyEs` for prints that label in American conventions.
 * Deterministic (no `toLocaleString`) so it is SSR/export-safe.
 */
export function moneyUs(value: number): string {
  if (value >= 1e12) return `$${trimDot((value / 1e12).toFixed(1))}T`
  if (value >= 1e9) {
    const v = value / 1e9
    const str = v >= 10 ? String(Math.round(v)) : trimDot(v.toFixed(1))
    return `$${str}B`
  }
  return `$${Math.round(value / 1e6)}M`
}

/** Money formatters by locale key (`doc.props.numberFormat`): default Spanish long-scale. */
export const MONEY_FORMATTERS: Record<string, (value: number) => string> = {
  es: moneyEs,
  us: moneyUs,
}

/* ── sources caption (deduped hosts + latest date) ────────────────────────────── */

export function marketSourcesCaption(label = 'Fuentes'): string {
  const hosts: string[] = []
  let latest = '0000'
  for (const y of MARKET_YEARS) {
    try {
      const h = new URL(y.sourceURL).hostname.replace(/^www\./, '')
      if (h && !hosts.includes(h)) hosts.push(h)
    } catch {
      /* ignore */
    }
    if (y.date > latest) latest = y.date
  }
  const shown = hosts.slice(0, 6)
  return `${label}: ${shown.join(', ')}${hosts.length > shown.length ? ', …' : ''} · ${latest}`
}
