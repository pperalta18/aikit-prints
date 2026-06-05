/**
 * galaxy-data — the sourced dataset behind the "Galaxia de mercados" installation.
 * ──────────────────────────────────────────────────────────────────────────
 * Metric (director's call): **valuation** — value compared with value. The central
 * "sun" is the combined valuation of the companies that actually build the models
 * (OpenAI + Anthropic + … = 16 labs); **Nvidia** is the one mega-cap planet (and the
 * global-max body that sets the shared scale). Everything else is a cold "marble":
 *   • whole **national economies** — the GDP of countries (Suiza, Argentina,
 *     Noruega…) smaller than Spain — and the biggest **Spanish companies** (each its
 *     OWN sphere, not the aggregate index): the dissonance the room is built on —
 *     entire nations and a country's champions are dots next to the AI;
 *   • famous global **markets / sectors** and **brands** people imagine are gigantic,
 *     dwarfed by the AI on the same scale.
 *
 * Honesty (same contract as `wall-data.ts`): every figure is absolute USD with a
 * date + source. Researched + adversarially verified June 2026 (each value an
 * independent source confirmed/adjusted; EUR→USD at 1.1606, GBP→USD at 1.3454).
 * Two honest caveats are documented, not hidden:
 *   1. The labs-sun (~$2.3 T) is genuinely SMALLER than Nvidia — so the planet renders
 *      larger than the sun. We do not fake the sun's size; it is the focal body by
 *      *light and centrality*, not by being the biggest.
 *   2. Some marbles are an annual FLOW (national GDPs, coffee, luxury, video games,
 *      streaming, football, box office, music…), not a stock of value. They carry
 *      `perYear` and read "·/año"; the wall states the two unit kinds.
 *
 * See [[galaxy-markets-walls]] and `specs/wall-graphics.md`.
 */

import type { GalaxyDatum } from '../pages/galaxy'

/** Colour family for a body — the simple warm/cool message: AI is light, the rest is cold. */
export type GalaxyGroup = 'ai' | 'spanish' | 'country' | 'market'

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
 * DeepMind & Meta Superintelligence are EXCLUDED (already inside their parent
 * companies' caps). xAI (round unconfirmed) and DeepSeek (round in progress) are
 * the two soft points.
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

/** The central body: the combined valuation of the model-makers (~$2.3 T). */
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

/* ── the planet: Nvidia, the one mega-cap (and the shared-scale max) ───────────── */

export const GALAXY_PLANETS: GalaxyBodyDatum[] = [
  { id: 'nvidia', label: 'Nvidia', value: 5.201e12, kind: 'planet', group: 'ai', figure: 'Nvidia — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/nvda/market-cap/' },
]

/* ── España: each champion its OWN sphere (no aggregate index) ─────────────────── */

/**
 * The back wall's cold Spanish marbles: the biggest IBEX 35 companies, each as its
 * own circle — NOT the aggregate index — so the room reads "even Inditex, even
 * Santander, is a dot next to the AI." EUR→USD @ 1.1606, IAG from its London (GBP)
 * line @ 1.3454.
 */
export const GALAXY_SPANISH: GalaxyBodyDatum[] = [
  { id: 'inditex', label: 'Inditex', value: 193.25e9, kind: 'marble', group: 'spanish', figure: 'Inditex — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/ITX/market-cap/' },
  { id: 'santander', label: 'Santander', value: 176.71e9, kind: 'marble', group: 'spanish', figure: 'Banco Santander — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/SAN/market-cap/' },
  { id: 'iberdrola', label: 'Iberdrola', value: 151.03e9, kind: 'marble', group: 'spanish', figure: 'Iberdrola — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/IBE/market-cap/' },
  { id: 'bbva', label: 'BBVA', value: 127.13e9, kind: 'marble', group: 'spanish', figure: 'BBVA — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/BBVA/market-cap/' },
  { id: 'caixabank', label: 'CaixaBank', value: 93.03e9, kind: 'marble', group: 'spanish', figure: 'CaixaBank — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/CABK/market-cap/' },
  { id: 'ferrovial', label: 'Ferrovial', value: 47.7e9, kind: 'marble', group: 'spanish', figure: 'Ferrovial — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/FER/market-cap/' },
  { id: 'endesa', label: 'Endesa', value: 44.21e9, kind: 'marble', group: 'spanish', figure: 'Endesa — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/ELE/market-cap/' },
  { id: 'aena', label: 'Aena', value: 42.2e9, kind: 'marble', group: 'spanish', figure: 'Aena — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/AENA/market-cap/' },
  { id: 'acs', label: 'ACS', value: 37.63e9, kind: 'marble', group: 'spanish', figure: 'ACS — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/ACS/market-cap/' },
  { id: 'naturgy', label: 'Naturgy', value: 31.22e9, kind: 'marble', group: 'spanish', figure: 'Naturgy — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/NTGY/market-cap/' },
  { id: 'repsol', label: 'Repsol', value: 29.39e9, kind: 'marble', group: 'spanish', figure: 'Repsol — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/REP/market-cap/' },
  { id: 'amadeus', label: 'Amadeus', value: 25.81e9, kind: 'marble', group: 'spanish', figure: 'Amadeus IT Group — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/AMS/market-cap/' },
  { id: 'telefonica', label: 'Telefónica', value: 25.74e9, kind: 'marble', group: 'spanish', figure: 'Telefónica — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/TEF/market-cap/' },
  { id: 'iag', label: 'IAG', value: 25.29e9, kind: 'marble', group: 'spanish', figure: 'IAG (Iberia / British Airways) — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/lon/IAG/market-cap/' },
  { id: 'cellnex', label: 'Cellnex', value: 22.12e9, kind: 'marble', group: 'spanish', figure: 'Cellnex Telecom — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/CLNX/market-cap/' },
  { id: 'bankinter', label: 'Bankinter', value: 14.7e9, kind: 'marble', group: 'spanish', figure: 'Bankinter — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/BKT/market-cap/' },
  { id: 'mapfre', label: 'Mapfre', value: 13.83e9, kind: 'marble', group: 'spanish', figure: 'Mapfre — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/MAP/market-cap/' },
  { id: 'merlin', label: 'Merlin', value: 10.85e9, kind: 'marble', group: 'spanish', figure: 'Merlin Properties — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/quote/bme/MRL/market-cap/' },
]

/* ── whole nations: other countries' GDPs, each its own sphere ─────────────────── */

/**
 * National economies as cold marbles — the GDP (an annual flow) of countries smaller
 * than Spain, each clearly dwarfed by the AI on the same scale: "naciones enteras son
 * puntos junto a la IA." IMF 2026 nominal estimates (US$), one consistent source.
 */
export const GALAXY_COUNTRIES: GalaxyBodyDatum[] = [
  { id: 'switzerland', label: 'Suiza', value: 1.146911e12, kind: 'marble', group: 'country', perYear: true, figure: 'PIB nominal de Suiza (anual, est. FMI 2026)', date: '2026', sourceURL: 'https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)' },
  { id: 'argentina', label: 'Argentina', value: 688.378e9, kind: 'marble', group: 'country', perYear: true, figure: 'PIB nominal de Argentina (anual, est. FMI 2026)', date: '2026', sourceURL: 'https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)' },
  { id: 'norway', label: 'Noruega', value: 599.406e9, kind: 'marble', group: 'country', perYear: true, figure: 'PIB nominal de Noruega (anual, est. FMI 2026)', date: '2026', sourceURL: 'https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)' },
  { id: 'portugal', label: 'Portugal', value: 380.637e9, kind: 'marble', group: 'country', perYear: true, figure: 'PIB nominal de Portugal (anual, est. FMI 2026)', date: '2026', sourceURL: 'https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)' },
]

/* ── the markets/sectors you picture as huge (mostly annual flows) ─────────────── */

export const GALAXY_SECTORS: GalaxyBodyDatum[] = [
  { id: 'smartphones', label: 'Smartphones', value: 607.56e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial de smartphones (ventas anuales)', date: '2025', sourceURL: 'https://www.precedenceresearch.com/smartphones-market' },
  { id: 'vino', label: 'Vino', value: 549.65e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial del vino (anual, valor minorista)', date: '2025', sourceURL: 'https://www.grandviewresearch.com/industry-analysis/wine-market' },
  { id: 'airlines', label: 'Aerolíneas', value: 425.67e9, kind: 'marble', group: 'market', figure: 'Todas las aerolíneas cotizadas del mundo — capitalización agregada', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/dal/market-cap/' },
  { id: 'lujo', label: 'Lujo', value: 404.7e9, kind: 'marble', group: 'market', perYear: true, figure: 'Bienes de lujo personal — mercado mundial (anual)', date: '2025', sourceURL: 'https://www.bain.com/about/media-center/press-releases/20252/global-luxury-stays-resilient-despite-economic-headwinds-and-shifting-consumer-trends-that-reshape-marketbain--company-and-altagamma/' },
  { id: 'mascotas', label: 'Mascotas', value: 273.42e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial del cuidado de mascotas (anual)', date: '2025', sourceURL: 'https://www.fortunebusinessinsights.com/pet-care-market-104749' },
  { id: 'coffee', label: 'Café', value: 256.29e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial del café (minorista, anual)', date: '2025', sourceURL: 'https://www.grandviewresearch.com/industry-analysis/coffee-market' },
  { id: 'videojuegos', label: 'Videojuegos', value: 188.8e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial de videojuegos (anual)', date: '2025', sourceURL: 'https://respawn.outlookindia.com/gaming/gaming-news/global-games-market-set-for-189b-in-2025-newzoo-report' },
  { id: 'streaming-video', label: 'Streaming vídeo', value: 157.1e9, kind: 'marble', group: 'market', perYear: true, figure: 'Suscripción de streaming de vídeo — ingresos mundiales (anual)', date: '2025', sourceURL: 'https://www.mediaplaynews.com/ampere-global-streaming-subscription-revenue-topped-150-billion-in-2025/' },
  { id: 'calzado-deportivo', label: 'Zapatillas', value: 145.49e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial de calzado deportivo (anual)', date: '2025', sourceURL: 'https://www.fortunebusinessinsights.com/athletic-footwear-market-104126' },
  { id: 'chocolate', label: 'Chocolate', value: 128.02e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial del chocolate (anual)', date: '2025', sourceURL: 'https://www.grandviewresearch.com/industry-analysis/chocolate-market' },
  { id: 'whisky', label: 'Whisky', value: 77.92e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial del whisky (anual)', date: '2025', sourceURL: 'https://www.grandviewresearch.com/industry-analysis/whiskey-market' },
  { id: 'arte', label: 'Mercado del arte', value: 57.5e9, kind: 'marble', group: 'market', perYear: true, figure: 'Ventas mundiales del mercado del arte (anual, Art Basel/UBS)', date: '2024', sourceURL: 'https://www.artbasel.com/news/the-art-basel-and-ubs-global-art-market-report-2025' },
  { id: 'futbol', label: 'Fútbol europeo', value: 41.1236e9, kind: 'marble', group: 'market', perYear: true, figure: 'Fútbol profesional europeo — mercado (temporada)', date: '2024', sourceURL: 'https://www.deloitte.com/uk/en/about/press-room/deloitte-annual-review-of-football-finance-european-football-market-revenue.html' },
  { id: 'cine', label: 'Taquilla cine', value: 33.55e9, kind: 'marble', group: 'market', perYear: true, figure: 'Taquilla mundial de cine (anual)', date: '2025', sourceURL: 'https://gower.st/articles/highest-grossing-december-since-2019-3-5-billion-33-6-billion-global-total-2025/' },
  { id: 'musica', label: 'Música grabada', value: 31.7e9, kind: 'marble', group: 'market', perYear: true, figure: 'Música grabada — mercado mundial (anual, IFPI)', date: '2025', sourceURL: 'https://variety.com/2026/music/news/global-record-revenues-grow-to-31-7-billion-ifpi-2025-1236692531/' },
  { id: 'aceite-oliva', label: 'Aceite de oliva', value: 19.42e9, kind: 'marble', group: 'market', perYear: true, figure: 'Mercado mundial del aceite de oliva (anual)', date: '2025', sourceURL: 'https://www.fortunebusinessinsights.com/industry-reports/olive-oil-market-101455' },
]

/* ── the famous brands/companies you picture as giants (market caps) ───────────── */

export const GALAXY_COMPANIES: GalaxyBodyDatum[] = [
  { id: 'netflix', label: 'Netflix', value: 343.52e9, kind: 'marble', group: 'market', figure: 'Netflix — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/nflx/market-cap/' },
  { id: 'coca-cola', label: 'Coca-Cola', value: 330.6e9, kind: 'marble', group: 'market', figure: 'Coca-Cola — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/ko/market-cap/' },
  { id: 'mcdonalds', label: "McDonald's", value: 193.84e9, kind: 'marble', group: 'market', figure: "McDonald's — capitalización bursátil", date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/mcd/market-cap/' },
  { id: 'disney', label: 'Disney', value: 172.49e9, kind: 'marble', group: 'market', figure: 'The Walt Disney Company — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/dis/market-cap/' },
  { id: 'boeing', label: 'Boeing', value: 171.41e9, kind: 'marble', group: 'market', figure: 'Boeing — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/ba/market-cap/' },
  { id: 'uber', label: 'Uber', value: 146.99e9, kind: 'marble', group: 'market', figure: 'Uber — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/uber/market-cap/' },
  { id: 'sony', label: 'Sony', value: 130.72e9, kind: 'marble', group: 'market', figure: 'Sony — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/sony/market-cap/' },
  { id: 'starbucks', label: 'Starbucks', value: 107.27e9, kind: 'marble', group: 'market', figure: 'Starbucks — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/sbux/market-cap/' },
  { id: 'spotify', label: 'Spotify', value: 100.24e9, kind: 'marble', group: 'market', figure: 'Spotify — capitalización bursátil', date: '2026-06-03', sourceURL: 'https://stockanalysis.com/stocks/spot/market-cap/' },
  { id: 'airbnb', label: 'Airbnb', value: 79.35e9, kind: 'marble', group: 'market', figure: 'Airbnb — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/abnb/market-cap/' },
  { id: 'nike', label: 'Nike', value: 64.57e9, kind: 'marble', group: 'market', figure: 'Nike — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/nke/market-cap/' },
  { id: 'ferrari', label: 'Ferrari', value: 60.84e9, kind: 'marble', group: 'market', figure: 'Ferrari — capitalización bursátil', date: '2026-06', sourceURL: 'https://stockanalysis.com/stocks/race/market-cap/' },
  { id: 'lego', label: 'Lego', value: 55e9, kind: 'marble', group: 'market', note: 'Empresa privada — valoración estimada', figure: 'Lego — valoración estimada (empresa privada)', date: '2026-06', sourceURL: 'https://www.researchgate.net/publication/389414029_The_Study_of_LEGOs_Market_Leadership_A_Financial_Valuation_Model_and_Strategic_Evaluation' },
  { id: 'nintendo', label: 'Nintendo', value: 53.09e9, kind: 'marble', group: 'market', figure: 'Nintendo — capitalización bursátil', date: '2026-06', sourceURL: 'https://companiesmarketcap.com/nintendo/marketcap/' },
  { id: 'adidas', label: 'Adidas', value: 33.1e9, kind: 'marble', group: 'market', figure: 'Adidas — capitalización bursátil', date: '2026-06', sourceURL: 'https://companiesmarketcap.com/adidas/marketcap/' },
]

/* ── the full set + accessors ─────────────────────────────────────────────────── */

export const GALAXY_BODIES: GalaxyBodyDatum[] = [GALAXY_SUN, ...GALAXY_PLANETS, ...GALAXY_COUNTRIES, ...GALAXY_SPANISH, ...GALAXY_SECTORS, ...GALAXY_COMPANIES]

/** The bodies to lay out (already `GalaxyDatum`-shaped). */
export function dataForGalaxy(): GalaxyBodyDatum[] {
  return GALAXY_BODIES
}

/* ── per-wall assignment: three separate, self-contained framed prints ────────── */

export type GalaxyPanel = 'back' | 'left' | 'right'

/**
 * Which bodies live on which wall. Each wall is its OWN framed composition (no
 * slicing): the back wall is the AI (Nvidia + the labs-sun) ringed by other nations'
 * GDPs and Spain's biggest companies; the left wall is the famous global markets/sectors;
 * the right wall is the iconic brands. All sized at one shared scale (see `galaxyMaxValue`) so
 * the comparison stays honest across the room.
 */
const WALL_BODY_IDS: Record<GalaxyPanel, string[]> = {
  back: ['ai-sun', 'nvidia', ...GALAXY_COUNTRIES.map((b) => b.id), ...GALAXY_SPANISH.map((b) => b.id)],
  left: GALAXY_SECTORS.map((b) => b.id),
  right: GALAXY_COMPANIES.map((b) => b.id),
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

const SOURCED_ALL = [...SUN_LABS, ...GALAXY_PLANETS, ...GALAXY_COUNTRIES, ...GALAXY_SPANISH, ...GALAXY_SECTORS, ...GALAXY_COMPANIES]

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
