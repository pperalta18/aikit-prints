import type { PrintPageProps } from '../types'
import {
  WAYFIND,
  WallField,
  Hairline,
  Lockup,
  Arrow,
  wayDisplay,
  wayEyebrow,
  wayLabel,
} from './wayfinding-kit'
import { NAVE_CAMERAS, planCameraSequence, umbralTypeScale, type NaveCamera } from './umbral'

/**
 * umbral — the #3 print page (wall 3 / `wall-2`, the S2→S3 nave title-band).
 * ──────────────────────────────────────────────────────────────────────────
 * The visitor crosses from S2 (Intro IA — "lo entiendo") into S3 (Velocidad /
 * Showroom). This band names the room with its thesis — **"Es inevitable"** — and
 * **sequences the three nave cameras** they are about to walk: `IMAGE → TEXT+CODE →
 * INVERSIÓN`. So the composition is a single eye-band band: a locator eyebrow, the
 * protagonist thesis, then an evenly-spaced row of the three cameras (each a number,
 * name and one-word hint) joined by thin-line accent arrows that show the sequence.
 *
 * No data, no chart (`research: false`); the only thing to keep honest is
 * **legibility** (every text level sized through the unit-tested `umbralTypeScale`
 * so it clears the museographic floor, ≈1 cm cap-height per 3 m) and the **even
 * sequencing** of the cameras (`planCameraSequence`). Shares the threshold register
 * with #10 via `wayfinding-kit`, so the demystify→velocity bridge reads as one
 * system. Pure inline styles (Remotion has no Tailwind); authored in `geo` units so
 * it reads at print scale at any size / DPI.
 */

type Props = {
  invId?: number
  /** Real reading distance to the wall (m) — drives the museographic type sizing. */
  readingDistanceM?: number
  /** The S3 room thesis — the protagonist line. */
  thesis?: string
  /** Section code shown in the locator eyebrow. */
  code?: string
  /** Room name in the locator eyebrow. */
  room?: string
}

const DEFAULTS: Required<Omit<Props, 'invId'>> = {
  readingDistanceM: 5,
  thesis: 'Es inevitable',
  code: 'S3',
  room: 'Velocidad',
}

const VENUE = 'Finca El Olivar · 17·06·2026'

export function Umbral({ doc, geo }: PrintPageProps) {
  const { mm } = geo
  const p = (doc.props ?? {}) as Props
  const readingDistanceM = typeof p.readingDistanceM === 'number' ? p.readingDistanceM : DEFAULTS.readingDistanceM
  const thesis = p.thesis ?? DEFAULTS.thesis
  const code = p.code ?? DEFAULTS.code
  const room = p.room ?? DEFAULTS.room

  const W = geo.dims.trimWidthMm
  const H = geo.dims.trimHeightMm
  const margin = W * 0.04

  // Museographic type scale — thesis + camera name + hint, all guaranteed legible.
  const scale = umbralTypeScale({ trimHeightMm: H, readingDistanceM })

  // The camera sequence: one even cell per camera, joined by accent arrows.
  const bandLeft = margin
  const bandTop = H * 0.5
  const bandW = W - 2 * margin
  const rowH = H * 0.34
  const gap = bandW * 0.06
  const cells = planCameraSequence(NAVE_CAMERAS, { width: bandW, height: rowH, gap })
  const arrowMm = scale.cameraCapMm * 0.85

  const renderCell = (cell: (typeof cells)[number]) => {
    const c: NaveCamera = cell.camera
    return (
      <div
        key={c.id}
        style={{
          position: 'absolute',
          left: mm(cell.x),
          top: 0,
          width: mm(cell.width),
          height: mm(rowH),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: mm(rowH * 0.06),
          textAlign: 'center',
        }}
      >
        <span style={wayEyebrow(geo, scale.footerPt, WAYFIND.accent)}>{`0${cell.index}`}</span>
        <div style={{ ...wayDisplay(geo, scale.cameraPt, 400), whiteSpace: 'nowrap' }}>{c.name}</div>
        <span style={wayLabel(geo, scale.hintPt, WAYFIND.muted, 400)}>{c.hint}</span>
      </div>
    )
  }

  return (
    <>
      <WallField />

      {/* trim layer — everything positioned in mm from the trim origin */}
      <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
        {/* ── top locator strip: section code · room — "de S2 a S3" ── */}
        <div style={{ position: 'absolute', left: mm(margin), top: mm(H * 0.08), right: mm(margin) }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: mm(W * 0.02) }}>
            <span style={wayEyebrow(geo, scale.eyebrowPt, WAYFIND.accent)}>{`${code} · ${room}`}</span>
            <span style={wayEyebrow(geo, scale.footerPt, WAYFIND.muted)}>De S2 a S3</span>
          </div>
          <div style={{ marginTop: mm(H * 0.03) }}>
            <Hairline geo={geo} />
          </div>
        </div>

        {/* ── the thesis: the protagonist S3 line ── */}
        <div style={{ position: 'absolute', left: mm(margin), right: mm(margin), top: mm(H * 0.2) }}>
          <div style={{ ...wayDisplay(geo, scale.destinationPt, 300), whiteSpace: 'nowrap' }}>{thesis}</div>
        </div>

        {/* ── the camera sequence: IMAGE → TEXT+CODE → INVERSIÓN ── */}
        <div style={{ position: 'absolute', left: mm(bandLeft), top: mm(bandTop), width: mm(bandW), height: mm(rowH) }}>
          {cells.map(renderCell)}
          {cells
            .filter((cell) => cell.connectorAfter)
            .map((cell) => (
              <div
                key={`arrow-${cell.index}`}
                style={{
                  position: 'absolute',
                  left: mm(cell.x + cell.width + gap / 2 - arrowMm / 2),
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <Arrow geo={geo} dir="right" sizeMm={arrowMm} color={WAYFIND.accent} weight={6} />
              </div>
            ))}
        </div>

        {/* ── footer: the discreet lockup ── */}
        <div style={{ position: 'absolute', left: mm(margin), right: mm(margin), bottom: mm(H * 0.08) }}>
          <Hairline geo={geo} style={{ marginBottom: mm(H * 0.03) }} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: mm(W * 0.02) }}>
            <Lockup geo={geo} sizePt={scale.footerPt} />
            <span style={wayEyebrow(geo, scale.footerPt, WAYFIND.faint)}>{VENUE}</span>
          </div>
        </div>
      </div>
    </>
  )
}
