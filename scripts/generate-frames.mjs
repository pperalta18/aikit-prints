#!/usr/bin/env node
/**
 * Blank-frame doc generator
 * ─────────────────────────
 * Writes one print document per wall frame so the empty placeholders show up in
 * the prints index (`/api/prints` scans `public/prints/<id>/doc.json`) and can be
 * exported like any other print. The geometry — both faces of every wall, split
 * where walls cut it, the nave cámaras on 2/11 — comes from the pure, unit-tested
 * `wallFrames.ts`; this file only reads the layout from disk, builds the `Wall[]`
 * it needs (same derivation as `eventLayout.ts`), and writes the docs.
 *
 *   npm run frames            # regenerate the public/prints/marco-… frame docs
 *
 * Re-runnable + deterministic: every `marco-*` doc is removed first, then rewritten,
 * so a geometry change drops stale frames and adds new ones with no manual cleanup.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { computeWallFrames } from '../src/print/space/wallFrames.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRINTS_DIR = join(ROOT, 'public', 'prints')
const CREATED_AT = '2026-06-04T00:00:00.000Z'
const DPI = 24 // blank placeholders — low dpi keeps the index preview light

/** Build the `Wall[]` exactly as `eventLayout.ts` does (world-centred metres). */
function loadWalls() {
  const layout = JSON.parse(readFileSync(join(ROOT, 'src/print/space/event-layout.json'), 'utf8'))
  const offX = -layout.spaceWidth / 2
  const offZ = -layout.spaceDepth / 2
  // Single source of truth for the uniform wall height: the layout root `wallHeight`
  // (the venue's walls are 3 m). Falls back to 2.5 m only if the layout carries none.
  const wallHeight =
    typeof layout.wallHeight === 'number' && Number.isFinite(layout.wallHeight) && layout.wallHeight > 0
      ? layout.wallHeight
      : 2.5
  const walls = layout.elements
    .filter((e) => e.type === 'wall')
    .map((e, i) => {
      const cx = e.x + e.w / 2 + offX
      const cz = e.y + e.h / 2 + offZ
      const sx = e.w
      const sz = e.h
      const normalAxis = sx <= sz ? 'x' : 'z'
      const explicit = typeof e.alturaM === 'number' && Number.isFinite(e.alturaM) && e.alturaM > 0
      return {
        id: `wall-${i}`,
        cx,
        cz,
        sx,
        sz,
        normalAxis,
        length: normalAxis === 'x' ? sz : sx,
        thickness: normalAxis === 'x' ? sx : sz,
        height: explicit ? e.alturaM : wallHeight,
        hasExplicitHeight: explicit,
        registry:
          e.invId == null
            ? undefined
            : { invId: e.invId, sala: e.sala ?? '', tema: e.tema ?? '', rol: e.rol ?? '', track: e.track ?? 'C/I', research: e.research ?? false, estado: e.estado ?? 'pend' },
      }
    })
  return { walls, wallHeight }
}

/** A frame id → a filesystem/URL-safe doc id, e.g. `2-E-TEXT+CODE` → `marco-2-e-text-code`. */
function docIdFor(frame) {
  const slug = frame.id
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (ó → o)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `marco-${slug}`
}

const fmtM = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

function docFor(frame, wallsByInv) {
  const tema = wallsByInv.get(frame.invId)?.registry?.tema ?? ''
  return {
    id: docIdFor(frame),
    title: `Marco vacío ${frame.id} — ${tema} (${fmtM(frame.widthM)}×${fmtM(frame.heightM)} m)`,
    createdAt: CREATED_AT,
    pageComponentId: 'blank',
    theme: 'light',
    dimensions: {
      trimWidthMm: Math.round(frame.widthM * 1000),
      trimHeightMm: Math.round(frame.heightM * 1000),
      bleedMm: 10,
      safeMarginMm: 0,
      cropMarks: false,
    },
    dpi: DPI,
    color: { mode: 'cmyk', iccProfile: 'icc/PSOuncoated_v3_FOGRA52.icc', renderIntent: 'perceptual', pdfxVariant: 'x1a' },
    // NB: the wall reference is `frameWallInvId`, NOT `invId` — a numeric
    // `props.invId` is the authored-print↔wall join key (control-table / legibility
    // / coverage), and frames must stay out of that 1-print-per-wall join.
    props: { frameWallInvId: frame.invId, wallId: frame.wallId, frameId: frame.id, side: frame.side, ...(frame.zone ? { zone: frame.zone } : {}) },
  }
}

function main() {
  const { walls, wallHeight } = loadWalls()
  const registered = walls.filter((w) => w.registry).sort((a, b) => a.registry.invId - b.registry.invId)
  const wallsByInv = new Map(registered.map((w) => [w.registry.invId, w]))
  const frames = computeWallFrames({ walls: registered, allWalls: walls, fallbackHeight: wallHeight })

  // Drop any previously-generated frame docs so removed segments don't linger.
  let removed = 0
  for (const entry of readdirSync(PRINTS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('marco-')) {
      rmSync(join(PRINTS_DIR, entry.name), { recursive: true, force: true })
      removed += 1
    }
  }

  for (const frame of frames) {
    const doc = docFor(frame, wallsByInv)
    const dir = join(PRINTS_DIR, doc.id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'doc.json'), JSON.stringify(doc, null, 2) + '\n')
  }

  console.log(`Wrote ${frames.length} blank-frame doc(s) to public/prints/marco-* (removed ${removed} stale).`)
}

main()
