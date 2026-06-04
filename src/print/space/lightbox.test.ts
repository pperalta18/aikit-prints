/**
 * Unit tests for the light-box material model (Phase 2 — 3D scene extensions).
 *
 * These pin the *behaviour and invariants* of the backlit-panel look, not a
 * re-paste of the magic numbers: a brighter dial always glows more / brightens
 * the art more / spills a larger, stronger halo; the dial is clamped so a
 * hand-edited value can never produce `NaN` glow; the halo is always strictly
 * larger than the panel with equal margin all around; and a vinyl resolves to
 * no glow at all. A regression is caught even if the exact tuning drifts.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MOUNT,
  LIGHTBOX_BRIGHTNESS_DEFAULT,
  LIGHTBOX_BRIGHTNESS_MAX,
  LIGHTBOX_BRIGHTNESS_MIN,
  LIGHTBOX_WARM,
  clampBrightness,
  isMountKind,
  lightboxGlow,
  normalizeMount,
  resolveGlow,
} from './lightbox'

/** Brightness dials spanning the legal range, strictly ascending. */
const SWEEP = [0, 0.25, 0.5, 1, 1.5, 1.75, 2]

/** Assert a numeric series is strictly increasing. */
function strictlyIncreasing(xs: number[]): boolean {
  return xs.every((x, i) => i === 0 || x > xs[i - 1])
}

describe('mount kind', () => {
  it('only accepts the two known kinds', () => {
    expect(isMountKind('vinyl')).toBe(true)
    expect(isMountKind('lightbox')).toBe(true)
    for (const bad of ['', 'VINYL', 'glow', 0, 1, null, undefined, {}, true]) {
      expect(isMountKind(bad)).toBe(false)
    }
  })

  it('normalises unknown / missing input to a vinyl', () => {
    expect(normalizeMount('lightbox')).toBe('lightbox')
    expect(normalizeMount('vinyl')).toBe('vinyl')
    expect(DEFAULT_MOUNT).toBe('vinyl')
    for (const bad of ['nope', undefined, null, 42, {}]) {
      expect(normalizeMount(bad)).toBe(DEFAULT_MOUNT)
    }
  })
})

describe('clampBrightness', () => {
  it('passes through in-range values', () => {
    for (const v of SWEEP) expect(clampBrightness(v)).toBe(v)
  })

  it('clamps to the configured bounds', () => {
    expect(clampBrightness(-3)).toBe(LIGHTBOX_BRIGHTNESS_MIN)
    expect(clampBrightness(99)).toBe(LIGHTBOX_BRIGHTNESS_MAX)
  })

  it('falls back to the default for non-finite / missing input', () => {
    for (const bad of [NaN, Infinity, -Infinity, undefined, null, '1', {}]) {
      expect(clampBrightness(bad)).toBe(LIGHTBOX_BRIGHTNESS_DEFAULT)
    }
  })
})

describe('lightboxGlow', () => {
  it('uses the warm tint for both the emissive edge and the halo', () => {
    const g = lightboxGlow({ brightness: 1, width: 2, height: 1 })
    expect(g.emissive).toBe(LIGHTBOX_WARM)
    expect(g.halo.color).toBe(LIGHTBOX_WARM)
  })

  it('is monotonic in brightness — brighter glows more in every channel', () => {
    const glows = SWEEP.map((b) => lightboxGlow({ brightness: b, width: 2, height: 1 }))
    expect(strictlyIncreasing(glows.map((g) => g.emissiveIntensity))).toBe(true)
    expect(strictlyIncreasing(glows.map((g) => g.panelBrightness))).toBe(true)
    expect(strictlyIncreasing(glows.map((g) => g.panelGlowPx))).toBe(true)
    expect(strictlyIncreasing(glows.map((g) => g.halo.opacity))).toBe(true)
    // larger spill margin when brighter (halo grows beyond the fixed panel)
    expect(strictlyIncreasing(glows.map((g) => g.halo.width))).toBe(true)
  })

  it('never dims the art (panel brightness ≥ 1) and keeps opacity sane', () => {
    for (const b of SWEEP) {
      const g = lightboxGlow({ brightness: b, width: 2, height: 1 })
      expect(g.panelBrightness).toBeGreaterThanOrEqual(1)
      expect(g.halo.opacity).toBeGreaterThanOrEqual(0)
      expect(g.halo.opacity).toBeLessThanOrEqual(0.6)
      expect(g.emissiveIntensity).toBeGreaterThan(0)
      expect(g.panelGlowPx).toBeGreaterThanOrEqual(0)
    }
  })

  it('halo is always strictly larger than the panel with equal margin all around', () => {
    for (const b of SWEEP) {
      const g = lightboxGlow({ brightness: b, width: 3, height: 1.5 })
      expect(g.halo.width).toBeGreaterThan(3)
      expect(g.halo.height).toBeGreaterThan(1.5)
      // equal margin per side → same extra on both axes
      expect(g.halo.width - 3).toBeCloseTo(g.halo.height - 1.5, 10)
    }
  })

  it('clamps the dial: out-of-range equals the boundary glow', () => {
    expect(lightboxGlow({ brightness: -10, width: 2, height: 1 })).toEqual(
      lightboxGlow({ brightness: LIGHTBOX_BRIGHTNESS_MIN, width: 2, height: 1 }),
    )
    expect(lightboxGlow({ brightness: 10, width: 2, height: 1 })).toEqual(
      lightboxGlow({ brightness: LIGHTBOX_BRIGHTNESS_MAX, width: 2, height: 1 }),
    )
  })

  it('defaults missing brightness to the default dial', () => {
    expect(lightboxGlow({ width: 2, height: 1 })).toEqual(
      lightboxGlow({ brightness: LIGHTBOX_BRIGHTNESS_DEFAULT, width: 2, height: 1 }),
    )
  })

  it('guards bad panel sizes — halo stays finite and positive', () => {
    for (const bad of [0, -5, NaN, Infinity, undefined]) {
      const g = lightboxGlow({ brightness: 1, width: bad as number, height: bad as number })
      expect(Number.isFinite(g.halo.width)).toBe(true)
      expect(g.halo.width).toBeGreaterThan(0)
      expect(Number.isFinite(g.halo.height)).toBe(true)
      expect(g.halo.height).toBeGreaterThan(0)
    }
  })
})

describe('resolveGlow', () => {
  const dims = { width: 2, height: 1 }

  it('returns null for a vinyl (default / explicit / unknown mount)', () => {
    expect(resolveGlow(undefined, undefined, dims)).toBeNull()
    expect(resolveGlow('vinyl', 1.5, dims)).toBeNull()
    expect(resolveGlow('bogus', 1, dims)).toBeNull()
  })

  it('returns the glow for a light-box, honouring its brightness dial', () => {
    const g = resolveGlow('lightbox', 1.5, dims)
    expect(g).not.toBeNull()
    expect(g).toEqual(lightboxGlow({ brightness: 1.5, width: 2, height: 1 }))
  })

  it('a brighter light-box resolves to a stronger glow', () => {
    const dim = resolveGlow('lightbox', 0.2, dims)!
    const bright = resolveGlow('lightbox', 1.9, dims)!
    expect(bright.emissiveIntensity).toBeGreaterThan(dim.emissiveIntensity)
    expect(bright.halo.opacity).toBeGreaterThan(dim.halo.opacity)
  })

  it('a light-box with no dial falls back to the default brightness', () => {
    expect(resolveGlow('lightbox', undefined, dims)).toEqual(
      lightboxGlow({ brightness: LIGHTBOX_BRIGHTNESS_DEFAULT, width: 2, height: 1 }),
    )
  })
})
