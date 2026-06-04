import { describe, expect, it } from 'vitest'
import { posterPdfBoxesPt, panelPdfBoxesPt } from './pdfBoxes'
import { panelEdges } from './tiling'
import { mmToPt } from './geometry'

/**
 * PDF box math (poster + lapped wall panel) and the panel-edge map that feeds it.
 * Pure arithmetic in points — these are the boxes the press reads off the PDF/X,
 * so an unbiased test pins the *finished-size* semantics, not an implementation
 * detail: a whole poster trims in by the bleed all round; a lapped wall panel is
 * full-bleed and only trims where it meets the master's outer media border.
 */

const B = mmToPt(10) // 10 mm bleed in points (≈ 28.3465)

describe('posterPdfBoxesPt', () => {
  it('MediaBox and BleedBox are the full page; TrimBox insets by the bleed all round', () => {
    const { media, bleed, trim } = posterPdfBoxesPt(1000, 700, 10)
    expect(media).toEqual([0, 0, 1000, 700])
    expect(bleed).toEqual([0, 0, 1000, 700])
    expect(trim[0]).toBeCloseTo(B, 6)
    expect(trim[1]).toBeCloseTo(B, 6)
    expect(trim[2]).toBeCloseTo(1000 - 2 * B, 6)
    expect(trim[3]).toBeCloseTo(700 - 2 * B, 6)
  })

  it('BleedBox is a distinct array (not an alias of MediaBox)', () => {
    const { media, bleed } = posterPdfBoxesPt(500, 500, 5)
    expect(bleed).toEqual(media)
    expect(bleed).not.toBe(media)
  })

  it('zero bleed → TrimBox equals MediaBox', () => {
    const { media, trim } = posterPdfBoxesPt(420, 297, 0)
    expect(trim).toEqual(media)
  })

  it('the trim is centred in the media (equal margins on opposite sides)', () => {
    const W = 800
    const H = 600
    const { trim } = posterPdfBoxesPt(W, H, 12)
    const leftMargin = trim[0]
    const rightMargin = W - (trim[0] + trim[2])
    const bottomMargin = trim[1]
    const topMargin = H - (trim[1] + trim[3])
    expect(leftMargin).toBeCloseTo(rightMargin, 6)
    expect(bottomMargin).toBeCloseTo(topMargin, 6)
  })

  it('rejects non-positive sizes, negative bleed, and a bleed too large for the page', () => {
    expect(() => posterPdfBoxesPt(0, 700, 10)).toThrow()
    expect(() => posterPdfBoxesPt(1000, -1, 10)).toThrow()
    expect(() => posterPdfBoxesPt(1000, 700, -5)).toThrow()
    expect(() => posterPdfBoxesPt(40, 700, 10)).toThrow() // 2·28.35pt ≥ 40pt
  })
})

describe('panelPdfBoxesPt — a lapped wall panel', () => {
  const W = 3000
  const H = 2000

  it('a fully interior panel is all image: TrimBox = MediaBox (no guillotine trim)', () => {
    const edges = { left: false, right: false, top: false, bottom: false }
    const { media, trim } = panelPdfBoxesPt(W, H, 10, edges)
    expect(media).toEqual([0, 0, W, H])
    expect(trim).toEqual([0, 0, W, H])
  })

  it('insets only on the sides that meet the master outer border', () => {
    // left + top + bottom outer, right interior (the hero tile-1 case)
    const { trim } = panelPdfBoxesPt(W, H, 10, { left: true, right: false, top: true, bottom: true })
    expect(trim[0]).toBeCloseTo(B, 6) // left inset
    expect(trim[1]).toBeCloseTo(B, 6) // bottom inset
    expect(trim[2]).toBeCloseTo(W - B, 6) // width loses only the left inset (right flush)
    expect(trim[3]).toBeCloseTo(H - 2 * B, 6) // height loses top + bottom
  })

  it('right-edge panel insets the right side, leaves the left flush', () => {
    const { trim } = panelPdfBoxesPt(W, H, 10, { left: false, right: true, top: true, bottom: true })
    expect(trim[0]).toBeCloseTo(0, 6) // left flush (lap seam)
    expect(trim[2]).toBeCloseTo(W - B, 6) // width loses only the right inset
  })

  it('top inset reduces height from the high-y side; bottom from the low-y side', () => {
    const top = panelPdfBoxesPt(W, H, 10, { left: false, right: false, top: true, bottom: false }).trim
    expect(top).toEqual([0, 0, W, H - B]) // y0 stays 0, height shrinks (top of page)
    const bottom = panelPdfBoxesPt(W, H, 10, { left: false, right: false, top: false, bottom: true }).trim
    expect(bottom[1]).toBeCloseTo(B, 6) // y0 lifts by the bleed (bottom of page)
    expect(bottom[3]).toBeCloseTo(H - B, 6)
  })

  it('an all-edges panel reduces to the whole-poster boxes (a 1×1 tiling)', () => {
    const panel = panelPdfBoxesPt(W, H, 10, { left: true, right: true, top: true, bottom: true })
    const poster = posterPdfBoxesPt(W, H, 10)
    expect(panel.media).toEqual(poster.media)
    expect(panel.trim[0]).toBeCloseTo(poster.trim[0], 6)
    expect(panel.trim[1]).toBeCloseTo(poster.trim[1], 6)
    expect(panel.trim[2]).toBeCloseTo(poster.trim[2], 6)
    expect(panel.trim[3]).toBeCloseTo(poster.trim[3], 6)
  })

  it('the TrimBox is always within the MediaBox', () => {
    for (const edges of [
      { left: true, right: false, top: false, bottom: false },
      { left: false, right: true, top: true, bottom: false },
      { left: true, right: true, top: true, bottom: true },
    ]) {
      const { trim } = panelPdfBoxesPt(W, H, 10, edges)
      expect(trim[0]).toBeGreaterThanOrEqual(0)
      expect(trim[1]).toBeGreaterThanOrEqual(0)
      expect(trim[0] + trim[2]).toBeLessThanOrEqual(W + 1e-6)
      expect(trim[1] + trim[3]).toBeLessThanOrEqual(H + 1e-6)
    }
  })

  it('rejects a bleed too large for the panel', () => {
    expect(() => panelPdfBoxesPt(40, 2000, 10, { left: true, right: true, top: false, bottom: false })).toThrow()
  })
})

describe('panelEdges — which tile sides sit on the master outer border', () => {
  it('a single-row split: first col left+top+bottom, last col right+top+bottom, middle only top+bottom', () => {
    expect(panelEdges({ col: 0, row: 0 }, 5, 1)).toEqual({ left: true, right: false, top: true, bottom: true })
    expect(panelEdges({ col: 4, row: 0 }, 5, 1)).toEqual({ left: false, right: true, top: true, bottom: true })
    expect(panelEdges({ col: 2, row: 0 }, 5, 1)).toEqual({ left: false, right: false, top: true, bottom: true })
  })

  it('a 3×3 grid: the centre tile touches no outer border; corners touch two', () => {
    expect(panelEdges({ col: 1, row: 1 }, 3, 3)).toEqual({ left: false, right: false, top: false, bottom: false })
    expect(panelEdges({ col: 0, row: 0 }, 3, 3)).toEqual({ left: true, right: false, top: true, bottom: false })
    expect(panelEdges({ col: 2, row: 2 }, 3, 3)).toEqual({ left: false, right: true, top: false, bottom: true })
  })

  it('a 1×1 tiling is all outer edges (it is the whole media)', () => {
    expect(panelEdges({ col: 0, row: 0 }, 1, 1)).toEqual({ left: true, right: true, top: true, bottom: true })
  })
})
