import { describe, it, expect } from 'vitest'
import {
  FURNITURE_HEIGHT_DEFAULTS,
  furnitureElevation,
  furnitureHeight,
  furnitureToElement,
  furnitureToElements,
  isFurnitureKind,
  isValidFurnitureItem,
  nextFurnitureId,
  type FurnitureItem,
} from './furniture'
import { SPACE_DEPTH, SPACE_WIDTH, loadFurnitureItems } from './eventLayout'

/**
 * Furniture model contract
 * ─────────────────────────
 * The movable-furniture core is pure and serialisable, so it carries the same
 * burden the placement layer does: a hand-edited / stale payload must never inject
 * a NaN, and a saved file must reopen identically. These tests pin the validation
 * and the world↔plan round-trip that the save endpoint relies on.
 */

const valid: FurnitureItem = { id: 'table-0', kind: 'table', cx: 0, cz: 0, sx: 2, sz: 2 }

describe('isFurnitureKind', () => {
  it('accepts the three movable kinds and nothing else', () => {
    expect(isFurnitureKind('table')).toBe(true)
    expect(isFurnitureKind('bar')).toBe(true)
    expect(isFurnitureKind('plant')).toBe(true)
    expect(isFurnitureKind('wall')).toBe(false)
    expect(isFurnitureKind('model')).toBe(false)
    expect(isFurnitureKind(undefined)).toBe(false)
  })
})

describe('isValidFurnitureItem', () => {
  it('accepts a well-formed item', () => {
    expect(isValidFurnitureItem(valid)).toBe(true)
    expect(isValidFurnitureItem({ ...valid, rotation: 90 })).toBe(true)
  })

  it('rejects bad kinds, NaN positions, non-positive sizes and bad rotation', () => {
    expect(isValidFurnitureItem({ ...valid, kind: 'sofa' })).toBe(false)
    expect(isValidFurnitureItem({ ...valid, cx: NaN })).toBe(false)
    expect(isValidFurnitureItem({ ...valid, sx: 0 })).toBe(false)
    expect(isValidFurnitureItem({ ...valid, sz: -1 })).toBe(false)
    expect(isValidFurnitureItem({ ...valid, id: '' })).toBe(false)
    expect(isValidFurnitureItem({ ...valid, rotation: 'x' })).toBe(false)
    expect(isValidFurnitureItem(null)).toBe(false)
  })

  it('accepts a valid object height + floor separation, rejects bad ones', () => {
    expect(isValidFurnitureItem({ ...valid, sy: 1.05, elevation: 0.5 })).toBe(true)
    expect(isValidFurnitureItem({ ...valid, elevation: 0 })).toBe(true) // on the floor
    expect(isValidFurnitureItem({ ...valid, sy: 0 })).toBe(false) // height must be > 0
    expect(isValidFurnitureItem({ ...valid, sy: -1 })).toBe(false)
    expect(isValidFurnitureItem({ ...valid, sy: 'x' })).toBe(false)
    expect(isValidFurnitureItem({ ...valid, elevation: -0.5 })).toBe(false) // can't sink below the floor
  })
})

describe('furnitureHeight / furnitureElevation', () => {
  it('fall back to the kind default height and to the floor when absent', () => {
    expect(furnitureHeight(valid)).toBe(FURNITURE_HEIGHT_DEFAULTS.table)
    expect(furnitureHeight({ ...valid, kind: 'bar' })).toBe(FURNITURE_HEIGHT_DEFAULTS.bar)
    expect(furnitureElevation(valid)).toBe(0)
  })

  it('use the explicit value when present', () => {
    expect(furnitureHeight({ ...valid, sy: 2 })).toBe(2)
    expect(furnitureElevation({ ...valid, elevation: 0.5 })).toBe(0.5)
  })
})

describe('furnitureToElement', () => {
  it('inverts the plan→world mapping (centre → top-left corner)', () => {
    // In a 30×40 room, a 2×2 piece centred at the origin sits at plan (14, 19).
    const el = furnitureToElement(valid, 30, 40)
    expect(el).toEqual({ type: 'table', x: 14, y: 19, w: 2, h: 2 })
  })

  it('carries a non-zero rotation but omits a zero one', () => {
    expect(furnitureToElement({ ...valid, rotation: 45 }, 30, 40).rotation).toBe(45)
    expect(furnitureToElement({ ...valid, rotation: 0 }, 30, 40)).not.toHaveProperty('rotation')
  })

  it('writes alturaM / elevacionM only when set (object height + floor separation)', () => {
    expect(furnitureToElement({ ...valid, sy: 1.05, elevation: 0.5 }, 30, 40)).toMatchObject({
      alturaM: 1.05,
      elevacionM: 0.5,
    })
    const bare = furnitureToElement(valid, 30, 40)
    expect(bare).not.toHaveProperty('alturaM') // unset height → kind default on reload
    expect(bare).not.toHaveProperty('elevacionM')
    expect(furnitureToElement({ ...valid, elevation: 0 }, 30, 40)).not.toHaveProperty('elevacionM')
  })

  it('drops invalid items when converting a list', () => {
    const els = furnitureToElements([valid, { ...valid, sx: 0 } as FurnitureItem], 30, 40)
    expect(els).toHaveLength(1)
  })
})

describe('nextFurnitureId', () => {
  it('starts at 0 and is one past the highest used suffix per kind', () => {
    expect(nextFurnitureId([], 'table')).toBe('table-0')
    const items: FurnitureItem[] = [
      { ...valid, id: 'table-0' },
      { ...valid, id: 'table-2' },
      { ...valid, id: 'bar-0', kind: 'bar' },
    ]
    expect(nextFurnitureId(items, 'table')).toBe('table-3') // ignores the gap-free assumption
    expect(nextFurnitureId(items, 'bar')).toBe('bar-1')
    expect(nextFurnitureId(items, 'plant')).toBe('plant-0')
  })
})

describe('round-trip against the live layout', () => {
  it('loadFurnitureItems → furnitureToElement reproduces the planner rectangles', () => {
    const items = loadFurnitureItems()
    expect(items.length).toBeGreaterThan(0)
    for (const it of items) {
      const el = furnitureToElement(it, SPACE_WIDTH, SPACE_DEPTH)
      // Centre back to corner and the size is unchanged — a stable round-trip.
      expect(Number.isFinite(el.x)).toBe(true)
      expect(Number.isFinite(el.y)).toBe(true)
      expect(el.w).toBeCloseTo(it.sx, 6)
      expect(el.h).toBeCloseTo(it.sz, 6)
    }
  })

  it('assigns stable per-kind ids that nextFurnitureId would continue', () => {
    const items = loadFurnitureItems()
    const tables = items.filter((i) => i.kind === 'table')
    expect(tables.map((t) => t.id)).toContain('table-0')
    // The next id never collides with an existing one.
    const ids = new Set(items.map((i) => i.id))
    expect(ids.has(nextFurnitureId(items, 'table'))).toBe(false)
  })
})
