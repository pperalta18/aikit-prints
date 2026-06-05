/**
 * galaxy-metaball — the morphed nucleus (Bauhaus-style smooth union of circles).
 * ──────────────────────────────────────────────────────────────────────────
 * The back wall's core (IA + Nvidia, a configurable set) is drawn as one blob:
 * the circles plus a concave "neck" bridging each pair, so they read as a single
 * fused mass — the Bauhaus reference. The neck is the classic two-circle metaball
 * connector (SATO Hiroyuki / Paper.js): tangent attachment points on each rim and
 * two cubic-bezier sides whose handles are tangent to the circles.
 *
 * Honesty preserved: each circle is emitted at its EXACT radius (`area ∝ value`);
 * the neck only *adds* mass between circles, it never resizes one. Output is a
 * single SVG path `d` (all circles + necks as subpaths, `fill-rule: nonzero` →
 * visual union, no boolean geometry). Pure / unit-agnostic — call it with mm or px.
 *
 * Pure (no React/DOM), deterministic — unit-tested in `galaxy-metaball.test.ts`.
 */

export type Circle = { cx: number; cy: number; r: number }

export type MetaballOpts = {
  /** Bezier handle length as a multiple of the neck scale. Default 2.4. */
  handleLenRate?: number
  /** Neck spread: how concave/wide the bridge is, 0..1. Default 0.5. */
  spread?: number
  /** Max centre distance that still grows a neck, as a multiple of `min(r1,r2)`
   *  ADDED to (r1+r2). Beyond it the two circles render separate. Default 1. */
  reach?: number
}

const TAU = Math.PI * 2
const HALF_PI = Math.PI / 2

const vec = (a: number): { x: number; y: number } => ({ x: Math.cos(a), y: Math.sin(a) })
const num = (x: number): string => (Number.isFinite(x) ? String(Math.round(x * 1000) / 1000) : '0')
const pt = (p: { x: number; y: number }): string => `${num(p.x)},${num(p.y)}`

/** The four rim points + their absolute bezier control points for the neck a→b. */
export type Connector = {
  p1a: { x: number; y: number }
  p1b: { x: number; y: number }
  p2a: { x: number; y: number }
  p2b: { x: number; y: number }
  /** Absolute control points (already offset from their anchor). */
  c1: { x: number; y: number } // out of p1a
  c2: { x: number; y: number } // into p2a
  c3: { x: number; y: number } // out of p2b
  c4: { x: number; y: number } // into p1b
}

/**
 * Geometry of the neck bridging circle `a` to circle `b`. Returns `null` when no
 * neck should be drawn: one circle contains the other (`d ≤ |r1−r2|`), they are
 * too far apart (`d ≥ r1+r2+reach·min(r)`), or a radius is non-positive.
 */
export function connectorGeometry(a: Circle, b: Circle, opts: MetaballOpts = {}): Connector | null {
  const r1 = a.r
  const r2 = b.r
  if (!(r1 > 0) || !(r2 > 0)) return null

  const handleLenRate = opts.handleLenRate ?? 2.4
  const v = opts.spread ?? 0.5
  const reach = opts.reach ?? 1

  const c1 = { x: a.cx, y: a.cy }
  const c2 = { x: b.cx, y: b.cy }
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y)

  if (d <= Math.abs(r1 - r2)) return null // containment → just the bigger circle
  const maxDistance = r1 + r2 + reach * Math.min(r1, r2)
  if (d >= maxDistance) return null // too far → separate circles, no neck

  // Tangent half-angles where the neck attaches (overlapping → >0, else 0).
  let u1 = 0
  let u2 = 0
  if (d < r1 + r2) {
    u1 = Math.acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d))
    u2 = Math.acos((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d))
  }

  const base = Math.atan2(c2.y - c1.y, c2.x - c1.x)
  const maxSpread = Math.acos((r1 - r2) / d)

  const angle1a = base + u1 + (maxSpread - u1) * v
  const angle1b = base - u1 - (maxSpread - u1) * v
  const angle2a = base + Math.PI - u2 - (Math.PI - u2 - maxSpread) * v
  const angle2b = base - Math.PI + u2 + (Math.PI - u2 - maxSpread) * v

  const onRim = (c: { x: number; y: number }, ang: number, r: number) => ({
    x: c.x + Math.cos(ang) * r,
    y: c.y + Math.sin(ang) * r,
  })
  const p1a = onRim(c1, angle1a, r1)
  const p1b = onRim(c1, angle1b, r1)
  const p2a = onRim(c2, angle2a, r2)
  const p2b = onRim(c2, angle2b, r2)

  // Handle length from the span of the neck, damped while circles still overlap.
  const totalRadius = r1 + r2
  let d2 = Math.min(v * handleLenRate, Math.hypot(p1a.x - p2a.x, p1a.y - p2a.y) / totalRadius)
  d2 *= Math.min(1, (d * 2) / totalRadius)
  const h1 = r1 * d2
  const h2 = r2 * d2

  const add = (p: { x: number; y: number }, hv: { x: number; y: number }, len: number) => ({
    x: p.x + hv.x * len,
    y: p.y + hv.y * len,
  })

  return {
    p1a,
    p1b,
    p2a,
    p2b,
    c1: add(p1a, vec(angle1a - HALF_PI), h1),
    c2: add(p2a, vec(angle2a + HALF_PI), h2),
    c3: add(p2b, vec(angle2b - HALF_PI), h2),
    c4: add(p1b, vec(angle1b + HALF_PI), h1),
  }
}

/** SVG path `d` for the neck a→b, or `null` if no neck (see `connectorGeometry`). */
export function connector(a: Circle, b: Circle, opts?: MetaballOpts): string | null {
  const g = connectorGeometry(a, b, opts)
  if (!g) return null
  // p1a ─(bezier)→ p2a ─(line)→ p2b ─(bezier)→ p1b ─(close, line)→ p1a
  return `M ${pt(g.p1a)} C ${pt(g.c1)} ${pt(g.c2)} ${pt(g.p2a)} L ${pt(g.p2b)} C ${pt(g.c3)} ${pt(g.c4)} ${pt(g.p1b)} Z`
}

/** A full circle as an SVG subpath (two semicircle arcs). */
export function circlePath(c: Circle): string {
  const { cx, cy, r } = c
  return `M ${num(cx - r)},${num(cy)} A ${num(r)},${num(r)} 0 1 0 ${num(cx + r)},${num(cy)} A ${num(r)},${num(r)} 0 1 0 ${num(cx - r)},${num(cy)} Z`
}

/**
 * One SVG path for the smooth union of `circles`. The largest-radius circle is the
 * anchor (hub); every other circle gets a neck to it (star topology — robust as the
 * core grows). All circles + necks are concatenated into a single `d`; render with
 * `fill-rule: nonzero` so the overlaps read as one fused blob.
 */
export function metaballPath(circles: ReadonlyArray<Circle>, opts?: MetaballOpts): string {
  const valid = circles.filter((c) => c.r > 0)
  if (valid.length === 0) return ''
  if (valid.length === 1) return circlePath(valid[0])

  let anchorIdx = 0
  for (let i = 1; i < valid.length; i++) if (valid[i].r > valid[anchorIdx].r) anchorIdx = i
  const anchor = valid[anchorIdx]

  const subpaths: string[] = valid.map(circlePath)
  for (let i = 0; i < valid.length; i++) {
    if (i === anchorIdx) continue
    const neck = connector(anchor, valid[i], opts)
    if (neck) subpaths.push(neck)
  }
  return subpaths.join(' ')
}

export { TAU }
