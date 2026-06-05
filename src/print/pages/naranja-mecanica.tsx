import type { CSSProperties, ReactNode } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import { DISPLAY_FONT, TEXT_FONT } from '@/lib/neumorphism'
import type { PrintPageProps } from '../types'

/**
 * naranja-mecanica — wall 13 (13-N-1 / 13-S-1, "Realidad — ya existe", 6.5 × 2.5 m).
 * ──────────────────────────────────────────────────────────────────────────────
 * El refuerzo al juego de la Sala 5 (el elixir / **La Naranja Mecánica**): cada
 * "mejora" que el jugador desbloquea para repartir el zumo sin coste humano —
 * camión autónomo, fábrica oscura, flota robotaxi, red de fábricas IA — **ya
 * existe en la vida real**. La pared empareja, por columna:
 *
 *   ASSET DEL JUEGO  →  PRUEBA REAL (foto + dato sourced + fuente)
 *
 * El asset se dibuja como una ficha de juego (glifo naranja + chip de nivel); la
 * prueba es una foto enmarcada con sello "REAL" y pie de foto con la cifra datada
 * (de `wall-data.ts` → `realidad-ya-existe`). Mensaje: "lo que has visto en el
 * juego ya está en marcha — no es fantasía".
 *
 * Placeholder: la foto es un *swatch* hasta dejar el PNG real en `assets/` y fijar
 * `item.proofSrc`. Autoría en mm desde el origen de trim, tipografía en puntos.
 */

const BG = '#ffffff'
const INK = '#161616'
const INK_SOFT = 'rgba(22,22,22,0.60)'
const HAIRLINE = 'rgba(22,22,22,0.85)'
const ORANGE = '#ff6a1f' // la naranja (zumo / elixir)
const ORANGE_FAINT = 'rgba(255,106,31,0.10)'

type Glyph = 'truck' | 'factory' | 'taxi' | 'network'

type Item = {
  /** Game-asset name (the unlockable upgrade). */
  asset: string
  /** Which glyph to draw for the asset. */
  glyph: Glyph
  /** The in-game effect line. */
  gameNote: string
  /** Real-world proof: who. */
  company: string
  /** Real-world proof: headline figure (already formatted). */
  stat: string
  /** Real-world proof: one-line claim. */
  claim: string
  /** Real-world proof: year. */
  year: string
  /** Real-world proof: source host (discreet caption). */
  source: string
  /** Optional real photo path under `public/` (Remotion `staticFile`). */
  proofSrc?: string
}

type Props = {
  items?: Item[]
}

/** The game upgrades that already exist — defaults; doc can override via props. */
const DEFAULT_ITEMS: Item[] = [
  {
    asset: 'Camión autónomo',
    glyph: 'truck',
    gameNote: 'Reparte sin conductor',
    company: 'Aurora',
    stat: '100.000+ millas sin conductor · 0 incidentes',
    claim: 'Primer transporte comercial de camiones pesados sin conductor en vías públicas (Dallas–Houston).',
    year: '2025',
    source: 'aurora.tech · act-news.com',
  },
  {
    asset: 'Fábrica oscura',
    glyph: 'factory',
    gameNote: 'Produce sin operarios',
    company: 'Xiaomi',
    stat: '10 M móviles/año · 81 % automatizado',
    claim: 'Fábrica «oscura» de Changping: produce móviles 24/7 prácticamente sin personal.',
    year: '2024',
    source: 'slashgear.com',
  },
  {
    asset: 'Flota robotaxi',
    glyph: 'taxi',
    gameNote: 'Mueve sin chófer',
    company: 'Waymo',
    stat: '450.000 viajes pagados / semana',
    claim: 'Servicio comercial de robotaxis sin conductor en varias ciudades de EE. UU.',
    year: '2025',
    source: 'cnbc.com',
  },
  {
    asset: 'Red de fábricas IA',
    glyph: 'network',
    gameNote: 'Escala sin límite',
    company: 'Red Faro · WEF',
    stat: '201 fábricas con IA a escala',
    claim: 'La Global Lighthouse Network reúne 201 fábricas operando con IA y 4IR; +40 % de productividad media.',
    year: '2025',
    source: 'weforum.org',
  },
]

export function NaranjaMecanica({ doc, geo }: PrintPageProps) {
  const { mm, pt } = geo
  const p = (doc.props ?? {}) as Props
  const items = Array.isArray(p.items) && p.items.length ? p.items : DEFAULT_ITEMS

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const N = items.length

  const at = (leftMm: number, topMm: number): CSSProperties => ({ position: 'absolute', left: mm(leftMm), top: mm(topMm) })

  /* ── horizontal grid — asset/proof columns ───────────────────────────────── */
  const MX = W * 0.04
  const CONTENT_W = W - 2 * MX
  const GUTTER_FRAC = 0.2
  const slotW = CONTENT_W / (N + (N - 1) * GUTTER_FRAC)
  const PITCH = slotW * (1 + GUTTER_FRAC)
  const slotLeft = (i: number) => MX + i * PITCH

  /* ── vertical grid (mm) ──────────────────────────────────────────────────── */
  const ASSET_TOP = H * 0.305
  const ASSET_H = H * 0.2 // game-asset tile
  const CONNECT_Y = ASSET_TOP + ASSET_H // "→ ya existe" band
  const CONNECT_H = H * 0.07
  const PROOF_TOP = CONNECT_Y + CONNECT_H
  const PROOF_H = H * 0.27 // real-photo frame
  const CAP_Y = PROOF_TOP + PROOF_H + H * 0.012

  const W_FRAME = 1.6

  return (
    <>
      {/* wall ground — the doc may override it (e.g. a warm cream "past" wall) */}
      <div style={{ position: 'absolute', inset: 0, background: doc.surface ?? BG }} />

      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>

        {/* ── header ──────────────────────────────────────────────────────────── */}
        <div style={{ ...at(MX, H * 0.07), width: mm(CONTENT_W) }}>
          <div style={{ fontFamily: TEXT_FONT, fontSize: pt(30), fontWeight: 600, letterSpacing: pt(1.4), textTransform: 'uppercase', color: ORANGE }}>
            S5 · La Naranja Mecánica
          </div>
          <div style={{ marginTop: mm(18), fontFamily: DISPLAY_FONT, fontSize: pt(120), fontWeight: 500, letterSpacing: pt(-1.6), lineHeight: 1.0, color: INK }}>
            Lo que ves en el juego ya está en marcha
          </div>
          <div style={{ marginTop: mm(18), fontFamily: TEXT_FONT, fontSize: pt(38), fontWeight: 400, lineHeight: 1.28, color: INK_SOFT, maxWidth: mm(CONTENT_W * 0.62) }}>
            Cada mejora que desbloqueas para repartir sin coste humano <strong style={{ fontWeight: 600, color: INK }}>ya existe</strong>. No es fantasía.
          </div>
        </div>

        {/* ── the columns: ASSET (game) → PROOF (real) ─────────────────────────── */}
        {items.map((item, i) => {
          const left = slotLeft(i)
          return (
            <div key={`col-${i}`}>
              {/* ── game-asset tile ───────────────────────────────────────────── */}
              <div
                style={{
                  ...at(left, ASSET_TOP),
                  width: mm(slotW),
                  height: mm(ASSET_H),
                  background: ORANGE_FAINT,
                  borderTop: `${mm(3)}px solid ${ORANGE}`,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  padding: `0 ${mm(slotW * 0.06)}px`,
                  gap: mm(slotW * 0.05),
                }}
              >
                <div style={{ width: mm(ASSET_H * 0.56), height: mm(ASSET_H * 0.56), flex: '0 0 auto' }}>
                  <AssetGlyph glyph={item.glyph} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: TEXT_FONT, fontSize: pt(24), fontWeight: 600, letterSpacing: pt(1.2), textTransform: 'uppercase', color: ORANGE }}>
                    Asset del juego
                  </div>
                  <div style={{ marginTop: mm(4), fontFamily: DISPLAY_FONT, fontSize: pt(58), fontWeight: 500, letterSpacing: pt(-0.6), lineHeight: 1.02, color: INK }}>
                    {item.asset}
                  </div>
                  <div style={{ marginTop: mm(4), fontFamily: TEXT_FONT, fontSize: pt(28), fontWeight: 500, color: INK_SOFT }}>
                    {item.gameNote} · coste humano → 0
                  </div>
                </div>
              </div>

              {/* ── connector: "→ ya existe" ──────────────────────────────────── */}
              <div style={{ ...at(left, CONNECT_Y), width: mm(slotW), height: mm(CONNECT_H), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: mm(10) }}>
                <div style={{ width: mm(slotW * 0.18), height: mm(2), background: HAIRLINE }} />
                <div style={{ fontFamily: TEXT_FONT, fontSize: pt(26), fontWeight: 600, letterSpacing: pt(1.4), textTransform: 'uppercase', color: INK }}>
                  ya existe
                </div>
                <div style={{ width: 0, height: 0, borderTop: `${mm(7)}px solid transparent`, borderBottom: `${mm(7)}px solid transparent`, borderLeft: `${mm(11)}px solid ${INK}` }} />
              </div>

              {/* ── proof: framed real photo + "REAL" stamp ───────────────────── */}
              <div
                style={{
                  ...at(left, PROOF_TOP),
                  width: mm(slotW),
                  height: mm(PROOF_H),
                  border: `${mm(W_FRAME)}px solid ${HAIRLINE}`,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  background: BG,
                }}
              >
                <ProofPhoto src={item.proofSrc} glyph={item.glyph} mm={mm} />
                {/* REAL stamp */}
                <div style={{ position: 'absolute', left: mm(slotW * 0.04), top: mm(slotW * 0.04), background: ORANGE, color: '#fff', fontFamily: TEXT_FONT, fontSize: pt(22), fontWeight: 700, letterSpacing: pt(1.4), textTransform: 'uppercase', padding: `${mm(5)}px ${mm(10)}px` }}>
                  Real · {item.year}
                </div>
              </div>

              {/* ── caption: company · stat · claim · source ──────────────────── */}
              <div style={{ ...at(left, CAP_Y), width: mm(slotW) }}>
                <div style={{ fontFamily: DISPLAY_FONT, fontSize: pt(40), fontWeight: 500, letterSpacing: pt(-0.4), lineHeight: 1.05, color: INK }}>
                  {item.company} <span style={{ color: ORANGE }}>— {item.stat}</span>
                </div>
                <div style={{ marginTop: mm(5), fontFamily: TEXT_FONT, fontSize: pt(25), fontWeight: 400, lineHeight: 1.24, color: INK_SOFT }}>
                  {item.claim}
                </div>
                <div style={{ marginTop: mm(5), fontFamily: TEXT_FONT, fontSize: pt(20), fontWeight: 500, letterSpacing: pt(0.4), textTransform: 'uppercase', color: 'rgba(22,22,22,0.42)' }}>
                  Fuente: {item.source}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ── the game-asset glyph (clean stroke icon, orange) ───────────────────────── */
function AssetGlyph({ glyph }: { glyph: Glyph }): ReactNode {
  const common = { width: '100%', height: '100%', display: 'block' } as CSSProperties
  const stroke = ORANGE
  const sw = 5
  switch (glyph) {
    case 'truck':
      return (
        <svg viewBox="0 0 100 100" style={common} fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round">
          <rect x="8" y="34" width="48" height="34" />
          <path d="M56 44 H78 L90 56 V68 H56 Z" />
          <circle cx="30" cy="76" r="9" fill="#fff" />
          <circle cx="74" cy="76" r="9" fill="#fff" />
        </svg>
      )
    case 'factory':
      return (
        <svg viewBox="0 0 100 100" style={common} fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round">
          <path d="M14 80 V46 L40 60 V46 L66 60 V30 H80 V80 Z" />
          <rect x="70" y="14" width="8" height="16" />
        </svg>
      )
    case 'taxi':
      return (
        <svg viewBox="0 0 100 100" style={common} fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round">
          <path d="M12 64 L22 44 H66 L82 56 H88 V64 Z" />
          <rect x="40" y="30" width="18" height="8" />
          <circle cx="30" cy="70" r="8" fill="#fff" />
          <circle cx="72" cy="70" r="8" fill="#fff" />
        </svg>
      )
    case 'network':
      return (
        <svg viewBox="0 0 100 100" style={common} fill="none" stroke={stroke} strokeWidth={sw}>
          <line x1="50" y1="50" x2="22" y2="24" />
          <line x1="50" y1="50" x2="80" y2="26" />
          <line x1="50" y1="50" x2="20" y2="78" />
          <line x1="50" y1="50" x2="82" y2="74" />
          <circle cx="50" cy="50" r="11" fill={ORANGE} stroke="none" />
          <circle cx="22" cy="24" r="7" fill="#fff" />
          <circle cx="80" cy="26" r="7" fill="#fff" />
          <circle cx="20" cy="78" r="7" fill="#fff" />
          <circle cx="82" cy="74" r="7" fill="#fff" />
        </svg>
      )
  }
}

/* ── proof photo: a real PNG, or a neutral placeholder swatch ──────────────── */
function ProofPhoto({ src, glyph, mm }: { src?: string; glyph: Glyph; mm: (v: number) => number }): ReactNode {
  const path = typeof src === 'string' && src.trim() ? src.trim() : ''
  if (path) {
    const resolved = staticFile(path.replace(/^\/+/, '').replace(/^public\//, ''))
    const style: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }
    return getRemotionEnvironment().isRendering ? <Img src={resolved} style={style} /> : <img src={resolved} alt="" style={style} />
  }
  // Placeholder: a quiet industrial-grey tonal field with a faint ghost of the
  // asset glyph — clearly a stand-in for the real documentary photo.
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(158deg, #d8dade 0%, #9aa0a6 100%)' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.18, padding: mm(40) }}>
        <div style={{ width: mm(140), height: mm(140), filter: 'grayscale(1) brightness(0.4)' }}>
          <AssetGlyph glyph={glyph} />
        </div>
      </div>
    </div>
  )
}
