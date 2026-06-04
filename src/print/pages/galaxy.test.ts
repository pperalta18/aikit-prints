import { describe, expect, it } from 'vitest'
import { layoutWall, type GalaxyDatum } from './galaxy'

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

function inBounds(b: { cx: number; cy: number; r: number }, w: number, h: number) {
  const eps = 1e-6
  return b.cx - b.r >= -eps && b.cx + b.r <= w + eps && b.cy - b.r >= -eps && b.cy + b.r <= h + eps
}

describe('layoutWall — the back wall (centred AI sun)', () => {
  const layout = layoutWall(BACK, { width: 9500, height: 2500, ...SHARED, sunId: 'ai-sun' })

  it('keeps every body fully inside its own frame (never clips at the edge)', () => {
    for (const b of layout.bodies) expect(inBounds(b, 9500, 2500)).toBe(true)
  })

  it('never overlaps two bodies (clears the gap)', () => {
    for (let i = 0; i < layout.bodies.length; i++)
      for (let j = i + 1; j < layout.bodies.length; j++) {
        const a = layout.bodies[i]
        const b = layout.bodies[j]
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.r + b.r + SHARED.gap - 1e-6)
      }
  })

  it('centres the AI sun in the frame', () => {
    const sun = layout.bodies.find((b) => b.id === 'ai-sun')!
    expect(sun.cx).toBeCloseTo(4750, 6)
    expect(sun.cy).toBeCloseTo(1250, 6)
  })

  it('renders Nvidia bigger than the labs-sun (honest area ∝ valuation)', () => {
    const nvidia = layout.bodies.find((b) => b.id === 'nvidia')!
    const sun = layout.bodies.find((b) => b.id === 'ai-sun')!
    expect(nvidia.r).toBeGreaterThan(sun.r)
    // the global-max body renders exactly at maxRadius
    expect(nvidia.r).toBeCloseTo(675, 6)
  })

  it('area is proportional to value', () => {
    const a = layout.bodies.find((b) => b.id === 'spain')!
    const b = layout.bodies.find((b) => b.id === 'ibex')!
    expect((a.r * a.r) / (b.r * b.r)).toBeCloseTo(a.value / b.value, 4)
  })

  it('is deterministic', () => {
    const again = layoutWall(BACK, { width: 9500, height: 2500, ...SHARED, sunId: 'ai-sun' })
    expect(again.bodies.map((b) => [b.id, b.cx, b.cy, b.r])).toEqual(layout.bodies.map((b) => [b.id, b.cx, b.cy, b.r]))
  })
})

describe('layoutWall — a side wall (largest body anchors, no sun)', () => {
  const layout = layoutWall(SIDE, { width: 5500, height: 2500, ...SHARED })

  it('keeps every body in-bounds and non-overlapping', () => {
    for (const b of layout.bodies) expect(inBounds(b, 5500, 2500)).toBe(true)
    for (let i = 0; i < layout.bodies.length; i++)
      for (let j = i + 1; j < layout.bodies.length; j++) {
        const a = layout.bodies[i]
        const b = layout.bodies[j]
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.r + b.r + SHARED.gap - 1e-6)
      }
  })

  it('centres the largest body when there is no sun', () => {
    const airlines = layout.bodies.find((b) => b.id === 'airlines')!
    expect(airlines.cx).toBeCloseTo(2750, 6)
    expect(airlines.cy).toBeCloseTo(1250, 6)
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
    const back = layoutWall(BACK, { width: 9500, height: 2500, ...SHARED, sunId: 'ai-sun' })
    const side = layoutWall(SIDE, { width: 5500, height: 2500, ...SHARED })
    for (const v of [0.256e12, 1.07e12, 5.2e12]) {
      expect(back.scale.radius(v)).toBeCloseTo(side.scale.radius(v), 6)
    }
  })
})
