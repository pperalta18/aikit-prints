import type { CSSProperties } from 'react'
import { KIT_BLUE, DISPLAY_FONT, TEXT_FONT } from '@/lib/neumorphism'
import type { PrintPageProps } from '../types'

/**
 * contexto — wall 11-W-TEXT+CODE (Nave E · cámara TEXT+CODE, 7.5 × 2.5 m).
 * ──────────────────────────────────────────────────────────────────────
 * **La ventana de contexto** — la "memoria de trabajo" del modelo: cuánto texto
 * puede leer y tener presente de una sola vez. El dato de verdad (tokens) no le
 * dice nada a nadie, así que cada hito se representa por **cuánto texto cabe en
 * esa memoria** en una unidad que cualquiera entiende: unas páginas → un capítulo
 * → una novela → una enciclopedia → dos biblias enteras.
 *
 * Visual: una progresión izquierda→derecha de **pilas de papel** sobre una línea
 * de suelo común; la altura de cada pila ∝ √(tokens) (acotada con un suelo para
 * que el primer hito siga siendo visible — nota de escala honesta). Encima de
 * cada pila, la equivalencia legible (el gancho); debajo de la línea, modelo ·
 * año · tokens. El presente (HOY · 2026) va en KIT_BLUE.
 *
 * Datos reales y datados (ventana de contexto al lanzamiento): GPT-3 2.048 ·
 * GPT-4 8.192 · Claude 2.1 200.000 · Gemini 1.5 Pro 1.000.000 · hoy 1–2M.
 * (Mismas fuentes que `wall-data.ts` → `ventana-de-contexto`.)
 *
 * Autoría en milímetros desde el origen de trim, tipografía en puntos: lee a
 * escala de imprenta a cualquier tamaño / DPI.
 */

const BG = '#ffffff'
const INK = '#1a1a1a'
const INK_SOFT = 'rgba(26,26,26,0.62)'
const HAIRLINE = 'rgba(26,26,26,0.85)'

type Item = {
  /** Model / hito name, e.g. "GPT-3". */
  model: string
  /** Launch year, e.g. "2020". */
  year: string
  /** Context window in tokens (the honest figure). */
  tokens: number
  /** Compact token label, e.g. "2K", "1M". */
  tokenLabel: string
  /** The relatable hook — what that much text *is* (one line, big). */
  equiv: string
  /** Sub-equivalence (smaller), e.g. "≈ 500 páginas". */
  equivSub: string
}

type Props = {
  items?: Item[]
}

/** The growth of context windows — defaults; the doc can override via props. */
const DEFAULT_ITEMS: Item[] = [
  { model: 'GPT-3', year: '2020', tokens: 2048, tokenLabel: '2K', equiv: 'Unas páginas', equivSub: '≈ un correo largo' },
  { model: 'GPT-4', year: '2023', tokens: 8192, tokenLabel: '8K', equiv: 'Un capítulo', equivSub: '≈ 25 páginas' },
  { model: 'Claude 2.1', year: '2023', tokens: 200000, tokenLabel: '200K', equiv: 'Una novela', equivSub: '≈ 500 páginas' },
  { model: 'Gemini 1.5 Pro', year: '2024', tokens: 1000000, tokenLabel: '1M', equiv: 'Una enciclopedia', equivSub: '≈ 3.000 páginas' },
  { model: 'Hoy', year: '2026', tokens: 2000000, tokenLabel: '2M', equiv: 'Dos biblias enteras', equivSub: '≈ una biblioteca' },
]

export function Contexto({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as Props
  const items = Array.isArray(p.items) && p.items.length ? p.items : DEFAULT_ITEMS

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const N = items.length

  /** Absolute placement in mm from the trim origin. */
  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  /* ── horizontal grid (mm) — stacks + gutters tile the content width ───────── */
  const MX = W * 0.04
  const CONTENT_X0 = MX
  const CONTENT_W = W - 2 * MX
  const GUTTER_FRAC = 0.42 // generous air between the stacks
  const slotW = CONTENT_W / (N + (N - 1) * GUTTER_FRAC)
  const PITCH = slotW * (1 + GUTTER_FRAC)
  const slotLeft = (i: number) => CONTENT_X0 + i * PITCH
  const slotCenter = (i: number) => slotLeft(i) + slotW / 2

  /* ── vertical grid (mm) ──────────────────────────────────────────────────── */
  const GROUND_Y = H * 0.84 // common floor line the stacks rise from
  const STACK_MAX_H = H * 0.5 // tallest stack (the present)
  const STACK_FLOOR_H = H * 0.036 // smallest visible stack (√-floored → scale note)
  const EQUIV_GAP = H * 0.018 // air between a stack's top and its equiv label
  const CAP_Y = GROUND_Y + H * 0.026 // model · tokens caption under the floor

  /* honest height map: area/height ∝ √tokens, floored so the first hito reads */
  const sq = (v: number) => Math.sqrt(Math.max(v, 1))
  const minT = Math.min(...items.map((d) => d.tokens))
  const maxT = Math.max(...items.map((d) => d.tokens))
  const span = sq(maxT) - sq(minT) || 1
  const stackH = (tokens: number) => STACK_FLOOR_H + ((sq(tokens) - sq(minT)) / span) * (STACK_MAX_H - STACK_FLOOR_H)

  const stackW = slotW * 0.66
  const PAGE_MM = 7 // striation pitch (suggests stacked sheets)

  return (
    <>
      {/* clean white field, bled to the media edge */}
      <div style={{ position: 'absolute', inset: 0, background: BG }} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── header (top-left): eyebrow · question · deck ─────────────────────── */}
        <div style={{ ...at(MX, H * 0.07), width: mm(CONTENT_W) }}>
          <div style={{ fontFamily: TEXT_FONT, fontSize: pt(30), fontWeight: 600, letterSpacing: pt(1.2), textTransform: 'uppercase', color: INK_SOFT }}>
            S3 · Nave E · Texto + Código
          </div>
          <div style={{ marginTop: mm(20), fontFamily: DISPLAY_FONT, fontSize: pt(126), fontWeight: 500, letterSpacing: pt(-1.6), lineHeight: 1.0, color: INK }}>
            ¿Cuánto puede recordar de una sola vez?
          </div>
          <div style={{ marginTop: mm(22), fontFamily: TEXT_FONT, fontSize: pt(40), fontWeight: 400, lineHeight: 1.28, color: INK_SOFT, maxWidth: mm(CONTENT_W * 0.62) }}>
            La <strong style={{ fontWeight: 600, color: INK }}>ventana de contexto</strong> es la memoria de trabajo del modelo. En cuatro años pasó de unas páginas a una biblioteca entera.
          </div>
        </div>

        {/* ── the row of memory stacks ─────────────────────────────────────────── */}
        {items.map((item, i) => {
          const isNow = i === N - 1
          const h = stackH(item.tokens)
          const top = GROUND_Y - h
          const accent = isNow ? KIT_BLUE : INK
          const faint = isNow ? 'rgba(0,112,249,0.10)' : 'rgba(26,26,26,0.05)'
          const striate = isNow ? 'rgba(0,112,249,0.16)' : 'rgba(26,26,26,0.11)'
          return (
            <div key={`stack-${i}`}>
              {/* equiv label — the relatable hook, floating above the stack top */}
              <div style={{ ...at(slotLeft(i) - slotW * 0.17, top - EQUIV_GAP), width: mm(slotW * 1.34), textAlign: 'center', transform: 'translateY(-100%)' }}>
                <div style={{ fontFamily: DISPLAY_FONT, fontSize: pt(58), fontWeight: 500, letterSpacing: pt(-0.4), lineHeight: 1.02, color: accent }}>
                  {item.equiv}
                </div>
                <div style={{ marginTop: mm(5), fontFamily: TEXT_FONT, fontSize: pt(30), fontWeight: 500, color: INK_SOFT }}>
                  {item.equivSub}
                </div>
              </div>

              {/* the paper stack: height ∝ √tokens, page striations for texture */}
              <div
                style={{
                  ...at(slotCenter(i) - stackW / 2, top),
                  width: mm(stackW),
                  height: mm(h),
                  background:
                    `repeating-linear-gradient(to bottom, ${striate} 0 ${mm(0.6)}px, rgba(0,0,0,0) ${mm(0.6)}px ${mm(PAGE_MM)}px), ` +
                    faint,
                  borderLeft: `${mm(1.2)}px solid ${accent}`,
                  borderRight: `${mm(1.2)}px solid ${accent}`,
                  borderTop: `${mm(2.4)}px solid ${accent}`,
                  boxSizing: 'border-box',
                }}
              />

              {/* caption under the floor: model · year · tokens */}
              <div style={{ ...at(slotLeft(i) - slotW * 0.17, CAP_Y), width: mm(slotW * 1.34), textAlign: 'center' }}>
                <div style={{ fontFamily: DISPLAY_FONT, fontSize: pt(64), fontWeight: 500, letterSpacing: pt(-0.6), lineHeight: 1, color: accent }}>
                  {item.tokenLabel}
                  <span style={{ fontFamily: TEXT_FONT, fontSize: pt(28), fontWeight: 600, letterSpacing: pt(0.4), color: INK_SOFT }}> tokens</span>
                </div>
                <div style={{ marginTop: mm(8), fontFamily: TEXT_FONT, fontSize: pt(34), fontWeight: 500, color: INK }}>
                  {item.model} {isNow ? '' : `· ${item.year}`}
                  {isNow && <span style={{ color: KIT_BLUE, fontWeight: 600 }}> · {item.year}</span>}
                </div>
              </div>
            </div>
          )
        })}

        {/* ── common ground line under the stacks ──────────────────────────────── */}
        <div style={{ ...at(slotCenter(0) - stackW * 0.8, GROUND_Y), width: mm(slotCenter(N - 1) - slotCenter(0) + stackW * 1.6), height: mm(3), background: HAIRLINE }} />

        {/* ── footnote: token gloss + scale note + sources ─────────────────────── */}
        <div style={{ ...at(MX, H * 0.955), width: mm(CONTENT_W) }}>
          <div style={{ fontFamily: TEXT_FONT, fontSize: pt(22), fontWeight: 400, color: INK_SOFT, lineHeight: 1.3 }}>
            Un token ≈ un fragmento de palabra. Alturas representadas a escala √ (no lineal) para que todos los hitos sean visibles.
            &nbsp;·&nbsp; Fuentes: OpenAI · Anthropic · Google · arXiv 2005.14165.
          </div>
        </div>
      </div>
    </>
  )
}
