/**
 * galaxy-orbits — one elliptical orbit per body (the "sistema solar / átomo" look).
 * ──────────────────────────────────────────────────────────────────────────
 * The redesigned galaxy draws, for every body, a thin ellipse CENTERED ON THE
 * NUCLEUS that passes EXACTLY through that body's centre — so the dot sits on its
 * own orbit by construction, and orbits cross each other (varied tilt + aspect)
 * like an atom diagram. NOT concentric, NOT value-encoding: the honesty stays in
 * the circle AREA (see `dataviz-scales.circleAreaScale`); the orbit is geometry.
 *
 * Closed form (no iteration): translate to the nucleus N, rotate into the
 * ellipse's local frame by −θ giving (u, w); an axis-aligned ellipse with
 * ry = k·rx through (u, w) needs `rx = √(u² + w²/k²)`, `ry = k·rx`. Substituting
 * back yields exactly 1, so the point is provably on the ellipse.
 *
 * Pure (no React/DOM), deterministic — unit-tested in `galaxy-orbits.test.ts`.
 */

export type Vec2 = { x: number; y: number }

/** An ellipse centred at (cx,cy), semi-axes (rx,ry), its local x-axis rotated
 *  `rotation` rad CCW. Maps 1:1 to SVG `<ellipse>` + `rotate(deg cx cy)`. */
export type Ellipse = {
  cx: number
  cy: number
  rx: number
  ry: number
  /** Rotation of the ellipse's local x-axis, radians (CCW). */
  rotation: number
}

/** Below this nucleus-distance a body has no meaningful orbit (it IS the centre). */
const MIN_ORBIT_DIST = 1e-6

/**
 * The ellipse centred at `n`, rotated by `theta`, with aspect `k = ry/rx`, that
 * passes exactly through `p`. Returns `null` if `p` coincides with `n` (no orbit)
 * or `k` is non-positive.
 */
export function ellipseThroughPoint(n: Vec2, p: Vec2, theta: number, k: number): Ellipse | null {
  if (!(k > 0)) return null
  const dx = p.x - n.x
  const dy = p.y - n.y
  if (Math.hypot(dx, dy) < MIN_ORBIT_DIST) return null

  const c = Math.cos(theta)
  const s = Math.sin(theta)
  // (u,w): p−n expressed in the ellipse's local (un-rotated) frame.
  const u = dx * c + dy * s
  const w = -dx * s + dy * c

  const rx = Math.sqrt(u * u + (w * w) / (k * k))
  const ry = k * rx
  if (!(rx > 0) || !Number.isFinite(rx) || !Number.isFinite(ry)) return null

  return { cx: n.x, cy: n.y, rx, ry, rotation: theta }
}

/** True iff `p` lies on `e` within a relative epsilon (the normalised form ≈ 1). */
export function pointOnEllipse(e: Ellipse, p: Vec2, eps = 1e-6): boolean {
  const c = Math.cos(e.rotation)
  const s = Math.sin(e.rotation)
  const dx = p.x - e.cx
  const dy = p.y - e.cy
  const u = dx * c + dy * s
  const w = -dx * s + dy * c
  const value = (u * u) / (e.rx * e.rx) + (w * w) / (e.ry * e.ry)
  return Math.abs(value - 1) <= eps
}

/* ── deterministic per-body orbit parameters ─────────────────────────────────── */

/** Stable [0,1) hash of two integers — so orbit params are reproducible by index. */
function hash2(a: number, b: number): number {
  let h = (Math.imul(a >>> 0, 0x9e3779b1) + Math.imul(b >>> 0, 0x85ebca77)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Tilt is offset from the body's radial heading (never equal to it — that reads as a
 *  spoke). A fixed base + jittered offset keeps every orbit a distinct crossing tilt. */
const BASE_TILT = 0.6
const TILT_JITTER = 1.0 // ±0.5 rad
const K_MIN = 0.45
const K_MAX = 0.85

/**
 * Deterministic `{theta, k}` for a body given the layout `seed`, the body `index`
 * and its polar `bodyAngle` around the nucleus. `theta` (orbit tilt) is offset
 * from `bodyAngle` so the major axis never runs straight through the dot; `k`
 * (aspect, ry/rx) stays eccentric-but-not-needle in [0.45, 0.85].
 */
export function orbitParams(seed: number, index: number, bodyAngle: number): { theta: number; k: number } {
  const j1 = hash2(seed, index * 2 + 1)
  const j2 = hash2(seed, index * 2 + 2)
  const theta = bodyAngle + BASE_TILT + (j1 - 0.5) * TILT_JITTER
  const k = K_MIN + j2 * (K_MAX - K_MIN)
  return { theta, k }
}
