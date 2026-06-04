import { KIT_BLUE, DISPLAY_FONT, TEXT_FONT } from '@/lib/neumorphism'
import { AikitLogo } from '@/components/AikitLogo'
import { PrintSafeArea } from '../PrintRenderer'
import type { PrintGeometry } from '../geometry'
import type { PrintPageProps } from '../types'

/**
 * aikit-event-badge — event ID card in the flat, M22-inspired style from the brief:
 * near-black card, the AiKit lockup top-left, event label top-right, the signature
 * diagonal-dash texture (faded), the holder's identity as the hero, and contact at
 * the foot. Portrait, classic business-card size (55×85mm) as a placeholder. All
 * copy is prop-driven. Type is laid out in points so it reads at print scale.
 */

type EventBadgeProps = {
  eventName?: string
  eventMeta?: string
  name?: string
  role?: string
  email?: string
  url?: string
}

const INK = '#0c0c10'
const WHITE = '#f4f4f6'
const MUTED = 'rgba(244,244,246,0.50)'

export function AikitEventBadge({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as EventBadgeProps
  const eventName = p.eventName ?? 'AIKIT LIVE'
  const eventMeta = p.eventMeta ?? 'MADRID · 2026'
  const name = p.name ?? 'Pablo Peralta'
  const role = p.role ?? 'Fundador'
  const email = p.email ?? 'hola@aikit.es'
  const url = p.url ?? 'aikit.es'

  return (
    <>
      {/* full-bleed ink background (reaches the media edge) */}
      <div style={{ position: 'absolute', inset: 0, background: INK }} />

      <PrintSafeArea style={{ display: 'flex', flexDirection: 'column' }}>
        {/* header: lockup + event */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <AikitLogo tone="dark" height={mm(5.8)} style={{ marginTop: mm(0.6) }} />
          <div style={{ textAlign: 'right', fontFamily: TEXT_FONT, textTransform: 'uppercase' }}>
            <div style={{ fontSize: pt(8), fontWeight: 700, letterSpacing: pt(0.8), color: WHITE, lineHeight: 1, whiteSpace: 'nowrap' }}>{eventName}</div>
            <div style={{ fontSize: pt(6.2), fontWeight: 600, letterSpacing: pt(0.6), color: MUTED, marginTop: mm(1.1), whiteSpace: 'nowrap' }}>{eventMeta}</div>
          </div>
        </div>

        {/* signature texture */}
        <div style={{ marginTop: mm(6) }}>
          <HatchField geo={geo} widthPx={geo.trimWidthPx - 2 * geo.safeMarginPx} heightMm={24} />
        </div>

        <div style={{ flex: 1 }} />

        {/* identity — the hero */}
        <div>
          <div
            style={{
              display: 'inline-block',
              fontFamily: TEXT_FONT,
              fontSize: pt(8),
              fontWeight: 700,
              letterSpacing: pt(1.8),
              textTransform: 'uppercase',
              color: KIT_BLUE,
            }}
          >
            {role}
          </div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 800,
              fontSize: pt(22),
              color: WHITE,
              lineHeight: 0.98,
              letterSpacing: pt(-0.8),
              marginTop: mm(2.2),
            }}
          >
            {name}
          </div>
        </div>

        {/* footer: contact */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: mm(6),
            paddingTop: mm(3),
            borderTop: `${mm(0.25)}px solid rgba(244,244,246,0.14)`,
            fontFamily: TEXT_FONT,
            fontSize: pt(7),
            color: MUTED,
          }}
        >
          <div>{email}</div>
          <div>{url}</div>
        </div>
      </PrintSafeArea>
    </>
  )
}

/**
 * The brand texture: short, steep diagonal dashes on a regular grid, fading top→
 * bottom. Fills the available content width; height set in mm. Deterministic.
 */
function HatchField({ geo, widthPx, heightMm }: { geo: PrintGeometry; widthPx: number; heightMm: number }) {
  const { mm } = geo
  const W = widthPx
  const H = mm(heightMm)
  const gap = mm(2.05)
  const len = mm(1.75)
  const stroke = mm(0.3)
  const ang = (62 * Math.PI) / 180
  const dx = len * Math.cos(ang)
  const dy = len * Math.sin(ang)
  const rows = Math.floor((H - mm(1)) / gap)
  const lines: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    const y = mm(1) + r * gap
    const alpha = 0.3 - (0.3 - 0.1) * (r / Math.max(1, rows - 1)) // fade down
    const color = `rgba(244,244,246,${alpha.toFixed(3)})`
    for (let x = mm(1); x < W - dx; x += gap) {
      lines.push(
        <line key={`${r}-${x.toFixed(1)}`} x1={x} y1={y + dy} x2={x + dx} y2={y} stroke={color} strokeWidth={stroke} strokeLinecap="round" />,
      )
    }
  }
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      {lines}
    </svg>
  )
}
