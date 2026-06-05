import type { PrintPageProps } from '../types'
import { PrintFonts, PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import { KIT_BLUE } from '@/lib/neumorphism'
import { buildWarpField, type WarpCell, type WarpOpts } from './warp'
import { placeWarpSpheres } from './warp-bodies'

/**
 * WarpV1 — preserved PREVIOUS version (commit c0e27d1): brand-blue basin with the
 * **black hole** at the centre (not the emerging sphere), uniform graphite spheres,
 * region swaps + dispersion. Kept as its own print alongside the newer `warp`.
 *
 * Warp — «Galaxia · warp espacio-tiempo» (canvas libre, los tres campos unidos).
 * ──────────────────────────────────────────────────────────────────────────
 * The continuous gravity-well field for the three INVERSIÓN walls (2-E · 5N1 ·
 * 11-W), authored as ONE canvas so the warp is perfectly continuous before it is
 * sliced. Register (director): a **white field** with the warp radiating from the
 * brand blue (KIT_BLUE) at the rim → white far away; a black hole at the centre
 * holding the white ChatGPT mark + title; uniform graphite market spheres (area ∝
 * valoración) with white label plates. Strong 3D funnel via a tilted, non-converging
 * projection — see `warp.ts`. Seam-safe placement so the three prints cut clean.
 *
 * `doc.props` (all optional): holeCenterXMm · holeCenterYFrac · horizonYFrac ·
 * holeRadiusMm · foreshorten · funnelFalloff · ringGrowth · spokes · shadeSpanMm ·
 * lineMm. Defaults match the 23.5 × 2.5 m combined canvas.
 */

type Props = Partial<Omit<WarpOpts, 'widthMm' | 'heightMm'>> & {
  /** Separation-line weight (mm). */
  lineMm?: number
  /** Darkness bias of the cell ramp (>1 = darker mid-tones, 1 = pure smoothstep). */
  shadeGamma?: number
  /** Show the market spheres + labels. */
  showSpheres?: boolean
  /** X positions (mm) of the print cuts (2-E│5N1 and 5N1│11-W). */
  seams?: number[]
  /** Clear gutter each side of a seam / at the edges (mm). */
  seamMarginMm?: number
  edgeMarginMm?: number
  /** Min gap between bodies/labels (mm). */
  bodyGapMm?: number
  /** 0 = packed toward the hole, 1 = spread across the band. */
  dispersion?: number
  /** Placement seed. */
  bodySeed?: number
  /** Label sizing. */
  labelFontFrac?: number
  labelMinMm?: number
  labelMaxMm?: number
  /** Centre mark (in the black hole): the white ChatGPT mark + title. */
  showCenterMark?: boolean
  centerTitle?: string
  centerLogoHeightMm?: number
  centerTitleCapMm?: number
  /** Vertical nudge of the centre mark (mm; negative = up). */
  centerMarkOffsetYMm?: number
}

type Palette = {
  field: string
  /** Cell fill at the rim (deepest, dives into the hole). */
  cellDark: string
  /** Cell fill in the far field. */
  cellLight: string
  /** The fine separation line — visible on white AND on the dark cells. */
  line: string
  /** The black hole. */
  holeInk: string
}

const LIGHT: Palette = {
  field: '#ffffff',
  // the warp radiates from the brand blue at the rim → white far away
  cellDark: KIT_BLUE,
  cellLight: '#ffffff',
  line: '#9aa6b6',
  holeInk: '#06080e',
}

// Symmetric dark variant (not the selected register) — black space, grid as light.
const DARK: Palette = {
  field: '#05060a',
  cellDark: '#dfe6f2',
  cellLight: '#05060a',
  line: '#454f60',
  holeInk: '#000000',
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Per-channel sRGB mix of two #rrggbb colours (fine for the neutral cool greys here). */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (sh: number) => {
    const ca = (pa >> sh) & 0xff
    const cb = (pb >> sh) & 0xff
    return Math.round(ca + (cb - ca) * t)
  }
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(ch(16))}${hex(ch(8))}${hex(ch(0))}`
}

/** S-curve: keeps the rim deep, then eases GENTLY into the white field (no abrupt jump). */
const smoothstep = (s: number) => s * s * (3 - 2 * s)

/** Cell ink: dark at the rim → white far away, via a soft-shouldered ramp (darker mids, gentle tail). */
function cellColor(shade: number, pal: Palette, gamma: number): string {
  const t = Math.pow(smoothstep(clamp(shade, 0, 1)), gamma)
  return mixHex(pal.cellDark, pal.cellLight, t)
}

/** The ChatGPT "blossom" knot only (the app-icon's white square is dropped) — filled white. */
const CHATGPT_MARK_VIEWBOX = '0 0 512 509.639'
const CHATGPT_MARK_D =
  'M412.037 221.764a90.834 90.834 0 004.648-28.67 90.79 90.79 0 00-12.443-45.87c-16.37-28.496-46.738-46.089-79.605-46.089-6.466 0-12.943.683-19.264 2.04a90.765 90.765 0 00-67.881-30.515h-.576c-.059.002-.149.002-.216.002-39.807 0-75.108 25.686-87.346 63.554-25.626 5.239-47.748 21.31-60.682 44.03a91.873 91.873 0 00-12.407 46.077 91.833 91.833 0 0023.694 61.553 90.802 90.802 0 00-4.649 28.67 90.804 90.804 0 0012.442 45.87c16.369 28.504 46.74 46.087 79.61 46.087a91.81 91.81 0 0019.253-2.04 90.783 90.783 0 0067.887 30.516h.576l.234-.001c39.829 0 75.119-25.686 87.357-63.588 25.626-5.242 47.748-21.312 60.682-44.033a91.718 91.718 0 0012.383-46.035 91.83 91.83 0 00-23.693-61.553l-.004-.005zM275.102 413.161h-.094a68.146 68.146 0 01-43.611-15.8 56.936 56.936 0 002.155-1.221l72.54-41.901a11.799 11.799 0 005.962-10.251V241.651l30.661 17.704c.326.163.55.479.596.84v84.693c-.042 37.653-30.554 68.198-68.21 68.273h.001zm-146.689-62.649a68.128 68.128 0 01-9.152-34.085c0-3.904.341-7.817 1.005-11.663.539.323 1.48.897 2.155 1.285l72.54 41.901a11.832 11.832 0 0011.918-.002l88.563-51.137v35.408a1.1 1.1 0 01-.438.94l-73.33 42.339a68.43 68.43 0 01-34.11 9.12 68.359 68.359 0 01-59.15-34.11l-.001.004zm-19.083-158.36a68.044 68.044 0 0135.538-29.934c0 .625-.036 1.731-.036 2.5v83.801l-.001.07a11.79 11.79 0 005.954 10.242l88.564 51.13-30.661 17.704a1.096 1.096 0 01-1.034.093l-73.337-42.375a68.36 68.36 0 01-34.095-59.143 68.412 68.412 0 019.112-34.085l-.004-.003zm251.907 58.621l-88.563-51.137 30.661-17.697a1.097 1.097 0 011.034-.094l73.337 42.339c21.109 12.195 34.132 34.746 34.132 59.132 0 28.604-17.849 54.199-44.686 64.078v-86.308c.004-.032.004-.065.004-.096 0-4.219-2.261-8.119-5.919-10.217zm30.518-45.93c-.539-.331-1.48-.898-2.155-1.286l-72.54-41.901a11.842 11.842 0 00-5.958-1.611c-2.092 0-4.15.558-5.957 1.611l-88.564 51.137v-35.408l-.001-.061a1.1 1.1 0 01.44-.88l73.33-42.303a68.301 68.301 0 0134.108-9.129c37.704 0 68.281 30.577 68.281 68.281a68.69 68.69 0 01-.984 11.545v.005zm-191.843 63.109l-30.668-17.704a1.09 1.09 0 01-.596-.84v-84.692c.016-37.685 30.593-68.236 68.281-68.236a68.332 68.332 0 0143.689 15.804 63.09 63.09 0 00-2.155 1.222l-72.54 41.9a11.794 11.794 0 00-5.961 10.248v.068l-.05 102.23zm16.655-35.91l39.445-22.782 39.444 22.767v45.55l-39.444 22.767-39.445-22.767v-45.535z'

function cellPath(cell: WarpCell, m: (v: number) => number): string {
  return cell.points.map((p, i) => `${i ? 'L' : 'M'}${m(p.x).toFixed(1)} ${m(p.y).toFixed(1)}`).join(' ') + 'Z'
}

export function WarpV1({ doc, geo }: PrintPageProps) {
  const props = (doc.props ?? {}) as Props
  const pal = doc.theme === 'dark' ? DARK : LIGHT
  const m = geo.mm

  const field = buildWarpField({
    widthMm: geo.dims.trimWidthMm,
    heightMm: geo.dims.trimHeightMm,
    ...props,
  })

  const strokeW = Math.max(1, m(props.lineMm ?? 2.2))
  const shadeGamma = props.shadeGamma ?? 1
  // Draw far (light) first, near (dark) last → a crisp dark basin around the hole.
  const ordered = [...field.cells].sort((a, b) => b.rMid - a.rMid)

  // Market spheres — seam/edge-aware so the three prints cut through clean gutters.
  const spheres =
    props.showSpheres === false
      ? []
      : placeWarpSpheres({
          widthMm: geo.dims.trimWidthMm,
          heightMm: geo.dims.trimHeightMm,
          hole: field.hole,
          seams: Array.isArray(props.seams) ? props.seams : [8250, 17750],
          seamMarginMm: props.seamMarginMm,
          edgeMarginMm: props.edgeMarginMm,
          gapMm: props.bodyGapMm,
          dispersion: props.dispersion,
          seed: props.bodySeed,
          labelFontFrac: props.labelFontFrac,
          labelMinMm: props.labelMinMm,
          labelMaxMm: props.labelMaxMm,
        }).placed

  return (
    <>
      <PrintFonts />
      {/* flat white ground — no gradients */}
      <div style={{ position: 'absolute', inset: 0, background: doc.surface ?? pal.field }} />

      {/* trim layer — the warp is authored in mm and clipped to the trim */}
      <div
        style={{
          position: 'absolute',
          left: geo.bleedPx,
          top: geo.bleedPx,
          width: geo.trimWidthPx,
          height: geo.trimHeightPx,
          overflow: 'hidden',
        }}
      >
        <svg width={geo.trimWidthPx} height={geo.trimHeightPx} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            {/* one graphite sphere material — every ball the same (uniform dark) */}
            <radialGradient id="warpSphere" cx="50%" cy="50%" r="62%" fx="34%" fy="28%">
              <stop offset="0%" stopColor="#b6c0d1" />
              <stop offset="20%" stopColor="#7c8799" />
              <stop offset="52%" stopColor="#2f3744" />
              <stop offset="100%" stopColor="#0a0d14" />
            </radialGradient>
            <radialGradient id="warpContact" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#080a10" stopOpacity="0.34" />
              <stop offset="62%" stopColor="#080a10" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#080a10" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="warpSpec" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {ordered.map((c) => (
            <path
              key={`${c.ring}-${c.spoke}`}
              d={cellPath(c, m)}
              fill={cellColor(c.shade, pal, shadeGamma)}
              stroke={pal.line}
              strokeWidth={strokeW}
              strokeLinejoin="round"
            />
          ))}
          {/* the black hole — area = IA + Nvidia */}
          <ellipse cx={m(field.hole.cx)} cy={m(field.hole.cy)} rx={m(field.hole.rx)} ry={m(field.hole.ry)} fill={pal.holeInk} />

          {/* contact shadows (under the spheres, on the grid) */}
          {spheres.map((s) => (
            <ellipse key={`sh-${s.id}`} cx={m(s.cx)} cy={m(s.cy + s.r * 0.84)} rx={m(s.r * 0.98)} ry={m(s.r * 0.26)} fill="url(#warpContact)" />
          ))}
          {/* the 3D spheres + specular highlight (all uniform graphite) */}
          {spheres.map((s) => (
            <g key={`sp-${s.id}`}>
              <circle cx={m(s.cx)} cy={m(s.cy)} r={m(s.r)} fill="url(#warpSphere)" />
              <ellipse cx={m(s.cx - s.r * 0.33)} cy={m(s.cy - s.r * 0.36)} rx={m(s.r * 0.27)} ry={m(s.r * 0.18)} fill="url(#warpSpec)" />
            </g>
          ))}
        </svg>

        {/* labels — name on a small white plate (no border-radius), set below each sphere */}
        {spheres.map((s) => (
          <div
            key={`lb-${s.id}`}
            style={{
              position: 'absolute',
              left: m(s.labelBox.x),
              top: m(s.labelBox.y),
              width: m(s.labelBox.w),
              height: m(s.labelBox.h),
              background: '#ffffff',
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontFamily: PRINT_DISPLAY_HAIR,
                fontWeight: 400,
                fontSize: m(s.labelBox.fontMm),
                lineHeight: 1,
                color: '#11141c',
                whiteSpace: 'nowrap',
                letterSpacing: m(-s.labelBox.fontMm * 0.01),
              }}
            >
              {s.label}
            </div>
          </div>
        ))}

        {/* centre mark — the white ChatGPT knot + title, floating in the black hole */}
        {props.showCenterMark !== false &&
          (() => {
            const logoH = props.centerLogoHeightMm ?? field.hole.ry * 0.62
            const logoW = (logoH * 512) / 509.639
            const capMm = props.centerTitleCapMm ?? field.hole.ry * 0.15
            const titleFont = capMm / 0.72 // hairline display cap ≈ 0.72·em
            const title = props.centerTitle ?? 'Mercado alrededor de ChatGPT'
            const offsetY = props.centerMarkOffsetYMm ?? -field.hole.ry * 0.22
            return (
              <div
                style={{
                  position: 'absolute',
                  left: m(field.hole.cx),
                  top: m(field.hole.cy + offsetY),
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  pointerEvents: 'none',
                }}
              >
                <svg viewBox={CHATGPT_MARK_VIEWBOX} width={m(logoW)} height={m(logoH)} style={{ display: 'block' }}>
                  <path d={CHATGPT_MARK_D} fill="#ffffff" fillRule="nonzero" />
                </svg>
                <div
                  style={{
                    marginTop: m(logoH * 0.22),
                    fontFamily: PRINT_TEXT_FONT,
                    fontWeight: 500,
                    fontSize: m(titleFont),
                    lineHeight: 1,
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    letterSpacing: m(-titleFont * 0.006),
                    textAlign: 'center',
                  }}
                >
                  {title}
                </div>
              </div>
            )
          })()}
      </div>
    </>
  )
}
