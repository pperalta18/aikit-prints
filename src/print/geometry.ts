import type { PrintDimensions } from './types'

/**
 * Print geometry
 * ──────────────
 * The one coordinate rule: a print's composition is sized to the **output pixels
 * at its DPI** (so Remotion `renderStill` at scale=1 yields the exact print size),
 * and everything inside is authored in physical units via `mm()` / `pt()`. Screen-
 * scale widgets are brought to physical size with CSS `zoom` (affects layout and
 * rasterises crisply at the composition's full resolution).
 */

export const MM_PER_INCH = 25.4
export const PT_PER_INCH = 72
/** 1 mm in PostScript points (≈ 2.83465) — used to set PDF Trim/Bleed boxes. */
export const PT_PER_MM = PT_PER_INCH / MM_PER_INCH

/**
 * Standard EXPORT resolution (ppp/DPI) for every print deliverable. Decoupled from
 * `doc.dpi` (which stays low — 24/36 — only to keep the live GUI/3D preview canvases
 * light): the export pipeline and the GUI export panel default to this instead, so
 * every PDF/PNG/JPG ships at 150 dpi regardless of the doc's preview DPI. Wall-sized
 * media at 150 dpi is gigapixel — `export-print.mjs` render-tiles + stitches it.
 * Override per run with `--dpi` (CLI) or the resolution slider (GUI).
 */
export const EXPORT_DPI = 150

/** Physical millimetres → device pixels at a DPI (rounded — for integer canvas sizes). */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / MM_PER_INCH)
}

/** Physical millimetres → PostScript points (for PDF box math). */
export function mmToPt(mm: number): number {
  return mm * PT_PER_MM
}

export type PageSizeMm = { widthMm: number; heightMm: number }
export type PageSizePx = { width: number; height: number }

/** Media (full canvas) size = trim + bleed on every side. */
export function mediaSizeMm(d: PrintDimensions): PageSizeMm {
  return {
    widthMm: d.trimWidthMm + 2 * d.bleedMm,
    heightMm: d.trimHeightMm + 2 * d.bleedMm,
  }
}

/** Media size in device pixels at a DPI — the Remotion composition dimensions. */
export function mediaSizePx(d: PrintDimensions, dpi: number): PageSizePx {
  const { widthMm, heightMm } = mediaSizeMm(d)
  return { width: mmToPx(widthMm, dpi), height: mmToPx(heightMm, dpi) }
}

export type PrintGeometry = {
  dpi: number
  /** Physical millimetres → px at dpi (unrounded, for layout). */
  mm: (v: number) => number
  /** Typographic points → px at dpi (unrounded, for type sizing). */
  pt: (v: number) => number
  bleedPx: number
  safeMarginPx: number
  trimWidthPx: number
  trimHeightPx: number
  mediaWidthPx: number
  mediaHeightPx: number
  dims: PrintDimensions
}

export function buildGeometry(d: PrintDimensions, dpi: number): PrintGeometry {
  const mm = (v: number) => (v * dpi) / MM_PER_INCH
  const pt = (v: number) => (v * dpi) / PT_PER_INCH
  const media = mediaSizePx(d, dpi)
  return {
    dpi,
    mm,
    pt,
    bleedPx: mm(d.bleedMm),
    safeMarginPx: mm(d.safeMarginMm),
    trimWidthPx: mm(d.trimWidthMm),
    trimHeightPx: mm(d.trimHeightMm),
    mediaWidthPx: media.width,
    mediaHeightPx: media.height,
    dims: d,
  }
}

/** Standard page presets (mm). Portrait orientation; swap w/h for landscape. */
export const PAGE_PRESETS: Record<string, PageSizeMm & { label: string }> = {
  a6: { label: 'A6', widthMm: 105, heightMm: 148 },
  a5: { label: 'A5', widthMm: 148, heightMm: 210 },
  a4: { label: 'A4', widthMm: 210, heightMm: 297 },
  a3: { label: 'A3', widthMm: 297, heightMm: 420 },
  a2: { label: 'A2', widthMm: 420, heightMm: 594 },
  a1: { label: 'A1', widthMm: 594, heightMm: 841 },
  a0: { label: 'A0', widthMm: 841, heightMm: 1189 },
  letter: { label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  legal: { label: 'Legal', widthMm: 215.9, heightMm: 355.6 },
  tabloid: { label: 'Tabloid', widthMm: 279.4, heightMm: 431.8 },
  'business-card': { label: 'Business card', widthMm: 85, heightMm: 55 },
  'square-150': { label: 'Square 150', widthMm: 150, heightMm: 150 },
  'poster-50x70': { label: 'Poster 50×70', widthMm: 500, heightMm: 700 },
  'poster-70x100': { label: 'Poster 70×100', widthMm: 700, heightMm: 1000 },
}
