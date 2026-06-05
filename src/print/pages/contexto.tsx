import type { CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import { KIT_BLUE } from '@/lib/neumorphism'
import { PrintFonts, PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { eventTypeScale } from './tipografia'
import type { PrintPageProps } from '../types'

/**
 * contexto — wall 11-W-TEXT+CODE (Nave E · cámara TEXT+CODE, 7 × 2.5 m).
 * ──────────────────────────────────────────────────────────────────────────
 * **La ventana de contexto over time** — the model's working memory: how much
 * text it can read and hold at once. A raw token count means nothing to anyone,
 * so each milestone is rendered as the **document of that size** — the volume of
 * text that fits — photographed as a black-and-white still life: unas páginas →
 * un artículo → un capítulo → una novela → la Biblia entera → una saga (Juego
 * de Tronos al completo).
 *
 * Composition: a clean white editorial ground (a curated gallery wall), over
 * which a left→right row of **framed B&W document prints** rises from a common
 * baseline — the plate grows with the context (a curling page → a towering
 * saga), so the explosion of the last six years is legible at a glance. Above
 * each plate floats the relatable equivalence (the hook); below the baseline, the
 * honest figure — tokens · model · year. The present (HOY · 2026) is KIT_BLUE.
 *
 * Real, datable context windows at launch: GPT-2 1.024 · GPT-3.5 4.096 ·
 * GPT-4 8.192 · Claude 2.1 200.000 · Gemini 1.5 Pro 1.000.000 · hoy ~2M.
 * Equivalences verified at 0,75 palabras/token (OpenAI): the Bible (KJV ≈
 * 783.137 palabras) ÷ 0,75 ≈ 1,04M tokens → 1M tokens ≈ one Bible; A Song of
 * Ice and Fire (~1,77M palabras) ≈ 2,3M tokens ≈ the ~2M window of today.
 * Plate height ∝ log(tokens) so every hito reads; the token figures and the
 * imagery carry the true magnitude.
 *
 * Type is sized for exhibition, not by eye: every level comes from
 * `eventTypeScale` at the wall's reading distance. Authored in millimetres from
 * the trim origin, type in points — reads at print scale at any size / DPI.
 */

/* ── clean white editorial ground · B&W plates · single blue accent ─────────── */
const BG = '#ffffff'
const INK = '#161616'
const INK_SOFT = 'rgba(22,22,22,0.58)'
const INK_FAINT = 'rgba(22,22,22,0.42)'
const HAIRLINE = 'rgba(22,22,22,0.34)'
const MAT = '#ffffff' // plate ground behind each print

/** How far the wall is read, in metres — drives the whole museographic type scale. */
const READING_DISTANCE_M = 3.5

type Item = {
  /** Model / hito name, e.g. "GPT-3". */
  model: string
  /** Launch year, e.g. "2020". */
  year: string
  /** Context window in tokens (the honest figure). */
  tokens: number
  /** Compact token label, e.g. "2K", "1M". */
  tokenLabel: string
  /** The relatable hook — the document that much text *is* (one line, big). */
  equiv: string
  /** Sub-equivalence (smaller), e.g. "≈ 500 páginas". */
  equivSub: string
  /** B&W still-life of that document, under public/ (Remotion `staticFile`). */
  src: string
  /** Display aspect (w/h) of the plate — matched to the photo so it isn't letterboxed. */
  aspect: number
  /** objectPosition for the cover-crop (the meaningful part of the photo). */
  focus?: string
  /** The present — marked in KIT_BLUE. */
  now?: boolean
}

type Props = {
  items?: Item[]
  /** Protagonist statement (header). */
  title?: string
  /** Lede paragraph (header). */
  lede?: string
}

const A = 'prints/marco-11-w-text-code/assets'

/** The growth of the context window — defaults; the doc can override via props. */
const DEFAULT_ITEMS: Item[] = [
  { model: 'GPT-2', year: '2019', tokens: 1024, tokenLabel: '1K', equiv: 'Unas páginas', equivSub: '≈ un correo largo', src: `${A}/doc-1-page.png`, aspect: 0.78, focus: 'center 42%' },
  { model: 'GPT-3.5', year: '2022', tokens: 4096, tokenLabel: '4K', equiv: 'Un artículo', equivSub: '≈ 3.000 palabras', src: `${A}/doc-2-story.png`, aspect: 1.0, focus: 'center center' },
  { model: 'GPT-4', year: '2023', tokens: 8192, tokenLabel: '8K', equiv: 'Un capítulo', equivSub: '≈ 20 páginas', src: `${A}/doc-3-chapter.png`, aspect: 1.3, focus: 'center center' },
  { model: 'Claude 2.1', year: '2023', tokens: 200000, tokenLabel: '200K', equiv: 'Una novela', equivSub: '≈ 500 páginas', src: `${A}/doc-4-novel.png`, aspect: 0.76, focus: 'center center' },
  { model: 'Gemini 1.5 Pro', year: '2024', tokens: 1000000, tokenLabel: '1M', equiv: 'La Biblia entera', equivSub: '≈ 783.000 palabras', src: `${A}/doc-5-bible.png`, aspect: 0.66, focus: 'center center' },
  { model: 'Hoy', year: '2026', tokens: 2000000, tokenLabel: '2M', equiv: 'Juego de Tronos', equivSub: '≈ la saga completa · 1,7 M palabras', src: `${A}/doc-6-saga.png`, aspect: 0.7, focus: 'center center', now: true },
]

const DEFAULT_HEADER = {
  title: 'De unas páginas a una saga entera.',
  lede: 'La ventana de contexto es la memoria de trabajo de un modelo: cuánto texto puede leer y tener presente a la vez. En seis años pasó de un correo a una saga entera.',
}

export function Contexto({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as Props
  const items = Array.isArray(p.items) && p.items.length ? p.items : DEFAULT_ITEMS
  const title = p.title ?? DEFAULT_HEADER.title
  const lede = p.lede ?? DEFAULT_HEADER.lede

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const N = items.length

  /** Museographic type scale — every level sized to the wall's reading distance. */
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM: READING_DISTANCE_M, ratio: 1.7, h1CapFraction: 0.092 })

  /** Absolute placement in mm from the trim origin. */
  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  /* ── horizontal grid (mm): evenly-pitched milestone centres = the time axis ──── */
  const MX = W * 0.035
  const CONTENT_X0 = MX
  const CONTENT_W = W - 2 * MX
  const PITCH = CONTENT_W / N
  const center = (i: number) => CONTENT_X0 + PITCH * (i + 0.5)

  /* ── vertical grid (mm): plates rise from a common baseline ──────────────────── */
  const GROUND_Y = H * 0.83 // baseline the document plates stand on
  const PLATE_MAX_H = H * 0.52 // tallest plate (the present — a towering saga)
  const PLATE_MIN_H = H * 0.115 // shortest visible plate (a page) — tall enough to read
  const EQUIV_GAP = H * 0.028 // air between a plate's top and its floating equiv
  const CAP_Y = GROUND_Y + H * 0.03 // tokens · model · year caption under the line

  /* honest height map: plate height ∝ log(tokens), so every hito reads */
  const lg = (v: number) => Math.log10(Math.max(v, 1))
  const minT = Math.min(...items.map((d) => d.tokens))
  const maxT = Math.max(...items.map((d) => d.tokens))
  const span = lg(maxT) - lg(minT) || 1
  const plateH = (tokens: number) => PLATE_MIN_H + ((lg(tokens) - lg(minT)) / span) * (PLATE_MAX_H - PLATE_MIN_H)
  /** Plate width follows the photo's aspect — so each document looks like itself,
   *  never letterboxed — bounded so a wide one can't crowd its neighbours. */
  const plateW = (h: number, aspect: number) => Math.max(PITCH * 0.22, Math.min(PITCH * 0.92, h * aspect))

  /* type styles — sizes from the scale (exhibition law), not by eye */
  const sTitle: CSSProperties = { fontFamily: PRINT_DISPLAY_HAIR, fontSize: pt(scale.h1Pt), fontWeight: 400, letterSpacing: pt(-scale.h1Pt * 0.02), lineHeight: 0.98, color: INK, margin: 0 }
  const sLede: CSSProperties = { fontFamily: PRINT_TEXT_FONT, fontSize: pt(scale.bodyPt), fontWeight: 400, lineHeight: 1.4, color: INK_SOFT, margin: 0, hyphens: 'none' }
  const sEquiv: CSSProperties = { fontFamily: PRINT_DISPLAY_HAIR, fontSize: pt(scale.h3Pt), fontWeight: 400, letterSpacing: pt(-scale.h3Pt * 0.012), lineHeight: 0.98 }
  const sEquivSub: CSSProperties = { fontFamily: PRINT_TEXT_FONT, fontSize: pt(scale.bodyPt * 0.86), fontWeight: 500, color: INK_FAINT, lineHeight: 1.1 }
  const sToken: CSSProperties = { fontFamily: PRINT_DISPLAY_HAIR, fontSize: pt(scale.h4Pt), fontWeight: 400, letterSpacing: pt(-scale.h4Pt * 0.01), lineHeight: 1 }
  const sModel: CSSProperties = { fontFamily: PRINT_TEXT_FONT, fontSize: pt(scale.bodyPt * 0.92), fontWeight: 500, lineHeight: 1.16 }

  return (
    <>
      <PrintFonts />
      {/* clean white editorial ground, bled to the media edge */}
      <div style={{ position: 'absolute', inset: 0, background: BG }} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── header (top-left): statement · lede ────────────────────────────────── */}
        <div style={{ ...at(MX, H * 0.07), width: mm(CONTENT_W * 0.5) }}>
          <div style={sTitle}>{title}</div>
          <div style={{ ...sLede, marginTop: mm(H * 0.022), maxWidth: mm(CONTENT_W * 0.31) }}>{lede}</div>
        </div>

        {/* ── the rising row of document plates ──────────────────────────────────── */}
        {items.map((item, i) => {
          const h = plateH(item.tokens)
          const w = plateW(h, item.aspect)
          const top = GROUND_Y - h
          const left = center(i) - w / 2
          const accent = item.now ? KIT_BLUE : INK
          return (
            <div key={`plate-${i}`}>
              {/* equiv — the relatable hook, floating above the plate top */}
              <div style={{ ...at(center(i) - PITCH / 2, top - EQUIV_GAP), width: mm(PITCH), textAlign: 'center', transform: 'translateY(-100%)' }}>
                <div style={{ ...sEquiv, color: accent }}>{item.equiv}</div>
                <div style={{ ...sEquivSub, marginTop: mm(H * 0.006) }}>{item.equivSub}</div>
              </div>

              {/* the framed B&W print: full-bleed photo + a hairline keyline on the white wall */}
              <div
                style={{
                  ...at(left, top),
                  width: mm(w),
                  height: mm(h),
                  background: MAT,
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  border: `${Math.max(1, mm(item.now ? 2 : 1))}px solid ${item.now ? KIT_BLUE : HAIRLINE}`,
                }}
              >
                <Plate item={item} />
              </div>

              {/* caption under the baseline: tokens · model · year */}
              <div style={{ ...at(center(i) - PITCH / 2, CAP_Y), width: mm(PITCH), textAlign: 'center' }}>
                <div style={{ ...sToken, color: accent }}>
                  {item.tokenLabel}
                  <span style={{ fontFamily: PRINT_TEXT_FONT, fontSize: pt(scale.bodyPt * 0.7), fontWeight: 600, letterSpacing: pt(0.4), color: INK_FAINT }}> tokens</span>
                </div>
                <div style={{ ...sModel, marginTop: mm(H * 0.008), color: INK }}>
                  {item.model}
                  <span style={{ color: item.now ? KIT_BLUE : INK_SOFT }}> · {item.year}</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* ── common baseline (the time axis) with a tick under each milestone ────── */}
        <div style={{ ...at(center(0) - PITCH * 0.42, GROUND_Y - mm(1)), width: mm(center(N - 1) - center(0) + PITCH * 0.84), height: Math.max(1, mm(2.4)), background: HAIRLINE }} />
        {items.map((item, i) => (
          <div key={`tick-${i}`} style={{ ...at(center(i) - mm(1), GROUND_Y - mm(1)), width: Math.max(1, mm(2.4)), height: mm(H * 0.012), background: item.now ? KIT_BLUE : HAIRLINE }} />
        ))}
      </div>
    </>
  )
}

/* ── one document plate: the real B&W still life, cover-cropped ──────────────── */
function Plate({ item }: { item: Item }) {
  const src = typeof item.src === 'string' && item.src.trim() ? item.src.trim() : ''
  const style: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: item.focus ?? 'center center', display: 'block', filter: 'grayscale(1) contrast(1.07)' }
  if (!src) {
    // Placeholder until the real PNG lands — a soft tonal field naming the document.
    return (
      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(152deg, #e9e9ea 0%, #cfcfd2 100%)', display: 'flex', alignItems: 'flex-end' }} />
    )
  }
  const path = staticFile(src.replace(/^\/+/, '').replace(/^public\//, ''))
  return getRemotionEnvironment().isRendering ? <Img src={path} alt={item.equiv} style={style} /> : <img src={path} alt={item.equiv} style={style} />
}
