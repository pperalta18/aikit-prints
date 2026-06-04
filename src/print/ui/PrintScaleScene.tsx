import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ContactShadows,
  Environment,
  Grid,
  Html,
  Lightformer,
  OrbitControls,
  useFBX,
  useTexture,
} from '@react-three/drei'
import {
  Box3,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Object3D,
} from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { KIT_BLUE } from '@/lib/neumorphism'
import { buildGeometry } from '../geometry'
import { getPrintPage } from '../pages'
import { PrintStage } from '../PrintRenderer'
import type { PrintDoc } from '../types'

/**
 * PrintScaleScene — a real-world 3D scale view of a print.
 * ────────────────────────────────────────────────────────
 * Puts the print, at its TRUE physical size (mm → metres), in a studio next to a
 * rigged human (Renderpeople "Claudia", ~1.68 m) so you can *feel* how big the
 * piece is. Launched from the print detail topbar. Three controls, as requested:
 *
 *   · «Distancia a la persona» — slides the human nearer / further from the print.
 *   · Free movement in the room — orbit + pan + zoom, plus WASD/RF to fly around.
 *   · «Vista de la persona»     — jumps the camera to her eyes, looking at the print,
 *                                 so you see the piece exactly as she would.
 *
 * The print face is the live React page (full fidelity) painted onto the slab via
 * drei <Html transform occlude>, so the human correctly occludes it when she stands
 * between camera and print. Reuses the same PrintStage/geometry as the 2D preview.
 */

const HUMAN_H = 1.68 // metres — Claudia's real standing height
const HUMAN_URL = '/models/claudia/claudia.fbx'
const DIF_URL = '/models/claudia/tex/claudia_dif.jpg'
const NORM_URL = '/models/claudia/tex/claudia_norm.jpg'

/** drei's <Html transform> maps worldWidth = contentPx * scale / 40 (see Phone3D). */
const HTML_TRANSFORM_FACTOR = 40
/** Long-edge px the print DOM is painted at (capped at native trim res). High so the
 *  artwork stays sharp even when it fills the viewport up close / in eye-view. Very
 *  large pieces (wall murals) still soften at unrealistically close range — you view
 *  those from metres away — but normal sizes stay crisp. */
const FACE_LONG_PX = 4096
/** Paper/board thickness of the slab, in metres. */
const SLAB_DEPTH = 0.006
/** mm → metres (world units are metres). */
const M = (mm: number) => mm / 1000

const UI_FONT = 'system-ui, -apple-system, sans-serif'

type Vec3 = [number, number, number]

export function PrintScaleScene({ doc }: { doc: PrintDoc }) {
  // Print physical size + where it hangs by default. Small/medium pieces hang at
  // gallery height (centre ≈ 1.45 m); tall pieces (banners) rest near the floor.
  const pw = M(doc.dimensions.trimWidthMm)
  const ph = M(doc.dimensions.trimHeightMm)
  const defaultCenterY = ph > 1.0 ? ph / 2 + 0.03 : 1.45
  const defaultFloorGap = Math.max(0, defaultCenterY - ph / 2) // bottom edge → floor

  const [distance, setDistance] = useState(1.5) // metres between print and person
  const [eyeMode, setEyeMode] = useState(false)
  const [printX, setPrintX] = useState(0) // horizontal slide of the print (m)
  const [floorGap, setFloorGap] = useState(defaultFloorGap) // bottom-edge height (m)

  // Live placement = user height/x layered over the default footprint.
  const centerY = floorGap + ph / 2
  const printCenter: Vec3 = [printX, centerY, 0]

  const resetScene = useCallback(() => {
    setDistance(1.5)
    setEyeMode(false)
    setPrintX(0)
    setFloorGap(defaultFloorGap)
  }, [defaultFloorGap])

  // Initial camera framing. The print (z=0) and the person (z=distance) sit on a
  // depth axis; we view it from a raised side-on 3/4 so both read at a comparable
  // apparent size (a fair scale comparison, not foreshortened down the axis), and
  // fit the whole tableau via its bounding sphere. distance only seeds the *initial*
  // frame — live camera moves are user-driven.
  const { camPos, target } = useMemo(() => {
    const sceneTop = Math.max(centerY + ph / 2, HUMAN_H)
    const halfW = Math.max(pw / 2, 0.9) // include her ~A-pose arm span
    const minZ = Math.min(0, distance) - 0.35
    const maxZ = Math.max(0, distance) + 0.35
    const cz = (minZ + maxZ) / 2
    const radius = 0.5 * Math.hypot(2 * halfW, sceneTop, maxZ - minZ)
    const fov = 38
    const R = (radius / Math.sin(MathUtils.degToRad(fov) / 2)) * 1.04
    const dir = new Vector3(0.92, 0.42, 0.62).normalize()
    const tgt: Vec3 = [0, sceneTop * 0.46, cz]
    return { camPos: [tgt[0] + dir.x * R, tgt[1] + dir.y * R, tgt[2] + dir.z * R] as Vec3, target: tgt }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const humanGroupRef = useRef<Object3D | null>(null)
  const headBoneRef = useRef<Object3D | null>(null)
  const controlsRef = useRef<any>(null)
  const setHeadBone = useCallback((b: Object3D | null) => {
    headBoneRef.current = b
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#1b1e25 0%,#101218 100%)' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: camPos, fov: 38, near: 0.03, far: 400 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#15171d']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[-5, 8, 6]} intensity={1.5} />
        <directionalLight position={[6, 3, 4]} intensity={0.45} color="#bcd2ff" />
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 5, -6]} scale={[12, 12, 1]} />
          <Lightformer intensity={1.1} position={[-6, 3, 4]} scale={[5, 12, 1]} />
          <Lightformer intensity={0.9} position={[6, 1, 4]} scale={[5, 12, 1]} color="#cfe0ff" />
        </Environment>

        <Suspense
          fallback={
            // Bound the loading overlay's z-index (drei defaults to ~16.7M) so it
            // can never paint over the HUD while assets load.
            <Html center zIndexRange={[30, 0]} style={{ color: '#9aa0ac', fontFamily: UI_FONT, fontSize: 14, whiteSpace: 'nowrap' }}>
              Cargando escena…
            </Html>
          }
        >
          <PrintSlab doc={doc} pw={pw} ph={ph} center={printCenter} />
          <group ref={humanGroupRef as never} position={[0, 0, distance]} rotation={[0, Math.PI, 0]}>
            <Human onHeadBone={setHeadBone} />
          </group>

          <DimensionLabels pw={pw} ph={ph} center={printCenter} doc={doc} distance={distance} />
        </Suspense>

        {/* Studio floor — 0.5 m cells, 1 m section lines = a built-in scale ruler. */}
        <Grid
          position={[0, 0, 0]}
          infiniteGrid
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#3a3f4b"
          sectionSize={1}
          sectionThickness={1.1}
          sectionColor="#5b6275"
          fadeDistance={34}
          fadeStrength={1.4}
        />
        <ContactShadows position={[0, 0.002, 0]} opacity={0.42} scale={14} blur={2.4} far={6} resolution={1024} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!eyeMode}
          enablePan
          enableZoom
          minDistance={0.25}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2 - 0.02}
          target={target}
        />
        <CameraRig
          eyeMode={eyeMode}
          headBoneRef={headBoneRef}
          humanGroupRef={humanGroupRef}
          printCenter={printCenter}
          controlsRef={controlsRef}
          initialTarget={target}
        />
      </Canvas>

      <SceneHud
        doc={doc}
        distance={distance}
        setDistance={setDistance}
        eyeMode={eyeMode}
        setEyeMode={setEyeMode}
        printX={printX}
        setPrintX={setPrintX}
        floorGap={floorGap}
        setFloorGap={setFloorGap}
        defaultFloorGap={defaultFloorGap}
        onReset={resetScene}
      />
    </div>
  )
}

/* ── the print as a true-scale slab with the live page painted on its face ───── */

function PrintSlab({ doc, pw, ph, center }: { doc: PrintDoc; pw: number; ph: number; center: Vec3 }) {
  const geo = useMemo(() => buildGeometry(doc.dimensions, doc.dpi), [doc])
  const page = getPrintPage(doc.pageComponentId)

  // The live page renders at full media px; clip to the trim, scale that to a
  // high-resolution content rectangle (long edge = FACE_LONG_PX, capped at native
  // trim res so the artwork is never upscaled), then map it onto the slab front.
  const longTrimPx = Math.max(geo.trimWidthPx, geo.trimHeightPx)
  const longPx = Math.min(FACE_LONG_PX, Math.round(longTrimPx))
  const landscape = pw >= ph
  const faceW = landscape ? longPx : Math.round(longPx * (pw / ph))
  const faceH = landscape ? Math.round(longPx * (ph / pw)) : longPx
  const trimScale = faceW / geo.trimWidthPx
  const htmlScale = (pw * HTML_TRANSFORM_FACTOR) / faceW
  const frontZ = SLAB_DEPTH / 2 + 0.0015

  return (
    <group>
      <mesh position={center} castShadow receiveShadow>
        <boxGeometry args={[pw, ph, SLAB_DEPTH]} />
        <meshStandardMaterial color="#f4f2ec" roughness={0.85} metalness={0} />
      </mesh>

      <Html
        transform
        occlude="blending"
        position={[center[0], center[1], center[2] + frontZ]}
        scale={htmlScale}
        zIndexRange={[20, 0]}
        pointerEvents="none"
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ width: faceW, height: faceH, overflow: 'hidden', background: '#fff', position: 'relative' }}>
          <div
            style={{
              width: geo.trimWidthPx,
              height: geo.trimHeightPx,
              transform: `scale(${trimScale})`,
              transformOrigin: 'top left',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', left: -geo.bleedPx, top: -geo.bleedPx }}>
              <PrintStage doc={doc}>{page ? page({ doc, geo }) : null}</PrintStage>
            </div>
          </div>
        </div>
      </Html>
    </group>
  )
}

/**
 * Rotate `bone` (in its parent's space) so the segment bone→child points along the
 * world-space `target` direction. Used to pull the arms down from the bind pose.
 */
function aimSegment(bone?: Object3D, child?: Object3D, target?: Vector3) {
  if (!bone || !child || !target) return
  bone.updateWorldMatrix(true, false)
  const u = bone.getWorldPosition(new Vector3())
  const c = child.getWorldPosition(new Vector3())
  const current = c.sub(u).normalize()
  if (current.lengthSq() < 1e-8) return
  const delta = new Quaternion().setFromUnitVectors(current, target.clone().normalize())
  const newWorld = delta.multiply(bone.getWorldQuaternion(new Quaternion()))
  const parentWorld = bone.parent ? bone.parent.getWorldQuaternion(new Quaternion()) : new Quaternion()
  bone.quaternion.copy(parentWorld.invert().multiply(newWorld))
  bone.updateMatrixWorld(true)
}

/* ── the human (rigged FBX, normalised to a real height) ─────────────────────── */

function Human({ onHeadBone }: { onHeadBone: (bone: Object3D | null) => void }) {
  const fbx = useFBX(HUMAN_URL)
  const [dif, norm] = useTexture([DIF_URL, NORM_URL])

  const { model, headBone } = useMemo(() => {
    const m = SkeletonUtils.clone(fbx)

    dif.colorSpace = SRGBColorSpace
    dif.flipY = true
    norm.flipY = true
    dif.needsUpdate = true
    norm.needsUpdate = true

    // Normalise to a real standing height, then plant feet at y=0, centred in x/z.
    m.updateMatrixWorld(true)
    let box = new Box3().setFromObject(m)
    const size = box.getSize(new Vector3())
    m.scale.setScalar(HUMAN_H / size.y)
    m.updateMatrixWorld(true)
    box = new Box3().setFromObject(m)
    const c = box.getCenter(new Vector3())
    m.position.x -= c.x
    m.position.z -= c.z
    m.position.y -= box.min.y
    m.updateMatrixWorld(true)

    let head: Object3D | null = null
    const bones: Record<string, Object3D> = {}
    m.traverse((o) => {
      if ((o as { isBone?: boolean }).isBone) {
        bones[o.name.toLowerCase()] = o
        // Rig is UE-style: the eye-height bone is exactly "head" (vs the "head_end" crown tip).
        if (/^head$/i.test(o.name)) head = o
      }
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.material = new MeshStandardMaterial({ map: dif, normalMap: norm, roughness: 0.72, metalness: 0 })
    })

    // The FBX bind pose is a wide A/T-pose ("scarecrow"). Relax both arms down to
    // the sides for a natural standing reference. We aim each upper-arm segment at
    // a downward target in world space — robust to the rig's local axis convention.
    aimSegment(bones['upperarm_l'], bones['lowerarm_l'], new Vector3(0.16, -1, -0.1))
    aimSegment(bones['upperarm_r'], bones['lowerarm_r'], new Vector3(-0.16, -1, -0.1))
    m.updateMatrixWorld(true)

    return { model: m, headBone: head }
  }, [fbx, dif, norm])

  useEffect(() => {
    onHeadBone(headBone)
    return () => onHeadBone(null)
  }, [headBone, onHeadBone])

  return <primitive object={model} />
}

/* ── camera: orbit/fly in free mode, snap to her eyes in person mode ─────────── */

function CameraRig({
  eyeMode,
  headBoneRef,
  humanGroupRef,
  printCenter,
  controlsRef,
  initialTarget,
}: {
  eyeMode: boolean
  headBoneRef: React.MutableRefObject<Object3D | null>
  humanGroupRef: React.MutableRefObject<Object3D | null>
  printCenter: Vec3
  controlsRef: React.MutableRefObject<any>
  initialTarget: Vec3
}) {
  const { camera, gl } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const saved = useRef<{ pos: Vector3; target: Vector3 } | null>(null)
  const wasEye = useRef(false)
  const tmp = useRef({ a: new Vector3(), b: new Vector3(), c: new Vector3() })
  // First-person look in eye mode: drag to swing yaw/pitch around the fixed eye.
  const eyeRef = useRef(eyeMode)
  eyeRef.current = eyeMode
  const look = useRef({ yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0, init: false })

  // Seed the orbit target once the controls exist.
  useEffect(() => {
    const c = controlsRef.current
    if (c) {
      c.target.set(initialTarget[0], initialTarget[1], initialTarget[2])
      c.update()
    }
  }, [controlsRef, initialTarget])

  useEffect(() => {
    const isText = (t: EventTarget | null) =>
      t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
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

  // Drag-to-look while in eye view: rotate the gaze around the fixed eye position.
  // Only active in eye mode (free mode is handled by OrbitControls on the same canvas).
  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      if (!eyeRef.current) return
      look.current.dragging = true
      look.current.lastX = e.clientX
      look.current.lastY = e.clientY
      el.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      if (!eyeRef.current || !look.current.dragging) return
      const S = 0.0026 // rad per pixel
      look.current.yaw -= (e.clientX - look.current.lastX) * S // grab-the-scene feel
      look.current.pitch = Math.max(-1.45, Math.min(1.45, look.current.pitch + (e.clientY - look.current.lastY) * S))
      look.current.lastX = e.clientX
      look.current.lastY = e.clientY
    }
    const up = () => {
      look.current.dragging = false
      if (eyeRef.current) el.style.cursor = 'grab'
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [gl])

  // Cursor affordance: a grab cursor over the canvas while in eye view.
  useEffect(() => {
    gl.domElement.style.cursor = eyeMode ? 'grab' : ''
    return () => {
      gl.domElement.style.cursor = ''
    }
  }, [eyeMode, gl])

  useFrame((_, dt) => {
    const controls = controlsRef.current
    const { a, b, c } = tmp.current

    if (eyeMode) {
      if (!wasEye.current) {
        if (controls) saved.current = { pos: camera.position.clone(), target: controls.target.clone() }
        wasEye.current = true
        look.current.init = false // re-aim at the print on (re)entering eye view
      }
      const eye = a
      const head = headBoneRef.current
      if (head) head.getWorldPosition(eye)
      else if (humanGroupRef.current) {
        humanGroupRef.current.getWorldPosition(eye)
        eye.y += HUMAN_H - 0.1
      } else return
      // Nudge from the head bone to roughly the eyes: a touch toward the print, a hair down.
      const toPrint = b.set(printCenter[0] - eye.x, 0, printCenter[2] - eye.z).normalize()
      eye.addScaledVector(toPrint, 0.1)
      eye.y -= 0.05
      camera.position.copy(eye)
      // Initial gaze aims at the print centre; drag then rotates yaw/pitch freely.
      if (!look.current.init) {
        const dx = printCenter[0] - eye.x
        const dy = printCenter[1] - eye.y
        const dz = printCenter[2] - eye.z
        look.current.yaw = Math.atan2(dx, -dz)
        look.current.pitch = Math.atan2(dy, Math.hypot(dx, dz))
        look.current.init = true
      }
      const { yaw, pitch } = look.current
      const cp = Math.cos(pitch)
      c.set(eye.x + Math.sin(yaw) * cp, eye.y + Math.sin(pitch), eye.z - Math.cos(yaw) * cp)
      camera.lookAt(c)
      return
    }

    if (wasEye.current) {
      if (saved.current && controls) {
        camera.position.copy(saved.current.pos)
        controls.target.copy(saved.current.target)
        controls.update()
      }
      wasEye.current = false
    }

    if (!controls) return
    // WASD to walk, R/F to rise/drop — moves camera + target together (a fly).
    const k = keys.current
    const move = a.set(0, 0, 0)
    const forward = b.copy(controls.target).sub(camera.position)
    forward.y = 0
    if (forward.lengthSq() > 1e-6) forward.normalize()
    const right = c.crossVectors(forward, camera.up).normalize()
    if (k['w']) move.add(forward)
    if (k['s']) move.sub(forward)
    if (k['d']) move.add(right)
    if (k['a']) move.sub(right)
    if (k['r']) move.y += 1
    if (k['f']) move.y -= 1
    if (move.lengthSq() > 1e-6) {
      move.normalize().multiplyScalar(2.4 * dt)
      camera.position.add(move)
      controls.target.add(move)
      controls.update()
    }
  })

  return null
}

/* ── floating dimension chips (print W×H + person height) ────────────────────── */

function DimensionLabels({
  pw,
  ph,
  center,
  doc,
  distance,
}: {
  pw: number
  ph: number
  center: Vec3
  doc: PrintDoc
  distance: number
}) {
  const fmtMm = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))
  const w = doc.dimensions.trimWidthMm
  const h = doc.dimensions.trimHeightMm
  return (
    <>
      {/* width — under the print */}
      <Html position={[center[0], center[1] - ph / 2 - 0.06, center[2]]} center zIndexRange={[15, 0]} pointerEvents="none">
        <Chip>{fmtMm(w)} mm</Chip>
      </Html>
      {/* height — to the right of the print */}
      <Html position={[center[0] + pw / 2 + 0.06, center[1], center[2]]} center zIndexRange={[15, 0]} pointerEvents="none">
        <Chip>{fmtMm(h)} mm</Chip>
      </Html>
      {/* person height */}
      <Html position={[0.34, HUMAN_H + 0.08, distance]} center zIndexRange={[15, 0]} pointerEvents="none">
        <Chip muted>1,68 m</Chip>
      </Html>
    </>
  )
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      style={{
        padding: '3px 8px',
        borderRadius: 7,
        background: muted ? 'rgba(20,22,28,0.7)' : KIT_BLUE,
        color: '#fff',
        fontFamily: UI_FONT,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        border: muted ? '1px solid rgba(255,255,255,0.15)' : 'none',
      }}
    >
      {children}
    </div>
  )
}

/* ── HUD: print placement controls, eye-view toggle, hints ───────────────────── */

function SceneHud({
  doc,
  distance,
  setDistance,
  eyeMode,
  setEyeMode,
  printX,
  setPrintX,
  floorGap,
  setFloorGap,
  defaultFloorGap,
  onReset,
}: {
  doc: PrintDoc
  distance: number
  setDistance: (n: number) => void
  eyeMode: boolean
  setEyeMode: (f: boolean | ((p: boolean) => boolean)) => void
  printX: number
  setPrintX: (n: number) => void
  floorGap: number
  setFloorGap: (n: number) => void
  defaultFloorGap: number
  onReset: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const trim = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Mostrar controles"
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
          background: 'rgba(18,20,26,0.82)',
          backdropFilter: 'blur(8px)',
          color: '#e8e8f0',
          fontFamily: UI_FONT,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        ⚙ Controles
      </button>
    )
  }

  const iconBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.05)',
    color: '#c9cdd6',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: UI_FONT,
    lineHeight: 1,
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        width: 270,
        maxHeight: 'calc(100% - 32px)',
        overflowY: 'auto',
        // Above every drei <Html> in the scene: print face ≤9, dimension chips ≤15,
        // loading overlay ≤30 (all bounded via zIndexRange). The print can never cover this.
        zIndex: 1000,
        background: 'rgba(18,20,26,0.82)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding: 16,
        color: '#e8e8f0',
        fontFamily: UI_FONT,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Escala real</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onReset} title="Restablecer valores" style={iconBtn}>
            ↺
          </button>
          <button onClick={() => setCollapsed(true)} title="Colapsar menú" style={iconBtn}>
            ⌄
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#a7adba', lineHeight: 1.4 }}>
        {trim(doc.dimensions.trimWidthMm)} × {trim(doc.dimensions.trimHeightMm)} mm a tamaño real, junto a una persona de 1,68 m.
      </div>

      <Slider
        label="Distancia a la persona"
        value={distance}
        display={`${distance.toFixed(1)} m`}
        min={0.4}
        max={8}
        step={0.1}
        onChange={setDistance}
        presets={[1, 2, 3, 5].map((d) => ({ label: `${d} m`, v: d }))}
      />

      <Slider
        label="Altura desde el suelo"
        value={floorGap}
        display={`${floorGap.toFixed(2)} m`}
        min={0}
        max={3}
        step={0.05}
        onChange={setFloorGap}
        presets={[
          { label: 'Suelo', v: 0 },
          { label: 'Mesa', v: 0.74 },
          { label: 'Defecto', v: Number(defaultFloorGap.toFixed(2)) },
        ]}
      />

      <Slider
        label="Posición horizontal"
        value={printX}
        display={`${printX >= 0 ? '+' : ''}${printX.toFixed(1)} m`}
        min={-4}
        max={4}
        step={0.1}
        onChange={setPrintX}
        presets={[{ label: 'Centro', v: 0 }]}
      />

      <button
        onClick={() => setEyeMode((v) => !v)}
        style={{
          padding: '11px 14px',
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          background: eyeMode ? '#2ada56' : KIT_BLUE,
          color: eyeMode ? '#062b12' : '#fff',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: UI_FONT,
        }}
      >
        {eyeMode ? '← Salir de su vista' : '👁  Ver desde sus ojos'}
      </button>

      <button
        onClick={onReset}
        style={{
          padding: '9px 14px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          color: '#c9cdd6',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: UI_FONT,
        }}
      >
        ↺ Restablecer valores
      </button>

      <div style={{ fontSize: 11, color: '#7c8190', lineHeight: 1.5 }}>
        {eyeMode
          ? 'Estás viendo desde los ojos de la persona. Arrastra para girar la vista · ajusta la distancia para ver cómo cambia el tamaño.'
          : 'Arrastra para orbitar · rueda para acercar · WASD para caminar · R/F para subir y bajar.'}
      </div>
    </div>
  )
}

/** A labelled range slider with an optional row of quick-set preset chips. */
function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  presets,
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (n: number) => void
  presets?: { label: string; v: number }[]
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#a7adba', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: '#e8e8f0' }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: KIT_BLUE }}
      />
      {presets && presets.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {presets.map((p) => {
            const active = Math.abs(value - p.v) < 0.03
            return (
              <button
                key={p.label}
                onClick={() => onChange(p.v)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  background: active ? KIT_BLUE : 'rgba(255,255,255,0.05)',
                  color: active ? '#fff' : '#c9cdd6',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: UI_FONT,
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      )}
    </label>
  )
}

useFBX.preload(HUMAN_URL)
