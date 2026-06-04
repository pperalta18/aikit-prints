import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { planTiles, panelEdges } from './tiling'
import { panelPdfBoxesPt } from './pdfBoxes'
import { mediaSizeMm, mmToPt } from './geometry'
import type { PrintDoc } from './types'

/**
 * Hero press-deliverable contract (Phase 4: "export to CMYK PDF/X tiles").
 * ────────────────────────────────────────────────────────────────────────
 * The hero wall is 6 m wide — no press outputs a single 6 m image, so it ships as
 * a row of overlapping panels (the installer laps the seams). This pins the *tile
 * plan* for the real `hero-solar` doc at the press defaults (≤1.5 m roll, 20 mm
 * solape) and the *honest box semantics* of each panel's PDF/X — every panel within
 * the press roll, the union exactly the master raster (lossless), and the TrimBox
 * marking the finished wall edge only where a panel meets the master outer border.
 * These are the same geometry the `tile-print --pdf` pipeline runs at print time.
 */

const DOC_PATH = fileURLToPath(new URL('../../public/prints/hero-solar/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

// The press defaults baked into `scripts/tile-print.mjs`.
const ROLL_MM = 1500
const OVERLAP_MM = 20

const media = mediaSizeMm(doc.dimensions)
const plan = planTiles({
  mediaWidthMm: media.widthMm,
  mediaHeightMm: media.heightMm,
  dpi: doc.dpi,
  maxPanelWidthMm: ROLL_MM,
  overlapMm: OVERLAP_MM,
})

/** A panel's PDF page size in points, from its crop px at the doc DPI. */
const panelPt = (widthPx: number, heightPx: number) => ({
  W: (widthPx / doc.dpi) * 72,
  H: (heightPx / doc.dpi) * 72,
})

describe('hero tiles — the plan splits a 6 m wall into press-width panels', () => {
  it('is a single row of multiple panels (a 6 m wall cannot print whole)', () => {
    expect(plan.tiled).toBe(true)
    expect(plan.rows).toBe(1)
    expect(plan.cols).toBeGreaterThan(1)
    expect(plan.count).toBe(plan.cols * plan.rows)
  })

  it('every panel fits the press roll width and has real area', () => {
    for (const t of plan.tiles) {
      expect(t.widthMm).toBeGreaterThan(0)
      expect(t.widthMm).toBeLessThanOrEqual(ROLL_MM + 1e-6)
      // single row → each panel spans the full media height
      expect(t.heightMm).toBeCloseTo(media.heightMm, 1)
      expect(t.widthPx).toBeGreaterThan(0)
      expect(t.heightPx).toBe(plan.mediaHeightPx)
    }
  })

  it('the union of panels is exactly the master raster (lossless, overlapping)', () => {
    const cols = plan.tiles.filter((t) => t.row === 0).sort((a, b) => a.col - b.col)
    expect(cols[0].xPx).toBe(0) // first panel pinned to the left media border
    const last = cols[cols.length - 1]
    expect(last.xPx + last.widthPx).toBe(plan.mediaWidthPx) // last pinned to the right
    for (let i = 0; i < cols.length - 1; i++) {
      const end = cols[i].xPx + cols[i].widthPx
      // adjacent panels overlap (the lap seam) and leave no gap
      expect(cols[i + 1].xPx).toBeLessThan(end)
      expect(cols[i + 1].xPx).toBeGreaterThanOrEqual(0)
    }
  })

  it('the overlap is the declared 20 mm interior bleed (a positive px strip)', () => {
    expect(plan.overlapMm).toBe(OVERLAP_MM)
    expect(plan.overlapPx).toBeGreaterThan(0)
  })
})

describe('hero tiles — each panel PDF/X has honest finished-edge boxes', () => {
  const b = mmToPt(doc.dimensions.bleedMm)

  it('MediaBox = BleedBox = the full panel for every tile', () => {
    for (const t of plan.tiles) {
      const { W, H } = panelPt(t.widthPx, t.heightPx)
      const { media: m, bleed } = panelPdfBoxesPt(W, H, doc.dimensions.bleedMm, panelEdges(t, plan.cols, plan.rows))
      expect(m).toEqual([0, 0, W, H])
      expect(bleed).toEqual(m)
    }
  })

  it('only the wall-edge panels trim in horizontally; lap seams stay flush', () => {
    const cols = plan.tiles.filter((t) => t.row === 0).sort((a, b) => a.col - b.col)
    cols.forEach((t, i) => {
      const { W, H } = panelPt(t.widthPx, t.heightPx)
      const { trim } = panelPdfBoxesPt(W, H, doc.dimensions.bleedMm, panelEdges(t, plan.cols, plan.rows))
      const leftInset = trim[0]
      const rightFlushAt = trim[0] + trim[2]
      if (i === 0) {
        expect(leftInset).toBeCloseTo(b, 6) // left wall edge → sangrado
      } else {
        expect(leftInset).toBeCloseTo(0, 6) // interior lap → flush
      }
      if (i === cols.length - 1) {
        expect(rightFlushAt).toBeCloseTo(W - b, 6) // right wall edge → sangrado
      } else {
        expect(rightFlushAt).toBeCloseTo(W, 6) // interior lap → flush
      }
    })
  })

  it('every panel trims top and bottom (the single row spans the full wall height)', () => {
    for (const t of plan.tiles) {
      const { W, H } = panelPt(t.widthPx, t.heightPx)
      const { trim } = panelPdfBoxesPt(W, H, doc.dimensions.bleedMm, panelEdges(t, plan.cols, plan.rows))
      expect(trim[1]).toBeCloseTo(b, 6) // bottom inset
      expect(trim[1] + trim[3]).toBeCloseTo(H - b, 6) // top inset
    }
  })
})

describe('hero tiles — the press width drives the panel count', () => {
  it('a roll wider than the whole wall needs no split (1×1)', () => {
    const single = planTiles({
      mediaWidthMm: media.widthMm,
      mediaHeightMm: media.heightMm,
      dpi: doc.dpi,
      maxPanelWidthMm: media.widthMm + 100,
      overlapMm: OVERLAP_MM,
    })
    expect(single.tiled).toBe(false)
    expect(single.count).toBe(1)
  })

  it('a narrower roll yields more panels', () => {
    const narrow = planTiles({
      mediaWidthMm: media.widthMm,
      mediaHeightMm: media.heightMm,
      dpi: doc.dpi,
      maxPanelWidthMm: 1000,
      overlapMm: OVERLAP_MM,
    })
    expect(narrow.cols).toBeGreaterThan(plan.cols)
  })
})
