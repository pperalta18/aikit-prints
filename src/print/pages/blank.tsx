import type { PrintPageProps } from '../types'

/**
 * blank — an empty print page.
 * ────────────────────────────
 * Draws nothing. The `PrintStage` already paints the doc's themed surface to the
 * full media (trim + bleed), so a blank page is a correctly-dimensioned,
 * press-ready empty canvas. This is the reusable "marco vacío": author a
 * `doc.json` at the real wall size, point `pageComponentId` here, and design into
 * it later (swap to a real page, or to `raster-wall` once the art exists).
 */
export function Blank(_props: PrintPageProps) {
  return null
}
