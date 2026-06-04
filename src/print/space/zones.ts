import type { Placement } from './placements'

/**
 * Zoned wall canvases (Phase 2 — 3D scene extensions)
 * ───────────────────────────────────────────────────
 * The perimeter walls are long — wall-2 (hero, S3 face) runs 22.5 m and wall-4
 * (Naranja Mecánica) 28.5 m. A single print stretched across one of those reads
 * as a smeared poster, never as a designed wall. The brief instead wants those
 * runs treated as a **series of segments** along the wall — a zoned light-box that
 * hosts the hero, the #11 acceleration charts "zoned per camera", the #4 store
 * tagline "mocked ×3". This module is the *pure geometry* of that split: divide a
 * wall's run into N side-by-side zones (equal or weighted, with optional end
 * margins and inter-zone gaps), then turn each zone into a `Placement` so the same
 * print can be hung once per zone instead of stretched across the whole wall.
 *
 * Like `tiling`/`geometry`/`lightbox`, everything here is JSX-free and DOM-free so
 * it unit-tests in the node `unit` project. `EventSpaceScene` owns the three.js
 * wiring; this owns the numbers.
 *
 * Coordinate model (one axis — the wall's run, in metres):
 *   • The run spans `[0, runLength]` measured from one wall end.
 *   • `marginM`  — dead space kept clear at *each* end of the run (default 0).
 *   • `gapM`     — clear space between adjacent zones (default 0 = a continuous
 *                  series of panels, the literal "not one stretched print").
 *   • Usable length `U = runLength − 2·margin − (count−1)·gap` is shared by the
 *     zones (equal, or split by `weights`). The zones tile `[margin, runLength −
 *     margin]` left→right, separated by `gap`.
 *
 * `alongOffset` is each zone's centre expressed **relative to the run centre**, so
 * it drops straight into `Placement.along = wallRunCentre + alongOffset` (the same
 * `along` the click-to-place flow and `placementTransform` already use).
 */

/** One zone along a wall run, in metres. */
export type Zone = {
  /** 0-based position in the series, left→right along the run. */
  index: number
  /** Zone start, measured from the wall-run start (0…runLength). */
  startM: number
  /** Zone end, measured from the wall-run start. */
  endM: number
  /** Zone width (`endM − startM`). */
  widthM: number
  /** Zone centre, measured from the wall-run start. */
  centerM: number
  /** Zone centre **relative to the run centre** → use as `Placement.along` offset. */
  alongOffset: number
}

export type ZonePlan = {
  /** The wall-run length the plan covers. */
  runLengthM: number
  /** Number of zones. */
  count: number
  /** Inter-zone gap used. */
  gapM: number
  /** Per-end margin used. */
  marginM: number
  /** Total width actually covered by the zones (sum of widths; excludes gaps/margins). */
  usableM: number
  /** The zones, left→right. */
  zones: Zone[]
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6

function assertFinitePositive(name: string, v: number): void {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
    throw new Error(`${name} must be a finite positive number (got ${v})`)
  }
}

function assertFiniteNonNeg(name: string, v: number): void {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new Error(`${name} must be a finite number ≥ 0 (got ${v})`)
  }
}

/**
 * Divide a wall run of `runLengthM` into `count` side-by-side zones.
 *
 * Zones are equal-width by default, or split in proportion to `weights` (which
 * must have one strictly-positive entry per zone). Optional `marginM` keeps each
 * wall end clear; optional `gapM` separates adjacent zones. The zones cover
 * exactly `[marginM, runLengthM − marginM]` with the requested gaps between them;
 * the last zone's end is pinned to `runLengthM − marginM` so float drift never
 * leaves a sliver.
 *
 * Throws on non-finite/non-positive `runLengthM`, a non-integer/`< 1` `count`,
 * negative `gapM`/`marginM`, malformed `weights`, or a layout whose margins+gaps
 * leave no usable length (`U ≤ 0`).
 */
export function planZones(
  runLengthM: number,
  count: number,
  opts: { gapM?: number; marginM?: number; weights?: number[] } = {},
): ZonePlan {
  assertFinitePositive('runLengthM', runLengthM)
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`count must be an integer ≥ 1 (got ${count})`)
  }
  const gapM = opts.gapM ?? 0
  const marginM = opts.marginM ?? 0
  assertFiniteNonNeg('gapM', gapM)
  assertFiniteNonNeg('marginM', marginM)

  let weights: number[]
  if (opts.weights != null) {
    if (opts.weights.length !== count) {
      throw new Error(`weights must have one entry per zone (count=${count}, got ${opts.weights.length})`)
    }
    opts.weights.forEach((w, i) => assertFinitePositive(`weights[${i}]`, w))
    weights = opts.weights
  } else {
    weights = new Array(count).fill(1)
  }
  const weightTotal = weights.reduce((a, b) => a + b, 0)

  const usable = runLengthM - 2 * marginM - (count - 1) * gapM
  if (usable <= 0) {
    throw new Error(
      `no usable length: runLength ${runLengthM} − 2·margin ${marginM} − ${count - 1}·gap ${gapM} = ${usable}`,
    )
  }

  const halfRun = runLengthM / 2
  const lastEnd = runLengthM - marginM
  const zones: Zone[] = []
  let cursor = marginM
  for (let i = 0; i < count; i++) {
    const width = (usable * weights[i]) / weightTotal
    const start = cursor
    // Pin the final zone's far edge so the series ends exactly at runLength−margin.
    const end = i === count - 1 ? lastEnd : start + width
    const center = (start + end) / 2
    zones.push({
      index: i,
      startM: round6(start),
      endM: round6(end),
      widthM: round6(end - start),
      centerM: round6(center),
      alongOffset: round6(center - halfRun),
    })
    cursor = end + gapM
  }

  return { runLengthM, count, gapM, marginM, usableM: round6(usable), zones }
}

/** Absolute `Placement.along` (world coord on the run axis) for a zone's centre. */
export function zoneAlong(runCenter: number, zone: Zone): number {
  return round6(runCenter + zone.alongOffset)
}

/**
 * Scale factor that makes a print of true width `printWidthM` exactly fill a zone
 * of width `zoneWidthM` (the run axis is the one being divided, so we fit width).
 */
export function fitScale(zoneWidthM: number, printWidthM: number): number {
  assertFinitePositive('zoneWidthM', zoneWidthM)
  assertFinitePositive('printWidthM', printWidthM)
  return round6(zoneWidthM / printWidthM)
}

export type ZonePlacementInput = {
  /** Template placement — printId / wallId / side / centerY / mount / glow are kept. */
  base: Placement
  /** Wall-run centre in world coords (`wallRun(wall).runCenter`). */
  runCenter: number
  /** Wall run length (metres). */
  runLength: number
  /** Print's true trim width at scale 1 (metres) — used when `fit` scales to a zone. */
  printWidthM: number
  /** Number of zones to lay out. */
  count: number
  /** Prefix for the generated placement ids (`${idPrefix}-z1`, `-z2`, …). */
  idPrefix: string
  /** Inter-zone gap (m). Default 0. */
  gapM?: number
  /** Per-end margin (m). Default 0. */
  marginM?: number
  /** Per-zone weights — uneven zones (e.g. "zoned per camera"). */
  weights?: number[]
  /**
   * When `true` (default), each copy is scaled to fill its zone's width; when
   * `false`, every copy keeps the base scale (a repeated motif with gaps).
   */
  fit?: boolean
}

/**
 * Turn one template placement into `count` zoned copies laid out along its wall —
 * the pure core behind "mount a series of segments instead of one stretched print".
 * Each copy inherits the base's wall/side/height/mount/glow, is re-centred on its
 * zone, and (when `fit`) scaled to fill that zone's width. Ids are stable and
 * unique within the call (`${idPrefix}-z{n}`). Returns a fresh `Placement[]`.
 */
export function planZonePlacements(input: ZonePlacementInput): Placement[] {
  const { base, runCenter, runLength, printWidthM, count, idPrefix } = input
  const fit = input.fit ?? true
  const plan = planZones(runLength, count, {
    gapM: input.gapM,
    marginM: input.marginM,
    weights: input.weights,
  })

  return plan.zones.map((zone) => {
    const placement: Placement = {
      ...base,
      id: `${idPrefix}-z${zone.index + 1}`,
      along: zoneAlong(runCenter, zone),
      scale: fit ? fitScale(zone.widthM, printWidthM) : base.scale,
    }
    return placement
  })
}
