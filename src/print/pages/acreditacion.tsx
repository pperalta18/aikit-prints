import type { PrintPageProps } from '../types'
import { Sheet, Masthead, Footer, Rule, display, eyebrow, text, PAPER, INK, MUTED, BLUE } from './signage-kit'

/**
 * acreditacion — the check-in desk sign (A2 portrait, read at the counter).
 * Title «Acreditación», three numbered steps for the guest, and a quiet note
 * about the pase. Hospitable and premium: the blue threads the step numerals so
 * the eye walks the sequence; everything else is ink on clean white paper.
 */

type Step = { n: string; title: string; body: string }
type Props = { steps?: Step[]; note?: string; hours?: string }

const DEFAULT_STEPS: Step[] = [
  { n: '01', title: 'Identifícate', body: 'Indica tu nombre o muestra tu invitación. Encontraremos tu plaza en la lista.' },
  { n: '02', title: 'Recoge tu pase', body: 'Te entregamos la credencial personal con tu nombre y acceso. Llévala visible.' },
  { n: '03', title: 'Accede a la cumbre', body: 'Pasa a la zona de exposición. El primer acto comienza a las 18:00.' },
]

export function Acreditacion({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const steps = p.steps && p.steps.length > 0 ? p.steps : DEFAULT_STEPS
  const note = p.note ?? 'Tu pase es nominal e intransferible. Consérvalo durante toda la jornada.'
  const hours = p.hours ?? 'Apertura de puertas 17:00'

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between">
      <Masthead geo={geo} left="Recepción · Acceso" />

      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* title */}
        <div style={{ marginBottom: geo.mm(16) }}>
          <div style={eyebrow(geo, 13, MUTED)}>Registro de invitados</div>
          <h1 style={{ ...display(geo, 74, 600), margin: 0, marginTop: geo.mm(6) }}>Acreditación</h1>
          <div style={{ ...text(geo, 15, 500), color: BLUE, marginTop: geo.mm(8), fontWeight: 600, letterSpacing: geo.pt(0.3) }}>{hours}</div>
        </div>

        <Rule geo={geo} w={0.5} color="rgba(30,30,32,0.35)" />

        {/* numbered steps */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: geo.mm(10) }}>
          {steps.map((s, i) => (
            <StepRow key={s.n} geo={geo} step={s} last={i === steps.length - 1} />
          ))}
        </div>
      </div>

      {/* note + footer */}
      <div style={{ flex: '0 0 auto', width: '100%' }}>
        <div style={{ ...text(geo, 13, 400), color: MUTED, marginBottom: geo.mm(16), maxWidth: geo.mm(300) }}>{note}</div>
        <Footer geo={geo} left="AiKit Live · Acreditación" right="live.aikit.io" sizePt={12} />
      </div>
    </Sheet>
  )
}

function StepRow({ geo, step, last }: { geo: PrintPageProps['geo']; step: Step; last: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: geo.mm(16),
        alignItems: 'flex-start',
        paddingTop: geo.mm(14),
        paddingBottom: geo.mm(14),
        borderBottom: last ? 'none' : `${geo.mm(0.45)}px solid rgba(30,30,32,0.3)`,
      }}
    >
      <span style={{ ...display(geo, 32, 700), color: BLUE, width: geo.mm(36), flex: '0 0 auto', lineHeight: 1 }}>{step.n}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...display(geo, 25, 600), color: INK }}>{step.title}</div>
        <div style={{ ...text(geo, 18, 400), color: MUTED, marginTop: geo.mm(5), maxWidth: geo.mm(300), lineHeight: 1.4 }}>{step.body}</div>
      </div>
    </div>
  )
}
