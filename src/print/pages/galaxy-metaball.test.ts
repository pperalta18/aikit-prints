import { describe, expect, it } from 'vitest'
import { circlePath, connector, connectorGeometry, metaballPath, type Circle } from './galaxy-metaball'

const countZ = (d: string) => (d.match(/Z/g) ?? []).length

describe('metaballPath — fused blob (circles + necks)', () => {
  it('a single circle is just its circle subpath', () => {
    const d = metaballPath([{ cx: 0, cy: 0, r: 100 }])
    expect(d).toBe(circlePath({ cx: 0, cy: 0, r: 100 }))
    expect(d.trim().endsWith('Z')).toBe(true)
  })

  it('two close circles → 2 circle subpaths + 1 neck, all closed', () => {
    const circles: Circle[] = [
      { cx: -250, cy: 0, r: 240 }, // anchor (larger)
      { cx: 250, cy: 0, r: 180 },
    ]
    const d = metaballPath(circles)
    expect(countZ(d)).toBe(3) // 2 circles + 1 neck
    expect(d.trim().endsWith('Z')).toBe(true)
    expect(d).toContain('C') // the neck has cubic curves
  })

  it('a 3-circle core stars off the anchor → 3 circles + 2 necks', () => {
    const d = metaballPath([
      { cx: 0, cy: 0, r: 300 }, // anchor
      { cx: 500, cy: 0, r: 160 },
      { cx: -480, cy: 60, r: 150 },
    ])
    expect(countZ(d)).toBe(5)
  })
})

describe('connector guards', () => {
  it('returns null when one circle contains the other', () => {
    expect(connector({ cx: 0, cy: 0, r: 300 }, { cx: 10, cy: 0, r: 50 })).toBeNull()
  })

  it('returns null when the circles are too far apart (no neck)', () => {
    // d = 1000, r1+r2 = 400, reach·min = 180 → maxDistance 580 < 1000
    expect(connector({ cx: 0, cy: 0, r: 220 }, { cx: 1000, cy: 0, r: 180 })).toBeNull()
  })

  it('far-apart circles still render as two separate (valid) circle subpaths', () => {
    const d = metaballPath([
      { cx: 0, cy: 0, r: 220 },
      { cx: 1000, cy: 0, r: 180 },
    ])
    expect(countZ(d)).toBe(2) // no neck
  })

  it('returns null for a non-positive radius', () => {
    expect(connector({ cx: 0, cy: 0, r: 0 }, { cx: 200, cy: 0, r: 100 })).toBeNull()
  })
})

describe('connectorGeometry — two equal circles give a mirror-symmetric neck', () => {
  const a: Circle = { cx: -250, cy: 0, r: 200 }
  const b: Circle = { cx: 250, cy: 0, r: 200 }
  const g = connectorGeometry(a, b)!

  it('rim points mirror across the centre axis (y → −y)', () => {
    expect(g).not.toBeNull()
    expect(g.p1a.x).toBeCloseTo(g.p1b.x, 6)
    expect(g.p1a.y).toBeCloseTo(-g.p1b.y, 6)
    expect(g.p2a.x).toBeCloseTo(g.p2b.x, 6)
    expect(g.p2a.y).toBeCloseTo(-g.p2b.y, 6)
  })

  it('control handles mirror too', () => {
    expect(g.c1.x).toBeCloseTo(g.c4.x, 6)
    expect(g.c1.y).toBeCloseTo(-g.c4.y, 6)
    expect(g.c2.x).toBeCloseTo(g.c3.x, 6)
    expect(g.c2.y).toBeCloseTo(-g.c3.y, 6)
  })

  it('attaches the neck on the facing sides of each circle', () => {
    // anchor a is on the left: its neck points face right (x > cx)
    expect(g.p1a.x).toBeGreaterThan(a.cx)
    // circle b is on the right: its neck points face left (x < cx)
    expect(g.p2a.x).toBeLessThan(b.cx)
  })
})
