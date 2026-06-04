import type { PrintPageProps } from '../types'
import { Sheet, Footer, Picto, display, eyebrow, text, PAPER, INK, MUTED, BLUE } from './signage-kit'

/**
 * wifi — the network access card (A5 portrait, read in hand or on a table). A blue
 * wifi glyph as the single focus, then the two things that matter at body size: the
 * network and the password. Prop-driven so credentials are edited without a recompile.
 */

type Props = { ssid?: string; password?: string; title?: string; hint?: string }

export function Wifi({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const ssid = p.ssid ?? 'AiKit Live'
  const password = p.password ?? 'contraste2026'
  const title = p.title ?? 'Conéctate'
  const hint = p.hint ?? 'Red abierta para invitados durante la jornada.'

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between">
      {/* header: glyph + title */}
      <div style={{ flex: '0 0 auto' }}>
        <Picto geo={geo} name="wifi" boxMm={26} glyphMm={16} color={BLUE} />
        <div style={{ ...eyebrow(geo, 11, MUTED), marginTop: geo.mm(9) }}>Conexión WiFi</div>
        <h1 style={{ ...display(geo, 40, 600), margin: 0, marginTop: geo.mm(4) }}>{title}</h1>
      </div>

      {/* credentials */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: geo.mm(12) }}>
        <Field geo={geo} label="Red" value={ssid} />
        <Field geo={geo} label="Contraseña" value={password} mono />
      </div>

      {/* hint + footer */}
      <div style={{ flex: '0 0 auto', width: '100%' }}>
        <div style={{ ...text(geo, 10, 400), color: MUTED, marginBottom: geo.mm(8), lineHeight: 1.35 }}>{hint}</div>
        <Footer geo={geo} left="AiKit Live" right="live.aikit.io" sizePt={9} />
      </div>
    </Sheet>
  )
}

function Field({ geo, label, value, mono = false }: { geo: PrintPageProps['geo']; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={eyebrow(geo, 10, MUTED)}>{label}</div>
      <div
        style={{
          ...display(geo, 26, 600),
          color: INK,
          marginTop: geo.mm(3),
          letterSpacing: mono ? geo.pt(0.5) : geo.pt(-0.3),
          fontVariantNumeric: 'tabular-nums',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
      <div style={{ height: geo.mm(0.5), background: 'rgba(30,30,32,0.3)', marginTop: geo.mm(7) }} />
    </div>
  )
}
