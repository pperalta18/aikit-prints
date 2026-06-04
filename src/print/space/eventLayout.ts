import raw from './event-layout.json'

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
   * Physical wall height in metres (the vertical extent, not a floor dimension).
   * Optional: walls without it fall back to {@link DEFAULT_WALL_HEIGHT_M}.
   */
  alturaM?: number
  rotation?: number
  modelId?: string
  animation?: string
  groupId?: string
}

type RawLayout = {
  version: number
  spaceWidth: number
  spaceDepth: number
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
 * the museographic brief — "height from the 3D model (assume 2.5 m and warn if
 * absent)". Walls dimension their graphics against this fallback until the real
 * model height is recorded on the element. See `specs/wall-graphics.md`.
 */
export const DEFAULT_WALL_HEIGHT_M = 2.5

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
    // Code id is derived from the stable inventory id (`wall-(invId-1)`), not the
    // array position, so retiring a wall (e.g. #17, the confesionario) never shifts
    // the ids of the walls after it. Unregistered surfaces (glass) keep array order.
    id: `wall-${e.invId != null ? e.invId - 1 : i}`,
    normalAxis,
    length: normalAxis === 'x' ? b.sz : b.sx,
    thickness: normalAxis === 'x' ? b.sx : b.sz,
    height,
    hasExplicitHeight: explicit,
    registry: toRegistry(e),
  }
}

export const WALLS: Wall[] = byType('wall').map(toWall)
/** Glass partitions — rendered like walls but transparent; also mountable. */
export const GLASS: Wall[] = byType('glass').map((e, i) => ({ ...toWall(e, i), id: `glass-${i}` }))
export const TABLES: FootprintBox[] = byType('table').map(toBox)
export const BARS: FootprintBox[] = byType('bar').map(toBox)
export const PLANTS: FootprintBox[] = byType('plant').map(toBox)
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
