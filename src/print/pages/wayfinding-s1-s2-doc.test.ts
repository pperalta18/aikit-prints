import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { WayfindingS1S2, WAYFINDING_S1_S2_INV_ID } from './wayfinding-s1-s2'
import { isLegibleAtDistance, minCapHeightMm } from './wayfinding'
import { eventTypeScale } from './tipografia'
import { buildGeometry } from '../geometry'
import type { PrintDoc, PrintPageProps } from '../types'
import { DEFAULT_WALL_HEIGHT_M, findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * wayfinding-s1-s2 (#10) doc + registration tests
 * ───────────────────────────────────────────────
 * The museographic maths lives in `tipografia.ts` / `wayfinding.ts` and is unit-tested
 * there. This file covers the *authoring* of the print: `public/prints/10-s-1/doc.json`
 * (the South face of wall 10) and its registration. The unbiased checks here prove the
 * authored **dimensions are honest and renderable** — the page resolves from the registry,
 * exports through the existing CMYK / FOGRA52 / PDF/X contract, physically fits wall 10
 * (the 6.5 m S1→S2 threshold) on its eye band, sizes every text level legibly for the
 * wall's reading distance, and renders the real directional content (room name + arrow),
 * not a blank page. (Wall 10 is the 6.5 m S1→S2 threshold in the current layout.)
 */

// public/ lives outside the src bundle root → read the committed file directly.
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/10-s-1/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

// Mirror the page's own title cap fraction so the *authored* type sizes are
// proven, not a convenient test value (see wayfinding-s1-s2.tsx).
const H1_CAP_FRACTION = 0.082

function readingDistanceM(): number {
  const v = doc.props?.readingDistanceM
  return typeof v === 'number' ? v : 4
}

describe('wayfinding-s1-s2 — registration', () => {
  it('is registered under its pageComponentId and resolves to the WayfindingS1S2 page', () => {
    expect(doc.pageComponentId).toBe('wayfinding-s1-s2')
    expect(getPrintPage(doc.pageComponentId)).toBe(WayfindingS1S2)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(WayfindingS1S2)
  })

  it('doc id matches its folder (the wall-10 South face frame)', () => {
    expect(doc.id).toBe('10-s-1')
  })
})

describe('wayfinding-s1-s2 — print contract', () => {
  it('is a CMYK / FOGRA52 / PDF-X print like the rest of the wall-graphics family', () => {
    expect(doc.color.mode).toBe('cmyk')
    expect(doc.color.iccProfile).toBe('icc/PSOuncoated_v3_FOGRA52.icc')
    expect(['x1a', 'x4']).toContain(doc.color.pdfxVariant)
    expect(RENDER_INTENTS).toContain(doc.color.renderIntent)
    // a flat, vivid typographic graphic → not the photo-only 'perceptual' intent.
    expect(doc.color.renderIntent).not.toBe('perceptual')
    // dark ground — carries the S1 combustion warmth across the threshold.
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

  it('points at the S1→S2 wayfinding wall via props.invId', () => {
    expect(doc.props?.invId).toBe(WAYFINDING_S1_S2_INV_ID)
    expect(WAYFINDING_S1_S2_INV_ID).toBe(10)
  })
})

describe('wayfinding-s1-s2 — physical fit to wall 10 (S1→S2 threshold)', () => {
  const wall = findWallByInvId(WAYFINDING_S1_S2_INV_ID)

  it('targets the registered S1→S2 wall', () => {
    expect(wall).toBeDefined()
    expect(wall?.registry?.invId).toBe(10)
    expect(wall?.registry?.sala).toContain('S2')
    expect(wall?.registry?.track).toBe('C') // code track
  })

  it('spans the full 6.5 m × 2.5 m wall face as a full-bleed vinyl', () => {
    if (!wall) throw new Error('wall 10 missing')
    const wallHeightMm = resolveWallHeight(wall) * 1000
    const wallLengthMm = wall.length * 1000
    const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions

    // Wall 10 has no measured alturaM yet → the 2.5 m default governs.
    expect(wallHeightMm).toBe(DEFAULT_WALL_HEIGHT_M * 1000)
    expect(wallLengthMm).toBeCloseTo(6500, 6)
    // The trim is the *visible* wall face: a full-bleed vinyl covers the whole
    // 6 m run × 2.5 m height, edge to edge.
    expect(trimWidthMm).toBeCloseTo(wallLengthMm, 6)
    expect(trimHeightMm).toBe(wallHeightMm)
    // Bleed extends beyond the face and is trimmed / wrapped at install.
    expect(bleedMm).toBeGreaterThan(0)
  })
})

describe('wayfinding-s1-s2 — the authored canvas is legible at its reading distance', () => {
  it('every text level clears the museographic floor for the wall, with a dominant title', () => {
    const dist = readingDistanceM()
    const scale = eventTypeScale({
      trimHeightMm: doc.dimensions.trimHeightMm,
      readingDistanceM: dist,
      h1CapFraction: H1_CAP_FRACTION,
    })
    expect(scale.minCapHeightMm).toBeCloseTo(minCapHeightMm(dist), 9)
    // documented cm sizes — the three levels the page renders, all legible at distance
    for (const cap of [scale.capHeights.h1Mm, scale.capHeights.h4Mm, scale.capHeights.eyebrowMm]) {
      expect(isLegibleAtDistance(cap, dist)).toBe(true)
    }
    // the room title is the protagonist (≥ 15 cm cap-height here), above the tag and eyebrow
    expect(scale.capHeights.h1Mm).toBeGreaterThanOrEqual(150)
    expect(scale.capHeights.h1Mm).toBeGreaterThan(scale.capHeights.h4Mm)
    expect(scale.capHeights.h4Mm).toBeGreaterThan(scale.capHeights.eyebrowMm)
  })
})

describe('wayfinding-s1-s2 — renders real content (not a blank page)', () => {
  function render() {
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    const props: PrintPageProps = { doc, geo }
    return renderToStaticMarkup(createElement(WayfindingS1S2, props))
  }

  it('renders the locator, the room tag and the protagonist title', () => {
    const html = render()
    expect(html).toContain('Próxima sala') // the eyebrow
    expect(html).toContain('Sala 2') // the wayfinding tag (the only room named — Sala 1 is behind you)
    expect(html).toContain('Introducción a la inteligencia artificial') // the title
    expect(html).toContain('S1 → S2') // the threshold locator
  })

  it('renders the arrow (svg) and the discreet brand lockup', () => {
    const html = render()
    expect(html).toContain('<svg') // the thin-line wayfinding arrow
    expect(html).toContain('AiKit Live')
  })
})
