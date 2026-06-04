/**
 * galaxy-data — the sourced dataset behind the "Galaxia de mercados" installation.
 * ──────────────────────────────────────────────────────────────────────────
 * Metric (director's call): **valuation** — value compared with value. The central
 * "sun" is the combined valuation of the companies that actually build the models
 * (OpenAI + Anthropic + … = 16 labs); a few AI mega-caps (Nvidia, Microsoft,
 * Alphabet, Meta) are the big planets; entire economies, indices and famous markets
 * people imagine are gigantic are the small "marbles" that ring outward.
 *
 * Honesty (same contract as `wall-data.ts`): every figure is absolute USD with a
 * date + source. Researched + adversarially verified June 2026 (each value an
 * independent source confirmed/adjusted). Two honest caveats are documented, not
 * hidden:
 *   1. The labs-sun (~$2.33 T) is genuinely SMALLER than Nvidia or Alphabet — so
 *      those planets render larger than the sun. We do not fake the sun's size; it
 *      is the focal body by *light and centrality*, not by being the biggest.
 *   2. Some marbles are an annual market FLOW (coffee, music, video games, box
 *      office, football, luxury, Spain's GDP), not a stock of value. They carry
 *      `perYear` and read "·/año"; the wall states the two unit kinds.
 *
 * See [[galaxy-markets-walls]] and `specs/wall-graphics.md`.
 */

import type { GalaxyDatum } from '../pages/galaxy'

/** Colour family for a body — the simple warm/cool message: AI is light, the rest is cold. */
export type GalaxyGroup = 'ai' | 'spanish' | 'market'

/** A galaxy body: the layout's `GalaxyDatum` + the sourced `{figure,date,sourceURL}` contract. */
export type GalaxyBodyDatum = GalaxyDatum & {
  group: GalaxyGroup
  figure: string
  date: string
  sourceURL: string
  note?: string
  /** True when `value` is an annual flow (market revenue / GDP), not a stock of value. */
  perYear?: boolean
}

/* ── the AI sun = the model-makers, combined ──────────────────────────────────── */

/**
 * The labs that ship the models. Their last-round valuations are SUMMED into the
 * single central sun: "esto es lo que vale, hoy, crear la inteligencia." Google
 * DeepMind & Meta Superintelligence are EXCLUDED (already inside Alphabet/Meta caps).
 * xAI (round unconfirmed) and DeepSeek (round in progress) are the two soft points.
 */
export const SUN_LABS: GalaxyBodyDatum[] = [
  { id: 'openai', label: 'OpenAI', value: 852e9, kind: 'sun', group: 'ai', figure: 'OpenAI — valoración última ronda', date: '2026-03-31', sourceURL: 'https://finance.yahoo.com/sectors/technology/articles/openai-raises-122-billion-852-073000122.html' },
  { id: 'anthropic', label: 'Anthropic', value: 965e9, kind: 'sun', group: 'ai', figure: 'Anthropic — valoración Serie H (post-money)', date: '2026-05-28', sourceURL: 'https://news.crunchbase.com/ai/anthropic-nears-1t-valuation-65b-seriesh/' },
  { id: 'xai', label: 'xAI', value: 230e9, kind: 'sun', group: 'ai', figure: 'xAI — valoración Serie E (estimada)', date: '2026-01-06', note: 'Ronda no confirmada oficialmente', sourceURL: 'https://techfundingnews.com/xai-nears-a-230b-valuation-with-20b-funding-from-nvidia-and-others-to-challenge-openai-and-anthropic/' },
  { id: 'zhipu', label: 'Zhipu', value: 83.2e9, kind: 'sun', group: 'ai', figure: 'Zhipu AI — capitalización tras OPV', date: '2026-06-03', sourceURL: 'https://simplywall.st/stocks/hk/software/hkg-2513/knowledge-atlas-technology-shares' },
  { id: 'deepseek', label: 'DeepSeek', value: 59e9, kind: 'sun', group: 'ai', figure: 'DeepSeek — valoración (ronda en curso, estimada)', date: '2026-06-03', note: 'Ronda en curso, sin cerrar', sourceURL: 'https://www.investing.com/news/stock-market-news/deepseek-slated-to-draw-7-billion-in-maiden-fundraising-sources-say-4723297' },
  { id: 'ssi', label: 'Safe Superintelligence', value: 32e9, kind: 'sun', group: 'ai', figure: 'Safe Superintelligence — valoración última ronda', date: '2025-04', sourceURL: 'https://www.calcalistech.com/ctechnews/article/hjfywdtajl' },
  { id: 'minimax', label: 'MiniMax', value: 27e9, kind: 'sun', group: 'ai', figure: 'MiniMax — capitalización tras OPV', date: '2026-06-02', sourceURL: 'https://stockanalysis.com/quote/hkg/0100/market-cap/' },
  { id: 'perplexity', label: 'Perplexity', value: 20e9, kind: 'sun', group: 'ai', figure: 'Perplexity — valoración última ronda', date: '2025-09-10', sourceURL: 'https://www.pymnts.com/artificial-intelligence-2/2025/perplexity-valuation-hits-20-billion-following-new-funding-round/' },
  { id: 'moonshot', label: 'Moonshot (Kimi)', value: 20e9, kind: 'sun', group: 'ai', figure: 'Moonshot AI — valoración última ronda', date: '2026-05-07', sourceURL: 'https://siliconangle.com/2026/05/07/open-source-ai-developer-moonshot-ai-raises-2b-20b-valuation/' },
  { id: 'mistral', label: 'Mistral', value: 13.9e9, kind: 'sun', group: 'ai', figure: 'Mistral AI — valoración última ronda', date: '2025-09-09', sourceURL: 'https://mistral.ai/news/mistral-ai-raises-1-7-b-to-accelerate-technological-progress-with-ai/' },
  { id: 'thinking-machines', label: 'Thinking Machines', value: 12e9, kind: 'sun', group: 'ai', figure: 'Thinking Machines Lab — ronda semilla', date: '2025-07', sourceURL: 'https://techcrunch.com/2025/07/15/mira-muratis-thinking-machines-lab-is-worth-12b-in-seed-round/' },
  { id: 'cohere', label: 'Cohere', value: 7e9, kind: 'sun', group: 'ai', figure: 'Cohere — valoración última ronda', date: '2026-06', sourceURL: 'https://techcrunch.com/2025/09/24/cohere-hits-7b-valuation-a-month-after-its-last-raise-partners-with-amd/' },
  { id: 'black-forest-labs', label: 'Black Forest Labs', value: 3.25e9, kind: 'sun', group: 'ai', figure: 'Black Forest Labs — Serie B', date: '2025-12-01', sourceURL: 'https://www.globenewswire.com/news-release/2025/12/01/3196629/0/en/black-forest-labs-announces-series-b-investment-to-accelerate-frontier-visual-intelligence.html' },
  { id: 'liquid-ai', label: 'Liquid AI', value: 2.35e9, kind: 'sun', group: 'ai', figure: 'Liquid AI — última ronda', date: '2024-12', sourceURL: 'https://www.liquid.ai/blog/we-raised-250m-to-scale-capable-and-efficient-general-purpose-ai' },
  { id: 'ai21-labs', label: 'AI21 Labs', value: 1.4e9, kind: 'sun', group: 'ai', figure: 'AI21 Labs — Serie C', date: '2023-11', sourceURL: 'https://www.prnewswire.com/news-releases/ai21-completes-208-million-oversubscribed-series-c-round-301994393.html' },
  { id: 'reka', label: 'Reka', value: 1e9, kind: 'sun', group: 'ai', figure: 'Reka AI — última ronda', date: '2025-07-22', sourceURL: 'https://siliconangle.com/2025/07/22/multimodal-ai-startup-reka-ai-raises-110m-1b-valuation/' },
]

const SUN_VALUE = SUN_LABS.reduce((s, d) => s + d.value, 0)
const SUN_DATE = SUN_LABS.reduce((acc, d) => (d.date > acc ? d.date : acc), '0000')

/** The central body: the combined valuation of the model-makers (~$2.33 T). */
export const GALAXY_SUN: GalaxyBodyDatum = {
  id: 'ai-sun',
  label: 'IA',
  value: SUN_VALUE,
  kind: 'sun',
  group: 'ai',
  figure: `Valoración combinada de ${SUN_LABS.length} laboratorios de IA (los que crean los modelos)`,
  date: SUN_DATE,
  sourceURL: 'https://news.crunchbase.com/ai/anthropic-nears-1t-valuation-65b-seriesh/',
  note: 'Suma de valoraciones de última ronda (OpenAI, Anthropic, xAI…). Datos más blandos: xAI (no confirmada) y DeepSeek (en curso)',
}

/* ── the planets: the AI mega-caps that ride the wave ─────────────────────────── */

export const GALAXY_PLANETS: GalaxyBodyDatum[] = [
  { id: 'nvidia', label: 'Nvidia', value: 5.201e12, kind: 'planet', group: 'ai', figure: 'Nvidia — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/nvda/market-cap/' },
  { id: 'alphabet', label: 'Alphabet', value: 4.309e12, kind: 'planet', group: 'ai', figure: 'Alphabet (Google) — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/googl/market-cap/' },
  { id: 'microsoft', label: 'Microsoft', value: 3.174e12, kind: 'planet', group: 'ai', figure: 'Microsoft — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/msft/market-cap/' },
  { id: 'meta', label: 'Meta', value: 1.581e12, kind: 'planet', group: 'ai', figure: 'Meta Platforms — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/meta/market-cap/' },
]

/* ── the marbles: economies, indices & famous markets dwarfed by AI ───────────── */

export const GALAXY_MARBLES: GalaxyBodyDatum[] = [
  // Spanish-resonance anchors (the audience's sense of "huge")
  { id: 'spain-gdp', label: 'PIB de España', value: 2.091222e12, kind: 'marble', group: 'spanish', perYear: true, figure: 'PIB nominal de España (anual)', date: '2026', sourceURL: 'https://www.worldometers.info/gdp/spain-gdp/' },
  { id: 'ibex35', label: 'IBEX 35', value: 1.07e12, kind: 'marble', group: 'spanish', figure: 'IBEX 35 — capitalización agregada del índice', date: '2026-06', sourceURL: 'https://disfold.com/stock-index/ibex35/companies/' },
  { id: 'inditex', label: 'Inditex', value: 198.05e9, kind: 'marble', group: 'spanish', figure: 'Inditex — capitalización bursátil', date: '2026-06', sourceURL: 'https://tradingeconomics.com/itx:sm:market-capitalization' },
  { id: 'santander', label: 'Santander', value: 175.1e9, kind: 'marble', group: 'spanish', figure: 'Banco Santander — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/quote/bme/SAN/market-cap/' },
  // Big "surprisingly small" sectors / markets
  { id: 'airlines', label: 'Aerolíneas (todas)', value: 425.67e9, kind: 'marble', group: 'market', figure: 'Todas las aerolíneas cotizadas del mundo — capitalización agregada', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/dal/market-cap/' },
  { id: 'lujo', label: 'Lujo (mundo)', value: 404.7e9, kind: 'marble', group: 'market', perYear: true, figure: 'Bienes de lujo personal — mercado mundial (anual)', date: '2025', sourceURL: 'https://www.bain.com/about/media-center/press-releases/20252/global-luxury-stays-resilient-despite-economic-headwinds-and-shifting-consumer-trends-that-reshape-marketbain--company-and-altagamma/' },
  { id: 'coffee', label: 'Café (mundo)', value: 256.29e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial del café (minorista, anual)', date: '2025', sourceURL: 'https://www.grandviewresearch.com/industry-analysis/coffee-market' },
  { id: 'mcdonalds', label: "McDonald's", value: 194.17e9, kind: 'marble', group: 'market', figure: "McDonald's — capitalización bursátil", date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/mcd/market-cap/' },
  { id: 'videojuegos', label: 'Videojuegos (mundo)', value: 188.8e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial de videojuegos (anual)', date: '2025', sourceURL: 'https://respawn.outlookindia.com/gaming/gaming-news/global-games-market-set-for-189b-in-2025-newzoo-report' },
  { id: 'disney', label: 'Disney', value: 172.59e9, kind: 'marble', group: 'market', figure: 'The Walt Disney Company — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/dis/market-cap/' },
  { id: 'spotify', label: 'Spotify', value: 100.24e9, kind: 'marble', group: 'market', figure: 'Spotify — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/spot/market-cap/' },
  { id: 'nike', label: 'Nike', value: 64.87e9, kind: 'marble', group: 'market', figure: 'Nike — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/nke/market-cap/' },
  { id: 'ferrari', label: 'Ferrari', value: 60.67e9, kind: 'marble', group: 'market', figure: 'Ferrari — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/race/market-cap/' },
  { id: 'nintendo', label: 'Nintendo', value: 53.14e9, kind: 'marble', group: 'market', figure: 'Nintendo — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://mlq.ai/stocks/NTDOY/market-cap/' },
  { id: 'futbol', label: 'Fútbol europeo', value: 41.1236e9, kind: 'marble', group: 'market', perYear: true, figure: 'Fútbol profesional europeo — mercado (temporada)', date: '2024', sourceURL: 'https://www.deloitte.com/uk/en/about/press-room/deloitte-annual-review-of-football-finance-european-football-market-revenue.html' },
  { id: 'cine', label: 'Taquilla cine (mundo)', value: 33.55e9, kind: 'marble', group: 'market', perYear: true, figure: 'Taquilla mundial de cine (anual)', date: '2025', sourceURL: 'https://gower.st/articles/highest-grossing-december-since-2019-3-5-billion-33-6-billion-global-total-2025/' },
  { id: 'musica', label: 'Música grabada (mundo)', value: 31.7e9, kind: 'marble', group: 'market', perYear: true, figure: 'Música grabada — mercado mundial (anual, IFPI)', date: '2025', sourceURL: 'https://variety.com/2026/music/news/global-record-revenues-grow-to-31-7-billion-ifpi-2025-1236692531/' },
]

/* ── the full set + accessors ─────────────────────────────────────────────────── */

export const GALAXY_BODIES: GalaxyBodyDatum[] = [GALAXY_SUN, ...GALAXY_PLANETS, ...GALAXY_MARBLES]

/** The bodies to lay out (already `GalaxyDatum`-shaped). */
export function dataForGalaxy(): GalaxyBodyDatum[] {
  return GALAXY_BODIES
}

/* ── per-wall assignment: three separate, self-contained framed prints ────────── */

export type GalaxyPanel = 'back' | 'left' | 'right'

/**
 * Which bodies live on which wall. Each wall is its OWN framed composition (no
 * slicing): the back wall is the AI (vs Spain's whole economy); the left wall is the
 * famous global markets; the right wall is the iconic brands. All sized at one shared
 * scale (see `galaxyMaxValue`) so the comparison stays honest across the room.
 */
const WALL_BODY_IDS: Record<GalaxyPanel, string[]> = {
  back: ['ai-sun', 'nvidia', 'alphabet', 'microsoft', 'meta', 'spain-gdp', 'ibex35'],
  left: ['airlines', 'lujo', 'coffee', 'videojuegos', 'cine', 'musica', 'futbol'],
  right: ['inditex', 'santander', 'mcdonalds', 'disney', 'spotify', 'nike', 'ferrari', 'nintendo'],
}

const BY_ID = new Map(GALAXY_BODIES.map((b) => [b.id, b]))

/** The bodies assigned to one wall, in declared order. */
export function bodiesForWall(panel: GalaxyPanel): GalaxyBodyDatum[] {
  return (WALL_BODY_IDS[panel] ?? []).map((id) => {
    const b = BY_ID.get(id)
    if (!b) throw new Error(`galaxy-data: wall '${panel}' references unknown body '${id}'`)
    return b
  })
}

/** Global max valuation across ALL bodies — the shared area∝value reference. */
export function galaxyMaxValue(): number {
  return Math.max(...GALAXY_BODIES.map((b) => b.value))
}

/** Every body appears on exactly one wall (coverage guard for tests). */
export function allWallBodyIds(): string[] {
  return [...WALL_BODY_IDS.back, ...WALL_BODY_IDS.left, ...WALL_BODY_IDS.right]
}

const SOURCED_ALL = [...SUN_LABS, ...GALAXY_PLANETS, ...GALAXY_MARBLES]

/** Source hosts (deduped, first-seen) + latest date for the discreet caption. */
export function galaxySourcesCaption(label = 'Fuentes'): string {
  const hosts: string[] = []
  let latest = '0000'
  for (const d of SOURCED_ALL) {
    try {
      const h = new URL(d.sourceURL).hostname.replace(/^www\./, '')
      if (h && !hosts.includes(h)) hosts.push(h)
    } catch {
      /* ignore malformed */
    }
    if (d.date > latest) latest = d.date
  }
  const shown = hosts.slice(0, 6)
  return `${label}: ${shown.join(', ')}${hosts.length > shown.length ? ', …' : ''} · ${latest}`
}

/** Every body (incl. the summed labs) carries value + ISO date + source — throws if not. */
export function assertGalaxySourced(): void {
  const problems: string[] = []
  const check = (d: GalaxyBodyDatum) => {
    if (!(d.value > 0)) problems.push(`${d.id}: value must be > 0`)
    if (!/^\d{4}(-\d{2}){0,2}$/.test(d.date)) problems.push(`${d.id}: bad date '${d.date}'`)
    if (!d.sourceURL) problems.push(`${d.id}: missing sourceURL`)
  }
  ;[...SUN_LABS, ...GALAXY_BODIES].forEach(check)
  if (problems.length) throw new Error(`galaxy-data unsourced:\n${problems.join('\n')}`)
}
