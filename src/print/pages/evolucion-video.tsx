import type { CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import { KIT_BLUE, DISPLAY_FONT, TEXT_FONT } from '@/lib/neumorphism'
import type { PrintPageProps } from '../types'

/**
 * evolucion-video — wall 2-E-IMAGE (Nave O · cámara VÍDEO, 7.5 × 2.5 m).
 * ──────────────────────────────────────────────────────────────────────
 * **Will Smith comiendo espaguetis** — el meme-prueba del progreso del vídeo IA.
 * El mismo prompt, año tras año: cada año es una **columna de frames** (una tira
 * vertical del mismo instante del vídeo) y la calidad sube de izquierda a derecha
 * — de la papilla deforme de 2023 a algo físicamente coherente hoy (hockey-stick).
 *
 * Cada año lleva un KPI honesto-ilustrativo (duración · resolución) que también
 * crece. El presente (HOY) va en KIT_BLUE.
 *
 * Placeholder de momento: cada frame es un *swatch* que va de muy distorsionado
 * y ruidoso (años tempranos) a limpio (años recientes), con variación por frame
 * para simular movimiento. Para meter frames reales, deja PNGs bajo `assets/` y
 * rellena `item.frames` (un path por frame de la columna) — el layout no cambia.
 *
 * Autoría en milímetros desde el origen de trim, tipografía en puntos.
 */

const BG = '#ffffff'
const INK = '#1a1a1a'
const INK_SOFT = 'rgba(26,26,26,0.62)'
const HAIRLINE = 'rgba(26,26,26,0.85)'

type Item = {
  /** Year of the sample, e.g. "2023". */
  year: string
  /** Short era label (eyebrow above the column). */
  era: string
  /** KPI line that grows hockey-stick: duración · resolución. */
  kpi: string
  /** Optional real frame PNGs under `public/` (one per frame of the column). */
  frames?: string[]
}

type Props = {
  items?: Item[]
  /** Frames stacked per year-column (default 3). */
  framesPerColumn?: number
}

/** The progress of AI video, same prompt year by year — defaults; doc can override. */
const DEFAULT_ITEMS: Item[] = [
  { year: '2023', era: 'Pesadilla deforme', kpi: '~2 s · 256p · incoherente' },
  { year: '2024', era: 'Toma forma', kpi: '~20 s · 480p' },
  { year: '2025', era: 'Movimiento creíble', kpi: '~60 s · 1080p' },
  { year: '2026', era: 'Indistinguible', kpi: 'minutos · 4K · física correcta' },
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
/** Deterministic pseudo-random in [0,1) from two ints (per-frame variation). */
function rnd(i: number, f: number): number {
  const x = Math.sin(i * 12.9898 + f * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function EvolucionVideo({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as Props
  const items = Array.isArray(p.items) && p.items.length ? p.items : DEFAULT_ITEMS
  const FPC = Math.max(2, Math.min(5, Math.round(p.framesPerColumn ?? 3)))

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const N = items.length

  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  /* ── horizontal grid — year columns + gutters tile the content width ──────── */
  const MX = W * 0.04
  const CONTENT_X0 = MX
  const CONTENT_W = W - 2 * MX
  const GUTTER_FRAC = 0.34
  const slotW = CONTENT_W / (N + (N - 1) * GUTTER_FRAC)
  const PITCH = slotW * (1 + GUTTER_FRAC)
  const slotLeft = (i: number) => CONTENT_X0 + i * PITCH
  const slotCenter = (i: number) => slotLeft(i) + slotW / 2

  /* ── vertical grid — header, the frame strip, year numerals ──────────────── */
  const STRIP_TOP = H * 0.33
  const STRIP_BOTTOM = H * 0.82
  const stripH = STRIP_BOTTOM - STRIP_TOP
  const FRAME_GAP = H * 0.012
  const frameW = slotW
  // frame height from a 16:9 aspect, but never taller than the strip allows
  const frameH = Math.min((frameW * 9) / 16, (stripH - (FPC - 1) * FRAME_GAP) / FPC)
  const colH = frameH * FPC + FRAME_GAP * (FPC - 1)
  const STRIP_Y0 = STRIP_TOP + (stripH - colH) / 2 // vertically centre the strip
  const KPI_Y = STRIP_Y0 - H * 0.028 // era + kpi above the column
  const YEAR_Y = STRIP_Y0 + colH + H * 0.022 // big year numeral below the column

  const W_FRAME = 1.4

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: BG }} />

      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── header (top-left) ────────────────────────────────────────────────── */}
        <div style={{ ...at(MX, H * 0.07), width: mm(CONTENT_W) }}>
          <div style={{ fontFamily: TEXT_FONT, fontSize: pt(30), fontWeight: 600, letterSpacing: pt(1.2), textTransform: 'uppercase', color: INK_SOFT }}>
            S3 · Nave O · Vídeo generado por IA
          </div>
          <div style={{ marginTop: mm(18), fontFamily: DISPLAY_FONT, fontSize: pt(120), fontWeight: 500, letterSpacing: pt(-1.6), lineHeight: 1.0, color: INK }}>
            Will Smith comiendo espaguetis
          </div>
          <div style={{ marginTop: mm(20), fontFamily: TEXT_FONT, fontSize: pt(38), fontWeight: 400, lineHeight: 1.28, color: INK_SOFT, maxWidth: mm(CONTENT_W * 0.6) }}>
            El mismo prompt, año tras año. ¿A esta velocidad, qué habrá el año que viene?
          </div>
        </div>

        {/* ── the year columns (each a vertical strip of frames) ───────────────── */}
        {items.map((item, i) => {
          const isNow = i === N - 1
          const c = N > 1 ? i / (N - 1) : 1 // 0 (deformed) → 1 (clean)
          const accent = isNow ? KIT_BLUE : INK
          const frames = Array.isArray(item.frames) ? item.frames : []
          return (
            <div key={`col-${i}`}>
              {/* era + kpi above the column */}
              <div style={{ ...at(slotLeft(i), KPI_Y), width: mm(slotW), textAlign: 'center', transform: 'translateY(-100%)' }}>
                <div style={{ fontFamily: TEXT_FONT, fontSize: pt(30), fontWeight: 600, letterSpacing: pt(0.6), textTransform: 'uppercase', color: isNow ? KIT_BLUE : INK_SOFT, lineHeight: 1.2 }}>
                  {item.era}
                </div>
                <div style={{ marginTop: mm(5), fontFamily: TEXT_FONT, fontSize: pt(26), fontWeight: 500, color: INK_SOFT }}>
                  {item.kpi}
                </div>
              </div>

              {/* the stacked frames */}
              {Array.from({ length: FPC }).map((_, f) => {
                const top = STRIP_Y0 + f * (frameH + FRAME_GAP)
                return (
                  <div
                    key={`frame-${i}-${f}`}
                    style={{
                      ...at(slotCenter(i) - frameW / 2, top),
                      width: mm(frameW),
                      height: mm(frameH),
                      border: `${mm(W_FRAME)}px solid ${isNow ? KIT_BLUE : HAIRLINE}`,
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      background: BG,
                    }}
                  >
                    <VideoFrame src={frames[f]} c={c} i={i} f={f} mm={mm} pt={pt} frameWmm={frameW} />
                  </div>
                )
              })}

              {/* big year numeral below the column; HOY tag on the present */}
              <div style={{ ...at(slotLeft(i), YEAR_Y), width: mm(slotW), textAlign: 'center' }}>
                <div style={{ fontFamily: DISPLAY_FONT, fontSize: pt(140), fontWeight: 500, letterSpacing: pt(-1.5), lineHeight: 1, color: accent }}>{item.year}</div>
                {isNow && (
                  <div style={{ marginTop: mm(8), fontFamily: TEXT_FONT, fontSize: pt(34), fontWeight: 600, letterSpacing: pt(1), textTransform: 'uppercase', color: KIT_BLUE }}>HOY</div>
                )}
              </div>
            </div>
          )
        })}

        {/* ── footnote ─────────────────────────────────────────────────────────── */}
        <div style={{ ...at(MX, H * 0.955), width: mm(CONTENT_W) }}>
          <div style={{ fontFamily: TEXT_FONT, fontSize: pt(22), fontWeight: 400, color: INK_SOFT, lineHeight: 1.3 }}>
            Frames de muestra del mismo vídeo generado cada año. KPIs ilustrativos (duración · resolución). Las modalidades avanzan todas a la vez — no hay freno.
          </div>
        </div>
      </div>
    </>
  )
}

/* ── one video frame: a real PNG, or the deformed→clean placeholder swatch ──── */
function VideoFrame({ src, c, i, f, mm, pt, frameWmm }: { src?: string; c: number; i: number; f: number; mm: (v: number) => number; pt: (v: number) => number; frameWmm: number }) {
  const path = typeof src === 'string' && src.trim() ? src.trim() : ''
  if (path) {
    const resolved = staticFile(path.replace(/^\/+/, '').replace(/^public\//, ''))
    const style: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }
    return getRemotionEnvironment().isRendering ? <Img src={resolved} style={style} /> : <img src={resolved} alt="" style={style} />
  }

  // Placeholder: a warm spaghetti-ish tone that goes from warped/noisy (early) to
  // clean (late). Per-frame variation (rnd) shifts the warp so a column reads as
  // successive frames of motion, more chaotic the earlier the year.
  const warp = (1 - c) * (0.5 + rnd(i, f)) // earlier years warp harder
  const angle = lerp(120, 158, c) + (rnd(i, f) - 0.5) * 80 * (1 - c)
  const sauce = `hsl(${lerp(18, 24, c)}, ${lerp(38, 70, c)}%, ${lerp(38, 52, c)}%)` // tomato
  const noodle = `hsl(${lerp(40, 46, c)}, ${lerp(30, 64, c)}%, ${lerp(60, 78, c)}%)` // pasta
  const tonal = `linear-gradient(${angle}deg, ${noodle} 0%, ${sauce} ${lerp(40, 64, c)}%, #5a2718 100%)`
  const noiseOpacity = 0.34 * warp
  const hatchMm = lerp(4, 12, c)
  const noise =
    noiseOpacity > 0.01
      ? `repeating-linear-gradient(${angle + 30}deg, rgba(0,0,0,${noiseOpacity}) 0 ${mm(hatchMm)}px, rgba(255,255,255,0) ${mm(hatchMm)}px ${mm(hatchMm * 2)}px), ` +
        `repeating-linear-gradient(${angle - 60}deg, rgba(255,255,255,${noiseOpacity * 0.6}) 0 ${mm(hatchMm * 0.7)}px, rgba(0,0,0,0) ${mm(hatchMm * 0.7)}px ${mm(hatchMm * 1.6)}px), `
      : ''
  return (
    <div style={{ position: 'absolute', inset: 0, background: noise + tonal, filter: warp > 0.4 ? 'contrast(0.9)' : 'none' }}>
      {f === 0 && (
        <div style={{ position: 'absolute', left: mm(frameWmm * 0.04), top: mm(frameWmm * 0.04), fontFamily: TEXT_FONT, fontSize: pt(20), fontWeight: 600, letterSpacing: pt(1.2), textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>
          muestra
        </div>
      )}
    </div>
  )
}
