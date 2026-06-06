import { describe, expect, it } from 'vitest'
import { COLUMNAS_INV_ID, cellOpacities, layoutColumns, tickPositions } from './columnas'

/**
 * columnas (19-S-1) — pure layout logic tests
 * ───────────────────────────────────────────
 * Three render-free concerns: that `layoutColumns` places equal columns with a
 * fixed gap centred on the wall (equal margins, exact span, loud failure when the
 * group can't fit), that `tickPositions` rules a closed cell module (both ends
 * inclusive, anchored to a datum, extensible past the media into the bleed), and
 * that `cellOpacities` builds a deterministic scatter (a chosen empty share, the
 * rest random in range, seed-reproducible).
 */

describe('columnas — identity', () => {
  it('targets wall 19', () => {
    expect(COLUMNAS_INV_ID).toBe(19)
  })
})

describe('layoutColumns — equal columns, fixed gap, centred group', () => {
  it('places the 19-S-1 default: two 1.15 m columns, 1 m apart, centred on a 7 m wall', () => {
    const l = layoutColumns({ trimWidthMm: 7000 })
    expect(l.columnWidthMm).toBe(1150)
    expect(l.gapMm).toBe(1000)
    expect(l.spanMm).toBe(1150 + 1000 + 1150) // 3300
    expect(l.marginMm).toBe((7000 - 3300) / 2) // 1850
    expect(l.columnLeftsMm).toEqual([1850, 1850 + 1150 + 1000]) // [1850, 4000]
  })

  it('keeps the group symmetric: right margin equals left margin', () => {
    const l = layoutColumns({ trimWidthMm: 7000, count: 3, columnWidthMm: 800, gapMm: 400 })
    const lastRight = l.columnLeftsMm[l.columnLeftsMm.length - 1] + l.columnWidthMm
    expect(7000 - lastRight).toBeCloseTo(l.marginMm, 9)
  })

  it('spaces adjacent columns by exactly width + gap', () => {
    const l = layoutColumns({ trimWidthMm: 7000, count: 2, columnWidthMm: 1150, gapMm: 1000 })
    expect(l.columnLeftsMm[1] - l.columnLeftsMm[0]).toBe(1150 + 1000)
  })

  it('handles a single column (centred, no gap term)', () => {
    const l = layoutColumns({ trimWidthMm: 4000, count: 1, columnWidthMm: 1000 })
    expect(l.spanMm).toBe(1000)
    expect(l.columnLeftsMm).toEqual([1500])
  })

  it('is deterministic and throws on bad input or an overflowing group', () => {
    expect(layoutColumns({ trimWidthMm: 7000 })).toEqual(layoutColumns({ trimWidthMm: 7000 }))
    expect(() => layoutColumns({ trimWidthMm: 0 })).toThrow()
    expect(() => layoutColumns({ trimWidthMm: 7000, count: 0 })).toThrow()
    expect(() => layoutColumns({ trimWidthMm: 7000, count: 2.5 })).toThrow()
    expect(() => layoutColumns({ trimWidthMm: 7000, columnWidthMm: 0 })).toThrow()
    expect(() => layoutColumns({ trimWidthMm: 7000, gapMm: -1 })).toThrow()
    // 2×1150 + 1×1000 = 3300 fits 3300 exactly (margin 0), but not 3299
    expect(() => layoutColumns({ trimWidthMm: 3300 })).not.toThrow()
    expect(() => layoutColumns({ trimWidthMm: 3299 })).toThrow()
  })
})

describe('tickPositions — a closed, datum-anchored grid module', () => {
  it('rules a whole-multiple range as a closed grid (both ends inclusive)', () => {
    // a 1150 mm column at a 50 mm module → 24 lines, edges included
    const xs = tickPositions({ originMm: 0, moduleMm: 50, minMm: 0, maxMm: 1150 })
    expect(xs.length).toBe(24)
    expect(xs[0]).toBe(0)
    expect(xs[xs.length - 1]).toBe(1150)
  })

  it('always lands a line on the origin datum, and extends both ways (into the bleed)', () => {
    // floor anchored at 3010 mm from the media top, module 50, ranging the full media
    const ys = tickPositions({ originMm: 3010, moduleMm: 50, minMm: 0, maxMm: 3020 })
    expect(ys).toContain(3010) // the floor itself is a line
    expect(ys).toContain(10) // trim top (3010 − 60·50) lands too
    expect(ys[0]).toBeGreaterThanOrEqual(0)
    expect(ys[ys.length - 1]).toBeLessThanOrEqual(3020)
    // every line is on the module, anchored to the datum
    for (const y of ys) expect((y - 3010) % 50).toBeCloseTo(0, 9)
  })

  it('offsets a column origin without breaking the module', () => {
    const xs = tickPositions({ originMm: 1850, moduleMm: 50, minMm: 1850, maxMm: 3000 })
    expect(xs[0]).toBe(1850)
    expect(xs[xs.length - 1]).toBe(3000)
    expect(xs.length).toBe(24)
  })

  it('is deterministic and throws on a bad module or inverted range', () => {
    expect(tickPositions({ originMm: 0, moduleMm: 50, minMm: 0, maxMm: 1150 })).toEqual(
      tickPositions({ originMm: 0, moduleMm: 50, minMm: 0, maxMm: 1150 }),
    )
    expect(() => tickPositions({ originMm: 0, moduleMm: 0, minMm: 0, maxMm: 100 })).toThrow()
    expect(() => tickPositions({ originMm: 0, moduleMm: 50, minMm: 100, maxMm: 0 })).toThrow()
  })
})

describe('cellOpacities — a deterministic per-cell scatter', () => {
  it('returns one opacity per cell', () => {
    expect(cellOpacities({ count: 100, seed: 1 })).toHaveLength(100)
    expect(cellOpacities({ count: 0, seed: 1 })).toEqual([])
  })

  it('is seed-reproducible (same seed ⇒ identical field) and reshuffles on a new seed', () => {
    expect(cellOpacities({ count: 200, seed: 7 })).toEqual(cellOpacities({ count: 200, seed: 7 }))
    expect(cellOpacities({ count: 200, seed: 7 })).not.toEqual(cellOpacities({ count: 200, seed: 8 }))
  })

  it('forces roughly emptyFrac of the cells to exactly 0 (the empty share)', () => {
    const op = cellOpacities({ count: 4000, seed: 3, emptyFrac: 0.7 })
    const empties = op.filter((o) => o === 0).length
    expect(empties / op.length).toBeCloseTo(0.7, 1) // ~70%, within sampling noise
    expect(empties).toBeGreaterThan(0)
    expect(empties).toBeLessThan(op.length)
  })

  it('keeps every filled cell inside [minOpacity, maxOpacity]', () => {
    const op = cellOpacities({ count: 4000, seed: 5, emptyFrac: 0.3, minOpacity: 0.2, maxOpacity: 0.9 })
    for (const o of op) {
      if (o === 0) continue
      expect(o).toBeGreaterThanOrEqual(0.2)
      expect(o).toBeLessThanOrEqual(0.9)
    }
  })

  it('emptyFrac = 0 fills every cell; emptyFrac = 1 empties every cell', () => {
    expect(cellOpacities({ count: 500, seed: 2, emptyFrac: 0 }).every((o) => o > 0)).toBe(true)
    expect(cellOpacities({ count: 500, seed: 2, emptyFrac: 1 }).every((o) => o === 0)).toBe(true)
  })

  it('throws on a bad count, emptyFrac out of [0,1], or an inverted/out-of-range opacity span', () => {
    expect(() => cellOpacities({ count: -1 })).toThrow()
    expect(() => cellOpacities({ count: 2.5 })).toThrow()
    expect(() => cellOpacities({ count: 10, emptyFrac: 1.2 })).toThrow()
    expect(() => cellOpacities({ count: 10, minOpacity: 0.8, maxOpacity: 0.2 })).toThrow()
    expect(() => cellOpacities({ count: 10, maxOpacity: 1.5 })).toThrow()
  })
})
