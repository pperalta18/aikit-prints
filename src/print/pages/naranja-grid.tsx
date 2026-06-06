import type { CSSProperties, ReactNode } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { PrintPageProps } from '../types'
import { PrintFonts } from '../printFonts'
import {
  mosaicGrid,
  packBays,
  fillBays,
  type MosaicBay,
  type MosaicSlot,
  type PlacedMosaicTile,
  type MosaicGrid,
} from './mosaico'

/**
 * naranja-grid — «La Naranja Mecánica», muro de campaña (wall 4-W-2, 11.5×3 m).
 * ──────────────────────────────────────────────────────────────────────────────
 * The **left quarter stays white** (clean breathing space) and the **right three
 * quarters** is a full-height grid of the brand's campaign creatives, **butted edge
 * to edge** ("pegados") with a fine white seam reading the grid. The cells are the
 * campaign images as-shipped (each one already a contact-sheet of ads), interspersed
 * **de vez en cuando** with a flat **brand-orange** cell and the **sun-mark / wordmark**
 * lockup — so the wall reads as the campaign plastered across a wall, mostly imagery,
 * a little colour and brand.
 *
 * It reuses the bay-packed geometry of `mosaico.ts` (a left→right run of full-height
 * column-groups, each a vertical stack of tiles), so the grid always tiles perfectly:
 * no gaps, full height, edge to edge. The grid's outer (wall-edge) tiles bleed past
 * the trim; its **left edge sits exactly at the grid start** (a quarter in), with the
 * white left margin to its left.
 *
 * `doc.props` (all optional): `gridStartXFraction` (where the grid begins, as a
 * fraction of the wall width — default 0.25), or `gridStartXMm` outright; `rows`
 * (grid height in cells, default 4); `gutterMm` (white seam, default 10); `images`
 * (key → {src, alt} map); `bays` (override the composition); `tones`; `logoSrc`.
 */

const SEAM = '#ffffff'

/** Brand orange family («el naranja de marca») + a campaign green and a paper cream. */
const ORANGE = '#fe6d01' // canonical brand orange (from the wordmark SVG)
const AMBER = '#fea903' // secondary amber (the sun's outer rays)
const GREEN = '#3a8a3f' // campaign green
const CREAM = '#f7f3e8' // brand paper (matches 4-W-1's ground)
const DEFAULT_TONES = [ORANGE, AMBER, GREEN]

const ASSET_DIR = 'prints/marco-4-w-2/assets'
const DEFAULT_LOGO = `${ASSET_DIR}/la-naranja-mecanica.svg`

type ImageRef = { src: string; alt?: string }

/** The eight campaign sheets shipped with the wall (each already a wall of ads). */
const DEFAULT_IMAGES: Record<string, ImageRef> = Object.fromEntries(
  Array.from({ length: 8 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0')
    return [`nm${n}`, { src: `${ASSET_DIR}/nm-${n}.png`, alt: `La Naranja Mecánica — campaña ${n}` }]
  }),
)

/** Our slot kinds extend the mosaic's with a brand `mark` (logo on a ground). */
type GridSlot = (MosaicSlot & { kind: 'image' | 'solid' | 'mark' }) & { ground?: string }
type GridBay = { cols: number; slots: GridSlot[] }

type Props = {
  /** Where the grid begins, as a fraction of the wall width. Default 0.25 (a quarter in). */
  gridStartXFraction?: number
  /** Explicit grid start X (mm). Overrides `gridStartXFraction` when set. */
  gridStartXMm?: number
  rows?: number
  gutterMm?: number
  images?: Record<string, ImageRef>
  bays?: GridBay[]
  tones?: string[]
  logoSrc?: string
}

/* ── slot builders ─────────────────────────────────────────────────────────── */
const img = (image: string, rows: number): GridSlot => ({ kind: 'image', image, rows })
const solid = (tone: number, rows: number): GridSlot => ({ kind: 'solid', rows, fill: `tone:${tone}` })
const mark = (rows: number, ground = CREAM): GridSlot => ({ kind: 'mark', rows, ground })

/**
 * The default composition for the grid region (12 cols × 4 rows on this wall). All
 * eight campaign sheets sit at near-native landscape spans (≈3×2 / 2×2) so they read
 * whole, with one flat brand-orange cell and one sun-mark lockup as the occasional
 * colour/brand beat. Bays are full-height column-groups; their `cols` sum to the grid.
 */
const DEFAULT_BAYS: GridBay[] = [
  { cols: 3, slots: [img('nm01', 2), img('nm02', 2)] }, //  0– 2
  { cols: 3, slots: [img('nm03', 2), img('nm04', 2)] }, //   3– 5
  { cols: 2, slots: [img('nm05', 2), solid(0, 2)] }, //      6– 7  · naranja de marca
  { cols: 2, slots: [mark(2), img('nm06', 2)] }, //          8– 9  · sol-marca / wordmark
  { cols: 2, slots: [img('nm07', 2), img('nm08', 2)] }, //  10–11
]

export function NaranjaGrid({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const rows = typeof p.rows === 'number' && p.rows > 0 ? Math.round(p.rows) : 4
  const gutterMm = typeof p.gutterMm === 'number' ? p.gutterMm : 10
  const images = { ...DEFAULT_IMAGES, ...(p.images ?? {}) }
  const tones = Array.isArray(p.tones) && p.tones.length ? p.tones : DEFAULT_TONES
  const logoSrc = typeof p.logoSrc === 'string' && p.logoSrc.trim() ? p.logoSrc.trim() : DEFAULT_LOGO

  const W = geo.dims.trimWidthMm
  const startFraction =
    typeof p.gridStartXFraction === 'number' && p.gridStartXFraction >= 0 && p.gridStartXFraction < 1
      ? p.gridStartXFraction
      : 0.25
  const gridStartXMm = typeof p.gridStartXMm === 'number' ? p.gridStartXMm : W * startFraction
  const gridWMm = Math.max(geo.dims.trimHeightMm, W - gridStartXMm)
  const gridLeftPx = geo.bleedPx + geo.mm(gridStartXMm)

  const grid = mosaicGrid({ widthMm: gridWMm, heightMm: geo.dims.trimHeightMm, rows })

  // The authored composition, topped up with brand-orange / cream fillers if narrower.
  const authored = (Array.isArray(p.bays) && p.bays.length ? p.bays : DEFAULT_BAYS) as GridBay[]
  const fillerFor = (index: number, cols: number, gridRows: number): MosaicBay =>
    index % 3 === 1
      ? { cols, slots: [mark(gridRows) as MosaicSlot] }
      : { cols, slots: [solid(index, gridRows) as MosaicSlot] }
  const bays = fillBays(authored as unknown as MosaicBay[], grid, fillerFor)
  const tiles = packBays(bays, grid)

  // Resolve a solid fill: `tone:N` indexes the brand palette, else a literal colour.
  const resolveFill = (slot: MosaicSlot): string => {
    const f = slot.fill ?? 'tone:0'
    const m = /^tone:(\d+)$/.exec(f)
    return m ? tones[Number(m[1]) % tones.length] : f
  }

  const g = geo.mm(gutterMm)

  return (
    <>
      <PrintFonts />

      {/* white ground over the whole media — the left quarter stays this clean white,
          and the seams between tiles read as paper. */}
      <div style={{ position: 'absolute', inset: 0, background: doc.surface ?? SEAM }} />

      {/* the campaign grid — tiles in media px from the grid start; wall-edge tiles
          (right / top / bottom) bleed past the trim, the left edge sits at the grid start */}
      {tiles.map((t, i) => (
        <Tile
          key={`${t.col}-${t.row}-${i}`}
          tile={t}
          grid={grid}
          geo={geo}
          gridLeftPx={gridLeftPx}
          gutterPx={g}
          images={images}
          fill={resolveFill(t.slot)}
          logoSrc={logoSrc}
        />
      ))}
    </>
  )
}

/* ── one placed tile, with white seams (internal) and bleed (outer edges) ───── */
function Tile({
  tile,
  grid,
  geo,
  gridLeftPx,
  gutterPx,
  images,
  fill,
  logoSrc,
}: {
  tile: PlacedMosaicTile
  grid: MosaicGrid
  geo: PrintPageProps['geo']
  gridLeftPx: number
  gutterPx: number
  images: Record<string, ImageRef>
  fill: string
  logoSrc: string
}): ReactNode {
  const cw = geo.mm(grid.cellWMm)
  const ch = geo.mm(grid.cellHMm)
  const half = gutterPx / 2

  let left = gridLeftPx + tile.col * cw
  let top = geo.bleedPx + tile.row * ch
  let right = gridLeftPx + (tile.col + tile.cols) * cw
  let bottom = geo.bleedPx + (tile.row + tile.rows) * ch

  // Internal seams: inset by half a gutter on sides that meet another tile.
  if (tile.col > 0) left += half
  if (tile.row > 0) top += half
  if (tile.col + tile.cols < grid.cols) right -= half
  if (tile.row + tile.rows < grid.rows) bottom -= half

  // Bleed the wall-edge sides past the trim (no white sliver after the cut). The grid's
  // LEFT edge is a quarter in (after the white margin), so it never bleeds left.
  if (tile.row === 0) top = 0
  if (tile.col + tile.cols === grid.cols) right = geo.mediaWidthPx
  if (tile.row + tile.rows === grid.rows) bottom = geo.mediaHeightPx

  const boxW = Math.max(0, right - left)
  const boxH = Math.max(0, bottom - top)
  const box: CSSProperties = { position: 'absolute', left, top, width: boxW, height: boxH, overflow: 'hidden' }

  const slot = tile.slot as GridSlot

  if (slot.kind === 'image') {
    const ref = slot.image ? images[slot.image] : undefined
    return (
      <div style={box}>
        <ImageFill src={ref?.src} alt={ref?.alt} />
      </div>
    )
  }

  if (slot.kind === 'mark') {
    const ground = slot.ground ?? CREAM
    const pad = Math.min(boxW, boxH) * 0.18
    return (
      <div style={{ ...box, background: ground, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: pad }}>
        <Logo src={logoSrc} />
      </div>
    )
  }

  // solid brand-colour cell
  return <div style={{ ...box, background: fill }} />
}

/* ── a real image, object-fit cover (works in app preview + Remotion export) ── */
function ImageFill({ src, alt }: { src?: string; alt?: string }): ReactNode {
  const path = typeof src === 'string' && src.trim() ? src.trim() : ''
  if (!path) return <div style={{ width: '100%', height: '100%', background: CREAM }} />
  const resolved = staticFile(path.replace(/^\/+/, '').replace(/^public\//, ''))
  const style: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }
  return getRemotionEnvironment().isRendering ? <Img src={resolved} style={style} /> : <img src={resolved} alt={alt ?? ''} style={style} />
}

/* ── the brand lockup (sun-mark + «La Naranja Mecánica» wordmark), contained ─── */
function Logo({ src }: { src: string }): ReactNode {
  const path = staticFile(src.replace(/^\/+/, '').replace(/^public\//, ''))
  const style: CSSProperties = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }
  return getRemotionEnvironment().isRendering ? <Img src={path} style={style} /> : <img src={path} alt="La Naranja Mecánica" style={style} />
}
