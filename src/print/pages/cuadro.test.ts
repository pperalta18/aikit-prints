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

describe('layoutCuadro — diptych (secondPainting)', () => {
  // A wide feature wall (13 × 3 m) hung with two reliefs, like 8-N-1.
  const WIDE: CuadroLayoutOpts = {
    wallWidthMm: 13000,
    wallHeightMm: 3000,
    paintingAspect: 2 / 3,
    paintingHeightFraction: 0.84,
    cartelaWidthMm: 460,
    gapMm: 300,
    secondPainting: true,
  }

  it('returns two paintings and a cartela, both reliefs the same size', () => {
    const { painting, painting2, cartela } = layoutCuadro(WIDE)
    expect(painting2).toBeDefined()
    if (!painting2) throw new Error('no painting2')
    expect(painting2.width).toBeCloseTo(painting.width, 6)
    expect(painting2.height).toBeCloseTo(painting.height, 6)
    expect(cartela.width).toBeCloseTo(WIDE.cartelaWidthMm, 6)
    // sized to the wall-height fraction and true aspect
    expect(painting.height).toBeCloseTo(3000 * 0.84, 6)
    expect(painting.width / painting.height).toBeCloseTo(2 / 3, 6)
  })

  it('centres each relief on a wall quarter-point and the cartela dead-centre', () => {
    const { painting, painting2, cartela } = layoutCuadro(WIDE)
    if (!painting2) throw new Error('no painting2')
    expect(painting.x + painting.width / 2).toBeCloseTo(WIDE.wallWidthMm * 0.25, 6)
    expect(painting2.x + painting2.width / 2).toBeCloseTo(WIDE.wallWidthMm * 0.75, 6)
    expect(cartela.x + cartela.width / 2).toBeCloseTo(WIDE.wallWidthMm / 2, 6)
  })

  it('hangs everything at the same height, vertically centred', () => {
    const { painting, painting2, cartela } = layoutCuadro(WIDE)
    if (!painting2) throw new Error('no painting2')
    const top = painting.y
    const bottom = WIDE.wallHeightMm - (painting.y + painting.height)
    expect(top).toBeCloseTo(bottom, 6)
    expect(painting2.y).toBeCloseTo(top, 6)
    expect(cartela.y).toBeCloseTo(top, 6)
    expect(cartela.height).toBeCloseTo(painting.height, 6)
  })

  it('is symmetric and keeps everything inside the wall without overlap', () => {
    const { painting, painting2, cartela, group } = layoutCuadro(WIDE)
    if (!painting2) throw new Error('no painting2')
    const leftAir = group.x
    const rightAir = WIDE.wallWidthMm - (group.x + group.width)
    expect(leftAir).toBeCloseTo(rightAir, 6)
    // order on the wall: P1 | cartela | P2, no overlaps
    expect(painting.x + painting.width).toBeLessThanOrEqual(cartela.x + EPS)
    expect(cartela.x + cartela.width).toBeLessThanOrEqual(painting2.x + EPS)
    for (const box of [painting, painting2, cartela]) {
      expect(box.x).toBeGreaterThanOrEqual(-EPS)
      expect(box.x + box.width).toBeLessThanOrEqual(WIDE.wallWidthMm + EPS)
    }
  })

  it('throws when the cartela cannot fit between the two reliefs', () => {
    expect(() => layoutCuadro({ ...WIDE, cartelaWidthMm: 7000 })).toThrow(/overlaps a painting/)
  })

  it('throws when the reliefs themselves overflow the wall', () => {
    // A narrow wall can't seat two quarter-point reliefs.
    expect(() => layoutCuadro({ ...WIDE, wallWidthMm: 2000 })).toThrow()
  })
})

describe('layoutCuadro — dual-cartela diptych (each relief its own label)', () => {
  // 8-N-1's new layout: two reliefs on the quarter-points, each with its own cartela
  // hung ½ m to its inner side, so the wall reads as two independent cuadros.
  const DUAL: CuadroLayoutOpts = {
    wallWidthMm: 13000,
    wallHeightMm: 3000,
    paintingAspect: 2 / 3,
    paintingHeightFraction: 0.84,
    cartelaWidthMm: 560,
    gapMm: 500, // ½ m
    secondPainting: true,
    dualCartela: true,
  }

  it('returns a second cartela and keeps both reliefs on the quarter-points', () => {
    const { painting, painting2, cartela2 } = layoutCuadro(DUAL)
    expect(cartela2).toBeDefined()
    if (!painting2 || !cartela2) throw new Error('missing diptych boxes')
    expect(painting.x + painting.width / 2).toBeCloseTo(DUAL.wallWidthMm * 0.25, 6)
    expect(painting2.x + painting2.width / 2).toBeCloseTo(DUAL.wallWidthMm * 0.75, 6)
  })

  it('hangs each label exactly gapMm to the inner side of its relief', () => {
    const { painting, painting2, cartela, cartela2 } = layoutCuadro(DUAL)
    if (!painting2 || !cartela2) throw new Error('missing diptych boxes')
    // label 1 sits gapMm to the RIGHT of relief 1; label 2 gapMm to the LEFT of relief 2
    expect(cartela.x - (painting.x + painting.width)).toBeCloseTo(DUAL.gapMm, 6)
    expect(painting2.x - (cartela2.x + cartela2.width)).toBeCloseTo(DUAL.gapMm, 6)
  })

  it('is mirror-symmetric and keeps everything inside the wall without overlap', () => {
    const { painting, painting2, cartela, cartela2, group } = layoutCuadro(DUAL)
    if (!painting2 || !cartela2) throw new Error('missing diptych boxes')
    const centre = DUAL.wallWidthMm / 2
    // mirror symmetry about the wall centre, for both reliefs and both labels
    expect(painting.x + painting.width / 2 - centre).toBeCloseTo(centre - (painting2.x + painting2.width / 2), 6)
    expect(cartela.x + cartela.width / 2 - centre).toBeCloseTo(centre - (cartela2.x + cartela2.width / 2), 6)
    // order on the wall: P1 | label1 | (air) | label2 | P2, no overlaps
    expect(painting.x + painting.width).toBeLessThanOrEqual(cartela.x + EPS)
    expect(cartela.x + cartela.width).toBeLessThanOrEqual(cartela2.x + EPS)
    expect(cartela2.x + cartela2.width).toBeLessThanOrEqual(painting2.x + EPS)
    for (const box of [painting, painting2, cartela, cartela2]) {
      expect(box.x).toBeGreaterThanOrEqual(-EPS)
      expect(box.x + box.width).toBeLessThanOrEqual(DUAL.wallWidthMm + EPS)
    }
    // both labels share the relief height and top edge; the group spans the two reliefs
    expect(cartela.height).toBeCloseTo(painting.height, 6)
    expect(cartela2.y).toBeCloseTo(painting.y, 6)
    expect(group.x).toBeCloseTo(painting.x, 6)
  })

  it('throws when the two labels would collide in the centre', () => {
    expect(() => layoutCuadro({ ...DUAL, cartelaWidthMm: 3000 })).toThrow(/collide in the centre/)
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
