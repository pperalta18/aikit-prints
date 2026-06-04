/**
 * escala-modelos — the honest maths behind the **9E1 + 8S1 model-scale pair**.
 * ──────────────────────────────────────────────────────────────────────────
 * Two walls, one scale. We visualise the exponential growth of model size by
 * AREA: each model is a square whose **area ∝ its parameter count**, so the side
 * is ∝ √params. Area (not length) is the honest 2D encoding — the eye reads the
 * footprint, and √ is the most generous honest compression of a 3.4-billion-fold
 * gap (Perceptrón → GPT-4) down to a ~58 000-fold side-length gap.
 *
 * The whole point of the pair is that **one continuous unit** (millimetres of wall
 * per √param) governs BOTH walls, so the squares on 9E1 (Perceptrón · AlexNet ·
 * GPT-2) and the GPT-4 square on 8S1 are mutually to scale. We anchor the unit so
 * GPT-2 reads at `ANCHOR_SIDE_MM` on 9E1; everything else follows:
 *   Perceptrón ≈ 0.8 mm (a literal speck → magnified callout, flagged "ampliado"),
 *   AlexNet ≈ 28 cm, GPT-2 ≈ 1.4 m, GPT-4 ≈ 48 m (overflows the 8.5 m wall → a
 *   fragment). Because the unit is in physical mm, it is wall-agnostic: both pages
 *   import the same `modelSideMm` and the scale is continuous by construction.
 *
 * Pure functions (no React, no DOM) so they unit-test in node and the two pages
 * share one source of truth. Presentation: `escala-modelos-kit.tsx`; pages:
 * `escala-9e1.tsx`, `escala-8s1.tsx`. See `specs/wall-graphics.md`.
 */

/* ── the shared honest unit (square side ∝ √params, area ∝ params) ────────────── */

/** Anchor model: GPT-2's square sets the unit on 9E1; the same unit governs 8S1. */
export const ANCHOR_VALUE = 1.5e9
/** GPT-2's square side in mm — the one tunable that sizes the whole pair. */
export const ANCHOR_SIDE_MM = 1400

/** Millimetres of wall per √param. The single continuous unit across both walls. */
export const MM_PER_SQRT_PARAM = ANCHOR_SIDE_MM / Math.sqrt(ANCHOR_VALUE)

/**
 * Honest square side (mm) for a parameter count, at the shared scale: side ∝ √value
 * so AREA ∝ value. Non-positive / non-finite → 0 (nothing to draw).
 */
export function modelSideMm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return MM_PER_SQRT_PARAM * Math.sqrt(value)
}

/** Honest square area (mm²) for a parameter count — area is exactly ∝ value. */
export function modelAreaMm2(value: number): number {
  const s = modelSideMm(value)
  return s * s
}

/**
 * The area quantum: mm² of wall per parameter (= MM_PER_SQRT_PARAM²). Constant
 * across both walls, so a matrix cell of a fixed physical size always represents
 * the SAME number of parameters — which makes the matrix-grain texture honest
 * (a model's square holds `value / paramsPerCell` cells, exactly ∝ its size).
 */
export const MM2_PER_PARAM = MM_PER_SQRT_PARAM * MM_PER_SQRT_PARAM

/** Parameters represented by one matrix cell of side `cellSideMm` (cell area ÷ quantum). */
export function paramsPerCell(cellSideMm: number): number {
  if (!(cellSideMm > 0)) return 0
  return (cellSideMm * cellSideMm) / MM2_PER_PARAM
}

/** How many matrix cells of side `cellSideMm` a model's square contains (∝ value). */
export function cellCount(value: number, cellSideMm: number): number {
  const ppc = paramsPerCell(cellSideMm)
  return ppc > 0 && value > 0 ? value / ppc : 0
}

/* ── a model on the scale ─────────────────────────────────────────────────────── */

export type ScaleModel = {
  id: string
  label: string
  /** Parameter count. */
  value: number
  /** Calendar year (4-digit), for the timeline / labels. */
  year: string
}

/**
 * Network **depth** — the number of layers ("capas") — the honest second metric we
 * render the models as stacks of. Real figures except GPT-4 (no official count):
 *   • Perceptrón Mark I: a single layer of adjustable weights.
 *   • AlexNet: 8 (5 convolutional + 3 fully-connected).
 *   • GPT-2 XL (1.5 B): 48 transformer blocks.
 *   • GPT-4: ≈120 transformer blocks (widely cited estimate; OpenAI never disclosed).
 * Size (area ∝ parameters) carries the exponential; depth carries the structure.
 */
export const MODEL_LAYERS: Record<string, number> = {
  perceptron: 1,
  alexnet: 8,
  gpt2: 48,
  gpt4: 120,
}

/** Layers for a model id, or 1 if unknown (a single layer is the honest floor). */
export function layersOf(id: string): number {
  return MODEL_LAYERS[id] ?? 1
}

/** First 4-digit year in an ISO-ish date ("2025-07" → "2025", "1958" → "1958"). */
export function yearOf(date: string): string {
  const m = /\d{4}/.exec(date ?? '')
  return m ? m[0] : (date ?? '')
}

/** Chronological order (by year, then value) — deterministic. */
export function byChronology(a: ScaleModel, b: ScaleModel): number {
  const ya = Number(a.year)
  const yb = Number(b.year)
  if (ya !== yb) return ya - yb
  return a.value - b.value
}

/* ── 9E1 layout: three squares on a baseline, chronological left → right ───────── */

export type SmallSquare = {
  id: string
  label: string
  year: string
  value: number
  /** Honest side at the shared scale (mm). */
  sideMm: number
  /** Top-left corner of the (honest) square, in trim mm. */
  xMm: number
  yMm: number
  /** Centre x (mm) — handy for labels / leader lines even when the square is a speck. */
  cxMm: number
  /**
   * False when the honest square is below `minVisibleSideMm` (e.g. the ~0.9 mm
   * Perceptrón): it is still drawn to scale as a speck, but the page must add a
   * magnified callout and the "ampliado" note. Never a silent enlargement.
   */
  visible: boolean
}

export type SmallLayout = {
  squares: SmallSquare[]
  /** The shared ground line the squares sit on (mm from the trim top). */
  baselineYMm: number
  /** Ids whose honest square is sub-visible and need a magnified callout. */
  enlarged: string[]
}

export type SmallLayoutOpts = {
  wallWidthMm: number
  wallHeightMm: number
  /** Ground line, measured up from the bottom of the trim. */
  baselineFromBottomMm?: number
  /** Side margins kept clear. */
  marginXMm?: number
  /** Honest side below which a square is treated as a speck needing a callout. */
  minVisibleSideMm?: number
  /** Centre-x of each square as a fraction of width, in chronological order. */
  centerFractions?: number[]
}

/**
 * Place the small models as area-true squares, bottom-aligned on a shared ground
 * line and ordered left→right by year. The dramatic size ramp (speck → tile → wall-
 * tall) IS the message; nothing is rescaled to "look balanced". A square smaller
 * than `minVisibleSideMm` is flagged in `enlarged` (drawn as a to-scale speck, the
 * page adds the magnifier). Deterministic; throws on a non-positive canvas.
 */
export function layoutSmallModels(models: ScaleModel[], opts: SmallLayoutOpts): SmallLayout {
  const {
    wallWidthMm,
    wallHeightMm,
    baselineFromBottomMm = wallHeightMm * 0.2,
    marginXMm = wallWidthMm * 0.04,
    minVisibleSideMm = 3,
    centerFractions,
  } = opts
  if (!(wallWidthMm > 0) || !(wallHeightMm > 0)) {
    throw new Error('layoutSmallModels: canvas must be positive')
  }

  const ordered = [...models].sort(byChronology)
  const baselineYMm = wallHeightMm - baselineFromBottomMm

  // Default centres: evenly spread across the usable width, in chronological order.
  const usableW = wallWidthMm - 2 * marginXMm
  const fractions =
    centerFractions && centerFractions.length === ordered.length
      ? centerFractions
      : ordered.map((_, i) => (ordered.length === 1 ? 0.5 : i / (ordered.length - 1)))

  const squares: SmallSquare[] = ordered.map((m, i) => {
    const sideMm = modelSideMm(m.value)
    const cxMm = marginXMm + fractions[i] * usableW
    return {
      id: m.id,
      label: m.label,
      year: m.year,
      value: m.value,
      sideMm,
      xMm: cxMm - sideMm / 2,
      yMm: baselineYMm - sideMm,
      cxMm,
      visible: sideMm >= minVisibleSideMm,
    }
  })

  return {
    squares,
    baselineYMm,
    enlarged: squares.filter((s) => !s.visible).map((s) => s.id),
  }
}

/* ── 8S1 layout: the GPT-4 fragment + to-scale references ──────────────────────── */

export type GiantReference = {
  id: string
  label: string
  value: number
  /** To-scale side on this wall (mm) — same unit as GPT-4. */
  sideMm: number
}

export type GiantLayout = {
  /** GPT-4's honest square side at the shared scale (mm). */
  gpt4SideMm: number
  /** Same in metres, for the on-wall scale note. */
  gpt4SideM: number
  /** How much of GPT-4's width / height the wall actually shows (0..1). */
  visibleFractionW: number
  visibleFractionH: number
  /** The other models drawn to scale on this wall as a size key (largest first). */
  references: GiantReference[]
}

/**
 * Resolve the GPT-4 fragment for 8S1: its honest side at the shared scale (so it
 * dwarfs the wall — the wall shows only `visibleFraction` of it), plus the other
 * models drawn to the SAME scale as a size key ("todo esto cabría aquí"). The
 * references are sorted largest→smallest and filtered to those at least 1 mm
 * (Perceptrón stays a labelled point, not a drawn square). Throws on a bad canvas.
 */
export function layoutGiant(
  gpt4Value: number,
  references: ScaleModel[],
  opts: { wallWidthMm: number; wallHeightMm: number; minReferenceSideMm?: number },
): GiantLayout {
  const { wallWidthMm, wallHeightMm, minReferenceSideMm = 1 } = opts
  if (!(wallWidthMm > 0) || !(wallHeightMm > 0)) {
    throw new Error('layoutGiant: canvas must be positive')
  }
  const gpt4SideMm = modelSideMm(gpt4Value)
  const refs: GiantReference[] = references
    .map((r) => ({ id: r.id, label: r.label, value: r.value, sideMm: modelSideMm(r.value) }))
    .filter((r) => r.sideMm >= minReferenceSideMm)
    .sort((a, b) => b.sideMm - a.sideMm)

  return {
    gpt4SideMm,
    gpt4SideM: gpt4SideMm / 1000,
    visibleFractionW: gpt4SideMm > 0 ? Math.min(1, wallWidthMm / gpt4SideMm) : 0,
    visibleFractionH: gpt4SideMm > 0 ? Math.min(1, wallHeightMm / gpt4SideMm) : 0,
    references: refs,
  }
}

/* ── growth ratios (computed hooks, never hard-coded) ─────────────────────────── */

/** value(b) / value(a) — the multiplicative jump. */
export function growthFactor(a: number, b: number): number {
  if (!(a > 0)) throw new Error('growthFactor: base must be > 0')
  return b / a
}

/* ── Spanish number formatting (editorial, audience-legible) ──────────────────── */

/**
 * A parameter count in plain Spanish, sized for an exhibition label:
 *   512 → "512", 60e6 → "60 millones", 1.5e9 → "1.500 millones",
 *   1.8e12 → "1,8 billones" (Spanish billón = 10¹²).
 * Below a million the exact integer is shown; from a million up to a billón it
 * reads in millones; a billón (10¹²) and above read in billones.
 */
export function formatParamsEs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 1e6) return formatIntEs(Math.round(value))
  if (value < 1e12) {
    const millions = value / 1e6
    return `${formatIntEs(Math.round(millions))} ${plural(millions, 'millón', 'millones')}`
  }
  return `${trimEs(value / 1e12)} ${plural(value / 1e12, 'billón', 'billones')}`
}

/** Integer with Spanish thousands separators (".") — 1500 → "1.500". */
export function formatIntEs(value: number): string {
  return Math.round(value).toLocaleString('de-DE')
}

/** Up to one decimal, Spanish decimal comma, trailing ",0" trimmed. */
function trimEs(n: number): string {
  const s = (Math.round(n * 10) / 10).toString()
  return s.replace('.', ',')
}

function plural(n: number, one: string, many: string): string {
  return Math.abs(n) === 1 ? one : many
}

/**
 * A big multiplicative factor as an editorial Spanish phrase:
 *   1173 → "1170×", 3.44e9 → "3400 millones×", 25 → "25×".
 * Rounded to 3 significant-ish figures so it reads as a headline, not a spec.
 */
export function formatFactorEs(factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0) return '—'
  if (factor < 1000) {
    const r = factor >= 100 ? Math.round(factor / 10) * 10 : Math.round(factor)
    return `${r}×`
  }
  if (factor < 1e6) return `${formatIntEs(Math.round(factor / 100) * 100)}×`
  if (factor < 1e9) return `${trimEs(Math.round(factor / 1e5) / 10)} millones×`
  return `${trimEs(Math.round(factor / 1e8) / 10)} mil millones×`
}
