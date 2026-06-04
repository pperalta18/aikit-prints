import { describe, expect, it } from 'vitest'
import {
  ANCHOR_SIDE_MM,
  ANCHOR_VALUE,
  byChronology,
  cellCount,
  formatFactorEs,
  formatParamsEs,
  growthFactor,
  layoutGiant,
  layoutSmallModels,
  modelAreaMm2,
  modelSideMm,
  paramsPerCell,
  type ScaleModel,
  yearOf,
} from './escala-modelos'

/** The real pair: Perceptrón → AlexNet → GPT-2 on 9E1, GPT-4 on 8S1. */
const PERCEPTRON: ScaleModel = { id: 'perceptron', label: 'Perceptrón', value: 512, year: '1958' }
const ALEXNET: ScaleModel = { id: 'alexnet', label: 'AlexNet', value: 60e6, year: '2012' }
const GPT2: ScaleModel = { id: 'gpt2', label: 'GPT-2', value: 1.5e9, year: '2019' }
const GPT4_VALUE = 1.8e12
const SMALL = [GPT2, PERCEPTRON, ALEXNET] // deliberately out of order

/* ── the honest unit: side ∝ √value, area ∝ value ─────────────────────────────── */

describe('modelSideMm — square side ∝ √params (area ∝ params)', () => {
  it('anchors GPT-2 to ANCHOR_SIDE_MM', () => {
    expect(modelSideMm(ANCHOR_VALUE)).toBeCloseTo(ANCHOR_SIDE_MM, 6)
  })

  it('area is exactly proportional to value', () => {
    // area(a)/area(b) === value(a)/value(b) for any positive pair.
    const ratioArea = modelAreaMm2(60e6) / modelAreaMm2(1.5e9)
    const ratioValue = 60e6 / 1.5e9
    expect(ratioArea).toBeCloseTo(ratioValue, 9)
  })

  it('side is proportional to √value', () => {
    const r = modelSideMm(GPT4_VALUE) / modelSideMm(GPT2.value)
    expect(r).toBeCloseTo(Math.sqrt(GPT4_VALUE / GPT2.value), 9)
  })

  it('the real anchored sizes land inside the design band', () => {
    expect(modelSideMm(512)).toBeLessThan(2) // Perceptrón ≈ 0.8 mm — a speck
    expect(modelSideMm(60e6)).toBeGreaterThan(200) // AlexNet ≈ 28 cm
    expect(modelSideMm(60e6)).toBeLessThan(420)
    expect(modelSideMm(1.5e9)).toBeGreaterThan(1200) // GPT-2 dominates 9E1
    expect(modelSideMm(1.5e9)).toBeLessThan(1750)
    expect(modelSideMm(GPT4_VALUE) / 1000).toBeGreaterThan(35) // GPT-4 fills 8S1
    expect(modelSideMm(GPT4_VALUE) / 1000).toBeLessThan(70)
  })

  it('returns 0 for non-positive / non-finite', () => {
    expect(modelSideMm(0)).toBe(0)
    expect(modelSideMm(-5)).toBe(0)
    expect(modelSideMm(NaN)).toBe(0)
    expect(modelSideMm(Infinity)).toBe(0)
  })
})

/* ── matrix-grain honesty: #cells ∝ params, fixed quantum per cell ────────────── */

describe('matrix cells', () => {
  it('a cell represents the same parameter count on both walls', () => {
    // paramsPerCell depends only on the cell size, not the model → honest grain.
    const a = paramsPerCell(20)
    expect(a).toBeGreaterThan(0)
    // #cells is exactly proportional to params (so a bigger square = more cells).
    expect(cellCount(60e6, 20) / cellCount(1.5e9, 20)).toBeCloseTo(60e6 / 1.5e9, 9)
  })

  it('cellCount × paramsPerCell recovers the value', () => {
    expect(cellCount(1.5e9, 20) * paramsPerCell(20)).toBeCloseTo(1.5e9, 0)
  })
})

/* ── scale is continuous across the two walls ─────────────────────────────────── */

describe('continuity across 9E1 and 8S1', () => {
  it('GPT-4 (8S1) and GPT-2 (9E1) share one unit', () => {
    // Both pages call modelSideMm → the ratio is fixed by the data, not the wall.
    const gpt4 = modelSideMm(GPT4_VALUE)
    const gpt2 = modelSideMm(GPT2.value)
    expect(gpt4 / gpt2).toBeCloseTo(Math.sqrt(GPT4_VALUE / GPT2.value), 9)
  })
})

/* ── 9E1 layout ───────────────────────────────────────────────────────────────── */

describe('layoutSmallModels', () => {
  const layout = layoutSmallModels(SMALL, { wallWidthMm: 10750, wallHeightMm: 2500 })

  it('orders chronologically left→right regardless of input order', () => {
    expect(layout.squares.map((s) => s.id)).toEqual(['perceptron', 'alexnet', 'gpt2'])
    const xs = layout.squares.map((s) => s.cxMm)
    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[1]).toBeLessThan(xs[2])
  })

  it('bottom-aligns every square on the shared baseline', () => {
    for (const s of layout.squares) {
      expect(s.yMm + s.sideMm).toBeCloseTo(layout.baselineYMm, 6)
    }
  })

  it('flags the sub-visible Perceptrón for a magnified callout', () => {
    expect(layout.enlarged).toContain('perceptron')
    expect(layout.squares.find((s) => s.id === 'perceptron')!.visible).toBe(false)
    expect(layout.squares.find((s) => s.id === 'gpt2')!.visible).toBe(true)
  })

  it('keeps the big square inside the wall height', () => {
    const gpt2 = layout.squares.find((s) => s.id === 'gpt2')!
    expect(gpt2.yMm).toBeGreaterThanOrEqual(0)
    expect(gpt2.sideMm).toBeLessThan(2500)
  })

  it('is deterministic', () => {
    const a = layoutSmallModels(SMALL, { wallWidthMm: 10750, wallHeightMm: 2500 })
    const b = layoutSmallModels(SMALL, { wallWidthMm: 10750, wallHeightMm: 2500 })
    expect(a).toEqual(b)
  })

  it('throws on a non-positive canvas', () => {
    expect(() => layoutSmallModels(SMALL, { wallWidthMm: 0, wallHeightMm: 2500 })).toThrow()
  })
})

/* ── 8S1 layout ───────────────────────────────────────────────────────────────── */

describe('layoutGiant', () => {
  const layout = layoutGiant(GPT4_VALUE, [PERCEPTRON, ALEXNET, GPT2], {
    wallWidthMm: 8500,
    wallHeightMm: 2500,
  })

  it('sizes GPT-4 to the shared scale (overflowing the wall)', () => {
    expect(layout.gpt4SideMm).toBeCloseTo(modelSideMm(GPT4_VALUE), 6)
    expect(layout.gpt4SideM).toBeGreaterThan(45)
    expect(layout.visibleFractionW).toBeLessThan(0.25) // wall shows a fragment
    expect(layout.visibleFractionH).toBeLessThan(0.1)
  })

  it('drops the Perceptrón (sub-mm) from the drawn size key, keeps the rest largest→smallest', () => {
    expect(layout.references.map((r) => r.id)).toEqual(['gpt2', 'alexnet'])
    expect(layout.references[0].sideMm).toBeGreaterThan(layout.references[1].sideMm)
  })

  it('throws on a non-positive canvas', () => {
    expect(() => layoutGiant(GPT4_VALUE, [], { wallWidthMm: -1, wallHeightMm: 2500 })).toThrow()
  })
})

/* ── ratios + formatting ──────────────────────────────────────────────────────── */

describe('growth + formatting', () => {
  it('growthFactor is the multiplicative jump', () => {
    expect(growthFactor(GPT2.value, GPT4_VALUE)).toBeCloseTo(1200, 0)
    expect(growthFactor(512, GPT4_VALUE)).toBeGreaterThan(3.5e9) // ~3.5 mil millones×
    expect(growthFactor(512, GPT4_VALUE)).toBeLessThan(3.6e9)
    expect(() => growthFactor(0, 10)).toThrow()
  })

  it('formatParamsEs reads as plain Spanish', () => {
    expect(formatParamsEs(512)).toBe('512')
    expect(formatParamsEs(60e6)).toBe('60 millones')
    expect(formatParamsEs(1.5e9)).toBe('1.500 millones')
    expect(formatParamsEs(1.8e12)).toBe('1,8 billones')
    expect(formatParamsEs(0)).toBe('0')
  })

  it('formatFactorEs reads as an editorial headline', () => {
    expect(formatFactorEs(25)).toBe('25×')
    expect(formatFactorEs(1200)).toBe('1.200×')
    expect(formatFactorEs(3.515e9)).toMatch(/mil millones×$/)
  })

  it('yearOf + byChronology', () => {
    expect(yearOf('2025-07')).toBe('2025')
    expect(yearOf('1958')).toBe('1958')
    expect([GPT2, PERCEPTRON].sort(byChronology)[0].id).toBe('perceptron')
  })
})
