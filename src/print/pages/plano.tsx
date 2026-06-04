import type { PrintPageProps } from '../types'
import { Sheet, Masthead, Footer, display, eyebrow, text, PAPER, INK, MUTED, BLUE } from './signage-kit'

/**
 * plano — «Estás aquí» as an editorial journey (A2 landscape). Rather than invent a
 * literal floor plan, the venue is read as the sequence of the evening: a horizontal
 * axis of nodes (Llegada → Acreditación → Exposición → Keynotes → Cóctel → Cena),
 * grouped by the three acts, with the current point marked in blue. Honest, premium,
 * unmistakably part of the system. Prop-driven nodes.
 */

type Node = { time: string; name: string; act: string; here?: boolean }
type Act = { code: string; name: string; span: number }
type Props = { nodes?: Node[]; acts?: Act[]; heading?: string }

const DEFAULT_NODES: Node[] = [
  { time: '17:00', name: 'Llegada', act: '001' },
  { time: '17:00', name: 'Acreditación', act: '001', here: true },
  { time: '18:00', name: 'Exposición', act: '001' },
  { time: '19:00', name: 'Ponencias', act: '002' },
  { time: '21:30', name: 'Cóctel', act: '003' },
  { time: '22:00', name: 'Cena', act: '003' },
]

const DEFAULT_ACTS: Act[] = [
  { code: '001', name: 'Contexto', span: 3 },
  { code: '002', name: 'Diagnóstico', span: 1 },
  { code: '003', name: 'Contraste', span: 2 },
]

export function Plano({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const nodes = p.nodes && p.nodes.length > 0 ? p.nodes : DEFAULT_NODES
  const acts = p.acts && p.acts.length > 0 ? p.acts : DEFAULT_ACTS
  const heading = p.heading ?? 'Recorrido de la jornada'

  const dotR = geo.mm(4.5)
  const hereR = geo.mm(7)
  const lineW = geo.mm(0.8)

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between">
      <Masthead geo={geo} left={heading} right="Finca El Olivar" />

      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* title */}
        <h1 style={{ ...display(geo, 56, 600), margin: 0, marginBottom: geo.mm(30), letterSpacing: geo.pt(-1.4) }}>
          Estás <span style={{ color: BLUE }}>aquí</span>
        </h1>

        {/* the axis of nodes */}
        <div style={{ position: 'relative', paddingLeft: geo.mm(4), paddingRight: geo.mm(4) }}>
          <div style={{ position: 'absolute', left: geo.mm(4), right: geo.mm(4), bottom: hereR - lineW / 2, height: lineW, background: 'rgba(30,30,32,0.34)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            {nodes.map((n, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flex: '1 1 0', minWidth: 0 }}>
                {n.here && (
                  <div
                    style={{
                      ...eyebrow(geo, 10, '#fff'),
                      background: BLUE,
                      padding: `${geo.mm(2.5)}px ${geo.mm(6)}px`,
                      borderRadius: geo.mm(2),
                      marginBottom: geo.mm(8),
                      letterSpacing: geo.pt(0.8),
                    }}
                  >
                    Estás aquí
                  </div>
                )}
                <div style={{ ...display(geo, 22, 600), color: n.here ? BLUE : INK }}>{n.time}</div>
                <div style={{ ...text(geo, 14, 500), color: n.here ? INK : MUTED, marginTop: geo.mm(2), marginBottom: geo.mm(11), textAlign: 'center' }}>{n.name}</div>
                <div
                  style={{
                    width: n.here ? hereR * 2 : dotR * 2,
                    height: n.here ? hereR * 2 : dotR * 2,
                    borderRadius: '50%',
                    background: n.here ? BLUE : PAPER,
                    border: n.here ? 'none' : `${geo.mm(1)}px solid ${INK}`,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* act groupings */}
        <div style={{ display: 'flex', marginTop: geo.mm(18), gap: geo.mm(2) }}>
          {acts.map((a) => (
            <div key={a.code} style={{ flex: `${a.span} ${a.span} 0`, minWidth: 0 }}>
              <div style={{ height: lineW, background: 'rgba(30,30,32,0.3)' }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: geo.mm(6), marginTop: geo.mm(6) }}>
                <span style={{ ...display(geo, 16, 700), color: INK }}>{a.code}</span>
                <span style={eyebrow(geo, 10, MUTED)}>{a.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Footer geo={geo} left="AiKit Live · Finca El Olivar" right="live.aikit.io" sizePt={12} />
    </Sheet>
  )
}
