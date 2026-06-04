import type { PrintPageProps } from '../types'
import { Sheet, Masthead, Footer, Rule, display, eyebrow, text, PAPER, INK, MUTED, BLUE } from './signage-kit'

/**
 * bienvenida — the entrance welcome board (A1 portrait, read from several metres).
 * The first impression of AiKit Live: the most sober, monumental piece of the
 * family. A small lockup up top, a deliberate empty channel, one huge Display
 * greeting, and a quiet meta footing (fecha · sede · acceso). Single blue focus on
 * the year, exactly as the programme masthead.
 */

type Props = { greeting?: string; eyebrowText?: string; year?: string }

export function Bienvenida({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const eyebrowText = p.eyebrowText ?? 'AiKit Live · Cumbre privada de IA'
  const year = p.year ?? '2026'

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between">
      {/* header — typographic locator strip (no logo: this is signage) */}
      <Masthead geo={geo} left="Cumbre a puerta cerrada" right="Alcalá de Henares · Madrid" />

      {/* the greeting block, lifted toward the upper-optical centre */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: geo.mm(56) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: geo.mm(7), marginBottom: geo.mm(14) }}>
          <span style={{ width: geo.mm(11), height: geo.mm(11), background: BLUE, flex: '0 0 auto' }} />
          <span style={eyebrow(geo, 15, INK)}>{eyebrowText}</span>
        </div>
        <h1 style={{ ...display(geo, 116, 600), margin: 0, letterSpacing: geo.pt(-2.4) }}>
          Te damos la
          <br />
          bienvenida.
        </h1>
        <p style={{ ...text(geo, 21, 400), color: MUTED, maxWidth: geo.mm(360), marginTop: geo.mm(18), lineHeight: 1.45 }}>
          Una jornada a puerta cerrada, en tres actos. Gracias por acompañarnos.
        </p>
      </div>

      {/* meta footing + brand line */}
      <div style={{ flex: '0 0 auto', width: '100%' }}>
        <Rule geo={geo} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: geo.mm(16), marginTop: geo.mm(14), marginBottom: geo.mm(22) }}>
          <Meta geo={geo} label="Fecha" value={<span>17 jun {year}</span>} />
          <Meta geo={geo} label="Sede" value="Finca El Olivar · Alcalá de Henares" />
          <Meta geo={geo} label="Acceso" value="Solo invitación · 150 plazas" align="right" />
        </div>
        <Footer geo={geo} left="AiKit Live" right="live.aikit.io" sizePt={13} />
      </div>
    </Sheet>
  )
}

function Meta({
  geo,
  label,
  value,
  align = 'left',
}: {
  geo: PrintPageProps['geo']
  label: string
  value: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <div style={{ textAlign: align, minWidth: 0 }}>
      <div style={eyebrow(geo, 11, MUTED)}>{label}</div>
      <div style={{ ...display(geo, 20, 600), marginTop: geo.mm(3), color: INK, lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}
