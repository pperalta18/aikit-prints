import type { CSSProperties } from 'react'
import type { PrintPageProps } from '../types'
import {
  type TipoPalette,
  TipoField,
  tipoPalette,
  tipoH1,
  tipoH3,
  tipoBody,
} from './tipografia-kit'
import { eventTypeScale } from './tipografia'
import { PrintFonts } from '../printFonts'

/**
 * indice — the editorial **table-of-contents** wall (first used on print **5-S-1**,
 * the S5→S6 bridge, replacing the four-heading typographic piece).
 * ──────────────────────────────────────────────────────────────────────────
 * *Muy fino, muy simple.* A small index of the whole show, held to the **left** of a
 * wide, short wall (9.5 × 2.5 m), the rest left as quiet paper — a compact,
 * vertically-centred run of entries — `nº · title · deck` — each sitting under a
 * **short** hairline rule (the classic magazine «índice»). No masthead word, no
 * eyebrow, no footer, no accent: only the rooms and the lines. Hierarchy is by size,
 * not weight — the room concept leads as the title, the number is a quiet tabular
 * locator, the descriptive deck the muted support.
 *
 * Every level is sized by the pure, unit-tested `eventTypeScale` (a small
 * `titleCapFraction` keeps the whole index *small* on the big wall, yet each rendered
 * level still clears the museographic legibility floor for the reading distance).
 * Ground (paper / ink) follows `doc.theme`. Pure inline styles; authored in `geo`
 * units so it reads at print scale at any DPI.
 */

type IndexEntry = {
  /** Locator number, pre-formatted ("01", "02", …). */
  no: string
  /** Room title — the row protagonist. */
  title: string
  /** Supporting deck: phase · «message». */
  deck?: string
}

type Props = {
  /** Real reading distance to the wall (m) — drives the museographic type sizing. */
  readingDistanceM?: number
  /** The index entries, top→bottom. */
  entries?: IndexEntry[]
  /** Left inset as a fraction of the trim width (kept tight to the left edge). */
  marginXFraction?: number
  /** Index column width as a fraction of the trim width (kept narrow / left). */
  columnWidthFraction?: number
  /** Separator-rule length as a fraction of the trim width (kept short). */
  separatorWidthFraction?: number
  /** Entry-title cap-height as a fraction of the trim height (kept small). */
  titleCapFraction?: number
  /** Modular ratio between type levels. */
  ratio?: number
}

const DEFAULTS: Required<Props> = {
  readingDistanceM: 3,
  entries: [
    { no: '01', title: 'Disrupción sensorial', deck: 'El esfuerzo humano y su malinterpretación' },
    { no: '02', title: 'Del mito al dato', deck: 'Una experiencia de desmitificación técnica' },
    { no: '03', title: 'Velocidad de progreso', deck: 'Un paseo alrededor de la velocidad' },
    { no: '04', title: 'Ineficiencias del humano', deck: 'Sala de cine' },
    { no: '05', title: 'Cuellos de botella', deck: '¿Qué nos aleja de la bonanza absoluta?' },
    { no: '06', title: 'La historia se repite', deck: 'Validación histórica · «Ya pasó antes»' },
  ],
  marginXFraction: 0.02,
  columnWidthFraction: 0.28,
  separatorWidthFraction: 0.13,
  titleCapFraction: 0.016,
  ratio: 1.6,
}

export function Indice({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props

  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : DEFAULTS.readingDistanceM
  const entries = Array.isArray(p.entries) && p.entries.length > 0 ? p.entries : DEFAULTS.entries
  const marginXFraction = typeof p.marginXFraction === 'number' ? p.marginXFraction : DEFAULTS.marginXFraction
  const colFraction = typeof p.columnWidthFraction === 'number' ? p.columnWidthFraction : DEFAULTS.columnWidthFraction
  const sepFraction = typeof p.separatorWidthFraction === 'number' ? p.separatorWidthFraction : DEFAULTS.separatorWidthFraction
  const titleCapFraction = typeof p.titleCapFraction === 'number' ? p.titleCapFraction : DEFAULTS.titleCapFraction
  const ratio = typeof p.ratio === 'number' ? p.ratio : DEFAULTS.ratio

  const pal: TipoPalette = tipoPalette(doc.theme)

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const marginX = W * marginXFraction
  const colW = W * colFraction
  const ruleW = W * sepFraction

  // Small chord: the entry title leads, but kept small relative to the wall.
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, ratio, h1CapFraction: titleCapFraction })

  // A compact run of equal rows, vertically centred in the column.
  const rowH = scale.capHeights.h1Mm * 3.2
  const listH = rowH * entries.length
  const listTop = (H - listH) / 2
  const rowPadTop = scale.capHeights.h1Mm * 0.5

  // Number gutter — fixed so every title hangs on the same left edge.
  const gutter = mm(scale.capHeights.h3Mm * 4.5)

  const hairlineMm = 1.2
  const hairline: CSSProperties = { height: Math.max(1, mm(hairlineMm)), background: pal.hairline, width: mm(ruleW) }

  return (
    <>
      {/* print-owned @font-face (hairline cut); works in the app preview + export */}
      <PrintFonts />
      <TipoField pal={pal} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* ── the ruled index: equal rows, one short hairline per entry ── */}
        {entries.map((e, i) => {
          const top = listTop + i * rowH
          return (
            <div key={e.no} style={{ position: 'absolute', left: mm(marginX), top: mm(top), width: mm(colW) }}>
              {/* the (short) separating line */}
              <div style={hairline} />
              {/* number · title / deck */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, marginTop: mm(rowPadTop) }}>
                <span style={{ ...tipoH3(geo, scale.h3Pt, pal), width: gutter, flex: '0 0 auto', color: pal.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {e.no}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: mm(scale.capHeights.bodyMm * 0.7) }}>
                  <span style={{ ...tipoH1(geo, scale.h1Pt, pal), whiteSpace: 'nowrap' }}>{e.title}</span>
                  {e.deck && <span style={{ ...tipoBody(geo, scale.bodyPt, pal), color: pal.muted }}>{e.deck}</span>}
                </div>
              </div>
            </div>
          )
        })}

        {/* closing line under the last entry */}
        <div style={{ position: 'absolute', left: mm(marginX), top: mm(listTop + listH), ...hairline }} />
      </div>
    </>
  )
}
