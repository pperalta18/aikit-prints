import type { PrintGeometry } from '../geometry'
import { PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { scaleLinear } from './dataviz-scales'
import {
  FRONTIER_POINTS,
  FRONTIER_PROVIDERS,
  FRONTIER_PROVISIONAL,
  frontierEnvelope,
  frontierProvidersPresent,
  type FrontierPoint,
} from '../space/frontier-data'

/**
 * FrontierChart — "Inteligencia de los modelos frontera, en el tiempo", styled
 * after Artificial Analysis: square markers coloured by provider, a rising frontier
 * line, x = release date, y = Artificial Analysis Intelligence Index (v4.0).
 *
 * Renders a self-contained block of `wMm × hMm` (the page positions it in the chart
 * half of a side wall). Editorial palette to sit beside the galaxy. Data is
 * `frontier-data.ts` (provisional until Pablo's exact AA export). Authored in `geo`
 * units so it reads at wall scale. Pure SVG (text + rects + polyline).
 */

export type FrontierPalette = {
  ink: string
  muted: string
  faint: string
  hair: string
  grid: string
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

  // margins (mm) → px
  const mL = px(wMm * 0.085)
  const mR = px(wMm * 0.055)
  const mT = px(hMm * 0.2)
  const mB = px(hMm * 0.17)
  const plotW = W - mL - mR
  const plotH = H - mT - mB

  const x = scaleLinear({ domain: [2023, 2026.7], range: [mL, mL + plotW] })
  const y = scaleLinear({ domain: [0, 60], range: [mT + plotH, mT] })

  const yTicks = [0, 15, 30, 45, 60]
  const xTicks = [2023, 2024, 2025, 2026]
  const env = frontierEnvelope()
  const sq = px(hMm * 0.012) // half-side of a marker square
  const labelPt = px(hMm * 0.022)
  const axisPt = px(hMm * 0.02)

  const color = (p: FrontierPoint) => FRONTIER_PROVIDERS[p.provider].color

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* title */}
        <text x={mL} y={px(hMm * 0.07)} fontFamily={PRINT_DISPLAY_HAIR} fontSize={px(hMm * 0.05)} fill={pal.ink}>
          Inteligencia de los modelos
        </text>
        <text x={mL} y={px(hMm * 0.115)} fontFamily={PRINT_TEXT_FONT} fontSize={px(hMm * 0.022)} fill={pal.muted} letterSpacing={px(0.4)}>
          ÍNDICE DE INTELIGENCIA · EN EL TIEMPO
        </text>

        {/* y gridlines + labels */}
        {yTicks.map((t) => {
          const yy = y(t)
          return (
            <g key={`y${t}`}>
              <line x1={mL} y1={yy} x2={mL + plotW} y2={yy} stroke={pal.grid} strokeWidth={Math.max(1, px(0.4))} />
              <text x={mL - px(wMm * 0.012)} y={yy + axisPt * 0.35} textAnchor="end" fontFamily={PRINT_TEXT_FONT} fontSize={axisPt} fill={pal.faint}>
                {t}
              </text>
            </g>
          )
        })}

        {/* x axis labels */}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={mT + plotH + px(hMm * 0.06)} textAnchor="middle" fontFamily={PRINT_TEXT_FONT} fontSize={axisPt} fill={pal.faint}>
            {t}
          </text>
        ))}

        {/* frontier line (running best) */}
        <polyline
          points={env.map((p) => `${x(p.date)},${y(p.index)}`).join(' ')}
          fill="none"
          stroke={pal.ink}
          strokeWidth={Math.max(1, px(1.6))}
          strokeOpacity={0.45}
          strokeLinejoin="round"
        />

        {/* square markers */}
        {FRONTIER_POINTS.map((p) => (
          <rect key={p.id} x={x(p.date) - sq} y={y(p.index) - sq} width={sq * 2} height={sq * 2} fill={color(p)} rx={Math.max(1, px(0.6))} />
        ))}

        {/* labels for the frontier record-setters only (keep it clean) */}
        {env.map((p, i) => {
          const right = x(p.date) > mL + plotW * 0.7
          return (
            <text
              key={`l${p.id}`}
              x={x(p.date) + (right ? -sq - px(2) : sq + px(2))}
              y={y(p.index) - sq - px(hMm * 0.012) + (i % 2 ? -labelPt * 1.1 : 0)}
              textAnchor={right ? 'end' : 'start'}
              fontFamily={PRINT_TEXT_FONT}
              fontSize={labelPt}
              fill={pal.ink}
            >
              {p.label}
            </text>
          )
        })}

        {/* provider legend */}
        {frontierProvidersPresent().map((prov, i) => {
          const lx = mL + i * px(wMm * 0.135)
          const ly = mT + plotH + px(hMm * 0.12)
          return (
            <g key={`leg${prov}`}>
              <rect x={lx} y={ly - sq * 1.4} width={sq * 1.8} height={sq * 1.8} fill={FRONTIER_PROVIDERS[prov].color} rx={Math.max(1, px(0.6))} />
              <text x={lx + sq * 2.6} y={ly} fontFamily={PRINT_TEXT_FONT} fontSize={px(hMm * 0.018)} fill={pal.muted}>
                {FRONTIER_PROVIDERS[prov].label}
              </text>
            </g>
          )
        })}

        {/* source / provisional note */}
        <text x={mL} y={H - px(hMm * 0.02)} fontFamily={PRINT_TEXT_FONT} fontSize={px(hMm * 0.016)} fill={pal.faint}>
          {`Fuente: Artificial Analysis · Intelligence Index v4.0${FRONTIER_PROVISIONAL ? ' · datos provisionales' : ''}`}
        </text>
      </svg>
    </div>
  )
}
