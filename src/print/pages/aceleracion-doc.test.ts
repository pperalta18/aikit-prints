import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { Aceleracion } from './aceleracion.tsx'
import { ACELERACION_INV_ID, chartInputFor, planAccelerationLayout } from './aceleracion'
import { buildGeometry } from '../geometry'
import type { PrintDoc, PrintPageProps } from '../types'
import { piecesByInvId } from '../space/wall-data'
import { DEFAULT_WALL_HEIGHT_M, findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * aceleracion (#11) doc + registration tests
 * ──────────────────────────────────────────
 * The chart maths lives in `aceleracion.ts` / `model-sizes.ts` and is unit-tested
 * there. This file covers the *authoring* of the print: `public/prints/aceleracion/
 * doc.json` and its registration. The unbiased point is to prove the authored
 * **dimensions are honest and renderable** — the page resolves from the registry,
 * exports through the existing CMYK / FOGRA52 / PDF/X contract, physically fits
 * wall 11 (the 23 m S3 "Nave E" light-box) on its eye band, and lays the *two real,
 * sourced* wall-11 charts out at the authored canvas — not just that JSON exists.
 */

// public/ lives outside the src bundle root → read the committed file directly.
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/aceleracion/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

describe('aceleracion — registration', () => {
  it('is registered under its pageComponentId and resolves to the Aceleracion page', () => {
    expect(doc.pageComponentId).toBe('aceleracion')
    expect(getPrintPage(doc.pageComponentId)).toBe(Aceleracion)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(Aceleracion)
  })

  it('doc id matches its folder/page key', () => {
    expect(doc.id).toBe('aceleracion')
  })
})

describe('aceleracion — print contract', () => {
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

  it('points at the acceleration wall via props.invId', () => {
    expect(doc.props?.invId).toBe(ACELERACION_INV_ID)
    expect(ACELERACION_INV_ID).toBe(11)
  })
})

describe('aceleracion — physical fit to wall 11 (S3 Nave E)', () => {
  const wall = findWallByInvId(ACELERACION_INV_ID)

  it('targets the registered S3 wall', () => {
    expect(wall).toBeDefined()
    expect(wall?.registry?.invId).toBe(11)
    expect(wall?.registry?.sala).toContain('S3')
  })

  it('fits within the wall height (incl. bleed) and along its run', () => {
    if (!wall) throw new Error('wall 11 missing')
    const wallHeightMm = resolveWallHeight(wall) * 1000
    const wallLengthMm = wall.length * 1000
    const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions
    const mediaHeightMm = trimHeightMm + 2 * bleedMm
    const mediaWidthMm = trimWidthMm + 2 * bleedMm

    // Wall 11 has no measured alturaM yet → the 2.5 m default governs.
    expect(wallHeightMm).toBe(DEFAULT_WALL_HEIGHT_M * 1000)
    // The whole media (art + bleed) must hang inside the wall height.
    expect(mediaHeightMm).toBeLessThanOrEqual(wallHeightMm)
    // It rides the eye band, so it is shorter than the full wall.
    expect(trimHeightMm).toBeLessThan(wallHeightMm)
    // Both zoned charts fit along the 23 m run (this panel is one camera bay).
    expect(wallLengthMm).toBeGreaterThan(0)
    expect(mediaWidthMm).toBeLessThanOrEqual(wallLengthMm)
  })
})

describe('aceleracion — the authored canvas lays the two real charts out honestly', () => {
  const charts = piecesByInvId(ACELERACION_INV_ID).map(chartInputFor)
  const layoutAtDoc = () => planAccelerationLayout(charts, doc.dimensions.trimWidthMm, doc.dimensions.trimHeightMm)

  it('the wall actually has two sourced charts to render', () => {
    expect(charts).toHaveLength(2)
    for (const c of charts) expect(c.data.length).toBeGreaterThan(0)
  })

  it('places every point in-bounds on each authored column', () => {
    const { panels } = layoutAtDoc()
    const eps = 1e-6
    expect(panels).toHaveLength(2)
    for (const panel of panels) {
      expect(panel.timeline.points.length).toBeGreaterThan(0)
      for (const p of panel.timeline.points) {
        expect(p.x).toBeGreaterThanOrEqual(-eps)
        expect(p.x).toBeLessThanOrEqual(panel.width + eps)
        expect(p.y).toBeGreaterThanOrEqual(-eps)
        expect(p.y).toBeLessThanOrEqual(panel.height + eps)
      }
    }
  })

  it('keeps the honest logarithmic read at the authored size (constant px/decade)', () => {
    const { panels } = layoutAtDoc()
    for (const panel of panels) {
      const slopes: number[] = []
      const pts = panel.timeline.points
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          slopes.push((pts[i].y - pts[j].y) / (Math.log10(pts[i].value) - Math.log10(pts[j].value)))
        }
      }
      for (const s of slopes) expect(s).toBeCloseTo(slopes[0], 4)
    }
  })

  it('is deterministic — same doc dimensions give the same layout', () => {
    const a = layoutAtDoc()
    const b = layoutAtDoc()
    const flat = (l: ReturnType<typeof layoutAtDoc>) => l.panels.map((p) => [p.x, p.width, p.timeline.points.map((pt) => [pt.id, pt.x, pt.y])])
    expect(flat(b)).toEqual(flat(a))
  })
})

describe('aceleracion — renders real content (not a blank page)', () => {
  function render() {
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    const props: PrintPageProps = { doc, geo }
    return renderToStaticMarkup(createElement(Aceleracion, props))
  }

  it('renders the title, message and the room eyebrow', () => {
    const html = render()
    expect(html).toContain('Aceleración')
    expect(html).toContain('se aceleran')
    expect(html).toContain('NAVE E')
  })

  it('renders both zoned chart titles', () => {
    const html = render()
    expect(html).toContain('Horizonte de tareas (METR)')
    expect(html).toContain('Ventana de contexto')
  })

  it('renders each plot (svg trajectory + decade rungs) and the models from the data', () => {
    const html = render()
    expect(html).toContain('<svg')
    expect(html).toContain('<polyline')
    expect(html).toContain('<line') // decade gridlines
    // distinctive models from each chart
    expect(html).toContain('GPT-2')
    expect(html).toContain('Claude 3.7 Sonnet') // task-horizon chart
    expect(html).toContain('Gemini 1.5 Pro') // context chart
    // endpoint years from both charts
    expect(html).toContain('2019')
    expect(html).toContain('2020')
    expect(html).toContain('2024')
  })

  it('reads the real values per chart (duration for seconds, magnitude for tokens)', () => {
    const html = render()
    expect(html).toContain('4 min') // GPT-4 task horizon (240 s)
    expect(html).toContain('1 h') // Claude 3.7 Sonnet (3600 s)
    expect(html).toContain('2 K') // GPT-3 context (2048 tokens)
    expect(html).toContain('1 M') // Gemini 1.5 Pro context (1 000 000 tokens)
  })

  it('stamps the mandatory annotations per chart: log scale note + source caption', () => {
    const html = render()
    expect(html).toContain('Escala logarítmica')
    expect(html).toContain('Fuentes:')
    expect(html).toContain('metr.org') // task-horizon source host
  })
})
