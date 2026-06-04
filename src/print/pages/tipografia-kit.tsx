import type { CSSProperties, ReactNode } from 'react'
import { BRAND } from '@/lib/neumorphism'
import type { PrintGeometry } from '../geometry'
import type { PrintTheme } from '../types'
import { PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'

/**
 * tipografia-kit — the presentation layer of the AiKit Live **event typographic
 * system** (the type voice every wall's words can borrow).
 * ──────────────────────────────────────────────────────────────────────────
 * One register, two grounds: an editorial / Swiss-modernist voice — Universal Sans
 * Display (hairline 250 cut) as the protagonist titling, Universal Sans Text for
 * body, one disciplined warm accent, hairline rules and a lot of air. *Muy fino,
 * muy simple.* It renders on **paper** (light) or **ink** (dark) chosen by the
 * doc's `theme`, so the same composition flips ground with a one-line doc change
 * and the dark ground stays one family with the velocity-room walls.
 *
 * The *honest* part — that every level clears the museographic legibility floor for
 * the wall's reading distance — is computed by the pure, unit-tested `tipografia.ts`.
 * This file is only the look. Sizing rule, like the rest of the print system:
 * author in physical units via `geo` (`geo.mm()` layout, `geo.pt()` type) so a piece
 * reads at print scale at any wall size and DPI. Pure inline styles (Remotion has
 * no Tailwind).
 */

/* ── palette: paper (light) · ink (dark) ──────────────────────────────────────── */

export type TipoPalette = {
  /** Flat ground colour. */
  bg: string
  /** A very subtle full-bleed wash over `bg` so the ground reads as a surface, not a fill. */
  field: string
  /** Primary type colour (headings). */
  ink: string
  /** Secondary type colour (body, decks). */
  inkSoft: string
  /** Muted labels / lockup. */
  muted: string
  /** Faintest — venue line, etc. */
  faint: string
  /** Hairline rule colour. */
  hairline: string
  /** The single disciplined accent. */
  accent: string
}

/** Light register — clean white, neutral near-black ink. The bridge wall's default. */
export const TIPO_LIGHT: TipoPalette = {
  bg: '#ffffff',
  field: '#ffffff',
  ink: '#141414',
  inkSoft: '#3b3b3b',
  muted: '#8a8a8a',
  faint: '#b6b6b6',
  hairline: 'rgba(20,20,20,0.18)',
  accent: BRAND.orange,
}

/** Dark register — deep ink, warm white. One family with the velocity-room walls. */
export const TIPO_DARK: TipoPalette = {
  bg: '#0c0e13',
  field: 'radial-gradient(120% 150% at 16% 30%, #16120c 0%, #0c0e13 58%, #050608 100%)',
  ink: '#f3efe9',
  inkSoft: '#cdc6ba',
  muted: '#8d8678',
  faint: '#5e584c',
  hairline: 'rgba(243,239,233,0.16)',
  accent: BRAND.orange,
}

export function tipoPalette(theme: PrintTheme): TipoPalette {
  return theme === 'dark' ? TIPO_DARK : TIPO_LIGHT
}

/* ── the four headings + body + eyebrow (sized in points via geo) ────────────── */

/** H1 — the protagonist statement. The hairline Display cut, tight leading. */
export function tipoH1(geo: PrintGeometry, sizePt: number, pal: TipoPalette, weight = 400): CSSProperties {
  return {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 0.94,
    letterSpacing: geo.pt(-sizePt * 0.022),
    color: pal.ink,
    margin: 0,
  }
}

/** H2 — the secondary line. Same hairline register, a step down in size. */
export function tipoH2(geo: PrintGeometry, sizePt: number, pal: TipoPalette, weight = 400): CSSProperties {
  return {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.0,
    letterSpacing: geo.pt(-sizePt * 0.018),
    color: pal.ink,
    margin: 0,
  }
}

/** H3 — the tertiary deck. Same hairline; a softer colour so it reads as support. */
export function tipoH3(geo: PrintGeometry, sizePt: number, pal: TipoPalette, weight = 400): CSSProperties {
  return {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.06,
    letterSpacing: geo.pt(-sizePt * 0.01),
    color: pal.inkSoft,
    margin: 0,
  }
}

/** H4 — the smallest heading. Quietest colour; bridges the headings down to body. */
export function tipoH4(geo: PrintGeometry, sizePt: number, pal: TipoPalette, weight = 400): CSSProperties {
  return {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.12,
    letterSpacing: geo.pt(-sizePt * 0.005),
    color: pal.muted,
    margin: 0,
  }
}

/** Body — paragraph snippets. Text face, generous leading (≈1.5, museographic). */
export function tipoBody(geo: PrintGeometry, sizePt: number, pal: TipoPalette, weight = 400): CSSProperties {
  return {
    fontFamily: PRINT_TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.5,
    color: pal.inkSoft,
    margin: 0,
  }
}

/** Eyebrow / locator — uppercase, tracked, small. */
export function tipoEyebrow(geo: PrintGeometry, sizePt: number, color: string, weight = 600): CSSProperties {
  return {
    fontFamily: PRINT_TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    letterSpacing: geo.pt(sizePt * 0.14),
    textTransform: 'uppercase',
    lineHeight: 1.1,
    color,
  }
}

/* ── the ground ───────────────────────────────────────────────────────────────── */

/** Full-bleed ground with a faint wash so the paper / ink reads as a surface. */
export function TipoField({ pal, children }: { pal: TipoPalette; children?: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: pal.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: pal.field }} />
      {children}
    </div>
  )
}

/* ── full-width hairline rule (mm-thick so it reads at distance) ──────────────── */

export function Rule({
  geo,
  pal,
  color,
  w = 1.4,
  style,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  color?: string
  /** Rule thickness in mm. */
  w?: number
  style?: CSSProperties
}) {
  return <div style={{ height: Math.max(1, geo.mm(w)), background: color ?? pal.hairline, width: '100%', ...style }} />
}

/* ── discreet lockup (the only brand presence) ───────────────────────────────── */

export function Lockup({
  geo,
  sizePt,
  pal,
  label = 'AiKit Live',
}: {
  geo: PrintGeometry
  sizePt: number
  pal: TipoPalette
  label?: string
}) {
  return <span style={{ ...tipoEyebrow(geo, sizePt, pal.muted), letterSpacing: geo.pt(sizePt * 0.16) }}>{label}</span>
}
