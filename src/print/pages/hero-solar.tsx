import { BRAND, DISPLAY_FONT, TEXT_FONT, elevation } from '@/lib/neumorphism'
import type { PrintPageProps } from '../types'
import {
  DATAVIZ,
  DataField,
  ScaleNote,
  SourceCaption,
  datavizTheme,
  eyebrow,
  formatMoney,
  ENLARGED_NOTE_ES,
  SCALE_NOTE_ES,
} from './dataviz-kit'
import { fitHeroMaxRadius, layoutHeroSolar, type HeroBody } from './hero-solar'
import { heroHooks, pieceByInvId } from '../space/wall-data'
import type { DatumGroup } from '../space/wall-data'

/**
 * hero-solar — the hero print page "Sistema solar de la inversión".
 * ──────────────────────────────────────────────────────────────────────────
 * S3 / INVESTMENT camera. A director-level guest should feel "how can AI, as a
 * market, be bigger than **this**?" — their sense of normality betraying them.
 *
 * Code-rendered (never AI-invented): every ball's **area ∝ money**, sized by the
 * unit-tested `circleAreaScale` from researched, dated, sourced figures
 * (`wall-data.ts`, wall 2). AI giants are the giant balls; the IBEX 35, Spain's
 * GDP, the Spanish blue-chips and the world coffee market are the *marbles* that
 * ring the core. The centre is **not** a sun — it reads "esto es IA". The two
 * mandatory data-piece annotations ride the corners: the scale note ("área ∝
 * valor", and "ampliado, no a escala" whenever a marble was floored to stay
 * visible) and the discreet source caption. The hook lines only appear when the
 * verified numbers actually back them (`heroHooks()`).
 *
 * Pure inline styles (Remotion has no Tailwind); authored in `geo` units so it
 * reads at print scale at any wall size / DPI. Layout maths: `hero-solar.ts`.
 */

/** Inventory id of the hero wall — `dataForWall(2)`. */
export const HERO_INV_ID = 2

/** Ball colour by curation group — AI giants vivid, references quiet, coffee warm. */
const HERO_COLORS: Record<DatumGroup, string> = {
  'ai-giant-public': BRAND.blue,
  'ai-giant-private': BRAND.teal,
  'spanish-ref': '#586079',
  aggregate: '#7e8aa6',
  'shock-market': BRAND.orange,
  // `model` (#8), `capability`/`context` (#11) and `productivity`/`adoption` (#16)
  // belong to other walls — never on the hero rosette; quiet fallbacks keep the
  // `Record<DatumGroup>` exhaustive.
  model: '#7e8aa6',
  capability: '#7e8aa6',
  context: '#7e8aa6',
  productivity: '#7e8aa6',
  adoption: '#7e8aa6',
}

export function HeroSolar({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const invId = typeof doc.props?.invId === 'number' ? (doc.props.invId as number) : HERO_INV_ID
  const piece = pieceByInvId(invId)
  const data = piece?.data ?? []

  // ── layout in millimetres (trim space), scaled to the canvas ──
  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const minDim = Math.min(W, H)
  const centerRadius = minDim * 0.14
  const minRadius = minDim * 0.022
  const gap = minDim * 0.01
  const maxRadius = fitHeroMaxRadius(
    data.map((d) => d.value),
    { width: W, height: H, minRadius, centerRadius, fill: 0.4 },
  )
  const layout = layoutHeroSolar(data, { width: W, height: H, maxRadius, minRadius, gap, centerRadius })

  const hooks = invId === HERO_INV_ID ? heroHooks().filter((h) => h.holds) : []

  // px helpers in trim space
  const centerPx = { x: mm(layout.center.x), y: mm(layout.center.y) }
  const holePx = mm(layout.centerRadius)

  return (
    <>
      <DataField>
        {/* a faint cosmic vignette so the field reads as space, not flat black */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(120% 120% at 50% 48%, #11151e 0%, ${DATAVIZ.bg} 62%, #05060a 100%)`,
          }}
        />
      </DataField>

      {/* trim layer — balls + labels positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* the balls (back: drawn largest-first so smaller marbles sit on top of edges) */}
        {layout.bodies.map((b) => (
          <Ball key={b.id} body={b} geo={geo} />
        ))}

        {/* centre: "esto es IA" — not a sun */}
        <div
          style={{
            position: 'absolute',
            left: centerPx.x,
            top: centerPx.y,
            width: holePx * 1.7,
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ ...eyebrow(geo, 9, DATAVIZ.muted), marginBottom: mm(2) }}>ESTO ES</div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: holePx * 0.92,
              fontWeight: 300,
              lineHeight: 0.9,
              letterSpacing: -holePx * 0.02,
              color: DATAVIZ.ink,
            }}
          >
            IA
          </div>
        </div>

        {/* top-left: piece title + room */}
        <div style={{ position: 'absolute', left: mm(minDim * 0.03), top: mm(minDim * 0.03) }}>
          <div style={eyebrow(geo, 9, DATAVIZ.accent)}>S3 · INVERSIÓN</div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: geo.pt(22),
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: geo.pt(-0.4),
              color: DATAVIZ.ink,
              marginTop: mm(minDim * 0.012),
              maxWidth: mm(W * 0.42),
            }}
          >
            {piece?.title ?? 'Sistema solar de la inversión'}
          </div>
        </div>

        {/* top-right: the verified hook lines (only those the numbers back) */}
        {hooks.length > 0 && (
          <div
            style={{
              position: 'absolute',
              right: mm(minDim * 0.03),
              top: mm(minDim * 0.03),
              maxWidth: mm(W * 0.36),
              textAlign: 'right',
            }}
          >
            {hooks.map((h) => (
              <div
                key={h.claim}
                style={{
                  fontFamily: TEXT_FONT,
                  fontSize: geo.pt(11),
                  fontWeight: 500,
                  lineHeight: 1.3,
                  color: DATAVIZ.inkSoft,
                  marginBottom: mm(minDim * 0.006),
                }}
              >
                {h.claim}
              </div>
            ))}
          </div>
        )}

        {/* bottom-left: the two mandatory annotations + the source caption */}
        <div style={{ position: 'absolute', left: mm(minDim * 0.03), bottom: mm(minDim * 0.03), maxWidth: mm(W * 0.6) }}>
          <ScaleNote geo={geo} note={SCALE_NOTE_ES} />
          {layout.enlarged.length > 0 && (
            <div style={{ marginTop: mm(minDim * 0.006) }}>
              <span style={eyebrow(geo, 7, DATAVIZ.faint)}>{ENLARGED_NOTE_ES}</span>
            </div>
          )}
          <div style={{ marginTop: mm(minDim * 0.01) }}>
            <SourceCaption geo={geo} data={data} />
          </div>
        </div>
      </div>
    </>
  )
}

/* ── one ball + its label (inside when it fits, below when it's a small marble) ── */

function Ball({ body, geo }: { body: HeroBody; geo: PrintPageProps['geo'] }) {
  const { mm } = geo
  const rPx = mm(body.r)
  const dia = rPx * 2
  const color = HERO_COLORS[body.group]
  const plate = elevation(datavizTheme, { depth: 'raised', distance: rPx * 0.05, blur: rPx * 0.16, radius: rPx })

  // Label fits inside when an ~16%-of-diameter name clears a legible floor.
  const insideNamePx = dia * 0.16
  const labelInside = insideNamePx >= geo.pt(7)
  const moneyText = formatMoney(body.value)

  return (
    <div style={{ position: 'absolute', left: mm(body.cx) - rPx, top: mm(body.cy) - rPx, width: dia, height: dia }}>
      <div
        style={{
          ...plate,
          width: dia,
          height: dia,
          borderRadius: rPx,
          background: color,
          // Floored marbles get a hairline ring so the eye knows not to trust the size.
          outline: body.toScale ? undefined : `${Math.max(1, mm(0.4))}px dashed ${DATAVIZ.faint}`,
          outlineOffset: mm(0.6),
          boxSizing: 'border-box',
        }}
      />

      {labelInside ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: dia * 0.08,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: insideNamePx, fontWeight: 400, lineHeight: 0.98, color: '#0b0d12', maxWidth: dia * 0.86 }}>
            {body.label}
          </div>
          <div style={{ fontFamily: TEXT_FONT, fontSize: dia * 0.108, fontWeight: 600, lineHeight: 1.1, color: 'rgba(11,13,18,0.78)', marginTop: dia * 0.02 }}>
            {moneyText}
          </div>
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            top: dia + mm(1.4),
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: geo.pt(9), fontWeight: 400, lineHeight: 1, color: DATAVIZ.inkSoft }}>{body.label}</div>
          <div style={{ fontFamily: TEXT_FONT, fontSize: geo.pt(7.5), fontWeight: 500, lineHeight: 1.15, color: DATAVIZ.muted }}>{moneyText}</div>
          {!body.toScale && <div style={eyebrow(geo, 6, DATAVIZ.faint)}>{ENLARGED_NOTE_ES}</div>}
        </div>
      )}
    </div>
  )
}
