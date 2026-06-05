import type { CSSProperties } from 'react'
import type { PrintPageProps, PrintTheme } from '../types'
import type { PrintGeometry } from '../geometry'
import { PrintFonts, PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { layoutWall, labelMetrics, type OrbitBody, type Nucleus } from './galaxy'
import { metaballPath } from './galaxy-metaball'
import { bodiesForWall, galaxyMaxValue, galaxySourcesCaption, type GalaxyGroup, type GalaxyPanel } from '../space/galaxy-data'
import { FrontierChart } from './frontier-chart'

/**
 * Galaxy — the "Galaxia de mercados" print, reimagined as an orbital diagram.
 * ──────────────────────────────────────────────────────────────────────────
 * THREE self-contained framed prints. Back wall **5N1**: the AI core (IA + Nvidia)
 * fused into one Bauhaus blob at the centre, ringed by other nations' GDPs and
 * Spain's biggest companies, each on its OWN crossing elliptical orbit. Side walls
 * **2-E / 11-W**: the galaxy fills the INNER half (by 5N1) with its orbit centre on
 * the wall's inner edge, so the big orbits bleed off the top and bottom; the outer
 * half holds a chart. Nothing is clipped except, by design, the orbit lines.
 *
 * The honesty is the circle AREA (`area ∝ valoración`, one shared global scale —
 * `galaxy.ts`); the orbit is geometry, not data. Editorial register (per the
 * director): clean white ground, flat shapes — NO gradients/glow — one accent
 * (amber = the AI core) vs fine ink rings (everything else), names only, no figures.
 *
 * `doc.props`: panel ('back'|'left'|'right') · chart ('frontier-intelligence') ·
 * galaxyHalf ('left'|'right', which half the galaxy occupies on a side wall) ·
 * innerEdge ('left'|'right', the region edge the orbit centre hugs).
 */

export const GALAXY_HEIGHT_MM = 2500
/** Radius of the global-max body (Nvidia) as a fraction of wall height — shared scale. */
export const GALAXY_MAX_RADIUS_FRAC = 0.27
export const GALAXY_MIN_RADIUS_MM = 34
export const GALAXY_GAP_MM = 160
export const GALAXY_SEED = 7
/** Base name-label height (mm) reserved below each dot. */
export const GALAXY_LABEL_FONT_MM = 56
/** Morph neck shape (Bauhaus fused look). */
const MORPH_SPREAD = 0.45
const MORPH_HANDLE = 2.4

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Default edge the galaxy's orbit centre hugs on a side panel — the spheres cluster on
 *  that side and the orbits sweep toward it (off its top/bottom). 2-E → left, 11-W → right. */
function defaultFocalEdge(panel: GalaxyPanel): 'left' | 'right' {
  return panel === 'right' ? 'right' : 'left'
}

/** Build the orbital layout for one wall's galaxy region (page + tests share this). */
export function galaxyWallLayout(panel: GalaxyPanel, widthMm: number, heightMm: number, focalEdge?: 'left' | 'right') {
  const isBack = panel === 'back'
  return layoutWall(bodiesForWall(panel), {
    width: widthMm,
    height: heightMm,
    maxValue: galaxyMaxValue(),
    maxRadius: heightMm * GALAXY_MAX_RADIUS_FRAC,
    minRadius: GALAXY_MIN_RADIUS_MM,
    gap: GALAXY_GAP_MM,
    seed: GALAXY_SEED,
    coreIds: isBack ? ['ai-sun', 'nvidia'] : undefined,
    nucleusAnchor: isBack ? 'center' : 'edge-inner',
    focalEdge: focalEdge ?? defaultFocalEdge(panel),
    label: { fontMm: GALAXY_LABEL_FONT_MM },
  })
}

/* ── palettes: clean editorial paper + a dark variant (flat, no gradients) ────── */

type Palette = {
  bg: string
  ink: string
  muted: string
  faint: string
  hair: string
  orbit: string
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
  orbit: 'rgba(28,26,22,0.5)',
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
  orbit: 'rgba(241,237,230,0.5)',
  aiFill: '#f6b24a',
  aiInk: '#2a1c08',
  ringStroke: '#b9b2a4',
  ringInk: '#f1ede6',
}

const palette = (theme: PrintTheme): Palette => (theme === 'dark' ? DARK : LIGHT)
const isAI = (b: { group?: string }) => ((b.group as GalaxyGroup) ?? 'market') === 'ai'

/* ── the page ─────────────────────────────────────────────────────────────────── */

export function Galaxy({ doc, geo }: PrintPageProps) {
  const panel = (doc.props?.panel as GalaxyPanel) ?? 'back'
  const chart = doc.props?.chart as string | undefined
  const pal = palette(doc.theme)
  const m = geo.mm
  const trimW = doc.dimensions.trimWidthMm
  const H = doc.dimensions.trimHeightMm

  const focalEdge = (doc.props?.focalEdge as 'left' | 'right') ?? defaultFocalEdge(panel)
  // Galaxy sits on the half its focal edge is on; the chart (if any) takes the other half.
  const galaxyHalf = (doc.props?.galaxyHalf as 'left' | 'right') ?? (focalEdge === 'right' ? 'right' : 'left')

  return (
    <>
      <PrintFonts />
      {/* flat ground — no gradients */}
      <div style={{ position: 'absolute', inset: 0, background: pal.bg }} />

      {/* trim-space layer */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {panel === 'back' ? (
          <GalaxyGroup geo={geo} panel={panel} regionWmm={trimW} originXmm={0} heightMm={H} pal={pal} focalEdge={focalEdge} showNote />
        ) : (
          (() => {
            const half = trimW / 2
            const galaxyX = galaxyHalf === 'left' ? 0 : half
            const chartX = galaxyHalf === 'left' ? half : 0
            const pad = 150
            // The chart fills its half minus `pad`, then shrinks by `chartScale` and
            // re-centres in that half — a smaller graphic with even air around it.
            const chartScale = (doc.props?.chartScale as number) ?? 0.82
            const boxW = (half - 2 * pad) * chartScale
            const boxH = (H - 2 * pad) * chartScale
            const boxX = chartX + (half - boxW) / 2
            const boxY = (H - boxH) / 2
            return (
              <>
                <GalaxyGroup geo={geo} panel={panel} regionWmm={half} originXmm={galaxyX} heightMm={H} pal={pal} focalEdge={focalEdge} showNote={false} />
                {chart === 'frontier-intelligence' && (
                  <div style={{ position: 'absolute', left: m(boxX), top: m(boxY), width: m(boxW), height: m(boxH) }}>
                    <FrontierChart geo={geo} wMm={boxW} hMm={boxH} pal={{ ink: pal.ink, muted: pal.muted, faint: pal.faint, hair: pal.hair, grid: pal.hair }} />
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
  focalEdge,
  showNote,
}: {
  geo: PrintGeometry
  panel: GalaxyPanel
  regionWmm: number
  originXmm: number
  heightMm: number
  pal: Palette
  focalEdge: 'left' | 'right'
  showNote: boolean
}) {
  const m = geo.mm
  const layout = galaxyWallLayout(panel, regionWmm, heightMm, focalEdge)
  const W = m(regionWmm)
  const Hpx = m(heightMm)

  return (
    <div style={{ position: 'absolute', left: m(originXmm), top: 0, width: W, height: Hpx }}>
      {/* one geometry layer: orbits, the morphed nucleus, the rings — overflow visible so orbits bleed */}
      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width={W} height={Hpx}>
        {/* orbits (hairline ellipses, each through its dot) */}
        {layout.bodies.map((b) => {
          const e = b.orbit
          const deg = (e.rotation * 180) / Math.PI
          return (
            <ellipse
              key={`o-${b.id}`}
              cx={m(e.cx)}
              cy={m(e.cy)}
              rx={m(e.rx)}
              ry={m(e.ry)}
              transform={`rotate(${deg} ${m(e.cx)} ${m(e.cy)})`}
              fill="none"
              stroke={pal.orbit}
              strokeWidth={Math.max(1, m(1))}
            />
          )
        })}

        {/* the morphed AI core (back wall) */}
        <NucleusView nucleus={layout.nucleus} geo={geo} pal={pal} />

        {/* orbiting bodies: fine outline ring (or amber if AI-group) sitting on its orbit */}
        {layout.bodies.map((b) => (
          <Disc key={`d-${b.id}`} body={b} geo={geo} pal={pal} />
        ))}
      </svg>

      {/* names below each dot + below each core circle (HTML overlay, real fonts) */}
      {layout.bodies.map((b) => (
        <LabelView key={`l-${b.id}`} cx={b.cx} cy={b.cy} r={b.r} label={b.label} toScale={b.toScale} geo={geo} pal={pal} ai={isAI(b)} />
      ))}
      {layout.nucleus.kind === 'metaball' &&
        layout.nucleus.circles.map((c) => (
          <LabelView key={`lc-${c.id}`} cx={c.cx} cy={c.cy} r={c.r} label={c.label} toScale geo={geo} pal={pal} ai core />
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

/* ── the morphed nucleus (amber Bauhaus blob) ─────────────────────────────────── */

function NucleusView({ nucleus, geo, pal }: { nucleus: Nucleus; geo: PrintGeometry; pal: Palette }) {
  if (nucleus.kind !== 'metaball') return null
  const m = geo.mm
  const pxCircles = nucleus.circles.map((c) => ({ cx: m(c.cx), cy: m(c.cy), r: m(c.r) }))
  const d = metaballPath(pxCircles, { spread: MORPH_SPREAD, handleLenRate: MORPH_HANDLE })
  return <path d={d} fill={pal.aiFill} fillRule="nonzero" />
}

/* ── a body: filled amber (AI) or a fine outline ring (everything else) ───────── */

function Disc({ body, geo, pal }: { body: OrbitBody; geo: PrintGeometry; pal: Palette }) {
  const m = geo.mm
  const ai = isAI(body)
  const cx = m(body.cx)
  const cy = m(body.cy)
  const r = m(body.r)
  const strokeMm = clamp(body.r * 0.02, 2, 6)
  return (
    <>
      {/* opaque fill (white, or amber for the AI core) so orbit lines never cross a sphere */}
      <circle cx={cx} cy={cy} r={r} fill={ai ? pal.aiFill : pal.bg} stroke={ai ? 'none' : pal.ringStroke} strokeWidth={ai ? 0 : Math.max(1, m(strokeMm))} />
      {!body.toScale && <circle cx={cx} cy={cy} r={r + m(2)} fill="none" stroke={pal.faint} strokeWidth={Math.max(1, m(0.6))} strokeDasharray={`${Math.max(2, m(6))} ${Math.max(2, m(6))}`} />}
    </>
  )
}

/* ── a name, set BELOW its dot ────────────────────────────────────────────────── */

function LabelView({
  cx,
  cy,
  r,
  label,
  toScale,
  geo,
  pal,
  ai,
  core = false,
}: {
  cx: number
  cy: number
  r: number
  label: string
  toScale: boolean
  geo: PrintGeometry
  pal: Palette
  ai: boolean
  core?: boolean
}) {
  const m = geo.mm
  const met = labelMetrics({ label, r })
  const top = cy + r + met.gapOut
  const nameStyle: CSSProperties = {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontWeight: 400,
    fontSize: m(met.nameMm),
    lineHeight: 1,
    letterSpacing: m(-met.nameMm * 0.015),
    color: core ? pal.aiInk : ai ? pal.aiInk : pal.ink,
    whiteSpace: 'nowrap',
  }
  return (
    <div style={{ position: 'absolute', left: m(cx), top: m(top), transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
      <div style={nameStyle}>{label}</div>
      {!toScale && <div style={{ ...typeMm(geo, 12, pal.faint, true), marginTop: m(8) }}>ampliado</div>}
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
