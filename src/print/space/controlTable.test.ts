import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildControlTable,
  controlTableSummary,
  dimensionsLabel,
  docSummary,
  formatControlTableCsv,
  formatControlTableMarkdown,
  formatMetres,
  orphanPrintDocs,
  summaryLine,
  type ControlWall,
  type DocSummary,
} from './controlTable'
import { REGISTERED_WALLS } from './eventLayout'
import type { Estado, Track } from './eventLayout'
import type { PrintDoc } from '../types'

/**
 * Control table (Phase 6 deliverable) tests
 * ─────────────────────────────────────────
 * Two layers, both unbiased:
 *  1. The pure join/format/summary logic on synthetic walls + docs — the join is
 *     correct, unbuilt walls don't fabricate a size, orphans are surfaced, the
 *     formatters round-trip, the summary partitions cleanly.
 *  2. The *real* committed data — `REGISTERED_WALLS` joined to every authored
 *     `public/prints/<id>/doc.json` — so the deliverable is proven against what the
 *     project actually ships, not a convenient fixture.
 */

// ── Synthetic fixtures ──────────────────────────────────────────────────────
type WallOverrides = {
  length?: number
  height?: number
  hasExplicitHeight?: boolean
  sala?: string
  tema?: string
  track?: Track
  research?: boolean
  estado?: Estado
}

function wall(invId: number, over: WallOverrides = {}): ControlWall {
  return {
    id: `wall-${invId - 1}`,
    length: over.length ?? 6,
    height: over.height ?? 2.5,
    hasExplicitHeight: over.hasExplicitHeight ?? false,
    registry: {
      invId,
      sala: over.sala ?? 'S3',
      tema: over.tema ?? `tema ${invId}`,
      rol: '',
      track: over.track ?? 'C',
      research: over.research ?? false,
      estado: over.estado ?? 'prop',
    },
  }
}

function glassWall(id: string): ControlWall {
  return { id, length: 4, height: 2.5, hasExplicitHeight: false }
}

function doc(id: string, invId: number, dpi = 60, w = 6000, h = 2200): DocSummary {
  return { id, invId, dpi, trimWidthMm: w, trimHeightMm: h }
}

/** Count Markdown table columns by splitting on *unescaped* pipes only. */
function mdCols(line: string): number {
  return line.split(/(?<!\\)\|/).length
}

describe('docSummary — projecting a print doc', () => {
  it('extracts the join key + print columns when props.invId is numeric', () => {
    const full = {
      id: 'hero-solar',
      dpi: 60,
      dimensions: { trimWidthMm: 6000, trimHeightMm: 2200 },
      props: { invId: 2 },
    }
    expect(docSummary(full)).toEqual({ id: 'hero-solar', invId: 2, dpi: 60, trimWidthMm: 6000, trimHeightMm: 2200 })
  })

  it('returns null for a non-wall print (no props.invId)', () => {
    expect(docSummary({ id: 'raster-proof', dpi: 36, dimensions: { trimWidthMm: 1000, trimHeightMm: 1400 }, props: {} })).toBeNull()
    expect(docSummary({ id: 'signage', dpi: 150, dimensions: { trimWidthMm: 460, trimHeightMm: 1150 } })).toBeNull()
  })

  it('is lenient — returns null (never throws) on malformed/partial docs', () => {
    expect(docSummary({})).toBeNull()
    expect(docSummary({ id: '', dpi: 60, dimensions: { trimWidthMm: 1, trimHeightMm: 1 }, props: { invId: 2 } })).toBeNull()
    expect(docSummary({ id: 'x', dpi: 0, dimensions: { trimWidthMm: 1, trimHeightMm: 1 }, props: { invId: 2 } })).toBeNull()
    expect(docSummary({ id: 'x', dpi: 60, dimensions: { trimWidthMm: -1, trimHeightMm: 1 }, props: { invId: 2 } })).toBeNull()
    expect(docSummary({ id: 'x', dpi: 60, props: { invId: 2 } })).toBeNull()
    expect(docSummary({ id: 'x', dpi: 60, dimensions: { trimWidthMm: 1, trimHeightMm: 1 }, props: { invId: Number.NaN } })).toBeNull()
    expect(docSummary({ id: 'x', dpi: 60, dimensions: { trimWidthMm: 1, trimHeightMm: 1 }, props: { invId: '2' } })).toBeNull()
  })
})

describe('buildControlTable — the join', () => {
  it('emits exactly one row per registry-bearing wall, sorted by invId', () => {
    const walls = [wall(3), wall(1), wall(2), glassWall('glass-0')]
    const rows = buildControlTable(walls, [])
    expect(rows.map((r) => r.invId)).toEqual([1, 2, 3])
    expect(rows.length).toBe(3) // glass excluded
  })

  it('joins a print to its wall and exposes dpi + dimensions in metres', () => {
    const rows = buildControlTable([wall(2)], [doc('hero-solar', 2, 60, 6000, 2200)])
    const r = rows[0]
    expect(r.built).toBe(true)
    expect(r.printId).toBe('hero-solar')
    expect(r.dpi).toBe(60)
    expect(r.widthM).toBeCloseTo(6, 9)
    expect(r.heightM).toBeCloseTo(2.2, 9)
    expect(dimensionsLabel(r)).toBe('6.0 × 2.2')
  })

  it('marks an unmatched wall unbuilt and never fabricates a size/dpi (honesty)', () => {
    const rows = buildControlTable([wall(7)], [])
    const r = rows[0]
    expect(r.built).toBe(false)
    expect(r.printId).toBeNull()
    expect(r.dpi).toBeNull()
    expect(r.widthM).toBeNull()
    expect(r.heightM).toBeNull()
    expect(dimensionsLabel(r)).toBe('—')
  })

  it('carries through registry fields with Spanish labels + research y/n', () => {
    const rows = buildControlTable([wall(11, { sala: 'S3', track: 'C', research: true, estado: 'ok' })], [])
    const r = rows[0]
    expect(r.sala).toBe('S3')
    expect(r.estado).toBe('ok')
    expect(r.estadoText).toBe('Listo')
    expect(r.track).toBe('C')
    expect(r.trackText).toBe('Código')
    expect(r.research).toBe(true)
    expect(r.researchText).toBe('sí')
  })

  it('aggregates multiple prints on one wall (zoned), deterministically by id', () => {
    const rows = buildControlTable([wall(4)], [doc('z-b', 4), doc('z-a', 4)])
    const r = rows[0]
    expect(r.prints.map((p) => p.id)).toEqual(['z-a', 'z-b']) // sorted
    expect(r.printId).toBe('z-a, z-b')
    expect(r.dpi).toBe(r.prints[0].dpi) // representative = first
  })

  it('reports wall geometry (run length + height) for every wall', () => {
    const rows = buildControlTable([wall(2, { length: 22.5, height: 2.5 })], [])
    expect(rows[0].wallLengthM).toBe(22.5)
    expect(rows[0].wallHeightM).toBe(2.5)
    expect(rows[0].hasExplicitHeight).toBe(false)
  })
})

describe('orphanPrintDocs', () => {
  it('finds prints whose invId no wall claims', () => {
    const orphans = orphanPrintDocs([wall(2)], [doc('hero-solar', 2), doc('ghost', 99)])
    expect(orphans.map((o) => o.id)).toEqual(['ghost'])
  })

  it('is empty when every print matches a wall', () => {
    expect(orphanPrintDocs([wall(2), wall(8)], [doc('a', 2), doc('b', 8)])).toEqual([])
  })
})

describe('controlTableSummary', () => {
  it('partitions built/pending and tallies estados to the total', () => {
    const rows = buildControlTable(
      [
        wall(1, { estado: 'ok', research: false }),
        wall(2, { estado: 'prop', research: true }),
        wall(3, { estado: 'pend', research: false }),
        wall(8, { estado: 'prop', research: true }),
      ],
      [doc('a', 1), doc('b', 2)],
    )
    const s = controlTableSummary(rows)
    expect(s.total).toBe(4)
    expect(s.built).toBe(2)
    expect(s.pending).toBe(2)
    expect(s.built + s.pending).toBe(s.total)
    expect(s.byEstado.ok + s.byEstado.prop + s.byEstado.pend).toBe(s.total)
    expect(s.byEstado).toEqual({ ok: 1, prop: 2, pend: 1 })
    expect(s.research).toBe(2)
    expect(s.researchBuilt).toBe(1) // wall 2 built+data; wall 8 data but unbuilt
  })

  it('summaryLine reflects the counts', () => {
    const rows = buildControlTable([wall(2, { estado: 'ok' })], [doc('a', 2)])
    expect(summaryLine(controlTableSummary(rows))).toContain('1/1 impresas')
  })
})

describe('formatMetres / formatters', () => {
  it('formats metres to one decimal by default', () => {
    expect(formatMetres(6)).toBe('6.0')
    expect(formatMetres(2.2)).toBe('2.2')
    expect(formatMetres(22.5)).toBe('22.5')
    expect(formatMetres(8.499, 3)).toBe('8.499')
  })

  it('markdown has a header, a separator, and one row per wall', () => {
    const rows = buildControlTable([wall(1), wall(2)], [doc('a', 2)])
    const md = formatControlTableMarkdown(rows)
    const lines = md.split('\n')
    expect(lines[0]).toContain('inv')
    expect(lines[0]).toContain('dim. impresión (m)')
    expect(lines[1].startsWith('| ---')).toBe(true)
    expect(lines.length).toBe(2 + rows.length)
    // Every data row has the same column count as the header.
    const cols = mdCols(lines[0])
    for (const l of lines) expect(mdCols(l)).toBe(cols)
  })

  it('markdown escapes pipes in the theme so the table never breaks', () => {
    const rows = buildControlTable([wall(2, { tema: 'a | b | c' })], [])
    const md = formatControlTableMarkdown(rows)
    const lines = md.split('\n')
    const dataRow = lines[2]
    expect(dataRow).toContain('a \\| b \\| c')
    // Escaped pipes are not column delimiters → the row still has header arity.
    expect(mdCols(dataRow)).toBe(mdCols(lines[0]))
  })

  it('csv has a header + one row per wall and quotes commas', () => {
    const rows = buildControlTable([wall(2, { sala: 'S1, S3' })], [doc('a', 2)])
    const csv = formatControlTableCsv(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('invId,code,sala,tema,estado,track,research,built,printId,dpi,widthM,heightM,wallLengthM,wallHeightM')
    expect(lines.length).toBe(1 + rows.length)
    expect(lines[1]).toContain('"S1, S3"') // comma-bearing field quoted
  })
})

// ── Real committed data ─────────────────────────────────────────────────────
const PRINTS_DIR = fileURLToPath(new URL('../../../public/prints', import.meta.url))

function loadRealDocs(): DocSummary[] {
  const out: DocSummary[] = []
  for (const entry of readdirSync(PRINTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    let parsed: PrintDoc
    try {
      parsed = JSON.parse(readFileSync(`${PRINTS_DIR}/${entry.name}/doc.json`, 'utf8')) as PrintDoc
    } catch {
      continue // a print folder without a doc.json (e.g. assets-only) is fine
    }
    const s = docSummary(parsed)
    if (s) out.push(s)
  }
  return out
}

describe('control table — real committed data', () => {
  const docs = loadRealDocs()
  const rows = buildControlTable(REGISTERED_WALLS, docs)

  it('has one row per registered wall (all 25), invId-ordered', () => {
    expect(rows.length).toBe(REGISTERED_WALLS.length)
    expect(rows.length).toBe(25)
    const invIds = rows.map((r) => r.invId)
    expect([...invIds].sort((a, b) => a - b)).toEqual(invIds)
    expect(new Set(invIds).size).toBe(25) // unique
    // #17 is retired; the new combustión backdrop wall is invId 26.
    expect(invIds).toContain(26)
    expect(invIds).not.toContain(17)
  })

  it('has no orphan prints — every authored wall print maps to a real wall', () => {
    expect(orphanPrintDocs(REGISTERED_WALLS, docs)).toEqual([])
  })

  it('the authored code-track pages are present, built, with their declared dpi/size', () => {
    // The authored pages that ship in the committed data (each doc.props.invId →
    // its wall). The earlier Phase 4/5 standalone pages (umbral, model-sizes,
    // wayfinding, aceleración, micro-acento, código) were migrated into the
    // marco-* fill workflow; the surviving authored hero page is hero-solar on
    // wall 2. inv26 (the new combustión backdrop) carries no authored page.
    const expected: Record<number, { id: string; dpi: number; w: number; h: number }> = {
      2: { id: 'hero-solar', dpi: 60, w: 6, h: 2.2 },
    }
    for (const [invId, exp] of Object.entries(expected)) {
      const r = rows.find((x) => x.invId === Number(invId))
      expect(r, `wall ${invId} row`).toBeDefined()
      expect(r!.built).toBe(true)
      expect(r!.printId).toContain(exp.id)
      expect(r!.dpi).toBe(exp.dpi)
      expect(r!.widthM).toBeCloseTo(exp.w, 6)
      expect(r!.heightM).toBeCloseTo(exp.h, 6)
    }
  })

  it('every built row carries a positive dpi and finished size; every unbuilt row is honestly blank', () => {
    for (const r of rows) {
      if (r.built) {
        expect(r.dpi).toBeGreaterThan(0)
        expect(r.widthM!).toBeGreaterThan(0)
        expect(r.heightM!).toBeGreaterThan(0)
        // The print must physically fit the wall it hangs on (eye-band piece).
        expect(r.widthM!).toBeLessThanOrEqual(r.wallLengthM + 1e-9)
        expect(r.heightM!).toBeLessThanOrEqual(r.wallHeightM + 1e-9)
      } else {
        expect(r.dpi).toBeNull()
        expect(r.widthM).toBeNull()
        expect(r.heightM).toBeNull()
      }
    }
  })

  it('every row reports a real (positive) wall run length and height', () => {
    for (const r of rows) {
      expect(r.wallLengthM).toBeGreaterThan(0)
      // Most walls sit on the ≥2.5 m fallback, but the S3 nave dividers (12, 16)
      // carry an explicit alturaM of 2 m, so the floor here is just "positive".
      expect(r.wallHeightM).toBeGreaterThan(0)
    }
  })

  it('the summary is consistent with the rows and reflects current progress', () => {
    const s = controlTableSummary(rows)
    expect(s.total).toBe(25)
    expect(s.built + s.pending).toBe(25)
    expect(s.byEstado.ok + s.byEstado.prop + s.byEstado.pend).toBe(25)
    // At least the hero page is authored (hero-solar on wall 2). Most walls are now
    // filled through the marco-* workflow; a new authored page only raises this.
    expect(s.built).toBeGreaterThanOrEqual(1)
    // Every built data wall must have its figures (the research:true + built set).
    expect(s.researchBuilt).toBeLessThanOrEqual(s.research)
  })

  it('renders a Markdown deliverable with a row per wall and no broken columns', () => {
    const md = formatControlTableMarkdown(rows)
    const lines = md.split('\n')
    expect(lines.length).toBe(2 + 25)
    const cols = mdCols(lines[0])
    for (const l of lines) expect(mdCols(l)).toBe(cols)
    // The required columns are present.
    for (const h of ['inv', 'sala', 'estado', 'dpi', 'dim. impresión (m)', 'research']) {
      expect(lines[0]).toContain(h)
    }
    // Each wall's invId appears as the first cell of its row.
    for (const r of rows) {
      const row = lines.find((l) => l.startsWith(`| ${r.invId} |`))
      expect(row, `row for inv ${r.invId}`).toBeDefined()
    }
  })

  it('renders a CSV deliverable parseable to one record per wall', () => {
    const csv = formatControlTableCsv(rows)
    const lines = csv.split('\n')
    expect(lines.length).toBe(1 + 25)
    expect(lines[0].split(',')[0]).toBe('invId')
  })

  it('markdown + csv are deterministic (stable deliverable across runs)', () => {
    expect(formatControlTableMarkdown(rows)).toBe(formatControlTableMarkdown(buildControlTable(REGISTERED_WALLS, loadRealDocs())))
    expect(formatControlTableCsv(rows)).toBe(formatControlTableCsv(buildControlTable(REGISTERED_WALLS, loadRealDocs())))
  })
})
