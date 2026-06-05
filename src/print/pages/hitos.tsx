import type { CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { PrintPageProps } from '../types'
import { PrintFonts, PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { eventTypeScale } from './tipografia'
import { tipoPalette, type TipoPalette } from './tipografia-kit'

/**
 * hitos — wall 2-E-TEXT+CODE (Nave O, 7 × 2.50 m).
 * ──────────────────────────────────────────────────────────────────────────
 * **Los hitos de la inteligencia artificial** como un **grid a pantalla completa**:
 * la pared entera es una rejilla de celdas (sin cabecera de sección), y cada celda
 * es una tarjeta. Cada tarjeta lleva por título **el logro** —qué consiguió la IA—,
 * un párrafo que lo explica, una **pequeña imagen del trofeo** que lo representa, y
 * al pie una discreta línea de crédito: el sistema (el «modelo»), la organización y
 * el año. Manda el qué se logró, no el nombre del producto.
 *
 * Fondo blanco; las celdas tilean toda la pared a sangre y se separan por finos
 * filetes (seams) de la rejilla. La tipografía viene del sistema de tipo del evento
 * (`eventTypeScale`) dimensionada a la distancia de lectura. Autoría en unidades
 * físicas vía `geo` (layout en mm / tipo en pt). Estilos inline (Remotion no tiene
 * Tailwind).
 */

const ASSET = 'prints/marco-2-e-text-code/assets'

type Item = {
  /** The card title — *el logro*, what the AI achieved (the protagonist line). */
  logro: string
  /** One-paragraph description of the achievement. */
  desc: string
  /** Field tag, shown small-caps + accent at the top of the card (e.g. "Biología"). */
  field: string
  /** Credit line at the foot: system / model · org · year (small-caps, muted). */
  meta: string
  /** Trophy image path under `public/` (Remotion `staticFile`). */
  src?: string
}

type Props = {
  /** Reading distance (m) that sizes the type. Default 3. */
  readingDistanceM?: number
  /** The cards. */
  items?: Item[]
  /** Grid columns / rows. Default 6 × 2. */
  cols?: number
  rows?: number
  /** Wall ground behind the grid. Default white. */
  ground?: string
}

/** The 12 hitos — defaults; the doc can override via props. */
const DEFAULT_ITEMS: Item[] = [
  {
    logro: 'Resolvió el plegamiento de las proteínas',
    desc: 'Predijo la estructura tridimensional de casi todas las proteínas conocidas —un problema abierto durante medio siglo— y liberó más de 200 millones de modelos. Aceleró la biología y el diseño de fármacos en todo el mundo, y mereció el Nobel de Química 2024.',
    field: 'Biología',
    meta: 'AlphaFold · Google DeepMind · 2024',
    src: `${ASSET}/alphafold.png`,
  },
  {
    logro: 'Venció al campeón mundial de Go',
    desc: 'Derrotó 4–1 a Lee Sedol en un juego que se creía vetado a las máquinas por exigir intuición. Su inesperado «movimiento 37» asombró a los maestros y abrió la era moderna del aprendizaje por refuerzo.',
    field: 'Juegos',
    meta: 'AlphaGo · Google DeepMind · 2016',
    src: `${ASSET}/alphago.png`,
  },
  {
    logro: 'Oro en la Olimpiada Matemática Internacional',
    desc: 'Gemini Deep Think resolvió cinco de los seis problemas de la IMO 2025 y sumó 35 de 42 puntos: una medalla de oro certificada, al nivel de los mejores estudiantes del mundo, con demostraciones completas escritas en lenguaje natural.',
    field: 'Matemáticas',
    meta: 'Gemini Deep Think · Google DeepMind · 2025',
    src: `${ASSET}/imo-gold.png`,
  },
  {
    logro: 'Descubrió 2,2 millones de materiales nuevos',
    desc: 'Predijo la estabilidad de millones de cristales inorgánicos y halló 380.000 estructuras estables —el equivalente a casi 800 años de investigación experimental—, abriendo el camino a nuevas baterías, superconductores y semiconductores.',
    field: 'Materiales',
    meta: 'GNoME · Google DeepMind · 2023',
    src: `${ASSET}/gnome.png`,
  },
  {
    logro: 'Encontró el primer antibiótico diseñado por IA',
    desc: 'Un modelo del MIT cribó más de cien millones de moléculas y descubrió la halicina, un compuesto de estructura inédita capaz de eliminar bacterias resistentes a todos los antibióticos conocidos: el primer fármaco de su clase hallado por inteligencia artificial.',
    field: 'Fármacos',
    meta: 'Halicina · MIT · 2020',
    src: `${ASSET}/halicina.png`,
  },
  {
    logro: 'Resuelve geometría olímpica como un medallista',
    desc: 'Unió un modelo de lenguaje a un motor de deducción simbólica para resolver 25 de 30 problemas de geometría de la IMO, a la altura de un medallista de oro, ideando construcciones auxiliares que sorprenden incluso a los expertos.',
    field: 'Matemáticas',
    meta: 'AlphaGeometry · Google DeepMind · 2024',
    src: `${ASSET}/alphageometry.png`,
  },
  {
    logro: 'Aceleró la multiplicación de matrices',
    desc: 'Descubrió formas de multiplicar matrices más rápidas que el método de Strassen, imbatido durante cincuenta años. Una IA mejorando por sí misma una de las operaciones más básicas y repetidas de toda la computación.',
    field: 'Algoritmos',
    meta: 'AlphaTensor · Google DeepMind · 2022',
    src: `${ASSET}/alphatensor.png`,
  },
  {
    logro: 'Primer hallazgo matemático nuevo de un LLM',
    desc: 'Acopló un gran modelo de lenguaje a un evaluador automático para encontrar soluciones inéditas a problemas abiertos de matemáticas y algoritmos: el primer conocimiento genuinamente nuevo y verificable descubierto por un modelo de lenguaje.',
    field: 'Matemáticas',
    meta: 'FunSearch · Google DeepMind · 2023',
    src: `${ASSET}/funsearch.png`,
  },
  {
    logro: 'Clasificó 71 millones de mutaciones humanas',
    desc: 'Estimó el efecto de todas las mutaciones que alteran una proteína humana —71 millones en total—, clasificando el 89% como benignas o probablemente patógenas y entregando a la medicina un mapa para descifrar enfermedades genéticas raras.',
    field: 'Genómica',
    meta: 'AlphaMissense · Google DeepMind · 2023',
    src: `${ASSET}/alphamissense.png`,
  },
  {
    logro: 'Leyó un papiro carbonizado sin abrirlo',
    desc: 'A partir de tomografías de un rollo calcinado por el Vesubio en el 79 d.C., la IA detectó la tinta invisible y recuperó columnas enteras de texto griego sin desplegarlo: la primera lectura de una biblioteca perdida de la Antigüedad.',
    field: 'Arqueología',
    meta: 'Vesuvius Challenge · 2024',
    src: `${ASSET}/herculano.png`,
  },
  {
    logro: 'Devolvió la voz a personas con parálisis',
    desc: 'Interfaces cerebro-ordenador leyeron la actividad neuronal de personas que habían perdido el habla y la convirtieron en voz y en un avatar en tiempo real, a más de sesenta palabras por minuto: la palabra recuperada directamente desde el pensamiento.',
    field: 'Neurociencia',
    meta: 'UCSF · Stanford · 2023',
    src: `${ASSET}/neuroprotesis.png`,
  },
  {
    logro: 'Halló un planeta oculto en el ruido',
    desc: 'Una red neuronal reanalizó datos del telescopio Kepler y detectó la débil señal de Kepler-90i, el octavo planeta de una estrella lejana —el primer sistema solar que iguala al nuestro en número de planetas—, invisible para los métodos clásicos.',
    field: 'Astronomía',
    meta: 'NASA · Google · 2017',
    src: `${ASSET}/kepler.png`,
  },
]

export function Hitos({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as Props
  const items = Array.isArray(p.items) && p.items.length ? p.items : DEFAULT_ITEMS
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : 3
  const cols = typeof p.cols === 'number' && p.cols > 0 ? p.cols : 6
  const rows = typeof p.rows === 'number' && p.rows > 0 ? p.rows : 2
  const ground = typeof p.ground === 'string' ? p.ground : (doc.surface ?? '#ffffff')

  const pal: TipoPalette = tipoPalette(doc.theme)
  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm

  // Type chord — a small ratio keeps logro/desc/meta as a quiet per-card hierarchy.
  // The logro title is set one step smaller than before (H4, not H3).
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, ratio: 1.5, h1CapFraction: 0.05 })
  const logroPt = scale.h4Pt
  const descPt = scale.bodyPt
  const metaPt = scale.eyebrowPt

  /* ── full-bleed grid: cells tile the whole wall, edge to edge ───────────────── */
  const cellW = W / cols
  const cellH = H / rows
  const cellX = (c: number) => c * cellW
  const cellY = (r: number) => r * cellH
  const seam = Math.max(1, mm(0.8)) // hairline grid seam

  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  return (
    <>
      <PrintFonts />

      {/* clean white wall ground (full-bleed, covers the bleed area) */}
      <div
        aria-hidden
        style={{ position: 'absolute', left: 0, top: 0, width: geo.mediaWidthPx, height: geo.mediaHeightPx, background: ground, pointerEvents: 'none' }}
      />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── the grid of hito cells (full screen) ─────────────────────────────── */}
        {items.slice(0, cols * rows).map((item, i) => {
          const c = i % cols
          const r = Math.floor(i / cols)
          return (
            <div key={`hito-${i}`} style={{ ...at(cellX(c), cellY(r)), width: mm(cellW), height: mm(cellH) }}>
              <Cell item={item} cellW={cellW} cellH={cellH} logroPt={logroPt} descPt={descPt} metaPt={metaPt} mm={mm} pt={pt} pal={pal} />
            </div>
          )
        })}

        {/* ── grid seams: hairlines between cells (no outer border → full bleed) ─── */}
        {Array.from({ length: cols - 1 }, (_, k) => (
          <div key={`vseam-${k}`} style={{ ...at(cellX(k + 1) - 0, 0), width: seam, height: mm(H), background: pal.hairline, transform: 'translateX(-50%)' }} />
        ))}
        {Array.from({ length: rows - 1 }, (_, k) => (
          <div key={`hseam-${k}`} style={{ ...at(0, cellY(k + 1)), width: mm(W), height: seam, background: pal.hairline, transform: 'translateY(-50%)' }} />
        ))}
      </div>
    </>
  )
}

/* ── one hito cell: trophy + field · logro (label) · paragraph · credit line ─── */
function Cell({
  item,
  cellW,
  cellH,
  logroPt,
  descPt,
  metaPt,
  mm,
  pt,
  pal,
}: {
  item: Item
  cellW: number
  cellH: number
  logroPt: number
  descPt: number
  metaPt: number
  mm: (v: number) => number
  pt: (v: number) => number
  pal: TipoPalette
}) {
  const padX = cellW * 0.07
  const padY = cellH * 0.06
  const thumb = cellH * 0.15 // a small trophy — never large

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: mm(padX), top: mm(padY), right: mm(padX), bottom: mm(padY), display: 'flex', flexDirection: 'column' }}>
        {/* header row: a small trophy + the field tag (the single accent) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: mm(cellW * 0.05) }}>
          <div style={{ width: mm(thumb), height: mm(thumb), flex: '0 0 auto', position: 'relative', overflow: 'hidden' }}>
            <Trophy item={item} />
          </div>
          <div
            style={{
              fontFamily: PRINT_TEXT_FONT,
              fontSize: pt(metaPt),
              fontWeight: 600,
              letterSpacing: pt(metaPt * 0.16),
              textTransform: 'uppercase',
              color: pal.accent,
            }}
          >
            {item.field}
          </div>
        </div>

        {/* logro — the cell label: what the AI achieved (reduced size) */}
        <div
          style={{
            marginTop: mm(cellH * 0.03),
            fontFamily: PRINT_DISPLAY_HAIR,
            fontSize: pt(logroPt),
            fontWeight: 400,
            lineHeight: 1.02,
            letterSpacing: pt(-logroPt * 0.016),
            color: pal.ink,
          }}
        >
          {item.logro}
        </div>

        {/* one-paragraph description */}
        <div
          style={{
            marginTop: mm(cellH * 0.028),
            fontFamily: PRINT_TEXT_FONT,
            fontSize: pt(descPt),
            fontWeight: 400,
            lineHeight: 1.32,
            color: pal.inkSoft,
            hyphens: 'none',
          }}
        >
          {item.desc}
        </div>

        {/* spacer pushes the credit line to the bottom of the cell */}
        <div style={{ flex: 1, minHeight: mm(cellH * 0.02) }} />

        {/* credit line — system / model · org · year (hairline above, like a spec line) */}
        <div style={{ height: Math.max(1, mm(0.8)), background: pal.hairline, width: '100%' }} />
        <div
          style={{
            marginTop: mm(cellH * 0.016),
            fontFamily: PRINT_TEXT_FONT,
            fontSize: pt(metaPt),
            fontWeight: 600,
            letterSpacing: pt(metaPt * 0.12),
            textTransform: 'uppercase',
            color: pal.muted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.meta}
        </div>
      </div>
    </div>
  )
}

/* ── the trophy image (contain, centred) or a quiet placeholder ─────────────── */
function Trophy({ item }: { item: Item }) {
  const src = typeof item.src === 'string' && item.src.trim() ? item.src.trim() : ''
  const imgStyle: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }
  if (!src) return <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,20,0.04)' }} />
  const path = staticFile(src.replace(/^\/+/, '').replace(/^public\//, ''))
  return getRemotionEnvironment().isRendering ? (
    <Img src={path} alt={item.logro} style={imgStyle} />
  ) : (
    <img src={path} alt={item.logro} style={imgStyle} />
  )
}
