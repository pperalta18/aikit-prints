import type { CSSProperties, ReactNode } from 'react'
import { BRAND, DISPLAY_FONT, TEXT_FONT } from '@/lib/neumorphism'
import type { PrintGeometry } from '../geometry'
import { Arrow, type ArrowDir } from './signage-kit'

/**
 * wayfinding-kit — the shared visual language of the AiKit Live **typographic /
 * wayfinding wall graphics** (code track, no data): #10 the S1→S2 threshold, and
 * the future Umbral S2→S3 title-band (#3) and micro-acento (#14).
 * ──────────────────────────────────────────────────────────────────────────
 * One register — rationalist / brutalist, very refined: a deep ink field from the
 * same family as the velocity-room "data on dark" palette (`dataviz-kit`) so the
 * whole expo reads as one system, a warm accent that carries the S1 combustion
 * heat across the threshold into the demystifying S2, hairline rules, lots of air,
 * and **typography as the protagonist**. No florituras, no gradients, no stock.
 *
 * The *honest* part — that every text level clears the museographic legibility
 * floor for the wall's reading distance (≈1 cm cap-height per 3 m) — is computed
 * by the pure, unit-tested `wayfinding.ts`. This file is only the presentation.
 *
 * Sizing rule, like the rest of the print system: author in physical units via
 * `geo` (`geo.mm()` layout, `geo.pt()` type) so a piece reads at print scale at
 * any wall size and DPI. The `Arrow` primitive is reused from `signage-kit` so the
 * wayfinding arrow speaks the same thin-line vocabulary as the venue signage.
 */

/* ── palette: the threshold register (deep ink, warm accent) ──────────────────── */

export const WAYFIND = {
  /** Deep ink field, one family with the velocity room so the expo reads as a set. */
  bg: '#0c0e13',
  /** Warm white — carries the S1 combustion warmth rather than a clinical white. */
  ink: '#f3efe9',
  inkSoft: '#cdc6ba',
  muted: '#8d8678',
  faint: '#5e584c',
  hairline: 'rgba(243,239,233,0.16)',
  /** The single disciplined accent: combustion warmth handing off to clarity. */
  accent: BRAND.orange,
} as const

/* ── type scale (sized in points via geo) ─────────────────────────────────────── */

/** The protagonist destination word — big, light Display titling. */
export function wayDisplay(geo: PrintGeometry, sizePt: number, weight = 300): CSSProperties {
  return {
    fontFamily: DISPLAY_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 0.92,
    letterSpacing: geo.pt(-sizePt * 0.02),
    color: WAYFIND.ink,
  }
}

/** Uppercase, tracked eyebrow / locator / lockup. */
export function wayEyebrow(geo: PrintGeometry, sizePt: number, color: string = WAYFIND.muted): CSSProperties {
  return {
    fontFamily: TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: 600,
    letterSpacing: geo.pt(sizePt * 0.12),
    textTransform: 'uppercase',
    lineHeight: 1.1,
    color,
  }
}

/** Body / subtitle text (the room thesis under the destination word). */
export function wayLabel(geo: PrintGeometry, sizePt: number, color: string = WAYFIND.inkSoft, weight = 400): CSSProperties {
  return {
    fontFamily: TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.2,
    color,
  }
}

/* ── the ink field ────────────────────────────────────────────────────────────── */

/** Full-bleed deep-ink field with a faint warm vignette so the dark reads as depth. */
export function WallField({ children }: { children?: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: WAYFIND.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(120% 140% at 16% 38%, #16120c 0%, ${WAYFIND.bg} 58%, #050608 100%)`,
        }}
      />
      {children}
    </div>
  )
}

/* ── full-width hairline rule (mm-thick so it reads at distance) ──────────────── */

export function Hairline({ geo, color = WAYFIND.hairline, w = 1.2, style }: { geo: PrintGeometry; color?: string; w?: number; style?: CSSProperties }) {
  return <div style={{ height: Math.max(1, geo.mm(w)), background: color, width: '100%', ...style }} />
}

/* ── discreet lockup (the only brand presence on a wayfinding wall) ───────────── */

export function Lockup({ geo, sizePt, label = 'AiKit Live', color = WAYFIND.muted }: { geo: PrintGeometry; sizePt: number; label?: string; color?: string }) {
  return <span style={{ ...wayEyebrow(geo, sizePt, color), letterSpacing: geo.pt(sizePt * 0.14) }}>{label}</span>
}

/* ── re-export the arrow vocabulary so a page imports one module ──────────────── */

export { Arrow }
export type { ArrowDir }
