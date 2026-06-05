import type { CSSProperties } from 'react'
import { KIT_BLUE } from '@/lib/neumorphism'
import { PrintFonts, PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '@/print/printFonts'

/**
 * Indice — the exhibition **contents page** in the AiKit Live editorial voice.
 * ──────────────────────────────────────────────────────────────────────────
 * A catalogue-style index of the rooms ("salas"): each entry is a ghost number,
 * the room title in the hairline Display cut, and a one-line description —
 * stacked into a column and **separated by hairline rules** (the *filetes*), the
 * way an exhibition catalogue's table of contents reads. *Muy editorial, muy fino.*
 *
 * Grounds & accent are defined **locally** on purpose — deliberately *not* pulled
 * from `tipografia-kit`, whose `accent` is the secondary warm orange and whose
 * "paper" vocabulary has been drifting the project toward cream grounds. We never
 * use cream: the light ground is **clean white** (`#ffffff`), the dark ground a
 * neutral deep ink, and the single accent is the **brand blue** (`KIT_BLUE`), the
 * same one note of colour `signage-kit` / `agi-timeline` use. The faces come from
 * `printFonts` (the hairline 250 cut, exposed as its own family so the browser
 * can't fall back to weight 400 and kill the *muy fino* look). Sizing is in CSS px
 * with `clamp()` so the index scales gracefully in the Storybook canvas — this is a
 * screen component, not a wall print, so it is *not* sized through the museographic
 * `eventTypeScale` (that law is for physical walls).
 *
 * Composition (one disciplined accent — a short tick beside the eyebrow):
 *   eyebrow · tick                                    caption
 *   ─ Índice ──────────────────────────────────────────────  ← strong ink rule
 *   01   La energía artificial                       Sección 01
 *        La inteligencia como nueva fuente…
 *   ─────────────────────────────────────────────────────  ← hairline filete
 *   02   …
 */

export type IndiceEntry = {
  /** Room title — the protagonist of the row (hairline Display cut). */
  title: string
  /** A short, one-line description sitting under the title. */
  description?: string
  /** Discreet right-aligned locator (e.g. "Sala S2"), tracked uppercase. */
  meta?: string
}

export type IndiceProps = {
  /** Tracked uppercase locator above the title (the exhibition line). */
  eyebrow?: string
  /** The big hairline title of the contents page. */
  title?: string
  /** A quiet second line under the title. */
  subtitle?: string
  /** Small right-aligned caption in the header (e.g. the year). */
  caption?: string
  /** The rooms. Each gets a number, a title and an optional description. */
  entries?: IndiceEntry[]
  /** White (light) or ink (dark) ground — never cream. */
  theme?: 'light' | 'dark'
  /** The single disciplined accent (the header tick). Defaults to the brand blue (`KIT_BLUE`). */
  accent?: string
  /** First room number. Default 1. */
  startIndex?: number
  /** Zero-pad the numbers to this many digits. Default 2 → "01". */
  padDigits?: number
}

/** The «Economía de guerra · Oficios del futuro» room itinerary, as a default. */
const DEFAULT_ENTRIES: IndiceEntry[] = [
  {
    title: 'La energía artificial',
    description:
      'La inteligencia como nueva fuente de energía. Dos siglos de progreso medido en vatios; este es el siguiente término de la serie.',
    meta: 'Sección 01',
  },
  {
    title: 'Introducción a la inteligencia artificial',
    description: 'Qué es, de dónde viene y por qué justo ahora. El umbral del progreso, contado sin jerga.',
    meta: 'Sala S2',
  },
  {
    title: 'La velocidad de escala',
    description: 'Cuando el coste marginal tiende a cero, lo escaso se vuelve abundante —y ya pasó antes.',
    meta: 'Sala S3',
  },
  {
    title: 'El telar de la inteligencia',
    description: 'De los oficios manuales al criterio delegado: qué se automatiza y qué queda, por fin, en manos humanas.',
    meta: 'Sala S4',
  },
  {
    title: 'La Naranja Mecánica',
    description: 'Cada pieza del juego ya existe fuera de él. Lo que parecía ficción, hoy es inventario.',
    meta: 'Sala S5',
  },
  {
    title: 'Cóctel de cierre',
    description: 'Conversación, networking y una última pregunta abierta para el camino de vuelta.',
    meta: 'Sala S6',
  },
]

/* ── grounds: clean white · deep ink (neutral — never cream) ───────────────── */

type Palette = {
  bg: string
  ink: string
  inkSoft: string
  muted: string
  faint: string
  hairline: string
}

/** Light register — clean white ground, neutral near-black ink. */
const LIGHT: Palette = {
  bg: '#ffffff',
  ink: '#141414',
  inkSoft: '#3b3b3b',
  muted: '#8a8a8a',
  faint: '#b6b6b6',
  hairline: 'rgba(20,20,20,0.16)',
}

/** Dark register — deep ink ground, neutral (cool) whites, no warm tint. */
const DARK: Palette = {
  bg: '#0c0e13',
  ink: '#f4f5f7',
  inkSoft: '#c6c8cf',
  muted: '#888b95',
  faint: '#565a64',
  hairline: 'rgba(244,245,247,0.16)',
}

const DEFAULTS = {
  eyebrow: 'Economía de guerra · Oficios del futuro',
  title: 'Índice',
  subtitle: 'Recorrido por las salas',
  caption: '2026',
  theme: 'light' as const,
  startIndex: 1,
  padDigits: 2,
}

export function Indice({
  eyebrow = DEFAULTS.eyebrow,
  title = DEFAULTS.title,
  subtitle = DEFAULTS.subtitle,
  caption = DEFAULTS.caption,
  entries = DEFAULT_ENTRIES,
  theme = DEFAULTS.theme,
  accent,
  startIndex = DEFAULTS.startIndex,
  padDigits = DEFAULTS.padDigits,
}: IndiceProps) {
  const pal: Palette = theme === 'dark' ? DARK : LIGHT
  const tick = accent ?? KIT_BLUE

  /* ── type styles (px, clamped to the canvas) ───────────────────────────── */
  const locator: CSSProperties = {
    fontFamily: PRINT_TEXT_FONT,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    lineHeight: 1.2,
  }
  const bigTitle: CSSProperties = {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: 'clamp(48px, 7vw, 88px)',
    fontWeight: 400,
    lineHeight: 0.96,
    letterSpacing: '-0.025em',
    color: pal.ink,
    margin: 0,
  }
  const subtitleStyle: CSSProperties = {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: 'clamp(17px, 2vw, 22px)',
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
    color: pal.muted,
    margin: '14px 0 0',
  }
  const numberStyle: CSSProperties = {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: 'clamp(32px, 4.4vw, 54px)',
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: '-0.02em',
    color: pal.faint,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 'clamp(52px, 7vw, 84px)',
    flex: '0 0 auto',
  }
  const rowTitle: CSSProperties = {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: 'clamp(22px, 2.8vw, 33px)',
    fontWeight: 400,
    lineHeight: 1.04,
    letterSpacing: '-0.015em',
    color: pal.ink,
    margin: 0,
  }
  const rowDesc: CSSProperties = {
    fontFamily: PRINT_TEXT_FONT,
    fontSize: 'clamp(13px, 1.4vw, 15.5px)',
    fontWeight: 400,
    lineHeight: 1.5,
    color: pal.inkSoft,
    margin: '12px 0 0',
    maxWidth: '54ch',
  }
  const rowMeta: CSSProperties = {
    ...locator,
    fontSize: 11.5,
    letterSpacing: 1.4,
    color: pal.muted,
    whiteSpace: 'nowrap',
    textAlign: 'right',
  }

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: pal.bg,
        color: pal.ink,
        fontFamily: PRINT_TEXT_FONT,
        WebkitFontSmoothing: 'antialiased',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: 'clamp(48px, 7vw, 112px) clamp(28px, 6vw, 96px)',
        boxSizing: 'border-box',
      }}
    >
      {/* the editorial faces (hairline 250 cut) — loaded once, host-agnostic */}
      <PrintFonts />

      <div style={{ width: '100%', maxWidth: 940 }}>
        {/* ── header ─────────────────────────────────────────────────────── */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 24,
          }}
        >
          <span style={{ ...locator, color: pal.muted, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 9, height: 9, background: tick, flex: '0 0 auto' }} />
            {eyebrow}
          </span>
          {caption && <span style={{ ...locator, color: pal.faint, whiteSpace: 'nowrap' }}>{caption}</span>}
        </header>

        <h1 style={{ ...bigTitle, marginTop: 'clamp(20px, 3vw, 34px)' }}>{title}</h1>
        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}

        {/* strong ink rule — anchors the top of the list (heavier than the filetes) */}
        <div
          style={{
            height: 1.5,
            background: pal.ink,
            opacity: theme === 'dark' ? 0.5 : 0.85,
            marginTop: 'clamp(28px, 4vw, 44px)',
          }}
        />

        {/* ── the rooms ──────────────────────────────────────────────────── */}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {entries.map((e, i) => {
            const n = String(startIndex + i).padStart(padDigits, '0')
            return (
              <li
                key={`${n}-${e.title}`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'clamp(24px, 4vw, 56px)',
                  padding: 'clamp(22px, 3vw, 34px) 0',
                  borderBottom: `1px solid ${pal.hairline}`,
                }}
              >
                <span style={numberStyle}>{n}</span>

                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <h2 style={rowTitle}>{e.title}</h2>
                  {e.description && <p style={rowDesc}>{e.description}</p>}
                </div>

                {e.meta && <span style={rowMeta}>{e.meta}</span>}
              </li>
            )
          })}
        </ol>

        {/* ── footer: the discreet lockup + count ────────────────────────── */}
        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 24,
            marginTop: 'clamp(26px, 4vw, 42px)',
          }}
        >
          <span style={{ ...locator, color: pal.muted, letterSpacing: 1.8 }}>AiKit Live</span>
          <span style={{ ...locator, color: pal.faint, whiteSpace: 'nowrap' }}>
            {entries.length} {entries.length === 1 ? 'sala' : 'salas'}
          </span>
        </footer>
      </div>
    </section>
  )
}
