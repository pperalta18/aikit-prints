/**
 * banda — the layout maths behind the «friso continuo» horizontal band.
 * ──────────────────────────────────────────────────────────────────────────
 * A single horizontal stripe of the same scattered brand-blue mosaic the
 * `columnas` wall uses, but laid as one **continuous frieze that wraps the
 * showroom's TV-alcove walls** (inv 16 + 27–31). On every wall the band sits at
 * the same height (its top a fixed distance from the wall top) and the same
 * thickness, and — crucially — its cells are anchored to a **global world
 * coordinate**, not to the print's own left edge. So two faces that are
 * collinear in the venue (e.g. 16-N-1's west end meets 30-N-1's east end at the
 * same world-X) paint the *same* cells at the join: the mosaic flows across the
 * seam instead of restarting per panel.
 *
 * Three pure, render-free concerns (the split the data pages use, so the geometry
 * is unit-tested, not eyeballed):
 *
 *   • `bandRows` — the band's horizontal cell boundaries (the vertical module),
 *     anchored to the band top. Identical on every print (same height, same
 *     module) → a row index is a **global** index.
 *   • `bandColumns` — the across-the-wall cell boundaries, anchored to a global
 *     world run coordinate (worldX for E-W walls, worldZ for N-S walls) via the
 *     print's baked `originMm` + `dir`. Each cell carries its **global column
 *     index** = the world grid cell it occupies, so the same world cell resolves
 *     to the same index on any print that covers it.
 *   • `bandCellOpacity` — the scatter, as a **positional** deterministic field
 *     keyed by (globalCol, row, seed): a hash, not an array. Same world cell ⇒
 *     same opacity everywhere, which is exactly what makes the frieze seam-match.
 *
 * Layout units are abstract millimetres (the page passes them from `geo`); the
 * maths is scale-free. See `banda.tsx` for the rendering.
 */

/* ── horizontal cell boundaries: the band's vertical module (global rows) ─────── */

export type BandRow = {
  /** Global row index (0 = topmost band row) — identical on every print. */
  row: number
  /** Top edge of the row, mm from the media (bleed-inclusive) top. */
  y0Mm: number
  /** Bottom edge of the row, mm from the media top. */
  y1Mm: number
}

export type BandRowsOpts = {
  /** Band top, mm from the **trim** (print) top. */
  bandTopMm: number
  /** Band thickness, mm. */
  bandHeightMm: number
  /** Square cell module, mm. */
  gridMm: number
  /** Print bleed, mm (the band top is measured from trim, the media adds bleed). */
  bleedMm: number
}

/**
 * The band's horizontal cell boundaries, top→bottom. The band is `bandHeightMm`
 * tall, its top `bandTopMm` below the trim top (so `bleedMm + bandTopMm` below the
 * media top), tiled into whole `gridMm` rows. Because every alcove wall is the
 * same height and shares these numbers, `row` is a global index — the same row on
 * any two prints is the same physical band course. Throws on a non-positive
 * module or thickness.
 */
export function bandRows(opts: BandRowsOpts): BandRow[] {
  const { bandTopMm, bandHeightMm, gridMm, bleedMm } = opts
  if (!(gridMm > 0)) throw new Error('bandRows: gridMm must be > 0')
  if (!(bandHeightMm > 0)) throw new Error('bandRows: bandHeightMm must be > 0')
  const topMediaMm = bleedMm + bandTopMm
  const n = Math.round(bandHeightMm / gridMm)
  const out: BandRow[] = []
  for (let r = 0; r < n; r++) {
    out.push({ row: r, y0Mm: topMediaMm + r * gridMm, y1Mm: topMediaMm + (r + 1) * gridMm })
  }
  return out
}

/* ── across-the-wall cell boundaries, anchored to a global world coordinate ────── */

export type BandColumn = {
  /** Global column index = the world grid cell `[k·grid, (k+1)·grid)` it occupies. */
  globalCol: number
  /** Left edge of the cell, mm from the media (bleed-inclusive) left. */
  x0Mm: number
  /** Right edge of the cell, mm from the media left. */
  x1Mm: number
}

export type BandColumnsOpts = {
  /** Full media width (trim + both bleeds), mm. */
  mediaWidthMm: number
  /** Print bleed, mm (trim-left sits `bleedMm` in from the media left). */
  bleedMm: number
  /** World run coordinate (mm) at the print's **left trim edge** (local x = 0). */
  originMm: number
  /** World-run change (mm) per +1 mm of local left→right distance (+1 or −1). */
  dir: 1 | -1
  /** Square cell module, mm. */
  gridMm: number
}

/**
 * The across-the-wall cells, left→right, every cell anchored to the global world
 * grid. A cell is the slice of the print that overlaps one world grid cell
 * `[k·grid, (k+1)·grid)`; its `globalCol` is `k`. Cells are emitted for the whole
 * media (bleed included) so the band covers the trim edge cleanly. Because the
 * index is the **world** cell — not a per-print counter — any two prints that
 * cover the same world cell agree on `globalCol`, so the opacity field (keyed on
 * it) seam-matches across panels. Throws on a non-positive module/width or a bad
 * direction.
 */
export function bandColumns(opts: BandColumnsOpts): BandColumn[] {
  const { mediaWidthMm, bleedMm, originMm, gridMm } = opts
  const dir = opts.dir
  if (!(gridMm > 0)) throw new Error('bandColumns: gridMm must be > 0')
  if (!(mediaWidthMm > 0)) throw new Error('bandColumns: mediaWidthMm must be > 0')
  if (dir !== 1 && dir !== -1) throw new Error('bandColumns: dir must be +1 or −1')

  // World coordinate at a media-left distance (mm). Trim-left (local 0) is bleedMm
  // in from the media left, so localFromTrim = localFromMedia − bleedMm.
  const worldAt = (localMediaMm: number) => originMm + dir * (localMediaMm - bleedMm)
  // Inverse: media-left distance (mm) for a world coordinate.
  const localAt = (worldMm: number) => bleedMm + dir * (worldMm - originMm)

  const wA = worldAt(0)
  const wB = worldAt(mediaWidthMm)
  const lo = Math.min(wA, wB)
  const hi = Math.max(wA, wB)
  const kStart = Math.floor(lo / gridMm) - 1
  const kEnd = Math.ceil(hi / gridMm) + 1

  const out: BandColumn[] = []
  for (let k = kStart; k < kEnd; k++) {
    const e0 = localAt(k * gridMm)
    const e1 = localAt((k + 1) * gridMm)
    const x0 = Math.min(e0, e1)
    const x1 = Math.max(e0, e1)
    if (x1 <= 0 || x0 >= mediaWidthMm) continue // outside the media → skip
    out.push({ globalCol: k, x0Mm: x0, x1Mm: x1 })
  }
  return out
}

/* ── per-cell opacity, as a positional (seam-matching) deterministic field ─────── */

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

/** Mix three (possibly negative) integers into a uint32 — the per-cell seed. */
function hash3(a: number, b: number, c: number): number {
  let h = (a | 0) ^ Math.imul(b | 0, 0x9e3779b1) ^ Math.imul(c | 0, 0x85ebca77)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

export type BandCellOpacityOpts = {
  /** Global column index (from `bandColumns`). */
  col: number
  /** Global row index (from `bandRows`). */
  row: number
  /** Field seed — change it to reshuffle the whole frieze; same seed ⇒ same field. */
  seed: number
  /** Fraction of cells forced fully transparent (opacity 0). */
  emptyFrac: number
  /** Lowest opacity a non-empty cell may take. */
  minOpacity: number
  /** Highest opacity a non-empty cell may take. */
  maxOpacity: number
}

/**
 * The opacity of one band cell, as a **positional** field: a deterministic hash of
 * `(col, row, seed)` decides empty-vs-filled (against `emptyFrac`) and, when
 * filled, the opacity in `[minOpacity, maxOpacity]`. Two independent draws keep the
 * empty share and the level uncorrelated. Being keyed purely on the global cell
 * (not a per-print index) is what makes the frieze continuous: the same world cell
 * yields the same opacity on every print that paints it. Throws on an `emptyFrac`
 * outside [0, 1] or an inverted/out-of-range opacity range.
 */
export function bandCellOpacity(opts: BandCellOpacityOpts): number {
  const { col, row, seed, emptyFrac, minOpacity, maxOpacity } = opts
  if (!(emptyFrac >= 0 && emptyFrac <= 1)) throw new Error('bandCellOpacity: emptyFrac must be in [0, 1]')
  if (!(minOpacity >= 0 && maxOpacity <= 1 && minOpacity <= maxOpacity)) {
    throw new Error('bandCellOpacity: require 0 <= minOpacity <= maxOpacity <= 1')
  }
  const rnd = mulberry32(hash3(col, row, seed))
  const gate = rnd() // empty vs filled
  const level = rnd() // opacity level when filled
  return gate < emptyFrac ? 0 : minOpacity + level * (maxOpacity - minOpacity)
}
