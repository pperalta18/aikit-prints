import type { PrintPageProps } from '../types'
import { Sheet, Masthead, Footer, Picto, Rule, display, eyebrow, text, PAPER, MUTED, RED } from './signage-kit'

/**
 * acceso-restringido — the private / restricted access sign (A3 portrait). Protects
 * backstage and the private zones of the venue, and underlines the closed-door
 * character of the summit. BRAND.red is the disciplined warning accent: a single red
 * rule and the lock glyph. Firm but elegant — no shouting, in keeping with a premium
 * private event.
 */

type Props = { title?: string; subtitle?: string; body?: string; tag?: string }

export function AccesoRestringido({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const title = p.title ?? 'Acceso\nprivado'
  const subtitle = p.subtitle ?? 'Solo invitados'
  const body = p.body ?? 'Cumbre a puerta cerrada. Más allá de este punto el acceso queda reservado al equipo y a los invitados acreditados.'
  const tag = p.tag ?? 'Zona reservada'

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between">
      <Masthead geo={geo} left={<span style={eyebrow(geo, 11, RED)}>{tag}</span>} />

      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* lock glyph + red rule */}
        <div style={{ display: 'flex', alignItems: 'center', gap: geo.mm(12), marginBottom: geo.mm(18) }}>
          <Picto geo={geo} name="lock" boxMm={40} glyphMm={26} color={RED} />
          <Rule geo={geo} w={1.4} color={RED} style={{ flex: '1 1 auto', width: 'auto' }} />
        </div>

        <div style={eyebrow(geo, 14, RED)}>{subtitle}</div>
        <h1 style={{ ...display(geo, 64, 600), margin: 0, marginTop: geo.mm(8), letterSpacing: geo.pt(-1.2), whiteSpace: 'pre-line', lineHeight: 1.02 }}>
          {title}
        </h1>
        <p style={{ ...text(geo, 15, 400), color: MUTED, maxWidth: geo.mm(230), marginTop: geo.mm(14), lineHeight: 1.42 }}>{body}</p>
      </div>

      <Footer geo={geo} left="AiKit Live" right="live.aikit.io" sizePt={11} />
    </Sheet>
  )
}
