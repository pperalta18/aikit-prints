/**
 * Museographic legibility pass (Phase 6 deliverable)
 * ──────────────────────────────────────────────────
 * The brief's second QA artifact (alongside the control table): a single audit
 * that answers, per wall, *"is this graphic legible and hung where the eye reads
 * it?"* — the two museographic standards the spec makes explicit
 * (`specs/wall-graphics.md`, "Format / museographic standards"):
 *
 *   1. **Mounting centre-line ~1.45–1.60 m** — key content rides the eye band.
 *   2. **Titular cap-height ≈ 1 cm per 3 m** of the wall's real reading distance,
 *      with the **real cm sizes documented** so all walls stay coherent.
 *
 * Following the codebase pattern (a pure, node-testable core + a thin I/O wrapper),
 * this module does *no* file reads. It takes the wall registry/geometry and the
 * authored-print projections and returns the joined rows + a summary + formatters.
 * The script that scans `public/prints/` and writes `out/legibility.{md,csv}` lives
 * in `scripts/legibility.mjs`; the unit tests feed it the real committed data.
 *
 * Honesty: the cap-height **floor** is documented for *every* wall (built or not),
 * because every wall has a room and therefore a reading distance — a built print
 * may declare its own (`props.readingDistanceM`), otherwise the room policy below
 * supplies a coherent one (flagged as the source). The eye-band fit is reported
 * only where a print is actually authored (no fabricated placement). A piece that
 * nearly fills its wall is *honestly* flagged as clamped below the band rather than
 * silently called "ok".
 *
 * Script-safety: like `controlTable.ts`, this imports `eventLayout` only as *types*
 * (erased at runtime) and reuses the museographic primitives from
 * `../pages/wayfinding.ts` (a JSON-free chain), so the raw-node `.mjs` script can
 * `import` it. The eye-band maths is re-stated here (a few pure lines) rather than
 * imported from `heroPlacement.ts`, which pulls `event-layout.json` at runtime; a
 * unit test guards it against the `heroPlacement` original so the two never drift.
 */

import type { Estado, Track, WallRegistry } from './eventLayout'
// Explicit `.ts` so Node's native loader can import this module from a script.
import { TRACK_LABEL, estadoLabel, truncate } from './wallHud.ts'

const EPS = 1e-9
const DASH = '—'

/* ── museographic primitives (mirror pages/wayfinding.ts; guarded by a unit test) ──
 * Re-stated here, not imported, because `pages/wayfinding.ts` reaches `'../geometry'`
 * with a bare specifier the raw-node `.mjs` loader can't resolve (it only resolves
 * relative `.ts` imports that carry the extension). The maths is the museographic
 * «1 cm cap-height per 3 m» rule; a test asserts these stay identical to the
 * `wayfinding.ts` originals so the two never drift. */

/** Points per millimetre (72 pt / 25.4 mm). */
const PT_PER_MM = 72 / 25.4
/** The rule of thumb: ~1 cm of cap-height per 3 m of reading distance. */
const CAP_CM_PER_METRE = 1 / 3
/** Cap-height ÷ em for the display face (Universal Sans Display ≈ 0.72). */
const DISPLAY_CAP_RATIO = 0.72

/** Minimum legible cap-height (mm) for a reading distance (m) — the 1 cm / 3 m floor. */
function minCapHeightMm(distanceM: number): number {
  if (!(distanceM > 0)) throw new Error(`minCapHeightMm: distanceM must be > 0 (got ${distanceM})`)
  return distanceM * CAP_CM_PER_METRE * 10
}

/** A cap-height (mm) → the CSS font-size (pt) that renders it. */
function capHeightMmToFontPt(capHeightMm: number): number {
  return (capHeightMm / DISPLAY_CAP_RATIO) * PT_PER_MM
}

/** A font-size (pt) → the cap-height it renders (mm). Inverse of {@link capHeightMmToFontPt}. */
function fontPtToCapHeightMm(fontPt: number): number {
  return (fontPt / PT_PER_MM) * DISPLAY_CAP_RATIO
}

/** Minimum legible font-size (pt) for a reading distance (m). */
function minFontPtForDistance(distanceM: number): number {
  return capHeightMmToFontPt(minCapHeightMm(distanceM))
}

/** Is a chosen cap-height (mm) legible at a reading distance (m)? Tolerant at the boundary. */
function isLegibleAtDistance(capHeightMm: number, distanceM: number): boolean {
  return capHeightMm + EPS >= minCapHeightMm(distanceM)
}

/* ── reading-distance policy (per room) ──────────────────────────────────────── */

/**
 * Base reading distance (metres) per funnel room — how far back a visitor typically
 * reads that room's titular content. The showroom nave (S3) and the dark cinema (S4)
 * are read from across a large space; the entrance/intro rooms are mid-range; the
 * tight juice/bottleneck/poverty rooms (S5/S6) are read close. These are the values
 * the typographic docs already declare (`wayfinding` S1→S2 = 4 m, `umbral` S2/S3 =
 * 5 m, `micro-acento` S5/S6 = 3 m), generalised so every wall gets a coherent one.
 */
export const ROOM_READING_DISTANCE_M: Record<string, number> = {
  S1: 4,
  S2: 4,
  S3: 5,
  S4: 5,
  S5: 3,
  S6: 3,
  'cóctel': 3,
}

/** Fallback reading distance (m) for a sala with no recognised room token. */
export const DEFAULT_READING_DISTANCE_M = 4

/**
 * Split a compound sala label ("S2/S3", "S1→S2", "S2/S6/cóctel") into its trimmed
 * room tokens. Separators: `/`, `→`, `-`, whitespace.
 */
export function salaRooms(sala: string): string[] {
  return sala
    .split(/[/→\-\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/**
 * The policy reading distance (m) for a sala. A compound sala takes the **maximum**
 * base of its rooms — the conservative choice, because a longer distance demands a
 * *larger* cap height, so a piece sized for it stays legible from the nearer rooms
 * too. Unknown tokens fall back to {@link DEFAULT_READING_DISTANCE_M}.
 */
export function salaReadingDistanceM(sala: string): number {
  const known = salaRooms(sala)
    .map((t) => ROOM_READING_DISTANCE_M[t])
    .filter((d): d is number => typeof d === 'number')
  return known.length ? Math.max(...known) : DEFAULT_READING_DISTANCE_M
}

/* ── eye band (mirrors heroPlacement; guarded against drift by a unit test) ────── */

/** Museographic eye band — centre-line height (m). Spec: "eye-band centre ~1.45–1.60 m". */
export const EYE_BAND_MIN_M = 1.45
export const EYE_BAND_MAX_M = 1.6
export const EYE_BAND_CENTER_M = 1.5
/** Clearance kept between the print edge and the floor / top of the wall (m). */
export const WALL_EDGE_MARGIN_M = 0.05

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)

/**
 * Museographic centre-height for a print on a wall: aim for {@link EYE_BAND_CENTER_M}
 * but always keep the *whole* print on the wall. Identical to `heroPlacement`'s
 * `eyeBandCenterY` (re-stated here to keep this module free of the runtime
 * `event-layout.json` import; a test asserts they agree).
 */
export function eyeBandCenterY(
  wallHeightM: number,
  printHeightM: number,
  opts: { target?: number; margin?: number } = {},
): number {
  const margin = opts.margin ?? WALL_EDGE_MARGIN_M
  const target = opts.target ?? EYE_BAND_CENTER_M
  const minCenter = printHeightM / 2 + margin
  const maxCenter = wallHeightM - printHeightM / 2 - margin
  return clamp(target, minCenter, Math.max(minCenter, maxCenter))
}

/* ── projections ──────────────────────────────────────────────────────────────── */

/** The minimal shape of a wall the audit needs — a full {@link import('./eventLayout').Wall} satisfies it. */
export type LegibilityWall = {
  /** Stable wall id, e.g. `wall-1`. */
  id: string
  /** Wall run length (metres). */
  length: number
  /** Wall height (metres). */
  height: number
  /** Whether {@link height} is measured (vs the 2.5 m fallback). */
  hasExplicitHeight: boolean
  /** Wall-graphics registry; absent on non-event surfaces (glass). */
  registry?: WallRegistry
}

/** The slice of a print doc the legibility audit needs. Build one with {@link printLegibility}. */
export type LegibilityPrint = {
  /** Print id (the `public/prints/<id>` folder / `doc.id`). */
  id: string
  /** The wall this print is mounted on (`doc.props.invId`). */
  invId: number
  /** Finished (cut) width in millimetres. */
  trimWidthMm: number
  /** Finished (cut) height in millimetres. */
  trimHeightMm: number
  /** Bleed (sangrado) in millimetres — the media is the trim + 2× bleed. */
  bleedMm: number
  /** Reading distance the doc declares (`props.readingDistanceM`), or `null`. */
  declaredReadingDistanceM: number | null
}

/** A loosely-typed print doc, enough to project a {@link LegibilityPrint} from it. */
type DocLike = {
  id?: unknown
  dimensions?: { trimWidthMm?: unknown; trimHeightMm?: unknown; bleedMm?: unknown } | null
  props?: { invId?: unknown; readingDistanceM?: unknown } | null
}

const finitePositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

/**
 * Project a print doc to a {@link LegibilityPrint}, or `null` when it is not a wall
 * graphic (no numeric `props.invId`) or is missing the dimensions the audit needs.
 * Lenient by design — it never throws on a malformed/partial doc, it just opts it
 * out. A non-positive declared reading distance is treated as undeclared.
 */
export function printLegibility(doc: DocLike): LegibilityPrint | null {
  const invId = doc.props?.invId
  if (!finitePositive(invId)) return null
  const id = doc.id
  const trimWidthMm = doc.dimensions?.trimWidthMm
  const trimHeightMm = doc.dimensions?.trimHeightMm
  const bleedRaw = doc.dimensions?.bleedMm
  if (typeof id !== 'string' || id.length === 0) return null
  if (!finitePositive(trimWidthMm) || !finitePositive(trimHeightMm)) return null
  const bleedMm = typeof bleedRaw === 'number' && Number.isFinite(bleedRaw) && bleedRaw >= 0 ? bleedRaw : 0
  const declared = doc.props?.readingDistanceM
  return {
    id,
    invId,
    trimWidthMm,
    trimHeightMm,
    bleedMm,
    declaredReadingDistanceM: finitePositive(declared) ? declared : null,
  }
}

/* ── audit primitives ─────────────────────────────────────────────────────────── */

/** The documented cap-height standard for a wall at a given reading distance. */
export type CapStandard = {
  /** Reading distance used (metres). */
  readingDistanceM: number
  /** Where the distance came from: the doc, or the room policy. */
  source: 'doc' | 'sala'
  /** Minimum legible titular cap-height (mm) — the 1 cm / 3 m floor. */
  minCapHeightMm: number
  /** Same floor in centimetres (the documented, human-facing "real cm size"). */
  minCapHeightCm: number
  /** Minimum legible font-size (pt) that renders that cap-height. */
  minFontPt: number
}

/** Build the cap-height standard for a reading distance. */
export function capStandard(readingDistanceM: number, source: 'doc' | 'sala'): CapStandard {
  const mm = minCapHeightMm(readingDistanceM)
  return {
    readingDistanceM,
    source,
    minCapHeightMm: mm,
    minCapHeightCm: mm / 10,
    minFontPt: minFontPtForDistance(readingDistanceM),
  }
}

/** Where a print's media sits on its wall once hung on the eye band. */
export type EyeBandFit = {
  /** Wall height the fit was computed against (metres). */
  wallHeightM: number
  /** Media height (trim + 2× bleed) in metres — the whole hanging piece. */
  printHeightM: number
  /** Resolved centre-line height (metres). */
  mountCenterM: number
  /** Bottom edge of the media above the floor (metres). */
  bottomM: number
  /** Top edge of the media above the floor (metres). */
  topM: number
  /** Whether the centre lands within the eye band [1.45, 1.60]. */
  inEyeBand: boolean
  /** Whether the whole media stays on the wall (0 ≤ bottom, top ≤ wallHeight). */
  fitsWall: boolean
  /** Whether the band centre was unreachable because the piece nearly fills the wall. */
  clampedByHeight: boolean
}

/** Compute the eye-band fit of a media height (m) on a wall height (m). */
export function eyeBandFit(wallHeightM: number, printHeightM: number): EyeBandFit {
  const mountCenterM = eyeBandCenterY(wallHeightM, printHeightM)
  const bottomM = mountCenterM - printHeightM / 2
  const topM = mountCenterM + printHeightM / 2
  const minCenter = printHeightM / 2 + WALL_EDGE_MARGIN_M
  const maxCenter = wallHeightM - printHeightM / 2 - WALL_EDGE_MARGIN_M
  // The ideal eye-band centre (1.5 m) was reachable only if it fits the feasible range.
  const clampedByHeight = !(minCenter <= EYE_BAND_CENTER_M + EPS && EYE_BAND_CENTER_M <= maxCenter + EPS)
  return {
    wallHeightM,
    printHeightM,
    mountCenterM,
    bottomM,
    topM,
    inEyeBand: mountCenterM >= EYE_BAND_MIN_M - EPS && mountCenterM <= EYE_BAND_MAX_M + EPS,
    fitsWall: bottomM >= -EPS && topM <= wallHeightM + EPS,
    clampedByHeight,
  }
}

/* ── rows ─────────────────────────────────────────────────────────────────────── */

export type LegibilityVerdict = 'ok' | 'warn' | 'unbuilt'

/** One row of the legibility audit: one registry-bearing wall + its print (if any). */
export type LegibilityRow = {
  invId: number
  code: string
  sala: string
  tema: string
  estado: Estado
  estadoText: string
  track: Track
  trackText: string
  research: boolean
  researchText: 'sí' | 'no'
  wallLengthM: number
  wallHeightM: number
  hasExplicitHeight: boolean
  /** Whether a print has been authored for this wall. */
  built: boolean
  /** Authored print id, or `null`. */
  printId: string | null
  /** The documented cap-height floor for this wall (always present — every wall has a room). */
  cap: CapStandard
  /** The eye-band fit of the authored print, or `null` when unbuilt. */
  eyeBand: EyeBandFit | null
  /** Overall verdict. */
  verdict: LegibilityVerdict
  /** Human-readable issues / notes (Spanish). */
  issues: string[]
}

function rowFor(wall: LegibilityWall, registry: WallRegistry, print: LegibilityPrint | null): LegibilityRow {
  const salaDistance = salaReadingDistanceM(registry.sala)
  const distance = print?.declaredReadingDistanceM ?? salaDistance
  const source: 'doc' | 'sala' = print?.declaredReadingDistanceM != null ? 'doc' : 'sala'
  const cap = capStandard(distance, source)

  const issues: string[] = []
  let eyeBand: EyeBandFit | null = null
  let verdict: LegibilityVerdict = 'unbuilt'

  if (print) {
    const printHeightM = (print.trimHeightMm + 2 * print.bleedMm) / 1000
    eyeBand = eyeBandFit(wall.height, printHeightM)

    if (!eyeBand.fitsWall) {
      issues.push(`no cabe en el muro (alto ${formatMetres(printHeightM)} m > ${formatMetres(wall.height)} m)`)
    }
    if (!eyeBand.inEyeBand) {
      issues.push(
        eyeBand.clampedByHeight
          ? `centro ${formatMetres(eyeBand.mountCenterM, 2)} m — bajo la banda 1.45–1.60 (pieza casi del alto del muro)`
          : `centro ${formatMetres(eyeBand.mountCenterM, 2)} m fuera de la banda 1.45–1.60`,
      )
    }
    // Coherence: a doc-declared reading distance should match its room policy.
    if (source === 'doc' && Math.abs(distance - salaDistance) > EPS) {
      issues.push(`distancia declarada ${formatMetres(distance)} m ≠ política de sala ${formatMetres(salaDistance)} m`)
    }

    // A clamped-by-height placement that still fits the wall is acceptable (noted, not failed).
    const hardFail = !eyeBand.fitsWall || (!eyeBand.inEyeBand && !eyeBand.clampedByHeight)
    const coherenceFail = source === 'doc' && Math.abs(distance - salaDistance) > EPS
    verdict = hardFail || coherenceFail ? 'warn' : 'ok'
  }

  return {
    invId: registry.invId,
    code: wall.id,
    sala: registry.sala,
    tema: registry.tema,
    estado: registry.estado,
    estadoText: estadoLabel(registry.estado),
    track: registry.track,
    trackText: TRACK_LABEL[registry.track] ?? registry.track,
    research: registry.research,
    researchText: registry.research ? 'sí' : 'no',
    wallLengthM: wall.length,
    wallHeightM: wall.height,
    hasExplicitHeight: wall.hasExplicitHeight,
    built: print != null,
    printId: print ? print.id : null,
    cap,
    eyeBand,
    verdict,
    issues,
  }
}

/**
 * Build the legibility audit: one {@link LegibilityRow} per registry-bearing wall,
 * joined to its authored print by `invId`, sorted by `invId` ascending. Walls
 * without a registry (glass) are skipped. When a wall has more than one print
 * (zoned), the first by id is used as the representative for the eye-band fit (all
 * share the same trim height by construction).
 */
export function buildLegibilityTable(walls: LegibilityWall[], prints: LegibilityPrint[]): LegibilityRow[] {
  const byInv = new Map<number, LegibilityPrint[]>()
  for (const p of prints) {
    const list = byInv.get(p.invId)
    if (list) list.push(p)
    else byInv.set(p.invId, [p])
  }
  const rows: LegibilityRow[] = []
  for (const wall of walls) {
    const r = wall.registry
    if (!r) continue
    const mine = (byInv.get(r.invId) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id))
    rows.push(rowFor(wall, r, mine[0] ?? null))
  }
  return rows.sort((a, b) => a.invId - b.invId)
}

/* ── summary & coherence ──────────────────────────────────────────────────────── */

export type LegibilitySummary = {
  /** Registry-bearing walls audited. */
  total: number
  /** Walls with an authored print. */
  built: number
  /** Built walls whose centre lands in the eye band. */
  inEyeBand: number
  /** Built walls hung below the band because the piece nearly fills the wall (noted, not failed). */
  clamped: number
  /** Walls flagged `warn` (a real legibility problem to fix). */
  warnings: number
}

/** Summarise the audit rows. */
export function legibilitySummary(rows: LegibilityRow[]): LegibilitySummary {
  const summary: LegibilitySummary = { total: rows.length, built: 0, inEyeBand: 0, clamped: 0, warnings: 0 }
  for (const r of rows) {
    if (r.built) summary.built += 1
    if (r.eyeBand?.inEyeBand) summary.inEyeBand += 1
    if (r.eyeBand && !r.eyeBand.inEyeBand && r.eyeBand.clampedByHeight) summary.clamped += 1
    if (r.verdict === 'warn') summary.warnings += 1
  }
  return summary
}

/** Rows with a real legibility problem to fix (verdict `warn`). */
export function legibilityIssues(rows: LegibilityRow[]): LegibilityRow[] {
  return rows.filter((r) => r.verdict === 'warn')
}

/** Per-room coherence: each distinct sala, its policy reading distance + documented cap floor. */
export type RoomCoherence = {
  sala: string
  readingDistanceM: number
  minCapHeightCm: number
  invIds: number[]
}

/**
 * Group the rows by sala and report each room's policy reading distance + cap floor,
 * sorted by reading distance then sala. Lets the deliverable show — and a test assert
 * — that walls in the same room share one coherent cap-height standard.
 */
export function roomCoherence(rows: LegibilityRow[]): RoomCoherence[] {
  const by = new Map<string, RoomCoherence>()
  for (const r of rows) {
    const existing = by.get(r.sala)
    if (existing) existing.invIds.push(r.invId)
    else {
      const d = salaReadingDistanceM(r.sala)
      by.set(r.sala, { sala: r.sala, readingDistanceM: d, minCapHeightCm: minCapHeightMm(d) / 10, invIds: [r.invId] })
    }
  }
  for (const c of by.values()) c.invIds.sort((a, b) => a - b)
  return [...by.values()].sort((a, b) => a.readingDistanceM - b.readingDistanceM || a.sala.localeCompare(b.sala))
}

/**
 * Is the audit coherent? Every built print whose doc declares a reading distance
 * agrees with its room policy, and no row is flagged `warn` for a hard placement
 * failure. Returns `true` when the room sizing is consistent.
 */
export function isLegibilityCoherent(rows: LegibilityRow[]): boolean {
  return rows.every((r) => {
    if (r.cap.source === 'doc' && Math.abs(r.cap.readingDistanceM - salaReadingDistanceM(r.sala)) > EPS) return false
    if (r.eyeBand && !r.eyeBand.fitsWall) return false
    return true
  })
}

/* ── formatters ───────────────────────────────────────────────────────────────── */

/** Round a metre value for display, e.g. `6 → "6.0"`. */
export function formatMetres(m: number, digits = 1): string {
  return m.toFixed(digits)
}

/** Verify a chosen titular cap-height (cm) is legible at a wall's reading distance. */
export function isLegibleCm(capHeightCm: number, readingDistanceM: number): boolean {
  return isLegibleAtDistance(capHeightCm * 10, readingDistanceM)
}

/** The cap-height (cm) a font size (pt) renders to — for documenting an authored size. */
export function capHeightCmFromFontPt(fontPt: number): number {
  return fontPtToCapHeightMm(fontPt) / 10
}

function mdCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

const MD_HEADERS = [
  'inv',
  'muro',
  'sala',
  'track',
  'research',
  'dist. lectura (m)',
  'fuente',
  'cap mín. (cm)',
  'impreso',
  'centro (m)',
  'en banda',
  'cabe',
  'veredicto',
  'notas',
] as const

const VERDICT_LABEL: Record<LegibilityVerdict, string> = {
  ok: '✓',
  warn: '⚠',
  unbuilt: '—',
}

/**
 * Render the audit as a GitHub-flavoured Markdown table. `notesMax` caps the notes
 * column (default 60). Documents, per wall, the museographic floor (cm), the reading
 * distance used (+ its source), and — where a print exists — the eye-band placement.
 */
export function formatLegibilityMarkdown(rows: LegibilityRow[], opts: { notesMax?: number } = {}): string {
  const notesMax = opts.notesMax ?? 60
  const header = `| ${MD_HEADERS.join(' | ')} |`
  const sep = `| ${MD_HEADERS.map(() => '---').join(' | ')} |`
  const body = rows.map((r) => {
    const cells = [
      String(r.invId),
      r.code,
      r.sala,
      r.trackText,
      r.researchText,
      formatMetres(r.cap.readingDistanceM),
      r.cap.source === 'doc' ? 'doc' : 'sala',
      formatMetres(r.cap.minCapHeightCm),
      r.built ? '✓' : DASH,
      r.eyeBand ? formatMetres(r.eyeBand.mountCenterM, 2) : DASH,
      r.eyeBand ? (r.eyeBand.inEyeBand ? '✓' : DASH) : DASH,
      r.eyeBand ? (r.eyeBand.fitsWall ? '✓' : '✗') : DASH,
      VERDICT_LABEL[r.verdict],
      r.issues.length ? truncate(r.issues.join('; '), notesMax) : '',
    ]
    return `| ${cells.map(mdCell).join(' | ')} |`
  })
  return [header, sep, ...body].join('\n')
}

const CSV_HEADERS = [
  'invId',
  'code',
  'sala',
  'track',
  'research',
  'readingDistanceM',
  'distanceSource',
  'minCapHeightCm',
  'minFontPt',
  'built',
  'printId',
  'mountCenterM',
  'bottomM',
  'topM',
  'inEyeBand',
  'fitsWall',
  'clampedByHeight',
  'verdict',
  'issues',
] as const

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Render the audit as CSV (one header row + one row per wall). */
export function formatLegibilityCsv(rows: LegibilityRow[]): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const r of rows) {
    const fields = [
      String(r.invId),
      r.code,
      r.sala,
      r.track,
      r.researchText,
      formatMetres(r.cap.readingDistanceM, 2),
      r.cap.source,
      formatMetres(r.cap.minCapHeightCm, 2),
      formatMetres(r.cap.minFontPt, 1),
      r.built ? 'sí' : 'no',
      r.printId ?? '',
      r.eyeBand ? formatMetres(r.eyeBand.mountCenterM, 3) : '',
      r.eyeBand ? formatMetres(r.eyeBand.bottomM, 3) : '',
      r.eyeBand ? formatMetres(r.eyeBand.topM, 3) : '',
      r.eyeBand ? (r.eyeBand.inEyeBand ? 'sí' : 'no') : '',
      r.eyeBand ? (r.eyeBand.fitsWall ? 'sí' : 'no') : '',
      r.eyeBand ? (r.eyeBand.clampedByHeight ? 'sí' : 'no') : '',
      r.verdict,
      r.issues.join('; '),
    ]
    lines.push(fields.map(csvField).join(','))
  }
  return lines.join('\n')
}

/** One-line human summary, e.g. `7/21 impresas · 6 en banda · 1 ajustada · 0 avisos`. */
export function summaryLine(summary: LegibilitySummary): string {
  return (
    `${summary.built}/${summary.total} impresas · ` +
    `${summary.inEyeBand} en banda · ${summary.clamped} ajustada(s) · ` +
    `${summary.warnings} aviso(s)`
  )
}
