/**
 * Unit tests for placement persistence (Phase 2 — 3D scene extensions).
 *
 * These pin the *durability contract* the 3D venue scene now relies on: a saved
 * layout round-trips losslessly; a corrupt, stale, or hand-edited document can
 * never crash the app or smuggle a `NaN`/zero-scale/bad-`side` placement into
 * the render; storage is fully optional (SSR / privacy mode) and degrades to an
 * empty layout instead of throwing. The tests probe behaviour and invariants
 * (not a re-paste of the field list), so a regression is caught even if the
 * production data drifts.
 */

import { describe, expect, it } from 'vitest'
import {
  PLACEMENTS_STORAGE_KEY,
  PLACEMENTS_VERSION,
  type Placement,
  type StorageLike,
  clearPlacements,
  isValidPlacement,
  loadPlacements,
  parsePlacements,
  placementsToJson,
  savePlacements,
  serializePlacements,
} from './placements'

/** A representative valid placement (one of each face). */
const sample: Placement[] = [
  { id: 'pl-0-wall-1-250', printId: 'hero', wallId: 'wall-1', along: 2.5, centerY: 1.5, scale: 1, side: 1 },
  { id: 'pl-1-glass-0--40', printId: 'naranja', wallId: 'glass-0', along: -0.4, centerY: 2.2, scale: 1.75, side: -1 },
]

/** In-memory Storage stub — exactly the slice the module depends on. */
function makeStorage(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(seed))
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

describe('isValidPlacement', () => {
  it('accepts a well-formed placement', () => {
    expect(isValidPlacement(sample[0])).toBe(true)
    expect(isValidPlacement(sample[1])).toBe(true)
  })

  it('rejects non-objects and null', () => {
    for (const bad of [null, undefined, 42, 'x', true, []]) {
      expect(isValidPlacement(bad)).toBe(false)
    }
  })

  it('requires non-empty id / printId / wallId', () => {
    expect(isValidPlacement({ ...sample[0], id: '' })).toBe(false)
    expect(isValidPlacement({ ...sample[0], printId: '' })).toBe(false)
    expect(isValidPlacement({ ...sample[0], wallId: undefined })).toBe(false)
  })

  it('rejects non-finite numeric fields', () => {
    expect(isValidPlacement({ ...sample[0], along: NaN })).toBe(false)
    expect(isValidPlacement({ ...sample[0], along: Infinity })).toBe(false)
    expect(isValidPlacement({ ...sample[0], centerY: '1.5' })).toBe(false)
  })

  it('requires a positive centerY and a positive scale', () => {
    expect(isValidPlacement({ ...sample[0], centerY: 0 })).toBe(false)
    expect(isValidPlacement({ ...sample[0], centerY: -1 })).toBe(false)
    expect(isValidPlacement({ ...sample[0], scale: 0 })).toBe(false)
    expect(isValidPlacement({ ...sample[0], scale: -0.5 })).toBe(false)
  })

  it('accepts a negative `along` (walls span both sides of the origin)', () => {
    expect(isValidPlacement({ ...sample[0], along: -7.3 })).toBe(true)
  })

  it('only accepts side === 1 or side === -1', () => {
    expect(isValidPlacement({ ...sample[0], side: 1 })).toBe(true)
    expect(isValidPlacement({ ...sample[0], side: -1 })).toBe(true)
    for (const bad of [0, 2, '1', true]) {
      expect(isValidPlacement({ ...sample[0], side: bad })).toBe(false)
    }
  })
})

describe('serializePlacements', () => {
  it('wraps the list in the current version envelope', () => {
    const doc = serializePlacements(sample)
    expect(doc.version).toBe(PLACEMENTS_VERSION)
    expect(doc.placements).toEqual(sample)
  })

  it('drops invalid entries so a clean document is always persisted', () => {
    const dirty = [sample[0], { id: 'x' }, { ...sample[1], scale: 0 }] as Placement[]
    expect(serializePlacements(dirty).placements).toEqual([sample[0]])
  })

  it('copies only known fields (no extra keys leak through)', () => {
    const withExtra = { ...sample[0], hacked: true, __proto__: { polluted: 1 } } as unknown as Placement
    const [out] = serializePlacements([withExtra]).placements
    expect(Object.keys(out).sort()).toEqual(['along', 'centerY', 'id', 'printId', 'scale', 'side', 'wallId'])
  })
})

describe('light-box fields (mount / glow)', () => {
  const lightbox: Placement = { ...sample[0], id: 'pl-lb', mount: 'lightbox', glow: 1.5 }

  it('round-trips a light-box placement losslessly', () => {
    expect(parsePlacements(placementsToJson([lightbox]))).toEqual([lightbox])
  })

  it('omits the optional fields on a plain vinyl (no key leakage / back-compat)', () => {
    const [out] = serializePlacements([sample[0]]).placements
    expect('mount' in out).toBe(false)
    expect('glow' in out).toBe(false)
  })

  it('keeps a valid placement but drops a bogus mount (degrades to a vinyl)', () => {
    const dirty = { ...sample[0], mount: 'neon' } as unknown as Placement
    const [out] = serializePlacements([dirty]).placements
    expect(isValidPlacement(dirty)).toBe(true) // mount is a lenient enhancement, never a reject
    expect('mount' in out).toBe(false)
  })

  it('drops a non-finite glow value', () => {
    const dirty = { ...sample[0], mount: 'lightbox', glow: NaN } as unknown as Placement
    const [out] = serializePlacements([dirty]).placements
    expect(out.mount).toBe('lightbox')
    expect('glow' in out).toBe(false)
  })
})

describe('double-sided link (pairId)', () => {
  const faceA: Placement = { ...sample[0], id: 'ds-fr', side: 1, pairId: 'ds-2' }
  const faceB: Placement = { ...sample[0], id: 'ds-bk', side: -1, printId: 'hero', pairId: 'ds-2' }

  it('round-trips a double-sided pair losslessly', () => {
    expect(parsePlacements(placementsToJson([faceA, faceB]))).toEqual([faceA, faceB])
  })

  it('omits pairId on a plain single-face placement (no key leakage / back-compat)', () => {
    const [out] = serializePlacements([sample[0]]).placements
    expect('pairId' in out).toBe(false)
  })

  it('drops an empty or non-string pairId (degrades to a single face)', () => {
    for (const bad of ['', 42, null, {}] as unknown[]) {
      const [out] = serializePlacements([{ ...sample[0], pairId: bad } as unknown as Placement]).placements
      expect('pairId' in out).toBe(false)
    }
  })

  it('treats pairId as a lenient enhancement, never a validation reject', () => {
    expect(isValidPlacement({ ...sample[0], pairId: 'ds-2' })).toBe(true)
    expect(isValidPlacement({ ...sample[0], pairId: 99 })).toBe(true) // bogus link, still a valid placement
  })
})

describe('parsePlacements', () => {
  it('round-trips a serialised document losslessly', () => {
    const json = placementsToJson(sample)
    expect(parsePlacements(json)).toEqual(sample)
  })

  it('accepts a JSON string, a parsed envelope, and a bare array alike', () => {
    expect(parsePlacements(placementsToJson(sample))).toEqual(sample)
    expect(parsePlacements(serializePlacements(sample))).toEqual(sample)
    expect(parsePlacements(sample)).toEqual(sample)
  })

  it('returns [] for unrecognised or malformed input (never throws)', () => {
    for (const bad of [null, undefined, 42, '', 'not json', '{', {}, { placements: 'nope' }, true]) {
      expect(parsePlacements(bad)).toEqual([])
    }
  })

  it('drops only the invalid entries, keeping the valid ones', () => {
    const mixed = { version: 1, placements: [sample[0], { id: 'bad' }, { ...sample[1], side: 3 }, sample[1]] }
    expect(parsePlacements(mixed)).toEqual([sample[0], sample[1]])
  })

  it('returns a fresh array (no aliasing of the input)', () => {
    const out = parsePlacements(sample)
    expect(out).not.toBe(sample)
    expect(out[0]).not.toBe(sample[0])
  })
})

describe('load / save / clear with a storage stub', () => {
  it('save then load reproduces the layout', () => {
    const storage = makeStorage()
    expect(savePlacements(sample, storage)).toBe(true)
    expect(loadPlacements(storage)).toEqual(sample)
  })

  it('persists under the versioned key as a valid JSON envelope', () => {
    const storage = makeStorage()
    savePlacements(sample, storage)
    const stored = JSON.parse(storage.map.get(PLACEMENTS_STORAGE_KEY)!)
    expect(stored.version).toBe(PLACEMENTS_VERSION)
    expect(stored.placements).toHaveLength(sample.length)
  })

  it('loads [] when the key is absent', () => {
    expect(loadPlacements(makeStorage())).toEqual([])
  })

  it('loads [] (not a throw) when the stored value is corrupt', () => {
    expect(loadPlacements(makeStorage({ [PLACEMENTS_STORAGE_KEY]: '{ broken' }))).toEqual([])
  })

  it('clear removes the saved layout', () => {
    const storage = makeStorage()
    savePlacements(sample, storage)
    clearPlacements(storage)
    expect(loadPlacements(storage)).toEqual([])
  })

  it('treats a null storage (SSR / unavailable) as empty and a no-op', () => {
    expect(loadPlacements(null)).toEqual([])
    expect(savePlacements(sample, null)).toBe(false)
    expect(() => clearPlacements(null)).not.toThrow()
  })

  it('returns false when the underlying storage throws (e.g. over quota)', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadPlacements(throwing)).toEqual([])
    expect(savePlacements(sample, throwing)).toBe(false)
    expect(() => clearPlacements(throwing)).not.toThrow()
  })
})
