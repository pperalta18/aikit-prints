/**
 * mosaico — a bay-packed, full-height brand mosaic for a long wall.
 * ──────────────────────────────────────────────────────────────────────────────
 * The wall is a base grid of near-square unit cells: `rows` tall (the full wall
 * height) and as many columns as fit across the width. The mosaic is laid out as a
 * left-to-right run of **bays** — each bay is one column-group, `cols` units wide,
 * filled top→bottom by a vertical **stack of slots** whose row-spans sum to the
 * grid height. Because every bay covers the full height, the wall always tiles
 * perfectly: no gaps, full height, edge to edge.
 *
 * A slot is a tile of one of three kinds — a real `image` (sized by spanning the
 * cells that best match its aspect, e.g. a 1.43∶1 landscape ≈ 3×2 units), a flat
 * `solid` brand-colour cell, or a `placeholder` standing in for imagery yet to come
 * (so a few real photos + placeholders can fill the whole wall). "No squares": a
 * tile takes *n* columns × *m* rows from the format, not a fixed 1×1.
 *
 * This module is pure geometry (no React/DOM): it derives the grid from the wall's
 * mm size and resolves a bay list into placed tiles in trim-space millimetres
 * (origin top-left). The look (seams, fills, the brand sun glyph) lives in
 * `mosaico.tsx`. First authored for wall 11-E-2 («La Naranja Mecánica», 12.25×2.5 m).
 */

export type MosaicTileKind = 'image' | 'solid' | 'placeholder'

/** One tile in a bay's vertical stack. `rows` is its height in grid units. */
export type MosaicSlot = {
  kind: MosaicTileKind
  /** Row-span (grid units). The slots of a bay sum to `grid.rows`. */
  rows: number
  /** Image key (into the page's images map) when `kind === 'image'`. */
  image?: string
  /** Flat fill (any CSS colour) when `kind === 'solid'`. */
  fill?: string
  /** Optional small label (e.g. for a placeholder). */
  label?: string
}

/** A full-height column-group: `cols` units wide, filled by a stack of slots. */
export type MosaicBay = {
  /** Column-span (grid units). */
  cols: number
  /** Top→bottom stack; row-spans should sum to `grid.rows`. */
  slots: MosaicSlot[]
}

/** The base unit grid derived from the wall: near-square cells, full-height. */
export type MosaicGrid = {
  /** Columns across the width. */
  cols: number
  /** Rows up the height. */
  rows: number
  /** Cell width (mm). */
  cellWMm: number
  /** Cell height (mm). */
  cellHMm: number
}

/** A resolved tile, placed in trim-space millimetres. */
export type PlacedMosaicTile = {
  /** Grid column it starts at (0-based, from the left). */
  col: number
  /** Grid row it starts at (0-based, from the top). */
  row: number
  /** Column-span (grid units). */
  cols: number
  /** Row-span (grid units). */
  rows: number
  /** Left edge (mm from trim origin). */
  xMm: number
  /** Top edge (mm from trim origin). */
  yMm: number
  /** Width (mm). */
  wMm: number
  /** Height (mm). */
  hMm: number
  slot: MosaicSlot
}

/**
 * Build the base grid for a wall: `rows` near-square cells tall, the most columns
 * that keep the cells near-square across the width. Cell sizes are exact divisors
 * of the wall, so the grid fills it with no remainder.
 */
export function mosaicGrid({
  widthMm,
  heightMm,
  rows,
}: {
  widthMm: number
  heightMm: number
  rows: number
}): MosaicGrid {
  const r = Math.max(1, Math.round(rows))
  const cellH = heightMm / r
  const cols = Math.max(1, Math.round(widthMm / cellH))
  return { cols, rows: r, cellWMm: widthMm / cols, cellHMm: cellH }
}

/**
 * Resolve a bay list into placed tiles. Bays are laid left→right; within a bay,
 * slots stack top→bottom. A bay (or slot) that would overflow the grid is clipped
 * to the wall, so the result never escapes the trim. Deterministic.
 */
export function packBays(bays: MosaicBay[], grid: MosaicGrid): PlacedMosaicTile[] {
  const tiles: PlacedMosaicTile[] = []
  let col = 0
  for (const bay of bays) {
    if (col >= grid.cols) break
    const cols = Math.min(Math.max(1, Math.round(bay.cols)), grid.cols - col)
    let row = 0
    for (const slot of bay.slots) {
      if (row >= grid.rows) break
      const rows = Math.min(Math.max(1, Math.round(slot.rows)), grid.rows - row)
      tiles.push({
        col,
        row,
        cols,
        rows,
        xMm: col * grid.cellWMm,
        yMm: row * grid.cellHMm,
        wMm: cols * grid.cellWMm,
        hMm: rows * grid.cellHMm,
        slot,
      })
      row += rows
    }
    col += cols
  }
  return tiles
}

/** Total columns a bay list occupies (clamped per bay like `packBays`). */
export function baysWidth(bays: MosaicBay[]): number {
  return bays.reduce((sum, b) => sum + Math.max(1, Math.round(b.cols)), 0)
}

/**
 * Top up a bay list with filler bays until it spans exactly `grid.cols`, so the
 * wall is always full even when the authored content is narrower than the wall
 * (e.g. once more real images are added, drop them in and the fillers shrink). The
 * `fillerFor(index, cols, rows)` factory builds each filler bay (solid / placeholder
 * rhythm). No-op when the content already fills (or overflows) the wall.
 */
export function fillBays(
  bays: MosaicBay[],
  grid: MosaicGrid,
  fillerFor: (index: number, cols: number, rows: number) => MosaicBay,
  fillerWidths: number[] = [2, 3, 2],
): MosaicBay[] {
  let remaining = grid.cols - baysWidth(bays)
  if (remaining <= 0) return bays
  const widths = fillerWidths.length ? fillerWidths : [2]
  const out = [...bays]
  let i = 0
  while (remaining > 0) {
    const w = Math.min(remaining, Math.max(1, Math.round(widths[i % widths.length])))
    out.push(fillerFor(i, w, grid.rows))
    remaining -= w
    i++
  }
  return out
}
