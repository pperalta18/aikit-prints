import { describe, expect, it } from 'vitest'
import { faceCropUV } from './printFaceTexture'

/**
 * faceCropUV — the pure bleed-crop maths behind realista-mode print textures.
 * The exported PNG is the full media (trim + bleed); the wall plane is the trim, so
 * the UV must crop the symmetric bleed away. These checks pin the invariants the GL
 * code relies on (the loader itself is browser/fetch/GL and isn't unit-tested here).
 */
describe('faceCropUV', () => {
  it('crops a symmetric bleed to the centred trim rectangle', () => {
    // marco-10-s-1 @ 24 dpi: trim 6000×2500 mm, 10 mm bleed → media = trim + 2·bleed.
    // In px the ratios are what matter; use round numbers that share the same ratios.
    const media = { mediaWidthPx: 6020, mediaHeightPx: 2520, trimWidthPx: 6000, trimHeightPx: 2500, bleedPx: 10 }
    const { offset, repeat } = faceCropUV(media)
    expect(offset[0]).toBeCloseTo(10 / 6020, 9)
    expect(offset[1]).toBeCloseTo(10 / 2520, 9)
    expect(repeat[0]).toBeCloseTo(6000 / 6020, 9)
    expect(repeat[1]).toBeCloseTo(2500 / 2520, 9)
    // the cropped window + its two margins reconstruct the whole media (lossless map)
    expect(offset[0] * 2 + repeat[0]).toBeCloseTo(1, 9)
    expect(offset[1] * 2 + repeat[1]).toBeCloseTo(1, 9)
  })

  it('no bleed → the full image (identity map)', () => {
    const { offset, repeat } = faceCropUV({
      mediaWidthPx: 1000,
      mediaHeightPx: 800,
      trimWidthPx: 1000,
      trimHeightPx: 800,
      bleedPx: 0,
    })
    expect(offset).toEqual([0, 0])
    expect(repeat).toEqual([1, 1])
  })

  it('degrades to the full image when media is missing/blank', () => {
    const { offset, repeat } = faceCropUV({
      mediaWidthPx: 0,
      mediaHeightPx: 0,
      trimWidthPx: 0,
      trimHeightPx: 0,
      bleedPx: 0,
    })
    expect(offset).toEqual([0, 0])
    expect(repeat).toEqual([1, 1])
  })

  it('keeps every UV component within [0, 1]', () => {
    const { offset, repeat } = faceCropUV({
      mediaWidthPx: 100,
      mediaHeightPx: 100,
      trimWidthPx: 100,
      trimHeightPx: 100,
      bleedPx: 999, // absurd bleed must not produce out-of-range UVs
    })
    for (const v of [...offset, ...repeat]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
