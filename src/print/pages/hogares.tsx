import type { CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { PrintPageProps } from '../types'
import { PrintFonts, PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { eventTypeScale } from './tipografia'
import { tipoPalette, TipoField, type TipoPalette } from './tipografia-kit'

/**
 * hogares — wall 11-E-1 (Nave E · aceleración, 9.75 × 2.50 m).
 * ──────────────────────────────────────────────────────────────────────────
 * A **gallery row of paintings**: one framed «cuadro» per century, hung in a clean
 * line across the wall — *el hogar a través de los siglos*. Each work is a framed
 * image (drop-shadow + mat keyline so it reads as a hung painting) with a small
 * museum-label underneath: the century + a short caption. Read left→right the row
 * walks from the slow, distant past (siglos VII · X · XII) into the dense recent
 * centuries (XVII · XIX · XX · XXI) — the gaps closing is the *aceleración*.
 *
 * Placeholder images for now: when `item.src` is empty each frame shows a toned
 * plate (warm/old → cool/new) with the century numeral faint behind it. Drop a
 * print-res PNG per century under `assets/` and set `item.src` to swap a frame in —
 * the layout is unchanged (`object-fit: cover`, so the photo fills the frame).
 *
 * Type is sized by the unit-tested `eventTypeScale` at the room reading distance, so
 * the captions clear the legibility floor while the paintings stay the protagonists.
 * Authored in physical units via `geo` (mm layout / pt type) so it reads at print
 * scale at any size / DPI. Pure inline styles (Remotion has no Tailwind).
 */

type Item = {
  /** The century label shown as the work title, e.g. "Siglo VII". */
  label: string
  /** The century in Roman numerals, large + faint behind the placeholder plate. */
  numeral: string
  /** A short museum caption under the painting (one short line). */
  caption: string
  /** Optional real image path under `public/` (Remotion `staticFile`). */
  src?: string
}

type Props = {
  /** Optional quiet header eyebrow at the top of the wall. */
  eyebrow?: string
  /** The reading distance (m) that sizes the captions. Default 3. */
  readingDistanceM?: number
  /** The row of works — one painting per century. */
  items?: Item[]
  /**
   * Warm cream ground painted full-bleed behind the *pre-industrial* (left) part of
   * the wall — the slow, distant past — then faded softly into the clean white half
   * that carries the industrial revolution onward. The warm/cool split sets «el antes»
   * apart from «el después» of the aceleración. Default cream `#ece2cc`.
   */
  historyGround?: string
  /**
   * The cream history ground stays solid through the work with this numeral and then
   * fades out across the next gutter, *before* the industrial revolution. Default 'XII'
   * (so the 19th-c. industrial home already sits on white); set '' to disable the band.
   */
  historyThroughNumeral?: string
}

/** El hogar a través de los siglos — defaults; the doc can override via props. */
const DEFAULT_ITEMS: Item[] = [
  { label: 'Siglo VII', numeral: 'VII', caption: 'Casa comunal de madera y paja' },
  { label: 'Siglo X', numeral: 'X', caption: 'Vivienda feudal de piedra y tierra' },
  { label: 'Siglo XII', numeral: 'XII', caption: 'Casa de villa medieval' },
  { label: 'Siglo XVII', numeral: 'XVII', caption: 'Hogar barroco' },
  { label: 'Siglo XIX', numeral: 'XIX', caption: 'Vivienda industrial' },
  { label: 'Siglo XX', numeral: 'XX', caption: 'Hogar moderno' },
  { label: 'Siglo XXI', numeral: 'XXI', caption: 'Hogar conectado' },
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function mixRgb(old: [number, number, number], now: [number, number, number], t: number): string {
  const r = Math.round(lerp(old[0], now[0], t))
  const g = Math.round(lerp(old[1], now[1], t))
  const b = Math.round(lerp(old[2], now[2], t))
  return `rgb(${r}, ${g}, ${b})`
}

export function Hogares({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as Props
  const items = Array.isArray(p.items) && p.items.length ? p.items : DEFAULT_ITEMS
  const eyebrow = typeof p.eyebrow === 'string' ? p.eyebrow : 'El hogar a través de los siglos'
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : 3
  const historyGround = typeof p.historyGround === 'string' ? p.historyGround : '#ece7d6'
  const historyThroughNumeral = typeof p.historyThroughNumeral === 'string' ? p.historyThroughNumeral : 'XII'

  const pal: TipoPalette = tipoPalette(doc.theme)
  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const N = items.length

  // Caption type — sized to the room reading distance (small chord so the captions
  // stay quiet labels under the paintings, never a competing headline).
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, ratio: 1.5, h1CapFraction: 0.05 })

  /** Absolute placement in mm from the trim origin. */
  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  /* ── horizontal grid (mm): frames + gutters tile the content width ─────────── */
  const MX = W * 0.065 // wider side margins — pull the row in from the wall edges
  const CONTENT_X0 = MX
  const CONTENT_W = W - 2 * MX
  const GUTTER_FRAC = 0.05 // gutter as a fraction of a frame's width — tight gallery air
  const slotW = CONTENT_W / (N + (N - 1) * GUTTER_FRAC)
  const gutter = slotW * GUTTER_FRAC
  const PITCH = slotW + gutter
  const slotLeft = (i: number) => CONTENT_X0 + i * PITCH

  /* ── cream "history" ground (full-bleed, left part) ────────────────────────── */
  // Solid behind the pre-industrial works with a clean hard cut at the gutter before
  // the industrial revolution — a warm/cool separation of the wall (px in media space
  // so it bleeds past the trim on 3 sides). No gradient: a crisp vertical edge.
  const histIdx = historyThroughNumeral ? items.findIndex((it) => it.numeral === historyThroughNumeral) : -1
  let histBandWidthPx: number | null = null
  if (histIdx >= 0) {
    // hard edge at the gutter midpoint after the last pre-industrial work
    const edgeMm = histIdx + 1 < N ? slotLeft(histIdx) + slotW + gutter / 2 : W
    histBandWidthPx = geo.bleedPx + mm(edgeMm)
  }

  /* ── vertical grid (mm): quiet header · the hung row · captions ────────────── */
  const HEADER_Y = H * 0.05
  const IMG_TOP = H * 0.15
  const IMG_BOTTOM = H * 0.73
  const bandH = IMG_BOTTOM - IMG_TOP

  // The paintings hang *smaller* than their slot: shrink the frame uniformly (keeps
  // the 0.76 aspect) and centre it in its column, so the row reads as a line of small
  // works with generous gallery air between them rather than edge-to-edge plates.
  const FRAME_SCALE = 0.68
  const frameW = slotW * FRAME_SCALE
  const paintingH = bandH * FRAME_SCALE
  const frameDX = (slotW - frameW) / 2 // re-centre the smaller frame in its slot
  const bandMidY = IMG_TOP + bandH / 2
  const frameTop = bandMidY - paintingH / 2 // keep the row vertically centred in the band
  const CAP_TOP = frameTop + paintingH + H * 0.035 // cartela rides just under the smaller frame

  return (
    <>
      <PrintFonts />
      <TipoField pal={pal} />

      {/* cream «history» ground — full-bleed behind the pre-industrial left, hard cut into white */}
      {histBandWidthPx != null ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: histBandWidthPx,
            height: geo.trimHeightPx + geo.bleedPx * 2,
            background: historyGround,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── quiet header eyebrow, centred ──────────────────────────────────── */}
        {eyebrow ? (
          <div
            style={{
              ...at(CONTENT_X0, HEADER_Y),
              width: mm(CONTENT_W),
              textAlign: 'center',
              fontFamily: PRINT_TEXT_FONT,
              fontSize: pt(scale.eyebrowPt),
              fontWeight: 600,
              letterSpacing: pt(scale.eyebrowPt * 0.22),
              textTransform: 'uppercase',
              color: pal.ink,
              lineHeight: 1.1,
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        {/* ── the row of hung paintings + their museum labels ────────────────── */}
        {items.map((item, i) => {
          const t = N > 1 ? i / (N - 1) : 1 // 0 = oldest century, 1 = newest
          return (
            <div key={`work-${i}`}>
              {/* the painting (real image, or the toned placeholder plate) — hung smaller and centred in its column */}
              <div style={{ ...at(slotLeft(i) + frameDX, frameTop), width: mm(frameW), height: mm(paintingH) }}>
                <Painting item={item} t={t} mm={mm} pt={pt} pal={pal} slotWmm={frameW} />
              </div>

              {/* the cartela: century (title) + a short caption, centred below */}
              <div style={{ ...at(slotLeft(i), CAP_TOP), width: mm(slotW), textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: PRINT_DISPLAY_HAIR,
                    fontSize: pt(scale.h4Pt),
                    fontWeight: 400,
                    letterSpacing: pt(-scale.h4Pt * 0.006),
                    color: pal.ink,
                    lineHeight: 1.04,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    marginTop: mm(scale.capHeights.bodyMm * 0.8),
                    fontFamily: PRINT_TEXT_FONT,
                    fontSize: pt(scale.bodyPt),
                    fontWeight: 400,
                    color: pal.inkSoft,
                    lineHeight: 1.25,
                  }}
                >
                  {item.caption}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ── one hung painting: a framed raster (cover), or a toned placeholder plate ── */
function Painting({
  item,
  t,
  mm,
  pt,
  pal,
  slotWmm,
}: {
  item: Item
  t: number
  mm: (v: number) => number
  pt: (v: number) => number
  pal: TipoPalette
  slotWmm: number
}) {
  const src = typeof item.src === 'string' && item.src.trim() ? item.src.trim() : ''

  // The mat: a clean ground lifted off the wall by a soft drop shadow and traced by
  // a faint keyline — so each frame reads as a *hung work*, not a pasted rectangle.
  const frame: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: pal.bg,
    overflow: 'hidden',
    boxShadow: `0 ${mm(6)}px ${mm(22)}px rgba(20,20,20,0.16)`,
    outline: `${Math.max(1, mm(0.6))}px solid ${pal.hairline}`,
    outlineOffset: 0,
  }

  if (src) {
    const path = staticFile(src.replace(/^\/+/, '').replace(/^public\//, ''))
    const imgStyle: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }
    return (
      <div style={frame}>
        {getRemotionEnvironment().isRendering ? (
          <Img src={path} alt={`${item.label} · ${item.caption}`} style={imgStyle} />
        ) : (
          <img src={path} alt={`${item.label} · ${item.caption}`} style={imgStyle} />
        )}
      </div>
    )
  }

  // Placeholder plate: a toned panel that warms/darkens for the old centuries and
  // cools/lightens for the recent ones, with the century numeral faint behind it.
  const top = mixRgb([196, 182, 160], [228, 231, 234], t)
  const bottom = mixRgb([150, 132, 108], [186, 192, 198], t)
  return (
    <div style={frame}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(158deg, ${top} 0%, ${bottom} 100%)` }}>
        {/* the century numeral, large + faint, centred */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: PRINT_DISPLAY_HAIR,
            fontSize: pt(slotWmm * 0.9),
            fontWeight: 400,
            color: 'rgba(20,20,20,0.14)',
            lineHeight: 1,
          }}
        >
          {item.numeral}
        </div>
        {/* a tiny placeholder tag, lower-left */}
        <div
          style={{
            position: 'absolute',
            left: mm(slotWmm * 0.05),
            bottom: mm(slotWmm * 0.05),
            fontFamily: PRINT_TEXT_FONT,
            fontSize: pt(slotWmm * 0.04),
            fontWeight: 600,
            letterSpacing: pt(slotWmm * 0.04 * 0.18),
            textTransform: 'uppercase',
            color: 'rgba(20,20,20,0.42)',
          }}
        >
          imagen
        </div>
      </div>
    </div>
  )
}
