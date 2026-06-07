import type { Wall } from './eventLayout'

/**
 * Wall frames — one blank canvas per wall face, split where walls cut it
 * ──────────────────────────────────────────────────────────────────────
 * The venue's base layer: **every wall face wears an empty white frame**, sized
 * to the real wall, so the operator sees the whole space papered with blank
 * placeholders before any art exists. A long wall is **not** one frame — it is
 * cut wherever another wall meets that face, so the operator gets the real,
 * separately-printable panels (e.g. wall 9 is split by wall 18 into `9-E-1` and
 * `9-E-2`). Both faces of every wall are framed independently, because the two
 * faces look onto different rooms and carry different art.
 *
 * Two cut sources, both derived from the committed geometry (never hand-baked):
 *   1. **Abutment** — a perpendicular wall whose *end touches a face* cuts that
 *      face at the touch point (wall 18 → wall 9; wall 10 → wall 2's S1 face; …).
 *   2. **Nave zone projection** — in the central showroom the two free-standing
 *      divisorias (12, 16) divide the nave into the three cámaras (IMAGE ·
 *      TEXT+CODE · INVERSIÓN). They don't physically touch the side walls (2, 11),
 *      so their positions are *projected* onto the nave-facing face of each side
 *      wall, cutting it into the three camera bays.
 *
 * Pure + self-contained: it takes plain `Wall` data in (no module-level layout, no
 * JSON import), so it unit-tests in the node `unit` project *and* is importable by
 * the plain-node frame generator (`scripts/generate-frames.mjs`) — same geometry
 * in, same frames out. `EventSpaceScene` owns the three.js wiring (`<WallFrames>`).
 */

/** Inventory ids of the two nave side walls and the divisorias that zone them. */
export const NAVE_SIDE_INV_IDS = [2, 11] as const
export const NAVE_DIVISORIA_INV_IDS = [12, 16] as const
/** The three nave cámaras in walk order (low → high along the run axis). */
export const NAVE_ZONE_ORDER = ['IMAGE', 'TEXT+CODE', 'INVERSIÓN'] as const

/** Cuts within this of a wall end are ignored — a corner abutment isn't a divider. */
export const FRAME_END_MARGIN_M = 0.4
/** Segments shorter than this are dropped (float slivers at junctions). */
export const FRAME_MIN_SEGMENT_M = 0.3
/** Fallback height for a wall without measured `alturaM` (venue walls are 3 m). */
export const FRAME_FALLBACK_HEIGHT_M = 3.0
/** How close two coordinates must be to count as touching / coincident (m). */
const TOUCH_TOL_M = 0.05

/** One blank frame: a full-height white panel covering a slice of one wall face. */
export type WallFrame = {
  /** Stable, human id, e.g. `9-E-1`, `2-W-1`, `11-W-IMAGE`. */
  id: string
  /** Inventory id of the host wall (1..21). */
  invId: number
  /** Host wall id (`wall-N`). */
  wallId: string
  /** Which face it covers (+1 / −1 along the wall's normal axis). */
  side: 1 | -1
  /** Short HUD label, e.g. `#9·E 1/2`. */
  label: string
  /** Centre along the wall's run axis, world coord (drops into `Placement.along`). */
  alongCenter: number
  /** Frame width along the run (m) = the segment length. */
  widthM: number
  /** Frame height (m) = the wall height. */
  heightM: number
  /** Nave camera name when this frame is one of the three nave bays. */
  zone?: string
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4

/** Coordinate of a point along `wall`'s RUN axis (the axis a print slides on). */
function runValueOf(wall: Wall, point: { cx: number; cz: number }): number {
  return wall.normalAxis === 'x' ? point.cz : point.cx
}

/** Coordinate of a point along `wall`'s NORMAL axis (the axis its faces straddle). */
function normalValueOf(wall: Wall, point: { cx: number; cz: number }): number {
  return wall.normalAxis === 'x' ? point.cx : point.cz
}

/** Run-axis centre of a wall (the floor coordinate a print's `along` slides on). */
function runCenterOf(wall: Wall): number {
  return runValueOf(wall, { cx: wall.cx, cz: wall.cz })
}

/** Height to render a wall at: its measured `alturaM`, else `fallback`. */
function heightOf(wall: Wall, fallback: number): number {
  return wall.hasExplicitHeight ? wall.height : fallback
}

/** Which face of `wall` (+1 / −1) points toward a reference floor point. */
function faceTowardPoint(wall: Wall, ref: { cx: number; cz: number }): 1 | -1 {
  return normalValueOf(wall, ref) >= normalValueOf(wall, { cx: wall.cx, cz: wall.cz }) ? 1 : -1
}

/** First wall with the given inventory id, or undefined. */
function byInv(walls: Wall[], invId: number): Wall | undefined {
  return walls.find((w) => w.registry?.invId === invId)
}

/**
 * Which face of `host` a perpendicular wall `p` touches, or `null` if it touches
 * neither (it doesn't reach the wall). `p` runs along `host`'s normal axis; we
 * check whether either end of `p`'s run reaches one of `host`'s two faces.
 */
function touchedFace(host: Wall, p: Wall): 1 | -1 | null {
  const nc = normalValueOf(host, { cx: host.cx, cz: host.cz })
  const faceHigh = nc + host.thickness / 2 // side +1
  const faceLow = nc - host.thickness / 2 // side −1
  const pCenter = normalValueOf(host, { cx: p.cx, cz: p.cz })
  const pLow = pCenter - p.length / 2
  const pHigh = pCenter + p.length / 2
  // Penetration-aware: `p` touches a face when its run-span *reaches* that face —
  // flush (an end at the face) OR penetrated past it. This matters because the venue
  // is drawn at the planner's thin-wall centreline but rendered at the true 0.5 m
  // depth, so a wall drawn flush ends up a fraction inside the thicker face; a simple
  // "end within tolerance of the face" test would miss it (the end is now *past* the
  // face, not near it) and the face would wrongly collapse to a single panel. A wall
  // that genuinely stops short of the face still doesn't reach it, so no spurious cut.
  const touchesHigh = pLow <= faceHigh + TOUCH_TOL_M && pHigh >= faceHigh - TOUCH_TOL_M
  const touchesLow = pLow <= faceLow + TOUCH_TOL_M && pHigh >= faceLow - TOUCH_TOL_M
  if (touchesHigh) return 1
  if (touchesLow) return -1
  return null
}

/** Nave-facing side of a nave side wall (2 → toward 11, 11 → toward 2), or null. */
function naveFacingSide(wall: Wall, allWalls: Wall[]): 1 | -1 | null {
  const invId = wall.registry?.invId
  if (invId !== 2 && invId !== 11) return null
  const opposite = byInv(allWalls, invId === 2 ? 11 : 2)
  if (!opposite) return invId === 2 ? 1 : -1
  return faceTowardPoint(wall, { cx: opposite.cx, cz: opposite.cz })
}

/** Run-axis positions of the divisorias projected onto a nave side wall, sorted. */
function naveProjectionCuts(wall: Wall, allWalls: Wall[]): number[] {
  return NAVE_DIVISORIA_INV_IDS.map((id) => byInv(allWalls, id))
    .filter((d): d is Wall => !!d)
    .map((d) => runValueOf(wall, { cx: d.cx, cz: d.cz }))
    .sort((a, b) => a - b)
}

/** Sort + drop duplicate cut coordinates (closer than `FRAME_MIN_SEGMENT_M`). */
function dedupeCuts(cuts: number[]): number[] {
  const sorted = [...cuts].sort((a, b) => a - b)
  const out: number[] = []
  for (const c of sorted) {
    if (out.length === 0 || c - out[out.length - 1] >= FRAME_MIN_SEGMENT_M) out.push(c)
  }
  return out
}

/** Face tag for an id/label: vertical walls → E/W, horizontal walls → N/S. */
function sideTag(wall: Wall, side: 1 | -1): string {
  if (wall.normalAxis === 'x') return side > 0 ? 'E' : 'W'
  return side > 0 ? 'S' : 'N'
}

/** Largest AABB side (m) a 4-wall cluster may span to count as a display *box*. */
const BOX_MAX_SPAN_M = 6

/** A free-standing display box (e.g. the central cube): its member walls + outer AABB. */
type WallBox = {
  wallIds: Set<string>
  xRange: [number, number]
  zRange: [number, number]
}

/** Footprint AABB of a wall in world coords (true 0.5 m depth). */
function footprint(w: Wall): { x0: number; x1: number; z0: number; z1: number } {
  return { x0: w.cx - w.sx / 2, x1: w.cx + w.sx / 2, z0: w.cz - w.sz / 2, z1: w.cz + w.sz / 2 }
}

/** Perpendicular walls whose footprints meet at a corner (overlap/touch on both axes). */
function cornerLinked(a: Wall, b: Wall): boolean {
  if (a.normalAxis === b.normalAxis) return false
  const A = footprint(a)
  const B = footprint(b)
  const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)
  const oz = Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0)
  return ox > -TOUCH_TOL_M && oz > -TOUCH_TOL_M
}

/**
 * Detect free-standing display *boxes* — the central exhibition cube: a closed ring
 * of exactly four corner-linked walls, two per orientation, within a small footprint.
 * Each *outer* face of such a box must clad its whole side (the wall length **plus the
 * neighbour's depth**) so the four prints wrap the cube edge-to-edge with no bare
 * corner return — the opposite of the T-junction inset that shrinks a normal face.
 */
function detectBoxes(walls: Wall[]): WallBox[] {
  const seen = new Set<string>()
  const boxes: WallBox[] = []
  for (const start of walls) {
    if (seen.has(start.id)) continue
    const comp: Wall[] = []
    const stack = [start]
    seen.add(start.id)
    while (stack.length) {
      const w = stack.pop() as Wall
      comp.push(w)
      for (const o of walls) {
        if (seen.has(o.id)) continue
        if (cornerLinked(w, o)) {
          seen.add(o.id)
          stack.push(o)
        }
      }
    }
    if (comp.length !== 4) continue
    const nx = comp.filter((w) => w.normalAxis === 'x').length
    if (nx !== 2) continue // 2 per orientation ⇒ a closed rectangular ring
    const xRange: [number, number] = [Math.min(...comp.map((w) => footprint(w).x0)), Math.max(...comp.map((w) => footprint(w).x1))]
    const zRange: [number, number] = [Math.min(...comp.map((w) => footprint(w).z0)), Math.max(...comp.map((w) => footprint(w).z1))]
    if (xRange[1] - xRange[0] > BOX_MAX_SPAN_M || zRange[1] - zRange[0] > BOX_MAX_SPAN_M) continue
    boxes.push({ wallIds: new Set(comp.map((w) => w.id)), xRange, zRange })
  }
  return boxes
}

/** The box a wall belongs to, or undefined. */
function boxOf(wall: Wall, boxes: WallBox[]): WallBox | undefined {
  return boxes.find((b) => b.wallIds.has(wall.id))
}

/** The outer side (+1/−1) of a box wall: the face pointing away from the box centre. */
function outerBoxSide(wall: Wall, box: WallBox): 1 | -1 {
  const range = wall.normalAxis === 'x' ? box.xRange : box.zRange
  const center = (range[0] + range[1]) / 2
  return normalValueOf(wall, { cx: wall.cx, cz: wall.cz }) >= center ? 1 : -1
}

export type WallFramesOptions = {
  /** The registry-bearing event walls to frame (both faces of each). */
  walls: Wall[]
  /** Every wall in the layout, used for abutment + nave-divisoria lookup. */
  allWalls: Wall[]
  /** Fallback height for walls without measured `alturaM` (default 3 m). */
  fallbackHeight?: number
}

/**
 * Compute every blank frame in the venue: both faces of each wall, each face cut
 * into panels where other walls meet it (plus the nave-zone projection on walls 2
 * & 11). Pure + deterministic — same geometry in, same frames out.
 */
export function computeWallFrames(opts: WallFramesOptions): WallFrame[] {
  const fallback = opts.fallbackHeight ?? FRAME_FALLBACK_HEIGHT_M
  const { walls, allWalls } = opts
  const frames: WallFrame[] = []
  const boxes = detectBoxes(walls)

  for (const wall of walls) {
    const invId = wall.registry?.invId
    if (invId == null) continue
    const height = heightOf(wall, fallback)
    const runC = runCenterOf(wall)
    const runStart = runC - wall.length / 2
    const runEnd = runC + wall.length / 2
    const naveSide = naveFacingSide(wall, allWalls)
    const box = boxOf(wall, boxes)
    const outerSide = box ? outerBoxSide(wall, box) : null

    for (const side of [1, -1] as const) {
      // Free-standing cube outer face: clad the whole side (wall + neighbour depth)
      // so the four faces wrap to the corner edges with no bare return. One panel,
      // spanning the box's outer extent on this wall's run axis.
      if (box && side === outerSide) {
        const range = wall.normalAxis === 'x' ? box.zRange : box.xRange
        const tag = sideTag(wall, side)
        frames.push({
          id: `${invId}-${tag}-1`,
          invId,
          wallId: wall.id,
          side,
          label: `#${invId}·${tag} 1/1`,
          alongCenter: round4((range[0] + range[1]) / 2),
          widthM: round4(range[1] - range[0]),
          heightM: round4(height),
        })
        continue
      }
      // 0 — corner inset: a perpendicular wall standing ON this face AND covering an
      //     END (e.g. the nave end wall over a side wall's corner) occludes that strip
      //     in 3D, so pull the framable run in to the occluder's near edge — the panel
      //     must not slide behind the corner return. (Flush corners give a 0 inset.)
      let effStart = runStart
      let effEnd = runEnd
      for (const p of allWalls) {
        if (p.id === wall.id) continue
        if (p.normalAxis === wall.normalAxis) continue
        if (touchedFace(wall, p) !== side) continue
        const at = runValueOf(wall, { cx: p.cx, cz: p.cz })
        const pLo = at - p.thickness / 2
        const pHi = at + p.thickness / 2
        if (pLo <= runStart + TOUCH_TOL_M && pHi > runStart + TOUCH_TOL_M && pHi < runEnd) effStart = Math.max(effStart, pHi)
        if (pHi >= runEnd - TOUCH_TOL_M && pLo < runEnd - TOUCH_TOL_M && pLo > runStart) effEnd = Math.min(effEnd, pLo)
      }

      // 1 — abutment cuts: perpendicular walls whose end touches THIS face.
      const cuts: number[] = []
      for (const p of allWalls) {
        if (p.id === wall.id) continue
        if (p.normalAxis === wall.normalAxis) continue // not perpendicular
        if (touchedFace(wall, p) !== side) continue
        const at = runValueOf(wall, { cx: p.cx, cz: p.cz })
        if (at > effStart + FRAME_END_MARGIN_M && at < effEnd - FRAME_END_MARGIN_M) cuts.push(at)
      }
      // 2 — nave zone projection on the nave-facing face of walls 2 & 11.
      const isNaveFace = naveSide != null && side === naveSide
      if (isNaveFace) {
        for (const at of naveProjectionCuts(wall, allWalls)) {
          if (at > effStart + FRAME_END_MARGIN_M && at < effEnd - FRAME_END_MARGIN_M) cuts.push(at)
        }
      }

      const bounds = [effStart, ...dedupeCuts(cuts), effEnd]
      const tag = sideTag(wall, side)
      const segments: { lo: number; hi: number }[] = []
      for (let i = 0; i < bounds.length - 1; i++) {
        const lo = bounds[i]
        const hi = bounds[i + 1]
        if (hi - lo >= FRAME_MIN_SEGMENT_M) segments.push({ lo, hi })
      }
      // Name the three nave bays after the cámaras (walk order = ascending run).
      const useZones = isNaveFace && segments.length === NAVE_ZONE_ORDER.length
      segments.forEach(({ lo, hi }, i) => {
        const zone = useZones ? NAVE_ZONE_ORDER[i] : undefined
        const panel = i + 1
        frames.push({
          id: `${invId}-${tag}-${zone ?? panel}`,
          invId,
          wallId: wall.id,
          side,
          label: zone ? `#${invId}·${tag} ${zone}` : `#${invId}·${tag} ${panel}/${segments.length}`,
          alongCenter: round4((lo + hi) / 2),
          widthM: round4(hi - lo),
          heightM: round4(height),
          zone,
        })
      })
    }
  }

  return frames
}
