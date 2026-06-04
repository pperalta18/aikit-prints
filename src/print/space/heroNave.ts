import { DEFAULT_WALL_HEIGHT_M, resolveWallHeight, type Wall } from './eventLayout'
import { LIGHTBOX_BRIGHTNESS_DEFAULT } from './lightbox'
import type { Placement } from './placements'
import { planZones, zoneAlong, fitScale, type Zone } from './zones'
import {
  HERO_PRINT_ID,
  eyeBandCenterY,
  faceToward,
  wallRunCenter,
} from './heroPlacement'

/**
 * Wall-2 S3-face zoned light-box — the three nave camera bays
 * ───────────────────────────────────────────────────────────
 * Phase 5 (S3 nave, densest room). Wall 2's S3 face (`invId 2` / `wall-1`, the
 * "Nave O" backdrop) runs the full length of the central nave behind the three
 * showroom cameras the visitor walks: **IMAGE → TEXT+CODE → INVERSIÓN**. The brief
 * (`specs/wall-graphics.md` inventory, wall 2) wants that face treated as a *zoned
 * light-box per nave camera* — one backlit bay behind each camera, **never one
 * stretched poster** — and the hero "Sistema solar de la inversión" hung in the
 * **INVERSIÓN** bay.
 *
 * This is the *pure, serialisable* core of that split: it composes the already
 * unit-tested {@link planZones} (equal side-by-side bays along the run) with the
 * hero's eye-band / S3-face / light-box logic ({@link eyeBandCenterY},
 * {@link faceToward}) to produce one `Placement` per camera bay that carries a
 * print. The hero defaults into the INVERSIÓN bay; the IMAGE / TEXT+CODE bays get a
 * placement only when their print id is supplied (their pieces are image-track and
 * still in production), so the plan is honest about which bays are filled today.
 *
 * Like `placements`/`lightbox`/`zones`/`heroPlacement`, everything here is JSX-free
 * and side-effect-free at module load, so it unit-tests in the node `unit` project.
 * `EventSpaceScene` owns the React wiring (a "HERO zonas" action); this owns the
 * contract and the numbers.
 *
 * Walk direction: the nave's physical entry end is flagged "to confirm" in the spec
 * (Open / to confirm). The cameras are mapped onto the run left→right by default;
 * pass `walkReversed` when the visitor enters from the far run end so IMAGE still
 * lands at the start of the walk.
 */

/** Stable id of a nave camera (matches `umbral.ts` `NAVE_CAMERAS[].id`). */
export type NaveCameraId = 'image' | 'text-code' | 'investment'

/**
 * The three S3 nave cameras in walk order — the same sequence documented in the
 * spec inventory and rendered by `umbral.ts`'s title-band. The INVERSIÓN camera is
 * last; the hero lives there. Kept here (the venue/space layer) as the canonical
 * walk order so the space code never has to import a page module; `umbral.ts`'s
 * `NAVE_CAMERAS` carries the display names/hints, and a test guards the two agree.
 */
export const NAVE_CAMERA_ORDER: readonly NaveCameraId[] = ['image', 'text-code', 'investment']

/** The camera bay that hosts the hero "Sistema solar de la inversión". */
export const HERO_CAMERA_ID: NaveCameraId = 'investment'

/** Number of nave camera bays the S3 face is split into. */
export const NAVE_CAMERA_COUNT = NAVE_CAMERA_ORDER.length

/** Catalogue print ids assigned per camera bay (the hero defaults into INVERSIÓN). */
export type NaveCameraPrints = Partial<Record<NaveCameraId, string>>

export type NaveZonedInput = {
  /** The hero wall — `findWallByInvId(2)` → wall 2 / `wall-1`, the nave backdrop. */
  wall: Wall
  /** Hero print trim height (mm) — drives the shared eye-band fit for the bays. */
  trimHeightMm: number
  /**
   * A floor point in the S3 nave to orient the front faces toward — typically the
   * opposite nave wall (`findWallByInvId(11)`). Defaults to the wall's own centre,
   * which still resolves to the `+1` S3 face. See {@link faceToward}.
   */
  s3Reference?: { cx: number; cz: number }
  /**
   * Print id per camera bay. The INVERSIÓN bay defaults to {@link HERO_PRINT_ID};
   * a bay with no print id produces a `null` placement (its piece isn't built yet).
   */
  cameraPrints?: NaveCameraPrints
  /** Inter-bay gap (m) — clear space between adjacent light-boxes. Default 0. */
  gapM?: number
  /** Per-end margin (m) kept clear at each end of the run. Default 0. */
  marginM?: number
  /**
   * When `true`, each bay's print is scaled to fill its bay width (a continuous
   * light-box); requires {@link printWidthM}. When `false` (default), prints hang
   * at **true physical scale** (1×) centred in their bay — the hero `doc.json` is
   * already authored to the camera-bay size, so true scale preserves area∝money.
   */
  fit?: boolean
  /** Print true trim width at scale 1 (m) — required only when `fit` is `true`. */
  printWidthM?: number
  /** Light-box brightness dial (0…2); defaults to {@link LIGHTBOX_BRIGHTNESS_DEFAULT}. */
  brightness?: number
  /** Fallback wall height for walls without measured `alturaM` (default 2.5 m). */
  fallbackHeight?: number
  /** Reverse the camera→bay mapping when the nave is entered from the far run end. */
  walkReversed?: boolean
  /** Prefix for the generated placement ids. Defaults to `hero-nave-${wall.id}`. */
  idPrefix?: string
}

/** One resolved nave camera bay: its camera, its zone geometry, and its placement. */
export type NaveZone = {
  /** Which camera this bay backs. */
  camera: NaveCameraId
  /** This bay's run geometry (from {@link planZones}). */
  zone: Zone
  /** `true` for the INVERSIÓN bay that hosts the hero. */
  isHero: boolean
  /** The mounted placement, or `null` when no print is assigned to this bay yet. */
  placement: Placement | null
}

export type NaveZonedPlan = {
  /** Wall the plan applies to (`wall-1`). */
  wallId: string
  /** Wall run length covered (m). */
  runLength: number
  /** The S3 face the bays hang on (+1 / −1), computed from the geometry. */
  side: 1 | -1
  /** Shared eye-band centre height for every bay (m above the floor). */
  centerY: number
  /** The three camera bays, in run order (left→right along the wall). */
  zones: NaveZone[]
  /** The non-null placements, ready to drop into the scene + persistence layer. */
  placements: Placement[]
}

/**
 * Plan the S3 face of wall 2 as a zoned light-box: divide the run into the three
 * nave camera bays and mount a light-box per bay that carries a print (the hero in
 * the INVERSIÓN bay by default). Pure + deterministic — the same input always
 * yields the same plan, so it round-trips through the persistence layer cleanly.
 */
export function naveS3ZonedPlacements(input: NaveZonedInput): NaveZonedPlan {
  const { wall, trimHeightMm } = input
  const fit = input.fit ?? false
  if (fit && !(typeof input.printWidthM === 'number' && Number.isFinite(input.printWidthM) && input.printWidthM > 0)) {
    throw new Error('printWidthM (a finite positive width in metres) is required when fit is true')
  }

  const fallbackHeight = input.fallbackHeight ?? DEFAULT_WALL_HEIGHT_M
  const reference = input.s3Reference ?? { cx: wall.cx, cz: wall.cz }
  const brightness = input.brightness ?? LIGHTBOX_BRIGHTNESS_DEFAULT
  const idPrefix = input.idPrefix ?? `hero-nave-${wall.id}`

  const wallHeightM = resolveWallHeight(wall, fallbackHeight)
  const printHeightM = trimHeightMm / 1000
  // Every bay sits on the same wall, so they share one eye-band centre + S3 face.
  const centerY = eyeBandCenterY(wallHeightM, printHeightM)
  const side = faceToward(wall, reference)
  const runCenter = wallRunCenter(wall)

  const plan = planZones(wall.length, NAVE_CAMERA_COUNT, {
    gapM: input.gapM,
    marginM: input.marginM,
  })

  // Resolve the print id for each camera (hero is the default for INVERSIÓN).
  const printFor = (camera: NaveCameraId): string | undefined =>
    camera === HERO_CAMERA_ID
      ? input.cameraPrints?.[camera] ?? HERO_PRINT_ID
      : input.cameraPrints?.[camera]

  const zones: NaveZone[] = plan.zones.map((zone) => {
    // Map this run bay (index 0 = run start) to a camera in walk order.
    const camera = input.walkReversed
      ? NAVE_CAMERA_ORDER[NAVE_CAMERA_COUNT - 1 - zone.index]
      : NAVE_CAMERA_ORDER[zone.index]
    const printId = printFor(camera)
    const isHero = camera === HERO_CAMERA_ID
    const placement: Placement | null =
      printId == null
        ? null
        : {
            id: `${idPrefix}-${camera}`,
            printId,
            wallId: wall.id,
            along: zoneAlong(runCenter, zone),
            centerY,
            scale: fit ? fitScale(zone.widthM, input.printWidthM as number) : 1,
            side,
            mount: 'lightbox',
            glow: brightness,
          }
    return { camera, zone, isHero, placement }
  })

  return {
    wallId: wall.id,
    runLength: wall.length,
    side,
    centerY,
    zones,
    placements: zones
      .map((z) => z.placement)
      .filter((p): p is Placement => p != null),
  }
}
