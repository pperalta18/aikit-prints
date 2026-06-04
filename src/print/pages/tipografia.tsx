import type { PrintPageProps } from '../types'
import {
  type TipoPalette,
  TipoField,
  Rule,
  Lockup,
  tipoPalette,
  tipoH1,
  tipoH2,
  tipoH3,
  tipoH4,
  tipoBody,
  tipoEyebrow,
} from './tipografia-kit'
import { bodyMeasureMm, eventTypeScale } from './tipografia'
import { PrintFonts } from '../printFonts'

/**
 * tipografia — the editorial text-wall page (first proven on print **5-S-1**,
 * wall 5 / `wall-4`, the S5→S6 bridge "coste marginal → 0").
 * ──────────────────────────────────────────────────────────────────────────
 * A props-driven specimen of the event type system: the **four headings + body
 * snippets** the brief asked us to define, composed *muy fino, muy simple* on a
 * wide, short wall (9.5 × 2.5 m). The wall reads left→right: the protagonist **H1**
 * holds the left; a quiet cascade **H2 → H3 → H4 → paragraph snippets** holds the right;
 * a locator eyebrow rides the top and the discreet lockup the bottom, between two
 * hairline rules. The only ornament is the rule and a short accent tick.
 *
 * Every level is sized by the pure, unit-tested `eventTypeScale` (headings a modular
 * chord, body at the comfortable-reading size for the wall's distance, nothing below
 * the museographic floor); paragraph snippets sit in a `bodyMeasureMm` column so the
 * measure stays readable on a long wall. Ground (paper / ink) follows `doc.theme`.
 * Pure inline styles; authored in `geo` units so it reads at print scale at any DPI.
 */

type Props = {
  /** Real reading distance to the wall (m) — drives the museographic type sizing. */
  readingDistanceM?: number
  /** Small tracked locator at the top. */
  eyebrow?: string
  /** H1 — the protagonist statement. */
  h1?: string
  /** H2 — the secondary line. */
  h2?: string
  /** H3 — the tertiary deck. */
  h3?: string
  /** H4 — the smallest heading, a quiet bridge into the body. */
  h4?: string
  /** Body paragraph snippets (each its own block). */
  paragraphs?: string[]
  /** Venue line in the footer. */
  venue?: string
  /** Modular ratio between heading levels — larger separates them faster (wide walls). */
  ratio?: number
  /** H1 cap-height as a fraction of the trim height. */
  h1CapFraction?: number
}

const DEFAULTS: Required<Omit<Props, never>> = {
  readingDistanceM: 3,
  eyebrow: 'S5 → S6 · El puente',
  h1: 'Coste marginal → 0',
  h2: 'Lo escaso se vuelve abundante.',
  h3: 'Ya pasó antes.',
  h4: 'Y vuelve a pasar.',
  paragraphs: [
    'Cada vez que producir algo se acerca al coste cero, deja de ser un lujo y pasa a estar en todas partes.',
    'La luz, el cálculo, la información: primero caros, después invisibles.',
  ],
  venue: 'Finca El Olivar · 17·06·2026',
  ratio: 1.9,
  h1CapFraction: 0.15,
}

export function Tipografia({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : DEFAULTS.readingDistanceM
  const eyebrow = p.eyebrow ?? DEFAULTS.eyebrow
  const h1 = p.h1 ?? DEFAULTS.h1
  const h2 = p.h2 ?? DEFAULTS.h2
  const h3 = p.h3 ?? DEFAULTS.h3
  const h4 = p.h4 ?? DEFAULTS.h4
  const paragraphs = Array.isArray(p.paragraphs) ? p.paragraphs : DEFAULTS.paragraphs
  const venue = p.venue ?? DEFAULTS.venue
  const ratio = typeof p.ratio === 'number' ? p.ratio : DEFAULTS.ratio
  const h1CapFraction = typeof p.h1CapFraction === 'number' ? p.h1CapFraction : DEFAULTS.h1CapFraction

  const pal: TipoPalette = tipoPalette(doc.theme)

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const marginX = W * 0.045

  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, ratio, h1CapFraction })

  // The mid band lives between the two hairlines; both columns centre inside it.
  const ruleTopY = H * 0.175
  const ruleBotY = H * 0.83
  const bandTop = ruleTopY + H * 0.04
  const bandH = ruleBotY - H * 0.04 - bandTop

  // Left = the H1 protagonist; right = the H2 → H3 → snippets cascade.
  const leftW = W * 0.52
  const rightX = W * 0.585
  const rightW = W - rightX - marginX
  const measureMm = Math.min(rightW, bodyMeasureMm(scale.bodyPt, { chars: 52 }))

  // A short warm accent tick under the eyebrow — the only flourish.
  const tickW = scale.eyebrowPt > 0 ? mm(scale.capHeights.eyebrowMm * 3.2) : 0

  return (
    <>
      {/* print-owned @font-face (hairline cut); works in the app preview + export */}
      <PrintFonts />
      <TipoField pal={pal} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* ── top locator: eyebrow + accent tick, then a full-width hairline ── */}
        <div style={{ position: 'absolute', left: mm(marginX), right: mm(marginX), top: mm(H * 0.085) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: mm(scale.capHeights.eyebrowMm * 0.9) }}>
            <span style={{ width: tickW, height: Math.max(1, mm(scale.capHeights.eyebrowMm * 0.34)), background: pal.accent }} />
            <span style={tipoEyebrow(geo, scale.eyebrowPt, pal.muted)}>{eyebrow}</span>
          </div>
        </div>
        <div style={{ position: 'absolute', left: mm(marginX), right: mm(marginX), top: mm(ruleTopY) }}>
          <Rule geo={geo} pal={pal} />
        </div>

        {/* ── left: the H1 protagonist, centred in the band ── */}
        <div
          style={{
            position: 'absolute',
            left: mm(marginX),
            top: mm(bandTop),
            width: mm(leftW),
            height: mm(bandH),
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ ...tipoH1(geo, scale.h1Pt, pal), whiteSpace: 'nowrap' }}>{h1}</div>
        </div>

        {/* ── right: the H2 → H3 → snippets cascade, centred in the band ── */}
        <div
          style={{
            position: 'absolute',
            left: mm(rightX),
            top: mm(bandTop),
            width: mm(rightW),
            height: mm(bandH),
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: mm(scale.capHeights.h3Mm * 0.85),
          }}
        >
          <div style={{ ...tipoH2(geo, scale.h2Pt, pal), maxWidth: mm(rightW) }}>{h2}</div>
          <div style={{ ...tipoH3(geo, scale.h3Pt, pal), maxWidth: mm(rightW) }}>{h3}</div>
          <div style={{ ...tipoH4(geo, scale.h4Pt, pal), maxWidth: mm(rightW) }}>{h4}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: mm(scale.capHeights.bodyMm * 0.9), maxWidth: mm(measureMm), marginTop: mm(scale.capHeights.h4Mm * 0.4) }}>
            {paragraphs.map((para, i) => (
              <p key={i} style={tipoBody(geo, scale.bodyPt, pal)}>
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* ── footer: hairline + the discreet lockup / venue ── */}
        <div style={{ position: 'absolute', left: mm(marginX), right: mm(marginX), top: mm(ruleBotY) }}>
          <Rule geo={geo} pal={pal} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: mm(W * 0.02), marginTop: mm(H * 0.025) }}>
            <Lockup geo={geo} sizePt={scale.eyebrowPt} pal={pal} />
            <span style={tipoEyebrow(geo, scale.eyebrowPt, pal.faint)}>{venue}</span>
          </div>
        </div>
      </div>
    </>
  )
}
