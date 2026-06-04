/**
 * Wall HUD model (Phase 0)
 * ────────────────────────
 * Pure, render-agnostic helpers that turn a registry-bearing {@link Wall} into the
 * label + filter primitives the 3D scene paints over each event wall. The point is
 * production unambiguity: during the Phase 4/5 mounting work an operator must see at
 * a glance *which* of the 21 identical grey walls is `#2 · S1/S3` and what its
 * production `estado` is, and be able to dim the walls that aren't the ones they're
 * working on. Following the codebase pattern (pure tested core + thin React wiring),
 * everything decidable without three.js lives here and is unit-tested.
 *
 * See `specs/wall-graphics.md` (Per-wall inventory, Wall registry).
 */

import type { Estado, Track, Wall } from './eventLayout'

/** Estados in production order: ready → proposed → pending decision. */
export const ESTADO_ORDER: readonly Estado[] = ['ok', 'prop', 'pend'] as const

/** Human (Spanish) label for each production status — for the HUD legend/badge. */
export const ESTADO_LABEL: Record<Estado, string> = {
  ok: 'Listo',
  prop: 'Propuesto',
  pend: 'Pendiente',
}

/**
 * Badge / wall-tint colour per status. Green = ready, blue = proposed (the brand
 * KIT_BLUE), amber = pending a decision (caution, not error-red). Kept as literal
 * hexes so this module has no render-layer dependency and stays node-testable.
 */
export const ESTADO_COLOR: Record<Estado, string> = {
  ok: '#36854f',
  prop: '#0070f9',
  pend: '#d9912f',
}

/** Human (Spanish) label for the production track tag shown on a wall chip. */
export const TRACK_LABEL: Record<Track, string> = {
  C: 'Código',
  I: 'Imagen',
  H: 'Híbrido',
  'C/I': 'Por decidir',
}

/** Spanish display label for a production status (falls back to the raw code). */
export function estadoLabel(estado: Estado): string {
  return ESTADO_LABEL[estado] ?? estado
}

/** Badge / tint colour for a production status (falls back to a neutral grey). */
export function estadoColor(estado: Estado): string {
  return ESTADO_COLOR[estado] ?? '#9aa0ac'
}

/**
 * Truncate `text` to at most `max` glyphs, appending an ellipsis when cut so the
 * result length never exceeds `max`. `max <= 0` yields an empty string; `max === 1`
 * yields the bare ellipsis. Trailing whitespace before the ellipsis is trimmed.
 */
export function truncate(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  if (max === 1) return '…'
  return text.slice(0, max - 1).trimEnd() + '…'
}

/** A wall reduced to everything the HUD chip needs to draw it. */
export type WallLabel = {
  /** Stable inventory id 1..21. */
  invId: number
  /** Compact identity line, e.g. `#2 · S1/S3`. */
  tag: string
  /** The wall's theme, truncated for the chip. */
  tema: string
  /** Production status. */
  estado: Estado
  /** Spanish status label, e.g. `Propuesto`. */
  estadoText: string
  /** Status colour (border / badge tint). */
  color: string
  /** Production track. */
  track: Track
  /** Whether this piece must be researched + sourced. */
  research: boolean
}

/**
 * Build the HUD label for a wall, or `null` when the wall carries no registry
 * (e.g. a glass partition — not one of the 21 event walls). `temaMax` caps the
 * theme text so chips stay compact (default 40).
 */
export function wallLabel(wall: Wall, opts: { temaMax?: number } = {}): WallLabel | null {
  const r = wall.registry
  if (!r) return null
  const temaMax = opts.temaMax ?? 40
  const sala = r.sala.trim()
  return {
    invId: r.invId,
    tag: sala ? `#${r.invId} · ${sala}` : `#${r.invId}`,
    tema: truncate(r.tema.trim(), temaMax),
    estado: r.estado,
    estadoText: estadoLabel(r.estado),
    color: estadoColor(r.estado),
    track: r.track,
    research: r.research,
  }
}

/**
 * Whether a wall passes the estado filter. `visible === null` means "no filter,
 * show everything". Otherwise the wall must be a registry-bearing event wall whose
 * status is in the visible set (glass / unregistered walls never pass an active
 * filter — they aren't part of the inventory being curated).
 */
export function matchesEstadoFilter(wall: Wall, visible: ReadonlySet<Estado> | null): boolean {
  if (visible === null) return true
  const estado = wall.registry?.estado
  return estado != null && visible.has(estado)
}

/** Keep only the walls that pass the estado filter (see {@link matchesEstadoFilter}). */
export function filterWallsByEstado(walls: Wall[], visible: ReadonlySet<Estado> | null): Wall[] {
  return walls.filter((w) => matchesEstadoFilter(w, visible))
}

/** Per-status tally of registry-bearing walls, plus the registered total. */
export type EstadoCounts = Record<Estado, number> & { total: number }

/**
 * Count registry-bearing walls per status. Walls without a registry are ignored,
 * so `total` is the number of event walls and equals `ok + prop + pend`.
 */
export function estadoCounts(walls: Wall[]): EstadoCounts {
  const counts: EstadoCounts = { ok: 0, prop: 0, pend: 0, total: 0 }
  for (const w of walls) {
    const estado = w.registry?.estado
    if (estado == null) continue
    counts[estado] += 1
    counts.total += 1
  }
  return counts
}
