import { describe, it, expect } from 'vitest'
import { snapMove, fmtGap, type Box } from './snapping'

const room = { width: 30, depth: 70 }

describe('snapMove', () => {
  it('snaps centre-to-centre and reports an X alignment guide', () => {
    const other: Box = { cx: 0, cz: 0, sx: 2, sz: 2 }
    // moving box whose centre is 0.1 m off the other's centre line
    const r = snapMove({ moving: { sx: 1, sz: 1 }, cx: 0.1, cz: 5, others: [other], room, threshold: 0.3 })
    expect(r.cx).toBeCloseTo(0, 6) // pulled onto cx = 0
    expect(r.aligns.some((g) => g.axis === 'x' && Math.abs(g.at) < 1e-6)).toBe(true)
  })

  it('snaps edge-to-edge (left edges align)', () => {
    const other: Box = { cx: 0, cz: 0, sx: 4, sz: 2 } // left edge at x = -2
    // moving sx=2, so to align left edges its centre must be at -1; start 0.15 off
    const r = snapMove({ moving: { sx: 2, sz: 2 }, cx: -1.15, cz: 6, others: [other], room, threshold: 0.3 })
    expect(r.cx).toBeCloseTo(-1, 6) // left edge now at -2, matching other's left edge
  })

  it('does not snap when nothing is within the threshold', () => {
    // away from the other piece, the room centre lines (x=0,z=0) and the walls
    const other: Box = { cx: 10, cz: 10, sx: 1, sz: 1 }
    const r = snapMove({ moving: { sx: 1, sz: 1 }, cx: 3.33, cz: 7.77, others: [other], room, threshold: 0.3 })
    expect(r.cx).toBeCloseTo(3.33, 6)
    expect(r.cz).toBeCloseTo(7.77, 6)
    expect(r.aligns).toHaveLength(0)
  })

  it('falls back to the grid when given and nothing else is near', () => {
    const r = snapMove({ moving: { sx: 1, sz: 1 }, cx: 2.03, cz: 4.04, others: [], room, threshold: 0.3, grid: 0.5 })
    expect(r.cx).toBeCloseTo(2, 6)
    expect(r.cz).toBeCloseTo(4, 6)
  })

  it('measures the edge-to-edge gap to the nearest overlapping neighbour on X', () => {
    // neighbour sits to the left, overlapping in Z; right edge at x = 1
    const other: Box = { cx: 0, cz: 0, sx: 2, sz: 4 }
    // moving box centred at x = 4 (left edge 3.5) → gap = 3.5 − 1 = 2.5 m. Keep it off any
    // snap line so the position isn't nudged.
    const r = snapMove({ moving: { sx: 1, sz: 1 }, cx: 4, cz: 0, others: [other], room, threshold: 0.1 })
    const mx = r.measures.find((m) => m.axis === 'x')
    expect(mx).toBeTruthy()
    expect(mx!.dist).toBeCloseTo(2.5, 6)
  })

  it('snaps to a room wall (left edge of the room)', () => {
    // room half-width = 15, so the left wall is at x = -15. A 2 m box hugging it has
    // centre -14; start a touch inside.
    const r = snapMove({ moving: { sx: 2, sz: 2 }, cx: -13.85, cz: 0, others: [], room, threshold: 0.3 })
    expect(r.cx).toBeCloseTo(-14, 6)
  })
})

describe('fmtGap', () => {
  it('uses cm under a metre and m at/above', () => {
    expect(fmtGap(0.42)).toBe('42 cm')
    expect(fmtGap(1.25)).toBe('1.25 m')
  })
})
