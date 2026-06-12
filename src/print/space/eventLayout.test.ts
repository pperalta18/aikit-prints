/**
 * Unit tests for the wall-graphics registry (Phase 0, single source of truth).
 *
 * These pin the *contract downstream code relies on* — that every one of the 25
 * event walls carries a complete, well-typed registry; that the stable `invId`
 * is looked up from data (not assumed from array order); that each wall resolves
 * to its array-order code id; and that the by-room lookup understands walls that
 * span two rooms ("S1/S3", "S1→S2"). They deliberately test behaviour and
 * invariants rather than re-pasting the inventory table, so a regression is
 * caught without the test silently agreeing with a corrupted layout file.
 *
 * Two brief anchor facts (inv 1 = 7.0 m, inv 4 = 28.5 m) guard against the
 * geometry being clobbered while injecting registry fields.
 */

import { describe, expect, it } from 'vitest'
import {
  GLASS,
  MOUNTABLE,
  REGISTERED_WALLS,
  WALLS,
  findWall,
  findWallByInvId,
  findWallsBySala,
  type Estado,
  type Track,
} from './eventLayout'

const VALID_ESTADO: Estado[] = ['ok', 'prop', 'pend']
const VALID_TRACK: Track[] = ['C', 'I', 'H', 'C/I']

describe('wall registry — coverage & shape', () => {
  it('registers all 31 event walls (17 + cube 22-25 retired; 27-31 alcove, 32 intro-side, 33-36 ex-cube panels added)', () => {
    expect(REGISTERED_WALLS).toHaveLength(31)
  })

  it('every WALLS element carries a registry (no blank walls)', () => {
    // All 25 footprint walls are inventory walls; none should be unannotated.
    expect(WALLS.every((w) => w.registry != null)).toBe(true)
  })

  it('glass partitions are mountable but carry no registry', () => {
    expect(GLASS.every((w) => w.registry == null)).toBe(true)
    // Glass is still a mountable surface.
    expect(MOUNTABLE.length).toBe(WALLS.length + GLASS.length)
  })

  it('exposes the live invIds, unique (cube #22-25 out; #27-36 added)', () => {
    const ids = REGISTERED_WALLS.map((w) => w.registry!.invId).sort((a, b) => a - b)
    // #17 confesionario + the S2 cube (#22-25) are retired. The 2026-06-08 plan added
    // #27-31 (central TV alcove), #32 (intro-IA side panel, ex wall-new-0) and #33-36
    // (the four ex-cube display panels). Live set = 1..16 + 18..21 + 26..36 (31 walls).
    expect(ids).toEqual([...Array.from({ length: 16 }, (_, i) => i + 1), 18, 19, 20, 21, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36])
    expect(new Set(ids).size).toBe(31)
  })

  it('every registry field is present and well-typed', () => {
    for (const w of REGISTERED_WALLS) {
      const r = w.registry!
      expect(typeof r.invId).toBe('number')
      expect(VALID_ESTADO).toContain(r.estado)
      expect(VALID_TRACK).toContain(r.track)
      expect(typeof r.research).toBe('boolean')
      expect(r.sala.length).toBeGreaterThan(0)
      expect(r.tema.length).toBeGreaterThan(0)
      expect(r.rol.length).toBeGreaterThan(0)
    }
  })
})

describe('wall registry — id convention (invId N ↔ wall-(N-1))', () => {
  it('maps each invId to code id wall-(invId-1), gap-stable', () => {
    // Code ids are derived from invId, so retiring #17 leaves every other wall's id
    // untouched (a gap at wall-16, never a shift of wall-17..wall-20).
    for (const w of REGISTERED_WALLS) {
      expect(w.id).toBe(`wall-${w.registry!.invId - 1}`)
    }
  })
})

describe('findWallByInvId', () => {
  it('resolves every live id to the matching wall (#17 + cube #22-25 ⇒ undefined)', () => {
    const absent = new Set([17, 22, 23, 24, 25])
    for (let n = 1; n <= 36; n++) {
      const w = findWallByInvId(n)
      if (absent.has(n)) {
        expect(w).toBeUndefined()
        continue
      }
      expect(w).toBeDefined()
      expect(w!.registry!.invId).toBe(n)
    }
  })

  it('returns undefined for out-of-range / invalid ids', () => {
    expect(findWallByInvId(0)).toBeUndefined()
    expect(findWallByInvId(37)).toBeUndefined()
    expect(findWallByInvId(-1)).toBeUndefined()
  })

  it('agrees with findWall(id) for the same wall', () => {
    const byInv = findWallByInvId(2)
    const byId = findWall('wall-1')
    expect(byInv).toBe(byId) // same object reference
  })
})

describe('findWallsBySala — room lookup understands spanning walls', () => {
  it('returns only walls whose sala includes the room', () => {
    const s3 = findWallsBySala('S3')
    expect(s3.length).toBeGreaterThan(0)
    expect(s3.every((w) => w.registry!.sala.split(/[\/→]/).includes('S3'))).toBe(true)
  })

  it('includes the double-sided S1/S3 nave wall (inv 2) under both rooms', () => {
    const nave = findWallByInvId(2)!
    expect(nave.registry!.sala).toBe('S1/S3')
    expect(findWallsBySala('S1')).toContain(nave)
    expect(findWallsBySala('S3')).toContain(nave)
  })

  it('splits on the → wayfinding separator (inv 10 = S1→S2)', () => {
    const way = findWallByInvId(10)!
    expect(findWallsBySala('S1')).toContain(way)
    expect(findWallsBySala('S2')).toContain(way)
  })

  it('returns [] for an unknown room', () => {
    expect(findWallsBySala('S9')).toEqual([])
  })
})

describe('geometry preserved through registry injection (brief anchors)', () => {
  // Anchors reflect the 2026-06-06 floor plan (inv 1 7.0→5.5 m, inv 4 28.5→28.25 m).
  it('inv 1 (S1 Bici) is 5.5 m long', () => {
    expect(findWallByInvId(1)!.length).toBeCloseTo(5.5, 5)
  })

  it('inv 4 (Naranja Mecánica light-box) is the 28.25 m run', () => {
    expect(findWallByInvId(4)!.length).toBeCloseTo(28.25, 5)
  })
})
