import type { PrintPageProps } from '../types'
import { PrintFonts } from '../printFonts'
import { eventTypeScale, bodyMeasureMm } from './tipografia'
import { type TipoPalette, TipoField, tipoPalette } from './tipografia-kit'
import {
  Painting,
  CartelaDivider,
  cartelaEyebrow,
  cartelaTitle,
  cartelaSubtitle,
  cartelaBody,
  cartelaMeta,
} from './cuadro-kit'
import { layoutCuadro, type CuadroPlacement } from './cuadro'
import { defaultRasterSrc, normalizeRasterSrc } from './raster'

/**
 * cuadro — the **museum-painting** print page.
 * ──────────────────────────────────────────────────────────────────────────
 * A wall hung like a gallery: one allegorical relief — the protagonist image —
 * with a fine museum *cartela* (label) beside it. The expo's ideas are presented
 * as carved Beaux-Arts bas-reliefs (img2img-coherent in style across the set);
 * each wall is just this page pointed at its committed relief PNG with curated
 * copy. The image carries the wall; the text is the small, intimate label you
 * step up to read.
 *
 * Layout maths (`cuadro.ts`) sizes the painting to the wall and centres the
 * [painting · gap · cartela] group with generous gallery air. The cartela type is
 * sized by the unit-tested `eventTypeScale` at the **approach** distance (≈1.7 m,
 * because you walk up to a label), so it clears the legibility floor there while
 * staying small enough that the relief dominates. Museum-label register lives in
 * `cuadro-kit`. Ground (paper / ink) follows `doc.theme`; default is the clean
 * paper wall. Pure inline styles; authored in `geo` units (mm / pt) so it reads
 * at print scale at any size / DPI.
 */

type Props = {
  /** Painting asset path relative to `public/`. Default `prints/<id>/assets/<id>.png`. */
  src?: string
  /** Second painting path — hangs the wall as a diptych (8-N-1). Relative to `public/`. */
  src2?: string
  /** Alt / sources description. Default = the title. */
  alt?: string
  /** Alt for the second painting. Default = `alt`. */
  alt2?: string
  /** The *approach* reading distance to the cartela (m) — drives the label sizing. */
  readingDistanceM?: number
  /** Room / section locator above the title. Omit (or empty) for a clean cartela with no eyebrow. */
  eyebrow?: string
  /** The allegorical work-title. */
  title?: string
  /** Optional quiet second line / dedication. Omit for a clean cartela with no subtitle. */
  subtitle?: string
  /** The fine editorial label text (1–2 short sentences). */
  paragraphs?: string[]
  /** The *ficha técnica* (técnica · soporte · colección · año). */
  meta?: string
  /** Draw the short hairline rule between the title and the body. Default `false` (clean). */
  divider?: boolean
  /** Lift the relief off the wall with a drop shadow + mat keyline. Default `false` (the reliefs carry their own carved frame). */
  framed?: boolean
  /** Which side the painting hangs on. Default 'left'. Ignored when `src2` is set. */
  placement?: CuadroPlacement
  /** Painting width ÷ height. Default 2/3 (the portrait reliefs). */
  paintingAspect?: number
  /** Painting height as a fraction of the wall height. Default 0.84. */
  paintingHeightFraction?: number
  /** Title cap-height as a fraction of the wall height (keep small). Default 0.012. */
  titleCapFraction?: number
  /** Modular ratio between cartela levels. Default 1.28. */
  ratio?: number
  /** Target characters per line in the cartela measure. Default 42. */
  cartelaChars?: number
}

const DEFAULTS = {
  readingDistanceM: 1.7,
  title: 'La ascensión en el umbral',
  paragraphs: [
    'La diagonal que sacó al hombre del esfuerzo agachado no se detiene: ahora la empuja el cálculo a gran escala.',
    'Si la curva se prolonga más allá del dintel, lo que aguarda aún no sabemos nombrarlo.',
  ],
  meta: 'Bajorrelieve monocromo · Piedra caliza · Colección AiKit Live · 2026',
  divider: false,
  framed: false,
  placement: 'left' as CuadroPlacement,
  paintingAspect: 2 / 3,
  paintingHeightFraction: 0.84,
  titleCapFraction: 0.012,
  ratio: 1.28,
  cartelaChars: 42,
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function Cuadro({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props

  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : DEFAULTS.readingDistanceM
  // Eyebrow / subtitle are opt-in: only render them when the doc explicitly supplies
  // non-empty copy. Omitting them keeps the cartela clean (title → body → ficha).
  const eyebrow = typeof p.eyebrow === 'string' && p.eyebrow.trim() ? p.eyebrow : ''
  const title = p.title ?? DEFAULTS.title
  const subtitle = typeof p.subtitle === 'string' && p.subtitle.trim() ? p.subtitle : ''
  const paragraphs = Array.isArray(p.paragraphs) ? p.paragraphs : DEFAULTS.paragraphs
  const meta = p.meta ?? DEFAULTS.meta
  const divider = typeof p.divider === 'boolean' ? p.divider : DEFAULTS.divider
  const framed = typeof p.framed === 'boolean' ? p.framed : DEFAULTS.framed
  const placement = p.placement ?? DEFAULTS.placement
  const paintingAspect = typeof p.paintingAspect === 'number' ? p.paintingAspect : DEFAULTS.paintingAspect
  const paintingHeightFraction =
    typeof p.paintingHeightFraction === 'number' ? p.paintingHeightFraction : DEFAULTS.paintingHeightFraction
  const titleCapFraction = typeof p.titleCapFraction === 'number' ? p.titleCapFraction : DEFAULTS.titleCapFraction
  const ratio = typeof p.ratio === 'number' ? p.ratio : DEFAULTS.ratio
  const cartelaChars = typeof p.cartelaChars === 'number' ? p.cartelaChars : DEFAULTS.cartelaChars

  const pal: TipoPalette = tipoPalette(doc.theme)
  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm

  const src = normalizeRasterSrc(typeof p.src === 'string' && p.src.trim() ? p.src : defaultRasterSrc(doc.id))
  const alt = typeof p.alt === 'string' ? p.alt : title
  // A second relief turns the wall into a diptych (8-N-1).
  const src2 = typeof p.src2 === 'string' && p.src2.trim() ? normalizeRasterSrc(p.src2) : null
  const alt2 = typeof p.alt2 === 'string' ? p.alt2 : alt

  // Cartela type — sized for the *approach* distance, so the label stays small
  // (the image is the protagonist) yet clears the legibility floor up close.
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, ratio, h1CapFraction: titleCapFraction })

  // The museum-label column: a comfortable measure for the body, bounded to a sane
  // physical width (mm) so the title and paragraphs get room to breathe without the
  // label ever growing into a second wall of text.
  const cartelaWidthMm = clamp(bodyMeasureMm(scale.bodyPt, { chars: cartelaChars }), Math.min(W * 0.12, 300), Math.min(W * 0.45, 560))
  const gapMm = W * 0.022

  const layout = layoutCuadro({
    wallWidthMm: W,
    wallHeightMm: H,
    paintingAspect,
    paintingHeightFraction,
    cartelaWidthMm,
    gapMm,
    placement,
    secondPainting: src2 != null,
  })

  // Vertical rhythm in the cartela, anchored to the body cap-height. Generous, so the
  // title and the paragraphs each sit in their own air on the clean (divider-less) label.
  const bodyCapMm = scale.capHeights.bodyMm
  const blockGap = mm(bodyCapMm * 1.9)
  const paraGap = mm(bodyCapMm * 1.05)
  const tickW = mm(scale.capHeights.eyebrowMm * 2.6)
  const tickH = Math.max(1, mm(scale.capHeights.eyebrowMm * 0.3))

  return (
    <>
      <PrintFonts />
      <TipoField pal={pal} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* ── the hung relief(s) — carved frame is in the art, so no CSS frame/shadow by default ── */}
        <div
          style={{
            position: 'absolute',
            left: mm(layout.painting.x),
            top: mm(layout.painting.y),
            width: mm(layout.painting.width),
            height: mm(layout.painting.height),
          }}
        >
          <Painting geo={geo} src={src} alt={alt} pal={pal} shadow={framed} keyline={framed} />
        </div>

        {layout.painting2 ? (
          <div
            style={{
              position: 'absolute',
              left: mm(layout.painting2.x),
              top: mm(layout.painting2.y),
              width: mm(layout.painting2.width),
              height: mm(layout.painting2.height),
            }}
          >
            <Painting geo={geo} src={src2 as string} alt={alt2} pal={pal} shadow={framed} keyline={framed} />
          </div>
        ) : null}

        {/* ── the cartela (museum label), text vertically centred to the painting ── */}
        <div
          style={{
            position: 'absolute',
            left: mm(layout.cartela.x),
            top: mm(layout.cartela.y),
            width: mm(layout.cartela.width),
            height: mm(layout.cartela.height),
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* optional eyebrow with a short warm accent tick */}
          {eyebrow ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: mm(scale.capHeights.eyebrowMm * 0.9), marginBottom: blockGap }}>
              <span style={{ width: tickW, height: tickH, background: pal.accent, flex: '0 0 auto' }} />
              <span style={cartelaEyebrow(geo, scale.eyebrowPt, pal.muted)}>{eyebrow}</span>
            </div>
          ) : null}

          {/* title (+ optional subtitle) */}
          <div style={cartelaTitle(geo, scale.h1Pt, pal)}>{title}</div>
          {subtitle ? (
            <div style={{ ...cartelaSubtitle(geo, scale.h3Pt, pal), marginTop: mm(scale.capHeights.h3Mm * 0.5) }}>{subtitle}</div>
          ) : null}

          {/* optional divider rule */}
          {divider ? (
            <div style={{ marginTop: blockGap, marginBottom: blockGap }}>
              <CartelaDivider geo={geo} pal={pal} widthMm={cartelaWidthMm * 0.42} color={pal.accent} />
            </div>
          ) : null}

          {/* the fine editorial label text — its own air below the title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: paraGap, marginTop: divider ? 0 : blockGap }}>
            {paragraphs.map((para, i) => (
              <p key={i} style={cartelaBody(geo, scale.bodyPt, pal)}>
                {para}
              </p>
            ))}
          </div>

          {/* ficha técnica */}
          <div style={{ marginTop: blockGap }}>
            <span style={cartelaMeta(geo, scale.eyebrowPt, pal.faint)}>{meta}</span>
          </div>
        </div>
      </div>
    </>
  )
}
