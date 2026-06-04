import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  HERO_CAMERA_ID,
  NAVE_CAMERA_COUNT,
  NAVE_CAMERA_ORDER,
  naveS3ZonedPlacements,
  type NaveCameraId,
} from './heroNave'
import {
  DEFAULT_WALL_HEIGHT_M,
  findWallByInvId,
  resolveWallHeight,
  type Wall,
} from './eventLayout'
import {
  HERO_INV_ID,
  HERO_PRINT_ID,
  NAVE_OPPOSITE_INV_ID,
  eyeBandCenterY,
  faceToward,
  heroSolarPlacement,
  wallRunCenter,
} from './heroPlacement'
import { isValidPlacement, parsePlacements } from './placements'
import { LIGHTBOX_BRIGHTNESS_DEFAULT } from './lightbox'
import { fitScale } from './zones'
import { NAVE_CAMERAS } from '../pages/umbral'

/**
 * heroNave tests
 * ──────────────
 * Phase 5 (S3 nave): wall 2's S3 face as a **zoned light-box per nave camera**, the
 * hero hung in the INVERSIÓN bay. The point of an unbiased test here is to prove the
 * split is the one the brief demands — three equal bays in walk order
 * (IMAGE/TEXT+CODE/INVERSIÓN), the hero on the S3 face as a light-box on the eye
 * band — derived from the committed venue geometry rather than asserted by hand, and
 * that every bay placement drops cleanly into the persistence layer.
 */

// public/ lives outside the src bundle root → read the committed file directly.
const DOC_PATH = fileURLToPath(new URL('../../../public/prints/hero-solar/doc.json', import.meta.url))
const doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')) as {
  id: string
  props?: { invId?: number }
  dimensions: { trimHeightMm: number; trimWidthMm: number }
}
const TRIM_H = doc.dimensions.trimHeightMm
const TRIM_W_M = doc.dimensions.trimWidthMm / 1000

function fakeWall(over: Partial<Wall> = {}): Wall {
  return {
    id: 'wall-test',
    cx: 0,
    cz: 0,
    sx: 0.5,
    sz: 22.5,
    normalAxis: 'x',
    length: 22.5,
    thickness: 0.5,
    height: DEFAULT_WALL_HEIGHT_M,
    hasExplicitHeight: false,
    ...over,
  }
}

describe('nave camera vocabulary', () => {
  it('is the three cameras in walk order, INVERSIÓN last and the hero bay', () => {
    expect(NAVE_CAMERA_COUNT).toBe(3)
    expect(NAVE_CAMERA_ORDER).toEqual<NaveCameraId[]>(['image', 'text-code', 'investment'])
    expect(NAVE_CAMERA_ORDER[NAVE_CAMERA_COUNT - 1]).toBe('investment')
    expect(HERO_CAMERA_ID).toBe('investment')
  })

  it('agrees with the umbral title-band camera ids (no drift)', () => {
    // Same canonical walk order, kept in two layers — guard they never diverge.
    expect(NAVE_CAMERAS.map((c) => c.id)).toEqual([...NAVE_CAMERA_ORDER])
  })
})

describe('naveS3ZonedPlacements — bay geometry', () => {
  it('splits the run into three contiguous, equal, gap-free bays covering it exactly', () => {
    const wall = fakeWall({ length: 22.5 })
    const plan = naveS3ZonedPlacements({ wall, trimHeightMm: TRIM_H })
    expect(plan.zones).toHaveLength(3)
    expect(plan.runLength).toBe(22.5)

    const zones = plan.zones.map((z) => z.zone)
    // covers [0, runLength]
    expect(zones[0].startM).toBeCloseTo(0, 6)
    expect(zones[zones.length - 1].endM).toBeCloseTo(22.5, 6)
    // contiguous (no gap by default) + equal width
    for (let i = 0; i < zones.length; i++) {
      expect(zones[i].widthM).toBeCloseTo(22.5 / 3, 6)
      if (i > 0) expect(zones[i].startM).toBeCloseTo(zones[i - 1].endM, 6)
    }
  })

  it('passes gap + margin through to the zone plan', () => {
    const wall = fakeWall({ length: 22.5 })
    const plan = naveS3ZonedPlacements({ wall, trimHeightMm: TRIM_H, gapM: 0.5, marginM: 0.3 })
    const zones = plan.zones.map((z) => z.zone)
    expect(zones[0].startM).toBeCloseTo(0.3, 6) // margin
    expect(zones[2].endM).toBeCloseTo(22.5 - 0.3, 6) // last edge pinned inside margin
    expect(zones[1].startM - zones[0].endM).toBeCloseTo(0.5, 6) // gap
  })
})

describe('naveS3ZonedPlacements — camera ↔ bay mapping', () => {
  it('maps bays to cameras in walk order by default (INVERSIÓN at the far run end)', () => {
    const plan = naveS3ZonedPlacements({ wall: fakeWall(), trimHeightMm: TRIM_H })
    expect(plan.zones.map((z) => z.camera)).toEqual(['image', 'text-code', 'investment'])
    expect(plan.zones[2].isHero).toBe(true)
    expect(plan.zones[0].isHero).toBe(false)
    expect(plan.zones[1].isHero).toBe(false)
  })

  it('reverses the mapping when the nave is entered from the far run end', () => {
    const plan = naveS3ZonedPlacements({ wall: fakeWall(), trimHeightMm: TRIM_H, walkReversed: true })
    expect(plan.zones.map((z) => z.camera)).toEqual(['investment', 'text-code', 'image'])
    // The hero bay is now the first run bay, but still the INVERSIÓN camera.
    expect(plan.zones[0].isHero).toBe(true)
    expect(plan.zones.find((z) => z.isHero)?.camera).toBe('investment')
  })

  it('exactly one bay is the hero bay, regardless of walk direction', () => {
    for (const walkReversed of [false, true]) {
      const plan = naveS3ZonedPlacements({ wall: fakeWall(), trimHeightMm: TRIM_H, walkReversed })
      expect(plan.zones.filter((z) => z.isHero)).toHaveLength(1)
    }
  })
})

describe('naveS3ZonedPlacements — the hero bay', () => {
  const wall = fakeWall()
  const plan = naveS3ZonedPlacements({ wall, trimHeightMm: TRIM_H })
  const heroBay = plan.zones.find((z) => z.isHero)!
  const heroP = heroBay.placement!

  it('hangs the hero print as a light-box at the default brightness', () => {
    expect(heroP).not.toBeNull()
    expect(heroP.printId).toBe(HERO_PRINT_ID)
    expect(heroP.mount).toBe('lightbox')
    expect(heroP.glow).toBe(LIGHTBOX_BRIGHTNESS_DEFAULT)
  })

  it('hangs at true physical scale (1×) by default', () => {
    expect(heroP.scale).toBe(1)
  })

  it('centres the print on its bay (along = bay centre in world coords)', () => {
    const expectedAlong = wallRunCenter(wall) + heroBay.zone.alongOffset
    expect(heroP.along).toBeCloseTo(expectedAlong, 6)
  })

  it('rides the shared eye-band centre height', () => {
    const wallH = resolveWallHeight(wall)
    expect(plan.centerY).toBeCloseTo(eyeBandCenterY(wallH, TRIM_H / 1000), 9)
    expect(heroP.centerY).toBe(plan.centerY)
  })

  it('agrees with the single-mount heroSolarPlacement on face / height / light-box', () => {
    // The zoned hero bay and the standalone mount must read identically except for
    // `along` (the bay re-centres it) and `id`.
    const single = heroSolarPlacement({ wall, trimHeightMm: TRIM_H })
    expect(heroP.side).toBe(single.side)
    expect(heroP.centerY).toBeCloseTo(single.centerY, 9)
    expect(heroP.mount).toBe(single.mount)
    expect(heroP.glow).toBe(single.glow)
    expect(heroP.scale).toBe(single.scale)
  })
})

describe('naveS3ZonedPlacements — which bays are filled', () => {
  it('only the hero bay is filled by default (image/text-code await their pieces)', () => {
    const plan = naveS3ZonedPlacements({ wall: fakeWall(), trimHeightMm: TRIM_H })
    expect(plan.placements).toHaveLength(1)
    expect(plan.placements[0].printId).toBe(HERO_PRINT_ID)
    const byCamera = Object.fromEntries(plan.zones.map((z) => [z.camera, z.placement]))
    expect(byCamera.image).toBeNull()
    expect(byCamera['text-code']).toBeNull()
    expect(byCamera.investment).not.toBeNull()
  })

  it('fills the IMAGE / TEXT+CODE bays when their print ids are supplied', () => {
    const plan = naveS3ZonedPlacements({
      wall: fakeWall(),
      trimHeightMm: TRIM_H,
      cameraPrints: { image: 'cam-image', 'text-code': 'cam-textcode' },
    })
    expect(plan.placements).toHaveLength(3)
    const byCamera = Object.fromEntries(plan.zones.map((z) => [z.camera, z.placement?.printId]))
    expect(byCamera.image).toBe('cam-image')
    expect(byCamera['text-code']).toBe('cam-textcode')
    expect(byCamera.investment).toBe(HERO_PRINT_ID)
  })

  it('lets an explicit investment print override the hero default', () => {
    const plan = naveS3ZonedPlacements({
      wall: fakeWall(),
      trimHeightMm: TRIM_H,
      cameraPrints: { investment: 'other-hero' },
    })
    expect(plan.zones.find((z) => z.isHero)?.placement?.printId).toBe('other-hero')
  })

  it('every emitted bay is a light-box on the S3 face at the shared eye band', () => {
    const plan = naveS3ZonedPlacements({
      wall: fakeWall(),
      trimHeightMm: TRIM_H,
      cameraPrints: { image: 'a', 'text-code': 'b' },
    })
    for (const p of plan.placements) {
      expect(p.mount).toBe('lightbox')
      expect(p.side).toBe(plan.side)
      expect(p.centerY).toBe(plan.centerY)
      expect(p.wallId).toBe(plan.wallId)
    }
  })
})

describe('naveS3ZonedPlacements — fit / scaling', () => {
  it('scales each bay to fill its width when fit is true', () => {
    const wall = fakeWall({ length: 22.5 })
    const plan = naveS3ZonedPlacements({
      wall,
      trimHeightMm: TRIM_H,
      cameraPrints: { image: 'a', 'text-code': 'b' },
      fit: true,
      printWidthM: TRIM_W_M,
    })
    for (const z of plan.zones) {
      expect(z.placement!.scale).toBeCloseTo(fitScale(z.zone.widthM, TRIM_W_M), 6)
      // a 7.5 m bay filled by a 6 m print scales up (>1)
      expect(z.placement!.scale).toBeGreaterThan(1)
    }
  })

  it('throws when fit is true but no printWidthM is given', () => {
    expect(() => naveS3ZonedPlacements({ wall: fakeWall(), trimHeightMm: TRIM_H, fit: true })).toThrow()
    expect(() =>
      naveS3ZonedPlacements({ wall: fakeWall(), trimHeightMm: TRIM_H, fit: true, printWidthM: 0 }),
    ).toThrow()
  })
})

describe('naveS3ZonedPlacements — height + brightness', () => {
  it('reaches the eye band on a taller measured wall (fit follows the data)', () => {
    const tall = fakeWall({ height: 4, hasExplicitHeight: true })
    const plan = naveS3ZonedPlacements({ wall: tall, trimHeightMm: TRIM_H })
    expect(plan.centerY).toBeCloseTo(eyeBandCenterY(4, TRIM_H / 1000), 9)
  })

  it('honours a custom light-box brightness on every bay', () => {
    const plan = naveS3ZonedPlacements({
      wall: fakeWall(),
      trimHeightMm: TRIM_H,
      brightness: 1.7,
      cameraPrints: { image: 'a' },
    })
    for (const p of plan.placements) expect(p.glow).toBe(1.7)
  })
})

describe('naveS3ZonedPlacements — ids, determinism, persistence', () => {
  it('uses stable, unique, camera-named ids (re-mount replaces, no dupes)', () => {
    const a = naveS3ZonedPlacements({ wall: fakeWall(), trimHeightMm: TRIM_H, cameraPrints: { image: 'i', 'text-code': 't' } })
    const b = naveS3ZonedPlacements({ wall: fakeWall(), trimHeightMm: TRIM_H, cameraPrints: { image: 'i', 'text-code': 't' } })
    const idsA = a.placements.map((p) => p.id)
    expect(new Set(idsA).size).toBe(idsA.length) // unique
    expect(idsA).toEqual(b.placements.map((p) => p.id)) // deterministic
    expect(a.zones.find((z) => z.isHero)?.placement?.id).toBe('hero-nave-wall-test-investment')
  })

  it('honours an idPrefix override', () => {
    const plan = naveS3ZonedPlacements({ wall: fakeWall(), trimHeightMm: TRIM_H, idPrefix: 'X' })
    expect(plan.placements[0].id).toBe('X-investment')
  })

  it('every placement is valid and round-trips through the persistence layer', () => {
    const plan = naveS3ZonedPlacements({
      wall: fakeWall(),
      trimHeightMm: TRIM_H,
      cameraPrints: { image: 'a', 'text-code': 'b' },
    })
    for (const p of plan.placements) expect(isValidPlacement(p)).toBe(true)
    const restored = parsePlacements(plan.placements)
    expect(restored).toHaveLength(plan.placements.length)
    for (const r of restored) {
      expect(r.mount).toBe('lightbox')
      expect(r.wallId).toBe(plan.wallId)
    }
  })
})

describe('naveS3ZonedPlacements — the real venue (wall 2, S3 face)', () => {
  const wall2 = findWallByInvId(HERO_INV_ID)
  const naveE = findWallByInvId(NAVE_OPPOSITE_INV_ID)
  if (!wall2 || !naveE) throw new Error('venue walls missing')

  const plan = naveS3ZonedPlacements({
    wall: wall2,
    s3Reference: { cx: naveE.cx, cz: naveE.cz },
    trimHeightMm: TRIM_H,
  })

  it('hangs on wall 2 facing the S3 nave (side +1), the opposite of the S1 back', () => {
    expect(plan.wallId).toBe(wall2.id)
    expect(plan.side).toBe(1)
    expect(plan.side).toBe(faceToward(wall2, { cx: naveE.cx, cz: naveE.cz }))
  })

  it('resolves the S3 face even with the default (wall-centre) reference', () => {
    const p = naveS3ZonedPlacements({ wall: wall2, trimHeightMm: TRIM_H })
    expect(p.side).toBe(1)
  })

  it('splits the ~22.5 m face into three real camera bays', () => {
    expect(plan.runLength).toBe(wall2.length)
    for (const z of plan.zones) expect(z.zone.widthM).toBeCloseTo(wall2.length / 3, 6)
  })

  it('hosts the hero in its bay, centred within that bay and on the wall', () => {
    const heroBay = plan.zones.find((z) => z.isHero)!
    const heroP = heroBay.placement!
    expect(heroP.printId).toBe(HERO_PRINT_ID)
    // along sits inside the hero bay span (mapped through the run centre)
    const lo = wallRunCenter(wall2) + (heroBay.zone.startM - wall2.length / 2)
    const hi = wallRunCenter(wall2) + (heroBay.zone.endM - wall2.length / 2)
    expect(heroP.along).toBeGreaterThanOrEqual(Math.min(lo, hi) - 1e-6)
    expect(heroP.along).toBeLessThanOrEqual(Math.max(lo, hi) + 1e-6)
    // whole print on the 2.5 m wall (no measured alturaM yet)
    const wallH = resolveWallHeight(wall2)
    expect(wallH).toBe(DEFAULT_WALL_HEIGHT_M)
    const ph = TRIM_H / 1000
    expect(heroP.centerY - ph / 2).toBeGreaterThanOrEqual(0)
    expect(heroP.centerY + ph / 2).toBeLessThanOrEqual(wallH + 1e-9)
  })

  it('the wall is a registered S3 wall (sanity on the venue data)', () => {
    expect(wall2.registry?.invId).toBe(2)
    expect(wall2.registry?.sala).toContain('S3')
  })
})
