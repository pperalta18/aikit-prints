import { DEFAULT_WALL_HEIGHT_M, resolveWallHeight, type Wall } from './eventLayout'
import { LIGHTBOX_BRIGHTNESS_DEFAULT } from './lightbox'
import type { Placement } from './placements'

/**
 * Hero placement — "Sistema solar de la inversión" on wall 2 (S3 face)
 * ────────────────────────────────────────────────────────────────────
 * Phase 4 (hero vertical slice): the code-rendered page + its `doc.json` already
 * exist; this is the *pure, serialisable* core of **mounting** it in the 3D venue
 * — building the one `Placement` that hangs the hero on its real wall:
 *
 *   • on wall 2 (`invId 2` / `wall-1`, the "Nave O" double-sided wall),
 *   • on its **S3 face** — the side pointing into the nave (where the three
 *     showroom cameras live), *not* the S1 combustión back,
 *   • as a **light-box** (caja de luz — the Apple-storefront glow the brief wants
 *     for the INVESTMENT piece), and
 *   • at **true physical scale** on the **museographic eye band**.
 *
 * Why the side is computed, not hard-coded: the venue geometry is the source of
 * truth (`event-layout.json`), so the S3 face is derived by asking which face of
 * the wall points toward a known nave reference (the opposite "Nave E" wall). That
 * survives any coordinate / reordering change instead of baking in a `+1`.
 *
 * Like `placements`/`lightbox`/`zones`, everything here is JSX-free and
 * side-effect-free at module load, so it unit-tests in the node `unit` project.
 * `EventSpaceScene` owns the React wiring (a "Montar HERO" action); this owns the
 * contract and the numbers.
 */

/** Inventory id of the hero wall (`invId 2` ↔ `wall-1`); see `hero-solar.tsx`. */
export const HERO_INV_ID = 2
/** Inventory id of the wall directly across the nave — the S3-interior reference. */
export const NAVE_OPPOSITE_INV_ID = 11
/** Catalogue print id of the hero page (`public/prints/hero-solar/`). */
export const HERO_PRINT_ID = 'hero-solar'

/**
 * Museographic eye band — the centre-line height (m above the floor) a piece is
 * hung at so its core reads at standing eye level. Spec §Format / museographic
 * standards: "eye-band centre ~1.45–1.60 m".
 */
export const EYE_BAND_MIN_M = 1.45
export const EYE_BAND_MAX_M = 1.6
export const EYE_BAND_CENTER_M = 1.5

/** Clearance kept between the print edge and the floor / top of the wall (m). */
export const WALL_EDGE_MARGIN_M = 0.05

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)

/** Run-axis centre of a wall (the floor coordinate the print's `along` slides on). */
export function wallRunCenter(wall: Wall): number {
  return wall.normalAxis === 'x' ? wall.cz : wall.cx
}

/** Normal-axis centre of a wall (the coordinate its two faces straddle). */
export function wallNormalCenter(wall: Wall): number {
  return wall.normalAxis === 'x' ? wall.cx : wall.cz
}

/**
 * Which face of a wall (`+1` / `-1` along its normal axis) points toward a
 * reference point on the floor. Used to pick wall 2's **S3 face** — the one
 * facing the nave interior (the opposite nave wall) rather than the S1 back.
 * A reference exactly on the wall's normal centre resolves to `+1` deterministically.
 */
export function faceToward(wall: Wall, reference: { cx: number; cz: number }): 1 | -1 {
  const refOnNormal = wall.normalAxis === 'x' ? reference.cx : reference.cz
  return refOnNormal >= wallNormalCenter(wall) ? 1 : -1
}

/**
 * Museographic centre-height for a print on a wall. Aims for the eye band
 * ({@link EYE_BAND_CENTER_M}) but always keeps the *whole* print on the wall:
 * the centre is clamped into `[printHeight/2 + margin, wallHeight − printHeight/2
 * − margin]`. When the print is nearly as tall as the wall that range collapses,
 * so the result is the highest centre that still fits (the print may then overhang
 * the top edge, never the floor first). Pure + deterministic.
 */
export function eyeBandCenterY(
  wallHeightM: number,
  printHeightM: number,
  opts: { target?: number; margin?: number } = {},
): number {
  const margin = opts.margin ?? WALL_EDGE_MARGIN_M
  const target = opts.target ?? EYE_BAND_CENTER_M
  const minCenter = printHeightM / 2 + margin
  const maxCenter = wallHeightM - printHeightM / 2 - margin
  return clamp(target, minCenter, Math.max(minCenter, maxCenter))
}

export type HeroPlacementInput = {
  /** The hero wall (`findWallByInvId(HERO_INV_ID)` → wall 2 / `wall-1`). */
  wall: Wall
  /**
   * A floor point in the S3 nave to orient the front face toward — typically the
   * opposite nave wall (`findWallByInvId(NAVE_OPPOSITE_INV_ID)`). Defaults to the
   * hero wall's own centre, which still resolves to the `+1` S3 face.
   */
  s3Reference?: { cx: number; cz: number }
  /** Print trim height (mm) — drives the eye-band fit. */
  trimHeightMm: number
  /** Placement id (stable so a re-mount replaces rather than duplicates). */
  id?: string
  /** Catalogue print id; defaults to {@link HERO_PRINT_ID}. */
  printId?: string
  /** Centre along the wall run; defaults to the run centre (operator can zone it). */
  along?: number
  /** Fallback wall height for walls without measured `alturaM` (default 2.5 m). */
  fallbackHeight?: number
  /** Light-box brightness dial (0…2); defaults to {@link LIGHTBOX_BRIGHTNESS_DEFAULT}. */
  brightness?: number
}

/**
 * Build the hero's `Placement`: wall 2, S3 face, light-box, true scale, eye band.
 * The result is a plain serialisable `Placement` that drops straight into the
 * scene's placement list and the persistence layer. Scale is fixed at `1` — the
 * hero `doc.json` is already authored to the camera-bay physical size, so true
 * scale is 1× (the operator can later "Repartir en zonas" to split it per camera).
 */
export function heroSolarPlacement(input: HeroPlacementInput): Placement {
  const { wall, trimHeightMm } = input
  const fallbackHeight = input.fallbackHeight ?? DEFAULT_WALL_HEIGHT_M
  const reference = input.s3Reference ?? { cx: wall.cx, cz: wall.cz }
  const wallHeightM = resolveWallHeight(wall, fallbackHeight)
  const printHeightM = trimHeightMm / 1000

  return {
    id: input.id ?? `hero-${wall.id}`,
    printId: input.printId ?? HERO_PRINT_ID,
    wallId: wall.id,
    along: input.along ?? wallRunCenter(wall),
    centerY: eyeBandCenterY(wallHeightM, printHeightM),
    scale: 1,
    side: faceToward(wall, reference),
    mount: 'lightbox',
    glow: input.brightness ?? LIGHTBOX_BRIGHTNESS_DEFAULT,
  }
}
