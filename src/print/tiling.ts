import { mmToPx } from './geometry.ts'

/**
 * Print tiling
 * ────────────
 * Wall graphics at real size are huge — the AiKit Live perimeter walls run 22.5 m
 * (hero, wall-2) and 28.5 m (Naranja Mecánica, wall-4). No press makes a single
 * 28 m image, and no raster pipeline renders one either, so each wall is produced
 * as a row (or grid) of **printable panels** that the installer overlaps on the
 * wall. This module is the pure geometry of that split — JSX-free and DOM-free so
 * it unit-tests in the node project (same split as `geometry`/`dataviz-scales`).
 * The side-effecting slice/recompose lives in `scripts/tile-print.mjs`.
 *
 * Model (one axis):
 *   • `maxPanelMm` — the largest panel the press can output on this axis (the
 *     usable roll width, or a sheet limit). A panel never exceeds it.
 *   • `overlapMm`  — the image strip adjacent panels SHARE (the *solape*). The
 *     installer laps one panel over the next by this much, so a seam never shows a
 *     gap. Overlap is the interior bleed; the outer media bleed is untouched.
 *
 * Panels are equal-width with equal overlap (a press- and installer-friendly split,
 * not "all max-width with a runt last panel"). The number of panels is the minimum
 * that covers the axis with every panel within `maxPanelMm`:
 *
 *   n      = ceil((length − overlap) / (maxPanel − overlap))      (1 if length ≤ maxPanel)
 *   panel  = (length + (n−1)·overlap) / n      (≤ maxPanel by construction)
 *   step   = panel − overlap                   (how far each panel advances)
 *
 * The union of panels covers exactly [0, length]: panel 0 starts at 0 and panel
 * n−1 ends at `length`, with consecutive panels overlapping by `overlapMm`.
 */

/** A panel span on one axis, in millimetres. `[start, end]` within `[0, length]`. */
export type AxisPanel = { start: number; end: number }

const round2 = (v: number) => Math.round(v * 100) / 100

function assertPositive(name: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} must be a positive number (got ${v})`)
}

/**
 * Divide one axis of `lengthMm` into overlapping panels, each ≤ `maxPanelMm`,
 * sharing `overlapMm`. Returns equal-width panels covering exactly `[0, lengthMm]`.
 * A non-finite `maxPanelMm` (Infinity) or `lengthMm ≤ maxPanelMm` yields a single
 * full-length panel (and overlap is then irrelevant).
 */
export function divideAxis(lengthMm: number, maxPanelMm: number, overlapMm = 0): AxisPanel[] {
  assertPositive('lengthMm', lengthMm)
  if (overlapMm < 0 || !Number.isFinite(overlapMm)) {
    throw new Error(`overlapMm must be ≥ 0 and finite (got ${overlapMm})`)
  }
  // No cap on this axis, or it already fits: a single panel, no seam.
  if (!Number.isFinite(maxPanelMm) || lengthMm <= maxPanelMm) {
    return [{ start: 0, end: lengthMm }]
  }
  assertPositive('maxPanelMm', maxPanelMm)
  if (overlapMm >= maxPanelMm) {
    throw new Error(`overlapMm (${overlapMm}) must be < maxPanelMm (${maxPanelMm}) so panels advance`)
  }

  const n = Math.max(1, Math.ceil((lengthMm - overlapMm) / (maxPanelMm - overlapMm)))
  const panel = (lengthMm + (n - 1) * overlapMm) / n
  const step = panel - overlapMm

  const panels: AxisPanel[] = []
  for (let i = 0; i < n; i++) {
    const start = i === 0 ? 0 : i * step
    const end = i === n - 1 ? lengthMm : i * step + panel
    panels.push({ start, end })
  }
  return panels
}

/** How many panels one axis needs (without computing the spans). */
export function panelCount(lengthMm: number, maxPanelMm: number, overlapMm = 0): number {
  return divideAxis(lengthMm, maxPanelMm, overlapMm).length
}

export type TilingInput = {
  /** Full media width incl. outer bleed, in mm (the doc's `mediaSizeMm`). */
  mediaWidthMm: number
  /** Full media height incl. outer bleed, in mm. */
  mediaHeightMm: number
  /** Render DPI of the raster being sliced (the doc's `dpi`). */
  dpi: number
  /** Max printable panel width (X axis), in mm. */
  maxPanelWidthMm: number
  /** Max printable panel height (Y axis), in mm. Omit/Infinity → a single row. */
  maxPanelHeightMm?: number
  /** Shared overlap strip between adjacent panels, in mm. Default 0. */
  overlapMm?: number
}

/** One output panel: its physical size (mm) and its crop rect in device px. */
export type Tile = {
  /** 1-based panel number, row-major — the `_tileN` suffix index. */
  index: number
  /** 0-based column / row in the panel grid. */
  col: number
  row: number
  /** Naming suffix, e.g. `_tile3` (append to the base file name before the ext). */
  suffix: string
  /** Physical panel size in mm (what the press cuts; includes overlap). */
  widthMm: number
  heightMm: number
  /** Crop rectangle in device px at `dpi` — ImageMagick `-crop WxH+X+Y`. */
  xPx: number
  yPx: number
  widthPx: number
  heightPx: number
}

export type TilePlan = {
  cols: number
  rows: number
  count: number
  /** Source media size in px (the crops tile exactly over this). */
  mediaWidthPx: number
  mediaHeightPx: number
  overlapMm: number
  overlapPx: number
  /** False when the media fits in a single panel (1×1) — nothing to slice. */
  tiled: boolean
  tiles: Tile[]
}

/**
 * Plan the panel grid for a media of `mediaWidthMm × mediaHeightMm` at `dpi`.
 * Crop rects are derived from the rounded px positions of the panel edges and
 * pinned at the media borders (first tile starts at 0, last ends at the media px),
 * so the union of crops is exactly the source raster — the slice is lossless.
 */
export function planTiles(input: TilingInput): TilePlan {
  const { mediaWidthMm, mediaHeightMm, dpi } = input
  assertPositive('mediaWidthMm', mediaWidthMm)
  assertPositive('mediaHeightMm', mediaHeightMm)
  assertPositive('dpi', dpi)

  const maxW = input.maxPanelWidthMm
  const maxH = input.maxPanelHeightMm ?? Infinity
  const overlapMm = input.overlapMm ?? 0

  const colPanels = divideAxis(mediaWidthMm, maxW, overlapMm)
  const rowPanels = divideAxis(mediaHeightMm, maxH, overlapMm)
  const cols = colPanels.length
  const rows = rowPanels.length

  const mediaWidthPx = mmToPx(mediaWidthMm, dpi)
  const mediaHeightPx = mmToPx(mediaHeightMm, dpi)

  const tiles: Tile[] = []
  let index = 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Crop edges from the rounded mm positions, but pin the media borders (left
      // col starts at 0, last col ends at the media px; same for rows). Pinning
      // guarantees the union of crops is exactly the source raster despite the
      // independent rounding of interior edges. The overlap strip is preserved
      // because a panel's `end` sits past the next panel's `start`.
      const xPx = c === 0 ? 0 : mmToPx(colPanels[c].start, dpi)
      const x2Px = c === cols - 1 ? mediaWidthPx : mmToPx(colPanels[c].end, dpi)
      const yPx = r === 0 ? 0 : mmToPx(rowPanels[r].start, dpi)
      const y2Px = r === rows - 1 ? mediaHeightPx : mmToPx(rowPanels[r].end, dpi)
      tiles.push({
        index,
        col: c,
        row: r,
        suffix: `_tile${index}`,
        widthMm: round2(colPanels[c].end - colPanels[c].start),
        heightMm: round2(rowPanels[r].end - rowPanels[r].start),
        xPx,
        yPx,
        widthPx: x2Px - xPx,
        heightPx: y2Px - yPx,
      })
      index++
    }
  }

  return {
    cols,
    rows,
    count: cols * rows,
    mediaWidthPx,
    mediaHeightPx,
    overlapMm,
    overlapPx: mmToPx(overlapMm, dpi),
    tiled: cols * rows > 1,
    tiles,
  }
}

/** Insert a `_tileN` suffix before a file's extension: `wall.png` → `wall_tile3.png`. */
export function tileName(fileName: string, index: number): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return `${fileName}_tile${index}`
  return `${fileName.slice(0, dot)}_tile${index}${fileName.slice(dot)}`
}

/**
 * Which sides of a panel sit on the master media's outer border (so they carry the
 * outer bleed) vs. are interior lap seams. Feeds `panelPdfBoxesPt` so each tile's
 * PDF TrimBox marks the finished wall edge only where the panel meets the media
 * edge. Note `row 0` is the *top* of the raster.
 */
export function panelEdges(tile: Pick<Tile, 'col' | 'row'>, cols: number, rows: number): { left: boolean; right: boolean; top: boolean; bottom: boolean } {
  return {
    left: tile.col === 0,
    right: tile.col === cols - 1,
    top: tile.row === 0,
    bottom: tile.row === rows - 1,
  }
}
