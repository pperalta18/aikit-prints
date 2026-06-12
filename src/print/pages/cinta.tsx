import type { PrintPageProps } from '../types'

/**
 * cinta — «La Naranja Mecánica» ribbon-trail (wall 4-W-2, 11.5 × 3 m).
 * ──────────────────────────────────────────────────────────────────────────────
 * A Bauhaus / mid-century homage (the «Form Follows Function» poster), with NO
 * text: one continuous **multi-stripe ribbon** — a railroad of N near-black
 * parallel lines — weaving a complex trail across the whole wall, doubling back on
 * itself so two **brand-orange** discs nest tangent in the pockets of the bends,
 * linked by a thin connector. Enters off the left edge, exits off the right.
 *
 * Technique (pure SVG, no raster): the ribbon is ONE centreline path stroked many
 * times — widest dark, then a narrower ground-colour stroke to carve the gap, then
 * dark again … — so the concentric stripes follow every rounded corner exactly and
 * the round line-joins give the uniform Bauhaus bends for free. Authored in mm and
 * converted to media px via `geo.mm()`, so it holds at any size / DPI.
 *
 * `doc.props` (all optional): see `Props` — colours, stripe count/width/gap,
 * the three run heights, the two hairpin x-positions and the two disc placements.
 */

type Props = {
  /** Ribbon ink (the stripes). Default near-black. */
  ribbonColor?: string
  /** Ground / gap colour (carves the stripe gaps; should match the wall). Default white. */
  groundColor?: string
  /** Disc colour (the «naranja»). Default brand orange. */
  discColor?: string
  /** How many dark stripes across the ribbon. Default 5. */
  stripeCount?: number
  /** Visible width of each dark stripe, mm. Default 60. */
  stripeMm?: number
  /** Visible width of each gap between stripes, mm. Default 42. */
  gapMm?: number
  /** Centre-line heights of the three runs (top, middle, bottom), mm. */
  yTopMm?: number
  yMidMm?: number
  yBotMm?: number
  /** x of the right hairpin (top→mid) and the left hairpin (mid→bot), mm. */
  xRightMm?: number
  xLeftMm?: number
  /** Shared x of the two stacked discs, mm. Default centred between the hairpins. */
  discXMm?: number
  /** Thin connector between the two discs. Default true. */
  connector?: boolean
}

export function Cinta({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const ribbon = p.ribbonColor ?? '#161513' // near-black ink
  const ground = p.groundColor ?? '#ffffff'
  const orange = p.discColor ?? '#fe6d01'
  const nStripe = p.stripeCount ?? 5
  const D = p.stripeMm ?? 60
  const G = p.gapMm ?? 42

  const { trimWidthMm: W, trimHeightMm: H } = doc.dimensions
  const { bleedPx } = geo
  // mm (trim space) → media px
  const X = (xMm: number) => bleedPx + geo.mm(xMm)
  const Y = (yMm: number) => bleedPx + geo.mm(yMm)

  // ── Trail geometry (centre-line), mm ──────────────────────────────────────
  const yTop = p.yTopMm ?? 520
  const yMid = p.yMidMm ?? 1500
  const yBot = p.yBotMm ?? 2480
  const xRight = p.xRightMm ?? 7650 // right hairpin: top run U-turns down to the mid run
  const xLeft = p.xLeftMm ?? 3850 //  left hairpin: mid run U-turns down to the bottom run
  const rA = (yMid - yTop) / 2 // top↔mid hairpin radius
  const rB = (yBot - yMid) / 2 // mid↔bot hairpin radius
  const leadL = -300 // bleed off the left edge
  const leadR = W + 300 // bleed off the right edge

  // Centre-line in media px. Two 180° arcs (sweep 1 = turning down-and-back).
  const d = [
    `M ${X(leadL)} ${Y(yTop)}`,
    `L ${X(xRight)} ${Y(yTop)}`,
    `A ${geo.mm(rA)} ${geo.mm(rA)} 0 0 1 ${X(xRight)} ${Y(yMid)}`,
    `L ${X(xLeft)} ${Y(yMid)}`,
    `A ${geo.mm(rB)} ${geo.mm(rB)} 0 0 1 ${X(xLeft)} ${Y(yBot)}`,
    `L ${X(leadR)} ${Y(yBot)}`,
  ].join(' ')

  // ── Stripe stack: concentric stroke widths, widest→narrowest, alternating ──
  // ink / ground. Total ribbon width T = nStripe·D + (nStripe−1)·G.
  const T = nStripe * D + (nStripe - 1) * G
  const ribbonHalf = T / 2
  const layers: { w: number; color: string }[] = []
  let w = T
  let ink = true
  layers.push({ w: geo.mm(w), color: ribbon })
  // peel inward: ink ring is D wide, gap ring is G wide (per side ⇒ subtract 2×)
  while (w > 0.001) {
    w -= ink ? 2 * D : 2 * G
    ink = !ink
    if (w <= 0.001) break
    layers.push({ w: geo.mm(w), color: ink ? ribbon : ground })
  }

  // ── Two discs, tangent to the inner stripe of the runs they sit between ────
  const discX = p.discXMm ?? (xLeft + xRight) / 2
  const rDiscA = rA - ribbonHalf // tangent to top & mid inner stripes
  const rDiscB = rB - ribbonHalf // tangent to mid & bot inner stripes
  const discAY = (yTop + yMid) / 2
  const discBY = (yMid + yBot) / 2
  const connector = p.connector ?? true

  return (
    <svg
      width={geo.mediaWidthPx}
      height={geo.mediaHeightPx}
      viewBox={`0 0 ${geo.mediaWidthPx} ${geo.mediaHeightPx}`}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* ground */}
      <rect x={0} y={0} width={geo.mediaWidthPx} height={geo.mediaHeightPx} fill={ground} />

      {/* discs (under the ribbon, so the stripes overlap their edges = nestled) */}
      <circle cx={X(discX)} cy={Y(discAY)} r={geo.mm(rDiscA)} fill={orange} />
      <circle cx={X(discX)} cy={Y(discBY)} r={geo.mm(rDiscB)} fill={orange} />

      {/* the multi-stripe ribbon */}
      {layers.map((l, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={l.color}
          strokeWidth={l.w}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* thin connector linking the two discs (on top) */}
      {connector && (
        <line
          x1={X(discX)}
          y1={Y(discAY + rDiscA)}
          x2={X(discX)}
          y2={Y(discBY - rDiscB)}
          stroke={orange}
          strokeWidth={geo.mm(18)}
        />
      )}
    </svg>
  )
}
