import { describe, expect, it } from 'vitest'
import {
  GIANT_GROUPS,
  bodyKind,
  fitHeroMaxRadius,
  isGiant,
  layoutHeroSolar,
  type HeroDatum,
  type HeroLayout,
} from './hero-solar'
import type { DatumGroup } from '../space/wall-data'
import { dataForWall } from '../space/wall-data'

/* ── fixtures ─────────────────────────────────────────────────────────────────── */

const GROUPS: DatumGroup[] = ['ai-giant-public', 'ai-giant-private', 'spanish-ref', 'aggregate', 'shock-market']

function datum(id: string, value: number, group: DatumGroup): HeroDatum {
  return { id, label: id.toUpperCase(), value, group }
}

/** A spread of values across every group (giant down to marble). */
const SAMPLE: HeroDatum[] = [
  datum('nvidia', 5.24e12, 'ai-giant-public'),
  datum('alphabet', 4.342e12, 'ai-giant-public'),
  datum('anthropic', 965e9, 'ai-giant-private'),
  datum('openai', 852e9, 'ai-giant-private'),
  datum('ibex', 1.07e12, 'aggregate'),
  datum('gdp', 1.891e12, 'aggregate'),
  datum('inditex', 193e9, 'spanish-ref'),
  datum('repsol', 29.68e9, 'spanish-ref'),
  datum('coffee', 249e9, 'shock-market'),
]

const EPS = 1e-6

/** Every (i<j) pair of bodies, for overlap assertions. */
function pairs<T>(xs: T[]): Array<[T, T]> {
  const out: Array<[T, T]> = []
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) out.push([xs[i], xs[j]])
  return out
}

function assertInBounds(layout: HeroLayout) {
  for (const b of layout.bodies) {
    expect(b.cx - b.r).toBeGreaterThanOrEqual(-EPS)
    expect(b.cy - b.r).toBeGreaterThanOrEqual(-EPS)
    expect(b.cx + b.r).toBeLessThanOrEqual(layout.width + EPS)
    expect(b.cy + b.r).toBeLessThanOrEqual(layout.height + EPS)
  }
}

function assertNoOverlap(layout: HeroLayout, gap: number) {
  for (const [a, b] of pairs(layout.bodies)) {
    const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy)
    expect(dist + EPS).toBeGreaterThanOrEqual(a.r + b.r + gap)
  }
}

function assertClearOfHole(layout: HeroLayout) {
  for (const b of layout.bodies) {
    const dist = Math.hypot(b.cx - layout.center.x, b.cy - layout.center.y)
    // Ball is fully outside the central label disc.
    expect(dist).toBeGreaterThanOrEqual(layout.centerRadius + b.r - EPS)
  }
}

/* ── classification ───────────────────────────────────────────────────────────── */

describe('classification (giants vs marbles)', () => {
  it('treats only the AI-giant groups as giants', () => {
    expect(isGiant('ai-giant-public')).toBe(true)
    expect(isGiant('ai-giant-private')).toBe(true)
    expect(isGiant('spanish-ref')).toBe(false)
    expect(isGiant('aggregate')).toBe(false)
    expect(isGiant('shock-market')).toBe(false)
  })

  it('GIANT_GROUPS contains exactly the two AI groups', () => {
    expect([...GIANT_GROUPS].sort()).toEqual(['ai-giant-private', 'ai-giant-public'])
  })

  it('bodyKind maps every group to giant or marble, partitioning them', () => {
    for (const g of GROUPS) {
      expect(bodyKind(g)).toBe(isGiant(g) ? 'giant' : 'marble')
    }
    const giants = GROUPS.filter((g) => bodyKind(g) === 'giant')
    const marbles = GROUPS.filter((g) => bodyKind(g) === 'marble')
    expect(giants.length + marbles.length).toBe(GROUPS.length)
    expect(giants).toEqual(['ai-giant-public', 'ai-giant-private'])
  })
})

/* ── honesty: area ∝ value ────────────────────────────────────────────────────── */

describe('area ∝ value (the honest scale)', () => {
  const layout = layoutHeroSolar(SAMPLE, {
    width: 6000,
    height: 2400,
    maxRadius: 220,
    minRadius: 40,
    gap: 12,
    centerRadius: 280,
  })

  it('gives the max-value ball the max radius', () => {
    const biggest = layout.bodies[0]
    expect(biggest.id).toBe('nvidia')
    expect(biggest.r).toBeCloseTo(220, 6)
    expect(biggest.toScale).toBe(true)
  })

  it('keeps radius ∝ √value and area ∝ value for every to-scale pair', () => {
    const scaled = layout.bodies.filter((b) => b.toScale)
    for (const [a, b] of pairs(scaled)) {
      const rRatio = a.r / b.r
      const vRatio = a.value / b.value
      expect(rRatio).toBeCloseTo(Math.sqrt(vRatio), 6)
      const areaRatio = (Math.PI * a.r * a.r) / (Math.PI * b.r * b.r)
      expect(areaRatio).toBeCloseTo(vRatio, 4)
    }
  })

  it('sorts bodies largest value first', () => {
    for (let i = 1; i < layout.bodies.length; i++) {
      expect(layout.bodies[i - 1].value).toBeGreaterThanOrEqual(layout.bodies[i].value)
    }
  })

  it('preserves classification on each laid-out body', () => {
    for (const b of layout.bodies) expect(b.kind).toBe(bodyKind(b.group))
  })
})

/* ── honesty: enlarged marbles are flagged, never silently distorted ──────────── */

describe('enlarged marbles', () => {
  it('flags any value floored to minRadius and lists it in enlarged[]', () => {
    // coffee here is far below the honest floor of the giant scale.
    const data: HeroDatum[] = [
      datum('giant', 1e12, 'ai-giant-public'),
      datum('tiny', 1e6, 'shock-market'),
    ]
    const layout = layoutHeroSolar(data, {
      width: 3000,
      height: 3000,
      maxRadius: 300,
      minRadius: 30,
      gap: 10,
      centerRadius: 150,
    })
    const tiny = layout.bodies.find((b) => b.id === 'tiny')!
    expect(tiny.toScale).toBe(false)
    expect(tiny.r).toBeCloseTo(30, 6) // floored, not zero — stays visible
    expect(layout.enlarged.map((b) => b.id)).toContain('tiny')
    // The giant is honest.
    const giant = layout.bodies.find((b) => b.id === 'giant')!
    expect(giant.toScale).toBe(true)
    expect(layout.enlarged.map((b) => b.id)).not.toContain('giant')
  })

  it('enlarges nothing when minRadius is 0 (every positive value is to scale)', () => {
    const layout = layoutHeroSolar(SAMPLE, {
      width: 6000,
      height: 2400,
      maxRadius: 200,
      minRadius: 0,
      gap: 10,
      centerRadius: 250,
    })
    expect(layout.enlarged).toEqual([])
    for (const b of layout.bodies) expect(b.toScale).toBe(true)
  })
})

/* ── packing invariants: no overlap, in bounds, clear of the label hole ───────── */

describe('rosette packing invariants', () => {
  const gap = 12
  const centerRadius = 280
  const layout = layoutHeroSolar(SAMPLE, {
    width: 6000,
    height: 2400,
    maxRadius: 220,
    minRadius: 40,
    gap,
    centerRadius,
  })

  it('places every datum (with a positive value)', () => {
    expect(layout.bodies).toHaveLength(SAMPLE.length)
  })

  it('keeps all balls inside the media', () => assertInBounds(layout))
  it('never overlaps two balls (respecting the gap)', () => assertNoOverlap(layout, gap))
  it('keeps every ball clear of the central label hole', () => assertClearOfHole(layout))

  it('is deterministic — same input, identical layout', () => {
    const opts = { width: 6000, height: 2400, maxRadius: 220, minRadius: 40, gap, centerRadius }
    const a = layoutHeroSolar(SAMPLE, opts)
    const b = layoutHeroSolar(SAMPLE, opts)
    expect(a.bodies).toEqual(b.bodies)
  })

  it('throws rather than silently overlapping when the canvas is far too small', () => {
    expect(() =>
      layoutHeroSolar(SAMPLE, {
        width: 400,
        height: 400,
        maxRadius: 220, // a single ball alone barely fits; the set cannot
        minRadius: 80,
        gap: 40,
        centerRadius: 150,
      }),
    ).toThrow()
  })
})

/* ── value filtering ──────────────────────────────────────────────────────────── */

describe('value filtering', () => {
  it('drops non-positive and non-finite values, lays out the rest', () => {
    const data: HeroDatum[] = [
      datum('ok', 1e12, 'ai-giant-public'),
      datum('zero', 0, 'spanish-ref'),
      datum('neg', -5, 'spanish-ref'),
      datum('nan', Number.NaN, 'aggregate'),
      datum('inf', Number.POSITIVE_INFINITY, 'aggregate'),
    ]
    const layout = layoutHeroSolar(data, { width: 2000, height: 2000, maxRadius: 200, centerRadius: 100 })
    expect(layout.bodies.map((b) => b.id)).toEqual(['ok'])
  })

  it('returns an empty layout for empty data', () => {
    const layout = layoutHeroSolar([], { width: 2000, height: 2000, maxRadius: 200 })
    expect(layout.bodies).toEqual([])
    expect(layout.enlarged).toEqual([])
  })
})

/* ── fitHeroMaxRadius: produces a radius the layout can actually place ─────────── */

describe('fitHeroMaxRadius', () => {
  const values = SAMPLE.map((d) => d.value)

  it('never exceeds the single-ball cap (biggest ball fits outside the hole, in bounds)', () => {
    const width = 6000
    const height = 2400
    const centerRadius = 280
    const r = fitHeroMaxRadius(values, { width, height, minRadius: 40, centerRadius, fill: 0.4 })
    const cap = (Math.min(width, height) / 2 - centerRadius) / 2
    expect(r).toBeLessThanOrEqual(cap + EPS)
    expect(r).toBeGreaterThan(0)
  })

  it('grows with the available area (more canvas → not-smaller radius)', () => {
    const base = fitHeroMaxRadius(values, { width: 4000, height: 2000, minRadius: 40, centerRadius: 200 })
    const bigger = fitHeroMaxRadius(values, { width: 8000, height: 4000, minRadius: 40, centerRadius: 200 })
    expect(bigger).toBeGreaterThanOrEqual(base - EPS)
  })

  it('yields a maxRadius the rosette can lay out without throwing (slack holds)', () => {
    const width = 6000
    const height = 2400
    const minRadius = 50
    const gap = 18
    const centerRadius = 300
    const maxRadius = fitHeroMaxRadius(values, { width, height, minRadius, centerRadius, fill: 0.4 })
    const layout = layoutHeroSolar(SAMPLE, { width, height, maxRadius, minRadius, gap, centerRadius })
    expect(layout.bodies).toHaveLength(SAMPLE.length)
    assertInBounds(layout)
    assertNoOverlap(layout, gap)
    assertClearOfHole(layout)
  })
})

/* ── the real hero data (wall 2) lays out honestly ────────────────────────────── */

describe('real hero data — dataForWall(2)', () => {
  const data = dataForWall(2)

  it('has the researched hero figures', () => {
    expect(data.length).toBeGreaterThan(0)
    expect(data.find((d) => d.id === 'nvidia')).toBeTruthy()
  })

  it('lays out at fitted scale: all in bounds, no overlap, clear of the hole, area∝value', () => {
    const width = 7000 // ~7 m hero zone
    const height = 2200 // ~2.2 m eye band
    const minRadius = height * 0.022
    const gap = height * 0.01
    const centerRadius = height * 0.14
    const maxRadius = fitHeroMaxRadius(
      data.map((d) => d.value),
      { width, height, minRadius, centerRadius, fill: 0.4 },
    )
    const layout = layoutHeroSolar(data, { width, height, maxRadius, minRadius, gap, centerRadius })

    expect(layout.bodies).toHaveLength(data.length)
    assertInBounds(layout)
    assertNoOverlap(layout, gap)
    assertClearOfHole(layout)

    // The single most valuable figure is the biggest ball and is honest.
    const top = layout.bodies[0]
    const maxVal = Math.max(...data.map((d) => d.value))
    expect(top.value).toBe(maxVal)
    expect(top.toScale).toBe(true)

    // area∝value across every to-scale pair.
    const scaled = layout.bodies.filter((b) => b.toScale)
    for (const [a, b] of pairs(scaled)) {
      expect(a.r / b.r).toBeCloseTo(Math.sqrt(a.value / b.value), 5)
    }
  })
})
