import type { CSSProperties } from 'react'
import type { PrintPageProps } from '../types'
import {
  type TipoPalette,
  TipoField,
  tipoPalette,
  tipoH1,
  tipoH4,
  tipoEyebrow,
} from './tipografia-kit'
import { Arrow, type ArrowDir } from './signage-kit'
import { eventTypeScale } from './tipografia'
import { PrintFonts } from '../printFonts'

/**
 * proxima-sala — a small editorial **next-room indicator** (a "marginalia" tag).
 * ──────────────────────────────────────────────────────────────────────────
 * First authored on the West / combustión face of wall 2 (`public/prints/marco-2-w-1/`,
 * the left 6.25 m print of the Nave O wall) to announce the next room — **«La
 * velocidad de escala»**.
 *
 * The brief (Pablo): «un pequeño indicador de la sala siguiente, a la izquierda del
 * print, relativamente pequeño — no como el otro índice (la banda-título de
 * wayfinding). Algo de expo, editorial, fino, bien compuesto: una cosa.» So this is
 * the **quiet** counterpart to `wayfinding-s1-s2` / `umbral`: not a protagonist
 * title-band that fills the wall, but a discreet catalogue-style tag pinned to the
 * **left margin** — a thin vertical hairline (the *filete*) hugging the edge with a
 * narrow text column beside it: a tracked locator eyebrow, a short warm accent tick,
 * the room name in the hairline Display cut sized **small** (a few cm, never the
 * museographic protagonist size), and a discreet directional arrow.
 *
 * The same tag also doubles as a **numbered section signpost**: pass `num` and it
 * carries the section number (e.g. «04») as the one note of accent colour in place
 * of the tick, optionally with a quiet `subtitle` deck under the name; pass
 * `edge: 'right'` to mirror the whole block onto the right trim edge.
 *
 * No data, no chart — the only thing to keep honest is **legibility**: the name and
 * eyebrow are still sized through the unit-tested museographic `eventTypeScale`
 * (≈1 cm cap-height per 3 m floor) for the wall's reading distance, just at a small
 * `nameCapFraction` so the piece stays a quiet marginal note rather than a headline.
 * Light / paper register by default (`doc.theme`), the shared event type voice
 * (`tipografia-kit`, hairline 250 cut → *muy fino*). Pure inline styles (Remotion has
 * no Tailwind); authored in `geo` units so it reads at print scale at any size / DPI.
 */

type Props = {
  /** Inventory id of the wall this indicator lives on (QA / registry lookup). */
  invId?: number
  /** Real reading distance to the wall (m) — drives the museographic type sizing. */
  readingDistanceM?: number
  /** Small tracked locator above the name. */
  eyebrow?: string
  /** Optional section number (e.g. "04") — rendered as the one accent, above the name. */
  num?: string
  /** The next-room name — the one thing this piece carries. */
  sala?: string
  /** Explicit line break of the name for a balanced rag (e.g. ["La velocidad", "de escala"]). */
  salaLines?: string[]
  /** Optional deck under the name (e.g. a validation note). Quiet, muted hairline. */
  subtitle?: string
  /** Which trim edge the tag hugs. 'right' mirrors the whole block. Default 'left'.
   *  (Named `edge`, not `side`, to avoid clashing with the inventory `side` metadata.) */
  edge?: 'left' | 'right'
  /** Direction of travel to the room (the discreet cue). */
  arrow?: ArrowDir
  /** Show the directional arrow. Default true. */
  showArrow?: boolean
  /** Show the vertical filete hairline at the left edge. Default true. */
  showFilete?: boolean
  /** Show the short accent tick under the eyebrow. Default true. */
  showTick?: boolean
  /** Accent colour for the short tick. Defaults to the kit's warm accent. */
  accent?: string
  /** Room-name cap-height as a fraction of the trim height — keep it small. Default 0.03. */
  nameCapFraction?: number
  /** Section-number cap-height as a fraction of the trim height — the accent. Default 0.07. */
  numberCapFraction?: number
  /** Horizontal inset of the filete from the left trim edge, as a fraction of width. Default 0.04. */
  edgeInset?: number
  /** Vertical centre of the block, as a fraction of trim height (the eye band). Default 0.44. */
  eyeBandFraction?: number
  /** Text-column max width, as a fraction of trim width — narrow so the name stacks. Default 0.15. */
  columnFraction?: number
}

const DEFAULTS: Required<Omit<Props, 'invId' | 'accent' | 'salaLines' | 'num' | 'subtitle'>> = {
  readingDistanceM: 4,
  eyebrow: 'Próxima sala',
  sala: 'La velocidad de escala',
  edge: 'left',
  arrow: 'right',
  showArrow: true,
  showFilete: true,
  showTick: true,
  nameCapFraction: 0.03,
  numberCapFraction: 0.07,
  edgeInset: 0.04,
  eyeBandFraction: 0.44,
  columnFraction: 0.15,
}

export function ProximaSala({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : DEFAULTS.readingDistanceM
  const eyebrow = p.eyebrow ?? DEFAULTS.eyebrow
  const num = p.num
  const sala = p.sala ?? DEFAULTS.sala
  // Explicit rag if given; otherwise one line that wraps within the narrow column.
  const hasExplicitRag = Array.isArray(p.salaLines) && p.salaLines.length > 0
  const salaLines = hasExplicitRag ? (p.salaLines as string[]) : [sala]
  const subtitle = p.subtitle
  const edge = p.edge ?? DEFAULTS.edge
  const arrow: ArrowDir = p.arrow ?? DEFAULTS.arrow
  const showArrow = p.showArrow ?? DEFAULTS.showArrow
  const showFilete = p.showFilete ?? DEFAULTS.showFilete
  // When a number is present it carries the single accent, so the tick stands down.
  const showTick = (p.showTick ?? DEFAULTS.showTick) && !num
  const nameCapFraction = typeof p.nameCapFraction === 'number' ? p.nameCapFraction : DEFAULTS.nameCapFraction
  const numberCapFraction = typeof p.numberCapFraction === 'number' ? p.numberCapFraction : DEFAULTS.numberCapFraction
  const edgeInset = typeof p.edgeInset === 'number' ? p.edgeInset : DEFAULTS.edgeInset
  const eyeBandFraction = typeof p.eyeBandFraction === 'number' ? p.eyeBandFraction : DEFAULTS.eyeBandFraction
  const columnFraction = typeof p.columnFraction === 'number' ? p.columnFraction : DEFAULTS.columnFraction

  const pal: TipoPalette = tipoPalette(doc.theme)
  const accent = p.accent ?? pal.accent

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm

  // Museographic type scale — the room name is the "h1" of a deliberately *small*
  // chord (nameCapFraction), so it clears the legibility floor for the distance yet
  // stays a quiet marginal tag, not a headline. Eyebrow is the floored locator.
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, h1CapFraction: nameCapFraction })
  // The section number is its own (larger) chord — it's the protagonist accent of the tag.
  const numScale = eventTypeScale({ trimHeightMm: H, readingDistanceM, h1CapFraction: numberCapFraction })

  const nameCapMm = scale.capHeights.h1Mm
  // The text column is narrow so the name stacks to ~2 lines — the editorial look.
  const colMaxW = mm(W * columnFraction)
  // Filete: a thin vertical hairline hugging the left edge, mm-thick so it reads.
  const fileteW = Math.max(1, mm(2))
  // Gap between the filete and the text column.
  const gap = mm(W * 0.018)
  // Short warm accent tick under the eyebrow — the only flourish.
  const tickW = mm(scale.capHeights.eyebrowMm * 3.2)
  const tickH = Math.max(1, mm(scale.capHeights.eyebrowMm * 0.32))
  // The arrow is paired to the name cap-height, a touch smaller — a discreet cue.
  const arrowMm = nameCapMm * 0.72

  const nameStyle: CSSProperties = {
    ...tipoH1(geo, scale.h1Pt, pal),
    lineHeight: 1.02,
    maxWidth: colMaxW,
  }
  // The section number — the one note of accent colour (hierarchy by colour, not size).
  const numberStyle: CSSProperties = {
    ...tipoH1(geo, numScale.h1Pt, pal),
    color: accent,
    lineHeight: 0.9,
  }
  // The deck under the name — quiet, muted hairline; wraps within the column.
  const subtitleStyle: CSSProperties = {
    ...tipoH4(geo, scale.eyebrowPt * 1.5, pal),
    maxWidth: colMaxW,
  }

  // Mirror the whole block to the right trim edge when asked: the filete hugs the
  // right edge and the column reads right-aligned (so the tag stays "in the margin").
  const isRight = edge === 'right'
  const edgeAnchor: CSSProperties = isRight ? { right: mm(W * edgeInset) } : { left: mm(W * edgeInset) }
  const colAlign: CSSProperties = isRight
    ? { alignItems: 'flex-end', textAlign: 'right' }
    : { alignItems: 'flex-start', textAlign: 'left' }

  return (
    <>
      {/* print-owned @font-face (hairline cut); works in the app preview + export */}
      <PrintFonts />
      <TipoField pal={pal} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* the indicator: a vertical filete + a narrow text column, pinned to the
            left margin and centred on the eye band */}
        <div
          style={{
            position: 'absolute',
            ...edgeAnchor,
            top: `${eyeBandFraction * 100}%`,
            transform: 'translateY(-50%)',
            display: 'flex',
            // Right-anchored: filete hugs the right edge, so reverse the row order.
            flexDirection: isRight ? 'row-reverse' : 'row',
            alignItems: 'stretch',
            gap,
          }}
        >
          {/* the filete — spans the column height (alignItems: stretch) */}
          {showFilete && <div style={{ width: fileteW, background: pal.hairline, flex: '0 0 auto' }} />}

          {/* the text column: eyebrow · number · tick · room name · subtitle · arrow */}
          <div style={{ display: 'flex', flexDirection: 'column', ...colAlign }}>
            <span style={tipoEyebrow(geo, scale.eyebrowPt, pal.muted)}>{eyebrow}</span>

            {/* the section number — the one note of accent colour */}
            {num && <div style={{ ...numberStyle, marginTop: mm(scale.capHeights.eyebrowMm * 0.9) }}>{num}</div>}

            {/* short warm accent tick (only when there's no number to carry the accent) */}
            {showTick && <div style={{ width: tickW, height: tickH, background: accent, marginTop: mm(scale.capHeights.eyebrowMm * 0.9) }} />}

            {/* the room name — the one thing (explicit rag for a balanced break).
                Pre-broken rag lines must NOT wrap: in realista's live texture the page
                is rasterised with html-to-image, whose <foreignObject> clone lays a
                wrapped block line out at single-line height, so the next sibling line
                overlaps it (the print/PDF path renders in real Chromium and is fine).
                One line each (nowrap) keeps both paths identical. */}
            <div style={{ ...nameStyle, marginTop: mm(scale.capHeights.eyebrowMm * 1.4) }}>
              {salaLines.map((line, i) => (
                <div key={i} style={hasExplicitRag ? { whiteSpace: 'nowrap' } : undefined}>
                  {line}
                </div>
              ))}
            </div>

            {/* the quiet deck under the name */}
            {subtitle && <div style={{ ...subtitleStyle, marginTop: mm(scale.capHeights.eyebrowMm * 1.1) }}>{subtitle}</div>}

            {/* the discreet directional cue */}
            {showArrow && (
              <div style={{ marginTop: mm(nameCapMm * 0.7) }}>
                <Arrow geo={geo} dir={arrow} sizeMm={arrowMm} color={pal.muted} weight={3} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
