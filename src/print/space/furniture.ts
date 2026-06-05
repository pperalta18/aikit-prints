/**
 * Editable furniture
 * ──────────────────
 * The venue's *movable* objects — banquet tables, the bar, planters. Unlike the
 * walls (a fixed museographic shell) these are arranged per-event, so the 3D
 * scene lets the operator drag, add and remove them and write the result back to
 * `event-layout.json`. This module is the *pure, serialisable* core of that:
 *
 *   • the item shape (world-space footprint, the same frame `FootprintBox` uses),
 *   • strict validation (so a hand-edit / stale payload can't inject a NaN),
 *   • and the world→plan conversion that turns an item back into the planner's
 *     top-left-corner rectangle for the JSON.
 *
 * Coordinate frames (mirrors `eventLayout.ts`):
 *   plan  = `{ x, y, w, h }` top-left corner + size, origin top-left (the JSON).
 *   world = `{ cx, cz, sx, sz }` centre + size, origin at the room centre (3D).
 *     cx = x + w/2 − spaceWidth/2 ;  cz = y + h/2 − spaceDepth/2
 *
 * JSX-free and side-effect-free at module load, so it runs in the node `unit`
 * project. `EventSpaceScene` owns the React wiring; `eventLayout` owns reading
 * the layout file; this owns the contract between them.
 */

/** The movable furniture kinds the operator can place. */
export type FurnitureKind = 'table' | 'bar' | 'plant'

/** Ordered for the palette UI. */
export const FURNITURE_KINDS: readonly FurnitureKind[] = ['table', 'bar', 'plant']

/** Spanish label per kind (palette + editor). */
export const FURNITURE_LABEL: Record<FurnitureKind, string> = {
  table: 'Mesa',
  bar: 'Barra',
  plant: 'Planta',
}

/**
 * A movable furniture object resolved to its world-space footprint (metres) — the
 * same `{ cx, cz, sx, sz }` frame the scene renders boxes in, plus a stable id and
 * an optional planar rotation (degrees, matching the planner's convention).
 */
export type FurnitureItem = {
  /** Stable id, unique within a layout (e.g. `table-0`, `bar-1`). */
  id: string
  kind: FurnitureKind
  /** World centre on the floor plane (metres). */
  cx: number
  cz: number
  /** Footprint size along world X / Z (metres). */
  sx: number
  sz: number
  /**
   * The object's own height along world Y (metres) — its vertical extent (e.g. how
   * tall the bar is). Optional: absent / non-positive falls back to the per-kind
   * default via {@link furnitureHeight}, so legacy layouts keep their look.
   */
  sy?: number
  /**
   * Separation from the floor (metres): how far the piece's base is lifted off the
   * ground plane (`y = 0`). Optional: absent / negative is treated as 0 (sitting on
   * the floor) via {@link furnitureElevation}.
   */
  elevation?: number
  /** Planar rotation in degrees (clockwise), as stored in the layout. */
  rotation?: number
}

/** Default footprint (metres) a freshly-placed item of each kind gets. */
export const FURNITURE_DEFAULTS: Record<FurnitureKind, { sx: number; sz: number }> = {
  table: { sx: 2.5, sz: 3 },
  bar: { sx: 3, sz: 1 },
  plant: { sx: 0.8, sz: 0.8 },
}

/** Footprint size bounds (metres) the editor clamps each item to. */
export const FURNITURE_MIN_SIZE = 0.3
export const FURNITURE_MAX_SIZE = 12

/**
 * Default object height (metres) per kind — the intrinsic vertical size a piece
 * gets when it carries no explicit `sy`. Mirrors the geometry `FurnitureModel`
 * builds, so a fresh / legacy piece looks unchanged until its height is edited.
 */
export const FURNITURE_HEIGHT_DEFAULTS: Record<FurnitureKind, number> = {
  table: 0.74,
  bar: 1.05,
  plant: 1.1,
}

/** Object-height (`sy`) bounds (metres) the editor clamps to. */
export const FURNITURE_MIN_HEIGHT = 0.1
export const FURNITURE_MAX_HEIGHT = 6

/** Elevation (separation-from-floor) bounds (metres) the editor clamps to. */
export const FURNITURE_MIN_ELEVATION = 0
export const FURNITURE_MAX_ELEVATION = 6

const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const isNonEmptyString = (s: unknown): s is string => typeof s === 'string' && s.length > 0

/** Resolve a piece's object height (metres): explicit `sy`, else the kind default. */
export const furnitureHeight = (it: FurnitureItem): number =>
  isFiniteNum(it.sy) && it.sy > 0 ? it.sy : FURNITURE_HEIGHT_DEFAULTS[it.kind]

/** Resolve a piece's elevation (metres): explicit `elevation`, else 0 (on the floor). */
export const furnitureElevation = (it: FurnitureItem): number =>
  isFiniteNum(it.elevation) && it.elevation > 0 ? it.elevation : 0

/** Narrow an arbitrary value to a known furniture kind. */
export function isFurnitureKind(value: unknown): value is FurnitureKind {
  return value === 'table' || value === 'bar' || value === 'plant'
}

/**
 * Strict structural + value validation of one item. Used to filter anything that
 * reaches us from an imported / hand-edited payload, so a bad rotation, a zero
 * size or a NaN centre can never enter the scene or be written to the layout.
 */
export function isValidFurnitureItem(value: unknown): value is FurnitureItem {
  if (value == null || typeof value !== 'object') return false
  const f = value as Record<string, unknown>
  return (
    isNonEmptyString(f.id) &&
    isFurnitureKind(f.kind) &&
    isFiniteNum(f.cx) &&
    isFiniteNum(f.cz) &&
    isFiniteNum(f.sx) &&
    f.sx > 0 &&
    isFiniteNum(f.sz) &&
    f.sz > 0 &&
    (f.sy === undefined || (isFiniteNum(f.sy) && f.sy > 0)) &&
    (f.elevation === undefined || (isFiniteNum(f.elevation) && f.elevation >= 0)) &&
    (f.rotation === undefined || isFiniteNum(f.rotation))
  )
}

/** Round to whole millimetres so the written JSON stays tidy and stable. */
const mm = (m: number) => Math.round(m * 1000) / 1000

/**
 * A layout element as stored in `event-layout.json`: a planner rectangle (plan
 * coords) tagged with its furniture type. The on-disk / on-wire form.
 */
export type PlanFurnitureElement = {
  type: FurnitureKind
  x: number
  y: number
  w: number
  h: number
  /** Object height (metres) — only written when set; absent → kind default on load. */
  alturaM?: number
  /** Separation from the floor (metres) — only written when > 0. */
  elevacionM?: number
  rotation?: number
}

/**
 * Convert a world-space item back into a planner rectangle (top-left corner +
 * size) for `event-layout.json`. Inverse of `eventLayout.toBox`.
 */
export function furnitureToElement(
  item: FurnitureItem,
  spaceWidth: number,
  spaceDepth: number,
): PlanFurnitureElement {
  const el: PlanFurnitureElement = {
    type: item.kind,
    x: mm(item.cx - item.sx / 2 + spaceWidth / 2),
    y: mm(item.cz - item.sz / 2 + spaceDepth / 2),
    w: mm(item.sx),
    h: mm(item.sz),
  }
  // Only persist the verticals when they carry real edits, so untouched pieces keep
  // a clean rectangle and fall back to their kind default / floor on reload.
  if (isFiniteNum(item.sy) && item.sy > 0) el.alturaM = mm(item.sy)
  if (isFiniteNum(item.elevation) && item.elevation > 0) el.elevacionM = mm(item.elevation)
  if (isFiniteNum(item.rotation) && item.rotation !== 0) el.rotation = mm(item.rotation)
  return el
}

/** Convert a list of items to their planner elements (dropping any invalid ones). */
export function furnitureToElements(
  items: FurnitureItem[],
  spaceWidth: number,
  spaceDepth: number,
): PlanFurnitureElement[] {
  return items
    .filter(isValidFurnitureItem)
    .map((it) => furnitureToElement(it, spaceWidth, spaceDepth))
}

/**
 * A fresh, collision-free id for a new item of `kind`: `${kind}-${n}` where `n`
 * is one past the highest numeric suffix already used for that kind. Deterministic
 * (no clock / RNG), so it survives the scene's pure-state model and round-trips.
 */
export function nextFurnitureId(items: FurnitureItem[], kind: FurnitureKind): string {
  const prefix = `${kind}-`
  let max = -1
  for (const it of items) {
    if (!it.id.startsWith(prefix)) continue
    const n = Number(it.id.slice(prefix.length))
    if (Number.isInteger(n) && n > max) max = n
  }
  return `${prefix}${max + 1}`
}
