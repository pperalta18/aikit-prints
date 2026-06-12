import type { CSSProperties } from 'react'
import type { PrintPageProps, PrintTheme } from '../types'
import type { PrintGeometry } from '../geometry'
import { PrintFonts, PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { ringLayout, MONEY_FORMATTERS, type Ring } from './mercado-tiempo'

/**
 * MercadoTiempo — «El valor de mercado de la IA, año a año» (free-standing, ~12-S-1 size).
 * ──────────────────────────────────────────────────────────────────────────
 * The AI **sphere** from the «Galaxia de mercados» walls, drawn THROUGH TIME: one
 * concentric circle per year (2019 → 2026, area ∝ the combined valuation of the frontier
 * labs that year), so the eye reads the growth as rings expanding outward, PLUS a dashed
 * **2027** ring — where the trend lands if you read the printed data as an exponential
 * (`projectExponential`). To the right of the rings, a ladder of year tooltips, each in
 * its ring's brand colour, connected to its ring by a fine radial leader.
 *
 * Editorial register (per the room): clean white ground, flat shapes, no gradients/glow;
 * one brand colour per year (oldest cool → newest brand-blue, the projection a lighter
 * blue); the area is the honesty (`mercado-tiempo.ts`), the inner specks enlarged so they
 * read, never faked. One explanatory title, no footer.
 *
 * `doc.props`: centerXFrac · centerYFrac · maxRadiusFrac (of trim height) ·
 * columnXFrac (left edge of the tooltip ladder) · title · numberFormat
 * ('es' long-scale «B»=billón, default · 'us' short-scale «T»/«B» American).
 */

export const MARKET_MAX_RADIUS_FRAC = 0.345
// Inner floor + gap: the pre-2024 years are a speck at honest area scale and would
// collapse into one tangle at the centre. We fan them out to a legible minimum spacing
// while the big years — where the growth is — stay area-true.
export const MARKET_MIN_INNER_RADIUS_MM = 40
export const MARKET_MIN_GAP_MM = 32
/** The projection ring (2027) — a lighter KIT_BLUE so it reads as future, not data. */
const PROJECTED_BLUE = '#6aa6fb'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const ringColor = (r: Ring): string => (r.projected ? PROJECTED_BLUE : r.color)

/* ── palette: clean editorial paper + a dark variant (flat, no gradients) ──────── */

type Palette = { bg: string; ink: string; muted: string; faint: string; hair: string }
const LIGHT: Palette = { bg: '#ffffff', ink: '#1c1a16', muted: '#6c6c89', faint: '#a9a4b5', hair: 'rgba(28,26,22,0.16)' }
const DARK: Palette = { bg: '#0a0b0e', ink: '#f1ede6', muted: '#9a9ab8', faint: '#5e584c', hair: 'rgba(241,237,230,0.18)' }
const palette = (theme: PrintTheme): Palette => (theme === 'dark' ? DARK : LIGHT)

/* ── the page ─────────────────────────────────────────────────────────────────── */

export function MercadoTiempo({ doc, geo }: PrintPageProps) {
  const m = geo.mm
  const pal = palette(doc.theme)
  const p = doc.props ?? {}
  const W = doc.dimensions.trimWidthMm
  const H = doc.dimensions.trimHeightMm

  const title = (p.title as string) ?? 'El valor de mercado de la IA, año a año'
  const money = MONEY_FORMATTERS[(p.numberFormat as string) ?? 'es'] ?? MONEY_FORMATTERS.es

  const cx = W * ((p.centerXFrac as number) ?? 0.305)
  const cy = H * ((p.centerYFrac as number) ?? 0.54)
  const maxR = H * ((p.maxRadiusFrac as number) ?? MARKET_MAX_RADIUS_FRAC)
  const columnX = W * ((p.columnXFrac as number) ?? 0.605)

  const rings = ringLayout({ maxRadiusMm: maxR, minInnerRadiusMm: MARKET_MIN_INNER_RADIUS_MM, minGapMm: MARKET_MIN_GAP_MM, includeProjection: true })

  // Tooltip ladder: newest (2026) at the top → oldest (2019) at the bottom, evenly spread.
  const rowTop = H * 0.165
  const rowBot = H * 0.875
  const newestFirst = [...rings].sort((a, b) => b.year - a.year)
  const rowY = (i: number) => rowTop + ((rowBot - rowTop) * i) / (newestFirst.length - 1)
  const yOf = new Map(newestFirst.map((r, i) => [r.year, rowY(i)]))

  return (
    <>
      <PrintFonts />
      <div style={{ position: 'absolute', inset: 0, background: pal.bg }} />

      {/* trim-space layer */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* one explanatory title (top-left, clear of the rings) */}
        <div style={{ position: 'absolute', left: m(W * 0.04), top: m(H * 0.055), maxWidth: m(W * 0.5) }}>
          {/* `pre-line` so a `\n` in the title prop forces a line break (e.g. «… IA,\naño a año»),
              while plain spaces still wrap to maxWidth. */}
          <div style={{ ...displayMm(geo, 92, pal.ink), whiteSpace: 'pre-line', lineHeight: 1.04 }}>{title}</div>
        </div>

        {/* one svg geometry layer: leaders (behind) → rings → anchor dots */}
        <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width={geo.trimWidthPx} height={geo.trimHeightPx}>
          {/* fine radial leaders, ducking behind the ring strokes */}
          {rings.map((r) => {
            const chipY = yOf.get(r.year)!
            const phi = Math.atan2(chipY - cy, columnX - cx)
            const ax = cx + r.r * Math.cos(phi)
            const ay = cy + r.r * Math.sin(phi)
            const col = ringColor(r)
            return (
              <line
                key={`ld-${r.year}`}
                x1={m(ax)}
                y1={m(ay)}
                x2={m(columnX - 26)}
                y2={m(chipY)}
                stroke={col}
                strokeWidth={Math.max(1, m(1.4))}
                opacity={0.55}
                strokeDasharray={r.projected ? `${Math.max(2, m(16))} ${Math.max(2, m(12))}` : undefined}
              />
            )
          })}

          {/* concentric rings — area ∝ value; 2026 = hero (filled faint), 2027 = dashed projection */}
          {rings.map((r) => {
            const isHero = r.year === 2026
            const col = ringColor(r)
            const strokeMm = isHero ? 8 : r.projected ? 6 : clamp(r.r * 0.02, 3, 6)
            return (
              <circle
                key={`ring-${r.year}`}
                cx={m(cx)}
                cy={m(cy)}
                r={m(r.r)}
                fill={isHero ? withAlpha(col, 0.06) : 'none'}
                stroke={col}
                strokeWidth={Math.max(1, m(strokeMm))}
                strokeDasharray={r.projected ? `${Math.max(2, m(34))} ${Math.max(2, m(24))}` : undefined}
              />
            )
          })}

          {/* anchor dots where each leader meets its ring (hollow for the projection) */}
          {rings.map((r) => {
            const chipY = yOf.get(r.year)!
            const phi = Math.atan2(chipY - cy, columnX - cx)
            const ax = cx + r.r * Math.cos(phi)
            const ay = cy + r.r * Math.sin(phi)
            const col = ringColor(r)
            const rad = r.year === 2026 ? 11 : 8
            return (
              <circle
                key={`an-${r.year}`}
                cx={m(ax)}
                cy={m(ay)}
                r={Math.max(1, m(rad))}
                fill={r.projected ? pal.bg : col}
                stroke={col}
                strokeWidth={r.projected ? Math.max(1, m(3)) : 0}
              />
            )
          })}
        </svg>

        {/* year tooltips (HTML overlay, real fonts) */}
        {newestFirst.map((r) => (
          <Tooltip key={`tip-${r.year}`} ring={r} x={columnX} y={yOf.get(r.year)!} geo={geo} pal={pal} money={money} />
        ))}
      </div>
    </>
  )
}

/* ── a year tooltip: colour swatch + year + figure ────────────────────────────── */

function Tooltip({ ring, x, y, geo, pal, money }: { ring: Ring; x: number; y: number; geo: PrintGeometry; pal: Palette; money: (v: number) => string }) {
  const m = geo.mm
  const col = ringColor(ring)
  // 2019–2020 had no public valuation; the 2027 ring is a projection — both flagged.
  const isEstimate = !ring.projected && ring.year <= 2020
  const swatch = ring.year === 2026 ? 52 : ring.projected ? 46 : 40
  return (
    <div style={{ position: 'absolute', left: m(x), top: m(y), transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: m(28), pointerEvents: 'none' }}>
      <div
        style={{
          width: m(swatch),
          height: m(swatch),
          borderRadius: '50%',
          background: ring.projected ? 'transparent' : col,
          border: ring.projected ? `${m(6)} dashed ${col}` : undefined,
          boxSizing: 'border-box',
          flex: '0 0 auto',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ ...displayMm(geo, ring.year === 2026 ? 84 : 66, col), lineHeight: 1 }}>{ring.year}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: m(16), marginTop: m(12) }}>
          {/* Money + a short wall-legible tag. Sizes clear the ~1 cm-cap / 3 m floor (specs/print-typography.md):
              the old 13–15 mm tags were below it — illegible at wall distance. */}
          <span style={typeMm(geo, ring.year === 2026 ? 42 : 32, pal.ink, false)}>{money(ring.value)}</span>
          {ring.year === 2026 && <span style={typeMm(geo, 20, pal.muted, true)}>hoy</span>}
          {ring.projected && <span style={typeMm(geo, 20, col, true)}>proyección</span>}
          {isEstimate && <span style={typeMm(geo, 18, pal.faint, true)}>estimación</span>}
        </div>
      </div>
    </div>
  )
}

/* ── physical-mm type helpers ─────────────────────────────────────────────────── */

function displayMm(geo: PrintGeometry, emMm: number, color: string): CSSProperties {
  return {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontWeight: 400,
    fontSize: geo.mm(emMm),
    letterSpacing: geo.mm(-emMm * 0.015),
    lineHeight: 1.02,
    color,
    whiteSpace: 'nowrap',
  }
}

function typeMm(geo: PrintGeometry, emMm: number, color: string, caps: boolean): CSSProperties {
  return {
    fontFamily: PRINT_TEXT_FONT,
    fontSize: geo.mm(emMm),
    fontWeight: caps ? 600 : 400,
    letterSpacing: caps ? geo.mm(emMm * 0.1) : undefined,
    textTransform: caps ? 'uppercase' : undefined,
    lineHeight: 1.3,
    color,
  }
}

/** Append an alpha to a #rrggbb colour (the faint hero fill). */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
