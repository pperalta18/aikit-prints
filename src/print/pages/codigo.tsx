import { DISPLAY_FONT, TEXT_FONT, elevation } from '@/lib/neumorphism'
import type { PrintPageProps } from '../types'
import {
  DATAVIZ,
  DataField,
  ScaleNote,
  SourceCaption,
  datavizTheme,
  display,
  eyebrow,
  label,
} from './dataviz-kit'
import {
  CODIGO_INV_ID,
  codigoChartInputFor,
  formatBarValue,
  formatPercent,
  planCodigoLayout,
  type Bar,
  type BarStats,
  type CodigoChartPanel,
} from './codigo'
import { piecesByInvId, type WallDatum } from '../space/wall-data'

/**
 * codigo — the #16 print page "El valor del código" (wall 16 / `wall-15`, S3).
 * ──────────────────────────────────────────────────────────────────────────
 * S3's "Divisoria 2 — TEXT + CODE". The visitor has seen models talk; this panel
 * lands that code generation is **enormous, verifiable economic value** with two
 * honest, sourced bar charts shown side by side (zoned, never a stretched poster):
 *
 *   • **Tiempo de desarrollo (con IA vs sin IA)** — GitHub's controlled study:
 *     the same HTTP-server task, 161 min without an assistant → 71 min with one;
 *   • **Código que ya escribe la IA** — the share of code already machine-written
 *     (GitHub Copilot 46 %, Microsoft 30 %, Google 25 %).
 *
 * Code-rendered (never AI-invented): every bar is a researched, dated, sourced
 * figure from `wall-data.ts` (`piecesByInvId(16)`), sized by the unit-tested
 * `layoutBars` (height ∝ value, **zero baseline** — a truncated axis would
 * exaggerate the gap). The percent chart is anchored to a full 0–100 scale so
 * "46 %" reads as *less than half*; the time chart's hook ("menos de la mitad del
 * tiempo") is computed from the data, not hard-coded. Each chart is stamped with
 * the honesty note + a discreet source caption.
 *
 * Pure inline styles (Remotion has no Tailwind); authored in `geo` units so it
 * reads at print scale at any wall size / DPI. Layout maths: `codigo.ts`.
 */

export function Codigo({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const invId = typeof doc.props?.invId === 'number' ? (doc.props.invId as number) : CODIGO_INV_ID
  const pieces = piecesByInvId(invId)
  const charts = pieces.map(codigoChartInputFor)
  // Keep the original sourced data per chart for the source caption (bars carry
  // value/label but not figure/sourceURL).
  const sourcesBySlug = new Map<string, WallDatum[]>(pieces.map((p) => [p.slug, p.data]))

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const { chartsLeftMm, chartsTopMm, chartsBottomMm, panels } = planCodigoLayout(charts, W, H)

  return (
    <>
      <DataField>
        {/* faint vignette so the dark field reads as depth, not flat black */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(130% 120% at 22% 26%, #11151e 0%, ${DATAVIZ.bg} 58%, #05060a 100%)`,
          }}
        />
      </DataField>

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* ── header: room eyebrow + title + the message ── */}
        <div style={{ position: 'absolute', left: mm(chartsLeftMm), top: mm(H * 0.07), maxWidth: mm(W * 0.78) }}>
          <div style={eyebrow(geo, 9, DATAVIZ.accent)}>S3 · TEXT + CODE</div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: geo.pt(26),
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: geo.pt(-0.5),
              color: DATAVIZ.ink,
              marginTop: mm(H * 0.014),
            }}
          >
            El valor del código
          </div>
          <div style={{ ...label(geo, 12, DATAVIZ.inkSoft), marginTop: mm(H * 0.02), maxWidth: mm(W * 0.7) }}>
            Lo que un equipo hacía despacio y por dinero, un asistente lo escribe en una fracción del tiempo — y ya
            redacta buena parte del código que llega a producción.
          </div>
        </div>

        {/* ── the zoned bar charts (one column per dataset) ── */}
        {panels.map((panel) => (
          <BarChart
            key={panel.slug}
            panel={panel}
            sources={sourcesBySlug.get(panel.slug) ?? []}
            geo={geo}
            chartsLeftMm={chartsLeftMm}
            chartsTopMm={chartsTopMm}
            chartsBottomMm={chartsBottomMm}
            H={H}
          />
        ))}
      </div>
    </>
  )
}

/* ── one zoned bar chart: title + computed hook + gridlines + bars + sources ───── */

function BarChart({
  panel,
  sources,
  geo,
  chartsLeftMm,
  chartsTopMm,
  chartsBottomMm,
  H,
}: {
  panel: CodigoChartPanel
  sources: ReadonlyArray<WallDatum>
  geo: PrintPageProps['geo']
  chartsLeftMm: number
  chartsTopMm: number
  chartsBottomMm: number
  H: number
}) {
  const { mm } = geo
  const panelLeftMm = chartsLeftMm + panel.x
  const { bars } = panel.bars

  const plotWpx = mm(panel.width)
  const plotHpx = mm(panel.height)

  const hook = hookFor(panel.unit, panel.stats)
  const scaleNote = panel.unit === 'percent' ? 'Escala 0–100 %' : 'Misma tarea · eje desde 0'
  const showAxisLabels = panel.unit === 'percent'

  return (
    <>
      {/* chart title, just above the plot box */}
      <div style={{ position: 'absolute', left: mm(panelLeftMm), top: mm(chartsTopMm - H * 0.085), maxWidth: plotWpx }}>
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: geo.pt(14), fontWeight: 400, lineHeight: 1.05, color: DATAVIZ.ink }}>
          {panel.title}
        </div>
      </div>

      {/* the computed hook, right-aligned over the plot box */}
      {hook && (
        <div style={{ position: 'absolute', left: mm(panelLeftMm), top: mm(chartsTopMm - H * 0.04), width: plotWpx, textAlign: 'right' }}>
          <span style={{ ...display(geo, 15, 400), color: DATAVIZ.grows }}>{hook}</span>
        </div>
      )}

      {/* gridlines from 0 → domainMax (faint), drawn behind the bars */}
      <svg
        width={plotWpx}
        height={plotHpx}
        viewBox={`0 0 ${plotWpx} ${plotHpx}`}
        style={{ position: 'absolute', left: mm(panelLeftMm), top: mm(chartsTopMm), overflow: 'visible' }}
      >
        {panel.bars.yTicks.map((t) => (
          <line key={t.value} x1={0} y1={mm(t.y)} x2={plotWpx} y2={mm(t.y)} stroke={DATAVIZ.hairline} strokeWidth={Math.max(1, mm(0.3))} />
        ))}
        {/* baseline (the zero rule the bars stand on) emphasised a touch */}
        <line x1={0} y1={plotHpx} x2={plotWpx} y2={plotHpx} stroke={DATAVIZ.muted} strokeWidth={Math.max(1, mm(0.5))} />
      </svg>

      {/* faint axis labels (percent only: makes the 0–100 anchor explicit) */}
      {showAxisLabels &&
        panel.bars.yTicks.map((t) => (
          <div
            key={t.value}
            style={{
              position: 'absolute',
              left: mm(panelLeftMm) - mm(1.5),
              top: mm(chartsTopMm + t.y),
              transform: 'translate(-100%, -50%)',
              ...eyebrow(geo, 7, DATAVIZ.faint),
              whiteSpace: 'nowrap',
            }}
          >
            {formatPercent(t.value)}
          </div>
        ))}

      {/* the bars: relief rectangle + value label above + name on the baseline */}
      {bars.map((bar) => (
        <BarMark
          key={bar.id}
          bar={bar}
          unit={panel.unit}
          stats={panel.stats}
          geo={geo}
          panelLeftMm={panelLeftMm}
          chartsTopMm={chartsTopMm}
          chartsBottomMm={chartsBottomMm}
          H={H}
        />
      ))}

      {/* per-chart annotations: honest-axis note + discreet source caption */}
      <div style={{ position: 'absolute', left: mm(panelLeftMm), top: mm(chartsBottomMm + H * 0.085), maxWidth: plotWpx }}>
        <ScaleNote geo={geo} note={scaleNote} />
        <div style={{ marginTop: mm(H * 0.008) }}>
          <SourceCaption geo={geo} data={sources} />
        </div>
      </div>
    </>
  )
}

/* ── one bar: neumorphic relief rectangle, value above, name on the baseline ───── */

function BarMark({
  bar,
  unit,
  stats,
  geo,
  panelLeftMm,
  chartsTopMm,
  chartsBottomMm,
  H,
}: {
  bar: Bar
  unit: string
  stats: BarStats | null
  geo: PrintPageProps['geo']
  panelLeftMm: number
  chartsTopMm: number
  chartsBottomMm: number
  H: number
}) {
  const { mm } = geo
  const leftPx = mm(panelLeftMm + bar.x)
  const topPx = mm(chartsTopMm + bar.top)
  const wPx = mm(bar.width)
  const hPx = mm(bar.barHeight)
  const centerPx = mm(panelLeftMm + bar.center)
  const radius = mm(2)
  const color = barColor(unit, bar, stats)
  const relief = elevation(datavizTheme, { depth: 'raised', distance: mm(0.5), blur: mm(2), radius })

  return (
    <>
      {/* the bar */}
      <div
        style={{
          position: 'absolute',
          left: leftPx,
          top: topPx,
          width: wPx,
          height: Math.max(hPx, Math.max(1, mm(0.4))),
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          background: color,
          ...relief,
        }}
      />

      {/* value label, just above the bar top */}
      <div
        style={{
          position: 'absolute',
          left: centerPx,
          top: topPx - mm(H * 0.006),
          transform: 'translate(-50%, -100%)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          fontFamily: TEXT_FONT,
          fontSize: geo.pt(13),
          fontWeight: 600,
          lineHeight: 1,
          color: DATAVIZ.ink,
        }}
      >
        {formatBarValue(bar.value, unit)}
      </div>

      {/* the name on the baseline */}
      <div
        style={{
          position: 'absolute',
          left: centerPx,
          top: mm(chartsBottomMm + H * 0.02),
          transform: 'translateX(-50%)',
          textAlign: 'center',
          maxWidth: Math.max(wPx * 1.6, mm(28)),
          ...label(geo, 10, DATAVIZ.inkSoft),
        }}
      >
        {bar.label}
      </div>
    </>
  )
}

/* ── helpers: computed hook + per-bar colour ──────────────────────────────────── */

/**
 * The computed hook for a chart, by unit — never hard-coded. The time chart, when
 * the AI run is under half the baseline, reads "menos de la mitad del tiempo"; the
 * adoption chart reads "hasta el {max} %". Returns null when there's nothing honest
 * to claim.
 */
function hookFor(unit: string, stats: BarStats | null): string | null {
  if (!stats) return null
  if (unit === 'minutes') return stats.lessThanHalf ? 'Menos de la mitad del tiempo' : null
  if (unit === 'percent') return `Hasta el ${formatPercent(stats.maxValue)}`
  return null
}

/**
 * Per-bar colour. On the time chart the fast (AI) bar is the smallest value →
 * highlighted in the "grows" green, the slow baseline stays a quiet grey; the
 * adoption bars are all the data accent.
 */
function barColor(unit: string, bar: Bar, stats: BarStats | null): string {
  if (unit === 'minutes') return stats && bar.value === stats.minValue ? DATAVIZ.grows : DATAVIZ.faint
  return DATAVIZ.accent
}
