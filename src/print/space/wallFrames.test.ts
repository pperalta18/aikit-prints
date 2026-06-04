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
    for (const w of REGISTERED_WALLS) {
      const fs = forWall(w.registry!.invId)
      for (const side of [1, -1] as const) {
        const faceWidth = sumWidth(fs.filter((f) => f.side === side))
        // Cuts have zero gap, so the panels reconstruct the wall run within a sliver.
        expect(Math.abs(faceWidth - w.length)).toBeLessThan(0.5)
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
    // Cut at the real divisoria projections → 6.75 / 7 / 8.75, no longer equal thirds.
    expect(widths).toEqual([6.75, 7, 8.75])
    expect(sumWidth(naveBays)).toBeCloseTo(findWallByInvId(2)!.length, 5)
  })

  it('cuts wall 11 nave face at the divisoria positions (unequal bays)', () => {
    const naveBays = forWall(11).filter((f) => f.zone)
    expect(naveBays.map((f) => f.zone)).toEqual([...NAVE_ZONE_ORDER])
    const widths = naveBays.map((f) => f.widthM)
    // Cut at the real divisoria projections → 9.25 / 7 / 5.75, not equal thirds.
    expect(widths).toEqual([9.25, 7, 5.75])
    expect(sumWidth(naveBays)).toBeCloseTo(findWallByInvId(11)!.length, 5)
  })

  it('only walls 2 and 11 carry nave zones', () => {
    const zoned = new Set(frames.filter((f) => f.zone).map((f) => f.invId))
    expect([...zoned].sort((a, b) => a - b)).toEqual([2, 11])
  })
})
