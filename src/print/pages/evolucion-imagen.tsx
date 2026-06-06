import type { CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import { KIT_BLUE } from '@/lib/neumorphism'
import { PrintFonts, PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { eventTypeScale } from './tipografia'
import type { PrintPageProps } from '../types'

/**
 * evolucion-imagen — wall 11-W-IMAGE (Nave E · cámara IMAGE, 9.25 × 2.5 m).
 * ──────────────────────────────────────────────────────────────────────────
 * An **editorial museum-grid** timeline of AI image generation, 2023 → today.
 * The reference is a gallery "magazine wall": a uniform grid of tiled panels with
 * fine joints, over which a deliberately asymmetric composition is laid — huge
 * display years straddling panels, clusters of images bleeding to the panel seams,
 * short text plates, with the years/images staggered band to band so it reads as
 * one designed wall, past→present, left→right.
 *
 * Substrate: a uniform COLS×ROWS tile grid; a thin **seam overlay** is drawn on top
 * of everything (joints cross images and type alike, as on a physically panelled
 * wall). Composition: four era-bands (one per year, 3 columns each). Within a band,
 * the giant year and the image cluster sit in **different rows** so nothing overlaps.
 *
 * **Type is sized for exhibition**, not by eye: every level comes from
 * `eventTypeScale` at the wall's reading distance — the giant years are the H1
 * protagonist, era headlines step down the modular chord, and the model/intro copy
 * is set to the museographic *comfort* size (≈1 in cap / 10 ft), so it reads at
 * distance. Voice: clean white ground, hairline Universal Sans Display, and a
 * **single KIT_BLUE accent** reserved for «2026 · HOY» (the present).
 *
 * Images are **iconic samples per era** (several per year, varied). Until the real
 * print-res PNGs land under `assets/`, each slot renders a labelled tonal
 * placeholder naming the era's model — drop a `src` on the era image to swap it in.
 */

const BG = '#ffffff'
const INK = '#1a1a1a'
const INK_SOFT = 'rgba(26,26,26,0.56)'
const SEAM = 'rgba(26,26,26,0.11)'

/** How far the wall is read, in metres — drives the whole museographic type scale. */
const READING_DISTANCE_M = 3.5

/* ── content model ────────────────────────────────────────────────────────── */
type EraImage = {
  /** What the sample depicts — used as the placeholder label + future gen prompt. */
  subject: string
  /** Optional real print-res image under `public/` (Remotion `staticFile`). */
  src?: string
}
type Era = {
  year: string
  /** Small tracked kicker above the headline. */
  eyebrow: string
  /** The era's headline. */
  title: string
  /** The model(s) that defined the year. */
  model: string
  /** Iconic samples (several per era; first is the hero). */
  images: EraImage[]
  /** The present — marked in KIT_BLUE. */
  now?: boolean
}
type Props = {
  eras?: Era[]
  /** Intro plate (top-left). No headline, no locator — one line of context. */
  lede?: string
}

/**
 * The four eras — each generated with the **real model of its year** (so the wall
 * is an honest exhibit, not a stylisation): SD 1.5 (2022) → SDXL (2023) → Recraft
 * v3 (2024) → GPT Image 2 (2026). Years are skipped on purpose to read as
 * acceleration. `src` paths resolve under `public/` via `staticFile`.
 */
const A = 'prints/marco-11-w-image/assets'
const DEFAULT_ERAS: Era[] = [
  {
    year: '2022',
    eyebrow: 'Difusión temprana',
    title: 'Aprende a soñar',
    model: 'Stable Diffusion 1.5 · DALL·E 2',
    // The hero slot is a 2×2 grid (imgs 0-3): many dreamy early-diffusion attempts,
    // quartered by the wall seams. img 4 is the separate small plate below-left.
    images: [
      { subject: 'las gradas abarrotadas de un estadio, intentadas con SD 1.5: el público se funde en figuras deformes (SD 1.5)', src: `${A}/2022-g1.png` },
      { subject: 'una mano sujetando un reloj, intentada con SD 1.5: dedos deformes y esfera ilegible (SD 1.5)', src: `${A}/2022-g2.png` },
      { subject: 'una bicicleta, intentada con SD 1.5: rueda y radios derretidos, geometría imposible (SD 1.5)', src: `${A}/2022-g3.png` },
      { subject: 'una cena de amigos a la luz de las velas, intentada con SD 1.5: caras y manos fundidas, mesa derretida (SD 1.5)', src: `${A}/2022-g4.png` },
      { subject: 'el salto del tenista de 2026, intentado con SD 1.5: anatomía rota, raqueta derretida y pelota duplicada (SD 1.5)', src: `${A}/2022-b.png` },
    ],
  },
  {
    year: '2023',
    eyebrow: 'Difusión madura',
    title: 'Gana nitidez y comprensión del mundo',
    model: 'SDXL · Midjourney v5',
    images: [
      { subject: 'el mismo salto del tenista, intentado con SDXL: más nítido que 2022 pero incoherente, con una raqueta fantasma flotando (SDXL)', src: `${A}/2023-hero.png` },
      { subject: 'paisaje cinematográfico (SDXL)', src: `${A}/2023-b.png` },
      { subject: 'la misma cena coral, intentada con SDXL: más nítida pero aún incoherente, con manos deformes (SDXL)', src: `${A}/2023-c.png` },
    ],
  },
  {
    year: '2024',
    eyebrow: 'Texto y diseño',
    title: 'Aprende a escribir',
    model: 'Recraft v3 · nanobanana 2',
    images: [
      { subject: 'el mismo salto del tenista, intentado con Recraft v3: coherente y nítido pero plano, aún no fotográfico (Recraft v3)', src: `${A}/2024-hero.png` },
      { subject: 'packaging con marca legible (nanobanana 2)', src: `${A}/2024-b.png` },
      { subject: 'infografía con rótulos correctos (Recraft v3)', src: `${A}/2024-c.png` },
    ],
  },
  {
    year: '2026',
    eyebrow: 'Indistinguible de lo real',
    title: 'Funde con lo real',
    model: 'GPT Image 2',
    now: true,
    images: [
      { subject: 'el salto del tenista en hierba de Wimbledon, fotorrealista e indistinguible de una cámara (GPT Image 2)', src: `${A}/2026-hero.png` },
      { subject: 'escena callejera compleja (GPT Image 2)', src: `${A}/2026-b.png` },
      { subject: 'retrato editorial hiperrealista, primer plano con textura de piel real (GPT Image 2)', src: `${A}/2026-c.png` },
    ],
  },
]

const DEFAULT_INTRO = {
  lede: 'En apenas cuatro años, la imagen IA pasó de manchas oníricas a fotografías que el ojo ya no distingue de una cámara real. Cada bloque está generado con el modelo de referencia de su año.',
}

/* ── tile grid ────────────────────────────────────────────────────────────── */
const COLS = 12
const ROWS = 3

/**
 * The editorial composition, authored on the tile grid. Each block is placed by
 * tile coords {c,r} with a span {cw,rh}. Hand-arranged so the giant years stagger
 * and the image cluster of each band never shares a row with its year (no overlap).
 * Era bands are 3 columns wide (cols 0-2, 3-5, 6-8, 9-11).
 */
type Block =
  | { kind: 'intro'; c: number; r: number; cw: number; rh: number }
  | { kind: 'year'; c: number; r: number; cw: number; rh: number; era: number }
  | { kind: 'plate'; c: number; r: number; cw: number; rh: number; era: number }
  | { kind: 'image'; c: number; r: number; cw: number; rh: number; era: number; img: number }
  | { kind: 'grid'; c: number; r: number; cw: number; rh: number; era: number; imgs: number[] }

const LAYOUT: Block[] = [
  // ── 2022 · cols 0-2 — year TOP, hero is a 2×2 grid of 4 early-diffusion tries ──
  { kind: 'intro', c: 0, r: 0, cw: 1, rh: 1 },
  { kind: 'year', c: 1, r: 0, cw: 2, rh: 1, era: 0 },
  { kind: 'plate', c: 0, r: 1, cw: 1, rh: 1, era: 0 },
  { kind: 'image', c: 0, r: 2, cw: 1, rh: 1, era: 0, img: 4 },
  { kind: 'grid', c: 1, r: 1, cw: 2, rh: 2, era: 0, imgs: [0, 1, 2, 3] },

  // ── 2024 · cols 3-5 — year BOTTOM, hero top-left ──
  { kind: 'image', c: 3, r: 0, cw: 2, rh: 2, era: 1, img: 0 },
  { kind: 'plate', c: 5, r: 0, cw: 1, rh: 1, era: 1 },
  { kind: 'image', c: 5, r: 1, cw: 1, rh: 1, era: 1, img: 1 },
  { kind: 'year', c: 3, r: 2, cw: 2, rh: 1, era: 1 },
  { kind: 'image', c: 5, r: 2, cw: 1, rh: 1, era: 1, img: 2 },

  // ── 2025 · cols 6-8 — year TOP, hero bottom-left ──
  { kind: 'year', c: 6, r: 0, cw: 2, rh: 1, era: 2 },
  { kind: 'plate', c: 8, r: 0, cw: 1, rh: 1, era: 2 },
  { kind: 'image', c: 6, r: 1, cw: 2, rh: 2, era: 2, img: 0 },
  { kind: 'image', c: 8, r: 1, cw: 1, rh: 1, era: 2, img: 1 },
  { kind: 'image', c: 8, r: 2, cw: 1, rh: 1, era: 2, img: 2 },

  // ── 2026 · cols 9-11 — the NOW era (blue): year TOP-right, hero mid-right ──
  { kind: 'plate', c: 9, r: 0, cw: 1, rh: 1, era: 3 },
  { kind: 'year', c: 10, r: 0, cw: 2, rh: 1, era: 3 },
  { kind: 'image', c: 9, r: 1, cw: 1, rh: 1, era: 3, img: 1 },
  { kind: 'image', c: 9, r: 2, cw: 1, rh: 1, era: 3, img: 2 },
  { kind: 'image', c: 10, r: 1, cw: 2, rh: 2, era: 3, img: 0 },
]

export function EvolucionImagen({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as Props
  const eras = Array.isArray(p.eras) && p.eras.length ? p.eras : DEFAULT_ERAS
  const intro = {
    lede: p.lede ?? DEFAULT_INTRO.lede,
  }

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const tileW = W / COLS
  const tileH = H / ROWS

  /** Museographic type scale — every level sized to the wall's reading distance. */
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM: READING_DISTANCE_M, ratio: 1.7, h1CapFraction: 0.132 })

  /** Tile rect → absolute mm box. */
  const box = (c: number, r: number, cw: number, rh: number): CSSProperties => ({
    position: 'absolute',
    left: mm(c * tileW),
    top: mm(r * tileH),
    width: mm(cw * tileW),
    height: mm(rh * tileH),
  })

  /* type styles — sizes from the scale (exhibition law), not by eye */
  const sYear: CSSProperties = { fontFamily: PRINT_DISPLAY_HAIR, fontWeight: 400, lineHeight: 0.8, letterSpacing: pt(-10), whiteSpace: 'nowrap' }
  const sEyebrow: CSSProperties = { fontFamily: PRINT_TEXT_FONT, fontSize: pt(scale.eyebrowPt), fontWeight: 600, letterSpacing: pt(scale.eyebrowPt * 0.045), textTransform: 'uppercase', color: INK_SOFT, lineHeight: 1.18 }
  const sTitle: CSSProperties = { fontFamily: PRINT_DISPLAY_HAIR, fontSize: pt(scale.h4Pt), fontWeight: 400, letterSpacing: pt(-1), lineHeight: 1.02, color: INK }
  const sModel: CSSProperties = { fontFamily: PRINT_TEXT_FONT, fontSize: pt(scale.bodyPt), fontWeight: 600, lineHeight: 1.16, color: INK }
  const sLede: CSSProperties = { fontFamily: PRINT_TEXT_FONT, fontSize: pt(scale.bodyPt), fontWeight: 400, lineHeight: 1.3, color: INK, margin: 0, hyphens: 'none' }
  const PAD = mm(46)

  return (
    <>
      <PrintFonts />
      {/* clean white field, bled to the media edge */}
      <div style={{ position: 'absolute', inset: 0, background: BG }} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── editorial composition ─────────────────────────────────────────── */}
        {LAYOUT.map((b, i) => {
          if (b.kind === 'intro') {
            return (
              <div key={i} style={{ ...box(b.c, b.r, b.cw, b.rh), padding: PAD, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <p style={{ ...sLede, margin: 0 }}>{intro.lede}</p>
              </div>
            )
          }

          if (b.kind === 'year') {
            const e = eras[b.era]
            if (!e) return null
            return (
              <div key={i} style={{ ...box(b.c, b.r, b.cw, b.rh), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ ...sYear, fontSize: pt(scale.h1Pt), color: e.now ? KIT_BLUE : INK }}>{e.year}</span>
                {e.now && (
                  <span style={{ position: 'absolute', right: PAD, bottom: PAD, fontFamily: PRINT_TEXT_FONT, fontSize: pt(scale.eyebrowPt), fontWeight: 600, letterSpacing: pt(scale.eyebrowPt * 0.05), textTransform: 'uppercase', color: KIT_BLUE }}>
                    Hoy
                  </span>
                )}
              </div>
            )
          }

          if (b.kind === 'plate') {
            const e = eras[b.era]
            if (!e) return null
            return (
              <div key={i} style={{ ...box(b.c, b.r, b.cw, b.rh), padding: PAD, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                <div style={sEyebrow}>{e.eyebrow}</div>
                <div style={{ ...sTitle, marginTop: mm(18) }}>{e.title}</div>
                <div style={{ ...sModel, marginTop: 'auto' }}>{e.model}</div>
              </div>
            )
          }

          if (b.kind === 'grid') {
            const e = eras[b.era]
            if (!e) return null
            const cells = b.imgs.map((idx) => e.images[idx]).filter(Boolean) as EraImage[]
            return (
              <div key={i} style={{ ...box(b.c, b.r, b.cw, b.rh), display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', background: BG }}>
                {cells.map((im, k) => (
                  <div key={k} style={{ position: 'relative', overflow: 'hidden', background: BG }}>
                    <Sample im={im} model={e.model} now={e.now} mm={mm} pt={pt} eyebrowPt={scale.eyebrowPt} />
                  </div>
                ))}
              </div>
            )
          }

          // image
          const e = eras[b.era]
          const im = e?.images[b.img]
          if (!e || !im) return null
          return (
            <div key={i} style={{ ...box(b.c, b.r, b.cw, b.rh), overflow: 'hidden', background: BG }}>
              <Sample im={im} model={e.model} now={e.now} mm={mm} pt={pt} eyebrowPt={scale.eyebrowPt} />
            </div>
          )
        })}

        {/* ── seam overlay: fine panel joints across the whole wall (on top) ──── */}
        <SeamGrid geo={geo} tileW={tileW} tileH={tileH} W={W} H={H} />
      </div>
    </>
  )
}

/* ── one sample: a real image, or a labelled tonal placeholder ─────────────── */
function Sample({ im, model, now, mm, pt, eyebrowPt }: { im: EraImage; model: string; now?: boolean; mm: (v: number) => number; pt: (v: number) => number; eyebrowPt: number }) {
  const src = typeof im.src === 'string' && im.src.trim() ? im.src.trim() : ''
  if (src) {
    const path = staticFile(src.replace(/^\/+/, '').replace(/^public\//, ''))
    const style: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }
    return getRemotionEnvironment().isRendering ? <Img src={path} alt={im.subject} style={style} /> : <img src={path} alt={im.subject} style={style} />
  }
  // Placeholder — a soft tonal field naming the era's model, so the mockup reads as
  // "the <model> sample goes here" until the real PNG lands.
  const tonal = now ? 'linear-gradient(152deg, #e9eef6 0%, #c9d3e2 100%)' : 'linear-gradient(152deg, #eceae6 0%, #cfcbc2 100%)'
  return (
    <div style={{ position: 'absolute', inset: 0, background: tonal, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: mm(30), boxSizing: 'border-box' }}>
      <div style={{ fontFamily: PRINT_TEXT_FONT, fontSize: pt(eyebrowPt * 0.62), fontWeight: 600, letterSpacing: pt(1.6), textTransform: 'uppercase', color: now ? KIT_BLUE : 'rgba(26,26,26,0.5)' }}>muestra</div>
      <div style={{ marginTop: mm(6), fontFamily: PRINT_TEXT_FONT, fontSize: pt(eyebrowPt * 0.82), fontWeight: 500, lineHeight: 1.14, color: 'rgba(26,26,26,0.78)' }}>{model}</div>
    </div>
  )
}

/* ── seam overlay — uniform panel joints drawn on top of all content ────────── */
function SeamGrid({ geo, tileW, tileH, W, H }: { geo: PrintPageProps['geo']; tileW: number; tileH: number; W: number; H: number }) {
  const { mm } = geo
  const SW = 2 // seam thickness (mm)
  const lines: CSSProperties[] = []
  for (let c = 1; c < COLS; c++) lines.push({ position: 'absolute', left: mm(c * tileW - SW / 2), top: 0, width: mm(SW), height: mm(H), background: SEAM })
  for (let r = 1; r < ROWS; r++) lines.push({ position: 'absolute', left: 0, top: mm(r * tileH - SW / 2), width: mm(W), height: mm(SW), background: SEAM })
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {lines.map((s, i) => (
        <div key={i} style={s} />
      ))}
    </div>
  )
}
