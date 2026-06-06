/**
 * pathfinding — route geometry for the «camino» print (pure math, no React).
 * ──────────────────────────────────────────────────────────────────────────
 * Ported from the neo-work grid generator (`src/lib/pathfinding.ts`). A concept
 * is expressed as a route through the grid: an ordered list of cells from a
 * start node to a goal node. Each cell's arrow direction is *derived* from the
 * route geometry, so editing the route re-orients every arrow — that's what
 * makes variations cheap.
 *
 * Coords are [col, row], 1-indexed, row 1 = top. Off-grid coords (col 0,
 * col columns+1, …) are allowed and used to place the start / goal nodes just
 * outside the grid. The `.tsx` page renders this in physical millimetres.
 */

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Coord = [number, number]

/**
 * A single step along the route. By default it renders an arrow pointing to the
 * next step. `depth` lets a step carve in (`recessed`) or stay flush (`flat`)
 * instead of swelling out (`raised`, the default) — so the *elevations* along
 * the path can follow their own pattern.
 */
export type RouteStep = {
  at: Coord
  colSpan?: number
  rowSpan?: number
  depth?: 'raised' | 'recessed' | 'flat'
}

/** Wrap bare coords as plain arrow steps. */
export const coordsToSteps = (coords: Coord[]): RouteStep[] => coords.map((at) => ({ at }))

const key = (c: Coord) => `${c[0]},${c[1]}`

/** Cardinal direction pointing from `a` toward `b`. */
export function dirBetween(a: Coord, b: Coord): Dir {
  const dc = b[0] - a[0]
  const dr = b[1] - a[1]
  if (Math.abs(dc) >= Math.abs(dr)) return dc >= 0 ? 'right' : 'left'
  return dr >= 0 ? 'down' : 'up'
}

/**
 * BFS shortest path on a 4-connected grid, avoiding `blocked` cells.
 * Returns the inclusive ordered cells (start → goal), or [] if unreachable.
 *   solve([1, 8], [12, 1], { columns: 12, rows: 8, blocked: [[3, 4]] })
 */
export function solve(
  start: Coord,
  goal: Coord,
  opts: { columns: number; rows: number; blocked?: Coord[] },
): Coord[] {
  const { columns, rows, blocked = [] } = opts
  const blockedSet = new Set(blocked.map(key))
  const inBounds = ([c, r]: Coord) => c >= 1 && c <= columns && r >= 1 && r <= rows

  const queue: Coord[][] = [[start]]
  const seen = new Set([key(start)])

  while (queue.length) {
    const path = queue.shift()!
    const cur = path[path.length - 1]
    if (cur[0] === goal[0] && cur[1] === goal[1]) return path

    const neighbours: Coord[] = [
      [cur[0] + 1, cur[1]],
      [cur[0] - 1, cur[1]],
      [cur[0], cur[1] + 1],
      [cur[0], cur[1] - 1],
    ]
    for (const n of neighbours) {
      if (!inBounds(n) || blockedSet.has(key(n)) || seen.has(key(n))) continue
      seen.add(key(n))
      queue.push([...path, n])
    }
  }
  return []
}

// ── Footprint-aware geometry ─────────────────────────────────────────────────

export type Footprint = { c0: number; r0: number; c1: number; r1: number }

/** Inclusive cell bounds a step occupies. */
export function footprint(step: RouteStep): Footprint {
  const c0 = step.at[0]
  const r0 = step.at[1]
  return { c0, r0, c1: c0 + (step.colSpan ?? 1) - 1, r1: r0 + (step.rowSpan ?? 1) - 1 }
}

/** Direction from a footprint toward a target coord — uses the footprint edges. */
export function dirToward(fp: Footprint, target: Coord): Dir {
  if (target[0] > fp.c1) return 'right'
  if (target[0] < fp.c0) return 'left'
  if (target[1] > fp.r1) return 'down'
  if (target[1] < fp.r0) return 'up'
  // target sits inside the footprint: keep travelling rightward by default.
  return 'right'
}

/**
 * Resolve a route so consecutive steps connect **edge-to-edge** and never
 * overlap. Each step keeps the travel direction implied by its authored anchor,
 * but is repositioned adjacent to the previous step's footprint edge — so a
 * spanning step pushes whatever follows it past its far edge.
 */
export function reflowRoute(route: RouteStep[]): RouteStep[] {
  if (route.length === 0) return route
  const out: RouteStep[] = [{ ...route[0] }]

  for (let i = 1; i < route.length; i += 1) {
    const origPrev = route[i - 1]
    const origCur = route[i]
    const prevFp = footprint(origPrev)
    let dir = dirToward(prevFp, origCur.at)
    // If the anchor fell inside the previous footprint, fall back to the raw
    // anchor-to-anchor direction so turns are preserved.
    if (
      origCur.at[0] >= prevFp.c0 &&
      origCur.at[0] <= prevFp.c1 &&
      origCur.at[1] >= prevFp.r0 &&
      origCur.at[1] <= prevFp.r1
    ) {
      dir = dirBetween(origPrev.at, origCur.at)
    }

    const prev = out[i - 1]
    const pf = footprint(prev)
    const curCols = origCur.colSpan ?? 1
    const curRows = origCur.rowSpan ?? 1

    let col = prev.at[0]
    let row = prev.at[1]
    if (dir === 'right') {
      col = pf.c1 + 1
      row = pf.r0
    } else if (dir === 'left') {
      col = pf.c0 - curCols
      row = pf.r0
    } else if (dir === 'down') {
      row = pf.r1 + 1
      col = pf.c0
    } else {
      row = pf.r0 - curRows
      col = pf.c0
    }

    out.push({ ...origCur, at: [Math.max(1, col), Math.max(1, row)] })
  }
  return out
}

/** Arrow direction per route step (footprint-aware), last step points to goal. */
export function routeArrows(route: RouteStep[], goal: Coord): Dir[] {
  return route.map((step, i) => {
    const target = i < route.length - 1 ? route[i + 1].at : goal
    return dirToward(footprint(step), target)
  })
}

// ── The print's resolved scene ───────────────────────────────────────────────

/** Named search patterns — different ways of sweeping/searching the grid. */
export type SearchPattern = 'staircase' | 'serpentine' | 'spiral'

export type PathProps = {
  columns?: number
  rows?: number
  /** Explicit route — bare coords or full steps. Highest precedence. */
  route?: Array<Coord | RouteStep>
  /** Auto-generate the route with BFS around obstacles. Beats `pattern`. */
  solve?: { start: Coord; goal: Coord; blocked?: Coord[] }
  /** Auto-generate the route from a named search pattern (fills the grid). */
  pattern?: SearchPattern
  /** Stride (cells per leg) for the `staircase` pattern. Default 2. */
  stride?: number
  /** Empty start disc. Defaults to one cell left of the first step's row. */
  startNode?: Coord
}

// ── Search-pattern route generators ──────────────────────────────────────────

/**
 * Sparse diagonal climb: right `stride`, up `stride`, repeating from the
 * bottom-left to the top-right — a greedy "best-first" path that leaves most of
 * the grid as empty searched space.
 */
export function staircase(cols: number, rows: number, stride = 2): Coord[] {
  const out: Coord[] = []
  let c = 1
  let r = rows
  out.push([c, r])
  let goRight = true
  // Bounded by total cells — can never loop longer than the grid.
  for (let guard = 0; guard < cols * rows && !(c === cols && r === 1); guard += 1) {
    if (goRight) {
      const target = Math.min(cols, c + stride)
      while (c < target) {
        c += 1
        out.push([c, r])
      }
    } else {
      const target = Math.max(1, r - stride)
      while (r > target) {
        r -= 1
        out.push([c, r])
      }
    }
    goRight = !goRight
  }
  return out
}

/**
 * Boustrophedon sweep: snake left↔right row by row from the bottom up, covering
 * every cell — an exhaustive breadth-first flood of the whole grid.
 */
export function serpentine(cols: number, rows: number): Coord[] {
  const out: Coord[] = []
  for (let i = 0; i < rows; i += 1) {
    const r = rows - i // bottom row first
    if (i % 2 === 0) for (let c = 1; c <= cols; c += 1) out.push([c, r])
    else for (let c = cols; c >= 1; c -= 1) out.push([c, r])
  }
  return out
}

/**
 * Inward clockwise spiral from the outer ring to the centre — a depth-first
 * boundary-following search.
 */
export function spiral(cols: number, rows: number): Coord[] {
  const out: Coord[] = []
  let top = 1
  let bottom = rows
  let left = 1
  let right = cols
  while (left <= right && top <= bottom) {
    for (let c = left; c <= right; c += 1) out.push([c, top])
    top += 1
    for (let r = top; r <= bottom; r += 1) out.push([right, r])
    right -= 1
    if (top <= bottom) {
      for (let c = right; c >= left; c -= 1) out.push([c, bottom])
      bottom -= 1
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r -= 1) out.push([left, r])
      left += 1
    }
  }
  return out
}

const PATTERNS: Record<SearchPattern, (cols: number, rows: number, stride?: number) => Coord[]> = {
  staircase,
  serpentine,
  spiral,
}

export type PathScene = {
  columns: number
  rows: number
  steps: RouteStep[]
  dirs: Dir[]
  startNode: Coord
  goalNode: Coord
}

/**
 * Default «camino»: a sparse staircase that always climbs toward the top-right,
 * turning at the decision points and leaving the rest of the grid as empty
 * searched space. Start disc bottom-left, goal (blue dot) just past top-right.
 */
export const DEFAULT_ROUTE: Coord[] = [
  [1, 8], [2, 8], [3, 8], [4, 8],
  [4, 7], [4, 6],
  [5, 6], [6, 6], [7, 6], [8, 6],
  [8, 5], [8, 4],
  [9, 4], [10, 4],
  [10, 3], [10, 2],
  [11, 2], [12, 2],
  [12, 1],
]

export const DEFAULT_COLUMNS = 12
export const DEFAULT_ROWS = 8

const asStep = (s: Coord | RouteStep): RouteStep => (Array.isArray(s) ? { at: s } : s)

/** Resolve raw `doc.props` into a fully-placed scene the page can render. */
export function resolveScene(props: PathProps = {}): PathScene {
  const declaredCols = props.columns ?? DEFAULT_COLUMNS
  const declaredRows = props.rows ?? DEFAULT_ROWS

  let raw: RouteStep[]
  if (props.route && props.route.length) {
    raw = props.route.map(asStep)
  } else if (props.solve) {
    const { start, goal, blocked } = props.solve
    raw = coordsToSteps(solve(start, goal, { columns: declaredCols, rows: declaredRows, blocked }))
  } else if (props.pattern) {
    raw = coordsToSteps(PATTERNS[props.pattern](declaredCols, declaredRows, props.stride))
  } else {
    raw = coordsToSteps(DEFAULT_ROUTE)
  }

  const steps = reflowRoute(raw)

  // Grow the grid if any step runs past the declared size.
  const columns = Math.max(declaredCols, ...steps.map((s) => footprint(s).c1))
  const rows = Math.max(declaredRows, ...steps.map((s) => footprint(s).r1))

  const startNode: Coord = props.startNode ?? [0, steps[0]?.at[1] ?? rows]
  // The goal always lives just outside the top-right corner — never in a cell.
  const goalNode: Coord = [columns + 1, 1]

  const dirs = routeArrows(steps, goalNode)

  return { columns, rows, steps, dirs, startNode, goalNode }
}
