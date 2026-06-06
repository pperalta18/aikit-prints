/**
 * Unit tests for Phase 0's final task: deciding pieces for the four
 * previously-unannotated walls — inv **3, 5, 14, 15** ("no blank walls").
 *
 * These pin the *decision contract*, not the prose: each of the four must now be
 * a real proposal (estado `prop`), carry a decided production track (never the
 * `C/I` "undecided" marker), and have shed the `(sin anotar)` placeholder text —
 * while their committed geometry (the brief `largo_m` anchors) stays intact so a
 * registry edit can't silently clobber a footprint. Two global invariants make
 * the test resist a partial fix: NO registered wall may keep `track: 'C/I'` and
 * NONE may keep an "unannotated" placeholder, so leaving any of the four behind
 * fails here even if the others were updated.
 *
 * The per-wall `track` assertions mirror the decision recorded in
 * `specs/wall-graphics.md` (Per-wall inventory): 3 = C (Umbral S2→S3 title-band),
 * 5 = H (Puente S5→S6), 14 = C (micro typographic accent), 15 = I (warm vertical
 * identity). All four are orientation / transition / accent pieces, so none
 * carries data — `research` must be false (keeps the honest-data track clean).
 */

import { describe, expect, it } from 'vitest'
import { REGISTERED_WALLS, findWallByInvId, type Track } from './eventLayout'

/** The four walls the brief left unannotated; Phase 0 owes each a decided piece. */
const UNANNOTATED_INV_IDS = [3, 5, 14, 15] as const

/** The decided track per wall, as recorded in the spec inventory. */
const DECIDED_TRACK: Record<number, Track> = { 3: 'C', 5: 'H', 14: 'C', 15: 'I' }

/** Committed footprint length (m) per wall — geometry guard against clobbering.
 *  Reflects the 2026-06-06 floor plan (inv 3 4.0→3.5 m, inv 5 9.5→9.75 m). */
const LARGO_M: Record<number, number> = { 3: 3.5, 5: 9.75, 14: 1.5, 15: 4.0 }

describe('Phase 0 — the four formerly-unannotated walls are decided', () => {
  for (const invId of UNANNOTATED_INV_IDS) {
    describe(`inv ${invId}`, () => {
      const wall = findWallByInvId(invId)

      it('exists and maps to wall-(invId-1)', () => {
        expect(wall).toBeDefined()
        expect(wall!.id).toBe(`wall-${invId - 1}`)
      })

      it('is a proposed piece, not pending', () => {
        expect(wall!.registry!.estado).toBe('prop')
      })

      it('has a decided production track (never the C/I placeholder)', () => {
        expect(wall!.registry!.track).not.toBe('C/I')
        expect(wall!.registry!.track).toBe(DECIDED_TRACK[invId])
      })

      it('carries no data (orientation / transition / accent piece)', () => {
        expect(wall!.registry!.research).toBe(false)
      })

      it('has shed the "(sin anotar)" placeholder in tema and rol', () => {
        const r = wall!.registry!
        expect(r.tema.toLowerCase()).not.toContain('sin anotar')
        expect(r.rol.toLowerCase()).not.toContain('sin anotar')
      })

      it('has a substantive role, not the bare "Proponer" stub', () => {
        const rol = wall!.registry!.rol.trim()
        expect(rol.length).toBeGreaterThan(20)
        // The stub was literally "Proponer (...)"; a real proposal does more.
        expect(/^proponer\b/i.test(rol)).toBe(false)
      })

      it('keeps its committed footprint length (geometry not clobbered)', () => {
        expect(wall!.length).toBeCloseTo(LARGO_M[invId], 5)
      })
    })
  }
})

describe('Phase 0 — global "no undecided wall" invariants', () => {
  it('no registered wall keeps the C/I undecided track', () => {
    const undecided = REGISTERED_WALLS.filter((w) => w.registry!.track === 'C/I')
    expect(undecided.map((w) => w.registry!.invId)).toEqual([])
  })

  it('no registered wall keeps a "sin anotar" placeholder tema', () => {
    const unannotated = REGISTERED_WALLS.filter((w) =>
      w.registry!.tema.toLowerCase().includes('sin anotar'),
    )
    expect(unannotated.map((w) => w.registry!.invId)).toEqual([])
  })

  it('every registered wall has a non-pending OR not-undecided status with a real track', () => {
    // Walls may still be `pend` where the brief itself owes a piece (S4 cinema,
    // S1 perimeter, S4/S5 transition are Phase-5 proposals) — but none of those
    // is "undecided" in track. The C/I marker, specifically, must be gone.
    for (const w of REGISTERED_WALLS) {
      expect(['C', 'I', 'H']).toContain(w.registry!.track)
    }
  })
})
