import { describe, expect, it } from 'vitest'
import {
  defaultRasterSrc,
  normalizeRasterSrc,
  resolveRasterImage,
  type PrintDocLike,
} from './raster'
import type { PrintDoc } from '../types'

/**
 * Unit tests for the image-track raster page's resolution logic (Phase 1,
 * "raster-in-print" path).
 *
 * What these pin is the *contract the export depends on*, not a re-pasted table:
 *   • the path handed to `staticFile()` is always relative to public/ (a leading
 *     "/" or a "public/" prefix would silently load the wrong/no file → a blank
 *     wall in the deterministic render);
 *   • a bare doc still resolves to its convention asset, so authoring a wall is
 *     just a `doc.json`;
 *   • the default fill is full-bleed ('cover'), because a wall graphic must reach
 *     every edge — and a bogus `fit` can never leak through to CSS.
 * Asserting these invariants means a regression can't make the test agree with
 * broken resolution.
 */

const doc = (id: string, props?: Record<string, unknown>): Pick<PrintDoc, 'id' | 'props'> => ({
  id,
  props,
})

describe('defaultRasterSrc', () => {
  it('follows the prints/<id>/assets/<id>.png convention', () => {
    expect(defaultRasterSrc('pared-04')).toBe('prints/pared-04/assets/pared-04.png')
  })
})

describe('normalizeRasterSrc', () => {
  it('leaves a clean relative path untouched', () => {
    expect(normalizeRasterSrc('prints/x/assets/y.png')).toBe('prints/x/assets/y.png')
  })

  it('strips a leading slash (staticFile wants a relative path)', () => {
    expect(normalizeRasterSrc('/prints/x/assets/y.png')).toBe('prints/x/assets/y.png')
    expect(normalizeRasterSrc('///prints/x.png')).toBe('prints/x.png')
  })

  it('strips an accidental public/ prefix (that is the staticFile root)', () => {
    expect(normalizeRasterSrc('public/prints/x.png')).toBe('prints/x.png')
  })

  it('collapses double slashes and trims whitespace', () => {
    expect(normalizeRasterSrc('  prints//x///y.png  ')).toBe('prints/x/y.png')
  })
})

describe('resolveRasterImage', () => {
  it('falls back to the convention asset when no props are given', () => {
    expect(resolveRasterImage(doc('raster-proof'))).toEqual({
      src: 'prints/raster-proof/assets/raster-proof.png',
      fit: 'cover',
      position: 'center',
      alt: undefined,
    })
  })

  it('uses props.src and normalises it for staticFile', () => {
    const r = resolveRasterImage(doc('w', { src: '/public/prints/w/assets/hero.png' }))
    expect(r.src).toBe('prints/w/assets/hero.png')
  })

  it('ignores a blank/whitespace src and uses the convention path', () => {
    expect(resolveRasterImage(doc('w', { src: '   ' })).src).toBe('prints/w/assets/w.png')
  })

  it('defaults to full-bleed cover and honours an explicit contain', () => {
    expect(resolveRasterImage(doc('w')).fit).toBe('cover')
    expect(resolveRasterImage(doc('w', { fit: 'contain' })).fit).toBe('contain')
  })

  it('never lets a bogus fit reach CSS — falls back to cover', () => {
    expect(resolveRasterImage(doc('w', { fit: 'fill' })).fit).toBe('cover')
    expect(resolveRasterImage(doc('w', { fit: 42 })).fit).toBe('cover')
  })

  it('defaults object-position to center and honours a custom one', () => {
    expect(resolveRasterImage(doc('w')).position).toBe('center')
    expect(resolveRasterImage(doc('w', { position: '50% 30%' })).position).toBe('50% 30%')
  })

  it('passes through an alt string only when present', () => {
    expect(resolveRasterImage(doc('w', { alt: 'combustion' })).alt).toBe('combustion')
    expect(resolveRasterImage(doc('w', { alt: 123 })).alt).toBeUndefined()
  })
})

// Type-level: PrintDocLike must accept a real PrintDoc subset (compile-time guard).
const _typecheck: PrintDocLike = { id: 'x' }
void _typecheck
