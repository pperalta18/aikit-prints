/**
 * umbral — the layout logic behind the #3 piece "Umbral S2→S3" (wall 3 /
 * `wall-2`, the typographic title-band at the threshold of the S3 central nave).
 * ──────────────────────────────────────────────────────────────────────────
 * As the visitor crosses from S2 (Intro IA — "lo entiendo") into S3 (Velocidad /
 * Showroom — "es inevitable"), this band does one job: it names the room and
 * **sequences the three nave cameras** the visitor is about to walk through —
 * `IMAGE → TEXT+CODE → INVERSIÓN` (the camera concepts documented in
 * `specs/wall-graphics.md` · Per-wall inventory). It carries no data
 * (`research: false`); like the S1→S2 wayfinding piece (#10), the only thing to
 * keep honest is **legibility** and the **even sequencing** of the three cameras.
 *
 * Two pure, unit-testable concerns live here (no React, no DOM — the same split
 * the data pages use, so the geometry is tested, not eyeballed):
 *
 *   • `planCameraSequence` — split the band into one equal cell per camera,
 *     left→right, separated by a gap, tiling the run exactly (last edge pinned),
 *     each cell flagged with whether a connector/arrow follows it. This is the
 *     orientation payload: the three cameras read as an evenly-spaced sequence,
 *     never crowded or stretched.
 *   • `umbralTypeScale` — extend the museographic `wayfindingTypeScale` (the
 *     ≈1 cm cap-height / 3 m rule) with the two extra levels this piece needs: the
 *     camera **name** (the secondary protagonist) and its one-word **hint**, each
 *     clamped up to the legibility floor so no level is ever sub-legible.
 *
 * Layout units are abstract (the page passes millimetres from `geo`); the maths is
 * scale-free. See `umbral.tsx` for the rendering and `wayfinding.ts` for the
 * museographic primitives this reuses.
 */

import {
  CAP_CM_PER_METRE,
  DISPLAY_CAP_RATIO,
  capHeightMmToFontPt,
  minCapHeightMm,
  wayfindingTypeScale,
  type WayfindingTypeScale,
} from './wayfinding'

/** Inventory id of the Umbral S2→S3 title-band wall. */
export const UMBRAL_INV_ID = 3

/* ── the nave camera sequence (documented concepts, not invented data) ─────────── */

export type NaveCamera = {
  /** Stable slug for the camera. */
  id: string
  /** Display label — exactly as documented in the spec inventory. */
  name: string
  /** One-word orientation hint: what the machine does at that camera. */
  hint: string
}

/**
 * The three S3 nave cameras in walk order, as documented in the brief / spec
 * inventory (`IMAGE → TEXT+CODE → INVERSIÓN`). The hints are faithful one-word
 * orientations of each camera's subject — vision, language/code, and the money /
 * scale of the investment (the hero "sistema solar de la inversión" lives at this
 * last camera, on wall 2's S3 face).
 */
export const NAVE_CAMERAS: readonly NaveCamera[] = [
  { id: 'image', name: 'IMAGE', hint: 'Ver' },
  { id: 'text-code', name: 'TEXT+CODE', hint: 'Crear' },
  { id: 'investment', name: 'INVERSIÓN', hint: 'El dinero' },
] as const

/* ── camera sequence layout (even cells across the band) ──────────────────────── */

/** A laid-out camera cell: its camera + resolved column rect (0 = band left/top). */
export type CameraCell = {
  camera: NaveCamera
  /** 1-based position in the nave walk order. */
  index: number
  /** Left edge of the cell (band units). */
  x: number
  /** Top edge of the cell (band units) — always 0 (single row). */
  y: number
  /** Cell width (band units). */
  width: number
  /** Cell height (band units) = the row height. */
  height: number
  /** Centre x of the cell — anchor for the centred camera label. */
  center: number
  /** True for every cell but the last → a connector/arrow follows it. */
  connectorAfter: boolean
}

/**
 * Split a `width × height` band into one equal cell per camera, left→right,
 * separated by `gap`. The cells tile `[0, width]` exactly — `n·cellW + (n−1)·gap =
 * width`, last edge pinned to `width` — so the cameras read as an evenly-spaced
 * sequence (mirrors the column splitters in `codigo.ts` / `zones.ts`). Returns []
 * for an empty list. Deterministic. Throws on a non-positive band, a negative gap,
 * or a gap that leaves no cell width.
 */
export function planCameraSequence(
  cameras: ReadonlyArray<NaveCamera>,
  opts: { width: number; height: number; gap?: number },
): CameraCell[] {
  const { width, height, gap = 0 } = opts
  if (!(width > 0) || !(height > 0)) throw new Error('planCameraSequence: width/height must be > 0')
  if (gap < 0) throw new Error('planCameraSequence: gap must be >= 0')
  const n = cameras.length
  if (n === 0) return []
  const cellW = (width - gap * (n - 1)) / n
  if (!(cellW > 0)) throw new Error('planCameraSequence: gap too large for the band width')
  return cameras.map((camera, i) => {
    const x = i * (cellW + gap)
    return {
      camera,
      index: i + 1,
      x,
      y: 0,
      width: cellW,
      height,
      center: x + cellW / 2,
      connectorAfter: i < n - 1,
    }
  })
}

/* ── type scale (thesis + camera name + hint, all ≥ the legibility floor) ──────── */

/** Default cap-height fractions for the umbral title-band (single source). */
export const UMBRAL_THESIS_CAP_FRACTION = 0.22
export const UMBRAL_CAMERA_CAP_FRACTION = 0.1
export const UMBRAL_HINT_CAP_FRACTION = 0.5

export type UmbralScaleOpts = {
  /** The print canvas (trim) height in mm — the title-band height. */
  trimHeightMm: number
  /** The real reading distance to this wall in metres. */
  readingDistanceM: number
  /** Thesis ("es inevitable") cap-height as a fraction of trim height. */
  thesisCapFraction?: number
  /** Camera-name cap-height as a fraction of trim height. */
  cameraCapFraction?: number
  /** Hint cap-height as a fraction of the camera cap. */
  hintCapFraction?: number
  /** Display face cap-height ÷ em. Default {@link DISPLAY_CAP_RATIO}. */
  capRatio?: number
  /** Override the museographic cm-per-metre constant. Default {@link CAP_CM_PER_METRE}. */
  cmPerMetre?: number
}

export type UmbralTypeScale = WayfindingTypeScale & {
  /** Font-size (pt) for a camera name (IMAGE / TEXT+CODE / INVERSIÓN). */
  cameraPt: number
  /** Font-size (pt) for a camera hint (the one-word descriptor). */
  hintPt: number
  /** The cap-height (mm) the camera name renders to. */
  cameraCapMm: number
  /** The cap-height (mm) the hint renders to. */
  hintCapMm: number
}

/**
 * Resolve the complete type scale for the umbral title-band. The thesis word is
 * the protagonist (sized through {@link wayfindingTypeScale} as the `destination`),
 * and this adds the two levels the title-band needs — the camera **name** (sized by
 * wall proportion) and its **hint** (a fraction of the camera cap) — each **clamped
 * up to the museographic minimum** for the wall's reading distance so no level is
 * ever sub-legible. Reports both point sizes (for `geo.pt`) and the rendered
 * cap-heights (mm) for the Phase-6 QA control table. Deterministic; throws via the
 * underlying scale on a non-positive trim height / distance or out-of-range fractions.
 */
export function umbralTypeScale(opts: UmbralScaleOpts): UmbralTypeScale {
  const {
    trimHeightMm,
    readingDistanceM,
    thesisCapFraction = UMBRAL_THESIS_CAP_FRACTION,
    cameraCapFraction = UMBRAL_CAMERA_CAP_FRACTION,
    hintCapFraction = UMBRAL_HINT_CAP_FRACTION,
    capRatio = DISPLAY_CAP_RATIO,
    cmPerMetre = CAP_CM_PER_METRE,
  } = opts

  for (const [k, v] of [
    ['cameraCapFraction', cameraCapFraction],
    ['hintCapFraction', hintCapFraction],
  ] as const) {
    if (!(v > 0 && v <= 1)) throw new Error(`umbralTypeScale: ${k} must be in (0, 1] (got ${v})`)
  }

  // The thesis rides the destination slot; this also validates trim/distance/fractions.
  const base = wayfindingTypeScale({
    trimHeightMm,
    readingDistanceM,
    destinationCapFraction: thesisCapFraction,
    capRatio,
    cmPerMetre,
  })

  const floorMm = minCapHeightMm(readingDistanceM, cmPerMetre)
  const cameraCapMm = Math.max(floorMm, trimHeightMm * cameraCapFraction)
  const hintCapMm = Math.max(floorMm, cameraCapMm * hintCapFraction)

  return {
    ...base,
    cameraPt: capHeightMmToFontPt(cameraCapMm, capRatio),
    hintPt: capHeightMmToFontPt(hintCapMm, capRatio),
    cameraCapMm,
    hintCapMm,
  }
}
