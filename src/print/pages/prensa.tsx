import type { CSSProperties, ReactNode } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { PrintPageProps } from '../types'
import { PrintFonts, PRINT_DISPLAY, PRINT_TEXT_FONT } from '../printFonts'
import { eventTypeScale } from './tipografia'
import { tipoPalette, type TipoPalette } from './tipografia-kit'

/**
 * prensa — «La Naranja Mecánica», muro de cards (wall 4-W-2, 11.5×3 m).
 * ──────────────────────────────────────────────────────────────────────────────
 * The **left quarter stays white** (the exhibition margin) and the **right three
 * quarters** is a clean, airy grid of **wide horizontal cards** (3×4 = 12) — photo
 * on the left, text on the right. Each card is one real, already-operating piece of
 * automation that **a company giving away juice to the whole world for free could
 * actually use**: growing, harvesting, making, powering, staffing, moving, delivering,
 * selling and advertising — every one automated. A short headline names the **emerging
 * technology and its impact**, a one-line fact gives the specifics, a quiet dateline
 * grounds it. The reader infers the thesis with no slogan: the cost of making and
 * moving everything is collapsing toward zero.
 *
 * House style: clean white paper, near-black ink, one disciplined **brand-orange**
 * accent (the room's «naranja») on the section kicker. No masthead, no frames or
 * shadows — the photograph anchors each card and the type does the rest, with a lot
 * of air. Type sized via `eventTypeScale`; layout in mm (`geo.mm`), type in pt (`geo.pt`).
 *
 * `doc.props` (all optional): `readingDistanceM` (default 3), `whiteLeftFraction`
 * (default 0.25), `cols`/`rows` (default 3×4), `marginMm`, `rightMarginMm`,
 * `stories` (override the twelve).
 */

/** Brand orange («el naranja de la sala», from the wordmark) — the only accent. */
const ORANGE = '#fe6d01'
const ASSET_DIR = 'prints/4-w-2/assets/news'

type Story = {
  /** Section label — small-caps orange kicker (e.g. «Energía»). */
  kicker: string
  /** Headline: the emerging technology + its impact (short). */
  headline: string
  /** A one-line fact with the real specifics. */
  body: string
  /** Dateline — place · year (small-caps, muted). */
  dateline?: string
  /** Press photo under `public/` (Remotion `staticFile`). */
  src?: string
  alt?: string
  /** object-position for the photo crop (default 'center'). */
  focus?: string
}

type Props = {
  readingDistanceM?: number
  whiteLeftFraction?: number
  cols?: number
  rows?: number
  /** Clear top & bottom margin (mm) — bigger ⇒ shorter cards with more air. Default 450. */
  marginMm?: number
  rightMarginMm?: number
  /** Press-photo width as a fraction of the card width. Default 0.3. */
  photoFraction?: number
  stories?: Story[]
}

const s = (kicker: string, headline: string, body: string, dateline: string, slug: string, alt: string, focus?: string): Story => ({
  kicker,
  headline,
  body,
  dateline,
  src: `${ASSET_DIR}/${slug}.png`,
  alt,
  focus,
})

/**
 * The twelve cards — everything a one-man «juice for the whole world» operation could
 * lean on, each a real system operating in 2023–2026. Row-major 3×4: grow · harvest ·
 * make → power-the-line · warehouse · workforce → road · sea · doorstep → shop · ride ·
 * sell-the-idea.
 */
const DEFAULT_STORIES: Story[] = [
  s('Agricultura', 'Granjas verticales que producen fruta todo el año, sin tierra', 'Una instalación sin ventanas en Richmond genera cuatro millones de kilos de fruta anuales con un 90 % menos de agua que la agricultura convencional.', '2024', 'agricultura', 'Granja vertical: torres de fresas bajo luz LED'),
  s('Cosecha', 'Robots autónomos que recogen la fruta una a una', 'La mayor flota de cosechadores robóticos del mundo identifica el nivel de madurez de cada pieza y la recoge de forma individual. Opera de forma continua en Colorado.', '2024', 'cosecha', 'Brazo robótico cogiendo una fresa madura'),
  s('Industria', 'Una planta embotelladora que funciona sin personal humano', 'Una línea totalmente automatizada en Arabia Saudí llena, tapa, etiqueta y apila siete millones de envases al día, a un ritmo de 150.000 botellas por hora.', '2024', 'industria', 'Línea automatizada de botellas de zumo, sin operarios'),

  s('Energía', 'Energía solar a menos de dos céntimos por kilovatio-hora', 'La mayor instalación solar del mundo, en Abu Dabi, genera electricidad a 1,3 céntimos por kWh. Es un 90 % más barato que en 2010.', '2024', 'energia', 'Mar de paneles solares en el desierto al atardecer'),
  s('Almacén', 'La flota de robots de Amazon supera el millón de unidades', 'La compañía opera ya más de un millón de robots en sus centros de distribución, una cifra cercana a su plantilla humana total.', '2025', 'almacen-amazon-millon-robots', 'Almacén con cientos de robots naranjas moviendo estanterías'),
  s('Trabajo', 'Robots humanoides se incorporan a las cadenas de montaje', 'Un robot humanoide en Spartanburg montó 30.000 vehículos en once meses. El programa se amplía ahora a otras plantas de fabricación.', '2025', 'trabajo', 'Robot humanoide en una línea de montaje de coches'),

  s('Transporte', 'Camiones de cuarenta toneladas circulan por rutas comerciales sin conductor', 'Remolques autónomos operan día y noche en las carreteras de Texas, prestando servicios de carga regulares con la cabina vacía.', '2025', 'transporte', 'Tráiler autónomo en autopista al atardecer, cabina vacía'),
  s('Marítimo', 'Un buque de carga eléctrico que navega sin tripulación entre puertos', 'El Yara Birkeland transporta mercancías entre puertos noruegos sin emisiones ni tripulación a bordo, eliminando 40.000 viajes anuales de camión.', '2024', 'carguero-electrico-yara-birkeland', 'Carguero eléctrico navegando por un fiordo noruego'),
  s('Reparto', 'Dos millones de entregas por dron', 'Las operaciones en Texas y Ruanda han completado más de dos millones de entregas, bajando los paquetes a los clientes mediante un cable en menos de media hora.', '2024', 'reparto', 'Dron de reparto bajando un paquete sobre una casa'),

  s('Comercio', 'Tiendas en las que coges los productos y te vas sin pasar por caja', 'La tecnología Just Walk Out está instalada en más de 80 estadios y 300 locales comerciales, cobrando a los clientes automáticamente al salir.', '2025', 'tienda-sin-cajero-just-walk-out', 'Tienda sin cajero: cliente saliendo con la compra'),
  s('Movilidad', 'Medio millón de trayectos autónomos de pago por semana', 'Waymo completa más de 500.000 trayectos de pago cada semana en diez ciudades, todos sin conductor humano al volante.', '2026', 'robotaxis-waymo', 'Robotaxi blanco con sensor en el techo, sin conductor'),
  s('Publicidad', 'Una campaña navideña producida por IA en un mes', 'Un anuncio navideño de alcance global se generó íntegramente con inteligencia artificial, reduciendo a cuatro semanas lo que tradicionalmente supone un año de producción.', '2024', 'publicidad', 'Camión rojo de reparto navideño bajo la nieve'),
]

export function Prensa({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props

  const stories = Array.isArray(p.stories) && p.stories.length ? p.stories : DEFAULT_STORIES
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : 3
  const cols = typeof p.cols === 'number' && p.cols > 0 ? Math.round(p.cols) : 3
  const rows = typeof p.rows === 'number' && p.rows > 0 ? Math.round(p.rows) : 4
  const margin = typeof p.marginMm === 'number' ? p.marginMm : 450
  const photoFraction =
    typeof p.photoFraction === 'number' && p.photoFraction > 0 && p.photoFraction < 0.9 ? p.photoFraction : 0.3
  const whiteLeftFraction =
    typeof p.whiteLeftFraction === 'number' && p.whiteLeftFraction >= 0 && p.whiteLeftFraction < 0.9
      ? p.whiteLeftFraction
      : 0.25

  const pal: TipoPalette = { ...tipoPalette(doc.theme), accent: ORANGE }
  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const rightMargin = typeof p.rightMarginMm === 'number' ? p.rightMarginMm : W * 0.04

  // Type chord — a compact medium-weight headline (one rung down from the old
  // hairline h3) so the smaller cards read calm, not shouty.
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, ratio: 1.5, h1CapFraction: 0.05 })
  const t = { headPt: scale.h4Pt, bodyPt: scale.bodyPt, eyebrowPt: scale.eyebrowPt }

  /* ── the card grid (right ¾; white margins left and right) ──────────────────── */
  const gridLeft = W * whiteLeftFraction
  const gridRight = W - rightMargin
  const gridTop = margin
  const gridBottom = H - margin
  const colGap = W * 0.012
  const rowGap = H * 0.035
  const cardW = (gridRight - gridLeft - colGap * (cols - 1)) / cols
  const cardH = (gridBottom - gridTop - rowGap * (rows - 1)) / rows
  const cardX = (c: number) => gridLeft + c * (cardW + colGap)
  const cardY = (r: number) => gridTop + r * (cardH + rowGap)

  return (
    <>
      <PrintFonts />

      {/* clean white wall — the left quarter stays this, the cards sit on it */}
      <div
        aria-hidden
        style={{ position: 'absolute', left: 0, top: 0, width: geo.mediaWidthPx, height: geo.mediaHeightPx, background: doc.surface ?? pal.bg }}
      />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {stories.slice(0, cols * rows).map((story, i) => {
          const c = i % cols
          const r = Math.floor(i / cols)
          return (
            <div key={`card-${i}`} style={{ position: 'absolute', left: mm(cardX(c)), top: mm(cardY(r)), width: mm(cardW), height: mm(cardH) }}>
              <Card story={story} cardW={cardW} cardH={cardH} photoFraction={photoFraction} geo={geo} pal={pal} t={t} />
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ── one wide card: photo on the left · kicker · headline · fact · dateline ───── */
function Card({
  story,
  cardW,
  cardH,
  photoFraction,
  geo,
  pal,
  t,
}: {
  story: Story
  cardW: number
  cardH: number
  photoFraction: number
  geo: PrintPageProps['geo']
  pal: TipoPalette
  t: { headPt: number; bodyPt: number; eyebrowPt: number }
}) {
  const { mm, pt } = geo
  const photoW = cardW * photoFraction
  const textGap = cardW * 0.035

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: pal.bg, display: 'flex', flexDirection: 'row' }}>
      {/* press photo (left, full height) */}
      <div style={{ width: mm(photoW), height: '100%', position: 'relative', overflow: 'hidden', flex: '0 0 auto' }}>
        <Photo story={story} geo={geo} pal={pal} />
      </div>

      {/* text column (right) — kicker · headline · fact at top, dateline pinned foot */}
      <div style={{ marginLeft: mm(textGap), flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            fontFamily: PRINT_TEXT_FONT,
            fontSize: pt(t.eyebrowPt),
            fontWeight: 700,
            letterSpacing: pt(t.eyebrowPt * 0.12),
            textTransform: 'uppercase',
            color: pal.accent,
          }}
        >
          {story.kicker}
        </div>
        <div
          style={{
            marginTop: mm(cardH * 0.04),
            fontFamily: PRINT_DISPLAY,
            fontSize: pt(t.headPt),
            fontWeight: 500,
            lineHeight: 1.08,
            letterSpacing: pt(-t.headPt * 0.01),
            color: pal.ink,
          }}
        >
          {story.headline}
        </div>
        <div
          style={{
            marginTop: mm(cardH * 0.045),
            fontFamily: PRINT_TEXT_FONT,
            fontSize: pt(t.bodyPt),
            fontWeight: 400,
            lineHeight: 1.32,
            color: pal.inkSoft,
            hyphens: 'none',
          }}
        >
          {story.body}
        </div>

        {/* spacer pushes the dateline to the foot of the card (air in between) */}
        <div style={{ flex: 1, minHeight: mm(cardH * 0.04) }} />

        {story.dateline && (
          <>
            <div style={{ height: Math.max(1, mm(0.8)), background: pal.hairline, width: '100%' }} />
            <div
              style={{
                marginTop: mm(cardH * 0.03),
                fontFamily: PRINT_TEXT_FONT,
                fontSize: pt(t.eyebrowPt),
                fontWeight: 600,
                letterSpacing: pt(t.eyebrowPt * 0.1),
                textTransform: 'uppercase',
                color: pal.muted,
              }}
            >
              {story.dateline}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── a press photo (object-fit cover) or a quiet labelled placeholder ─────────── */
function Photo({ story, geo, pal }: { story: Story; geo: PrintPageProps['geo']; pal: TipoPalette }): ReactNode {
  const path = typeof story.src === 'string' && story.src.trim() ? story.src.trim() : ''
  if (!path) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#ece9e3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: PRINT_TEXT_FONT, fontSize: geo.pt(geo.dims.trimHeightMm * 0.01), letterSpacing: geo.pt(2), textTransform: 'uppercase', color: pal.faint }}>{story.kicker}</span>
      </div>
    )
  }
  const resolved = staticFile(path.replace(/^\/+/, '').replace(/^public\//, ''))
  const style: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: story.focus ?? 'center', display: 'block' }
  return getRemotionEnvironment().isRendering ? <Img src={resolved} style={style} /> : <img src={resolved} alt={story.alt ?? ''} style={style} />
}
