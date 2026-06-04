import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PRINT_PAGES, getPrintPage } from './index'
import { Galaxy, galaxyWallLayout } from './galaxy.tsx'
import { buildGeometry } from '../geometry'
import type { PrintDoc } from '../types'
import { assertGalaxySourced, allWallBodyIds, GALAXY_BODIES } from '../space/galaxy-data'

/**
 * galaxy doc + registration tests — THREE separate framed prints.
 * ──────────────────────────────────────────────────────────────
 * The honest layout (shared area∝value scale, no overlap, no clipping, self-
 * contained per wall) is unit-tested in `galaxy.test.ts`. This proves the three
 * authored prints (5N1 back, 2-E left, 11-W right): registration, the print
 * contract, physical fit, full coverage of the data across the walls, and that
 * each renders real names with nothing clipped.
 */

const read = (id: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../public/prints/${id}/doc.json`, import.meta.url)), 'utf8')) as PrintDoc

const DOCS = {
  back: read('marco-5-n-1'),
  left: read('marco-2-e-inversion'),
  right: read('marco-11-w-inversion'),
}

describe('galaxy — registration & contract', () => {
  it('all three docs point at the galaxy page', () => {
    for (const doc of Object.values(DOCS)) {
      expect(doc.pageComponentId).toBe('galaxy')
      expect(getPrintPage(doc.pageComponentId)).toBe(Galaxy)
      expect(PRINT_PAGES.galaxy).toBe(Galaxy)
    }
  })

  it('each is a CMYK / FOGRA39 / PDF-X light print (vivid, not photo-perceptual)', () => {
    for (const doc of Object.values(DOCS)) {
      expect(doc.color.mode).toBe('cmyk')
      expect(doc.color.iccProfile).toBe('icc/CoatedFOGRA39.icc')
      expect(['x1a', 'x4']).toContain(doc.color.pdfxVariant)
      expect(doc.color.renderIntent).not.toBe('perceptual')
      expect(doc.theme).toBe('light')
    }
  })

  it('declares the panel and a metre-scale DPI with a sane canvas', () => {
    expect(DOCS.back.props?.panel).toBe('back')
    expect(DOCS.left.props?.panel).toBe('left')
    expect(DOCS.right.props?.panel).toBe('right')
    for (const doc of Object.values(DOCS)) {
      expect(doc.dpi).toBeGreaterThan(0)
      expect(doc.dpi).toBeLessThanOrEqual(150)
      const geo = buildGeometry(doc.dimensions, doc.dpi)
      expect(Number.isInteger(geo.mediaWidthPx)).toBe(true)
      expect(geo.mediaWidthPx).toBeLessThan(24000)
      expect(geo.mediaHeightPx).toBeLessThan(20000)
    }
  })
})

describe('galaxy — physical fit', () => {
  it('panels carry their wall widths and ride within the 2.5 m wall height', () => {
    expect(DOCS.back.dimensions.trimWidthMm).toBe(9500)
    expect(DOCS.left.dimensions.trimWidthMm).toBe(8750)
    expect(DOCS.right.dimensions.trimWidthMm).toBe(5750)
    for (const doc of Object.values(DOCS)) expect(doc.dimensions.trimHeightMm).toBeLessThanOrEqual(2500)
  })
})

describe('galaxy — data coverage & honest layout', () => {
  it('every body lives on exactly one wall (no orphans, no dupes)', () => {
    const assigned = allWallBodyIds()
    expect(new Set(assigned).size).toBe(assigned.length) // no duplicates
    expect([...assigned].sort()).toEqual(GALAXY_BODIES.map((b) => b.id).sort())
  })

  it('every figure is sourced (value + date + url)', () => {
    expect(() => assertGalaxySourced()).not.toThrow()
  })

  it('each wall lays out in-bounds, non-overlapping, at the shared scale', () => {
    const eps = 1e-6
    const radii: number[] = []
    for (const doc of Object.values(DOCS)) {
      const W = doc.dimensions.trimWidthMm
      const H = doc.dimensions.trimHeightMm
      const panel = doc.props!.panel as 'back' | 'left' | 'right'
      // side walls render the galaxy in HALF the frame (the other half is the chart)
      const regionW = panel === 'back' ? W : W / 2
      const layout = galaxyWallLayout(panel, regionW, H)
      for (const b of layout.bodies) {
        expect(b.cx - b.r).toBeGreaterThanOrEqual(-eps)
        expect(b.cx + b.r).toBeLessThanOrEqual(regionW + eps)
        expect(b.cy - b.r).toBeGreaterThanOrEqual(-eps)
        expect(b.cy + b.r).toBeLessThanOrEqual(H + eps)
      }
      for (let i = 0; i < layout.bodies.length; i++)
        for (let j = i + 1; j < layout.bodies.length; j++) {
          const a = layout.bodies[i]
          const b = layout.bodies[j]
          expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.r + b.r - eps)
        }
      radii.push(layout.scale.radius(1e12)) // a fixed value → same radius on every wall
    }
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 6)
  })
})

describe('galaxy — renders real content (names only, nothing clipped)', () => {
  function html(doc: PrintDoc) {
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    return renderToStaticMarkup(createElement(Galaxy, { doc, geo }))
  }

  it('back wall shows the AI by name and the scale note — and NO figures', () => {
    const out = html(DOCS.back)
    expect(out).toContain('IA')
    expect(out).toContain('Nvidia')
    expect(out).toContain('Representado a escala')
    expect(out).not.toMatch(/billones|mil millones/)
  })

  it('the left wall has half galaxy + the Artificial Analysis frontier chart', () => {
    const left = html(DOCS.left)
    expect(left).toContain('Café') // galaxy half
    expect(left).toContain('50%') // ring discs
    expect(left).toContain('Inteligencia de los modelos') // chart title
    expect(left).toContain('Artificial Analysis') // chart source
    expect(left).toContain('Gemini 3.1 Pro') // a frontier point
  })

  it('the right wall renders its galaxy half by name (chart half reserved)', () => {
    const right = html(DOCS.right)
    expect(right).toContain('Disney')
    expect(right).toContain('50%')
  })
})
