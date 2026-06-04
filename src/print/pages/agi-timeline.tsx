import { KIT_BLUE, DISPLAY_FONT, TEXT_FONT } from '@/lib/neumorphism'
import type { CSSProperties } from 'react'
import type { PrintPageProps } from '../types'

/**
 * agi-timeline — a participatory exhibition wall ("El Año Cero").
 * ──────────────────────────────────────────────────────────────
 * A very wide editorial timeline (2026 → 2036) where visitors leave a mark in the
 * lane of the year they think AGI will arrive; over the run the lanes fill from
 * the base and the collective histogram emerges in negative, in neutral ink.
 *
 * Composition (Swiss / exhibition register, inherited from `exhibition-wall-panel`):
 * monochrome INK on clean white PAPER, with a single accent — KIT_BLUE used in exactly
 * two places that tell one story ("AGI / now"): the word «AGI» in the title, and
 * the present (2026 / HOY) origin of the line. Three horizontal bands:
 *   [ left editorial block ] · [ empty seam ] · [ 11 open lanes + horizon ]
 *
 * Authored in millimetres from the trim origin (a trim layer offset by the bleed),
 * type in points — so it reads correctly at print scale and survives any bleed.
 * Designed via the editorial-layout workflow (3 concepts → judge panel → synthesis).
 */

const PAPER = '#ffffff'
const INK = '#1a1a1a'

/* ── canvas grid (mm) — 6000 × 2500, origin top-left ───────────────────────── */
const MARGIN = 180
const LEFT_X = MARGIN // 180
const LEFT_W = 1680 // editorial block: x 180 → 1860
// SEAM: 1860 → 2100 (240 mm of pure paper, no ink)

// Timeline: 11 lanes, 2026…2036. The year header sits on TOP, on a horizon axis;
// the open lanes hang downward and fill from the axis as visitors mark them.
const TL_X0 = 2100
const AXIS_Y = 600 // top horizon line (year header above it, lanes hang below)
const BOTTOM_Y = 2340 // lanes extend down to here (open at the bottom, no rule)
const LANE_W = 290.909 // markable lane width
const GUTTER = 52 // clean paper between lanes
const PITCH = LANE_W + GUTTER // 342.909  (11·LANE_W + 10·GUTTER = 3720 → closes at x=5820)
const LANE_H = BOTTOM_Y - AXIS_Y // 1740
const YEARS = Array.from({ length: 11 }, (_, i) => 2026 + i)
const leftEdge = (i: number) => TL_X0 + i * PITCH
const center = (i: number) => leftEdge(i) + LANE_W / 2

// Three level Y's (¼, ½, ¾ down from the top axis) — capacity scale.
const LEVELS = [AXIS_Y + LANE_H / 4, AXIS_Y + LANE_H / 2, AXIS_Y + (3 * LANE_H) / 4]

// "Now" lane (2026) origin disc.
const DISC_D = 18

/* ── line weights (mm) — bumped for a 6 m wall seen at distance ─────────────── */
const W_DIVIDER = 2
const W_LANE = 1.2
const W_AFORO = 1.2
const L_AFORO = 26
const H_EJE = 5
const W_YEARTICK = 2
const H_YEARTICK = 28
const W_COUNT = 1.2
const COUNT_INK = 'rgba(26,26,26,0.16)'
const FADE_X = 5600 // axis fades 5600 → 5820 (time continues past 2036)
const TL_END = leftEdge(10) + LANE_W // 5820

export function AgiTimeline({ geo }: PrintPageProps) {
  const { mm, pt } = geo
  /** Absolute placement in mm from the trim origin. */
  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })
  const blueSeg = leftEdge(0) + LANE_W // end of the blue axis stub (under 2026)

  /* type styles */
  const kicker: CSSProperties = { fontFamily: TEXT_FONT, fontSize: pt(34), fontWeight: 600, letterSpacing: pt(1.1), textTransform: 'uppercase', color: INK }
  const titleLine: CSSProperties = { fontFamily: DISPLAY_FONT, fontSize: pt(340), fontWeight: 500, letterSpacing: pt(-5), lineHeight: 1.16, color: INK, whiteSpace: 'nowrap' }
  const para: CSSProperties = { fontFamily: TEXT_FONT, fontSize: pt(64), fontWeight: 400, lineHeight: 1.42, color: INK, margin: 0, hyphens: 'none' }
  const instr: CSSProperties = { fontFamily: TEXT_FONT, fontSize: pt(44), fontWeight: 600, lineHeight: 1.28, color: INK }

  return (
    <>
      {/* warm paper, bled to the media edge */}
      <div style={{ position: 'absolute', inset: 0, background: PAPER }} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── TIMELINE — year header on top, lanes hang below (back to front) ── */}

        {/* global capacity hairlines — quiet, behind the lanes */}
        {LEVELS.map((y) => (
          <div key={`count-${y}`} style={{ ...at(TL_X0, y - W_COUNT / 2), width: mm(TL_END - TL_X0), height: mm(W_COUNT), background: COUNT_INK }} />
        ))}

        {/* lane side hairlines — open paper columns hanging from the axis (no fill, no bottom) */}
        {YEARS.map((_, i) => {
          const l = leftEdge(i)
          const r = l + LANE_W
          return (
            <div key={`lane-${i}`}>
              <div style={{ ...at(l - W_LANE / 2, AXIS_Y), width: mm(W_LANE), height: mm(LANE_H), background: INK }} />
              <div style={{ ...at(r - W_LANE / 2, AXIS_Y), width: mm(W_LANE), height: mm(LANE_H), background: INK }} />
            </div>
          )
        })}

        {/* per-lane capacity ticks on the left edge (survive a full lane) */}
        {YEARS.map((_, i) =>
          LEVELS.map((y) => (
            <div key={`aforo-${i}-${y}`} style={{ ...at(leftEdge(i), y - W_AFORO / 2), width: mm(L_AFORO), height: mm(W_AFORO), background: INK }} />
          )),
        )}

        {/* horizon axis (top) — blue stub (2026) · ink · fade-out at the right */}
        <div style={{ ...at(TL_X0, AXIS_Y - H_EJE / 2), width: mm(blueSeg - TL_X0), height: mm(H_EJE), background: KIT_BLUE }} />
        <div style={{ ...at(blueSeg, AXIS_Y - H_EJE / 2), width: mm(FADE_X - blueSeg), height: mm(H_EJE), background: INK }} />
        <div style={{ ...at(FADE_X, AXIS_Y - H_EJE / 2), width: mm(TL_END - FADE_X), height: mm(H_EJE), background: `linear-gradient(to right, ${INK}, rgba(26,26,26,0))` }} />
        {/* origin end-cap */}
        <div style={{ ...at(TL_X0 - H_EJE / 2, AXIS_Y - 9), width: mm(H_EJE), height: mm(18), background: INK }} />

        {/* year ruler ticks rising from the axis toward the numbers */}
        {YEARS.map((_, i) => (
          <div key={`ytick-${i}`} style={{ ...at(center(i) - W_YEARTICK / 2, AXIS_Y - H_YEARTICK), width: mm(W_YEARTICK), height: mm(H_YEARTICK), background: INK }} />
        ))}

        {/* 2026 origin disc (blue) on the axis */}
        <div style={{ ...at(center(0) - DISC_D / 2, AXIS_Y - DISC_D / 2), width: mm(DISC_D), height: mm(DISC_D), borderRadius: '50%', background: KIT_BLUE }} />

        {/* year labels above the axis (bigger); HOY (2026) and "o en adelante" (2036) on the ends */}
        {YEARS.map((y, i) => (
          <div key={`year-${i}`} style={{ ...at(leftEdge(i), 410), width: mm(LANE_W), textAlign: 'center' }}>
            <div style={{ fontFamily: DISPLAY_FONT, fontSize: pt(150), fontWeight: 500, letterSpacing: pt(-1.5), lineHeight: 1, color: i === 0 ? KIT_BLUE : INK }}>{y}</div>
            {(i === 0 || i === 10) && (
              <div style={{ marginTop: mm(7), fontFamily: TEXT_FONT, fontSize: pt(32), fontWeight: 600, letterSpacing: pt(0.6), color: i === 0 ? KIT_BLUE : INK, textTransform: i === 0 ? 'uppercase' : 'none' }}>
                {i === 0 ? 'HOY' : 'o en adelante'}
              </div>
            )}
          </div>
        ))}

        {/* ── LEFT EDITORIAL BLOCK ─────────────────────────────────────────── */}

        <div style={{ ...at(LEFT_X, 380), ...kicker }}>PRONÓSTICO COLECTIVO · «OFICIOS DEL FUTURO», 2026</div>

        <div style={{ ...at(LEFT_X, 540), display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={titleLine}>¿En qué año</span>
          <span style={titleLine}>
            llegará la <span style={{ color: KIT_BLUE }}>AGI</span>?
          </span>
        </div>

        <div style={{ ...at(LEFT_X, 920), width: mm(LEFT_W), height: mm(W_DIVIDER), background: INK }} />

        <p style={{ ...at(LEFT_X, 1010), width: mm(1180), ...para }}>
          La AGI —Inteligencia Artificial General— sería una máquina capaz de igualar a una persona en
          cualquier tarea intelectual: razonar, aprender algo que nunca vio y resolver problemas para los que
          nadie la preparó. Cuándo llegará es la gran incógnita: las estimaciones de los expertos van de unos
          pocos años a varias décadas. Esta pared no zanja el debate, lo mide. Cada año es un carril vacío y
          la predicción la construyen los visitantes, marca a marca, hasta que la forma del histograma muestra
          —en vivo— cuándo cree la gente que llegará.
        </p>

        {/* instruction: ink bullet square + call to action */}
        <div style={{ ...at(LEFT_X, 1900), width: mm(LEFT_W), display: 'flex', alignItems: 'flex-start', gap: mm(60) }}>
          <div style={{ width: mm(60), height: mm(60), background: INK, flex: '0 0 auto', marginTop: mm(6) }} />
          <div style={{ ...instr, width: mm(LEFT_W - 120) }}>
            Marca el año en que crees que llegará la AGI: deja tu señal dentro de su carril. La columna
            desciende marca a marca y su largo mide los votos acumulados.
          </div>
        </div>
      </div>
    </>
  )
}
