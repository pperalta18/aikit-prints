import { describe, expect, it } from 'vitest'
import {
  CORNER_WRAP_FACES,
  NAVE_ZONE_ORDER,
  PARED_COMPLETA_FACES,
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
    // Cuts have zero gap, so a face's panels reconstruct the wall run within a sliver —
    // minus any corner inset where a wall stands on the face (e.g. the nave end wall
    // over wall 2's INVERSIÓN corner pulls that bay 0.5 m off the end), plus any
    // outer-corner wrap that claddings a neighbour's return (e.g. 31-S out to 27).
    // The central S2 cube (inv 22–25) was removed in the 2026-06-08 plan, so no
    // free-standing box remains.
    const wrapExtra = (invId: number, side: 1 | -1): number =>
      CORNER_WRAP_FACES.filter((c) => c.invId === invId && c.side === side).reduce(
        (a, c) => a + (findWallByInvId(c.neighborInvId)?.thickness ?? 0),
        0,
      )
    for (const w of REGISTERED_WALLS) {
      const fs = forWall(w.registry!.invId)
      for (const side of [1, -1] as const) {
        const faceWidth = sumWidth(fs.filter((f) => f.side === side))
        expect(faceWidth).toBeLessThanOrEqual(w.length + wrapExtra(w.registry!.invId, side) + 0.01)
        expect(faceWidth).toBeGreaterThan(w.length - 1.05)
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

describe('outer-corner wrap (TV alcove)', () => {
  it("SW corner: claddings wall 31's south face out to wall 27's outer (west) face", () => {
    const south = forWall(31).filter((f) => f.side === 1)
    expect(south).toHaveLength(1) // still one panel — nothing cuts this face
    const wall31 = findWallByInvId(31)!
    const wall27 = findWallByInvId(27)!
    // 31 is drawn 2.5 m and stops at 27's inner face; wrapping 27's 0.25 m return
    // carries it to 2.75 m.
    expect(south[0].widthM).toBeCloseTo(wall31.length + wall27.thickness, 5)
    // its west edge now sits on 27's *west* (outer) face, not 27's inner face.
    const westEdge = south[0].alongCenter - south[0].widthM / 2
    expect(westEdge).toBeCloseTo(wall27.cx - wall27.thickness / 2, 5)
  })

  it("west bay NW corner: claddings wall 28's west face up to wall 30's north edge", () => {
    const west = forWall(28).filter((f) => f.side === -1)
    expect(west).toHaveLength(1) // single panel — nothing cuts this face
    const wall28 = findWallByInvId(28)!
    const wall30 = findWallByInvId(30)!
    // 28-W is drawn 1.5 m and stops at wall 30's south edge; wrapping 30's 0.25 m
    // west-end return carries it to 1.75 m.
    expect(west[0].widthM).toBeCloseTo(wall28.length + wall30.thickness, 5)
    // its north end now reaches wall 30's north (outer) edge. Run axis is z, so the
    // wrapped (low-z / north) edge = alongCenter − widthM/2.
    const northEdge = west[0].alongCenter - west[0].widthM / 2
    expect(northEdge).toBeCloseTo(wall30.cz - wall30.thickness / 2, 5)
  })

  it('does NOT wrap the opposite (north) face — only the curated south side grows', () => {
    const wall31 = findWallByInvId(31)!
    const drawnStart = wall31.cx - wall31.length / 2 // 27's inner (east) face
    const north = forWall(31).filter((f) => f.side === -1)
    const westEdge = Math.min(...north.map((f) => f.alongCenter - f.widthM / 2))
    expect(westEdge).toBeCloseTo(drawnStart, 5) // unwrapped: stops at 27's inner face
  })
})

describe('nave zone projection', () => {
  it('cuts wall 2 nave face into the three cámaras (unequal bays)', () => {
    const naveBays = forWall(2).filter((f) => f.zone)
    expect(naveBays.map((f) => f.zone)).toEqual([...NAVE_ZONE_ORDER])
    const widths = naveBays.map((f) => f.widthM)
    // 2026-06-08 plan: inv16 (TEXT+CODE↔INVERSIÓN divisoria) moved +0.875 m south, so
    // its projection shifts the cut — TEXT+CODE grows 6.625→7.5, INVERSIÓN shrinks
    // 8.625→7.75 (still pulled 0.5 m off the back-wall corner). IMAGE (inv12) unmoved → 7.
    expect(widths).toEqual([7, 7.5, 7.75])
    expect(sumWidth(naveBays)).toBeCloseTo(findWallByInvId(2)!.length - 0.5, 5)
  })

  it('cuts wall 11 nave face at the divisoria positions (unequal bays)', () => {
    const naveBays = forWall(11).filter((f) => f.zone)
    expect(naveBays.map((f) => f.zone)).toEqual([...NAVE_ZONE_ORDER])
    const widths = naveBays.map((f) => f.widthM)
    // 2026-06-08 plan: inv16 moved +0.875 m south → TEXT+CODE grows 6.625→7.5,
    // INVERSIÓN shrinks 7.125→6.25. IMAGE (inv12 at y50) unmoved → 9.25.
    expect(widths).toEqual([9.25, 7.5, 6.25])
    expect(sumWidth(naveBays)).toBeCloseTo(findWallByInvId(11)!.length, 5)
  })

  it('only walls 2 and 11 carry nave zones', () => {
    const zoned = new Set(frames.filter((f) => f.zone).map((f) => f.invId))
    expect([...zoned].sort((a, b) => a - b)).toEqual([2, 11])
  })
})

describe('full-face (pared completa)', () => {
  const full = computeWallFrames({ walls: REGISTERED_WALLS, allWalls: WALLS, fullFaces: PARED_COMPLETA_FACES })
  const frameId = (id: string) => full.find((f) => f.id === id)

  it('collapses each nave face into ONE full-wall frame the combined print mounts on', () => {
    // 11-W spans the whole face (no corner inset) = the three cámaras combined.
    const w11 = frameId('11-W')
    expect(w11).toBeDefined()
    expect(w11!.zone).toBeUndefined()
    expect(w11!.widthM).toBeCloseTo(findWallByInvId(11)!.length, 5) // 23 m
    // 2-E pulls 0.5 m off the back-wall corner (same inset as the bays' sum).
    const w2 = frameId('2-E')
    expect(w2).toBeDefined()
    expect(w2!.widthM).toBeCloseTo(findWallByInvId(2)!.length - 0.5, 5) // 22.25 m
  })

  it('drops the three cámara bays on the pared face but keeps the opposite face split', () => {
    // No zoned bays remain on 11-W / 2-E …
    expect(full.filter((f) => f.zone).length).toBe(0)
    // … while the other face of each wall still splits normally (11-E: 2, 2-W: 3).
    expect(full.filter((f) => f.invId === 11 && f.side === 1)).toHaveLength(2)
    expect(full.filter((f) => f.invId === 2 && f.side === -1)).toHaveLength(3)
  })

  it('is opt-in — without `fullFaces` the nave still splits into the three cámaras', () => {
    const base = computeWallFrames({ walls: REGISTERED_WALLS, allWalls: WALLS })
    expect(base.find((f) => f.id === '11-W')).toBeUndefined()
    expect(base.filter((f) => f.invId === 11 && f.zone).map((f) => f.zone)).toEqual([...NAVE_ZONE_ORDER])
  })
})
