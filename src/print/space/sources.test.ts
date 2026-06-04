import { describe, expect, it } from 'vitest'
import {
  assertSourcesNotes,
  buildSourcePieces,
  dataPieceToSource,
  formatSourcesCsv,
  formatSourcesMarkdown,
  hasSourcesNote,
  piecesMissingSourcesNote,
  refPieceToSource,
  sourcesSummary,
  summaryLine,
} from './sources'
import {
  allPieces,
  allRefPieces,
  isIsoDate,
  type DatumGroup,
  type PieceData,
  type RefItem,
  type RefPiece,
  type WallDatum,
} from './wall-data'

/**
 * Sources deliverable (Phase 3 · Phase 6) tests
 * ─────────────────────────────────────────────
 * Two unbiased layers:
 *  1. The pure projection / join / format / summary logic on synthetic pieces — the
 *     `{ figure, value, date, sourceURL }` rows are projected faithfully, a missing
 *     note is surfaced (never silently dropped), a reference with no figure keeps a
 *     null value (no fabricated number), the formatters escape + round-trip, the
 *     summary partitions cleanly.
 *  2. The *real* committed data (`allPieces()` + `allRefPieces()`) — so the
 *     deliverable, and especially the Phase 6 "every data piece has a sources note"
 *     confirmation, is proven against what the project actually ships.
 */

// ── Synthetic fixtures ──────────────────────────────────────────────────────
function datum(over: Partial<WallDatum> = {}): WallDatum {
  return {
    id: over.id ?? 'd1',
    label: over.label ?? 'Label',
    group: (over.group ?? 'aggregate') as DatumGroup,
    unit: over.unit ?? 'USD',
    figure: over.figure ?? 'A figure',
    value: over.value ?? 1000,
    date: over.date ?? '2026-01',
    sourceURL: over.sourceURL ?? 'https://www.example.com/x',
    ...(over.note ? { note: over.note } : {}),
  }
}

function dataPiece(over: Partial<PieceData> = {}): PieceData {
  const invId = over.invId ?? 2
  return {
    invId,
    code: over.code ?? `wall-${invId - 1}`,
    slug: over.slug ?? `piece-${invId}`,
    title: over.title ?? `Piece ${invId}`,
    sala: over.sala ?? 'S3',
    data: over.data ?? [datum()],
    sourcesNote: over.sourcesNote ?? 'A note',
  }
}

function refItem(over: Partial<RefItem> = {}): RefItem {
  return {
    id: over.id ?? 'r1',
    label: over.label ?? 'Ref',
    category: over.category ?? 'autonomous-vehicle',
    claim: over.claim ?? 'A real claim',
    date: over.date ?? '2025-05',
    sourceURL: over.sourceURL ?? 'https://www.example.org/y',
    ...(over.value !== undefined ? { value: over.value } : {}),
    ...(over.unit !== undefined ? { unit: over.unit } : {}),
    ...(over.note ? { note: over.note } : {}),
  }
}

function refPiece(over: Partial<RefPiece> = {}): RefPiece {
  const invId = over.invId ?? 13
  return {
    invId,
    code: over.code ?? `wall-${invId - 1}`,
    slug: over.slug ?? `ref-${invId}`,
    title: over.title ?? `Ref ${invId}`,
    sala: over.sala ?? 'S5/S6',
    refs: over.refs ?? [refItem()],
    sourcesNote: over.sourcesNote ?? 'A ref note',
  }
}

/** Count Markdown table columns by splitting on *unescaped* pipes only. */
function mdCols(line: string): number {
  return line.split(/(?<!\\)\|/).length
}

describe('hasSourcesNote', () => {
  it('is true only for a non-empty, non-whitespace string', () => {
    expect(hasSourcesNote('Fuentes: x')).toBe(true)
    expect(hasSourcesNote('')).toBe(false)
    expect(hasSourcesNote('   ')).toBe(false)
    expect(hasSourcesNote(undefined)).toBe(false)
    expect(hasSourcesNote(null)).toBe(false)
    expect(hasSourcesNote(42)).toBe(false)
  })
})

describe('dataPieceToSource — projecting a code-track piece', () => {
  it('projects each datum to a faithful { figure, value, date, sourceURL } row + host', () => {
    const p = dataPieceToSource(
      dataPiece({
        data: [
          datum({ id: 'a', figure: 'Fig A', value: 5.24e12, unit: 'USD', date: '2026-06-03', sourceURL: 'https://www.companiesmarketcap.com/nvidia/' }),
          datum({ id: 'b', figure: 'Fig B', value: 60e6, unit: 'parameters', date: '2012', sourceURL: 'https://proceedings.neurips.cc/x.pdf' }),
        ],
      }),
    )
    expect(p.track).toBe('data')
    expect(p.rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(p.rows[0]).toEqual({
      id: 'a',
      figure: 'Fig A',
      value: 5.24e12,
      unit: 'USD',
      date: '2026-06-03',
      sourceURL: 'https://www.companiesmarketcap.com/nvidia/',
      host: 'companiesmarketcap.com',
    })
    expect(p.rows[1].host).toBe('proceedings.neurips.cc')
  })

  it('dedupes hosts in first-seen order and reports the latest date', () => {
    const p = dataPieceToSource(
      dataPiece({
        data: [
          datum({ id: 'a', date: '2026-06', sourceURL: 'https://www.companiesmarketcap.com/a' }),
          datum({ id: 'b', date: '2026-06-03', sourceURL: 'https://companiesmarketcap.com/b' }), // same host
          datum({ id: 'c', date: '2025', sourceURL: 'https://www.imf.org/c' }),
        ],
      }),
    )
    expect(p.hosts).toEqual(['companiesmarketcap.com', 'imf.org'])
    expect(p.latestDate).toBe('2026-06-03')
  })

  it('carries the note + hasSourcesNote flag through', () => {
    expect(dataPieceToSource(dataPiece({ sourcesNote: 'hi' })).hasSourcesNote).toBe(true)
    expect(dataPieceToSource(dataPiece({ sourcesNote: '' })).hasSourcesNote).toBe(false)
  })
})

describe('refPieceToSource — projecting an image-track piece', () => {
  it('uses the claim as the row figure and a present value/unit', () => {
    const p = refPieceToSource(
      refPiece({ refs: [refItem({ id: 'aurora', claim: 'Driverless trucking', value: 100000, unit: 'millas' })] }),
    )
    expect(p.track).toBe('reference')
    expect(p.rows[0].figure).toBe('Driverless trucking')
    expect(p.rows[0].value).toBe(100000)
    expect(p.rows[0].unit).toBe('millas')
    expect(p.rows[0].host).toBe('example.org')
  })

  it('keeps value/unit null for an existence-only reference (no fabricated number)', () => {
    const p = refPieceToSource(refPiece({ refs: [refItem({ id: 'x', value: undefined, unit: undefined })] }))
    expect(p.rows[0].value).toBeNull()
    expect(p.rows[0].unit).toBeNull()
  })
})

describe('buildSourcePieces — the join', () => {
  it('includes every data + reference piece', () => {
    const pieces = buildSourcePieces([dataPiece({ invId: 2 }), dataPiece({ invId: 8 })], [refPiece({ invId: 13 })])
    expect(pieces.length).toBe(3)
    expect(pieces.filter((p) => p.track === 'data').length).toBe(2)
    expect(pieces.filter((p) => p.track === 'reference').length).toBe(1)
  })

  it('sorts by invId, then track, then slug (deterministic)', () => {
    const pieces = buildSourcePieces(
      [dataPiece({ invId: 16, slug: 'b-second' }), dataPiece({ invId: 16, slug: 'a-first' }), dataPiece({ invId: 2 })],
      [refPiece({ invId: 13 })],
    )
    expect(pieces.map((p) => p.invId)).toEqual([2, 13, 16, 16])
    // Within wall 16, slugs are ordered.
    const w16 = pieces.filter((p) => p.invId === 16)
    expect(w16.map((p) => p.slug)).toEqual(['a-first', 'b-second'])
  })

  it('orders a data piece before a reference piece sharing a wall', () => {
    const pieces = buildSourcePieces([dataPiece({ invId: 13, slug: 'z' })], [refPiece({ invId: 13, slug: 'a' })])
    expect(pieces.map((p) => p.track)).toEqual(['data', 'reference']) // 'data' < 'reference'
  })
})

describe('piecesMissingSourcesNote / assertSourcesNotes', () => {
  it('flags only the pieces whose note is missing/blank', () => {
    const pieces = buildSourcePieces(
      [dataPiece({ slug: 'ok', sourcesNote: 'has note' }), dataPiece({ slug: 'blank', sourcesNote: '   ' })],
      [],
    )
    expect(piecesMissingSourcesNote(pieces).map((p) => p.slug)).toEqual(['blank'])
  })

  it('assertSourcesNotes throws naming the offenders, passes when all present', () => {
    const good = buildSourcePieces([dataPiece({ slug: 'a' }), dataPiece({ slug: 'b' })], [])
    expect(() => assertSourcesNotes(good)).not.toThrow()

    const bad = buildSourcePieces([dataPiece({ slug: 'no-note', sourcesNote: '' })], [])
    expect(() => assertSourcesNotes(bad)).toThrow(/no-note/)
  })
})

describe('sourcesSummary / summaryLine', () => {
  it('partitions tracks + note coverage and counts sources/hosts', () => {
    const pieces = buildSourcePieces(
      [
        dataPiece({ slug: 'd1', data: [datum({ id: 'a', sourceURL: 'https://www.alpha.com/1' }), datum({ id: 'b', sourceURL: 'https://www.beta.com/2' })] }),
        dataPiece({ slug: 'd2', sourcesNote: '', data: [datum({ id: 'c', sourceURL: 'https://www.alpha.com/3' })] }),
      ],
      [refPiece({ slug: 'r1', refs: [refItem({ id: 'x', sourceURL: 'https://www.gamma.org/4' })] })],
    )
    const s = sourcesSummary(pieces)
    expect(s.pieces).toBe(3)
    expect(s.dataPieces).toBe(2)
    expect(s.referencePieces).toBe(1)
    expect(s.dataPieces + s.referencePieces).toBe(s.pieces)
    expect(s.withNote).toBe(2)
    expect(s.missingNote).toBe(1)
    expect(s.withNote + s.missingNote).toBe(s.pieces)
    expect(s.totalSources).toBe(4) // 2 + 1 + 1 rows
    expect(s.hosts).toBe(3) // alpha, beta, gamma (alpha deduped across pieces)
  })

  it('summaryLine reflects the counts', () => {
    const s = sourcesSummary(buildSourcePieces([dataPiece()], [refPiece()]))
    const line = summaryLine(s)
    expect(line).toContain('2 piezas')
    expect(line).toContain('1 datos · 1 referencias')
    expect(line).toContain('2/2 con nota')
  })
})

describe('formatSourcesMarkdown', () => {
  it('renders a section, caption, note + a row table per piece', () => {
    const pieces = buildSourcePieces([dataPiece({ invId: 2, title: 'Solar', sourcesNote: 'The note' })], [])
    const md = formatSourcesMarkdown(pieces)
    expect(md).toContain('## #2 · wall-1 · Solar · S3 · datos')
    expect(md).toContain('**Fuentes:** example.com')
    expect(md).toContain('> The note')
    expect(md).toContain('| id | figura | valor | fecha | fuente |')
  })

  it('flags a missing note visibly instead of dropping it', () => {
    const md = formatSourcesMarkdown(buildSourcePieces([dataPiece({ sourcesNote: '' })], []))
    expect(md).toContain('⚠ **Falta la nota de fuentes**')
  })

  it('escapes pipes in the title, note and figure so the table never breaks', () => {
    const pieces = buildSourcePieces(
      [dataPiece({ title: 'a | b', sourcesNote: 'note | with pipe', data: [datum({ figure: 'fig | x' })] })],
      [],
    )
    const md = formatSourcesMarkdown(pieces)
    expect(md).toContain('a \\| b')
    expect(md).toContain('note \\| with pipe')
    const tableRow = md.split('\n').find((l) => l.includes('fig \\| x'))!
    expect(tableRow).toBeDefined()
    const headerRow = md.split('\n').find((l) => l.startsWith('| id | figura'))!
    expect(mdCols(tableRow)).toBe(mdCols(headerRow)) // escaped pipe ≠ delimiter
  })

  it('renders a reference value with its unit and a dash for a value-less ref', () => {
    const md = formatSourcesMarkdown(
      buildSourcePieces([], [refPiece({ refs: [refItem({ id: 'with', value: 201, unit: 'fábricas' }), refItem({ id: 'without', value: undefined, unit: undefined })] })]),
    )
    expect(md).toContain('201 fábricas')
    // the value-less row renders an em dash in the valor column
    const lines = md.split('\n')
    const withoutRow = lines.find((l) => l.startsWith('| without |'))!
    expect(withoutRow).toContain('| — |')
  })
})

describe('formatSourcesCsv', () => {
  it('emits a header + one row per source with raw values', () => {
    const pieces = buildSourcePieces(
      [dataPiece({ data: [datum({ id: 'a' }), datum({ id: 'b' })] })],
      [refPiece({ refs: [refItem({ id: 'x' })] })],
    )
    const csv = formatSourcesCsv(pieces)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('invId,code,slug,track,hasSourcesNote,rowId,figure,value,unit,date,sourceURL,host')
    expect(lines.length).toBe(1 + 3) // 2 datums + 1 ref
  })

  it('leaves value/unit empty for a value-less reference', () => {
    const csv = formatSourcesCsv(buildSourcePieces([], [refPiece({ refs: [refItem({ id: 'x', value: undefined, unit: undefined })] })]))
    const row = csv.split('\n')[1].split(',')
    // ...,rowId(x),figure,value(''),unit(''),date,...
    expect(row[5]).toBe('x')
    expect(row[7]).toBe('') // value
    expect(row[8]).toBe('') // unit
  })

  it('quotes fields that contain commas or quotes (RFC-4180)', () => {
    const csv = formatSourcesCsv(buildSourcePieces([dataPiece({ data: [datum({ figure: 'a, "b"' })] })], []))
    expect(csv).toContain('"a, ""b"""')
  })
})

// ── Real committed data ─────────────────────────────────────────────────────
describe('sources — real committed data', () => {
  const pieces = buildSourcePieces()

  it('joins every data + reference piece (none lost)', () => {
    expect(pieces.length).toBe(allPieces().length + allRefPieces().length)
    expect(pieces.filter((p) => p.track === 'data').length).toBe(allPieces().length)
    expect(pieces.filter((p) => p.track === 'reference').length).toBe(allRefPieces().length)
    // Current snapshot — a new piece only raises these.
    expect(allPieces().length).toBeGreaterThanOrEqual(6)
    expect(allRefPieces().length).toBeGreaterThanOrEqual(2)
  })

  it('is sorted by invId (non-decreasing) and deterministic across builds', () => {
    const invIds = pieces.map((p) => p.invId)
    expect([...invIds].sort((a, b) => a - b)).toEqual(invIds)
    expect(formatSourcesMarkdown()).toBe(formatSourcesMarkdown(buildSourcePieces()))
    expect(formatSourcesCsv()).toBe(formatSourcesCsv(buildSourcePieces()))
  })

  it('EVERY piece carries a sources note — the Phase 6 confirmation', () => {
    expect(piecesMissingSourcesNote(pieces)).toEqual([])
    expect(() => assertSourcesNotes(pieces)).not.toThrow()
    for (const p of pieces) {
      expect(p.hasSourcesNote, `${p.slug} note`).toBe(true)
      expect(p.sourcesNote.trim().length).toBeGreaterThan(0)
    }
  })

  it('every source row resolves to a host and a valid ISO date', () => {
    for (const p of pieces) {
      expect(p.rows.length, `${p.slug} has rows`).toBeGreaterThan(0)
      for (const r of p.rows) {
        expect(r.host.length, `${p.slug}/${r.id} host`).toBeGreaterThan(0)
        expect(isIsoDate(r.date), `${p.slug}/${r.id} date ${r.date}`).toBe(true)
        expect(r.sourceURL).toMatch(/^https?:\/\//)
      }
    }
  })

  it('every code-track (data) row has a finite numeric value', () => {
    for (const p of pieces.filter((x) => x.track === 'data')) {
      for (const r of p.rows) {
        expect(typeof r.value, `${p.slug}/${r.id}`).toBe('number')
        expect(Number.isFinite(r.value as number)).toBe(true)
      }
    }
  })

  it('exposes the hero piece with its real anchor datum', () => {
    const hero = pieces.find((p) => p.slug === 'sistema-solar-inversion')
    expect(hero, 'hero piece present').toBeDefined()
    expect(hero!.invId).toBe(2)
    expect(hero!.track).toBe('data')
    const nvidia = hero!.rows.find((r) => r.id === 'nvidia')
    expect(nvidia).toBeDefined()
    expect(nvidia!.value).toBe(5.24e12)
    expect(nvidia!.host).toBe('companiesmarketcap.com')
    expect(hero!.latestDate).toBe('2026-06-03')
  })

  it('exposes the image-track reference pieces (#13, #20) as references', () => {
    const realidad = pieces.find((p) => p.slug === 'realidad-ya-existe')
    const salones = pieces.find((p) => p.slug === 'salones-por-siglos')
    expect(realidad?.track).toBe('reference')
    expect(realidad?.invId).toBe(13)
    expect(salones?.track).toBe('reference')
    expect(salones?.invId).toBe(20)
  })

  it('the summary is internally consistent and reflects current progress', () => {
    const s = sourcesSummary(pieces)
    expect(s.pieces).toBe(pieces.length)
    expect(s.dataPieces + s.referencePieces).toBe(s.pieces)
    expect(s.withNote).toBe(s.pieces) // all sourced
    expect(s.missingNote).toBe(0)
    expect(s.totalSources).toBe(pieces.reduce((n, p) => n + p.rows.length, 0))
    expect(s.hosts).toBeGreaterThan(0)
  })

  it('renders a Markdown deliverable that names every piece + its note', () => {
    const md = formatSourcesMarkdown(pieces)
    for (const p of pieces) {
      expect(md, `${p.slug} heading`).toContain(`#${p.invId} · ${p.code} ·`)
      // A slice of the note proves the note is rendered beside the piece.
      expect(md).toContain(p.sourcesNote.slice(0, 24))
    }
    expect(md).not.toContain('Falta la nota de fuentes') // nothing missing
  })

  it('renders a CSV deliverable with one record per source', () => {
    const csv = formatSourcesCsv(pieces)
    const lines = csv.split('\n')
    expect(lines[0].split(',')[0]).toBe('invId')
    const totalRows = pieces.reduce((n, p) => n + p.rows.length, 0)
    expect(lines.length).toBe(1 + totalRows)
  })
})
