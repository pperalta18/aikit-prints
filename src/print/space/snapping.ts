/**
 * snapping — Figma-style alignment snapping + distance guides for the event-space
 * editor. Pure geometry over axis-aligned footprints on the floor plane (metres,
 * world frame: cx/cz = centre, sx/sz = full extents). Used while dragging furniture
 * or walls: the dragged box snaps when one of its edges/centre lines up with another
 * element's edge/centre (or a room wall, or the grid), and we report the alignment
 * lines + the edge-to-edge gap to the nearest neighbour on each axis so the operator
 * sees exactly how far the piece sits from the others.
 *
 * Rotated furniture is treated as its un-rotated AABB (sx×sz) — fine for the 0/90°
 * placements used here; an obliquely rotated piece snaps by its bounding box.
 */

export type Box = { cx: number; cz: number; sx: number; sz: number }

/** An alignment line that lit up: a constant-`at` line on `axis`, spanning [min,max]
 *  on the other axis (enough to visually connect the dragged box to its match). */
export type AlignGuide = { axis: 'x' | 'z'; at: number; min: number; max: number }

/** A measured gap: along `axis` from `a`→`b` (so dist = |b−a|), drawn at `along` on
 *  the perpendicular axis. */
export type MeasureGuide = { axis: 'x' | 'z'; along: number; a: number; b: number; dist: number }

export type SnapResult = { cx: number; cz: number; aligns: AlignGuide[]; measures: MeasureGuide[] }

export type SnapOptions = {
  moving: { sx: number; sz: number }
  cx: number
  cz: number
  others: Box[]
  room: { width: number; depth: number }
  /** Snap radius in metres (edge/centre lines within this distance pull). Default 0.3. */
  threshold?: number
  /** Optional grid step (metres) used only when nothing else aligns. */
  grid?: number
}

const EPS = 1e-4

// left, centre, right (X) / near, centre, far (Z)
const edgesX = (b: Box) => [b.cx - b.sx / 2, b.cx, b.cx + b.sx / 2]
const edgesZ = (b: Box) => [b.cz - b.sz / 2, b.cz, b.cz + b.sz / 2]
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0)

type Target = { at: number; src: Box | null }
type Best = { delta: number; at: number; src: Box | null }

/** Best snap of the three moving anchors to any target line, within `thr`. */
function bestSnap(anchors: number[], targets: Target[], thr: number): Best | null {
  let best: Best | null = null
  for (const a of anchors) {
    for (const t of targets) {
      const d = t.at - a
      if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.delta))) {
        best = { delta: d, at: t.at, src: t.src }
      }
    }
  }
  return best
}

export function snapMove(opts: SnapOptions): SnapResult {
  const thr = opts.threshold ?? 0.3
  const gridThr = Math.min(thr, 0.12)
  const { sx, sz } = opts.moving
  const halfW = opts.room.width / 2
  const halfD = opts.room.depth / 2
  let cx = opts.cx
  let cz = opts.cz

  // ── X axis ──────────────────────────────────────────────────────────────────
  const targX: Target[] = []
  for (const o of opts.others) for (const e of edgesX(o)) targX.push({ at: e, src: o })
  targX.push({ at: -halfW, src: null }, { at: 0, src: null }, { at: halfW, src: null })
  const bestX = bestSnap([cx - sx / 2, cx, cx + sx / 2], targX, thr)
  if (bestX) cx += bestX.delta
  else if (opts.grid) {
    const g = Math.round(cx / opts.grid) * opts.grid
    if (Math.abs(g - cx) <= gridThr) cx = g
  }

  // ── Z axis ──────────────────────────────────────────────────────────────────
  const targZ: Target[] = []
  for (const o of opts.others) for (const e of edgesZ(o)) targZ.push({ at: e, src: o })
  targZ.push({ at: -halfD, src: null }, { at: 0, src: null }, { at: halfD, src: null })
  const bestZ = bestSnap([cz - sz / 2, cz, cz + sz / 2], targZ, thr)
  if (bestZ) cz += bestZ.delta
  else if (opts.grid) {
    const g = Math.round(cz / opts.grid) * opts.grid
    if (Math.abs(g - cz) <= gridThr) cz = g
  }

  const m: Box = { cx, cz, sx, sz }

  // ── alignment guide lines ─────────────────────────────────────────────────────
  const aligns: AlignGuide[] = []
  if (bestX) {
    const s = bestX.src
    aligns.push(
      s
        ? { axis: 'x', at: bestX.at, min: Math.min(m.cz - sz / 2, s.cz - s.sz / 2), max: Math.max(m.cz + sz / 2, s.cz + s.sz / 2) }
        : { axis: 'x', at: bestX.at, min: -halfD, max: halfD },
    )
  }
  if (bestZ) {
    const s = bestZ.src
    aligns.push(
      s
        ? { axis: 'z', at: bestZ.at, min: Math.min(m.cx - sx / 2, s.cx - s.sx / 2), max: Math.max(m.cx + sx / 2, s.cx + s.sx / 2) }
        : { axis: 'z', at: bestZ.at, min: -halfW, max: halfW },
    )
  }

  // ── distance to the nearest neighbour on each axis (edge-to-edge gap) ──────────
  const measures: MeasureGuide[] = []
  const mL = m.cx - sx / 2, mR = m.cx + sx / 2, mN = m.cz - sz / 2, mF = m.cz + sz / 2

  // X gap: neighbours overlapping in Z, sitting clear to the left or right.
  let nx: MeasureGuide | null = null
  for (const o of opts.others) {
    if (overlap(mN, mF, o.cz - o.sz / 2, o.cz + o.sz / 2) <= EPS) continue
    const oL = o.cx - o.sx / 2, oR = o.cx + o.sx / 2
    let a: number, b: number
    if (oR <= mL + EPS) { a = oR; b = mL } else if (mR <= oL + EPS) { a = mR; b = oL } else continue
    const dist = Math.abs(b - a)
    if (dist <= EPS) continue
    const along = (Math.max(mN, o.cz - o.sz / 2) + Math.min(mF, o.cz + o.sz / 2)) / 2
    if (!nx || dist < nx.dist) nx = { axis: 'x', along, a, b, dist }
  }
  if (nx) measures.push(nx)

  // Z gap: neighbours overlapping in X, sitting clear nearer or farther.
  let nz: MeasureGuide | null = null
  for (const o of opts.others) {
    if (overlap(mL, mR, o.cx - o.sx / 2, o.cx + o.sx / 2) <= EPS) continue
    const oN = o.cz - o.sz / 2, oF = o.cz + o.sz / 2
    let a: number, b: number
    if (oF <= mN + EPS) { a = oF; b = mN } else if (mF <= oN + EPS) { a = mF; b = oN } else continue
    const dist = Math.abs(b - a)
    if (dist <= EPS) continue
    const along = (Math.max(mL, o.cx - o.sx / 2) + Math.min(mR, o.cx + o.sx / 2)) / 2
    if (!nz || dist < nz.dist) nz = { axis: 'z', along, a, b, dist }
  }
  if (nz) measures.push(nz)

  return { cx, cz, aligns, measures }
}

/** Format a metre distance for a guide label (cm under a metre). */
export function fmtGap(m: number): string {
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`
}
