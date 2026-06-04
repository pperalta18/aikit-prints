import type { PrintPageProps } from '../types'

/**
 * solid — a full-bleed flat colour field.
 * ───────────────────────────────────────
 * Paints one solid colour edge-to-edge over the whole media (trim + bleed), so the
 * print reads as a single flat brand colour. Like `blank`, but with a chosen fill
 * instead of the themed surface. Pass the colour as `props.fill` (any CSS colour —
 * use a brand secondary, e.g. `BRAND.violet` `#b84fed`, from `@/lib/neumorphism`).
 * With no fill it draws nothing, so the themed surface shows through (== `blank`).
 *
 * Flat, vivid brand colour → author the doc with `color.renderIntent: 'relative'`
 * (or `'saturation'`), not `'perceptual'`: the sRGB→CMYK conversion should clip only
 * the out-of-gamut bits and keep the colour at full strength, not dull the whole
 * gamut (see `PrintColor` in `../types`).
 */
export function Solid({ doc }: PrintPageProps) {
  const fill = (doc.props as { fill?: string } | undefined)?.fill
  if (!fill) return null
  return <div style={{ position: 'absolute', inset: 0, backgroundColor: fill }} />
}
