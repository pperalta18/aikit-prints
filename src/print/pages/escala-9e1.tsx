import type { PrintPageProps } from '../types'
import type { PrintGeometry } from '../geometry'
import { PrintFonts } from '../printFonts'
import { type TipoPalette, TipoField, tipoEyebrow, tipoH2, tipoH4, tipoPalette } from './tipografia-kit'
import { eventTypeScale } from './tipografia'
import { LayerStack, MiniMatrix } from './escala-modelos-kit'
import {
  type ScaleModel,
  formatFactorEs,
  formatParamsEs,
  growthFactor,
  layersOf,
  layoutSmallModels,
  yearOf,
} from './escala-modelos'
import { sourcesCaption } from './dataviz-scales'
import { pieceBySlug } from '../space/wall-data'

/**
 * escala-9e1 — first half of the model-scale pair: **Perceptrón · AlexNet · GPT-2
 * on wall 9E1** (10.75 × 2.5 m), editorial light register.
 * ──────────────────────────────────────────────────────────────────────────
 * Three models, centred as a group, each a dark **stack of layers** on paper —
 * a network is a stack of layers ("no es magia, es multiplicación de matrices").
 * The footprint area is the parameter count (the exponential), the number of
 * layers is the network depth: Perceptrón 1 layer / 512 params (a ~0.8 mm speck +
 * magnifier), AlexNet 8 / 60 M, GPT-2 48 / 1.5 bn. A cue points to GPT-4, which no
 * longer fits at scale (pair: `escala-8s1.tsx`, the textless monolith).
 *
 * Honest, code-rendered from the sourced `wall-data.ts`. Maths: `escala-modelos.ts`.
 */

const DISPLAY_NAME: Record<string, string> = { perceptron: 'Perceptrón', alexnet: 'AlexNet', gpt2: 'GPT-2', gpt4: 'GPT-4' }

type Datum = { id: string; label: string; value: number; date: string; figure: string; sourceURL: string; note?: string }

const FALLBACK: Datum[] = [
  { id: 'perceptron', label: 'Perceptrón', value: 512, date: '1958', figure: 'Perceptrón Mark I', sourceURL: 'https://en.wikipedia.org/wiki/Perceptron' },
  { id: 'alexnet', label: 'AlexNet', value: 60e6, date: '2012', figure: 'AlexNet', sourceURL: 'https://proceedings.neurips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks.pdf' },
  { id: 'gpt2', label: 'GPT-2', value: 1.5e9, date: '2019', figure: 'GPT-2', sourceURL: 'https://openai.com/index/gpt-2-1-5b-release/' },
  { id: 'gpt4', label: 'GPT-4', value: 1.8e12, date: '2023', figure: 'GPT-4 (estimación)', sourceURL: 'https://dbmi.hms.harvard.edu/news/should-ai-be-scaled-down' },
]

type Props = { readingDistanceM?: number }

export function Escala9E1({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : 4.5

  const pal = tipoPalette(doc.theme)
  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const marginX = W * 0.045

  const piece = pieceBySlug('tamano-de-modelos')
  const all = (piece?.data as Datum[] | undefined) ?? FALLBACK
  const byId = new Map(all.map((d) => [d.id, d]))
  const order = ['perceptron', 'alexnet', 'gpt2']
  const small: ScaleModel[] = order
    .map((id) => byId.get(id))
    .filter((d): d is Datum => Boolean(d))
    .map((d) => ({ id: d.id, label: DISPLAY_NAME[d.id] ?? d.label, value: d.value, year: yearOf(d.date) }))
  const sources = order.concat('gpt4').map((id) => byId.get(id)).filter((d): d is Datum => Boolean(d))
  const gpt4 = byId.get('gpt4')
  const gpt2 = byId.get('gpt2')

  // ── layout: squares centred on a common mid-line, distributed across the width ──
  const cy = H * 0.45
  const layout = layoutSmallModels(small, {
    wallWidthMm: W,
    wallHeightMm: H,
    marginXMm: marginX,
    minVisibleSideMm: 8,
    centerFractions: [0.12, 0.4, 0.66],
  })
  const sq = new Map(layout.squares.map((s) => [s.id, s]))
  const captionY = H * 0.78

  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, ratio: 1.6, h1CapFraction: 0.05 })
  const microPt = scale.eyebrowPt * 0.8

  return (
    <>
      <PrintFonts />
      <TipoField pal={pal} />

      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* ── header, top-left ── */}
        <div style={{ position: 'absolute', left: mm(marginX), top: mm(H * 0.085), width: mm(W * 0.5) }}>
          <span style={tipoEyebrow(geo, scale.eyebrowPt, pal.muted)}>Tamaño de modelos · 1958 → hoy</span>
          <div style={{ ...tipoH2(geo, scale.h2Pt, pal), marginTop: mm(H * 0.035) }}>Setenta años de escala</div>
          <div style={{ ...tipoEyebrow(geo, microPt, pal.muted), textTransform: 'none', letterSpacing: 0, fontWeight: 400, lineHeight: 1.4, marginTop: mm(H * 0.028), maxWidth: mm(W * 0.3) }}>
            El área de cada modelo es su número de parámetros. Las franjas son sus capas — la profundidad de la red.
          </div>
        </div>

        {/* ── the three model stacks (centred on cy) ── */}
        {small.map((m) => {
          const s = sq.get(m.id)!
          if (m.id === 'perceptron') return null // a speck → magnifier below
          const topMm = cy - s.sideMm / 2
          return (
            <div key={m.id}>
              <div style={{ position: 'absolute', left: mm(s.cxMm - s.sideMm / 2), top: mm(topMm), width: mm(s.sideMm), height: mm(s.sideMm) }}>
                <LayerStack geo={geo} pal={pal} wPx={mm(s.sideMm)} hPx={mm(s.sideMm)} layers={layersOf(m.id)} seed={m.id === 'gpt2' ? 3 : 7} />
              </div>
              <Caption geo={geo} pal={pal} cxMm={s.cxMm} y={captionY} name={m.label} sub={`${m.year} · ${formatParamsEs(m.value)}`} layers={`${layersOf(m.id)} capas`} namePt={scale.h4Pt} subPt={scale.eyebrowPt} microPt={microPt} />
            </div>
          )
        })}

        {/* ── Perceptrón: a to-scale locator + a magnified single layer (512 weights) ── */}
        <PerceptronCallout geo={geo} pal={pal} cxMm={sq.get('perceptron')!.cxMm} trueSideMm={sq.get('perceptron')!.sideMm} cy={cy} captionY={captionY} H={H} W={W} namePt={scale.h4Pt} subPt={scale.eyebrowPt} microPt={microPt} />

        {/* ── cross-wall cue: GPT-4 doesn't fit at scale ── */}
        {gpt4 && gpt2 && (
          <Gpt4Cue geo={geo} pal={pal} W={W} marginX={marginX} cy={cy} H={H} namePt={scale.h2Pt} subPt={scale.eyebrowPt} microPt={microPt} factor={formatFactorEs(growthFactor(gpt2.value, gpt4.value))} />
        )}

        {/* ── one discreet honesty line, bottom-left ── */}
        <div style={{ position: 'absolute', left: mm(marginX), bottom: mm(H * 0.05), maxWidth: mm(W * 0.6) }}>
          <span style={tipoEyebrow(geo, microPt, pal.faint)}>
            Representado a escala · área ∝ parámetros · {sourcesCaption(sources)}
          </span>
        </div>
      </div>
    </>
  )
}

/* ── a model caption (museum label), centred under its square on a common line ─── */

function Caption({
  geo,
  pal,
  cxMm,
  y,
  name,
  sub,
  layers,
  namePt,
  subPt,
  microPt,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  cxMm: number
  y: number
  name: string
  sub: string
  layers: string
  namePt: number
  subPt: number
  microPt: number
}) {
  const { mm } = geo
  return (
    <div style={{ position: 'absolute', left: mm(cxMm), top: mm(y), transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
      <div style={tipoH4(geo, namePt, pal)}>{name}</div>
      <div style={{ ...tipoEyebrow(geo, subPt, pal.muted), marginTop: mm(8) }}>{sub}</div>
      <div style={{ ...tipoEyebrow(geo, microPt, pal.faint), marginTop: mm(5) }}>{layers}</div>
    </div>
  )
}

/* ── the Perceptrón magnifier ─────────────────────────────────────────────────── */

function PerceptronCallout({
  geo,
  pal,
  cxMm,
  trueSideMm,
  cy,
  captionY,
  H,
  W,
  namePt,
  subPt,
  microPt,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  cxMm: number
  trueSideMm: number
  cy: number
  captionY: number
  H: number
  W: number
  namePt: number
  subPt: number
  microPt: number
}) {
  const { mm } = geo
  const dotR = mm(H * 0.0035)
  const boxWmm = W * 0.038
  const boxHmm = boxWmm / 2
  const boxLeft = cxMm - boxWmm / 2
  const boxTop = cy - boxHmm / 2
  const mag = Math.round(boxWmm / Math.max(trueSideMm, 1e-6) / 50) * 50

  return (
    <>
      {/* locator dot at the true (to-scale) position */}
      <div style={{ position: 'absolute', left: mm(cxMm) - dotR, top: mm(cy) - dotR, width: dotR * 2, height: dotR * 2, borderRadius: dotR, background: pal.accent }} />
      {/* dashed leader from the speck up to the magnifier */}
      <div style={{ position: 'absolute', left: mm(cxMm) - Math.max(1, mm(0.4)) / 2, top: mm(boxTop + boxHmm), width: 0, height: mm(cy - dotR - (boxTop + boxHmm)), borderLeft: `${Math.max(1, mm(0.4))}px dashed ${pal.muted}` }} />

      <div style={{ position: 'absolute', left: mm(boxLeft), top: mm(boxTop - H * 0.04), whiteSpace: 'nowrap' }}>
        <span style={tipoEyebrow(geo, microPt, pal.muted)}>Detalle · ×{mag}</span>
      </div>
      {/* a magnified single layer of 512 weights, framed as an inset */}
      <div style={{ position: 'absolute', left: mm(boxLeft), top: mm(boxTop), width: mm(boxWmm), height: mm(boxHmm), border: `${Math.max(1, mm(0.6))}px solid ${pal.ink}` }}>
        <MiniMatrix geo={geo} pal={pal} wPx={mm(boxWmm)} hPx={mm(boxHmm)} cols={32} rows={16} />
      </div>
      {/* caption on the common label line */}
      <div style={{ position: 'absolute', left: mm(cxMm), top: mm(captionY), transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
        <div style={tipoH4(geo, namePt, pal)}>Perceptrón</div>
        <div style={{ ...tipoEyebrow(geo, subPt, pal.muted), marginTop: mm(8) }}>1958 · 512 parámetros</div>
        <div style={{ ...tipoEyebrow(geo, microPt, pal.faint), marginTop: mm(5) }}>1 capa · ≈ 0,8 mm a escala</div>
      </div>
    </>
  )
}

/* ── the GPT-4 cross-wall cue ──────────────────────────────────────────────────── */

function Gpt4Cue({
  geo,
  pal,
  W,
  marginX,
  cy,
  H,
  namePt,
  subPt,
  microPt,
  factor,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  W: number
  marginX: number
  cy: number
  H: number
  namePt: number
  subPt: number
  microPt: number
  factor: string
}) {
  const { mm } = geo
  const boxWmm = W * 0.2
  const boxLeft = W - marginX - boxWmm
  const arrowW = mm(boxWmm * 0.6)
  const arrowH = mm(H * 0.045)

  return (
    <div style={{ position: 'absolute', left: mm(boxLeft), top: mm(cy - H * 0.12), width: mm(boxWmm), textAlign: 'right' }}>
      <div style={tipoEyebrow(geo, subPt, pal.muted)}>El siguiente</div>
      <div style={{ ...tipoH2(geo, namePt, pal), marginTop: mm(H * 0.008) }}>GPT-4</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: mm(H * 0.025) }}>
        <svg width={arrowW} height={arrowH} viewBox={`0 0 ${arrowW} ${arrowH}`} style={{ overflow: 'visible' }}>
          <line x1={0} y1={arrowH / 2} x2={arrowW - arrowH * 0.5} y2={arrowH / 2} stroke={pal.accent} strokeWidth={Math.max(1, mm(1.2))} />
          <polyline points={`${arrowW - arrowH * 0.7},${arrowH * 0.16} ${arrowW},${arrowH / 2} ${arrowW - arrowH * 0.7},${arrowH * 0.84}`} fill="none" stroke={pal.accent} strokeWidth={Math.max(1, mm(1.2))} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ ...tipoEyebrow(geo, subPt, pal.muted), textTransform: 'none', letterSpacing: 0, marginTop: mm(H * 0.02), lineHeight: 1.4 }}>
        {factor} GPT-2. No cabe a escala en esta pared.
      </div>
    </div>
  )
}
