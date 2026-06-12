import { type CSSProperties, type ReactNode } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { PrintPageProps } from '../types'

/**
 * imagen-grid — a uniform N×M grid of full-bleed images.
 * ──────────────────────────────────────────────────────
 * The reusable "wall of images" page: an even `cols × rows` grid that fills the
 * **whole media** (trim + bleed) edge to edge. Each cell hosts one image, sized
 * `object-fit: cover` so it fills its cell with no letterboxing (the overflow is
 * cropped); the grid's outer cells bleed past the trim, so there's no white sliver
 * after the cut. Author a `doc.json` at the real wall size, point `pageComponentId`
 * here, and list the images in `props.images` (reading order, left→right then
 * top→bottom).
 *
 * Uses Remotion's `<Img>` while rendering (it delays the still until the bitmap
 * decodes — essential for the deterministic `renderStill` export) and a bare
 * `<img>` in the live browser preview (where `<Img>` would throw without a
 * composition context), the same pattern as `raster-wall` / `naranja-grid`.
 *
 * `doc.props` (all optional except `images`):
 *   `images`   string[] — asset paths (under `public/`, leading `public/` and `/`
 *              are stripped). Cells beyond the list stay empty (seam colour).
 *   `cols`     number — columns (default 3).
 *   `rows`     number — rows (default 2).
 *   `gutterMm` number — white seam between cells, in mm (default 0 = butted).
 *              Outer edges always bleed; the gutter only opens internal seams.
 *   `fit`      'cover' | 'contain' — per-cell object-fit (default 'cover').
 *   `position` string — object-position for every cell (default 'center').
 *   `seam`     string — gutter / empty-cell colour (default `doc.surface` ?? white).
 *
 * For photographic content keep the doc's `color.renderIntent: 'perceptual'` so the
 * sRGB→CMYK conversion compresses the gamut smoothly instead of clipping.
 */

type Props = {
  images?: string[]
  cols?: number
  rows?: number
  gutterMm?: number
  fit?: 'cover' | 'contain'
  position?: string
  seam?: string
}

const posInt = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : fallback

export function ImagenGrid({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props

  const images = Array.isArray(p.images)
    ? p.images.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : []
  const cols = posInt(p.cols, 3)
  const rows = posInt(p.rows, 2)
  const gutterPx = geo.mm(typeof p.gutterMm === 'number' && p.gutterMm >= 0 ? p.gutterMm : 0)
  const fit: 'cover' | 'contain' = p.fit === 'contain' ? 'contain' : 'cover'
  const position = typeof p.position === 'string' && p.position.trim() ? p.position.trim() : 'center'
  const seam = typeof p.seam === 'string' && p.seam.trim() ? p.seam.trim() : doc.surface ?? '#ffffff'

  const cellW = geo.mediaWidthPx / cols
  const cellH = geo.mediaHeightPx / rows
  const half = gutterPx / 2

  const cells: { key: number; src?: string; box: CSSProperties }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      // Cell bounds in media px; outer edges sit exactly at the media edge (full
      // bleed). Internal sides inset by half a gutter so seams read evenly.
      let left = c * cellW
      let top = r * cellH
      let right = (c + 1) * cellW
      let bottom = (r + 1) * cellH
      if (c > 0) left += half
      if (r > 0) top += half
      if (c < cols - 1) right -= half
      if (r < rows - 1) bottom -= half
      cells.push({
        key: idx,
        src: images[idx],
        box: { position: 'absolute', left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top), overflow: 'hidden' },
      })
    }
  }

  return (
    <>
      {/* seam ground — shows through the gutters and behind any empty cell */}
      <div style={{ position: 'absolute', inset: 0, background: seam }} />
      {cells.map((cell) => (
        <div key={cell.key} style={cell.box}>
          {cell.src ? <CellImage src={cell.src} fit={fit} position={position} /> : null}
        </div>
      ))}
    </>
  )
}

/* ── one cell image, object-fit cover/contain (app preview + Remotion export) ── */
function CellImage({ src, fit, position }: { src: string; fit: 'cover' | 'contain'; position: string }): ReactNode {
  const resolved = staticFile(src.replace(/^\/+/, '').replace(/^public\//, ''))
  const style: CSSProperties = { width: '100%', height: '100%', objectFit: fit, objectPosition: position, display: 'block' }
  return getRemotionEnvironment().isRendering ? <Img src={resolved} style={style} /> : <img src={resolved} alt="" style={style} />
}
