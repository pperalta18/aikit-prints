import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { Codigo } from './codigo.tsx'
import { CODIGO_INV_ID, codigoChartInputFor, planCodigoLayout } from './codigo'
import { buildGeometry } from '../geometry'
import type { PrintDoc, PrintPageProps } from '../types'
import { piecesByInvId } from '../space/wall-data'
import { DEFAULT_WALL_HEIGHT_M, findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * codigo (#16) doc + registration tests
 * ─────────────────────────────────────
 * The bar maths lives in `codigo.ts` and is unit-tested there. This file covers the
 * *authoring* of the print: `public/prints/codigo/doc.json` and its registration.
 * The unbiased point is to prove the authored **dimensions are honest and
 * renderable** — the page resolves from the registry, exports through the existing
 * CMYK / FOGRA52 / PDF/X contract, physically fits wall 16 (the 3.5 m S3 "Divisoria
 * 2 TEXT+CODE"), and lays the *two real, sourced* wall-16 datasets out at the
 * authored canvas — not just that JSON exists.
 */

// public/ lives outside the src bundle root → read the committed file directly.
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/codigo/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

describe('codigo — registration', () => {
  it('is registered under its pageComponentId and resolves to the Codigo page', () => {
    expect(doc.pageComponentId).toBe('codigo')
    expect(getPrintPage(doc.pageComponentId)).toBe(Codigo)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(Codigo)
  })

  it('doc id matches its folder/page key', () => {
    expect(doc.id).toBe('codigo')
  })
})

describe('codigo — print contract', () => {
  it('is a CMYK / FOGRA52 / PDF-X print like the rest of the data-viz family', () => {
    expect(doc.color.mode).toBe('cmyk')
    expect(doc.color.iccProfile).toBe('icc/PSOuncoated_v3_FOGRA52.icc')
    expect(['x1a', 'x4']).toContain(doc.color.pdfxVariant)
    expect(RENDER_INTENTS).toContain(doc.color.renderIntent)
    // vivid brand data-viz on dark → not the photo-only 'perceptual' intent.
    expect(doc.color.renderIntent).not.toBe('perceptual')
    expect(doc.theme).toBe('dark')
  })

  it('declares a low DPI suited to a metre-scale wall (keeps the master canvas sane)', () => {
    expect(doc.dpi).toBeGreaterThan(0)
    expect(doc.dpi).toBeLessThanOrEqual(150) // "low DPI for the metre scale"
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    expect(Number.isInteger(geo.mediaWidthPx)).toBe(true)
    expect(Number.isInteger(geo.mediaHeightPx)).toBe(true)
    expect(geo.mediaWidthPx).toBeGreaterThan(0)
    expect(geo.mediaHeightPx).toBeGreaterThan(0)
    // Sanity ceiling so renderStill won't choke on an accidental giant canvas.
    expect(geo.mediaWidthPx).toBeLessThan(20000)
    expect(geo.mediaHeightPx).toBeLessThan(20000)
  })

  it('points at the code-gen wall via props.invId', () => {
    expect(doc.props?.invId).toBe(CODIGO_INV_ID)
    expect(CODIGO_INV_ID).toBe(16)
  })
})

describe('codigo — physical fit to wall 16 (S3 TEXT+CODE)', () => {
  const wall = findWallByInvId(CODIGO_INV_ID)

  it('targets the registered S3 wall', () => {
    expect(wall).toBeDefined()
    expect(wall?.registry?.invId).toBe(16)
    expect(wall?.registry?.sala).toContain('S3')
  })

  it('fits within the wall height (incl. bleed) and along its run', () => {
    if (!wall) throw new Error('wall 16 missing')
    const wallHeightMm = resolveWallHeight(wall) * 1000
    const wallLengthMm = wall.length * 1000
    const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions
    const mediaHeightMm = trimHeightMm + 2 * bleedMm
    const mediaWidthMm = trimWidthMm + 2 * bleedMm

    // Wall 16 has no measured alturaM yet → the 2.5 m default governs.
    expect(wallHeightMm).toBe(DEFAULT_WALL_HEIGHT_M * 1000)
    // The whole media (art + bleed) must hang inside the wall height.
    expect(mediaHeightMm).toBeLessThanOrEqual(wallHeightMm)
    // It rides the eye band, so it is shorter than the full wall.
    expect(trimHeightMm).toBeLessThan(wallHeightMm)
    // Both bar charts fit along the 3.5 m divisoria run.
    expect(wallLengthMm).toBeGreaterThan(0)
    expect(mediaWidthMm).toBeLessThanOrEqual(wallLengthMm)
  })
})

describe('codigo — the authored canvas lays the two real charts out honestly', () => {
  const charts = piecesByInvId(CODIGO_INV_ID).map(codigoChartInputFor)
  const layoutAtDoc = () => planCodigoLayout(charts, doc.dimensions.trimWidthMm, doc.dimensions.trimHeightMm)
  const EPS = 1e-6

  it('the wall actually has two sourced charts to render', () => {
    expect(charts).toHaveLength(2)
    for (const c of charts) expect(c.data.length).toBeGreaterThan(0)
  })

  it('places every bar in-bounds, on a zero baseline, on each authored column', () => {
    const { panels } = layoutAtDoc()
    expect(panels).toHaveLength(2)
    for (const panel of panels) {
      expect(panel.bars.bars.length).toBeGreaterThan(0)
      for (const b of panel.bars.bars) {
        expect(b.x).toBeGreaterThanOrEqual(-EPS)
        expect(b.x + b.width).toBeLessThanOrEqual(panel.width + EPS)
        expect(b.top).toBeGreaterThanOrEqual(-EPS)
        expect(b.top + b.barHeight).toBeCloseTo(panel.height, 4) // stands on the baseline
        expect(b.barHeight).toBeLessThanOrEqual(panel.height + EPS)
      }
    }
  })

  it('keeps the honest zero-based read (height ratio = value ratio)', () => {
    const { panels } = layoutAtDoc()
    for (const panel of panels) {
      const bars = panel.bars.bars
      for (let i = 0; i < bars.length; i++) {
        for (let j = i + 1; j < bars.length; j++) {
          if (bars[j].value > 0) {
            expect(bars[i].barHeight / bars[j].barHeight).toBeCloseTo(bars[i].value / bars[j].value, 5)
          }
        }
      }
    }
  })

  it('is deterministic — same doc dimensions give the same layout', () => {
    const a = layoutAtDoc()
    const b = layoutAtDoc()
    const flat = (l: ReturnType<typeof layoutAtDoc>) => l.panels.map((p) => [p.x, p.width, p.bars.bars.map((bar) => [bar.id, bar.x, bar.barHeight])])
    expect(flat(b)).toEqual(flat(a))
  })
})

describe('codigo — renders real content (not a blank page)', () => {
  function render() {
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    const props: PrintPageProps = { doc, geo }
    return renderToStaticMarkup(createElement(Codigo, props))
  }

  it('renders the title, message and the room eyebrow', () => {
    const html = render()
    expect(html).toContain('El valor del código')
    expect(html).toContain('fracción del tiempo')
    expect(html).toContain('TEXT + CODE')
  })

  it('renders both zoned chart titles', () => {
    const html = render()
    expect(html).toContain('Tiempo de desarrollo (con IA vs sin IA)')
    expect(html).toContain('Código que ya escribe la IA')
  })

  it('renders the bars (svg gridlines + baseline) and every dataset label', () => {
    const html = render()
    expect(html).toContain('<svg')
    expect(html).toContain('<line') // gridlines + baseline
    // chart A bars
    expect(html).toContain('Sin IA')
    expect(html).toContain('Con IA (Copilot)')
    // chart B bars
    expect(html).toContain('GitHub Copilot')
    expect(html).toContain('Microsoft')
    expect(html).toContain('Google')
  })

  it('reads the real values per chart (durations for minutes, percent for adoption)', () => {
    const html = render()
    expect(html).toContain('2 h 41 min') // sin IA (161 min)
    expect(html).toContain('1 h 11 min') // con IA (71 min)
    expect(html).toContain('46 %') // GitHub Copilot
    expect(html).toContain('30 %') // Microsoft
    expect(html).toContain('25 %') // Google
  })

  it('stamps the computed hooks and the mandatory annotations per chart', () => {
    const html = render()
    expect(html).toContain('Menos de la mitad del tiempo') // computed: 71/161 < 0.5
    expect(html).toContain('Hasta el 46 %') // computed: adoption max
    expect(html).toContain('Misma tarea · eje desde 0') // honest-axis note (time)
    expect(html).toContain('Escala 0–100 %') // honest-axis note (percent)
    expect(html).toContain('Fuentes:') // discreet source caption
    expect(html).toContain('github.blog') // shared source host
  })
})
