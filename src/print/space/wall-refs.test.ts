import { describe, expect, it } from 'vitest'
import { sourceHost } from '../pages/dataviz-scales'
import { findWallByInvId } from './eventLayout'
import {
  WALL_DATA_VERSION,
  WALL_REFS,
  allData,
  allPieces,
  allRefPieces,
  allRefs,
  assertRefsSourced,
  dataForWall,
  isIsoDate,
  isRefItem,
  pieceBySlug,
  refPieceBySlug,
  refProblems,
  refsByInvId,
  refsSourcesCaptionFor,
  unsourcedRefs,
  type RefItem,
} from './wall-data'

/** A fully-valid reference, mutated per-test to probe one rule at a time. */
const valid: RefItem = {
  id: 'x',
  label: 'X',
  category: 'autonomous-vehicle',
  claim: 'Algo real ya está ocurriendo',
  value: 1000,
  unit: 'unidades',
  date: '2026-06',
  sourceURL: 'https://example.com/x',
}

describe('wall-refs — file shape', () => {
  it('exposes the schema version that introduced the reference schema (>= 5)', () => {
    expect(WALL_DATA_VERSION).toBeGreaterThanOrEqual(5)
  })

  it('has at least one reference piece (the #13 reality refs)', () => {
    expect(allRefPieces().length).toBeGreaterThanOrEqual(1)
    expect(refPieceBySlug('realidad-ya-existe')).toBeDefined()
  })

  it('keys WALL_REFS by each piece slug', () => {
    for (const [key, piece] of Object.entries(WALL_REFS)) {
      expect(key).toBe(piece.slug)
    }
  })
})

describe('wall-refs — every reference is sourced and dated', () => {
  it('passes the global guard: no unsourced refs', () => {
    expect(unsourcedRefs()).toEqual([])
    expect(() => assertRefsSourced()).not.toThrow()
  })

  it('each ref carries a well-formed claim, ISO date and resolvable source host', () => {
    for (const r of allRefs()) {
      expect(refProblems(r), `ref ${r.id}`).toEqual([])
      expect(r.claim.trim()).not.toBe('')
      expect(isIsoDate(r.date)).toBe(true)
      expect(sourceHost(r.sourceURL)).not.toBe('')
    }
  })

  it('any ref with a headline figure carries a positive value and a unit', () => {
    for (const r of allRefs()) {
      if (r.value !== undefined) {
        expect(r.value, `ref ${r.id}`).toBeGreaterThan(0)
        expect((r.unit ?? '').trim(), `ref ${r.id} unit`).not.toBe('')
      }
    }
  })

  it('ref ids are unique within each piece', () => {
    for (const piece of allRefPieces()) {
      const ids = piece.refs.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('every piece carries a non-empty prose sources note', () => {
    for (const piece of allRefPieces()) expect(piece.sourcesNote.trim()).not.toBe('')
  })
})

describe('wall-refs — validation primitives', () => {
  it('isRefItem accepts a well-formed ref', () => {
    expect(isRefItem(valid)).toBe(true)
    expect(refProblems(valid)).toEqual([])
  })

  it('accepts an existence-only ref (no value/unit) — refs need not be quantitative', () => {
    const { value, unit, ...existence } = valid
    expect(isRefItem(existence)).toBe(true)
    expect(refProblems(existence)).toEqual([])
  })

  it('rejects missing id / label / category / claim', () => {
    expect(isRefItem({ ...valid, id: '' })).toBe(false)
    expect(isRefItem({ ...valid, label: '   ' })).toBe(false)
    expect(isRefItem({ ...valid, category: '' as RefItem['category'] })).toBe(false)
    expect(isRefItem({ ...valid, claim: '' })).toBe(false)
  })

  it('rejects a non-ISO date', () => {
    for (const bad of ['mayo 2025', '2025/05', '2025-13', '2025-05-32', '']) {
      expect(isRefItem({ ...valid, date: bad })).toBe(false)
    }
    // year / month / day precision are all valid
    expect(isRefItem({ ...valid, date: '2025' })).toBe(true)
    expect(isRefItem({ ...valid, date: '2025-05' })).toBe(true)
    expect(isRefItem({ ...valid, date: '2025-05-01' })).toBe(true)
  })

  it('rejects a missing or hostless source URL', () => {
    expect(isRefItem({ ...valid, sourceURL: '' })).toBe(false)
    const { sourceURL, ...noURL } = valid
    expect(isRefItem(noURL)).toBe(false)
  })

  it('rejects an orphan figure (value without unit, or unit without value)', () => {
    const { unit, ...valueNoUnit } = valid
    expect(isRefItem(valueNoUnit)).toBe(false)
    const { value, ...unitNoValue } = valid
    expect(isRefItem(unitNoValue)).toBe(false)
  })

  it('rejects a non-finite or non-positive value', () => {
    for (const bad of [NaN, Infinity, -Infinity, 0, -5]) {
      expect(isRefItem({ ...valid, value: bad })).toBe(false)
    }
  })

  it('rejects non-objects without throwing', () => {
    for (const bad of [null, undefined, 42, 'str', []]) {
      expect(isRefItem(bad)).toBe(false)
    }
  })

  it('assertRefsSourced throws on a corrupt ref and on a code/invId mismatch', () => {
    expect(() =>
      assertRefsSourced([
        { invId: 13, code: 'wall-12', slug: 't', title: 'T', sala: 'S5/S6', sourcesNote: '', refs: [{ ...valid, date: 'ayer' }] },
      ]),
    ).toThrow()
    expect(() =>
      assertRefsSourced([{ invId: 13, code: 'wall-99', slug: 't', title: 'T', sala: 'S5/S6', sourcesNote: '', refs: [] }]),
    ).toThrow(/wall-12/)
  })

  it('assertRefsSourced throws on duplicate ref ids', () => {
    expect(() =>
      assertRefsSourced([
        {
          invId: 13,
          code: 'wall-12',
          slug: 't',
          title: 'T',
          sala: 'S5/S6',
          sourcesNote: '',
          refs: [valid, { ...valid, label: 'Y' }],
        },
      ]),
    ).toThrow(/duplicate/)
  })
})

describe('wall-refs — wall registry coherence', () => {
  it('each ref piece code is wall-(invId-1) and resolves to a real registered wall', () => {
    for (const piece of allRefPieces()) {
      expect(piece.code).toBe(`wall-${piece.invId - 1}`)
      const wall = findWallByInvId(piece.invId)
      expect(wall, `invId ${piece.invId}`).toBeDefined()
      expect(wall!.id).toBe(piece.code)
    }
  })

  it('only grounds walls flagged research:true (the honesty invariant)', () => {
    for (const piece of allRefPieces()) {
      const wall = findWallByInvId(piece.invId)
      expect(wall!.registry!.research, `wall ${piece.invId} must be research:true`).toBe(true)
    }
  })
})

describe('wall-refs — queries', () => {
  it('refsByInvId returns the wall-13 piece, and [] for an unknown wall', () => {
    const refs = refsByInvId(13)
    expect(refs.length).toBe(1)
    expect(refs[0].slug).toBe('realidad-ya-existe')
    expect(refsByInvId(999)).toEqual([])
  })

  it('allRefs flattens every reference across every piece', () => {
    const total = allRefPieces().reduce((n, p) => n + p.refs.length, 0)
    expect(allRefs().length).toBe(total)
  })

  it('refsSourcesCaptionFor lists deduped hosts and the latest date, "" for an unknown slug', () => {
    const caption = refsSourcesCaptionFor('realidad-ya-existe')
    expect(caption).toMatch(/^Fuentes:/)
    expect(caption).toContain('cnbc.com')
    const hostList = caption.replace(/^Fuentes:\s*/, '').split(' · ')[0]
    const hosts = hostList.split(', ')
    expect(new Set(hosts).size).toBe(hosts.length) // deduped
    expect(caption).toContain('2025-12') // the most recent ref date (Waymo)
    expect(refsSourcesCaptionFor('does-not-exist')).toBe('')
  })
})

describe('wall-refs — #13 reality dataset (S5/S6 "ya está ocurriendo")', () => {
  const piece = refPieceBySlug('realidad-ya-existe')

  it('exists and mounts on wall 13 (S5/S6, code wall-12)', () => {
    expect(piece, 'realidad-ya-existe ref piece must exist').toBeDefined()
    expect(piece!.invId).toBe(13)
    expect(piece!.code).toBe('wall-12')
    expect(piece!.sala).toBe('S5/S6')
  })

  it('its wall (#13) is registered, research:true and resolves to wall-12', () => {
    const wall = findWallByInvId(13)
    expect(wall, 'wall invId 13 must be registered').toBeDefined()
    expect(wall!.id).toBe('wall-12')
    expect(wall!.registry!.research).toBe(true)
  })

  it("covers the brief's two named upgrades: autonomous vehicles AND dark factories", () => {
    const categories = new Set(piece!.refs.map((r) => r.category))
    expect(categories).toContain('autonomous-vehicle')
    expect(categories).toContain('dark-factory')
  })

  it('includes the anchor refs the brief names (autonomous trucks + dark factory)', () => {
    const ids = new Set(piece!.refs.map((r) => r.id))
    // at least one Aurora truck ref and the Xiaomi dark factory
    expect([...ids].some((id) => id.startsWith('aurora-trucks'))).toBe(true)
    expect(ids).toContain('xiaomi-dark-factory')
  })

  it('carries the verified headline figures with units', () => {
    const byId = Object.fromEntries(piece!.refs.map((r) => [r.id, r]))
    expect(byId['aurora-trucks-launch'].value).toBe(3000000)
    expect(byId['aurora-trucks-scale'].value).toBe(100000)
    expect(byId['xiaomi-dark-factory'].value).toBe(10000000)
    expect(byId['wef-lighthouses'].value).toBe(201)
    expect(byId['waymo-robotaxis'].value).toBe(450000)
    for (const r of piece!.refs) expect((r.unit ?? '').trim()).not.toBe('')
  })

  it('attributes each ref to a primary or reputable, dated source', () => {
    const byId = Object.fromEntries(piece!.refs.map((r) => [r.id, r]))
    expect(sourceHost(byId['aurora-trucks-launch'].sourceURL)).toContain('aurora.tech')
    expect(byId['aurora-trucks-launch'].date).toBe('2025-05-01')
    expect(sourceHost(byId['aurora-trucks-scale'].sourceURL)).toBe('act-news.com')
    expect(sourceHost(byId['xiaomi-dark-factory'].sourceURL)).toBe('slashgear.com')
    expect(sourceHost(byId['wef-lighthouses'].sourceURL)).toBe('weforum.org')
    expect(sourceHost(byId['waymo-robotaxis'].sourceURL)).toBe('cnbc.com')
    expect(byId['waymo-robotaxis'].date).toBe('2025-12')
  })

  it('flags the dark-factory marketing-vs-reality caveat honestly (1/segundo vs ~3 s)', () => {
    const xiaomi = piece!.refs.find((r) => r.id === 'xiaomi-dark-factory')!
    // honest scope note: corrects the "one phone per second" marketing claim
    expect((xiaomi.note ?? '').toLowerCase()).toMatch(/segundo|3,15|3\.15/)
  })

  it('is fully covered by the global ref guards (sourced, unique ids, code↔invId)', () => {
    expect(() => assertRefsSourced([piece!])).not.toThrow()
    const ids = piece!.refs.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('wall-refs — refs stay separate from the code-track charts', () => {
  it('a ref slug is not also a chart slug (no registry collision)', () => {
    for (const slug of Object.keys(WALL_REFS)) {
      expect(pieceBySlug(slug), `'${slug}' must not also be a chart piece`).toBeUndefined()
    }
  })

  it('wall 13 has no code-track chart data — it is grounded by refs only', () => {
    expect(dataForWall(13)).toEqual([])
  })

  it('references never enter allData(), so the single-unit chart invariant is untouched', () => {
    const refClaims = new Set(allRefs().map((r) => r.claim))
    for (const d of allData()) {
      expect(refClaims.has(d.figure)).toBe(false)
    }
    // and the chart pieces are unchanged in count by the ref additions
    expect(allPieces().every((p) => Array.isArray(p.data))).toBe(true)
  })
})
