import { describe, expect, it } from 'vitest'
import {
  NAVE_ZONE_ORDER,
  computeWallFrames,
  type WallFrame,
} from './wallFrames'
import { REGISTERED_WALLS, WALLS, findWallByInvId, resolveWallHeight } from './eventLayout'

/**
 * wallFrames tests
 * ────────────────
 * Prove the blank-frame split is the one the brief demands, derived from the
 * committed venue geometry rather than asserted by hand: both faces of every wall,
 * each face cut where another wall meets it, and the nave side walls (2, 11) cut at
 * the divisoria projection into the three cámaras.
 */

const frames = computeWallFrames({ walls: REGISTERED_WALLS, allWalls: WALLS })
const forWall = (invId: number): WallFrame[] => frames.filter((f) => f.invId === invId)
const sumWidth = (fs: WallFrame[]) => fs.reduce((a, f) => a + f.widthM, 0)

describe('coverage', () => {
  it('frames every registry wall on both faces', () => {
    for (const w of REGISTERED_WALLS) {
      const fs = forWall(w.registry!.invId)
      expect(fs.some((f) => f.side === 1)).toBe(true)
      expect(fs.some((f) => f.side === -1)).toBe(true)
    }
  })

  it('gives every frame a positive size and a unique id', () => {
    expect(frames.length).toBeGreaterThan(0)
    for (const f of frames) {
      expect(f.widthM).toBeGreaterThan(0)
      expect(f.heightM).toBeGreaterThan(0)
    }
    expect(new Set(frames.map((f) => f.id)).size).toBe(frames.length)
  })

  it('each face\'s panels tile the full wall length (sum of widths ≈ wall length)', () => {
    // The central S2 cube (inv 22–25) is a free-standing box: each OUTER face clads
    // the whole side (wall length + the neighbour's 0.5 m depth) so the four prints
    // wrap to the corner edges, while the occluded INNER faces pull in at the corners.
    const CUBE_INV = new Set([22, 23, 24, 25])
    for (const w of REGISTERED_WALLS) {
      const inv = w.registry!.invId
      const fs = forWall(inv)
      for (const side of [1, -1] as const) {
        const faceWidth = sumWidth(fs.filter((f) => f.side === side))
        if (CUBE_INV.has(inv)) {
          // Outer face overhangs by ≤ one neighbour depth (0.5 m); inner stays ≥ half.
          expect(faceWidth).toBeGreaterThan(w.length / 2 - 0.05)
          expect(faceWidth).toBeLessThanOrEqual(w.length + 0.6)
        } else {
          // Cuts have zero gap, so panels reconstruct the wall run within a sliver —
          // minus any corner inset where a wall stands on the face (e.g. the nave end
          // wall over wall 2's INVERSIÓN corner pulls that bay 0.5 m off the end).
          expect(faceWidth).toBeLessThanOrEqual(w.length + 0.01)
          expect(faceWidth).toBeGreaterThan(w.length - 1.05)
        }
      }
    }
  })

  it('frame height equals the host wall height', () => {
    for (const f of frames) {
      const wall = REGISTERED_WALLS.find((w) => w.id === f.wallId)!
      expect(f.heightM).toBeCloseTo(resolveWallHeight(wall), 5)
    }
  })
})

describe('abutment cuts', () => {
  it('splits wall 9 east face into three interior panels where other walls meet it', () => {
    const east = forWall(9).filter((f) => f.id.startsWith('9-E'))
    expect(east).toHaveLength(3) // 9-E-1 + 9-E-2 + 9-E-3
    // The back face is uncut (nothing touches it).
    expect(forWall(9).filter((f) => f.id.startsWith('9-W'))).toHaveLength(1)
  })

  it("splits wall 2's S1 face where walls 10 and 1 meet it (3 panels)", () => {
    const w = forWall(2).filter((f) => f.side === -1) // W / S1 face
    expect(w).toHaveLength(3)
  })
})

describe('nave zone projection', () => {
  it('cuts wall 2 nave face into the three cámaras (unequal bays)', () => {
    const naveBays = forWall(2).filter((f) => f.zone)
    expect(naveBays.map((f) => f.zone)).toEqual([...NAVE_ZONE_ORDER])
    const widths = naveBays.map((f) => f.widthM)
    // 2026-06-06 plan: divisoria projections → 7 / 6.625, INVERSIÓN pulled 0.5 m off
    // the back-wall corner (it stands on this face for the last 0.5 m) → 8.625.
    expect(widths).toEqual([7, 6.625, 8.625])
    expect(sumWidth(naveBays)).toBeCloseTo(findWallByInvId(2)!.length - 0.5, 5)
  })

  it('cuts wall 11 nave face at the divisoria positions (unequal bays)', () => {
    const naveBays = forWall(11).filter((f) => f.zone)
    expect(naveBays.map((f) => f.zone)).toEqual([...NAVE_ZONE_ORDER])
    const widths = naveBays.map((f) => f.widthM)
    // 2026-06-06 plan: cut at the real divisoria projections → 9.25 / 6.625 / 6.125.
    expect(widths).toEqual([9.25, 6.625, 6.125])
    expect(sumWidth(naveBays)).toBeCloseTo(findWallByInvId(11)!.length, 5)
  })

  it('only walls 2 and 11 carry nave zones', () => {
    const zoned = new Set(frames.filter((f) => f.zone).map((f) => f.invId))
    expect([...zoned].sort((a, b) => a - b)).toEqual([2, 11])
  })
})
