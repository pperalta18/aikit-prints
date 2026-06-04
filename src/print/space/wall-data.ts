/**
 * wall-data — the versioned, sourced data file for the AiKit Live code track.
 * ──────────────────────────────────────────────────────────────────────────
 * The non-negotiable principle of the wall graphics is honesty: a text-to-image
 * model invents axes and figures; the code track renders only numbers that were
 * **researched, dated and sourced**. This file is the single source of those
 * numbers. Every datum carries the `{ figure, value, date, sourceURL }` contract
 * (`Datum` from `dataviz-scales`) plus production metadata, and the data-viz
 * pages (the hero "sistema solar", #8 model size, #11 acceleration charts, …)
 * import their figures from here — never from prose, never from a model.
 *
 * Rules this file enforces:
 *   • Nothing ships unverified — `assertSourced()` throws if any datum is missing
 *     a value, an ISO date, or a source URL. Pages/build can call it as a guard.
 *   • One unit per piece — every datum on a chart shares a single `unit`, so the
 *     values are directly comparable on it (you never mix dollars and parameters
 *     on one axis). Money pieces are absolute USD, so they drop straight into
 *     `circleAreaScale` (area ∝ value) and `formatMoney` ("$5.24 T"); the model-
 *     size piece (#8) is parameter counts that feed `scaleLog` / `formatCompact`.
 *   • The hooks the brief proposes ("one AI co > the IBEX 35", "AI > Spain GDP")
 *     are *computed from the data* (`heroHooks()`), so a stale figure that breaks
 *     a hook fails a test instead of shipping a false claim.
 *
 * Image / hybrid-track walls (#13 autonomous trucks & dark factories, #20 salones…)
 * render imagery, not axes, but their imagery must still depict things that are
 * genuinely REAL. Those walls are grounded by a parallel **reference** schema
 * ({@link RefItem} / {@link RefPiece}, registry {@link WALL_REFS}) — each reference
 * is dated + sourced just like a datum, but kept apart from {@link WALL_DATA} so it
 * never feeds (nor relaxes the single-unit invariant of) the code-track charts.
 *
 * Versioned via {@link WALL_DATA_VERSION}; bump it when the schema changes.
 * See `specs/wall-graphics.md` (Methodology · Hero piece).
 */

import type { Datum } from '../pages/dataviz-scales.ts'
import { sourceHost, sourcesCaption } from '../pages/dataviz-scales.ts'

/**
 * Schema version of this data file. Bump on any shape change to `WallDatum` /
 * `PieceData` (or the `RefItem` / `RefPiece` reference schema, introduced at v5).
 * v6 extends `RefCategory` for the #20 salones-por-siglos piece.
 */
export const WALL_DATA_VERSION = 6

/* ── the datum contract (extends the `Datum` source-of-truth) ─────────────────── */

/**
 * Curation grouping — decides a datum's colour / size family on the piece.
 *   • `ai-giant-public`  — a public company's market cap.
 *   • `ai-giant-private` — a private AI lab's last-round (post-money) valuation.
 *   • `spanish-ref`      — a Spanish blue-chip's market cap (the "shock" refs).
 *   • `aggregate`        — an index or national total (IBEX 35, Spain GDP).
 *   • `shock-market`     — a market that feels huge but is small in money.
 *   • `model`            — an ML model's size in parameters (the #8 timeline).
 *   • `capability`       — what a model can *do* over time (the #11 METR task
 *                          time-horizon: seconds of human work it completes).
 *   • `context`          — a model's context window in tokens (the #11 memory
 *                          milestones 2K → 1M).
 *   • `productivity`     — time to complete a real coding task with vs without an
 *                          AI assistant (the #16 GitHub controlled study).
 *   • `adoption`         — share of code (percent) already written by AI at a
 *                          named company / tool (the #16 usage datum).
 */
export type DatumGroup =
  | 'ai-giant-public'
  | 'ai-giant-private'
  | 'spanish-ref'
  | 'aggregate'
  | 'shock-market'
  | 'model'
  | 'capability'
  | 'context'
  | 'productivity'
  | 'adoption'

/**
 * One researched figure for a wall piece. Satisfies the `{ figure, value, date,
 * sourceURL }` contract and adds production metadata (`id`, `label`, `group`,
 * `unit`, optional `note`). `value` is always in `unit` (absolute USD for money,
 * so `circleAreaScale`/`formatMoney` consume it directly).
 */
export type WallDatum = Datum & {
  /** Stable key, unique within its piece (React keys + targeted edits). */
  id: string
  /** Short on-wall label, e.g. "OpenAI", "IBEX 35". */
  label: string
  /** Curation grouping. */
  group: DatumGroup
  /** Unit of `value`, single per piece — "USD" for money, "parameters" for #8. */
  unit: string
  /** Discreet caveat — e.g. a definition note, or "última ronda privada". */
  note?: string
}

/** A wall's researched dataset + the sources note the spec requires beside it. */
export type PieceData = {
  /** Inventory id (1..21) of the wall this data feeds. */
  invId: number
  /** Code id of the wall — always `wall-(invId-1)`. */
  code: string
  /** Slug / key under {@link WALL_DATA}. */
  slug: string
  /** Human title. */
  title: string
  /** Room / zone. */
  sala: string
  /** The researched figures — every entry sourced + dated. */
  data: WallDatum[]
  /** One-line narrative sources note (the per-piece deliverable). */
  sourcesNote: string
}

/* ── reference contract (image / hybrid track) ───────────────────────────────── */

/**
 * Coarse category of a reference, so a piece can assert it covers the real-world
 * upgrades its room claims. A plain string union (no exhaustive `Record` consumes
 * it, so adding a category never breaks a build); extend it as new image-track
 * walls are researched.
 */
export type RefCategory =
  | 'autonomous-vehicle'
  | 'dark-factory'
  /** A household-technology / comfort milestone (the #20 salones-por-siglos arc). */
  | 'domestic-milestone'
  /** A historical purchasing-power / economics anchor (Velázquez's salary). */
  | 'historical-economics'

/**
 * A verifiable real-world reference for an image / hybrid-track wall. The image
 * track must never render axes or invented figures, but its imagery has to depict
 * things that are genuinely REAL — so a wall that claims "this is already
 * happening" (#13 autonomous trucks / dark factories, #20 salones…) is grounded in
 * dated, sourced references recorded here. Unlike a chart {@link WallDatum}, refs
 * are a curated gallery rather than one axis, so they do **not** share a unit; an
 * optional `value` + `unit` carries a headline figure only when one exists.
 */
export type RefItem = {
  /** Stable key, unique within its piece. */
  id: string
  /** Short on-wall label, e.g. "Aurora", "Xiaomi". */
  label: string
  /** Coarse category — what kind of real-world upgrade this proves. */
  category: RefCategory
  /** The verifiable claim in one line — what is already real. */
  claim: string
  /** ISO date (`YYYY` / `YYYY-MM` / `YYYY-MM-DD`) the fact was reported / true. */
  date: string
  /** Source URL — must resolve to a host. */
  sourceURL: string
  /** Optional headline figure (driverless miles, phones/year, …). */
  value?: number
  /** Unit of `value`; required when `value` is present (refs need not share one). */
  unit?: string
  /** Optional caveat / scope (e.g. a marketing-vs-measured rate). */
  note?: string
}

/** A reference dataset for an image / hybrid wall + the sources note beside it. */
export type RefPiece = {
  /** Inventory id (1..21) of the wall this grounds. */
  invId: number
  /** Code id of the wall — always `wall-(invId-1)`. */
  code: string
  /** Slug / key under {@link WALL_REFS}. */
  slug: string
  /** Human title. */
  title: string
  /** Room / zone. */
  sala: string
  /** The verifiable references — each dated + sourced. */
  refs: RefItem[]
  /** One-line narrative sources note (the per-piece deliverable). */
  sourcesNote: string
}

/* ── validation (nothing unverified ships) ───────────────────────────────────── */

/**
 * ISO date at year, month, or day precision (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`)
 * with a valid month (and day when present). Year precision is allowed for
 * genuinely annual figures (GDP, an index's aggregate cap, an annual market size).
 */
const ISO_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/

/** True when `s` is an ISO `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` date string. */
export function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && ISO_DATE.test(s)
}

/**
 * Everything wrong with a candidate datum, as human-readable strings (empty when
 * it is a fully-sourced, well-formed {@link WallDatum}). Drives `assertSourced`
 * and is handy in tests for a precise failure message.
 */
export function datumProblems(x: unknown): string[] {
  const problems: string[] = []
  if (!x || typeof x !== 'object') return ['not an object']
  const d = x as Record<string, unknown>
  const str = (k: string) => typeof d[k] === 'string' && (d[k] as string).trim() !== ''
  if (!str('figure')) problems.push('figure must be a non-empty string')
  if (typeof d.value !== 'number' || !Number.isFinite(d.value)) problems.push('value must be a finite number')
  if (!isIsoDate(d.date)) problems.push('date must be ISO YYYY, YYYY-MM or YYYY-MM-DD')
  if (!str('sourceURL')) problems.push('sourceURL must be a non-empty string')
  else if (!sourceHost(d.sourceURL as string)) problems.push('sourceURL has no resolvable host')
  if (!str('id')) problems.push('id must be a non-empty string')
  if (!str('label')) problems.push('label must be a non-empty string')
  if (!str('unit')) problems.push('unit must be a non-empty string')
  if (typeof d.group !== 'string') problems.push('group must be a string')
  return problems
}

/** Type-guard: a fully-sourced, well-formed {@link WallDatum}. */
export function isWallDatum(x: unknown): x is WallDatum {
  return datumProblems(x).length === 0
}

/**
 * Throw if any datum in `pieces` is unsourced or malformed — the "nothing ships
 * unverified" guard. Also catches duplicate ids and a `code`/`invId` mismatch.
 * Defaults to validating the whole file.
 */
export function assertSourced(pieces: PieceData[] = allPieces()): void {
  for (const piece of pieces) {
    if (piece.code !== `wall-${piece.invId - 1}`) {
      throw new Error(`wall-data: piece '${piece.slug}' code ${piece.code} ≠ wall-${piece.invId - 1}`)
    }
    const seen = new Set<string>()
    for (const d of piece.data) {
      const problems = datumProblems(d)
      if (problems.length) {
        throw new Error(`wall-data: '${piece.slug}' datum '${(d as WallDatum)?.id ?? '?'}' — ${problems.join('; ')}`)
      }
      if (seen.has(d.id)) throw new Error(`wall-data: '${piece.slug}' duplicate datum id '${d.id}'`)
      seen.add(d.id)
    }
  }
}

/* ── reference validation (image-track refs are sourced too) ───────────────────── */

/**
 * Everything wrong with a candidate {@link RefItem} (empty when well-formed and
 * fully sourced). A ref always needs an id / label / category / claim / date /
 * sourceURL; `value` and `unit` are optional, but if either is present the value
 * must be a finite positive number **and** carry a unit (no orphan figures).
 */
export function refProblems(x: unknown): string[] {
  const problems: string[] = []
  if (!x || typeof x !== 'object') return ['not an object']
  const r = x as Record<string, unknown>
  const str = (k: string) => typeof r[k] === 'string' && (r[k] as string).trim() !== ''
  if (!str('id')) problems.push('id must be a non-empty string')
  if (!str('label')) problems.push('label must be a non-empty string')
  if (!str('category')) problems.push('category must be a non-empty string')
  if (!str('claim')) problems.push('claim must be a non-empty string')
  if (!isIsoDate(r.date)) problems.push('date must be ISO YYYY, YYYY-MM or YYYY-MM-DD')
  if (!str('sourceURL')) problems.push('sourceURL must be a non-empty string')
  else if (!sourceHost(r.sourceURL as string)) problems.push('sourceURL has no resolvable host')
  if (r.value !== undefined || r.unit !== undefined) {
    if (typeof r.value !== 'number' || !Number.isFinite(r.value) || (r.value as number) <= 0) {
      problems.push('value must be a finite positive number when a figure is given')
    }
    if (!str('unit')) problems.push('unit must accompany a value')
  }
  return problems
}

/** Type-guard: a fully-sourced, well-formed {@link RefItem}. */
export function isRefItem(x: unknown): x is RefItem {
  return refProblems(x).length === 0
}

/**
 * Throw if any reference is unsourced / malformed, has a duplicate id, or sits on a
 * `code`/`invId` mismatch — the image-track twin of {@link assertSourced}. Defaults
 * to validating every registered reference piece.
 */
export function assertRefsSourced(pieces: RefPiece[] = allRefPieces()): void {
  for (const piece of pieces) {
    if (piece.code !== `wall-${piece.invId - 1}`) {
      throw new Error(`wall-data: ref piece '${piece.slug}' code ${piece.code} ≠ wall-${piece.invId - 1}`)
    }
    const seen = new Set<string>()
    for (const r of piece.refs) {
      const problems = refProblems(r)
      if (problems.length) {
        throw new Error(`wall-data: ref '${piece.slug}' item '${(r as RefItem)?.id ?? '?'}' — ${problems.join('; ')}`)
      }
      if (seen.has(r.id)) throw new Error(`wall-data: ref '${piece.slug}' duplicate item id '${r.id}'`)
      seen.add(r.id)
    }
  }
}

/* ── HERO — "Sistema solar de la inversión" (wall 2, S3 INVESTMENT face) ───────── */

/**
 * Circle area ∝ money. AI giants are giant balls; Spanish blue-chips, the IBEX 35
 * and Spain's GDP are the shock references; the world coffee market is the "huge
 * in the imagination, small in money" marble. All money in absolute USD, verified
 * with source + date (June 2026 snapshot). The "≈$49 bn" coffee myth in the brief
 * is corrected here: that figure is only green (commodity) coffee — the finished
 * retail market is ~$249 bn, still far below a single AI company.
 */
const HERO: PieceData = {
  invId: 2,
  code: 'wall-1',
  slug: 'sistema-solar-inversion',
  title: 'Sistema solar de la inversión',
  sala: 'S3',
  data: [
    // ── AI giants — public market cap (June 2026) ──
    {
      id: 'nvidia',
      label: 'Nvidia',
      group: 'ai-giant-public',
      unit: 'USD',
      figure: 'Nvidia — capitalización bursátil',
      value: 5.24e12,
      date: '2026-06-03',
      sourceURL: 'https://companiesmarketcap.com/nvidia/marketcap/',
    },
    {
      id: 'alphabet',
      label: 'Alphabet',
      group: 'ai-giant-public',
      unit: 'USD',
      figure: 'Alphabet (Google) — capitalización bursátil',
      value: 4.342e12,
      date: '2026-06',
      sourceURL: 'https://companiesmarketcap.com/alphabet-google/marketcap/',
    },
    {
      id: 'microsoft',
      label: 'Microsoft',
      group: 'ai-giant-public',
      unit: 'USD',
      figure: 'Microsoft — capitalización bursátil',
      value: 3.174e12,
      date: '2026-06',
      sourceURL: 'https://companiesmarketcap.com/microsoft/marketcap/',
    },
    {
      id: 'meta',
      label: 'Meta',
      group: 'ai-giant-public',
      unit: 'USD',
      figure: 'Meta Platforms — capitalización bursátil',
      value: 1.581e12,
      date: '2026-06',
      sourceURL: 'https://companiesmarketcap.com/meta-platforms/marketcap/',
    },
    // ── AI labs — last private round, post-money ──
    {
      id: 'anthropic',
      label: 'Anthropic',
      group: 'ai-giant-private',
      unit: 'USD',
      figure: 'Anthropic — valoración última ronda (Serie H, post-money)',
      value: 965e9,
      date: '2026-05-28',
      note: 'Última ronda privada, no cotiza',
      sourceURL: 'https://www.anthropic.com/news/series-h',
    },
    {
      id: 'openai',
      label: 'OpenAI',
      group: 'ai-giant-private',
      unit: 'USD',
      figure: 'OpenAI — valoración última ronda (post-money)',
      value: 852e9,
      date: '2026-03-31',
      note: 'Última ronda privada, no cotiza',
      sourceURL: 'https://www.cnbc.com/2026/03/31/openai-funding-round-ipo.html',
    },
    // ── Spanish blue-chips — market cap (June 2026) ──
    {
      id: 'inditex',
      label: 'Inditex',
      group: 'spanish-ref',
      unit: 'USD',
      figure: 'Inditex — capitalización bursátil',
      value: 193.19e9,
      date: '2026-06',
      sourceURL: 'https://companiesmarketcap.com/spain/largest-companies-in-spain-by-market-cap/',
    },
    {
      id: 'santander',
      label: 'Banco Santander',
      group: 'spanish-ref',
      unit: 'USD',
      figure: 'Banco Santander — capitalización bursátil',
      value: 175.1e9,
      date: '2026-06',
      sourceURL: 'https://companiesmarketcap.com/spain/largest-companies-in-spain-by-market-cap/',
    },
    {
      id: 'iberdrola',
      label: 'Iberdrola',
      group: 'spanish-ref',
      unit: 'USD',
      figure: 'Iberdrola — capitalización bursátil',
      value: 152.89e9,
      date: '2026-06',
      sourceURL: 'https://companiesmarketcap.com/spain/largest-companies-in-spain-by-market-cap/',
    },
    {
      id: 'bbva',
      label: 'BBVA',
      group: 'spanish-ref',
      unit: 'USD',
      figure: 'BBVA — capitalización bursátil',
      value: 126.05e9,
      date: '2026-06',
      sourceURL: 'https://companiesmarketcap.com/spain/largest-companies-in-spain-by-market-cap/',
    },
    {
      id: 'repsol',
      label: 'Repsol',
      group: 'spanish-ref',
      unit: 'USD',
      figure: 'Repsol — capitalización bursátil',
      value: 29.68e9,
      date: '2026-06',
      sourceURL: 'https://companiesmarketcap.com/spain/largest-companies-in-spain-by-market-cap/',
    },
    {
      id: 'telefonica',
      label: 'Telefónica',
      group: 'spanish-ref',
      unit: 'USD',
      figure: 'Telefónica — capitalización bursátil',
      value: 25.76e9,
      date: '2026-06',
      sourceURL: 'https://companiesmarketcap.com/spain/largest-companies-in-spain-by-market-cap/',
    },
    // ── Aggregates — the "this is everything" references ──
    {
      id: 'ibex35',
      label: 'IBEX 35',
      group: 'aggregate',
      unit: 'USD',
      figure: 'IBEX 35 — capitalización agregada del índice',
      value: 1.07e12,
      date: '2026',
      note: 'Suma de las 35 mayores cotizadas españolas',
      sourceURL: 'https://marketcap.company/stock-indices/ibex-35-index-market-cap/',
    },
    {
      id: 'spain-gdp',
      label: 'PIB de España',
      group: 'aggregate',
      unit: 'USD',
      figure: 'PIB nominal de España (2025)',
      value: 1.891e12,
      date: '2025',
      note: 'FMI, World Economic Outlook',
      sourceURL: 'https://www.imf.org/external/datamapper/NGDPD@WEO/ESP',
    },
    // ── Shock market — huge in the imagination, small in money ──
    {
      id: 'coffee',
      label: 'Café (mundo)',
      group: 'shock-market',
      unit: 'USD',
      figure: 'Mercado mundial del café (minorista, producto terminado, 2025)',
      value: 249.34e9,
      date: '2025',
      note: 'El "≈$49 bn" alude solo al café verde (materia prima); el minorista es ~$249 bn',
      sourceURL: 'https://www.grandviewresearch.com/industry-analysis/coffee-market',
    },
  ],
  sourcesNote:
    'Capitalizaciones bursátiles (jun 2026, companiesmarketcap.com), valoraciones de última ronda ' +
    'de OpenAI/Anthropic (CNBC / Anthropic, mar–may 2026), IBEX 35 (marketcap.company), PIB de España ' +
    '(FMI WEO 2025) y mercado mundial del café (Grand View Research 2025). Área ∝ dinero.',
}

/* ── #8 — "Tamaño de modelos" (wall 8, S2 Intro IA) ────────────────────────────── */

/**
 * Model size in **parameters**, Perceptrón (1958) → frontier (2025). The room's
 * message: "no es magia, es multiplicación de matrices" — the matrices *are* the
 * parameters, and they grew ~10 orders of magnitude in ~70 years.
 *
 * Honesty notes baked into the data:
 *   • Every figure is the *officially disclosed* parameter count **except GPT-4**,
 *     whose size OpenAI never published; its 1.8 T is the widely-cited estimate
 *     for the mixture-of-experts model and is flagged as such in its `note`.
 *   • MoE totals (Kimi K2) report total parameters; the active-per-token count is
 *     in the `note` so the comparison with dense models stays honest.
 *   • One unit ("parameters") so the series feeds `scaleLog` / `formatCompact`
 *     directly — the span is logarithmic, never area∝value.
 */
const MODEL_SIZES: PieceData = {
  invId: 8,
  code: 'wall-7',
  slug: 'tamano-de-modelos',
  title: 'Tamaño de modelos',
  sala: 'S2',
  data: [
    {
      id: 'perceptron',
      label: 'Perceptrón (Mark I)',
      group: 'model',
      unit: 'parameters',
      figure: 'Perceptrón Mark I — pesos ajustables (potenciómetros)',
      value: 512,
      date: '1958',
      note: 'Unidades de asociación con peso ajustable del hardware Mark I de Rosenblatt',
      sourceURL: 'https://en.wikipedia.org/wiki/Perceptron',
    },
    {
      id: 'alexnet',
      label: 'AlexNet',
      group: 'model',
      unit: 'parameters',
      figure: 'AlexNet — parámetros',
      value: 60e6,
      date: '2012',
      sourceURL:
        'https://proceedings.neurips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks.pdf',
    },
    {
      id: 'gpt2',
      label: 'GPT-2',
      group: 'model',
      unit: 'parameters',
      figure: 'GPT-2 (modelo mayor) — parámetros',
      value: 1.5e9,
      date: '2019',
      sourceURL: 'https://openai.com/index/gpt-2-1-5b-release/',
    },
    {
      id: 'gpt3',
      label: 'GPT-3',
      group: 'model',
      unit: 'parameters',
      figure: 'GPT-3 — parámetros',
      value: 175e9,
      date: '2020',
      sourceURL: 'https://arxiv.org/abs/2005.14165',
    },
    {
      id: 'gpt4',
      label: 'GPT-4',
      group: 'model',
      unit: 'parameters',
      figure: 'GPT-4 — parámetros (estimación)',
      value: 1.8e12,
      date: '2023',
      note: 'Estimación; OpenAI no divulgó el tamaño (arquitectura mixture-of-experts)',
      sourceURL: 'https://dbmi.hms.harvard.edu/news/should-ai-be-scaled-down',
    },
    {
      id: 'kimi-k2',
      label: 'Kimi K2',
      group: 'model',
      unit: 'parameters',
      figure: 'Kimi K2 (Moonshot AI) — parámetros totales',
      value: 1.0e12,
      date: '2025-07',
      note: 'MoE: 1 billón de parámetros totales, 32 mil millones activos por token',
      sourceURL: 'https://moonshotai.github.io/Kimi-K2/',
    },
  ],
  sourcesNote:
    'Recuentos de parámetros publicados: Perceptrón Mark I (Wikipedia), AlexNet (NeurIPS 2012), ' +
    'GPT-2 (OpenAI 2019), GPT-3 (arXiv 2005.14165), Kimi K2 (Moonshot AI 2025). GPT-4 es la ' +
    'estimación pública (~1,8 B) al no haberse divulgado su tamaño. Escala logarítmica.',
}

/* ── #11 — "Aceleración" (wall 11, S3 nave E, zoned charts per camera) ──────────── */

/**
 * The S3 "Nave E" is a 23 m light-box wall whose message is **es inevitable —
 * velocidad**. The brief asks for *zoned acceleration charts per camera* rather
 * than one stretched poster, so #11 is a **family** of single-unit charts (each
 * its own `PieceData` on `invId 11`, retrieved with {@link piecesByInvId}). Two
 * charts carry the message most legibly and are the most verifiable; the others
 * the brief floats are cut on purpose (message-first):
 *   • stock exponentials → already the hero's domain (valuations on wall 2);
 *   • US-vs-EU growth "AI-discounted" → deferred until a clean primary source;
 *   • # of frontier labs/models → a candidate, dropped to keep two strong reads.
 *
 * Chart A — **task horizon (capability over time)**: METR's 50%-reliability time
 * horizon, the length of human work a model finishes autonomously. Values from
 * METR Time Horizon 1.1 (Jan 2026) except GPT-2, the 2019 origin of the original
 * study; the horizon doubles ≈ every 7 months (≈4 months since 2023). Stored in
 * **seconds** (one unit) so the values stay exact integers and feed `scaleLog`.
 */
const ACELERACION_HORIZONTE: PieceData = {
  invId: 11,
  code: 'wall-10',
  slug: 'horizonte-de-tareas',
  title: 'Horizonte de tareas (METR)',
  sala: 'S3',
  data: [
    {
      id: 'gpt2',
      label: 'GPT-2',
      group: 'capability',
      unit: 'seconds',
      figure: 'GPT-2 — horizonte de tareas al 50 % de fiabilidad',
      value: 2,
      date: '2019-02',
      note: '≈2 s; punto de origen del estudio METR original (mar 2025)',
      sourceURL: 'https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/',
    },
    {
      id: 'gpt4',
      label: 'GPT-4',
      group: 'capability',
      unit: 'seconds',
      figure: 'GPT-4 — horizonte de tareas al 50 % de fiabilidad',
      value: 240,
      date: '2023-03',
      note: '≈4 min (METR Time Horizon 1.1)',
      sourceURL: 'https://metr.org/blog/2026-1-29-time-horizon-1-1/',
    },
    {
      id: 'o1',
      label: 'o1',
      group: 'capability',
      unit: 'seconds',
      figure: 'o1 — horizonte de tareas al 50 % de fiabilidad',
      value: 2280,
      date: '2024-12',
      note: '≈38 min (METR Time Horizon 1.1)',
      sourceURL: 'https://metr.org/blog/2026-1-29-time-horizon-1-1/',
    },
    {
      id: 'claude-3-7-sonnet',
      label: 'Claude 3.7 Sonnet',
      group: 'capability',
      unit: 'seconds',
      figure: 'Claude 3.7 Sonnet — horizonte de tareas al 50 % de fiabilidad',
      value: 3600,
      date: '2025-02',
      note: '≈1 h (METR Time Horizon 1.1)',
      sourceURL: 'https://metr.org/blog/2026-1-29-time-horizon-1-1/',
    },
    {
      id: 'o3',
      label: 'o3',
      group: 'capability',
      unit: 'seconds',
      figure: 'o3 — horizonte de tareas al 50 % de fiabilidad',
      value: 7260,
      date: '2025-04',
      note: '≈2 h 1 min (METR Time Horizon 1.1)',
      sourceURL: 'https://metr.org/blog/2026-1-29-time-horizon-1-1/',
    },
  ],
  sourcesNote:
    'Horizonte temporal al 50 % de fiabilidad (METR): duración de la tarea humana que un modelo ' +
    'completa de forma autónoma. Valores de METR Time Horizon 1.1 (ene 2026), salvo GPT-2 (origen del ' +
    'estudio original, mar 2025). Se duplica ≈cada 7 meses (≈4 meses desde 2023). Escala logarítmica.',
}

/**
 * Chart B — **context window (memory over time)**: the token window each
 * milestone shipped with, 2K → 1M in four years (~500×). One unit (tokens), so
 * the values drop straight into `scaleLog` / `formatCompact`. Every figure is
 * the launch context window of that model, sourced and dated.
 */
const ACELERACION_CONTEXTO: PieceData = {
  invId: 11,
  code: 'wall-10',
  slug: 'ventana-de-contexto',
  title: 'Ventana de contexto',
  sala: 'S3',
  data: [
    {
      id: 'gpt3',
      label: 'GPT-3',
      group: 'context',
      unit: 'tokens',
      figure: 'GPT-3 — ventana de contexto',
      value: 2048,
      date: '2020',
      note: '2.048 tokens (n_ctx del modelo)',
      sourceURL: 'https://arxiv.org/abs/2005.14165',
    },
    {
      id: 'gpt4',
      label: 'GPT-4',
      group: 'context',
      unit: 'tokens',
      figure: 'GPT-4 — ventana de contexto (modelo base)',
      value: 8192,
      date: '2023-03',
      note: '8.192 tokens en el modelo base; variante de 32K disponible',
      sourceURL: 'https://openai.com/index/gpt-4-research/',
    },
    {
      id: 'claude-2-1',
      label: 'Claude 2.1',
      group: 'context',
      unit: 'tokens',
      figure: 'Claude 2.1 — ventana de contexto',
      value: 200000,
      date: '2023-11',
      note: '200K tokens (≈500 páginas) al lanzamiento',
      sourceURL: 'https://www.anthropic.com/news/claude-2-1',
    },
    {
      id: 'gemini-1-5-pro',
      label: 'Gemini 1.5 Pro',
      group: 'context',
      unit: 'tokens',
      figure: 'Gemini 1.5 Pro — ventana de contexto',
      value: 1000000,
      date: '2024-02',
      note: 'Hasta 1M en vista previa; 10M probados en investigación; 128K estándar al lanzar',
      sourceURL: 'https://blog.google/technology/ai/google-gemini-next-generation-model-february-2024/',
    },
  ],
  sourcesNote:
    'Ventana de contexto (tokens) en el lanzamiento de cada hito: GPT-3 2.048 (arXiv 2005.14165), ' +
    'GPT-4 8.192 (OpenAI, mar 2023), Claude 2.1 200.000 (Anthropic, nov 2023), Gemini 1.5 Pro ' +
    '1.000.000 / 10M en investigación (Google, feb 2024). De 2K a 1M en cuatro años (~500×). Escala logarítmica.',
}

/* ── #16 — "Code-gen" (wall 16, S3 divisoria 2 TEXT+CODE) ───────────────────────── */

/**
 * The S3 "TEXT+CODE" divisoria backs the live demo where a few prompts generate a
 * whole multi-file app ("3 líneas → app de 37 archivos"). Its message: **code
 * generation is enormous, verifiable economic value** — what a team did slowly and
 * for real money, an AI assistant now does in a fraction of the time, and it is
 * already writing a large share of production code.
 *
 * The honesty principle forbids inventing a bespoke "37-file app = N engineers ×
 * €X" quote (no primary source exists). So #16 is anchored on **two hard, sourced
 * datasets**, modelled as a `piecesByInvId(16)` family of single-unit charts (the
 * wall-11 pattern):
 *   • Chart A — GitHub's *controlled study*: the same real task (write a JavaScript
 *     HTTP server) measured with and without Copilot — a defensible time/value
 *     comparison "vs a real team" instead of an unsourced cost estimate.
 *   • Chart B — the share of code **already written by AI** at named tools/firms —
 *     the requested "GitHub AI-assisted / usage" datum, plus Google & Microsoft.
 *
 * Stock exponentials, agent benchmarks etc. are cut (message-first; they live on
 * walls 2 and 11). Each chart keeps one unit so it reads honestly on its own axis.
 */

/**
 * Chart A — **tiempo de desarrollo (con IA vs sin IA)**, unit `minutes`. GitHub's
 * controlled experiment: 95 professional developers wrote an HTTP server in
 * JavaScript; the Copilot group finished in 71 min vs 161 min for the control — a
 * 55 % reduction (95 % CI [21 %, 89 %], p = 0,0017). The honest, sourced proxy for
 * "the value of code-gen vs a real team's time."
 */
const CODEGEN_TIEMPO: PieceData = {
  invId: 16,
  code: 'wall-15',
  slug: 'tiempo-de-desarrollo',
  title: 'Tiempo de desarrollo (con IA vs sin IA)',
  sala: 'S3',
  data: [
    {
      id: 'sin-ia',
      label: 'Sin IA',
      group: 'productivity',
      unit: 'minutes',
      figure: 'Escribir un servidor HTTP en JavaScript — sin asistente (grupo de control)',
      value: 161,
      date: '2022-09',
      note: 'Estudio controlado de GitHub con 95 desarrolladores; 2 h 41 min de media',
      sourceURL:
        'https://github.blog/news-insights/research/research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/',
    },
    {
      id: 'con-ia',
      label: 'Con IA (Copilot)',
      group: 'productivity',
      unit: 'minutes',
      figure: 'Escribir un servidor HTTP en JavaScript — con GitHub Copilot',
      value: 71,
      date: '2022-09',
      note: '1 h 11 min de media; 55 % menos tiempo (IC 95 % 21–89 %, p = 0,0017)',
      sourceURL:
        'https://github.blog/news-insights/research/research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/',
    },
  ],
  sourcesNote:
    'Estudio controlado de GitHub (sep 2022): 95 desarrolladores escribieron el mismo servidor HTTP en ' +
    'JavaScript con y sin Copilot. El grupo con IA terminó en 71 min frente a 161 min — un 55 % menos de ' +
    'tiempo (IC 95 % 21–89 %, p = 0,0017). Misma tarea, medición directa; no es una estimación de coste.',
}

/**
 * Chart B — **código que ya escribe la IA**, unit `percent`. The requested GitHub
 * usage datum (Copilot autocompletes ~46 % of code in enabled files) alongside the
 * named-executive figures for Microsoft and Google. Each datum's *scope* differs
 * (Copilot-enabled files vs all new code), so it is spelled out per bar in `note`;
 * the shared honest read is "a quarter to nearly half of code is already
 * machine-written."
 */
const CODEGEN_ADOPCION: PieceData = {
  invId: 16,
  code: 'wall-15',
  slug: 'codigo-escrito-por-ia',
  title: 'Código que ya escribe la IA',
  sala: 'S3',
  data: [
    {
      id: 'github-copilot',
      label: 'GitHub Copilot',
      group: 'adoption',
      unit: 'percent',
      figure: 'GitHub Copilot — porcentaje del código que autocompleta',
      value: 46,
      date: '2023-02',
      note: 'Media en todos los lenguajes en archivos con Copilot activo (61 % en Java); subió del 27 % (jun 2022) al 46 %',
      sourceURL:
        'https://github.blog/ai-and-ml/github-copilot/github-copilot-now-has-a-better-ai-model-and-new-capabilities/',
    },
    {
      id: 'microsoft',
      label: 'Microsoft',
      group: 'adoption',
      unit: 'percent',
      figure: 'Microsoft — porcentaje del código escrito por IA',
      value: 30,
      date: '2025-04',
      note: 'Hasta el 30 %, según Satya Nadella (LlamaCon, abr 2025); algunos repos ya superan el 50 %',
      sourceURL:
        'https://www.cnbc.com/2025/04/29/satya-nadella-says-as-much-as-30percent-of-microsoft-code-is-written-by-ai.html',
    },
    {
      id: 'google',
      label: 'Google',
      group: 'adoption',
      unit: 'percent',
      figure: 'Google — porcentaje del código nuevo generado por IA',
      value: 25,
      date: '2024-10',
      note: 'Más de una cuarta parte del código nuevo (Sundar Pichai, resultados Q3 2024); >30 % en abr 2025',
      sourceURL: 'https://blog.google/inside-google/message-ceo/alphabet-earnings-q3-2024/',
    },
  ],
  sourcesNote:
    'Porcentaje del código atribuido a la IA: GitHub Copilot 46 % en archivos donde está activo (GitHub, ' +
    'feb 2023), Microsoft hasta 30 % (Satya Nadella, abr 2025) y Google >25 % del código nuevo (Sundar ' +
    'Pichai, resultados Q3 2024). Cada cifra tiene su propio alcance, indicado en la pieza.',
}

/* ── #13 — "Ya está ocurriendo" (wall 13, S5/S6 reality refs) ──────────────────── */

/**
 * Wall #13 (image track, `research:true`) sits at the S5→S6 seam and carries the
 * message **"esto no es utopía, está pasando"**: the juice-game "upgrades" the
 * visitor just saw — autonomous vehicles, dark / lights-out factories — are
 * **already real**. The image track may not render figures, so its imagery is
 * grounded here in dated, sourced references of deployments that exist today (June
 * 2026). Each ref is a real deployment with a primary or reputable source — never
 * an AI-imagined future. The two named anchors (autonomous trucks, dark factories)
 * are reinforced by their scale context (Aurora's mileage milestone, the WEF
 * Lighthouse network) and by robotaxis, the most consumer-visible proof of
 * commercial full autonomy.
 */
const REALIDAD_YA_EXISTE: RefPiece = {
  invId: 13,
  code: 'wall-12',
  slug: 'realidad-ya-existe',
  title: 'Ya está ocurriendo',
  sala: 'S5/S6',
  refs: [
    {
      id: 'aurora-trucks-launch',
      label: 'Aurora',
      category: 'autonomous-vehicle',
      claim:
        'Primer servicio comercial de camiones pesados sin conductor en vías públicas de EE. UU. (Dallas–Houston)',
      value: 3000000,
      unit: 'millas autónomas (piloto previo)',
      date: '2025-05-01',
      note: 'Arrancó las entregas comerciales sin conductor tras 3 M de millas autónomas supervisadas y >10.000 cargas de clientes',
      sourceURL:
        'https://ir.aurora.tech/news-events/press-releases/detail/119/aurora-begins-commercial-driverless-trucking-in-texas-ushering-in-a-new-era-of-freight',
    },
    {
      id: 'aurora-trucks-scale',
      label: 'Aurora',
      category: 'autonomous-vehicle',
      claim: 'Los camiones sin conductor de Aurora superan las 100.000 millas en vías públicas, sin incidentes de seguridad',
      value: 100000,
      unit: 'millas sin conductor',
      date: '2025-11',
      note: 'Acumuladas desde el arranque comercial de mayo de 2025; cero incidentes de seguridad reportados',
      sourceURL: 'https://www.act-news.com/news/aurora-expands-driverless-operations/',
    },
    {
      id: 'xiaomi-dark-factory',
      label: 'Xiaomi',
      category: 'dark-factory',
      claim: 'Fábrica «oscura» de Xiaomi en Changping: produce móviles 24/7 prácticamente sin operarios',
      value: 10000000,
      unit: 'móviles al año',
      date: '2024-07',
      note: '81 % de automatización; el marketing dijo «1 móvil/segundo», el ritmo real es ~1 cada 3,15 s de media anual',
      sourceURL: 'https://www.slashgear.com/2144548/xiaomi-smartphone-robot-dark-factory-how-works-makes-phones-fast/',
    },
    {
      id: 'wef-lighthouses',
      label: 'Red Faro (WEF)',
      category: 'dark-factory',
      claim:
        'La Global Lighthouse Network del Foro Económico Mundial reúne 201 fábricas que operan con IA y 4IR a escala',
      value: 201,
      unit: 'fábricas faro',
      date: '2025-09',
      note: 'Red lanzada en 2018; 189 en ene 2025 → 201 en sep 2025; +40 % de productividad laboral media',
      sourceURL:
        'https://www.weforum.org/press/2025/09/global-lighthouse-network-2025-world-economic-forum-recognizes-12-new-sites-driving-holistic-transformation-in-manufacturing/',
    },
    {
      id: 'waymo-robotaxis',
      label: 'Waymo',
      category: 'autonomous-vehicle',
      claim: 'Waymo supera los 450.000 viajes pagados a la semana en robotaxis sin conductor',
      value: 450000,
      unit: 'viajes pagados / semana',
      date: '2025-12',
      note: '14 M de viajes pagados en 2025; servicio comercial sin conductor en varias ciudades de EE. UU.',
      sourceURL: 'https://www.cnbc.com/2025/12/08/waymo-paid-rides-robotaxi-tesla.html',
    },
  ],
  sourcesNote:
    'Referencias reales (jun 2026): Aurora — primer transporte comercial de camiones pesados sin conductor en vías ' +
    'públicas (Dallas–Houston, may 2025; >100.000 millas sin conductor a nov 2025, ACT News); Xiaomi — fábrica ' +
    'oscura de Changping, hasta 10 M de móviles/año con 81 % de automatización (SlashGear, jul 2024); Global ' +
    'Lighthouse Network del WEF — 201 fábricas con IA/4IR (sep 2025); Waymo — 450.000+ viajes pagados/semana sin ' +
    'conductor (CNBC, dic 2025). No es utopía: ya está ocurriendo.',
}

/* ── #20 — "El salón por los siglos" (wall 20, S6 Pobreza histórica) ───────────── */

/**
 * Wall #20 (hybrid track, `research:true`) closes the S6 "Pobreza histórica —
 * ya pasó antes" room. Its message: **el progreso material es brutal** — el salón
 * de una persona corriente hoy supera con creces lo que tenía cualquier élite del
 * pasado, así que el salto que viene (la IA) "ya pasó antes". The imagery walks a
 * living room *por los siglos* and ends on the provocation "¿cómo será el salón en
 * 3-4 años?". As an image/hybrid wall it renders no axes, so it is grounded here in
 * dated, sourced milestones of how the home actually changed.
 *
 * The brief floats an optional "Velázquez = X menús" hook and asks to **validate
 * whether it lands** (Pablo himself doubts it). Researched and recorded honestly:
 * the king's painter's top salary ≈ 192 ducados / 72.000 maravedís ≈ **48.300 €/año**
 * (equivalencia por contenido de oro, Archivo General de Simancas vía El Debate,
 * nov 2025) ≈ **~3.400 menús del día** (a 14,20 € de media, Hostelería de España
 * 2024). **Verdict: la línea NO aterriza limpia** y se recomienda reformular o
 * retirar — 48.300 €/año es un sueldo de clase media hoy, no «pobreza», de modo que
 * la comparación se vuelve en contra del mensaje; y las conversiones de poder
 * adquisitivo a 400 años son poco fiables (el oro da una cifra, una conversión por
 * salario/cesta da otra muy distinta). El dato se conserva como ancla histórica con
 * el aviso explícito; el mensaje lo lleva el salón, no la nómina.
 */
const SALONES_POR_SIGLOS: RefPiece = {
  invId: 20,
  code: 'wall-19',
  slug: 'salones-por-siglos',
  title: 'El salón por los siglos',
  sala: 'S6',
  refs: [
    {
      id: 'velazquez-sueldo',
      label: 'Velázquez (s. XVII)',
      category: 'historical-economics',
      claim:
        'El pintor del rey Felipe IV cobraba ≈48.300 €/año (192 ducados / 72.000 maravedís): unos 3.400 menús del día',
      value: 48300,
      unit: '€/año (equivalente en oro)',
      date: '2025-11-25',
      note:
        'Equivalencia por contenido de oro del Archivo General de Simancas (192 ducados = 72.000 mrs ≈ 48.300 €) ÷ ' +
        '14,20 € (precio medio del menú del día en España, Hostelería de España 2024) ≈ 3.400 menús/año. AVISO ' +
        '(validación pedida en el brief): la comparación NO aterriza limpia — 48.300 €/año es un sueldo de clase ' +
        'media hoy, no «pobreza», y una conversión a 400 años por oro/salario/cesta da cifras muy distintas. ' +
        'Recomendación: reformular o retirar el «= X menús»; el mensaje lo lleva el salón, no la nómina.',
      sourceURL:
        'https://www.eldebate.com/cultura/20251125/cuanto-cobraba-velazquez-como-pintor-camara-felipe-iv_358717.html',
    },
    {
      id: 'agua-corriente-1950',
      label: 'Agua corriente',
      category: 'domestic-milestone',
      claim: 'En el censo de viviendas de 1950, menos de un tercio de las viviendas en España tenía agua corriente',
      value: 33,
      unit: '% de viviendas con agua corriente (≈, 1950)',
      date: '1950',
      note: 'Primer censo de edificios y viviendas (1950): más del 66 % de las viviendas carecían de agua corriente; hoy es prácticamente universal (≈100 % en 2011).',
      sourceURL:
        'https://www.juntadeandalucia.es/institutodeestadisticaycartografia/atlashistoriaecon/atlas_cap_44.html',
    },
    {
      id: 'television-1956',
      label: 'Televisión (TVE)',
      category: 'domestic-milestone',
      claim: 'TVE estrenó sus emisiones el 28 de octubre de 1956; solo había unos 600 televisores en Madrid (25.000 ptas cada uno)',
      value: 600,
      unit: 'televisores (Madrid, estreno)',
      date: '1956-10-28',
      note: 'La televisión entra en el salón: 600 receptores en el estreno de TVE; en una generación pasó a estar en casi todos los hogares.',
      sourceURL:
        'https://www.elespanol.com/bluper/television/20161030/primera-emision-tve-hace-anos-televisores/166484402_0.html',
    },
    {
      id: 'hogar-conectado-2024',
      label: 'Salón conectado',
      category: 'domestic-milestone',
      claim: 'En 2024, el 96,8 % de los hogares españoles tenía internet de banda ancha y el 99,5 % un teléfono móvil',
      value: 96.8,
      unit: '% de hogares con banda ancha (2024)',
      date: '2024',
      note: 'INE, Encuesta TIC en los hogares 2024: 96,8 % con banda ancha, 99,5 % con móvil, 83,0 % con ordenador. El salón de hoy supera lo que tenía cualquier élite del pasado.',
      sourceURL: 'https://www.ine.es/dyngs/Prensa/TICH2024.htm',
    },
  ],
  sourcesNote:
    'Salón por los siglos (refs reales): sueldo de Velázquez ≈48.300 €/año en oro (Archivo General de Simancas vía ' +
    'El Debate, nov 2025) ≈ ~3.400 menús del día (14,20 €, Hostelería de España 2024) — comparación marcada como ' +
    'frágil; agua corriente en <1/3 de las viviendas en 1950 (atlas de historia económica, IECA); estreno de TVE ' +
    'con ~600 televisores (28 oct 1956, El Español); y el hogar de 2024 con 96,8 % de banda ancha y 99,5 % de ' +
    'móvil (INE, TIC en los hogares 2024). El progreso material ya pasó antes: ¿cómo será el salón en 3-4 años?',
}

/* ── registry + queries ──────────────────────────────────────────────────────── */

/**
 * Every researched piece, keyed by slug. Add pieces (#16, …) here. A wall can
 * carry **several** pieces (e.g. wall 11's zoned acceleration charts share
 * `invId 11`); retrieve them all with {@link piecesByInvId}.
 */
export const WALL_DATA: Record<string, PieceData> = {
  [HERO.slug]: HERO,
  [MODEL_SIZES.slug]: MODEL_SIZES,
  [ACELERACION_HORIZONTE.slug]: ACELERACION_HORIZONTE,
  [ACELERACION_CONTEXTO.slug]: ACELERACION_CONTEXTO,
  [CODEGEN_TIEMPO.slug]: CODEGEN_TIEMPO,
  [CODEGEN_ADOPCION.slug]: CODEGEN_ADOPCION,
}

/** All pieces as an array. */
export function allPieces(): PieceData[] {
  return Object.values(WALL_DATA)
}

/** Look up a piece by its slug. */
export function pieceBySlug(slug: string): PieceData | undefined {
  return WALL_DATA[slug]
}

/**
 * Look up a piece by the inventory id of the wall it feeds. On a wall that
 * carries several charts (wall 11), this returns the **first**; use
 * {@link piecesByInvId} to get them all.
 */
export function pieceByInvId(invId: number): PieceData | undefined {
  return allPieces().find((p) => p.invId === invId)
}

/** Every piece feeding a wall, in registry order — the zoned charts of a multi-chart wall. */
export function piecesByInvId(invId: number): PieceData[] {
  return allPieces().filter((p) => p.invId === invId)
}

/**
 * The researched figures for a wall (empty array if the wall carries no data).
 * On a multi-chart wall this is the **first** chart's data; render each zoned
 * chart from `piecesByInvId(invId)` instead.
 */
export function dataForWall(invId: number): WallDatum[] {
  return pieceByInvId(invId)?.data ?? []
}

/** Every datum across every piece (flattened). */
export function allData(): WallDatum[] {
  return allPieces().flatMap((p) => p.data)
}

/** Any datum that fails validation — should always be empty (guard in tests). */
export function unsourcedData(): WallDatum[] {
  return allData().filter((d) => !isWallDatum(d))
}

/** The discreet on-wall sources caption for a piece (deduped hosts + latest date). */
export function sourcesCaptionFor(slug: string): string {
  const piece = pieceBySlug(slug)
  return piece ? sourcesCaption(piece.data) : ''
}

/** The deliverable sources table: one `{ figure, value, date, sourceURL }` row per datum. */
export function sourcesTable(piece: PieceData): Datum[] {
  return piece.data.map(({ figure, value, date, sourceURL }) => ({ figure, value, date, sourceURL }))
}

/* ── reference registry + queries (image / hybrid track) ───────────────────────── */

/**
 * Every researched **reference** piece (image / hybrid track), keyed by slug. Kept
 * separate from {@link WALL_DATA} so the code-track chart invariants never see it.
 * Add image-track refs (#13, #20, …) here.
 */
export const WALL_REFS: Record<string, RefPiece> = {
  [REALIDAD_YA_EXISTE.slug]: REALIDAD_YA_EXISTE,
  [SALONES_POR_SIGLOS.slug]: SALONES_POR_SIGLOS,
}

/** All reference pieces as an array. */
export function allRefPieces(): RefPiece[] {
  return Object.values(WALL_REFS)
}

/** Look up a reference piece by its slug. */
export function refPieceBySlug(slug: string): RefPiece | undefined {
  return WALL_REFS[slug]
}

/** Every reference piece grounding a wall, in registry order. */
export function refsByInvId(invId: number): RefPiece[] {
  return allRefPieces().filter((p) => p.invId === invId)
}

/** Every reference across every piece (flattened). */
export function allRefs(): RefItem[] {
  return allRefPieces().flatMap((p) => p.refs)
}

/** Any reference that fails validation — should always be empty (guard in tests). */
export function unsourcedRefs(): RefItem[] {
  return allRefs().filter((r) => !isRefItem(r))
}

/** The discreet on-wall sources caption for a reference piece (deduped hosts + latest date). */
export function refsSourcesCaptionFor(slug: string): string {
  const piece = refPieceBySlug(slug)
  if (!piece) return ''
  // refs carry the same `{ date, sourceURL }` the caption helper needs; figure/value
  // are only used for chart rows, so a placeholder value keeps the `Datum` shape.
  return sourcesCaption(piece.refs.map((r) => ({ figure: r.claim, value: r.value ?? 0, date: r.date, sourceURL: r.sourceURL })))
}

/* ── hero hooks — validate the brief's claims against the real numbers ─────────── */

/** A rhetorical hook line + whether the verified data actually supports it. */
export type Hook = {
  /** The claim shown (or implied) on the wall. */
  claim: string
  /** True when the data backs the claim — the only state allowed to ship. */
  holds: boolean
  /** The driving ratio (a / b) for transparency. */
  ratio: number
}

function valueOf(data: WallDatum[], id: string): number {
  const d = data.find((x) => x.id === id)
  if (!d) throw new Error(`hero hook: missing datum '${id}'`)
  return d.value
}

/**
 * The brief proposes hook lines ("one AI co > the IBEX 35", "AI > Spain GDP") and
 * insists they ship **only if the numbers hold**. These are computed from the
 * verified hero data so a future figure edit that breaks a claim fails a test
 * rather than printing a lie. `approx` hooks hold within ±25 %.
 */
export function heroHooks(): Hook[] {
  const d = HERO.data
  const specs: Array<{ claim: string; a: string; b: string; approx?: boolean }> = [
    { claim: 'Nvidia vale más que todo el IBEX 35', a: 'nvidia', b: 'ibex35' },
    { claim: 'Nvidia vale más que el PIB de España', a: 'nvidia', b: 'spain-gdp' },
    { claim: 'OpenAI vale más que todo el mercado mundial del café', a: 'openai', b: 'coffee' },
    { claim: 'La última ronda de Anthropic ≈ todo el IBEX 35', a: 'anthropic', b: 'ibex35', approx: true },
  ]
  return specs.map(({ claim, a, b, approx }) => {
    const ratio = valueOf(d, a) / valueOf(d, b)
    return { claim, ratio, holds: approx ? ratio >= 0.8 && ratio <= 1.25 : ratio > 1 }
  })
}
