import { mmToPt } from './geometry.ts'

/**
 * PDF page boxes (PDF/X)
 * ──────────────────────
 * The press contract needs three page boxes on every PDF/X page, in PostScript
 * points with a bottom-left origin:
 *   • MediaBox  — the physical sheet/roll the art is rendered on (full media).
 *   • BleedBox  — how far art may safely run past the trim. For our raster prints
 *                 the whole media bleeds, so BleedBox = MediaBox.
 *   • TrimBox   — the finished size after cutting (inset from the media by bleed).
 *
 * Two cases share this math, so it lives here (pure, JSX-/DOM-free → unit-tests in
 * the node project, same split as `geometry`/`tiling`):
 *   • a whole poster  → `posterPdfBoxesPt` (trim inset by the outer bleed all round).
 *   • one wall panel  → `panelPdfBoxesPt`. A wall vinyl is printed full-bleed and
 *     lapped on site — there is no guillotine trim, so the TrimBox marks the
 *     *finished wall edge*: it equals the media except on the panel sides that
 *     coincide with the master's outer media border, which inset by the outer
 *     bleed (that strip is the sangrado, image past the wall edge). Interior
 *     (lapped) sides get no inset — they are all image the installer overlaps.
 *
 * Boxes are `[x, y, width, height]` to drop straight into pdf-lib's
 * `setMediaBox` / `setBleedBox` / `setTrimBox`.
 */

/** A PDF page box as `[x, y, width, height]` in points (bottom-left origin). */
export type BoxPt = [number, number, number, number]

export type PageBoxesPt = { media: BoxPt; bleed: BoxPt; trim: BoxPt }

/** Which sides of a panel coincide with the master's outer media border. */
export type PanelEdges = { left: boolean; right: boolean; top: boolean; bottom: boolean }

function assertFinitePositive(name: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} must be a positive number (got ${v})`)
}

function assertFiniteNonNegative(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0) throw new Error(`${name} must be ≥ 0 and finite (got ${v})`)
}

/**
 * Page boxes for a whole poster of `widthPt × heightPt` with an outer `bleedMm`:
 * MediaBox = BleedBox = the full page, TrimBox inset by the bleed on every side.
 * Mirrors the master export path (`scripts/export-print.mjs`).
 */
export function posterPdfBoxesPt(widthPt: number, heightPt: number, bleedMm: number): PageBoxesPt {
  assertFinitePositive('widthPt', widthPt)
  assertFinitePositive('heightPt', heightPt)
  assertFiniteNonNegative('bleedMm', bleedMm)
  const b = mmToPt(bleedMm)
  if (2 * b >= widthPt || 2 * b >= heightPt) {
    throw new Error(`bleed (${bleedMm}mm = ${b.toFixed(2)}pt) too large for page ${widthPt}×${heightPt}pt`)
  }
  const media: BoxPt = [0, 0, widthPt, heightPt]
  return { media, bleed: [...media], trim: [b, b, widthPt - 2 * b, heightPt - 2 * b] }
}

/**
 * Page boxes for one lapped wall panel of `widthPt × heightPt`. MediaBox =
 * BleedBox = the full panel; TrimBox equals the media except on the sides flagged
 * in `edges` (the panel sides on the master's outer media border), which inset by
 * the outer `bleedMm`. Note the PDF y-origin is bottom-left, so `edges.top` insets
 * the high-y side and `edges.bottom` the low-y side.
 */
export function panelPdfBoxesPt(widthPt: number, heightPt: number, bleedMm: number, edges: PanelEdges): PageBoxesPt {
  assertFinitePositive('widthPt', widthPt)
  assertFinitePositive('heightPt', heightPt)
  assertFiniteNonNegative('bleedMm', bleedMm)
  const b = mmToPt(bleedMm)
  const left = edges.left ? b : 0
  const right = edges.right ? b : 0
  const bottom = edges.bottom ? b : 0
  const top = edges.top ? b : 0
  const trimW = widthPt - left - right
  const trimH = heightPt - bottom - top
  if (trimW <= 0 || trimH <= 0) {
    throw new Error(`bleed (${bleedMm}mm) too large for panel ${widthPt}×${heightPt}pt`)
  }
  const media: BoxPt = [0, 0, widthPt, heightPt]
  return { media, bleed: [...media], trim: [left, bottom, trimW, trimH] }
}
