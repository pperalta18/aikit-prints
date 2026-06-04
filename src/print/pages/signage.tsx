import { KIT_BLUE, BRAND, TEXT_FONT } from '@/lib/neumorphism'
import { PrintSafeArea } from '../PrintRenderer'
import type { PrintGeometry } from '../geometry'
import type { PrintPageProps } from '../types'

/**
 * signage — a tall hanging wayfinding banner in the Swiss / International
 * Typographic style: a near-white sheet, a neutral grotesque, hairline rules,
 * lettered badges and thin line arrows, transport pictograms at the foot. The
 * editorial directory you see hung over the aisles of a trade-fair hall, here a
 * "AiKit Live" venue directory.
 *
 * The composition is the flat printable artwork (full bleed white), not the
 * photographic mock-up. Everything is laid out in physical units via `geo`, and
 * the whole row list is prop-driven (`doc.props.rows`) so it can be re-edited.
 */

type ArrowDir = 'up' | 'down' | 'left' | 'right' | 'up-right' | 'up-left' | 'none'
type PictoName = 'bus' | 'car' | 'train' | 'plane' | 'walk' | 'lift' | 'info' | 'wc'

type BadgeSpec = { text: string; color?: string; shape?: 'circle' | 'square' }

type Row = {
  type?: 'label' | 'badges' | 'pictos'
  /** Label text — use \n for explicit line breaks. */
  text?: string
  size?: 'lg' | 'md'
  badges?: BadgeSpec[]
  pictos?: PictoName[]
  arrow?: ArrowDir
  /** Draw a hairline rule beneath this row. */
  rule?: boolean
  /** Space above this row. */
  gap?: 'sm' | 'md' | 'lg'
}

type SignageProps = {
  rows?: Row[]
  brand?: string
  footer?: string
}

const INK = '#111114'
const MUTED = '#8c8c92'
const RED = BRAND.red // circle badges
const BLUE = KIT_BLUE // square badges

const b = (text: string, color: string = RED, shape: 'circle' | 'square' = 'circle'): BadgeSpec => ({
  text,
  color,
  shape,
})

/** Default directory — mirrors the reference's rhythm, themed as AiKit Live. */
const DEFAULT_ROWS: Row[] = [
  { type: 'label', text: 'Auditorio', gap: 'sm' },
  { type: 'badges', badges: [b('KEY', BLUE, 'square'), b('IA'), b('ML')], arrow: 'up', rule: true, gap: 'md' },
  { type: 'label', text: 'Talleres', arrow: 'up', rule: true, gap: 'md' },
  { type: 'label', text: 'Demos', gap: 'md' },
  { type: 'badges', badges: [b('API')], arrow: 'up', rule: true, gap: 'md' },
  { type: 'label', text: 'Networking', gap: 'lg' },
  { type: 'badges', badges: [b('DEV', BLUE, 'square'), b('OPS'), b('CS'), b('QA')], arrow: 'up', gap: 'md' },
  { type: 'label', text: 'Zona de\nPartners', gap: 'lg' },
  { type: 'badges', badges: [b('B2B'), b('CRM'), b('ERP')], gap: 'md' },
  { type: 'label', text: 'Prensa', gap: 'lg' },
  { type: 'label', text: 'VIP', arrow: 'up', rule: true, gap: 'sm' },
  { type: 'label', text: 'Entrada\nPrincipal', arrow: 'up', gap: 'md' },
  { type: 'pictos', pictos: ['bus', 'car'], arrow: 'up', gap: 'lg' },
]

export function Signage({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as SignageProps
  const rows = p.rows && p.rows.length > 0 ? p.rows : DEFAULT_ROWS
  const brand = p.brand ?? 'AiKit Live'
  const footer = p.footer ?? 'aikit.es'

  const gapPx = { sm: mm(16), md: mm(34), lg: mm(66) } as const

  return (
    <>
      {/* pure-white sheet, bleeding to the media edge */}
      <div style={{ position: 'absolute', inset: 0, background: '#ffffff' }} />

      <PrintSafeArea style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* directory rows */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => (
            <RowView key={i} r={r} geo={geo} gapPx={gapPx} first={i === 0} />
          ))}
        </div>

        {/* foot: fine brand line */}
        <div>
          <div style={{ height: mm(1.0), background: INK, width: '100%' }} />
          <div
            style={{
              marginTop: mm(8),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontFamily: TEXT_FONT,
              fontSize: pt(12),
              fontWeight: 600,
              letterSpacing: pt(1.4),
              textTransform: 'uppercase',
            }}
          >
            <span style={{ color: INK }}>{brand}</span>
            <span style={{ color: MUTED }}>{footer}</span>
          </div>
        </div>
      </PrintSafeArea>
    </>
  )
}

/* ── one directory row ─────────────────────────────────────────────────────── */

function RowView({
  r,
  geo,
  gapPx,
  first,
}: {
  r: Row
  geo: PrintGeometry
  gapPx: { sm: number; md: number; lg: number }
  first: boolean
}) {
  const { mm } = geo
  const type = r.type ?? 'label'
  const gap = first ? 0 : gapPx[r.gap ?? 'md']

  const left =
    type === 'label' ? (
      <Label geo={geo} text={r.text ?? ''} size={r.size ?? 'lg'} />
    ) : type === 'badges' ? (
      <div style={{ display: 'flex', gap: mm(6) }}>
        {(r.badges ?? []).map((bg, i) => (
          <Badge key={i} geo={geo} spec={bg} />
        ))}
      </div>
    ) : (
      <div style={{ display: 'flex', gap: mm(7) }}>
        {(r.pictos ?? []).map((name, i) => (
          <Picto key={i} geo={geo} name={name} />
        ))}
      </div>
    )

  return (
    <div style={{ marginTop: gap }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: mm(6) }}>
        <div style={{ flex: 1, minWidth: 0 }}>{left}</div>
        <div style={{ width: mm(52), display: 'flex', justifyContent: 'flex-end' }}>
          <Arrow geo={geo} dir={r.arrow ?? 'none'} />
        </div>
      </div>
      {r.rule && <div style={{ marginTop: mm(11), height: mm(1.0), background: INK, width: '100%' }} />}
    </div>
  )
}

function Label({ geo, text, size }: { geo: PrintGeometry; text: string; size: 'lg' | 'md' }) {
  const { mm, pt } = geo
  return (
    <div
      style={{
        fontFamily: TEXT_FONT,
        fontSize: size === 'lg' ? mm(46) : mm(32),
        fontWeight: 600,
        lineHeight: 1.02,
        letterSpacing: pt(-0.6),
        color: INK,
        whiteSpace: 'pre-line',
      }}
    >
      {text}
    </div>
  )
}

function Badge({ geo, spec }: { geo: PrintGeometry; spec: BadgeSpec }) {
  const { mm } = geo
  const size = mm(30)
  const long = (spec.text ?? '').length >= 3
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: spec.shape === 'square' ? mm(6) : '50%',
        background: spec.color ?? RED,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: TEXT_FONT,
        fontWeight: 700,
        fontSize: long ? mm(9.5) : mm(12.5),
        letterSpacing: long ? 0 : mm(0.2),
        lineHeight: 1,
      }}
    >
      {spec.text}
    </div>
  )
}

/* ── thin line arrow ───────────────────────────────────────────────────────── */

const ARROW_ROT: Record<string, number> = {
  up: 0,
  down: 180,
  left: -90,
  right: 90,
  'up-right': 45,
  'up-left': -45,
}

function Arrow({ geo, dir }: { geo: PrintGeometry; dir: ArrowDir }) {
  if (dir === 'none') return null
  const { mm } = geo
  const s = mm(34)
  const rot = ARROW_ROT[dir] ?? 0
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" style={{ transform: `rotate(${rot}deg)`, display: 'block' }}>
      <g stroke={INK} strokeWidth={4.5} strokeLinecap="butt" strokeLinejoin="miter" fill="none">
        <line x1={50} y1={92} x2={50} y2={13} />
        <path d="M 23 41 L 50 12 L 77 41" />
      </g>
    </svg>
  )
}

/* ── transport / facility pictograms (solid, inside a hairline square) ──────── */

function Picto({ geo, name }: { geo: PrintGeometry; name: PictoName }) {
  const { mm } = geo
  const box = mm(40)
  return (
    <div
      style={{
        width: box,
        height: box,
        border: `${mm(1.0)}px solid ${INK}`,
        borderRadius: mm(7),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={mm(26)} height={mm(26)} viewBox="0 0 100 100">
        <PictoGlyph name={name} />
      </svg>
    </div>
  )
}

function PictoGlyph({ name }: { name: PictoName }) {
  const f = { fill: INK }
  switch (name) {
    case 'bus':
      return (
        <g {...f}>
          <rect x={16} y={18} width={68} height={52} rx={9} />
          <rect x={23} y={27} width={25} height={18} rx={3} fill="#fff" />
          <rect x={52} y={27} width={25} height={18} rx={3} fill="#fff" />
          <rect x={18} y={54} width={64} height={6} fill="#fff" />
          <circle cx={31} cy={76} r={8} />
          <circle cx={69} cy={76} r={8} />
        </g>
      )
    case 'car':
      return (
        <g {...f}>
          <path d="M12 58 L23 38 Q26 32 34 32 L66 32 Q74 32 77 38 L88 58 L88 67 Q88 71 84 71 L16 71 Q12 71 12 67 Z" />
          <rect x={33} y={39} width={15} height={12} rx={2} fill="#fff" />
          <rect x={52} y={39} width={15} height={12} rx={2} fill="#fff" />
          <circle cx={30} cy={71} r={9} />
          <circle cx={70} cy={71} r={9} />
          <circle cx={30} cy={71} r={3.5} fill="#fff" />
          <circle cx={70} cy={71} r={3.5} fill="#fff" />
        </g>
      )
    case 'train':
      return (
        <g {...f}>
          <rect x={26} y={14} width={48} height={58} rx={12} />
          <rect x={32} y={24} width={36} height={20} rx={3} fill="#fff" />
          <circle cx={38} cy={58} r={5} fill="#fff" />
          <circle cx={62} cy={58} r={5} fill="#fff" />
          <line x1={36} y1={80} x2={24} y2={92} stroke={INK} strokeWidth={5} />
          <line x1={64} y1={80} x2={76} y2={92} stroke={INK} strokeWidth={5} />
        </g>
      )
    case 'plane':
      return (
        <g {...f}>
          <path d="M88 50 L57 46 L41 18 L33 18 L41 44 L20 41 L13 31 L7 31 L11 50 L7 69 L13 69 L20 59 L41 56 L33 82 L41 82 L57 54 L88 50 Z" />
        </g>
      )
    case 'walk':
      return (
        <g {...f}>
          <circle cx={54} cy={16} r={9} />
          <path d="M52 28 L60 50 L74 60 L70 68 L52 58 L48 48 L42 70 L54 86 L46 90 L32 74 L38 46 L30 56 L22 50 L26 44 L34 50 Z" />
        </g>
      )
    case 'lift':
      return (
        <g {...f}>
          <rect x={26} y={14} width={48} height={72} rx={6} />
          <path d="M50 24 L40 38 L60 38 Z" fill="#fff" />
          <path d="M50 76 L40 62 L60 62 Z" fill="#fff" />
        </g>
      )
    default:
      return (
        <>
          <circle cx={50} cy={50} r={38} fill={INK} />
          <text x={50} y={67} textAnchor="middle" fontSize={50} fontWeight={700} fill="#fff" fontFamily="sans-serif">
            {name === 'wc' ? 'W' : 'i'}
          </text>
        </>
      )
  }
}
