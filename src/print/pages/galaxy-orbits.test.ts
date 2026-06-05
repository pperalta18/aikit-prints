import { describe, expect, it } from 'vitest'
import { ellipseThroughPoint, orbitParams, pointOnEllipse, type Vec2 } from './galaxy-orbits'

const N: Vec2 = { x: 4750, y: 1250 }

describe('ellipseThroughPoint — the dot is on its own orbit by construction', () => {
  const cases: Array<{ p: Vec2; theta: number; k: number }> = [
    { p: { x: 6000, y: 1400 }, theta: 0.3, k: 0.6 },
    { p: { x: 3000, y: 400 }, theta: 1.7, k: 0.5 },
    { p: { x: 4760, y: 2300 }, theta: -0.9, k: 0.8 }, // near-radial (almost straight down)
    { p: { x: 8000, y: 1250 }, theta: 2.4, k: 0.45 },
  ]

  it('returns an ellipse centred at the nucleus that passes through the point', () => {
    for (const { p, theta, k } of cases) {
      const e = ellipseThroughPoint(N, p, theta, k)!
      expect(e).not.toBeNull()
      expect(e.cx).toBe(N.x)
      expect(e.cy).toBe(N.y)
      expect(e.ry).toBeCloseTo(k * e.rx, 6)
      expect(pointOnEllipse(e, p)).toBe(true)
    }
  })

  it('keeps semi-axes finite and positive even for a near-radial point', () => {
    const e = ellipseThroughPoint(N, { x: 4750.0001, y: 2200 }, 0.0, 0.45)!
    expect(e.rx).toBeGreaterThan(0)
    expect(Number.isFinite(e.rx)).toBe(true)
    expect(Number.isFinite(e.ry)).toBe(true)
  })

  it('returns null only when the point coincides with the nucleus (or k≤0)', () => {
    expect(ellipseThroughPoint(N, { ...N }, 0.5, 0.6)).toBeNull()
    expect(ellipseThroughPoint(N, { x: 6000, y: 1400 }, 0.5, 0)).toBeNull()
    expect(ellipseThroughPoint(N, { x: 6000, y: 1400 }, 0.5, -0.3)).toBeNull()
  })
})

describe('pointOnEllipse', () => {
  it('rejects a point clearly off the ellipse', () => {
    const e = ellipseThroughPoint(N, { x: 6000, y: 1400 }, 0.3, 0.6)!
    expect(pointOnEllipse(e, { x: N.x, y: N.y })).toBe(false) // the centre is not on it
    expect(pointOnEllipse(e, { x: 6000, y: 1900 })).toBe(false)
  })
})

describe('orbitParams — deterministic, eccentric, never a radial spoke', () => {
  it('is deterministic per (seed,index)', () => {
    const a = orbitParams(7, 3, 1.1)
    const b = orbitParams(7, 3, 1.1)
    expect(a).toEqual(b)
  })

  it('keeps k in [0.45, 0.85] and tilts the orbit off the radial heading', () => {
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2 - Math.PI
      const { theta, k } = orbitParams(7, i, angle)
      expect(k).toBeGreaterThanOrEqual(0.45)
      expect(k).toBeLessThanOrEqual(0.85)
      // never equal to the body's radial angle (would render as a spoke)
      expect(Math.abs(theta - angle)).toBeGreaterThan(1e-6)
    }
  })

  it('varies tilt across bodies (orbits cross, not nest)', () => {
    const tilts = new Set<number>()
    for (let i = 0; i < 12; i++) tilts.add(Number(orbitParams(7, i, 0).theta.toFixed(6)))
    expect(tilts.size).toBeGreaterThan(8)
  })
})
