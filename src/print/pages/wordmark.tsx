import { type CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { PrintPageProps } from '../types'

/**
 * wordmark — a single logo/wordmark centred on the wall.
 * ──────────────────────────────────────────────────────
 * A press-ready "statement" wall: one committed image (SVG/PNG) centred at a
 * controlled physical size over the themed surface (or `doc.surface`). Reusable —
 * a doc just points `props.src` at its committed asset. First used by 13-S-1 (the
 * «La Naranja Mecánica» wordmark on the back face of the Naranja-Mecánica wall).
 *
 * Unlike `raster-wall` (full-bleed `cover`/`contain`) the image keeps its aspect
 * ratio AND a deliberate margin: it is sized to `maxWidthMm` and centred, so a
 * wordmark reads as a mark on the wall, not edge-to-edge artwork.
 *
 * `doc.props`:
 *   • `src`              path relative to `public/` (staticFile). Absent → the
 *                        convention `prints/<id>/assets/<id>.svg`.
 *   • `alt`              description (accessibility / sources note).
 *   • `maxWidthMm`       mark width in mm. Default: 60 % of the trim width.
 *   • `alignX`           horizontal edge: 'left' | 'center' | 'right'. When set it
 *                        flushes the mark to that edge of the trim, overriding
 *                        `centerXFraction`. Default 'center'.
 *   • `marginXMm`        inset (mm) from the aligned edge when `alignX` is
 *                        left/right. Default 0 (flush). Ignored when centred.
 *   • `centerXFraction`  horizontal placement (0..1). Default 0.5.
 *   • `centerYFraction`  vertical placement (0..1). Default 0.5.
 */

type Props = {
  src?: string
  alt?: string
  maxWidthMm?: number
  alignX?: 'left' | 'center' | 'right'
  marginXMm?: number
  centerXFraction?: number
  centerYFraction?: number
}

export function Wordmark({ doc, geo }: PrintPageProps) {
  const p = (doc.props ?? {}) as Props
  const rawSrc = typeof p.src === 'string' && p.src.trim() ? p.src : `prints/${doc.id}/assets/${doc.id}.svg`
  const src = staticFile(rawSrc.replace(/^\/+/, '').replace(/^public\//, ''))
  const widthMm = typeof p.maxWidthMm === 'number' ? p.maxWidthMm : geo.dims.trimWidthMm * 0.6
  const cx = typeof p.centerXFraction === 'number' ? p.centerXFraction : 0.5
  const cy = typeof p.centerYFraction === 'number' ? p.centerYFraction : 0.5
  const alignX = p.alignX === 'left' || p.alignX === 'right' ? p.alignX : 'center'
  const marginX = typeof p.marginXMm === 'number' ? geo.mm(p.marginXMm) : 0
  const imgStyle: CSSProperties = { width: '100%', height: 'auto', display: 'block' }
  // Horizontal anchoring: inset from a trim edge by `marginXMm` for left/right,
  // else centre on `centerXFraction`. Vertical placement stays on `centerYFraction`.
  const horiz: CSSProperties =
    alignX === 'left'
      ? { left: marginX, transform: 'translateY(-50%)' }
      : alignX === 'right'
        ? { right: marginX, transform: 'translateY(-50%)' }
        : { left: `${cx * 100}%`, transform: 'translate(-50%, -50%)' }

  return (
    <div style={{ position: 'absolute', left: geo.bleedPx, top: geo.bleedPx, width: geo.trimWidthPx, height: geo.trimHeightPx }}>
      <div
        style={{
          position: 'absolute',
          top: `${cy * 100}%`,
          width: geo.mm(widthMm),
          ...horiz,
        }}
      >
        {/* Remotion's <Img> delays the still until the bitmap decodes (export);
            a bare <img> is correct + crash-free in the live preview. */}
        {getRemotionEnvironment().isRendering ? (
          <Img src={src} alt={p.alt ?? ''} style={imgStyle} />
        ) : (
          <img src={src} alt={p.alt ?? ''} style={imgStyle} />
        )}
      </div>
    </div>
  )
}
