import type { PrintPageProps } from '../types'
import { PrintFonts } from '../printFonts'
import { TipoField, tipoPalette } from './tipografia-kit'
import { LayerMonolith } from './escala-modelos-kit'
import { layersOf } from './escala-modelos'

/**
 * escala-8s1 — second half of the model-scale pair: **GPT-4 on wall 8S1**
 * (8.5 × 2.5 m), editorial light register.
 * ──────────────────────────────────────────────────────────────────────────
 * The payoff, textless. On 9E1 the models are small dark stacks of layers on
 * paper; here GPT-4's stack is so vast it BECOMES the wall — a dark layered
 * monolith filling every edge (≈120 layers, the deepest of the set). No labels,
 * no comparisons: the explanation lives on 9E1; this wall is the gut-punch. The
 * sheer dark mass against the airy 9E1 is the exponential made felt.
 *
 * Honest, code-rendered; GPT-4's depth (≈120 layers) is the cited estimate. The
 * scale note + sources ride 9E1 (same data). Maths: `escala-modelos.ts`.
 */

export function Escala8S1({ doc, geo }: PrintPageProps) {
  const pal = tipoPalette(doc.theme)
  return (
    <>
      <PrintFonts />
      <TipoField pal={pal} />
      {/* GPT-4 as a colossal 3D block of ~120 stacked floors, too tall for the wall */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <LayerMonolith pal={pal} wPx={geo.mediaWidthPx} hPx={geo.mediaHeightPx} layers={layersOf('gpt4')} seed={11} />
      </div>
    </>
  )
}
