import { describe, expect, it } from 'vitest'
import {
  NAVE_CAMERAS,
  UMBRAL_CAMERA_CAP_FRACTION,
  UMBRAL_HINT_CAP_FRACTION,
  UMBRAL_INV_ID,
  UMBRAL_THESIS_CAP_FRACTION,
  planCameraSequence,
  umbralTypeScale,
  type NaveCamera,
} from './umbral'
import { capHeightMmToFontPt, fontPtToCapHeightMm, isLegibleAtDistance, minCapHeightMm } from './wayfinding'

/**
 * umbral (#3) — pure layout logic tests
 * ─────────────────────────────────────
 * Two unbiased, render-free concerns: that `planCameraSequence` splits the band
 * into evenly-spaced cells that tile the run exactly (so the three cameras read as
 * a sequence, never crowded or stretched), and that `umbralTypeScale` sizes every
 * text level — thesis, camera name, hint — legibly at the wall's reading distance,
 * with an honest hierarchy. The museographic primitives (`wayfinding.ts`) have
 * their own tests; here we only prove what #3 adds on top.
 */

const EPS = 1e-6

describe('umbral — the nave camera sequence (documented concepts)', () => {
  it('targets wall 3', () => {
    expect(UMBRAL_INV_ID).toBe(3)
  })

  it('is exactly the three S3 cameras in walk order, named as the spec documents', () => {
    expect(NAVE_CAMERAS.map((c) => c.name)).toEqual(['IMAGE', 'TEXT+CODE', 'INVERSIÓN'])
  })

  it('has unique ids and a non-empty hint per camera', () => {
    const ids = NAVE_CAMERAS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of NAVE_CAMERAS) {
      expect(c.id.length).toBeGreaterThan(0)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.hint.length).toBeGreaterThan(0)
    }
  })
})

describe('planCameraSequence — even cells tiling the band', () => {
  const band = { width: 1000, height: 300, gap: 40 }

  it('returns one cell per camera with a 1-based index', () => {
    const cells = planCameraSequence(NAVE_CAMERAS, band)
    expect(cells).toHaveLength(NAVE_CAMERAS.length)
    expect(cells.map((c) => c.index)).toEqual([1, 2, 3])
    expect(cells.map((c) => c.camera.id)).toEqual(NAVE_CAMERAS.map((c) => c.id))
  })

  it('tiles [0, width] exactly — last edge pinned to the band width', () => {
    const cells = planCameraSequence(NAVE_CAMERAS, band)
    expect(cells[0].x).toBeCloseTo(0, 9)
    const last = cells[cells.length - 1]
    expect(last.x + last.width).toBeCloseTo(band.width, 6)
  })

  it('gives every cell an equal width and the exact gap between cells', () => {
    const cells = planCameraSequence(NAVE_CAMERAS, band)
    const w0 = cells[0].width
    for (const c of cells) expect(c.width).toBeCloseTo(w0, 9)
    for (let i = 1; i < cells.length; i++) {
      const measuredGap = cells[i].x - (cells[i - 1].x + cells[i - 1].width)
      expect(measuredGap).toBeCloseTo(band.gap, 6)
    }
    // n·cellW + (n−1)·gap = width
    const n = cells.length
    expect(n * w0 + (n - 1) * band.gap).toBeCloseTo(band.width, 6)
  })

  it('places centres left→right, strictly increasing, each in its cell', () => {
    const cells = planCameraSequence(NAVE_CAMERAS, band)
    for (let i = 1; i < cells.length; i++) expect(cells[i].center).toBeGreaterThan(cells[i - 1].center + EPS)
    for (const c of cells) {
      expect(c.center).toBeGreaterThanOrEqual(c.x - EPS)
      expect(c.center).toBeLessThanOrEqual(c.x + c.width + EPS)
      expect(c.center).toBeCloseTo(c.x + c.width / 2, 9)
      expect(c.y).toBe(0)
      expect(c.height).toBe(band.height)
    }
  })

  it('flags a connector after every cell but the last', () => {
    const cells = planCameraSequence(NAVE_CAMERAS, band)
    expect(cells.map((c) => c.connectorAfter)).toEqual([true, true, false])
  })

  it('works with no gap (cells abut)', () => {
    const cells = planCameraSequence(NAVE_CAMERAS, { width: 900, height: 200 })
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i].x).toBeCloseTo(cells[i - 1].x + cells[i - 1].width, 9)
    }
    expect(cells[cells.length - 1].x + cells[cells.length - 1].width).toBeCloseTo(900, 6)
  })

  it('returns [] for an empty camera list', () => {
    expect(planCameraSequence([], band)).toEqual([])
  })

  it('is deterministic', () => {
    const a = planCameraSequence(NAVE_CAMERAS, band)
    const b = planCameraSequence(NAVE_CAMERAS, band)
    expect(a).toEqual(b)
  })

  it('throws on a non-positive band, a negative gap, or a gap too large for the band', () => {
    expect(() => planCameraSequence(NAVE_CAMERAS, { width: 0, height: 100 })).toThrow()
    expect(() => planCameraSequence(NAVE_CAMERAS, { width: 100, height: -1 })).toThrow()
    expect(() => planCameraSequence(NAVE_CAMERAS, { width: 100, height: 100, gap: -5 })).toThrow()
    // 3 cells need < 50 each → a gap of 50 (×2 = 100) leaves nothing.
    expect(() => planCameraSequence(NAVE_CAMERAS, { width: 100, height: 100, gap: 50 })).toThrow()
  })

  it('scales the cells with the band width (independent of camera content)', () => {
    const fake: NaveCamera[] = [
      { id: 'a', name: 'A', hint: 'x' },
      { id: 'b', name: 'BB', hint: 'yy' },
    ]
    const cells = planCameraSequence(fake, { width: 600, height: 100, gap: 20 })
    // 2 cells, gap 20 → cellW = (600−20)/2 = 290
    expect(cells[0].width).toBeCloseTo(290, 9)
    expect(cells[1].width).toBeCloseTo(290, 9)
  })
})

describe('umbralTypeScale — legible, hierarchical type', () => {
  const opts = { trimHeightMm: 1800, readingDistanceM: 5 }

  it('sizes the thesis by wall proportion and every level above the legibility floor', () => {
    const s = umbralTypeScale(opts)
    expect(s.minCapHeightMm).toBeCloseTo(minCapHeightMm(opts.readingDistanceM), 9)
    // thesis follows the destination slot → proportion of the trim height
    expect(s.capHeights.destinationMm).toBeCloseTo(opts.trimHeightMm * UMBRAL_THESIS_CAP_FRACTION, 6)
    for (const cap of [
      s.capHeights.destinationMm,
      s.capHeights.eyebrowMm,
      s.capHeights.footerMm,
      s.cameraCapMm,
      s.hintCapMm,
    ]) {
      expect(isLegibleAtDistance(cap, opts.readingDistanceM)).toBe(true)
    }
  })

  it('keeps an honest visual hierarchy: thesis > camera name > hint', () => {
    const s = umbralTypeScale(opts)
    expect(s.capHeights.destinationMm).toBeGreaterThan(s.cameraCapMm)
    expect(s.cameraCapMm).toBeGreaterThan(s.hintCapMm)
    expect(s.destinationPt).toBeGreaterThan(s.cameraPt)
    expect(s.cameraPt).toBeGreaterThan(s.hintPt)
  })

  it('reports camera/hint pt sizes consistent with their cap-heights (round-trip)', () => {
    const s = umbralTypeScale(opts)
    expect(s.cameraPt).toBeCloseTo(capHeightMmToFontPt(s.cameraCapMm), 9)
    expect(s.hintPt).toBeCloseTo(capHeightMmToFontPt(s.hintCapMm), 9)
    expect(fontPtToCapHeightMm(s.cameraPt)).toBeCloseTo(s.cameraCapMm, 9)
    expect(fontPtToCapHeightMm(s.hintPt)).toBeCloseTo(s.hintCapMm, 9)
  })

  it('uses the documented default fractions for the camera and hint', () => {
    const s = umbralTypeScale(opts)
    // at this distance the proportional sizes dominate the floor → equal it exactly
    expect(s.cameraCapMm).toBeCloseTo(opts.trimHeightMm * UMBRAL_CAMERA_CAP_FRACTION, 6)
    expect(s.hintCapMm).toBeCloseTo(opts.trimHeightMm * UMBRAL_CAMERA_CAP_FRACTION * UMBRAL_HINT_CAP_FRACTION, 6)
  })

  it('clamps the camera and hint up to the floor at a far reading distance', () => {
    const far = umbralTypeScale({ trimHeightMm: 120, readingDistanceM: 30 })
    const floor = minCapHeightMm(30)
    // tiny trim, far wall → the proportional sizes fall under the floor → clamped up
    expect(far.cameraCapMm).toBeCloseTo(floor, 9)
    expect(far.hintCapMm).toBeCloseTo(floor, 9)
    expect(isLegibleAtDistance(far.cameraCapMm, 30)).toBe(true)
    expect(isLegibleAtDistance(far.hintCapMm, 30)).toBe(true)
  })

  it('is deterministic and throws on invalid input', () => {
    expect(umbralTypeScale(opts)).toEqual(umbralTypeScale(opts))
    expect(() => umbralTypeScale({ trimHeightMm: 0, readingDistanceM: 5 })).toThrow()
    expect(() => umbralTypeScale({ trimHeightMm: 1800, readingDistanceM: 0 })).toThrow()
    expect(() => umbralTypeScale({ ...opts, cameraCapFraction: 0 })).toThrow()
    expect(() => umbralTypeScale({ ...opts, hintCapFraction: 1.5 })).toThrow()
  })
})
