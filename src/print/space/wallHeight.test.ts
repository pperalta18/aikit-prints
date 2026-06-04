/**
 * Unit tests for per-wall height (Phase 2).
 *
 * Contract under test: walls take their physical height from per-wall data
 * (`alturaM`) and fall back to 2.5 m "and warn if absent" (the museographic
 * brief, `specs/wall-graphics.md`). These pin the *pure* height logic the 3D
 * scene depends on — coercion of bad/missing values, the data-vs-fallback
 * resolution, and the "which walls are still defaulted" flag used for the warn —
 * without asserting any fabricated height numbers (none are measured yet, so the
 * honest current state is that every wall is on the fallback).
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WALL_HEIGHT_M,
  GLASS,
  MOUNTABLE,
  WALLS,
  normalizeWallHeight,
  resolveWallHeight,
  wallsWithoutHeight,
  type Wall,
} from './eventLayout'

/** A minimal synthetic wall — only the fields the height helpers read. */
function fakeWall(over: Partial<Wall> = {}): Wall {
  return {
    id: 'wall-test',
    cx: 0,
    cz: 0,
    sx: 1,
    sz: 0.2,
    normalAxis: 'z',
    length: 1,
    thickness: 0.2,
    height: DEFAULT_WALL_HEIGHT_M,
    hasExplicitHeight: false,
    ...over,
  }
}

describe('DEFAULT_WALL_HEIGHT_M', () => {
  it('is the 2.5 m the brief mandates as the fallback', () => {
    expect(DEFAULT_WALL_HEIGHT_M).toBe(2.5)
  })
})

describe('normalizeWallHeight — coercion of raw alturaM', () => {
  it('honours a finite, strictly-positive number', () => {
    expect(normalizeWallHeight(3.2)).toEqual({ height: 3.2, explicit: true })
    expect(normalizeWallHeight(2.5)).toEqual({ height: 2.5, explicit: true })
    expect(normalizeWallHeight(0.01)).toEqual({ height: 0.01, explicit: true })
  })

  it('treats a missing value as absent → fallback', () => {
    expect(normalizeWallHeight(undefined)).toEqual({ height: DEFAULT_WALL_HEIGHT_M, explicit: false })
    expect(normalizeWallHeight(null)).toEqual({ height: DEFAULT_WALL_HEIGHT_M, explicit: false })
  })

  it('rejects zero and negatives (a wall cannot be ≤ 0 m tall)', () => {
    expect(normalizeWallHeight(0)).toEqual({ height: DEFAULT_WALL_HEIGHT_M, explicit: false })
    expect(normalizeWallHeight(-2.5)).toEqual({ height: DEFAULT_WALL_HEIGHT_M, explicit: false })
  })

  it('rejects non-finite and non-number values', () => {
    expect(normalizeWallHeight(NaN)).toEqual({ height: DEFAULT_WALL_HEIGHT_M, explicit: false })
    expect(normalizeWallHeight(Infinity)).toEqual({ height: DEFAULT_WALL_HEIGHT_M, explicit: false })
    expect(normalizeWallHeight('3')).toEqual({ height: DEFAULT_WALL_HEIGHT_M, explicit: false })
    expect(normalizeWallHeight({})).toEqual({ height: DEFAULT_WALL_HEIGHT_M, explicit: false })
  })

  it('a rejected value is never reported as explicit', () => {
    for (const bad of [undefined, null, 0, -1, NaN, Infinity, '2', {}, []]) {
      const r = normalizeWallHeight(bad)
      expect(r.explicit).toBe(false)
      expect(r.height).toBe(DEFAULT_WALL_HEIGHT_M)
    }
  })
})

describe('resolveWallHeight — data wins, otherwise fallback', () => {
  it('returns the wall height when it is explicit, ignoring the fallback', () => {
    const w = fakeWall({ height: 4, hasExplicitHeight: true })
    expect(resolveWallHeight(w, 2.8)).toBe(4)
    expect(resolveWallHeight(w)).toBe(4)
  })

  it('returns the caller fallback when the wall has no explicit height', () => {
    const w = fakeWall({ height: DEFAULT_WALL_HEIGHT_M, hasExplicitHeight: false })
    expect(resolveWallHeight(w, 3.3)).toBe(3.3)
  })

  it('defaults the fallback to DEFAULT_WALL_HEIGHT_M when omitted', () => {
    const w = fakeWall({ hasExplicitHeight: false })
    expect(resolveWallHeight(w)).toBe(DEFAULT_WALL_HEIGHT_M)
  })

  it('a measured height is unaffected by the user-adjustable fallback', () => {
    const measured = fakeWall({ height: 3.7, hasExplicitHeight: true })
    expect(resolveWallHeight(measured, 2.2)).toBe(3.7)
    expect(resolveWallHeight(measured, 5)).toBe(3.7)
  })
})

describe('wallsWithoutHeight — the set to warn about', () => {
  it('returns walls flagged as not having explicit height', () => {
    const a = fakeWall({ id: 'a', hasExplicitHeight: false })
    const b = fakeWall({ id: 'b', height: 3, hasExplicitHeight: true })
    const c = fakeWall({ id: 'c', hasExplicitHeight: false })
    expect(wallsWithoutHeight([a, b, c]).map((w) => w.id)).toEqual(['a', 'c'])
  })

  it('returns an empty list when every wall is measured', () => {
    const all = [fakeWall({ hasExplicitHeight: true }), fakeWall({ hasExplicitHeight: true })]
    expect(wallsWithoutHeight(all)).toEqual([])
  })

  it('defaults to scanning every mountable surface', () => {
    // The two S3 nave dividers (invId 12, 16) carry an explicit alturaM; every
    // other surface is still on the fallback, so all-but-two lack a measured height.
    expect(wallsWithoutHeight()).toHaveLength(MOUNTABLE.length - 2)
  })
})

describe('parsed layout — current honest state (no heights measured yet)', () => {
  it('every wall parses a height and a hasExplicitHeight flag', () => {
    for (const w of [...WALLS, ...GLASS]) {
      expect(typeof w.height).toBe('number')
      expect(w.height).toBeGreaterThan(0)
      expect(typeof w.hasExplicitHeight).toBe('boolean')
    }
  })

  it('falls walls back to 2.5 m unless they carry an explicit alturaM', () => {
    // The S3 nave dividers (invId 12, 16) carry alturaM: 2; every other wall still
    // takes its height from the 3D model later and uses the fallback for now.
    for (const w of WALLS) {
      if (w.hasExplicitHeight) {
        expect(w.height).toBe(2)
      } else {
        expect(w.height).toBe(DEFAULT_WALL_HEIGHT_M)
      }
    }
    const explicit = WALLS.filter((w) => w.hasExplicitHeight).map((w) => w.registry?.invId).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(explicit).toEqual([12, 16])
  })

  it('a measured wall would surface its data height end-to-end', () => {
    // Mirrors what toWall does with a real alturaM, proving the data path works
    // the moment a height is added to event-layout.json (not just the fallback).
    const { height, explicit } = normalizeWallHeight(3.1)
    const measured = fakeWall({ height, hasExplicitHeight: explicit })
    expect(resolveWallHeight(measured, DEFAULT_WALL_HEIGHT_M)).toBe(3.1)
    expect(wallsWithoutHeight([measured])).toEqual([])
  })
})
