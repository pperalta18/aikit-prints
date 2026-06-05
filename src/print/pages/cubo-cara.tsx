import type { CSSProperties } from 'react'
import type { PrintPageProps } from '../types'
import { type TipoPalette, tipoH1 } from './tipografia-kit'
import { eventTypeScale } from './tipografia'
import { PrintFonts } from '../printFonts'

/**
 * cubo-cara — an editorial face of the **central exhibition cube in S2** (Intro IA).
 * ──────────────────────────────────────────────────────────────────────────────
 * The cube has four sections (01–04), one per wall — and **both faces of each wall
 * carry the same section's `cubo-cara`** (22-N+22-S = 03 · 23-N+23-S = 01 · 24-E+24-W
 * = 04 · 25-E+25-W = 02), so the editorial reads from inside *and* outside the cube
 * (which face is "exterior" is ambiguous in this layout, so we paint both). Each face
 * has a screen mounted in front, so the printed graphic only needs to live in the
 * **top band**
 * of the wall — above the screen. Each face is a flat brand-coloured ground carrying
 * a single small, hairline **editorial numeral** (01–04) in the **top-left corner**
 * — no title, eyebrow or rule — in the event type voice (`eventTypeScale` +
 * `tipografia-kit`'s hairline Display cut).
 *
 * Because each face is painted a different colour, the type colour is chosen for
 * **contrast against that ground**: `inkMode: 'auto'` picks pure white or near-black
 * by whichever wins the WCAG contrast ratio; `'light'` / `'dark'` force it. Authored
 * in `geo` units so it reads at print scale at any DPI; flat vivid colour → author
 * the doc with `color.renderIntent: 'relative'` (not `perceptual`).
 */

type InkMode = 'auto' | 'light' | 'dark'

type Props = {
  /** The editorial numeral, e.g. "01". */
  index?: string
  /** The paint colour of this face (any solid CSS hex, e.g. a `BRAND` colour). */
  ground?: string
  /** Real reading distance to the cube face (m) — drives the museographic sizing. */
  readingDistanceM?: number
  /** White ('light') / near-black ('dark') type, or 'auto' by contrast. Default auto. */
  inkMode?: InkMode
  /** Numeral cap-height as a fraction of the trim height. Default 0.05. */
  numberCapFraction?: number
}

const DEFAULTS: Required<Props> = {
  index: '01',
  ground: '#0070f9',
  readingDistanceM: 3.5,
  inkMode: 'auto',
  numberCapFraction: 0.05,
}

const PAPER = '#ffffff'
const NEAR_BLACK = '#141414'

/** Parse `#rgb` / `#rrggbb` → [r,g,b] 0–255, or null if not a hex colour. */
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1]
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

/** WCAG relative luminance of an sRGB colour. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

const contrast = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

/** Resolve the type colour: forced by `inkMode`, else the higher-contrast of paper/near-black. */
function resolveInk(ground: string, inkMode: InkMode): 'light' | 'dark' {
  if (inkMode === 'light') return 'light'
  if (inkMode === 'dark') return 'dark'
  const rgb = parseHex(ground)
  if (!rgb) return 'dark'
  const lg = relativeLuminance(rgb)
  const cLight = contrast(relativeLuminance([255, 255, 255]), lg)
  const cDark = contrast(relativeLuminance([20, 20, 20]), lg)
  return cLight >= cDark ? 'light' : 'dark'
}

/** A minimal `TipoPalette` over a painted ground, with type in the chosen contrast ink. */
function facePalette(ground: string, ink: 'light' | 'dark'): TipoPalette {
  const base = ink === 'light' ? '255,255,255' : '20,20,20'
  const inkColor = ink === 'light' ? PAPER : NEAR_BLACK
  return {
    bg: ground,
    field: ground,
    ink: inkColor,
    inkSoft: inkColor,
    muted: `rgba(${base},${ink === 'light' ? 0.74 : 0.62})`,
    faint: `rgba(${base},${ink === 'light' ? 0.55 : 0.42})`,
    hairline: `rgba(${base},${ink === 'light' ? 0.34 : 0.22})`,
    accent: inkColor,
  }
}

export function CuboCara({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props
  const index = p.index ?? DEFAULTS.index
  const ground = p.ground ?? DEFAULTS.ground
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : DEFAULTS.readingDistanceM
  const inkMode = p.inkMode ?? DEFAULTS.inkMode
  const numberCapFraction = typeof p.numberCapFraction === 'number' ? p.numberCapFraction : DEFAULTS.numberCapFraction

  const ink = resolveInk(ground, inkMode)
  const pal = facePalette(ground, ink)

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const marginX = W * 0.06

  // The lone numeral is sized as H1 by wall proportion (`numberCapFraction`).
  const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM, h1CapFraction: numberCapFraction })

  const numberStyle: CSSProperties = { ...tipoH1(geo, scale.h1Pt, pal), lineHeight: 0.84, whiteSpace: 'nowrap' }

  return (
    <>
      <PrintFonts />
      {/* the paint — full bleed (covers trim + bleed) */}
      <div style={{ position: 'absolute', inset: 0, background: ground }} />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* a single small editorial numeral, anchored to the top-left corner so the
            screen mounted in front (lower wall) stays clear */}
        <div style={{ ...numberStyle, position: 'absolute', left: mm(marginX), top: mm(H * 0.06) }}>{index}</div>
      </div>
    </>
  )
}
