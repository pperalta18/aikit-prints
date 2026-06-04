/**
 * Sources deliverable (Phase 3 · Phase 6)
 * ───────────────────────────────────────
 * Two checklist items, one underlying concern — every researched wall piece must
 * carry a **sources note alongside its deliverable** (Phase 3) and the QA pass must
 * **confirm every data piece actually has one** (Phase 6). See
 * `specs/wall-graphics.md` (Methodology · Deliverables & naming).
 *
 * The numbers themselves live in `wall-data.ts` — the single, versioned, sourced
 * data file. Each {@link PieceData} (code track) and {@link RefPiece} (image /
 * hybrid track) already records a one-line `sourcesNote` beside its figures. This
 * module is the deliverable that consolidates them: it joins both tracks into one
 * list of {@link SourcePiece}s — each with its note, a `{ figure, value, date,
 * sourceURL }` row per datum / reference, and the deduped source hosts — and adds
 * the completeness guard ({@link assertSourcesNotes}) that lets a test fail if any
 * piece ships without a note.
 *
 * Following the codebase pattern (pure, node-testable core + thin I/O wiring), this
 * module does *no* file reads: it imports the data registries directly and returns
 * the joined pieces + formatters + a summary. The thin wrapper that writes the
 * deliverable to `out/` lives in `scripts/sources.mjs`; the unit tests in
 * `sources.test.ts` feed it the real committed data.
 *
 * Honesty: a reference with no headline figure reports `value: null` (rendered "—")
 * rather than a fabricated number, and a piece missing its note is surfaced (never
 * silently dropped) by {@link piecesMissingSourcesNote}.
 */

// Explicit `.ts` so Node's native loader can import this whole chain from the
// `scripts/sources.mjs` wrapper (mirrors `controlTable.ts` → `./wallHud.ts`). The
// data file's only relative dependency is `../pages/dataviz-scales.ts`, which is
// pure (no imports of its own), so the chain resolves under raw Node.
import { sourceHost } from '../pages/dataviz-scales.ts'
import {
  allPieces,
  allRefPieces,
  type PieceData,
  type RefItem,
  type RefPiece,
  type WallDatum,
} from './wall-data.ts'

/** Which production track a sourced piece belongs to. */
export type SourceTrack = 'data' | 'reference'

/** Spanish label for a {@link SourceTrack}. */
export const TRACK_LABEL: Record<SourceTrack, string> = {
  data: 'datos',
  reference: 'referencia',
}

/**
 * One deliverable source row — the `{ figure, value, date, sourceURL }` contract the
 * spec asks for, plus the unit and the resolved host. `value` / `unit` are `null`
 * for an existence-only reference that carries no headline figure.
 */
export type SourceRow = {
  /** Stable datum / reference id within its piece. */
  id: string
  /** What the row measures — a datum's `figure` or a reference's `claim`. */
  figure: string
  /** The value, or `null` for a reference with no headline figure. */
  value: number | null
  /** Unit of `value`, or `null` when there is no value. */
  unit: string | null
  /** ISO date the figure is true / was reported. */
  date: string
  /** Source URL. */
  sourceURL: string
  /** Host of {@link sourceURL} without `www.` (deduped in captions). */
  host: string
}

/** A piece (data or reference) with its sources note + deliverable rows. */
export type SourcePiece = {
  /** Inventory id (1..21) of the wall. */
  invId: number
  /** Code id of the wall — `wall-(invId-1)`. */
  code: string
  /** Slug / key in its registry. */
  slug: string
  /** Human title. */
  title: string
  /** Room / zone. */
  sala: string
  /** Which track (code-rendered data vs image / hybrid reference). */
  track: SourceTrack
  /** The per-piece narrative sources note (the deliverable the spec requires). */
  sourcesNote: string
  /** Whether {@link sourcesNote} is present + non-empty. */
  hasSourcesNote: boolean
  /** One row per datum / reference. */
  rows: SourceRow[]
  /** Deduped source hosts in first-seen order. */
  hosts: string[]
  /** Most recent ISO date across {@link rows}, or `null` when there are none. */
  latestDate: string | null
}

/** True when `note` is a non-empty (non-whitespace) string. */
export function hasSourcesNote(note: unknown): note is string {
  return typeof note === 'string' && note.trim().length > 0
}

/** Source hosts of `rows`, deduped, in first-seen order (drops empties). */
function dedupeHosts(rows: SourceRow[]): string[] {
  const hosts: string[] = []
  for (const r of rows) {
    if (r.host && !hosts.includes(r.host)) hosts.push(r.host)
  }
  return hosts
}

/** The most recent ISO date in `rows` (lexical compare is correct for zero-padded ISO). */
function latestDateOf(rows: SourceRow[]): string | null {
  return rows.reduce<string | null>((acc, r) => (acc == null || r.date > acc ? r.date : acc), null)
}

/** Project a code-track {@link PieceData} to its deliverable source rows. */
function rowsFromData(data: WallDatum[]): SourceRow[] {
  return data.map((d) => ({
    id: d.id,
    figure: d.figure,
    value: d.value,
    unit: d.unit,
    date: d.date,
    sourceURL: d.sourceURL,
    host: sourceHost(d.sourceURL),
  }))
}

/** Project an image-track {@link RefItem}'s to deliverable source rows. */
function rowsFromRefs(refs: RefItem[]): SourceRow[] {
  return refs.map((r) => ({
    id: r.id,
    figure: r.claim,
    value: r.value ?? null,
    unit: r.unit ?? null,
    date: r.date,
    sourceURL: r.sourceURL,
    host: sourceHost(r.sourceURL),
  }))
}

function toSourcePiece(
  base: { invId: number; code: string; slug: string; title: string; sala: string; sourcesNote: string },
  track: SourceTrack,
  rows: SourceRow[],
): SourcePiece {
  return {
    invId: base.invId,
    code: base.code,
    slug: base.slug,
    title: base.title,
    sala: base.sala,
    track,
    sourcesNote: base.sourcesNote,
    hasSourcesNote: hasSourcesNote(base.sourcesNote),
    rows,
    hosts: dedupeHosts(rows),
    latestDate: latestDateOf(rows),
  }
}

/** Turn a code-track data piece into a {@link SourcePiece}. */
export function dataPieceToSource(piece: PieceData): SourcePiece {
  return toSourcePiece(piece, 'data', rowsFromData(piece.data))
}

/** Turn an image / hybrid-track reference piece into a {@link SourcePiece}. */
export function refPieceToSource(piece: RefPiece): SourcePiece {
  return toSourcePiece(piece, 'reference', rowsFromRefs(piece.refs))
}

/**
 * Build the unified list of sourced pieces — every code-track data piece and every
 * image-track reference piece — sorted by `invId`, then track, then slug, so the
 * deliverable is deterministic. Defaults to the whole committed data file.
 */
export function buildSourcePieces(
  data: PieceData[] = allPieces(),
  refs: RefPiece[] = allRefPieces(),
): SourcePiece[] {
  const out = [...data.map(dataPieceToSource), ...refs.map(refPieceToSource)]
  return out.sort(
    (a, b) => a.invId - b.invId || a.track.localeCompare(b.track) || a.slug.localeCompare(b.slug),
  )
}

/** Pieces missing their sources note — empty in a healthy data file. */
export function piecesMissingSourcesNote(pieces: SourcePiece[] = buildSourcePieces()): SourcePiece[] {
  return pieces.filter((p) => !p.hasSourcesNote)
}

/**
 * Throw if any piece ships without a sources note — the Phase 6 "confirm a sources
 * note exists for every data piece" guard. Defaults to the whole data file.
 */
export function assertSourcesNotes(pieces: SourcePiece[] = buildSourcePieces()): void {
  const missing = piecesMissingSourcesNote(pieces)
  if (missing.length) {
    throw new Error(
      `sources: ${missing.length} piece(s) without a sources note: ${missing.map((p) => p.slug).join(', ')}`,
    )
  }
}

/* ── summary ─────────────────────────────────────────────────────────────────── */

/** Aggregate counts for the deliverable footer / the script's stdout summary. */
export type SourcesSummary = {
  /** Total sourced pieces. */
  pieces: number
  /** Code-track data pieces. */
  dataPieces: number
  /** Image / hybrid-track reference pieces. */
  referencePieces: number
  /** Pieces carrying a sources note. */
  withNote: number
  /** Pieces missing a sources note (should be 0). */
  missingNote: number
  /** Total deliverable rows (datums + references) across all pieces. */
  totalSources: number
  /** Distinct source hosts across all pieces. */
  hosts: number
}

/** Summarise the sourced pieces (tracks, note coverage, source + host counts). */
export function sourcesSummary(pieces: SourcePiece[] = buildSourcePieces()): SourcesSummary {
  const hosts = new Set<string>()
  let dataPieces = 0
  let referencePieces = 0
  let withNote = 0
  let totalSources = 0
  for (const p of pieces) {
    if (p.track === 'data') dataPieces += 1
    else referencePieces += 1
    if (p.hasSourcesNote) withNote += 1
    totalSources += p.rows.length
    for (const h of p.hosts) hosts.add(h)
  }
  return {
    pieces: pieces.length,
    dataPieces,
    referencePieces,
    withNote,
    missingNote: pieces.length - withNote,
    totalSources,
    hosts: hosts.size,
  }
}

/** One-line human summary, e.g. `8 piezas (6 datos · 2 referencias) · 39 fuentes · 12 hosts · 8/8 con nota`. */
export function summaryLine(summary: SourcesSummary): string {
  return (
    `${summary.pieces} piezas (${summary.dataPieces} datos · ${summary.referencePieces} referencias) · ` +
    `${summary.totalSources} fuentes · ${summary.hosts} hosts · ` +
    `${summary.withNote}/${summary.pieces} con nota`
  )
}

/* ── formatters ──────────────────────────────────────────────────────────────── */

const DASH = '—'

/** Escape a cell for a GitHub-flavoured Markdown table (pipes + newlines). */
function mdCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

/** Format a row value for the human-facing Markdown table (deterministic). */
function formatRowValue(row: SourceRow): string {
  if (row.value == null) return DASH
  // Plain decimal string — exact and locale-independent (no toLocaleString, which
  // would vary by environment and break determinism across machines).
  const num = String(row.value)
  return row.unit ? `${num} ${row.unit}` : num
}

const ROW_HEADERS = ['id', 'figura', 'valor', 'fecha', 'fuente'] as const

/** Render one piece's deliverable rows as a GFM table. */
function rowsTable(rows: SourceRow[]): string {
  const header = `| ${ROW_HEADERS.join(' | ')} |`
  const sep = `| ${ROW_HEADERS.map(() => '---').join(' | ')} |`
  const body = rows.map((r) => {
    const cells = [r.id, r.figure, formatRowValue(r), r.date, r.host]
    return `| ${cells.map(mdCell).join(' | ')} |`
  })
  return [header, sep, ...body].join('\n')
}

/**
 * Render the sources deliverable as Markdown: one section per piece — a heading,
 * its deduped source hosts + latest date, its narrative sources note (or a visible
 * warning if it is missing), and the `{ id, figure, valor, fecha, fuente }` table.
 * The document title / summary are added by the script wrapper (mirrors
 * `formatControlTableMarkdown`).
 */
export function formatSourcesMarkdown(pieces: SourcePiece[] = buildSourcePieces()): string {
  return pieces
    .map((p) => {
      const head = `## #${p.invId} · ${p.code} · ${mdCell(p.title)} · ${p.sala} · ${TRACK_LABEL[p.track]}`
      const caption = p.hosts.length
        ? `**Fuentes:** ${p.hosts.join(', ')}${p.latestDate ? ` · ${p.latestDate}` : ''}`
        : '_Sin fuentes_'
      const note = p.hasSourcesNote
        ? `> ${mdCell(p.sourcesNote)}`
        : '> ⚠ **Falta la nota de fuentes**'
      return [head, '', caption, '', note, '', rowsTable(p.rows)].join('\n')
    })
    .join('\n\n')
}

const CSV_HEADERS = [
  'invId',
  'code',
  'slug',
  'track',
  'hasSourcesNote',
  'rowId',
  'figure',
  'value',
  'unit',
  'date',
  'sourceURL',
  'host',
] as const

/** Escape a CSV field (RFC-4180: quote when it contains `,` `"` or a newline). */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Render the deliverable as a flat CSV — one row per source (`{ figure, value,
 * date, sourceURL }` with its piece identity + host), machine-readable with exact
 * raw values. The narrative note stays in the Markdown; `hasSourcesNote` carries the
 * confirmation here.
 */
export function formatSourcesCsv(pieces: SourcePiece[] = buildSourcePieces()): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const p of pieces) {
    for (const r of p.rows) {
      const fields = [
        String(p.invId),
        p.code,
        p.slug,
        p.track,
        p.hasSourcesNote ? 'sí' : 'no',
        r.id,
        r.figure,
        r.value == null ? '' : String(r.value),
        r.unit ?? '',
        r.date,
        r.sourceURL,
        r.host,
      ]
      lines.push(fields.map(csvField).join(','))
    }
  }
  return lines.join('\n')
}
