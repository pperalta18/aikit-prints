/**
 * Coverage & spoiler lint (Phase 6 deliverable)
 * ─────────────────────────────────────────────
 * Encodes two of the brief's **non-negotiable principles** as a single, testable
 * QA pass over the wall registry (see `specs/wall-graphics.md`, "Non-negotiable
 * principles"):
 *
 *   1. **No blank walls — none of the 21.** Every event wall must carry a *decided
 *      piece*: a non-empty theme + role, a decided production `track` (never the
 *      `C/I` "undecided" marker), and no leftover `(sin anotar)` placeholder. And
 *      the funnel as a whole must be covered — every room of the walk (S1…S6 +
 *      cóctel) has at least one wall.
 *   2. **No spoilers of what happens inside each experience.** "The wall names,
 *      orients, and delivers one strong graphic; it does not tell the ending."
 *      Two structural reads make that testable:
 *        • **S1 is textless** — the entrance room reveals nothing in words (the
 *          only S1 text is the expo title at the door), so a wall *purely inside*
 *          the S1 experience may not be a code-rendered *typographic* page
 *          (`track: 'C'`). A wayfinding *transition* leaving S1 (S1→S2) is exempt —
 *          its text orients toward the next zone, which the brief endorses.
 *        • **No funnel jump** — a wall lives in its room or *bridges adjacent
 *          rooms* (a transition like S1→S2 / S5/S6); a wall that spans
 *          **non-adjacent** funnel rooms would carry a later room's payoff into an
 *          earlier beat — a spoiler — unless it is a documented **double-sided**
 *          wall (two faces seen one at a time) or a documented multi-zone
 *          **junction**. Anything else is flagged for review.
 *
 * Following the codebase pattern (pure, node-testable core + thin I/O wiring), this
 * module does *no* file reads: it takes the walls (a {@link CoverageWall} is the
 * registry slice it needs) and returns the joined rows + guards + formatters + a
 * summary. The thin wrapper that reads `event-layout.json` and writes the
 * deliverable lives in `scripts/coverage.mjs`; the unit tests feed it the real
 * committed registry.
 *
 * Honesty: an unknown `sala` token is surfaced (`unknownRooms`), never silently
 * dropped; the documented double-sided / junction exceptions are explicit sets
 * (drift-guarded in the tests against `doublesided.ts`) rather than a fudge that
 * hides a real jump.
 */

import type { Estado, Track, WallRegistry } from './eventLayout'
// Explicit `.ts` so Node's native loader can import this module from a script
// (mirrors `controlTable.ts` → `./wallHud.ts`). `wallHud` only imports `eventLayout`
// as *types*, which are erased at runtime, so no JSON import is pulled in.
import { TRACK_LABEL, estadoLabel, truncate } from './wallHud.ts'

/**
 * The 6-room emotional funnel **in walk order**, plus the cocktail close — the
 * single ordering every spoiler check is measured against. Enter S1, exit after
 * S6 to the cóctel. See `specs/wall-graphics.md` ("The funnel (walk order)").
 */
export const FUNNEL_ORDER = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'cóctel'] as const

/** A room of the funnel walk. */
export type Room = (typeof FUNNEL_ORDER)[number]

/**
 * Walls printed on **both faces**, each face living in a different room and seen
 * one at a time — so a non-adjacent room pair on these is spatially correct, not a
 * spoiler. The brief's designated set (drift-guarded against `doublesided.ts`).
 */
export const DOUBLE_SIDED_INV_IDS: readonly number[] = [2, 12]

/**
 * Documented multi-zone **junction** walls: one physical wall that serves separate
 * zones of the room it sits between, by design (not a content spoiler). Today only
 * wall 19 — the "eres una neurona" grouping (S2 idea) reprised at the cóctel exit;
 * the brief notes "only 1 of ~4 walls there is real". See the per-wall inventory.
 */
export const JUNCTION_INV_IDS: readonly number[] = [19]

/**
 * Placeholder substrings that mean a wall was never actually assigned a piece — the
 * literal `(sin anotar)` marker the four unannotated walls once carried (Phase 0).
 * Deliberately narrow: an open *sub*-decision on an otherwise-decided wall (e.g. the
 * Naranja Mecánica tagline "TBD") is not a blank wall, so "tbd"/"todo" are excluded.
 */
const BLANK_MARKERS = ['sin anotar', 'por anotar'] as const

/** The minimal shape of a wall the coverage pass needs — a full `Wall` satisfies it. */
export type CoverageWall = {
  /** Stable wall id, e.g. `wall-1`. */
  id: string
  /** Wall-graphics registry; absent on non-event surfaces (glass). */
  registry?: WallRegistry
}

/** Position of a room in the funnel walk (`-1` if it is not a known room). */
export function roomIndex(room: string): number {
  return (FUNNEL_ORDER as readonly string[]).indexOf(room)
}

/** Strip accents + lowercase, for tolerant room-token matching. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/** Normalise one `sala` token to a canonical {@link Room}, or `null` if unknown. */
function normalizeRoom(token: string): Room | null {
  const f = fold(token)
  const m = /^s\s*([1-6])$/.exec(f)
  if (m) return `S${m[1]}` as Room
  if (/^(coctel|cocktail)$/.test(f)) return 'cóctel'
  return null
}

/**
 * Split a `sala` string (`"S1/S3"`, `"S1→S2"`, `"S2/S6/cóctel"`) into its known
 * rooms (in appearance order, de-duplicated) and the tokens it could not resolve.
 * Separators are `/` and `→` (matching `findWallsBySala`). Surfacing the unknowns
 * keeps a typo'd room from being silently ignored.
 */
export function parseRooms(sala: string): { rooms: Room[]; unknown: string[] } {
  const rooms: Room[] = []
  const unknown: string[] = []
  for (const raw of sala.split(/[\/→]/)) {
    if (raw.trim() === '') continue
    const room = normalizeRoom(raw)
    if (room === null) unknown.push(raw.trim())
    else if (!rooms.includes(room)) rooms.push(room)
  }
  return { rooms, unknown }
}

/**
 * Whether a set of rooms forms one **contiguous run** of the funnel (e.g. S5+S6,
 * or S1+S2+S3) — i.e. they bridge only *adjacent* rooms. A single room is trivially
 * contiguous; an empty set is not. Non-contiguous = a funnel jump.
 */
export function isContiguousRun(rooms: Room[]): boolean {
  const idx = rooms.map(roomIndex).filter((i) => i >= 0)
  if (idx.length === 0) return false
  const min = Math.min(...idx)
  const max = Math.max(...idx)
  // Indices are unique (parseRooms de-dupes), so a span equal to (count-1) can only
  // be an exactly-consecutive run.
  return max - min === idx.length - 1
}

/** One row of the coverage pass: a registry-bearing wall + its verdicts. */
export type CoverageRow = {
  /** Stable inventory id 1..21. */
  invId: number
  /** Wall id, e.g. `wall-1`. */
  code: string
  /** Raw room/zone string from the registry. */
  sala: string
  /** Resolved funnel rooms (walk order). */
  rooms: Room[]
  /** Unresolvable `sala` tokens, if any (a typo'd room). */
  unknownRooms: string[]
  /** Theme / subject. */
  tema: string
  /** Message / functional role. */
  rol: string
  /** Production track. */
  track: Track
  /** Spanish track label. */
  trackText: string
  /** Production status. */
  estado: Estado
  /** Spanish status label. */
  estadoText: string
  /** Whether the piece carries data that must be researched + sourced. */
  research: boolean

  // ── coverage (no blank walls) ──
  /** Whether the wall carries a decided piece (no blank reason). */
  covered: boolean
  /** Why the wall is blank (empty when {@link covered}). */
  blankReasons: string[]

  // ── funnel position ──
  /** Earliest room in the funnel this wall touches (`null` if none resolved). */
  firstRoom: Room | null
  /** Latest room in the funnel this wall touches (`null` if none resolved). */
  lastRoom: Room | null
  /** Multi-room and contiguous → an adjacent-room transition piece. */
  isTransition: boolean
  /** Designated double-sided wall (faces seen separately). */
  isDoubleSided: boolean
  /** Designated multi-zone junction wall. */
  isJunction: boolean

  // ── spoiler / museographic lint ──
  /** `'ok'` when no concern, `'warn'` when flagged for review. */
  verdict: 'ok' | 'warn'
  /** Human (Spanish) reasons behind a `'warn'` verdict (empty when `'ok'`). */
  concerns: string[]
}

/** Compute the blank-wall reasons for a registry (empty array ⇒ covered). */
function blankReasonsFor(r: WallRegistry): string[] {
  const reasons: string[] = []
  const tema = r.tema.trim()
  const rol = r.rol.trim()
  if (tema === '') reasons.push('tema vacío')
  if (rol === '') reasons.push('rol vacío')
  if (r.track === 'C/I') reasons.push('track sin decidir (C/I)')
  const hay = `${tema} ${rol}`.toLowerCase()
  for (const marker of BLANK_MARKERS) {
    if (hay.includes(marker)) {
      reasons.push(`placeholder «${marker}»`)
      break
    }
  }
  return reasons
}

/** Build the coverage row for a single registry-bearing wall. */
export function coverageRow(wall: CoverageWall): CoverageRow {
  const r = wall.registry
  if (!r) throw new Error(`coverageRow: ${wall.id} has no registry`)
  const { rooms, unknown } = parseRooms(r.sala)
  const indices = rooms.map(roomIndex).filter((i) => i >= 0)
  const firstRoom = indices.length ? FUNNEL_ORDER[Math.min(...indices)] : null
  const lastRoom = indices.length ? FUNNEL_ORDER[Math.max(...indices)] : null

  const isDoubleSided = DOUBLE_SIDED_INV_IDS.includes(r.invId)
  const isJunction = JUNCTION_INV_IDS.includes(r.invId)
  const contiguous = isContiguousRun(rooms)
  const isTransition = rooms.length > 1 && contiguous

  const blankReasons = blankReasonsFor(r)

  // ── spoiler lint ──
  const concerns: string[] = []
  if (unknown.length > 0) {
    concerns.push(`zona desconocida en sala: ${unknown.join(', ')}`)
  }
  // S1 textless: a wall *purely inside* the S1 experience carries no on-wall text →
  // no code-rendered typographic page. A wayfinding *transition* leaving S1 (S1→S2)
  // is exempt: its text orients toward the next zone, which the brief endorses.
  if (rooms.length === 1 && rooms[0] === 'S1' && r.track === 'C') {
    concerns.push('S1 sin texto: una página tipográfica (track C) rotularía la sala de entrada sensorial')
  }
  // No funnel jump: a non-contiguous multi-room span is a spoiler unless documented.
  if (rooms.length > 1 && !contiguous && !isDoubleSided && !isJunction) {
    concerns.push(
      `salto del recorrido ${firstRoom}→${lastRoom} (no adyacente): adelanta el desenlace de una sala posterior`,
    )
  }

  return {
    invId: r.invId,
    code: wall.id,
    sala: r.sala,
    rooms,
    unknownRooms: unknown,
    tema: r.tema,
    rol: r.rol,
    track: r.track,
    trackText: TRACK_LABEL[r.track] ?? r.track,
    estado: r.estado,
    estadoText: estadoLabel(r.estado),
    research: r.research,
    covered: blankReasons.length === 0,
    blankReasons,
    firstRoom,
    lastRoom,
    isTransition,
    isDoubleSided,
    isJunction,
    verdict: concerns.length === 0 ? 'ok' : 'warn',
    concerns,
  }
}

/**
 * Build the coverage pass: one {@link CoverageRow} per registry-bearing wall,
 * sorted by `invId` ascending. Walls without a registry (glass) are skipped.
 */
export function buildCoverage(walls: CoverageWall[]): CoverageRow[] {
  return walls
    .filter((w) => w.registry)
    .map(coverageRow)
    .sort((a, b) => a.invId - b.invId)
}

/** Walls with no decided piece — the blank walls the brief forbids (empty when healthy). */
export function blankWalls(rows: CoverageRow[]): CoverageRow[] {
  return rows.filter((r) => !r.covered)
}

/**
 * Throw if any wall is blank, naming the offenders + their reasons. Enforces the
 * "No blank walls — none of the 21" principle as a hard guard (the script calls it).
 */
export function assertNoBlankWalls(rows: CoverageRow[]): void {
  const blank = blankWalls(rows)
  if (blank.length > 0) {
    const detail = blank
      .map((r) => `#${r.invId} (${r.code}): ${r.blankReasons.join('; ')}`)
      .join(' · ')
    throw new Error(`Muros en blanco (sin pieza decidida): ${detail}`)
  }
}

/** Walls flagged for museographic / spoiler review (verdict `'warn'`). */
export function spoilerRisks(rows: CoverageRow[]): CoverageRow[] {
  return rows.filter((r) => r.verdict === 'warn')
}

/**
 * Which walls cover each funnel room, in `FUNNEL_ORDER`. Every room maps to the
 * (invId-sorted) list of walls that touch it — the funnel-level "no blank" view.
 */
export function funnelCoverage(rows: CoverageRow[]): Record<Room, number[]> {
  const out = {} as Record<Room, number[]>
  for (const room of FUNNEL_ORDER) out[room] = []
  for (const r of rows) {
    for (const room of r.rooms) out[room].push(r.invId)
  }
  for (const room of FUNNEL_ORDER) out[room].sort((a, b) => a - b)
  return out
}

/** Funnel rooms with no wall at all — must be empty for full coverage. */
export function emptyRooms(rows: CoverageRow[]): Room[] {
  const cov = funnelCoverage(rows)
  return FUNNEL_ORDER.filter((room) => cov[room].length === 0)
}

/** Aggregate counts for the deliverable footer / the script's stdout summary. */
export type CoverageSummary = {
  /** Registry-bearing walls in the pass. */
  total: number
  /** Walls carrying a decided piece. */
  covered: number
  /** Blank walls (must be 0). */
  blank: number
  /** Per-status tally (sums to {@link total}). */
  byEstado: Record<Estado, number>
  /** Adjacent-room transition pieces. */
  transitions: number
  /** Designated double-sided walls present. */
  doubleSided: number
  /** Designated junction walls present. */
  junctions: number
  /** Walls flagged for review (`verdict: 'warn'`). */
  warnings: number
  /** Funnel rooms with no wall (must be empty). */
  emptyRooms: Room[]
}

/** Summarise the rows (coverage, estados, transitions, spoiler warnings). */
export function coverageSummary(rows: CoverageRow[]): CoverageSummary {
  const summary: CoverageSummary = {
    total: rows.length,
    covered: 0,
    blank: 0,
    byEstado: { ok: 0, prop: 0, pend: 0 },
    transitions: 0,
    doubleSided: 0,
    junctions: 0,
    warnings: 0,
    emptyRooms: emptyRooms(rows),
  }
  for (const r of rows) {
    if (r.covered) summary.covered += 1
    else summary.blank += 1
    if (r.estado in summary.byEstado) summary.byEstado[r.estado] += 1
    if (r.isTransition) summary.transitions += 1
    if (r.isDoubleSided) summary.doubleSided += 1
    if (r.isJunction) summary.junctions += 1
    if (r.verdict === 'warn') summary.warnings += 1
  }
  return summary
}

/** One-line human summary, e.g. `21/21 cubiertos · 0 en blanco · 0 avisos · funnel completo`. */
export function summaryLine(summary: CoverageSummary): string {
  const funnel = summary.emptyRooms.length === 0 ? 'funnel completo' : `salas sin muro: ${summary.emptyRooms.join(', ')}`
  return (
    `${summary.covered}/${summary.total} cubiertos · ` +
    `${summary.blank} en blanco · ` +
    `${summary.warnings} avisos · ` +
    funnel
  )
}

/** The label for a wall's funnel role (single room / transition / doble cara / cruce). */
export function roleLabel(row: CoverageRow): string {
  if (row.isDoubleSided) return 'doble cara'
  if (row.isJunction) return 'cruce'
  if (row.isTransition) return 'transición'
  if (row.rooms.length === 1) return 'sala única'
  return 'multi-sala'
}

const DASH = '—'

/** Escape a cell for a GitHub-flavoured Markdown table (pipes + newlines). */
function mdCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

const MD_HEADERS = [
  'inv',
  'muro',
  'sala',
  'funnel',
  'tema',
  'track',
  'estado',
  'tipo',
  'cubierto',
  'lint',
] as const

/**
 * Render the coverage pass as a GitHub-flavoured Markdown table. `temaMax` caps the
 * theme column (default 40). The `lint` column shows `✓` for an `ok` verdict or the
 * concern(s) behind a `⚠`.
 */
export function formatCoverageMarkdown(rows: CoverageRow[], opts: { temaMax?: number } = {}): string {
  const temaMax = opts.temaMax ?? 40
  const header = `| ${MD_HEADERS.join(' | ')} |`
  const sep = `| ${MD_HEADERS.map(() => '---').join(' | ')} |`
  const body = rows.map((r) => {
    const funnel = r.rooms.length ? r.rooms.join(' → ') : DASH
    const lint = r.verdict === 'ok' ? '✓' : `⚠ ${r.concerns.join('; ')}`
    const cubierto = r.covered ? '✓' : `✗ ${r.blankReasons.join('; ')}`
    const cells = [
      String(r.invId),
      r.code,
      r.sala,
      funnel,
      truncate(r.tema, temaMax),
      r.trackText,
      r.estadoText,
      roleLabel(r),
      cubierto,
      lint,
    ]
    return `| ${cells.map(mdCell).join(' | ')} |`
  })
  return [header, sep, ...body].join('\n')
}

const CSV_HEADERS = [
  'invId',
  'code',
  'sala',
  'rooms',
  'tema',
  'track',
  'estado',
  'role',
  'covered',
  'blankReasons',
  'verdict',
  'concerns',
] as const

/** Escape a CSV field (RFC-4180: quote when it contains `,` `"` or a newline). */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Render the coverage pass as CSV (one header row + one row per wall). */
export function formatCoverageCsv(rows: CoverageRow[]): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const r of rows) {
    const fields = [
      String(r.invId),
      r.code,
      r.sala,
      r.rooms.join(' '),
      r.tema,
      r.track,
      r.estado,
      roleLabel(r),
      r.covered ? 'sí' : 'no',
      r.blankReasons.join('; '),
      r.verdict,
      r.concerns.join('; '),
    ]
    lines.push(fields.map(csvField).join(','))
  }
  return lines.join('\n')
}
