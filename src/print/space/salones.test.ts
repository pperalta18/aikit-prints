import { describe, expect, it } from 'vitest'
import { sourceHost } from '../pages/dataviz-scales'
import { findWallByInvId } from './eventLayout'
import {
  WALL_DATA_VERSION,
  allData,
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
} from './wall-data'

/**
 * #20 — "El salón por los siglos" (wall 20, S6 Pobreza histórica). An image /
 * hybrid wall, so it is grounded by the `WALL_REFS` reference schema (like #13),
 * not the code-track charts. These tests are unbiased: they assert wall/registry
 * coherence, the sourced-and-dated contract, the canonical researched figures, the
 * arithmetic of the "Velázquez = X menús" hook, the brief's *validation verdict*
 * being recorded honestly, and that the refs stay clear of the chart invariants.
 */
const SLUG = 'salones-por-siglos'
const piece = refPieceBySlug(SLUG)
const byId = piece ? Object.fromEntries(piece.refs.map((r) => [r.id, r])) : {}

describe('salones — piece exists and mounts on wall 20 (S6, wall-19)', () => {
  it('is registered and resolves to the right wall', () => {
    expect(piece, `${SLUG} ref piece must exist`).toBeDefined()
    expect(piece!.invId).toBe(20)
    expect(piece!.code).toBe('wall-19')
    expect(piece!.sala).toBe('S6')
  })

  it('its wall (#20) is registered, research:true and resolves to wall-19', () => {
    const wall = findWallByInvId(20)
    expect(wall, 'wall invId 20 must be registered').toBeDefined()
    expect(wall!.id).toBe('wall-19')
    expect(wall!.registry!.research, 'wall 20 must be research:true').toBe(true)
  })

  it('refsByInvId(20) returns exactly this piece', () => {
    const refs = refsByInvId(20)
    expect(refs.length).toBe(1)
    expect(refs[0].slug).toBe(SLUG)
  })

  it('exposes a schema version >= 6 (RefCategory extended for #20)', () => {
    expect(WALL_DATA_VERSION).toBeGreaterThanOrEqual(6)
  })
})

describe('salones — every ref is sourced, dated and well-formed', () => {
  it('passes the global ref guard for this piece', () => {
    expect(() => assertRefsSourced([piece!])).not.toThrow()
  })

  it('each ref has a well-formed claim, ISO date and resolvable source host', () => {
    for (const r of piece!.refs) {
      expect(refProblems(r), `ref ${r.id}`).toEqual([])
      expect(isRefItem(r)).toBe(true)
      expect(r.claim.trim()).not.toBe('')
      expect(isIsoDate(r.date)).toBe(true)
      expect(sourceHost(r.sourceURL)).not.toBe('')
    }
  })

  it('any ref with a headline figure carries a positive value and a unit', () => {
    for (const r of piece!.refs) {
      if (r.value !== undefined) {
        expect(r.value, `ref ${r.id}`).toBeGreaterThan(0)
        expect((r.unit ?? '').trim(), `ref ${r.id} unit`).not.toBe('')
      }
    }
  })

  it('ref ids are unique within the piece', () => {
    const ids = piece!.refs.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('carries a non-empty prose sources note', () => {
    expect(piece!.sourcesNote.trim()).not.toBe('')
  })
})

describe('salones — the "por siglos" arc (domestic milestones + a historical anchor)', () => {
  it('covers both new categories: a historical-economics anchor and domestic milestones', () => {
    const categories = new Set(piece!.refs.map((r) => r.category))
    expect(categories).toContain('historical-economics')
    expect(categories).toContain('domestic-milestone')
  })

  it('spans a wide time range — a pre-1960 date AND a present-day (2024+) date', () => {
    const years = piece!.refs.map((r) => parseInt(r.date.slice(0, 4), 10))
    expect(Math.min(...years)).toBeLessThanOrEqual(1956)
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2024)
  })

  it('includes the home-milestone anchors (water, television, connected home)', () => {
    const ids = new Set(piece!.refs.map((r) => r.id))
    expect(ids).toContain('agua-corriente-1950')
    expect(ids).toContain('television-1956')
    expect(ids).toContain('hogar-conectado-2024')
  })
})

describe('salones — canonical researched figures with units', () => {
  it('agua corriente 1950 ≈ a third of dwellings', () => {
    expect(byId['agua-corriente-1950'].value).toBe(33)
    expect((byId['agua-corriente-1950'].unit ?? '').trim()).not.toBe('')
    expect(byId['agua-corriente-1950'].date).toBe('1950')
  })

  it('TVE first broadcast — ~600 sets on 28 Oct 1956', () => {
    expect(byId['television-1956'].value).toBe(600)
    expect(byId['television-1956'].date).toBe('1956-10-28')
  })

  it('connected home 2024 — 96.8 % broadband', () => {
    expect(byId['hogar-conectado-2024'].value).toBe(96.8)
    expect(byId['hogar-conectado-2024'].date).toBe('2024')
  })

  it('attributes each ref to a primary / reputable, dated source host', () => {
    expect(sourceHost(byId['velazquez-sueldo'].sourceURL)).toBe('eldebate.com')
    expect(sourceHost(byId['agua-corriente-1950'].sourceURL)).toBe('juntadeandalucia.es')
    expect(sourceHost(byId['television-1956'].sourceURL)).toBe('elespanol.com')
    expect(sourceHost(byId['hogar-conectado-2024'].sourceURL)).toBe('ine.es')
  })
})

describe('salones — "Velázquez = X menús" validated honestly (the brief asked to validate)', () => {
  const velazquez = byId['velazquez-sueldo']

  it('exists as a historical-economics anchor carrying the king-painter salary', () => {
    expect(velazquez, 'velazquez-sueldo ref must exist').toBeDefined()
    expect(velazquez.category).toBe('historical-economics')
    expect(velazquez.value).toBe(48300) // 192 ducados / 72.000 maravedís ≈ 48.300 € (oro, Simancas)
    expect((velazquez.unit ?? '').trim()).not.toBe('')
  })

  it('carries the brief\'s framing ("= X menús") in its claim', () => {
    expect(velazquez.claim.toLowerCase()).toContain('menús')
  })

  it('the "~3.400 menús" figure is arithmetically consistent with the sourced inputs', () => {
    // 48.300 € / 14,20 € (precio medio del menú del día, Hostelería de España 2024)
    const menus = velazquez.value! / 14.2
    expect(menus).toBeGreaterThan(3300)
    expect(menus).toBeLessThan(3500) // ≈ 3.401 → the claimed "~3.400"
  })

  it('records the validation VERDICT honestly — the menús line is flagged as fragile, not shipped as a clean win', () => {
    const note = (velazquez.note ?? '').toLowerCase()
    // the note must caveat the comparison (Pablo doubts it): an explicit warning +
    // a reframe/cut recommendation, never a silent "Velázquez was poor" claim.
    expect(note).toContain('aviso')
    expect(note).toMatch(/reformular|retirar/)
    expect(note).toMatch(/clase media|poco fiable|distint/)
  })
})

describe('salones — refs stay separate from the code-track charts', () => {
  it('the slug is not also a chart piece (no registry collision)', () => {
    expect(pieceBySlug(SLUG)).toBeUndefined()
  })

  it('wall 20 has no code-track chart data — it is grounded by refs only', () => {
    expect(dataForWall(20)).toEqual([])
  })

  it('the salones refs never enter allData(), so the single-unit chart invariant is untouched', () => {
    const claims = new Set(piece!.refs.map((r) => r.claim))
    for (const d of allData()) expect(claims.has(d.figure)).toBe(false)
  })

  it('the new categories appear only among image-track refs', () => {
    const refCategories = new Set(allRefs().map((r) => r.category))
    expect(refCategories).toContain('domestic-milestone')
    expect(refCategories).toContain('historical-economics')
  })
})

describe('salones — discreet on-wall sources caption', () => {
  it('lists deduped hosts under a "Fuentes:" label', () => {
    const caption = refsSourcesCaptionFor(SLUG)
    expect(caption).toMatch(/^Fuentes:/)
    expect(caption).toContain('ine.es')
    expect(caption).toContain('eldebate.com')
    const hostList = caption.replace(/^Fuentes:\s*/, '').split(' · ')[0]
    const hosts = hostList.split(', ')
    expect(new Set(hosts).size).toBe(hosts.length) // deduped
  })
})
