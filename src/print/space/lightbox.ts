/**
 * Light-box material model (Phase 2 — 3D scene extensions)
 * ────────────────────────────────────────────────────────
 * Some expo pieces are not flat vinyls but **backlit light-boxes** — the
 * "Apple-storefront" glow (spec §3D application; id 4 *Naranja Mecánica*, the
 * S3 INVESTMENT hero). A light-box reads as an internally-lit panel: the art
 * pops (brighter than ambient), its edges glow, and it spills a soft warm halo
 * onto the wall behind it. A vinyl does none of that.
 *
 * This module is the *pure, serialisable* core of that look. It owns:
 *   • the `MountKind` enum and its validation (a placement records whether it
 *     hangs as a vinyl or a light-box), and
 *   • `lightboxGlow()` — a single brightness dial (0…2, default 1) mapped to all
 *     the render parameters `EventSpaceScene.WallPrint` needs (emissive backing,
 *     CSS panel brightness, the warm spill-halo plane).
 *
 * Everything here is JSX-free and side-effect-free at module load, so it is
 * unit-tested in the node `unit` project. `EventSpaceScene` owns the three.js /
 * DOM wiring; this owns the contract and the numbers.
 */

/** How a placement is mounted on the wall. */
export type MountKind = 'vinyl' | 'lightbox'

/** Default mount — a flat printed vinyl, no backlight. */
export const DEFAULT_MOUNT: MountKind = 'vinyl'

/** Warm-white backlight tint (slightly amber, like a fluorescent/LED box). */
export const LIGHTBOX_WARM = '#fff3df'

/** Brightness dial bounds. 0 = barely lit, 1 = default box, 2 = storefront-bright. */
export const LIGHTBOX_BRIGHTNESS_MIN = 0
export const LIGHTBOX_BRIGHTNESS_MAX = 2
export const LIGHTBOX_BRIGHTNESS_DEFAULT = 1

const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)
const lerp = (lo: number, hi: number, t: number) => lo + (hi - lo) * t

/** Type guard for a valid `MountKind`. */
export function isMountKind(value: unknown): value is MountKind {
  return value === 'vinyl' || value === 'lightbox'
}

/** Coerce any input to a `MountKind`, defaulting unknown/missing to a vinyl. */
export function normalizeMount(value: unknown): MountKind {
  return isMountKind(value) ? value : DEFAULT_MOUNT
}

/**
 * Clamp a brightness dial into range. Non-finite / missing input falls back to
 * the default (so a hand-edited or absent value never produces `NaN` glow).
 */
export function clampBrightness(value: unknown): number {
  const n = isFiniteNum(value) ? value : LIGHTBOX_BRIGHTNESS_DEFAULT
  return clamp(n, LIGHTBOX_BRIGHTNESS_MIN, LIGHTBOX_BRIGHTNESS_MAX)
}

/** The soft warm spill a light-box throws onto the wall behind the panel. */
export type LightboxHalo = {
  /** Halo plane width (m) — always larger than the panel (margin all around). */
  width: number
  /** Halo plane height (m) — always larger than the panel. */
  height: number
  /** Additive opacity of the spill, 0…~0.5. */
  opacity: number
  /** Halo tint. */
  color: string
}

/** Every render parameter a backlit panel needs, derived from one brightness dial. */
export type LightboxGlow = {
  /** Emissive tint of the backing board (the glowing edge). */
  emissive: string
  /** Emissive intensity of the backing board. */
  emissiveIntensity: number
  /** CSS `filter: brightness()` multiplier on the live art (≥ 1). */
  panelBrightness: number
  /** CSS glow blur radius (px) for the panel's warm box-shadow. */
  panelGlowPx: number
  /** The warm spill thrown onto the wall behind the panel. */
  halo: LightboxHalo
}

/**
 * Map a single brightness dial (0…2) + the panel's physical size to all the
 * light-box render parameters. Monotonic in `brightness`: a brighter box glows
 * more, brightens the art more, and throws a larger / stronger halo. The halo is
 * always strictly larger than the panel (equal margin on every side) so the
 * spill reads as a ring around the art.
 */
export function lightboxGlow(
  opts: { brightness?: unknown; width?: number; height?: number } = {},
): LightboxGlow {
  const b = clampBrightness(opts.brightness)
  const t = (b - LIGHTBOX_BRIGHTNESS_MIN) / (LIGHTBOX_BRIGHTNESS_MAX - LIGHTBOX_BRIGHTNESS_MIN)

  const w = isFiniteNum(opts.width) && opts.width > 0 ? opts.width : 0
  const h = isFiniteNum(opts.height) && opts.height > 0 ? opts.height : 0
  const margin = lerp(0.05, 0.2, t) // metres of spill beyond the panel, per side

  return {
    emissive: LIGHTBOX_WARM,
    emissiveIntensity: lerp(0.4, 1.7, t),
    panelBrightness: lerp(1.0, 1.4, t),
    panelGlowPx: lerp(10, 46, t),
    halo: {
      width: w + 2 * margin,
      height: h + 2 * margin,
      opacity: lerp(0.1, 0.5, t),
      color: LIGHTBOX_WARM,
    },
  }
}

/**
 * Resolve the glow for a mounted piece, or `null` when it hangs as a vinyl.
 * Pins the vinyl-vs-light-box branch in one tested place so the 3D component
 * stays a thin renderer.
 */
export function resolveGlow(
  mount: unknown,
  glow: unknown,
  dims: { width: number; height: number },
): LightboxGlow | null {
  if (normalizeMount(mount) !== 'lightbox') return null
  return lightboxGlow({ brightness: glow, width: dims.width, height: dims.height })
}
