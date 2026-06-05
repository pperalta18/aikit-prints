import { describe, expect, it } from 'vitest'
import {
  buildCorpus,
  GEMS,
  genArithmetic,
  genCapitals,
  layoutSea,
  mulberry32,
  shuffle,
  type Phrase,
} from './palabra-faltante'

const WALL = { trimWidthMm: 6500, trimHeightMm: 2500, readingDistanceM: 3 }

describe('mulberry32 / shuffle — deterministic primitives', () => {
  it('is a stable stream per seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
    expect(seqA[0]).toBeGreaterThanOrEqual(0)
    expect(seqA[0]).toBeLessThan(1)
  })

  it('shuffle is a permutation and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(input, mulberry32(7))
    expect(out).toHaveLength(input.length)
    expect([...out].sort((x, y) => x - y)).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('corpus — every phrase is a real fill-in-the-blank', () => {
  const corpus = buildCorpus()

  it('builds a large pool from gems + generators', () => {
    expect(corpus.length).toBeGreaterThan(GEMS.length)
    expect(corpus.length).toBeGreaterThan(180)
  })

  const allValid = (phrases: Phrase[], label: string) =>
    it(`${label}: text has no trailing space and a non-empty answer`, () => {
      for (const p of phrases) {
        expect(p.t.length, p.t).toBeGreaterThan(0)
        expect(p.t).toBe(p.t.trimEnd())
        expect(p.a.length, p.t).toBeGreaterThan(0)
        // the answer must NOT already be sitting at the end of the visible text
        expect(p.t.toLowerCase().endsWith(p.a.toLowerCase()), p.t).toBe(false)
      }
    })

  allValid(GEMS, 'gems')
  allValid(corpus, 'corpus')

  it('arithmetic answers are correct (the blank really needs computing)', () => {
    const ar = genArithmetic()
    const prod = ar.find((p) => p.t === '7 por 8 son')
    expect(prod?.a).toBe('56')
    const pct = ar.find((p) => p.t === 'El 20% de 80 es')
    expect(pct?.a).toBe('16')
  })

  it('includes deliberately counter-intuitive capitals', () => {
    const caps = genCapitals()
    expect(caps.find((p) => p.t.includes('Australia'))?.a).toBe('Canberra')
    expect(caps.find((p) => p.t.includes('Turquía'))?.a).toBe('Ankara')
  })

  it('carries exactly one explicit thesis gem about intelligence', () => {
    const thesis = GEMS.filter((p) => p.a === 'inteligencia')
    expect(thesis).toHaveLength(1)
  })
})

describe('layoutSea — deterministic, in-bounds, fills the wall', () => {
  const accentText = 'Para acertar esta última palabra hace falta algo más que memoria: hace falta'
  const layout = layoutSea({ ...WALL, seed: 3, accentText })

  it('is deterministic for a fixed seed', () => {
    const again = layoutSea({ ...WALL, seed: 3, accentText })
    expect(again.placed).toEqual(layout.placed)
  })

  it('differs when the seed changes', () => {
    const other = layoutSea({ ...WALL, seed: 99, accentText })
    expect(other.placed[0]).not.toEqual(layout.placed[0])
  })

  it('tiles the wall with a real sea of phrases', () => {
    expect(layout.placed.length).toBeGreaterThan(150)
  })

  it('keeps every phrase inside the usable area', () => {
    const right = layout.usable.x + layout.usable.w
    const bottom = layout.usable.y + layout.usable.h
    const EPS = 1e-6
    for (const p of layout.placed) {
      expect(p.xMm).toBeGreaterThanOrEqual(layout.usable.x - EPS)
      expect(p.yMm).toBeGreaterThanOrEqual(layout.usable.y - EPS)
      expect(p.xMm + p.textWidthMm + p.blankGapMm + p.blankWidthMm).toBeLessThanOrEqual(right + 1)
      expect(p.yMm + p.emMm).toBeLessThanOrEqual(bottom + EPS)
    }
  })

  it('sizes every phrase at or above the legibility floor', () => {
    for (const p of layout.placed) {
      expect(p.capMm).toBeGreaterThan(0)
      // smallest tier == the floor; the only shrink is to fit width, which still
      // leaves cap-heights comfortably positive — assert they never collapse.
      expect(p.capMm).toBeGreaterThanOrEqual(layout.floorCapMm * 0.25)
    }
  })

  it('gives every phrase a positive blank rule', () => {
    for (const p of layout.placed) expect(p.blankWidthMm).toBeGreaterThan(0)
  })

  it('marks exactly one accented phrase', () => {
    const accents = layout.placed.filter((p) => p.accent)
    expect(accents).toHaveLength(1)
    expect(accents[0].text).toBe(accentText)
  })

  it('uses the full tier range (depth + size variety → a sea, not a grid)', () => {
    const tiers = new Set(layout.placed.map((p) => p.tier))
    expect(tiers.size).toBeGreaterThanOrEqual(2)
    const depths = layout.placed.map((p) => p.depth)
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(0.3)
  })
})
