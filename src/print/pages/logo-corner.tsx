import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { CSSProperties } from 'react'
import type { PrintPageProps } from '../types'

/**
 * logo-corner — an over-sized mark stamped from a corner, optional centred hero.
 * ──────────────────────────────────────────────────────────────────────────────
 * The supplied sun/leaf mark (faithful inline copy of the source SVG, gradients
 * and all) is scaled far past the wall and pinned by its OPTICAL CENTRE to one
 * corner of the media, so only a quarter of it bleeds onto the wall — a sunburst
 * radiating in from the corner, "impregnated" across the field. An optional raster
 * (`centerImage`, e.g. the world globe) sits centred on top as the hero.
 *
 * The mark is inlined (not a `staticFile`) so it rasterises crisply at any scale
 * and renders deterministically under Remotion `renderStill` — no async load. Note
 * ImageMagick mis-renders its linearGradients as black; Chrome (the real preview /
 * export host) renders them correctly as orange→yellow / green.
 *
 * Props (doc.props):
 *  · `sizeMm`            full mark size (its 2080² viewBox square) on the wall.
 *                        Default = trimWidth × 2 (its quarter spans the wall width).
 *  · `corner`           which corner the mark's centre pins to. Default bottom-left.
 *  · `background`       field colour behind everything. Default white.
 *  · `logoOpacity`      mark opacity (lower → quiet watermark). Default 1.
 *  · `anchorXUnit/anchorYUnit`  override the pinned point inside the mark (viewBox units).
 *  · `centerImage`      path under `public/` of a centred hero raster (optional).
 *  · `centerImageWidthMm`       its width on the wall. Default 3200.
 *  · `centerImageOpacity`       its opacity. Default 1.
 */

type Corner = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

type LogoCornerProps = {
  sizeMm?: number
  corner?: Corner
  background?: string
  logoOpacity?: number
  anchorXUnit?: number
  anchorYUnit?: number
  centerImage?: string
  centerImageWidthMm?: number
  centerImageOpacity?: number
  /** Wash the mark out to the field colour from the sun toward the opposite corner. */
  whiteFade?: boolean
  /** Gradient axis (CSS). Default = diagonal toward the corner opposite `corner`. */
  whiteFadeAngle?: string
  /** Where the wash begins / reaches full opacity, in % along the axis. Default 30 → 96. */
  whiteFadeStartPct?: number
  whiteFadeEndPct?: number
  /** Colour the wash fades to. Default = `background`. */
  whiteFadeColor?: string
}

/** The mark's square viewBox, and its measured artwork-bbox centre within it. */
const VB = 2080
const ART_CENTER = { x: 1066, y: 898 }

const CORNER_PIN: Record<Corner, { fx: number; fy: number }> = {
  'bottom-left': { fx: 0, fy: 1 },
  'bottom-right': { fx: 1, fy: 1 },
  'top-left': { fx: 0, fy: 0 },
  'top-right': { fx: 1, fy: 0 },
}

/** Diagonal pointing away from each corner (the sun → opposite-corner wash axis). */
const CORNER_FADE_AXIS: Record<Corner, string> = {
  'bottom-left': 'to top right',
  'bottom-right': 'to top left',
  'top-left': 'to bottom right',
  'top-right': 'to bottom left',
}

export function LogoCorner({ doc, geo }: PrintPageProps) {
  const { mm, mediaWidthPx, mediaHeightPx } = geo
  const p = (doc.props ?? {}) as LogoCornerProps

  const background = p.background ?? '#ffffff'
  const sizeMm = p.sizeMm ?? doc.dimensions.trimWidthMm * 2
  const sizePx = mm(sizeMm)
  const u = sizePx / VB // px per viewBox unit

  const anchorX = (p.anchorXUnit ?? ART_CENTER.x) * u
  const anchorY = (p.anchorYUnit ?? ART_CENTER.y) * u
  const corner = p.corner ?? 'bottom-left'
  const { fx, fy } = CORNER_PIN[corner]
  const left = fx * mediaWidthPx - anchorX
  const top = fy * mediaHeightPx - anchorY

  // White wash: transparent at the sun, full field-colour toward the opposite corner,
  // so the rays dissolve into the field as they travel away from the sun.
  const fadeColor = p.whiteFadeColor ?? background
  const fadeAxis = p.whiteFadeAngle ?? CORNER_FADE_AXIS[corner]
  const fadeStart = p.whiteFadeStartPct ?? 30
  const fadeEnd = p.whiteFadeEndPct ?? 96
  const fadeBg = `linear-gradient(${fadeAxis}, ${toRgba(fadeColor, 0)} ${fadeStart}%, ${toRgba(fadeColor, 1)} ${fadeEnd}%)`

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background }} />

      <SunMark
        style={{
          position: 'absolute',
          left,
          top,
          width: sizePx,
          height: sizePx,
          opacity: p.logoOpacity ?? 1,
        }}
      />

      {/* wash above the mark, BELOW the hero — fades only the rays, not the globe */}
      {p.whiteFade && (
        <div style={{ position: 'absolute', inset: 0, background: fadeBg, pointerEvents: 'none' }} />
      )}

      {p.centerImage && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CenterImg
            src={p.centerImage}
            widthPx={mm(p.centerImageWidthMm ?? 3200)}
            opacity={p.centerImageOpacity ?? 1}
          />
        </div>
      )}
    </>
  )
}

/** A CSS colour at a given alpha. Parses hex (so the gradient fades through the real
 *  colour, never transparent-black); falls back to color-mix for any other CSS colour. */
function toRgba(color: string, alpha: number): string {
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim())
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color.trim())
  if (m6) return `rgba(${parseInt(m6[1], 16)}, ${parseInt(m6[2], 16)}, ${parseInt(m6[3], 16)}, ${alpha})`
  if (m3) {
    const d = (h: string) => parseInt(h + h, 16)
    return `rgba(${d(m3[1])}, ${d(m3[2])}, ${d(m3[3])}, ${alpha})`
  }
  return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`
}

/* ── centred hero raster (host split: Remotion <Img> waits for decode) ────────── */
function CenterImg({ src, widthPx, opacity }: { src: string; widthPx: number; opacity: number }) {
  const file = staticFile(src.replace(/^\/+/, '').replace(/^public\//, ''))
  const style: CSSProperties = { width: widthPx, height: 'auto', display: 'block', opacity }
  return getRemotionEnvironment().isRendering ? (
    <Img src={file} alt="" style={style} />
  ) : (
    <img src={file} alt="" style={style} />
  )
}

/* ── the supplied sun/leaf mark, inline (faithful copy of the source SVG) ─────── */
function SunMark({ style }: { style: CSSProperties }) {
  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      width="100%"
      height="100%"
      role="img"
      aria-label=""
      style={{ display: 'block', ...style }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="lc_g1" gradientUnits="userSpaceOnUse" x1="1155.77" y1="1352.13" x2="1400.4" y2="1197.38">
          <stop offset="0" stopOpacity="1" stopColor="rgb(66,124,67)" />
          <stop offset="1" stopOpacity="1" stopColor="rgb(100,150,70)" />
        </linearGradient>
        <linearGradient id="lc_g2" gradientUnits="userSpaceOnUse" x1="950.151" y1="1046.48" x2="1217.21" y2="907.844">
          <stop offset="0" stopOpacity="1" stopColor="rgb(254,151,7)" />
          <stop offset="1" stopOpacity="1" stopColor="rgb(254,192,8)" />
        </linearGradient>
      </defs>
      <path fill="rgb(252,117,5)" d="M 655.958 874.594 C 667.917 880.003 682.929 888.623 694.718 894.923 C 715.232 905.907 735.854 916.691 756.579 927.273 C 838.404 969.104 915.531 1000.09 982.112 1065.94 C 1063.38 1146.32 1114.46 1257.78 1135.49 1369.23 C 1136.89 1376.67 1145.59 1423.42 1141.8 1427.25 C 1128.14 1429.68 1114.3 1430.94 1100.43 1431.02 C 1000.48 1431.11 897.498 1360.76 828.766 1292.65 C 721.229 1186.09 655.335 1026.36 655.958 874.594 z" />
      <path fill="url(#lc_g2)" d="M 1045.91 759.12 C 1098.66 759.337 1144.38 785.48 1175.36 827.795 C 1251.92 932.364 1243.8 1124.39 1135.18 1204.66 C 1128.76 1188.22 1121.53 1172.11 1113.49 1156.4 C 1063.5 1061.02 981.728 969.25 882.428 924.16 C 907.028 844.788 956.256 767.936 1045.91 759.12 z" />
      <path fill="url(#lc_g1)" d="M 1302.36 1181.62 C 1341.45 1180.01 1380.63 1194.72 1414.4 1213.11 C 1378.19 1290.31 1324.62 1355.51 1248.76 1396.68 C 1231.53 1406.05 1213 1414.81 1194.01 1419.88 C 1187.32 1362.01 1175.6 1315.1 1156.62 1260.16 C 1201.87 1219.34 1238.43 1185.48 1302.36 1181.62 z" />
      <path fill="rgb(253,160,6)" d="M 962.859 379.998 L 964.431 381.007 C 969.204 405.897 973.36 442.774 977.177 468.983 C 988.331 546.715 998.953 624.523 1009.04 702.401 C 992.637 707.6 982.019 712.338 966.508 719.421 L 960.957 697.484 L 889.895 410.755 C 915.92 397.168 934.842 388.872 962.859 379.998 z" />
      <path fill="rgb(253,188,7)" d="M 1072.51 363.32 C 1098.17 364.332 1120.14 368.771 1144.96 374.654 L 1105.38 682.18 L 1102.54 706.352 C 1085.77 702.142 1075.51 699.695 1058.15 698.441 C 1061.46 654.982 1062.11 605.997 1063.9 562.162 L 1072.51 363.32 z" />
      <path fill="rgb(253,160,6)" d="M 802.3 481.96 C 806.721 483.929 912.803 724.209 922.99 747.434 C 909.699 761.085 900.865 771.071 889.512 786.485 C 885.971 780.519 882.106 774.456 878.443 768.538 C 836.533 702.688 787.095 627.334 742.009 563.711 C 762.713 529.83 776.168 511.851 802.3 481.96 z" />
      <path fill="rgb(253,188,7)" d="M 1260.24 435.587 C 1276.99 444.521 1312.9 477.586 1326.75 490.701 C 1312.61 517.605 1298.71 546.331 1284.91 573.609 L 1201.1 739.634 L 1190.35 761.122 C 1177.04 747.948 1168.95 740.701 1153.86 729.614 C 1190.19 631.924 1225.66 533.911 1260.24 435.587 z" />
      <path fill="rgb(253,188,7)" d="M 1402.91 616.156 C 1410.32 623.304 1435.54 693.926 1440.08 707.669 C 1381.34 755.473 1317.87 803.191 1257.87 849.861 L 1250.26 855.688 C 1242.73 837.926 1236.31 824.822 1226.38 808.331 C 1284.73 743.825 1344.83 680.784 1402.91 616.156 z" />
      <path fill="rgb(252,117,5)" d="M 689.281 680.043 C 747.337 729.784 804.11 781.005 859.541 833.655 C 856.73 840.309 840.582 884.354 838.442 886.357 L 835.359 884.858 C 777.925 850.292 719.606 811.372 662.481 777.741 C 669.525 743.906 676.759 712.46 689.281 680.043 z" />
      <path fill="rgb(253,188,7)" d="M 1469.03 840.98 C 1470.24 841.187 1469.48 840.94 1470.96 842.397 C 1474.01 873.896 1475.58 905.521 1475.66 937.168 C 1408.93 948.525 1342.34 960.654 1275.9 973.554 C 1275.51 972.882 1269.13 922.872 1267.91 916.282 L 1469.03 840.98 z" />
      <path fill="rgb(253,160,6)" d="M 1276.08 1036.78 C 1339.33 1042.25 1402.53 1048.33 1465.67 1055.02 C 1461.13 1078.07 1455.5 1100.9 1448.79 1123.42 C 1448 1126.24 1447.76 1128.75 1445.58 1130.46 C 1440.41 1130.13 1433.88 1128.24 1428.69 1127.03 C 1374.57 1114.51 1320.67 1103 1265.75 1094.59 C 1270.77 1075.65 1273.41 1056.17 1276.08 1036.78 z" />
    </svg>
  )
}
