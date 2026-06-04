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
import { formatCompact } from './dataviz-scales'
import {
  ACELERACION_INV_ID,
  chartInputFor,
  formatChartValue,
  planAccelerationLayout,
  type ChartPanel,
} from './aceleracion'
import type { ModelPoint } from './model-sizes'
import { piecesByInvId, type WallDatum } from '../space/wall-data'

/**
 * aceleracion — the #11 print page "Aceleración" (wall 11 / `wall-10`, S3).
 * ──────────────────────────────────────────────────────────────────────────
 * S3 "Nave E". The visitor has felt how fast models improve; this 23 m light-box
 * makes the *acceleration* land with two honest, sourced log charts shown side by
 * side (zoned per camera, never a single stretched poster):
 *
 *   • **Horizonte de tareas (METR)** — the length of human work a model finishes
 *     autonomously (2 s → 2 h in ~6 years);
 *   • **Ventana de contexto** — the token window each milestone shipped with
 *     (2K → 1M in ~4 years).
 *
 * Code-rendered (never AI-invented): every point is a researched, dated, sourced
 * figure from `wall-data.ts` (`piecesByInvId(11)`), placed by the unit-tested
 * `layoutModelTimeline` (year → x linear, value → y log) via `planAccelerationLayout`.
 * Both charts being exponentials, the only honest read is the **logarithmic**
 * y-axis — stamped per chart with the scale note + a discreet source caption.
 *
 * Pure inline styles (Remotion has no Tailwind); authored in `geo` units so it
 * reads at print scale at any wall size / DPI. Layout maths: `aceleracion.ts`.
 */

export function Aceleracion({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const invId = typeof doc.props?.invId === 'number' ? (doc.props.invId as number) : ACELERACION_INV_ID
  const pieces = piecesByInvId(invId)
  const charts = pieces.map(chartInputFor)
  // Keep the original sourced data per chart for the source caption (timeline
  // points carry value/date but not figure/sourceURL).
  const sourcesBySlug = new Map<string, WallDatum[]>(pieces.map((p) => [p.slug, p.data]))

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const { chartsLeftMm, chartsTopMm, chartsBottomMm, panels } = planAccelerationLayout(charts, W, H)

  return (
    <>
      <DataField>
        {/* faint vignette so the dark field reads as depth, not flat black */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(130% 120% at 20% 24%, #11151e 0%, ${DATAVIZ.bg} 58%, #05060a 100%)`,
          }}
        />
      </DataField>

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* ── header: room eyebrow + title + the message ── */}
        <div style={{ position: 'absolute', left: mm(chartsLeftMm), top: mm(H * 0.06), maxWidth: mm(W * 0.62) }}>
          <div style={eyebrow(geo, 9, DATAVIZ.accent)}>S3 · NAVE E</div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: geo.pt(26),
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: geo.pt(-0.5),
              color: DATAVIZ.ink,
              marginTop: mm(H * 0.012),
            }}
          >
            Aceleración
          </div>
          <div style={{ ...label(geo, 13, DATAVIZ.inkSoft), marginTop: mm(H * 0.018), maxWidth: mm(W * 0.55) }}>
            No es que los modelos mejoren: es que se aceleran. Lo que pueden hacer y lo que pueden recordar se
            multiplican año tras año.
          </div>
        </div>

        {/* ── the zoned charts (one column per camera) ── */}
        {panels.map((panel) => (
          <TimelineChart
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

/* ── one zoned chart: title + ×hook + log trajectory + dots + sources ──────────── */

function TimelineChart({
  panel,
  sources,
  geo,
  chartsLeftMm,
  chartsTopMm,
  chartsBottomMm,
  H,
}: {
  panel: ChartPanel
  sources: ReadonlyArray<WallDatum>
  geo: PrintPageProps['geo']
  chartsLeftMm: number
  chartsTopMm: number
  chartsBottomMm: number
  H: number
}) {
  const { mm } = geo
  const panelLeftMm = chartsLeftMm + panel.x
  const { timeline, growth } = panel

  const plotWpx = mm(panel.width)
  const plotHpx = mm(panel.height)
  const polyline = timeline.points.map((p) => `${mm(p.x)},${mm(p.y)}`).join(' ')

  return (
    <>
      {/* chart title + unit, just above the plot box */}
      <div style={{ position: 'absolute', left: mm(panelLeftMm), top: mm(chartsTopMm - H * 0.05), maxWidth: plotWpx }}>
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: geo.pt(15), fontWeight: 400, lineHeight: 1, color: DATAVIZ.ink }}>
          {panel.title}
        </div>
      </div>

      {/* the ×growth hook, right-aligned over the plot box */}
      {growth && (
        <div style={{ position: 'absolute', left: mm(panelLeftMm), top: mm(chartsTopMm - H * 0.055), width: plotWpx, textAlign: 'right' }}>
          <span style={{ ...display(geo, 22, 400), color: DATAVIZ.grows }}>×{formatCompact(growth.growthFactor)}</span>
          <div style={{ ...label(geo, 9.5, DATAVIZ.muted), marginTop: mm(H * 0.003) }}>
            ≈{Math.round(growth.ordersOfMagnitude)} órdenes en {growth.yearSpan} años
          </div>
        </div>
      )}

      {/* log decade gridlines + the growth trajectory */}
      <svg
        width={plotWpx}
        height={plotHpx}
        viewBox={`0 0 ${plotWpx} ${plotHpx}`}
        style={{ position: 'absolute', left: mm(panelLeftMm), top: mm(chartsTopMm), overflow: 'visible' }}
      >
        {timeline.yTicks.map((t) => (
          <line key={t.value} x1={0} y1={mm(t.y)} x2={plotWpx} y2={mm(t.y)} stroke={DATAVIZ.hairline} strokeWidth={Math.max(1, mm(0.3))} />
        ))}
        <polyline
          points={polyline}
          fill="none"
          stroke={DATAVIZ.accent}
          strokeWidth={Math.max(1, mm(1.1))}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
      </svg>

      {/* the data points: dot + name + value, year on the baseline */}
      {timeline.points.map((p) => (
        <ChartDot
          key={p.id}
          p={p}
          unit={panel.unit}
          geo={geo}
          panelLeftMm={panelLeftMm}
          panelWmm={panel.width}
          panelHmm={panel.height}
          chartsTopMm={chartsTopMm}
          chartsBottomMm={chartsBottomMm}
          H={H}
        />
      ))}

      {/* per-chart annotations: log scale note + discreet source caption */}
      <div style={{ position: 'absolute', left: mm(panelLeftMm), top: mm(chartsBottomMm + H * 0.08), maxWidth: plotWpx }}>
        <ScaleNote geo={geo} note="Escala logarítmica" />
        <div style={{ marginTop: mm(H * 0.008) }}>
          <SourceCaption geo={geo} data={sources} />
        </div>
      </div>
    </>
  )
}

/* ── one data point: neumorphic dot, name + value, year on the baseline ────────── */

function ChartDot({
  p,
  unit,
  geo,
  panelLeftMm,
  panelWmm,
  panelHmm,
  chartsTopMm,
  chartsBottomMm,
  H,
}: {
  p: ModelPoint
  unit: string
  geo: PrintPageProps['geo']
  panelLeftMm: number
  panelWmm: number
  panelHmm: number
  chartsTopMm: number
  chartsBottomMm: number
  H: number
}) {
  const { mm } = geo
  const cx = mm(panelLeftMm + p.x)
  const cy = mm(chartsTopMm + p.y)
  const r = mm(H * 0.014)
  const dot = elevation(datavizTheme, { depth: 'raised', distance: r * 0.06, blur: r * 0.2, radius: r })

  // Horizontal anchor: left-anchor the first point, right-anchor the last, else centre.
  const fracX = p.x / panelWmm
  const halign: 'left' | 'center' | 'right' = fracX < 0.1 ? 'left' : fracX > 0.9 ? 'right' : 'center'
  const xform = halign === 'left' ? 'translateX(0)' : halign === 'right' ? 'translateX(-100%)' : 'translateX(-50%)'
  const labelLeft = halign === 'left' ? cx - r : halign === 'right' ? cx + r : cx

  // Vertical anchor: points near the top of the plot get their label *below* the dot
  // (so it never collides with the chart title); the rest sit above.
  const above = p.y / panelHmm > 0.22
  const labelTop = above ? cy - r - mm(H * 0.01) : cy + r + mm(H * 0.01)
  const yform = above ? 'translateY(-100%)' : 'translateY(0)'

  return (
    <>
      {/* the dot */}
      <div
        style={{
          position: 'absolute',
          left: cx - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          background: DATAVIZ.accent,
          ...dot,
        }}
      />

      {/* name + value beside the dot */}
      <div
        style={{
          position: 'absolute',
          left: labelLeft,
          top: labelTop,
          transform: `${xform} ${yform}`,
          textAlign: halign,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: geo.pt(11), fontWeight: 400, lineHeight: 1, color: DATAVIZ.ink }}>
          {p.label}
        </div>
        <div style={{ fontFamily: TEXT_FONT, fontSize: geo.pt(10), fontWeight: 600, lineHeight: 1.15, color: DATAVIZ.inkSoft }}>
          {formatChartValue(p.value, unit)}
        </div>
      </div>

      {/* the year on the baseline */}
      <div
        style={{
          position: 'absolute',
          left: cx,
          top: mm(chartsBottomMm + H * 0.02),
          transform: 'translateX(-50%)',
          ...eyebrow(geo, 9, DATAVIZ.muted),
          whiteSpace: 'nowrap',
        }}
      >
        {p.year}
      </div>
    </>
  )
}
