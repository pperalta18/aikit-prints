import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { Tipografia } from './tipografia.tsx'
import { TIPOGRAFIA_INV_ID, eventTypeScale } from './tipografia'
import { isLegibleAtDistance, minCapHeightMm } from './wayfinding'
import { buildGeometry } from '../geometry'
import type { PrintDoc, PrintPageProps } from '../types'
import { DEFAULT_WALL_HEIGHT_M, findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * tipografia (print 5-S-1) doc + registration tests
 * ─────────────────────────────────────────────────
 * The type-scale maths lives in `tipografia.ts` and is unit-tested there. This file
 * covers the *authoring* of print **5-S-1**: `public/prints/marco-5-s-1/doc.json` and
 * its registration. Unlike the eye-band code pages this is a **full-wall vinyl** —
 * the trim equals the whole 9.5 × 2.5 m wall and the bleed wraps the edge — so the
 * fit checks assert trim == wall, not media ≤ wall. The page is identified by the
 * marco convention (`frameWallInvId`), not `props.invId`, so it stays out of the
 * planned-piece audits; its museographic honesty is proven here directly.
 */

const DOC_PATH = fileURLToPath(new URL('../../../public/prints/marco-5-s-1/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

function readingDistanceM(): number {
  const v = doc.props?.readingDistanceM
  return typeof v === 'number' ? v : 3
}

describe('tipografia (5-S-1) — registration', () => {
  it('is registered under its pageComponentId and resolves to the Tipografia page', () => {
    expect(doc.pageComponentId).toBe('tipografia')
    expect(getPrintPage(doc.pageComponentId)).toBe(Tipografia)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(Tipografia)
  })

  it('is the print 5-S-1 doc', () => {
    expect(doc.id).toBe('marco-5-s-1')
    expect(doc.props?.frameId).toBe('5-S-1')
    expect(doc.props?.frameWallInvId).toBe(TIPOGRAFIA_INV_ID)
    expect(TIPOGRAFIA_INV_ID).toBe(5)
  })
})

describe('tipografia (5-S-1) — print contract', () => {
  it('is a CMYK / FOGRA39 / PDF-X print like the rest of the wall-graphics family', () => {
    expect(doc.color.mode).toBe('cmyk')
    expect(doc.color.iccProfile).toBe('icc/CoatedFOGRA39.icc')
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

describe('tipografia (5-S-1) — physical fit to wall 5 (S5→S6 bridge, full-wall vinyl)', () => {
  const wall = findWallByInvId(TIPOGRAFIA_INV_ID)

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

describe('tipografia (5-S-1) — the authored canvas is legible at its reading distance', () => {
  it('every type level clears the museographic floor, with a dominant H1', () => {
    const dist = readingDistanceM()
    const ratio = typeof doc.props?.ratio === 'number' ? doc.props.ratio : undefined
    const h1CapFraction = typeof doc.props?.h1CapFraction === 'number' ? doc.props.h1CapFraction : undefined
    const scale = eventTypeScale({
      trimHeightMm: doc.dimensions.trimHeightMm,
      readingDistanceM: dist,
      ratio,
      h1CapFraction,
    })
    expect(scale.minCapHeightMm).toBeCloseTo(minCapHeightMm(dist), 9)
    for (const cap of Object.values(scale.capHeights)) {
      expect(isLegibleAtDistance(cap, dist)).toBe(true)
    }
    // H1 is a true protagonist on the 2.5 m wall (hundreds of mm of cap-height).
    expect(scale.capHeights.h1Mm).toBeGreaterThanOrEqual(300)
    expect(scale.capHeights.h1Mm).toBeGreaterThan(scale.capHeights.h2Mm)
  })
})

describe('tipografia (5-S-1) — renders real content (not a blank page)', () => {
  function render() {
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    const props: PrintPageProps = { doc, geo }
    return renderToStaticMarkup(createElement(Tipografia, props))
  }

  it('renders the eyebrow, the four headings, a paragraph snippet and the lockup', () => {
    const html = render()
    expect(html).toContain('S5') // the locator eyebrow (S5 → S6 · El puente)
    expect(html).toContain('Coste marginal') // H1
    expect(html).toContain('abundante') // H2
    expect(html).toContain('Ya pasó antes') // H3
    expect(html).toContain('vuelve a pasar') // H4
    expect(html).toContain('coste cero') // a body paragraph snippet
    expect(html).toContain('AiKit Live')
  })
})
