/**
 * Placement persistence
 * ─────────────────────
 * The 3D venue scene (`EventSpaceScene`) lets you mount each of the 21 wall
 * graphics on its wall at true scale. Until now that layout lived in ephemeral
 * React state, so closing the tab discarded every placement — unworkable once
 * production scales to all 21 pieces. This module is the *pure, serialisable*
 * core of placement persistence: a versioned document shape, strict validation
 * (so corrupt/stale storage can never crash or mis-render the scene), and
 * storage-agnostic load/save helpers (any Web-Storage-shaped object, defaulting
 * to `localStorage`, so a configured layout reopens on its own and can also be
 * exported to / imported from a JSON file).
 *
 * Everything here is JSX-free and side-effect-free at module load, so it is
 * unit-tested in the node `unit` project. `EventSpaceScene` owns the React
 * wiring; this owns the contract.
 */

import { isMountKind, type MountKind } from './lightbox'

/**
 * A print mounted on a wall — the unit of a saved 3D layout. World coordinates
 * are derived from the wall + these fields at render time (see
 * `EventSpaceScene.placementTransform`), so a placement is fully portable: the
 * same JSON reopens identically on any machine with the same layout + catalogue.
 */
export type Placement = {
  /** Stable id of this placement instance (unique within a layout). */
  id: string
  /** Catalogue print id (`PrintDoc.id`) painted on the panel. */
  printId: string
  /** Wall id it hangs on (`wall-N` / `glass-N`). */
  wallId: string
  /** World coordinate along the wall's run axis (centre of the print). */
  along: number
  /** Height of the print centre above the floor (m). */
  centerY: number
  /** Size multiplier over the print's true physical size. */
  scale: number
  /** Which face of the wall it hangs on (+1 / −1 along the normal axis). */
  side: 1 | -1
  /**
   * Free world-space nudge (metres) added on top of the wall-anchored position,
   * so the piece can be moved on X / Y / Z independently of the wall — including
   * off the wall surface. Optional + lenient: absent means no offset (0,0,0); a
   * partial/NaN value is sanitised to 0 per axis. See `EventSpaceScene`.
   */
  offset?: { x: number; y: number; z: number }
  /**
   * How the piece is mounted — a flat `vinyl` (default) or a backlit `lightbox`
   * (Phase 2). Optional + lenient: a missing/invalid value renders as a vinyl,
   * so old layouts and hand-edits never break. See `./lightbox`.
   */
  mount?: MountKind
  /** Light-box brightness dial (0…2) when `mount === 'lightbox'`; ignored otherwise. */
  glow?: number
  /**
   * Double-sided link (Phase 2). When set, this placement is one *face* of a
   * physical double-sided piece (ids 2 & 12); the sibling placement on the same
   * wall sharing this `pairId` is the other face, with the opposite `side` and its
   * own art. Optional + lenient: absent/empty means a plain single-face placement.
   * See `./doublesided`.
   */
  pairId?: string
}

/** Bump when the persisted shape changes incompatibly (drives a clean reset). */
export const PLACEMENTS_VERSION = 3

/** localStorage key — carries the version so a schema bump starts from empty. */
export const PLACEMENTS_STORAGE_KEY = `aikit:event-placements:v${PLACEMENTS_VERSION}`

/** The persisted document: a versioned envelope around the placement list. */
export type PlacementsDoc = {
  version: number
  placements: Placement[]
}

/**
 * The minimal slice of the Web Storage API we depend on. `localStorage` satisfies
 * it; tests pass an in-memory stub. Kept narrow so the persistence logic is
 * trivially mockable and never reaches for a real browser global.
 */
export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const isNonEmptyString = (s: unknown): s is string => typeof s === 'string' && s.length > 0

/**
 * Sanitise a free-move offset: each axis coerced to a finite number (else 0).
 * Returns `undefined` for a zero/absent offset so a plain placement never carries
 * a no-op `{0,0,0}` (keeps the persisted JSON + the double-sided sync clean).
 */
export function sanitizeOffset(value: unknown): { x: number; y: number; z: number } | undefined {
  if (value == null || typeof value !== 'object') return undefined
  const o = value as Record<string, unknown>
  const x = isFiniteNum(o.x) ? o.x : 0
  const y = isFiniteNum(o.y) ? o.y : 0
  const z = isFiniteNum(o.z) ? o.z : 0
  if (x === 0 && y === 0 && z === 0) return undefined
  return { x, y, z }
}

/**
 * Strict structural + value validation of a single placement. Used to filter
 * anything that reaches us from storage / an imported file, so a half-written or
 * hand-edited document can never inject a `NaN` position, a zero scale, or a
 * bogus `side` into the scene.
 */
export function isValidPlacement(value: unknown): value is Placement {
  if (value == null || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return (
    isNonEmptyString(p.id) &&
    isNonEmptyString(p.printId) &&
    isNonEmptyString(p.wallId) &&
    isFiniteNum(p.along) &&
    isFiniteNum(p.centerY) &&
    p.centerY > 0 &&
    isFiniteNum(p.scale) &&
    p.scale > 0 &&
    (p.side === 1 || p.side === -1)
  )
}

/**
 * Re-create a placement from validated input, copying only the known fields.
 * The optional light-box fields are *sanitised* rather than required: a valid
 * `mount` / finite `glow` is carried through, anything else is simply omitted
 * (degrading to a vinyl), so they never leak a bad value or appear on a plain
 * placement that doesn't use them.
 */
function normalise(p: Placement): Placement {
  const out: Placement = {
    id: p.id,
    printId: p.printId,
    wallId: p.wallId,
    along: p.along,
    centerY: p.centerY,
    scale: p.scale,
    side: p.side,
  }
  const offset = sanitizeOffset(p.offset)
  if (offset) out.offset = offset
  if (isMountKind(p.mount)) out.mount = p.mount
  if (isFiniteNum(p.glow)) out.glow = p.glow
  if (isNonEmptyString(p.pairId)) out.pairId = p.pairId
  return out
}

/**
 * Parse anything (a JSON string, a parsed envelope, or a bare array) into a
 * clean `Placement[]`. Lenient by design: unknown shapes and individual invalid
 * entries are dropped rather than thrown, so a corrupt key never breaks the app
 * — it just reopens empty (or with the valid subset). Returns a fresh array.
 */
export function parsePlacements(input: unknown): Placement[] {
  let data: unknown = input
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return []
    }
  }

  let list: unknown[]
  if (Array.isArray(data)) {
    list = data
  } else if (data != null && typeof data === 'object' && Array.isArray((data as PlacementsDoc).placements)) {
    list = (data as PlacementsDoc).placements
  } else {
    return []
  }

  return list.filter(isValidPlacement).map(normalise)
}

/** Wrap a placement list in the versioned envelope (dropping any invalid ones). */
export function serializePlacements(placements: Placement[]): PlacementsDoc {
  return {
    version: PLACEMENTS_VERSION,
    placements: placements.filter(isValidPlacement).map(normalise),
  }
}

/** Pretty-printed JSON of the versioned document — the export / on-disk form. */
export function placementsToJson(placements: Placement[]): string {
  return JSON.stringify(serializePlacements(placements), null, 2)
}

/** Resolve the ambient `localStorage`, tolerating SSR and privacy-mode throws. */
function defaultStorage(): StorageLike | null {
  try {
    const s = (globalThis as { localStorage?: StorageLike }).localStorage
    return s ?? null
  } catch {
    return null
  }
}

/**
 * Load the saved layout. Defensive end-to-end: a missing key, unreadable
 * storage, malformed JSON, or partially-invalid data all degrade to the valid
 * subset (or `[]`) instead of throwing.
 */
export function loadPlacements(storage: StorageLike | null = defaultStorage()): Placement[] {
  if (!storage) return []
  let rawValue: string | null
  try {
    rawValue = storage.getItem(PLACEMENTS_STORAGE_KEY)
  } catch {
    return []
  }
  if (rawValue == null) return []
  return parsePlacements(rawValue)
}

/**
 * Persist the layout. Returns whether the write happened (false when storage is
 * unavailable or throws, e.g. over quota) so callers can surface it if they care.
 */
export function savePlacements(
  placements: Placement[],
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false
  try {
    storage.setItem(PLACEMENTS_STORAGE_KEY, placementsToJson(placements))
    return true
  } catch {
    return false
  }
}

/** Drop the saved layout entirely. */
export function clearPlacements(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(PLACEMENTS_STORAGE_KEY)
  } catch {
    // ignore — clearing is best-effort
  }
}
