import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, Html, Lightformer, Line, OrbitControls, OrthographicCamera } from '@react-three/drei'
import { InstancedMesh, MathUtils, Object3D, Plane, Vector3 } from 'three'
import { snapMove, fmtGap, type Box, type AlignGuide, type MeasureGuide } from '../space/snapping'
import { KIT_BLUE, lightTheme, darkTheme } from '@/lib/neumorphism'
import { buildGeometry } from '../geometry'
import { getPrintPage } from '../pages'
import { PrintStage } from '../PrintRenderer'
import { useLivePrintFaceTexture } from './printLiveTexture'
import type { PrintDoc } from '../types'
import {
  DEFAULT_WALL_HEIGHT_M,
  GLASS,
  PEOPLE,
  SPACE_DEPTH,
  SPACE_WIDTH,
  SPAWNS,
  WALL_HEIGHT,
  loadFurnitureItems,
  loadWallItems,
  nextWallId,
  resolveEditableWall,
  resolveWallHeight,
  wallItemToElement,
  wallsWithoutHeight,
  type EditableWall,
  type FootprintBox,
  type Wall,
} from '../space/eventLayout'
import {
  FURNITURE_DEFAULTS,
  FURNITURE_LABEL,
  FURNITURE_MAX_ELEVATION,
  FURNITURE_MAX_HEIGHT,
  FURNITURE_MAX_SIZE,
  FURNITURE_MIN_ELEVATION,
  FURNITURE_MIN_HEIGHT,
  FURNITURE_MIN_SIZE,
  furnitureElevation,
  furnitureHeight,
  furnitureToElements,
  nextFurnitureId,
  type FurnitureItem,
  type FurnitureKind,
} from '../space/furniture'
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
import { computeWallFrames, PARED_COMPLETA_FACES } from '../space/wallFrames'
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
// Nudge a pasted/duplicated piece off its source so the copy never lands hidden
// exactly under the original (clamped back into the room after the offset).
const FURNITURE_PASTE_OFFSET_M = 0.6
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
const PLANT_COL = '#5f8f57'
const POT_COL = '#8a6a4a'

type Vec3 = [number, number, number]

type DragKind = 'furn' | 'wall'
/** Live drag feedback: the dragged box plus the alignment + distance guides to show. */
type DragSession = { kind: DragKind; box: Box; aligns: AlignGuide[]; measures: MeasureGuide[] }

/** A tool armed in the "edit space" palette: a furniture kind, or a wall. */
type SpaceTool = FurnitureKind | 'wall'

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
  // Free world-space nudge (X/Y/Z) on top of the wall-anchored position — lets the
  // piece be moved on any axis, including off the wall surface (depth).
  const o = p.offset
  if (o) pos = [pos[0] + o.x, pos[1] + o.y, pos[2] + o.z]
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
  // One global height for every wall (the venue's walls are uniform). Seeded from
  // the saved `wallHeight`, else the brief's 2.5 m default; the slider drives it.
  const [fallbackHeight, setFallbackHeight] = useState(WALL_HEIGHT ?? DEFAULT_WALL_HEIGHT_M)
  // Wall identity overlay: float `#N · sala` + tema over the 20 event walls so
  // mounting the right piece on the right wall stays unambiguous during production.
  // Off by default — the default view reads the space as built (toggle on to mount).
  const [showLabels, setShowLabels] = useState(false)
  // Blank-frame base layer: every wall face papered with an empty white frame at
  // true scale, split where walls cut it (`computeWallFrames`). On by default.
  const [showFrames, setShowFrames] = useState(true)
  // "Vista real": paint each print as a true depth-tested mesh texture (the live page,
  // rasterised) instead of the floating <Html> overlay, so a wall in front hides the
  // print behind it — the space reads like real life, nothing pops on top. On by
  // default (the space's primary view); toggle off for the live, selectable Html faces.
  const [realista, setRealista] = useState(true)
  // "Vista de plano": a true top-down ORTHOGRAPHIC camera (no perspective) — reads the
  // venue as a flat floor plan. Toggling it swaps the default camera to the ortho one
  // (drei restores the perspective camera when turned off) and locks orbit rotation.
  const [planMode, setPlanMode] = useState(false)
  const cameraApi = useRef<{ setView: (pos: Vec3, target: Vec3) => void } | null>(null)

  // Movable furniture (tables / bar / plants). Seeded from the layout file; the
  // operator can drag, add and remove pieces in edit mode and write the result
  // back to `event-layout.json`. Walls/glass/crowd are fixed and not edited here.
  const [furniture, setFurniture] = useState<FurnitureItem[]>(() => loadFurnitureItems())
  // Editable walls (move / rotate / add / remove), seeded from the layout. Every
  // wall renders at one global height (`fallbackHeight`), so the venue's walls
  // stay uniform. Glass and the crowd are not editable.
  const [walls, setWalls] = useState<EditableWall[]>(() => loadWallItems())
  // One "edit space" mode toggles furniture *and* wall editing together.
  const [editFurniture, setEditFurniture] = useState(false)
  const [selectedFurnId, setSelectedFurnId] = useState<string | null>(null)
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null)
  // The tool primed to drop on the next floor click (a furniture kind, a wall, or
  // null = none armed). Shared by the furniture + wall palette.
  const [armed, setArmed] = useState<SpaceTool | null>(null)
  const [savingFurniture, setSavingFurniture] = useState(false)
  // Unsaved edits (true after any change, false on load + after a save).
  const [furnitureDirty, setFurnitureDirty] = useState(false)
  const [wallsDirty, setWallsDirty] = useState(false)
  // Copy/paste clipboard: a full snapshot of the last copied furniture piece, kept
  // in memory so it can be pasted any number of times (and survives deselection).
  const [furnitureClipboard, setFurnitureClipboard] = useState<FurnitureItem | null>(null)

  // ── Undo / redo (Ctrl/Cmd+Z) ──────────────────────────────────────────────────
  // History of the editable layout (furniture + walls + hung prints). Every mutation is
  // immutable (new arrays/objects), so a snapshot is just the current array refs — no
  // deep copy. `beginEdit()` records the pre-edit state right before a change; drags
  // snapshot once on grab (deduped on release if nothing moved); slider streams coalesce
  // by `tag` so a continuous resize is one undo step.
  type EditSnap = { furniture: FurnitureItem[]; walls: EditableWall[]; placements: Placement[] }
  const stateRef = useRef<EditSnap>({ furniture, walls, placements })
  stateRef.current = { furniture, walls, placements }
  const undoStack = useRef<EditSnap[]>([])
  const redoStack = useRef<EditSnap[]>([])
  const [, setHistTick] = useState(0)
  const bumpHistory = useCallback(() => setHistTick((t) => t + 1), [])
  const lastEdit = useRef<{ tag?: string; t: number }>({ t: 0 })
  const beginEdit = useCallback((tag?: string) => {
    const now = performance.now()
    if (tag && lastEdit.current.tag === tag && now - lastEdit.current.t < 700) {
      lastEdit.current.t = now
      return // coalesce a stream of same-tag edits (e.g. dragging a size slider)
    }
    undoStack.current.push(stateRef.current)
    if (undoStack.current.length > 120) undoStack.current.shift()
    redoStack.current = []
    lastEdit.current = { tag, t: now }
    bumpHistory()
  }, [bumpHistory])
  const applySnap = useCallback((s: EditSnap) => {
    setFurniture(s.furniture)
    setWalls(s.walls)
    setPlacements(s.placements)
    setFurnitureDirty(true)
    setWallsDirty(true)
    setSelectedFurnId(null)
    setSelectedWallId(null)
    setSelectedId(null)
  }, [])
  const undo = useCallback(() => {
    if (!undoStack.current.length) return
    redoStack.current.push(stateRef.current)
    applySnap(undoStack.current.pop()!)
    lastEdit.current = { t: 0 }
    bumpHistory()
  }, [applySnap, bumpHistory])
  const redo = useCallback(() => {
    if (!redoStack.current.length) return
    undoStack.current.push(stateRef.current)
    applySnap(redoStack.current.pop()!)
    lastEdit.current = { t: 0 }
    bumpHistory()
  }, [applySnap, bumpHistory])
  const canUndo = undoStack.current.length > 0
  const canRedo = redoStack.current.length > 0

  useEffect(() => {
    const isText = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || isText(e.target)) return
      const k = e.key.toLowerCase()
      if (k === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (k === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const docById = useCallback((id: string) => docs.find((d) => d.id === id), [docs])

  // Keep a furniture piece inside the room: clamp its centre so its footprint
  // never spills past a wall (per axis, accounting for the piece's own size).
  const clampToRoom = useCallback((cx: number, cz: number, sx: number, sz: number) => {
    const halfX = Math.max(0, SPACE_WIDTH / 2 - sx / 2)
    const halfZ = Math.max(0, SPACE_DEPTH / 2 - sz / 2)
    return { cx: MathUtils.clamp(cx, -halfX, halfX), cz: MathUtils.clamp(cz, -halfZ, halfZ) }
  }, [])

  const addFurniture = useCallback(
    (kind: FurnitureKind, x: number, z: number) => {
      beginEdit()
      const { sx, sz } = FURNITURE_DEFAULTS[kind]
      const id = nextFurnitureId(furniture, kind)
      const { cx, cz } = clampToRoom(x, z, sx, sz)
      setFurniture((cur) => [...cur, { id, kind, cx, cz, sx, sz }])
      setSelectedFurnId(id)
      setSelectedWallId(null)
      setFurnitureDirty(true)
    },
    [furniture, clampToRoom, beginEdit],
  )

  const moveFurniture = useCallback(
    (id: string, x: number, z: number) => {
      setFurniture((cur) =>
        cur.map((it) => (it.id === id ? { ...it, ...clampToRoom(x, z, it.sx, it.sz) } : it)),
      )
      setFurnitureDirty(true)
    },
    [clampToRoom],
  )

  const updateSelectedFurn = useCallback(
    (patch: Partial<FurnitureItem>) => {
      beginEdit('furn-edit')
      setFurniture((cur) =>
        cur.map((it) => {
          if (it.id !== selectedFurnId) return it
          const merged = { ...it, ...patch }
          // A resize can push the piece past a wall — re-clamp its centre to fit.
          return { ...merged, ...clampToRoom(merged.cx, merged.cz, merged.sx, merged.sz) }
        }),
      )
      setFurnitureDirty(true)
    },
    [selectedFurnId, clampToRoom, beginEdit],
  )

  const removeSelectedFurn = useCallback(() => {
    beginEdit()
    setFurniture((cur) => cur.filter((it) => it.id !== selectedFurnId))
    setSelectedFurnId(null)
    setFurnitureDirty(true)
  }, [selectedFurnId, beginEdit])

  const selectedFurn = furniture.find((f) => f.id === selectedFurnId) ?? null

  // Drop a fresh-id copy of `src` (all dimensions/rotation/height/elevation kept),
  // nudged off the source and clamped into the room, then select it. The shared core
  // of paste and duplicate.
  const placeFurnitureCopy = useCallback(
    (src: FurnitureItem) => {
      beginEdit()
      const id = nextFurnitureId(furniture, src.kind)
      const { cx, cz } = clampToRoom(
        src.cx + FURNITURE_PASTE_OFFSET_M,
        src.cz + FURNITURE_PASTE_OFFSET_M,
        src.sx,
        src.sz,
      )
      setFurniture((cur) => [...cur, { ...src, id, cx, cz }])
      setSelectedFurnId(id)
      setSelectedWallId(null)
      setFurnitureDirty(true)
    },
    [furniture, clampToRoom, beginEdit],
  )
  // Copy stores a snapshot; paste drops it; duplicate drops a copy of the current
  // selection directly (without disturbing the clipboard, so an earlier copy survives).
  const copyFurniture = useCallback(() => {
    if (selectedFurn) setFurnitureClipboard(selectedFurn)
  }, [selectedFurn])
  const pasteFurniture = useCallback(() => {
    if (furnitureClipboard) placeFurnitureCopy(furnitureClipboard)
  }, [furnitureClipboard, placeFurnitureCopy])
  const duplicateFurniture = useCallback(() => {
    if (selectedFurn) placeFurnitureCopy(selectedFurn)
  }, [selectedFurn, placeFurnitureCopy])

  /* ── editable walls ─────────────────────────────────────────────────────── */

  // Resolve the editable walls to render/mounting `Wall`s at the single global
  // height. An unedited wall resolves to the same id + geometry it had in the
  // static set, so any print mounted on it (keyed by wall id) stays put.
  const resolvedWalls = useMemo(
    () => walls.map((w) => resolveEditableWall(w, fallbackHeight)),
    [walls, fallbackHeight],
  )
  const registeredWalls = useMemo(
    () => resolvedWalls.filter((w) => w.registry).sort((a, b) => a.registry!.invId - b.registry!.invId),
    [resolvedWalls],
  )
  // Footprints fed to the plan-view clearance cotas: every wall + the glass
  // envelope, plus furniture only while it's actually on screen (so we never
  // measure a gap to something the operator can't see).
  const planGapBoxes = useMemo(() => {
    const boxes: Box[] = resolvedWalls.map((w) => ({ cx: w.cx, cz: w.cz, sx: w.sx, sz: w.sz }))
    for (const g of GLASS) boxes.push({ cx: g.cx, cz: g.cz, sx: g.sx, sz: g.sz })
    if (showPeople || editFurniture) for (const f of furniture) boxes.push({ cx: f.cx, cz: f.cz, sx: f.sx, sz: f.sz })
    return boxes
  }, [resolvedWalls, furniture, showPeople, editFurniture])
  // Look up a mountable surface by id from the live (editable) walls + static glass.
  const findWallLocal = useCallback(
    (id: string): Wall | undefined => resolvedWalls.find((w) => w.id === id) ?? GLASS.find((g) => g.id === id),
    [resolvedWalls],
  )
  const findWallByInvIdLocal = useCallback(
    (invId: number) => resolvedWalls.find((w) => w.registry?.invId === invId),
    [resolvedWalls],
  )

  const addWall = useCallback(
    (x: number, z: number) => {
      beginEdit()
      const sx = 4 // default: a 4 m run…
      const sz = 0.2 // …0.2 m thick (rotate 90° to swap which axis runs)
      const id = nextWallId(walls)
      const { cx, cz } = clampToRoom(x, z, sx, sz)
      setWalls((cur) => [...cur, { id, cx, cz, sx, sz }])
      setSelectedWallId(id)
      setSelectedFurnId(null)
      setWallsDirty(true)
    },
    [walls, clampToRoom, beginEdit],
  )

  const moveWall = useCallback(
    (id: string, x: number, z: number) => {
      setWalls((cur) => cur.map((w) => (w.id === id ? { ...w, ...clampToRoom(x, z, w.sx, w.sz) } : w)))
      setWallsDirty(true)
    },
    [clampToRoom],
  )

  const updateSelectedWall = useCallback(
    (patch: Partial<EditableWall>) => {
      beginEdit('wall-edit')
      setWalls((cur) =>
        cur.map((w) => {
          if (w.id !== selectedWallId) return w
          const merged = { ...w, ...patch }
          return { ...merged, ...clampToRoom(merged.cx, merged.cz, merged.sx, merged.sz) }
        }),
      )
      setWallsDirty(true)
    },
    [selectedWallId, clampToRoom, beginEdit],
  )

  // Rotate 90°: swap the footprint's run/thickness axes about the centre. The wall
  // stays axis-aligned, so its normal axis — and every mounting calculation — stays
  // exact (no need to rework `wallRun` / `placementTransform` / frames).
  const rotateSelectedWall = useCallback(() => {
    beginEdit()
    setWalls((cur) => cur.map((w) => (w.id === selectedWallId ? { ...w, sx: w.sz, sz: w.sx } : w)))
    setWallsDirty(true)
  }, [selectedWallId, beginEdit])

  const removeSelectedWall = useCallback(() => {
    beginEdit()
    setWalls((cur) => cur.filter((w) => w.id !== selectedWallId))
    setSelectedWallId(null)
    setWallsDirty(true)
  }, [selectedWallId, beginEdit])

  const selectedWallItem = walls.find((w) => w.id === selectedWallId) ?? null

  // Selecting one editable thing clears the other, so Delete + the side panel
  // always act on a single, unambiguous selection.
  const selectFurniture = useCallback((id: string) => {
    setSelectedFurnId(id)
    setSelectedWallId(null)
  }, [])
  const selectWall = useCallback((id: string) => {
    setSelectedWallId(id)
    setSelectedFurnId(null)
  }, [])

  /* ── drag with snapping + live guides ────────────────────────────────────────── */
  // Lifted so the guide overlay can render while a piece is being dragged. On grab we
  // snapshot the OTHER elements' footprints once (they don't move during the drag), then
  // each move snaps the dragged box against them and reports the alignment + gap guides.
  const [dragSession, setDragSession] = useState<DragSession | null>(null)
  const dragRef = useRef<{ kind: DragKind; id: string; others: Box[]; sx: number; sz: number; start: { cx: number; cz: number } } | null>(null)

  const dragStart = useCallback((kind: DragKind, id: string) => {
    const me = (kind === 'furn' ? stateRef.current.furniture : stateRef.current.walls).find((x) => x.id === id)
    if (!me) return
    const others: Box[] = [
      ...stateRef.current.furniture.filter((f) => !(kind === 'furn' && f.id === id)).map((f) => ({ cx: f.cx, cz: f.cz, sx: f.sx, sz: f.sz })),
      ...stateRef.current.walls.filter((w) => !(kind === 'wall' && w.id === id)).map((w) => ({ cx: w.cx, cz: w.cz, sx: w.sx, sz: w.sz })),
    ]
    dragRef.current = { kind, id, others, sx: me.sx, sz: me.sz, start: { cx: me.cx, cz: me.cz } }
    beginEdit() // one snapshot per drag; dropped on release if nothing moved
  }, [beginEdit])

  const dragMove = useCallback((kind: DragKind, id: string, rawX: number, rawZ: number, noSnap: boolean) => {
    const d = dragRef.current
    const moving = { sx: d?.sx ?? 1, sz: d?.sz ?? 1 }
    const res = noSnap || !d
      ? { cx: rawX, cz: rawZ, aligns: [] as AlignGuide[], measures: [] as MeasureGuide[] }
      : snapMove({ moving, cx: rawX, cz: rawZ, others: d.others, room: { width: SPACE_WIDTH, depth: SPACE_DEPTH }, threshold: 0.3, grid: 0.5 })
    if (kind === 'furn') moveFurniture(id, res.cx, res.cz)
    else moveWall(id, res.cx, res.cz)
    setDragSession({ kind, box: { cx: res.cx, cz: res.cz, sx: moving.sx, sz: moving.sz }, aligns: res.aligns, measures: res.measures })
  }, [moveFurniture, moveWall])

  const dragEnd = useCallback(() => {
    const d = dragRef.current
    if (d) {
      const me = (d.kind === 'furn' ? stateRef.current.furniture : stateRef.current.walls).find((x) => x.id === d.id)
      if (me && Math.abs(me.cx - d.start.cx) < 1e-4 && Math.abs(me.cz - d.start.cz) < 1e-4) {
        undoStack.current.pop() // a click that didn't move: discard the snapshot
        bumpHistory()
      }
    }
    dragRef.current = null
    setDragSession(null)
  }, [bumpHistory])

  const toggleEditFurniture = useCallback(() => {
    setEditFurniture((p) => {
      if (p) {
        setArmed(null)
        setSelectedFurnId(null)
        setSelectedWallId(null)
      }
      return !p
    })
  }, [])

  // Write the editable layout (furniture + walls) back into event-layout.json (dev
  // endpoint). The dev plugin suppresses the file's HMR reload, so the in-memory
  // state stays the source of truth and saving is seamless.
  const saveLayout = useCallback(async () => {
    setSavingFurniture(true)
    try {
      const res = await fetch('/api/event-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          furniture: furnitureToElements(furniture, SPACE_WIDTH, SPACE_DEPTH),
          walls: walls.map((w) => wallItemToElement(w)),
          wallHeight: fallbackHeight,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.ok && json.ok) {
        setFurnitureDirty(false)
        setWallsDirty(false)
      } else {
        console.error('[event-space] guardar espacio falló', json)
        alert(`No se pudo guardar el espacio: ${json.error ?? res.statusText}`)
      }
    } catch (err) {
      console.error('[event-space] guardar espacio falló', err)
      alert('No se pudo guardar el espacio. ¿Está corriendo el servidor de dev (npm run dev)?')
    } finally {
      setSavingFurniture(false)
    }
  }, [furniture, walls, fallbackHeight])

  // Auto-save: persist the layout a beat after the last edit, debounced so a drag
  // writes once on release rather than every frame. Move / edit / rotate / delete
  // all flip a dirty flag, so every change lands in the file on its own.
  useEffect(() => {
    if (!furnitureDirty && !wallsDirty) return
    const t = setTimeout(() => {
      void saveLayout()
    }, 600)
    return () => clearTimeout(t)
  }, [furnitureDirty, wallsDirty, saveLayout])

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
      beginEdit()
      setPlacements((cur) => [...cur, next])
      setSelectedId(id)
    },
    [armedId, docById, placements.length, fallbackHeight, beginEdit],
  )

  const updateSelected = useCallback(
    (patch: Partial<Placement>) => {
      beginEdit('place-edit')
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
    [selectedId, beginEdit],
  )
  const removeSelected = useCallback(() => {
    beginEdit()
    setPlacements((cur) => {
      const sel = cur.find((p) => p.id === selectedId)
      if (!sel) return cur
      const partner = pairFor(sel, cur) // removing one face removes the whole piece
      const drop = new Set([sel.id, ...(partner ? [partner.id] : [])])
      return cur.filter((p) => !drop.has(p.id))
    })
    setSelectedId(null)
  }, [selectedId, beginEdit])

  // Delete / Backspace removes the current selection (unless a form field has
  // focus, e.g. a dropdown). In edit-space mode the selected wall or furniture
  // piece goes first; otherwise it unmounts the selected print.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (editFurniture && selectedWallId) {
        e.preventDefault()
        removeSelectedWall()
      } else if (editFurniture && selectedFurnId) {
        e.preventDefault()
        removeSelectedFurn()
      } else if (selectedId) {
        e.preventDefault()
        removeSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, removeSelected, editFurniture, selectedFurnId, removeSelectedFurn, selectedWallId, removeSelectedWall])

  // Copy (⌘/Ctrl+C), paste (⌘/Ctrl+V) and duplicate (⌘/Ctrl+D) the selected furniture
  // piece, only while editing the space. Skipped when a form field has focus so the
  // shortcuts never hijack a real text copy/paste.
  useEffect(() => {
    if (!editFurniture) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const t = e.target
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      const k = e.key.toLowerCase()
      if (k === 'c' && selectedFurnId) {
        e.preventDefault()
        copyFurniture()
      } else if (k === 'v' && furnitureClipboard) {
        e.preventDefault()
        pasteFurniture()
      } else if (k === 'd' && selectedFurnId) {
        e.preventDefault()
        duplicateFurniture()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editFurniture, selectedFurnId, furnitureClipboard, copyFurniture, pasteFurniture, duplicateFurniture])

  const selected = placements.find((p) => p.id === selectedId) ?? null
  // Height of the wall the selected print hangs on — bounds its centre-height slider.
  const selectedWall = selected ? findWallLocal(selected.wallId) : undefined
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
      const wall = findWallLocal(selected.wallId)
      const doc = docById(selected.printId)
      if (!wall || !doc) return
      const { runCenter } = wallRun(wall)
      beginEdit()
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
    [selected, docById, placements.length, beginEdit],
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
    beginEdit()
    setPlacements((cur) => [...cur.filter((p) => p.id !== selected.id), front, back])
    setSelectedId(front.id)
  }, [selected, placements, armedId, beginEdit])

  // Unlink a double-sided pair back into two independent single-face placements.
  const splitSelectedFaces = useCallback(() => {
    const pid = selected?.pairId
    if (!pid) return
    beginEdit()
    setPlacements((cur) => unlinkPair(pid, cur))
  }, [selected, beginEdit])

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
    beginEdit()
    setPlacements(parsePlacements(text))
    setSelectedId(null)
  }, [beginEdit])

  const clearLayout = useCallback(() => {
    beginEdit()
    setPlacements([])
    setSelectedId(null)
    clearPlacements()
  }, [beginEdit])

  const setView = useCallback((pos: Vec3, target: Vec3) => cameraApi.current?.setView(pos, target), [])
  // Aerial / walk drive the perspective camera. If we're leaving plan mode, the default
  // camera only swaps back to the perspective one after this render commits — so defer the
  // framing one frame (rAF) so setView lands on the perspective camera, not the ortho one.
  const perspView = useCallback((pos: Vec3, target: Vec3) => {
    if (planMode) { setPlanMode(false); requestAnimationFrame(() => setView(pos, target)) }
    else setView(pos, target)
  }, [planMode, setView])
  const aerialView = useCallback(() => perspView([0, 30, 32], [0, 0, 0]), [perspView])
  const walkView = useCallback(() => perspView([0, 1.6, SPACE_DEPTH / 2 - 4], [0, 1.6, 0]), [perspView])
  const planView = useCallback(() => setPlanMode(true), [])

  // Phase 4 hero slice: mount "Sistema solar de la inversión" on wall 2's S3 face
  // as a light-box, at true scale on the eye band, and frame it head-on so the
  // operator can confirm the scale + placement. Re-mounting replaces the existing
  // hero (no duplicates). The exact placement maths live in `heroSolarPlacement`.
  const heroDoc = useMemo(() => docById(HERO_PRINT_ID), [docById])
  const heroWall = useMemo(() => findWallByInvIdLocal(HERO_INV_ID), [findWallByInvIdLocal])
  const canMountHero = !!heroDoc && !!heroWall
  const mountHero = useCallback(() => {
    if (!heroWall || !heroDoc) return
    const opposite = findWallByInvIdLocal(NAVE_OPPOSITE_INV_ID)
    const placement = heroSolarPlacement({
      wall: heroWall,
      s3Reference: opposite ? { cx: opposite.cx, cz: opposite.cz } : undefined,
      trimHeightMm: heroDoc.dimensions.trimHeightMm,
      fallbackHeight,
    })
    beginEdit()
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
  }, [heroWall, heroDoc, fallbackHeight, setView, findWallByInvIdLocal, beginEdit])

  // Phase 5 (S3 nave): mount wall 2's S3 face as a ZONED light-box per nave camera
  // — three bays (IMAGE / TEXT+CODE / INVERSIÓN) instead of one stretched poster —
  // with the hero hung in the INVERSIÓN bay. Other bays fill in as their pieces
  // ship. Replaces any existing hero placement so re-mounting never duplicates.
  const mountHeroZoned = useCallback(() => {
    if (!heroWall || !heroDoc) return
    const opposite = findWallByInvIdLocal(NAVE_OPPOSITE_INV_ID)
    const plan = naveS3ZonedPlacements({
      wall: heroWall,
      s3Reference: opposite ? { cx: opposite.cx, cz: opposite.cz } : undefined,
      trimHeightMm: heroDoc.dimensions.trimHeightMm,
      fallbackHeight,
    })
    beginEdit()
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
  }, [heroWall, heroDoc, fallbackHeight, setView, findWallByInvIdLocal, beginEdit])

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#1b1e25 0%,#101218 100%)' }}>
      <Canvas
        // On-demand rendering: only redraw when something actually changes (orbit,
        // selection, a texture landing) instead of every frame forever. With many
        // textured prints a continuous loop burns GPU/CPU even while idle; demand mode
        // drops idle cost to ~0. OrbitControls + R3F's reconciler invalidate
        // automatically; WASD fly and async texture loads invalidate explicitly.
        frameloop="demand"
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

        <RoomFloor
          onFloorClick={
            editFurniture && armed
              ? (p) => (armed === 'wall' ? addWall(p.x, p.z) : addFurniture(armed, p.x, p.z))
              : undefined
          }
        />
        <Walls
          walls={resolvedWalls}
          editable={editFurniture}
          selectedId={selectedWallId}
          onSelect={selectWall}
          onDragStart={(id) => dragStart('wall', id)}
          onDragMove={(id, x, z, noSnap) => dragMove('wall', id, x, z, noSnap)}
          onDragEnd={dragEnd}
          onPlace={placeOnWall}
        />
        <GlassPanels fallback={fallbackHeight} onPlace={placeOnWall} />
        {showLabels && <WallLabels registered={registeredWalls} />}
        {showFrames && (
          <WallFrames
            walls={resolvedWalls}
            registered={registeredWalls}
            findWall={findWallLocal}
            fallback={fallbackHeight}
            showLabels={showLabels}
            docs={docs}
            realista={realista}
          />
        )}
        <FurniturePieces
          items={furniture}
          editable={editFurniture}
          showTables={showPeople || editFurniture}
          selectedId={selectedFurnId}
          onSelect={selectFurniture}
          onDragStart={(id) => dragStart('furn', id)}
          onDragMove={(id, x, z, noSnap) => dragMove('furn', id, x, z, noSnap)}
          onDragEnd={dragEnd}
        />
        {showPeople && SPAWNS.map((s, i) => <SpawnMarker key={i} box={s} />)}
        {showPeople && <Crowd />}

        <Suspense fallback={null}>
          {placements.map((p) => {
            const wall = findWallLocal(p.wallId)
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

        <ContactShadows position={[0, 0.01, 0]} opacity={0.32} scale={Math.max(SPACE_WIDTH, SPACE_DEPTH) * 1.2} blur={2.6} far={3} resolution={512} />
        <OrbitControls makeDefault enablePan enableZoom enableRotate={!planMode} minDistance={1} maxDistance={200} maxPolarAngle={Math.PI / 2 - 0.03} target={[0, 1, 0]} />
        <DragGuides session={dragSession} />
        {planMode && <PlanDimensions walls={resolvedWalls} gapBoxes={planGapBoxes} y={fallbackHeight + 0.3} />}
        <PlanCamera enabled={planMode} />
        <CameraRig apiRef={cameraApi} planMode={planMode} />
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
        editFurniture={editFurniture}
        onToggleEditFurniture={toggleEditFurniture}
        armed={armed}
        setArmed={setArmed}
        selectedFurn={selectedFurn}
        updateSelectedFurn={updateSelectedFurn}
        removeSelectedFurn={removeSelectedFurn}
        furnitureCount={furniture.length}
        furnitureClipboardKind={furnitureClipboard?.kind ?? null}
        onCopyFurn={copyFurniture}
        onPasteFurn={pasteFurniture}
        onDuplicateFurn={duplicateFurniture}
        selectedWall={selectedWallItem}
        updateSelectedWall={updateSelectedWall}
        rotateSelectedWall={rotateSelectedWall}
        removeSelectedWall={removeSelectedWall}
        wallCount={walls.length}
        furnitureDirty={furnitureDirty || wallsDirty}
        savingFurniture={savingFurniture}
        onSaveFurniture={saveLayout}
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
        onPlan={planView}
        planMode={planMode}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
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

function RoomFloor({ onFloorClick }: { onFloorClick?: (point: Vector3) => void }) {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={
          onFloorClick
            ? (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation()
                onFloorClick(e.point)
              }
            : undefined
        }
        onPointerOver={onFloorClick ? () => (document.body.style.cursor = 'copy') : undefined}
        onPointerOut={onFloorClick ? () => (document.body.style.cursor = '') : undefined}
      >
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

// All walls. In edit mode each is selectable + draggable across the floor (its
// height stays the global value); otherwise clicking it mounts the armed print —
// the venue's original behaviour. Rotation (90°) and resize live in the side panel.
function Walls({
  walls,
  editable,
  selectedId,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPlace,
}: {
  walls: Wall[]
  editable: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, x: number, z: number, noSnap: boolean) => void
  onDragEnd: () => void
  onPlace: (w: Wall, p: Vector3) => void
}) {
  return (
    <group>
      {walls.map((w) => (
        <WallMesh
          key={w.id}
          wall={w}
          editable={editable}
          selected={w.id === selectedId}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onPlace={onPlace}
        />
      ))}
    </group>
  )
}

function WallMesh({
  wall,
  editable,
  selected,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPlace,
}: {
  wall: Wall
  editable: boolean
  selected: boolean
  onSelect: (id: string) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, x: number, z: number, noSnap: boolean) => void
  onDragEnd: () => void
  onPlace: (w: Wall, p: Vector3) => void
}) {
  const { controls } = useThree() as unknown as { controls: { enabled: boolean } | null }
  const floor = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  const hit = useRef(new Vector3())
  const drag = useRef<{ dx: number; dz: number } | null>(null)
  const h = wall.height

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onSelect(wall.id)
    if (!e.ray.intersectPlane(floor, hit.current)) return
    drag.current = { dx: wall.cx - hit.current.x, dz: wall.cz - hit.current.z }
    onDragStart(wall.id)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
  }
  const onPointerMoveDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    e.stopPropagation()
    if (!e.ray.intersectPlane(floor, hit.current)) return
    onDragMove(wall.id, hit.current.x + drag.current.dx, hit.current.z + drag.current.dz, e.nativeEvent.altKey)
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    e.stopPropagation()
    drag.current = null
    onDragEnd()
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    document.body.style.cursor = ''
  }

  const handlers = editable
    ? {
        onPointerDown: onDown,
        onPointerMove: onPointerMoveDrag,
        onPointerUp: onUp,
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          if (!drag.current) document.body.style.cursor = 'grab'
        },
        onPointerOut: () => !drag.current && (document.body.style.cursor = ''),
      }
    : {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          onPlace(wall, e.point)
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          document.body.style.cursor = 'crosshair'
        },
        onPointerOut: () => (document.body.style.cursor = ''),
      }

  return (
    <mesh position={[wall.cx, h / 2, wall.cz]} castShadow receiveShadow {...handlers}>
      <boxGeometry args={[wall.sx, h, wall.sz]} />
      <meshStandardMaterial
        color={WALL_COL}
        roughness={0.92}
        metalness={0}
        emissive={selected && editable ? KIT_BLUE : '#000000'}
        emissiveIntensity={selected && editable ? 0.4 : 0}
      />
    </mesh>
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

function WallLabels({ registered }: { registered: Wall[] }) {
  return (
    <>
      {registered.map((w) => {
        const label = wallLabel(w)
        if (!label) return null
        const y = w.height + 0.32
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

/* ── movable furniture (tables / bar / plants) ───────────────────────────────── */

// The mesh(es) for one furniture kind, modelled at the origin with its base on the
// group's y=0 so the parent owns position (incl. elevation) + rotation. Built from
// the footprint (sx·sz) and the editable object height `sy`, so a resized or
// re-heighted piece keeps its proportions — nothing about the vertical is hardcoded.
function FurnitureModel({ kind, sx, sz, sy }: { kind: FurnitureKind; sx: number; sz: number; sy: number }) {
  if (kind === 'bar') {
    // The body box IS the bar's height (`sy`, the "eje Y"); a thin counter sits proud
    // on top so the silhouette reads as a bar at any height.
    return (
      <group>
        <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color={BAR_COL} roughness={0.6} metalness={0} />
        </mesh>
        <mesh position={[0, sy + 0.03, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx + 0.1, 0.06, sz + 0.1]} />
          <meshStandardMaterial color="#7c2f1c" roughness={0.5} metalness={0} />
        </mesh>
      </group>
    )
  }
  if (kind === 'plant') {
    // Pot height scales gently with `sy`; the foliage sphere (footprint-sized) rides
    // so its crown reaches `sy`, clamped to always sit above the pot.
    const potR = Math.min(sx, sz) * 0.34
    const foliageR = Math.min(sx, sz) * 0.5
    const potH = Math.min(0.4, sy * 0.4)
    const foliageCY = Math.max(potH + foliageR * 0.3, sy - foliageR)
    return (
      <group>
        <mesh position={[0, potH / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[potR * 0.78, potR, potH, 16]} />
          <meshStandardMaterial color={POT_COL} roughness={0.8} metalness={0} />
        </mesh>
        <mesh position={[0, foliageCY, 0]} castShadow>
          <sphereGeometry args={[foliageR, 14, 12]} />
          <meshStandardMaterial color={PLANT_COL} roughness={0.85} metalness={0} />
        </mesh>
      </group>
    )
  }
  // table
  return (
    <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial color={TABLE_COL} roughness={0.85} metalness={0} />
    </mesh>
  )
}

// A flat blue footprint highlight under the selected piece. Non-raycasting so it
// never intercepts the drag that's moving the piece it marks.
function SelectionFootprint({ sx, sz }: { sx: number; sz: number }) {
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[sx + 0.14, sz + 0.14]} />
      <meshBasicMaterial color={KIT_BLUE} transparent opacity={0.3} />
    </mesh>
  )
}

// One movable piece. In edit mode it's selectable and draggable across the floor
// (pointer-captured ray → floor plane); otherwise it's inert scenery. Orbit is
// suspended while dragging so the camera doesn't fight the drag.
function FurnitureMesh({
  item,
  editable,
  selected,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  item: FurnitureItem
  editable: boolean
  selected: boolean
  onSelect: (id: string) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, x: number, z: number, noSnap: boolean) => void
  onDragEnd: () => void
}) {
  const { controls } = useThree() as unknown as { controls: { enabled: boolean } | null }
  const floor = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  const hit = useRef(new Vector3())
  const drag = useRef<{ dx: number; dz: number } | null>(null)

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!editable) return
    e.stopPropagation()
    onSelect(item.id)
    if (!e.ray.intersectPlane(floor, hit.current)) return
    drag.current = { dx: item.cx - hit.current.x, dz: item.cz - hit.current.z }
    onDragStart(item.id)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
  }
  const onPointerMoveDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    e.stopPropagation()
    if (!e.ray.intersectPlane(floor, hit.current)) return
    onDragMove(item.id, hit.current.x + drag.current.dx, hit.current.z + drag.current.dz, e.nativeEvent.altKey)
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    e.stopPropagation()
    drag.current = null
    onDragEnd()
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    document.body.style.cursor = ''
  }

  return (
    <group
      position={[item.cx, furnitureElevation(item), item.cz]}
      rotation={[0, ((item.rotation ?? 0) * Math.PI) / 180, 0]}
      onPointerDown={editable ? onDown : undefined}
      onPointerMove={editable ? onPointerMoveDrag : undefined}
      onPointerUp={editable ? onUp : undefined}
      onPointerOver={
        editable
          ? (e) => {
              e.stopPropagation()
              if (!drag.current) document.body.style.cursor = 'grab'
            }
          : undefined
      }
      onPointerOut={editable ? () => !drag.current && (document.body.style.cursor = '') : undefined}
    >
      <FurnitureModel kind={item.kind} sx={item.sx} sz={item.sz} sy={furnitureHeight(item)} />
      {selected && editable && <SelectionFootprint sx={item.sx} sz={item.sz} />}
    </group>
  )
}

// All movable furniture. Tables stay tied to the occupancy reading (shown with the
// crowd) unless we're editing; the bar and plants are permanent scenery.
function FurniturePieces({
  items,
  editable,
  showTables,
  selectedId,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  items: FurnitureItem[]
  editable: boolean
  showTables: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, x: number, z: number, noSnap: boolean) => void
  onDragEnd: () => void
}) {
  return (
    <group>
      {items.map((it) =>
        it.kind === 'table' && !showTables ? null : (
          <FurnitureMesh
            key={it.id}
            item={it}
            editable={editable}
            selected={it.id === selectedId}
            onSelect={onSelect}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        ),
      )}
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
  const invalidate = useThree((s) => s.invalidate)

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
    invalidate() // demand mode: the matrices are set after the mount render — redraw once
  }, [invalidate])

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

/** Filesystem-safe slug of a frame code, matching `generate-frames` `docIdFor`. */
const frameCodeSlug = (fid: string): string =>
  fid
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Rank to pick the winning doc when several share a `frameId`: a real page beats a
 * `blank`; a user design (`pared-*` / anything) beats the generator's placeholder.
 * The generator names its frame docs by the bare wall code (e.g. `2-w-2`), so a doc
 * whose id *differs* from its frame code is a deliberate user override and wins the
 * tiebreak — a dark `pared-2-w-2` overrides its blank `2-w-2` twin, and an arted
 * frame overrides everything.
 */
function frameDocRank(d: PrintDoc): number {
  const fid = (d.props as Record<string, unknown> | undefined)?.frameId
  const isCanonical = typeof fid === 'string' && d.id === frameCodeSlug(fid)
  return (d.pageComponentId !== 'blank' ? 2 : 0) + (isCanonical ? 0 : 1)
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
  walls,
  registered,
  findWall,
  fallback,
  showLabels,
  docs,
  realista,
}: {
  walls: Wall[]
  registered: Wall[]
  findWall: (id: string) => Wall | undefined
  fallback: number
  showLabels: boolean
  docs: PrintDoc[]
  realista: boolean
}) {
  const frames = useMemo(
    // The nave side walls (2-E, 11-W) wear ONE full-wall `pared completa` frame
    // instead of the three cámara bays, so the combined print hangs as one graphic.
    () => computeWallFrames({ walls: registered, allWalls: walls, fallbackHeight: fallback, fullFaces: PARED_COMPLETA_FACES }),
    [registered, walls, fallback],
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
        // A panel wider than its wall (a cube outer face cladding the corner returns)
        // is meant to overhang, so allow its centre to sit off the wall centre too.
        const maxOff = Math.abs(wall.length / 2 - pw / 2)
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
        // The frame code still shows over the art while labels are on.
        if (doc && doc.pageComponentId !== 'blank') {
          return (
            <FramePrint key={f.id} doc={doc} pos={pos} rotY={rotY} panelW={pw} panelH={ph} realista={realista} showLabels={showLabels} code={f.id} />
          )
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
            {showLabels && <FrameCodeLabel code={f.id} />}
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
  showLabels,
  code,
}: {
  doc: PrintDoc
  pos: Vec3
  rotY: number
  panelW: number
  panelH: number
  realista: boolean
  showLabels: boolean
  code: string
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
        {showLabels && <FrameCodeLabel code={code} />}
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
      {showLabels && <FrameCodeLabel code={code} />}
    </group>
  )
}

/**
 * FrameCodeLabel — the frame's id (e.g. `9-E-1`) painted as a small chip at the
 * centre of the face. Shared by blank frames and arted ones so the code stays
 * visible over a live print while the Etiquetas overlay is on.
 */
function FrameCodeLabel({ code }: { code: string }) {
  return (
    <Html position={[0, 0, 0.02]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#7c8190',
          fontFamily: UI_FONT,
          background: 'rgba(255,255,255,0.82)',
          padding: '1px 5px',
          borderRadius: 5,
          whiteSpace: 'nowrap',
          boxShadow: '0 0 0 1px rgba(124,129,144,0.25)',
        }}
      >
        {code}
      </div>
    </Html>
  )
}

/* ── realista mode: the print as a true depth-tested mesh texture ────────────── */

/**
 * The print face as a genuine textured plane — depth-tested, so a wall in front of
 * it hides it like real life (no floating <Html>). The texture is the **live page**
 * rasterised to the trim ({@link useLivePrintFaceTexture}), so it tracks edits to the
 * design automatically. Until the first raster lands (or if it fails) it falls back
 * to a plain white plate, which is still correctly occluded. Lit by the room so it
 * reads as a vinyl on the wall.
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
  const tex = useLivePrintFaceTexture(doc, true)

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

/**
 * PlanCamera — a true top-down ORTHOGRAPHIC camera for the «Vista de plano» mode.
 * While enabled it becomes the default camera (drei restores the perspective camera when
 * disabled). It sits straight above the room with up = −Z so the venue's depth runs
 * vertically on screen, and its zoom is sized so the whole floor fits the viewport.
 * Orthographic = no perspective, so walls read as flat footprints — a floor plan, not a
 * 3-D view. OrbitControls (rotation locked while in plan) still handles pan + wheel-zoom.
 */
function PlanCamera({ enabled }: { enabled: boolean }) {
  const ref = useRef<any>(null)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  // drei's ortho frustum spans the viewport in pixels; zoom = pixels per metre. Fit both
  // axes (room width → screen X, depth → screen Y) with a small breathing margin.
  const zoom = Math.min(size.width / SPACE_WIDTH, size.height / SPACE_DEPTH) / 1.08
  useEffect(() => {
    const cam = ref.current
    if (!cam || !enabled) return
    cam.up.set(0, 0, -1)
    cam.position.set(0, 100, 0)
    cam.lookAt(0, 0, 0)
    cam.zoom = zoom
    cam.updateProjectionMatrix()
    invalidate()
  }, [enabled, zoom, invalidate])
  return <OrthographicCamera ref={ref} makeDefault={enabled} position={[0, 100, 0]} up={[0, 0, -1]} zoom={zoom} near={1} far={400} />
}

/**
 * DragGuides — Figma-style overlay drawn on the floor while a piece is dragged: bright
 * alignment lines where an edge/centre lines up with another element (or a room wall),
 * plus a measured gap (ticked segment + label) to the nearest neighbour on each axis.
 * Non-interactive; lives just above the floor so it reads over the grid.
 */
function DragGuides({ session }: { session: DragSession | null }) {
  if (!session) return null
  const y = 0.06
  const COL = '#ff3b6b'
  const tick = 0.18
  return (
    <group>
      {session.aligns.map((g, i) => (
        <Line
          key={`a${i}`}
          points={g.axis === 'x' ? [[g.at, y, g.min], [g.at, y, g.max]] : [[g.min, y, g.at], [g.max, y, g.at]]}
          color={COL}
          lineWidth={1.5}
        />
      ))}
      {session.measures.map((g, i) => {
        const pts: [number, number, number][] = g.axis === 'x' ? [[g.a, y, g.along], [g.b, y, g.along]] : [[g.along, y, g.a], [g.along, y, g.b]]
        const ends: [number, number, number][][] = g.axis === 'x'
          ? [[[g.a, y, g.along - tick], [g.a, y, g.along + tick]], [[g.b, y, g.along - tick], [g.b, y, g.along + tick]]]
          : [[[g.along - tick, y, g.a], [g.along + tick, y, g.a]], [[g.along - tick, y, g.b], [g.along + tick, y, g.b]]]
        const mid: [number, number, number] = g.axis === 'x' ? [(g.a + g.b) / 2, y, g.along] : [g.along, y, (g.a + g.b) / 2]
        return (
          <group key={`m${i}`}>
            <Line points={pts} color={COL} lineWidth={1.5} />
            {ends.map((e, j) => (
              <Line key={j} points={e} color={COL} lineWidth={1.5} />
            ))}
            <Html position={mid} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div style={{ background: COL, color: '#fff', fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                {fmtGap(g.dist)}
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

const GAP_COL = '#e8943a' // amber: edge-to-edge clearances between elements

/**
 * A single dimension graphic on the plan: a measured segment a→b along `axis`
 * (drawn at `along` on the perpendicular axis, at height `y`), capped with end
 * ticks and a centred label pill. Mirrors the look of {@link DragGuides} but is
 * a reusable static cota. The 3-D line is drawn above the walls so the top-down
 * ortho camera never has it occluded by a wall box; the <Html> label always
 * floats on top regardless.
 */
function DimLine({
  axis,
  a,
  b,
  along,
  y,
  color,
  label,
  tick = 0.15,
}: {
  axis: 'x' | 'z'
  a: number
  b: number
  along: number
  y: number
  color: string
  label: string
  tick?: number
}) {
  const pts: [number, number, number][] = axis === 'x' ? [[a, y, along], [b, y, along]] : [[along, y, a], [along, y, b]]
  const ends: [number, number, number][][] = axis === 'x'
    ? [[[a, y, along - tick], [a, y, along + tick]], [[b, y, along - tick], [b, y, along + tick]]]
    : [[[along - tick, y, a], [along + tick, y, a]], [[along - tick, y, b], [along + tick, y, b]]]
  const mid: [number, number, number] = axis === 'x' ? [(a + b) / 2, y, along] : [along, y, (a + b) / 2]
  return (
    <group>
      <Line points={pts} color={color} lineWidth={1.2} />
      {ends.map((e, j) => (
        <Line key={j} points={e} color={color} lineWidth={1.2} />
      ))}
      <Html position={mid} center zIndexRange={[38, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ background: color, color: '#fff', font: '700 10px/1 system-ui, sans-serif', padding: '2px 5px', borderRadius: 4, whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,.35)' }}>
          {label}
        </div>
      </Html>
    </group>
  )
}

/**
 * Edge-to-edge clearances between footprints: for every box, the nearest clear
 * neighbour in each of the four directions (±X, ±Z) that overlaps it on the
 * perpendicular axis — i.e. the gaps that read as corridors/setbacks on a floor
 * plan. Picking only the nearest per direction keeps facing pairs and drops
 * spans that something else already sits between; results are deduped so a pair's
 * two reciprocal gaps collapse to one cota.
 */
function computePlanGaps(boxes: Box[]): MeasureGuide[] {
  const EPS = 1e-3
  const span = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0)
  const out = new Map<string, MeasureGuide>()
  for (let i = 0; i < boxes.length; i++) {
    const m = boxes[i]
    const mL = m.cx - m.sx / 2, mR = m.cx + m.sx / 2, mN = m.cz - m.sz / 2, mF = m.cz + m.sz / 2
    let right: MeasureGuide | null = null
    let left: MeasureGuide | null = null
    let far: MeasureGuide | null = null
    let near: MeasureGuide | null = null
    for (let j = 0; j < boxes.length; j++) {
      if (j === i) continue
      const o = boxes[j]
      const oL = o.cx - o.sx / 2, oR = o.cx + o.sx / 2, oN = o.cz - o.sz / 2, oF = o.cz + o.sz / 2
      // X gap: neighbours that overlap in Z, sitting clear left/right.
      if (span(mN, mF, oN, oF) > EPS) {
        const along = (Math.max(mN, oN) + Math.min(mF, oF)) / 2
        if (oL >= mR - EPS) {
          const dist = oL - mR
          if (dist > EPS && (!right || dist < right.dist)) right = { axis: 'x', along, a: mR, b: oL, dist }
        } else if (oR <= mL + EPS) {
          const dist = mL - oR
          if (dist > EPS && (!left || dist < left.dist)) left = { axis: 'x', along, a: oR, b: mL, dist }
        }
      }
      // Z gap: neighbours that overlap in X, sitting clear near/far.
      if (span(mL, mR, oL, oR) > EPS) {
        const along = (Math.max(mL, oL) + Math.min(mR, oR)) / 2
        if (oN >= mF - EPS) {
          const dist = oN - mF
          if (dist > EPS && (!far || dist < far.dist)) far = { axis: 'z', along, a: mF, b: oN, dist }
        } else if (oF <= mN + EPS) {
          const dist = mN - oF
          if (dist > EPS && (!near || dist < near.dist)) near = { axis: 'z', along, a: oF, b: mN, dist }
        }
      }
    }
    for (const g of [right, left, far, near]) {
      if (!g) continue
      const lo = Math.min(g.a, g.b), hi = Math.max(g.a, g.b)
      const key = `${g.axis}:${lo.toFixed(2)}:${hi.toFixed(2)}:${g.along.toFixed(1)}`
      if (!out.has(key)) out.set(key, g)
    }
  }
  return [...out.values()]
}

/**
 * PlanDimensions — the «vista de plano» cota overlay: the length of every wall
 * (blue, down the wall's centreline) plus the edge-to-edge clearances between
 * elements (amber). Drawn at `y` above the wall tops so nothing is occluded by a
 * wall box in the top-down ortho view. Only mounted while plan mode is on.
 */
function PlanDimensions({ walls, gapBoxes, y }: { walls: Wall[]; gapBoxes: Box[]; y: number }) {
  const gaps = useMemo(() => computePlanGaps(gapBoxes), [gapBoxes])
  return (
    <group>
      {walls.map((w) => {
        const runAxis: 'x' | 'z' = w.normalAxis === 'x' ? 'z' : 'x'
        const along = w.normalAxis === 'x' ? w.cx : w.cz
        const center = runAxis === 'x' ? w.cx : w.cz
        return (
          <DimLine
            key={`len-${w.id}`}
            axis={runAxis}
            a={center - w.length / 2}
            b={center + w.length / 2}
            along={along}
            y={y}
            color={KIT_BLUE}
            label={fmtGap(w.length)}
          />
        )
      })}
      {gaps.map((g, i) => (
        <DimLine key={`gap-${i}`} axis={g.axis} a={g.a} b={g.b} along={g.along} y={y} color={GAP_COL} label={fmtGap(g.dist)} tick={0.12} />
      ))}
    </group>
  )
}

function CameraRig({ apiRef, planMode }: { apiRef: React.MutableRefObject<{ setView: (pos: Vec3, target: Vec3) => void } | null>; planMode: boolean }) {
  const { camera, controls, invalidate } = useThree() as unknown as {
    camera: any
    controls: any
    invalidate: () => void
  }
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
        invalidate() // demand mode: render the new framing now
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, camera, controls, invalidate])

  useEffect(() => {
    const isText = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
    const dn = (e: KeyboardEvent) => {
      if (isText(e.target)) return
      keys.current[e.key.toLowerCase()] = true
      invalidate() // demand mode: kick off the fly loop (useFrame only runs on rendered frames)
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
  }, [invalidate])

  useFrame((_, dt) => {
    const c = controls
    if (!c || planMode) return // no WASD fly in the locked top-down plan view
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
    // demand mode: while any fly key is held, request the next frame so the loop
    // sustains itself (and stops the instant all keys are released).
    if (k['w'] || k['s'] || k['a'] || k['d'] || k['r'] || k['f']) invalidate()
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
  editFurniture,
  onToggleEditFurniture,
  armed,
  setArmed,
  selectedFurn,
  updateSelectedFurn,
  removeSelectedFurn,
  furnitureCount,
  furnitureClipboardKind,
  onCopyFurn,
  onPasteFurn,
  onDuplicateFurn,
  selectedWall,
  updateSelectedWall,
  rotateSelectedWall,
  removeSelectedWall,
  wallCount,
  furnitureDirty,
  savingFurniture,
  onSaveFurniture,
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
  onPlan,
  planMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
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
  editFurniture: boolean
  onToggleEditFurniture: () => void
  armed: SpaceTool | null
  setArmed: (k: SpaceTool | null) => void
  selectedFurn: FurnitureItem | null
  updateSelectedFurn: (patch: Partial<FurnitureItem>) => void
  removeSelectedFurn: () => void
  furnitureCount: number
  furnitureClipboardKind: FurnitureKind | null
  onCopyFurn: () => void
  onPasteFurn: () => void
  onDuplicateFurn: () => void
  selectedWall: EditableWall | null
  updateSelectedWall: (patch: Partial<EditableWall>) => void
  rotateSelectedWall: () => void
  removeSelectedWall: () => void
  wallCount: number
  furnitureDirty: boolean
  savingFurniture: boolean
  onSaveFurniture: () => void
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
  onPlan: () => void
  planMode: boolean
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
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
        <button onClick={onPlan} title="Vista de plano: cámara cenital recta sobre el recinto (se lee como un plano de planta). Rotación bloqueada; arrastra para mover y rueda para acercar." style={{ ...glassBtn, pointerEvents: 'auto', color: planMode ? KIT_BLUE : '#c9cdd6' }}>Vista de plano</button>
        <button onClick={() => setShowPeople((p) => !p)} title="Muestra/oculta la simulación de uso: personas, mesas y punto de spawn. Oculto por defecto." style={{ ...glassBtn, pointerEvents: 'auto', color: showPeople ? KIT_BLUE : '#c9cdd6' }}>
          👥 Personas {showPeople ? 'on' : 'off'}
        </button>
        <button onClick={onToggleEditFurniture} title="Editar espacio: mover, añadir, girar y quitar mobiliario (mesas, barra, plantas) y paredes. Al activarlo se muestran y se pueden arrastrar todas las piezas. Al mover, las piezas hacen snap a las demás y muestran las distancias (mantén Alt para mover libre)." style={{ ...glassBtn, pointerEvents: 'auto', color: editFurniture ? KIT_BLUE : '#c9cdd6' }}>
          ✏️ Editar espacio {editFurniture ? 'on' : 'off'}{editFurniture && furnitureDirty ? ' •' : ''}
        </button>
        <button onClick={onUndo} disabled={!canUndo} title="Deshacer (Ctrl/Cmd+Z)" style={{ ...glassBtn, pointerEvents: 'auto', opacity: canUndo ? 1 : 0.4 }}>↶</button>
        <button onClick={onRedo} disabled={!canRedo} title="Rehacer (Ctrl/Cmd+Shift+Z)" style={{ ...glassBtn, pointerEvents: 'auto', opacity: canRedo ? 1 : 0.4 }}>↷</button>
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
        {editFurniture && (
          <SpaceEditPanel
            armed={armed}
            setArmed={setArmed}
            selectedFurn={selectedFurn}
            updateSelectedFurn={updateSelectedFurn}
            removeSelectedFurn={removeSelectedFurn}
            furnitureCount={furnitureCount}
            clipboardKind={furnitureClipboardKind}
            onCopy={onCopyFurn}
            onPaste={onPasteFurn}
            onDuplicate={onDuplicateFurn}
            selectedWall={selectedWall}
            updateSelectedWall={updateSelectedWall}
            rotateSelectedWall={rotateSelectedWall}
            removeSelectedWall={removeSelectedWall}
            wallCount={wallCount}
            dirty={furnitureDirty}
            saving={savingFurniture}
            onSave={onSaveFurniture}
          />
        )}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a7adba', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Mover (X · Y · Z)</span>
                  {selected.offset && (selected.offset.x || selected.offset.y || selected.offset.z) ? (
                    <button onClick={() => updateSelected({ offset: undefined })} style={{ ...glassBtn, padding: '2px 8px', fontSize: 10 }}>
                      reset
                    </button>
                  ) : null}
                </div>
                <Slider label="X (lateral)" value={selected.offset?.x ?? 0} display={`${(selected.offset?.x ?? 0).toFixed(2)} m`} min={-5} max={5} step={0.01} onChange={(v) => updateSelected({ offset: { x: v, y: selected.offset?.y ?? 0, z: selected.offset?.z ?? 0 } })} />
                <Slider label="Y (altura)" value={selected.offset?.y ?? 0} display={`${(selected.offset?.y ?? 0).toFixed(2)} m`} min={-5} max={5} step={0.01} onChange={(v) => updateSelected({ offset: { x: selected.offset?.x ?? 0, y: v, z: selected.offset?.z ?? 0 } })} />
                <Slider label="Z (fondo)" value={selected.offset?.z ?? 0} display={`${(selected.offset?.z ?? 0).toFixed(2)} m`} min={-5} max={5} step={0.01} onChange={(v) => updateSelected({ offset: { x: selected.offset?.x ?? 0, y: selected.offset?.y ?? 0, z: v } })} />
                <div style={{ fontSize: 10, color: '#7c8190', lineHeight: 1.4 }}>
                  Desplaza la pieza libremente en los tres ejes del espacio, incluso despegándola de la pared (Z = fondo).
                </div>
              </div>
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

          <Slider label="Altura de paredes" value={fallbackHeight} display={`${fallbackHeight.toFixed(1)} m`} min={2.2} max={5} step={0.1} onChange={setFallbackHeight} />
          <div style={{ fontSize: 10, color: '#7c8190', lineHeight: 1.4 }}>
            Altura única para <b>todas</b> las paredes. Al guardar se escribe como <code>alturaM</code> en cada una.
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
          Orbitar: arrastrar · zoom: rueda · caminar: WASD · subir/bajar: R/F · borrar selección: Supr/⌫ · editar espacio: modo ✏️ + arrastrar · copiar/pegar mueble: ⌘/Ctrl+C/V · duplicar: ⌘/Ctrl+D
        </div>
      </div>
    </>
  )
}

/* ── space editor panel (furniture + walls; shown in the left column while editing) ── */

const FURNITURE_ICON: Record<FurnitureKind, string> = { table: '🪑', bar: '🍸', plant: '🪴' }
const TOOL_ICON: Record<SpaceTool, string> = { table: '🪑', bar: '🍸', plant: '🪴', wall: '🧱' }
const TOOL_LABEL: Record<SpaceTool, string> = { table: 'Mesa', bar: 'Barra', plant: 'Planta', wall: 'Pared' }
const SPACE_TOOLS: readonly SpaceTool[] = ['table', 'bar', 'plant', 'wall']
const WALL_MAX_SIZE = Math.max(SPACE_WIDTH, SPACE_DEPTH)

function SpaceEditPanel({
  armed,
  setArmed,
  selectedFurn,
  updateSelectedFurn,
  removeSelectedFurn,
  furnitureCount,
  clipboardKind,
  onCopy,
  onPaste,
  onDuplicate,
  selectedWall,
  updateSelectedWall,
  rotateSelectedWall,
  removeSelectedWall,
  wallCount,
  dirty,
  saving,
  onSave,
}: {
  armed: SpaceTool | null
  setArmed: (k: SpaceTool | null) => void
  selectedFurn: FurnitureItem | null
  updateSelectedFurn: (patch: Partial<FurnitureItem>) => void
  removeSelectedFurn: () => void
  furnitureCount: number
  clipboardKind: FurnitureKind | null
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  selectedWall: EditableWall | null
  updateSelectedWall: (patch: Partial<EditableWall>) => void
  rotateSelectedWall: () => void
  removeSelectedWall: () => void
  wallCount: number
  dirty: boolean
  saving: boolean
  onSave: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: KIT_BLUE }}>✏️ Editar espacio</div>

      <div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a7adba', marginBottom: 6 }}>Añadir</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SPACE_TOOLS.map((k) => {
            const on = armed === k
            return (
              <button
                key={k}
                onClick={() => setArmed(on ? null : k)}
                style={{ ...glassBtn, flex: '1 0 42%', textAlign: 'center', color: on ? KIT_BLUE : '#c9cdd6', borderColor: on ? 'rgba(0,112,249,0.5)' : 'rgba(255,255,255,0.12)' }}
              >
                {TOOL_ICON[k]} {TOOL_LABEL[k]}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 10, color: '#7c8190', lineHeight: 1.45, marginTop: 6 }}>
          {armed
            ? `Haz click en el suelo para colocar ${armed === 'wall' ? 'una pared' : `una ${TOOL_LABEL[armed].toLowerCase()}`}.`
            : 'Elige un tipo y click en el suelo. Click en una pieza/pared para editarla; arrástrala para moverla.'}
        </div>
        {clipboardKind && (
          <button
            onClick={onPaste}
            title="Pegar una copia del último mueble copiado (⌘/Ctrl+V)"
            style={{ ...glassBtn, width: '100%', marginTop: 8, color: KIT_BLUE, borderColor: 'rgba(0,112,249,0.5)' }}
          >
            📋 Pegar {FURNITURE_LABEL[clipboardKind]}
          </button>
        )}
      </div>

      {selectedWall ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>
            🧱 Pared · {selectedWall.id}
            {selectedWall.registry ? ` · #${selectedWall.registry.invId}` : ''}
          </div>
          <Slider label="Tamaño X" value={selectedWall.sx} display={`${selectedWall.sx.toFixed(2)} m`} min={0.1} max={WALL_MAX_SIZE} step={0.1} onChange={(v) => updateSelectedWall({ sx: v })} />
          <Slider label="Tamaño Z" value={selectedWall.sz} display={`${selectedWall.sz.toFixed(2)} m`} min={0.1} max={WALL_MAX_SIZE} step={0.1} onChange={(v) => updateSelectedWall({ sz: v })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={rotateSelectedWall} style={{ ...glassBtn, flex: 1 }}>⟳ Girar 90°</button>
            <button onClick={removeSelectedWall} style={{ ...glassBtn, flex: 1, color: '#ff6b7d', borderColor: 'rgba(255,107,125,0.4)' }}>🗑 Quitar</button>
          </div>
          <div style={{ fontSize: 10, color: '#7c8190', lineHeight: 1.4 }}>
            La altura es global para todas las paredes (control «Altura de paredes» más abajo).
          </div>
        </div>
      ) : selectedFurn ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>
            {FURNITURE_ICON[selectedFurn.kind]} {FURNITURE_LABEL[selectedFurn.kind]} · {selectedFurn.id}
          </div>
          <Slider label="Ancho (X)" value={selectedFurn.sx} display={`${selectedFurn.sx.toFixed(1)} m`} min={FURNITURE_MIN_SIZE} max={FURNITURE_MAX_SIZE} step={0.1} onChange={(v) => updateSelectedFurn({ sx: v })} />
          <Slider label="Fondo (Z)" value={selectedFurn.sz} display={`${selectedFurn.sz.toFixed(1)} m`} min={FURNITURE_MIN_SIZE} max={FURNITURE_MAX_SIZE} step={0.1} onChange={(v) => updateSelectedFurn({ sz: v })} />
          <Slider label="Alto del objeto (Y)" value={furnitureHeight(selectedFurn)} display={`${furnitureHeight(selectedFurn).toFixed(2)} m`} min={FURNITURE_MIN_HEIGHT} max={FURNITURE_MAX_HEIGHT} step={0.05} onChange={(v) => updateSelectedFurn({ sy: v })} />
          <Slider label="Separación del suelo" value={furnitureElevation(selectedFurn)} display={`${furnitureElevation(selectedFurn).toFixed(2)} m`} min={FURNITURE_MIN_ELEVATION} max={FURNITURE_MAX_ELEVATION} step={0.05} onChange={(v) => updateSelectedFurn({ elevation: v })} />
          <Slider label="Rotación" value={selectedFurn.rotation ?? 0} display={`${Math.round(selectedFurn.rotation ?? 0)}°`} min={0} max={360} step={5} onChange={(v) => updateSelectedFurn({ rotation: v })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDuplicate} title="Duplicar esta pieza en el sitio (⌘/Ctrl+D)" style={{ ...glassBtn, flex: 1 }}>⧉ Duplicar</button>
            <button onClick={onCopy} title="Copiar esta pieza al portapapeles (⌘/Ctrl+C)" style={{ ...glassBtn, flex: 1 }}>⎘ Copiar</button>
          </div>
          <button onClick={removeSelectedFurn} style={{ ...glassBtn, color: '#ff6b7d', borderColor: 'rgba(255,107,125,0.4)' }}>
            🗑 Quitar pieza
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 10.5, color: '#7c8190', lineHeight: 1.5 }}>
          {furnitureCount} mueble(s) · {wallCount} pared(es). Selecciona una pieza o pared para editarla.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: saving ? '#ffce6b' : dirty ? '#ffce6b' : '#7fcaa0',
          }}
        >
          {saving ? '💾 Guardando…' : dirty ? '• Guardando cambios…' : '✓ Guardado en event-layout.json'}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onSave}
          disabled={saving}
          title="Se guarda solo al editar. Pulsa para forzar la escritura de event-layout.json ahora."
          style={{ ...glassBtn, fontSize: 11, padding: '5px 9px', opacity: saving ? 0.55 : 1 }}
        >
          Guardar ya
        </button>
      </div>
      <div style={{ fontSize: 10, color: '#7c8190', lineHeight: 1.4 }}>
        Mover, redimensionar, girar y quitar (mobiliario y paredes) se guardan solos en <code>event-layout.json</code>.
      </div>
    </div>
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
