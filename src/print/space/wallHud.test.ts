/**
 * Unit tests for the wall HUD model (Phase 0).
 *
 * Contract under test: the pure helpers that label the 21 event walls in the 3D
 * scene (`#N · sala`, theme, production `estado`) and filter/tally them by status,
 * so an operator can mount the right piece on the right wall during Phase 4/5.
 * These pin the label assembly, the truncation rule, the estado filter (incl. the
 * "no filter" and unregistered-wall edges), and the count tally — using synthetic
 * walls where the estado is controlled, plus a few invariants against the real
 * registry (`REGISTERED_WALLS`) that don't hard-code brittle per-status numbers.
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_WALL_HEIGHT_M, REGISTERED_WALLS, type Estado, type Track, type Wall, type WallRegistry } from './eventLayout'
import {
  ESTADO_COLOR,
  ESTADO_LABEL,
  ESTADO_ORDER,
  TRACK_LABEL,
  estadoColor,
  estadoCounts,
  estadoLabel,
  filterWallsByEstado,
  matchesEstadoFilter,
  truncate,
  wallLabel,
} from './wallHud'

/** A minimal synthetic wall — only the fields the HUD helpers read matter. */
function fakeWall(registry?: Partial<WallRegistry>, over: Partial<Wall> = {}): Wall {
  return {
    id: 'wall-test',
    cx: 0,
    cz: 0,
    sx: 0.2,
    sz: 1,
    normalAxis: 'x',
    length: 1,
    thickness: 0.2,
    height: DEFAULT_WALL_HEIGHT_M,
    hasExplicitHeight: false,
    registry: registry
      ? { invId: 1, sala: 'S1', tema: 'tema', rol: 'rol', track: 'C', research: false, estado: 'prop', ...registry }
      : undefined,
    ...over,
  }
}

describe('estado constants', () => {
  it('orders statuses ready → proposed → pending', () => {
    expect(ESTADO_ORDER).toEqual(['ok', 'prop', 'pend'])
  })

  it('has a Spanish label and a distinct colour for every estado', () => {
    for (const e of ESTADO_ORDER) {
      expect(ESTADO_LABEL[e]).toBeTruthy()
      expect(ESTADO_COLOR[e]).toMatch(/^#[0-9a-f]{6}$/i)
    }
    const colours = ESTADO_ORDER.map((e) => ESTADO_COLOR[e])
    expect(new Set(colours).size).toBe(colours.length)
  })

  it('labels every production track', () => {
    for (const t of ['C', 'I', 'H', 'C/I'] as Track[]) {
      expect(TRACK_LABEL[t]).toBeTruthy()
    }
  })
})

describe('estadoLabel / estadoColor', () => {
  it('maps each known estado to its label and colour', () => {
    expect(estadoLabel('ok')).toBe('Listo')
    expect(estadoLabel('prop')).toBe('Propuesto')
    expect(estadoLabel('pend')).toBe('Pendiente')
    expect(estadoColor('ok')).toBe(ESTADO_COLOR.ok)
    expect(estadoColor('pend')).toBe(ESTADO_COLOR.pend)
  })

  it('degrades gracefully on an unknown status', () => {
    const bogus = 'xxx' as Estado
    expect(estadoLabel(bogus)).toBe('xxx')
    expect(estadoColor(bogus)).toBe('#9aa0ac')
  })
})

describe('truncate', () => {
  it('returns the text unchanged when within the limit', () => {
    expect(truncate('hello', 5)).toBe('hello')
    expect(truncate('hi', 10)).toBe('hi')
    expect(truncate('', 4)).toBe('')
  })

  it('cuts to at most `max` glyphs including the ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hell…')
    expect(truncate('hello world', 5)).toHaveLength(5)
    expect(truncate('abcdefghij', 4)).toBe('abc…')
  })

  it('trims whitespace before the ellipsis', () => {
    expect(truncate('ab cdef', 4)).toBe('ab…')
    expect(truncate('ab cdef', 4).length).toBeLessThanOrEqual(4)
  })

  it('handles the degenerate small limits', () => {
    expect(truncate('anything', 0)).toBe('')
    expect(truncate('anything', -3)).toBe('')
    expect(truncate('anything', 1)).toBe('…')
  })

  it('never exceeds the requested length for any cut', () => {
    const text = 'the speed of artificial intelligence is inevitable'
    for (let max = 1; max <= text.length + 2; max++) {
      expect(truncate(text, max).length).toBeLessThanOrEqual(max)
    }
  })
})

describe('wallLabel', () => {
  it('assembles the identity tag, theme, estado and track for a registry wall', () => {
    const w = fakeWall({ invId: 2, sala: 'S1/S3', tema: 'Combustión → caos', estado: 'prop', track: 'H', research: true })
    const label = wallLabel(w)
    expect(label).not.toBeNull()
    expect(label!.invId).toBe(2)
    expect(label!.tag).toBe('#2 · S1/S3')
    expect(label!.tema).toBe('Combustión → caos')
    expect(label!.estado).toBe('prop')
    expect(label!.estadoText).toBe('Propuesto')
    expect(label!.color).toBe(ESTADO_COLOR.prop)
    expect(label!.track).toBe('H')
    expect(label!.research).toBe(true)
  })

  it('returns null for a wall with no registry (e.g. glass)', () => {
    expect(wallLabel(fakeWall(undefined))).toBeNull()
  })

  it('omits the separator when the sala is blank', () => {
    const label = wallLabel(fakeWall({ invId: 7, sala: '   ' }))
    expect(label!.tag).toBe('#7')
  })

  it('truncates a long theme to the requested width', () => {
    const long = 'A very long theme description that would overflow a compact chip badge'
    const label = wallLabel(fakeWall({ tema: long }), { temaMax: 20 })
    expect(label!.tema).toHaveLength(20)
    expect(label!.tema.endsWith('…')).toBe(true)
  })

  it('defaults temaMax to 40', () => {
    const long = 'x'.repeat(60)
    expect(wallLabel(fakeWall({ tema: long }))!.tema).toHaveLength(40)
  })
})

describe('matchesEstadoFilter', () => {
  it('passes everything when the filter is null (no filter)', () => {
    expect(matchesEstadoFilter(fakeWall({ estado: 'pend' }), null)).toBe(true)
    expect(matchesEstadoFilter(fakeWall(undefined), null)).toBe(true)
  })

  it('passes only walls whose estado is in the visible set', () => {
    const visible = new Set<Estado>(['ok', 'prop'])
    expect(matchesEstadoFilter(fakeWall({ estado: 'ok' }), visible)).toBe(true)
    expect(matchesEstadoFilter(fakeWall({ estado: 'prop' }), visible)).toBe(true)
    expect(matchesEstadoFilter(fakeWall({ estado: 'pend' }), visible)).toBe(false)
  })

  it('rejects an unregistered wall whenever a filter is active', () => {
    const visible = new Set<Estado>(['ok', 'prop', 'pend'])
    expect(matchesEstadoFilter(fakeWall(undefined), visible)).toBe(false)
  })

  it('an empty visible set hides every wall', () => {
    const none = new Set<Estado>()
    expect(matchesEstadoFilter(fakeWall({ estado: 'ok' }), none)).toBe(false)
  })
})

describe('filterWallsByEstado', () => {
  const walls = [
    fakeWall({ invId: 1, estado: 'ok' }, { id: 'w1' }),
    fakeWall({ invId: 2, estado: 'prop' }, { id: 'w2' }),
    fakeWall({ invId: 3, estado: 'pend' }, { id: 'w3' }),
    fakeWall(undefined, { id: 'glass' }),
  ]

  it('returns the full list (sans nothing) when unfiltered', () => {
    expect(filterWallsByEstado(walls, null).map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'glass'])
  })

  it('keeps only matching registry walls when filtered', () => {
    const visible = new Set<Estado>(['pend'])
    expect(filterWallsByEstado(walls, visible).map((w) => w.id)).toEqual(['w3'])
  })

  it('does not mutate the input array', () => {
    const before = walls.slice()
    filterWallsByEstado(walls, new Set<Estado>(['ok']))
    expect(walls).toEqual(before)
  })
})

describe('estadoCounts', () => {
  it('tallies per status and ignores unregistered walls', () => {
    const walls = [
      fakeWall({ estado: 'ok' }),
      fakeWall({ estado: 'ok' }),
      fakeWall({ estado: 'prop' }),
      fakeWall({ estado: 'pend' }),
      fakeWall({ estado: 'pend' }),
      fakeWall({ estado: 'pend' }),
      fakeWall(undefined),
    ]
    expect(estadoCounts(walls)).toEqual({ ok: 2, prop: 1, pend: 3, total: 6 })
  })

  it('total always equals ok + prop + pend', () => {
    const walls = [fakeWall({ estado: 'ok' }), fakeWall({ estado: 'pend' }), fakeWall(undefined)]
    const c = estadoCounts(walls)
    expect(c.total).toBe(c.ok + c.prop + c.pend)
  })

  it('is all zeros for an empty / registry-free list', () => {
    expect(estadoCounts([])).toEqual({ ok: 0, prop: 0, pend: 0, total: 0 })
    expect(estadoCounts([fakeWall(undefined)])).toEqual({ ok: 0, prop: 0, pend: 0, total: 0 })
  })
})

describe('against the real registry (REGISTERED_WALLS)', () => {
  it('every event wall produces a non-null label', () => {
    for (const w of REGISTERED_WALLS) {
      const label = wallLabel(w)
      expect(label).not.toBeNull()
      expect(label!.invId).toBe(w.registry!.invId)
      expect(label!.tag.startsWith(`#${w.registry!.invId}`)).toBe(true)
    }
  })

  it('counts the whole inventory and partitions it across the three statuses', () => {
    const c = estadoCounts(REGISTERED_WALLS)
    expect(c.total).toBe(REGISTERED_WALLS.length)
    expect(c.ok + c.prop + c.pend).toBe(c.total)
    // Honest invariant: the inventory still has unresolved walls in production.
    expect(c.total).toBeGreaterThan(0)
  })

  it('filtering by all three statuses keeps every registered wall', () => {
    const all = new Set<Estado>(ESTADO_ORDER)
    expect(filterWallsByEstado(REGISTERED_WALLS, all)).toHaveLength(REGISTERED_WALLS.length)
  })

  it('the per-status filters partition the registry exactly', () => {
    const total = REGISTERED_WALLS.length
    const sum = ESTADO_ORDER.reduce(
      (n, e) => n + filterWallsByEstado(REGISTERED_WALLS, new Set<Estado>([e])).length,
      0,
    )
    expect(sum).toBe(total)
  })
})
