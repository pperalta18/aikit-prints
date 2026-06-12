import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  DEFAULT_READING_DISTANCE_M,
  EYE_BAND_CENTER_M,
  EYE_BAND_MAX_M,
  EYE_BAND_MIN_M,
  ROOM_READING_DISTANCE_M,
  WALL_EDGE_MARGIN_M,
  buildLegibilityTable,
  capHeightCmFromFontPt,
  capStandard,
  eyeBandCenterY,
  eyeBandFit,
  formatLegibilityCsv,
  formatLegibilityMarkdown,
  isLegibilityCoherent,
  isLegibleCm,
  legibilityIssues,
  legibilitySummary,
  printLegibility,
  roomCoherence,
  salaReadingDistanceM,
  salaRooms,
  summaryLine,
  type LegibilityPrint,
  type LegibilityRow,
  type LegibilityWall,
} from './legibility'

// Drift guards — the originals these primitives mirror (vitest resolves the bare
// `'../geometry'` import that the raw-node `.mjs` loader can't, so we can import them).
import {
  EYE_BAND_CENTER_M as HERO_EYE_BAND_CENTER_M,
  EYE_BAND_MAX_M as HERO_EYE_BAND_MAX_M,
  EYE_BAND_MIN_M as HERO_EYE_BAND_MIN_M,
  WALL_EDGE_MARGIN_M as HERO_WALL_EDGE_MARGIN_M,
  eyeBandCenterY as heroEyeBandCenterY,
} from './heroPlacement'
import {
  fontPtToCapHeightMm,
  isLegibleAtDistance,
  minCapHeightMm,
  minFontPtForDistance,
} from '../pages/wayfinding'

import { REGISTERED_WALLS } from './eventLayout'
import { wayfindingTypeScale } from '../pages/wayfinding'
import { umbralTypeScale } from '../pages/umbral'
import { microAcentoTypeScale, wrapPhrase } from '../pages/micro-acento'

/**
 * Museographic legibility pass (Phase 6) — unit tests
 * ───────────────────────────────────────────────────
 * Unbiased coverage of the pure audit core in `legibility.ts`: the museographic
 * primitives (re-stated → guarded against drift), the per-room reading-distance
 * policy, the cap-height floor, the eye-band fit, the row/verdict join, the
 * summary/coherence helpers, the Markdown/CSV formatters, and — feeding it the
 * **real committed data** — that all 24 walls audit honestly, every authored print
 * fits its wall, and the typographic pages' real titular caps clear the documented
 * floor (the "document the real cm sizes" guarantee with teeth).
 */

/* ── fixtures ─────────────────────────────────────────────────────────────────── */

function wall(partial: Partial<LegibilityWall> & { id: string; registry?: LegibilityWall['registry'] }): LegibilityWall {
  return {
    length: 6,
    height: 2.5,
    hasExplicitHeight: false,
    ...partial,
  }
}

function reg(invId: number, over: Partial<NonNullable<LegibilityWall['registry']>> = {}) {
  return {
    invId,
    sala: 'S3',
    tema: `tema ${invId}`,
    rol: 'rol',
    track: 'C' as const,
    research: false,
    estado: 'prop' as const,
    ...over,
  }
}

function print(partial: Partial<LegibilityPrint> & { id: string; invId: number }): LegibilityPrint {
  return {
    trimWidthMm: 6000,
    trimHeightMm: 1800,
    bleedMm: 10,
    declaredReadingDistanceM: null,
    ...partial,
  }
}

/* ── museographic primitive drift guards ──────────────────────────────────────── */

describe('legibility — museographic primitives mirror wayfinding.ts (no drift)', () => {
  const distances = [3, 4, 5, 6, 2.5, 7.3]

  it('cap-height floor matches wayfinding.minCapHeightMm', () => {
    for (const d of distances) {
      expect(capStandard(d, 'sala').minCapHeightMm).toBeCloseTo(minCapHeightMm(d), 9)
    }
  })

  it('min font size matches wayfinding.minFontPtForDistance', () => {
    for (const d of distances) {
      expect(capStandard(d, 'sala').minFontPt).toBeCloseTo(minFontPtForDistance(d), 9)
    }
  })

  it('cap-height ⇄ font-size conversion matches wayfinding (inverse-consistent)', () => {
    for (const pt of [10, 100, 1633]) {
      expect(capHeightCmFromFontPt(pt) * 10).toBeCloseTo(fontPtToCapHeightMm(pt), 9)
    }
  })

  it('isLegibleCm matches wayfinding.isLegibleAtDistance', () => {
    for (const d of distances) {
      const floorCm = minCapHeightMm(d) / 10
      expect(isLegibleCm(floorCm, d)).toBe(isLegibleAtDistance(floorCm * 10, d))
      expect(isLegibleCm(floorCm * 0.5, d)).toBe(false)
      expect(isLegibleCm(floorCm * 2, d)).toBe(true)
    }
  })

  it('the 1 cm / 3 m rule lands on round numbers', () => {
    expect(capStandard(3, 'sala').minCapHeightCm).toBeCloseTo(1, 9)
    expect(capStandard(6, 'sala').minCapHeightCm).toBeCloseTo(2, 9)
    expect(capStandard(9, 'sala').minCapHeightCm).toBeCloseTo(3, 9)
  })
})

/* ── eye-band drift guard ─────────────────────────────────────────────────────── */

describe('legibility — eye-band maths mirrors heroPlacement (no drift)', () => {
  it('constants are identical to the heroPlacement originals', () => {
    expect(EYE_BAND_MIN_M).toBe(HERO_EYE_BAND_MIN_M)
    expect(EYE_BAND_MAX_M).toBe(HERO_EYE_BAND_MAX_M)
    expect(EYE_BAND_CENTER_M).toBe(HERO_EYE_BAND_CENTER_M)
    expect(WALL_EDGE_MARGIN_M).toBe(HERO_WALL_EDGE_MARGIN_M)
  })

  it('eyeBandCenterY agrees with heroPlacement across wall/print heights', () => {
    for (const wh of [2.2, 2.5, 3.0, 4.0]) {
      for (const ph of [0.8, 1.0, 1.82, 2.02, 2.22, 2.6]) {
        expect(eyeBandCenterY(wh, ph)).toBeCloseTo(heroEyeBandCenterY(wh, ph), 9)
      }
    }
  })
})

/* ── reading-distance policy ──────────────────────────────────────────────────── */

describe('legibility — sala reading-distance policy', () => {
  it('splits compound salas into room tokens', () => {
    expect(salaRooms('S2/S3')).toEqual(['S2', 'S3'])
    expect(salaRooms('S1→S2')).toEqual(['S1', 'S2'])
    expect(salaRooms('S2/S6/cóctel')).toEqual(['S2', 'S6', 'cóctel'])
    expect(salaRooms('S3')).toEqual(['S3'])
    expect(salaRooms('  S5 / S6 ')).toEqual(['S5', 'S6'])
  })

  it('takes the maximum (conservative) distance among a compound sala', () => {
    // S2 (4) vs S3 (5) → the larger 5 m, which demands a larger cap (safe from nearer too)
    expect(salaReadingDistanceM('S2/S3')).toBe(5)
    expect(salaReadingDistanceM('S1→S2')).toBe(4)
    expect(salaReadingDistanceM('S5/S6')).toBe(3)
    expect(salaReadingDistanceM('S4/S5')).toBe(Math.max(ROOM_READING_DISTANCE_M.S4, ROOM_READING_DISTANCE_M.S5))
  })

  it('resolves single rooms from the policy table', () => {
    expect(salaReadingDistanceM('S3')).toBe(ROOM_READING_DISTANCE_M.S3)
    expect(salaReadingDistanceM('S5')).toBe(ROOM_READING_DISTANCE_M.S5)
  })

  it('falls back to the default for an unrecognised sala', () => {
    expect(salaReadingDistanceM('Z9')).toBe(DEFAULT_READING_DISTANCE_M)
    expect(salaReadingDistanceM('')).toBe(DEFAULT_READING_DISTANCE_M)
  })

  it('the policy is coherent with the declared typographic reading distances', () => {
    // wayfinding S1→S2 = 4, umbral S2/S3 = 5, micro-acento S5/S6 = 3
    expect(salaReadingDistanceM('S1→S2')).toBe(4)
    expect(salaReadingDistanceM('S2/S3')).toBe(5)
    expect(salaReadingDistanceM('S5/S6')).toBe(3)
  })
})

/* ── capStandard ──────────────────────────────────────────────────────────────── */

describe('legibility — capStandard', () => {
  it('reports the floor in mm + cm and echoes the source', () => {
    const c = capStandard(6, 'doc')
    expect(c.readingDistanceM).toBe(6)
    expect(c.source).toBe('doc')
    expect(c.minCapHeightMm).toBeCloseTo(20, 9)
    expect(c.minCapHeightCm).toBeCloseTo(2, 9)
    expect(c.minCapHeightCm).toBeCloseTo(c.minCapHeightMm / 10, 9)
    expect(c.minFontPt).toBeGreaterThan(0)
  })
})

/* ── eyeBandFit ───────────────────────────────────────────────────────────────── */

describe('legibility — eyeBandFit', () => {
  it('centres a short print in the eye band and reports its edges', () => {
    const fit = eyeBandFit(2.5, 1.0)
    expect(fit.mountCenterM).toBeCloseTo(1.5, 9)
    expect(fit.bottomM).toBeCloseTo(1.0, 9)
    expect(fit.topM).toBeCloseTo(2.0, 9)
    expect(fit.inEyeBand).toBe(true)
    expect(fit.fitsWall).toBe(true)
    expect(fit.clampedByHeight).toBe(false)
  })

  it('honestly flags a tall print clamped below the band (still on the wall)', () => {
    // 2.22 m media on a 2.5 m wall → centre clamps to 1.35 m, below the 1.45 floor
    const fit = eyeBandFit(2.5, 2.22)
    expect(fit.mountCenterM).toBeLessThan(EYE_BAND_MIN_M)
    expect(fit.inEyeBand).toBe(false)
    expect(fit.clampedByHeight).toBe(true)
    expect(fit.fitsWall).toBe(true)
    expect(fit.bottomM).toBeGreaterThanOrEqual(-1e-9)
    expect(fit.topM).toBeLessThanOrEqual(2.5 + 1e-9)
  })

  it('flags a print taller than the wall as not fitting', () => {
    const fit = eyeBandFit(2.5, 2.6)
    expect(fit.fitsWall).toBe(false)
  })

  it('top/bottom straddle the centre by half the print height', () => {
    const fit = eyeBandFit(3.0, 1.4)
    expect(fit.topM - fit.mountCenterM).toBeCloseTo(0.7, 9)
    expect(fit.mountCenterM - fit.bottomM).toBeCloseTo(0.7, 9)
  })
})

/* ── printLegibility projection ───────────────────────────────────────────────── */

describe('legibility — printLegibility projection', () => {
  it('projects a well-formed wall-graphic doc', () => {
    const p = printLegibility({
      id: 'umbral',
      dimensions: { trimWidthMm: 7600, trimHeightMm: 1800, bleedMm: 10 },
      props: { invId: 3, readingDistanceM: 5 },
    })
    expect(p).toEqual({
      id: 'umbral',
      invId: 3,
      trimWidthMm: 7600,
      trimHeightMm: 1800,
      bleedMm: 10,
      declaredReadingDistanceM: 5,
    })
  })

  it('returns null without a numeric props.invId', () => {
    expect(printLegibility({ id: 'x', dimensions: { trimWidthMm: 100, trimHeightMm: 100, bleedMm: 0 }, props: {} })).toBeNull()
    expect(printLegibility({ id: 'x', dimensions: { trimWidthMm: 100, trimHeightMm: 100, bleedMm: 0 }, props: { invId: 'a' } })).toBeNull()
  })

  it('returns null on missing / non-positive dimensions', () => {
    expect(printLegibility({ id: 'x', dimensions: { trimWidthMm: 0, trimHeightMm: 100, bleedMm: 0 }, props: { invId: 1 } })).toBeNull()
    expect(printLegibility({ id: 'x', dimensions: null, props: { invId: 1 } })).toBeNull()
    expect(printLegibility({ id: '', dimensions: { trimWidthMm: 100, trimHeightMm: 100, bleedMm: 0 }, props: { invId: 1 } })).toBeNull()
  })

  it('defaults a missing/invalid bleed to 0 and treats a non-positive distance as undeclared', () => {
    const p = printLegibility({ id: 'x', dimensions: { trimWidthMm: 100, trimHeightMm: 100 }, props: { invId: 1, readingDistanceM: 0 } })
    expect(p?.bleedMm).toBe(0)
    expect(p?.declaredReadingDistanceM).toBeNull()
  })
})

/* ── buildLegibilityTable + verdicts ──────────────────────────────────────────── */

describe('legibility — buildLegibilityTable', () => {
  it('emits one row per registry wall, invId-sorted, skipping glass', () => {
    const walls = [
      wall({ id: 'wall-2', registry: reg(3) }),
      wall({ id: 'glass-0' }), // no registry → skipped
      wall({ id: 'wall-0', registry: reg(1) }),
    ]
    const rows = buildLegibilityTable(walls, [])
    expect(rows.map((r) => r.invId)).toEqual([1, 3])
    expect(rows.every((r) => r.code.startsWith('wall-'))).toBe(true)
  })

  it('an unbuilt wall still documents a cap floor (sala source), with no eye-band', () => {
    const rows = buildLegibilityTable([wall({ id: 'wall-0', registry: reg(1, { sala: 'S5' }) })], [])
    const r = rows[0]
    expect(r.built).toBe(false)
    expect(r.printId).toBeNull()
    expect(r.eyeBand).toBeNull()
    expect(r.verdict).toBe('unbuilt')
    expect(r.cap.source).toBe('sala')
    expect(r.cap.readingDistanceM).toBe(3) // S5
    expect(r.cap.minCapHeightCm).toBeCloseTo(1, 9)
  })

  it('a built, in-band print verdicts ok with no issues', () => {
    const walls = [wall({ id: 'wall-0', registry: reg(1, { sala: 'S3' }) })]
    const prints = [print({ id: 'p', invId: 1, trimHeightMm: 1780, bleedMm: 10, declaredReadingDistanceM: 5 })]
    const r = buildLegibilityTable(walls, prints)[0]
    expect(r.built).toBe(true)
    expect(r.cap.source).toBe('doc')
    expect(r.eyeBand?.inEyeBand).toBe(true)
    expect(r.verdict).toBe('ok')
    expect(r.issues).toEqual([])
  })

  it('a clamped-but-fitting print is ok with an explanatory note (not a failure)', () => {
    const walls = [wall({ id: 'wall-0', registry: reg(1) })]
    const prints = [print({ id: 'p', invId: 1, trimHeightMm: 2200, bleedMm: 10 })]
    const r = buildLegibilityTable(walls, prints)[0]
    expect(r.eyeBand?.clampedByHeight).toBe(true)
    expect(r.eyeBand?.fitsWall).toBe(true)
    expect(r.eyeBand?.inEyeBand).toBe(false)
    expect(r.verdict).toBe('ok')
    expect(r.issues.length).toBe(1)
    expect(r.issues[0]).toMatch(/bajo la banda/)
  })

  it('a print taller than the wall verdicts warn', () => {
    const walls = [wall({ id: 'wall-0', registry: reg(1), height: 2.5 })]
    const prints = [print({ id: 'p', invId: 1, trimHeightMm: 2600, bleedMm: 10 })]
    const r = buildLegibilityTable(walls, prints)[0]
    expect(r.eyeBand?.fitsWall).toBe(false)
    expect(r.verdict).toBe('warn')
    expect(r.issues.some((i) => /no cabe/.test(i))).toBe(true)
  })

  it('a doc distance that disagrees with the room policy verdicts warn (incoherent)', () => {
    const walls = [wall({ id: 'wall-0', registry: reg(1, { sala: 'S3' }) })]
    // S3 policy is 5 m; declaring 9 m is incoherent
    const prints = [print({ id: 'p', invId: 1, trimHeightMm: 1500, bleedMm: 10, declaredReadingDistanceM: 9 })]
    const r = buildLegibilityTable(walls, prints)[0]
    expect(r.verdict).toBe('warn')
    expect(r.issues.some((i) => /política de sala/.test(i))).toBe(true)
  })

  it('picks the first print by id (zoned walls) as the representative', () => {
    const walls = [wall({ id: 'wall-0', registry: reg(1) })]
    const prints = [
      print({ id: 'b-zone', invId: 1, trimHeightMm: 1780 }),
      print({ id: 'a-zone', invId: 1, trimHeightMm: 1780 }),
    ]
    const r = buildLegibilityTable(walls, prints)[0]
    expect(r.printId).toBe('a-zone')
  })
})

/* ── summary / issues / coherence ─────────────────────────────────────────────── */

describe('legibility — summary, issues & coherence', () => {
  const walls = [
    wall({ id: 'wall-0', registry: reg(1, { sala: 'S3' }) }), // unbuilt
    wall({ id: 'wall-1', registry: reg(2, { sala: 'S3' }) }), // in band
    wall({ id: 'wall-2', registry: reg(3, { sala: 'S3' }) }), // clamped
  ]
  const prints = [
    print({ id: 'inband', invId: 2, trimHeightMm: 1780, bleedMm: 10, declaredReadingDistanceM: 5 }),
    print({ id: 'tall', invId: 3, trimHeightMm: 2200, bleedMm: 10 }),
  ]
  const rows = buildLegibilityTable(walls, prints)

  it('summary partitions built / in-band / clamped / warnings', () => {
    const s = legibilitySummary(rows)
    expect(s.total).toBe(3)
    expect(s.built).toBe(2)
    expect(s.inEyeBand).toBe(1)
    expect(s.clamped).toBe(1)
    expect(s.warnings).toBe(0)
  })

  it('legibilityIssues returns only warn rows', () => {
    expect(legibilityIssues(rows)).toEqual([])
    const bad = buildLegibilityTable(
      [wall({ id: 'wall-0', registry: reg(1) })],
      [print({ id: 'p', invId: 1, trimHeightMm: 3000 })],
    )
    expect(legibilityIssues(bad)).toHaveLength(1)
  })

  it('roomCoherence groups by sala with one distance + cap floor each, sorted', () => {
    const coh = roomCoherence(rows)
    expect(coh).toHaveLength(1) // all three are S3
    expect(coh[0]).toMatchObject({ sala: 'S3', readingDistanceM: 5 })
    expect(coh[0].invIds).toEqual([1, 2, 3])
    expect(coh[0].minCapHeightCm).toBeCloseTo(minCapHeightMm(5) / 10, 9)
  })

  it('isLegibilityCoherent is true when distances match the policy and prints fit', () => {
    expect(isLegibilityCoherent(rows)).toBe(true)
  })

  it('isLegibilityCoherent is false when a print does not fit', () => {
    const bad = buildLegibilityTable(
      [wall({ id: 'wall-0', registry: reg(1) })],
      [print({ id: 'p', invId: 1, trimHeightMm: 3000 })],
    )
    expect(isLegibilityCoherent(bad)).toBe(false)
  })

  it('summaryLine reads as a one-liner', () => {
    expect(summaryLine(legibilitySummary(rows))).toBe('2/3 impresas · 1 en banda · 1 ajustada(s) · 0 aviso(s)')
  })
})

/* ── formatters ───────────────────────────────────────────────────────────────── */

describe('legibility — formatters', () => {
  const rows = buildLegibilityTable(
    [
      wall({ id: 'wall-0', registry: reg(1, { sala: 'S3' }) }),
      wall({ id: 'wall-1', registry: reg(2, { sala: 'S5' }) }),
    ],
    [print({ id: 'p', invId: 1, trimHeightMm: 1780, bleedMm: 10, declaredReadingDistanceM: 5 })],
  )

  const splitUnescaped = (line: string) => line.split(/(?<!\\)\|/)

  it('Markdown has a header, a separator and one row per wall with equal column counts', () => {
    const md = formatLegibilityMarkdown(rows)
    const lines = md.split('\n')
    expect(lines).toHaveLength(2 + rows.length)
    const cols = splitUnescaped(lines[0]).length
    for (const l of lines) expect(splitUnescaped(l).length).toBe(cols)
  })

  it('Markdown escapes pipes in notes (so the column count survives)', () => {
    const piped = buildLegibilityTable(
      [wall({ id: 'wall-0', registry: reg(1, { sala: 'S3' }) })],
      [print({ id: 'p', invId: 1, trimHeightMm: 1500, bleedMm: 0, declaredReadingDistanceM: 9 })],
    )
    // force a synthetic pipe into the notes to prove escaping
    piped[0].issues = ['a | b']
    const md = formatLegibilityMarkdown(piped)
    const headerCols = splitUnescaped(md.split('\n')[0]).length
    for (const l of md.split('\n')) expect(splitUnescaped(l).length).toBe(headerCols)
    expect(md).toContain('a \\| b')
  })

  it('CSV has a header + one row per wall, with quoted fields when needed', () => {
    const csv = formatLegibilityCsv(rows)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(1 + rows.length)
    const cols = lines[0].split(',').length
    // unbuilt row leaves the eye-band columns blank but keeps the arity
    expect(lines[2].split(',').length).toBe(cols)
  })

  it('CSV quotes an issue containing a comma', () => {
    const r = buildLegibilityTable([wall({ id: 'wall-0', registry: reg(1) })], [print({ id: 'p', invId: 1, trimHeightMm: 3000 })])
    r[0].issues = ['x, y']
    expect(formatLegibilityCsv(r)).toContain('"x, y"')
  })
})

/* ── determinism ──────────────────────────────────────────────────────────────── */

describe('legibility — determinism', () => {
  it('builds an identical table on repeated runs', () => {
    const walls = [
      wall({ id: 'wall-1', registry: reg(2, { sala: 'S3' }) }),
      wall({ id: 'wall-0', registry: reg(1, { sala: 'S5' }) }),
    ]
    const prints = [print({ id: 'p', invId: 2, trimHeightMm: 1780, declaredReadingDistanceM: 5 })]
    expect(JSON.stringify(buildLegibilityTable(walls, prints))).toBe(JSON.stringify(buildLegibilityTable(walls, prints)))
  })
})

/* ── the real committed venue + prints ────────────────────────────────────────── */

const HERE = dirname(fileURLToPath(import.meta.url))
const PRINTS_DIR = join(HERE, '../../../public/prints')

function loadRealPrints(): LegibilityPrint[] {
  const out: LegibilityPrint[] = []
  for (const entry of readdirSync(PRINTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    let doc: unknown
    try {
      doc = JSON.parse(readFileSync(join(PRINTS_DIR, entry.name, 'doc.json'), 'utf8'))
    } catch {
      continue
    }
    const p = printLegibility(doc as Parameters<typeof printLegibility>[0])
    if (p) out.push(p)
  }
  return out
}

describe('legibility — real venue audit (event-layout.json + public/prints)', () => {
  const walls = REGISTERED_WALLS as unknown as LegibilityWall[]
  const prints = loadRealPrints()
  const rows = buildLegibilityTable(walls, prints)
  const byInv = new Map<number, LegibilityRow>(rows.map((r) => [r.invId, r]))

  it('audits all 31 registry walls (cube 22-25 removed; 27-36 added)', () => {
    expect(rows).toHaveLength(31)
    expect(rows.map((r) => r.invId)).toEqual([...Array.from({ length: 16 }, (_, i) => i + 1), 18, 19, 20, 21, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36])
  })

  it('every wall has a documented cap floor ≥ the legibility minimum for its distance', () => {
    for (const r of rows) {
      expect(r.cap.minCapHeightMm).toBeGreaterThan(0)
      expect(isLegibleCm(r.cap.minCapHeightCm, r.cap.readingDistanceM)).toBe(true)
    }
  })

  it('has no hard warnings — every built print fits its wall and is coherent', () => {
    expect(legibilityIssues(rows)).toEqual([])
    expect(isLegibilityCoherent(rows)).toBe(true)
    for (const r of rows) {
      if (r.built) {
        expect(r.verdict).toBe('ok')
        expect(r.eyeBand?.fitsWall).toBe(true)
      }
    }
  })

  it('the 7 authored prints are the expected wall graphics', () => {
    const built = rows.filter((r) => r.built).map((r) => r.invId).sort((a, b) => a - b)
    // hero #2, umbral #3, model-sizes #8, wayfinding #10, aceleración #11, micro-acento #14, código #16
    expect(built).toEqual([2, 3, 8, 10, 11, 14, 16])
  })

  it('the typographic pieces declare a reading distance that matches their room policy (in-band)', () => {
    for (const invId of [3, 10, 14]) {
      const r = byInv.get(invId)!
      expect(r.cap.source).toBe('doc')
      expect(r.cap.readingDistanceM).toBe(salaReadingDistanceM(r.sala))
      expect(r.eyeBand?.inEyeBand).toBe(true)
    }
  })

  it('the tall data-viz pieces are honestly clamped below the band but fit the wall', () => {
    // hero (2.2 m) + model-sizes/aceleración (2.0 m) on 2.5 m walls clamp below 1.45
    for (const invId of [2, 8, 11]) {
      const r = byInv.get(invId)!
      expect(r.eyeBand?.clampedByHeight).toBe(true)
      expect(r.eyeBand?.fitsWall).toBe(true)
      expect(r.verdict).toBe('ok')
    }
  })

  it("documents the real titular cap sizes: each typographic page's title clears its floor", () => {
    // wayfinding #10 — destinationCapFraction 0.32 (mirrors the page)
    const way = byInv.get(10)!
    const wayScale = wayfindingTypeScale({ trimHeightMm: 1800, readingDistanceM: way.cap.readingDistanceM, destinationCapFraction: 0.32 })
    expect(wayScale.minCapHeightMm).toBeCloseTo(way.cap.minCapHeightMm, 6)
    expect(isLegibleCm(wayScale.capHeights.destinationMm / 10, way.cap.readingDistanceM)).toBe(true)

    // umbral #3 — default exported fractions
    const umb = byInv.get(3)!
    const umbScale = umbralTypeScale({ trimHeightMm: 1800, readingDistanceM: umb.cap.readingDistanceM })
    expect(umbScale.minCapHeightMm).toBeCloseTo(umb.cap.minCapHeightMm, 6)
    expect(isLegibleCm(umbScale.capHeights.destinationMm / 10, umb.cap.readingDistanceM)).toBe(true)

    // micro-acento #14 — sized to fit its wrapped line count
    const micro = byInv.get(14)!
    const lineCount = wrapPhrase('Ya pasó antes', { maxLines: 2 }).length
    const microScale = microAcentoTypeScale({ trimHeightMm: 1000, readingDistanceM: micro.cap.readingDistanceM, lineCount })
    expect(microScale.minCapHeightMm).toBeCloseTo(micro.cap.minCapHeightMm, 6)
    expect(isLegibleCm(microScale.capHeights.destinationMm / 10, micro.cap.readingDistanceM)).toBe(true)
  })

  it('per-room coherence: each sala maps to a single reading distance + cap floor', () => {
    const coh = roomCoherence(rows)
    expect(coh.length).toBeGreaterThan(0)
    const covered = coh.flatMap((c) => c.invIds).sort((a, b) => a - b)
    expect(covered).toEqual([...Array.from({ length: 16 }, (_, i) => i + 1), 18, 19, 20, 21, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36])
    for (const c of coh) {
      expect(c.readingDistanceM).toBe(salaReadingDistanceM(c.sala))
      expect(c.minCapHeightCm).toBeCloseTo(minCapHeightMm(c.readingDistanceM) / 10, 9)
    }
  })

  it('produces a deterministic deliverable (markdown + csv)', () => {
    expect(formatLegibilityMarkdown(rows)).toBe(formatLegibilityMarkdown(buildLegibilityTable(walls, prints)))
    expect(formatLegibilityCsv(rows)).toBe(formatLegibilityCsv(buildLegibilityTable(walls, prints)))
  })
})
