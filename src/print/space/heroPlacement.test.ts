import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  EYE_BAND_CENTER_M,
  EYE_BAND_MAX_M,
  EYE_BAND_MIN_M,
  HERO_INV_ID,
  HERO_PRINT_ID,
  NAVE_OPPOSITE_INV_ID,
  WALL_EDGE_MARGIN_M,
  eyeBandCenterY,
  faceToward,
  heroSolarPlacement,
  wallNormalCenter,
  wallRunCenter,
} from './heroPlacement'
import {
  DEFAULT_WALL_HEIGHT_M,
  findWallByInvId,
  resolveWallHeight,
  type Wall,
} from './eventLayout'
import { isValidPlacement, parsePlacements } from './placements'
import { LIGHTBOX_BRIGHTNESS_DEFAULT } from './lightbox'
import { HERO_INV_ID as PAGE_HERO_INV_ID } from '../pages/hero-solar.tsx'

/**
 * heroPlacement tests
 * ───────────────────
 * Phase 4 (hero vertical slice): mounting "Sistema solar de la inversión" on its
 * real wall. The point of an unbiased test here is to prove the *placement is the
 * one the brief demands* — wall 2's **S3 face** (toward the nave, not the S1
 * combustión back), a **light-box**, **true scale**, on the **museographic eye
 * band** — derived from the committed venue geometry rather than asserted by hand,
 * and that it drops cleanly into the persistence layer.
 */

// public/ lives outside the src bundle root → read the committed file directly.
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/hero-solar/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as {
  id: string
  props?: { invId?: number }
  dimensions: { trimHeightMm: number; trimWidthMm: number }
}

function fakeWall(over: Partial<Wall> = {}): Wall {
  return {
    id: 'wall-test',
    cx: 0,
    cz: 0,
    sx: 0.5,
    sz: 10,
    normalAxis: 'x',
    length: 10,
    thickness: 0.5,
    height: DEFAULT_WALL_HEIGHT_M,
    hasExplicitHeight: false,
    ...over,
  }
}

describe('eyeBandCenterY', () => {
  it('hits the eye-band target when the print fits comfortably', () => {
    // 0.5 m print on a 3 m wall: the target is reachable.
    expect(eyeBandCenterY(3, 0.5)).toBeCloseTo(EYE_BAND_CENTER_M, 9)
  })

  it('clamps down to the highest centre that still fits a tall print', () => {
    // 2.2 m print on a 2.5 m wall: top edge governs → max centre.
    const c = eyeBandCenterY(2.5, 2.2)
    expect(c).toBeCloseTo(2.5 - 2.2 / 2 - WALL_EDGE_MARGIN_M, 9) // 1.35
  })

  it('keeps the whole print on the wall whenever it can fit', () => {
    for (const [wallH, ph] of [
      [2.5, 2.2],
      [3, 1],
      [2.5, 0.4],
      [4, 3.5],
    ] as const) {
      const c = eyeBandCenterY(wallH, ph)
      // never below the floor (lower bound is always honoured)
      expect(c - ph / 2).toBeGreaterThanOrEqual(WALL_EDGE_MARGIN_M - 1e-9)
      // and within the wall top when the print is short enough to fit
      if (ph <= wallH - 2 * WALL_EDGE_MARGIN_M) {
        expect(c + ph / 2).toBeLessThanOrEqual(wallH - WALL_EDGE_MARGIN_M + 1e-9)
      }
    }
  })

  it('protects the floor first when the print is taller than the wall (never NaN)', () => {
    const c = eyeBandCenterY(2, 2.2)
    expect(Number.isFinite(c)).toBe(true)
    expect(c).toBeCloseTo(2.2 / 2 + WALL_EDGE_MARGIN_M, 9) // 1.15 — bottom off the floor
    expect(c - 2.2 / 2).toBeGreaterThanOrEqual(0) // bottom never below the floor
  })

  it('honours custom target and margin', () => {
    expect(eyeBandCenterY(3, 0.5, { target: 1.2 })).toBeCloseTo(1.2, 9)
    expect(eyeBandCenterY(2.5, 2.2, { margin: 0 })).toBeCloseTo(2.5 - 1.1, 9) // 1.4
  })

  it('the default target sits inside the museographic eye band', () => {
    expect(EYE_BAND_CENTER_M).toBeGreaterThanOrEqual(EYE_BAND_MIN_M)
    expect(EYE_BAND_CENTER_M).toBeLessThanOrEqual(EYE_BAND_MAX_M)
  })
})

describe('wall axis centres', () => {
  it('run/normal centres for an x-normal wall', () => {
    const w = fakeWall({ normalAxis: 'x', cx: -4.75, cz: 5.25 })
    expect(wallNormalCenter(w)).toBe(-4.75)
    expect(wallRunCenter(w)).toBe(5.25)
  })

  it('run/normal centres for a z-normal wall', () => {
    const w = fakeWall({ normalAxis: 'z', cx: 2, cz: -3 })
    expect(wallNormalCenter(w)).toBe(-3)
    expect(wallRunCenter(w)).toBe(2)
  })
})

describe('faceToward', () => {
  it('picks the face pointing at the reference (x-normal)', () => {
    const w = fakeWall({ normalAxis: 'x', cx: 0 })
    expect(faceToward(w, { cx: 5, cz: 0 })).toBe(1)
    expect(faceToward(w, { cx: -5, cz: 0 })).toBe(-1)
  })

  it('resolves a reference on the normal centre to +1 deterministically', () => {
    const w = fakeWall({ normalAxis: 'x', cx: 3 })
    expect(faceToward(w, { cx: 3, cz: 99 })).toBe(1)
  })

  it('picks the face pointing at the reference (z-normal)', () => {
    const w = fakeWall({ normalAxis: 'z', cz: 0 })
    expect(faceToward(w, { cx: 0, cz: 5 })).toBe(1)
    expect(faceToward(w, { cx: 0, cz: -5 })).toBe(-1)
  })

  it('on the real venue, wall 2 faces the nave (S3) on one side and S1 on the other', () => {
    const wall2 = findWallByInvId(HERO_INV_ID)
    const naveE = findWallByInvId(NAVE_OPPOSITE_INV_ID) // "Nave E" — across the nave
    const s1 = findWallByInvId(9) // "Perímetro O — combustión" (S1, west back)
    if (!wall2 || !naveE || !s1) throw new Error('venue walls missing')

    const s3Side = faceToward(wall2, { cx: naveE.cx, cz: naveE.cz })
    const s1Side = faceToward(wall2, { cx: s1.cx, cz: s1.cz })
    // The S3 face (toward the nave) is the opposite of the S1 combustión back.
    expect(s3Side).toBe(1)
    expect(s1Side).toBe(-1)
    expect(s3Side).toBe((s1Side * -1) as 1 | -1)
  })
})

describe('constants are consistent with the authored hero print', () => {
  it('inventory id agrees across the placement core, the page, and the doc', () => {
    expect(HERO_INV_ID).toBe(2)
    expect(PAGE_HERO_INV_ID).toBe(HERO_INV_ID)
    expect(doc.props?.invId).toBe(HERO_INV_ID)
  })

  it('print id agrees with the catalogue doc', () => {
    expect(HERO_PRINT_ID).toBe('hero-solar')
    expect(doc.id).toBe(HERO_PRINT_ID)
  })

  it('the hero wall is a registered S3 wall', () => {
    const wall2 = findWallByInvId(HERO_INV_ID)
    expect(wall2?.registry?.invId).toBe(2)
    expect(wall2?.registry?.sala).toContain('S3')
  })
})

describe('heroSolarPlacement — the real wall-2 mount', () => {
  const wall2 = findWallByInvId(HERO_INV_ID)
  const naveE = findWallByInvId(NAVE_OPPOSITE_INV_ID)
  if (!wall2 || !naveE) throw new Error('venue walls missing')

  const placement = heroSolarPlacement({
    wall: wall2,
    s3Reference: { cx: naveE.cx, cz: naveE.cz },
    trimHeightMm: doc.dimensions.trimHeightMm,
  })

  it('hangs the hero print on wall 2', () => {
    expect(placement.printId).toBe(HERO_PRINT_ID)
    expect(placement.wallId).toBe(wall2.id)
  })

  it('mounts as a light-box (caja de luz) at the default brightness', () => {
    expect(placement.mount).toBe('lightbox')
    expect(placement.glow).toBe(LIGHTBOX_BRIGHTNESS_DEFAULT)
  })

  it('hangs at true physical scale (1×)', () => {
    expect(placement.scale).toBe(1)
  })

  it('faces the S3 nave (side +1), the opposite of the S1 back', () => {
    expect(placement.side).toBe(1)
  })

  it('still resolves the S3 face with the default (wall-centre) reference', () => {
    const p = heroSolarPlacement({ wall: wall2, trimHeightMm: doc.dimensions.trimHeightMm })
    expect(p.side).toBe(1)
  })

  it('rides the eye band and fits entirely on the 2.5 m wall', () => {
    const wallH = resolveWallHeight(wall2)
    expect(wallH).toBe(DEFAULT_WALL_HEIGHT_M) // wall 2 has no measured alturaM yet
    const ph = doc.dimensions.trimHeightMm / 1000
    expect(placement.centerY).toBeCloseTo(eyeBandCenterY(wallH, ph), 9)
    // whole print on the wall: off the floor, under the ceiling
    expect(placement.centerY - ph / 2).toBeGreaterThanOrEqual(0)
    expect(placement.centerY + ph / 2).toBeLessThanOrEqual(wallH + 1e-9)
  })

  it('defaults `along` to the wall-run centre', () => {
    expect(placement.along).toBe(wallRunCenter(wall2))
  })

  it('uses a stable default id so a re-mount replaces rather than duplicates', () => {
    expect(placement.id).toBe(`hero-${wall2.id}`)
    const again = heroSolarPlacement({ wall: wall2, trimHeightMm: doc.dimensions.trimHeightMm })
    expect(again.id).toBe(placement.id)
  })

  it('is a valid, persistable placement that round-trips through the store', () => {
    expect(isValidPlacement(placement)).toBe(true)
    const [restored] = parsePlacements([placement])
    expect(restored).toBeDefined()
    expect(restored.mount).toBe('lightbox')
    expect(restored.glow).toBe(LIGHTBOX_BRIGHTNESS_DEFAULT)
    expect(restored.side).toBe(1)
    expect(restored.wallId).toBe(wall2.id)
  })

  it('honours overrides (id, printId, along, brightness)', () => {
    const p = heroSolarPlacement({
      wall: wall2,
      trimHeightMm: doc.dimensions.trimHeightMm,
      id: 'custom-id',
      printId: 'other-print',
      along: 1.25,
      brightness: 1.8,
    })
    expect(p.id).toBe('custom-id')
    expect(p.printId).toBe('other-print')
    expect(p.along).toBe(1.25)
    expect(p.glow).toBe(1.8)
  })

  it('honours a measured wall height when present (fit follows the data)', () => {
    const tall = { ...wall2, height: 4, hasExplicitHeight: true }
    const p = heroSolarPlacement({ wall: tall, trimHeightMm: doc.dimensions.trimHeightMm })
    const ph = doc.dimensions.trimHeightMm / 1000
    // a 4 m wall lets the eye band be reached without clamping
    expect(p.centerY).toBeCloseTo(eyeBandCenterY(4, ph), 9)
    expect(p.centerY).toBeCloseTo(EYE_BAND_CENTER_M, 9)
  })
})
