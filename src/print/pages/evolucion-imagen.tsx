import type { CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import { KIT_BLUE, DISPLAY_FONT, TEXT_FONT } from '@/lib/neumorphism'
import type { PrintPageProps } from '../types'

/**
 * evolucion-imagen — wall 11-W-IMAGE (Nave E · cámara IMAGE, 10 × 2.5 m).
 * ──────────────────────────────────────────────────────────────────────
 * A very wide **timeline of AI image generation**: a row of dated frames reading
 * left→right = past→present, from the first blurry GAN faces to today's
 * indistinguishable images. Each milestone is a year + a representative image;
 * the present (2026 · HOY) is marked in KIT_BLUE.
 *
 * The **timeline mechanism is inherited from `agi-timeline` ("El Año Cero")** —
 * a single blue accent on «now», a horizon axis with year ruler ticks and big
 * Display year numerals. Inverted to the museum reading: pictures on top, the
 * dated axis underneath. No headline, **no cream ground** — a clean white field
 * so the row of images is the whole wall (the timeline only, per the brief).
 *
 * Placeholder images for now (`item.src` empty → an abstract monochrome swatch
 * that runs **from noise to a clean image** as you move forward in time). Drop a
 * real print-res PNG per year under `assets/` and set `item.src` to swap a frame
 * in — the layout is unchanged.
 *
 * Authored in millimetres from the trim origin (a trim layer offset by the
 * bleed), type in points, so it reads at print scale at any size / DPI.
 */

const BG = '#ffffff'
const INK = '#1a1a1a'
const INK_SOFT = 'rgba(26,26,26,0.62)'
const HAIRLINE = 'rgba(26,26,26,0.85)'

type Item = {
  /** The milestone year, e.g. "2022". */
  year: string
  /** Short era label (uppercase eyebrow above the model). */
  era: string
  /** The model / tool(s) that defined the year. */
  model: string
  /** Optional real image path under `public/` (Remotion `staticFile`). */
  src?: string
}

type Props = {
  items?: Item[]
}

/** The decade of AI image generation — defaults; the doc can override via props. */
const DEFAULT_ITEMS: Item[] = [
  { year: '2014', era: 'Nacen las GAN', model: 'Goodfellow et al.' },
  { year: '2016', era: 'GAN convolucional', model: 'DCGAN' },
  { year: '2018', era: 'Caras fotorrealistas', model: 'BigGAN · StyleGAN' },
  { year: '2021', era: 'Texto → imagen', model: 'DALL·E · CLIP' },
  { year: '2022', era: 'La era de la difusión', model: 'DALL·E 2 · Midjourney · SD' },
  { year: '2023', era: 'Nitidez y coherencia', model: 'Midjourney v5 · SDXL' },
  { year: '2024', era: 'Texto en la imagen', model: 'DALL·E 3 · Flux' },
  { year: '2025', era: 'Control y consistencia', model: 'GPT Image · Nano Banana' },
  { year: '2026', era: 'Indistinguible de lo real', model: 'Generación en tiempo real' },
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function gray(v: number): string {
  const n = Math.round(v)
  return `rgb(${n}, ${n}, ${n})`
}

export function EvolucionImagen({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as Props
  const items = Array.isArray(p.items) && p.items.length ? p.items : DEFAULT_ITEMS

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm

  /** Absolute placement in mm from the trim origin. */
  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  /* ── horizontal grid (mm) — frames + gutters tile the content width ──────── */
  const MX = W * 0.03 // 300 on a 10 m wall
  const CONTENT_X0 = MX
  const CONTENT_W = W - 2 * MX
  const N = items.length
  const GUTTER_FRAC = 0.19 // gutter as a fraction of a frame's width
  const slotW = CONTENT_W / (N + (N - 1) * GUTTER_FRAC)
  const gutter = slotW * GUTTER_FRAC
  const PITCH = slotW + gutter
  const slotLeft = (i: number) => CONTENT_X0 + i * PITCH
  const slotCenter = (i: number) => slotLeft(i) + slotW / 2
  const TL_END = slotLeft(N - 1) + slotW

  /* ── vertical grid (mm) — no header, so the row is centred on the wall ───── */
  const IMG_TOP = H * 0.1 // ~250
  const IMG_BASELINE = H * 0.648 // ~1620  (bottom of the frames)
  const slotH = IMG_BASELINE - IMG_TOP
  const CAP_Y = IMG_BASELINE + H * 0.012 // caption under the frame
  const AXIS_Y = H * 0.76 // ~1900  (horizon line)
  const YEAR_Y = H * 0.78 // ~1950  (big year numerals, below the axis)

  /* ── line weights (mm) — bumped for a 10 m wall seen at distance ─────────── */
  const W_FRAME = 1.6
  const H_EJE = 4
  const W_YTICK = 2
  const H_YTICK = 26
  const W_DROP = 1
  const DROP_INK = 'rgba(26,26,26,0.16)'
  const DISC_D = 16
  const FADE_IN = slotLeft(0) - MX * 0.4 // axis fades in to the left (pre-history)

  return (
    <>
      {/* clean white field, bled to the media edge */}
      <div style={{ position: 'absolute', inset: 0, background: BG }} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── faint drop lines (image column → axis) behind everything ───────── */}
        {items.map((_, i) => (
          <div
            key={`drop-${i}`}
            style={{ ...at(slotCenter(i) - W_DROP / 2, IMG_BASELINE), width: mm(W_DROP), height: mm(AXIS_Y - IMG_BASELINE), background: DROP_INK }}
          />
        ))}

        {/* ── the row of dated frames ─────────────────────────────────────────── */}
        {items.map((item, i) => {
          const isNow = i === N - 1
          const c = N > 1 ? i / (N - 1) : 1 // clarity 0 (noise) → 1 (clean image)
          return (
            <div key={`frame-${i}`}>
              {/* the frame (real image, or the noise→clarity placeholder swatch) */}
              <div
                style={{
                  ...at(slotLeft(i), IMG_TOP),
                  width: mm(slotW),
                  height: mm(slotH),
                  border: `${mm(W_FRAME)}px solid ${HAIRLINE}`,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  background: BG,
                }}
              >
                <Frame item={item} c={c} mm={mm} pt={pt} slotWmm={slotW} />
              </div>

              {/* caption: era (eyebrow) + model, centred under the frame */}
              <div style={{ ...at(slotLeft(i), CAP_Y), width: mm(slotW), textAlign: 'center' }}>
                <div style={{ fontFamily: TEXT_FONT, fontSize: pt(28), fontWeight: 600, letterSpacing: pt(0.6), textTransform: 'uppercase', color: isNow ? KIT_BLUE : INK_SOFT, lineHeight: 1.2 }}>
                  {item.era}
                </div>
                <div style={{ marginTop: mm(8), fontFamily: TEXT_FONT, fontSize: pt(40), fontWeight: 500, color: INK, lineHeight: 1.12 }}>
                  {item.model}
                </div>
              </div>
            </div>
          )
        })}

        {/* ── horizon axis: fade-in (pre-history) · ink · blue under «now» ───── */}
        <div style={{ ...at(FADE_IN, AXIS_Y - H_EJE / 2), width: mm(slotLeft(0) - FADE_IN), height: mm(H_EJE), background: `linear-gradient(to right, rgba(26,26,26,0), ${INK})` }} />
        <div style={{ ...at(slotLeft(0), AXIS_Y - H_EJE / 2), width: mm(slotLeft(N - 1) - slotLeft(0)), height: mm(H_EJE), background: INK }} />
        <div style={{ ...at(slotLeft(N - 1), AXIS_Y - H_EJE / 2), width: mm(TL_END - slotLeft(N - 1)), height: mm(H_EJE), background: KIT_BLUE }} />

        {/* year ruler ticks dropping from the axis to the numerals */}
        {items.map((_, i) => {
          const isNow = i === N - 1
          return (
            <div key={`ytick-${i}`} style={{ ...at(slotCenter(i) - W_YTICK / 2, AXIS_Y), width: mm(W_YTICK), height: mm(H_YTICK), background: isNow ? KIT_BLUE : INK }} />
          )
        })}

        {/* «now» origin disc on the axis */}
        <div style={{ ...at(slotCenter(N - 1) - DISC_D / 2, AXIS_Y - DISC_D / 2), width: mm(DISC_D), height: mm(DISC_D), borderRadius: '50%', background: KIT_BLUE }} />

        {/* big year numerals below the axis; HOY tag under «now» */}
        {items.map((item, i) => {
          const isNow = i === N - 1
          return (
            <div key={`year-${i}`} style={{ ...at(slotLeft(i), YEAR_Y), width: mm(slotW), textAlign: 'center' }}>
              <div style={{ fontFamily: DISPLAY_FONT, fontSize: pt(150), fontWeight: 500, letterSpacing: pt(-1.5), lineHeight: 1, color: isNow ? KIT_BLUE : INK }}>{item.year}</div>
              {isNow && (
                <div style={{ marginTop: mm(10), fontFamily: TEXT_FONT, fontSize: pt(34), fontWeight: 600, letterSpacing: pt(1), textTransform: 'uppercase', color: KIT_BLUE }}>HOY</div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ── one frame's interior: a real image, or the noise→clarity placeholder ──── */
function Frame({ item, c, mm, pt, slotWmm }: { item: Item; c: number; mm: (v: number) => number; pt: (v: number) => number; slotWmm: number }) {
  const src = typeof item.src === 'string' && item.src.trim() ? item.src.trim() : ''
  if (src) {
    const path = staticFile(src.replace(/^\/+/, '').replace(/^public\//, ''))
    const style: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }
    // Remotion's <Img> waits for the bitmap to decode (deterministic still); the
    // bare <img> is correct for the live preview where there is no render context.
    return getRemotionEnvironment().isRendering ? <Img src={path} alt={`${item.year} · ${item.model}`} style={style} /> : <img src={path} alt={`${item.year} · ${item.model}`} style={style} />
  }

  // Placeholder: an abstract monochrome swatch that runs from noisy/muddy (early)
  // to a crisp tonal image (late) — a meaningful stand-in until the real PNG lands.
  const lightTone = gray(lerp(196, 234, c))
  const darkTone = gray(lerp(150, 40, c))
  const noiseOpacity = 0.16 * (1 - c)
  const hatchMm = lerp(5, 13, c) // finer hatch early reads as noise
  const tonal = `linear-gradient(158deg, ${lightTone} 0%, ${darkTone} 100%)`
  const noise =
    noiseOpacity > 0.005
      ? `repeating-linear-gradient(45deg, rgba(0,0,0,${noiseOpacity}) 0 ${mm(hatchMm)}px, rgba(255,255,255,0) ${mm(hatchMm)}px ${mm(hatchMm * 2)}px), ` +
        `repeating-linear-gradient(-45deg, rgba(0,0,0,${noiseOpacity * 0.7}) 0 ${mm(hatchMm)}px, rgba(255,255,255,0) ${mm(hatchMm)}px ${mm(hatchMm * 2)}px), `
      : ''
  return (
    <div style={{ position: 'absolute', inset: 0, background: noise + tonal }}>
      <div style={{ position: 'absolute', left: mm(slotWmm * 0.05), bottom: mm(slotWmm * 0.05), fontFamily: TEXT_FONT, fontSize: pt(22), fontWeight: 600, letterSpacing: pt(1.4), textTransform: 'uppercase', color: c > 0.5 ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.4)' }}>
        muestra
      </div>
    </div>
  )
}
