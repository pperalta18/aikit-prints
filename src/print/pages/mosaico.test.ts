import { describe, expect, it } from 'vitest'
import {
  mosaicGrid,
  packBays,
  baysWidth,
  fillBays,
  type MosaicBay,
} from './mosaico'

/** The 11-E-2 wall (La Naranja Mecánica). */
const WALL = { widthMm: 12250, heightMm: 2500, rows: 4 }

describe('mosaicGrid — near-square unit grid that fills the wall exactly', () => {
  const g = mosaicGrid(WALL)

  it('is 4 rows × 20 cols for the 12.25×2.5 m wall', () => {
    expect(g.rows).toBe(4)
    expect(g.cols).toBe(20)
  })

  it('cells tile the wall with no remainder', () => {
    expect(g.cellWMm * g.cols).toBeCloseTo(WALL.widthMm, 6)
    expect(g.cellHMm * g.rows).toBeCloseTo(WALL.heightMm, 6)
  })

  it('keeps cells near-square (within ~5%)', () => {
    const ratio = g.cellWMm / g.cellHMm
    expect(ratio).toBeGreaterThan(0.95)
    expect(ratio).toBeLessThan(1.05)
  })

  it('a 3×2 landscape footprint ≈ the source 1.43∶1 images', () => {
    const r = (3 * g.cellWMm) / (2 * g.cellHMm)
    expect(r).toBeGreaterThan(1.35)
    expect(r).toBeLessThan(1.6)
  })

  it('is deterministic', () => {
    const h = mosaicGrid(WALL)
    expect(h).toEqual(g)
  })
})

/** A composition that exactly fills the 20-col wall: images + solids + placeholders. */
const BAYS: MosaicBay[] = [
  { cols: 3, slots: [{ kind: 'image', image: 'vending', rows: 2 }, { kind: 'solid', rows: 2 }] },
  { cols: 2, slots: [{ kind: 'placeholder', rows: 4 }] },
  { cols: 3, slots: [{ kind: 'solid', rows: 2 }, { kind: 'image', image: 'taxi', rows: 2 }] },
  { cols: 6, slots: [{ kind: 'image', image: 'poster', rows: 4 }] },
  { cols: 3, slots: [{ kind: 'image', image: 'landscape', rows: 2 }, { kind: 'placeholder', rows: 2 }] },
  { cols: 3, slots: [{ kind: 'placeholder', rows: 2 }, { kind: 'solid', rows: 2 }] },
]

describe('packBays — full-height bays that tile the wall', () => {
  const g = mosaicGrid(WALL)
  const tiles = packBays(BAYS, g)

  it('content sums to the full wall width', () => {
    expect(baysWidth(BAYS)).toBe(g.cols)
  })

  it('covers every grid cell exactly once (no gaps, no overlaps)', () => {
    const seen = Array.from({ length: g.rows }, () => new Array<number>(g.cols).fill(0))
    for (const t of tiles) {
      for (let r = t.row; r < t.row + t.rows; r++) {
        for (let c = t.col; c < t.col + t.cols; c++) {
          seen[r][c] += 1
        }
      }
    }
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        expect(seen[r][c]).toBe(1)
      }
    }
  })

  it('keeps every tile inside the wall', () => {
    for (const t of tiles) {
      expect(t.col).toBeGreaterThanOrEqual(0)
      expect(t.row).toBeGreaterThanOrEqual(0)
      expect(t.col + t.cols).toBeLessThanOrEqual(g.cols)
      expect(t.row + t.rows).toBeLessThanOrEqual(g.rows)
    }
  })

  it('derives mm rects from the grid cell size', () => {
    for (const t of tiles) {
      expect(t.xMm).toBeCloseTo(t.col * g.cellWMm, 6)
      expect(t.yMm).toBeCloseTo(t.row * g.cellHMm, 6)
      expect(t.wMm).toBeCloseTo(t.cols * g.cellWMm, 6)
      expect(t.hMm).toBeCloseTo(t.rows * g.cellHMm, 6)
    }
  })

  it('places all four real images once each', () => {
    const imgs = tiles.filter((t) => t.slot.kind === 'image').map((t) => t.slot.image).sort()
    expect(imgs).toEqual(['landscape', 'poster', 'taxi', 'vending'])
  })

  it('is deterministic', () => {
    expect(packBays(BAYS, g)).toEqual(tiles)
  })
})

describe('packBays — clips overflow to the wall', () => {
  const g = mosaicGrid(WALL)
  it('clips a bay that runs past the right edge and stops', () => {
    const wide: MosaicBay[] = [
      { cols: 18, slots: [{ kind: 'solid', rows: 4 }] },
      { cols: 6, slots: [{ kind: 'solid', rows: 4 }] }, // would overflow → clipped to 2
      { cols: 4, slots: [{ kind: 'solid', rows: 4 }] }, // past the edge → dropped
    ]
    const tiles = packBays(wide, g)
    expect(tiles).toHaveLength(2)
    expect(tiles[0].cols).toBe(18)
    expect(tiles[1].cols).toBe(2)
    expect(tiles[1].col + tiles[1].cols).toBe(g.cols)
  })

  it('clips a slot stack that overflows the height', () => {
    const tall: MosaicBay[] = [{ cols: 4, slots: [{ kind: 'solid', rows: 3 }, { kind: 'solid', rows: 3 }] }]
    const tiles = packBays(tall, g)
    expect(tiles).toHaveLength(2)
    expect(tiles[0].rows).toBe(3)
    expect(tiles[1].rows).toBe(1) // clipped from 3 → 1 so it stays in the 4-row wall
  })
})

describe('fillBays — tops content up to the full wall', () => {
  const g = mosaicGrid(WALL)
  const filler = (index: number, cols: number, rows: number): MosaicBay => ({
    cols,
    slots: [{ kind: index % 2 ? 'solid' : 'placeholder', rows }],
  })

  it('fills a short content list to exactly the wall width', () => {
    const short: MosaicBay[] = [{ cols: 6, slots: [{ kind: 'image', image: 'poster', rows: 4 }] }]
    const full = fillBays(short, g, filler)
    expect(baysWidth(full)).toBe(g.cols)
    expect(packBays(full, g)).toHaveLength(
      // 1 hero + however many fillers were appended
      full.length,
    )
  })

  it('leaves an already-full list untouched', () => {
    expect(fillBays(BAYS, g, filler)).toBe(BAYS)
  })
})
