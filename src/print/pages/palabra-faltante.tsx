import type { CSSProperties } from 'react'
import { KIT_BLUE } from '@/lib/neumorphism'
import type { PrintPageProps } from '../types'
import { PrintFonts, PRINT_TEXT_FONT } from '../printFonts'
import { tipoPalette } from './tipografia-kit'
import { layoutSea, type Hero, type PlacedPhrase, type Phrase } from './palabra-faltante'

/**
 * palabra-faltante — «La última palabra» (10-N-1, S1→S2).
 * ──────────────────────────────────────────────────────────────────────────
 * A wall flooded edge-to-edge with phrases, each missing its final word, shown as a
 * blank rule. To fill any one of them you have to *reason* — model the physics, hold
 * the nested beliefs, do the arithmetic, get the joke — so the wall is a felt proof
 * of its own thesis: predicting the next word is not autocomplete, it is
 * intelligence. Depth is carried by **colour** (foreground gems in ink, a murmur of
 * fainter phrases receding into grey), not by shouting size; one single phrase — the
 * thesis itself — keeps its blank in KIT_BLUE, the one disciplined accent the visitor
 * eventually finds in the sea.
 *
 * The honest parts (reading-distance cap-heights, the deterministic packing) live in
 * the pure `palabra-faltante.ts`; this file is only the look. Authored in `geo` units
 * so it reads at print scale at any wall size and DPI; ground follows `doc.theme`.
 */

type Props = {
  /** Real reading distance to the wall (m) — anchors the museographic type sizing. */
  readingDistanceM?: number
  /** Reproducibility seed for the sea. */
  seed?: number
  /** Override the phrase pool (otherwise the built-in corpus). */
  phrases?: Phrase[]
  /** Side margins as a fraction of width. */
  marginXFraction?: number
  /** Top/bottom margins as a fraction of height. */
  marginYFraction?: number
  /** Cap-height of each size tier as a multiple of the legibility floor. */
  tierCapMultiples?: number[]
}

/** The phrase whose blank carries the single KIT_BLUE accent — the wall's thesis. */
const ACCENT_TEXT = 'Para acertar esta última palabra hace falta algo más que memoria: hace falta'

const DEFAULTS = {
  readingDistanceM: 2.6,
  seed: 7,
  marginXFraction: 0.022,
  marginYFraction: 0.035,
}

/** depth 0 (foreground) … 1 (haze) → a neutral grey on the chosen ground. */
function depthToInk(depth: number, theme: 'light' | 'dark'): string {
  const d = Math.max(0, Math.min(1, depth))
  // light: near-black → light grey; dark: near-white → dim grey.
  const v = theme === 'dark' ? Math.round(236 - (d / 0.92) * 168) : Math.round(20 + (d / 0.92) * 184)
  const c = Math.max(0, Math.min(255, v))
  const h = c.toString(16).padStart(2, '0')
  return `#${h}${h}${h}`
}

function PhraseLine({ p, geo, theme }: { p: PlacedPhrase; geo: PrintPageProps['geo']; theme: 'light' | 'dark' }) {
  const { mm, pt } = geo
  const ink = p.accent ? (theme === 'dark' ? '#f4f4fa' : '#141414') : depthToInk(p.depth, theme)
  const ruleColor = p.accent ? KIT_BLUE : ink
  const ruleThickMm = Math.max(p.accent ? 1.5 : 0.6, p.capMm * (p.accent ? 0.17 : 0.07))

  const line: CSSProperties = {
    position: 'absolute',
    left: mm(p.xMm),
    top: mm(p.yMm),
    fontFamily: PRINT_TEXT_FONT,
    fontSize: pt(p.fontPt),
    lineHeight: 1,
    whiteSpace: 'nowrap',
    color: ink,
    // a hair of tracking opens the small greys so they don't clot
    letterSpacing: pt(p.fontPt * 0.004),
  }
  const blank: CSSProperties = {
    display: 'inline-block',
    width: mm(p.blankWidthMm),
    height: 0,
    marginLeft: mm(p.blankGapMm),
    borderBottom: `${Math.max(1, mm(ruleThickMm))}px solid ${ruleColor}`,
    verticalAlign: '-0.04em',
  }
  return (
    <div style={line}>
      <span>{p.text}</span>
      <span style={blank} />
    </div>
  )
}

/**
 * The thesis, lifted out of the sea and rendered dead-centre, large: «destacada, en
 * el centro, en grande». It sits in a soft clearing (a ground-coloured halo that lets
 * the sea recede around it) and keeps the wall's one disciplined KIT_BLUE accent in
 * its blank. Each wrapped line is its own flex item (never a wrapped block) so the
 * live 3D texture doesn't overlap the lines — see live-texture-multiline-overlap.
 */
function HeroBlock({ hero, geo, theme, bg }: { hero: Hero; geo: PrintPageProps['geo']; theme: 'light' | 'dark'; bg: string }) {
  const { mm, pt } = geo
  const ink = theme === 'dark' ? '#f4f4fa' : '#141414'
  const ruleThickMm = Math.max(2.5, hero.capMm * 0.13)
  const padX = hero.emMm * 2.2
  const padY = hero.emMm * 1.4
  const feather = hero.emMm * 3.6

  const clearing: CSSProperties = {
    position: 'absolute',
    left: mm(hero.centerXMm),
    top: mm(hero.centerYMm),
    transform: 'translate(-50%, -50%)',
    width: mm(hero.box.wMm + padX * 2),
    height: mm(hero.box.hMm + padY * 2),
    background: bg,
    borderRadius: mm(hero.emMm),
    // a wide, same-colour halo feathers the clearing into the surrounding sea
    boxShadow: `0 0 ${mm(feather)}px ${mm(feather)}px ${bg}`,
  }
  const stack: CSSProperties = {
    position: 'absolute',
    left: mm(hero.centerXMm),
    top: mm(hero.centerYMm),
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
    fontFamily: PRINT_TEXT_FONT,
    fontSize: pt(hero.fontPt),
    lineHeight: hero.lineHeightMm / hero.emMm,
    color: ink,
    letterSpacing: pt(hero.fontPt * 0.002),
  }
  const blank: CSSProperties = {
    display: 'inline-block',
    width: mm(hero.blankWidthMm),
    height: 0,
    marginLeft: mm(hero.blankGapMm),
    borderBottom: `${Math.max(2, mm(ruleThickMm))}px solid ${KIT_BLUE}`,
    verticalAlign: '-0.04em',
  }
  return (
    <>
      <div style={clearing} />
      <div style={stack}>
        {hero.lines.map((ln, i) => (
          <div key={i} style={{ whiteSpace: 'nowrap' }}>
            {ln}
            {i === hero.lines.length - 1 ? <span style={blank} /> : null}
          </div>
        ))}
      </div>
    </>
  )
}

export function PalabraFaltante({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const theme = doc.theme
  const pal = tipoPalette(theme)

  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : DEFAULTS.readingDistanceM
  const seed = typeof p.seed === 'number' ? p.seed : DEFAULTS.seed

  const sea = layoutSea({
    trimWidthMm: geo.dims.trimWidthMm,
    trimHeightMm: geo.dims.trimHeightMm,
    readingDistanceM,
    seed,
    phrases: Array.isArray(p.phrases) ? p.phrases : undefined,
    marginXFraction: typeof p.marginXFraction === 'number' ? p.marginXFraction : DEFAULTS.marginXFraction,
    marginYFraction: typeof p.marginYFraction === 'number' ? p.marginYFraction : DEFAULTS.marginYFraction,
    tierCapMultiples: Array.isArray(p.tierCapMultiples) ? p.tierCapMultiples : undefined,
    accentText: ACCENT_TEXT,
  })

  return (
    <>
      <PrintFonts />
      <div style={{ position: 'absolute', inset: 0, background: pal.bg }} />
      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx, overflow: 'hidden' }}>
        {sea.placed.map((pl, i) => (
          <PhraseLine key={i} p={pl} geo={geo} theme={theme} />
        ))}
        {sea.hero && <HeroBlock hero={sea.hero} geo={geo} theme={theme} bg={pal.bg} />}
      </div>
    </>
  )
}
