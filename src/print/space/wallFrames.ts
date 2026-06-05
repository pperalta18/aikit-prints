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
/** Fallback height for a wall without measured `alturaM`. */
export const FRAME_FALLBACK_HEIGHT_M = 2.5
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
  const nearHigh = Math.abs(pLow - faceHigh) <= TOUCH_TOL_M || Math.abs(pHigh - faceHigh) <= TOUCH_TOL_M
  const nearLow = Math.abs(pLow - faceLow) <= TOUCH_TOL_M || Math.abs(pHigh - faceLow) <= TOUCH_TOL_M
  if (nearHigh) return 1
  if (nearLow) return -1
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

export type WallFramesOptions = {
  /** The registry-bearing event walls to frame (both faces of each). */
  walls: Wall[]
  /** Every wall in the layout, used for abutment + nave-divisoria lookup. */
  allWalls: Wall[]
  /** Fallback height for walls without measured `alturaM` (default 2.5 m). */
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

  for (const wall of walls) {
    const invId = wall.registry?.invId
    if (invId == null) continue
    const height = heightOf(wall, fallback)
    const runC = runCenterOf(wall)
    const runStart = runC - wall.length / 2
    const runEnd = runC + wall.length / 2
    const naveSide = naveFacingSide(wall, allWalls)

    for (const side of [1, -1] as const) {
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
