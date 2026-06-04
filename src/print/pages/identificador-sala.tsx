import type { PrintPageProps } from '../types'
import { Sheet, Masthead, Footer, Arrow, type ArrowDir, display, eyebrow, text, PAPER, INK, MUTED, BLUE } from './signage-kit'

/**
 * identificador-sala — a door / space placard (A3 portrait). One reusable template
 * that emits any room of the venue: an act badge (001/002/003), a huge space name,
 * a one-line descriptor, and an optional direction arrow. Default = «Exposición»,
 * the 001 · Contexto room. Prop-driven so the same page renders Auditorio,
 * Networking, Comedor, Guardarropa… by editing doc.props.
 */

type Props = {
  name?: string
  code?: string
  act?: string
  descriptor?: string
  arrow?: ArrowDir
  arrowLabel?: string
}

export function IdentificadorSala({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const name = p.name ?? 'Exposición'
  const code = p.code ?? '001'
  const act = p.act ?? 'Contexto'
  const descriptor = p.descriptor ?? 'Recorrido inmersivo por los patrones del nuevo paradigma.'
  const arrow = p.arrow ?? 'none'
  const arrowLabel = p.arrowLabel ?? 'Acceso'

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between">
      <Masthead geo={geo} left="Sala" />

      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: geo.mm(40) }}>
        {/* act badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: geo.mm(8), marginBottom: geo.mm(14) }}>
          <span style={{ ...display(geo, 30, 700), color: BLUE, lineHeight: 1 }}>{code}</span>
          <span style={{ width: geo.mm(0.6), height: geo.mm(15), background: 'rgba(30,30,32,0.3)' }} />
          <span style={eyebrow(geo, 13, INK)}>{act}</span>
        </div>

        {/* the space name — the dominant element */}
        <h1 style={{ ...display(geo, 70, 600), margin: 0, letterSpacing: geo.pt(-1.4) }}>{name}</h1>

        {/* descriptor */}
        <p style={{ ...text(geo, 16, 400), color: MUTED, maxWidth: geo.mm(230), marginTop: geo.mm(12), lineHeight: 1.4 }}>{descriptor}</p>

        {/* optional direction */}
        {arrow !== 'none' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: geo.mm(10), marginTop: geo.mm(24) }}>
            <Arrow geo={geo} dir={arrow} sizeMm={30} color={INK} />
            <span style={eyebrow(geo, 13, INK)}>{arrowLabel}</span>
          </div>
        )}
      </div>

      <Footer geo={geo} left="AiKit Live" right="live.aikit.io" sizePt={11} />
    </Sheet>
  )
}
