import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PRINT_PAGES, getPrintPage } from './index'
import { HeroSolar, HERO_INV_ID } from './hero-solar.tsx'
import { fitHeroMaxRadius, layoutHeroSolar } from './hero-solar'
import { buildGeometry } from '../geometry'
import type { PrintDoc } from '../types'
import { dataForWall, pieceByInvId } from '../space/wall-data'
import { DEFAULT_WALL_HEIGHT_M, findWallByInvId, resolveWallHeight } from '../space/eventLayout'

/**
 * hero-solar doc + registration tests
 * ───────────────────────────────────
 * Phase 4 (hero vertical slice): the page logic already lives in `hero-solar.ts`
 * /`hero-solar.tsx` and is unit-tested there. This file covers the *authoring* of
 * the print: the `public/prints/hero-solar/doc.json` and its registration in the
 * page registry. The point of an unbiased test here is to prove the authored
 * **dimensions are honest and renderable** — that the chosen real-wall canvas
 * actually lays the *real, sourced* wall-2 data out (no starve/overlap), fits the
 * physical wall it hangs on, and exports through the existing print contract
 * (CMYK / FOGRA39 / PDF/X) — not just that some JSON exists.
 */

// public/ lives outside the src bundle root → read the committed file directly.
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/hero-solar/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as PrintDoc

const RENDER_INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']

describe('hero-solar — registration', () => {
  it('is registered under its pageComponentId and resolves to the HeroSolar page', () => {
    expect(doc.pageComponentId).toBe('hero-solar')
    expect(getPrintPage(doc.pageComponentId)).toBe(HeroSolar)
    expect(PRINT_PAGES[doc.pageComponentId]).toBe(HeroSolar)
  })

  it('doc id matches its folder/page key', () => {
    expect(doc.id).toBe('hero-solar')
  })
})

describe('hero-solar — print contract', () => {
  it('is a CMYK / FOGRA39 / PDF-X print like the rest of the family', () => {
    expect(doc.color.mode).toBe('cmyk')
    expect(doc.color.iccProfile).toBe('icc/CoatedFOGRA39.icc')
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

  it('points at the hero wall via props.invId', () => {
    expect(doc.props?.invId).toBe(HERO_INV_ID)
    expect(HERO_INV_ID).toBe(2)
  })
})

describe('hero-solar — physical fit to wall 2 (S3 face)', () => {
  const wall = findWallByInvId(HERO_INV_ID)

  it('targets a registered S3 wall', () => {
    expect(wall).toBeDefined()
    expect(wall?.registry?.invId).toBe(2)
    expect(wall?.registry?.sala).toContain('S3')
  })

  it('fits within the wall height (incl. bleed) and along its run, as one camera zone', () => {
    if (!wall) throw new Error('wall 2 missing')
    const wallHeightMm = resolveWallHeight(wall) * 1000
    const wallLengthMm = wall.length * 1000
    const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions
    const mediaHeightMm = trimHeightMm + 2 * bleedMm
    const mediaWidthMm = trimWidthMm + 2 * bleedMm

    // Wall 2 has no measured alturaM yet → the 2.5 m default governs.
    expect(wallHeightMm).toBe(DEFAULT_WALL_HEIGHT_M * 1000)
    // The whole media (art + bleed) must hang inside the wall height.
    expect(mediaHeightMm).toBeLessThanOrEqual(wallHeightMm)
    // It rides the eye band, so it is shorter than the full wall.
    expect(trimHeightMm).toBeLessThan(wallHeightMm)
    // It is the INVESTMENT *camera* panel, not a poster stretched over the 22.5 m
    // run — comfortably under one of the three nave camera bays.
    expect(mediaWidthMm).toBeLessThanOrEqual(wallLengthMm)
    expect(trimWidthMm).toBeLessThanOrEqual(wallLengthMm / 3)
  })
})

describe('hero-solar — the authored canvas lays the real data out honestly', () => {
  const data = dataForWall(HERO_INV_ID)

  // Replicates the geometry math in hero-solar.tsx so the *authored* dimensions
  // are proven, not just a convenient test size.
  function layoutAtDoc() {
    const W = doc.dimensions.trimWidthMm
    const H = doc.dimensions.trimHeightMm
    const minDim = Math.min(W, H)
    const centerRadius = minDim * 0.14
    const minRadius = minDim * 0.022
    const gap = minDim * 0.01
    const maxRadius = fitHeroMaxRadius(
      data.map((d) => d.value),
      { width: W, height: H, minRadius, centerRadius, fill: 0.4 },
    )
    return { layout: layoutHeroSolar(data, { width: W, height: H, maxRadius, minRadius, gap, centerRadius }), W, H, centerRadius }
  }

  it('the hero wall actually has sourced data to render', () => {
    const piece = pieceByInvId(HERO_INV_ID)
    expect(piece).toBeDefined()
    expect(data.length).toBeGreaterThan(0)
  })

  it('packs every body in-bounds, non-overlapping, and clear of the centre hole', () => {
    const { layout, W, H, centerRadius } = layoutAtDoc()
    const eps = 1e-6
    expect(layout.bodies.length).toBe(data.length)

    for (const b of layout.bodies) {
      // fully inside the media
      expect(b.cx - b.r).toBeGreaterThanOrEqual(-eps)
      expect(b.cx + b.r).toBeLessThanOrEqual(W + eps)
      expect(b.cy - b.r).toBeGreaterThanOrEqual(-eps)
      expect(b.cy + b.r).toBeLessThanOrEqual(H + eps)
      // fully outside the "esto es IA" hole
      const dCenter = Math.hypot(b.cx - layout.center.x, b.cy - layout.center.y)
      expect(dCenter).toBeGreaterThanOrEqual(centerRadius + b.r - eps)
    }

    // pairwise non-overlap
    for (let i = 0; i < layout.bodies.length; i++) {
      for (let j = i + 1; j < layout.bodies.length; j++) {
        const a = layout.bodies[i]
        const b = layout.bodies[j]
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.r + b.r - eps)
      }
    }
  })

  it('the biggest ball fits within the wall height (giant, but not taller than the wall)', () => {
    const { layout } = layoutAtDoc()
    const biggest = layout.bodies.reduce((m, b) => (b.r > m.r ? b : m), layout.bodies[0])
    expect(biggest.r * 2).toBeLessThanOrEqual(doc.dimensions.trimHeightMm)
    // Area ∝ money: the largest ball must be the largest value (no inverted scale).
    const maxValue = Math.max(...layout.bodies.map((b) => b.value))
    expect(biggest.value).toBe(maxValue)
  })

  it('any enlarged marble is flagged for the "ampliado, no a escala" note (never a silent lie)', () => {
    const { layout } = layoutAtDoc()
    for (const b of layout.enlarged) expect(b.toScale).toBe(false)
    for (const b of layout.bodies) {
      if (!b.toScale) expect(layout.enlarged).toContain(b)
    }
  })

  it('is deterministic — same doc dimensions give the same packing', () => {
    const a = layoutAtDoc().layout
    const b = layoutAtDoc().layout
    expect(b.bodies.map((x) => [x.id, x.cx, x.cy, x.r])).toEqual(a.bodies.map((x) => [x.id, x.cx, x.cy, x.r]))
  })
})
