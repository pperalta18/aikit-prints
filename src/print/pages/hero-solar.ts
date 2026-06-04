/**
 * hero-solar — the honest geometry behind the hero piece
 * "Sistema solar de la inversión" (wall 2, S3 INVESTMENT face).
 * ──────────────────────────────────────────────────────────────────────────
 * Pure functions (no React, no DOM) so the honesty of the hero is *unit-tested*,
 * not eyeballed. The code track's whole reason to exist is that a text-to-image
 * model invents bubble sizes; here every radius is derived from a researched,
 * dated, sourced figure (`src/print/space/wall-data.ts`) via `circleAreaScale`
 * (a ball's **area** ∝ its money). This module:
 *
 *   • classifies each datum — AI giants are giant balls, every shock reference
 *     (Spanish blue-chips, the IBEX 35, Spain's GDP, the coffee market) is a
 *     *marble* (`bodyKind`);
 *   • lays the balls out as a deterministic rosette around a central hole that
 *     holds the "esto es IA" label — biggest balls hug the core, the marbles
 *     ring outward (`layoutHeroSolar`), never overlapping, always in bounds;
 *   • reports any marble it had to **enlarge** to stay visible (`toScale ===
 *     false`) so the page can stamp "ampliado, no a escala" — never a silent lie;
 *   • sizes the largest ball to the canvas (`fitHeroMaxRadius`) so the piece reads
 *     at any wall size / DPI.
 *
 * Layout units are abstract (the page passes millimetres from `geo`); the maths is
 * scale-free. See `specs/wall-graphics.md` (Hero piece).
 */

import { circleAreaScale, type AreaScale } from './dataviz-scales'
import type { DatumGroup } from '../space/wall-data'

/* ── classification: giants vs marbles ───────────────────────────────────────── */

/** A ball is either an AI giant (giant ball) or a shock reference (marble). */
export type BodyKind = 'giant' | 'marble'

/** The datum groups that read as AI giants — everything else is a marble. */
export const GIANT_GROUPS: readonly DatumGroup[] = ['ai-giant-public', 'ai-giant-private']

/** True when a group is an AI giant (a public market cap or a private last round). */
export function isGiant(group: DatumGroup): boolean {
  return GIANT_GROUPS.includes(group)
}

/** Map a datum group to its ball kind. */
export function bodyKind(group: DatumGroup): BodyKind {
  return isGiant(group) ? 'giant' : 'marble'
}

/* ── inputs / outputs ─────────────────────────────────────────────────────────── */

/**
 * The minimal datum the layout needs. `WallDatum` (from `wall-data`) satisfies it
 * structurally, so a page passes `dataForWall(2)` straight in; tests can pass
 * synthetic figures.
 */
export type HeroDatum = {
  id: string
  label: string
  value: number
  group: DatumGroup
}

/** A laid-out ball: its datum + resolved position/size + the honesty flag. */
export type HeroBody = {
  id: string
  label: string
  value: number
  group: DatumGroup
  kind: BodyKind
  /** Centre, in layout units (same units as `width`/`height`). */
  cx: number
  cy: number
  /** Rendered radius, in layout units (area ∝ value, floored at `minRadius`). */
  r: number
  /** True at honest area-scale; false when floored to stay visible → annotate. */
  toScale: boolean
}

export type HeroLayout = {
  width: number
  height: number
  /** Centre of the canvas (where the "esto es IA" label sits). */
  center: { x: number; y: number }
  /** Radius of the central label disc kept clear of every ball. */
  centerRadius: number
  /** The shared area∝value scale (so the page can size a legend the same way). */
  scale: AreaScale
  /** Bodies, largest value first. */
  bodies: HeroBody[]
  /** The subset that was enlarged past honest size (`toScale === false`). */
  enlarged: HeroBody[]
}

export type HeroLayoutOpts = {
  width: number
  height: number
  /** Radius of the largest (max-value) ball, in layout units. */
  maxRadius: number
  /** Floor so tiny marbles stay visible; anything floored is flagged. Default 0. */
  minRadius?: number
  /** Clear gap kept between balls, in layout units. Default 0. */
  gap?: number
  /** Radius of the central label disc no ball may overlap. Default 0. */
  centerRadius?: number
  /** Canvas centre override (defaults to the geometric centre). */
  center?: { x: number; y: number }
}

/* ── auto-fit the largest ball to the canvas ─────────────────────────────────── */

export type FitOpts = {
  width: number
  height: number
  minRadius?: number
  centerRadius?: number
  /**
   * Target fraction of the usable canvas the balls should cover. Conservative
   * (< achievable packing density) so the rosette has slack to lay out. Default 0.4.
   */
  fill?: number
}

/**
 * Largest sensible radius for the max-value ball so the whole set fits the canvas
 * at the target `fill`. Monotonic (every radius grows with `maxRadius`) → solved
 * by bisection. Also capped so the biggest ball alone fits outside the centre hole
 * and inside the media. The page calls this so `layoutHeroSolar` never starves.
 */
export function fitHeroMaxRadius(values: ReadonlyArray<number>, opts: FitOpts): number {
  const { width, height, minRadius = 0, centerRadius = 0, fill = 0.4 } = opts
  const positives = values.filter((v) => v > 0)
  if (positives.length === 0) return Math.max(minRadius, 0)
  const vmax = Math.max(...positives)

  const usable = Math.max(1, width * height - Math.PI * centerRadius * centerRadius)
  const target = fill * usable
  // A single biggest ball must clear the hole AND stay in bounds.
  const cap = Math.max(minRadius || 1, (Math.min(width, height) / 2 - centerRadius) / 2)

  const totalArea = (maxR: number): number => {
    const s = circleAreaScale({ maxValue: vmax, maxRadius: maxR, minRadius })
    return positives.reduce((acc, v) => {
      const r = s.radius(v)
      return acc + Math.PI * r * r
    }, 0)
  }

  if (totalArea(cap) <= target) return cap
  let lo = Math.max(minRadius, 0)
  let hi = cap
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (totalArea(mid) <= target) lo = mid
    else hi = mid
  }
  return lo
}

/* ── layout (deterministic rosette packing) ──────────────────────────────────── */

type Placed = { cx: number; cy: number; r: number }

function collides(x: number, y: number, r: number, placed: ReadonlyArray<Placed>, gap: number): boolean {
  for (const p of placed) {
    const need = p.r + r + gap
    if (Math.hypot(x - p.cx, y - p.cy) < need) return true
  }
  return false
}

/**
 * Place balls (largest first) onto a grid of candidate centres ordered by distance
 * from the canvas centre: the first body grabs the closest valid cell, so the
 * giants hug the central "esto es IA" hole and the marbles ring outward. A cell is
 * valid only when the ball is fully inside the media, fully outside the centre
 * hole, and clears every placed ball by `gap`. Deterministic (no randomness).
 * Throws when no slot exists at this grid `step` (the caller refines the step).
 */
function packAtStep(bodies: ReadonlyArray<HeroBody>, opts: Required<Omit<HeroLayoutOpts, 'maxRadius'>>, step: number): HeroBody[] {
  const { width, height, gap, centerRadius, center } = opts

  // Candidate grid centres, closest-to-centre first.
  const candidates: Array<{ x: number; y: number }> = []
  for (let x = step / 2; x <= width; x += step) {
    for (let y = step / 2; y <= height; y += step) {
      candidates.push({ x, y })
    }
  }
  candidates.sort(
    (a, b) =>
      (a.x - center.x) ** 2 + (a.y - center.y) ** 2 - ((b.x - center.x) ** 2 + (b.y - center.y) ** 2),
  )

  const placed: Placed[] = []
  const out: HeroBody[] = []
  for (const body of bodies) {
    const r = body.r
    let slot: { x: number; y: number } | null = null
    for (const c of candidates) {
      // Fully inside the media.
      if (c.x - r < 0 || c.x + r > width || c.y - r < 0 || c.y + r > height) continue
      // Fully outside the central label hole.
      if (Math.hypot(c.x - center.x, c.y - center.y) < centerRadius + r) continue
      // Clear of every placed ball.
      if (collides(c.x, c.y, r, placed, gap)) continue
      slot = c
      break
    }
    if (!slot) throw new Error(`hero-solar: no slot for '${body.id}' (r=${r}) at step ${step}`)
    placed.push({ cx: slot.x, cy: slot.y, r })
    out.push({ ...body, cx: slot.x, cy: slot.y })
  }
  return out
}

/**
 * Lay the hero balls out as a deterministic rosette around the central "esto es
 * IA" hole. Bodies are sorted by value (largest first), sized by `circleAreaScale`
 * (area ∝ money), and packed with no overlap, all in bounds, all clear of the hole.
 * Refines the candidate grid if a coarse pass can't place a ball, then throws only
 * if the canvas is genuinely too small (use `fitHeroMaxRadius` to avoid that).
 */
export function layoutHeroSolar(data: ReadonlyArray<HeroDatum>, opts: HeroLayoutOpts): HeroLayout {
  const { width, height, maxRadius, minRadius = 0, gap = 0, centerRadius = 0 } = opts
  if (!(width > 0) || !(height > 0)) throw new Error('layoutHeroSolar: width/height must be > 0')
  const center = opts.center ?? { x: width / 2, y: height / 2 }

  const valid = data.filter((d) => Number.isFinite(d.value) && d.value > 0)
  const scale = circleAreaScale({
    maxValue: valid.length ? Math.max(...valid.map((d) => d.value)) : 1,
    maxRadius,
    minRadius,
  })

  const sorted = [...valid].sort((a, b) => b.value - a.value)
  const bodiesUnplaced: HeroBody[] = sorted.map((d) => ({
    id: d.id,
    label: d.label,
    value: d.value,
    group: d.group,
    kind: bodyKind(d.group),
    cx: center.x,
    cy: center.y,
    r: scale.radius(d.value),
    toScale: scale.toScale(d.value),
  }))

  const packOpts: Required<Omit<HeroLayoutOpts, 'maxRadius'>> = {
    width,
    height,
    minRadius,
    gap,
    centerRadius,
    center,
  }

  let bodies: HeroBody[] = []
  if (bodiesUnplaced.length > 0) {
    const minR = Math.min(...bodiesUnplaced.map((b) => b.r))
    // Coarse enough to be fast, fine enough to find gaps; refined on failure.
    let step = Math.max(minR * 0.5, gap, Math.max(width, height) / 280, 1)
    const floor = Math.max(minR * 0.1, 0.25)
    let lastErr: unknown
    let done = false
    for (let attempt = 0; attempt < 9 && !done; attempt++) {
      try {
        bodies = packAtStep(bodiesUnplaced, packOpts, step)
        done = true
      } catch (err) {
        lastErr = err
        step /= 2
        if (step < floor) break
      }
    }
    if (!done) throw lastErr instanceof Error ? lastErr : new Error('hero-solar: could not lay out balls')
  }

  return {
    width,
    height,
    center,
    centerRadius,
    scale,
    bodies,
    enlarged: bodies.filter((b) => !b.toScale),
  }
}
