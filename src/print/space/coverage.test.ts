/**
 * Unit tests for the Phase 6 **coverage & spoiler lint** deliverable
 * (`coverage.ts`). Two halves:
 *
 *   • **Pure logic** on synthetic walls — the room parser, the contiguity test, the
 *     blank-wall reasons, and (crucially) proof that each spoiler rule *bites*: a
 *     code typographic page in S1, a non-adjacent funnel jump, and an unknown room
 *     are all flagged, while the documented double-sided / junction exceptions and a
 *     legitimate adjacent transition are not.
 *   • **The real committed registry** (`REGISTERED_WALLS`) — every one of the 25
 *     walls is covered, the funnel is fully walked, and the venue trips zero spoiler
 *     warnings; plus a drift guard tying the double-sided set to `doublesided.ts`.
 *
 * The synthetic cases are deliberately adversarial (they *expect* violations) so the
 * lint can't pass by being a no-op; the real-data cases assert the venue is clean.
 */

import { describe, expect, it } from 'vitest'
import { REGISTERED_WALLS, type WallRegistry } from './eventLayout'
import { DOUBLE_SIDED_INV_IDS as DS_FROM_DOUBLESIDED } from './doublesided'
import {
  DOUBLE_SIDED_INV_IDS,
  FUNNEL_ORDER,
  JUNCTION_INV_IDS,
  assertNoBlankWalls,
  blankWalls,
  buildCoverage,
  coverageRow,
  coverageSummary,
  emptyRooms,
  formatCoverageCsv,
  formatCoverageMarkdown,
  funnelCoverage,
  isContiguousRun,
  parseRooms,
  roleLabel,
  roomIndex,
  spoilerRisks,
  summaryLine,
  type CoverageWall,
} from './coverage'

/** A complete, valid registry — override fields per test. */
function reg(over: Partial<WallRegistry> = {}): WallRegistry {
  return {
    invId: 99,
    sala: 'S3',
    tema: 'Tema de prueba',
    rol: 'Un rol descriptivo suficientemente largo',
    track: 'C',
    research: false,
    estado: 'prop',
    ...over,
  }
}

/** A coverage-wall wrapper from a registry override. */
function wall(over: Partial<WallRegistry> = {}, id = 'wall-x'): CoverageWall {
  return { id, registry: reg(over) }
}

// ───────────────────────────── roomIndex ─────────────────────────────

describe('roomIndex', () => {
  it('orders the rooms along the funnel walk', () => {
    expect(roomIndex('S1')).toBe(0)
    expect(roomIndex('S6')).toBe(5)
    expect(roomIndex('cóctel')).toBe(6)
    expect(roomIndex('S1')).toBeLessThan(roomIndex('S2'))
    expect(roomIndex('S6')).toBeLessThan(roomIndex('cóctel'))
  })

  it('returns -1 for an unknown room', () => {
    expect(roomIndex('S7')).toBe(-1)
    expect(roomIndex('lobby')).toBe(-1)
    expect(roomIndex('')).toBe(-1)
  })
})

// ───────────────────────────── parseRooms ─────────────────────────────

describe('parseRooms', () => {
  it('splits on both "/" and "→" separators', () => {
    expect(parseRooms('S1/S3').rooms).toEqual(['S1', 'S3'])
    expect(parseRooms('S1→S2').rooms).toEqual(['S1', 'S2'])
    expect(parseRooms('S2/S6/cóctel').rooms).toEqual(['S2', 'S6', 'cóctel'])
  })

  it('preserves appearance order and de-duplicates', () => {
    expect(parseRooms('S3/S3').rooms).toEqual(['S3'])
    expect(parseRooms('S5/S6/S5').rooms).toEqual(['S5', 'S6'])
  })

  it('is accent- and spelling-tolerant for the cocktail close', () => {
    expect(parseRooms('cóctel').rooms).toEqual(['cóctel'])
    expect(parseRooms('coctel').rooms).toEqual(['cóctel'])
    expect(parseRooms('Cocktail').rooms).toEqual(['cóctel'])
  })

  it('tolerates whitespace and lower-case "s" in room codes', () => {
    expect(parseRooms(' s1 / s 2 ').rooms).toEqual(['S1', 'S2'])
  })

  it('surfaces unresolvable tokens instead of silently dropping them', () => {
    const { rooms, unknown } = parseRooms('S2/lobby')
    expect(rooms).toEqual(['S2'])
    expect(unknown).toEqual(['lobby'])
  })

  it('skips empty tokens (trailing separators)', () => {
    expect(parseRooms('S3/').rooms).toEqual(['S3'])
    expect(parseRooms('').rooms).toEqual([])
  })
})

// ─────────────────────────── isContiguousRun ───────────────────────────

describe('isContiguousRun', () => {
  it('is true for a single room', () => {
    expect(isContiguousRun(['S3'])).toBe(true)
  })

  it('is true for adjacent rooms (a transition) in either order', () => {
    expect(isContiguousRun(['S5', 'S6'])).toBe(true)
    expect(isContiguousRun(['S6', 'S5'])).toBe(true)
    expect(isContiguousRun(['S1', 'S2', 'S3'])).toBe(true)
    expect(isContiguousRun(['S6', 'cóctel'])).toBe(true)
  })

  it('is false for a non-adjacent span (a funnel jump)', () => {
    expect(isContiguousRun(['S1', 'S3'])).toBe(false)
    expect(isContiguousRun(['S2', 'S6', 'cóctel'])).toBe(false)
    expect(isContiguousRun(['S2', 'S4'])).toBe(false)
  })

  it('is false for an empty set', () => {
    expect(isContiguousRun([])).toBe(false)
  })
})

// ───────────────────────── coverageRow: coverage ─────────────────────────

describe('coverageRow — blank-wall detection', () => {
  it('marks a fully-specified wall as covered', () => {
    const row = coverageRow(wall())
    expect(row.covered).toBe(true)
    expect(row.blankReasons).toEqual([])
  })

  it('flags an empty tema', () => {
    const row = coverageRow(wall({ tema: '   ' }))
    expect(row.covered).toBe(false)
    expect(row.blankReasons).toContain('tema vacío')
  })

  it('flags an empty rol', () => {
    const row = coverageRow(wall({ rol: '' }))
    expect(row.covered).toBe(false)
    expect(row.blankReasons).toContain('rol vacío')
  })

  it('flags the undecided C/I track', () => {
    const row = coverageRow(wall({ track: 'C/I' }))
    expect(row.covered).toBe(false)
    expect(row.blankReasons.some((r) => r.includes('C/I'))).toBe(true)
  })

  it('flags the "(sin anotar)" placeholder', () => {
    const row = coverageRow(wall({ tema: 'Pieza (sin anotar)' }))
    expect(row.covered).toBe(false)
    expect(row.blankReasons.some((r) => r.includes('sin anotar'))).toBe(true)
  })

  it('does NOT treat an open sub-decision ("tagline TBD") as blank', () => {
    const row = coverageRow(wall({ estado: 'ok', rol: 'Light-box aprobado; tagline TBD' }))
    expect(row.covered).toBe(true)
    expect(row.blankReasons).toEqual([])
  })

  it('throws when asked to row a wall with no registry', () => {
    expect(() => coverageRow({ id: 'glass-0' })).toThrow(/no registry/)
  })
})

// ────────────────── coverageRow: funnel classification ──────────────────

describe('coverageRow — funnel position', () => {
  it('resolves first/last room across a span', () => {
    const row = coverageRow(wall({ sala: 'S1/S3' }))
    expect(row.firstRoom).toBe('S1')
    expect(row.lastRoom).toBe('S3')
  })

  it('classifies an adjacent multi-room wall as a transition', () => {
    const row = coverageRow(wall({ sala: 'S5/S6' }))
    expect(row.isTransition).toBe(true)
    expect(roleLabel(row)).toBe('transición')
  })

  it('classifies a single-room wall as "sala única" (not a transition)', () => {
    const row = coverageRow(wall({ sala: 'S3' }))
    expect(row.isTransition).toBe(false)
    expect(roleLabel(row)).toBe('sala única')
  })

  it('marks the designated double-sided ids and labels them', () => {
    const row = coverageRow(wall({ invId: 2, sala: 'S1/S3' }))
    expect(row.isDoubleSided).toBe(true)
    expect(roleLabel(row)).toBe('doble cara')
  })

  it('marks the designated junction ids and labels them', () => {
    const row = coverageRow(wall({ invId: 19, sala: 'S2/S6/cóctel', track: 'H' }))
    expect(row.isJunction).toBe(true)
    expect(roleLabel(row)).toBe('cruce')
  })
})

// ───────────────── coverageRow: spoiler lint (must bite) ─────────────────

describe('coverageRow — spoiler lint bites the violations', () => {
  it('flags a code typographic page purely inside the textless S1', () => {
    const row = coverageRow(wall({ invId: 1, sala: 'S1', track: 'C' }))
    expect(row.verdict).toBe('warn')
    expect(row.concerns.some((c) => c.includes('S1 sin texto'))).toBe(true)
  })

  it('does NOT flag an image piece in S1 (textless honoured)', () => {
    const row = coverageRow(wall({ invId: 1, sala: 'S1', track: 'I' }))
    expect(row.verdict).toBe('ok')
  })

  it('does NOT flag the S1→S2 wayfinding transition (text orients to the next zone)', () => {
    const row = coverageRow(wall({ invId: 10, sala: 'S1→S2', track: 'C' }))
    expect(row.verdict).toBe('ok')
    expect(row.isTransition).toBe(true)
  })

  it('flags a non-adjacent funnel jump (a later room\'s payoff brought forward)', () => {
    const row = coverageRow(wall({ invId: 50, sala: 'S2/S5', track: 'I' }))
    expect(row.verdict).toBe('warn')
    expect(row.concerns.some((c) => c.includes('salto del recorrido'))).toBe(true)
  })

  it('does NOT flag a non-adjacent span on a double-sided wall (faces seen separately)', () => {
    const row = coverageRow(wall({ invId: 2, sala: 'S1/S3', track: 'H' }))
    expect(row.verdict).toBe('ok')
  })

  it('does NOT flag a non-adjacent span on the documented junction wall', () => {
    const row = coverageRow(wall({ invId: 19, sala: 'S2/S6/cóctel', track: 'H' }))
    expect(row.verdict).toBe('ok')
  })

  it('flags an unknown room token', () => {
    const row = coverageRow(wall({ invId: 51, sala: 'S3/almacén', track: 'I' }))
    expect(row.verdict).toBe('warn')
    expect(row.concerns.some((c) => c.includes('zona desconocida'))).toBe(true)
  })
})

// ─────────────────────────── buildCoverage ───────────────────────────

describe('buildCoverage', () => {
  it('skips walls with no registry (glass) and sorts by invId', () => {
    const walls: CoverageWall[] = [
      wall({ invId: 5 }, 'wall-a'),
      { id: 'glass-0' },
      wall({ invId: 1 }, 'wall-b'),
      wall({ invId: 3 }, 'wall-c'),
    ]
    const rows = buildCoverage(walls)
    expect(rows.map((r) => r.invId)).toEqual([1, 3, 5])
  })

  it('is deterministic', () => {
    const walls: CoverageWall[] = [wall({ invId: 2 }), wall({ invId: 1 })]
    expect(JSON.stringify(buildCoverage(walls))).toBe(JSON.stringify(buildCoverage(walls)))
  })
})

// ────────────────────── blank-wall guard ──────────────────────

describe('blankWalls / assertNoBlankWalls', () => {
  it('collects the blank walls', () => {
    const rows = buildCoverage([wall({ invId: 1 }), wall({ invId: 2, tema: '' })])
    expect(blankWalls(rows).map((r) => r.invId)).toEqual([2])
  })

  it('does not throw when every wall is covered', () => {
    const rows = buildCoverage([wall({ invId: 1 }), wall({ invId: 2 })])
    expect(() => assertNoBlankWalls(rows)).not.toThrow()
  })

  it('throws naming the offender and its reason', () => {
    const rows = buildCoverage([wall({ invId: 7, track: 'C/I' })])
    expect(() => assertNoBlankWalls(rows)).toThrow(/#7/)
    expect(() => assertNoBlankWalls(rows)).toThrow(/C\/I/)
  })
})

// ────────────────────── funnel coverage ──────────────────────

describe('funnelCoverage / emptyRooms', () => {
  it('maps each room to the (sorted) walls that touch it', () => {
    const rows = buildCoverage([
      wall({ invId: 3, sala: 'S5/S6' }),
      wall({ invId: 1, sala: 'S5' }),
    ])
    const cov = funnelCoverage(rows)
    expect(cov.S5).toEqual([1, 3])
    expect(cov.S6).toEqual([3])
  })

  it('reports rooms with no wall', () => {
    const rows = buildCoverage([wall({ invId: 1, sala: 'S3' })])
    const empty = emptyRooms(rows)
    expect(empty).toContain('S1')
    expect(empty).not.toContain('S3')
  })
})

// ───────────────────────── spoilerRisks / summary ─────────────────────────

describe('spoilerRisks & summary', () => {
  it('collects only the flagged walls', () => {
    const rows = buildCoverage([
      wall({ invId: 1, sala: 'S1', track: 'I' }), // ok
      wall({ invId: 50, sala: 'S2/S5', track: 'I' }), // jump → warn
    ])
    expect(spoilerRisks(rows).map((r) => r.invId)).toEqual([50])
  })

  it('partitions the summary correctly (covered + blank = total)', () => {
    const rows = buildCoverage([
      wall({ invId: 1, sala: 'S5/S6', estado: 'ok' }), // transition, covered
      wall({ invId: 2, sala: 'S3', estado: 'prop', tema: '' }), // blank
      wall({ invId: 3, sala: 'S2/S5', estado: 'pend', track: 'I' }), // jump → warn, covered
    ])
    const s = coverageSummary(rows)
    expect(s.total).toBe(3)
    expect(s.covered + s.blank).toBe(s.total)
    expect(s.blank).toBe(1)
    expect(s.transitions).toBe(1)
    expect(s.warnings).toBe(1)
    expect(s.byEstado.ok + s.byEstado.prop + s.byEstado.pend).toBe(s.total)
  })

  it('summaryLine reports the funnel state', () => {
    const complete = buildCoverage(FUNNEL_ORDER.map((room, i) => wall({ invId: i + 1, sala: room })))
    expect(summaryLine(coverageSummary(complete))).toContain('funnel completo')
    const sparse = buildCoverage([wall({ invId: 1, sala: 'S3' })])
    expect(summaryLine(coverageSummary(sparse))).toContain('salas sin muro')
  })
})

// ───────────────────────── formatters ─────────────────────────

/** Split a Markdown row on UNESCAPED pipes (escaped `\|` stays inside a cell). */
const mdCols = (line: string) => line.split(/(?<!\\)\|/)

describe('formatCoverageMarkdown', () => {
  const rows = buildCoverage([
    wall({ invId: 1, sala: 'S1', track: 'I' }),
    wall({ invId: 50, sala: 'S2/S5', track: 'I' }), // → warn
  ])
  const md = formatCoverageMarkdown(rows)
  const lines = md.split('\n')

  it('emits a header, a separator and one row per wall', () => {
    expect(lines.length).toBe(2 + rows.length)
  })

  it('every body row has the same column count as the header', () => {
    const headerCols = mdCols(lines[0]).length
    for (const line of lines.slice(2)) {
      expect(mdCols(line).length).toBe(headerCols)
    }
  })

  it('renders ✓ for an ok verdict and ⚠ + concern for a warn', () => {
    expect(md).toContain('✓')
    expect(md).toContain('⚠')
    expect(md).toContain('salto del recorrido')
  })

  it('escapes a pipe in the theme so the row keeps its column count', () => {
    const piped = formatCoverageMarkdown(buildCoverage([wall({ invId: 1, tema: 'a|b' })]))
    const body = piped.split('\n')[2]
    expect(body).toContain('a\\|b')
    expect(mdCols(body).length).toBe(mdCols(piped.split('\n')[0]).length)
  })
})

describe('formatCoverageCsv', () => {
  const rows = buildCoverage([wall({ invId: 1, sala: 'S5/S6' }), wall({ invId: 50, sala: 'S2/S5', track: 'I' })])
  const csv = formatCoverageCsv(rows)
  const lines = csv.split('\n')

  it('emits a header + one row per wall, all with the same arity', () => {
    expect(lines.length).toBe(1 + rows.length)
    const cols = lines[0].split(',').length
    for (const line of lines.slice(1)) expect(line.split(',').length).toBe(cols)
  })

  it('quotes a field containing a comma (RFC-4180)', () => {
    const withComma = formatCoverageCsv(buildCoverage([wall({ invId: 1, tema: 'uno, dos' })]))
    expect(withComma).toContain('"uno, dos"')
  })
})

// ─────────────────────── drift guard ───────────────────────

describe('drift guard', () => {
  it('the double-sided set matches the canonical one in doublesided.ts', () => {
    expect([...DOUBLE_SIDED_INV_IDS]).toEqual([...DS_FROM_DOUBLESIDED])
  })
})

// ═══════════════════ the real committed registry ═══════════════════

describe('the real venue — REGISTERED_WALLS', () => {
  const rows = buildCoverage(REGISTERED_WALLS)

  it('has exactly the 31 event walls (cube 22-25 removed; 27-36 added)', () => {
    expect(rows.length).toBe(31)
    expect(rows.map((r) => r.invId)).toEqual([...Array.from({ length: 16 }, (_, i) => i + 1), 18, 19, 20, 21, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36])
  })

  it('NO blank walls — all 31 carry a decided piece', () => {
    const blank = blankWalls(rows)
    expect(blank.map((r) => r.invId)).toEqual([])
    expect(() => assertNoBlankWalls(rows)).not.toThrow()
    expect(coverageSummary(rows).covered).toBe(31)
  })

  it('every wall has resolvable rooms (no typo in any sala)', () => {
    for (const r of rows) {
      expect(r.unknownRooms, `#${r.invId} sala "${r.sala}"`).toEqual([])
      expect(r.rooms.length).toBeGreaterThan(0)
    }
  })

  it('trips ZERO spoiler warnings (S1 textless + no funnel jump honoured)', () => {
    const risks = spoilerRisks(rows)
    expect(risks.map((r) => `#${r.invId}: ${r.concerns.join('; ')}`)).toEqual([])
  })

  it('the funnel is fully walked — every room has at least one wall', () => {
    expect(emptyRooms(rows)).toEqual([])
    const cov = funnelCoverage(rows)
    for (const room of FUNNEL_ORDER) {
      expect(cov[room].length, `room ${room}`).toBeGreaterThan(0)
    }
  })

  it('the S1 sensory rooms are textless (no single-room S1 code page)', () => {
    const s1Only = rows.filter((r) => r.rooms.length === 1 && r.rooms[0] === 'S1')
    expect(s1Only.map((r) => r.invId)).toEqual([1, 9, 18, 26])
    for (const r of s1Only) expect(r.track, `#${r.invId}`).not.toBe('C')
  })

  it('classifies the designated double-sided walls 2 & 12', () => {
    const ds = rows.filter((r) => r.isDoubleSided).map((r) => r.invId)
    expect(ds).toEqual([...DOUBLE_SIDED_INV_IDS].sort((a, b) => a - b))
  })

  it('classifies the documented junction wall 19', () => {
    const j = rows.filter((r) => r.isJunction).map((r) => r.invId)
    expect(j).toEqual([...JUNCTION_INV_IDS])
    const w19 = rows.find((r) => r.invId === 19)!
    expect(w19.rooms).toEqual(['S2', 'S6', 'cóctel'])
  })

  it('only wall 19 reaches the cóctel close (the brief: "only 1 of ~4 is real")', () => {
    expect(funnelCoverage(rows)['cóctel']).toEqual([19])
  })

  it('renders the deliverable Markdown + CSV with consistent arity', () => {
    const md = formatCoverageMarkdown(rows).split('\n')
    const headerCols = mdCols(md[0]).length
    expect(md.length).toBe(2 + 31)
    for (const line of md.slice(2)) expect(mdCols(line).length).toBe(headerCols)

    const csv = formatCoverageCsv(rows).split('\n')
    expect(csv.length).toBe(1 + 31)
    const csvCols = csv[0].split(',').length
    for (const line of csv.slice(1)) expect(line.split(',').length).toBeGreaterThanOrEqual(csvCols)
  })

  it('summarises as covered + funnel complete', () => {
    const line = summaryLine(coverageSummary(rows))
    expect(line).toContain('31/31 cubiertos')
    expect(line).toContain('0 en blanco')
    expect(line).toContain('funnel completo')
  })
})
