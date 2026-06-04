import type { PrintPageProps } from '../types'
import { Sheet, display, eyebrow, text, PAPER, INK, MUTED, BLUE } from './signage-kit'

/**
 * mesa — a dinner table numberer (A5 portrait, a tent card on the cloth). The huge
 * numeral is the whole piece; «Mesa» labels it and a quiet line ties it to the
 * third act (the private dinner, 003 · Contraste). Prop-driven number so one page
 * emits every table of the 150-guest seating.
 */

type Props = { number?: string; caption?: string }

export function Mesa({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const number = p.number ?? '07'
  const caption = p.caption ?? 'Cena privada · Acto 003 · Contraste'

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between" align="center">
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: geo.mm(5), marginBottom: geo.mm(6) }}>
          <span style={{ width: geo.mm(5.5), height: geo.mm(5.5), background: BLUE, flex: '0 0 auto' }} />
          <span style={eyebrow(geo, 13, INK)}>Mesa</span>
        </div>
        <div style={{ ...display(geo, 200, 600), color: INK, lineHeight: 0.9, letterSpacing: geo.pt(-4) }}>{number}</div>
      </div>

      <div style={{ flex: '0 0 auto', width: '100%', textAlign: 'center', paddingBottom: geo.mm(2) }}>
        <div style={{ ...text(geo, 10.5, 500), color: MUTED, letterSpacing: geo.pt(0.3) }}>{caption}</div>
      </div>
    </Sheet>
  )
}
