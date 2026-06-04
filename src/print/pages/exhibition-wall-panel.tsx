import { DISPLAY_FONT, TEXT_FONT } from '@/lib/neumorphism'
import type { CSSProperties } from 'react'
import type { PrintPageProps } from '../types'

/**
 * exhibition-wall-panel — a simple, editorial exhibition wall text (A1 landscape).
 * Swiss/International register: one huge Display title split across two lines, a quiet
 * near-black divider, a narrow credits rail on the left, a deliberate empty channel,
 * two flush-left body columns on the right, a footnote on the master left edge.
 * Monochrome ink on clean white paper. Layout from the editorial-poster workflow synthesis.
 *
 * Content is positioned in mm from the TRIM origin (a trim layer offset by the bleed),
 * type sized in points — so it reads correctly at print scale and survives any bleed.
 */

const PAPER = '#ffffff'
const INK = '#1a1a1a'

// Grid (mm) — A1 landscape 841×594, asymmetric 12-col.
const LEFT = 64 // master left edge: title, kicker, meta, footnote
const BODY1_X = 364.83
const BODY2_X = 545.33
const COL_W = 171.5
const RIGHT_EDGE = 716.83

export function ExhibitionWallPanel({ geo }: PrintPageProps) {
  const { mm, pt } = geo
  // Absolute placement in mm from the trim origin (left/top are px → React adds 'px').
  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  const metaPairs: Array<[string, string]> = [
    ['Periodo', '14–28 junio 2026'],
    ['Sede', 'Matadero Madrid · Nave 16'],
    ['Comisariado', 'AiKit Studio'],
    ['Participan', 'Pablo Peralta · María Lazcano · Equipo AiKit'],
  ]

  const titleLine: CSSProperties = {
    fontFamily: DISPLAY_FONT,
    fontSize: pt(150),
    fontWeight: 500,
    letterSpacing: pt(-2.5),
    lineHeight: 1,
    color: INK,
  }
  const label: CSSProperties = { fontFamily: TEXT_FONT, fontSize: pt(9), fontWeight: 600, letterSpacing: pt(0.7), color: INK, marginBottom: mm(1.4) }
  const value: CSSProperties = { fontFamily: TEXT_FONT, fontSize: pt(12.5), fontWeight: 400, lineHeight: pt(18) / pt(12.5), color: INK }
  const body: CSSProperties = { fontFamily: TEXT_FONT, fontSize: pt(12), fontWeight: 400, lineHeight: pt(17) / pt(12), color: INK, textAlign: 'left', margin: 0, hyphens: 'none' }

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: PAPER }} />

      {/* trim layer — content positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* TITLE: two stacked lines */}
        <div style={{ ...at(LEFT, 92), display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: mm(3) }}>
          <span style={titleLine}>El trabajo</span>
          <span style={titleLine}>invisible</span>
        </div>

        {/* KICKER */}
        <div style={{ ...at(LEFT, 256), width: mm(472), fontFamily: TEXT_FONT, fontSize: pt(19), fontWeight: 400, lineHeight: pt(26) / pt(19), color: INK }}>
          Una exposición sobre la operación que se diseña a sí misma
        </div>

        {/* band divider */}
        <div style={{ ...at(LEFT, 286), width: mm(RIGHT_EDGE - LEFT), height: mm(0.3), background: INK }} />

        {/* META rail (narrow, ragged-right) */}
        <div style={{ ...at(LEFT, 312), width: mm(95), display: 'flex', flexDirection: 'column', gap: mm(7) }}>
          {metaPairs.map(([l, v]) => (
            <div key={l}>
              <div style={label}>{l}</div>
              <div style={value}>{v}</div>
            </div>
          ))}
          <div style={{ ...value, fontWeight: 500, letterSpacing: pt(0.4), marginTop: mm(2) }}>#eltrabajoinvisible</div>
        </div>

        {/* BODY column 1 */}
        <p style={{ ...at(BODY1_X, 312), width: mm(COL_W), ...body }}>
          Toda organización esconde un segundo edificio: el de las tareas que nadie mira. Facturas
          que se cruzan, mensajes respondidos dos veces, decisiones que aguardan a alguien. Esta
          exposición recorre ese edificio invisible y muestra cómo, pieza a pieza, el trabajo puede
          rediseñarse hasta volverse imperceptible.
        </p>

        {/* BODY column 2 */}
        <p style={{ ...at(BODY2_X, 312), width: mm(COL_W), ...body }}>
          Frente a la automatización entendida como sustitución, AiKit propone otra lectura: delegar
          no es ceder el control, sino recuperar el criterio. Lo que permanece, cuando el trabajo
          invisible se disuelve, es el tiempo —y el tiempo, bien empleado, vuelve a parecerse a una
          decisión.
        </p>

        {/* FOOTNOTE (master left edge, bottom margin) */}
        <div style={{ ...at(LEFT, 548), width: mm(RIGHT_EDGE - LEFT), fontFamily: TEXT_FONT, fontSize: pt(8.5), fontWeight: 400, letterSpacing: pt(0.2), color: INK }}>
          * AiKit es un sistema operativo de negocio. Programa «Oficios del futuro», 2026.
        </div>
      </div>
    </>
  )
}
