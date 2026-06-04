import type { CSSProperties, ReactNode } from 'react'
import { KIT_BLUE, BRAND, DISPLAY_FONT, TEXT_FONT } from '@/lib/neumorphism'
import type { PrintGeometry } from '../geometry'

/**
 * signage-kit — the shared visual language of the AiKit Live signage family.
 * ──────────────────────────────────────────────────────────────────────────
 * Every wayfinding / identification piece of the event (bienvenida, direccional,
 * identificador-sala, acreditación, aseos, acceso-restringido, wifi, mesa) is
 * composed from these primitives so the whole set reads as ONE system: the Swiss /
 * International register already set by `signage.tsx` — pure paper, a neutral
 * grotesque, hairline rules, a small "AiKit Live" lockup, thin-line arrows, solid
 * pictograms inside filete squares, lettered/numbered codes, KIT_BLUE as the single
 * disciplined accent (BRAND.red for warnings).
 *
 * Sizing rule (same as the rest of the print system): everything is authored in
 * physical units through `geo` — `geo.mm()` for layout, `geo.pt()` for type — so a
 * piece reads correctly at print scale at any format (A1 board → A5 card).
 */

/* ── palette ─────────────────────────────────────────────────────────────────── */
export const PAPER = '#ffffff'
export const INK = '#111114'
export const INK_SOFT = '#1e1e20'
export const MUTED = '#6c6c89'
export const FAINT = '#a7a7bd'
export const BLUE = KIT_BLUE
export const RED = BRAND.red

/* ── type scale (factories sized in points via geo) ───────────────────────────── */

/** Big Display titling. */
export function display(geo: PrintGeometry, sizePt: number, weight = 600): CSSProperties {
  return {
    fontFamily: DISPLAY_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.0,
    letterSpacing: geo.pt(-sizePt * 0.022),
    color: INK,
  }
}

/** Body / label text. */
export function text(geo: PrintGeometry, sizePt: number, weight = 400): CSSProperties {
  return {
    fontFamily: TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.32,
    color: INK,
  }
}

/** Uppercase, tracked eyebrow / kicker. */
export function eyebrow(geo: PrintGeometry, sizePt: number, color: string = MUTED): CSSProperties {
  return {
    fontFamily: TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: 700,
    letterSpacing: geo.pt(sizePt * 0.16),
    textTransform: 'uppercase',
    color,
  }
}

/* ── sheet: paper bled to the media edge + a trim/safe content layer ──────────── */

/**
 * Sheet — paints the paper to the media edge and lays a safe-area flex column on
 * top (masthead → body → footer). `geo` is taken as a prop (no context needed), so
 * the kit is portable. Children fill the middle; pass `masthead` / `footer` slots.
 */
export function Sheet({
  geo,
  paper = PAPER,
  masthead,
  footer,
  children,
  justify = 'space-between',
  align = 'stretch',
  style,
}: {
  geo: PrintGeometry
  paper?: string
  masthead?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  justify?: CSSProperties['justifyContent']
  align?: CSSProperties['alignItems']
  style?: CSSProperties
}) {
  const inset = geo.bleedPx + geo.safeMarginPx
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: paper }} />
      <div
        style={{
          position: 'absolute',
          left: inset,
          top: inset,
          right: inset,
          bottom: inset,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: justify,
          alignItems: align,
          ...style,
        }}
      >
        {masthead}
        {children}
        {footer}
      </div>
    </>
  )
}

/** A full-width hairline rule. `w` in mm (default ~1mm to read at distance). */
export function Rule({ geo, color = INK, w = 1.0, style }: { geo: PrintGeometry; color?: string; w?: number; style?: CSSProperties }) {
  return <div style={{ height: geo.mm(w), background: color, width: '100%', flex: '0 0 auto', ...style }} />
}

/* ── header: a purely TYPOGRAPHIC locator strip (no logo) ─────────────────────── */

/**
 * This is signage, not a poster — so the header carries NO brand lockup, just a
 * thin locator strip (a section label + an optional place/locator) over a hairline.
 * The only brand presence in the system is the discreet typographic line in `Footer`.
 * `left` / `right` accept a string (rendered as an eyebrow) or a custom node.
 */
export function Masthead({
  geo,
  left,
  right,
  rule = true,
  sizePt = 11,
}: {
  geo: PrintGeometry
  left?: ReactNode
  right?: ReactNode
  rule?: boolean
  sizePt?: number
}) {
  const lbl = (node: ReactNode, color: string) =>
    typeof node === 'string' || typeof node === 'number' ? <span style={eyebrow(geo, sizePt, color)}>{node}</span> : node
  const hasRow = left != null || right != null
  return (
    <div style={{ flex: '0 0 auto', width: '100%' }}>
      {hasRow && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: geo.mm(8),
            marginBottom: rule ? geo.mm(sizePt * 0.5) : 0,
          }}
        >
          {lbl(left ?? '', INK)}
          {lbl(right ?? '', MUTED)}
        </div>
      )}
      {rule && <Rule geo={geo} />}
    </div>
  )
}

/* ── footer: hairline rule + brand left · url right ───────────────────────────── */

export function Footer({
  geo,
  left = 'AiKit Live',
  right = 'live.aikit.io',
  sizePt = 12,
  rule = true,
}: {
  geo: PrintGeometry
  left?: ReactNode
  right?: ReactNode
  sizePt?: number
  rule?: boolean
}) {
  return (
    <div style={{ flex: '0 0 auto', width: '100%' }}>
      {rule && <Rule geo={geo} />}
      <div
        style={{
          marginTop: geo.mm(sizePt * 0.5),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: geo.mm(8),
        }}
      >
        <span style={{ ...eyebrow(geo, sizePt, INK), letterSpacing: geo.pt(sizePt * 0.12) }}>{left}</span>
        <span style={{ ...eyebrow(geo, sizePt, MUTED), letterSpacing: geo.pt(sizePt * 0.12) }}>{right}</span>
      </div>
    </div>
  )
}

/* ── code chip: square blue / circle red badge with siglas, or an act number ──── */

export function CodeChip({
  geo,
  code,
  color = BLUE,
  shape = 'square',
  sizeMm = 30,
}: {
  geo: PrintGeometry
  code: string
  color?: string
  shape?: 'square' | 'circle'
  sizeMm?: number
}) {
  const size = geo.mm(sizeMm)
  const long = code.length >= 3
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: shape === 'square' ? geo.mm(sizeMm * 0.2) : '50%',
        background: color,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: TEXT_FONT,
        fontWeight: 700,
        fontSize: geo.mm(sizeMm * (long ? 0.32 : 0.42)),
        letterSpacing: long ? 0 : geo.mm(sizeMm * 0.01),
        lineHeight: 1,
        flex: '0 0 auto',
      }}
    >
      {code}
    </div>
  )
}

/* ── thin-line arrow (tallo + cabeza en V), all 8 directions ──────────────────── */

export type ArrowDir = 'up' | 'down' | 'left' | 'right' | 'up-right' | 'up-left' | 'down-right' | 'down-left' | 'none'

const ARROW_ROT: Record<string, number> = {
  up: 0,
  down: 180,
  left: -90,
  right: 90,
  'up-right': 45,
  'up-left': -45,
  'down-right': 135,
  'down-left': -135,
}

export function Arrow({
  geo,
  dir,
  sizeMm = 34,
  color = INK,
  weight = 4.5,
}: {
  geo: PrintGeometry
  dir: ArrowDir
  sizeMm?: number
  color?: string
  /** Stroke weight in the 0–100 viewBox space. */
  weight?: number
}) {
  if (dir === 'none') return null
  const s = geo.mm(sizeMm)
  const rot = ARROW_ROT[dir] ?? 0
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" style={{ transform: `rotate(${rot}deg)`, display: 'block', flex: '0 0 auto' }}>
      <g stroke={color} strokeWidth={weight} strokeLinecap="butt" strokeLinejoin="miter" fill="none">
        <line x1={50} y1={92} x2={50} y2={13} />
        <path d="M 23 41 L 50 12 L 77 41" />
      </g>
    </svg>
  )
}

/* ── pictograms: solid glyphs inside a hairline filete square ─────────────────── */

export type PictoName =
  | 'bus'
  | 'car'
  | 'train'
  | 'plane'
  | 'walk'
  | 'lift'
  | 'wc-men'
  | 'wc-women'
  | 'accessible'
  | 'lock'
  | 'wifi'
  | 'info'
  | 'coat'
  | 'cutlery'

export function Picto({
  geo,
  name,
  boxMm = 40,
  color = INK,
  glyphMm,
  framed = true,
}: {
  geo: PrintGeometry
  name: PictoName
  boxMm?: number
  color?: string
  glyphMm?: number
  framed?: boolean
}) {
  const box = geo.mm(boxMm)
  const gl = geo.mm(glyphMm ?? boxMm * 0.65)
  return (
    <div
      style={{
        width: box,
        height: box,
        border: framed ? `${geo.mm(boxMm * 0.025)}px solid ${color}` : 'none',
        borderRadius: framed ? geo.mm(boxMm * 0.17) : 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
      }}
    >
      <svg width={gl} height={gl} viewBox="0 0 100 100">
        <PictoGlyph name={name} color={color} />
      </svg>
    </div>
  )
}

export function PictoGlyph({ name, color = INK }: { name: PictoName; color?: string }) {
  const f = { fill: color }
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
          <line x1={36} y1={80} x2={24} y2={92} stroke={color} strokeWidth={5} />
          <line x1={64} y1={80} x2={76} y2={92} stroke={color} strokeWidth={5} />
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
    case 'wc-men':
      // Unambiguous male restroom figure: round head, straight torso, two trouser
      // legs with a clear central gap (no flare that could read as a skirt).
      return (
        <g {...f}>
          <circle cx={50} cy={15} r={9.5} />
          <rect x={39} y={28} width={22} height={30} rx={4} />
          <rect x={41.5} y={56} width={7.5} height={36} rx={2} />
          <rect x={51} y={56} width={7.5} height={36} rx={2} />
        </g>
      )
    case 'wc-women':
      // Female restroom figure: round head, clean triangular dress, two legs below.
      return (
        <g {...f}>
          <circle cx={50} cy={15} r={9.5} />
          <path d="M50 26 L34 64 L66 64 Z" />
          <rect x={45} y={64} width={4} height={28} rx={1.5} />
          <rect x={51} y={64} width={4} height={28} rx={1.5} />
        </g>
      )
    case 'accessible':
      // International Symbol of Access: a seated figure of profile over a clear wheel.
      return (
        <>
          <circle cx={48} cy={61} r={25} fill="none" stroke={color} strokeWidth={5} />
          <g {...f}>
            <circle cx={44} cy={16} r={8} />
            <path d="M39 25 L39 47 Q39 51 43 51 L62 51 L73 78 L66.5 81 L57 56 L43 56 Q34 56 34 47 L34 27 Z" />
          </g>
        </>
      )
    case 'lock':
      return (
        <g {...f}>
          <path d="M34 44 L34 34 Q34 18 50 18 Q66 18 66 34 L66 44" fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
          <rect x={26} y={44} width={48} height={42} rx={7} />
          <circle cx={50} cy={61} r={6} fill="#fff" />
          <rect x={47} y={61} width={6} height={14} rx={3} fill="#fff" />
        </g>
      )
    case 'wifi':
      return (
        <g fill="none" stroke={color} strokeLinecap="round">
          <path d="M22 46 Q50 22 78 46" strokeWidth={8} />
          <path d="M33 58 Q50 43 67 58" strokeWidth={8} />
          <circle cx={50} cy={74} r={6} fill={color} stroke="none" />
        </g>
      )
    case 'info':
      return (
        <g {...f}>
          <circle cx={50} cy={50} r={38} />
          <circle cx={50} cy={33} r={6} fill="#fff" />
          <rect x={45} y={44} width={10} height={28} rx={3} fill="#fff" />
        </g>
      )
    case 'coat':
      return (
        <g fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M50 30 Q40 30 40 22 Q40 16 50 16 Q58 16 58 24" />
          <path d="M50 32 L20 56 Q16 60 22 62 L78 62 Q84 60 80 56 Z" fill={color} stroke="none" />
        </g>
      )
    case 'cutlery':
      return (
        <g {...f}>
          <rect x={30} y={14} width={6} height={72} rx={3} />
          <path d="M24 14 L24 34 Q24 40 30 40 L36 40 L36 14 L33 14 L33 33 L31 33 L31 14 L29 14 L29 33 L27 33 L27 14 Z" />
          <path d="M66 14 Q56 14 56 38 Q56 50 64 52 L64 86 L70 86 L70 52 Q78 50 78 38 Q78 14 66 14 Z" />
        </g>
      )
    default:
      return null
  }
}
