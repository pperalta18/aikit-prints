import { describe, expect, it } from 'vitest'
import { placeWarpSpheres, warpBodies, type WarpRegion, type PlaceOpts } from './warp-bodies'

const SEAM_MARGIN = 220
const EDGE_MARGIN = 170
const SEAMS = [5750, 15250] // unfold order [11-W | 5N1 | 2-E]
const W = 23500
const H = 2500

// hole as the page projects it: holeCenterXMm 10500 (5N1 centre), foreshorten 0.38, holeR ≈ 812
const OPTS: PlaceOpts = {
  widthMm: W,
  heightMm: H,
  hole: { cx: 10500, cy: 0.63 * H, rx: 812, ry: 812 * 0.38 },
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

describe('warpBodies — unfold [11-W | 5N1 | 2-E] with the director swaps', () => {
  it('companies→left (11-W), nations+spanish→centre, sectors→right (2-E)', () => {
    const bodies = warpBodies()
    expect(bodies.length).toBe(16 + 4 + 18 + 15 - 1) // sectors + countries + spanish + companies, minus Suiza (dropped from the warp)
    expect(bodies.find((b) => b.id === 'coca-cola')?.region).toBe('left') // a company → 11-W
    expect(bodies.find((b) => b.id === 'whisky')?.region).toBe('right') // a sector → 2-E
    expect(bodies.find((b) => b.id === 'inditex')?.region).toBe('center')
    expect(bodies.find((b) => b.id === 'portugal')?.region).toBe('center')
    // swaps: brands/markets → centre; nations → the laterals
    expect(bodies.find((b) => b.id === 'netflix')?.region).toBe('center')
    expect(bodies.find((b) => b.id === 'switzerland')).toBeUndefined() // dropped from the warp (stays in the orbital galaxy)
    expect(bodies.find((b) => b.id === 'vino')?.region).toBe('center')
    expect(bodies.find((b) => b.id === 'norway')?.region).toBe('right') // ↔ Vino (a sector, 2-E)
    expect(bodies.find((b) => b.id === 'smartphones')?.region).toBe('center')
    expect(bodies.find((b) => b.id === 'argentina')?.region).toBe('right') // ↔ Smartphones (a sector, 2-E)
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
      expect(p.cx - p.r).toBeGreaterThanOrEqual(xMin - 1e-6)
      expect(p.cx + p.r).toBeLessThanOrEqual(xMax + 1e-6)
      expect(p.labelBox.x).toBeGreaterThanOrEqual(xMin - 1e-6)
      expect(p.labelBox.x + p.labelBox.w).toBeLessThanOrEqual(xMax + 1e-6)
      expect(p.cy - p.r).toBeGreaterThanOrEqual(EDGE_MARGIN - 1e-6)
      expect(p.labelBox.y + p.labelBox.h).toBeLessThanOrEqual(H - EDGE_MARGIN + 1e-6)
    }
  })

  it('explicitly clears the print cuts by the full margin', () => {
    for (const seam of SEAMS) {
      for (const p of res.placed) {
        const left = Math.min(p.cx - p.r, p.labelBox.x)
        const right = Math.max(p.cx + p.r, p.labelBox.x + p.labelBox.w)
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

describe('placeWarpSpheres — keep-outs (e.g. the 2-E chart) clear of spheres + labels', () => {
  // the frontier chart on 2-E, in full-canvas coords (originX 15250 + wall-local box)
  const chart = { x: 15250 + 4619.25, y: 348, w: 3136.5, h: 1804 }
  const res = placeWarpSpheres({ ...OPTS, keepouts: [chart] })

  it('still places nearly every body', () => {
    expect(res.placed.length).toBeGreaterThanOrEqual(warpBodies().length - 3)
  })

  it('no sphere and no label overlaps the chart rectangle', () => {
    const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const intersects = (px: number, py: number, pw: number, ph: number) =>
      px < chart.x + chart.w && px + pw > chart.x && py < chart.y + chart.h && py + ph > chart.y
    for (const p of res.placed) {
      // sphere circle clears the chart (nearest point on the rect is ≥ r away)
      const nx = clampN(p.cx, chart.x, chart.x + chart.w)
      const ny = clampN(p.cy, chart.y, chart.y + chart.h)
      expect(Math.hypot(p.cx - nx, p.cy - ny)).toBeGreaterThanOrEqual(p.r - 1e-6)
      // label box doesn't intersect the chart
      expect(intersects(p.labelBox.x, p.labelBox.y, p.labelBox.w, p.labelBox.h)).toBe(false)
    }
  })
})
