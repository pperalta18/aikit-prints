import type { PrintPageProps } from '../types'
import { KIT_BLUE } from '@/lib/neumorphism'
import { layoutColumns, tickPositions, cellOpacities } from './columnas'

/**
 * columnas — the «dos columnas» wall (19-S-1).
 * ──────────────────────────────────────────────────────────────────────────
 * Two tall, slender bands centred on the wall, each filled to the **full height**
 * with a mosaic of square brand-blue cells. No continuous gradient, no ruling
 * lines: every cell is a flat brand-blue tile with its own **opacity** — a good
 * share are empty (opacity 0), the rest take a random opacity in (0, 1] — so each
 * column reads as a scattered blue tapestry. The scatter is seeded, so the
 * preview, the export and the PDF are identical (change `seed` to reshuffle).
 *
 * Pure SVG (a flat blue `<rect>` per non-empty cell), authored in `geo` units so
 * it holds at print scale at any size / DPI. The layout (centring, the cell
 * module) and the opacity field are the pure, unit-tested maths in `columnas.ts`;
 * this file only paints it.
 */

type Props = {
  /** How many columns. Default 2. */
  count?: number
  /** Each column's width in mm. Default 1150 (1.15 m). */
  columnWidthMm?: number
  /** Air between adjacent columns in mm. Default 1000 (1 m). */
  gapMm?: number
  /** The square cell module in mm. Default 12.5 (divides 1150 & 3000 cleanly → a closed grid). */
  gridMm?: number
  /** The brand colour for the cells. Default KIT_BLUE. */
  color?: string
  /** Fraction of cells left empty (opacity 0). Default 0.7. */
  emptyFrac?: number
  /** Lowest opacity a filled cell may take. Default 0.1. */
  minOpacity?: number
  /** Highest opacity a filled cell may take. Default 1. */
  maxOpacity?: number
  /** PRNG seed — change it to reshuffle the scatter; same seed ⇒ same field. Default 1. */
  seed?: number
}

/** Distinct per-column seed offset so the two columns scatter differently (a prime). */
const COLUMN_SEED_STRIDE = 9973

export function Columnas({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const count = p.count ?? 2
  const columnWidthMm = p.columnWidthMm ?? 1150
  const gapMm = p.gapMm ?? 1000
  const gridMm = p.gridMm ?? 12.5
  const color = p.color ?? KIT_BLUE
  const emptyFrac = p.emptyFrac ?? 0.7
  const minOpacity = p.minOpacity ?? 0.1
  const maxOpacity = p.maxOpacity ?? 1
  const seed = p.seed ?? 1

  const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions
  const { mediaWidthPx: W, mediaHeightPx: H, bleedPx } = geo

  const layout = layoutColumns({ trimWidthMm, count, columnWidthMm, gapMm })

  // Horizontal cell boundaries: anchored to the floor (trim bottom), extended one
  // module past the media top & bottom so the mosaic covers the bleed (SVG clips).
  const floorFromMediaTopMm = bleedMm + trimHeightMm
  const mediaHeightMm = trimHeightMm + 2 * bleedMm
  const rowEdgesPx = tickPositions({
    originMm: floorFromMediaTopMm,
    moduleMm: gridMm,
    minMm: -gridMm,
    maxMm: mediaHeightMm + gridMm,
  }).map((yMm) => geo.mm(yMm))
  const nRows = rowEdgesPx.length - 1

  const columns = layout.columnLeftsMm.map((leftMm, i) => {
    // Vertical cell boundaries across the column (both edges inclusive → closed).
    const colEdgesPx = tickPositions({
      originMm: leftMm,
      moduleMm: gridMm,
      minMm: leftMm,
      maxMm: leftMm + columnWidthMm,
    }).map((xMm) => bleedPx + geo.mm(xMm))
    const nCols = colEdgesPx.length - 1

    // The deterministic opacity for every cell (row-major), distinct per column.
    const op = cellOpacities({
      count: nCols * nRows,
      seed: seed + i * COLUMN_SEED_STRIDE,
      emptyFrac,
      minOpacity,
      maxOpacity,
    })

    // One <rect> per *filled* cell (skip the empties — they're just white ground).
    const cells: { key: string; x: number; y: number; w: number; h: number; o: number }[] = []
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const o = op[r * nCols + c]
        if (o <= 0) continue
        const x = colEdgesPx[c]
        const y = rowEdgesPx[r]
        cells.push({ key: `${r}-${c}`, x, y, w: colEdgesPx[c + 1] - x, h: rowEdgesPx[r + 1] - y, o })
      }
    }
    return { i, cells }
  })

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', inset: 0 }}
      shapeRendering="crispEdges"
    >
      {columns.map((col) => (
        <g key={col.i} fill={color}>
          {col.cells.map((cell) => (
            <rect key={cell.key} x={cell.x} y={cell.y} width={cell.w} height={cell.h} fillOpacity={cell.o} />
          ))}
        </g>
      ))}
    </svg>
  )
}
