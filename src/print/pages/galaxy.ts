/**
 * galaxy — the honest geometry behind the "Galaxia de mercados" prints.
 * ──────────────────────────────────────────────────────────────────────────
 * THREE separate, self-contained framed prints — the back wall **5N1** (the AI),
 * the left wall **2-E** and the right wall **11-W** (the markets). Reimagined as an
 * orbital ("sistema solar / átomo") diagram: every body rides its OWN thin elliptical
 * orbit (see `galaxy-orbits`), the orbits cross each other, and at the centre the AI
 * core (IA + Nvidia, a configurable set) is fused into one Bauhaus blob (`galaxy-metaball`).
 *
 * The honesty link is UNCHANGED: a circle's AREA is its valuation (`circleAreaScale`),
 * at the SAME global-max scale on every wall (Nvidia). The orbit is geometry, not data —
 * it does NOT encode value. Bodies are dispersed so neither the circles NOR the name
 * placed below each circle collide; only the dots + labels stay in-bounds — the ellipses
 * are free to bleed off the frame (the look the side walls want around their edge nucleus).
 *
 * Pure functions (no React/DOM) so the geometry is unit-tested, not eyeballed. Layout is
 * deterministic (seeded). See `galaxy.tsx` for the wall policy + render.
 */

import { circleAreaScale, type AreaScale } from './dataviz-scales'
import { ellipseThroughPoint, orbitParams, type Ellipse, type Vec2 } from './galaxy-orbits'

/* ── types ───────────────────────────────────────────────────────────────────── */

export type GalaxyKind = 'sun' | 'planet' | 'marble'

export type GalaxyDatum = {
  id: string
  label: string
  /** Absolute USD. Area ∝ this value. */
  value: number
  kind: GalaxyKind
  /** Optional colour key (e.g. "ai", "spanish", "market"). */
  group?: string
}

export type GalaxyBody = GalaxyDatum & {
  /** Centre in the frame, mm (x from the left edge, y from the top). */
  cx: number
  cy: number
  /** Rendered radius, mm (area ∝ value, floored at minRadius). */
  r: number
  /** True at honest area-scale; false when floored to stay visible → annotate. */
  toScale: boolean
}

/** An orbiting body + the ellipse (centred on the nucleus) that passes through it. */
export type OrbitBody = GalaxyBody & { orbit: Ellipse }

/** A body fused into the morphed nucleus (drawn as part of the metaball blob). */
export type CoreCircle = GalaxyBody

/**
 * The wall's centre. `metaball` = a fused AI core (back wall). `focal` = an abstract
 * orbit centre with nothing drawn (side walls anchor it on the inner edge). `obstacleR`
 * is the keep-out radius orbiting bodies must clear around the nucleus centre.
 */
export type Nucleus =
  | { kind: 'metaball'; center: Vec2; circles: CoreCircle[]; obstacleR: number }
  | { kind: 'focal'; center: Vec2; obstacleR: number }

export type WallLayout = {
  width: number
  height: number
  /** The shared area∝value scale (built from the global max — same on every wall). */
  scale: AreaScale
  /** Orbiting bodies, value-desc (the nucleus core is NOT here — see `nucleus`). */
  bodies: OrbitBody[]
  /** Orbiting bodies enlarged past honest size (`toScale === false`). */
  enlarged: OrbitBody[]
  /** Nucleus centre (kept for back-compat; equals `nucleus.center`). */
  center: { x: number; y: number }
  /** The morphed core / focal centre. */
  nucleus: Nucleus
}

export type WallOpts = {
  width: number
  height: number
  /** Global max value across ALL walls — the shared scale's reference. */
  maxValue: number
  /** Radius (mm) of the global-max body — shared across walls so sizes are comparable. */
  maxRadius: number
  /** Floor so tiny rings stay visible; anything floored is flagged. Default 0. */
  minRadius?: number
  /** Clear gap between bodies, mm. Default 0. */
  gap?: number
  /** Body ids fused into the morphed nucleus (the AI core). Default none → focal nucleus. */
  coreIds?: string[]
  /** Nucleus placement: centred (back) or anchored to a frame edge (sides). */
  nucleusAnchor?: 'center' | 'edge-inner'
  /** For `edge-inner`: which frame edge the focal point hugs. Default 'left'. */
  focalEdge?: 'left' | 'right'
  /** Vertical centre as a fraction of height. Default 0.5. */
  centerYFrac?: number
  /** Fraction of the available half-width / half-height the scatter fills. */
  hFill?: number
  vFill?: number
  /** Name-label sizing (so the solver reserves the text below each dot). */
  label?: { fontMm?: number; charWidth?: number; gapMm?: number }
  /** Deterministic seed. Default 1. */
  seed?: number
}

/* ── deterministic helpers ───────────────────────────────────────────────────── */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const TAU = Math.PI * 2
const CORE_TILT = -0.18 // slight diagonal for the 2-body blob
const SCAN_RINGS = 20 // candidate radius bands, inner → outer
const SCAN_ANGLES = 28 // candidate headings per band

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function rng(seed: number): () => number {
  let a = seed >>> 0 || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ── label metrics (single source of truth: solver + render share this) ──────── */

export type LabelOpts = WallOpts['label']

export type LabelMetrics = { nameMm: number; labelW: number; labelH: number; gapOut: number }

const DEFAULT_FONT_MM = 56
const DEFAULT_CHAR_W = 0.55
const DEFAULT_GAP_MM = 36

/** Size of the name set BELOW a body (used to reserve space and to render it). */
export function labelMetrics(body: Pick<GalaxyBody, 'label' | 'r'>, label?: LabelOpts): LabelMetrics {
  const fontMm = label?.fontMm ?? DEFAULT_FONT_MM
  const charW = label?.charWidth ?? DEFAULT_CHAR_W
  const gapMm = label?.gapMm ?? DEFAULT_GAP_MM
  const nameMm = clamp(body.r * 0.5, fontMm * 0.8, fontMm * 1.7)
  const labelW = body.label.length * nameMm * charW
  const labelH = nameMm * 1.15
  const gapOut = Math.max(gapMm, body.r * 0.15)
  return { nameMm, labelW, labelH, gapOut }
}

/* ── footprint geometry (circle ∪ name-box below it) ─────────────────────────── */

type Box = { x0: number; y0: number; x1: number; y1: number }
type Footprint = { cx: number; cy: number; r: number; box: Box }

const boxesOverlap = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

function circleHitsBox(cx: number, cy: number, r: number, box: Box, pad: number): boolean {
  const nx = clamp(cx, box.x0, box.x1)
  const ny = clamp(cy, box.y0, box.y1)
  return Math.hypot(cx - nx, cy - ny) < r + pad
}

function footprintHits(c: Footprint, placed: ReadonlyArray<Footprint>, nucleus: Vec2, obstacleR: number, gap: number): boolean {
  if (obstacleR > 0) {
    if (Math.hypot(c.cx - nucleus.x, c.cy - nucleus.y) < obstacleR + c.r + gap) return true
    if (circleHitsBox(nucleus.x, nucleus.y, obstacleR, c.box, gap)) return true
  }
  for (const p of placed) {
    if (Math.hypot(c.cx - p.cx, c.cy - p.cy) < c.r + p.r + gap) return true
    if (boxesOverlap(c.box, p.box)) return true
    if (circleHitsBox(c.cx, c.cy, c.r, p.box, gap)) return true
    if (circleHitsBox(p.cx, p.cy, p.r, c.box, gap)) return true
  }
  return false
}

/* ── the morphed core (a tight cluster around the nucleus centre) ─────────────── */

function buildCore(coreData: ReadonlyArray<GalaxyDatum>, scale: AreaScale, n: Vec2): { circles: CoreCircle[]; obstacleR: number } {
  if (coreData.length === 0) return { circles: [], obstacleR: 0 }
  const sorted = [...coreData].sort((a, b) => scale.radius(b.value) - scale.radius(a.value))
  const body = (d: GalaxyDatum, cx: number, cy: number): CoreCircle => ({ ...d, cx, cy, r: scale.radius(d.value), toScale: scale.toScale(d.value) })
  const OVERLAP = 0.88 // centre distance as a fraction of (r0+r1): <1 → fused with a neck

  if (sorted.length === 2) {
    const r0 = scale.radius(sorted[0].value)
    const r1 = scale.radius(sorted[1].value)
    const d = OVERLAP * (r0 + r1)
    const dir = { x: Math.cos(CORE_TILT), y: Math.sin(CORE_TILT) }
    const c0 = body(sorted[0], n.x - dir.x * (d / 2), n.y - dir.y * (d / 2))
    const c1 = body(sorted[1], n.x + dir.x * (d / 2), n.y + dir.y * (d / 2))
    return { circles: [c0, c1], obstacleR: d / 2 + Math.max(r0, r1) }
  }

  // 1 or 3+: anchor (largest) at the centre, the rest spread around it.
  const aR = scale.radius(sorted[0].value)
  const circles: CoreCircle[] = [body(sorted[0], n.x, n.y)]
  let obstacleR = aR
  for (let i = 1; i < sorted.length; i++) {
    const r = scale.radius(sorted[i].value)
    const ang = CORE_TILT + ((i - 1) / Math.max(1, sorted.length - 1)) * TAU
    const d = OVERLAP * (aR + r)
    circles.push(body(sorted[i], n.x + Math.cos(ang) * d, n.y + Math.sin(ang) * d))
    obstacleR = Math.max(obstacleR, d + r)
  }
  return { circles, obstacleR }
}

/* ── layout: one self-contained wall, shared scale ───────────────────────────── */

/**
 * Lay a wall's bodies out as an orbital diagram at the SHARED scale. The core ids
 * (back wall) fuse into a centred metaball nucleus; everything else is dispersed
 * (collision-free, including the name below each dot) around the nucleus centre,
 * and each body gets the unique ellipse that passes through it. On `edge-inner`
 * walls the nucleus centre hugs the inner edge so the big orbits bleed off the top
 * and bottom. Shrinks the shared radius only as a last resort (keeps sizes honest).
 */
export function layoutWall(data: ReadonlyArray<GalaxyDatum>, opts: WallOpts): WallLayout {
  const { width, height, maxValue, maxRadius } = opts
  if (!(width > 0) || !(height > 0)) throw new Error('layoutWall: width/height must be > 0')
  if (!(maxValue > 0) || !(maxRadius > 0)) throw new Error('layoutWall: maxValue/maxRadius must be > 0')

  const minRadius = Math.max(0, opts.minRadius ?? 0)
  const gap = Math.max(0, opts.gap ?? 0)
  const centerYFrac = opts.centerYFrac ?? 0.5
  const hFill = opts.hFill ?? 0.96
  const vFill = opts.vFill ?? 0.9
  const seed = opts.seed ?? 1
  const anchor = opts.nucleusAnchor ?? 'center'
  const focalEdge = opts.focalEdge ?? 'left'

  const valid = data.filter((d) => Number.isFinite(d.value) && d.value > 0)
  if (valid.length === 0) throw new Error('layoutWall: no positive-valued bodies')

  const coreIds = new Set(opts.coreIds ?? [])
  const coreData = valid.filter((d) => coreIds.has(d.id))
  const orbitData = valid.filter((d) => !coreIds.has(d.id)).sort((a, b) => b.value - a.value)

  // Nucleus centre: framed centre, or hugging an inner edge (side walls).
  const n: Vec2 =
    anchor === 'edge-inner'
      ? { x: focalEdge === 'right' ? width : 0, y: height * centerYFrac }
      : { x: width / 2, y: height * centerYFrac }

  const availX = (anchor === 'edge-inner' ? width : Math.min(n.x, width - n.x)) * hFill
  const availY = Math.min(n.y, height - n.y) * vFill

  let mr = maxRadius
  for (let attempt = 0; attempt < 16; attempt++) {
    const scale = circleAreaScale({ maxValue, maxRadius: mr, minRadius })
    const core = buildCore(coreData, scale, n)
    const focalClearance = core.circles.length > 0 ? core.obstacleR : Math.max(gap, height * 0.05)

    const jitter = rng(seed)
    const placed: Footprint[] = []
    const out: OrbitBody[] = []
    let ok = true

    for (let i = 0; i < orbitData.length; i++) {
      const d = orbitData[i]
      const r = scale.radius(d.value)
      const toScale = scale.toScale(d.value)
      const met = labelMetrics({ label: d.label, r }, opts.label)
      const halfW = Math.max(r, met.labelW / 2)

      const clampX = (x: number) => clamp(x, halfW, width - halfW)
      const clampY = (y: number) => clamp(y, r, height - r - met.gapOut - met.labelH)
      const makeFp = (x: number, y: number): Footprint => ({
        cx: x,
        cy: y,
        r,
        box: { x0: x - met.labelW / 2, y0: y + r + met.gapOut, x1: x + met.labelW / 2, y1: y + r + met.gapOut + met.labelH },
      })

      // Scan candidates over (radius band × heading), anisotropically mapped into the
      // frame so the wide walls spread horizontally. Per-body jittered start ring +
      // angle so distances vary (orbits at mixed scales, not a tidy gradient). On
      // edge walls the heading is folded into the inward half-plane. First collision-
      // free slot wins; the footprint test already clears the nucleus + every label.
      const ringStart = Math.floor(jitter() * SCAN_RINGS)
      const angOff = jitter() * TAU
      let px = NaN
      let py = NaN
      let done = false
      for (let ringI = 0; ringI < SCAN_RINGS && !done; ringI++) {
        const ring = (ringStart + ringI) % SCAN_RINGS
        const radFrac = 0.14 + ring * (0.92 / (SCAN_RINGS - 1))
        for (let a = 0; a < SCAN_ANGLES && !done; a++) {
          const ang = angOff + a * GOLDEN_ANGLE
          let ux = Math.cos(ang)
          const uy = Math.sin(ang)
          if (anchor === 'edge-inner') ux = focalEdge === 'right' ? -Math.abs(ux) : Math.abs(ux)
          const cx = clampX(n.x + ux * radFrac * availX)
          const cy = clampY(n.y + uy * radFrac * availY)
          if (!footprintHits(makeFp(cx, cy), placed, n, focalClearance, gap)) {
            px = cx
            py = cy
            done = true
          }
        }
      }
      if (!done) {
        ok = false
        break
      }

      placed.push(makeFp(px, py))
      const { theta: ot, k } = orbitParams(seed, i, Math.atan2(py - n.y, px - n.x))
      const orbit = ellipseThroughPoint(n, { x: px, y: py }, ot, k) ?? { cx: n.x, cy: n.y, rx: Math.hypot(px - n.x, py - n.y) || r, ry: r, rotation: ot }
      out.push({ ...d, cx: px, cy: py, r, toScale, orbit })
    }

    if (!ok) {
      mr *= 0.9
      continue
    }

    const bodies = out.sort((a, b) => b.value - a.value)
    const nucleus: Nucleus =
      core.circles.length > 0
        ? { kind: 'metaball', center: n, circles: core.circles, obstacleR: core.obstacleR }
        : { kind: 'focal', center: n, obstacleR: focalClearance }
    return { width, height, scale, bodies, enlarged: bodies.filter((b) => !b.toScale), center: n, nucleus }
  }

  throw new Error('layoutWall: could not place bodies even after shrinking')
}
