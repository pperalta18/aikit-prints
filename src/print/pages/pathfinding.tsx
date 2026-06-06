import type { CSSProperties } from 'react'
import { KIT_BLUE, elevation, type NeoTheme } from '@/lib/neumorphism'
import type { PrintGeometry } from '../geometry'
import type { PrintPageProps } from '../types'
import {
  footprint,
  resolveScene,
  type Coord,
  type Dir,
  type PathProps,
  type PathScene,
} from './pathfinding'

/**
 * pathfinding — «El camino» (free-standing neumorphic grid, no wall).
 * ───────────────────────────────────────────────────────────────────────────
 * The neo-work grid generator rebuilt as a print. A concept is a *route* across
 * a grid of soft plates: a chain of raised arrow-cells that auto-point toward
 * the next step, so the pattern the arrows trace *is* the path; the empty cells
 * around it are the space being searched. Start disc (outside, left) and goal
 * (a KIT_BLUE dot just past the top-right) can be shown or hidden.
 *
 * Two layouts:
 *   · `single`  — one grid centred in the trim (default).
 *   · `columns` — N equal grids side by side, split by a full-height gutter,
 *                 each running its own route / search pattern.
 *
 * Pure DOM/CSS neumorphism (box-shadow), so it exports through the print
 * pipeline like any other page. Authored in millimetres from the trim origin;
 * each grid auto-sizes its cell to its panel. Prop-driven (`doc.props`).
 */

/* ── Cool light relief theme (the Figma "06 Grid" light mode). The surface is
 * intentionally NOT pure white: the relief leans on a #ffffff lit edge, which
 * only reads against a slightly darker ground. ─────────────────────────────── */
const SURFACE = '#f4f4fa'
function reliefTheme(surface: string): NeoTheme {
  return {
    name: 'grid-light',
    surface,
    gridLine: 'rgba(184, 204, 224, 0.45)',
    textMuted: '#6c6c89',
    textStrong: '#1e1e20',
    highlight: '#ffffff',
    shadow: '#c9d7e8',
    lightSource: 'tl',
  }
}

/* Neumorphism proportions, relative to the cell edge (from the 128 px module:
 * radius 24, distance 8, blur 16, plate inset 22 → these ratios). */
const R_RADIUS = 24 / 128
const R_DISTANCE = 8 / 128
const R_BLUR = 16 / 128
const R_INSET = 22 / 128
const R_FRAME_RADIUS = 28 / 128

type PanelTuning = {
  /** Arrow glyph size as a fraction of the cell edge. */
  arrowScale?: number
}

type PanelSpec = PathProps & PanelTuning

type LayoutProps = {
  layout?: 'single' | 'columns'
  /** Outer breathing room around the whole composition (mm). */
  pageMargin?: number
  /** Full-height gutter between columns (mm). */
  gutterMm?: number
  /** Show the empty start disc (just outside, left of each grid). */
  showStart?: boolean
  /** Show the KIT_BLUE goal dot (just past the top-right of each grid). */
  showGoal?: boolean
  /** One spec per column (columns layout). */
  panels?: PanelSpec[]
}

type Rect = { x: number; y: number; w: number; h: number }

export function Pathfinding({ doc, geo }: PrintPageProps) {
  const props = (doc.props ?? {}) as LayoutProps & PanelSpec
  const surface = doc.surface ?? SURFACE
  const theme = reliefTheme(surface)
  const { trimWidthMm: W, trimHeightMm: H } = doc.dimensions

  const margin = props.pageMargin ?? 30
  const showStart = props.showStart ?? props.layout !== 'columns'
  const showGoal = props.showGoal ?? props.layout !== 'columns'

  // Resolve the panels: a list of { rect (mm), scene, tuning }.
  const panels: Array<{ rect: Rect; scene: PathScene; arrowScale?: number }> = []

  if (props.layout === 'columns') {
    const specs = props.panels?.length ? props.panels : [{}, {}]
    const n = specs.length
    const gutter = props.gutterMm ?? 1150
    const innerW = W - 2 * margin - gutter * (n - 1)
    const colW = innerW / n
    const colH = H - 2 * margin
    specs.forEach((spec, i) => {
      const rect: Rect = { x: margin + i * (colW + gutter), y: margin, w: colW, h: colH }
      panels.push({ rect, scene: resolveScene(spec), arrowScale: spec.arrowScale })
    })
  } else {
    const rect: Rect = { x: margin, y: margin, w: W - 2 * margin, h: H - 2 * margin }
    panels.push({ rect, scene: resolveScene(props), arrowScale: props.arrowScale })
  }

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: surface }}>
      {panels.map((p, i) => (
        <PathPanel
          key={i}
          rect={p.rect}
          scene={p.scene}
          theme={theme}
          geo={geo}
          showStart={showStart}
          showGoal={showGoal}
          arrowScale={p.arrowScale ?? 0.34}
        />
      ))}
    </div>
  )
}

/* ── One grid + route, fitted into a rect (mm) ──────────────────────────────── */
function PathPanel({
  rect,
  scene,
  theme,
  geo,
  showStart,
  showGoal,
  arrowScale,
}: {
  rect: Rect
  scene: PathScene
  theme: NeoTheme
  geo: PrintGeometry
  showStart: boolean
  showGoal: boolean
  arrowScale: number
}) {
  const { mm } = geo
  const { columns, rows, steps, dirs, startNode, goalNode } = scene

  // Fit the cell to the rect. Reserve an outside column for any visible node.
  const slot0 = showStart ? 0 : 1
  const horizCells = columns + (showStart ? 1 : 0) + (showGoal ? 1 : 0)
  const cell = Math.min(rect.w / horizCells, rect.h / rows)

  const blockW = horizCells * cell
  const blockH = rows * cell
  const originX = rect.x + (rect.w - blockW) / 2 // left edge of column `slot0`
  const originY = rect.y + (rect.h - blockH) / 2

  const colLeft = (c: number) => originX + (c - slot0) * cell // 0/1-indexed slot → mm
  const rowTop = (r: number) => originY + (r - 1) * cell // row 1 = top
  const cellCenter = (c: Coord): [number, number] => [colLeft(c[0]) + cell / 2, rowTop(c[1]) + cell / 2]

  const inset = cell * R_INSET
  const radius = cell * R_RADIUS
  const distance = cell * R_DISTANCE
  const blur = cell * R_BLUR
  const frameRadius = cell * R_FRAME_RADIUS

  const frameLeft = colLeft(1)
  const frameTop = rowTop(1)
  const frameW = columns * cell
  const frameH = rows * cell
  const hairline = theme.gridLine
  const lw = mm(0.3) // hairline width (mm → px)

  const at = (leftMm: number, topMm: number, w: number, h: number): CSSProperties => ({
    position: 'absolute',
    left: mm(leftMm),
    top: mm(topMm),
    width: mm(w),
    height: mm(h),
  })

  return (
    <>
      {/* ── the tray frame: hairline grid + soft rounded panel ─────────────── */}
      <div
        style={{
          ...at(frameLeft, frameTop, frameW, frameH),
          borderRadius: mm(frameRadius),
          boxShadow: `inset 0 0 0 ${lw}px ${hairline}, 0 ${mm(cell * 0.14)}px ${mm(cell * 0.39)}px ${mm(-cell * 0.16)}px ${theme.shadow}`,
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: mm(frameRadius),
            backgroundImage: `linear-gradient(to right, ${hairline} ${lw}px, transparent ${lw}px), linear-gradient(to bottom, ${hairline} ${lw}px, transparent ${lw}px)`,
            backgroundSize: `${mm(cell)}px ${mm(cell)}px`,
          }}
        />
      </div>

      {/* ── route: a raised arrow plate per step, auto-oriented ────────────── */}
      {steps.map((step, i) => {
        const fp = footprint(step)
        const left = colLeft(fp.c0) + inset
        const top = rowTop(fp.r0) + inset
        const w = (fp.c1 - fp.c0 + 1) * cell - 2 * inset
        const h = (fp.r1 - fp.r0 + 1) * cell - 2 * inset
        const depth = step.depth ?? 'raised'
        const plate = elevation(theme, { depth, distance: mm(distance), blur: mm(blur), radius: mm(radius) })
        return (
          <div
            key={`s-${i}`}
            style={{ ...at(left, top, w, h), display: 'grid', placeItems: 'center', ...plate }}
          >
            <Chevron dir={dirs[i]} sizePx={mm(cell * arrowScale)} color={theme.textMuted} />
          </div>
        )
      })}

      {/* ── nodes: empty start disc + KIT_BLUE goal dot (optional) ─────────── */}
      {showStart ? (
        <Node theme={theme} center={cellCenter(startNode)} cell={cell} inset={inset} radius={radius} distance={distance} blur={blur} geo={geo} />
      ) : null}
      {showGoal ? (
        <Node theme={theme} center={cellCenter(goalNode)} cell={cell} inset={inset} radius={radius} distance={distance} blur={blur} geo={geo} goal />
      ) : null}
    </>
  )
}

/* ── A directional chevron (dependency-free SVG), sized in device px ────────── */
function Chevron({ dir, sizePx, color }: { dir: Dir; sizePx: number; color: string }) {
  const rotate = { down: 0, up: 180, left: 90, right: -90 }[dir]
  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/* ── A start disc / goal dot — a circular raised plate the size of a cell ──── */
function Node({
  theme,
  center,
  cell,
  inset,
  radius,
  distance,
  blur,
  geo,
  goal = false,
}: {
  theme: NeoTheme
  center: [number, number]
  cell: number
  inset: number
  radius: number
  distance: number
  blur: number
  geo: PrintGeometry
  goal?: boolean
}) {
  const { mm } = geo
  const discMm = cell - 2 * inset
  const disc: CSSProperties = {
    position: 'absolute',
    left: mm(center[0] - discMm / 2),
    top: mm(center[1] - discMm / 2),
    width: mm(discMm),
    height: mm(discMm),
    display: 'grid',
    placeItems: 'center',
    ...elevation(theme, { depth: 'raised', distance: mm(distance), blur: mm(blur), radius: mm(radius * 4) }),
    borderRadius: '50%',
  }
  const dot = mm(discMm * 0.5)
  return (
    <div style={disc}>
      {goal ? (
        <div
          style={{
            width: dot,
            height: dot,
            borderRadius: '50%',
            background: KIT_BLUE,
            boxShadow: `0 0 ${mm(discMm * 0.25)}px ${KIT_BLUE}66`,
          }}
        />
      ) : null}
    </div>
  )
}
