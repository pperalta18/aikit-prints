import { isMountKind } from './lightbox'
import type { Placement } from './placements'

/**
 * Double-sided wall pieces (Phase 2 — 3D scene extensions)
 * ────────────────────────────────────────────────────────
 * Two of the expo walls are physically double-sided: the same divider carries
 * *distinct art on each face*. Wall **inv 2** ("Nave O") shows the S1 combustión
 * on one side and the S3 light-box hero on the other; wall **inv 12** ("Divisoria
 * IMAGE") shows the IMAGE-screen identity on its entrance face and the
 * confesionario / Turing-test on its reverse (spec §3D application). Until now a
 * placement could only hang on one face — you could drop two independent
 * placements on the same wall, but nothing tied them together, so they could
 * drift out of alignment and there was no notion that they were two faces of *one*
 * physical piece.
 *
 * This module is the *pure, serialisable* core of that look. It owns:
 *   • the face vocabulary (`Face` = ±1, `oppositeFace`),
 *   • which walls the brief designates as double-sided (`DOUBLE_SIDED_INV_IDS` /
 *     `wallSupportsDoubleSided`),
 *   • `planDoubleSided()` — turn one front placement + a back-face print into the
 *     two coherent, back-to-back placements (same wall / position / scale, mirrored
 *     `side`, distinct `printId`), linked by a shared `pairId`, and
 *   • the pairing queries + the edit helpers (`pairFor` / `facesOf` /
 *     `syncedFaceFields` / `unlinkPair`) the scene uses to keep the two faces in
 *     lock-step (move/scale both, remove both) and to split them apart.
 *
 * Like `tiling`/`zones`/`lightbox`, everything here is JSX-free and side-effect-free
 * at module load, so it unit-tests in the node `unit` project. `EventSpaceScene`
 * owns the three.js / HUD wiring; this owns the model and the invariants.
 */

/** A wall face: `+1` / `−1` along the wall's normal axis (the two printable sides). */
export type Face = 1 | -1

/** The two faces of any wall, in a stable order. */
export const WALL_FACES: readonly Face[] = [1, -1]

const isNonEmptyString = (s: unknown): s is string => typeof s === 'string' && s.length > 0
const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** Type guard for a valid wall `Face`. */
export function isFace(value: unknown): value is Face {
  return value === 1 || value === -1
}

/** The other face of a wall (`+1 ↔ −1`). */
export function oppositeFace(side: Face): Face {
  return side === 1 ? -1 : 1
}

/**
 * The inventory ids the brief designates as double-sided (distinct art per face):
 * **inv 2** (Nave O — S1 combustión / S3 hero light-box) and **inv 12** (Divisoria
 * IMAGE — screen identity / confesionario reverse). See `specs/wall-graphics.md`.
 */
export const DOUBLE_SIDED_INV_IDS: readonly number[] = [2, 12]

/** Whether an inventory id is one the brief marks as double-sided. */
export function isDoubleSidedInvId(invId: unknown): boolean {
  return typeof invId === 'number' && DOUBLE_SIDED_INV_IDS.includes(invId)
}

/** Minimal shape `wallSupportsDoubleSided` reads — structural, to stay decoupled from `eventLayout`. */
type WallLike = { registry?: { invId?: number } | null }

/**
 * Whether a wall is one the brief designates as double-sided (reads its
 * `registry.invId`, so it survives wall reordering / id renaming). Glass and
 * unregistered walls are never double-sided.
 */
export function wallSupportsDoubleSided(wall: WallLike | null | undefined): boolean {
  return isDoubleSidedInvId(wall?.registry?.invId)
}

/** Per-face customisation allowed on the back face (the rest is shared with the front). */
export type BackFaceOverride = Partial<Pick<Placement, 'scale' | 'mount' | 'glow'>>

export type DoubleSidedInput = {
  /** The front-face placement — defines the shared wall / along / centerY / scale / mount / glow. */
  base: Placement
  /** Distinct print id painted on the *opposite* face. */
  backPrintId: string
  /** Prefix for the two generated ids (`${idPrefix}-fr` / `-bk`) and the shared `pairId`. */
  idPrefix: string
  /**
   * Optional per-face overrides for the back — e.g. a light-box on one face and a
   * matte vinyl on the other, or a different scale. Position (along / centerY / wall
   * / side) is never overridable here: the two faces are deliberately back-to-back.
   */
  back?: BackFaceOverride
}

/**
 * Turn one template (front) placement + a back-face print into the **two coherent
 * placements** of a single double-sided piece — the pure core behind "distinct art
 * per face". Both share the wall, `along`, `centerY`, `scale` and a fresh `pairId`
 * so they sit exactly back-to-back; the back gets the opposite `side` and the
 * distinct `backPrintId`. Optional `back` overrides tweak only the back's
 * scale / mount / glow. Ids are stable and unique within the call. The input is
 * never mutated; returns `[front, back]`.
 */
export function planDoubleSided(input: DoubleSidedInput): [Placement, Placement] {
  const { base, backPrintId, idPrefix, back } = input
  if (!isNonEmptyString(idPrefix)) throw new Error('idPrefix must be a non-empty string')
  if (!isNonEmptyString(backPrintId)) throw new Error('backPrintId must be a non-empty string')
  if (!isFace(base?.side)) throw new Error(`base.side must be 1 or -1 (got ${base?.side})`)

  const pairId = idPrefix
  const front: Placement = { ...base, id: `${idPrefix}-fr`, side: base.side, pairId }
  const backPlacement: Placement = {
    ...base,
    id: `${idPrefix}-bk`,
    side: oppositeFace(base.side),
    printId: backPrintId,
    pairId,
  }
  if (back) {
    if (isFiniteNum(back.scale) && back.scale > 0) backPlacement.scale = back.scale
    if (isMountKind(back.mount)) backPlacement.mount = back.mount
    else if ('mount' in back && back.mount === undefined) delete backPlacement.mount
    if (isFiniteNum(back.glow)) backPlacement.glow = back.glow
  }
  return [front, backPlacement]
}

/** Every placement that belongs to a given (non-empty) `pairId`. */
export function facesOf(pairId: string, all: Placement[]): Placement[] {
  if (!isNonEmptyString(pairId)) return []
  return all.filter((p) => p.pairId === pairId)
}

/**
 * The *other* face of a placement's double-sided pair, or `null` when it is not
 * paired (no `pairId`, or no sibling carrying the same one). Matches on `pairId`
 * and a different `id` — robust even if a sibling's `side` was hand-edited.
 */
export function pairFor(placement: Placement, all: Placement[]): Placement | null {
  const pid = placement.pairId
  if (!isNonEmptyString(pid)) return null
  return all.find((p) => p.id !== placement.id && p.pairId === pid) ?? null
}

/** Whether a placement is one face of a double-sided pair present in `all`. */
export function isPaired(placement: Placement, all: Placement[]): boolean {
  return pairFor(placement, all) !== null
}

/**
 * The placement fields that must stay identical across the two faces of a pair so
 * they remain back-to-back (everything *positional*). `side` / `printId` / `id` /
 * `pairId` are deliberately per-face and never synced; `mount` / `glow` are allowed
 * to differ (a light-box on one side, a vinyl on the other).
 */
export const SYNCED_FACE_FIELDS = ['along', 'centerY', 'scale', 'offset'] as const

/**
 * Project an edit patch down to just the fields that should mirror onto the other
 * face of a pair. The scene applies the full patch to the selected face and this
 * subset to its partner, keeping the two faces aligned without dragging across
 * per-face attributes.
 */
export function syncedFaceFields(patch: Partial<Placement>): Partial<Placement> {
  const out: Partial<Placement> = {}
  for (const key of SYNCED_FACE_FIELDS) {
    if (key in patch) out[key] = patch[key]
  }
  return out
}

/**
 * Unlink a double-sided pair: strip the shared `pairId` from every placement that
 * carries it, leaving two independent single-face placements in place (geometry
 * untouched). Returns a fresh array; unaffected placements keep their reference.
 */
export function unlinkPair(pairId: string, all: Placement[]): Placement[] {
  if (!isNonEmptyString(pairId)) return all.slice()
  return all.map((p) => {
    if (p.pairId !== pairId) return p
    const { pairId: _drop, ...rest } = p
    return rest
  })
}
