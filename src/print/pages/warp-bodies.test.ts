import { describe, expect, it } from 'vitest'
import { placeWarpSpheres, warpBodies, type WarpRegion, type PlaceOpts } from './warp-bodies'

const SEAM_MARGIN = 220
const EDGE_MARGIN = 170
const SEAMS = [8250, 17750]
const W = 23500
const H = 2500

// hole as the page projects it: holeCenterYFrac 0.6, foreshorten 0.42, holeR ≈ 812
const OPTS: PlaceOpts = {
  widthMm: W,
  heightMm: H,
  hole: { cx: 13000, cy: 0.6 * H, rx: 812, ry: 812 * 0.42 },
  seams: SEAMS,
  seamMarginMm: SEAM_MARGIN,
  edgeMarginMm: EDGE_MARGIN,
  seed: 7,
}

const BANDS: Record<WarpRegion, [number, number]> = {
  left: [EDGE_MARGIN, SEAMS[0] - SEAM_MARGIN],
  center: [SEAMS[0] + SEAM_MARGIN, SEAMS[1] - SEAM_MARGIN],
  right: [SEAMS[1] + SEAM_MARGIN, W - EDGE_MARGIN],
}

describe('warpBodies — region map mirrors the walls, with the director swaps', () => {
  it('tags by wall, then applies Suiza↔Netflix / Noruega↔Vino / Argentina↔Smartphones', () => {
    const bodies = warpBodies()
    expect(bodies.length).toBe(16 + 4 + 18 + 15) // sectors + countries + spanish + companies
    expect(bodies.find((b) => b.id === 'inditex')?.region).toBe('center') // spanish stays centre
    expect(bodies.find((b) => b.id === 'portugal')?.region).toBe('center') // unswapped nation stays centre
    // swaps: brands/markets → centre, nations → laterals
    expect(bodies.find((b) => b.id === 'netflix')?.region).toBe('center')
    expect(bodies.find((b) => b.id === 'switzerland')?.region).toBe('right')
    expect(bodies.find((b) => b.id === 'vino')?.region).toBe('center')
    expect(bodies.find((b) => b.id === 'norway')?.region).toBe('left')
    expect(bodies.find((b) => b.id === 'smartphones')?.region).toBe('center')
    expect(bodies.find((b) => b.id === 'argentina')?.region).toBe('left')
  })
})

describe('placeWarpSpheres — seam-safe, edge-safe, collision-free', () => {
  const res = placeWarpSpheres(OPTS)

  it('places (nearly) every body', () => {
    expect(res.placed.length).toBeGreaterThanOrEqual(warpBodies().length - 2)
  })

  it('is deterministic for a fixed seed', () => {
    const again = placeWarpSpheres(OPTS)
    expect(again.placed.map((p) => [p.id, p.cx, p.cy])).toEqual(res.placed.map((p) => [p.id, p.cx, p.cy]))
  })

  it('never lets a sphere OR its label cross a seam / canvas edge', () => {
    for (const p of res.placed) {
      const [xMin, xMax] = BANDS[p.region]
      // sphere fully inside its region band (so clear of both seams by ≥ margin)
      expect(p.cx - p.r).toBeGreaterThanOrEqual(xMin - 1e-6)
      expect(p.cx + p.r).toBeLessThanOrEqual(xMax + 1e-6)
      // label plate fully inside the band too
      expect(p.labelBox.x).toBeGreaterThanOrEqual(xMin - 1e-6)
      expect(p.labelBox.x + p.labelBox.w).toBeLessThanOrEqual(xMax + 1e-6)
      // vertical: inside the canvas with edge margin
      expect(p.cy - p.r).toBeGreaterThanOrEqual(EDGE_MARGIN - 1e-6)
      expect(p.labelBox.y + p.labelBox.h).toBeLessThanOrEqual(H - EDGE_MARGIN + 1e-6)
    }
  })

  it('explicitly clears the print cuts by the full margin', () => {
    for (const seam of SEAMS) {
      for (const p of res.placed) {
        const left = Math.min(p.cx - p.r, p.labelBox.x)
        const right = Math.max(p.cx + p.r, p.labelBox.x + p.labelBox.w)
        // the item is entirely on one side of the gutter [seam-margin, seam+margin]
        const clearLeft = right <= seam - SEAM_MARGIN + 1e-6
        const clearRight = left >= seam + SEAM_MARGIN - 1e-6
        expect(clearLeft || clearRight).toBe(true)
      }
    }
  })

  it('keeps every sphere off the black hole', () => {
    for (const p of res.placed) {
      const dx = p.cx - OPTS.hole.cx
      const dy = p.cy - OPTS.hole.cy
      const ex = OPTS.hole.rx + p.r
      const ey = OPTS.hole.ry + p.r
      expect((dx * dx) / (ex * ex) + (dy * dy) / (ey * ey)).toBeGreaterThanOrEqual(1 - 1e-6)
    }
  })

  it('never overlaps two spheres', () => {
    for (let i = 0; i < res.placed.length; i++) {
      for (let j = i + 1; j < res.placed.length; j++) {
        const a = res.placed[i]
        const b = res.placed[j]
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.r + b.r - 1e-6)
      }
    }
  })
})
