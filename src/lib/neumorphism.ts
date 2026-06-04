import type { CSSProperties } from 'react'

/**
 * Neumorphism engine
 * ──────────────────
 * Generalised from the AiKit keynote neumorphism library. Instead of fixed
 * box-shadow strings, shadows are *computed* from a theme + a light source, so
 * the same surface can be re-lit (tl / tr / bl / br) — or animated — at runtime.
 *
 *   elevation(theme, { depth: 'raised' })   →  a plate that pops out
 *   elevation(theme, { depth: 'recessed' }) →  a plate carved in
 *
 * Two themes ship by default: `lightTheme` (the Figma "06 Grid" light mode,
 * surface #f4f4fa) and `darkTheme` (the keynote dark slides, surface #161a20).
 */

export const KIT_BLUE = '#0070f9'

/**
 * Secondary brand palette (from the "Economía de guerra" Figma library).
 * Not primaries — use sparingly for accents: status, the hang-up / window
 * buttons, multi-series charts, etc. Blue stays the primary accent (KIT_BLUE).
 */
export const BRAND = {
  blue: KIT_BLUE,
  red: '#ff4d40',
  orange: '#ffa322',
  yellow: '#ffcf22',
  green: '#2ada56',
  teal: '#16b3cf',
  purple: '#5856d6',
  violet: '#b84fed',
  pink: '#ff2d55',
} as const

export type BrandColor = keyof typeof BRAND

export type LightSource = 'tl' | 'tr' | 'bl' | 'br'

export type NeoTheme = {
  name: string
  /** Base colour of every surface (page + plates). */
  surface: string
  /** Faint hairline drawn between grid cells. */
  gridLine: string
  textMuted: string
  textStrong: string
  /** Colour of the lit edge of a raised plate. */
  highlight: string
  /** Colour of the shaded edge of a raised plate. */
  shadow: string
  /** Where the light comes from. Flips every computed shadow. */
  lightSource: LightSource
  /**
   * Relief strength — a multiplier on every computed shadow's distance + blur.
   * 1 = the designed look, <1 flatter, >1 more pronounced. Default 1.
   */
  intensity?: number
}

export const lightTheme: NeoTheme = {
  name: 'light',
  surface: '#f4f4fa',
  gridLine: 'rgba(184, 204, 224, 0.45)',
  textMuted: '#6c6c89',
  textStrong: '#1e1e20',
  highlight: '#ffffff',
  shadow: '#c9d7e8',
  lightSource: 'tl',
}

export const darkTheme: NeoTheme = {
  name: 'dark',
  surface: '#161a20',
  gridLine: 'rgba(54, 64, 79, 0.6)',
  textMuted: '#9a9ab8',
  textStrong: '#eef0f7',
  // Near-black surface: relief leans on a lit top-left edge + a soft, semi-
  // transparent shadow (a hard black drop shadow kills the 3D feel).
  highlight: '#333d4b',
  shadow: 'rgba(0, 0, 0, 0.5)',
  lightSource: 'tl',
}

export const THEMES: Record<string, NeoTheme> = {
  light: lightTheme,
  dark: darkTheme,
}

/** Unit vector pointing toward the light (where the highlight sits). */
function lightVector(ls: LightSource): [number, number] {
  switch (ls) {
    case 'tl':
      return [-1, -1]
    case 'tr':
      return [1, -1]
    case 'bl':
      return [-1, 1]
    case 'br':
      return [1, 1]
  }
}

export type Depth = 'raised' | 'recessed' | 'flat'

export type ElevationOpts = {
  depth?: Depth
  /** Shadow offset in px (the bigger, the more it floats / sinks). */
  distance?: number
  blur?: number
  radius?: number
}

/**
 * Compute the surface styles (background + radius + box-shadow) for a plate.
 * Highlight always sits on the light-facing corner; shadow on the opposite one.
 */
export function elevation(theme: NeoTheme, opts: ElevationOpts = {}): CSSProperties {
  const { depth = 'raised', distance = 8, blur = 16, radius = 24 } = opts
  const [hx, hy] = lightVector(theme.lightSource)
  // Scale distance + blur by the theme's relief strength (default 1).
  const k = theme.intensity ?? 1
  const d = distance * k
  const b = blur * k

  if (depth === 'flat') {
    return { backgroundColor: theme.surface, borderRadius: radius, boxShadow: 'none' }
  }

  const litOffset = `${hx * d}px ${hy * d}px ${b}px`
  const darkOffset = `${-hx * d}px ${-hy * d}px ${b}px`

  // Raised: highlight on the lit corner, shadow opposite — the plate pops out.
  // Recessed (pressed): the inverse, cast inward — the near rim is shaded and
  // the far rim catches light, reading as a hole carved into the surface.
  const boxShadow =
    depth === 'recessed'
      ? `inset ${litOffset} ${theme.shadow}, inset ${darkOffset} ${theme.highlight}`
      : `${litOffset} ${theme.highlight}, ${darkOffset} ${theme.shadow}`

  return { backgroundColor: theme.surface, borderRadius: radius, boxShadow }
}

/** Default grid cell edge (px) — matches the Figma 128px module. */
export const CELL = 128

/** How far a raised plate is inset inside its cell, leaving the gridline visible. */
export const PLATE_INSET = 22

export const DISPLAY_FONT = "'Universal Sans Display', ui-sans-serif, system-ui, sans-serif"
export const TEXT_FONT = "'Universal Sans Text', ui-sans-serif, system-ui, sans-serif"
