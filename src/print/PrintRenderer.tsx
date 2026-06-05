import { createContext, useContext, type ReactNode } from 'react'
import { lightTheme, darkTheme, TEXT_FONT, type NeoTheme } from '@/lib/neumorphism'
import { NeoThemeProvider } from '@/stories/neo/NeoTheme'
import { buildGeometry, type PrintGeometry } from './geometry'
import type { PrintDoc } from './types'

/**
 * PrintStage
 * ──────────
 * The print "frame": sizes a canvas to the document's media (trim + bleed) in
 * pixels at its DPI, lights it with the doc's NeoTheme, exposes the geometry to
 * the page, and freezes every animation/transition so the still is stable and
 * deterministic. The page (children) fills the media — backgrounds bleed to the
 * edge; content insets itself by `geo.bleedPx + geo.safeMarginPx`.
 *
 * Fonts: this component is context-agnostic and does NOT inject @font-face. In the
 * Vite app the faces come from `src/index.css`; in the Remotion export the
 * PrintPage composition wraps this with <Fonts/> (which uses `staticFile`).
 */

const PrintGeometryContext = createContext<PrintGeometry | null>(null)

export function usePrintGeometry(): PrintGeometry {
  const geo = useContext(PrintGeometryContext)
  if (!geo) throw new Error('usePrintGeometry must be used inside <PrintStage>')
  return geo
}

const THEME_MAP: Record<string, NeoTheme> = { light: lightTheme, dark: darkTheme }

/** Kill motion so a single frame is the whole, stable picture. */
const FREEZE_CSS =
  '*,*::before,*::after{animation:none!important;animation-duration:0s!important;' +
  'transition:none!important;caret-color:transparent!important;}'

/**
 * A sub-rectangle of the full media to render in isolation — a *render-tile*. The
 * page still lays out at full media size; the stage crops the composition to
 * `[x, x+width) × [y, y+height)` by translating the media canvas. The export
 * pipeline uses this to render wall-sized prints in a grid of abutting tiles
 * (no overlap), past Chrome's single-screenshot pixel limit, then stitches them
 * back losslessly. Omit for a whole-media render.
 */
export type PrintViewport = { xPx: number; yPx: number; widthPx: number; heightPx: number }

export type PrintStageProps = {
  doc: PrintDoc
  children: ReactNode
  /** Preview-only trim/safe guides. NEVER rendered in export. Default false. */
  showGuides?: boolean
  /** Render only this sub-rectangle of the media (a render-tile). Omit for whole. */
  viewport?: PrintViewport
}

export function PrintStage({ doc, children, showGuides = false, viewport }: PrintStageProps) {
  const geo = buildGeometry(doc.dimensions, doc.dpi)
  const theme = THEME_MAP[doc.theme] ?? lightTheme

  // The full-media canvas. Whole-media render: it IS the composition (relative).
  // Render-tile: it's translated by −viewport so the requested window lands at the
  // composition origin, then cropped by the viewport wrapper below.
  const media = (
    <div
      style={{
        position: viewport ? 'absolute' : 'relative',
        left: viewport ? -viewport.xPx : undefined,
        top: viewport ? -viewport.yPx : undefined,
        width: geo.mediaWidthPx,
        height: geo.mediaHeightPx,
        backgroundColor: doc.surface ?? theme.surface,
        color: theme.textStrong,
        fontFamily: TEXT_FONT,
        overflow: 'hidden',
      }}
    >
      <style>{FREEZE_CSS}</style>
      {children}
      {doc.dimensions.cropMarks && <CropMarks geo={geo} />}
      {showGuides && <Guides geo={geo} />}
    </div>
  )

  return (
    <NeoThemeProvider theme={theme}>
      <PrintGeometryContext.Provider value={geo}>
        {viewport ? (
          <div style={{ position: 'relative', width: viewport.widthPx, height: viewport.heightPx, overflow: 'hidden' }}>
            {media}
          </div>
        ) : (
          media
        )}
      </PrintGeometryContext.Provider>
    </NeoThemeProvider>
  )
}

/**
 * Convenience: an absolutely-positioned layer inset to the safe area (trim +
 * safe margin). Place body content inside it; let backgrounds bleed outside it.
 */
export function PrintSafeArea({
  children,
  style,
}: {
  children?: ReactNode
  style?: React.CSSProperties
}) {
  const geo = usePrintGeometry()
  const inset = geo.bleedPx + geo.safeMarginPx
  return (
    <div style={{ position: 'absolute', left: inset, top: inset, right: inset, bottom: inset, ...style }}>
      {children}
    </div>
  )
}

/* ── crop marks (printed) ──────────────────────────────────────────────────── */

/**
 * Printer's crop marks at the four trim corners, drawn in the bleed area in
 * registration black. Each corner gets a vertical + horizontal tick that sits
 * just outside the trim. Needs bleed room (`len`); clipped by the media edge if
 * the bleed is smaller than the mark length.
 */
function CropMarks({ geo }: { geo: PrintGeometry }) {
  const { mm, pt } = geo
  const w = Math.max(1, pt(0.5)) // hairline ~0.5pt, but never below 1 device px
  const len = mm(3)
  const gap = 0
  const trimL = geo.bleedPx
  const trimT = geo.bleedPx
  const trimR = geo.bleedPx + geo.trimWidthPx
  const trimB = geo.bleedPx + geo.trimHeightPx
  const color = '#000000'

  const seg = (left: number, top: number, width: number, height: number, key: string) => (
    <div key={key} style={{ position: 'absolute', left, top, width, height, background: color }} />
  )
  const vline = (x: number, yStart: number, key: string) =>
    seg(x - w / 2, yStart, w, len, key)
  const hline = (y: number, xStart: number, key: string) =>
    seg(xStart, y - w / 2, len, w, key)

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* top-left */}
      {vline(trimL, trimT - gap - len, 'tl-v')}
      {hline(trimT, trimL - gap - len, 'tl-h')}
      {/* top-right */}
      {vline(trimR, trimT - gap - len, 'tr-v')}
      {hline(trimT, trimR + gap, 'tr-h')}
      {/* bottom-left */}
      {vline(trimL, trimB + gap, 'bl-v')}
      {hline(trimB, trimL - gap - len, 'bl-h')}
      {/* bottom-right */}
      {vline(trimR, trimB + gap, 'br-v')}
      {hline(trimB, trimR + gap, 'br-h')}
    </div>
  )
}

/* ── preview guides (never exported) ───────────────────────────────────────── */

function Guides({ geo }: { geo: PrintGeometry }) {
  const dash = Math.max(2, geo.mm(1))
  const stroke = Math.max(1, geo.mm(0.25))
  const box = (inset: number, color: string): React.CSSProperties => ({
    position: 'absolute',
    left: geo.bleedPx + inset,
    top: geo.bleedPx + inset,
    width: geo.trimWidthPx - 2 * inset,
    height: geo.trimHeightPx - 2 * inset,
    outline: `${stroke}px dashed ${color}`,
    outlineOffset: 0,
    pointerEvents: 'none',
  })
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* trim */}
      <div style={{ ...box(0, 'rgba(22,179,207,0.9)'), borderRadius: 0, backgroundSize: `${dash}px ${dash}px` }} />
      {/* safe margin */}
      {geo.safeMarginPx > 0 && <div style={box(geo.safeMarginPx, 'rgba(255,45,85,0.8)')} />}
    </div>
  )
}
