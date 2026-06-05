import { describe, it, expect } from 'vitest'
import {
  SPACE_DEPTH,
  SPACE_WIDTH,
  WALLS,
  loadWallItems,
  nextWallId,
  resolveEditableWall,
  wallItemToElement,
  type EditableWall,
} from './eventLayout'

/**
 * Editable-wall contract
 * ──────────────────────
 * Walls are deeply wired into mounting, frames and labels, so the editing layer's
 * one hard invariant is: an *unmodified* wall must resolve to exactly the wall it
 * always was (same id + geometry), or prints keyed on its id would jump. These
 * tests pin that, plus the world↔plan round-trip the save endpoint relies on and
 * the collision-free id scheme for added walls.
 */

describe('loadWallItems + resolveEditableWall', () => {
  it('reproduces every static wall (id + footprint + registry), only the height being global', () => {
    const items = loadWallItems()
    expect(items.length).toBe(WALLS.length)
    for (const it of items) {
      const orig = WALLS.find((w) => w.id === it.id)
      expect(orig, `wall ${it.id} present in static set`).toBeTruthy()
      const resolved = resolveEditableWall(it, 2.5)
      expect(resolved.cx).toBe(orig!.cx)
      expect(resolved.cz).toBe(orig!.cz)
      expect(resolved.sx).toBe(orig!.sx)
      expect(resolved.sz).toBe(orig!.sz)
      expect(resolved.normalAxis).toBe(orig!.normalAxis)
      expect(resolved.length).toBe(orig!.length)
      expect(resolved.thickness).toBe(orig!.thickness)
      expect(resolved.registry).toEqual(orig!.registry)
      // Every wall resolves at the one global height handed in.
      expect(resolved.height).toBe(2.5)
    }
  })

  it('derives the normal axis from the footprint (thin axis), so a 90° swap flips it', () => {
    const run: EditableWall = { id: 'wall-new-0', cx: 0, cz: 0, sx: 6, sz: 0.3 }
    expect(resolveEditableWall(run, 3).normalAxis).toBe('z') // thin along z
    const rotated: EditableWall = { ...run, sx: 0.3, sz: 6 }
    expect(resolveEditableWall(rotated, 3).normalAxis).toBe('x') // thin along x
  })
})

describe('wallItemToElement', () => {
  it('inverts the plan↔world mapping and preserves only a wall’s own alturaM', () => {
    for (const it of loadWallItems()) {
      const el = wallItemToElement(it)
      expect(el.type).toBe('wall')
      // Reconstruct the world centre from the planner rectangle.
      expect((el.x as number) + (el.w as number) / 2 - SPACE_WIDTH / 2).toBeCloseTo(it.cx, 6)
      expect((el.y as number) + (el.h as number) / 2 - SPACE_DEPTH / 2).toBeCloseTo(it.cz, 6)
      expect(el.w).toBeCloseTo(it.sx, 6)
      expect(el.h).toBeCloseTo(it.sz, 6)
      // A wall's measured height is carried through untouched; the global height is
      // stored at the layout root, never stamped per wall.
      if (it.alturaM != null) expect(el.alturaM).toBe(it.alturaM)
      else expect(el).not.toHaveProperty('alturaM')
    }
  })

  it('carries a registry through for catalogue walls and omits it for added ones', () => {
    const registered = loadWallItems().find((w) => w.registry)!
    const el = wallItemToElement(registered)
    expect(el.invId).toBe(registered.registry!.invId)
    expect(el.sala).toBe(registered.registry!.sala)
    expect(typeof el.research).toBe('boolean')

    const added: EditableWall = { id: 'wall-new-0', cx: 1, cz: 1, sx: 4, sz: 0.2 }
    const plain = wallItemToElement(added)
    expect(plain).not.toHaveProperty('invId')
    expect(plain).not.toHaveProperty('sala')
    expect(plain).not.toHaveProperty('alturaM')
  })
})

describe('nextWallId', () => {
  it('never collides with the loaded ids and counts past the highest wall-new suffix', () => {
    const items = loadWallItems()
    // The invariant that matters: the next id is fresh, whatever the venue holds.
    expect(items.some((w) => w.id === nextWallId(items))).toBe(false)

    expect(nextWallId([])).toBe('wall-new-0')
    const withAdded: EditableWall[] = [{ id: 'wall-new-3', cx: 0, cz: 0, sx: 1, sz: 1 }]
    expect(nextWallId(withAdded)).toBe('wall-new-4')
  })
})
