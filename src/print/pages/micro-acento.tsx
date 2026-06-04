import type { PrintPageProps } from '../types'
import {
  WAYFIND,
  WallField,
  Hairline,
  Lockup,
  wayDisplay,
  wayEyebrow,
} from './wayfinding-kit'
import { microAcentoTypeScale, wrapPhrase } from './micro-acento'

/**
 * micro-acento — the #14 print page (wall 14 / `wall-13`, the S5→S6 micro-accent).
 * ──────────────────────────────────────────────────────────────────────────
 * The smallest wall in the show (1.5 m). The visitor turns from S5 (Cuellos de
 * botella — the juice game, "human marginal cost → 0") toward S6 (Pobreza histórica
 * — *ya pasó antes*). This micro-wall carries **one strong phrase** and nothing else
 * — a typographic accent, not a data piece (`research: false`). So the composition
 * is the quietest of the threshold family: a small locator eyebrow, the protagonist
 * phrase stacked in balanced lines with a short warm accent rule beneath, and the
 * discreet lockup.
 *
 * The only things to keep honest are **legibility** (every level sized through the
 * unit-tested `microAcentoTypeScale` so it clears the ≈1 cm / 3 m floor) and that the
 * phrase **fits** the narrow band (`wrapPhrase` balances the lines). Shares the
 * threshold register with #10 / #3 via `wayfinding-kit`. Pure inline styles
 * (Remotion has no Tailwind); authored in `geo` units so it reads at print scale at
 * any size / DPI.
 */

type Props = {
  invId?: number
  /** Real reading distance to the wall (m) — drives the museographic type sizing. */
  readingDistanceM?: number
  /** The one strong phrase — the protagonist. */
  phrase?: string
  /** Section locator shown in the eyebrow. */
  code?: string
  /** Max lines the phrase may wrap to on this narrow wall. */
  maxLines?: number
}

const DEFAULTS: Required<Omit<Props, 'invId'>> = {
  readingDistanceM: 3,
  phrase: 'Ya pasó antes',
  code: 'S5 → S6',
  maxLines: 2,
}

const VENUE = 'Finca El Olivar · 17·06·2026'

export function MicroAcento({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : DEFAULTS.readingDistanceM
  const phrase = p.phrase ?? DEFAULTS.phrase
  const code = p.code ?? DEFAULTS.code
  const maxLines = typeof p.maxLines === 'number' ? p.maxLines : DEFAULTS.maxLines

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const margin = W * 0.06

  // Balance the phrase into lines, then size it to fit that many lines legibly.
  const lines = wrapPhrase(phrase, { maxLines })
  const lineCount = Math.max(1, lines.length)
  const scale = microAcentoTypeScale({ trimHeightMm: H, readingDistanceM, lineCount })

  // A short warm accent rule under the phrase — the only ornament.
  const ruleWidthMm = scale.phraseCapMm * 1.1
  const ruleThickMm = Math.max(1.2, scale.phraseCapMm * 0.03)

  return (
    <>
      <WallField />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* ── top locator strip: S5 → S6 ── */}
        <div style={{ position: 'absolute', left: mm(margin), top: mm(H * 0.1), right: mm(margin) }}>
          <span style={wayEyebrow(geo, scale.eyebrowPt, WAYFIND.accent)}>{code}</span>
          <div style={{ marginTop: mm(H * 0.04) }}>
            <Hairline geo={geo} />
          </div>
        </div>

        {/* ── the act: the one strong phrase, balanced + a short accent rule ── */}
        <div
          style={{
            position: 'absolute',
            left: mm(margin),
            right: mm(margin),
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: mm(H * 0.03),
          }}
        >
          <div>
            {lines.map((line, i) => (
              <div key={i} style={{ ...wayDisplay(geo, scale.phrasePt, 300), whiteSpace: 'nowrap' }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ width: mm(ruleWidthMm), height: Math.max(1, mm(ruleThickMm)), background: WAYFIND.accent }} />
        </div>

        {/* ── footer: the discreet lockup ── */}
        <div style={{ position: 'absolute', left: mm(margin), right: mm(margin), bottom: mm(H * 0.1) }}>
          <Hairline geo={geo} style={{ marginBottom: mm(H * 0.04) }} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: mm(W * 0.03) }}>
            <Lockup geo={geo} sizePt={scale.footerPt} />
            <span style={wayEyebrow(geo, scale.footerPt, WAYFIND.faint)}>{VENUE}</span>
          </div>
        </div>
      </div>
    </>
  )
}
