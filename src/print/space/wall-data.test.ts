import { describe, expect, it } from 'vitest'
import { circleAreaScale, scaleLog, sourceHost } from '../pages/dataviz-scales'
import { findWallByInvId } from './eventLayout'
import {
  WALL_DATA,
  WALL_DATA_VERSION,
  allData,
  allPieces,
  assertSourced,
  dataForWall,
  datumProblems,
  heroHooks,
  isIsoDate,
  isWallDatum,
  pieceByInvId,
  pieceBySlug,
  piecesByInvId,
  sourcesCaptionFor,
  sourcesTable,
  unsourcedData,
  type WallDatum,
} from './wall-data'

/** A fully-valid datum, mutated per-test to probe one rule at a time. */
const valid: WallDatum = {
  id: 'x',
  label: 'X',
  group: 'aggregate',
  unit: 'USD',
  figure: 'X — value',
  value: 1e9,
  date: '2026-06',
  sourceURL: 'https://example.com/x',
}

describe('wall-data — file shape', () => {
  it('exports a numeric schema version', () => {
    expect(typeof WALL_DATA_VERSION).toBe('number')
    expect(WALL_DATA_VERSION).toBeGreaterThanOrEqual(1)
  })

  it('has at least one piece (the hero)', () => {
    expect(allPieces().length).toBeGreaterThanOrEqual(1)
    expect(pieceBySlug('sistema-solar-inversion')).toBeDefined()
  })

  it('keys WALL_DATA by each piece slug', () => {
    for (const [key, piece] of Object.entries(WALL_DATA)) {
      expect(key).toBe(piece.slug)
    }
  })
})

describe('wall-data — every datum honours the {figure,value,date,sourceURL} contract', () => {
  it('passes the global guard: no unsourced data', () => {
    expect(unsourcedData()).toEqual([])
    expect(() => assertSourced()).not.toThrow()
  })

  it('each datum has the four required contract fields, well-formed', () => {
    for (const d of allData()) {
      expect(datumProblems(d), `datum ${d.id}`).toEqual([])
      expect(d.figure.trim()).not.toBe('')
      expect(Number.isFinite(d.value)).toBe(true)
      expect(isIsoDate(d.date)).toBe(true)
      expect(sourceHost(d.sourceURL)).not.toBe('') // URL resolves to a host
    }
  })

  it('uses one consistent unit per piece (never mixes units on a single chart)', () => {
    for (const piece of allPieces()) {
      const units = new Set(piece.data.map((d) => d.unit))
      expect(units.size, `piece ${piece.slug} mixes units: ${[...units].join(', ')}`).toBe(1)
    }
  })

  it('money pieces use absolute USD so values feed circleAreaScale/formatMoney directly', () => {
    const money = pieceBySlug('sistema-solar-inversion')!
    for (const d of money.data) expect(d.unit).toBe('USD')
  })

  it('all values are strictly positive (log/area scales need value > 0)', () => {
    for (const d of allData()) expect(d.value).toBeGreaterThan(0)
  })

  it('datum ids are unique within each piece', () => {
    for (const piece of allPieces()) {
      const ids = piece.data.map((d) => d.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('wall-data — validation primitives', () => {
  it('isWallDatum accepts a well-formed datum', () => {
    expect(isWallDatum(valid)).toBe(true)
    expect(datumProblems(valid)).toEqual([])
  })

  it('rejects a missing or empty figure', () => {
    expect(isWallDatum({ ...valid, figure: '' })).toBe(false)
    expect(isWallDatum({ ...valid, figure: '   ' })).toBe(false)
    const { figure, ...noFigure } = valid
    expect(isWallDatum(noFigure)).toBe(false)
  })

  it('rejects a non-finite or non-numeric value', () => {
    for (const bad of [NaN, Infinity, -Infinity, '1e9', null]) {
      expect(isWallDatum({ ...valid, value: bad as number })).toBe(false)
    }
  })

  it('rejects a non-ISO date', () => {
    for (const bad of ['June 2026', '2026/06', '2026-13', '2026-06-32', '26-06', '']) {
      expect(isWallDatum({ ...valid, date: bad })).toBe(false)
    }
    // year / month / day precision are all valid ISO (year for annual figures)
    expect(isWallDatum({ ...valid, date: '2026' })).toBe(true)
    expect(isWallDatum({ ...valid, date: '2026-06' })).toBe(true)
    expect(isWallDatum({ ...valid, date: '2026-06-03' })).toBe(true)
  })

  it('rejects a missing or hostless source URL', () => {
    expect(isWallDatum({ ...valid, sourceURL: '' })).toBe(false)
    const { sourceURL, ...noURL } = valid
    expect(isWallDatum(noURL)).toBe(false)
  })

  it('rejects missing production metadata (id/label/unit/group)', () => {
    expect(isWallDatum({ ...valid, id: '' })).toBe(false)
    expect(isWallDatum({ ...valid, label: '' })).toBe(false)
    expect(isWallDatum({ ...valid, unit: '' })).toBe(false)
    expect(isWallDatum({ ...valid, group: 123 as unknown as WallDatum['group'] })).toBe(false)
  })

  it('rejects non-objects without throwing', () => {
    for (const bad of [null, undefined, 42, 'str', []]) {
      expect(isWallDatum(bad)).toBe(false)
    }
  })

  it('isIsoDate accepts year, month, and day precision', () => {
    expect(isIsoDate('2025')).toBe(true)
    expect(isIsoDate('2026-06')).toBe(true)
    expect(isIsoDate('2026-06-03')).toBe(true)
    expect(isIsoDate('2026-00')).toBe(false)
    expect(isIsoDate('2026-13')).toBe(false)
    expect(isIsoDate(20260603)).toBe(false)
  })

  it('assertSourced throws on a corrupt datum and on a code/invId mismatch', () => {
    expect(() =>
      assertSourced([
        { invId: 9, code: 'wall-8', slug: 't', title: 'T', sala: 'S1', sourcesNote: '', data: [{ ...valid, value: NaN }] },
      ]),
    ).toThrow()
    expect(() =>
      assertSourced([{ invId: 2, code: 'wall-99', slug: 't', title: 'T', sala: 'S3', sourcesNote: '', data: [] }]),
    ).toThrow(/wall-1/)
  })

  it('assertSourced throws on duplicate datum ids', () => {
    expect(() =>
      assertSourced([
        {
          invId: 2,
          code: 'wall-1',
          slug: 't',
          title: 'T',
          sala: 'S3',
          sourcesNote: '',
          data: [valid, { ...valid, label: 'Y' }],
        },
      ]),
    ).toThrow(/duplicate/)
  })
})

describe('wall-data — wall registry coherence', () => {
  it('each piece code is wall-(invId-1) and resolves to a real registered wall', () => {
    for (const piece of allPieces()) {
      expect(piece.code).toBe(`wall-${piece.invId - 1}`)
      const wall = findWallByInvId(piece.invId)
      expect(wall, `invId ${piece.invId}`).toBeDefined()
      expect(wall!.id).toBe(piece.code)
    }
  })

  it('only feeds data to walls flagged research:true (honesty invariant)', () => {
    for (const piece of allPieces()) {
      const wall = findWallByInvId(piece.invId)
      expect(wall!.registry!.research, `wall ${piece.invId} must be research:true`).toBe(true)
    }
  })

  it('dataForWall returns the piece data, and [] for an unknown wall', () => {
    expect(dataForWall(2)).toBe(pieceByInvId(2)!.data)
    expect(dataForWall(999)).toEqual([])
  })
})

describe('wall-data — sources note deliverables', () => {
  it('every piece carries a non-empty prose sources note', () => {
    for (const piece of allPieces()) expect(piece.sourcesNote.trim()).not.toBe('')
  })

  it('sourcesCaptionFor lists deduped hosts and a date', () => {
    const caption = sourcesCaptionFor('sistema-solar-inversion')
    expect(caption).toMatch(/^Fuentes:/)
    expect(caption).toContain('companiesmarketcap.com')
    // hosts are deduped even though six Spanish refs share one URL
    const hostList = caption.replace(/^Fuentes:\s*/, '').split(' · ')[0]
    const hosts = hostList.split(', ')
    expect(new Set(hosts).size).toBe(hosts.length)
  })

  it('sourcesTable yields one {figure,value,date,sourceURL} row per datum', () => {
    const piece = pieceByInvId(2)!
    const rows = sourcesTable(piece)
    expect(rows.length).toBe(piece.data.length)
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['date', 'figure', 'sourceURL', 'value'])
    }
  })
})

describe('wall-data — hero dataset', () => {
  const hero = pieceBySlug('sistema-solar-inversion')!

  it('mounts on wall 2 (S3 INVESTMENT face)', () => {
    expect(hero.invId).toBe(2)
    expect(hero.code).toBe('wall-1')
    expect(hero.sala).toBe('S3')
  })

  it('covers every comparison family the brief asks for', () => {
    const groups = new Set(hero.data.map((d) => d.group))
    expect(groups).toContain('ai-giant-public')
    expect(groups).toContain('ai-giant-private')
    expect(groups).toContain('spanish-ref')
    expect(groups).toContain('aggregate')
    expect(groups).toContain('shock-market')
  })

  it('includes the named AI giants and Spanish refs from the brief', () => {
    const ids = new Set(hero.data.map((d) => d.id))
    for (const id of ['nvidia', 'alphabet', 'microsoft', 'meta', 'openai', 'anthropic']) {
      expect(ids, `AI giant ${id}`).toContain(id)
    }
    for (const id of ['inditex', 'iberdrola', 'santander', 'bbva', 'telefonica', 'repsol', 'ibex35', 'spain-gdp']) {
      expect(ids, `Spanish ref ${id}`).toContain(id)
    }
  })

  it('flags private valuations as not-listed via a note', () => {
    for (const d of hero.data.filter((x) => x.group === 'ai-giant-private')) {
      expect(d.note ?? '').not.toBe('')
    }
  })

  it('corrects the coffee-market definition (retail ≫ the $49 bn green-coffee myth)', () => {
    const coffee = hero.data.find((d) => d.id === 'coffee')!
    expect(coffee.value).toBeGreaterThan(49e9) // not the commodity figure
    expect(coffee.note ?? '').toMatch(/49/) // explains the discrepancy on the piece
  })

  it('feeds circleAreaScale: area ∝ value, radii finite, biggest ball = max value', () => {
    const values = hero.data.map((d) => d.value)
    const maxValue = Math.max(...values)
    const scale = circleAreaScale({ maxValue, maxRadius: 200 })
    for (const d of hero.data) {
      const r = scale.radius(d.value)
      expect(Number.isFinite(r)).toBe(true)
      expect(r).toBeGreaterThan(0)
      // area is exactly proportional to value
      expect(scale.area(d.value) / d.value).toBeCloseTo((Math.PI * 200 * 200) / maxValue, 6)
    }
    // the largest datum renders at the full radius
    const biggest = hero.data.reduce((a, b) => (a.value >= b.value ? a : b))
    expect(scale.radius(biggest.value)).toBeCloseTo(200, 6)
  })
})

describe('wall-data — #8 model-sizes dataset', () => {
  const piece = pieceBySlug('tamano-de-modelos')

  it('exists and mounts on wall 8 (S2 Intro IA, code wall-7)', () => {
    expect(piece, 'tamano-de-modelos piece must exist').toBeDefined()
    expect(piece!.invId).toBe(8)
    expect(piece!.code).toBe('wall-7')
    expect(piece!.sala).toBe('S2')
  })

  it('its wall (#8) is flagged research:true and resolves to wall-7', () => {
    const wall = findWallByInvId(8)
    expect(wall, 'wall invId 8 must be registered').toBeDefined()
    expect(wall!.id).toBe('wall-7')
    expect(wall!.registry!.research).toBe(true)
  })

  it('every datum is a parameter count (single unit), sourced and dated', () => {
    for (const d of piece!.data) {
      expect(datumProblems(d), `datum ${d.id}`).toEqual([])
      expect(d.unit).toBe('parameters')
      expect(d.group).toBe('model')
      expect(d.value).toBeGreaterThan(0)
    }
    // one unit on the chart — no mixing
    expect(new Set(piece!.data.map((d) => d.unit)).size).toBe(1)
  })

  it('covers the milestones the brief names (Perceptrón → 2025-26)', () => {
    const ids = new Set(piece!.data.map((d) => d.id))
    for (const id of ['perceptron', 'alexnet', 'gpt2', 'gpt3', 'gpt4', 'kimi-k2']) {
      expect(ids, `milestone ${id}`).toContain(id)
    }
  })

  it('carries the canonical disclosed figures', () => {
    const byId = Object.fromEntries(piece!.data.map((d) => [d.id, d]))
    expect(byId.perceptron.value).toBe(512)
    expect(byId.alexnet.value).toBe(60e6)
    expect(byId.gpt2.value).toBe(1.5e9)
    expect(byId.gpt3.value).toBe(175e9)
    expect(byId['kimi-k2'].value).toBe(1.0e12)
  })

  it('flags any non-disclosed figure as an estimate via a note (GPT-4)', () => {
    const gpt4 = piece!.data.find((d) => d.id === 'gpt4')!
    expect(gpt4.value).toBe(1.8e12)
    expect(gpt4.figure.toLowerCase()).toMatch(/estimaci/)
    expect((gpt4.note ?? '').toLowerCase()).toMatch(/estimaci/)
  })

  it('spans ~10 orders of magnitude (the explosive-growth message)', () => {
    const values = piece!.data.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    expect(min).toBe(512) // the Perceptrón is the smallest
    expect(Math.log10(max / min)).toBeGreaterThanOrEqual(9)
  })

  it('the disclosed classic era is strictly increasing (Perceptrón→GPT-3)', () => {
    const byId = Object.fromEntries(piece!.data.map((d) => [d.id, d.value]))
    const era = ['perceptron', 'alexnet', 'gpt2', 'gpt3'].map((id) => byId[id])
    for (let i = 1; i < era.length; i++) expect(era[i]).toBeGreaterThan(era[i - 1])
  })

  it('feeds a log axis cleanly (all values placeable, monotonic in value)', () => {
    const values = piece!.data.map((d) => d.value)
    const scale = scaleLog({ domain: [Math.min(...values), Math.max(...values)], range: [0, 1000] })
    const sorted = [...values].sort((a, b) => a - b)
    let prev = -Infinity
    for (const v of sorted) {
      const px = scale(v)
      expect(Number.isFinite(px)).toBe(true)
      expect(px).toBeGreaterThanOrEqual(prev)
      prev = px
    }
  })

  it('is covered by the global guards (sourced, unique ids, code↔invId)', () => {
    expect(() => assertSourced([piece!])).not.toThrow()
    const ids = piece!.data.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('wall-data — hero hooks hold against the verified numbers', () => {
  it('every proposed hook line is backed by the data', () => {
    const hooks = heroHooks()
    expect(hooks.length).toBeGreaterThan(0)
    for (const hook of hooks) {
      expect(hook.holds, `hook should hold: "${hook.claim}" (ratio ${hook.ratio.toFixed(2)})`).toBe(true)
    }
  })

  it('the strict hooks really clear 1× and the approx hook sits near parity', () => {
    const hooks = heroHooks()
    const byClaim = (needle: string) => hooks.find((h) => h.claim.includes(needle))!
    expect(byClaim('IBEX 35').claim).toBeDefined()
    expect(byClaim('Nvidia vale más que todo el IBEX 35').ratio).toBeGreaterThan(1)
    expect(byClaim('PIB de España').ratio).toBeGreaterThan(1)
    expect(byClaim('café').ratio).toBeGreaterThan(1)
    const approx = byClaim('última ronda de Anthropic')
    expect(approx.ratio).toBeGreaterThanOrEqual(0.8)
    expect(approx.ratio).toBeLessThanOrEqual(1.25)
  })
})

describe('wall-data — piecesByInvId (multi-chart walls)', () => {
  it('returns every piece feeding a wall (wall 11 hosts both acceleration charts)', () => {
    const pieces = piecesByInvId(11)
    expect(pieces.length).toBe(2)
    const slugs = pieces.map((p) => p.slug).sort()
    expect(slugs).toEqual(['horizonte-de-tareas', 'ventana-de-contexto'])
    for (const p of pieces) {
      expect(p.invId).toBe(11)
      expect(p.code).toBe('wall-10')
    }
  })

  it('returns a single-element list for a one-chart wall (wall 2 = hero)', () => {
    const pieces = piecesByInvId(2)
    expect(pieces.length).toBe(1)
    expect(pieces[0].slug).toBe('sistema-solar-inversion')
  })

  it('returns [] for a wall with no data', () => {
    expect(piecesByInvId(999)).toEqual([])
  })

  it('pieceByInvId returns the first of piecesByInvId (back-compat)', () => {
    expect(pieceByInvId(11)).toBe(piecesByInvId(11)[0])
    expect(pieceByInvId(2)).toBe(piecesByInvId(2)[0])
    expect(pieceByInvId(999)).toBeUndefined()
  })

  it('every piece is reachable via piecesByInvId(its own invId)', () => {
    for (const piece of allPieces()) {
      expect(piecesByInvId(piece.invId)).toContain(piece)
    }
  })
})

describe('wall-data — #11 acceleration charts (S3 Nave E)', () => {
  const horizonte = pieceBySlug('horizonte-de-tareas')
  const contexto = pieceBySlug('ventana-de-contexto')

  it('exposes the new schema version that introduced capability/context groups', () => {
    expect(WALL_DATA_VERSION).toBeGreaterThanOrEqual(3)
  })

  it('both charts exist and mount on wall 11 (S3, code wall-10)', () => {
    for (const piece of [horizonte, contexto]) {
      expect(piece, 'acceleration chart must exist').toBeDefined()
      expect(piece!.invId).toBe(11)
      expect(piece!.code).toBe('wall-10')
      expect(piece!.sala).toBe('S3')
      expect(piece!.sourcesNote.trim()).not.toBe('')
    }
  })

  it('its wall (#11) is flagged research:true and resolves to wall-10', () => {
    const wall = findWallByInvId(11)
    expect(wall, 'wall invId 11 must be registered').toBeDefined()
    expect(wall!.id).toBe('wall-10')
    expect(wall!.registry!.research).toBe(true)
  })

  it('each chart keeps one consistent unit (never mixes units on a single chart)', () => {
    expect(new Set(horizonte!.data.map((d) => d.unit))).toEqual(new Set(['seconds']))
    expect(new Set(horizonte!.data.map((d) => d.group))).toEqual(new Set(['capability']))
    expect(new Set(contexto!.data.map((d) => d.unit))).toEqual(new Set(['tokens']))
    expect(new Set(contexto!.data.map((d) => d.group))).toEqual(new Set(['context']))
  })

  it('every datum is sourced, dated, positive, with unique ids (the global contract)', () => {
    for (const piece of [horizonte!, contexto!]) {
      const ids = piece.data.map((d) => d.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const d of piece.data) {
        expect(datumProblems(d), `datum ${piece.slug}/${d.id}`).toEqual([])
        expect(d.value).toBeGreaterThan(0)
        expect(isIsoDate(d.date)).toBe(true)
        expect(sourceHost(d.sourceURL)).not.toBe('')
      }
      expect(() => assertSourced([piece])).not.toThrow()
    }
  })

  // ── Chart A: METR task horizon (capability) ──
  it('the task-horizon chart covers the METR milestones GPT-2 → o3', () => {
    const ids = new Set(horizonte!.data.map((d) => d.id))
    for (const id of ['gpt2', 'gpt4', 'o1', 'claude-3-7-sonnet', 'o3']) {
      expect(ids, `METR milestone ${id}`).toContain(id)
    }
  })

  it('carries the sourced METR Time Horizon values (seconds)', () => {
    const byId = Object.fromEntries(horizonte!.data.map((d) => [d.id, d.value]))
    expect(byId.gpt2).toBe(2) // 2 s — 2019 origin of the trend
    expect(byId.gpt4).toBe(240) // 4 min
    expect(byId.o1).toBe(2280) // 38 min
    expect(byId['claude-3-7-sonnet']).toBe(3600) // 1 h
    expect(byId.o3).toBe(7260) // 2 h 1 min
  })

  it('the task horizon grows strictly over time (the acceleration message)', () => {
    const data = horizonte!.data
    for (let i = 1; i < data.length; i++) {
      expect(data[i].date >= data[i - 1].date, 'authored in chronological order').toBe(true)
      expect(data[i].value).toBeGreaterThan(data[i - 1].value)
    }
  })

  it('spans the dramatic multi-year arc (≥3 orders of magnitude)', () => {
    const values = horizonte!.data.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    expect(min).toBe(2) // GPT-2, the 2019 origin, is the smallest
    expect(Math.log10(max / min)).toBeGreaterThanOrEqual(3)
  })

  it('every horizon figure is sourced to METR and GPT-2 is flagged as the study origin', () => {
    for (const d of horizonte!.data) expect(sourceHost(d.sourceURL)).toBe('metr.org')
    const gpt2 = horizonte!.data.find((d) => d.id === 'gpt2')!
    expect((gpt2.note ?? '').toLowerCase()).toMatch(/origen/)
  })

  // ── Chart B: context window (memory) ──
  it('the context chart covers the milestones 2K → 1M', () => {
    const ids = new Set(contexto!.data.map((d) => d.id))
    for (const id of ['gpt3', 'gpt4', 'claude-2-1', 'gemini-1-5-pro']) {
      expect(ids, `context milestone ${id}`).toContain(id)
    }
  })

  it('carries the launch context windows (tokens)', () => {
    const byId = Object.fromEntries(contexto!.data.map((d) => [d.id, d.value]))
    expect(byId.gpt3).toBe(2048)
    expect(byId.gpt4).toBe(8192)
    expect(byId['claude-2-1']).toBe(200000)
    expect(byId['gemini-1-5-pro']).toBe(1000000)
  })

  it('context grows strictly over time and reaches a million-token window', () => {
    const data = contexto!.data
    for (let i = 1; i < data.length; i++) {
      expect(data[i].date >= data[i - 1].date, 'authored in chronological order').toBe(true)
      expect(data[i].value).toBeGreaterThan(data[i - 1].value)
    }
    expect(Math.max(...data.map((d) => d.value))).toBeGreaterThanOrEqual(1e6)
    for (const d of data) expect((d.note ?? '').trim()).not.toBe('')
  })

  // ── both charts feed a log axis cleanly ──
  it('both charts are placeable on a log axis (monotonic in value)', () => {
    for (const piece of [horizonte!, contexto!]) {
      const values = piece.data.map((d) => d.value)
      const scale = scaleLog({ domain: [Math.min(...values), Math.max(...values)], range: [0, 1000] })
      const sorted = [...values].sort((a, b) => a - b)
      let prev = -Infinity
      for (const v of sorted) {
        const px = scale(v)
        expect(Number.isFinite(px)).toBe(true)
        expect(px).toBeGreaterThanOrEqual(prev)
        prev = px
      }
    }
  })
})

describe('wall-data — #16 code-gen charts (S3 divisoria 2 TEXT+CODE)', () => {
  const tiempo = pieceBySlug('tiempo-de-desarrollo')
  const adopcion = pieceBySlug('codigo-escrito-por-ia')

  it('exposes the schema version that introduced productivity/adoption groups', () => {
    expect(WALL_DATA_VERSION).toBeGreaterThanOrEqual(4)
  })

  it('models wall 16 as a two-chart family via piecesByInvId(16)', () => {
    const pieces = piecesByInvId(16)
    expect(pieces.length).toBe(2)
    expect(pieces.map((p) => p.slug).sort()).toEqual(['codigo-escrito-por-ia', 'tiempo-de-desarrollo'])
    // pieceByInvId stays back-compatible (returns the first chart)
    expect(pieceByInvId(16)).toBe(pieces[0])
  })

  it('both charts exist and mount on wall 16 (S3, code wall-15)', () => {
    for (const piece of [tiempo, adopcion]) {
      expect(piece, 'code-gen chart must exist').toBeDefined()
      expect(piece!.invId).toBe(16)
      expect(piece!.code).toBe('wall-15')
      expect(piece!.sala).toBe('S3')
      expect(piece!.sourcesNote.trim()).not.toBe('')
    }
  })

  it('its wall (#16) is flagged research:true and resolves to wall-15', () => {
    const wall = findWallByInvId(16)
    expect(wall, 'wall invId 16 must be registered').toBeDefined()
    expect(wall!.id).toBe('wall-15')
    expect(wall!.registry!.research).toBe(true)
  })

  it('each chart keeps one consistent unit and group (never mixes on a single chart)', () => {
    expect(new Set(tiempo!.data.map((d) => d.unit))).toEqual(new Set(['minutes']))
    expect(new Set(tiempo!.data.map((d) => d.group))).toEqual(new Set(['productivity']))
    expect(new Set(adopcion!.data.map((d) => d.unit))).toEqual(new Set(['percent']))
    expect(new Set(adopcion!.data.map((d) => d.group))).toEqual(new Set(['adoption']))
  })

  it('every datum is sourced, dated, positive, with unique ids (the global contract)', () => {
    for (const piece of [tiempo!, adopcion!]) {
      const ids = piece.data.map((d) => d.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const d of piece.data) {
        expect(datumProblems(d), `datum ${piece.slug}/${d.id}`).toEqual([])
        expect(d.value).toBeGreaterThan(0)
        expect(isIsoDate(d.date)).toBe(true)
        expect(sourceHost(d.sourceURL)).not.toBe('')
      }
      expect(() => assertSourced([piece])).not.toThrow()
    }
  })

  // ── Chart A: GitHub controlled study — task time with vs without AI ──
  it('the time chart is an honest A/B of the same task (control vs Copilot)', () => {
    const ids = new Set(tiempo!.data.map((d) => d.id))
    expect(ids).toContain('sin-ia')
    expect(ids).toContain('con-ia')
    // both datums describe the *same* measured task, from the same study/source
    const hosts = new Set(tiempo!.data.map((d) => sourceHost(d.sourceURL)))
    expect(hosts).toEqual(new Set(['github.blog']))
    for (const d of tiempo!.data) expect(d.figure).toMatch(/servidor HTTP/i)
  })

  it('carries the sourced GitHub study times (161 min control, 71 min Copilot)', () => {
    const byId = Object.fromEntries(tiempo!.data.map((d) => [d.id, d.value]))
    expect(byId['sin-ia']).toBe(161) // 2 h 41 min
    expect(byId['con-ia']).toBe(71) // 1 h 11 min
    // AI is the faster (smaller) value — the whole point of the chart
    expect(byId['con-ia']).toBeLessThan(byId['sin-ia'])
  })

  it('the measured reduction matches the published ~55 % faster claim', () => {
    const byId = Object.fromEntries(tiempo!.data.map((d) => [d.id, d.value]))
    const reduction = (byId['sin-ia'] - byId['con-ia']) / byId['sin-ia']
    // 90 / 161 = 55.9 %, consistent with GitHub's published "55 % faster"
    expect(reduction).toBeGreaterThanOrEqual(0.55)
    expect(reduction).toBeLessThanOrEqual(0.56)
  })

  // ── Chart B: share of code already written by AI ──
  it('the adoption chart includes the required GitHub usage datum + Google & Microsoft', () => {
    const ids = new Set(adopcion!.data.map((d) => d.id))
    for (const id of ['github-copilot', 'microsoft', 'google']) {
      expect(ids, `adoption datum ${id}`).toContain(id)
    }
    // the brief's "GitHub AI-assisted / usage" datum must be present and GitHub-sourced
    const github = adopcion!.data.find((d) => d.id === 'github-copilot')!
    expect(sourceHost(github.sourceURL)).toContain('github')
  })

  it('carries the sourced adoption percentages (Copilot 46, Microsoft 30, Google 25)', () => {
    const byId = Object.fromEntries(adopcion!.data.map((d) => [d.id, d.value]))
    expect(byId['github-copilot']).toBe(46)
    expect(byId.microsoft).toBe(30)
    expect(byId.google).toBe(25)
  })

  it('every adoption figure is a real percentage in (0, 100] with its scope noted', () => {
    for (const d of adopcion!.data) {
      expect(d.value).toBeGreaterThan(0)
      expect(d.value).toBeLessThanOrEqual(100)
      // each bar's denominator differs, so its scope must be spelled out (honesty)
      expect((d.note ?? '').trim(), `datum ${d.id} needs a scope note`).not.toBe('')
    }
  })

  it('attributes each named-company figure to a primary, dated source', () => {
    const byId = Object.fromEntries(adopcion!.data.map((d) => [d.id, d]))
    expect(sourceHost(byId.microsoft.sourceURL)).toBe('cnbc.com')
    expect(byId.microsoft.date).toBe('2025-04')
    expect(sourceHost(byId.google.sourceURL)).toBe('blog.google')
    expect(byId.google.date).toBe('2024-10')
    expect(byId['github-copilot'].date).toBe('2023-02')
  })

  it('introduces exactly the two new groups, used only by #16', () => {
    const groupsOf = (slug: string) => new Set(pieceBySlug(slug)!.data.map((d) => d.group))
    // the new groups exist in the file…
    expect(allData().some((d) => d.group === 'productivity')).toBe(true)
    expect(allData().some((d) => d.group === 'adoption')).toBe(true)
    // …and belong to #16's charts only
    expect(groupsOf('tiempo-de-desarrollo')).toEqual(new Set(['productivity']))
    expect(groupsOf('codigo-escrito-por-ia')).toEqual(new Set(['adoption']))
    for (const piece of allPieces()) {
      if (piece.invId === 16) continue
      const groups = piece.data.map((d) => d.group)
      expect(groups).not.toContain('productivity')
      expect(groups).not.toContain('adoption')
    }
  })

  it('is covered by the global file guards (sourced, code↔invId, no unsourced data)', () => {
    expect(() => assertSourced()).not.toThrow()
    expect(unsourcedData()).toEqual([])
    for (const piece of [tiempo!, adopcion!]) {
      expect(piece.code).toBe(`wall-${piece.invId - 1}`)
    }
  })
})
