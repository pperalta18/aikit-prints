/**
 * Control table (Phase 6 deliverable)
 * ───────────────────────────────────
 * The brief's QA artifact: a single table that answers, at a glance, "where does
 * each of the 21 walls stand?" — **wall id, sala, estado, dpi, dimensions (m),
 * research y/n** (see `specs/wall-graphics.md`, "Deliverables & naming"). It joins
 * three sources of truth that otherwise live apart:
 *
 *   1. the **wall registry** (`event-layout.json` → {@link Wall.registry}) — invId,
 *      sala, estado, track, research, tema;
 *   2. the **wall geometry** (the footprint) — physical run length + height in m;
 *   3. the **authored prints** (`public/prints/<id>/doc.json`) — which wall a print
 *      targets (`props.invId`), its dpi and finished (trim) size.
 *
 * Following the codebase pattern (pure, node-testable core + thin I/O wiring), this
 * module does *no* file reads: it takes the walls and a list of {@link DocSummary}
 * projections and returns the joined rows + formatters + a summary. The thin wrapper
 * that scans `public/prints/` and writes the deliverable lives in
 * `scripts/control-table.mjs`; the unit tests feed it the real committed data.
 *
 * Honesty: a wall with no authored print reports `built: false` (dpi / dimensions =
 * `null`, rendered "—") rather than a fabricated size, and a print pointing at a
 * non-existent wall is surfaced by {@link orphanPrintDocs} instead of silently
 * dropped — the table never overstates how much is done.
 */

import type { Estado, Track, WallRegistry } from './eventLayout'
// Explicit `.ts` so Node's native loader can import this module from a script
// (mirrors `tiling.ts` → `./geometry.ts`). `wallHud.ts` only imports `eventLayout`
// as *types*, which are erased at runtime, so no JSON import is pulled in.
import { TRACK_LABEL, estadoLabel, truncate } from './wallHud.ts'

/**
 * The slice of a {@link import('../types').PrintDoc} the control table needs: the
 * join key (`invId`, from `doc.props.invId`) plus the print columns (dpi + finished
 * trim size in mm). Build one with {@link docSummary}.
 */
export type DocSummary = {
  /** Print id (the `public/prints/<id>` folder / `doc.id`). */
  id: string
  /** The wall this print is mounted on (`doc.props.invId`). */
  invId: number
  /** Render resolution. */
  dpi: number
  /** Finished (cut) width in millimetres. */
  trimWidthMm: number
  /** Finished (cut) height in millimetres. */
  trimHeightMm: number
}

/** The minimal shape of a wall the table needs — a full {@link Wall} satisfies it. */
export type ControlWall = {
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

/** A loosely-typed print doc, enough to project a {@link DocSummary} from it. */
type DocLike = {
  id?: unknown
  dpi?: unknown
  dimensions?: { trimWidthMm?: unknown; trimHeightMm?: unknown } | null
  props?: { invId?: unknown } | null
}

/**
 * Project a print doc to a {@link DocSummary}, or `null` when it is not a wall
 * graphic (no numeric `props.invId`) or is missing the columns the table needs.
 * Lenient by design: it never throws on a malformed/partial doc, it just opts that
 * doc out of the table.
 */
export function docSummary(doc: DocLike): DocSummary | null {
  const invId = doc.props?.invId
  if (typeof invId !== 'number' || !Number.isFinite(invId)) return null
  const id = doc.id
  const dpi = doc.dpi
  const trimWidthMm = doc.dimensions?.trimWidthMm
  const trimHeightMm = doc.dimensions?.trimHeightMm
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof dpi !== 'number' || !Number.isFinite(dpi) || dpi <= 0) return null
  if (typeof trimWidthMm !== 'number' || !Number.isFinite(trimWidthMm) || trimWidthMm <= 0) return null
  if (typeof trimHeightMm !== 'number' || !Number.isFinite(trimHeightMm) || trimHeightMm <= 0) return null
  return { id, invId, dpi, trimWidthMm, trimHeightMm }
}

/** One row of the control table: one registry-bearing wall + its print(s). */
export type ControlRow = {
  /** Stable inventory id 1..21. */
  invId: number
  /** Wall id, e.g. `wall-1`. */
  code: string
  /** Room / zone of the funnel. */
  sala: string
  /** Theme / subject. */
  tema: string
  /** Production status. */
  estado: Estado
  /** Spanish status label. */
  estadoText: string
  /** Production track. */
  track: Track
  /** Spanish track label. */
  trackText: string
  /** Whether the piece carries data that must be researched + sourced. */
  research: boolean
  /** `'sí'` / `'no'` for the research column. */
  researchText: 'sí' | 'no'
  /** Physical wall run length (metres). */
  wallLengthM: number
  /** Physical wall height (metres). */
  wallHeightM: number
  /** Whether {@link wallHeightM} is measured (vs the 2.5 m fallback). */
  hasExplicitHeight: boolean
  /** Every authored print mounted on this wall (sorted by id; usually 0 or 1). */
  prints: DocSummary[]
  /** Whether at least one print has been authored for this wall. */
  built: boolean
  /** Representative print id(s) — all ids joined, or `null` when none. */
  printId: string | null
  /** Representative dpi (the first print's), or `null` when unbuilt. */
  dpi: number | null
  /** Representative finished width in metres, or `null` when unbuilt. */
  widthM: number | null
  /** Representative finished height in metres, or `null` when unbuilt. */
  heightM: number | null
}

function rowFor(wall: ControlWall, registry: WallRegistry, docs: DocSummary[]): ControlRow {
  const prints = [...docs].sort((a, b) => a.id.localeCompare(b.id))
  const rep = prints[0] ?? null
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
    prints,
    built: prints.length > 0,
    printId: prints.length ? prints.map((p) => p.id).join(', ') : null,
    dpi: rep ? rep.dpi : null,
    widthM: rep ? rep.trimWidthMm / 1000 : null,
    heightM: rep ? rep.trimHeightMm / 1000 : null,
  }
}

/**
 * Build the control table: one {@link ControlRow} per registry-bearing wall, joined
 * to its authored print(s) by `invId`, sorted by `invId` ascending. Walls without a
 * registry (glass) are skipped; prints whose `invId` matches no wall are skipped here
 * (recover them with {@link orphanPrintDocs}).
 */
export function buildControlTable(walls: ControlWall[], docs: DocSummary[]): ControlRow[] {
  const byInv = new Map<number, DocSummary[]>()
  for (const d of docs) {
    const list = byInv.get(d.invId)
    if (list) list.push(d)
    else byInv.set(d.invId, [d])
  }
  const rows: ControlRow[] = []
  for (const wall of walls) {
    const r = wall.registry
    if (!r) continue
    rows.push(rowFor(wall, r, byInv.get(r.invId) ?? []))
  }
  return rows.sort((a, b) => a.invId - b.invId)
}

/**
 * Prints that target an `invId` no registry-bearing wall claims — a sign of a typo
 * in a `doc.props.invId` or a deleted wall. Empty in a healthy project.
 */
export function orphanPrintDocs(walls: ControlWall[], docs: DocSummary[]): DocSummary[] {
  const known = new Set<number>()
  for (const w of walls) if (w.registry) known.add(w.registry.invId)
  return docs.filter((d) => !known.has(d.invId))
}

/** Aggregate counts for the table footer / the script's stdout summary. */
export type ControlSummary = {
  /** Registry-bearing walls in the table. */
  total: number
  /** Walls with at least one authored print. */
  built: number
  /** Walls with no print yet. */
  pending: number
  /** Per-status tally (sums to {@link total}). */
  byEstado: Record<Estado, number>
  /** Walls carrying data (`research: true`). */
  research: number
  /** Data walls that already have a print authored. */
  researchBuilt: number
}

/** Summarise the rows (built vs pending, estados, data pieces). */
export function controlTableSummary(rows: ControlRow[]): ControlSummary {
  const summary: ControlSummary = {
    total: rows.length,
    built: 0,
    pending: 0,
    byEstado: { ok: 0, prop: 0, pend: 0 },
    research: 0,
    researchBuilt: 0,
  }
  for (const r of rows) {
    if (r.built) summary.built += 1
    else summary.pending += 1
    if (r.estado in summary.byEstado) summary.byEstado[r.estado] += 1
    if (r.research) {
      summary.research += 1
      if (r.built) summary.researchBuilt += 1
    }
  }
  return summary
}

/** Round a metre value for display, e.g. `6 → "6.0"`, `2.2 → "2.2"`. */
export function formatMetres(m: number, digits = 1): string {
  return m.toFixed(digits)
}

/** `"6.0 × 2.2"` for a built row, `"—"` for an unbuilt one. */
export function dimensionsLabel(row: ControlRow): string {
  if (row.widthM == null || row.heightM == null) return '—'
  return `${formatMetres(row.widthM)} × ${formatMetres(row.heightM)}`
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
  'tema',
  'estado',
  'track',
  'research',
  'impreso',
  'dpi',
  'dim. impresión (m)',
  'largo muro (m)',
] as const

/**
 * Render the control table as a GitHub-flavoured Markdown table. `temaMax` caps the
 * theme column (default 48). The columns are the brief's required set (id, sala,
 * estado, dpi, dimensions in m, research) plus the useful context the data makes
 * free (wall code + run length, track, and whether a print exists yet).
 */
export function formatControlTableMarkdown(rows: ControlRow[], opts: { temaMax?: number } = {}): string {
  const temaMax = opts.temaMax ?? 48
  const header = `| ${MD_HEADERS.join(' | ')} |`
  const sep = `| ${MD_HEADERS.map(() => '---').join(' | ')} |`
  const body = rows.map((r) => {
    // Raw cell values — escaped exactly once by the `.map(mdCell)` below.
    const cells = [
      String(r.invId),
      r.code,
      r.sala,
      truncate(r.tema, temaMax),
      r.estadoText,
      r.trackText,
      r.researchText,
      r.built ? '✓' : DASH,
      r.dpi == null ? DASH : String(r.dpi),
      dimensionsLabel(r),
      formatMetres(r.wallLengthM),
    ]
    return `| ${cells.map(mdCell).join(' | ')} |`
  })
  return [header, sep, ...body].join('\n')
}

const CSV_HEADERS = [
  'invId',
  'code',
  'sala',
  'tema',
  'estado',
  'track',
  'research',
  'built',
  'printId',
  'dpi',
  'widthM',
  'heightM',
  'wallLengthM',
  'wallHeightM',
] as const

/** Escape a CSV field (RFC-4180: quote when it contains `,` `"` or a newline). */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Render the control table as CSV (one header row + one row per wall). */
export function formatControlTableCsv(rows: ControlRow[]): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const r of rows) {
    const fields = [
      String(r.invId),
      r.code,
      r.sala,
      r.tema,
      r.estado,
      r.track,
      r.researchText,
      r.built ? 'sí' : 'no',
      r.printId ?? '',
      r.dpi == null ? '' : String(r.dpi),
      r.widthM == null ? '' : formatMetres(r.widthM, 3),
      r.heightM == null ? '' : formatMetres(r.heightM, 3),
      formatMetres(r.wallLengthM, 3),
      formatMetres(r.wallHeightM, 3),
    ]
    lines.push(fields.map(csvField).join(','))
  }
  return lines.join('\n')
}

/** One-line human summary, e.g. `7/21 impresas · 5 listas · 9 con datos`. */
export function summaryLine(summary: ControlSummary): string {
  return (
    `${summary.built}/${summary.total} impresas · ` +
    `${summary.byEstado.ok} listas / ${summary.byEstado.prop} propuestas / ${summary.byEstado.pend} pendientes · ` +
    `${summary.researchBuilt}/${summary.research} piezas con datos impresas`
  )
}
