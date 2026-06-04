/**
 * cuadro — pure layout maths for the **museum-painting** print page.
 * ──────────────────────────────────────────────────────────────────────────
 * A wall hung like a gallery: one allegorical relief (the protagonist image)
 * with a fine museum *cartela* (label) beside it. This module turns the wall
 * size + the painting's proportion into the two physical boxes — the framed
 * painting and the cartela column — laid out as a single centred group with
 * generous gallery air on both sides. JSX-free so it unit-tests in the node
 * project (same split as `umbral.ts` / `hero-solar.ts`); the component
 * (`cuadro.tsx`) only renders the boxes and sizes the cartela type.
 *
 * Coordinates are millimetres from the trim origin (top-left of the cut page).
 * The painting keeps its true aspect (the reliefs are ~2:3 portrait), so on a
 * wide wall it reads as a hung artwork, not a stretched mural — and the visitor
 * steps closer to read the label. The cartela box gets the painting's full
 * height; the page flex-centres the label text inside it.
 */

/** Which side of the group the painting hangs on (cartela takes the other). */
export type CuadroPlacement = 'left' | 'right'

/** A positioned rectangle in millimetres from the trim origin. */
export type CuadroBox = { x: number; y: number; width: number; height: number }

export type CuadroLayoutOpts = {
  /** Wall (trim) width in mm. */
  wallWidthMm: number
  /** Wall (trim) height in mm. */
  wallHeightMm: number
  /** Painting width ÷ height (e.g. 2/3 ≈ 0.667 for the portrait reliefs). */
  paintingAspect: number
  /** Painting height as a fraction of the wall height, in (0, 1]. */
  paintingHeightFraction: number
  /** Cartela (museum label) column width in mm. */
  cartelaWidthMm: number
  /** Gap between the painting and the cartela in mm. */
  gapMm: number
  /** Which side the painting hangs on. Default 'left' (reads painting → label). */
  placement?: CuadroPlacement
}

export type CuadroLayout = {
  /** The framed painting box. */
  painting: CuadroBox
  /** The cartela (label) column box — full painting height; text centres inside. */
  cartela: CuadroBox
  /** The whole [painting · gap · cartela] group, horizontally centred on the wall. */
  group: { x: number; width: number }
}

const PLACEMENTS: readonly CuadroPlacement[] = ['left', 'right']

function pos(name: string, v: number): number {
  if (!Number.isFinite(v) || v <= 0) throw new Error(`layoutCuadro: ${name} must be a positive finite number (got ${v})`)
  return v
}

/**
 * Resolve the painting + cartela boxes for a museum-painting wall.
 *
 * The painting is sized to a fraction of the wall height and its true aspect;
 * the cartela rides beside it at the same height. The [painting · gap · cartela]
 * group is centred horizontally so equal gallery air frames it. Deterministic;
 * throws on non-positive inputs, a fraction outside (0, 1], an unknown placement,
 * or a group too wide to fit the wall.
 */
export function layoutCuadro(opts: CuadroLayoutOpts): CuadroLayout {
  const wallWidthMm = pos('wallWidthMm', opts.wallWidthMm)
  const wallHeightMm = pos('wallHeightMm', opts.wallHeightMm)
  const paintingAspect = pos('paintingAspect', opts.paintingAspect)
  const cartelaWidthMm = pos('cartelaWidthMm', opts.cartelaWidthMm)
  const gapMm = pos('gapMm', opts.gapMm)
  const frac = opts.paintingHeightFraction
  if (!(frac > 0 && frac <= 1)) {
    throw new Error(`layoutCuadro: paintingHeightFraction must be in (0, 1] (got ${frac})`)
  }
  const placement = opts.placement ?? 'left'
  if (!PLACEMENTS.includes(placement)) {
    throw new Error(`layoutCuadro: placement must be 'left' | 'right' (got ${placement})`)
  }

  const paintingH = wallHeightMm * frac
  const paintingW = paintingH * paintingAspect
  const groupW = paintingW + gapMm + cartelaWidthMm
  if (groupW > wallWidthMm) {
    throw new Error(
      `layoutCuadro: group (${groupW.toFixed(1)} mm) is wider than the wall (${wallWidthMm} mm) — ` +
        `shrink the painting, cartela or gap`,
    )
  }

  const groupX = (wallWidthMm - groupW) / 2
  const y = (wallHeightMm - paintingH) / 2

  const paintingX = placement === 'left' ? groupX : groupX + cartelaWidthMm + gapMm
  const cartelaX = placement === 'left' ? groupX + paintingW + gapMm : groupX

  return {
    painting: { x: paintingX, y, width: paintingW, height: paintingH },
    cartela: { x: cartelaX, y, width: cartelaWidthMm, height: paintingH },
    group: { x: groupX, width: groupW },
  }
}
