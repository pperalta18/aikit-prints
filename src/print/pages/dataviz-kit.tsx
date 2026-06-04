import type { CSSProperties, ReactNode } from 'react'
import { BRAND, DISPLAY_FONT, TEXT_FONT, elevation, type NeoTheme } from '@/lib/neumorphism'
import type { PrintGeometry } from '../geometry'
import {
  circleAreaScale,
  formatMoney,
  scaleLinear,
  scaleLog,
  sourcesCaption,
  SCALE_NOTE_ES,
  ENLARGED_NOTE_ES,
  type AreaScale,
  type Datum,
  type Scale,
} from './dataviz-scales'

/**
 * dataviz-kit — the shared visual language of the AiKit Live **code track**:
 * honest, beautiful data-viz rendered in React/SVG (never by a text-to-image
 * model, which hallucinates axes and figures). One register — "data on dark",
 * the velocity-room palette — so #8 (model size), #11 (acceleration charts),
 * #16 (code-gen value) and the hero "sistema solar de la inversión" read as one
 * family. ([spec](../../specs/wall-graphics.md))
 *
 * The maths lives in `dataviz-scales.ts` (pure, unit-tested); this file is only
 * the presentation: a dark surface, the display/mono type scale, value circles
 * sized by `circleAreaScale` (area ∝ money), honest linear/log axes, and the two
 * non-negotiable annotations every data piece carries — the **scale note**
 * ("representado a escala", or "ampliado, no a escala" when a marble is enlarged)
 * and the **discreet source caption**. Pure inline styles (Remotion has no Tailwind).
 *
 * Sizing rule, like the rest of the print system: author in physical units via
 * `geo` (`geo.mm()` layout, `geo.pt()` type) so a piece reads at print scale at
 * any wall size and DPI.
 */

/* ── palette: the velocity-room "data on dark" register ──────────────────────── */

export const DATAVIZ = {
  /** Deep ink field (a touch warmer than pure black so relief reads). */
  bg: '#0c0e13',
  surface: '#141821',
  ink: '#eef0f7',
  inkSoft: '#c4c8d6',
  muted: '#8b8fa3',
  faint: '#5a5e70',
  hairline: 'rgba(238,240,247,0.14)',
  /** Primary data accent + the up/down semantics from the hero spec. */
  accent: BRAND.blue,
  grows: BRAND.green,
  falls: BRAND.red,
} as const

/** Relief theme matching the dark data field — feeds `elevation()` for the balls/plates. */
export const datavizTheme: NeoTheme = {
  name: 'dataviz-dark',
  surface: DATAVIZ.surface,
  gridLine: DATAVIZ.hairline,
  textMuted: DATAVIZ.muted,
  textStrong: DATAVIZ.ink,
  highlight: '#2a3140',
  shadow: 'rgba(0,0,0,0.6)',
  lightSource: 'tl',
}

/* ── type scale (sized in points via geo) ────────────────────────────────────── */

/** Big Display titling — the value words and headlines. */
export function display(geo: PrintGeometry, sizePt: number, weight = 300): CSSProperties {
  return {
    fontFamily: DISPLAY_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 0.95,
    letterSpacing: geo.pt(-sizePt * 0.02),
    color: DATAVIZ.ink,
  }
}

/** Body / axis / data labels. */
export function label(geo: PrintGeometry, sizePt: number, color: string = DATAVIZ.inkSoft, weight = 400): CSSProperties {
  return {
    fontFamily: TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.25,
    color,
  }
}

/** Uppercase tracked eyebrow / annotation register (scale note, source caption). */
export function eyebrow(geo: PrintGeometry, sizePt: number, color: string = DATAVIZ.muted): CSSProperties {
  return {
    fontFamily: TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: geo.pt(sizePt * 0.08),
    textTransform: 'uppercase',
    color,
  }
}

/* ── the dark field ──────────────────────────────────────────────────────────── */

export function DataField({ children }: { children?: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: DATAVIZ.bg, overflow: 'hidden' }}>{children}</div>
  )
}

/* ── value circle (area ∝ value) — the hero "sistema solar" ball ──────────────── */

export type ValueCircleProps = {
  geo: PrintGeometry
  scale: AreaScale
  value: number
  /** Centre in device px. */
  cx: number
  cy: number
  /** Fill — defaults to the data accent. */
  color?: string
  /** Optional name + formatted value rendered beside/over the ball. */
  name?: string
  caption?: string
  /** Name type size in points (default 14). */
  nameSizePt?: number
}

/**
 * A single neumorphic ball whose **area** encodes `value` (radius from the shared
 * `circleAreaScale`). If the scale floored it to stay visible, the ball is ringed
 * and tagged so the wall never silently misreports a magnitude.
 */
export function ValueCircle({ geo, scale, value, cx, cy, color = DATAVIZ.accent, name, caption, nameSizePt = 14 }: ValueCircleProps) {
  const r = scale.radius(value)
  const honest = scale.toScale(value)
  const plate = elevation(datavizTheme, { depth: 'raised', distance: r * 0.06, blur: r * 0.18, radius: r })
  return (
    <div style={{ position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2 }}>
      <div
        style={{
          ...plate,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          background: color,
          // Enlarged marbles get a hairline ring so the eye knows not to trust the size.
          outline: honest ? undefined : `${Math.max(1, geo.mm(0.4))}px dashed ${DATAVIZ.faint}`,
          outlineOffset: geo.mm(0.6),
        }}
      />
      {name != null && (
        <div
          style={{
            position: 'absolute',
            top: r * 2 + geo.mm(2),
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={display(geo, nameSizePt, 400)}>{name}</div>
          {caption != null && <div style={label(geo, 9, DATAVIZ.muted)}>{caption}</div>}
          {!honest && <div style={eyebrow(geo, 6.5, DATAVIZ.faint)}>{ENLARGED_NOTE_ES}</div>}
        </div>
      )}
    </div>
  )
}

/* ── honest axes ─────────────────────────────────────────────────────────────── */

export type AxisProps = {
  geo: PrintGeometry
  scale: Scale
  /** Pixel length of the perpendicular tick marks. */
  tickLength?: number
  /** Format a tick value into its label. */
  format?: (v: number) => string
  /** ~tick count hint (linear scales). */
  count?: number
  color?: string
}

/** Horizontal (x) axis: a baseline rule + nice ticks from the scale, labels below. */
export function AxisX({ geo, scale, tickLength = geo.mm(2.5), format = String, count, color = DATAVIZ.muted }: AxisProps) {
  const [x0, x1] = scale.range
  const ticks = scale.ticks(count)
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: Math.min(x0, x1), top: 0, width: Math.abs(x1 - x0), height: Math.max(1, geo.mm(0.3)), background: color }} />
      {ticks.map((t, i) => {
        const x = scale(t)
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: 0 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: Math.max(1, geo.mm(0.3)), height: tickLength, background: color }} />
            <div style={{ ...label(geo, 9, DATAVIZ.inkSoft), position: 'absolute', top: tickLength + geo.mm(1.2), left: 0, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
              {format(t)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── the two mandatory annotations ───────────────────────────────────────────── */

/** Scale note — "representado a escala" (honest) by default; override for a distorted axis. */
export function ScaleNote({ geo, note = SCALE_NOTE_ES, color = DATAVIZ.muted }: { geo: PrintGeometry; note?: string; color?: string }) {
  return <div style={eyebrow(geo, 7, color)}>{note}</div>
}

/** Discreet source caption built from the researched data points. */
export function SourceCaption({ geo, data, label: srcLabel, color = DATAVIZ.faint }: { geo: PrintGeometry; data: ReadonlyArray<Datum>; label?: string; color?: string }) {
  const text = sourcesCaption(data, srcLabel)
  if (!text) return null
  return <div style={{ ...label(geo, 8, color), letterSpacing: geo.pt(0.2) }}>{text}</div>
}

/* ── re-export the maths so a page imports one module ────────────────────────── */

export { circleAreaScale, scaleLinear, scaleLog, formatMoney, sourcesCaption, SCALE_NOTE_ES, ENLARGED_NOTE_ES }
export type { AreaScale, Scale, Datum }
