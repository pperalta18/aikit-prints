import type { PrintPageProps } from '../types'
import { KIT_BLUE } from '@/lib/neumorphism'
import { bandRows, bandColumns, bandCellOpacity } from './banda'

/**
 * banda — the «friso continuo» horizontal mosaic band (alcoba TV: inv 16 + 27–31).
 * ──────────────────────────────────────────────────────────────────────────
 * One horizontal stripe of scattered brand-blue cells — the same mosaic language
 * as `columnas`, but a single band that **wraps the alcove walls as one
 * continuous frieze**. The band sits at a fixed height on every wall (its top a
 * set distance below the wall top) and is a fixed thickness; its cells are
 * anchored to a **global world coordinate** (baked per-print as `originMm` +
 * `dir`), so collinear faces paint the same cells where they meet and the mosaic
 * flows across the seam instead of restarting per panel.
 *
 * Pure SVG (a flat blue `<rect>` per non-empty cell), authored in `geo` units so
 * it holds at print scale at any size / DPI. All the geometry (the global cell
 * grid) and the seam-matching opacity field are the unit-tested maths in
 * `banda.ts`; this file only paints it.
 */

type Props = {
  /** Band top, mm from the trim (print) top. Default 300 (0.3 m). */
  bandTopMm?: number
  /** Band thickness, mm. Default 300 (0.3 m). */
  bandHeightMm?: number
  /** Square cell module, mm. Default 12.5 (matches the `columnas` mosaico fino). */
  gridMm?: number
  /** World run coordinate (mm) at the print's left trim edge — baked per print. */
  originMm?: number
  /** World-run change (mm) per +1 mm local left→right (+1/−1) — baked per print. */
  dir?: 1 | -1
  /** The brand colour for the cells. Default KIT_BLUE. */
  color?: string
  /** Fraction of cells left empty (opacity 0). Default 0.7. */
  emptyFrac?: number
  /** Lowest opacity a filled cell may take. Default 0.1. */
  minOpacity?: number
  /** Highest opacity a filled cell may take. Default 1. */
  maxOpacity?: number
  /** Field seed — shared across the whole frieze; same seed ⇒ same field. Default 16. */
  seed?: number
}

export function Banda({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const bandTopMm = p.bandTopMm ?? 300
  const bandHeightMm = p.bandHeightMm ?? 300
  const gridMm = p.gridMm ?? 12.5
  const originMm = p.originMm ?? 0
  const dir: 1 | -1 = p.dir === -1 ? -1 : 1
  const color = p.color ?? KIT_BLUE
  const emptyFrac = p.emptyFrac ?? 0.7
  const minOpacity = p.minOpacity ?? 0.1
  const maxOpacity = p.maxOpacity ?? 1
  const seed = p.seed ?? 16

  const { bleedMm } = doc.dimensions
  const { mediaWidthPx: W, mediaHeightPx: H } = geo
  const mediaWidthMm = doc.dimensions.trimWidthMm + 2 * bleedMm

  const rows = bandRows({ bandTopMm, bandHeightMm, gridMm, bleedMm })
  const cols = bandColumns({ mediaWidthMm, bleedMm, originMm, dir, gridMm })

  // One <rect> per *filled* cell (skip the empties — they're just white ground).
  const cells: { key: string; x: number; y: number; w: number; h: number; o: number }[] = []
  for (const r of rows) {
    const y = geo.mm(r.y0Mm)
    const h = geo.mm(r.y1Mm) - y
    for (const c of cols) {
      const o = bandCellOpacity({ col: c.globalCol, row: r.row, seed, emptyFrac, minOpacity, maxOpacity })
      if (o <= 0) continue
      const x = geo.mm(c.x0Mm)
      cells.push({ key: `${r.row}-${c.globalCol}`, x, y, w: geo.mm(c.x1Mm) - x, h, o })
    }
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', inset: 0 }}
      shapeRendering="crispEdges"
    >
      <g fill={color}>
        {cells.map((cell) => (
          <rect key={cell.key} x={cell.x} y={cell.y} width={cell.w} height={cell.h} fillOpacity={cell.o} />
        ))}
      </g>
    </svg>
  )
}
