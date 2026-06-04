import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { Umbral } from './umbral.tsx'
import { NAVE_CAMERAS, UMBRAL_INV_ID, umbralTypeScale } from './umbral'
import { isLegibleAtDistance, minCapHeightMm } from './wayfinding'
import { buildGeometry } from '../geometry'
import type { PrintDoc, PrintPageProps } from '../types'
import { DEFAULT_WALL_HEIGHT_M, findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * umbral (#3) doc + registration tests
 * ────────────────────────────────────
 * The layout maths lives in `umbral.ts` and is unit-tested there. This file covers
 * the *authoring* of the print: `public/prints/umbral/doc.json` and its
 * registration. The unbiased checks prove the authored **dimensions are honest and
 * renderable** — the page resolves from the registry, exports through the existing
 * CMYK / FOGRA39 / PDF/X contract, physically fits wall 3 (the 8.5 m S2/S3 nave
 * threshold) on its eye band, sizes every text level legibly for the wall's reading
 * distance, and renders the real title-band content (thesis + the three sequenced
 * cameras), not a blank page.
 */

// public/ lives outside the src bundle root → read the committed file directly.
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/umbral/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

function readingDistanceM(): number {
  const v = doc.props?.readingDistanceM
  return typeof v === 'number' ? v : 5
}

describe('umbral — registration', () => {
  it('is registered under its pageComponentId and resolves to the Umbral page', () => {
    expect(doc.pageComponentId).toBe('umbral')
    expect(getPrintPage(doc.pageComponentId)).toBe(Umbral)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(Umbral)
  })

  it('doc id matches its folder/page key', () => {
    expect(doc.id).toBe('umbral')
  })
})

describe('umbral — print contract', () => {
  it('is a CMYK / FOGRA39 / PDF-X print like the rest of the wall-graphics family', () => {
    expect(doc.color.mode).toBe('cmyk')
    expect(doc.color.iccProfile).toBe('icc/CoatedFOGRA39.icc')
    expect(['x1a', 'x4']).toContain(doc.color.pdfxVariant)
    expect(RENDER_INTENTS).toContain(doc.color.renderIntent)
    // a flat, vivid typographic graphic → not the photo-only 'perceptual' intent.
    expect(doc.color.renderIntent).not.toBe('perceptual')
    expect(doc.theme).toBe('dark')
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

  it('points at the S2→S3 umbral wall via props.invId', () => {
    expect(doc.props?.invId).toBe(UMBRAL_INV_ID)
    expect(UMBRAL_INV_ID).toBe(3)
  })
})

describe('umbral — physical fit to wall 3 (S2/S3 nave threshold)', () => {
  const wall = findWallByInvId(UMBRAL_INV_ID)

  it('targets the registered S2/S3 code-track wall', () => {
    expect(wall).toBeDefined()
    expect(wall?.registry?.invId).toBe(3)
    expect(wall?.registry?.sala).toContain('S3') // orients the S3 nave
    expect(wall?.registry?.track).toBe('C') // code track
  })

  it('fits within the wall height (incl. bleed) and along its 8.5 m run', () => {
    if (!wall) throw new Error('wall 3 missing')
    const wallHeightMm = resolveWallHeight(wall) * 1000
    const wallLengthMm = wall.length * 1000
    const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions
    const mediaHeightMm = trimHeightMm + 2 * bleedMm
    const mediaWidthMm = trimWidthMm + 2 * bleedMm

    // Wall 3 has no measured alturaM yet → the 2.5 m default governs.
    expect(wallHeightMm).toBe(DEFAULT_WALL_HEIGHT_M * 1000)
    // The whole media (art + bleed) hangs inside the wall height.
    expect(mediaHeightMm).toBeLessThanOrEqual(wallHeightMm)
    // It rides the eye band, so it is shorter than the full wall.
    expect(trimHeightMm).toBeLessThan(wallHeightMm)
    // The band fits along the 8.5 m run.
    expect(wallLengthMm).toBeCloseTo(8500, 6)
    expect(mediaWidthMm).toBeLessThanOrEqual(wallLengthMm)
  })
})

describe('umbral — the authored canvas is legible at its reading distance', () => {
  it('every text level clears the museographic floor, with a dominant thesis', () => {
    const dist = readingDistanceM()
    const scale = umbralTypeScale({ trimHeightMm: doc.dimensions.trimHeightMm, readingDistanceM: dist })
    expect(scale.minCapHeightMm).toBeCloseTo(minCapHeightMm(dist), 9)
    for (const cap of [
      scale.capHeights.destinationMm,
      scale.capHeights.eyebrowMm,
      scale.capHeights.footerMm,
      scale.cameraCapMm,
      scale.hintCapMm,
    ]) {
      expect(isLegibleAtDistance(cap, dist)).toBe(true)
    }
    // the thesis is a real protagonist and beats the camera names
    expect(scale.capHeights.destinationMm).toBeGreaterThanOrEqual(200)
    expect(scale.capHeights.destinationMm).toBeGreaterThan(scale.cameraCapMm)
  })
})

describe('umbral — renders real content (not a blank page)', () => {
  function render() {
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    const props: PrintPageProps = { doc, geo }
    return renderToStaticMarkup(createElement(Umbral, props))
  }

  it('renders the locator, the S3 thesis and all three sequenced cameras', () => {
    const html = render()
    expect(html).toContain('S3') // section code
    expect(html).toContain('Velocidad') // room name in the locator
    expect(html).toContain('Es inevitable') // the thesis
    for (const c of NAVE_CAMERAS) expect(html).toContain(c.name) // IMAGE · TEXT+CODE · INVERSIÓN
  })

  it('renders the connector arrows (svg) and the discreet brand lockup', () => {
    const html = render()
    expect(html).toContain('<svg') // the thin-line sequence arrows
    expect(html).toContain('AiKit Live')
  })
})
