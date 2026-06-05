/**
 * warp-bodies — seam-aware placement of the market spheres on the warp canvas.
 * ──────────────────────────────────────────────────────────────────────────
 * Pure maths (no React/DOM). Places every non-core body as an area-true sphere
 * (area ∝ valoración, Nvidia = global max — the same shared scale) around the
 * black hole, then a label box under each one. Crucially it is **print-cut aware**:
 * the combined canvas is sliced into three prints (2-E · 5N1 · 11-W), so neither a
 * sphere NOR its label may straddle a seam — each region is a band inset from its
 * seams and from the canvas edges, and a body is only placed where BOTH its sphere
 * and its (conservatively reserved) label box fit entirely inside that band. So the
 * cuts fall through clean white gutters. Region map mirrors the orbital walls:
 * 2-E (left) = sectors · 5N1 (centre) = nations + Spanish champions · 11-W (right)
 * = iconic brands. See [[galaxia-warp-canvas]].
 */

import { circleAreaScale } from './dataviz-scales'
import { WARP_MAX_RADIUS_FRAC } from './warp'
import {
  GALAXY_COUNTRIES,
  GALAXY_SPANISH,
  GALAXY_SECTORS,
  GALAXY_COMPANIES,
  galaxyMaxValue,
  type GalaxyBodyDatum,
  type GalaxyGroup,
} from '../space/galaxy-data'

/** Legibility floor — a body whose honest radius is below this is enlarged (toScale=false). */
export const WARP_MIN_RADIUS_MM = 34

export type WarpRegion = 'left' | 'center' | 'right'

export type WarpBody = {
  id: string
  label: string
  value: number
  group: GalaxyGroup
  region: WarpRegion
}

/**
 * Director's manual moves (swaps): pull recognisable brands/markets into the centre,
 * push the nations out to the laterals — so it isn't all countries next to ChatGPT.
 * Suiza ↔ Netflix · Noruega ↔ Vino · Argentina ↔ Smartphones. Regions use the canvas
 * unfold order [11-W (left) · 5N1 (centre) · 2-E (right)]: Suiza→11-W (left),
 * Noruega/Argentina→2-E (right).
 */
const REGION_OVERRIDES: Record<string, WarpRegion> = {
  netflix: 'center',
  switzerland: 'left',
  vino: 'center',
  norway: 'right',
  smartphones: 'center',
  argentina: 'right',
}

/**
 * Every non-core body tagged with the region (= print) it belongs to. Unfold order is
 * [11-W (left band) · 5N1 (centre) · 2-E (right band)] — companies on 11-W, nations +
 * Spanish round the core on 5N1, sectors on 2-E.
 */
export function warpBodies(): WarpBody[] {
  const tag = (arr: GalaxyBodyDatum[], region: WarpRegion): WarpBody[] =>
    arr.map((b) => ({ id: b.id, label: b.label, value: b.value, group: b.group, region: REGION_OVERRIDES[b.id] ?? region }))
  return [
    ...tag(GALAXY_COMPANIES, 'left'), // 11-W
    ...tag(GALAXY_COUNTRIES, 'center'), // 5N1
    ...tag(GALAXY_SPANISH, 'center'), // 5N1
    ...tag(GALAXY_SECTORS, 'right'), // 2-E
  ]
}

export type Rect = { x: number; y: number; w: number; h: number }
export type LabelBox = Rect & { fontMm: number }

export type PlacedSphere = {
  id: string
  label: string
  group: GalaxyGroup
  region: WarpRegion
  cx: number
  cy: number
  r: number
  /** False when the body was floored to the legibility minimum (→ annotate "ampliado"). */
  toScale: boolean
  labelBox: LabelBox
}

export type PlaceOpts = {
  widthMm: number
  heightMm: number
  /** Projected black-hole ellipse to keep clear of. */
  hole: { cx: number; cy: number; rx: number; ry: number }
  /** X positions (mm) of the print cuts. */
  seams: number[]
  /** Clear gutter on each side of a seam (mm). */
  seamMarginMm?: number
  /** Clear margin at the canvas edges (mm). */
  edgeMarginMm?: number
  /** Minimum gap between any two bodies / labels (mm). */
  gapMm?: number
  seed?: number
  /** 0 = pack toward the hole (gravitational); 1 = spread evenly across the band. */
  dispersion?: number
  /** Rectangles (mm) to keep clear of every sphere AND label — e.g. a fixed wall chart. */
  keepouts?: Rect[]
  /** Label font size as a fraction of sphere radius (clamped to min/max). */
  labelFontFrac?: number
  labelMinMm?: number
  labelMaxMm?: number
  /** Gap between sphere bottom and label plate (mm). */
  labelGapMm?: number
  labelPadXMm?: number
  labelPadYMm?: number
  /** Reserved width per character as a fraction of font size (conservative → seam-safe). */
  labelCharWFrac?: number
  /** Scale maxRadius (mm). Default = height·WARP_MAX_RADIUS_FRAC (Nvidia's radius). */
  maxRadiusMm?: number
}

export type PlaceResult = { placed: PlacedSphere[]; skipped: string[] }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Small deterministic PRNG (same family as the other pages). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Circle (centre + radius) vs axis-aligned rect — true if they intersect. */
function circleRect(cx: number, cy: number, r: number, b: Rect): boolean {
  const nx = clamp(cx, b.x, b.x + b.w)
  const ny = clamp(cy, b.y, b.y + b.h)
  return Math.hypot(cx - nx, cy - ny) < r
}

/** Two rects intersect within `gap`. */
function rectRect(a: Rect, b: Rect, gap: number): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
}

/** Ellipse (centre + semi-axes) vs rect — true if the rect reaches inside the ellipse. */
function ellipseRect(ecx: number, ecy: number, erx: number, ery: number, b: LabelBox): boolean {
  const nx = clamp(ecx, b.x, b.x + b.w)
  const ny = clamp(ecy, b.y, b.y + b.h)
  const dx = (nx - ecx) / erx
  const dy = (ny - ecy) / ery
  return dx * dx + dy * dy < 1
}

/**
 * Place the spheres + labels, seam- and edge-safe, collision-free. Largest first,
 * filling each region from the hole outward (so big bodies sit near the core).
 */
export function placeWarpSpheres(opts: PlaceOpts): PlaceResult {
  const W = opts.widthMm
  const H = opts.heightMm
  const seamMargin = opts.seamMarginMm ?? 220
  const edgeMargin = opts.edgeMarginMm ?? 170
  const gap = opts.gapMm ?? 120
  const seed = opts.seed ?? 7
  const dispersion = clamp(opts.dispersion ?? 0, 0, 1)
  const keepouts = opts.keepouts ?? []
  const fontFrac = opts.labelFontFrac ?? 0.42
  const labelMin = opts.labelMinMm ?? 46
  const labelMax = opts.labelMaxMm ?? 120
  const labelGap = opts.labelGapMm ?? 42
  const padX = opts.labelPadXMm ?? 16
  const padY = opts.labelPadYMm ?? 8
  const charW = opts.labelCharWFrac ?? 0.6
  const maxRadius = opts.maxRadiusMm ?? H * WARP_MAX_RADIUS_FRAC

  const scale = circleAreaScale({ maxValue: galaxyMaxValue(), maxRadius, minRadius: WARP_MIN_RADIUS_MM })
  const rng = mulberry32(seed)

  const seams = [...opts.seams].sort((a, b) => a - b)
  const bands: Record<WarpRegion, [number, number]> = {
    left: [edgeMargin, seams[0] - seamMargin],
    center: [seams[0] + seamMargin, seams[1] - seamMargin],
    right: [seams[1] + seamMargin, W - edgeMargin],
  }
  const yMin = edgeMargin
  const yMax = H - edgeMargin

  const byRegion: Record<WarpRegion, WarpBody[]> = { left: [], center: [], right: [] }
  for (const b of warpBodies()) byRegion[b.region].push(b)
  for (const k of Object.keys(byRegion) as WarpRegion[]) byRegion[k].sort((a, b) => b.value - a.value)

  const placed: PlacedSphere[] = []
  const skipped: string[] = []

  const dims = (label: string, r: number) => {
    const fontMm = clamp(r * fontFrac, labelMin, labelMax)
    return { fontMm, w: label.length * fontMm * charW + 2 * padX, h: fontMm + 2 * padY }
  }

  const hitsExisting = (cx: number, cy: number, r: number, lb: LabelBox): boolean => {
    for (const p of placed) {
      if (Math.hypot(cx - p.cx, cy - p.cy) < r + p.r + gap) return true
      if (circleRect(cx, cy, r + gap, p.labelBox)) return true
      if (circleRect(p.cx, p.cy, p.r + gap, lb)) return true
      if (rectRect(lb, p.labelBox, gap)) return true
    }
    return false
  }

  // centre first → the nations/champions take the prime ring around the hole.
  for (const region of ['center', 'left', 'right'] as WarpRegion[]) {
    const [xMin, xMax] = bands[region]
    for (const body of byRegion[region]) {
      const r = scale.radius(body.value)
      const toScale = scale.toScale(body.value)
      const d = dims(body.label, r)
      const half = Math.max(r, d.w / 2)
      const cxLo = xMin + half
      const cxHi = xMax - half
      const cyLo = yMin + r
      const cyHi = yMax - (r + labelGap + d.h)
      if (cxLo > cxHi || cyLo > cyHi) {
        skipped.push(body.id)
        continue
      }

      // jittered grid candidates; ordering blends nearest-to-hole (gravitational) with a
      // seeded random spread, so `dispersion` lerps from a tight core to an even scatter.
      const step = Math.max(64, r * 0.6)
      const cands: Array<{ x: number; y: number; dist: number; rnd: number }> = []
      for (let x = cxLo; x <= cxHi; x += step) {
        for (let y = cyLo; y <= cyHi; y += step) {
          const cx = clamp(x + (rng() - 0.5) * step * 0.7, cxLo, cxHi)
          const cy = clamp(y + (rng() - 0.5) * step * 0.7, cyLo, cyHi)
          cands.push({ x: cx, y: cy, dist: Math.hypot(cx - opts.hole.cx, cy - opts.hole.cy), rnd: rng() })
        }
      }
      let maxD = 1
      for (const c of cands) if (c.dist > maxD) maxD = c.dist
      const key = (c: { dist: number; rnd: number }) => c.dist * (1 - dispersion) + c.rnd * maxD * dispersion
      cands.sort((a, b) => key(a) - key(b))

      let done = false
      for (const c of cands) {
        // hole clearance (sphere)
        const dx = c.x - opts.hole.cx
        const dy = c.y - opts.hole.cy
        const ex = opts.hole.rx + r + gap
        const ey = opts.hole.ry + r + gap
        if ((dx * dx) / (ex * ex) + (dy * dy) / (ey * ey) < 1) continue
        const lb: LabelBox = { x: c.x - d.w / 2, y: c.y + r + labelGap, w: d.w, h: d.h, fontMm: d.fontMm }
        if (ellipseRect(opts.hole.cx, opts.hole.cy, opts.hole.rx + gap, opts.hole.ry + gap, lb)) continue
        if (keepouts.some((k) => circleRect(c.x, c.y, r + gap, k) || rectRect(lb, k, gap))) continue
        if (hitsExisting(c.x, c.y, r, lb)) continue
        placed.push({ id: body.id, label: body.label, group: body.group, region, cx: c.x, cy: c.y, r, toScale, labelBox: lb })
        done = true
        break
      }
      if (!done) skipped.push(body.id)
    }
  }

  return { placed, skipped }
}
