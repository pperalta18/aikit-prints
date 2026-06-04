import type { PrintPageProps } from '../types'
import { Sheet, Masthead, Footer, Picto, Arrow, type ArrowDir, type PictoName, display, eyebrow, text, PAPER, INK, MUTED, RED } from './signage-kit'

/**
 * aseos — the restroom sign (A3 portrait). A service piece: monochrome ink, with a
 * single red focus on the accessible pictogram (the family's warning/identification
 * accent — and the universal convention for the adapted facility). No blue: blue is
 * the programme/orientation accent and is kept undiluted. A clean triptych of solid
 * glyphs in filete squares, then the word at brutal scale.
 */

type Glyph = { name: PictoName; label: string; color?: string }
type Props = { glyphs?: Glyph[]; title?: string; note?: string; arrow?: ArrowDir }

const DEFAULT_GLYPHS: Glyph[] = [
  { name: 'wc-men', label: 'Caballeros' },
  { name: 'wc-women', label: 'Señoras' },
  { name: 'accessible', label: 'Accesible', color: RED },
]

export function Aseos({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const glyphs = p.glyphs && p.glyphs.length > 0 ? p.glyphs : DEFAULT_GLYPHS
  const title = p.title ?? 'Aseos'
  const note = p.note ?? 'Aseo accesible disponible en planta baja.'
  const arrow = p.arrow ?? 'none'

  return (
    <Sheet geo={geo} paper={PAPER} justify="space-between">
      <Masthead geo={geo} left="Servicios" right="Finca El Olivar" />

      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* triptych of pictograms */}
        <div style={{ display: 'flex', gap: geo.mm(12), marginBottom: geo.mm(26) }}>
          {glyphs.map((g) => (
            <div key={g.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: geo.mm(8) }}>
              <Picto geo={geo} name={g.name} boxMm={54} glyphMm={36} color={g.color ?? INK} />
              <span style={eyebrow(geo, 10, g.color ?? MUTED)}>{g.label}</span>
            </div>
          ))}
        </div>

        {/* the word, at brutal scale */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: geo.mm(10) }}>
          <h1 style={{ ...display(geo, 92, 600), margin: 0, letterSpacing: geo.pt(-1.8) }}>{title}</h1>
          {arrow !== 'none' && <Arrow geo={geo} dir={arrow} sizeMm={44} color={INK} />}
        </div>
        <p style={{ ...text(geo, 14, 400), color: MUTED, marginTop: geo.mm(14) }}>{note}</p>
      </div>

      <Footer geo={geo} left="AiKit Live" right="live.aikit.io" sizePt={11} />
    </Sheet>
  )
}
