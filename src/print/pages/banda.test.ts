import { describe, expect, it } from 'vitest'
import { bandRows, bandColumns, bandCellOpacity } from './banda'

/**
 * banda — pure layout logic tests for the «friso continuo» band
 * ─────────────────────────────────────────────────────────────
 * Three render-free concerns: that `bandRows` tiles the band into whole global
 * rows anchored to the band top, that `bandColumns` cuts the wall into cells
 * anchored to a global world coordinate (so the same world cell gets the same
 * `globalCol` regardless of where the print's left edge sits, in either
 * direction), and — the property the whole frieze rests on — that
 * `bandCellOpacity` is a positional field that **seam-matches**: the same
 * (col, row, seed) yields the same opacity, so two prints covering one world cell
 * paint it identically.
 */

const BLEED = 10

describe('bandRows — the band vertical module (global rows)', () => {
  it('tiles a 0.3 m band of 12.5 mm cells into 24 rows, top a fixed distance below the media top', () => {
    const rows = bandRows({ bandTopMm: 300, bandHeightMm: 300, gridMm: 12.5, bleedMm: BLEED })
    expect(rows).toHaveLength(24)
    // First row top = bleed + bandTop below the media top; rows are gridMm tall.
    expect(rows[0].y0Mm).toBe(BLEED + 300)
    expect(rows[0].y1Mm - rows[0].y0Mm).toBeCloseTo(12.5, 9)
    expect(rows[0].row).toBe(0)
    // The band spans exactly bandHeightMm.
    expect(rows[rows.length - 1].y1Mm - rows[0].y0Mm).toBeCloseTo(300, 9)
  })

  it('rejects a non-positive module or thickness', () => {
    expect(() => bandRows({ bandTopMm: 800, bandHeightMm: 500, gridMm: 0, bleedMm: BLEED })).toThrow()
    expect(() => bandRows({ bandTopMm: 800, bandHeightMm: 0, gridMm: 12.5, bleedMm: BLEED })).toThrow()
  })
})

describe('bandColumns — cells anchored to a global world coordinate', () => {
  it('indexes cells by the world grid cell they occupy (origin on a grid line, dir +1)', () => {
    // originMm 1000 = 80·12.5 → the trim-left lands exactly on world grid line k=80.
    const cols = bandColumns({ mediaWidthMm: 100 + 2 * BLEED, bleedMm: BLEED, originMm: 1000, dir: 1, gridMm: 12.5 })
    const trimLeft = cols.find((c) => Math.abs(c.x0Mm - BLEED) < 1e-6)
    expect(trimLeft?.globalCol).toBe(80) // world [1000, 1012.5) → k = 80
  })

  it('seam-matches two collinear faces: the shared world cell gets the same globalCol from both sides', () => {
    // 16-N-1 covers worldX [−1750, 1000] (origin 1000, dir −1); 30-N-1 covers
    // [−3250, −1750] (origin −1750, dir −1). They meet at worldX −1750 = −140·12.5.
    const a = bandColumns({ mediaWidthMm: 2750 + 2 * BLEED, bleedMm: BLEED, originMm: 1000, dir: -1, gridMm: 12.5 })
    const b = bandColumns({ mediaWidthMm: 1500 + 2 * BLEED, bleedMm: BLEED, originMm: -1750, dir: -1, gridMm: 12.5 })
    const aCols = new Set(a.map((c) => c.globalCol))
    const bCols = new Set(b.map((c) => c.globalCol))
    // The join cell (k = −141, world [−1762.5, −1750)) is covered by both panels.
    expect(aCols.has(-141)).toBe(true)
    expect(bCols.has(-141)).toBe(true)
  })

  it('covers the full media (cells reach past both trim edges into the bleed)', () => {
    const media = 100 + 2 * BLEED
    const cols = bandColumns({ mediaWidthMm: media, bleedMm: BLEED, originMm: 0, dir: 1, gridMm: 12.5 })
    expect(Math.min(...cols.map((c) => c.x0Mm))).toBeLessThanOrEqual(0)
    expect(Math.max(...cols.map((c) => c.x1Mm))).toBeGreaterThanOrEqual(media)
  })

  it('rejects a bad direction or non-positive module/width', () => {
    expect(() => bandColumns({ mediaWidthMm: 100, bleedMm: BLEED, originMm: 0, dir: 2 as 1, gridMm: 12.5 })).toThrow()
    expect(() => bandColumns({ mediaWidthMm: 100, bleedMm: BLEED, originMm: 0, dir: 1, gridMm: 0 })).toThrow()
    expect(() => bandColumns({ mediaWidthMm: 0, bleedMm: BLEED, originMm: 0, dir: 1, gridMm: 12.5 })).toThrow()
  })
})

describe('bandCellOpacity — a positional, seam-matching field', () => {
  const base = { seed: 16, emptyFrac: 0.7, minOpacity: 0.1, maxOpacity: 1 }

  it('is deterministic: same (col, row, seed) ⇒ identical opacity', () => {
    expect(bandCellOpacity({ col: -141, row: 7, ...base })).toBe(bandCellOpacity({ col: -141, row: 7, ...base }))
  })

  it('seam-matches: a world cell resolves the same on any print that covers it', () => {
    // Whatever the two panels' origins, the cell is addressed by its global index,
    // so both panels draw the join cell identically (this is the whole point).
    const fromA = bandCellOpacity({ col: -141, row: 3, ...base })
    const fromB = bandCellOpacity({ col: -141, row: 3, ...base })
    expect(fromA).toBe(fromB)
  })

  it('honours the empty share and keeps filled cells within the opacity range', () => {
    let empty = 0
    const N = 2000
    for (let k = 0; k < N; k++) {
      const o = bandCellOpacity({ col: k, row: 0, ...base })
      if (o === 0) {
        empty++
      } else {
        expect(o).toBeGreaterThanOrEqual(base.minOpacity - 1e-9)
        expect(o).toBeLessThanOrEqual(base.maxOpacity + 1e-9)
      }
    }
    expect(empty / N).toBeGreaterThan(0.6)
    expect(empty / N).toBeLessThan(0.8)
  })

  it('reshuffles with the seed (the field as a whole differs)', () => {
    const fieldFor = (seed: number) => Array.from({ length: 64 }, (_, k) => bandCellOpacity({ col: k, row: 0, ...base, seed }))
    expect(fieldFor(16)).not.toEqual(fieldFor(17))
  })

  it('rejects a bad empty share or opacity range', () => {
    expect(() => bandCellOpacity({ col: 0, row: 0, ...base, emptyFrac: 1.5 })).toThrow()
    expect(() => bandCellOpacity({ col: 0, row: 0, ...base, minOpacity: 0.8, maxOpacity: 0.2 })).toThrow()
  })
})
