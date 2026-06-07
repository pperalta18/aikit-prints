import type { PrintPageProps, PrintDoc, PrintDimensions, PrintTheme } from '../types'
import { PrintStage } from '../PrintRenderer'
import { buildGeometry } from '../geometry'
import { getPrintPage } from './index'

/**
 * Pared combinada — several per-zone wall prints joined into ONE wall-sized print.
 * ──────────────────────────────────────────────────────────────────────────────
 * A wall in the nave is split into zone panels (e.g. 2-E → IMAGE · TEXT+CODE ·
 * INVERSIÓN), each authored + exported as its own print. For the printer we
 * sometimes want the WHOLE wall as a single deliverable: this page packs the zone
 * prints side by side, in the order they read when you stand facing the wall, each
 * at its real width, full wall height — the panels butt edge to edge (the zones
 * are contiguous on the wall, so there is no gutter between them).
 *
 * Each child is rendered live (same `page({doc,geo})` path as everywhere else)
 * inside its OWN `<PrintStage>`, at the COMPOSITE's render dpi (`geo.dpi`), so the
 * combined print is pixel-faithful in both the live preview (low dpi) and the
 * export (150 dpi). The child's bleed is cropped at the interior seams (the panels
 * touch) and kept at the wall's outer edges (so the deliverable still bleeds).
 *
 * `doc.props.children`: the panels in left→right order — see {@link ParedChild}.
 * The combined `doc.dimensions.trimWidthMm` MUST equal the sum of the children's
 * `trimWidthMm`; the height is shared (the wall height).
 */

/** One zone panel packed into the wall, given in left→right (as-viewed) order. */
export type ParedChild = {
  /** Source print id — for reference/debugging only. */
  id?: string
  /** Page registered under this id renders the panel. */
  pageComponentId: string
  /** Panel theme (defaults to the composite's). */
  theme?: PrintTheme
  /** Optional ground override (defaults to the panel theme's surface). */
  surface?: string
  /** The panel's trim width (mm) — its slice of the wall. */
  trimWidthMm: number
  /** Panel bleed (mm) — defaults to the composite bleed. */
  bleedMm?: number
  /** Page-specific props, copied verbatim from the source doc. */
  props?: Record<string, unknown>
}

type Props = { children?: ParedChild[] }

export function ParedCombinada({ doc, geo }: PrintPageProps) {
  const { children = [] } = (doc.props ?? {}) as Props
  const dpi = geo.dpi
  const mm = geo.mm
  const compBleedPx = geo.bleedPx
  const trimHeightMm = doc.dimensions.trimHeightMm
  const last = children.length - 1

  // Walk the panels left→right, tracking the cumulative trim offset (mm).
  let cumTrimMm = 0

  return (
    <>
      {children.map((child, i) => {
        const leftTrimMm = cumTrimMm
        cumTrimMm += child.trimWidthMm

        const childBleedMm = child.bleedMm ?? doc.dimensions.bleedMm
        const childDims: PrintDimensions = {
          trimWidthMm: child.trimWidthMm,
          trimHeightMm,
          bleedMm: childBleedMm,
          safeMarginMm: 0,
          cropMarks: false,
        }
        const childDoc: PrintDoc = {
          ...doc,
          id: child.id ?? `${doc.id}-${i}`,
          pageComponentId: child.pageComponentId,
          theme: child.theme ?? doc.theme,
          surface: child.surface,
          dimensions: childDims,
          dpi,
          props: child.props ?? {},
        }
        const childGeo = buildGeometry(childDims, dpi)
        const page = getPrintPage(child.pageComponentId)

        // Place the panel so its TRIM origin lands at the composite trim seam.
        const trimLeftPx = compBleedPx + mm(leftTrimMm)
        const childMediaLeft = trimLeftPx - childGeo.bleedPx
        const childMediaTop = compBleedPx - childGeo.bleedPx // 0 when bleeds match

        // Clip window: cut the panel's bleed at interior seams (panels touch),
        // keep it at the wall's outer edges so the deliverable still bleeds.
        const x0 = i === 0 ? 0 : trimLeftPx
        const x1 = i === last ? geo.mediaWidthPx : trimLeftPx + childGeo.trimWidthPx

        return (
          <div
            key={childDoc.id}
            style={{ position: 'absolute', left: x0, top: 0, width: x1 - x0, height: geo.mediaHeightPx, overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', left: childMediaLeft - x0, top: childMediaTop }}>
              <PrintStage doc={childDoc}>{page ? page({ doc: childDoc, geo: childGeo }) : null}</PrintStage>
            </div>
          </div>
        )
      })}
    </>
  )
}
