import type { PrintPageProps } from '../types'
import { Sheet, Masthead, Footer, Arrow, type ArrowDir, display, PAPER, INK, BLUE } from './signage-kit'

/**
 * direccional — a junction / corridor wayfinding sign (A2 landscape). The
 * distributed wayfinding the fixed vertical directory can't give at every fork:
 * a short list of destinations, each with a thin-line arrow, and the act code in
 * blue tying the space back to the programme. Prop-driven rows.
 */

type Row = { text: string; arrow: ArrowDir; code?: string }
type Props = { rows?: Row[]; heading?: string }

const DEFAULT_ROWS: Row[] = [
  { text: 'Exposición', arrow: 'up', code: '001' },
  { text: 'Auditorio', arrow: 'up-right', code: '002' },
  { text: 'Acreditación', arrow: 'left' },
  { text: 'Cóctel y cena', arrow: 'right', code: '003' },
  { text: 'Aseos', arrow: 'down' },
]

export function Direccional({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const rows = p.rows && p.rows.length > 0 ? p.rows : DEFAULT_ROWS
  const heading = p.heading ?? 'Orientación'

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between">
      <Masthead geo={geo} left={heading} right="Finca El Olivar" />

      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: geo.mm(14),
              paddingTop: geo.mm(11),
              paddingBottom: geo.mm(11),
              borderBottom: i === rows.length - 1 ? 'none' : `${geo.mm(0.55)}px solid rgba(30,30,32,0.32)`,
            }}
          >
            <span style={{ ...display(geo, 30, 700), color: BLUE, width: geo.mm(46), flex: '0 0 auto', lineHeight: 1 }}>{r.code ?? ''}</span>
            <span style={{ ...display(geo, 66, 600), color: INK, flex: '1 1 auto', letterSpacing: geo.pt(-1.6) }}>{r.text}</span>
            <Arrow geo={geo} dir={r.arrow} sizeMm={50} color={INK} weight={5.5} />
          </div>
        ))}
      </div>

      <Footer geo={geo} left="AiKit Live · Finca El Olivar" right="live.aikit.io" sizePt={12} />
    </Sheet>
  )
}
