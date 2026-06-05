import raw from './event-layout.json'
import type { FurnitureItem, FurnitureKind } from './furniture'

/**
 * Event-space layout model
 * ────────────────────────
 * Parses the space-planner export (a flat list of footprint rectangles in metres)
 * into typed, 3D-ready structures for `EventSpaceScene`. The planner's coordinate
 * frame is a top-down plan: `x` runs left→right, `y` runs top→bottom (depth), both
 * in metres, origin at the top-left corner. Every element is an axis-aligned
 * rectangle `{ x, y, w, h }` = its top-left corner + size on the floor.
 *
 * 3D mapping (world units = metres, centred on the room):
 *   worldX = x + w/2 − spaceWidth/2     (plan x → world X)
 *   worldZ = y + h/2 − spaceDepth/2     (plan y → world Z, +Z = "down" the plan)
 *   worldY = up
 */

/** Production status of a wall piece: ready / proposed / pending decision. */
export type Estado = 'ok' | 'prop' | 'pend'
/** Production track: Code-rendered / Image-gen / Hybrid (`C/I` = undecided). */
export type Track = 'C' | 'I' | 'H' | 'C/I'

/**
 * Wall-graphics registry fields carried on each `wall` element in the JSON.
 * `invId` is the stable 1..21 inventory id from the brief (`invId N ↔ wall-(N-1)`);
 * `eventLayout.ts` reads it rather than assuming the index so the registry survives
 * reordering. See `specs/wall-graphics.md` (Per-wall inventory).
 */
export type WallRegistry = {
  /** Stable inventory id 1..21 from the brief. */
  invId: number
  /** Room / zone of the funnel, e.g. "S1", "S3", "S1/S3". */
  sala: string
  /** This wall's subject / theme. */
  tema: string
  /** The wall's message / functional role. */
  rol: string
  /** Production track. */
  track: Track
  /** Whether this piece carries data/facts that must be researched + sourced. */
  research: boolean
  /** Production status. */
  estado: Estado
}

export type RawElement = Partial<WallRegistry> & {
  type: string
  x: number
  y: number
  w: number
  h: number
  /**
   * Physical height in metres (the vertical extent, not a floor dimension). On a
   * wall it's the wall height (fallback {@link DEFAULT_WALL_HEIGHT_M}); on a piece
   * of furniture it's the object's own height (`sy`, fallback to its kind default).
   */
  alturaM?: number
  /** Furniture only: separation from the floor in metres (lifts the base off y=0). */
  elevacionM?: number
  /**
   * Stable code id for a wall added in the 3D editor (no inventory `invId`). Read
   * in preference to the index/`invId` fallback so an added wall keeps its id —
   * and never collides with a catalogue wall's `wall-(invId-1)` — across saves.
   */
  wallId?: string
  rotation?: number
  modelId?: string
  animation?: string
  groupId?: string
}

type RawLayout = {
  version: number
  spaceWidth: number
  spaceDepth: number
  /**
   * Single global height (metres) the 3D editor applies to *every* wall — the
   * venue's walls are uniform. Optional: absent falls back to
   * {@link DEFAULT_WALL_HEIGHT_M}. Stored once at the root rather than stamped on
   * each wall, so per-wall `alturaM` (measured-height) data stays meaningful.
   */
  wallHeight?: number
  elements: RawElement[]
  exportedAt?: string
}

const layout = raw as RawLayout

export const SPACE_WIDTH = layout.spaceWidth // metres, plan X
export const SPACE_DEPTH = layout.spaceDepth // metres, plan Y
const OFF_X = -SPACE_WIDTH / 2
const OFF_Z = -SPACE_DEPTH / 2

/**
 * Height (metres) assumed for a wall that carries no explicit `alturaM`. Matches
 * the venue's physical walls — **raised to 3 m** (the original museographic-brief
 * assumption was 2.5 m, "height from the 3D model and warn if absent"). Walls
 * dimension their graphics against this fallback until the real model height is
 * recorded on the element. See `specs/wall-graphics.md`.
 */
export const DEFAULT_WALL_HEIGHT_M = 3.0

/**
 * The saved global wall height (metres) the 3D editor seeds its height control
 * from, or `undefined` when the layout has none yet (then the scene starts on
 * {@link DEFAULT_WALL_HEIGHT_M}). The single source of truth for "all walls share
 * one height".
 */
export const WALL_HEIGHT: number | undefined =
  typeof layout.wallHeight === 'number' && Number.isFinite(layout.wallHeight) && layout.wallHeight > 0
    ? layout.wallHeight
    : undefined

/**
 * Normalise a raw `alturaM` to a usable wall height. A height is only honoured
 * when it is a finite, strictly-positive number; anything else (missing, 0, NaN,
 * negative, non-number) is treated as absent and falls back deterministically to
 * {@link DEFAULT_WALL_HEIGHT_M}. `explicit` reports which branch was taken so the
 * scene can flag walls still on the fallback.
 */
export function normalizeWallHeight(raw: unknown): { height: number; explicit: boolean } {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
    ? { height: raw, explicit: true }
    : { height: DEFAULT_WALL_HEIGHT_M, explicit: false }
}

/** A footprint rectangle resolved to world-space centre + size (metres). */
export type FootprintBox = {
  /** World centre [x, z] on the floor plane. */
  cx: number
  cz: number
  /** Size along world X and Z. */
  sx: number
  sz: number
  rotation?: number
}

function toBox(e: RawElement): FootprintBox {
  return {
    cx: e.x + e.w / 2 + OFF_X,
    cz: e.y + e.h / 2 + OFF_Z,
    sx: e.w,
    sz: e.h,
    rotation: e.rotation,
  }
}

const byType = (t: string) => layout.elements.filter((e) => e.type === t)

/**
 * A wall resolved for both rendering and as a print-mounting surface. Walls are
 * thin in one axis; that thin axis is the wall's *normal* (the face you hang art
 * on), and the other floor axis is its run/length.
 */
export type Wall = FootprintBox & {
  id: string
  /** Which world axis the wall faces (its thin axis). */
  normalAxis: 'x' | 'z'
  /** Wall length along its run axis (metres). */
  length: number
  /** Wall thickness along its normal axis (metres). */
  thickness: number
  /** Wall height (metres): per-wall `alturaM`, or {@link DEFAULT_WALL_HEIGHT_M}. */
  height: number
  /** `true` when {@link height} came from data; `false` when it was defaulted. */
  hasExplicitHeight: boolean
  /** Wall-graphics registry (present on the 21 event walls; absent on glass). */
  registry?: WallRegistry
}

function toRegistry(e: RawElement): WallRegistry | undefined {
  if (e.invId == null) return undefined
  return {
    invId: e.invId,
    sala: e.sala ?? '',
    tema: e.tema ?? '',
    rol: e.rol ?? '',
    track: e.track ?? 'C/I',
    research: e.research ?? false,
    estado: e.estado ?? 'pend',
  }
}

function toWall(e: RawElement, i: number): Wall {
  const b = toBox(e)
  // The thinner floor dimension is the wall thickness; its axis is the normal.
  const normalAxis: 'x' | 'z' = b.sx <= b.sz ? 'x' : 'z'
  const { height, explicit } = normalizeWallHeight(e.alturaM)
  return {
    ...b,
    // Code id: an editor-added wall carries its own stable `wallId`; otherwise it's
    // derived from the inventory id (`wall-(invId-1)`), not the array position, so
    // retiring a wall (e.g. #17, the confesionario) never shifts the ids after it.
    // Unregistered surfaces (glass) keep array order.
    id: e.wallId ?? `wall-${e.invId != null ? e.invId - 1 : i}`,
    normalAxis,
    length: normalAxis === 'x' ? b.sz : b.sx,
    thickness: normalAxis === 'x' ? b.sx : b.sz,
    height,
    hasExplicitHeight: explicit,
    registry: toRegistry(e),
  }
}

/**
 * Assign every wall element a unique code id. A catalogue wall keeps its inventory
 * id (`wall-(invId-1)`); an editor-added wall keeps its explicit `wallId`, unless
 * that clashes with a catalogue id — e.g. a gap in the invId sequence (retired
 * #17) leaves `wall-25` free for invId 26 while an added wall also grabbed
 * `wall-25` — in which case it's bumped to a fresh `wall-new-N`. Shared by
 * {@link WALLS} and {@link loadWallItems} so the static and editable wall views
 * never disagree, and selecting/dragging an added wall can never hit a catalogue
 * wall by id.
 */
function wallIds(elements: RawElement[]): string[] {
  const used = new Set<string>()
  for (const e of elements) if (e.invId != null) used.add(`wall-${e.invId - 1}`)
  let n = 0
  return elements.map((e, i) => {
    if (e.invId != null) return `wall-${e.invId - 1}`
    let id = e.wallId ?? `wall-${i}`
    while (used.has(id)) id = `wall-new-${n++}`
    used.add(id)
    return id
  })
}

const WALL_ELEMENTS = byType('wall')
const WALL_IDS = wallIds(WALL_ELEMENTS)
export const WALLS: Wall[] = WALL_ELEMENTS.map((e, i) => ({ ...toWall(e, i), id: WALL_IDS[i] }))
/** Glass partitions — rendered like walls but transparent; also mountable. */
export const GLASS: Wall[] = byType('glass').map((e, i) => ({ ...toWall(e, i), id: `glass-${i}` }))
export const TABLES: FootprintBox[] = byType('table').map(toBox)
export const BARS: FootprintBox[] = byType('bar').map(toBox)
export const PLANTS: FootprintBox[] = byType('plant').map(toBox)

/**
 * The movable furniture (tables, bar, plants) resolved to editable world-space
 * items — the seed the 3D scene drags / adds / removes and writes back to the
 * layout (see `./furniture`). Ids are stable per kind (`table-0`, `bar-0`, …) and
 * match {@link FurnitureItem.id} / `nextFurnitureId`'s scheme, so a saved file
 * reopens to the same items. Walls, glass, spawn and the crowd are *not* movable
 * and are excluded here.
 */
export function loadFurnitureItems(): FurnitureItem[] {
  const counters: Partial<Record<FurnitureKind, number>> = {}
  const items: FurnitureItem[] = []
  for (const e of layout.elements) {
    if (e.type !== 'table' && e.type !== 'bar' && e.type !== 'plant') continue
    const kind: FurnitureKind = e.type
    const b = toBox(e)
    const n = counters[kind] ?? 0
    counters[kind] = n + 1
    items.push({
      id: `${kind}-${n}`,
      kind,
      cx: b.cx,
      cz: b.cz,
      sx: b.sx,
      sz: b.sz,
      ...(typeof e.alturaM === 'number' && e.alturaM > 0 ? { sy: e.alturaM } : {}),
      ...(typeof e.elevacionM === 'number' && e.elevacionM > 0 ? { elevation: e.elevacionM } : {}),
      ...(e.rotation != null ? { rotation: e.rotation } : {}),
    })
  }
  return items
}
export const SPAWNS: FootprintBox[] = byType('spawn').map(toBox)

/** A person/agent reduced to a position + facing (the planner's "model" rows). */
export type Person = {
  cx: number
  cz: number
  /** Facing in radians (planner rotation is degrees, clockwise from north). */
  rotationY: number
  groupId?: string
}

export const PEOPLE: Person[] = byType('model').map((e) => {
  const b = toBox(e)
  return {
    cx: b.cx,
    cz: b.cz,
    rotationY: ((e.rotation ?? 0) * Math.PI) / 180,
    groupId: e.groupId,
  }
})

/* ── editable walls ───────────────────────────────────────────────────────────
 * The 3D scene lets the operator move / rotate / add / remove walls and write the
 * result back to the layout, with one global height for every wall. These helpers
 * are the bridge: read the wall elements into world-space editable items, resolve
 * an item back to the same `Wall` the rest of the system consumes (so an unedited
 * wall is byte-for-byte the wall it was — prints stay put), and convert an item
 * back to a planner element for the JSON. Walls rotate in 90° steps, so they stay
 * axis-aligned and the normal axis is always derived from the footprint.
 */

/** A wall reduced to its editable world-space footprint + its registry, if any. */
export type EditableWall = {
  /** Stable id — `wall-(invId-1)` for catalogue walls, `wall-new-N` for added ones. */
  id: string
  cx: number
  cz: number
  sx: number
  sz: number
  /**
   * The wall's own measured height (metres), preserved untouched across edits. The
   * scene renders every wall at the *global* height instead, so this is data — not
   * a render input — kept so a measured wall keeps its `alturaM` after a round-trip.
   */
  alturaM?: number
  /** Wall-graphics registry (catalogue walls); absent on freshly-added walls. */
  registry?: WallRegistry
}

const roundMm = (m: number) => Math.round(m * 1000) / 1000

/**
 * Read the wall elements into editable world-space items. Ids match {@link toWall}
 * exactly (`wall-(invId-1)`, or the array index when unregistered), so a saved
 * placement keyed on a wall id still resolves after a round-trip.
 */
export function loadWallItems(): EditableWall[] {
  return WALL_ELEMENTS.map((e, i) => {
    const b = toBox(e)
    return {
      id: WALL_IDS[i],
      cx: b.cx,
      cz: b.cz,
      sx: b.sx,
      sz: b.sz,
      ...(typeof e.alturaM === 'number' && e.alturaM > 0 ? { alturaM: e.alturaM } : {}),
      registry: toRegistry(e),
    }
  })
}

/**
 * Resolve an editable wall to the `Wall` the renderer / mounting math consume, at
 * the given global height. Derivation mirrors {@link toWall} (normal = thin axis),
 * so for an unmodified item this returns the same wall as the static set, only
 * with the uniform height applied.
 */
export function resolveEditableWall(item: EditableWall, height: number): Wall {
  const normalAxis: 'x' | 'z' = item.sx <= item.sz ? 'x' : 'z'
  return {
    cx: item.cx,
    cz: item.cz,
    sx: item.sx,
    sz: item.sz,
    id: item.id,
    normalAxis,
    length: normalAxis === 'x' ? item.sz : item.sx,
    thickness: normalAxis === 'x' ? item.sx : item.sz,
    height,
    hasExplicitHeight: true,
    registry: item.registry,
  }
}

/** A fresh id for an added wall: `wall-new-N`, one past the highest such suffix. */
export function nextWallId(items: EditableWall[]): string {
  let max = -1
  for (const it of items) {
    const m = /^wall-new-(\d+)$/.exec(it.id)
    if (m) {
      const n = Number(m[1])
      if (n > max) max = n
    }
  }
  return `wall-new-${max + 1}`
}

/**
 * Convert an editable wall back to a planner element for `event-layout.json`. The
 * global height lives at the layout root (not here), so this writes only the
 * footprint, the wall's *own* preserved `alturaM` (if it had one), and the
 * registry — a catalogue wall's inventory data survives the round-trip untouched.
 */
export function wallItemToElement(item: EditableWall): Record<string, unknown> {
  const el: Record<string, unknown> = {
    type: 'wall',
    x: roundMm(item.cx - item.sx / 2 - OFF_X),
    y: roundMm(item.cz - item.sz / 2 - OFF_Z),
    w: roundMm(item.sx),
    h: roundMm(item.sz),
  }
  if (typeof item.alturaM === 'number' && item.alturaM > 0) el.alturaM = roundMm(item.alturaM)
  if (item.registry) {
    const r = item.registry
    el.invId = r.invId
    el.sala = r.sala
    el.tema = r.tema
    el.rol = r.rol
    el.track = r.track
    el.research = r.research
    el.estado = r.estado
  } else {
    // No inventory id → persist the stable code id so it survives the round-trip
    // without colliding with a catalogue wall's index-derived id.
    el.wallId = item.id
  }
  return el
}

/** Every mountable surface (walls + glass), for click-to-place. */
export const MOUNTABLE: Wall[] = [...WALLS, ...GLASS]

export function findWall(id: string): Wall | undefined {
  return MOUNTABLE.find((w) => w.id === id)
}

/** The 21 registry-bearing event walls (excludes glass), ordered by `invId`. */
export const REGISTERED_WALLS: Wall[] = WALLS.filter((w) => w.registry).sort(
  (a, b) => (a.registry!.invId - b.registry!.invId),
)

/** Look up an event wall by its stable inventory id (1..21). */
export function findWallByInvId(invId: number): Wall | undefined {
  return WALLS.find((w) => w.registry?.invId === invId)
}

/** Look up walls by room/zone code (e.g. "S3"); matches walls that span it too. */
export function findWallsBySala(sala: string): Wall[] {
  return REGISTERED_WALLS.filter((w) =>
    w.registry!.sala.split(/[\/→]/).includes(sala),
  )
}

/**
 * Height (metres) to render a wall at. A wall with explicit per-wall data uses
 * that height; a wall without it uses `fallback` (default
 * {@link DEFAULT_WALL_HEIGHT_M}). The 3D scene passes a user-adjustable fallback
 * so unspecified walls can still be tuned without overriding measured ones.
 */
export function resolveWallHeight(wall: Wall, fallback: number = DEFAULT_WALL_HEIGHT_M): number {
  return wall.hasExplicitHeight ? wall.height : fallback
}

/**
 * Walls that lack explicit height and are therefore relying on the fallback —
 * the set the brief wants flagged ("warn if absent"). Defaults to scanning every
 * mountable surface (walls + glass).
 */
export function wallsWithoutHeight(walls: Wall[] = MOUNTABLE): Wall[] {
  return walls.filter((w) => !w.hasExplicitHeight)
}
