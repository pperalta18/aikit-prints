import type { CSSProperties, ReactNode } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { PrintPageProps } from '../types'
import { PrintFonts, PRINT_TEXT_FONT } from '../printFonts'
import { ProximaSala } from './proxima-sala'
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
 * mosaico — «La Naranja Mecánica», mosaico de marca (wall 11-E-2, 12.25×2.5 m).
 * ──────────────────────────────────────────────────────────────────────────────
 * The wall keeps its **signage** tag on the left (the `proxima-sala` «05 · Cuellos
 * de botella» next-section indicator) and, **two metres to its right**, a full-height
 * grid mosaic fills the rest of the wall with the brand's imagery: real photos /
 * illustrations sized to span the cells that match their format (the 1.43∶1
 * landscapes ≈ 3×2 units), flat **brand-orange** solid cells for rhythm, and
 * **placeholder** cells (the brand sun, ghosted) standing in for the imagery yet to
 * come — so a handful of real images plus placeholders still cover the grid region
 * edge to edge. White seams read the grid; the grid's outer (wall-edge) tiles bleed
 * past the trim, while its left edge sits exactly at the grid start (mid-wall).
 *
 * Layout is bay-packed (see `mosaico.ts`): a left→right run of full-height column
 * groups, each a vertical stack of tiles. The default composition fills the grid
 * region; `fillBays` tops up anything narrower, so dropping in more images just
 * shrinks the placeholder/solid fillers.
 *
 * `doc.props`: the signage reads its own `proxima-sala` props (`num`, `sala`,
 * `salaLines`, `arrow`, `edge`, …). Grid props (all optional): `signageBandMm` (the
 * signage element's right edge, default 1500) + `gridGapMm` (clear gap to the grid,
 * default 2000) → the grid starts at their sum; or set `gridStartXMm` outright.
 * `rows` (grid height in cells, default 4), `gutterMm` (white seam, default 14),
 * `images` (key → {src, alt} map), `bays` (override the composition), `tones`.
 */

const SEAM = '#ffffff'

/** Brand orange family («el naranja de marca»). */
const ORANGE_DEEP = '#f15a22'
const ORANGE = '#ff6a1f'
const AMBER = '#f9a825'
const DEFAULT_TONES = [ORANGE_DEEP, ORANGE, AMBER]

/** Placeholder field: a faint orange wash + a ghosted brand sun on white. */
const PLACEHOLDER_WASH = 'rgba(255,106,31,0.11)'
const PLACEHOLDER_FRAME = 'rgba(241,90,34,0.28)'
const PLACEHOLDER_GLYPH = 'rgba(241,90,34,0.40)'
const PLACEHOLDER_LABEL = 'rgba(241,90,34,0.62)'

const ASSET_DIR = 'prints/11-e-2/assets'

type ImageRef = { src: string; alt?: string }

/** The four real brand images shipped with the wall. */
const DEFAULT_IMAGES: Record<string, ImageRef> = {
  poster: { src: `${ASSET_DIR}/poster.png`, alt: 'La Naranja Mecánica — Fuel for a better world' },
  landscape: { src: `${ASSET_DIR}/landscape.png`, alt: 'La Naranja Mecánica — paisaje de marca' },
  vending: { src: `${ASSET_DIR}/vending.png`, alt: 'La Naranja Mecánica — máquina expendedora' },
  taxi: { src: `${ASSET_DIR}/taxi.png`, alt: 'La Naranja Mecánica — robotaxi autónomo' },
  slogan: { src: `${ASSET_DIR}/slogan.png`, alt: 'Good for you. Good for each other. Good for our planet.' },
  bottles: { src: `${ASSET_DIR}/bottles.png`, alt: 'La Naranja Mecánica — botellas de zumo' },
  factory: { src: `${ASSET_DIR}/factory.png`, alt: 'La Naranja Mecánica — micro-fábrica autónoma' },
}

type Props = {
  /** The signage element's right edge (mm from the left trim). Default 1500. */
  signageBandMm?: number
  /** Clear gap between the signage and the grid (mm). Default 2000 («dos metros»). */
  gridGapMm?: number
  /** Explicit grid start X (mm). Overrides `signageBandMm + gridGapMm` when set. */
  gridStartXMm?: number
  rows?: number
  gutterMm?: number
  images?: Record<string, ImageRef>
  bays?: MosaicBay[]
  tones?: string[]
}

/* ── slot builders for the default art direction ───────────────────────────── */
const img = (image: string, rows: number): MosaicSlot => ({ kind: 'image', image, rows })
const solid = (tone: number, rows: number): MosaicSlot => ({ kind: 'solid', rows, fill: `tone:${tone}` })
const ph = (rows: number, label?: string): MosaicSlot => ({ kind: 'placeholder', rows, label })

/**
 * The default composition for the grid region (12 cols on this wall, full height 3 m).
 * The real images sit in the leftmost bays so they're never clipped if the region is
 * narrow; `fillBays` tops up any extra width with the placeholder/solid rhythm. A calm
 * contact-sheet of half-height landscapes anchored, on the right, by the full-height
 * brand **póster** as the wall's hero. The póster is itself a 1.43∶1 landscape, so it
 * gets a wide **6-col** bay (≈1.46∶1) — it reads whole, edge to edge, never squeezed
 * into a portrait sliver.
 */
const DEFAULT_BAYS: MosaicBay[] = [
  { cols: 3, slots: [img('vending', 2), img('bottles', 2)] }, // 0– 2  vending / botellas
  { cols: 3, slots: [img('taxi', 2), img('landscape', 2)] }, //  3– 5  robotaxi / paisaje
  { cols: 6, slots: [img('poster', 4)] }, //                     6–11  póster héroe — landscape a sangre, sin recorte
]

export function Mosaico({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const rows = typeof p.rows === 'number' && p.rows > 0 ? Math.round(p.rows) : 4
  const gutterMm = typeof p.gutterMm === 'number' ? p.gutterMm : 14
  const images = { ...DEFAULT_IMAGES, ...(p.images ?? {}) }
  const tones = Array.isArray(p.tones) && p.tones.length ? p.tones : DEFAULT_TONES

  // The grid starts two metres to the right of the signage element: at
  // `signageBandMm + gridGapMm` (or an explicit `gridStartXMm`), and runs to the right
  // trim edge. The signage tag itself keeps the left of the wall.
  const W = geo.dims.trimWidthMm
  const signageBandMm = typeof p.signageBandMm === 'number' ? p.signageBandMm : 1500
  const gridGapMm = typeof p.gridGapMm === 'number' ? p.gridGapMm : 2000
  const gridStartXMm = typeof p.gridStartXMm === 'number' ? p.gridStartXMm : signageBandMm + gridGapMm
  const gridWMm = Math.max(geo.dims.trimHeightMm, W - gridStartXMm)
  const gridLeftPx = geo.bleedPx + geo.mm(gridStartXMm)

  const grid = mosaicGrid({ widthMm: gridWMm, heightMm: geo.dims.trimHeightMm, rows })

  // The authored composition, topped up to fill the wall if it's narrower.
  const authored = Array.isArray(p.bays) && p.bays.length ? p.bays : DEFAULT_BAYS
  const fillerFor = (index: number, cols: number, gridRows: number): MosaicBay =>
    index % 3 === 1
      ? { cols, slots: [ph(gridRows)] }
      : { cols, slots: [solid(index, gridRows)] }
  const bays = fillBays(authored, grid, fillerFor)
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

      {/* white ground over the whole media (so seams + any edge gap read as paper) */}
      <div style={{ position: 'absolute', inset: 0, background: doc.surface ?? SEAM }} />

      {/* the signage stays on the left of the wall (the «05 · Cuellos de botella»
          next-section tag); it reads its own props from the same doc. Rendered BEFORE
          the tiles because it paints its own full-bleed ground — the tiles then sit on
          top, but only in the grid region, so the tag (far left) stays visible. */}
      <ProximaSala doc={doc} geo={geo} />

      {/* the mosaic — tiles placed in media px from the grid start; wall-edge tiles
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
}: {
  tile: PlacedMosaicTile
  grid: MosaicGrid
  geo: PrintPageProps['geo']
  /** Left origin of the grid in media px (the grid starts mid-wall, after the signage). */
  gridLeftPx: number
  gutterPx: number
  images: Record<string, ImageRef>
  fill: string
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
  // LEFT edge is mid-wall (it starts after the signage), so it never bleeds — it sits
  // exactly at the grid start.
  if (tile.row === 0) top = 0
  if (tile.col + tile.cols === grid.cols) right = geo.mediaWidthPx
  if (tile.row + tile.rows === grid.rows) bottom = geo.mediaHeightPx

  const boxW = Math.max(0, right - left)
  const boxH = Math.max(0, bottom - top)
  const box: CSSProperties = {
    position: 'absolute',
    left,
    top,
    width: boxW,
    height: boxH,
    overflow: 'hidden',
  }

  if (tile.slot.kind === 'image') {
    const ref = tile.slot.image ? images[tile.slot.image] : undefined
    return (
      <div style={box}>
        <ImageFill src={ref?.src} alt={ref?.alt} />
      </div>
    )
  }

  if (tile.slot.kind === 'solid') {
    return <div style={{ ...box, background: fill }} />
  }

  // placeholder
  return (
    <div style={{ ...box, background: PLACEHOLDER_WASH }}>
      <PlaceholderFace geo={geo} label={tile.slot.label} boxW={boxW} boxH={boxH} />
    </div>
  )
}

/* ── a real image, object-fit cover (works in app preview + Remotion export) ── */
function ImageFill({ src, alt }: { src?: string; alt?: string }): ReactNode {
  const path = typeof src === 'string' && src.trim() ? src.trim() : ''
  if (!path) return <div style={{ width: '100%', height: '100%', background: PLACEHOLDER_WASH }} />
  const resolved = staticFile(path.replace(/^\/+/, '').replace(/^public\//, ''))
  const style: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }
  return getRemotionEnvironment().isRendering ? <Img src={resolved} style={style} /> : <img src={resolved} alt={alt ?? ''} style={style} />
}

/* ── placeholder face: thin brand frame + ghosted rising sun + small label ──── */
function PlaceholderFace({
  geo,
  label,
  boxW,
  boxH,
}: {
  geo: PrintPageProps['geo']
  label?: string
  boxW: number
  boxH: number
}): ReactNode {
  const frame = Math.max(1, geo.mm(2))
  const inset = geo.mm(20)
  // The brand mark scales to the tile — ~46% of its short side — so it reads as a
  // branded "image coming" slot at any cell size, never lost in a big empty field.
  const glyph = Math.min(boxW, boxH) * 0.46
  const labelPt = Math.max(geo.pt(26), glyph * 0.07)
  return (
    <div style={{ position: 'absolute', inset, border: `${frame}px solid ${PLACEHOLDER_FRAME}` }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: glyph * 0.12,
        }}
      >
        <SunMark color={PLACEHOLDER_GLYPH} style={{ width: glyph, height: glyph * 0.62, display: 'block' }} />
        <div
          style={{
            fontFamily: PRINT_TEXT_FONT,
            fontSize: labelPt,
            fontWeight: 600,
            letterSpacing: labelPt * 0.12,
            textTransform: 'uppercase',
            color: PLACEHOLDER_LABEL,
          }}
        >
          {label ?? 'Próximamente'}
        </div>
      </div>
    </div>
  )
}

/* ── the brand mark: a rising sun (filled half-disc + rays over a baseline) ─── */
function SunMark({ color, style }: { color: string; style?: CSSProperties }): ReactNode {
  const cx = 50
  const cy = 60
  const coreR = 17
  const rays = Array.from({ length: 9 }, (_, i) => {
    // span the half-dome from left horizon to right horizon
    const a = Math.PI + (Math.PI * i) / 8
    const r0 = coreR + 6
    const r1 = coreR + 18
    return {
      x1: cx + r0 * Math.cos(a),
      y1: cy + r0 * Math.sin(a),
      x2: cx + r1 * Math.cos(a),
      y2: cy + r1 * Math.sin(a),
    }
  })
  return (
    <svg viewBox="0 0 100 72" style={style} fill="none">
      <g stroke={color} strokeWidth={4.2} strokeLinecap="round">
        {rays.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
      </g>
      {/* rising sun — a half-disc sitting on the horizon */}
      <path d={`M${cx - coreR} ${cy} A${coreR} ${coreR} 0 0 1 ${cx + coreR} ${cy} Z`} fill={color} />
      {/* horizon baseline */}
      <line x1={cx - 30} y1={cy} x2={cx + 30} y2={cy} stroke={color} strokeWidth={4.2} strokeLinecap="round" />
    </svg>
  )
}
