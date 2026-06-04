import type { PrintPageProps } from '../types'
import { Sheet, Masthead, Footer, Picto, Arrow, type ArrowDir, type PictoName, display, eyebrow, text, PAPER, INK, MUTED, BLUE } from './signage-kit'

/**
 * llegada — the arrival / parking sign at the gate of the finca (A2 landscape). The
 * first physical contact: a monumental «Llegada» with the address on the left, and
 * on the right the two directives that matter on arrival — where to park and where
 * to walk in — each a solid pictogram + thin-line arrow. Single blue tick accent.
 */

type Directive = { picto: PictoName; label: string; sub: string; arrow: ArrowDir }
type Props = { directives?: Directive[]; address?: string; when?: string }

const DEFAULT_DIRECTIVES: Directive[] = [
  { picto: 'car', label: 'Aparcamiento', sub: 'Reservado a invitados', arrow: 'right' },
  { picto: 'walk', label: 'Recepción', sub: 'Acreditación y entrada', arrow: 'up' },
]

export function Llegada({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const directives = p.directives && p.directives.length > 0 ? p.directives : DEFAULT_DIRECTIVES
  const address = p.address ?? 'Camino del Olivar, 9 · 28806 Alcalá de Henares'
  const when = p.when ?? '17 jun 2026 · desde las 17:00'

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between">
      <Masthead geo={geo} left="Acceso a la sede" right="Finca El Olivar" />

      <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: geo.mm(28) }}>
        {/* left — the place */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: geo.mm(7), marginBottom: geo.mm(10) }}>
            <span style={{ width: geo.mm(8), height: geo.mm(8), background: BLUE, flex: '0 0 auto' }} />
            <span style={eyebrow(geo, 13, INK)}>Finca El Olivar</span>
          </div>
          <h1 style={{ ...display(geo, 88, 600), margin: 0, letterSpacing: geo.pt(-2) }}>Llegada</h1>
          <div style={{ ...text(geo, 15, 500), color: INK, marginTop: geo.mm(12) }}>{address}</div>
          <div style={{ ...text(geo, 14, 400), color: MUTED, marginTop: geo.mm(4) }}>{when}</div>
        </div>

        {/* right — the two directives */}
        <div style={{ flex: '0 0 auto', width: geo.mm(228), display: 'flex', flexDirection: 'column', gap: geo.mm(14) }}>
          {directives.map((d, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: geo.mm(14),
                paddingTop: geo.mm(14),
                borderTop: `${geo.mm(0.6)}px solid rgba(30,30,32,0.32)`,
              }}
            >
              <Picto geo={geo} name={d.picto} boxMm={34} glyphMm={22} color={INK} />
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ ...display(geo, 30, 600), color: INK }}>{d.label}</div>
                <div style={{ ...text(geo, 12.5, 400), color: MUTED, marginTop: geo.mm(2) }}>{d.sub}</div>
              </div>
              <Arrow geo={geo} dir={d.arrow} sizeMm={32} color={INK} weight={5} />
            </div>
          ))}
        </div>
      </div>

      <Footer geo={geo} left="AiKit Live" right="live.aikit.io" sizePt={12} />
    </Sheet>
  )
}
