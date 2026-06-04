import { describe, expect, it } from 'vitest'
import { fitScale, planZonePlacements, planZones, zoneAlong, type Zone } from './zones'
import type { Placement } from './placements'

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)
const widths = (zones: Zone[]) => zones.map((z) => z.widthM)

describe('planZones — equal split', () => {
  it('produces the requested number of zones', () => {
    for (const n of [1, 2, 3, 4, 7]) {
      expect(planZones(20, n).zones).toHaveLength(n)
      expect(planZones(20, n).count).toBe(n)
    }
  })

  it('a single zone spans the whole run and is centred', () => {
    const { zones } = planZones(12.5, 1)
    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({ index: 0, startM: 0, endM: 12.5, widthM: 12.5 })
    expect(zones[0].centerM).toBeCloseTo(6.25, 6)
    expect(zones[0].alongOffset).toBeCloseTo(0, 6) // centred on the run centre
  })

  it('splits a run into equal-width zones', () => {
    const { zones } = planZones(9, 3)
    expect(widths(zones)).toEqual([3, 3, 3])
    expect(zones.map((z) => z.startM)).toEqual([0, 3, 6])
    expect(zones.map((z) => z.endM)).toEqual([3, 6, 9])
    expect(zones.map((z) => z.centerM)).toEqual([1.5, 4.5, 7.5])
  })

  it('alongOffset is the zone centre relative to the run centre (drops into Placement.along)', () => {
    const { zones } = planZones(9, 3)
    // run centre is at 4.5 → offsets −3, 0, +3
    expect(zones.map((z) => z.alongOffset)).toEqual([-3, 0, 3])
  })

  it('alongOffsets are symmetric about 0 for an even split', () => {
    const { zones } = planZones(28.5, 4)
    const offs = zones.map((z) => z.alongOffset)
    for (let i = 0; i < offs.length; i++) {
      expect(offs[i]).toBeCloseTo(-offs[offs.length - 1 - i], 6)
    }
  })
})

describe('planZones — coverage invariants', () => {
  it('zones tile contiguously and cover exactly [0, runLength] with no gap/margin', () => {
    for (const [len, n] of [[10, 1], [22.5, 3], [28.5, 5], [13.37, 7]] as const) {
      const { zones } = planZones(len, n)
      expect(zones[0].startM).toBe(0)
      expect(zones[n - 1].endM).toBeCloseTo(len, 6) // last edge pinned to the run end
      for (let i = 1; i < n; i++) {
        expect(zones[i].startM).toBeCloseTo(zones[i - 1].endM, 6) // no gap, no overlap
      }
      expect(sum(widths(zones))).toBeCloseTo(len, 6)
    }
  })

  it('the centre of each zone is the midpoint of its span', () => {
    const { zones } = planZones(22.5, 4)
    for (const z of zones) expect(z.centerM).toBeCloseTo((z.startM + z.endM) / 2, 6)
  })
})

describe('planZones — margins and gaps', () => {
  it('keeps each wall end clear by marginM and still covers symmetrically', () => {
    const { zones, usableM } = planZones(12, 2, { marginM: 1 })
    expect(usableM).toBeCloseTo(10, 6)
    expect(zones[0].startM).toBe(1) // first zone starts after the margin
    expect(zones[1].endM).toBeCloseTo(11, 6) // last zone ends before the far margin
    expect(widths(zones)).toEqual([5, 5])
    expect(zones.map((z) => z.alongOffset)).toEqual([-2.5, 2.5]) // still symmetric
  })

  it('separates adjacent zones by exactly gapM', () => {
    const { zones, usableM } = planZones(11, 2, { gapM: 1 })
    expect(usableM).toBeCloseTo(10, 6)
    expect(zones[1].startM - zones[0].endM).toBeCloseTo(1, 6)
    expect(sum(widths(zones))).toBeCloseTo(10, 6) // gaps are excluded from usable
    expect(zones[1].endM).toBeCloseTo(11, 6)
  })

  it('combines margins and gaps: usable = run − 2·margin − (n−1)·gap', () => {
    const len = 30
    const n = 4
    const gapM = 0.5
    const marginM = 1
    const { zones, usableM } = planZones(len, n, { gapM, marginM })
    expect(usableM).toBeCloseTo(len - 2 * marginM - (n - 1) * gapM, 6)
    expect(sum(widths(zones))).toBeCloseTo(usableM, 6)
    expect(zones[0].startM).toBeCloseTo(marginM, 6)
    expect(zones[n - 1].endM).toBeCloseTo(len - marginM, 6)
    for (let i = 1; i < n; i++) {
      expect(zones[i].startM - zones[i - 1].endM).toBeCloseTo(gapM, 6)
    }
  })
})

describe('planZones — weighted split', () => {
  it('splits width in proportion to weights', () => {
    const { zones } = planZones(10, 2, { weights: [3, 1] })
    expect(widths(zones)).toEqual([7.5, 2.5])
    expect(sum(widths(zones))).toBeCloseTo(10, 6)
    expect(zones[0].startM).toBe(0)
    expect(zones[1].endM).toBeCloseTo(10, 6)
  })

  it('equal weights match the unweighted split', () => {
    const a = planZones(17.3, 3)
    const b = planZones(17.3, 3, { weights: [1, 1, 1] })
    expect(widths(b.zones)).toEqual(widths(a.zones))
    expect(b.zones.map((z) => z.alongOffset)).toEqual(a.zones.map((z) => z.alongOffset))
  })

  it('weights are relative, not absolute (scale-invariant)', () => {
    const a = planZones(12, 3, { weights: [1, 2, 1] })
    const b = planZones(12, 3, { weights: [10, 20, 10] })
    expect(widths(a.zones)).toEqual(widths(b.zones))
    expect(widths(a.zones)).toEqual([3, 6, 3])
  })
})

describe('planZones — validation', () => {
  it('rejects a non-finite or non-positive runLength', () => {
    expect(() => planZones(0, 2)).toThrow()
    expect(() => planZones(-5, 2)).toThrow()
    expect(() => planZones(Number.NaN, 2)).toThrow()
    expect(() => planZones(Number.POSITIVE_INFINITY, 2)).toThrow()
  })

  it('rejects a non-integer or < 1 count', () => {
    expect(() => planZones(10, 0)).toThrow()
    expect(() => planZones(10, -2)).toThrow()
    expect(() => planZones(10, 1.5)).toThrow()
  })

  it('rejects negative or non-finite gap / margin', () => {
    expect(() => planZones(10, 2, { gapM: -1 })).toThrow()
    expect(() => planZones(10, 2, { marginM: -0.5 })).toThrow()
    expect(() => planZones(10, 2, { gapM: Number.NaN })).toThrow()
    expect(() => planZones(10, 2, { marginM: Number.POSITIVE_INFINITY })).toThrow()
  })

  it('rejects a layout whose margins/gaps leave no usable length', () => {
    expect(() => planZones(2, 2, { marginM: 1.5 })).toThrow(/usable/)
    expect(() => planZones(2, 3, { gapM: 2 })).toThrow(/usable/)
  })

  it('rejects malformed weights (wrong length or non-positive entry)', () => {
    expect(() => planZones(10, 3, { weights: [1, 1] })).toThrow()
    expect(() => planZones(10, 2, { weights: [1, 0] })).toThrow()
    expect(() => planZones(10, 2, { weights: [1, -3] })).toThrow()
    expect(() => planZones(10, 2, { weights: [1, Number.NaN] })).toThrow()
  })
})

describe('zoneAlong', () => {
  it('offsets the zone centre by the wall-run centre', () => {
    const { zones } = planZones(9, 3) // offsets −3, 0, +3
    expect(zones.map((z) => zoneAlong(0, z))).toEqual([-3, 0, 3])
    expect(zones.map((z) => zoneAlong(5, z))).toEqual([2, 5, 8])
    expect(zones.map((z) => zoneAlong(-4.25, z))).toEqual([-7.25, -4.25, -1.25])
  })
})

describe('fitScale', () => {
  it('returns the factor that makes a print fill a zone width', () => {
    expect(fitScale(5, 5)).toBe(1)
    expect(fitScale(10, 5)).toBe(2)
    expect(fitScale(2.5, 10)).toBe(0.25)
  })

  it('scaling the print by the factor reproduces the zone width', () => {
    const printW = 3.2
    const zoneW = 7.8
    expect(printW * fitScale(zoneW, printW)).toBeCloseTo(zoneW, 6)
  })

  it('rejects non-positive widths', () => {
    expect(() => fitScale(0, 5)).toThrow()
    expect(() => fitScale(5, 0)).toThrow()
    expect(() => fitScale(-1, 5)).toThrow()
    expect(() => fitScale(5, Number.NaN)).toThrow()
  })
})

describe('planZonePlacements', () => {
  const base: Placement = {
    id: 'orig',
    printId: 'hero-solar',
    wallId: 'wall-1',
    along: 99, // overwritten per zone
    centerY: 1.55,
    scale: 0.7, // overwritten when fit
    side: -1,
    mount: 'lightbox',
    glow: 1.2,
  }

  it('creates one placement per zone with stable, unique ids', () => {
    const out = planZonePlacements({
      base,
      runCenter: 0,
      runLength: 10,
      printWidthM: 5,
      count: 3,
      idPrefix: 'hero',
    })
    expect(out).toHaveLength(3)
    expect(out.map((p) => p.id)).toEqual(['hero-z1', 'hero-z2', 'hero-z3'])
    expect(new Set(out.map((p) => p.id)).size).toBe(3)
  })

  it('positions each copy at its zone centre (runCentre + alongOffset)', () => {
    const out = planZonePlacements({
      base,
      runCenter: 6,
      runLength: 9,
      printWidthM: 3,
      count: 3,
      idPrefix: 'z',
    })
    // offsets −3, 0, +3 around runCentre 6
    expect(out.map((p) => p.along)).toEqual([3, 6, 9])
  })

  it('fits each copy to its zone width by default (panel width = zone width)', () => {
    const printWidthM = 4
    const out = planZonePlacements({
      base,
      runCenter: 0,
      runLength: 24,
      printWidthM,
      count: 2,
      idPrefix: 'z',
    })
    // two 12 m zones → each copy scaled so 4 m print fills 12 m
    for (const p of out) expect(printWidthM * p.scale).toBeCloseTo(12, 6)
  })

  it('keeps the base scale when fit is false (repeated motif)', () => {
    const out = planZonePlacements({
      base,
      runCenter: 0,
      runLength: 24,
      printWidthM: 4,
      count: 3,
      idPrefix: 'z',
      fit: false,
    })
    for (const p of out) expect(p.scale).toBe(base.scale)
  })

  it('inherits wall / side / height / mount / glow from the base placement', () => {
    const out = planZonePlacements({
      base,
      runCenter: 0,
      runLength: 10,
      printWidthM: 5,
      count: 2,
      idPrefix: 'z',
    })
    for (const p of out) {
      expect(p.printId).toBe('hero-solar')
      expect(p.wallId).toBe('wall-1')
      expect(p.side).toBe(-1)
      expect(p.centerY).toBe(1.55)
      expect(p.mount).toBe('lightbox')
      expect(p.glow).toBe(1.2)
    }
  })

  it('honours gap / margin / weights via the underlying plan', () => {
    const out = planZonePlacements({
      base,
      runCenter: 0,
      runLength: 12,
      printWidthM: 1,
      count: 2,
      idPrefix: 'z',
      weights: [3, 1],
      marginM: 0,
      gapM: 0,
      fit: true,
    })
    // usable 12 → widths 9 and 3 → scales 9 and 3 (printWidth 1)
    expect(out.map((p) => p.scale)).toEqual([9, 3])
  })

  it('does not mutate the base placement', () => {
    const snapshot = JSON.parse(JSON.stringify(base))
    planZonePlacements({ base, runCenter: 0, runLength: 10, printWidthM: 5, count: 2, idPrefix: 'z' })
    expect(base).toEqual(snapshot)
  })
})
