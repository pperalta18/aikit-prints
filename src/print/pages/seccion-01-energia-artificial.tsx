import { KIT_BLUE, DISPLAY_FONT, TEXT_FONT, elevation, type NeoTheme } from '@/lib/neumorphism'
import type { CSSProperties } from 'react'
import type { PrintPageProps } from '../types'

/**
 * seccion-01-energia-artificial — exhibition section wall ("01 · La energía artificial").
 * ───────────────────────────────────────────────────────────────────────────────────────
 * A 4 × 2.5 m section-divider wall for the «Economía de guerra» / «Oficios del futuro»
 * exhibition. It marks the entrance to section 01.
 *
 * Two references, fused:
 *  · The Figma slide «01 · La energía artificial» — composition: a monumental ghost
 *    section number carved into the surface (top-left), the title beneath it, a body
 *    column on the left, and an allegorical relief running full-height on the right.
 *  · The «El Año Cero» wall (agi-timeline) — register: monochrome INK on warm PAPER,
 *    Swiss/editorial, with a single KIT_BLUE accent used in exactly one place that
 *    tells the story; authored in millimetres from the trim origin, type in points.
 *
 * The Figma's carved allegory is rebuilt with the neumorphism engine (no bitmap):
 * the ghost «01» is embossed text, and the right relief is a recessed niche holding
 * a raised light-bulb emblem — radiating rays in relief, the filament the one spark
 * of colour: blue = the artificial energy itself.
 */

const PAPER = '#f4f1ea'
const INK = '#1a1a1a'

/**
 * Warm relief theme — the neumorphism engine re-lit for warm paper (the default
 * light theme is cool blue-grey). Drives every carved/raised surface on the wall.
 */
const RELIEF: NeoTheme = {
  name: 'paper-relief',
  surface: PAPER,
  gridLine: 'rgba(26,26,26,0.06)',
  textMuted: '#6f6a5d',
  textStrong: INK,
  highlight: '#fffdf6', // warm lit edge
  shadow: '#cbc4b1', // warm shaded edge — dark enough to read on a wall
  lightSource: 'tl',
  intensity: 1,
}

/* ── canvas grid (mm) — 4000 × 2500, origin top-left ───────────────────────── */
const MARGIN = 180
const LEFT_X = MARGIN // 180
const RELIEF_X = 2680 // carved niche: x 2680 → 3820
const RELIEF_W = 4000 - MARGIN - RELIEF_X // 1140
const TEXT_W = RELIEF_X - 240 - LEFT_X // left column wrap width (~2260), 240 mm gap to niche
const CONTENT_TOP = MARGIN
const CONTENT_BOT = 2500 - MARGIN // 2320

export function SeccionEnergiaArtificial({ geo }: PrintPageProps) {
  const { mm, pt } = geo
  /** Absolute placement in mm from the trim origin. */
  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  /* ── carved ghost number — embossed text, paper-on-paper, lit top-left ── */
  const embossDist = mm(2.6)
  const embossBlur = mm(6)
  const ghostEmboss: CSSProperties = {
    color: PAPER,
    textShadow: `${-embossDist}px ${-embossDist}px ${embossBlur}px ${RELIEF.highlight}, ${embossDist}px ${embossDist}px ${embossBlur}px ${RELIEF.shadow}`,
  }

  /* type styles (points) */
  const kicker: CSSProperties = { fontFamily: TEXT_FONT, fontSize: pt(30), fontWeight: 600, letterSpacing: pt(1.2), textTransform: 'uppercase', color: INK }
  const ghost: CSSProperties = { fontFamily: DISPLAY_FONT, fontSize: pt(1450), fontWeight: 700, letterSpacing: pt(-12), lineHeight: 0.8, ...ghostEmboss, whiteSpace: 'nowrap' }
  const titleLine: CSSProperties = { fontFamily: DISPLAY_FONT, fontSize: pt(300), fontWeight: 500, letterSpacing: pt(-4.5), lineHeight: 1.0, color: INK, whiteSpace: 'nowrap' }
  const subtitle: CSSProperties = { fontFamily: DISPLAY_FONT, fontSize: pt(70), fontWeight: 500, letterSpacing: pt(-0.6), lineHeight: 1.18, color: INK }
  const body: CSSProperties = { fontFamily: TEXT_FONT, fontSize: pt(58), fontWeight: 400, lineHeight: 1.42, color: INK, margin: 0, hyphens: 'none' }
  const footnote: CSSProperties = { fontFamily: TEXT_FONT, fontSize: pt(26), fontWeight: 400, letterSpacing: pt(0.2), color: RELIEF.textMuted }

  return (
    <>
      {/* warm paper, bled to the media edge */}
      <div style={{ position: 'absolute', inset: 0, background: PAPER }} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── RIGHT: carved relief niche + light-bulb emblem (behind the editorial block edge) ── */}
        <ReliefEmblem geo={geo} />

        {/* ── LEFT EDITORIAL BLOCK ──────────────────────────────────────────── */}

        {/* kicker */}
        <div style={{ ...at(LEFT_X, CONTENT_TOP + 8), ...kicker, display: 'flex', alignItems: 'center', gap: mm(18) }}>
          <span style={{ width: mm(46), height: mm(46), background: KIT_BLUE, flex: '0 0 auto' }} />
          <span>Sección 01 · «Oficios del futuro», 2026</span>
        </div>

        {/* monumental carved «01» (the relief of the section number) */}
        <div style={{ ...at(LEFT_X - mm(8), 250), ...ghost }}>01</div>

        {/* title — two stacked lines */}
        <div style={{ ...at(LEFT_X, 1170), display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: mm(2) }}>
          <span style={titleLine}>La energía</span>
          <span style={titleLine}>artificial</span>
        </div>

        {/* divider rule */}
        <div style={{ ...at(LEFT_X, 1640), width: mm(TEXT_W), height: mm(2), background: INK }} />

        {/* subtitle */}
        <div style={{ ...at(LEFT_X, 1720), width: mm(TEXT_W), ...subtitle }}>
          La inteligencia como nueva fuente de energía
        </div>

        {/* body */}
        <p style={{ ...at(LEFT_X, 1900), width: mm(TEXT_W), ...body }}>
          Durante dos siglos el progreso se midió en energía: carbón, vapor, electricidad, petróleo. Cada salto
          multiplicó lo que una persona podía hacer en un día. La inteligencia artificial es el siguiente término
          de esa serie —solo que esta vez lo que se amplifica no es la fuerza, sino el criterio. Una energía que no
          se quema: se entrena, se conecta y se reparte. Esta sección recorre cómo esa corriente entra en los
          oficios: en quién decide, en qué se delega y en qué queda, por fin, en manos humanas.
        </p>

        {/* footnote (master left edge, bottom margin) */}
        <div style={{ ...at(LEFT_X, CONTENT_BOT - 18), ...footnote }}>
          AiKit · sistema operativo de negocio. Exposición «Economía de guerra», 2026.
        </div>
      </div>
    </>
  )
}

/* ── the relief: a carved niche holding a raised light-bulb emblem ───────────── */
/* Built entirely with the neumorphism engine (elevation()): a recessed panel, a    */
/* raised glass bulb radiating relief rays, a threaded screw base, and a filament    */
/* drawn as the single blue spark — the distilled allegory of «artificial energy».   */
function ReliefEmblem({ geo }: { geo: PrintPageProps['geo'] }) {
  const { mm } = geo
  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  // niche
  const niche = elevation(RELIEF, { depth: 'recessed', distance: mm(4), blur: mm(11), radius: mm(28) })

  // emblem geometry (mm, absolute on the trim layer)
  const cx = RELIEF_X + RELIEF_W / 2 // 3250
  const cy = 1200 // bulb glass centre — emblem balanced within the niche (glass + rays + base)
  const glassD = 560
  const glassR = glassD / 2

  // radial rays — relief lines emitted from the glass (skip the downward arc: base)
  const rayLen = 150
  const startR = glassR + 70
  const rayW = 16
  const rays = Array.from({ length: 24 }, (_, i) => i * 15).filter((a) => a < 70 || a > 110)

  // screw base — raised block with recessed thread grooves, hung under the glass
  const baseW = 210
  const baseH = 230
  const baseTop = cy + glassR + 18
  const grooves = [0, 1, 2]

  return (
    <>
      {/* carved niche */}
      <div style={{ ...at(RELIEF_X, CONTENT_TOP), width: mm(RELIEF_W), height: mm(CONTENT_BOT - CONTENT_TOP), ...niche }} />

      {/* radiating relief rays */}
      {rays.map((a) => (
        <div
          key={`ray-${a}`}
          style={{
            ...at(cx, cy),
            width: mm(rayLen),
            height: mm(rayW),
            marginTop: mm(-rayW / 2),
            transformOrigin: '0 50%',
            transform: `rotate(${a}deg) translateX(${mm(startR)}px)`,
            borderRadius: mm(rayW / 2),
            ...elevation(RELIEF, { depth: 'raised', distance: mm(1.4), blur: mm(3.4), radius: mm(rayW / 2) }),
          }}
        />
      ))}

      {/* glass bulb — raised disc */}
      <div
        style={{
          ...at(cx - glassR, cy - glassR),
          width: mm(glassD),
          height: mm(glassD),
          ...elevation(RELIEF, { depth: 'raised', distance: mm(3.4), blur: mm(8), radius: mm(glassR) }),
        }}
      />
      {/* inner carved well inside the glass (gives the dome depth) */}
      <div
        style={{
          ...at(cx - glassR + mm(46), cy - glassR + mm(46)),
          width: mm(glassD) - mm(92),
          height: mm(glassD) - mm(92),
          ...elevation(RELIEF, { depth: 'recessed', distance: mm(1.8), blur: mm(5), radius: mm(glassR) }),
        }}
      />

      {/* filament — the single blue spark: an incandescent filament (two leads + a
          coil loop) drawn as the one note of colour on the whole wall. */}
      <svg
        style={{ ...at(cx - mm(150), cy - mm(150)), width: mm(300), height: mm(300), overflow: 'visible' }}
        viewBox="0 0 300 300"
        fill="none"
      >
        {/* two leads rising from the screw base into the glass */}
        <path d="M125 285 L125 160" stroke={KIT_BLUE} strokeWidth={12} strokeLinecap="round" />
        <path d="M175 285 L175 160" stroke={KIT_BLUE} strokeWidth={12} strokeLinecap="round" />
        {/* the coil loop bridging the leads (the glowing wire) */}
        <path d="M125 160 C125 96 175 96 175 160" stroke={KIT_BLUE} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
        {/* the spark at the apex */}
        <circle cx={150} cy={116} r={9} fill={KIT_BLUE} />
      </svg>

      {/* screw base — raised block */}
      <div
        style={{
          ...at(cx - baseW / 2, baseTop),
          width: mm(baseW),
          height: mm(baseH),
          ...elevation(RELIEF, { depth: 'raised', distance: mm(2.4), blur: mm(6), radius: mm(20) }),
        }}
      />
      {/* thread grooves — recessed lines across the base */}
      {grooves.map((g) => (
        <div
          key={`thread-${g}`}
          style={{
            ...at(cx - baseW / 2 + mm(22), baseTop + mm(44) + mm(g * 52)),
            width: mm(baseW - 44),
            height: mm(20),
            ...elevation(RELIEF, { depth: 'recessed', distance: mm(1), blur: mm(2.6), radius: mm(10) }),
          }}
        />
      ))}
      {/* contact tip */}
      <div
        style={{
          ...at(cx - mm(48), baseTop + mm(baseH)),
          width: mm(96),
          height: mm(54),
          ...elevation(RELIEF, { depth: 'raised', distance: mm(1.8), blur: mm(4.4), radius: mm(26) }),
        }}
      />
    </>
  )
}
