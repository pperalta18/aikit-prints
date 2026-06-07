import { describe, expect, it } from 'vitest'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { Cuadro } from './cuadro.tsx'
import { layoutCuadro } from './cuadro'
import { eventTypeScale, bodyMeasureMm } from './tipografia'
import { buildGeometry } from '../geometry'
import type { PrintDoc } from '../types'
import { findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * cuadro doc + registration tests
 * ───────────────────────────────
 * The three **museum-painting** walls (3-N-1, 8-N-1, 19-N-1) are the same `cuadro`
 * page pointed at a committed relief PNG with curated copy. The page maths is
 * proven in `cuadro.test.ts`; this file proves the *authoring*: that each doc is
 * registered, exports through the print contract, hangs on its real wall, points
 * at a committed painting asset, carries real cartela copy, and that the authored
 * dimensions lay the painting + cartela out within the wall (no overflow).
 */

const WALLS = [
  { slug: '3-n-1', invId: 3 },
  { slug: '8-n-1', invId: 8 },
  { slug: '19-n-1', invId: 19 },
] as const

// Defaults mirrored from `cuadro.tsx` DEFAULTS, so the authored canvas is proven
// with the exact constants the page renders with (same idea as hero-solar-doc).
const DEFAULTS = { paintingAspect: 2 / 3, paintingHeightFraction: 0.84, titleCapFraction: 0.012, ratio: 1.28, cartelaChars: 42 }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

function docFor(slug: string): PrintDoc {
  const path = fileURLToPath(new URL(`../../../public/prints/${slug}/doc.json`, import.meta.url))
  return JSON.parse(readFileSync(path, 'utf8')) as PrintDoc
}

function assetPath(slug: string): string {
  return fileURLToPath(new URL(`../../../public/prints/${slug}/assets/${slug}.png`, import.meta.url))
}

describe.each(WALLS)('cuadro doc — $slug', ({ slug, invId }) => {
  const doc = docFor(slug)
  const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d)
  const p = (doc.props ?? {}) as Record<string, unknown>

  it('is registered under the cuadro page and matches its folder', () => {
    expect(doc.id).toBe(slug)
    expect(doc.pageComponentId).toBe('cuadro')
    expect(getPrintPage(doc.pageComponentId)).toBe(Cuadro)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(Cuadro)
  })

  it('exports through the CMYK / FOGRA52 / PDF-X print contract', () => {
    expect(doc.color.mode).toBe('cmyk')
    expect(doc.color.iccProfile).toBe('icc/PSOuncoated_v3_FOGRA52.icc')
    expect(['x1a', 'x4']).toContain(doc.color.pdfxVariant)
    expect(RENDER_INTENTS).toContain(doc.color.renderIntent)
    // The relief is photographic-grey content → perceptual (smooth gamut), like the raster track.
    expect(doc.color.renderIntent).toBe('perceptual')
    expect(doc.theme).toBe('light')
  })

  it('declares a sane metre-scale DPI with an integer canvas', () => {
    expect(doc.dpi).toBeGreaterThan(0)
    expect(doc.dpi).toBeLessThanOrEqual(150)
    const geo = buildGeometry(doc.dimensions, doc.dpi)
    expect(Number.isInteger(geo.mediaWidthPx)).toBe(true)
    expect(Number.isInteger(geo.mediaHeightPx)).toBe(true)
    expect(geo.mediaWidthPx).toBeGreaterThan(0)
    expect(geo.mediaWidthPx).toBeLessThan(20000)
    expect(geo.mediaHeightPx).toBeLessThan(20000)
  })

  it('carries real, clean cartela copy (title + ≥1 paragraph per label; no eyebrow/subtitle/divider)', () => {
    // Any cartela a doc declares must carry a real title and at least one non-empty paragraph.
    const expectCartelaCopy = (t: unknown, ps: unknown) => {
      expect(typeof t).toBe('string')
      expect((t as string).length).toBeGreaterThan(3)
      expect(Array.isArray(ps)).toBe(true)
      expect((ps as unknown[]).length).toBeGreaterThanOrEqual(1)
      for (const para of ps as unknown[]) {
        expect(typeof para).toBe('string')
        expect((para as string).length).toBeGreaterThan(0)
      }
    }
    // The cleaned-up cartela drops the eyebrow, subtitle and the title↔body rule.
    expect(p.eyebrow).toBeUndefined()
    expect(p.subtitle).toBeUndefined()
    expect(p.divider).toBe(false)
    expectCartelaCopy(p.title, p.paragraphs)
    // A dual-cartela diptych (8-N-1) labels each relief — its second cartela needs its own copy.
    if (p.dualCartela === true) {
      expectCartelaCopy(p.title2, p.paragraphs2)
    }
    // The ficha técnica is now opt-in (the clean label reads as a meditation, not a catalogue
    // entry); when a doc still keeps it, it must read as a real ficha.
    if (typeof p.meta === 'string') {
      expect(p.meta).toContain('AiKit Live')
    }
  })

  it('points at committed painting asset(s) (non-trivial PNG; both reliefs for a diptych)', () => {
    const ap = assetPath(slug)
    expect(existsSync(ap)).toBe(true)
    expect(statSync(ap).size).toBeGreaterThan(50 * 1024) // a real relief, not a stub
    // A diptych wall (8-N-1) commits a second relief via `src2`.
    if (typeof p.src2 === 'string') {
      const ap2 = fileURLToPath(new URL(`../../../public/${p.src2}`, import.meta.url))
      expect(existsSync(ap2)).toBe(true)
      expect(statSync(ap2).size).toBeGreaterThan(50 * 1024)
    }
  })

  it('hangs full-wall-height on its registered wall', () => {
    const wall = findWallByInvId(invId)
    expect(wall).toBeDefined()
    if (!wall) throw new Error(`wall ${invId} missing`)
    const wallHeightMm = resolveWallHeight(wall) * 1000
    const wallLengthMm = wall.length * 1000
    // The marco walls are full-wall canvases: trim height == the wall height.
    expect(doc.dimensions.trimHeightMm).toBe(wallHeightMm)
    // And the art spans (about) the wall run — these are wide event walls.
    expect(doc.dimensions.trimWidthMm).toBeLessThanOrEqual(wallLengthMm + 1)
  })

  it('lays the painting(s) + cartela out inside the wall (no overflow)', () => {
    const W = doc.dimensions.trimWidthMm
    const H = doc.dimensions.trimHeightMm
    const readingDistanceM = num(p.readingDistanceM, 1.7)
    const scale = eventTypeScale({
      trimHeightMm: H,
      readingDistanceM,
      ratio: DEFAULTS.ratio,
      h1CapFraction: DEFAULTS.titleCapFraction,
    })
    // Mirror the page's cartela-width clamp (a sane physical width in mm).
    const cartelaWidthMm = clamp(
      bodyMeasureMm(scale.bodyPt, { chars: DEFAULTS.cartelaChars }),
      Math.min(W * 0.12, 300),
      Math.min(W * 0.45, 560),
    )
    const secondPainting = typeof p.src2 === 'string'
    // Mirror the page: a dual-cartela diptych hangs each label an exact ½ m from its relief.
    const dualCartela = p.dualCartela === true && secondPainting
    const gapMm = dualCartela ? num(p.cartelaGapMm, 500) : W * 0.022
    const layout = layoutCuadro({
      wallWidthMm: W,
      wallHeightMm: H,
      paintingAspect: DEFAULTS.paintingAspect,
      paintingHeightFraction: DEFAULTS.paintingHeightFraction,
      cartelaWidthMm,
      gapMm,
      placement: 'left',
      secondPainting,
      dualCartela,
    })
    const eps = 1e-6
    // diptych walls resolve a second relief; single walls do not
    expect(Boolean(layout.painting2)).toBe(secondPainting)
    // a dual-cartela diptych resolves a second label too; others keep a single cartela
    expect(Boolean(layout.cartela2)).toBe(dualCartela)
    // painting fits within the wall height with margin (it's a hung work, not full-bleed)
    expect(layout.painting.height).toBeLessThan(H)
    expect(layout.painting.width / layout.painting.height).toBeCloseTo(DEFAULTS.paintingAspect, 6)
    // every box inside the wall
    const boxes = [
      layout.painting,
      layout.cartela,
      ...(layout.painting2 ? [layout.painting2] : []),
      ...(layout.cartela2 ? [layout.cartela2] : []),
    ]
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(-eps)
      expect(box.x + box.width).toBeLessThanOrEqual(W + eps)
      expect(box.y).toBeGreaterThanOrEqual(-eps)
      expect(box.y + box.height).toBeLessThanOrEqual(H + eps)
    }
    // generous gallery air both sides (the image is the protagonist)
    expect(layout.group.x).toBeGreaterThan(W * 0.05)
  })
})
