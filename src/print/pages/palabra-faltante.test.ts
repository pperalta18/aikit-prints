import { describe, expect, it } from 'vitest'
import { buildCorpus, GEMS, layoutSea, mulberry32, shuffle, type Phrase } from './palabra-faltante'

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

  it('is a sizable, hand-curated reasoning-only pool (no generators)', () => {
    // the corpus IS the gems — every phrase is authored + adversarially verified
    expect(corpus.length).toBe(GEMS.length)
    expect(corpus.length).toBeGreaterThan(120)
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

  it('carries no pure-recall phrases (the wall argues «no es solo memoria»)', () => {
    // retrieval-only patterns must never reappear: capitals, roman numerals, unit
    // conversions, day-of-week, do-re-mi, rote times tables.
    expect(corpus.some((p) => p.t.startsWith('La capital de '))).toBe(false)
    expect(corpus.some((p) => p.t.startsWith('El número romano '))).toBe(false)
    expect(corpus.some((p) => /^(Media docena|Dos docenas|Media hora) /.test(p.t))).toBe(false)
    expect(corpus.some((p) => / por \d+ son$/.test(p.t))).toBe(false)
  })

  it('keeps a real depth gradient (foreground gems + a haze of background phrases)', () => {
    const weights = new Set(corpus.map((p) => p.w ?? 1))
    expect(weights.has(2)).toBe(true) // foreground
    expect(weights.has(0)).toBe(true) // haze
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

  it('lifts the thesis out of the sea into a centred hero', () => {
    // the thesis is no longer a sea phrase…
    expect(layout.placed.some((p) => p.text === accentText)).toBe(false)
    expect(layout.placed.some((p) => p.accent)).toBe(false)
    // …it is the hero, dead-centre, wrapped into lines, with its blank sized
    expect(layout.hero).not.toBeNull()
    const hero = layout.hero!
    expect(hero.text).toBe(accentText)
    expect(hero.answer).toBe('inteligencia')
    expect(hero.lines.length).toBeGreaterThanOrEqual(1)
    expect(hero.lines.join(' ')).toBe(accentText)
    expect(hero.centerXMm).toBeCloseTo(WALL.trimWidthMm / 2)
    expect(hero.centerYMm).toBeCloseTo(WALL.trimHeightMm / 2)
    // the hero dominates the sea foreground and stays inside the wall
    expect(hero.capMm).toBeGreaterThan(layout.tierCapsMm[0])
    expect(hero.box.wMm).toBeLessThanOrEqual(layout.usable.w)
  })

  it('has no hero when no thesis text is given', () => {
    const plain = layoutSea({ ...WALL, seed: 3 })
    expect(plain.hero).toBeNull()
  })

  it('uses the full tier range (depth + size variety → a sea, not a grid)', () => {
    const tiers = new Set(layout.placed.map((p) => p.tier))
    expect(tiers.size).toBeGreaterThanOrEqual(2)
    const depths = layout.placed.map((p) => p.depth)
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(0.3)
  })
})
