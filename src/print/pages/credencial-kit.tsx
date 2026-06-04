import type { CSSProperties } from 'react'
import { elevation, lightTheme, darkTheme, KIT_BLUE, DISPLAY_FONT, type NeoTheme } from '@/lib/neumorphism'
import { AikitLiveLogo } from '@/components/AikitLiveLogo'
import type { PrintGeometry } from '../geometry'

/**
 * credencial-kit — the shared visual language of the AiKit Live accreditation
 * cards (lanyard credentials), one editorial system in four role colourways.
 * ──────────────────────────────────────────────────────────────────────────
 * Reproduces the four Figma designs ("Economía de guerra" → STAFF · Guest ·
 * Host · Speaker). These are credentials sorted BY TYPE, not personal badges:
 * the ROLE is the hero — one big, light-weight display word anchored to the
 * bottom — and there is no holder name. The composition is dead simple and
 * premium: a flat full-bleed colour field, two staggered rows of raised
 * neumorphic "keys" bleeding off the top + sides (the keynote neumorphism
 * library, tinted per field), the centred AiKit Live lockup, then the role word.
 *
 * Field per role: STAFF = graphite (#161a20), Guest = cool grey (#f4f4fa),
 * Host + Speaker = brand blue (#0070f9). The key relief and the lockup tint
 * follow the field so each card reads as one tone across a room.
 *
 * Print-correct: the field + key texture bleed to the media edge (the card is
 * die-cut rounded and lanyard-punched; neither is printed). Everything is
 * authored in physical units via `geo` so it reads at print scale, and the
 * geometry is expressed as fractions of the trim so the family keeps the exact
 * Figma proportions at any chosen card size.
 */

/* ── roles ─────────────────────────────────────────────────────────────────── */

export type CredRole = 'staff' | 'guest' | 'host' | 'speaker'

export const ROLES: CredRole[] = ['speaker', 'host', 'staff', 'guest']

const MAGENTA = '#FF2D55'
/** Near-white ink for the role word on dark / blue fields (Figma --muted). */
const INK_LIGHT = '#f4f4fa'
/** Muted ink for the role word on the light field (Figma --muted-foreground). */
const INK_MUTED = '#6c6c89'

/* ── colourways ──────────────────────────────────────────────────────────────
 * The key relief is computed by the neumorphism engine (`elevation`) from a
 * NeoTheme + light source — NOT hand-rolled box-shadows. Each card carries a
 * theme whose `surface` IS its full-bleed field, so the keys read as plates
 * embossed straight out of the field:
 *   STAFF → darkTheme  (graphite #161a20, #333d4b lit edge, soft-black shadow)
 *   GUEST → lightTheme (cool grey #f4f4fa, white lit edge, #c9d7e8 shadow)
 *   HOST / SPEAKER → blueTheme (brand blue, lighter-blue lit edge, deep-blue shadow)
 * The lockup tint keeps one mark colour legible on each field. */

/** Brand-blue relief theme — the engine has light + dark; this is the AiKit field.
 *  Soft lit edge (the bright highlight read too "white", so it's dimmed). */
const blueTheme: NeoTheme = {
  name: 'kit-blue',
  surface: KIT_BLUE,
  gridLine: 'rgba(3,30,90,0.55)',
  textMuted: 'rgba(255,255,255,0.72)',
  textStrong: '#ffffff',
  highlight: '#2e84f4', // lit top-left edge — a gentle lighter blue (softened)
  shadow: '#0a4cba', // shaded bottom-right edge — a deeper blue
  lightSource: 'tl',
}

/** Graphite relief theme — the engine darkTheme with a dimmer (softer) lit edge. */
const graphiteTheme: NeoTheme = {
  ...darkTheme,
  highlight: '#272e39', // softened from #333d4b — the white edge was too strong
  shadow: 'rgba(0,0,0,0.42)',
}

/** Engraved "Grid" hairline on the key tray's lower edge (hard line + soft groove). */
export type Tray = { hard: string; soft: string }

export type Colorway = {
  tone: 'dark' | 'light'
  /** Relief engine theme — its `surface` is the full-bleed field. */
  theme: NeoTheme
  /** Lower-edge hairline of the key container. */
  tray: Tray
  /** Role word colour — the hero masthead. */
  ink: string
  /** The role word exactly as it reads (casing is intentional: STAFF caps). */
  word: string
  /** AiKit Live lockup tint. */
  logo: {
    tone: 'light' | 'dark'
    markColor: string
    wordmarkColor?: string
    liveColor: string
    /** Branded purple radial glow behind "Live" (on the magenta cards only). */
    glow?: boolean
  }
}

export const COLORWAYS: Record<CredRole, Colorway> = {
  // SPEAKER — the flagship. Brand blue, all-white monochrome lockup.
  speaker: {
    tone: 'dark',
    theme: blueTheme,
    tray: { hard: 'rgba(2,28,84,0.6)', soft: 'rgba(0,0,0,0.20)' },
    ink: INK_LIGHT,
    word: 'Speaker',
    logo: { tone: 'dark', markColor: '#ffffff', wordmarkColor: '#ffffff', liveColor: '#ffffff' },
  },
  // HOST — also brand blue (the on-stage hosts), matched to Speaker.
  host: {
    tone: 'dark',
    theme: blueTheme,
    tray: { hard: 'rgba(2,28,84,0.6)', soft: 'rgba(0,0,0,0.20)' },
    ink: INK_LIGHT,
    word: 'Host',
    logo: { tone: 'dark', markColor: '#ffffff', wordmarkColor: '#ffffff', liveColor: '#ffffff' },
  },
  // STAFF — operational. Graphite, blue mark + magenta "Live".
  staff: {
    tone: 'dark',
    theme: graphiteTheme,
    tray: { hard: 'rgba(54,64,79,0.55)', soft: 'rgba(0,0,0,0.5)' },
    ink: INK_LIGHT,
    word: 'STAFF',
    logo: { tone: 'dark', markColor: KIT_BLUE, liveColor: MAGENTA, glow: true },
  },
  // GUEST — general admission. Cool light grey, ink lockup, muted role word.
  guest: {
    tone: 'light',
    theme: lightTheme,
    tray: { hard: 'rgba(255,255,255,0.9)', soft: 'rgba(184,204,224,0.8)' },
    ink: INK_MUTED,
    word: 'Guest',
    logo: { tone: 'light', markColor: KIT_BLUE, liveColor: MAGENTA, glow: true },
  },
}

/* ── layout proportions (fractions of the trim, straight from the A4 Figma) ──── */

const F = {
  /** Role word font size ÷ trim width (162.042 / 595). */
  roleSize: 0.2724,
  /** Role word vertical centre ÷ trim height (calc(80% + 77.4px) on 842). */
  roleCenterY: 0.8919,
  /** Lockup top ÷ trim height (≈624 / 842). */
  lockupTopY: 0.741,
  /** Lockup width ÷ trim width (258 / 595). */
  lockupW: 0.4336,
  /** Key square side ÷ trim width (68.299 / 595). */
  key: 0.1148,
  /** Gap between keys ÷ trim width (15.522 / 595). */
  gap: 0.0261,
  /** Key corner radius ÷ trim width (18.627 / 595). */
  keyRadius: 0.0313,
  /** Relief offset ÷ KEY size (engine `distance`). */
  reliefDist: 0.085,
  /** Relief blur ÷ KEY size (engine `blur`) — generous so the lit edge stays soft. */
  reliefBlur: 0.2,
  /** Height of each key-row band ÷ trim width (103 / 595) — the Figma row pitch. */
  rowPitch: 0.1731,
} as const

/** Key widths per row, in multiples of the square key (a keyboard-like mix that
 *  bleeds off both side edges); the second row is shifted further left so the
 *  columns stagger like real keycaps. Lifted from the Figma key arrangement. */
const ROW_TOP = { widths: [1, 1, 1, 2.443, 2.719, 1], startX: -0.05 }
const ROW_BOTTOM = { widths: [1, 1, 5.183, 1, 1, 2.719], startX: -0.156 }

/* ── full-bleed field ──────────────────────────────────────────────────────── */

export function Field({ cw }: { cw: Colorway }) {
  return <div style={{ position: 'absolute', inset: 0, background: cw.theme.surface }} />
}

/* ── keyboard texture: two key-tray bands, bleeding off the top + sides ──────────
 * Each row of keys (raised neumorphic plates, lit by the card's theme via the
 * engine) sits in its own band that carries the Figma "Grid" engraved hairline on
 * its lower edge — so the keyboard shows TWO lines: one between the rows and one
 * at the foot. Each band extends past both side media edges (only the bottom line
 * shows) and clips its row at the bottom, meeting that line crisply. */

export function Keyboard({ geo, cw }: { geo: PrintGeometry; cw: Colorway }) {
  const W = geo.trimWidthPx
  const s = W * F.key
  const gap = W * F.gap
  const radius = W * F.keyRadius
  // Relief offset + blur scale with the key size (so the emboss reads the same at
  // any card size / DPI). The engine paints highlight on the lit corner, shadow opposite.
  const plate = elevation(cw.theme, { depth: 'raised', distance: s * F.reliefDist, blur: s * F.reliefBlur, radius })

  const beyond = W * 0.14 // band overhang past each media edge (hides the side lines)
  const bandLeft = -beyond
  const bandWidth = geo.mediaWidthPx + 2 * beyond
  const bandH = W * F.rowPitch // each band = one Figma key row
  const keyTop = (bandH - s) / 2 // vertically centre the key row in its band
  const band1Top = geo.bleedPx // flush with the trim top, like the Figma
  const band2Top = band1Top + bandH

  // Engraved lower hairline: a hard line + a soft groove on the band's inner bottom.
  const L = Math.max(1, geo.mm(0.2))
  const trayShadow = `inset ${-L}px ${-L}px 0 0 ${cw.tray.hard}, inset 0 ${-2 * L}px ${2.5 * L}px 0 ${cw.tray.soft}`

  const Band = ({ widths, startX, top }: { widths: number[]; startX: number; top: number }) => (
    <div
      style={{
        position: 'absolute',
        left: bandLeft,
        top,
        width: bandWidth,
        height: bandH,
        background: cw.theme.surface,
        overflow: 'hidden',
        boxShadow: trayShadow,
      }}
    >
      <div style={{ position: 'absolute', top: keyTop, left: geo.bleedPx + beyond + W * startX, display: 'flex', gap }}>
        {widths.map((m, i) => (
          <div key={i} style={{ ...plate, width: s * m, height: s, flex: '0 0 auto' }} />
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <Band widths={ROW_TOP.widths} startX={ROW_TOP.startX} top={band1Top} />
      <Band widths={ROW_BOTTOM.widths} startX={ROW_BOTTOM.startX} top={band2Top} />
    </div>
  )
}

/* ── role masthead — the hero, one fixed size on every card ─────────────────────
 * Universal Sans Display Light (the Figma "250" cut, vendored as
 * Universal-Sans-Display-250.ttf) — the thin display weight is the whole look. */

export function RoleWord({ geo, cw }: { geo: PrintGeometry; cw: Colorway }) {
  const style: CSSProperties = {
    fontFamily: DISPLAY_FONT,
    fontWeight: 250,
    fontSize: geo.trimWidthPx * F.roleSize,
    lineHeight: 0.9,
    letterSpacing: 0,
    color: cw.ink,
    whiteSpace: 'nowrap',
    textAlign: 'center',
    fontFeatureSettings: '"lnum" 1, "tnum" 1',
  }
  return <div style={style}>{cw.word}</div>
}

/* ── event lockup ────────────────────────────────────────────────────────────── */

export function EventLockup({ geo, cw }: { geo: PrintGeometry; cw: Colorway }) {
  return (
    <AikitLiveLogo
      tone={cw.logo.tone}
      markColor={cw.logo.markColor}
      wordmarkColor={cw.logo.wordmarkColor}
      liveColor={cw.logo.liveColor}
      glow={cw.logo.glow ?? false}
      height={(geo.trimWidthPx * F.lockupW) / (593 / 80)}
    />
  )
}

/** Positions, as device px from the trim origin (add `bleedPx` for the media). */
export function layout(geo: PrintGeometry) {
  return {
    centerX: geo.bleedPx + geo.trimWidthPx / 2,
    lockupTop: geo.bleedPx + geo.trimHeightPx * F.lockupTopY,
    roleCenterY: geo.bleedPx + geo.trimHeightPx * F.roleCenterY,
  }
}
