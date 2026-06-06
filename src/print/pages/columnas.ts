/**
 * columnas — the layout maths behind the "two blue columns" wall (19-S-1).
 * ──────────────────────────────────────────────────────────────────────────
 * A pair (or any count) of tall, slender bands centred on a wall, each filled to
 * the **full height** with a mosaic of square brand-blue cells. There is no
 * continuous gradient and no ruling lines: every cell is a flat blue tile with its
 * own **opacity** — a good share are fully transparent (empty), the rest take a
 * random opacity in (0, 1] — so each column reads as a scattered blue tapestry.
 *
 * Three pure, render-free concerns live here (the same split the data pages use,
 * so the geometry is unit-tested, not eyeballed):
 *
 *   • `layoutColumns` — place N equal-width columns, separated by a fixed gap and
 *     centred on the wall (the group is symmetric: equal margin left/right). Tells
 *     each column's left edge in mm. Validates the group actually fits the wall.
 *   • `tickPositions` — the cell boundaries: every `origin + k·module` line that
 *     lands inside a range (k ∈ ℤ, both ends inclusive). Used for both the across-
 *     column and the floor-anchored boundaries (extended past the media so the
 *     mosaic covers the bleed), so the grid is a closed, intentional module.
 *   • `cellOpacities` — the scatter: a **deterministic** (seeded) field of per-cell
 *     opacities, a chosen fraction forced to 0 (empty) and the rest random.
 *
 * Layout units are abstract millimetres (the page passes them from `geo`); the
 * maths is scale-free. See `columnas.tsx` for the rendering.
 */

/** Inventory id of the «dos columnas» wall (19-S-1). */
export const COLUMNAS_INV_ID = 19

/* ── column placement (equal columns, fixed gap, centred group) ────────────────── */

export type ColumnsLayout = {
  /** Left edge of each column, in mm from the wall's left edge (left→right). */
  columnLeftsMm: number[]
  /** Each column's width (mm) — all equal. */
  columnWidthMm: number
  /** The air between adjacent columns (mm). */
  gapMm: number
  /** Total width the column group spans (mm): `n·w + (n−1)·gap`. */
  spanMm: number
  /** Inset of the group from each wall edge (mm) — equal both sides when centred. */
  marginMm: number
}

export type ColumnsLayoutOpts = {
  /** The wall (trim) width in mm. */
  trimWidthMm: number
  /** How many columns. Default 2. */
  count?: number
  /** Each column's width in mm. Default 1150 (1.15 m). */
  columnWidthMm?: number
  /** Air between adjacent columns in mm. Default 1000 (1 m). */
  gapMm?: number
}

/**
 * Place `count` equal-width columns across the wall, separated by `gapMm` and
 * centred as a group (equal margin on both sides). Returns each column's left
 * edge (mm, left→right) plus the group's span and margin. Deterministic. Throws
 * on a non-positive wall/width, negative gap/count, or a group that overflows the
 * wall (so a too-wide spec fails loudly instead of bleeding off both sides).
 */
export function layoutColumns(opts: ColumnsLayoutOpts): ColumnsLayout {
  const { trimWidthMm } = opts
  const count = opts.count ?? 2
  const columnWidthMm = opts.columnWidthMm ?? 1150
  const gapMm = opts.gapMm ?? 1000
  if (!(trimWidthMm > 0)) throw new Error('layoutColumns: trimWidthMm must be > 0')
  if (!Number.isInteger(count) || count < 1) throw new Error('layoutColumns: count must be a positive integer')
  if (!(columnWidthMm > 0)) throw new Error('layoutColumns: columnWidthMm must be > 0')
  if (gapMm < 0) throw new Error('layoutColumns: gapMm must be >= 0')

  const spanMm = count * columnWidthMm + (count - 1) * gapMm
  if (spanMm > trimWidthMm + 1e-6) {
    throw new Error(`layoutColumns: column group (${spanMm} mm) does not fit the wall (${trimWidthMm} mm)`)
  }
  const marginMm = (trimWidthMm - spanMm) / 2
  const columnLeftsMm = Array.from({ length: count }, (_, i) => marginMm + i * (columnWidthMm + gapMm))

  return { columnLeftsMm, columnWidthMm, gapMm, spanMm, marginMm }
}

/* ── cell boundaries (closed module, both ends inclusive) ──────────────────────── */

export type TickOpts = {
  /** A position the ruling is anchored to (mm) — a boundary always lands here. */
  originMm: number
  /** Spacing between adjacent boundaries (mm). */
  moduleMm: number
  /** Lowest position to emit (mm, inclusive). */
  minMm: number
  /** Highest position to emit (mm, inclusive). */
  maxMm: number
}

/**
 * Every `origin + k·module` boundary (k ∈ ℤ) that lands inside `[min, max]`,
 * ascending. Both ends are inclusive (a boundary exactly on an edge is kept), so a
 * range that is a whole multiple of the module yields a closed grid. Lets the
 * grid be anchored to a meaningful datum (e.g. the floor) yet extend past the
 * media in either direction (so the mosaic covers the bleed). Deterministic.
 * Throws on a non-positive module or an inverted range.
 */
export function tickPositions(opts: TickOpts): number[] {
  const { originMm, moduleMm, minMm, maxMm } = opts
  if (!(moduleMm > 0)) throw new Error('tickPositions: moduleMm must be > 0')
  if (minMm > maxMm + 1e-9) throw new Error('tickPositions: minMm must be <= maxMm')
  const eps = 1e-6
  const kStart = Math.ceil((minMm - originMm) / moduleMm - eps)
  const kEnd = Math.floor((maxMm - originMm) / moduleMm + eps)
  const out: number[] = []
  for (let k = kStart; k <= kEnd; k++) out.push(originMm + k * moduleMm)
  return out
}

/* ── per-cell opacity field (a scattered mosaic, deterministic) ───────────────── */

/** A small, fast, deterministic PRNG (mulberry32) — same seed ⇒ same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type CellOpacityOpts = {
  /** How many cells to fill (e.g. cols × rows). */
  count: number
  /** PRNG seed — change it to reshuffle the pattern; same seed ⇒ same field. Default 1. */
  seed?: number
  /** Fraction of cells forced fully transparent (opacity 0). Default 0.5. */
  emptyFrac?: number
  /** Lowest opacity a *non-empty* cell may take. Default 0.1. */
  minOpacity?: number
  /** Highest opacity a non-empty cell may take. Default 1. */
  maxOpacity?: number
}

/**
 * A deterministic field of per-cell opacities for the mosaic columns: a chosen
 * share of cells (`emptyFrac`) is forced fully transparent (0), and the rest take
 * a **random** opacity in `[minOpacity, maxOpacity]`. Seeded (mulberry32) so the
 * preview, the export and the PDF are pixel-identical — and a new `seed`
 * reshuffles the scatter. Two independent draws per cell (empty-gate, then level)
 * keep the empty share and the opacity distribution uncorrelated. Throws on a bad
 * count, an `emptyFrac` outside [0, 1], or an inverted/out-of-range opacity range.
 */
export function cellOpacities(opts: CellOpacityOpts): number[] {
  const { count } = opts
  const seed = opts.seed ?? 1
  const emptyFrac = opts.emptyFrac ?? 0.5
  const minOpacity = opts.minOpacity ?? 0.1
  const maxOpacity = opts.maxOpacity ?? 1
  if (!Number.isInteger(count) || count < 0) throw new Error('cellOpacities: count must be a non-negative integer')
  if (!(emptyFrac >= 0 && emptyFrac <= 1)) throw new Error('cellOpacities: emptyFrac must be in [0, 1]')
  if (!(minOpacity >= 0 && maxOpacity <= 1 && minOpacity <= maxOpacity)) {
    throw new Error('cellOpacities: require 0 <= minOpacity <= maxOpacity <= 1')
  }
  const rnd = mulberry32(seed)
  const span = maxOpacity - minOpacity
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const gate = rnd() // empty vs filled
    const level = rnd() // opacity level when filled
    out.push(gate < emptyFrac ? 0 : minOpacity + level * span)
  }
  return out
}
