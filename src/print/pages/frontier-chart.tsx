import type { PrintGeometry } from '../geometry'
import { PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { scaleLinear } from './dataviz-scales'
import {
  FRONTIER_POINTS,
  FRONTIER_PROVIDERS,
  FRONTIER_INDEX_VERSION,
  frontierLabLines,
  frontierProvidersPresent,
  frontierDateExtent,
  type FrontierPoint,
  type FrontierProvider,
} from '../space/frontier-data'

/**
 * FrontierChart — "Inteligencia de los modelos frontera, en el tiempo", faithful
 * to Artificial Analysis's signature chart: a square marker per model coloured by
 * lab, and one rising **stepped** line per lab (its best Intelligence Index so
 * far). x = release date, y = Artificial Analysis Intelligence Index (0–80).
 *
 * Renders a self-contained block of `wMm × hMm` (the page positions it in the
 * chart half of a side wall). Editorial palette to sit beside the galaxy; the
 * marker/line colours are AA's own (the chart is the one place colour carries the
 * message). Data: `frontier-data.ts` (baked from the AA API). Pure SVG.
 */

export type FrontierPalette = {
  ink: string
  muted: string
  faint: string
  hair: string
  grid: string
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Semiannual ticks (Jan & Jul) inside [d0, d1], as decimal years. */
function timeTicks(d0: number, d1: number): number[] {
  const ticks: number[] = []
  const startYear = Math.floor(d0)
  for (let y = startYear; y <= Math.ceil(d1); y++) {
    for (const frac of [0, 0.5]) {
      const t = y + frac
      if (t >= d0 && t <= d1) ticks.push(t)
    }
  }
  return ticks
}

/** Decimal year → "mmm 'yy". */
function fmtTick(t: number): string {
  const year = Math.floor(t)
  const month = Math.round((t - year) * 12)
  return `${MONTHS_ES[month] ?? 'ene'} ’${String(year % 100).padStart(2, '0')}`
}

export function FrontierChart({
  geo,
  wMm,
  hMm,
  pal,
}: {
  geo: PrintGeometry
  wMm: number
  hMm: number
  pal: FrontierPalette
}) {
  const px = geo.mm
  const W = px(wMm)
  const H = px(hMm)

  // margins (mm) → px: room above for title + legend, left for the y axis,
  // below for the time axis + source line.
  const mL = px(wMm * 0.062)
  const mR = px(wMm * 0.028)
  const mT = px(hMm * 0.215)
  const mB = px(hMm * 0.125)
  const plotW = W - mL - mR
  const plotH = H - mT - mB

  const [dmin, dmax] = frontierDateExtent()
  const xDomain: [number, number] = [dmin - 0.06, dmax + 0.07]
  const x = scaleLinear({ domain: xDomain, range: [mL, mL + plotW] })
  const y = scaleLinear({ domain: [0, 80], range: [mT + plotH, mT] })

  const yTicks = [0, 20, 40, 60, 80]
  const xTicks = timeTicks(xDomain[0], xDomain[1])

  const labLines = frontierLabLines()
  const providers = frontierProvidersPresent()
  const color = (p: FrontierProvider) => FRONTIER_PROVIDERS[p].color

  const sq = px(hMm * 0.0052) // half-side of a marker square
  const lineW = Math.max(1, px(hMm * 0.0024))
  const axisPt = px(hMm * 0.0165)
  const labelPt = px(hMm * 0.0165)

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* ── title block ───────────────────────────────────────────────── */}
        <text x={mL} y={px(hMm * 0.06)} fontFamily={PRINT_DISPLAY_HAIR} fontSize={px(hMm * 0.045)} fill={pal.ink}>
          Inteligencia de los modelos frontera, en el tiempo
        </text>
        <text x={mL} y={px(hMm * 0.092)} fontFamily={PRINT_TEXT_FONT} fontSize={px(hMm * 0.019)} fill={pal.muted} letterSpacing={px(0.6)}>
          {`ÍNDICE DE INTELIGENCIA · ARTIFICIAL ANALYSIS v${FRONTIER_INDEX_VERSION}`}
        </text>

        {/* watermark */}
        <text x={mL + plotW} y={px(hMm * 0.06)} textAnchor="end" fontFamily={PRINT_TEXT_FONT} fontSize={px(hMm * 0.02)} fill={pal.faint} letterSpacing={px(0.4)}>
          Artificial Analysis
        </text>

        {/* ── legend: provider dots, wrapping ───────────────────────────── */}
        <Legend
          providers={providers}
          x0={mL}
          y0={px(hMm * 0.135)}
          maxX={mL + plotW}
          fontPx={px(hMm * 0.017)}
          dotR={px(hMm * 0.008)}
          lineH={px(hMm * 0.04)}
          gap={px(hMm * 0.02)}
          color={color}
          ink={pal.muted}
        />

        {/* ── y gridlines + labels ──────────────────────────────────────── */}
        {yTicks.map((t) => {
          const yy = y(t)
          return (
            <g key={`y${t}`}>
              <line x1={mL} y1={yy} x2={mL + plotW} y2={yy} stroke={pal.grid} strokeWidth={Math.max(1, px(0.4))} />
              <text x={mL - px(wMm * 0.01)} y={yy + axisPt * 0.35} textAnchor="end" fontFamily={PRINT_TEXT_FONT} fontSize={axisPt} fill={pal.faint}>
                {t}
              </text>
            </g>
          )
        })}

        {/* y axis title (rotated) */}
        <text
          x={px(wMm * 0.016)}
          y={mT + plotH / 2}
          textAnchor="middle"
          fontFamily={PRINT_TEXT_FONT}
          fontSize={px(hMm * 0.018)}
          fill={pal.muted}
          letterSpacing={px(0.4)}
          transform={`rotate(-90 ${px(wMm * 0.016)} ${mT + plotH / 2})`}
        >
          ÍNDICE DE INTELIGENCIA
        </text>

        {/* x axis ticks + labels */}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} y1={mT + plotH} x2={x(t)} y2={mT + plotH + px(hMm * 0.012)} stroke={pal.grid} strokeWidth={Math.max(1, px(0.4))} />
            <text x={x(t)} y={mT + plotH + px(hMm * 0.045)} textAnchor="middle" fontFamily={PRINT_TEXT_FONT} fontSize={axisPt} fill={pal.faint}>
              {fmtTick(t)}
            </text>
          </g>
        ))}
        <text x={mL + plotW / 2} y={mT + plotH + px(hMm * 0.09)} textAnchor="middle" fontFamily={PRINT_TEXT_FONT} fontSize={px(hMm * 0.018)} fill={pal.muted} letterSpacing={px(0.4)}>
          FECHA DE LANZAMIENTO
        </text>

        {/* ── per-lab stepped progression lines (best so far), extended to now ── */}
        {labLines.map((lab) => {
          const pts = [...lab.points]
          const last = pts[pts.length - 1]
          const ext = `${pts.map((p) => `${x(p.date)},${y(p.index)}`).join(' ')} ${x(xDomain[1])},${y(last.index)}`
          return (
            <polyline
              key={`line-${lab.provider}`}
              points={ext}
              fill="none"
              stroke={color(lab.provider)}
              strokeWidth={lineW}
              strokeOpacity={0.85}
              strokeLinejoin="miter"
              strokeLinecap="butt"
            />
          )
        })}

        {/* ── square markers, one per model ─────────────────────────────── */}
        {FRONTIER_POINTS.map((p: FrontierPoint) => (
          <rect
            key={p.id}
            x={x(p.date) - sq}
            y={y(p.index) - sq}
            width={sq * 2}
            height={sq * 2}
            fill={color(p.provider)}
            rx={Math.max(1, px(0.5))}
          />
        ))}

        {/* ── source / index note ───────────────────────────────────────── */}
        <text x={mL} y={H - px(hMm * 0.018)} fontFamily={PRINT_TEXT_FONT} fontSize={px(hMm * 0.015)} fill={pal.faint}>
          {`Fuente: Artificial Analysis · artificialanalysis.ai · Intelligence Index v${FRONTIER_INDEX_VERSION} · variante de máximo esfuerzo por modelo`}
        </text>
      </svg>
    </div>
  )
}

/* ── legend: provider dots + labels, wrapping within the plot width ─────── */

function Legend({
  providers,
  x0,
  y0,
  maxX,
  fontPx,
  dotR,
  lineH,
  gap,
  color,
  ink,
}: {
  providers: FrontierProvider[]
  x0: number
  y0: number
  maxX: number
  fontPx: number
  dotR: number
  lineH: number
  gap: number
  color: (p: FrontierProvider) => string
  ink: string
}) {
  let cx = x0
  let cy = y0
  const items = providers.map((p) => {
    const label = FRONTIER_PROVIDERS[p].label
    const w = dotR * 2 + fontPx * 0.46 + label.length * fontPx * 0.52 + gap
    if (cx + w > maxX && cx > x0) {
      cx = x0
      cy += lineH
    }
    const item = { p, label, lx: cx, ly: cy }
    cx += w
    return item
  })

  return (
    <g>
      {items.map((it) => (
        <g key={`leg-${it.p}`}>
          <circle cx={it.lx + dotR} cy={it.ly - fontPx * 0.32} r={dotR} fill={color(it.p)} />
          <text x={it.lx + dotR * 2 + fontPx * 0.46} y={it.ly} fontFamily={PRINT_TEXT_FONT} fontSize={fontPx} fill={ink}>
            {it.label}
          </text>
        </g>
      ))}
    </g>
  )
}
