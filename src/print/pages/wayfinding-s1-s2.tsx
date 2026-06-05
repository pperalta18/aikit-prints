import type { PrintPageProps } from '../types'
import {
  type TipoPalette,
  TipoField,
  Rule,
  Lockup,
  tipoPalette,
  tipoH1,
  tipoEyebrow,
} from './tipografia-kit'
import { Arrow, type ArrowDir } from './signage-kit'
import { eventTypeScale } from './tipografia'
import { PrintFonts } from '../printFonts'
import { BRAND } from '@/lib/neumorphism'

/**
 * wayfinding-s1-s2 — the #10 print page (wall 10 / `wall-9`, S1→S2 threshold).
 * Authored as `public/prints/marco-10-s-1/doc.json` (the South face).
 * ──────────────────────────────────────────────────────────────────────────
 * The brief (Pablo): «señalética en la mitad derecha — Sala 2: Introducción a la
 * inteligencia artificial, con una flecha a la izquierda. Muy editorial, muy de
 * expo, muy fino». Sala 1 is the room behind you, so this is a **single directional**
 * — it names only the *next* room and points the way.
 *
 * So the composition is asymmetric: the left half is open air, and the signage
 * lives on the **right half** — a quiet locator eyebrow, the protagonist room title
 * in the hairline Display cut, the «Sala 2» tag in the **brand blue** accent, and a
 * large, thin left-pointing arrow that leads the eye out of the block toward the room.
 *
 * No data, no chart (`research: false`); the only thing to keep honest is
 * **legibility** — every text level is sized through the unit-tested museographic
 * `eventTypeScale` (1 cm cap-height per 3 m floor) for the wall's real reading
 * distance. The type voice is the shared event system (`tipografia-kit`, the
 * hairline 250 cut → *muy fino*), theme-aware so the ground follows `doc.theme`
 * (dark ink here). The accent is the **primary brand blue** (`BRAND.blue` / KIT_BLUE),
 * overriding the kit's default warm accent. Pure inline styles (Remotion has no
 * Tailwind); authored in `geo` units so it reads at print scale at any size / DPI.
 */

/** Inventory id of the S1→S2 wayfinding wall. */
export const WAYFINDING_S1_S2_INV_ID = 10

type Props = {
  invId?: number
  /** Real reading distance to the wall (m) — drives the museographic type sizing. */
  readingDistanceM?: number
  /** Small tracked locator above the title. */
  eyebrow?: string
  /** The room tag, in the accent — the wayfinding key. */
  sala?: string
  /** The protagonist room title. */
  title?: string
  /** Direction of travel to the room. */
  arrow?: ArrowDir
  /** Accent colour. Defaults to the primary brand blue. */
  accent?: string
  /** Threshold locator on the top strip. */
  locator?: string
  /** Title cap-height as a fraction of the trim height. */
  h1CapFraction?: number
}

const DEFAULTS: Required<Omit<Props, 'invId'>> = {
  readingDistanceM: 4,
  eyebrow: 'Próxima sala',
  sala: 'Sala 2',
  title: 'Del mito al dato',
  arrow: 'left',
  accent: BRAND.blue,
  locator: 'S1 → S2',
  h1CapFraction: 0.082,
}

export function WayfindingS1S2({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : DEFAULTS.readingDistanceM
  const eyebrow = p.eyebrow ?? DEFAULTS.eyebrow
  const sala = p.sala ?? DEFAULTS.sala
  const title = p.title ?? DEFAULTS.title
  const arrow: ArrowDir = p.arrow ?? DEFAULTS.arrow
  const accent = p.accent ?? DEFAULTS.accent
  const locator = p.locator ?? DEFAULTS.locator
  const h1CapFraction = typeof p.h1CapFraction === 'number' ? p.h1CapFraction : DEFAULTS.h1CapFraction

  const pal: TipoPalette = tipoPalette(doc.theme)

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const marginX = W * 0.05

  // Museographic type scale — every level guaranteed legible at the reading distance.
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, h1CapFraction })

  // The signage block hugs the right; the title wraps within this measure.
  const blockMaxW = W * 0.46
  // The arrow is paired to the title cap-height so word and arrow read as one unit.
  const arrowMm = scale.capHeights.h1Mm * 1.15

  // The editorial frame: two hairlines top and bottom, the act centred between.
  const ruleTopY = H * 0.16
  const ruleBotY = H * 0.84

  return (
    <>
      {/* print-owned @font-face (hairline cut); works in the app preview + export */}
      <PrintFonts />
      <TipoField pal={pal} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* ── top: hairline + the threshold locator, right-aligned ── */}
        <div style={{ position: 'absolute', left: mm(marginX), right: mm(marginX), top: mm(ruleTopY) }}>
          <Rule geo={geo} pal={pal} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: mm(H * 0.025) }}>
            <span style={tipoEyebrow(geo, scale.eyebrowPt, pal.faint)}>{locator}</span>
          </div>
        </div>

        {/* ── the act: a left-pointing arrow leading into the right-half signage ── */}
        <div
          style={{
            position: 'absolute',
            right: mm(marginX),
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: mm(W * 0.045),
          }}
        >
          <Arrow geo={geo} dir={arrow} sizeMm={arrowMm} color={accent} weight={3.5} />
          <div style={{ maxWidth: mm(blockMaxW) }}>
            <div style={{ marginBottom: mm(H * 0.035) }}>
              <span style={tipoEyebrow(geo, scale.eyebrowPt, pal.muted)}>{eyebrow}</span>
            </div>
            <div style={tipoH1(geo, scale.h1Pt, pal)}>{title}</div>
            <div style={{ marginTop: mm(H * 0.045) }}>
              <span style={{ ...tipoEyebrow(geo, scale.h4Pt, accent), letterSpacing: geo.pt(scale.h4Pt * 0.16) }}>{sala}</span>
            </div>
          </div>
        </div>

        {/* ── footer: hairline + the discreet lockup (the only brand presence) ── */}
        <div style={{ position: 'absolute', left: mm(marginX), right: mm(marginX), top: mm(ruleBotY) }}>
          <Rule geo={geo} pal={pal} />
          <div style={{ marginTop: mm(H * 0.025) }}>
            <Lockup geo={geo} sizePt={scale.eyebrowPt} pal={pal} />
          </div>
        </div>
      </div>
    </>
  )
}
