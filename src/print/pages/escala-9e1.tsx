import type { PrintPageProps } from '../types'
import type { PrintGeometry } from '../geometry'
import type { CSSProperties } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight02Icon } from '@hugeicons-pro/core-stroke-standard'
import { PrintFonts } from '../printFonts'
import { type TipoPalette, TipoField, tipoEyebrow, tipoH2, tipoH4, tipoPalette } from './tipografia-kit'
import { eventTypeScale } from './tipografia'
import { LayerStack, MiniMatrix } from './escala-modelos-kit'
import { formatFactorEs, formatParamsEs, growthFactor, layersOf, modelSideMm, yearOf } from './escala-modelos'
import { pieceBySlug } from '../space/wall-data'

/**
 * escala-9e1 — first half of the model-scale pair: **Perceptrón · AlexNet · GPT-2
 * on wall 9E1** (10.75 × 2.5 m), editorial light register.
 * ──────────────────────────────────────────────────────────────────────────
 * Composed as ONE editorial sentence read left→right across the 10.75 m band
 * (the only structure that fits a 4.3:1 wall at 4.5 m — the eye sweeps, it does
 * not compose). The headline OPENS the sentence inline on the left, centred on
 * the box line; the three honest squares are the chronological predicate, baseline-
 * aligned on a single hairline ground rule so the size ramp (a ~0.8 mm Perceptrón
 * speck → AlexNet 0.28 m → GPT-2 1.4 m) reads as a staircase growing UP from the
 * floor — the staircase IS the exponential. The right ~40 % is a deliberate runway
 * the next model must travel to leave the wall: a small black Huge Icons arrow
 * carries GPT-4 off → its companion wall 8-S-1 (the textless monolith).
 *
 * Two horizontal axes only (ground rule + cartela line), hierarchy by colour not
 * size, the single brand-blue accent reserved for the Perceptrón locator dot alone.
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

/** Sentence-case support line (deck / sub-labels) — the eyebrow recipe, un-tracked. */
function softLine(geo: PrintGeometry, sizePt: number, color: string): CSSProperties {
  return { ...tipoEyebrow(geo, sizePt, color), textTransform: 'none', letterSpacing: 0, fontWeight: 400, lineHeight: 1.4 }
}

export function Escala9E1({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : 4.5

  const pal = tipoPalette(doc.theme)
  const W = geo.dims.trimWidthMm
  // Hybrid-museográfico vertical fit: compose against the tuned reference height and
  // centre that "stage" on the museographic eye band, so a taller wall (3 m) gains
  // balanced breathing room above/below instead of sinking the horizon into the
  // lower third. At REF_H the stage IS the full trim, so the 2.5 m design is
  // byte-for-byte unchanged — only taller walls get the centred headroom.
  const REF_H = 2500
  const Hfull = geo.dims.trimHeightMm
  const H = Math.min(Hfull, REF_H)
  const stageTopPx = geo.bleedPx + (geo.trimHeightPx - geo.mm(H)) / 2
  const marginX = W * 0.045

  const piece = pieceBySlug('tamano-de-modelos')
  const all = (piece?.data as Datum[] | undefined) ?? FALLBACK
  const byId = new Map(all.map((d) => [d.id, d]))
  const order = ['perceptron', 'alexnet', 'gpt2']
  const small = order
    .map((id) => byId.get(id))
    .filter((d): d is Datum => Boolean(d))
    .map((d) => ({ id: d.id, label: DISPLAY_NAME[d.id] ?? d.label, value: d.value, year: yearOf(d.date) }))
  const gpt4 = byId.get('gpt4')
  const gpt2 = byId.get('gpt2')

  // ── the editorial spine: one common ground line; the boxes grow UP from it ──
  const groundY = H * 0.73
  // Full-width centre fractions (chronological, spread across the wall's centre-left
  // so the three breathe; the right is left clear for GPT-4, pinned to the edge).
  const centresFullFrac: Record<string, number> = { perceptron: 0.3, alexnet: 0.48, gpt2: 0.66 }
  const sq = new Map(
    small.map((m) => [m.id, { id: m.id, label: m.label, value: m.value, year: m.year, sideMm: modelSideMm(m.value), cxMm: (centresFullFrac[m.id] ?? 0.5) * W }] as const),
  )
  const gpt2Sq = sq.get('gpt2')!
  const midY = groundY - gpt2Sq.sideMm / 2 // the sentence line = GPT-2's mid-height
  const cartelaY = groundY + H * 0.055 // the museum labels hang just below the horizon

  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, ratio: 1.6, h1CapFraction: 0.05 })
  const microPt = scale.eyebrowPt * 0.82

  return (
    <>
      <PrintFonts />
      <TipoField pal={pal} />

      <div style={{ position: 'absolute', left: geo.bleedPx, top: stageTopPx, width: geo.trimWidthPx, height: geo.mm(H) }}>
        {/* ── the editorial spine: a full-bleed horizon the whole sentence sits on ── */}
        <div style={{ position: 'absolute', left: 0, top: mm(groundY), width: '100%', height: Math.max(1, mm(1.6)), background: pal.hairline }} />

        {/* ── the headline OPENS the sentence: inline-left, centred on the box line ── */}
        <div style={{ position: 'absolute', left: mm(marginX), top: mm(midY), transform: 'translateY(-50%)', width: mm(W * 0.205) }}>
          <span style={tipoEyebrow(geo, scale.eyebrowPt, pal.muted)}>Tamaño de modelos · 1958 → hoy</span>
          <div style={{ ...tipoH2(geo, scale.h2Pt, pal), marginTop: mm(H * 0.028) }}>Setenta años de escala</div>
          <div style={{ ...softLine(geo, scale.eyebrowPt, pal.inkSoft), marginTop: mm(H * 0.03), maxWidth: mm(W * 0.2) }}>
            El área de cada modelo es su número de parámetros. Las franjas oscuras son sus capas: la profundidad de la red.
          </div>
        </div>

        {/* ── the chronological predicate: AlexNet · GPT-2 grow up from the ground ── */}
        {(['alexnet', 'gpt2'] as const).map((id) => {
          const s = sq.get(id)!
          return (
            <div key={id}>
              <div style={{ position: 'absolute', left: mm(s.cxMm - s.sideMm / 2), top: mm(groundY - s.sideMm), width: mm(s.sideMm), height: mm(s.sideMm) }}>
                <LayerStack geo={geo} pal={pal} wPx={mm(s.sideMm)} hPx={mm(s.sideMm)} layers={layersOf(id)} seed={id === 'gpt2' ? 3 : 7} />
              </div>
              <Caption geo={geo} pal={pal} cxMm={s.cxMm} y={cartelaY} num={id === 'gpt2' ? '03' : '02'} name={s.label} sub={`${s.year} · ${formatParamsEs(s.value)}`} layers={`${layersOf(id)} capas`} namePt={scale.h4Pt} subPt={microPt} microPt={microPt} />
            </div>
          )
        })}

        {/* ── Perceptrón: a to-scale blue speck on the ground + a magnified detail above ── */}
        <PerceptronCallout geo={geo} pal={pal} cxMm={sq.get('perceptron')!.cxMm} groundY={groundY} cartelaY={cartelaY} H={H} W={W} namePt={scale.h4Pt} microPt={microPt} />

        {/* ── GPT-4 leaves the wall: the small black Huge Icons arrow exits right → 8-S-1 ── */}
        {gpt4 && gpt2 && (
          <Gpt4Cue
            geo={geo}
            pal={pal}
            W={W}
            midY={midY}
            H={H}
            h2Pt={scale.h2Pt}
            eyebrowPt={scale.eyebrowPt}
            microPt={microPt}
            factor={formatFactorEs(growthFactor(gpt2.value, gpt4.value))}
            params={formatParamsEs(gpt4.value)}
            layers={layersOf('gpt4')}
          />
        )}
      </div>
    </>
  )
}

/* ── a model caption (museum label), numbered, centred under its square ─────────── */

function Caption({
  geo,
  pal,
  cxMm,
  y,
  num,
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
  num: string
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
      <div style={{ ...tipoEyebrow(geo, microPt, pal.faint), marginBottom: mm(7) }}>{num}</div>
      <div style={tipoH4(geo, namePt, pal)}>{name}</div>
      <div style={{ ...tipoEyebrow(geo, subPt, pal.muted), marginTop: mm(8) }}>{sub}</div>
      <div style={{ ...tipoEyebrow(geo, microPt, pal.faint), marginTop: mm(5) }}>{layers}</div>
    </div>
  )
}

/* ── the Perceptrón: a to-scale speck on the ground + a magnified detail above ───── */

function PerceptronCallout({
  geo,
  pal,
  cxMm,
  groundY,
  cartelaY,
  H,
  W,
  namePt,
  microPt,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  cxMm: number
  groundY: number
  cartelaY: number
  H: number
  W: number
  namePt: number
  microPt: number
}) {
  const { mm } = geo
  const trueSideMm = modelSideMm(512) // ≈ 0.8 mm at the shared scale
  const dotR = Math.max(2, mm(H * 0.004))
  const boxWmm = W * 0.03
  const boxHmm = boxWmm / 2
  const boxLeft = cxMm - boxWmm / 2
  const insetBottom = groundY - H * 0.165 // floats above the ground, tethered to the speck
  const insetTop = insetBottom - boxHmm
  const mag = Math.round(boxWmm / Math.max(trueSideMm, 1e-6) / 50) * 50
  const leader = Math.max(1, mm(0.5))

  return (
    <>
      {/* the single brand-blue accent: the to-scale speck on the ground line */}
      <div style={{ position: 'absolute', left: mm(cxMm) - dotR, top: mm(groundY) - dotR, width: dotR * 2, height: dotR * 2, borderRadius: dotR, background: pal.accent }} />
      {/* dashed leader rising from the speck up to the magnified detail */}
      <div style={{ position: 'absolute', left: mm(cxMm) - leader / 2, top: mm(insetBottom), width: 0, height: mm(groundY - insetBottom) - dotR, borderLeft: `${leader}px dashed ${pal.muted}` }} />

      {/* the "Detalle · ×N" note above the inset */}
      <div style={{ position: 'absolute', left: mm(boxLeft), top: mm(insetTop - H * 0.038), whiteSpace: 'nowrap' }}>
        <span style={tipoEyebrow(geo, microPt, pal.muted)}>Detalle · ×{mag} · ampliado</span>
      </div>
      {/* a magnified single layer of 512 weights, framed as an inset */}
      <div style={{ position: 'absolute', left: mm(boxLeft), top: mm(insetTop), width: mm(boxWmm), height: mm(boxHmm), border: `${Math.max(1, mm(0.6))}px solid ${pal.ink}` }}>
        <MiniMatrix geo={geo} pal={pal} wPx={mm(boxWmm)} hPx={mm(boxHmm)} cols={32} rows={16} />
      </div>

      {/* caption on the common cartela line */}
      <div style={{ position: 'absolute', left: mm(cxMm), top: mm(cartelaY), transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
        <div style={{ ...tipoEyebrow(geo, microPt, pal.faint), marginBottom: mm(7) }}>01</div>
        <div style={tipoH4(geo, namePt, pal)}>Perceptrón</div>
        <div style={{ ...tipoEyebrow(geo, microPt, pal.muted), marginTop: mm(8) }}>1958 · 512 parámetros</div>
        <div style={{ ...tipoEyebrow(geo, microPt, pal.faint), marginTop: mm(5) }}>1 capa · ≈ 0,8 mm a escala</div>
      </div>
    </>
  )
}

/* ── the GPT-4 cue: pinned hard right, it announces the next wall (a small black arrow) ── */

function Gpt4Cue({
  geo,
  pal,
  W,
  midY,
  H,
  h2Pt,
  eyebrowPt,
  microPt,
  factor,
  params,
  layers,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  W: number
  midY: number
  H: number
  h2Pt: number
  eyebrowPt: number
  microPt: number
  factor: string
  params: string
  layers: number
}) {
  const { mm } = geo
  const arrowMm = H * 0.07 // small & disciplined, never a banner

  // One right-anchored unit pushed hard toward the edge (much tighter than the left
  // margin): the next model named, then the small black arrow as the rightmost mark,
  // pointing off the edge — it announces the next wall.
  return (
    <div style={{ position: 'absolute', right: mm(W * 0.022), top: mm(midY), transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: mm(W * 0.012), whiteSpace: 'nowrap' }}>
      <div style={{ textAlign: 'right' }}>
        <span style={tipoEyebrow(geo, eyebrowPt, pal.muted)}>El siguiente</span>
        <div style={{ ...tipoH2(geo, h2Pt, pal), marginTop: mm(H * 0.012) }}>GPT-4</div>
        <div style={{ ...softLine(geo, microPt, pal.muted), marginTop: mm(H * 0.02) }}>≈ {params} de parámetros · {layers} capas</div>
        <div style={{ ...softLine(geo, microPt, pal.muted), marginTop: mm(H * 0.006) }}>{factor} GPT-2 · no cabe a escala en esta pared</div>
      </div>
      <HugeiconsIcon icon={ArrowRight02Icon} size={mm(arrowMm)} color={pal.ink} strokeWidth={1} />
    </div>
  )
}
