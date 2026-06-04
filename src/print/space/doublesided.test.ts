/**
 * Unit tests for double-sided wall pieces (Phase 2 — 3D scene extensions).
 *
 * These pin the *coherence contract* of a double-sided piece: turning one front
 * placement + a back print into two back-to-back, position-locked placements with
 * distinct art and a shared link; finding / grouping / unlinking the two faces;
 * and the field subset that must mirror between them when one is edited. The tests
 * probe behaviour and invariants (back-to-back geometry, opposite faces, no input
 * mutation, lenient queries) rather than re-pasting the field list, so a regression
 * is caught even if the production wiring drifts.
 */

import { describe, expect, it } from 'vitest'
import type { Placement } from './placements'
import {
  DOUBLE_SIDED_INV_IDS,
  WALL_FACES,
  facesOf,
  isDoubleSidedInvId,
  isFace,
  isPaired,
  oppositeFace,
  pairFor,
  planDoubleSided,
  syncedFaceFields,
  unlinkPair,
  wallSupportsDoubleSided,
} from './doublesided'

/** A representative single-face front placement (a light-box, to prove inheritance). */
const front: Placement = {
  id: 'pl-front',
  printId: 'combustion-s1',
  wallId: 'wall-1',
  along: 3.2,
  centerY: 1.55,
  scale: 1.4,
  side: 1,
  mount: 'lightbox',
  glow: 1.2,
}

describe('face vocabulary', () => {
  it('exposes both faces in a stable order', () => {
    expect(WALL_FACES).toEqual([1, -1])
  })

  it('isFace accepts only ±1', () => {
    expect(isFace(1)).toBe(true)
    expect(isFace(-1)).toBe(true)
    for (const bad of [0, 2, -2, '1', null, undefined, NaN, true]) {
      expect(isFace(bad)).toBe(false)
    }
  })

  it('oppositeFace flips the face and is an involution', () => {
    expect(oppositeFace(1)).toBe(-1)
    expect(oppositeFace(-1)).toBe(1)
    expect(oppositeFace(oppositeFace(1))).toBe(1)
    expect(oppositeFace(oppositeFace(-1))).toBe(-1)
  })
})

describe('designated double-sided walls', () => {
  it('is exactly the brief set {2, 12}', () => {
    expect([...DOUBLE_SIDED_INV_IDS].sort((a, b) => a - b)).toEqual([2, 12])
  })

  it('isDoubleSidedInvId matches only those ids', () => {
    expect(isDoubleSidedInvId(2)).toBe(true)
    expect(isDoubleSidedInvId(12)).toBe(true)
    for (const bad of [1, 3, 11, 13, 21, '2', null, undefined, NaN]) {
      expect(isDoubleSidedInvId(bad)).toBe(false)
    }
  })

  it('wallSupportsDoubleSided reads the wall registry invId', () => {
    expect(wallSupportsDoubleSided({ registry: { invId: 2 } })).toBe(true)
    expect(wallSupportsDoubleSided({ registry: { invId: 12 } })).toBe(true)
    expect(wallSupportsDoubleSided({ registry: { invId: 5 } })).toBe(false)
  })

  it('treats glass / unregistered / missing walls as not double-sided', () => {
    expect(wallSupportsDoubleSided({})).toBe(false)
    expect(wallSupportsDoubleSided({ registry: null })).toBe(false)
    expect(wallSupportsDoubleSided({ registry: {} })).toBe(false)
    expect(wallSupportsDoubleSided(null)).toBe(false)
    expect(wallSupportsDoubleSided(undefined)).toBe(false)
  })
})

describe('planDoubleSided', () => {
  it('produces exactly two placements with stable, unique ids and a shared pairId', () => {
    const pair = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds7-wall-1' })
    expect(pair).toHaveLength(2)
    const [f, b] = pair
    expect(f.id).toBe('ds7-wall-1-fr')
    expect(b.id).toBe('ds7-wall-1-bk')
    expect(f.id).not.toBe(b.id)
    expect(f.pairId).toBe('ds7-wall-1')
    expect(b.pairId).toBe('ds7-wall-1')
  })

  it('puts the faces back-to-back: opposite sides, same wall', () => {
    const [f, b] = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds' })
    expect(f.side).toBe(front.side)
    expect(b.side).toBe(oppositeFace(front.side))
    expect(f.side).toBe(-b.side)
    expect(f.wallId).toBe('wall-1')
    expect(b.wallId).toBe('wall-1')
  })

  it('gives each face distinct art (front keeps base, back gets backPrintId)', () => {
    const [f, b] = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds' })
    expect(f.printId).toBe('combustion-s1')
    expect(b.printId).toBe('hero-solar')
  })

  it('locks the two faces to the same position + scale (back-to-back alignment)', () => {
    const [f, b] = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds' })
    expect(b.along).toBe(f.along)
    expect(b.centerY).toBe(f.centerY)
    expect(b.scale).toBe(f.scale)
    expect(f.along).toBe(front.along)
  })

  it('inherits mount / glow from the base on both faces by default', () => {
    const [f, b] = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds' })
    expect(f.mount).toBe('lightbox')
    expect(f.glow).toBe(1.2)
    expect(b.mount).toBe('lightbox')
    expect(b.glow).toBe(1.2)
  })

  it('starts the front from a plain vinyl base without inventing mount/glow', () => {
    const vinyl: Placement = { ...front, mount: undefined, glow: undefined }
    const [f, b] = planDoubleSided({ base: vinyl, backPrintId: 'x', idPrefix: 'ds' })
    expect(f.mount).toBeUndefined()
    expect(b.mount).toBeUndefined()
  })

  it('lets the back override scale / mount / glow (light-box front, vinyl back)', () => {
    const [, b] = planDoubleSided({
      base: front,
      backPrintId: 'confesionario',
      idPrefix: 'ds',
      back: { scale: 0.8, mount: 'vinyl', glow: 0.3 },
    })
    expect(b.scale).toBe(0.8)
    expect(b.mount).toBe('vinyl')
    expect(b.glow).toBe(0.3)
  })

  it('drops the back mount when overridden to undefined (back becomes a vinyl)', () => {
    const [, b] = planDoubleSided({
      base: front,
      backPrintId: 'confesionario',
      idPrefix: 'ds',
      back: { mount: undefined },
    })
    expect('mount' in b).toBe(false)
  })

  it('ignores invalid back overrides (keeps the inherited values)', () => {
    const [, b] = planDoubleSided({
      base: front,
      backPrintId: 'confesionario',
      idPrefix: 'ds',
      back: { scale: -1, glow: Number.NaN, mount: 'neon' as unknown as 'vinyl' },
    })
    expect(b.scale).toBe(front.scale) // negative ignored
    expect(b.glow).toBe(front.glow) // NaN ignored
    expect(b.mount).toBe('lightbox') // bogus mount ignored
  })

  it('does not mutate the base placement', () => {
    const snapshot = JSON.parse(JSON.stringify(front))
    planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds', back: { scale: 0.5 } })
    expect(front).toEqual(snapshot)
  })

  it('rejects an empty idPrefix or backPrintId', () => {
    expect(() => planDoubleSided({ base: front, backPrintId: '', idPrefix: 'ds' })).toThrow()
    expect(() => planDoubleSided({ base: front, backPrintId: 'x', idPrefix: '' })).toThrow()
  })

  it('rejects a base with an invalid side', () => {
    const bad = { ...front, side: 0 as unknown as 1 }
    expect(() => planDoubleSided({ base: bad, backPrintId: 'x', idPrefix: 'ds' })).toThrow()
  })

  it('the resulting faces form a recognisable pair', () => {
    const pair = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds' })
    expect(pairFor(pair[0], pair)).toBe(pair[1])
    expect(pairFor(pair[1], pair)).toBe(pair[0])
    expect(isPaired(pair[0], pair)).toBe(true)
  })
})

describe('pairFor / facesOf / isPaired', () => {
  const [f, b] = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds' })
  const single: Placement = { ...front, id: 'lone', pairId: undefined }
  const all = [f, single, b]

  it('finds the opposite face of a paired placement', () => {
    expect(pairFor(f, all)).toBe(b)
    expect(pairFor(b, all)).toBe(f)
  })

  it('returns null for a placement without a pairId', () => {
    expect(pairFor(single, all)).toBeNull()
    expect(isPaired(single, all)).toBe(false)
  })

  it('returns null when the pairId has no sibling in the list', () => {
    expect(pairFor(f, [f, single])).toBeNull() // partner b absent
  })

  it('never reports a placement as its own pair', () => {
    expect(pairFor(f, [f])).toBeNull()
  })

  it('facesOf returns both faces of a pairId, and [] for empty / unknown', () => {
    expect(facesOf('ds', all)).toEqual([f, b])
    expect(facesOf('', all)).toEqual([])
    expect(facesOf('nope', all)).toEqual([])
  })
})

describe('syncedFaceFields', () => {
  it('keeps only the positional fields that must mirror between faces', () => {
    const patch: Partial<Placement> = { along: 5, centerY: 2, scale: 1.1 }
    expect(syncedFaceFields(patch)).toEqual({ along: 5, centerY: 2, scale: 1.1 })
  })

  it('drops per-face attributes (side / printId / mount / glow / id / pairId)', () => {
    const patch: Partial<Placement> = {
      along: 5,
      side: -1,
      printId: 'other',
      mount: 'vinyl',
      glow: 0.4,
      id: 'x',
      pairId: 'y',
    }
    expect(syncedFaceFields(patch)).toEqual({ along: 5 })
  })

  it('only includes keys actually present in the patch', () => {
    expect(syncedFaceFields({ scale: 2 })).toEqual({ scale: 2 })
    expect(syncedFaceFields({})).toEqual({})
  })
})

describe('unlinkPair', () => {
  it('strips the shared pairId from both faces, leaving geometry intact', () => {
    const [f, b] = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds' })
    const out = unlinkPair('ds', [f, b])
    expect(out.every((p) => p.pairId === undefined)).toBe(true)
    // geometry / art untouched
    expect(out[0]).toMatchObject({ id: f.id, along: f.along, side: f.side, printId: f.printId })
    expect(out[1]).toMatchObject({ id: b.id, side: b.side, printId: b.printId })
  })

  it('leaves placements of other pairs (and singles) untouched by reference', () => {
    const [f, b] = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds' })
    const single: Placement = { ...front, id: 'lone', pairId: undefined }
    const out = unlinkPair('ds', [f, single, b])
    expect(out[1]).toBe(single) // unaffected entries keep their reference
  })

  it('is a no-op (fresh copy) for an empty pairId', () => {
    const list = [front]
    const out = unlinkPair('', list)
    expect(out).toEqual(list)
    expect(out).not.toBe(list)
  })

  it('after unlinking, the faces no longer resolve as a pair', () => {
    const [f, b] = planDoubleSided({ base: front, backPrintId: 'hero-solar', idPrefix: 'ds' })
    const out = unlinkPair('ds', [f, b])
    expect(pairFor(out[0], out)).toBeNull()
  })
})
