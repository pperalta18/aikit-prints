/**
 * warp — the "warp espacio-tiempo" gravity-well field for the Galaxia canvas.
 * ──────────────────────────────────────────────────────────────────────────
 * A continuous rubber-sheet / gravity-well diagram drawn **por celdas** (not by
 * lines): a polar grid of cells that crowds and dives into a central black hole.
 * The hole IS the AI core — its area is `area(IA) + area(Nvidia)` at the *same*
 * shared galaxy scale (`circleAreaScale`, Nvidia = global max), so "the dark part
 * matches the size of IA + Nvidia". On the combined canvas the hole sits over the
 * centre of the back wall (5N1); the field flows out continuously across the two
 * laterals (2-E left, 11-W right), flattening to a plain grid far away.
 *
 * This module is pure maths (no React/DOM): it models a funnel **surface of
 * revolution** under a tilted, non-converging (oblique) projection — the transform
 * a 3D camera applies, but emitted as flat 2D cell polygons so the piece prints in
 * CMYK and maps onto the walls. The look (white field, cells darkening into the
 * hole, fine separation lines) lives in `warp.tsx`; the spheres come later.
 *
 * Coordinates are millimetres in the trim space (origin top-left, +x right, +y
 * down) — the page scales them to px with `geo.mm`. See [[galaxy-markets-walls]].
 */

import { circleAreaScale } from './dataviz-scales'
import { GALAXY_SUN, GALAXY_PLANETS, galaxyMaxValue } from '../space/galaxy-data'

/** Nvidia (the global-max body) radius as a fraction of canvas height — the galaxy's shared scale. */
export const WARP_MAX_RADIUS_FRAC = 0.27

export type WarpOpts = {
  /** Full canvas width (mm) — the three walls joined: 2-E + 5N1 + 11-W. */
  widthMm: number
  /** Canvas height (mm). */
  heightMm: number
  /** Hole centre X (mm from left). Default = centre of the back-wall (5N1) region. */
  holeCenterXMm?: number
  /** Where the black hole sits vertically, as a fraction of height (low → bigger funnel). */
  holeCenterYFrac?: number
  /** The undisturbed far-field "horizon" (flat grid equator), as a fraction of height. */
  horizonYFrac?: number
  /** Black-hole radius (mm). Default = area(IA)+area(Nvidia) at the shared galaxy scale. */
  holeRadiusMm?: number
  /**
   * Enlarge the throat so its FORESHORTENED projected ellipse has the same apparent
   * area as the honest disc (= IA+Nvidia) — otherwise the tilt shrinks the hole vs the
   * area-true spheres and it "loses" in perspective. Scales the radius by 1/√foreshorten.
   * Default true.
   */
  perspectiveCompensate?: boolean
  /** Vertical foreshorten of the rings (0…1) — the tilt of the rubber sheet (smaller = more 3D). */
  foreshorten?: number
  /** Funnel falloff exponent — how fast the basin flattens away from the rim. */
  funnelFalloff?: number
  /** Geometric growth ratio between successive rings (>1) — cells crowd near the rim. */
  ringGrowth?: number
  /** Number of angular spokes. */
  spokes?: number
  /** Arc subdivisions per cell side (1 = straight chords; >1 = smoother curved cells). */
  arcSegments?: number
  /** Radius (mm) over which a cell fades from hole-ink (rim) to the white field. */
  shadeSpanMm?: number
  /** Max planar radius to tile (mm). Default covers the canvas corners. */
  maxRadiusMm?: number
}

/** A vertex in canvas mm. */
export type WarpPoint = { x: number; y: number }

/** One annular-sector cell of the warped grid. */
export type WarpCell = {
  ring: number
  spoke: number
  /** Closed polygon outline in canvas mm (outer arc → inner arc). */
  points: WarpPoint[]
  /** Representative planar radius (mm from the hole centre) — drives shading + draw order. */
  rMid: number
  /** 0 at the rim (darkest, dives into the hole) … 1 in the flat far field (white). */
  shade: number
}

export type WarpField = {
  /** Hole centre X in canvas mm. */
  holeCenterX: number
  /** Hole centre Y in canvas mm (the projected basin). */
  holeCenterY: number
  /** The flat far-field equator Y in canvas mm. */
  cyHorizon: number
  /** Throat radius in mm (perspective-compensated rim — what the rings start at). */
  holeRadiusMm: number
  /** Radius (mm) over which a cell fades from rim-ink to the white field. */
  shadeSpanMm: number
  /** Vertical foreshorten actually used. */
  foreshorten: number
  /** Projected black-hole ellipse (centre + semi-axes, canvas mm). */
  hole: { cx: number; cy: number; rx: number; ry: number }
  /** Tiled cells, in (ring, spoke) order. */
  cells: WarpCell[]
  /** Ring radii (mm), from the rim outward. */
  radii: number[]
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const DEFAULTS = {
  /** Centre of 5N1 on the 23.5 m combined canvas (8.25 m 2-E + half of 9.5 m 5N1). */
  holeCenterXFrac: 13000 / 23500,
  holeCenterYFrac: 0.56,
  horizonYFrac: 0.4,
  foreshorten: 0.48,
  funnelFalloff: 1.2,
  ringGrowth: 1.2,
  spokes: 72,
  arcSegments: 1,
  /** Darkening reach as a multiple of the hole radius (ties the basin to the hole size). */
  shadeSpanFrac: 4.4,
}

/**
 * The honest black-hole radius: the disc whose AREA equals area(IA) + area(Nvidia)
 * at the galaxy's shared `area ∝ valoración` scale (Nvidia = global max). So the
 * dark centre reads as exactly the combined size of the AI core, never a guess.
 */
export function holeRadiusForIaNvidia(heightMm: number): number {
  const scale = circleAreaScale({ maxValue: galaxyMaxValue(), maxRadius: heightMm * WARP_MAX_RADIUS_FRAC })
  const rIa = scale.radius(GALAXY_SUN.value)
  const rNv = scale.radius(GALAXY_PLANETS[0].value)
  // π·R² = π·rIa² + π·rNv²  →  R = hypot(rIa, rNv)
  return Math.hypot(rIa, rNv)
}

/** Build the full warp field: the gravity-well surface projected to 2D cell polygons. */
export function buildWarpField(opts: WarpOpts): WarpField {
  const W = opts.widthMm
  const H = opts.heightMm
  const cx = opts.holeCenterXMm ?? W * DEFAULTS.holeCenterXFrac
  const foreshorten = clamp(opts.foreshorten ?? DEFAULTS.foreshorten, 0.05, 1)
  const cyHorizon = (opts.horizonYFrac ?? DEFAULTS.horizonYFrac) * H
  const holeCenterY = (opts.holeCenterYFrac ?? DEFAULTS.holeCenterYFrac) * H
  const liftTotal = holeCenterY - cyHorizon
  const honestHoleR = opts.holeRadiusMm ?? holeRadiusForIaNvidia(H)
  // A ground circle becomes a foreshortened ellipse under the tilt, so its apparent
  // area drops by `foreshorten` vs the (area-true) spheres. Scale the throat up by
  // 1/√foreshorten → the projected hole reads at its honest area next to the spheres.
  const holeR = (opts.perspectiveCompensate ?? true) ? honestHoleR / Math.sqrt(foreshorten) : honestHoleR
  const falloff = opts.funnelFalloff ?? DEFAULTS.funnelFalloff
  const growth = Math.max(1.02, opts.ringGrowth ?? DEFAULTS.ringGrowth)
  const spokes = Math.max(8, Math.round(opts.spokes ?? DEFAULTS.spokes))
  const arcSeg = Math.max(1, Math.round(opts.arcSegments ?? DEFAULTS.arcSegments))
  const shadeSpan = opts.shadeSpanMm ?? holeR * DEFAULTS.shadeSpanFrac
  const maxR = opts.maxRadiusMm ?? 1.25 * Math.max(cx, W - cx, H / foreshorten)

  /** Funnel depth → vertical lift (mm, downward): max at the rim, fading to the flat far field. */
  const lift = (r: number) => liftTotal * Math.pow(holeR / Math.max(r, holeR), falloff)
  /** Oblique projection of the surface-of-revolution point (r, θ) to canvas mm. */
  const project = (r: number, theta: number): WarpPoint => ({
    x: cx + r * Math.cos(theta),
    y: cyHorizon + r * Math.sin(theta) * foreshorten + lift(r),
  })

  // Ring radii: geometric growth from the rim → small gaps near the hole, large gaps far out.
  const radii: number[] = []
  for (let r = holeR; r < maxR; r *= growth) radii.push(r)
  radii.push(maxR) // close coverage out to the canvas corner

  const dTheta = (2 * Math.PI) / spokes
  const cells: WarpCell[] = []
  for (let i = 0; i < radii.length - 1; i++) {
    const r0 = radii[i]
    const r1 = radii[i + 1]
    const rMid = Math.sqrt(r0 * r1)
    const shade = clamp((rMid - holeR) / shadeSpan, 0, 1)
    for (let j = 0; j < spokes; j++) {
      const a0 = j * dTheta
      const a1 = a0 + dTheta
      const points: WarpPoint[] = []
      // outer arc (r1): a0 → a1
      for (let s = 0; s <= arcSeg; s++) points.push(project(r1, a0 + ((a1 - a0) * s) / arcSeg))
      // inner arc (r0): a1 → a0  (closes the sector)
      for (let s = 0; s <= arcSeg; s++) points.push(project(r0, a1 - ((a1 - a0) * s) / arcSeg))
      cells.push({ ring: i, spoke: j, points, rMid, shade })
    }
  }

  return {
    holeCenterX: cx,
    holeCenterY,
    cyHorizon,
    holeRadiusMm: holeR,
    shadeSpanMm: shadeSpan,
    foreshorten,
    hole: { cx, cy: holeCenterY, rx: holeR, ry: holeR * foreshorten },
    cells,
    radii,
  }
}
