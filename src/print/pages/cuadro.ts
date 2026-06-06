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
  /**
   * Hang **two** reliefs on the wall instead of one. When set, `placement` is
   * ignored and the wall is laid out as a symmetric diptych: the two paintings are
   * centred on the wall's quarter-points. By default the cartela floats dead-centre
   * between them; with {@link dualCartela} each relief gets its own label instead
   * (see {@link layoutCuadro}). Used by the wide 8-N-1 feature wall.
   */
  secondPainting?: boolean
  /**
   * Give **each** relief of a diptych its own cartela (only meaningful with
   * `secondPainting`). The two paintings stay on the wall's quarter-points and each
   * label hangs `gapMm` to its *inner* side — so the wall reads as two independent
   * museum cuadros (relief · ½ m · label) facing the centre, instead of one shared
   * central label. Default `false` (the original single centred cartela).
   */
  dualCartela?: boolean
}

export type CuadroLayout = {
  /** The framed painting box. */
  painting: CuadroBox
  /** The second painting box — only present when `secondPainting` was requested. */
  painting2?: CuadroBox
  /** The cartela (label) column box — full painting height; text centres inside. */
  cartela: CuadroBox
  /** The second cartela box — only present for a `dualCartela` diptych (labels painting 2). */
  cartela2?: CuadroBox
  /** The whole hung group, horizontally centred on the wall. */
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
 * group is centred horizontally so equal gallery air frames it.
 *
 * With `secondPainting`, the wall becomes a symmetric **diptych**: two reliefs of
 * the same size centred on the wall's quarter-points (so they spread evenly across
 * the run). By default the cartela floats dead-centre between them (`placement`/`gapMm`
 * ignored); with `dualCartela` each relief instead gets its own label hung `gapMm` to
 * its inner side, so the wall reads as two independent cuadros. Deterministic; throws
 * on non-positive inputs, a fraction outside (0, 1], an unknown placement, a group too
 * wide to fit the wall, or a diptych whose paintings overflow / collide with the cartela(s).
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
  const y = (wallHeightMm - paintingH) / 2

  // ── diptych: two reliefs, evenly distributed, cartela centred between them ──
  // The wall carries two works hung symmetrically about its centre: each painting
  // is centred on a wall quarter-point (¼ and ¾ of the run) so they read as evenly
  // spread across the run, and the museum label floats dead-centre between them.
  if (opts.secondPainting) {
    const p1x = wallWidthMm * 0.25 - paintingW / 2
    const p2x = wallWidthMm * 0.75 - paintingW / 2
    if (p1x < 0 || p2x + paintingW > wallWidthMm) {
      throw new Error(`layoutCuadro: diptych paintings (${paintingW.toFixed(1)} mm) overflow the wall (${wallWidthMm} mm)`)
    }
    const painting = { x: p1x, y, width: paintingW, height: paintingH }
    const painting2 = { x: p2x, y, width: paintingW, height: paintingH }
    const group = { x: p1x, width: p2x + paintingW - p1x }

    // ── dual cartela: two independent cuadros, each label hung gapMm to its inner side ──
    // (relief · gap · label) on the left, mirrored (label · gap · relief) on the right, so
    // each cartela sits beside its own work and the wall reads as a matched pair.
    if (opts.dualCartela) {
      const cartela1X = p1x + paintingW + gapMm // inner (right) side of relief 1
      const cartela2X = p2x - gapMm - cartelaWidthMm // inner (left) side of relief 2
      if (cartela1X + cartelaWidthMm > cartela2X) {
        throw new Error(
          `layoutCuadro: dual cartelas (${cartelaWidthMm.toFixed(1)} mm) collide in the centre — narrow the cartela or the gap`,
        )
      }
      return {
        painting,
        painting2,
        cartela: { x: cartela1X, y, width: cartelaWidthMm, height: paintingH },
        cartela2: { x: cartela2X, y, width: cartelaWidthMm, height: paintingH },
        group,
      }
    }

    // ── single centred cartela floating dead-centre between the two reliefs ──
    const cartelaX = (wallWidthMm - cartelaWidthMm) / 2
    if (p1x + paintingW > cartelaX || cartelaX + cartelaWidthMm > p2x) {
      throw new Error(`layoutCuadro: diptych cartela overlaps a painting — widen the wall or narrow the cartela`)
    }
    return {
      painting,
      painting2,
      cartela: { x: cartelaX, y, width: cartelaWidthMm, height: paintingH },
      group,
    }
  }

  const groupW = paintingW + gapMm + cartelaWidthMm
  if (groupW > wallWidthMm) {
    throw new Error(
      `layoutCuadro: group (${groupW.toFixed(1)} mm) is wider than the wall (${wallWidthMm} mm) — ` +
        `shrink the painting, cartela or gap`,
    )
  }

  const groupX = (wallWidthMm - groupW) / 2

  const paintingX = placement === 'left' ? groupX : groupX + cartelaWidthMm + gapMm
  const cartelaX = placement === 'left' ? groupX + paintingW + gapMm : groupX

  return {
    painting: { x: paintingX, y, width: paintingW, height: paintingH },
    cartela: { x: cartelaX, y, width: cartelaWidthMm, height: paintingH },
    group: { x: groupX, width: groupW },
  }
}
