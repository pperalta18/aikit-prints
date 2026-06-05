import type { CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import { KIT_BLUE } from '@/lib/neumorphism'
import type { PrintPageProps } from '../types'
import { PrintFonts, PRINT_DISPLAY_HAIR } from '../printFonts'
import { tipoPalette } from './tipografia-kit'
import { eventTypeScale } from './tipografia'

/**
 * evolucion-video — wall 2-E-IMAGE (Nave O · cámara VÍDEO, 6.75 × 2.5 m).
 * ──────────────────────────────────────────────────────────────────────
 * **Will Smith comiendo espaguetis** — el meme-prueba del progreso del vídeo IA,
 * montado como **dos tiras de película** sobre fondo blanco. Sin texto: sólo una
 * **referencia temporal relativa** y los **fotogramas reales**. La franja de arriba
 * son frames del modelo viejo (hace 3 años, la papilla deforme de ModelScope) y la
 * de abajo del modelo de hoy (fotorrealista, hace unos meses). El contraste entre las dos tiras *es* el mensaje; el presente
 * se marca por color (KIT_BLUE), no por palabras.
 *
 * Tratamiento **editorial / de exposición**: las dos tiras forman un bloque
 * centrado en el alto de la pared, con celuloide casi-negro, perforaciones finas
 * de 35 mm, filetes de registro que abrazan el fotograma y las imágenes
 * *image-forward* (márgenes de banda delgados para que mande la imagen). La referencia temporal es
 * un **folio hairline** (más contenido que un titular) **sobre un filete a todo el
 * ancho** —gris para el pasado, KIT_BLUE para el presente— que hace de pie editorial
 * de cada tira; el presente además lleva un filete azul de un pelo alrededor.
 *
 * Los fotogramas son PNGs reales extraídos de los vídeos, recortados a 3:2, en
 * `public/prints/marco-2-e-image/assets/{old,new}/`. El layout es data-driven:
 * `doc.props.strips` puede sustituir las tiras; si no, usa los defaults de abajo.
 *
 * Autoría en milímetros desde el origen de trim, tipografía en puntos vía la
 * escala museográfica `eventTypeScale` (no se eligen pt a ojo).
 */

const ASSET_DIR = 'prints/marco-2-e-image/assets'
const seq = (sub: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${ASSET_DIR}/${sub}/${String(i + 1).padStart(2, '0')}.png`)

type Strip = {
  /** The only label on the piece — a relative-time folio over the strip
   *  (e.g. «hace 3 años» / «hace unos meses»), so it never reads as dated. */
  year: string
  /** Real frame PNGs under `public/` (one per cell of the strip). */
  frames: string[]
  /** Marks the present strip — label + keyline go KIT_BLUE. */
  now?: boolean
}

type Props = {
  strips?: Strip[]
  /** Real reading distance to the wall, metres. Default 3. */
  readingDistanceM?: number
}

/** The before/after of AI video — the same prompt, relative time apart. */
const DEFAULT_STRIPS: Strip[] = [
  { year: 'hace 3 años', frames: seq('old', 8) },
  { year: 'hace unos meses', frames: seq('new', 8), now: true },
]

/* ── film-strip proportions (fractions of one frame / of the band) ─────────────── */
const AR = 3 / 2 // classic 35mm still-frame aspect (w : h)
const GAP_FRAC = 0.022 // inter-frame frame-line (and side pad) ÷ frame width — thin
const PAD_Y_FRAC = 0.092 // sprocket margin top/bottom ÷ frame height — slim, image-forward
const DISPLAY_CAP_RATIO = 0.72 // Universal Sans Display cap ÷ em (year numeral em height)

type StripGeom = { frameW: number; frameH: number; gap: number; padX: number; padY: number; bandH: number; bandW: number }
function computeStripGeom(contentW: number, n: number): StripGeom {
  const frameW = contentW / (n + GAP_FRAC * (n + 1))
  const gap = GAP_FRAC * frameW
  const frameH = frameW / AR
  const padY = frameH * PAD_Y_FRAC
  return { frameW, frameH, gap, padX: gap, padY, bandH: frameH + 2 * padY, bandW: contentW }
}

export function EvolucionVideo({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const pal = tipoPalette(doc.theme)
  const p = (doc.props ?? {}) as Props
  const strips = Array.isArray(p.strips) && p.strips.length ? p.strips : DEFAULT_STRIPS
  const readingDistanceM = typeof p.readingDistanceM === 'number' && p.readingDistanceM > 0 ? p.readingDistanceM : 3

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm

  // Museographic type scale — only the year numeral uses it (the sole text).
  // A restrained editorial folio, not a billboard: smaller than the protagonist
  // H1 would be, sized so the *frames* lead and the year captions them.
  const t = eventTypeScale({ trimHeightMm: H, readingDistanceM, h1CapFraction: 0.021, ratio: 1.7 })

  const MX = W * 0.04
  const contentW = W - 2 * MX

  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  // Vertical rhythm: each strip is one "unit" = [year folio · lead · film band],
  // and the units are stacked with a breathing mid-gap and centred on the wall.
  const yearEmMm = t.capHeights.h1Mm / DISPLAY_CAP_RATIO // the numeral's em box height
  const YEAR_LEAD = H * 0.04 // air between the year+rule caption and its film band
  const MID_GAP = H * 0.09 // breathing room between the two strips
  const RULE_W = 1.4 // mm — a true hairline rule, thick enough to read at distance
  const bandH = (i: number) => computeStripGeom(contentW, strips[i].frames.length).bandH
  const unitH = (i: number) => yearEmMm + YEAR_LEAD + bandH(i)
  const totalH = strips.reduce((sum, _s, i) => sum + unitH(i), 0) + (strips.length - 1) * MID_GAP
  const top0 = Math.max(H * 0.05, (H - totalH) / 2)
  const unitTop = (i: number) => top0 + strips.slice(0, i).reduce((s, _x, j) => s + unitH(j) + MID_GAP, 0)
  const bandTop = (i: number) => unitTop(i) + yearEmMm + YEAR_LEAD

  return (
    <>
      <PrintFonts />
      <div style={{ position: 'absolute', inset: 0, background: pal.bg }} />

      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {strips.map((strip, s) => {
          const g = computeStripGeom(contentW, strip.frames.length)
          const top = bandTop(s)
          const now = !!strip.now
          const accent = now ? KIT_BLUE : pal.ink
          // The folio rule: full-band hairline underlining the year — present in
          // KIT_BLUE, past a quiet grey. The editorial device that captions each strip.
          const ruleColor = now ? KIT_BLUE : pal.muted
          return (
            <div key={`strip-${s}`}>
              {/* the only label: the year folio, hairline, sitting on its rule */}
              <div
                style={{
                  ...at(MX, top - YEAR_LEAD),
                  transform: 'translateY(-100%)',
                  fontFamily: PRINT_DISPLAY_HAIR,
                  fontSize: pt(t.h1Pt),
                  fontWeight: 400,
                  letterSpacing: pt(-t.h1Pt * 0.015),
                  lineHeight: 1,
                  color: accent,
                }}
              >
                {strip.year}
              </div>

              {/* the folio rule — full band width, underlining the year as one caption unit */}
              <div style={{ ...at(MX, top - YEAR_LEAD), width: mm(g.bandW), height: mm(RULE_W), background: ruleColor }} />

              <FilmStrip geo={geo} leftMm={MX} topMm={top} g={g} frames={strip.frames} now={now} bg={pal.bg} />
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ── one film strip: black celluloid band, punched sprockets, a row of frames ──── */
function FilmStrip({
  geo,
  leftMm,
  topMm,
  g,
  frames,
  now,
  bg,
}: {
  geo: PrintPageProps['geo']
  leftMm: number
  topMm: number
  g: StripGeom
  frames: string[]
  now: boolean
  bg: string
}) {
  const { mm } = geo
  const BAND = '#0a0a0b' // a deep, neutral celluloid black (no warm cast)
  const REG = '#1b1b1f' // the image-edge registration line — a half-tone above black

  // Perforations: 4 per frame width (the 35mm "KS" standard), fine rounded slots
  // centred in each sprocket margin and run the full band so the strip reads as
  // real film without shouting. Kept small + precise — the elegance is in restraint.
  const pitch = g.frameW / 4
  const holeW = pitch * 0.36
  const holeH = g.padY * 0.3
  const holeR = Math.min(holeW, holeH) * 0.26
  const count = Math.max(2, Math.floor(g.bandW / pitch))
  const startX = (g.bandW - (count - 1) * pitch) / 2
  const holesX = Array.from({ length: count }, (_, i) => startX + i * pitch)

  const hole = (cx: number, cyMm: number): CSSProperties => ({
    position: 'absolute',
    left: mm(cx - holeW / 2),
    top: mm(cyMm - holeH / 2),
    width: mm(holeW),
    height: mm(holeH),
    borderRadius: mm(holeR),
    background: bg,
  })

  return (
    <div
      style={{
        position: 'absolute',
        left: mm(leftMm),
        top: mm(topMm),
        width: mm(g.bandW),
        height: mm(g.bandH),
        background: BAND,
        // a hairline KIT_BLUE keyline marks the present strip without shouting
        boxShadow: now ? `0 0 0 ${mm(1.4)}px ${KIT_BLUE}` : 'none',
      }}
    >
      {/* image-edge registration lines — a half-tone rule kissing the image top
          and bottom, so the frame area reads as a precisely seated plate */}
      <div style={{ position: 'absolute', left: 0, top: mm(g.padY - 0.8), width: mm(g.bandW), height: mm(0.8), background: REG }} />
      <div style={{ position: 'absolute', left: 0, top: mm(g.padY + g.frameH), width: mm(g.bandW), height: mm(0.8), background: REG }} />

      {/* top + bottom sprocket rows */}
      {holesX.map((cx, i) => (
        <div key={`ht-${i}`} style={hole(cx, g.padY / 2)} />
      ))}
      {holesX.map((cx, i) => (
        <div key={`hb-${i}`} style={hole(cx, g.bandH - g.padY / 2)} />
      ))}

      {/* the frames, separated by black frame-lines (the gap shows the band) */}
      {frames.map((src, i) => (
        <div
          key={`f-${i}`}
          style={{
            position: 'absolute',
            left: mm(g.padX + i * (g.frameW + g.gap)),
            top: mm(g.padY),
            width: mm(g.frameW),
            height: mm(g.frameH),
            overflow: 'hidden',
            background: '#000',
          }}
        >
          <VideoFrame src={src} />
        </div>
      ))}
    </div>
  )
}

/* ── one real frame PNG, cover-cropped to the cell ─────────────────────────────── */
function VideoFrame({ src }: { src: string }) {
  const path = typeof src === 'string' ? src.trim() : ''
  if (!path) return <div style={{ position: 'absolute', inset: 0, background: '#1a1a1a' }} />
  const resolved = staticFile(path.replace(/^\/+/, '').replace(/^public\//, ''))
  const style: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }
  return getRemotionEnvironment().isRendering ? <Img src={resolved} style={style} /> : <img src={resolved} alt="" style={style} />
}
