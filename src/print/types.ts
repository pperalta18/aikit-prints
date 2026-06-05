import type { ReactNode } from 'react'
import type { PrintGeometry } from './geometry'

/**
 * Print document model
 * ────────────────────
 * A print is a JSON spec (`public/prints/<id>/doc.json`) + a React page component
 * registered under `pageComponentId`. The spec is the single source of truth for
 * both the on-screen preview and the print canvas: dimensions (mm), bleed, DPI and
 * colour all live here, so the same doc renders identically in the app and in the
 * deterministic Remotion `renderStill` export. See `specs/print-generator.md`.
 */

export type PrintTheme = 'light' | 'dark'
export type PrintColorMode = 'cmyk' | 'rgb'
/** PDF/X conformance level. X-1a = max compatibility (PDF 1.3); X-4 = modern. */
export type PdfxVariant = 'x1a' | 'x4'
/**
 * sRGB→CMYK gamut-mapping rendering intent (ICC). For our flat, vivid brand
 * graphics `relative` (clip only out-of-gamut colours, keep in-gamut at full
 * strength) or `saturation` (max punch) preserve the most vivacity; `perceptual`
 * compresses the whole gamut inward and looks duller — prefer it only for photos.
 */
export type RenderIntent = 'perceptual' | 'relative' | 'saturation' | 'absolute'

export type PrintDimensions = {
  /** Finished (cut) width in millimetres. */
  trimWidthMm: number
  /** Finished (cut) height in millimetres. */
  trimHeightMm: number
  /** Bleed on every side in mm — art extends this far past the trim. Default 0. */
  bleedMm: number
  /** Keep-clear margin inside the trim, in mm. Default 0. */
  safeMarginMm: number
  /** Draw printer's crop marks in the bleed area. Default false. */
  cropMarks: boolean
}

export type PrintColor = {
  mode: PrintColorMode
  /**
   * Path to the CMYK output ICC profile under `public/`, e.g.
   * `icc/CoatedFOGRA39.icc`. This is the single biggest lever on print
   * vivacity — a narrow-gamut profile (the old Apple `GenericCMYK.icc`)
   * desaturates badly. Default is a coated FOGRA39 placeholder; drop the
   * print shop's real profile into `public/icc/` and point here for the run.
   */
  iccProfile: string
  /** sRGB→CMYK rendering intent. Default `relative`. */
  renderIntent?: RenderIntent
  pdfxVariant: PdfxVariant
}

export type PrintDoc = {
  id: string
  title: string
  /** ISO timestamp. */
  createdAt: string
  /** Key into the page registry (`src/print/pages/index.ts`). */
  pageComponentId: string
  theme: PrintTheme
  /**
   * Optional wall-ground override (any CSS colour). When set it replaces the
   * themed `surface` painted full-bleed by `PrintStage` — e.g. a warm cream to
   * make a "looking at the past" wall read as aged paper instead of the default
   * cool white. Pages that paint their own ground read it too (`doc.surface ??
   * <own default>`). Leave unset for the standard themed surface.
   */
  surface?: string
  dimensions: PrintDimensions
  /** Render resolution. Print floor + default is 300. */
  dpi: number
  color: PrintColor
  /** Page-specific data passed to the page component. Images referenced by path. */
  props?: Record<string, unknown>
}

/** Props every print page component receives. */
export type PrintPageProps = {
  doc: PrintDoc
  geo: PrintGeometry
}

export type PrintPageComponent = (props: PrintPageProps) => ReactNode

/** A lightweight row for the index view (`public/prints/index.json`). */
export type PrintIndexEntry = {
  id: string
  title: string
  thumb?: string
  dimensions: PrintDimensions
  dpi: number
  updatedAt: string
}
