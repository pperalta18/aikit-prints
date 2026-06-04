import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { MicroAcento } from './micro-acento.tsx'
import { MICRO_ACENTO_INV_ID, microAcentoTypeScale, wrapPhrase } from './micro-acento'
import { isLegibleAtDistance, minCapHeightMm } from './wayfinding'
import { buildGeometry } from '../geometry'
import type { PrintDoc, PrintPageProps } from '../types'
import { DEFAULT_WALL_HEIGHT_M, findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * micro-acento (#14) doc + registration tests
 * ───────────────────────────────────────────
 * The layout maths lives in `micro-acento.ts` and is unit-tested there. This file
 * covers the *authoring* of the print: `public/prints/micro-acento/doc.json` and its
 * registration. The unbiased checks prove the authored dimensions are honest and
 * renderable — the page resolves from the registry, exports through the existing
 * CMYK / FOGRA39 / PDF/X contract, physically fits wall 14 (the tiny 1.5 m S5/S6
 * accent) on its eye band, sizes its phrase legibly for the reading distance, and
 * renders the real one-phrase content, not a blank page.
 */

// public/ lives outside the src bundle root → read the committed file directly.
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/micro-acento/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

function readingDistanceM(): number {
  const v = doc.props?.readingDistanceM
  return typeof v === 'number' ? v : 3
}

describe('micro-acento — registration', () => {
  it('is registered under its pageComponentId and resolves to the MicroAcento page', () => {
    expect(doc.pageComponentId).toBe('micro-acento')
    expect(getPrintPage(doc.pageComponentId)).toBe(MicroAcento)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(MicroAcento)
  })

  it('doc id matches its folder/page key', () => {
    expect(doc.id).toBe('micro-acento')
  })
})

describe('micro-acento — print contract', () => {
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

  it('points at the S5→S6 micro-accent wall via props.invId', () => {
    expect(doc.props?.invId).toBe(MICRO_ACENTO_INV_ID)
    expect(MICRO_ACENTO_INV_ID).toBe(14)
  })
})

describe('micro-acento — physical fit to wall 14 (tiny S5/S6 accent)', () => {
  const wall = findWallByInvId(MICRO_ACENTO_INV_ID)

  it('targets the registered S5/S6 code-track wall', () => {
    expect(wall).toBeDefined()
    expect(wall?.registry?.invId).toBe(14)
    expect(wall?.registry?.sala).toContain('S5')
    expect(wall?.registry?.track).toBe('C') // code track
  })

  it('fits within the wall height (incl. bleed) and along its 1.5 m run', () => {
    if (!wall) throw new Error('wall 14 missing')
    const wallHeightMm = resolveWallHeight(wall) * 1000
    const wallLengthMm = wall.length * 1000
    const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions
    const mediaHeightMm = trimHeightMm + 2 * bleedMm
    const mediaWidthMm = trimWidthMm + 2 * bleedMm

    // Wall 14 has no measured alturaM yet → the 2.5 m default governs.
    expect(wallHeightMm).toBe(DEFAULT_WALL_HEIGHT_M * 1000)
    // The whole media (art + bleed) hangs inside the wall height.
    expect(mediaHeightMm).toBeLessThanOrEqual(wallHeightMm)
    // It rides the eye band, so it is shorter than the full wall.
    expect(trimHeightMm).toBeLessThan(wallHeightMm)
    // The accent fits along the tiny 1.5 m run.
    expect(wallLengthMm).toBeCloseTo(1500, 6)
    expect(mediaWidthMm).toBeLessThanOrEqual(wallLengthMm)
  })
})

describe('micro-acento — the authored canvas is legible at its reading distance', () => {
  it('every text level clears the museographic floor, with a dominant phrase', () => {
    const dist = readingDistanceM()
    const lines = wrapPhrase(String(doc.props?.phrase ?? 'Ya pasó antes'), {
      maxLines: typeof doc.props?.maxLines === 'number' ? doc.props.maxLines : 2,
    })
    const scale = microAcentoTypeScale({
      trimHeightMm: doc.dimensions.trimHeightMm,
      readingDistanceM: dist,
      lineCount: Math.max(1, lines.length),
    })
    expect(scale.minCapHeightMm).toBeCloseTo(minCapHeightMm(dist), 9)
    for (const cap of [scale.phraseCapMm, scale.capHeights.eyebrowMm, scale.capHeights.footerMm]) {
      expect(isLegibleAtDistance(cap, dist)).toBe(true)
    }
    // the phrase is a real protagonist, and a multi-word phrase fits the narrow wall
    expect(scale.phraseCapMm).toBeGreaterThanOrEqual(100)
    expect(scale.phraseCapMm).toBeGreaterThan(scale.capHeights.eyebrowMm)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines.length).toBeLessThanOrEqual(2)
  })
})

describe('micro-acento — renders real content (not a blank page)', () => {
  function render() {
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    const props: PrintPageProps = { doc, geo }
    return renderToStaticMarkup(createElement(MicroAcento, props))
  }

  it('renders the locator, every wrapped line of the phrase and the brand lockup', () => {
    const html = render()
    expect(html).toContain('S5') // the locator eyebrow (S5 → S6)
    const lines = wrapPhrase(String(doc.props?.phrase ?? 'Ya pasó antes'), {
      maxLines: typeof doc.props?.maxLines === 'number' ? doc.props.maxLines : 2,
    })
    for (const line of lines) expect(html).toContain(line)
    expect(html).toContain('AiKit Live')
  })
})
