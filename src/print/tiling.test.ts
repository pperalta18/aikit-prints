import { describe, expect, it } from 'vitest'
import { divideAxis, panelCount, planTiles, tileName, type TilingInput } from './tiling'
import { mmToPx } from './geometry'

/**
 * Unit tests for the print tiling geometry (Phase 1, "tiling helper").
 *
 * These pin the *invariants the press and the slice rely on*, not a re-pasted
 * table of expected pixels:
 *   • COVERAGE — the panels' union is exactly the wall (no lost content, no white
 *     seam): first panel starts at 0, last ends at the length, consecutive panels
 *     share precisely `overlapMm`.
 *   • LIMIT — no panel ever exceeds the press's `maxPanelMm`, and the count is the
 *     minimum that satisfies it (an installer-friendly equal split).
 *   • LOSSLESS px — the px crop rects tile the source raster exactly (borders
 *     pinned), so `magick -crop` then recompose reproduces the original.
 * Asserting these means a regression can't make the test agree with a broken
 * split (e.g. a gap at a seam, or an over-wide panel the press can't print).
 */

const EPS = 1e-6
const widthsOf = (panels: { start: number; end: number }[]) => panels.map((p) => p.end - p.start)

describe('divideAxis — single panel when it fits', () => {
  it('returns one full-length panel when length ≤ maxPanel (overlap irrelevant)', () => {
    expect(divideAxis(1400, 1500, 20)).toEqual([{ start: 0, end: 1400 }])
    expect(divideAxis(1500, 1500, 20)).toEqual([{ start: 0, end: 1500 }])
  })

  it('treats an uncapped axis (Infinity) as a single panel of any length', () => {
    expect(divideAxis(28500, Infinity)).toEqual([{ start: 0, end: 28500 }])
  })
})

describe('divideAxis — covers the axis exactly', () => {
  // A spread of awkward lengths against a fixed press width + seam.
  const maxPanel = 1500
  const overlap = 20
  for (const length of [1501, 2000, 3000, 4321, 22500, 28500]) {
    it(`length ${length}: union = [0, ${length}], every seam shares exactly ${overlap}mm`, () => {
      const panels = divideAxis(length, maxPanel, overlap)
      // borders
      expect(panels[0].start).toBe(0)
      expect(panels[panels.length - 1].end).toBeCloseTo(length, 6)
      // monotonic, overlapping, no gaps
      for (let i = 0; i < panels.length - 1; i++) {
        expect(panels[i + 1].start).toBeGreaterThan(panels[i].start)
        // shared strip between neighbours is precisely the overlap
        expect(panels[i].end - panels[i + 1].start).toBeCloseTo(overlap, 6)
      }
    })
  }
})

describe('divideAxis — respects the press limit with a minimal, equal split', () => {
  const cases: Array<{ length: number; maxPanel: number; overlap: number }> = [
    { length: 3000, maxPanel: 1500, overlap: 20 },
    { length: 22500, maxPanel: 1600, overlap: 25 },
    { length: 28500, maxPanel: 1500, overlap: 20 },
    { length: 9500, maxPanel: 1370, overlap: 15 },
  ]
  for (const { length, maxPanel, overlap } of cases) {
    it(`${length}/${maxPanel}/${overlap}: panels ≤ max, equal width, and n is minimal`, () => {
      const panels = divideAxis(length, maxPanel, overlap)
      const widths = widthsOf(panels)
      // no panel exceeds the press width
      for (const w of widths) expect(w).toBeLessThanOrEqual(maxPanel + EPS)
      // equal-width split
      for (const w of widths) expect(w).toBeCloseTo(widths[0], 6)
      // minimal: one fewer panel could not cover within the limit
      const n = panels.length
      const tighter = (length + (n - 2) * overlap) / (n - 1)
      if (n > 1) expect(tighter).toBeGreaterThan(maxPanel + EPS)
    })
  }
})

describe('panelCount matches divideAxis', () => {
  it('agrees with the number of spans for the 28.5 m wall', () => {
    expect(panelCount(28500, 1500, 20)).toBe(divideAxis(28500, 1500, 20).length)
  })
  it('is 1 when the axis fits', () => {
    expect(panelCount(1000, 1500, 20)).toBe(1)
  })
})

describe('divideAxis — input validation', () => {
  it('rejects a non-positive length', () => {
    expect(() => divideAxis(0, 1500, 20)).toThrow(/lengthMm/)
    expect(() => divideAxis(-5, 1500, 20)).toThrow(/lengthMm/)
  })
  it('rejects a negative overlap', () => {
    expect(() => divideAxis(3000, 1500, -1)).toThrow(/overlapMm/)
  })
  it('rejects an overlap ≥ the panel (panels would not advance)', () => {
    expect(() => divideAxis(3000, 1500, 1500)).toThrow(/advance/)
    expect(() => divideAxis(3000, 1500, 1600)).toThrow(/advance/)
  })
})

describe('planTiles — single panel media', () => {
  it('is not tiled and the one crop is the whole raster', () => {
    const input: TilingInput = {
      mediaWidthMm: 1020,
      mediaHeightMm: 1420,
      dpi: 36,
      maxPanelWidthMm: 1500,
      overlapMm: 20,
    }
    const plan = planTiles(input)
    expect(plan.tiled).toBe(false)
    expect(plan.count).toBe(1)
    expect(plan.cols).toBe(1)
    expect(plan.rows).toBe(1)
    const t = plan.tiles[0]
    expect(t.xPx).toBe(0)
    expect(t.yPx).toBe(0)
    expect(t.widthPx).toBe(plan.mediaWidthPx)
    expect(t.heightPx).toBe(plan.mediaHeightPx)
    expect(t.suffix).toBe('_tile1')
  })

  it('defaults to a single row when no maxPanelHeight is given', () => {
    const plan = planTiles({
      mediaWidthMm: 28500,
      mediaHeightMm: 2500,
      dpi: 50,
      maxPanelWidthMm: 1500,
      overlapMm: 20,
    })
    expect(plan.rows).toBe(1)
    expect(plan.cols).toBeGreaterThan(1)
  })
})

describe('planTiles — lossless px coverage of a real wall', () => {
  // Hero-scale media: 22.5 m × 2.6 m at 50 dpi, 1.5 m panels with a 2 cm seam.
  const input: TilingInput = {
    mediaWidthMm: 22520,
    mediaHeightMm: 2620,
    dpi: 50,
    maxPanelWidthMm: 1500,
    overlapMm: 20,
  }
  const plan = planTiles(input)

  it('media px matches the geometry conversion', () => {
    expect(plan.mediaWidthPx).toBe(mmToPx(input.mediaWidthMm, input.dpi))
    expect(plan.mediaHeightPx).toBe(mmToPx(input.mediaHeightMm, input.dpi))
    expect(plan.overlapPx).toBe(mmToPx(input.overlapMm ?? 0, input.dpi))
  })

  it('indexes row-major, 1-based, with matching suffix/col/row', () => {
    expect(plan.count).toBe(plan.cols * plan.rows)
    expect(plan.tiles).toHaveLength(plan.count)
    plan.tiles.forEach((t, k) => {
      expect(t.index).toBe(k + 1)
      expect(t.suffix).toBe(`_tile${k + 1}`)
      expect(t.col).toBe(k % plan.cols)
      expect(t.row).toBe(Math.floor(k / plan.cols))
    })
  })

  it('every crop lies within the raster and no panel exceeds the press width', () => {
    for (const t of plan.tiles) {
      expect(t.xPx).toBeGreaterThanOrEqual(0)
      expect(t.yPx).toBeGreaterThanOrEqual(0)
      expect(t.xPx + t.widthPx).toBeLessThanOrEqual(plan.mediaWidthPx)
      expect(t.yPx + t.heightPx).toBeLessThanOrEqual(plan.mediaHeightPx)
      expect(t.widthMm).toBeLessThanOrEqual(input.maxPanelWidthMm + EPS)
    }
  })

  it('columns tile the full width with overlap and no gap', () => {
    const top = plan.tiles.filter((t) => t.row === 0).sort((a, b) => a.col - b.col)
    expect(top[0].xPx).toBe(0)
    expect(top[top.length - 1].xPx + top[top.length - 1].widthPx).toBe(plan.mediaWidthPx)
    for (let i = 0; i < top.length - 1; i++) {
      const rightEdge = top[i].xPx + top[i].widthPx
      // next panel starts before the current one ends → overlap, never a gap
      expect(top[i + 1].xPx).toBeLessThanOrEqual(rightEdge)
      expect(top[i + 1].xPx).toBeGreaterThan(top[i].xPx)
    }
  })
})

describe('planTiles — 2D grid when both axes are capped', () => {
  it('splits rows and columns and keeps a full row-major grid', () => {
    const plan = planTiles({
      mediaWidthMm: 6000,
      mediaHeightMm: 4000,
      dpi: 40,
      maxPanelWidthMm: 1500,
      maxPanelHeightMm: 1500,
      overlapMm: 20,
    })
    expect(plan.cols).toBeGreaterThan(1)
    expect(plan.rows).toBeGreaterThan(1)
    expect(plan.tiled).toBe(true)
    // last column of every row reaches the right border; last row reaches the bottom
    for (const t of plan.tiles) {
      if (t.col === plan.cols - 1) expect(t.xPx + t.widthPx).toBe(plan.mediaWidthPx)
      if (t.row === plan.rows - 1) expect(t.yPx + t.heightPx).toBe(plan.mediaHeightPx)
      if (t.col === 0) expect(t.xPx).toBe(0)
      if (t.row === 0) expect(t.yPx).toBe(0)
    }
  })
})

describe('tileName', () => {
  it('inserts the suffix before the extension', () => {
    expect(tileName('wall.png', 3)).toBe('wall_tile3.png')
    expect(tileName('pared-04_S5_naranja-mecanica.png', 2)).toBe(
      'pared-04_S5_naranja-mecanica_tile2.png',
    )
  })
  it('appends when there is no extension', () => {
    expect(tileName('wall', 1)).toBe('wall_tile1')
  })
})
