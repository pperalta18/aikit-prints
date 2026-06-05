import type { CSSProperties } from 'react'
import { GRAY, KIT_BLUE } from '@/lib/neumorphism'
import { PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT, PrintFonts } from '../printFonts'

/**
 * SalaSignage — room / section signage for a wall (a print piece).
 * ──────────────────────────────────────────────────────────────────────────
 * A vertical dial: every section of the run is a numbered stop fanned along a
 * large, gentle arc. The numbers are all the **same size**; the current one is
 * simply pulled out to the right in full ink (the rest stay as light-grey
 * ghosts) with its label and a one-line description. Modelled on the Polyera
 * "Wove" indicator, re-cut in the AiKit voice — the hairline Universal Sans
 * Display cut, white ground (never cream), the brand grey scale (`GRAY`) and a
 * single KIT_BLUE accent on the active stop.
 *
 * No chrome: no logo, no close button, no footer — it is a wall graphic. One
 * resolution-independent SVG (portrait 1080×1920) so it scales to any print size.
 */

export type SignageStep = {
  /** Stop label, e.g. "01". Defaults to the zero-padded position. */
  id?: string
  /** The section name — the protagonist line when active, e.g. "Ambiente". */
  label: string
  /** One-line description shown under the label when active. */
  description?: string
}

export type SalaSignageProps = {
  /** The full run of sections, top → bottom along the arc. */
  steps: SignageStep[]
  /** Which step is current (0-based). */
  activeIndex?: number
  theme?: 'light' | 'dark'
  /** Wrapper style — size it where you place it; the 9:16 portrait is kept. */
  style?: CSSProperties
}

/* ── canvas + arc geometry (a big, gentle circle centred off the left edge) ───── */

const W = 1080
const H = 1920
const CY = H / 2

/** Every number — ghost and active — is this size. Hierarchy is colour, not size. */
const NUM_SIZE = 146

// The arc: derived from where the centre stop bulges, where the end stops sit
// and the vertical span the stops cover. tan(φ/2) = Δx / halfSpan,
// R = halfSpan / sin φ, cx = X_BULGE − R. A large R ⇒ a gentle curve.
const X_BULGE = 0.32 * W // x of the centre stop (θ=0), the arc's rightmost point
const X_OUTER = 0.16 * W // x of the two end stops
const HALF_SPAN = 0.4 * H // vertical half-distance, first stop → last stop
const PHI = 2 * Math.atan((X_BULGE - X_OUTER) / HALF_SPAN)
const R = HALF_SPAN / Math.sin(PHI)
const ARC_CX = X_BULGE - R
const ARC_CY = CY

const r1 = (n: number) => Math.round(n * 10) / 10

function angleAt(i: number, n: number): number {
  return n <= 1 ? 0 : -PHI + (i * 2 * PHI) / (n - 1)
}

function pointAt(i: number, n: number) {
  const a = angleAt(i, n)
  return { x: ARC_CX + R * Math.cos(a), y: ARC_CY + R * Math.sin(a), a }
}

function palette(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    return {
      bg: GRAY.ink,
      ghost: 'rgba(244,244,250,0.12)',
      line: 'rgba(244,244,250,0.16)',
      ink: GRAY.surface,
      muted: '#9a9ab4',
      dot: 'rgba(244,244,250,0.30)',
      accent: KIT_BLUE,
    }
  }
  return {
    // White ground — never cream. GRAY.surface (#f4f4fa) stays a fill token.
    bg: '#ffffff',
    ghost: GRAY.line,
    line: GRAY.line,
    ink: GRAY.ink,
    muted: GRAY.muted,
    dot: 'rgba(108,108,137,0.38)',
    accent: KIT_BLUE,
  }
}

const padId = (i: number) => String(i + 1).padStart(2, '0')

export function SalaSignage({ steps, activeIndex = 0, theme = 'light', style }: SalaSignageProps) {
  const n = steps.length
  const active = Math.min(Math.max(activeIndex, 0), Math.max(n - 1, 0))
  const pal = palette(theme)

  const activePt = pointAt(active, n)
  const activeStep = steps[active]

  // Arc line, extended a little past the end stops so it runs toward the edges.
  const aStart = -PHI - 0.16
  const aEnd = PHI + 0.16
  const p0 = { x: ARC_CX + R * Math.cos(aStart), y: ARC_CY + R * Math.sin(aStart) }
  const p1 = { x: ARC_CX + R * Math.cos(aEnd), y: ARC_CY + R * Math.sin(aEnd) }
  const arcPath = `M ${r1(p0.x)} ${r1(p0.y)} A ${r1(R)} ${r1(R)} 0 0 1 ${r1(p1.x)} ${r1(p1.y)}`

  // The active number is pulled out to the right of its stop, in full ink; its
  // label + description sit beside it, all vertically centred on the stop.
  const numLeft = activePt.x + 0.1 * W
  const BLOCK_H = 380

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, ...style }}>
      <PrintFonts />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
        role="img"
        aria-label={`Sala ${activeStep?.id ?? padId(active)} · ${activeStep?.label ?? ''}`}
      >
        <rect x={0} y={0} width={W} height={H} fill={pal.bg} />

        {/* the dial */}
        <path d={arcPath} fill="none" stroke={pal.line} strokeWidth={2.2} />

        {/* ghost numbers + stop dots (active number is drawn pulled-out, below) */}
        {steps.map((step, i) => {
          const pt = pointAt(i, n)
          const isActive = i === active
          const id = step.id ?? padId(i)
          // Number hangs to the right of the arc so the stop dot sits at its
          // left edge (not in its centre). Fan opens with the arc: top numbers
          // rise to the right, bottom numbers fall to the right.
          const gx = pt.x + 0.26 * NUM_SIZE * id.length + 10
          const rot = ((pt.a * 180) / Math.PI) * 0.72
          return (
            <g key={i}>
              {!isActive && (
                <text
                  x={r1(gx)}
                  y={r1(pt.y)}
                  fontFamily={PRINT_DISPLAY_HAIR}
                  fontSize={NUM_SIZE}
                  fill={pal.ghost}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${r1(rot)} ${r1(gx)} ${r1(pt.y)})`}
                >
                  {id}
                </text>
              )}
              <circle cx={r1(pt.x)} cy={r1(pt.y)} r={isActive ? 12 : 7} fill={isActive ? pal.accent : pal.dot} />
            </g>
          )
        })}

        {/* active block — same-size number in ink, pulled right, with its words */}
        {activeStep && (
          <foreignObject x={r1(numLeft)} y={r1(activePt.y - BLOCK_H / 2)} width={r1(W - numLeft - 64)} height={BLOCK_H}>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
              <div
                style={{
                  fontFamily: PRINT_DISPLAY_HAIR,
                  fontSize: NUM_SIZE,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: pal.ink,
                  whiteSpace: 'nowrap',
                }}
              >
                {activeStep.id ?? padId(active)}
              </div>
              <div style={{ marginLeft: 44, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                <div style={{ fontFamily: PRINT_TEXT_FONT, fontWeight: 600, fontSize: 44, lineHeight: 1.12, color: pal.ink }}>
                  {activeStep.label}
                </div>
                {activeStep.description && (
                  <div
                    style={{
                      fontFamily: PRINT_TEXT_FONT,
                      fontWeight: 400,
                      fontSize: 32,
                      lineHeight: 1.35,
                      color: pal.muted,
                      marginTop: 14,
                    }}
                  >
                    {activeStep.description}
                  </div>
                )}
              </div>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  )
}
