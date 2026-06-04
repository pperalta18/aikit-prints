import type { CSSProperties } from 'react'
import type { PrintPageProps, PrintTheme } from '../types'
import type { PrintGeometry } from '../geometry'
import { PrintFonts, PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { layoutWall, type GalaxyBody } from './galaxy'
import { bodiesForWall, galaxyMaxValue, galaxySourcesCaption, type GalaxyGroup, type GalaxyPanel } from '../space/galaxy-data'
import { FrontierChart } from './frontier-chart'

/**
 * Galaxy — the "Galaxia de mercados" print page (THREE separate framed prints).
 * ──────────────────────────────────────────────────────────────────────────
 * Each wall is its own self-contained composition (NOT a sliced mural). Back wall
 * **5N1**: the AI (vs Spain's whole economy), full frame. Side walls **2-E** / **11-W**:
 * the galaxy fills HALF the wall (the corner half, by 5N1) and the other half holds a
 * chart (the left wall hosts the Artificial-Analysis "intelligence over time" chart).
 * Nothing is clipped. A **shared area∝value scale** keeps the circle sizes honest and
 * comparable across the three walls.
 *
 * Editorial register (per the director): clean warm-paper ground, flat shapes — NO
 * gradients, NO glow — one accent (amber = AI) vs fine ink outline rings (everything
 * else), **names only, no figures** (the AREA is the value). No headline, no footer —
 * only a discreet scale + sources note on the back wall (honesty).
 *
 * `doc.props`: panel ('back'|'left'|'right') · chart ('frontier-intelligence') ·
 * galaxyHalf ('left'|'right', which half the galaxy occupies on a side wall).
 */

export const GALAXY_HEIGHT_MM = 2500
/** Radius of the global-max body (Nvidia) as a fraction of wall height — shared scale. */
export const GALAXY_MAX_RADIUS_FRAC = 0.27
export const GALAXY_MIN_RADIUS_MM = 34
export const GALAXY_GAP_MM = 160
export const GALAXY_SEED = 7

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Build the shared-scale layout for one wall's galaxy region (page + tests share this). */
export function galaxyWallLayout(panel: GalaxyPanel, widthMm: number, heightMm: number) {
  return layoutWall(bodiesForWall(panel), {
    width: widthMm,
    height: heightMm,
    maxValue: galaxyMaxValue(),
    maxRadius: heightMm * GALAXY_MAX_RADIUS_FRAC,
    minRadius: GALAXY_MIN_RADIUS_MM,
    gap: GALAXY_GAP_MM,
    sunId: panel === 'back' ? 'ai-sun' : undefined,
    seed: GALAXY_SEED,
  })
}

/* ── palettes: clean editorial paper + a dark variant (flat, no gradients) ────── */

type Palette = {
  bg: string
  ink: string
  muted: string
  faint: string
  hair: string
  grid: string
  aiFill: string
  aiInk: string
  ringStroke: string
  ringInk: string
}

const LIGHT: Palette = {
  bg: '#ffffff',
  ink: '#1c1a16',
  muted: '#938c80',
  faint: '#b7b0a3',
  hair: 'rgba(28,26,22,0.22)',
  grid: 'rgba(28,26,22,0.08)',
  aiFill: '#ee9412',
  aiInk: '#3c2405',
  ringStroke: '#2c2a25',
  ringInk: '#1c1a16',
}

const DARK: Palette = {
  bg: '#0a0b0e',
  ink: '#f1ede6',
  muted: '#8d8678',
  faint: '#5e584c',
  hair: 'rgba(241,237,230,0.22)',
  grid: 'rgba(241,237,230,0.1)',
  aiFill: '#f6b24a',
  aiInk: '#2a1c08',
  ringStroke: '#b9b2a4',
  ringInk: '#f1ede6',
}

const palette = (theme: PrintTheme): Palette => (theme === 'dark' ? DARK : LIGHT)
const isAI = (b: GalaxyBody) => ((b.group as GalaxyGroup) ?? 'market') === 'ai'

/* ── label layout: name only, inside the big bodies, leadered outside the small ── */

type LabelPlan = {
  body: GalaxyBody
  cx: number
  cy: number
  r: number
  nameMm: number
  inside: boolean
  lx: number
  ly: number
  leader: { x1: number; y1: number; x2: number; y2: number } | null
}

const NAME_CW = 0.55

function planLabels(bodies: GalaxyBody[], fieldH: number, fieldW: number): LabelPlan[] {
  const placed: Array<{ x0: number; y0: number; x1: number; y1: number }> = []
  const sorted = [...bodies].sort((a, b) => b.r - a.r)
  const out: LabelPlan[] = []
  const PAD = 50

  for (const body of sorted) {
    const isSun = body.kind === 'sun'
    let nameMm = isSun ? clamp(body.r * 0.52, 150, 360) : clamp(body.r * 0.6, 42, 150)
    const dia = body.r * 2
    let nameW = body.label.length * nameMm * NAME_CW

    let inside = isSun
    if (!isSun && dia * 0.86 >= nameW && dia >= nameMm * 2) inside = true
    if (!isSun && !inside && dia >= nameMm * 2.2) {
      const fit = (dia * 0.84) / (body.label.length * NAME_CW)
      if (fit >= 40) {
        nameMm = fit
        nameW = body.label.length * nameMm * NAME_CW
        inside = true
      }
    }

    if (inside) {
      out.push({ body, cx: body.cx, cy: body.cy, r: body.r, nameMm, inside: true, lx: body.cx, ly: body.cy, leader: null })
      continue
    }

    const blockH = nameMm * 1.15
    const gapOut = Math.max(40, body.r * 0.2)
    const clampX = (v: number) => clamp(v, PAD + nameW / 2, fieldW - PAD - nameW / 2)
    const candidates: Array<{ lx: number; ly: number }> = []
    for (let k = 0; k < 3; k++) {
      const extra = k * (blockH + 30)
      candidates.push({ lx: clampX(body.cx), ly: body.cy + body.r + gapOut + extra })
      candidates.push({ lx: clampX(body.cx), ly: body.cy - body.r - gapOut - blockH - extra })
    }
    const fits = (lx: number, ly: number) => {
      const x0 = lx - nameW / 2
      const x1 = lx + nameW / 2
      const y0 = ly
      const y1 = ly + blockH
      if (y0 < 8 || y1 > fieldH - 8) return false
      for (const p of placed) if (x0 < p.x1 && x1 > p.x0 && y0 < p.y1 && y1 > p.y0) return false
      for (const b of bodies) {
        if (b.id === body.id) continue
        const ccx = clamp(b.cx, x0, x1)
        const ccy = clamp(b.cy, y0, y1)
        if (Math.hypot(b.cx - ccx, b.cy - ccy) < b.r + 6) return false
      }
      return true
    }
    const chosen = candidates.find((c) => fits(c.lx, c.ly)) ?? { lx: clampX(body.cx), ly: body.cy + body.r + gapOut }
    placed.push({ x0: chosen.lx - nameW / 2, y0: chosen.ly, x1: chosen.lx + nameW / 2, y1: chosen.ly + blockH })
    const above = chosen.ly < body.cy
    const ly2 = above ? chosen.ly + blockH : chosen.ly
    const leader = { x1: body.cx, y1: body.cy + (above ? -body.r : body.r), x2: chosen.lx, y2: ly2 }
    out.push({ body, cx: body.cx, cy: body.cy, r: body.r, nameMm, inside: false, lx: chosen.lx, ly: chosen.ly, leader })
  }
  return out
}

/* ── the page ─────────────────────────────────────────────────────────────────── */

export function Galaxy({ doc, geo }: PrintPageProps) {
  const panel = (doc.props?.panel as GalaxyPanel) ?? 'back'
  const chart = doc.props?.chart as string | undefined
  const pal = palette(doc.theme)
  const m = geo.mm
  const trimW = doc.dimensions.trimWidthMm
  const H = doc.dimensions.trimHeightMm

  const galaxyHalf = (doc.props?.galaxyHalf as 'left' | 'right') ?? (panel === 'left' ? 'left' : 'right')

  return (
    <>
      <PrintFonts />
      {/* flat ground — no gradients */}
      <div style={{ position: 'absolute', inset: 0, background: pal.bg }} />

      {/* trim-space layer */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {panel === 'back' ? (
          <GalaxyGroup geo={geo} panel={panel} regionWmm={trimW} originXmm={0} heightMm={H} pal={pal} showNote />
        ) : (
          (() => {
            const half = trimW / 2
            const galaxyX = galaxyHalf === 'left' ? 0 : half
            const chartX = galaxyHalf === 'left' ? half : 0
            const pad = 150
            return (
              <>
                <GalaxyGroup geo={geo} panel={panel} regionWmm={half} originXmm={galaxyX} heightMm={H} pal={pal} showNote={false} />
                {chart === 'frontier-intelligence' && (
                  <div style={{ position: 'absolute', left: m(chartX + pad), top: m(pad), width: m(half - 2 * pad), height: m(H - 2 * pad) }}>
                    <FrontierChart geo={geo} wMm={half - 2 * pad} hMm={H - 2 * pad} pal={{ ink: pal.ink, muted: pal.muted, faint: pal.faint, hair: pal.hair, grid: pal.grid }} />
                  </div>
                )}
              </>
            )
          })()
        )}
      </div>
    </>
  )
}

/* ── one self-contained galaxy region (positioned by the page) ────────────────── */

function GalaxyGroup({
  geo,
  panel,
  regionWmm,
  originXmm,
  heightMm,
  pal,
  showNote,
}: {
  geo: PrintGeometry
  panel: GalaxyPanel
  regionWmm: number
  originXmm: number
  heightMm: number
  pal: Palette
  showNote: boolean
}) {
  const m = geo.mm
  const layout = galaxyWallLayout(panel, regionWmm, heightMm)
  const plans = planLabels(layout.bodies, heightMm, regionWmm)
  const leaders = plans.map((p) => p.leader).filter((l): l is NonNullable<typeof l> => l != null)

  return (
    <div style={{ position: 'absolute', left: m(originXmm), top: 0, width: m(regionWmm), height: m(heightMm) }}>
      {leaders.length > 0 && (
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width={m(regionWmm)} height={m(heightMm)}>
          {leaders.map((l, i) => (
            <line key={i} x1={m(l.x1)} y1={m(l.y1)} x2={m(l.x2)} y2={m(l.y2)} stroke={pal.hair} strokeWidth={Math.max(1, m(0.8))} />
          ))}
        </svg>
      )}
      {plans.map((p) => (
        <Disc key={p.body.id} plan={p} geo={geo} pal={pal} />
      ))}
      {plans.map((p) => (
        <LabelView key={`l-${p.body.id}`} plan={p} geo={geo} pal={pal} />
      ))}
      {showNote && (
        <div style={{ position: 'absolute', left: m(180), bottom: m(180), maxWidth: m(regionWmm * 0.7) }}>
          <div style={typeMm(geo, 14, pal.muted, true)}>Representado a escala · el área de cada círculo es su valoración · «/año» = mercado anual</div>
          <div style={{ ...typeMm(geo, 13, pal.faint, false), marginTop: m(18) }}>{galaxySourcesCaption()}</div>
        </div>
      )}
    </div>
  )
}

/* ── a body: filled amber (AI) or a fine outline ring (everything else) ───────── */

function Disc({ plan, geo, pal }: { plan: LabelPlan; geo: PrintGeometry; pal: Palette }) {
  const m = geo.mm
  const { body } = plan
  const ai = isAI(body)
  const rPx = m(body.r)
  const dia = rPx * 2
  const strokeMm = clamp(body.r * 0.02, 2, 6)

  return (
    <div
      style={{
        position: 'absolute',
        left: m(body.cx) - rPx,
        top: m(body.cy) - rPx,
        width: dia,
        height: dia,
        borderRadius: '50%',
        background: ai ? pal.aiFill : 'transparent',
        border: ai ? undefined : `${Math.max(1, m(strokeMm))}px solid ${pal.ringStroke}`,
        boxSizing: 'border-box',
        outline: body.toScale ? undefined : `${Math.max(1, m(0.6))}px dashed ${pal.faint}`,
        outlineOffset: m(2),
      }}
    />
  )
}

/* ── a name (inside the body, or in its leadered outside slot) ────────────────── */

function LabelView({ plan, geo, pal }: { plan: LabelPlan; geo: PrintGeometry; pal: Palette }) {
  const m = geo.mm
  const { body, nameMm, inside } = plan
  const ai = isAI(body)
  const color = inside ? (ai ? pal.aiInk : pal.ringInk) : pal.ink
  const nameStyle: CSSProperties = {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontWeight: 400,
    fontSize: m(nameMm),
    lineHeight: 1,
    letterSpacing: m(-nameMm * 0.015),
    color,
    whiteSpace: 'nowrap',
  }

  if (inside) {
    const rPx = m(body.r)
    return (
      <div style={{ position: 'absolute', left: m(plan.cx) - rPx, top: m(plan.cy) - rPx, width: rPx * 2, height: rPx * 2, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={nameStyle}>{body.label}</div>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', left: m(plan.lx), top: m(plan.ly), transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
      <div style={nameStyle}>{body.label}</div>
      {!body.toScale && <div style={{ ...typeMm(geo, 12, pal.faint, true), marginTop: m(8) }}>ampliado</div>}
    </div>
  )
}

/* ── physical-mm type helper ──────────────────────────────────────────────────── */

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
