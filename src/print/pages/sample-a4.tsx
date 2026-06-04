import { KIT_BLUE, DISPLAY_FONT, elevation } from '@/lib/neumorphism'
import { useNeoTheme } from '@/stories/neo/NeoTheme'
import { StatWidget } from '@/stories/neo/widgets/StatWidget'
import { PrintSafeArea } from '../PrintRenderer'
import type { PrintPageProps } from '../types'

/**
 * sample-a4 — the first proof: an A4 neumorphic poster composed from reused
 * widgets, exercising the whole pipeline (dimensions, bleed, crop marks, CMYK).
 *
 * Demonstrates the coordinate model: layout in mm/pt via `geo`, and screen-scale
 * widgets brought to a physical size with CSS `zoom` (layout-affecting, crisp).
 */
export function SampleA4({ geo }: PrintPageProps) {
  const theme = useNeoTheme()
  const { mm, pt } = geo

  // Bring the 240px-wide StatWidget to ~84mm physical width.
  const STAT_BASE_W = 240
  const statZoom = mm(84) / STAT_BASE_W

  return (
    <>
      {/* Bleeding footer band — fills to the media edge (proves bleed). */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: mm(26),
          background: KIT_BLUE,
        }}
      />

      <PrintSafeArea style={{ display: 'flex', flexDirection: 'column', gap: mm(7) }}>
        {/* eyebrow */}
        <span
          style={{
            alignSelf: 'flex-start',
            fontSize: pt(9.5),
            fontWeight: 700,
            letterSpacing: pt(1.2),
            textTransform: 'uppercase',
            color: KIT_BLUE,
            padding: `${mm(1.4)}px ${mm(3)}px`,
            borderRadius: mm(999),
            ...elevation(theme, { depth: 'recessed', distance: mm(0.5), blur: mm(1.2), radius: mm(999) }),
          }}
        >
          AiKit · Informe
        </span>

        {/* headline */}
        <h1
          style={{
            margin: 0,
            fontFamily: DISPLAY_FONT,
            fontWeight: 800,
            fontSize: pt(46),
            lineHeight: 1.02,
            letterSpacing: pt(-1.2),
            color: theme.textStrong,
          }}
        >
          El trabajo
          <br />
          que ya no
          <br />
          haces a mano
        </h1>

        {/* subhead */}
        <p
          style={{
            margin: 0,
            maxWidth: mm(140),
            fontSize: pt(13),
            lineHeight: 1.5,
            color: theme.textMuted,
          }}
        >
          Un vistazo a lo que cambia cuando la operativa se delega. Mismos
          procesos, una fracción del tiempo — y listo para imprenta en CMYK.
        </p>

        {/* two KPI tiles, scaled to physical size via zoom */}
        <div style={{ display: 'flex', gap: mm(8), marginTop: mm(3) }}>
          <div style={{ zoom: statZoom }}>
            <StatWidget
              label="Tiempo por contratación"
              before="3 días"
              after="75 s"
              delta={-98}
              accent="blue"
            />
          </div>
          <div style={{ zoom: statZoom }}>
            <StatWidget
              label="Coste por documento"
              before="12 €"
              after="0,40 €"
              delta={-96}
              accent="green"
            />
          </div>
        </div>
      </PrintSafeArea>

      {/* footer label inside the bleeding band */}
      <span
        style={{
          position: 'absolute',
          left: geo.bleedPx + geo.safeMarginPx,
          bottom: mm(9),
          fontSize: pt(11),
          fontWeight: 600,
          letterSpacing: pt(0.4),
          color: '#ffffff',
        }}
      >
        aikit.es
      </span>
    </>
  )
}
