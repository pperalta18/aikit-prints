import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, Html, Lightformer, OrbitControls } from '@react-three/drei'
import { InstancedMesh, MathUtils, Object3D, Texture, Vector3 } from 'three'
import { KIT_BLUE, lightTheme, darkTheme } from '@/lib/neumorphism'
import { buildGeometry } from '../geometry'
import { getPrintPage } from '../pages'
import { PrintStage } from '../PrintRenderer'
import { faceCropUV, loadPrintFaceTexture } from './printFaceTexture'
import type { PrintDoc } from '../types'
import {
  BARS,
  DEFAULT_WALL_HEIGHT_M,
  GLASS,
  PEOPLE,
  REGISTERED_WALLS,
  SPACE_DEPTH,
  SPACE_WIDTH,
  SPAWNS,
  TABLES,
  WALLS,
  findWall,
  findWallByInvId,
  resolveWallHeight,
  wallsWithoutHeight,
  type FootprintBox,
  type Wall,
} from '../space/eventLayout'
import {
  HERO_INV_ID,
  HERO_PRINT_ID,
  NAVE_OPPOSITE_INV_ID,
  eyeBandCenterY,
  heroSolarPlacement,
} from '../space/heroPlacement'
import { naveS3ZonedPlacements } from '../space/heroNave'
import { TRACK_LABEL, wallLabel } from '../space/wallHud'
import {
  clearPlacements,
  loadPlacements,
  parsePlacements,
  placementsToJson,
  savePlacements,
  type Placement,
} from '../space/placements'
import { planZonePlacements } from '../space/zones'
import { computeWallFrames } from '../space/wallFrames'
import {
  pairFor,
  planDoubleSided,
  syncedFaceFields,
  unlinkPair,
  wallSupportsDoubleSided,
} from '../space/doublesided'

/**
 * EventSpaceScene — the event venue in 3D, for previewing prints on the walls.
 * ───────────────────────────────────────────────────────────────────────────
 * Rebuilds the space-planner layout (`src/print/space/event-layout.json`) as a
 * walkable room: floor, walls, glass and a bar, plus a toggleable occupancy
 * overlay (attendees + their tables + spawn, off by default). **Arm a print from
 * the catalogue, then click any wall** to mount it at
 * its true physical size; select a mounted print to scale / raise / flip / remove
 * it. Reuses the `PrintScaleScene` toolkit: drei <Html transform occlude> paints
 * the live React page onto each panel, orbit + WASD fly to move around.
 */

const HTML_TRANSFORM_FACTOR = 40 // drei <Html transform>: worldWidth = contentPx·scale/40
const FACE_LONG_PX = 2048 // long-edge px the print DOM is painted at (walls viewed from afar)
const M = (mm: number) => mm / 1000 // mm → metres (world units)
// A print is a flat vinyl stuck onto the wall — it sits flush against the surface,
// just a hair proud so it never z-fights the wall (no thick board, no light-box).
const VINYL_SURFACE_OFFSET_M = 0.004
const UI_FONT = 'system-ui, -apple-system, sans-serif'

const FLOOR = '#8d877c'
// White walls: a white vinyl stuck on top should read as part of the wall, not a
// contrasting panel — so the wall surface matches the print's white background.
const WALL_COL = '#ffffff'
const TABLE_COL = '#e3c79b'
const BAR_COL = '#b1492f'
const PERSON_COL = '#b3a0d6'

type Vec3 = [number, number, number]

// `Placement` (a print mounted on a wall) is defined in `../space/placements`,
// alongside the persistence core that saves/loads the layout.

/* ── world transform of a mounted print, derived from wall + placement ──────── */

function wallRun(wall: Wall) {
  // The run axis is the floor axis the wall is NOT thin in.
  const runAxis: 'x' | 'z' = wall.normalAxis === 'x' ? 'z' : 'x'
  const runCenter = runAxis === 'z' ? wall.cz : wall.cx
  const normalCenter = wall.normalAxis === 'x' ? wall.cx : wall.cz
  return { runAxis, runCenter, normalCenter }
}

function placementTransform(wall: Wall, p: Placement, pw: number) {
  const { runCenter, normalCenter } = wallRun(wall)
  const maxOff = Math.max(0, wall.length / 2 - pw / 2)
  const along = MathUtils.clamp(p.along, runCenter - maxOff, runCenter + maxOff)
  const surf = normalCenter + p.side * (wall.thickness / 2 + VINYL_SURFACE_OFFSET_M)

  let pos: Vec3
  let rotY: number
  if (wall.normalAxis === 'z') {
    pos = [along, p.centerY, surf]
    rotY = p.side > 0 ? 0 : Math.PI
  } else {
    pos = [surf, p.centerY, along]
    rotY = p.side > 0 ? Math.PI / 2 : -Math.PI / 2
  }
  return { pos, rotY }
}

/** Strip any light-box fields → a plain flat vinyl (the only mount the venue uses). */
function asVinyl(p: Placement): Placement {
  const vinyl = { ...p }
  delete vinyl.mount
  delete vinyl.glow
  return vinyl
}

/* ── the scene ──────────────────────────────────────────────────────────────── */

export function EventSpaceScene({ docs, onBack }: { docs: PrintDoc[]; onBack: () => void }) {
  const [armedId, setArmedId] = useState<string | null>(docs[0]?.id ?? null)
  // Restore the saved layout on open; persist it on every change (Phase 2).
  const [placements, setPlacements] = useState<Placement[]>(() => loadPlacements())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The simulated-occupancy overlay — attendees (crowd), their tables and the
  // spawn point — clutters the museographic view, so it's off by default; a single
  // toggle shows/hides all three together.
  const [showPeople, setShowPeople] = useState(false)
  // Walls now take their height from per-wall data (`alturaM`); this slider only
  // sets the fallback used by walls that carry no measured height yet (Phase 2).
  const [fallbackHeight, setFallbackHeight] = useState(DEFAULT_WALL_HEIGHT_M)
  // Wall identity overlay: float `#N · sala` + tema over the 20 event walls so
  // mounting the right piece on the right wall stays unambiguous during production.
  const [showLabels, setShowLabels] = useState(true)
  // Blank-frame base layer: every wall face papered with an empty white frame at
  // true scale, split where walls cut it (`computeWallFrames`). On by default.
  const [showFrames, setShowFrames] = useState(true)
  // "Vista real": paint each print as a true depth-tested mesh texture (its exported
  // PNG) instead of the floating <Html> overlay, so a wall in front hides the print
  // behind it — the space reads like real life, nothing pops on top. Off by default
  // (edit mode keeps the live, selectable Html faces).
  const [realista, setRealista] = useState(false)
  const cameraApi = useRef<{ setView: (pos: Vec3, target: Vec3) => void } | null>(null)

  const docById = useCallback((id: string) => docs.find((d) => d.id === id), [docs])

  // Brief: "assume 2.5 m and warn if absent". The wall set is static (resolved at
  // module load), so flag every wall still on the fallback exactly once on mount.
  useEffect(() => {
    const missing = wallsWithoutHeight()
    if (missing.length > 0) {
      console.warn(
        `[event-space] ${missing.length} wall(s) have no explicit height (alturaM); ` +
          `using ${DEFAULT_WALL_HEIGHT_M} m fallback: ${missing.map((w) => w.id).join(', ')}`,
      )
    }
  }, [])

  // Persist the layout so a configured space reopens automatically (no backend).
  useEffect(() => {
    savePlacements(placements)
  }, [placements])

  const placeOnWall = useCallback(
    (wall: Wall, point: Vector3) => {
      if (!armedId) return
      const doc = docById(armedId)
      if (!doc) return
      const { runAxis, runCenter, normalCenter } = wallRun(wall)
      const along = runAxis === 'z' ? point.z : point.x
      const side: 1 | -1 = (wall.normalAxis === 'x' ? point.x : point.z) >= normalCenter ? 1 : -1
      const pw = M(doc.dimensions.trimWidthMm)
      const ph = M(doc.dimensions.trimHeightMm)
      const maxOff = Math.max(0, wall.length / 2 - pw / 2)
      const wallH = resolveWallHeight(wall, fallbackHeight)
      // Hang it on the museographic eye band, clamped to keep the print on the wall.
      const centerY = eyeBandCenterY(wallH, ph)
      const id = `pl-${placements.length}-${wall.id}-${Math.round(along * 100)}`
      const next: Placement = {
        id,
        printId: doc.id,
        wallId: wall.id,
        along: MathUtils.clamp(along, runCenter - maxOff, runCenter + maxOff),
        centerY,
        scale: 1,
        side,
      }
      setPlacements((cur) => [...cur, next])
      setSelectedId(id)
    },
    [armedId, docById, placements.length, fallbackHeight],
  )

  const updateSelected = useCallback(
    (patch: Partial<Placement>) => {
      setPlacements((cur) => {
        const sel = cur.find((p) => p.id === selectedId)
        if (!sel) return cur
        // A double-sided piece edits as one: positional changes mirror to the other
        // face so the two stay back-to-back; per-face attributes (side/art) don't.
        const partner = pairFor(sel, cur)
        const synced = partner ? syncedFaceFields(patch) : null
        return cur.map((p) => {
          if (p.id === selectedId) return { ...p, ...patch }
          if (partner && synced && p.id === partner.id) return { ...p, ...synced }
          return p
        })
      })
    },
    [selectedId],
  )
  const removeSelected = useCallback(() => {
    setPlacements((cur) => {
      const sel = cur.find((p) => p.id === selectedId)
      if (!sel) return cur
      const partner = pairFor(sel, cur) // removing one face removes the whole piece
      const drop = new Set([sel.id, ...(partner ? [partner.id] : [])])
      return cur.filter((p) => !drop.has(p.id))
    })
    setSelectedId(null)
  }, [selectedId])

  // Delete / Backspace unmounts the selected print (unless a form field has focus,
  // e.g. the print dropdown), so you can pick a wall and just hit delete.
  useEffect(() => {
    if (!selectedId) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, removeSelected])

  const selected = placements.find((p) => p.id === selectedId) ?? null
  // Height of the wall the selected print hangs on — bounds its centre-height slider.
  const selectedWall = selected ? findWall(selected.wallId) : undefined
  const selectedWallHeight = selectedWall ? resolveWallHeight(selectedWall, fallbackHeight) : fallbackHeight

  // Double-sided pieces (Phase 2): walls inv 2 & 12 carry distinct art per face.
  const selectedPartner = selected ? pairFor(selected, placements) : null
  const selectedIsPaired = selectedPartner != null
  const selectedSupportsDouble = wallSupportsDoubleSided(selectedWall)
  const partnerTitle = selectedPartner ? docById(selectedPartner.printId)?.title ?? null : null

  // Zoned canvases (Phase 2): the long perimeter walls (2/4/9/11) read better as a
  // SERIES of segments than as one stretched print. Replace the selected piece with
  // `count` copies tiled along its wall, each scaled to fill its zone — see `zones`.
  const applyZones = useCallback(
    (count: number) => {
      if (!selected) return
      const wall = findWall(selected.wallId)
      const doc = docById(selected.printId)
      if (!wall || !doc) return
      const { runCenter } = wallRun(wall)
      const zoned = planZonePlacements({
        base: selected,
        runCenter,
        runLength: wall.length,
        printWidthM: M(doc.dimensions.trimWidthMm),
        count,
        idPrefix: `zn${placements.length}-${wall.id}-${count}`,
      })
      setPlacements((cur) => [...cur.filter((p) => p.id !== selected.id), ...zoned])
      setSelectedId(zoned[0]?.id ?? null)
    },
    [selected, docById, placements.length],
  )

  // Double-sided (Phase 2): convert the selected single-face piece into a coherent
  // two-face piece on its wall. The back face uses the *armed* catalogue print when
  // it differs (distinct art per face — e.g. combustión vs hero on inv 2); otherwise
  // it mirrors the same art. Both faces are linked by a shared pairId.
  const makeDoubleSided = useCallback(() => {
    if (!selected || pairFor(selected, placements)) return
    const backPrintId = armedId && armedId !== selected.printId ? armedId : selected.printId
    const [front, back] = planDoubleSided({
      base: selected,
      backPrintId,
      idPrefix: `ds${placements.length}-${selected.wallId}`,
    })
    setPlacements((cur) => [...cur.filter((p) => p.id !== selected.id), front, back])
    setSelectedId(front.id)
  }, [selected, placements, armedId])

  // Unlink a double-sided pair back into two independent single-face placements.
  const splitSelectedFaces = useCallback(() => {
    const pid = selected?.pairId
    if (!pid) return
    setPlacements((cur) => unlinkPair(pid, cur))
  }, [selected])

  // Portable layout file: export the current placements / import a saved one /
  // clear back to empty. The auto-persist effect above keeps localStorage in sync.
  const exportLayout = useCallback(() => {
    const blob = new Blob([placementsToJson(placements)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'event-placements.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [placements])

  const importLayout = useCallback((text: string) => {
    setPlacements(parsePlacements(text))
    setSelectedId(null)
  }, [])

  const clearLayout = useCallback(() => {
    setPlacements([])
    setSelectedId(null)
    clearPlacements()
  }, [])

  const setView = useCallback((pos: Vec3, target: Vec3) => cameraApi.current?.setView(pos, target), [])
  const aerialView = useCallback(() => setView([0, 30, 32], [0, 0, 0]), [setView])
  const walkView = useCallback(() => setView([0, 1.6, SPACE_DEPTH / 2 - 4], [0, 1.6, 0]), [setView])

  // Phase 4 hero slice: mount "Sistema solar de la inversión" on wall 2's S3 face
  // as a light-box, at true scale on the eye band, and frame it head-on so the
  // operator can confirm the scale + placement. Re-mounting replaces the existing
  // hero (no duplicates). The exact placement maths live in `heroSolarPlacement`.
  const heroDoc = useMemo(() => docById(HERO_PRINT_ID), [docById])
  const heroWall = useMemo(() => findWallByInvId(HERO_INV_ID), [])
  const canMountHero = !!heroDoc && !!heroWall
  const mountHero = useCallback(() => {
    if (!heroWall || !heroDoc) return
    const opposite = findWallByInvId(NAVE_OPPOSITE_INV_ID)
    const placement = heroSolarPlacement({
      wall: heroWall,
      s3Reference: opposite ? { cx: opposite.cx, cz: opposite.cz } : undefined,
      trimHeightMm: heroDoc.dimensions.trimHeightMm,
      fallbackHeight,
    })
    setArmedId(HERO_PRINT_ID)
    setPlacements((cur) => [...cur.filter((p) => p.printId !== HERO_PRINT_ID), asVinyl(placement)])
    setSelectedId(placement.id)
    // Frame the S3 face head-on at eye height to verify the true-scale fit.
    const { runCenter, normalCenter } = wallRun(heroWall)
    const dist = 7
    const eye: Vec3 =
      heroWall.normalAxis === 'x'
        ? [normalCenter + placement.side * dist, placement.centerY, runCenter]
        : [runCenter, placement.centerY, normalCenter + placement.side * dist]
    const target: Vec3 =
      heroWall.normalAxis === 'x'
        ? [normalCenter, placement.centerY, runCenter]
        : [runCenter, placement.centerY, normalCenter]
    setView(eye, target)
  }, [heroWall, heroDoc, fallbackHeight, setView])

  // Phase 5 (S3 nave): mount wall 2's S3 face as a ZONED light-box per nave camera
  // — three bays (IMAGE / TEXT+CODE / INVERSIÓN) instead of one stretched poster —
  // with the hero hung in the INVERSIÓN bay. Other bays fill in as their pieces
  // ship. Replaces any existing hero placement so re-mounting never duplicates.
  const mountHeroZoned = useCallback(() => {
    if (!heroWall || !heroDoc) return
    const opposite = findWallByInvId(NAVE_OPPOSITE_INV_ID)
    const plan = naveS3ZonedPlacements({
      wall: heroWall,
      s3Reference: opposite ? { cx: opposite.cx, cz: opposite.cz } : undefined,
      trimHeightMm: heroDoc.dimensions.trimHeightMm,
      fallbackHeight,
    })
    setArmedId(HERO_PRINT_ID)
    setPlacements((cur) => [
      ...cur.filter((p) => p.printId !== HERO_PRINT_ID && !p.id.startsWith(`hero-nave-${heroWall.id}`)),
      ...plan.placements.map(asVinyl),
    ])
    const heroP = plan.placements.find((p) => p.printId === HERO_PRINT_ID) ?? plan.placements[0]
    setSelectedId(heroP?.id ?? null)
    // Frame the hero bay head-on at eye height to verify the zoned scale + placement.
    const { normalCenter } = wallRun(heroWall)
    const dist = 7
    const eye: Vec3 =
      heroWall.normalAxis === 'x'
        ? [normalCenter + plan.side * dist, plan.centerY, heroP?.along ?? 0]
        : [heroP?.along ?? 0, plan.centerY, normalCenter + plan.side * dist]
    const target: Vec3 =
      heroWall.normalAxis === 'x'
        ? [normalCenter, plan.centerY, heroP?.along ?? 0]
        : [heroP?.along ?? 0, plan.centerY, normalCenter]
    setView(eye, target)
  }, [heroWall, heroDoc, fallbackHeight, setView])

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#1b1e25 0%,#101218 100%)' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 30, 32], fov: 45, near: 0.05, far: 600 }}
        gl={{ antialias: true }}
        onPointerMissed={() => setSelectedId(null)}
      >
        <color attach="background" args={['#12141a']} />
        <hemisphereLight intensity={0.5} color="#eef2ff" groundColor="#5b574e" />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[-18, 30, 16]}
          intensity={1.35}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-26}
          shadow-camera-right={26}
          shadow-camera-top={26}
          shadow-camera-bottom={-26}
          shadow-camera-near={1}
          shadow-camera-far={90}
        />
        <directionalLight position={[14, 10, -8]} intensity={0.4} color="#bcd2ff" />
        <Environment resolution={256}>
          <Lightformer intensity={1.6} position={[0, 12, 0]} scale={[20, 20, 1]} rotation={[Math.PI / 2, 0, 0]} />
          <Lightformer intensity={1} position={[-12, 6, 8]} scale={[8, 14, 1]} />
          <Lightformer intensity={0.8} position={[12, 4, -8]} scale={[8, 14, 1]} color="#cfe0ff" />
        </Environment>

        <RoomFloor />
        <Walls fallback={fallbackHeight} onPlace={placeOnWall} />
        <GlassPanels fallback={fallbackHeight} onPlace={placeOnWall} />
        {showLabels && <WallLabels fallback={fallbackHeight} />}
        {showFrames && <WallFrames fallback={fallbackHeight} showLabels={showLabels} docs={docs} realista={realista} />}
        <Furniture />
        {showPeople && <Tables />}
        {showPeople && SPAWNS.map((s, i) => <SpawnMarker key={i} box={s} />)}
        {showPeople && <Crowd />}

        <Suspense fallback={null}>
          {placements.map((p) => {
            const wall = findWall(p.wallId)
            const doc = docById(p.printId)
            if (!wall || !doc) return null
            return (
              <WallPrint
                key={p.id}
                doc={doc}
                placement={p}
                wall={wall}
                selected={p.id === selectedId}
                onSelect={() => setSelectedId(p.id)}
                realista={realista}
              />
            )
          })}
        </Suspense>

        <ContactShadows position={[0, 0.01, 0]} opacity={0.32} scale={Math.max(SPACE_WIDTH, SPACE_DEPTH) * 1.2} blur={2.6} far={3} resolution={1024} />
        <OrbitControls makeDefault enablePan enableZoom minDistance={1} maxDistance={120} maxPolarAngle={Math.PI / 2 - 0.03} target={[0, 1, 0]} />
        <CameraRig apiRef={cameraApi} />
      </Canvas>

      <Hud
        docs={docs}
        armedId={armedId}
        setArmedId={setArmedId}
        selected={selected}
        selectedDoc={selected ? docById(selected.printId) ?? null : null}
        updateSelected={updateSelected}
        removeSelected={removeSelected}
        onZone={applyZones}
        selectedIsPaired={selectedIsPaired}
        selectedSupportsDouble={selectedSupportsDouble}
        partnerTitle={partnerTitle}
        onDoubleSided={makeDoubleSided}
        onSplitFaces={splitSelectedFaces}
        showPeople={showPeople}
        setShowPeople={setShowPeople}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        showFrames={showFrames}
        setShowFrames={setShowFrames}
        realista={realista}
        setRealista={setRealista}
        fallbackHeight={fallbackHeight}
        setFallbackHeight={setFallbackHeight}
        selectedWallHeight={selectedWallHeight}
        placementCount={placements.length}
        onBack={onBack}
        onAerial={aerialView}
        onWalk={walkView}
        onMountHero={mountHero}
        onMountHeroZoned={mountHeroZoned}
        canMountHero={canMountHero}
        onExport={exportLayout}
        onImport={importLayout}
        onClear={clearLayout}
      />
    </div>
  )
}

/* ── room shell ───────────────────────────────────────────────────────────────*/

function RoomFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[SPACE_WIDTH, SPACE_DEPTH]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} metalness={0} />
      </mesh>
      <Grid
        position={[0, 0.004, 0]}
        args={[SPACE_WIDTH, SPACE_DEPTH]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6f6a60"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#837d72"
        fadeDistance={70}
        fadeStrength={1}
      />
    </group>
  )
}

function Walls({ fallback, onPlace }: { fallback: number; onPlace: (w: Wall, p: Vector3) => void }) {
  return (
    <group>
      {WALLS.map((w) => {
        const h = resolveWallHeight(w, fallback)
        return (
          <mesh
            key={w.id}
            position={[w.cx, h / 2, w.cz]}
            castShadow
            receiveShadow
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation()
              onPlace(w, e.point)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              document.body.style.cursor = 'crosshair'
            }}
            onPointerOut={() => {
              document.body.style.cursor = ''
            }}
          >
            <boxGeometry args={[w.sx, h, w.sz]} />
            <meshStandardMaterial color={WALL_COL} roughness={0.92} metalness={0} />
          </mesh>
        )
      })}
    </group>
  )
}

function GlassPanels({ fallback, onPlace }: { fallback: number; onPlace: (w: Wall, p: Vector3) => void }) {
  return (
    <group>
      {GLASS.map((w) => {
        const h = resolveWallHeight(w, fallback)
        return (
          <mesh
            key={w.id}
            position={[w.cx, h / 2, w.cz]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation()
              onPlace(w, e.point)
            }}
          >
            <boxGeometry args={[w.sx, h, w.sz]} />
            <meshStandardMaterial color="#bcd6df" transparent opacity={0.22} roughness={0.1} metalness={0} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ── wall identity labels (Phase 0: which wall is which during production) ─────── */

function WallLabels({ fallback }: { fallback: number }) {
  return (
    <>
      {REGISTERED_WALLS.map((w) => {
        const label = wallLabel(w)
        if (!label) return null
        const y = resolveWallHeight(w, fallback) + 0.32
        return (
          <Html
            key={w.id}
            position={[w.cx, y, w.cz]}
            center
            zIndexRange={[16, 0]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minWidth: 92,
                maxWidth: 168,
                padding: '5px 9px',
                borderRadius: 9,
                background: 'rgba(16,18,24,0.86)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
                color: '#e8e8f0',
                fontFamily: UI_FONT,
                textAlign: 'center',
                lineHeight: 1.25,
                transform: 'translateY(-4px)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.2 }}>{label.tag}</div>
              {label.tema && <div style={{ fontSize: 9.5, color: '#aab0bc' }}>{label.tema}</div>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 1 }}>
                <span title={TRACK_LABEL[label.track]} style={{ fontSize: 8.5, color: '#7c8190' }}>{label.track}</span>
                {label.research && <span title="requiere fuentes" style={{ fontSize: 8.5, color: '#7fd0ff' }}>· ◆</span>}
              </div>
            </div>
          </Html>
        )
      })}
    </>
  )
}

function Box({ box, height, y, color, roughness = 0.85 }: { box: FootprintBox; height: number; y: number; color: string; roughness?: number }) {
  return (
    <mesh position={[box.cx, y, box.cz]} castShadow receiveShadow>
      <boxGeometry args={[box.sx, height, box.sz]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

// Always-on furniture: the bar(s). Tables belong to the toggleable occupancy
// overlay (they map the simulated crowd's use of the space), so they render in
// their own `Tables` component gated by `showPeople`.
function Furniture() {
  return (
    <group>
      {BARS.map((b, i) => (
        <group key={`b${i}`}>
          <Box box={b} height={1.05} y={0.525} color={BAR_COL} roughness={0.6} />
          <Box box={{ ...b, sx: b.sx + 0.1, sz: b.sz + 0.1 }} height={0.06} y={1.08} color="#7c2f1c" roughness={0.5} />
        </group>
      ))}
    </group>
  )
}

// Tables — part of the toggleable occupancy overlay (off by default).
function Tables() {
  return (
    <group>
      {TABLES.map((t, i) => (
        <Box key={`t${i}`} box={t} height={0.74} y={0.37} color={TABLE_COL} />
      ))}
    </group>
  )
}

function SpawnMarker({ box }: { box: FootprintBox }) {
  return (
    <mesh position={[box.cx, 0.02, box.cz]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[Math.min(box.sx, box.sz) * 0.4, Math.min(box.sx, box.sz) * 0.6, 32]} />
      <meshBasicMaterial color={KIT_BLUE} transparent opacity={0.55} />
    </mesh>
  )
}

/* ── the crowd (instanced low-poly people) ───────────────────────────────────── */

const BODY_R = 0.16
const BODY_LEN = 1.05
const BODY_CY = BODY_R + BODY_LEN / 2 // capsule centre so feet sit at y=0
const HEAD_CY = BODY_R + BODY_LEN + 0.04

function Crowd() {
  const bodyRef = useRef<InstancedMesh>(null)
  const headRef = useRef<InstancedMesh>(null)

  useEffect(() => {
    const dummy = new Object3D()
    PEOPLE.forEach((p, i) => {
      dummy.position.set(p.cx, BODY_CY, p.cz)
      dummy.rotation.set(0, p.rotationY, 0)
      dummy.updateMatrix()
      bodyRef.current?.setMatrixAt(i, dummy.matrix)
      dummy.position.set(p.cx, HEAD_CY, p.cz)
      dummy.updateMatrix()
      headRef.current?.setMatrixAt(i, dummy.matrix)
    })
    if (bodyRef.current) bodyRef.current.instanceMatrix.needsUpdate = true
    if (headRef.current) headRef.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, PEOPLE.length]} castShadow>
        <capsuleGeometry args={[BODY_R, BODY_LEN, 4, 10]} />
        <meshStandardMaterial color={PERSON_COL} roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, PEOPLE.length]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color="#e7d9c4" roughness={0.8} />
      </instancedMesh>
    </group>
  )
}

/* ── blank frames: one empty white canvas per wall face, split at wall cuts ──── */

const FRAME_SURFACE_OFFSET_M = 0.0025 // a touch behind a real vinyl, so prints sit on top
const FRAME_BORDER_M = 0.05 // grey hairline that reads as the frame edge on a white wall
const FRAME_EDGE_MARGIN_M = 0.04 // clearance from floor/ceiling and adjacent frames

/** Solid surface colour a `blank` doc paints (matches `PrintStage`'s `theme.surface`). */
const surfaceForTheme = (theme?: string): string =>
  theme === 'dark' ? darkTheme.surface : lightTheme.surface

/**
 * Rank to pick the winning doc when several share a `frameId`: a real page beats a
 * `blank`; a user design (`pared-*` / anything) beats the generator's `marco-*`
 * placeholder. So a frame the user dressed (e.g. a dark `pared-2-w-2`) overrides its
 * blank `marco-*` twin, and an arted frame overrides everything.
 */
function frameDocRank(d: PrintDoc): number {
  return (d.pageComponentId !== 'blank' ? 2 : 0) + (d.id.startsWith('marco-') ? 0 : 1)
}

/**
 * WallFrames — the venue's base layer: every wall face wears its frame at true
 * scale, split wherever another wall meets it (`computeWallFrames`). A long wall
 * becomes its real printable panels (9·E·1 / 9·E·2; the nave cámaras on 2/11), so
 * the operator sees the whole space papered with frames.
 *
 * **Every frame paints the print associated with it — not only the arted ones.** A
 * frame is joined to a print by `doc.props.frameId` (the `marco-*` / `pared-*` docs).
 * Whatever that doc renders is what the wall shows: a real page (`raster-wall`,
 * `aikit-live-mural`, `tipografia`, …) paints edge-to-edge as a live page; a `blank`
 * doc still has a *design* — its themed background — so it paints as that solid
 * surface (a dark frame shows dark, a light one white), with a faint grey edge so
 * the panel divisions read and the id label (when shown). So a frame appears here the
 * moment it has a doc, with no manual placement — the layout is *derived* from the
 * geometry + catalogue. Non-interactive (clicks fall through to the wall, where an
 * armed print can still mount on top).
 */
function WallFrames({
  fallback,
  showLabels,
  docs,
  realista,
}: {
  fallback: number
  showLabels: boolean
  docs: PrintDoc[]
  realista: boolean
}) {
  const frames = useMemo(
    () => computeWallFrames({ walls: REGISTERED_WALLS, allWalls: WALLS, fallbackHeight: fallback }),
    [fallback],
  )
  // Join each frame to its print by `props.frameId` (every frame, not just arted
  // ones); when several docs claim a frame, the highest `frameDocRank` wins.
  const docByFrameId = useMemo(() => {
    const m = new Map<string, PrintDoc>()
    for (const d of docs) {
      const fid = (d.props as Record<string, unknown> | undefined)?.frameId
      if (typeof fid !== 'string' || !fid) continue
      const cur = m.get(fid)
      if (!cur || frameDocRank(d) > frameDocRank(cur)) m.set(fid, d)
    }
    return m
  }, [docs])
  return (
    <>
      {frames.map((f) => {
        const wall = findWall(f.wallId)
        if (!wall) return null
        const { runCenter, normalCenter } = wallRun(wall)
        const pw = f.widthM
        const ph = f.heightM
        const maxOff = Math.max(0, wall.length / 2 - pw / 2)
        const along = MathUtils.clamp(f.alongCenter, runCenter - maxOff, runCenter + maxOff)
        const centerY = ph / 2
        const surf = normalCenter + f.side * (wall.thickness / 2 + FRAME_SURFACE_OFFSET_M)
        let pos: Vec3
        let rotY: number
        if (wall.normalAxis === 'z') {
          pos = [along, centerY, surf]
          rotY = f.side > 0 ? 0 : Math.PI
        } else {
          pos = [surf, centerY, along]
          rotY = f.side > 0 ? Math.PI / 2 : -Math.PI / 2
        }

        const doc = docByFrameId.get(f.id)

        // Arted frame → paint the live print edge-to-edge over the whole face.
        if (doc && doc.pageComponentId !== 'blank') {
          return <FramePrint key={f.id} doc={doc} pos={pos} rotY={rotY} panelW={pw} panelH={ph} realista={realista} />
        }

        // Blank frame → its *themed background* (a dark frame paints dark, a light
        // one white) + a faint grey edge so the panel divisions read + the id label.
        const field = surfaceForTheme(doc?.theme)
        const outerW = Math.max(0.05, pw - 2 * FRAME_EDGE_MARGIN_M)
        const outerH = Math.max(0.05, ph - 2 * FRAME_EDGE_MARGIN_M)
        const innerW = Math.max(0.02, outerW - 2 * FRAME_BORDER_M)
        const innerH = Math.max(0.02, outerH - 2 * FRAME_BORDER_M)
        return (
          <group key={f.id} position={pos} rotation={[0, rotY, 0]}>
            {/* grey edge — reads as the panel boundary against the wall */}
            <mesh raycast={() => null}>
              <planeGeometry args={[outerW, outerH]} />
              <meshStandardMaterial color="#c4c6d0" roughness={0.95} metalness={0} />
            </mesh>
            {/* themed background field — the blank frame's actual design */}
            <mesh position={[0, 0, 0.002]} raycast={() => null}>
              <planeGeometry args={[innerW, innerH]} />
              <meshStandardMaterial color={field} roughness={0.95} metalness={0} />
            </mesh>
            {showLabels && (
              <Html position={[0, 0, 0.01]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#7c8190',
                    fontFamily: UI_FONT,
                    background: 'rgba(255,255,255,0.66)',
                    padding: '1px 5px',
                    borderRadius: 5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.id}
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </>
  )
}

/**
 * FramePrint — a frame whose associated print carries art: the live React page
 * painted edge-to-edge over the whole wall face (`panelW × panelH`, the frame's
 * real size), at true scale. Same drei `<Html transform occlude="blending">` paint
 * path as {@link WallPrint}, but non-interactive: the substrate ignores raycasts so
 * clicks fall through to the wall (just like a blank frame), and there is no
 * selection/editing — auto-painted frames are derived, not part of the saved layout.
 */
function FramePrint({
  doc,
  pos,
  rotY,
  panelW,
  panelH,
  realista,
}: {
  doc: PrintDoc
  pos: Vec3
  rotY: number
  panelW: number
  panelH: number
  realista: boolean
}) {
  const geo = useMemo(() => buildGeometry(doc.dimensions, doc.dpi), [doc])
  const page = getPrintPage(doc.pageComponentId)
  const aspect = geo.trimWidthPx / geo.trimHeightPx
  const longTrimPx = Math.max(geo.trimWidthPx, geo.trimHeightPx)
  const longPx = Math.min(FACE_LONG_PX, Math.round(longTrimPx))
  const faceW = aspect >= 1 ? longPx : Math.round(longPx * aspect)
  const faceH = aspect >= 1 ? Math.round(longPx / aspect) : longPx
  const trimScale = faceW / geo.trimWidthPx
  const htmlScale = (panelW * HTML_TRANSFORM_FACTOR) / faceW

  // Realista mode: paint the frame as a real texture so the geometry occludes it.
  if (realista) {
    return (
      <group position={pos} rotation={[0, rotY, 0]}>
        <PrintFaceMesh doc={doc} w={panelW} h={panelH} />
      </group>
    )
  }

  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* white substrate sized to the whole face, non-interactive (clicks fall
          through to the wall, like a blank frame). */}
      <mesh position={[0, 0, 0.001]} raycast={() => null}>
        <planeGeometry args={[panelW, panelH]} />
        <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0} />
      </mesh>
      <Html
        transform
        occlude="blending"
        position={[0, 0, 0.003]}
        scale={htmlScale}
        zIndexRange={[18, 0]}
        pointerEvents="none"
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ width: faceW, height: faceH, overflow: 'hidden', background: '#fff', position: 'relative' }}>
          <div style={{ width: geo.trimWidthPx, height: geo.trimHeightPx, transform: `scale(${trimScale})`, transformOrigin: 'top left', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: -geo.bleedPx, top: -geo.bleedPx }}>
              <PrintStage doc={doc}>{page ? page({ doc, geo }) : null}</PrintStage>
            </div>
          </div>
        </div>
      </Html>
    </group>
  )
}

/* ── realista mode: the print as a true depth-tested mesh texture ────────────── */

/** Load the print's exported PNG as a three texture when realista mode is on. */
function usePrintFaceTexture(id: string, enabled: boolean): Texture | null {
  const [tex, setTex] = useState<Texture | null>(null)
  useEffect(() => {
    if (!enabled) {
      setTex(null)
      return
    }
    let alive = true
    loadPrintFaceTexture(id)
      .then((t) => alive && setTex(t))
      .catch(() => alive && setTex(null))
    return () => {
      alive = false
    }
  }, [id, enabled])
  return tex
}

/**
 * The print face as a genuine textured plane — depth-tested, so a wall in front of
 * it hides it like real life (no floating <Html>). The texture is the exported PNG,
 * with the bleed cropped to the trim via UV ({@link faceCropUV}). Until the texture
 * is ready (or if it can't be produced) it falls back to a plain white plate, which
 * is still correctly occluded. Lit by the room so it reads as a vinyl on the wall.
 */
function PrintFaceMesh({
  doc,
  w,
  h,
  interactive = false,
  onSelect,
}: {
  doc: PrintDoc
  w: number
  h: number
  interactive?: boolean
  onSelect?: () => void
}) {
  const geo = useMemo(() => buildGeometry(doc.dimensions, doc.dpi), [doc])
  const tex = usePrintFaceTexture(doc.id, true)

  useEffect(() => {
    if (!tex) return
    const { offset, repeat } = faceCropUV({
      mediaWidthPx: geo.mediaWidthPx,
      mediaHeightPx: geo.mediaHeightPx,
      trimWidthPx: geo.trimWidthPx,
      trimHeightPx: geo.trimHeightPx,
      bleedPx: geo.bleedPx,
    })
    tex.offset.set(offset[0], offset[1])
    tex.repeat.set(repeat[0], repeat[1])
    tex.needsUpdate = true
  }, [tex, geo])

  return (
    <mesh
      position={[0, 0, 0.002]}
      raycast={interactive ? undefined : () => null}
      onClick={
        interactive
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation()
              onSelect?.()
            }
          : undefined
      }
    >
      <planeGeometry args={[w, h]} />
      {/* Distinct `key` per branch forces a fresh material when the texture arrives:
          mutating an existing material's `map` from undefined→texture doesn't recompile
          its shader, so the map would never be sampled (it'd stay the white plate). */}
      {tex ? (
        <meshStandardMaterial key="textured" map={tex} roughness={0.85} metalness={0} />
      ) : (
        <meshStandardMaterial key="plate" color="#ffffff" roughness={0.92} metalness={0} />
      )}
    </mesh>
  )
}

/* ── a print mounted on a wall (live page on a true-scale panel) ─────────────── */

function WallPrint({
  doc,
  placement,
  wall,
  selected,
  onSelect,
  realista,
}: {
  doc: PrintDoc
  placement: Placement
  wall: Wall
  selected: boolean
  onSelect: () => void
  realista: boolean
}) {
  const geo = useMemo(() => buildGeometry(doc.dimensions, doc.dpi), [doc])
  const page = getPrintPage(doc.pageComponentId)

  const pw = M(doc.dimensions.trimWidthMm) * placement.scale
  const ph = M(doc.dimensions.trimHeightMm) * placement.scale
  const { pos, rotY } = placementTransform(wall, placement, pw)

  // Paint the live page at a high-res content rectangle (long edge = FACE_LONG_PX,
  // capped at native trim res), then map it onto the panel — same math as PrintSlab.
  const aspect = geo.trimWidthPx / geo.trimHeightPx
  const longTrimPx = Math.max(geo.trimWidthPx, geo.trimHeightPx)
  const longPx = Math.min(FACE_LONG_PX, Math.round(longTrimPx))
  const faceW = aspect >= 1 ? longPx : Math.round(longPx * aspect)
  const faceH = aspect >= 1 ? Math.round(longPx / aspect) : longPx
  const trimScale = faceW / geo.trimWidthPx
  const htmlScale = (pw * HTML_TRANSFORM_FACTOR) / faceW

  // Realista mode: a real textured mesh (depth-tested → occluded by geometry, never
  // floats), still selectable. Edit mode: the live, pointer-transparent Html face.
  if (realista) {
    return (
      <group position={pos} rotation={[0, rotY, 0]}>
        {selected && (
          <mesh position={[0, 0, 0]} raycast={() => null}>
            <planeGeometry args={[pw + 0.05, ph + 0.05]} />
            <meshBasicMaterial color={KIT_BLUE} />
          </mesh>
        )}
        <PrintFaceMesh doc={doc} w={pw} h={ph} interactive onSelect={onSelect} />
      </group>
    )
  }

  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* selection outline — a slightly larger plate peeking behind the vinyl edge */}
      {selected && (
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[pw + 0.05, ph + 0.05]} />
          <meshBasicMaterial color={KIT_BLUE} />
        </mesh>
      )}
      {/* the vinyl substrate — flat, flush against the wall, matte; also the click
          target (the Html face is pointer-transparent). No thickness, no backlight. */}
      <mesh
        position={[0, 0, 0.001]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <planeGeometry args={[pw, ph]} />
        <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0} />
      </mesh>

      <Html
        transform
        occlude="blending"
        position={[0, 0, 0.003]}
        scale={htmlScale}
        zIndexRange={[18, 0]}
        pointerEvents="none"
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            width: faceW,
            height: faceH,
            overflow: 'hidden',
            background: '#fff',
            position: 'relative',
          }}
        >
          <div style={{ width: geo.trimWidthPx, height: geo.trimHeightPx, transform: `scale(${trimScale})`, transformOrigin: 'top left', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: -geo.bleedPx, top: -geo.bleedPx }}>
              <PrintStage doc={doc}>{page ? page({ doc, geo }) : null}</PrintStage>
            </div>
          </div>
        </div>
      </Html>
    </group>
  )
}

/* ── camera: orbit + WASD fly, with imperative view presets ──────────────────── */

function CameraRig({ apiRef }: { apiRef: React.MutableRefObject<{ setView: (pos: Vec3, target: Vec3) => void } | null> }) {
  const { camera, controls } = useThree() as unknown as { camera: any; controls: any }
  const keys = useRef<Record<string, boolean>>({})
  const tmp = useRef({ a: new Vector3(), b: new Vector3(), c: new Vector3() })

  useEffect(() => {
    apiRef.current = {
      setView: (pos, target) => {
        camera.position.set(pos[0], pos[1], pos[2])
        const c = controls
        if (c) {
          c.target.set(target[0], target[1], target[2])
          c.update()
        }
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, camera, controls])

  useEffect(() => {
    const isText = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
    const dn = (e: KeyboardEvent) => {
      if (isText(e.target)) return
      keys.current[e.key.toLowerCase()] = true
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false
    }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', dn)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useFrame((_, dt) => {
    const c = controls
    if (!c) return
    const { a, b, c: cc } = tmp.current
    const k = keys.current
    const move = a.set(0, 0, 0)
    const forward = b.copy(c.target).sub(camera.position)
    forward.y = 0
    if (forward.lengthSq() > 1e-6) forward.normalize()
    const right = cc.crossVectors(forward, camera.up).normalize()
    if (k['w']) move.add(forward)
    if (k['s']) move.sub(forward)
    if (k['d']) move.add(right)
    if (k['a']) move.sub(right)
    if (k['r']) move.y += 1
    if (k['f']) move.y -= 1
    if (move.lengthSq() > 1e-6) {
      move.normalize().multiplyScalar(6 * dt)
      camera.position.add(move)
      c.target.add(move)
      c.update()
    }
  })

  return null
}

/* ── HUD ──────────────────────────────────────────────────────────────────────*/

function Hud({
  docs,
  armedId,
  setArmedId,
  selected,
  selectedDoc,
  updateSelected,
  removeSelected,
  onZone,
  selectedIsPaired,
  selectedSupportsDouble,
  partnerTitle,
  onDoubleSided,
  onSplitFaces,
  showPeople,
  setShowPeople,
  showLabels,
  setShowLabels,
  showFrames,
  setShowFrames,
  realista,
  setRealista,
  fallbackHeight,
  setFallbackHeight,
  selectedWallHeight,
  placementCount,
  onBack,
  onAerial,
  onWalk,
  onMountHero,
  onMountHeroZoned,
  canMountHero,
  onExport,
  onImport,
  onClear,
}: {
  docs: PrintDoc[]
  armedId: string | null
  setArmedId: (id: string) => void
  selected: Placement | null
  selectedDoc: PrintDoc | null
  updateSelected: (patch: Partial<Placement>) => void
  removeSelected: () => void
  onZone: (count: number) => void
  selectedIsPaired: boolean
  selectedSupportsDouble: boolean
  partnerTitle: string | null
  onDoubleSided: () => void
  onSplitFaces: () => void
  showPeople: boolean
  setShowPeople: (f: (p: boolean) => boolean) => void
  showLabels: boolean
  setShowLabels: (f: (p: boolean) => boolean) => void
  showFrames: boolean
  setShowFrames: (f: (p: boolean) => boolean) => void
  realista: boolean
  setRealista: (f: (p: boolean) => boolean) => void
  fallbackHeight: number
  setFallbackHeight: (n: number) => void
  selectedWallHeight: number
  placementCount: number
  onBack: () => void
  onAerial: () => void
  onWalk: () => void
  onMountHero: () => void
  onMountHeroZoned: () => void
  canMountHero: boolean
  onExport: () => void
  onImport: (text: string) => void
  onClear: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const armedDoc = docs.find((d) => d.id === armedId) ?? null
  const pickImport = () => fileRef.current?.click()
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    file.text().then(onImport)
  }
  return (
    <>
      {/* top bar */}
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
        <button onClick={onBack} style={{ ...glassBtn, pointerEvents: 'auto' }}>◀ índice</button>
        <span style={{ ...pill, pointerEvents: 'auto' }}>🏛 Espacio del evento · {SPACE_WIDTH}×{SPACE_DEPTH} m</span>
        <div style={{ flex: 1 }} />
        {canMountHero && (
          <button
            onClick={onMountHero}
            title="Cuelga el hero «Sistema solar de la inversión» en la pared 2 (cara S3), a escala real sobre la banda visual"
            style={{ ...glassBtn, pointerEvents: 'auto', color: '#ffce6b', borderColor: 'rgba(255,206,107,0.5)' }}
          >
            ☀ Montar HERO
          </button>
        )}
        {canMountHero && (
          <button
            onClick={onMountHeroZoned}
            title="Reparte la cara S3 de la pared 2 en las tres cámaras del nave (IMAGE · TEXT+CODE · INVERSIÓN); el hero va en la bahía INVERSIÓN"
            style={{ ...glassBtn, pointerEvents: 'auto', color: '#ffce6b', borderColor: 'rgba(255,206,107,0.5)' }}
          >
            ☀ HERO zonas
          </button>
        )}
        <button onClick={onAerial} style={{ ...glassBtn, pointerEvents: 'auto' }}>Vista aérea</button>
        <button onClick={onWalk} style={{ ...glassBtn, pointerEvents: 'auto' }}>Vista a pie</button>
        <button onClick={() => setShowPeople((p) => !p)} title="Muestra/oculta la simulación de uso: personas, mesas y punto de spawn. Oculto por defecto." style={{ ...glassBtn, pointerEvents: 'auto', color: showPeople ? KIT_BLUE : '#c9cdd6' }}>
          👥 Personas {showPeople ? 'on' : 'off'}
        </button>
        <button onClick={() => setShowFrames((p) => !p)} style={{ ...glassBtn, pointerEvents: 'auto', color: showFrames ? KIT_BLUE : '#c9cdd6' }}>
          ▦ Marcos {showFrames ? 'on' : 'off'}
        </button>
        <button onClick={() => setShowLabels((p) => !p)} style={{ ...glassBtn, pointerEvents: 'auto', color: showLabels ? KIT_BLUE : '#c9cdd6' }}>
          🏷 Etiquetas {showLabels ? 'on' : 'off'}
        </button>
        <button
          onClick={() => setRealista((p) => !p)}
          title="Vista real: pinta cada print como textura 3D (su PNG exportado) en vez de superponerlo — la geometría lo ocluye, no flota por encima. Se renderiza bajo demanda; la primera vez puede tardar."
          style={{ ...glassBtn, pointerEvents: 'auto', color: realista ? KIT_BLUE : '#c9cdd6' }}
        >
          👁 Vista real {realista ? 'on' : 'off'}
        </button>
      </div>

      {/* left: catalogue + editor */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 64,
          bottom: 16,
          width: 280,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          background: 'rgba(18,20,26,0.84)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          padding: 16,
          color: '#e8e8f0',
          fontFamily: UI_FONT,
          overflowY: 'auto',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800 }}>Print a colgar</div>
        <select value={armedId ?? ''} onChange={(e) => setArmedId(e.target.value)} style={selectStyle}>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: '#9aa0ac', lineHeight: 1.5 }}>
          {armedDoc && (
            <>
              <b>{fmtMm(armedDoc.dimensions.trimWidthMm)}×{fmtMm(armedDoc.dimensions.trimHeightMm)} mm</b>
              {' · '}
            </>
          )}
          Haz <b>click en una pared</b> para colgarlo a tamaño real. Click en un print colgado para editarlo.
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selected && selectedDoc ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 800 }}>Editar: {selectedDoc.title}</div>
              <Slider label="Tamaño" value={selected.scale} display={`${Math.round(selected.scale * 100)}%`} min={0.25} max={4} step={0.05} onChange={(v) => updateSelected({ scale: v })} />
              <Slider label="Altura (centro)" value={selected.centerY} display={`${selected.centerY.toFixed(2)} m`} min={0.3} max={Math.max(0.3, selectedWallHeight - 0.1)} step={0.05} onChange={(v) => updateSelected({ centerY: v })} />
              <Slider label="Posición lateral" value={selected.along} display={`${selected.along.toFixed(1)} m`} min={-Math.max(SPACE_WIDTH, SPACE_DEPTH) / 2} max={Math.max(SPACE_WIDTH, SPACE_DEPTH) / 2} step={0.1} onChange={(v) => updateSelected({ along: v })} />
              {!selectedIsPaired && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a7adba', marginBottom: 6 }}>
                    Repartir en zonas
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[2, 3, 4].map((n) => (
                      <button key={n} onClick={() => onZone(n)} style={{ ...glassBtn, flex: 1, textAlign: 'center' }}>
                        {n} zonas
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: '#7c8190', lineHeight: 1.4, marginTop: 6 }}>
                    Divide la pared en una serie de segmentos a lo largo (en vez de un print estirado).
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a7adba', marginBottom: 6 }}>
                  Caras de la pared
                </div>
                {selectedIsPaired ? (
                  <>
                    <div style={{ fontSize: 10.5, color: '#9aa0ac', lineHeight: 1.5 }}>
                      🔁 <b>Doble cara</b> · reverso: <b>{partnerTitle ?? '—'}</b>. Mover, escalar y subir afecta a las dos caras.
                    </div>
                    <button onClick={onSplitFaces} style={{ ...glassBtn, marginTop: 8 }}>⛓ Separar caras</button>
                  </>
                ) : selectedSupportsDouble ? (
                  <>
                    <button onClick={onDoubleSided} style={{ ...glassBtn, color: '#7fd0ff', borderColor: 'rgba(127,208,255,0.4)' }}>
                      🔁 Hacer doble cara
                    </button>
                    <div style={{ fontSize: 10, color: '#7c8190', lineHeight: 1.4, marginTop: 6 }}>
                      Pared de doble cara (brief). Arma otro print del catálogo para que el reverso lleve arte distinto.
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 10, color: '#7c8190', lineHeight: 1.4 }}>
                    Esta pared no es de doble cara.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!selectedIsPaired && (
                  <button onClick={() => updateSelected({ side: (selected.side * -1) as 1 | -1 })} style={glassBtn}>↔ Cambiar cara</button>
                )}
                <button onClick={removeSelected} style={{ ...glassBtn, color: '#ff6b7d', borderColor: 'rgba(255,107,125,0.4)' }}>
                  🗑 Quitar{selectedIsPaired ? ' (2 caras)' : ''}
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#7c8190', lineHeight: 1.5 }}>
              {placementCount === 0 ? 'Aún no has colgado ningún print.' : `${placementCount} print(s) colgados. Selecciona uno para editarlo.`}
            </div>
          )}

          <Slider label="Altura por defecto" value={fallbackHeight} display={`${fallbackHeight.toFixed(1)} m`} min={2.2} max={5} step={0.1} onChange={setFallbackHeight} />
          <div style={{ fontSize: 10, color: '#7c8190', lineHeight: 1.4 }}>
            Solo afecta a muros sin altura medida; los que la tengan usan su <code>alturaM</code>.
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a7adba', display: 'flex', justifyContent: 'space-between' }}>
            <span>Diseño</span>
            <span style={{ color: '#7c8190', fontWeight: 600 }}>se guarda solo</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onExport} disabled={placementCount === 0} style={{ ...glassBtn, flex: 1, opacity: placementCount === 0 ? 0.45 : 1 }}>
              ⬇ Exportar
            </button>
            <button onClick={pickImport} style={{ ...glassBtn, flex: 1 }}>⬆ Importar</button>
          </div>
          <button onClick={onClear} disabled={placementCount === 0} style={{ ...glassBtn, color: '#ff6b7d', borderColor: 'rgba(255,107,125,0.4)', opacity: placementCount === 0 ? 0.45 : 1 }}>
            🗑 Vaciar diseño
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: 'none' }} />
        </div>

        <div style={{ fontSize: 10.5, color: '#7c8190', lineHeight: 1.5, marginTop: 'auto' }}>
          Orbitar: arrastrar · zoom: rueda · caminar: WASD · subir/bajar: R/F · borrar print: Supr/⌫
        </div>
      </div>
    </>
  )
}

const fmtMm = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

const glassBtn: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.12)',
  cursor: 'pointer',
  background: 'rgba(18,20,26,0.82)',
  backdropFilter: 'blur(6px)',
  color: '#c9cdd6',
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: UI_FONT,
}
const pill: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 9,
  background: 'rgba(18,20,26,0.82)',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e8e8f0',
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: UI_FONT,
}
const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e8e8f0',
  fontSize: 12.5,
  fontWeight: 600,
  fontFamily: UI_FONT,
  cursor: 'pointer',
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a7adba', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: '#e8e8f0' }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: KIT_BLUE }} />
    </label>
  )
}
