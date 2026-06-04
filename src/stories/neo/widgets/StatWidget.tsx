import { BRAND, elevation, type BrandColor } from '@/lib/neumorphism'
import { useNeoTheme } from '../NeoTheme'
import { NeoCard } from './NeoCard'

export type StatWidgetProps = {
  /** UPPERCASE muted label above the number. */
  label?: string
  /** The headline value (the big number). */
  value?: string
  /** Signed percentage change (e.g. -98 or 12.4). Sign picks ▼/▲ + colour. */
  delta?: number
  /** Small caption next to the delta (e.g. "vs. mes pasado"). */
  deltaCaption?: string
  /** Optional tiny trend line drawn as a rounded polyline. */
  sparkline?: number[]
  /** Comparison "antes" value — turns the tile into before → after mode. */
  before?: string
  /** Comparison "después" value — turns the tile into before → after mode. */
  after?: string
  /** Accent colour for the comparison chip + sparkline. Default blue. */
  accent?: BrandColor
}

type Theme = ReturnType<typeof useNeoTheme>

/**
 * StatWidget — a single, punchy KPI tile.
 * ───────────────────────────────────────
 * Two moods on one calm plate:
 *  · metric  → UPPERCASE label · big number · ▲/▼ delta in green/red · tiny
 *              KIT_BLUE sparkline carved into a recessed well at the bottom.
 *  · comparison → "antes → después" with a highlighted delta chip, for when a
 *                 number drops off a cliff (que es justo lo que nos mola).
 * Picks comparison automatically when `before` + `after` are both set.
 * Re-lit live by the active NeoTheme like the rest of the gallery.
 */
export function StatWidget({
  label = 'Tiempo por contratación',
  value = '75 s',
  delta = -98,
  deltaCaption = 'vs. el proceso a mano',
  sparkline,
  before,
  after,
  accent = 'blue',
}: StatWidgetProps) {
  const theme = useNeoTheme()
  const accentColor = BRAND[accent]
  const isComparison = before != null && after != null

  return (
    <NeoCard width={240} center={false} padding={26} radius={26} style={{ gap: 16 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.6,
          color: theme.textMuted,
          textTransform: 'uppercase',
          lineHeight: 1.35,
        }}
      >
        {label}
      </span>

      {isComparison ? (
        <Comparison before={before!} after={after!} delta={delta} accent={accentColor} theme={theme} />
      ) : (
        <Metric value={value} delta={delta} deltaCaption={deltaCaption} theme={theme} />
      )}

      {!isComparison && sparkline && sparkline.length > 1 && (
        <Sparkline points={sparkline} color={accentColor} theme={theme} />
      )}
    </NeoCard>
  )
}

/* ── metric mode ─────────────────────────────────────────────────────── */

function Metric({
  value,
  delta,
  deltaCaption,
  theme,
}: {
  value: string
  delta: number
  deltaCaption?: string
  theme: Theme
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.8, color: theme.textStrong, lineHeight: 1 }}>
        {value}
      </span>
      <DeltaRow delta={delta} caption={deltaCaption} theme={theme} />
    </div>
  )
}

function DeltaRow({ delta, caption, theme }: { delta: number; caption?: string; theme: Theme }) {
  const up = delta >= 0
  const color = up ? BRAND.green : BRAND.red

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color, fontSize: 13, fontWeight: 700 }}>
        <Caret up={up} />
        {up ? '+' : '−'}
        {Math.abs(delta)}%
      </span>
      {caption && <span style={{ fontSize: 12, color: theme.textMuted, letterSpacing: -0.2 }}>{caption}</span>}
    </div>
  )
}

function Caret({ up }: { up: boolean }) {
  // Tiny solid triangle, rotated by mode. color = currentColor.
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
      <path d="M12 4 L21 19 L3 19 Z" fill="currentColor" />
    </svg>
  )
}

/* ── comparison mode ─────────────────────────────────────────────────── */

function Comparison({
  before,
  after,
  delta,
  accent,
  theme,
}: {
  before: string
  after: string
  delta: number
  accent: string
  theme: Theme
}) {
  const sign = delta >= 0 ? '+' : '−'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: theme.textMuted, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>
          {before}
        </span>
        <Arrow color={accent} />
        <span style={{ fontSize: 28, fontWeight: 700, color: theme.textStrong, letterSpacing: -0.8, whiteSpace: 'nowrap' }}>
          {after}
        </span>
      </div>
      <span
        style={{
          alignSelf: 'flex-start',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: -0.2,
          color: accent,
          background: `${accent}1f`,
          borderRadius: 999,
          padding: '4px 11px',
        }}
      >
        {sign}
        {Math.abs(delta)}%
      </span>
    </div>
  )
}

function Arrow({ color }: { color: string }) {
  return (
    <svg width="22" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M4 12 H19" />
      <path d="M13 6 L19 12 L13 18" />
    </svg>
  )
}

/* ── sparkline ───────────────────────────────────────────────────────── */

function Sparkline({ points, color, theme }: { points: number[]; color: string; theme: Theme }) {
  const W = 188
  const H = 38
  const PAD = 4
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const stepX = (W - PAD * 2) / (points.length - 1)

  const coords = points.map((p, i) => {
    const x = PAD + i * stepX
    const y = PAD + (1 - (p - min) / span) * (H - PAD * 2)
    return [x, y] as const
  })
  const poly = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]
  const well = elevation(theme, { depth: 'recessed', distance: 3, blur: 8, radius: 12 })

  return (
    <div style={{ padding: '9px 10px 7px', ...well }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={poly} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />
      </svg>
    </div>
  )
}
