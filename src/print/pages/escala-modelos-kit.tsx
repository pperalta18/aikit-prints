import type { PrintGeometry } from '../geometry'
import { type TipoPalette, tipoEyebrow } from './tipografia-kit'
import { sourcesCaption, type Datum } from './dataviz-scales'

/**
 * escala-modelos-kit — the presentation primitives shared by the **9E1 + 8S1
 * model-scale pair**, in the editorial *light gallery* register.
 * ──────────────────────────────────────────────────────────────────────────
 * The pair borrows the event type voice + ground from `tipografia-kit` (hairline
 * Display, paper ground, hairline Rules, the discreet Lockup) and adds the one
 * thing it needs of its own: the **matrix grain**. Every model is rendered as a
 * fine grid of cells — the literal "no es magia, es multiplicación de matrices".
 * Because a cell is a FIXED physical size, the number of cells in a model's square
 * is exactly proportional to its parameter count (`escala-modelos.ts` cellCount),
 * so the texture is honest, not decorative: each cell is the same quantum of
 * parameters on both walls.
 *
 * Pure inline styles, authored in `geo` units so it reads at print scale at any
 * wall size / DPI. Layout maths live in `escala-modelos.ts`.
 */

/** Matrix cell size (mm) for the bounded model squares (fine grain). */
export const CELL_SIDE_MM = 22

/** Deterministic per-cell ink weight in [lo, hi] — varies the grain like real weights. */
function cellWeight(i: number, j: number, seed: number, lo: number, hi: number): number {
  // Integer xor-shift hash — well-distributed, no diagonal banding (unlike a
  // sin() hash), so a vast grid reads as a genuine random matrix, not wallpaper.
  let h = (Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663) ^ Math.imul(seed + 1, 83492791)) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 1274126177) >>> 0
  const f = (h >>> 8) / 0x1000000 // 0..1
  return lo + f * (hi - lo)
}

/** Dense graphite grain — the small "object" squares on 9E1. */
export const GRAIN_SOLID: [number, number] = [0.58, 0.95]
/** Deep, high-contrast grain — the GPT-4 monolith on 8S1 (some layers near-black). */
export const GRAIN_DEEP: [number, number] = [0.46, 1]
/** Pale luminous grain — kept for the light field option. */
export const GRAIN_PALE: [number, number] = [0.1, 0.42]

/** Cell size (mm) for the wall-flooding GPT-4 field — coarser than the squares so a
 * ~9 m² of grain stays a few thousand cells, not tens of thousands. */
export const FIELD_CELL_MM = 46

/* ── matrix grain: a square/field filled as ONE unique grid of cells ───────────── */

/** Render `cols × rows` unique cells covering wPx×hPx; paper shows through as a grid. */
function MatrixCells({
  wPx,
  hPx,
  cols,
  rows,
  inkColor,
  bg,
  gridPx,
  seed,
  lo,
  hi,
}: {
  wPx: number
  hPx: number
  cols: number
  rows: number
  inkColor: string
  bg: string
  gridPx: number
  seed: number
  lo: number
  hi: number
}) {
  const cw = wPx / cols
  const ch = hPx / rows
  const rects = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      rects.push(
        <rect
          key={`${i}-${j}`}
          x={i * cw + gridPx / 2}
          y={j * ch + gridPx / 2}
          width={Math.max(0.5, cw - gridPx)}
          height={Math.max(0.5, ch - gridPx)}
          fill={inkColor}
          opacity={cellWeight(i, j, seed, lo, hi)}
        />,
      )
    }
  }
  return (
    <svg width={wPx} height={hPx} style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <rect width={wPx} height={hPx} fill={bg} />
      {rects}
    </svg>
  )
}

export function MatrixGrain({
  geo,
  pal,
  wPx,
  hPx,
  cellMm = CELL_SIDE_MM,
  ink,
  gridMm = 0.5,
  seed = 1,
  opacityRange = GRAIN_SOLID,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  wPx: number
  hPx: number
  cellMm?: number
  ink?: string
  /** Gridline thickness (mm) — the paper showing between cells. */
  gridMm?: number
  seed?: number
  /** Per-cell ink-opacity band: GRAIN_SOLID (objects) or GRAIN_PALE (the GPT-4 field). */
  opacityRange?: [number, number]
}) {
  const cellPx = Math.max(2, geo.mm(cellMm))
  const cols = Math.max(1, Math.round(wPx / cellPx))
  const rows = Math.max(1, Math.round(hPx / cellPx))
  const [lo, hi] = opacityRange
  return (
    <MatrixCells
      wPx={wPx}
      hPx={hPx}
      cols={cols}
      rows={rows}
      inkColor={ink ?? pal.ink}
      bg={pal.bg}
      gridPx={Math.max(0.75, geo.mm(gridMm))}
      seed={seed}
      lo={lo}
      hi={hi}
    />
  )
}

/**
 * An explicit `cols × rows` matrix — used to render a tiny model (the Perceptrón's
 * 512 parameters) at its TRUE cell count, enlarged inside a magnifier. Honest: the
 * grid holds exactly cols·rows cells, labelled as enlarged.
 */
export function MiniMatrix({
  geo,
  pal,
  wPx,
  hPx,
  cols,
  rows,
  ink,
  gridMm = 0.5,
  seed = 2,
  opacityRange = GRAIN_SOLID,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  wPx: number
  hPx: number
  cols: number
  rows: number
  ink?: string
  gridMm?: number
  seed?: number
  opacityRange?: [number, number]
}) {
  const [lo, hi] = opacityRange
  return (
    <MatrixCells
      wPx={wPx}
      hPx={hPx}
      cols={cols}
      rows={rows}
      inkColor={ink ?? pal.ink}
      bg={pal.bg}
      gridPx={Math.max(0.75, geo.mm(gridMm))}
      seed={seed}
      lo={lo}
      hi={hi}
    />
  )
}

/* ── layer stack: a model rendered as a stack of N layers ("capas") ───────────── */

/** Per-layer tone: a random weight blended with a slow wave, so a tall stack reads
 * as an organic field of activations (darker and lighter zones) rather than flat. */
function layerTone(k: number, seed: number, lo: number, hi: number): number {
  const rand = cellWeight(0, k, seed, lo, hi)
  const wave = lo + (hi - lo) * (0.5 + 0.5 * Math.sin(k * 0.11 + seed * 1.7))
  return rand * 0.6 + wave * 0.4
}

/**
 * Render a model as a vertical **stack of `layers` horizontal sheets** filling
 * wPx×hPx — the "no es magia, es multiplicación de matrices" made physical: a
 * network is a stack of layers. Each sheet is one layer; the paper shows through
 * as a hairline gap between them. With `cells` the sheets are themselves divided
 * into weight-cells (rich texture for the bounded squares); without, they are
 * clean strata (for the wall-flooding GPT-4 monolith, which would otherwise be
 * tens of thousands of cells). Layer 0 is the top.
 */
export function LayerStack({
  geo,
  pal,
  wPx,
  hPx,
  layers,
  cells = false,
  ink,
  seed = 1,
  gapMm = 1.4,
  cellGapMm = 0.5,
  opacityRange = GRAIN_SOLID,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  wPx: number
  hPx: number
  layers: number
  /** Subdivide each layer into ~square weight-cells (true for the bounded squares). */
  cells?: boolean
  ink?: string
  seed?: number
  /** Gap between layers (mm) — the sheet separation. */
  gapMm?: number
  /** Gap between weight-cells within a layer (mm). */
  cellGapMm?: number
  opacityRange?: [number, number]
}) {
  const inkColor = ink ?? pal.ink
  const n = Math.max(1, Math.round(layers))
  const rowH = hPx / n
  const gap = Math.min(rowH * 0.4, Math.max(geo.mm(0.35), geo.mm(gapMm)))
  const [lo, hi] = opacityRange
  const rects = []

  for (let k = 0; k < n; k++) {
    const y = k * rowH + gap / 2
    const h = Math.max(0.5, rowH - gap)
    if (cells) {
      const m = Math.max(1, Math.round(wPx / rowH)) // ~square cells
      const cw = wPx / m
      const cgap = Math.max(0.5, geo.mm(cellGapMm))
      for (let i = 0; i < m; i++) {
        rects.push(
          <rect
            key={`${k}-${i}`}
            x={i * cw + cgap / 2}
            y={y}
            width={Math.max(0.5, cw - cgap)}
            height={h}
            fill={inkColor}
            opacity={cellWeight(i, k, seed, lo, hi)}
          />,
        )
      }
    } else {
      // a sheet: the band + a thin darker shadow along its lower edge, so the
      // stack reads as physical layers catching light, not flat blinds.
      const shadowH = Math.max(geo.mm(0.5), h * 0.16)
      rects.push(<rect key={`b-${k}`} x={0} y={y} width={wPx} height={h} fill={inkColor} opacity={layerTone(k, seed, lo, hi)} />)
      rects.push(<rect key={`s-${k}`} x={0} y={y + h - shadowH} width={wPx} height={shadowH} fill={inkColor} opacity={Math.min(1, layerTone(k, seed, lo, hi) + 0.22)} />)
    }
  }

  return (
    <svg width={wPx} height={hPx} style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <rect width={wPx} height={hPx} fill={pal.bg} />
      {rects}
    </svg>
  )
}

/* ── layer tunnel: the deepest model, seen INTO (perspective recession) ───────── */

function parseHex(h: string): [number, number, number] {
  const x = h.replace('#', '')
  const n = x.length === 3 ? x.split('').map((c) => c + c).join('') : x
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

/** Solid colour t of the way from `a` to `b` (t in 0..1) — for opaque tunnel rings. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  const c = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * Math.max(0, Math.min(1, t)))
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`
}

/**
 * Render a model as a **tunnel of `layers`** receding to a vanishing point — you
 * are not looking at the stack from the side (`LayerStack`) but *into* it: the
 * network is so deep it swallows the wall. Concentric frames shrink toward the
 * core (geometric perspective spacing), each frame one layer, graded + varied so
 * the depth reads as an abyss of activations rather than a flat target. The GPT-4
 * payoff on 8S1 — textless, filling every edge.
 */
export function LayerTunnel({
  pal,
  wPx,
  hPx,
  layers,
  seed = 1,
  ink,
  vpx = 0.5,
  vpy = 0.5,
  minScale = 0.05,
  edgeOpacity = 0.94,
  coreOpacity = 0.14,
  rimColor = '#15110a',
  coreColor = '#fdf5e8',
}: {
  pal: TipoPalette
  wPx: number
  hPx: number
  layers: number
  seed?: number
  ink?: string
  /** Vanishing point as a fraction of the canvas (0..1). */
  vpx?: number
  vpy?: number
  /** Size of the deepest (smallest) frame relative to the front (0..1). */
  minScale?: number
  /** Ink opacity at the rim (dark, dominant) … */
  edgeOpacity?: number
  /** … and at the luminous core (light) — the glow at the end of the depth. */
  coreOpacity?: number
  /** Warm near-black at the rim … (warm so the export is true CMYK, not DeviceGray). */
  rimColor?: string
  /** … warming to a luminous core, tying GPT-4's depth to the combustion warmth. */
  coreColor?: string
}) {
  void ink
  void pal
  const n = Math.max(2, Math.round(layers))
  const cx = vpx * wPx
  const cy = vpy * hPx
  const rects = []
  // evenly-spaced concentric frames (one per layer), drawn rim → core (smaller on
  // top). OPAQUE solid greys (not stacked alpha — that would pile up black at the
  // centre): each ring shows its own tone, a dark dominant rim deepening to a
  // bright core — a luminous rectangular tunnel whose rings read as stacked layers.
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1) // 0 at the rim, 1 at the core
    const s = 1 - t * (1 - minScale) // linear spacing → every layer visible
    const base = edgeOpacity + (coreOpacity - edgeOpacity) * t
    const v = cellWeight(0, k, seed, 0.9, 1.08) // per-layer activation variation
    rects.push(
      <rect
        key={k}
        x={cx * (1 - s)}
        y={cy * (1 - s)}
        width={wPx * s}
        height={hPx * s}
        fill={mixHex(coreColor, rimColor, Math.max(0, Math.min(1, base * v)))}
      />,
    )
  }
  return (
    <svg width={wPx} height={hPx} style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <rect width={wPx} height={hPx} fill={rimColor} />
      {rects}
    </svg>
  )
}

/* ── layer monolith: the deepest model as a colossal 3D block of stacked floors ── */

/**
 * Render a model as an **isometric monolith** — a 3D block built of `layers`
 * stacked floors, seen in oblique projection (front face + a receding right side,
 * the floors wrapping the corner) and so tall it bleeds off the top: you stand at
 * the base of a tower of layers. The GPT-4 payoff on 8S1 — textless, monumental,
 * immediately legible as "an enormous stack", warm-lit so it exports true CMYK.
 */
export function LayerMonolith({
  pal,
  wPx,
  hPx,
  layers,
  seed = 1,
  // Neutral B&W to match the other wall (9E1). The dark carries an imperceptible
  // cool tint so the export is true CMYK, not DeviceGray (a perfectly neutral image
  // would be flagged grayscale); visually it reads as the same clean near-black.
  lightColor = '#ffffff',
  darkColor = '#14141a',
  frontTone = 0.42,
  sideTone = 0.84,
  gapTone = 0.66,
  leftFrac = 0.07,
  widthFrac = 0.7,
  depthXFrac = 0.14,
  depthYFrac = 0.26,
  baseFrac = 0.985,
  visibleLayers = 56,
}: {
  pal: TipoPalette
  wPx: number
  hPx: number
  layers: number
  seed?: number
  lightColor?: string
  darkColor?: string
  /** Tone of the lit front face / shadowed side / floor-seam (0 light … 1 dark). */
  frontTone?: number
  sideTone?: number
  gapTone?: number
  leftFrac?: number
  widthFrac?: number
  depthXFrac?: number
  depthYFrac?: number
  baseFrac?: number
  /** How many floors fit between the base and the top of the wall (rest bleed up). */
  visibleLayers?: number
}) {
  void pal
  const n = Math.max(2, Math.round(layers))
  const baseY = hPx * baseFrac
  const leftX = wPx * leftFrac
  const frontW = wPx * widthFrac
  const rightX = leftX + frontW
  const ddx = wPx * depthXFrac
  const ddy = -hPx * depthYFrac // recede up-and-right
  const slabH = baseY / Math.max(1, visibleLayers)
  const seamH = Math.max(1, slabH * 0.09) // floor shadow seam
  const litH = Math.max(1, slabH * 0.07) // lit leading edge of each floor
  const seamFill = mixHex(lightColor, darkColor, gapTone)
  const litFill = mixHex(lightColor, darkColor, frontTone * 0.42)
  const els = []
  for (let k = 0; k < n; k++) {
    const yBot = baseY - k * slabH
    const yTop = yBot - slabH
    if (yBot < -slabH * 2 + ddy) break // fully above the frame (bleeds off the top)
    const v = layerTone(k, seed, 0.92, 1.08)
    const grad = 1 - 0.2 * Math.min(1, k / Math.max(1, visibleLayers)) // top floors catch light
    const fFill = mixHex(lightColor, darkColor, Math.min(1, frontTone * v * grad))
    const sFill = mixHex(lightColor, darkColor, Math.min(1, sideTone * v * grad))
    // right side face (behind the corner) — floors receding in depth
    els.push(
      <polygon
        key={`s${k}`}
        points={`${rightX},${yTop} ${rightX},${yBot} ${rightX + ddx},${yBot + ddy} ${rightX + ddx},${yTop + ddy}`}
        fill={sFill}
      />,
    )
    // side floor seam — a thin LIT edge so the floors read on the shadowed side
    els.push(
      <line key={`ss${k}`} x1={rightX} y1={yBot} x2={rightX + ddx} y2={yBot + ddy} stroke={mixHex(lightColor, darkColor, sideTone * 0.62)} strokeWidth={seamH * 0.7} />,
    )
    // front face floor
    els.push(<rect key={`f${k}`} x={leftX} y={yTop} width={frontW} height={slabH} fill={fFill} />)
    // lit leading edge at the top of the floor, shadow seam at the bottom → stacked slabs
    els.push(<rect key={`l${k}`} x={leftX} y={yTop} width={frontW} height={litH} fill={litFill} />)
    els.push(<rect key={`g${k}`} x={leftX} y={yBot - seamH} width={frontW} height={seamH} fill={seamFill} />)
  }
  return (
    <svg width={wPx} height={hPx} style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <rect width={wPx} height={hPx} fill={lightColor} />
      {els}
    </svg>
  )
}

/* ── the two mandatory data annotations, in the light register ────────────────── */

/** Museographic scale stamp: an accent tick + a tracked note. */
export function ScaleNoteLight({
  geo,
  pal,
  sizePt,
  note,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  sizePt: number
  note: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: geo.mm(sizePt * 0.4) }}>
      <span style={{ width: geo.mm(sizePt * 1.6), height: Math.max(1, geo.mm(sizePt * 0.16)), background: pal.accent }} />
      <span style={tipoEyebrow(geo, sizePt, pal.muted)}>{note}</span>
    </div>
  )
}

/** The discreet sources caption every data piece must carry (deduped hosts + date). */
export function SourceCaptionLight({
  geo,
  pal,
  data,
  sizePt,
  label = 'Fuentes',
}: {
  geo: PrintGeometry
  pal: TipoPalette
  data: ReadonlyArray<Datum>
  sizePt: number
  label?: string
}) {
  return <span style={tipoEyebrow(geo, sizePt, pal.faint)}>{sourcesCaption(data, label)}</span>
}
