import { describe, expect, it } from 'vitest'
import { layoutCuadro, type CuadroLayoutOpts } from './cuadro'

/* ── fixtures ─────────────────────────────────────────────────────────────────── */

/** A wide, short event wall (8.5 × 2.5 m) with a portrait painting + label. */
const BASE: CuadroLayoutOpts = {
  wallWidthMm: 8500,
  wallHeightMm: 2500,
  paintingAspect: 2 / 3,
  paintingHeightFraction: 0.84,
  cartelaWidthMm: 2400,
  gapMm: 300,
  placement: 'left',
}

const EPS = 1e-6

describe('layoutCuadro — painting box', () => {
  it('sizes the painting to the wall-height fraction and its true aspect', () => {
    const { painting } = layoutCuadro(BASE)
    expect(painting.height).toBeCloseTo(2500 * 0.84, 6)
    expect(painting.width / painting.height).toBeCloseTo(2 / 3, 6)
  })

  it('vertically centres the painting on the wall', () => {
    const { painting } = layoutCuadro(BASE)
    const topGap = painting.y
    const bottomGap = BASE.wallHeightMm - (painting.y + painting.height)
    expect(topGap).toBeCloseTo(bottomGap, 6)
  })

  it('gives the cartela the painting height and shares the top edge', () => {
    const { painting, cartela } = layoutCuadro(BASE)
    expect(cartela.height).toBeCloseTo(painting.height, 6)
    expect(cartela.y).toBeCloseTo(painting.y, 6)
    expect(cartela.width).toBeCloseTo(BASE.cartelaWidthMm, 6)
  })
})

describe('layoutCuadro — centred group with gallery air', () => {
  it('frames the group with equal air on both sides', () => {
    const { group } = layoutCuadro(BASE)
    const leftAir = group.x
    const rightAir = BASE.wallWidthMm - (group.x + group.width)
    expect(leftAir).toBeCloseTo(rightAir, 6)
    expect(leftAir).toBeGreaterThan(0)
  })

  it('group width = painting + gap + cartela', () => {
    const { group, painting } = layoutCuadro(BASE)
    expect(group.width).toBeCloseTo(painting.width + BASE.gapMm + BASE.cartelaWidthMm, 6)
  })

  it('keeps an exact gap between painting and cartela (left placement)', () => {
    const { painting, cartela } = layoutCuadro({ ...BASE, placement: 'left' })
    expect(cartela.x - (painting.x + painting.width)).toBeCloseTo(BASE.gapMm, 6)
    expect(painting.x).toBeLessThan(cartela.x) // painting reads first
  })
})

describe('layoutCuadro — placement flips the order, not the geometry', () => {
  it("'right' puts the cartela first and the painting second, same group box", () => {
    const left = layoutCuadro({ ...BASE, placement: 'left' })
    const right = layoutCuadro({ ...BASE, placement: 'right' })
    // Same outer group, same sizes — only the inner order swaps.
    expect(right.group.x).toBeCloseTo(left.group.x, 6)
    expect(right.group.width).toBeCloseTo(left.group.width, 6)
    expect(right.painting.width).toBeCloseTo(left.painting.width, 6)
    expect(right.cartela.x).toBeLessThan(right.painting.x)
    expect(right.painting.x + right.painting.width).toBeCloseTo(left.group.x + left.group.width, 6)
  })
})

describe('layoutCuadro — everything inside the wall', () => {
  it('keeps both boxes within the wall bounds', () => {
    for (const placement of ['left', 'right'] as const) {
      const { painting, cartela } = layoutCuadro({ ...BASE, placement })
      for (const box of [painting, cartela]) {
        expect(box.x).toBeGreaterThanOrEqual(-EPS)
        expect(box.y).toBeGreaterThanOrEqual(-EPS)
        expect(box.x + box.width).toBeLessThanOrEqual(BASE.wallWidthMm + EPS)
        expect(box.y + box.height).toBeLessThanOrEqual(BASE.wallHeightMm + EPS)
      }
    }
  })

  it('is deterministic', () => {
    expect(layoutCuadro(BASE)).toEqual(layoutCuadro(BASE))
  })
})

describe('layoutCuadro — validation', () => {
  it('rejects non-positive dimensions', () => {
    expect(() => layoutCuadro({ ...BASE, wallWidthMm: 0 })).toThrow()
    expect(() => layoutCuadro({ ...BASE, wallHeightMm: -1 })).toThrow()
    expect(() => layoutCuadro({ ...BASE, paintingAspect: 0 })).toThrow()
    expect(() => layoutCuadro({ ...BASE, cartelaWidthMm: Number.NaN })).toThrow()
    expect(() => layoutCuadro({ ...BASE, gapMm: -10 })).toThrow()
  })

  it('rejects a fraction outside (0, 1]', () => {
    expect(() => layoutCuadro({ ...BASE, paintingHeightFraction: 0 })).toThrow()
    expect(() => layoutCuadro({ ...BASE, paintingHeightFraction: 1.2 })).toThrow()
  })

  it('rejects an unknown placement', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => layoutCuadro({ ...BASE, placement: 'middle' })).toThrow()
  })

  it('throws when the group cannot fit the wall', () => {
    expect(() => layoutCuadro({ ...BASE, cartelaWidthMm: 9000 })).toThrow(/wider than the wall/)
  })
})
