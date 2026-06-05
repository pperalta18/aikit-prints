import { describe, expect, it } from 'vitest'
import { buildWarpField, holeRadiusForIaNvidia, WARP_MAX_RADIUS_FRAC } from './warp'
import { circleAreaScale } from './dataviz-scales'
import { GALAXY_SUN, GALAXY_PLANETS, galaxyMaxValue } from '../space/galaxy-data'

const CANVAS = { widthMm: 23500, heightMm: 2500 }

describe('holeRadiusForIaNvidia — the dark centre = area(IA) + area(Nvidia)', () => {
  it('is the area-additive disc at the shared galaxy scale', () => {
    const scale = circleAreaScale({ maxValue: galaxyMaxValue(), maxRadius: 2500 * WARP_MAX_RADIUS_FRAC })
    const rIa = scale.radius(GALAXY_SUN.value)
    const rNv = scale.radius(GALAXY_PLANETS[0].value)
    const holeR = holeRadiusForIaNvidia(2500)
    expect(Math.PI * holeR * holeR).toBeCloseTo(Math.PI * rIa * rIa + Math.PI * rNv * rNv, 2)
    // combined is bigger than Nvidia alone (the global-max body)
    expect(holeR).toBeGreaterThan(rNv)
  })
})

describe('buildWarpField — deterministic gravity-well tiling', () => {
  const f = buildWarpField(CANVAS)

  it('is deterministic for the same options', () => {
    const g = buildWarpField(CANVAS)
    expect(g.cells.length).toBe(f.cells.length)
    expect(g.cells[0].points).toEqual(f.cells[0].points)
  })

  it('tiles rings × spokes into cells with finite coordinates', () => {
    expect(f.cells.length).toBe((f.radii.length - 1) * 72)
    for (const c of f.cells) {
      for (const p of c.points) {
        expect(Number.isFinite(p.x)).toBe(true)
        expect(Number.isFinite(p.y)).toBe(true)
      }
    }
  })

  it('darkens toward the hole (shade rises with radius, stays in 0…1)', () => {
    const inner = f.cells.find((c) => c.ring === 0)!
    const outer = f.cells[f.cells.length - 1]
    expect(inner.shade).toBeLessThan(outer.shade)
    expect(inner.shade).toBeLessThan(0.05) // the rim ring is the deepest (its mid-radius hugs the rim)
    expect(outer.shade).toBe(1) // the far field is fully white
    for (const c of f.cells) {
      expect(c.shade).toBeGreaterThanOrEqual(0)
      expect(c.shade).toBeLessThanOrEqual(1)
    }
  })

  it('starts the rings at the hole rim and tiles out past every canvas corner', () => {
    expect(f.radii[0]).toBeCloseTo(f.holeRadiusMm, 6)
    const maxR = f.radii[f.radii.length - 1]
    const corners: Array<[number, number]> = [
      [0, 0],
      [CANVAS.widthMm, 0],
      [0, CANVAS.heightMm],
      [CANVAS.widthMm, CANVAS.heightMm],
    ]
    for (const [xc, yc] of corners) {
      const X = xc - f.holeCenterX
      const Y = (yc - f.cyHorizon) / f.foreshorten
      expect(Math.hypot(X, Y)).toBeLessThanOrEqual(maxR + 1e-6)
    }
  })

  it('projects the black hole centred low, with an elliptical (foreshortened) rim', () => {
    expect(f.hole.cx).toBeCloseTo(13000, 6)
    expect(f.hole.cy).toBeCloseTo(0.56 * 2500, 6)
    expect(f.hole.ry).toBeCloseTo(f.hole.rx * f.foreshorten, 6)
    expect(f.holeCenterX).toBeCloseTo(13000, 6)
  })
})
