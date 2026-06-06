import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROUTE,
  dirBetween,
  footprint,
  reflowRoute,
  resolveScene,
  routeArrows,
  serpentine,
  solve,
  spiral,
  staircase,
  type Coord,
} from './pathfinding'

const contiguous = (path: Coord[]) =>
  path.every((c, i) => i === 0 || Math.abs(c[0] - path[i - 1][0]) + Math.abs(c[1] - path[i - 1][1]) === 1)

describe('pathfinding route geometry', () => {
  it('points each arrow toward the next step, last toward the goal', () => {
    const dirs = routeArrows([{ at: [1, 2] }, { at: [2, 2] }, { at: [2, 1] }], [4, 1])
    expect(dirs).toEqual(['right', 'up', 'right'])
  })

  it('dirBetween picks the dominant cardinal', () => {
    expect(dirBetween([1, 1], [3, 1])).toBe('right')
    expect(dirBetween([3, 1], [3, 4])).toBe('down')
    expect(dirBetween([3, 4], [1, 4])).toBe('left')
    expect(dirBetween([3, 4], [3, 1])).toBe('up')
  })

  it('BFS solve returns an inclusive shortest path around blocked cells', () => {
    const path = solve([1, 3], [5, 1], { columns: 5, rows: 3, blocked: [[3, 2]] })
    expect(path[0]).toEqual([1, 3])
    expect(path[path.length - 1]).toEqual([5, 1])
    // shortest 4-connected path over Δcol 4 + Δrow 2 is 7 cells (6 moves).
    expect(path).toHaveLength(7)
  })

  it('reflowRoute keeps an already-adjacent route in place', () => {
    const route = DEFAULT_ROUTE.map((at) => ({ at }))
    const flowed = reflowRoute(route)
    expect(flowed.map((s) => s.at)).toEqual(DEFAULT_ROUTE)
  })

  it('resolveScene places the goal just past the top-right and never overlaps footprints', () => {
    const scene = resolveScene()
    expect(scene.goalNode).toEqual([scene.columns + 1, 1])
    expect(scene.startNode[0]).toBe(0)
    expect(scene.dirs).toHaveLength(scene.steps.length)

    const seen = new Set<string>()
    for (const step of scene.steps) {
      const fp = footprint(step)
      for (let c = fp.c0; c <= fp.c1; c += 1) {
        for (let r = fp.r0; r <= fp.r1; r += 1) {
          const k = `${c},${r}`
          expect(seen.has(k)).toBe(false)
          seen.add(k)
        }
      }
    }
  })

  it('search patterns are 4-adjacent contiguous (so reflow keeps them in place)', () => {
    expect(contiguous(staircase(10, 8))).toBe(true)
    expect(contiguous(serpentine(10, 8))).toBe(true)
    expect(contiguous(spiral(10, 8))).toBe(true)
  })

  it('serpentine and spiral cover every cell exactly once; staircase climbs to the corner', () => {
    expect(serpentine(10, 8)).toHaveLength(80)
    expect(new Set(serpentine(10, 8).map((c) => c.join(','))).size).toBe(80)
    expect(spiral(10, 8)).toHaveLength(80)
    expect(new Set(spiral(10, 8).map((c) => c.join(','))).size).toBe(80)
    const stair = staircase(10, 8)
    expect(stair[0]).toEqual([1, 8])
    expect(stair.at(-1)).toEqual([10, 1])
  })

  it('resolveScene generates a named pattern when given one', () => {
    const scene = resolveScene({ columns: 10, rows: 8, pattern: 'spiral' })
    expect(scene.steps).toHaveLength(80)
    expect(scene.dirs).toHaveLength(80)
  })

  it('honours an explicit BFS solve from doc.props', () => {
    const scene = resolveScene({
      columns: 6,
      rows: 4,
      solve: { start: [1, 4], goal: [6, 1], blocked: [[3, 4], [3, 3], [3, 2]] as Coord[] },
    })
    expect(scene.steps[0].at).toEqual([1, 4])
    expect(scene.steps.at(-1)?.at).toEqual([6, 1])
  })
})
