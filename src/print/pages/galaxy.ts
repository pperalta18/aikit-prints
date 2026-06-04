/**
 * galaxy — the honest geometry behind the "Galaxia de mercados" prints.
 * ──────────────────────────────────────────────────────────────────────────
 * THREE separate, self-contained framed prints — the back wall **5N1** (the AI),
 * the left wall **2-E** and the right wall **11-W** (the markets). They are NOT one
 * sliced mural: each wall composes its own assigned bodies entirely inside its own
 * frame, nothing clipped. The honesty link is a **shared area∝value scale**: every
 * wall sizes its circles against the SAME global max (Nvidia) at the same `maxRadius`,
 * so a coffee ring on a side wall is the true size it would be next to the AI — the
 * comparison stays honest as you walk the room.
 *
 * Pure functions (no React/DOM) so the honesty is unit-tested, not eyeballed. Every
 * radius derives from a researched, dated, sourced USD figure (`galaxy-data.ts`).
 * Layout: a deterministic **phyllotaxis** (sunflower) scatter around a centred
 * anchor (the AI "sun" on the back wall; the largest body on a side wall), packed
 * with no overlap and fully in-bounds. See [[galaxy-markets-walls]].
 */

import { circleAreaScale, type AreaScale } from './dataviz-scales'

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

export type WallLayout = {
  width: number
  height: number
  /** The shared area∝value scale (built from the global max — same on every wall). */
  scale: AreaScale
  /** Bodies, value-desc. */
  bodies: GalaxyBody[]
  /** Bodies enlarged past honest size (`toScale === false`). */
  enlarged: GalaxyBody[]
  /** Frame centre where the anchor sits. */
  center: { x: number; y: number }
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
  /** Body id to centre (the AI sun on the back wall). Else the largest body anchors. */
  sunId?: string
  /** Vertical centre as a fraction of height. Default 0.5. */
  centerYFrac?: number
  /** Fraction of the half-width / half-height the scatter fills. */
  hFill?: number
  vFill?: number
  /** Deterministic jitter seed. Default 1. */
  seed?: number
}

/* ── deterministic helpers ───────────────────────────────────────────────────── */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

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

type Placed = { cx: number; cy: number; r: number }

function hits(x: number, y: number, r: number, placed: ReadonlyArray<Placed>, gap: number): boolean {
  for (const p of placed) if (Math.hypot(x - p.cx, y - p.cy) < p.r + r + gap) return true
  return false
}

/* ── layout: one self-contained wall, shared scale ───────────────────────────── */

/**
 * Lay a wall's bodies out inside its own frame at the SHARED scale. The anchor
 * (sun, or the largest body) sits at the frame centre; the rest take phyllotaxis
 * slots (value-desc → big near the anchor, small spiralling outward), mapped into
 * an ellipse the shape of the frame and collision-resolved outward. Everything
 * stays fully in-bounds, so the print never clips a body at its frame edge.
 */
export function layoutWall(data: ReadonlyArray<GalaxyDatum>, opts: WallOpts): WallLayout {
  const { width, height, maxValue, maxRadius } = opts
  if (!(width > 0) || !(height > 0)) throw new Error('layoutWall: width/height must be > 0')
  if (!(maxValue > 0) || !(maxRadius > 0)) throw new Error('layoutWall: maxValue/maxRadius must be > 0')

  const minRadius = Math.max(0, opts.minRadius ?? 0)
  const gap = Math.max(0, opts.gap ?? 0)
  const centerYFrac = opts.centerYFrac ?? 0.5
  const hFill = opts.hFill ?? 0.98
  const vFill = opts.vFill ?? 0.9
  const seed = opts.seed ?? 1

  const valid = data.filter((d) => Number.isFinite(d.value) && d.value > 0)
  if (valid.length === 0) throw new Error('layoutWall: no positive-valued bodies')

  const center = { x: width / 2, y: height * centerYFrac }

  const sun = opts.sunId ? valid.find((d) => d.id === opts.sunId) : undefined
  const rest = (sun ? valid.filter((d) => d.id !== sun.id) : [...valid]).sort((a, b) => b.value - a.value)
  const anchor = sun ?? rest.shift()! // largest anchors a side wall

  const jitter = rng(seed)
  const angle0 = jitter() * Math.PI * 2
  const unit = rest.map((_, i) => {
    const n = i + 1
    const theta = angle0 + n * GOLDEN_ANGLE
    const rad = Math.sqrt(n) * (0.9 + jitter() * 0.2)
    return { ux: Math.cos(theta) * rad, uy: Math.sin(theta) * rad }
  })
  const unitMax = unit.reduce((m, u) => Math.max(m, Math.hypot(u.ux, u.uy)), 1)

  const availX = Math.min(center.x, width - center.x)
  const availY = Math.min(center.y, height - center.y)

  let mr = maxRadius
  for (let attempt = 0; attempt < 12; attempt++) {
    const scale = circleAreaScale({ maxValue, maxRadius: mr, minRadius })
    const placed: Placed[] = []
    const bodyOut: GalaxyBody[] = []

    const aR = scale.radius(anchor.value)
    placed.push({ cx: center.x, cy: center.y, r: aR })
    bodyOut.push({ ...anchor, cx: center.x, cy: center.y, r: aR, toScale: scale.toScale(anchor.value) })

    const Kx = (availX * hFill) / unitMax
    const Ky = (availY * vFill) / unitMax
    let ok = true

    for (let i = 0; i < rest.length; i++) {
      const d = rest[i]
      const r = scale.radius(d.value)
      const u = unit[i]
      const clampX = (x: number) => Math.min(width - r, Math.max(r, x))
      const clampY = (y: number) => Math.min(height - r, Math.max(r, y))
      let cx = clampX(center.x + u.ux * Kx)
      let cy = clampY(center.y + u.uy * Ky)
      const len = Math.hypot(u.ux * Kx, u.uy * Ky) || 1
      const dx = (u.ux * Kx) / len
      const dy = (u.uy * Ky) / len
      const step = Math.max(minRadius * 0.4, r * 0.25, gap, 1)

      let done = false
      let t = 0
      for (let it = 0; it < 4000; it++) {
        if (!hits(cx, cy, r, placed, gap)) {
          done = true
          break
        }
        t += step
        cx = clampX(center.x + dx * (aR + r + gap + t))
        cy = clampY(center.y + dy * (aR + r + gap + t))
      }
      if (!done) {
        ok = false
        break
      }
      placed.push({ cx, cy, r })
      bodyOut.push({ ...d, cx, cy, r, toScale: scale.toScale(d.value) })
    }

    if (!ok) {
      mr *= 0.88
      continue
    }

    const bodies = bodyOut.sort((a, b) => b.value - a.value)
    return { width, height, scale, bodies, enlarged: bodies.filter((b) => !b.toScale), center }
  }

  throw new Error('layoutWall: could not place bodies even after shrinking')
}
