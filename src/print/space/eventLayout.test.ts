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
  it('registers all 25 event walls (invId 17 retired)', () => {
    expect(REGISTERED_WALLS).toHaveLength(25)
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

  it('exposes invIds 1..26 minus the retired #17, unique', () => {
    const ids = REGISTERED_WALLS.map((w) => w.registry!.invId).sort((a, b) => a - b)
    // The confesionario (#17) was retired (folded into wall 12's reverse face), so
    // the inventory skips it: 25 walls, ids 1..16 + 18..26 (22..25 = the S2 central
    // cube, 26 = the added S1 Bici/combustión backdrop wall).
    expect(ids).toEqual([...Array.from({ length: 16 }, (_, i) => i + 1), 18, 19, 20, 21, 22, 23, 24, 25, 26])
    expect(new Set(ids).size).toBe(25)
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
  it('resolves every live id to the matching wall (#17 retired ⇒ undefined)', () => {
    for (let n = 1; n <= 26; n++) {
      const w = findWallByInvId(n)
      if (n === 17) {
        expect(w).toBeUndefined()
        continue
      }
      expect(w).toBeDefined()
      expect(w!.registry!.invId).toBe(n)
    }
  })

  it('returns undefined for out-of-range / invalid ids', () => {
    expect(findWallByInvId(0)).toBeUndefined()
    expect(findWallByInvId(27)).toBeUndefined()
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
