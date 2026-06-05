import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { ProximaSala } from './proxima-sala'
import { isLegibleAtDistance, minCapHeightMm } from './wayfinding'
import { eventTypeScale } from './tipografia'
import { buildGeometry } from '../geometry'
import type { PrintDoc, PrintPageProps } from '../types'
import { DEFAULT_WALL_HEIGHT_M, findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * proxima-sala — doc + registration tests for the wall 2-W-1 indicator.
 * ───────────────────────────────────────────────────────────────────────
 * The museographic maths lives in `tipografia.ts` and is unit-tested there. This
 * file covers the *authoring* of the print: `public/prints/marco-2-w-1/doc.json`
 * (the left 6.25 m print of the West / combustión face of wall 2) and its
 * registration. The checks prove the authored piece is honest and renderable — it
 * resolves from the registry, ships the CMYK / FOGRA39 / PDF/X contract on a clean
 * paper ground, physically fits within the wall-2 West face, sizes its two text
 * levels legibly **yet small** (a marginal tag, not a headline), and renders the
 * real next-room content (eyebrow + room name + arrow), not a blank page.
 */

// public/ lives outside the src bundle root → read the committed file directly.
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/marco-2-w-1/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

// Mirror the page's own small name-cap fraction so the *authored* sizes are proven,
// not a convenient test value (see proxima-sala.tsx DEFAULTS.nameCapFraction).
const NAME_CAP_FRACTION = 0.03
const WALL_INV_ID = 2

function readingDistanceM(): number {
  const v = doc.props?.readingDistanceM
  return typeof v === 'number' ? v : 4
}

describe('proxima-sala — registration', () => {
  it('is registered under its pageComponentId and resolves to the ProximaSala page', () => {
    expect(doc.pageComponentId).toBe('proxima-sala')
    expect(getPrintPage(doc.pageComponentId)).toBe(ProximaSala)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(ProximaSala)
  })

  it('doc id matches its folder (the wall-2 West-face left frame)', () => {
    expect(doc.id).toBe('marco-2-w-1')
  })
})

describe('proxima-sala — print contract', () => {
  it('is a CMYK / FOGRA39 / PDF-X print on a clean paper ground', () => {
    expect(doc.color.mode).toBe('cmyk')
    expect(doc.color.iccProfile).toBe('icc/CoatedFOGRA39.icc')
    expect(['x1a', 'x4']).toContain(doc.color.pdfxVariant)
    expect(RENDER_INTENTS).toContain(doc.color.renderIntent)
    // a flat, typographic graphic → not the photo-only 'perceptual' intent.
    expect(doc.color.renderIntent).not.toBe('perceptual')
    // light / paper register — the chosen «papel limpio» ground.
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

  it('points at the wall-2 (Nave O) frame via props', () => {
    expect(doc.props?.invId).toBe(WALL_INV_ID)
    expect(doc.props?.frameId).toBe('2-W-1')
    expect(doc.props?.side).toBe(-1)
  })
})

describe('proxima-sala — physical fit to the wall-2 West face', () => {
  const wall = findWallByInvId(WALL_INV_ID)

  it('targets the registered Nave O wall', () => {
    expect(wall).toBeDefined()
    expect(wall?.registry?.invId).toBe(WALL_INV_ID)
    expect(wall?.registry?.tema).toContain('Nave O')
  })

  it('fits within the wall face: full height, ≤ the wall run length', () => {
    if (!wall) throw new Error('wall 2 missing')
    const wallHeightMm = resolveWallHeight(wall) * 1000
    const wallLengthMm = wall.length * 1000
    const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions

    // Wall 2 has no measured alturaM yet → the 2.5 m default governs.
    expect(wallHeightMm).toBe(DEFAULT_WALL_HEIGHT_M * 1000)
    // The frame covers the full wall height…
    expect(trimHeightMm).toBe(wallHeightMm)
    // …and is one of the two West-face prints, so it is a fraction of the run.
    expect(trimWidthMm).toBeLessThanOrEqual(wallLengthMm)
    expect(trimWidthMm).toBeCloseTo(6250, 6)
    // Bleed extends beyond the face and is trimmed / wrapped at install.
    expect(bleedMm).toBeGreaterThan(0)
  })
})

describe('proxima-sala — legible yet small (a marginal tag, not a headline)', () => {
  it('the name + eyebrow clear the museographic floor, and the name stays small', () => {
    const dist = readingDistanceM()
    const scale = eventTypeScale({
      trimHeightMm: doc.dimensions.trimHeightMm,
      readingDistanceM: dist,
      h1CapFraction: NAME_CAP_FRACTION,
    })
    expect(scale.minCapHeightMm).toBeCloseTo(minCapHeightMm(dist), 9)
    // both rendered levels clear the legibility floor at the wall's distance
    expect(isLegibleAtDistance(scale.capHeights.h1Mm, dist)).toBe(true)
    expect(isLegibleAtDistance(scale.capHeights.eyebrowMm, dist)).toBe(true)
    // name above eyebrow (hierarchy), yet deliberately small: well under the
    // protagonist sizes the big wayfinding band uses (≥150 mm cap) — this is «una cosa pequeña».
    expect(scale.capHeights.h1Mm).toBeGreaterThan(scale.capHeights.eyebrowMm)
    expect(scale.capHeights.h1Mm).toBeLessThan(150)
    // a few cm of cap-height: small relative to the 2.5 m wall but comfortably legible.
    expect(scale.capHeights.h1Mm).toBeGreaterThanOrEqual(scale.comfortCapHeightMm)
  })
})

describe('proxima-sala — renders real content (not a blank page)', () => {
  function render() {
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    const props: PrintPageProps = { doc, geo }
    return renderToStaticMarkup(createElement(ProximaSala, props))
  }

  it('renders the eyebrow, the next-room name and the directional arrow', () => {
    const html = render()
    expect(html).toContain('Próxima sala') // the eyebrow
    // the room name — authored with an explicit rag (two balanced lines)
    expect(html).toContain('Velocidad')
    expect(html).toContain('de progreso')
    expect(html).toContain('<svg') // the discreet thin-line arrow
  })
})
