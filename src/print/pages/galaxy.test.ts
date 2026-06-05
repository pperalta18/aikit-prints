import { describe, expect, it } from 'vitest'
import { labelMetrics, layoutWall, type GalaxyDatum, type OrbitBody } from './galaxy'
import { pointOnEllipse, type Ellipse } from './galaxy-orbits'

/* Shared-scale params (the same on every wall → honest cross-wall comparison). */
const SHARED = { maxValue: 5.2e12, maxRadius: 675, minRadius: 34, gap: 160 }

const BACK: GalaxyDatum[] = [
  { id: 'ai-sun', label: 'IA', value: 2.33e12, kind: 'sun', group: 'ai' },
  { id: 'nvidia', label: 'Nvidia', value: 5.2e12, kind: 'planet', group: 'ai' },
  { id: 'alphabet', label: 'Alphabet', value: 4.31e12, kind: 'planet', group: 'ai' },
  { id: 'microsoft', label: 'Microsoft', value: 3.17e12, kind: 'planet', group: 'ai' },
  { id: 'meta', label: 'Meta', value: 1.58e12, kind: 'planet', group: 'ai' },
  { id: 'spain', label: 'PIB de España', value: 2.09e12, kind: 'marble', group: 'spanish' },
  { id: 'ibex', label: 'IBEX 35', value: 1.07e12, kind: 'marble', group: 'spanish' },
]

const SIDE: GalaxyDatum[] = [
  { id: 'airlines', label: 'Aerolíneas', value: 0.426e12, kind: 'marble', group: 'market' },
  { id: 'cafe', label: 'Café', value: 0.256e12, kind: 'marble', group: 'market' },
  { id: 'musica', label: 'Música', value: 0.032e12, kind: 'marble', group: 'market' },
  { id: 'tiny', label: 'Vinilo', value: 0.003e12, kind: 'marble', group: 'market' },
]

const inBounds = (b: { cx: number; cy: number; r: number }, w: number, h: number) => {
  const eps = 1e-6
  return b.cx - b.r >= -eps && b.cx + b.r <= w + eps && b.cy - b.r >= -eps && b.cy + b.r <= h + eps
}

/** Vertical half-extent of a rotated ellipse from its centre. */
const vExtent = (e: Ellipse) => Math.hypot(e.rx * Math.sin(e.rotation), e.ry * Math.cos(e.rotation))

/** Name-box below a placed body (same metrics the solver reserved). */
const labelBox = (b: OrbitBody) => {
  const m = labelMetrics(b)
  return { x0: b.cx - m.labelW / 2, y0: b.cy + b.r + m.gapOut, x1: b.cx + m.labelW / 2, y1: b.cy + b.r + m.gapOut + m.labelH }
}
const boxesOverlap = (a: ReturnType<typeof labelBox>, c: ReturnType<typeof labelBox>) => a.x0 < c.x1 && a.x1 > c.x0 && a.y0 < c.y1 && a.y1 > c.y0
const circleHitsBox = (cx: number, cy: number, r: number, box: ReturnType<typeof labelBox>) => {
  const nx = Math.max(box.x0, Math.min(cx, box.x1))
  const ny = Math.max(box.y0, Math.min(cy, box.y1))
  return Math.hypot(cx - nx, cy - ny) < r - 1e-6
}

describe('layoutWall — the back wall (fused AI core, centred)', () => {
  const layout = layoutWall(BACK, { width: 9500, height: 2500, ...SHARED, coreIds: ['ai-sun', 'nvidia'] })

  it('fuses the AI core into a centred metaball nucleus', () => {
    expect(layout.nucleus.kind).toBe('metaball')
    expect(layout.nucleus.center.x).toBeCloseTo(4750, 6)
    expect(layout.nucleus.center.y).toBeCloseTo(1250, 6)
    if (layout.nucleus.kind !== 'metaball') throw new Error('expected metaball')
    const ids = layout.nucleus.circles.map((c) => c.id).sort()
    expect(ids).toEqual(['ai-sun', 'nvidia'])
  })

  it('keeps the core OUT of the orbiting bodies (it is the nucleus, not a planet)', () => {
    const ids = layout.bodies.map((b) => b.id)
    expect(ids).not.toContain('ai-sun')
    expect(ids).not.toContain('nvidia')
  })

  it('renders Nvidia at maxRadius and bigger than the labs-sun (honest area ∝ valuation)', () => {
    if (layout.nucleus.kind !== 'metaball') throw new Error('expected metaball')
    const nvidia = layout.nucleus.circles.find((c) => c.id === 'nvidia')!
    const sun = layout.nucleus.circles.find((c) => c.id === 'ai-sun')!
    expect(nvidia.r).toBeCloseTo(675, 6)
    expect(nvidia.r).toBeGreaterThan(sun.r)
  })

  it('every orbiting dot keeps its honest area∝value radius', () => {
    for (const b of layout.bodies) expect(b.r).toBeCloseTo(layout.scale.radius(b.value), 6)
  })

  it('keeps every orbiting dot inside the frame and clears the gap', () => {
    for (const b of layout.bodies) expect(inBounds(b, 9500, 2500)).toBe(true)
    for (let i = 0; i < layout.bodies.length; i++)
      for (let j = i + 1; j < layout.bodies.length; j++) {
        const a = layout.bodies[i]
        const b = layout.bodies[j]
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.r + b.r + SHARED.gap - 1e-6)
      }
  })

  it('places every dot exactly on its own orbit', () => {
    for (const b of layout.bodies) expect(pointOnEllipse(b.orbit, { x: b.cx, y: b.cy })).toBe(true)
    for (const b of layout.bodies) {
      expect(b.orbit.cx).toBeCloseTo(layout.nucleus.center.x, 6)
      expect(b.orbit.cy).toBeCloseTo(layout.nucleus.center.y, 6)
    }
  })

  it('never lets a name-box collide with another dot or another name', () => {
    const boxes = layout.bodies.map(labelBox)
    for (let i = 0; i < layout.bodies.length; i++) {
      for (let j = 0; j < layout.bodies.length; j++) {
        if (i === j) continue
        expect(boxesOverlap(boxes[i], boxes[j])).toBe(false)
        expect(circleHitsBox(layout.bodies[j].cx, layout.bodies[j].cy, layout.bodies[j].r, boxes[i])).toBe(false)
      }
    }
  })

  it('area is proportional to value', () => {
    const a = layout.bodies.find((b) => b.id === 'spain')!
    const b = layout.bodies.find((b) => b.id === 'ibex')!
    expect((a.r * a.r) / (b.r * b.r)).toBeCloseTo(a.value / b.value, 4)
  })

  it('is deterministic', () => {
    const again = layoutWall(BACK, { width: 9500, height: 2500, ...SHARED, coreIds: ['ai-sun', 'nvidia'] })
    expect(again.bodies.map((b) => [b.id, b.cx, b.cy, b.r])).toEqual(layout.bodies.map((b) => [b.id, b.cx, b.cy, b.r]))
  })
})

describe('layoutWall — a side wall (focal nucleus on the inner edge, orbits bleed off)', () => {
  const W = 4375
  const layout = layoutWall(SIDE, { width: W, height: 2500, ...SHARED, nucleusAnchor: 'edge-inner', focalEdge: 'right' })

  it('anchors an (undrawn) focal nucleus on the inner edge', () => {
    expect(layout.nucleus.kind).toBe('focal')
    expect(layout.nucleus.center.x).toBeCloseTo(W, 6) // right edge
    expect(layout.nucleus.center.y).toBeCloseTo(1250, 6)
  })

  it('keeps every dot in-bounds and non-overlapping', () => {
    for (const b of layout.bodies) expect(inBounds(b, W, 2500)).toBe(true)
    for (let i = 0; i < layout.bodies.length; i++)
      for (let j = i + 1; j < layout.bodies.length; j++) {
        const a = layout.bodies[i]
        const b = layout.bodies[j]
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.r + b.r + SHARED.gap - 1e-6)
      }
  })

  it('lets at least one orbit bleed off the top/bottom of the frame', () => {
    const bleeds = layout.bodies.some((b) => b.orbit.cy - vExtent(b.orbit) < 0 || b.orbit.cy + vExtent(b.orbit) > 2500)
    expect(bleeds).toBe(true)
  })

  it('floors and flags the tiny ring (ampliado)', () => {
    const tiny = layout.bodies.find((b) => b.id === 'tiny')!
    expect(tiny.toScale).toBe(false)
    expect(tiny.r).toBeCloseTo(SHARED.minRadius, 6)
    expect(layout.enlarged.map((b) => b.id)).toContain('tiny')
  })
})

describe('layoutWall — ONE shared scale across walls (honest comparison)', () => {
  it('the same value renders at the same radius on any wall', () => {
    const back = layoutWall(BACK, { width: 9500, height: 2500, ...SHARED, coreIds: ['ai-sun', 'nvidia'] })
    const side = layoutWall(SIDE, { width: 4375, height: 2500, ...SHARED, nucleusAnchor: 'edge-inner', focalEdge: 'right' })
    for (const v of [0.256e12, 1.07e12, 5.2e12]) {
      expect(back.scale.radius(v)).toBeCloseTo(side.scale.radius(v), 6)
    }
  })
})
