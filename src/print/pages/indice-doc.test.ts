import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { Indice } from './indice.tsx'
import { eventTypeScale } from './tipografia'
import { isLegibleAtDistance, minCapHeightMm } from './wayfinding'
import { buildGeometry } from '../geometry'
import type { PrintDoc, PrintPageProps } from '../types'
import { DEFAULT_WALL_HEIGHT_M, findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * indice (print 5-S-1) doc + registration tests
 * ──────────────────────────────────────────────
 * The type-scale maths lives in `tipografia.ts` and is unit-tested there. This file
 * covers the *authoring* of print **5-S-1** — `public/prints/5-s-1/doc.json` —
 * which now carries the editorial **índice** (table of contents of the whole show)
 * instead of the earlier four-heading bridge piece. Like the other full-wall vinyls
 * its trim equals the whole 9.5 × 2.5 m wall and the bleed wraps the edge, so the fit
 * checks assert trim == wall. Identified by the marco convention (`frameWallInvId`),
 * not `props.invId`, so it stays out of the planned-piece audits; its museographic
 * honesty (now a *relatively small*, but still legible, index) is proven here directly.
 */

const INV_ID = 5 // wall 5 (`wall-4`), the S5→S6 bridge
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/5-s-1/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

function readingDistanceM(): number {
  const v = doc.props?.readingDistanceM
  return typeof v === 'number' ? v : 3
}

describe('indice (5-S-1) — registration', () => {
  it('is registered under its pageComponentId and resolves to the Indice page', () => {
    expect(doc.pageComponentId).toBe('indice')
    expect(getPrintPage(doc.pageComponentId)).toBe(Indice)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(Indice)
  })

  it('is the print 5-S-1 doc', () => {
    expect(doc.id).toBe('5-s-1')
    expect(doc.props?.frameId).toBe('5-S-1')
    expect(doc.props?.frameWallInvId).toBe(INV_ID)
  })
})

describe('indice (5-S-1) — print contract', () => {
  it('is a CMYK / FOGRA52 / PDF-X print like the rest of the wall-graphics family', () => {
    expect(doc.color.mode).toBe('cmyk')
    expect(doc.color.iccProfile).toBe('icc/PSOuncoated_v3_FOGRA52.icc')
    expect(['x1a', 'x4']).toContain(doc.color.pdfxVariant)
    expect(RENDER_INTENTS).toContain(doc.color.renderIntent)
    // flat, vivid typography on a flat ground → not the photo-only 'perceptual' intent.
    expect(doc.color.renderIntent).not.toBe('perceptual')
    // the bridge wall is authored on the light (paper) ground.
    expect(doc.theme).toBe('light')
  })

  it('declares a low DPI suited to a metre-scale wall (keeps the master canvas sane)', () => {
    expect(doc.dpi).toBeGreaterThan(0)
    expect(doc.dpi).toBeLessThanOrEqual(150)
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    expect(Number.isInteger(geo.mediaWidthPx)).toBe(true)
    expect(Number.isInteger(geo.mediaHeightPx)).toBe(true)
    expect(geo.mediaWidthPx).toBeGreaterThan(0)
    expect(geo.mediaHeightPx).toBeGreaterThan(0)
    expect(geo.mediaWidthPx).toBeLessThan(20000)
    expect(geo.mediaHeightPx).toBeLessThan(20000)
  })
})

describe('indice (5-S-1) — physical fit to wall 5 (S5→S6 bridge, full-wall vinyl)', () => {
  const wall = findWallByInvId(INV_ID)

  it('targets the registered S5/S6 bridge wall (9.5 m run)', () => {
    expect(wall).toBeDefined()
    expect(wall?.registry?.invId).toBe(5)
    expect(wall?.registry?.sala).toContain('S5')
    expect(wall?.length).toBeCloseTo(9.5, 6)
  })

  it('covers the whole wall: trim == wall run × wall height, with bleed wrapping the edge', () => {
    if (!wall) throw new Error('wall 5 missing')
    const wallHeightMm = resolveWallHeight(wall) * 1000
    const wallLengthMm = wall.length * 1000
    const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions

    // Wall 5 has no measured alturaM yet → the 2.5 m default governs.
    expect(wallHeightMm).toBe(DEFAULT_WALL_HEIGHT_M * 1000)
    // A full-wall vinyl: the trim *is* the wall; the bleed extends past it (wrap).
    expect(trimWidthMm).toBeCloseTo(wallLengthMm, 6)
    expect(trimHeightMm).toBeCloseTo(wallHeightMm, 6)
    expect(bleedMm).toBeGreaterThan(0)
  })
})

describe('indice (5-S-1) — a small, but legible, index at its reading distance', () => {
  it('every rendered level clears the museographic floor, with a small (not monumental) title', () => {
    const dist = readingDistanceM()
    const ratio = typeof doc.props?.ratio === 'number' ? doc.props.ratio : undefined
    const titleCapFraction = typeof doc.props?.titleCapFraction === 'number' ? doc.props.titleCapFraction : undefined
    const scale = eventTypeScale({
      trimHeightMm: doc.dimensions.trimHeightMm,
      readingDistanceM: dist,
      ratio,
      h1CapFraction: titleCapFraction,
    })
    expect(scale.minCapHeightMm).toBeCloseTo(minCapHeightMm(dist), 9)
    // The índice renders only the title (h1), the number (h3), the deck (body) and the
    // eyebrow — those are the levels that must clear the floor (h2/h4 are unused here).
    for (const cap of [scale.capHeights.h1Mm, scale.capHeights.h3Mm, scale.capHeights.bodyMm, scale.capHeights.eyebrowMm]) {
      expect(isLegibleAtDistance(cap, dist)).toBe(true)
    }
    // The title leads the row but is kept *small* on the wall (an índice, not a hero):
    expect(scale.capHeights.h1Mm).toBeGreaterThan(scale.capHeights.bodyMm)
    expect(scale.capHeights.h1Mm).toBeLessThan(80)
  })
})

describe('indice (5-S-1) — renders the index (not a blank page)', () => {
  function render() {
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    const props: PrintPageProps = { doc, geo }
    return renderToStaticMarkup(createElement(Indice, props))
  }

  it('renders every room title and a deck (no eyebrow / masthead / footer)', () => {
    const html = render()
    // the six rooms of the show, top→bottom
    expect(html).toContain('Disrupción sensorial')
    expect(html).toContain('Del mito al dato')
    expect(html).toContain('Velocidad de progreso')
    expect(html).toContain('Ineficiencias del humano')
    expect(html).toContain('Cuellos de botella')
    expect(html).toContain('La historia se repite')
    expect(html).toContain('Sala de cine') // a deck (S4)
    // stripped chrome: no eyebrow, no masthead word, no lockup.
    expect(html).not.toContain('Economía de guerra')
    expect(html).not.toContain('AiKit Live')
  })
})
