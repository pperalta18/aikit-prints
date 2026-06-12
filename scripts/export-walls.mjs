#!/usr/bin/env node
/**
 * export-walls — batch-export every wall-mounted print to a CMYK PDF/X.
 * ────────────────────────────────────────────────────────────────────────
 * "Todos los prints que estén asociados a una pared." A print is wall-associated
 * when its `doc.props.frameId` matches a frame produced by `computeWallFrames`
 * (the geometry the 3D scene paints) — so this derives the SAME frame→doc join the
 * venue renders (`EventSpaceScene`'s `frameDocRank` tiebreak), keeps the real
 * (non-blank) winning page per frame, drops the inner cube faces (only the 4 outer
 * faces print) and emits one true-scale CMYK PDF/X per wall graphic.
 *
 *   node scripts/export-walls.mjs [--out <dir>] [--dpi 150] [--only a,b] [--list]
 *
 * The Remotion entry is bundled ONCE and reused across every print (the bundle is
 * the per-call overhead). Exports run SEQUENTIALLY: a 22 m nave wall at 150 ppp is
 * ~2.3 Gpx, so its intermediate master PNG is multi-GB — running these in parallel
 * would exhaust memory. Each PNG is deleted the moment its PDF is written. Already
 * exported PDFs are skipped, so a killed run resumes where it left off.
 *
 * Black faces (painted, not printed) and blank placeholders are excluded by design.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { applyProjectWebpack, renderPng } from './export-print.mjs'
import { pngToCmykPdfX } from './lib/cmyk-pdf.mjs'
import { posterPdfBoxesPt } from '../src/print/pdfBoxes.ts'
import { EXPORT_DPI, mediaSizePx } from '../src/print/geometry.ts'
import { computeWallFrames, PARED_COMPLETA_FACES } from '../src/print/space/wallFrames.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = 'src/remotion/index.ts'
const PRINTS_DIR = path.join(ROOT, 'public', 'prints')
const DEFAULT_OUT = '/Users/pabloperalta/Desktop/AiKit Live/prints/exports/Prints'

/** Build the `Wall[]` exactly as `eventLayout.ts` / `generate-frames.mjs` does. */
function loadWalls() {
  const layout = JSON.parse(readFileSync(path.join(ROOT, 'src/print/space/event-layout.json'), 'utf8'))
  const offX = -layout.spaceWidth / 2
  const offZ = -layout.spaceDepth / 2
  const wh = typeof layout.wallHeight === 'number' && layout.wallHeight > 0 ? layout.wallHeight : 2.5
  const walls = layout.elements
    .filter((e) => e.type === 'wall')
    .map((e, i) => {
      const sx = e.w
      const sz = e.h
      const na = sx <= sz ? 'x' : 'z'
      const explicit = typeof e.alturaM === 'number' && e.alturaM > 0
      return {
        id: `wall-${i}`,
        cx: e.x + e.w / 2 + offX,
        cz: e.y + e.h / 2 + offZ,
        sx,
        sz,
        normalAxis: na,
        length: na === 'x' ? sz : sx,
        thickness: na === 'x' ? sx : sz,
        height: explicit ? e.alturaM : wh,
        hasExplicitHeight: explicit,
        registry:
          e.invId == null
            ? undefined
            : { invId: e.invId, sala: e.sala ?? '', tema: e.tema ?? '', rol: e.rol ?? '', track: e.track ?? 'C/I', research: e.research ?? false, estado: e.estado ?? 'pend' },
      }
    })
  return { walls, wh }
}

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** EventSpaceScene's frameDocRank: real page beats blank; user override beats canonical. */
const frameDocRank = (d) => {
  const fid = d?.props?.frameId
  const canon = typeof fid === 'string' && d.id === slug(fid)
  return (d.pageComponentId !== 'blank' ? 2 : 0) + (canon ? 0 : 1)
}

/**
 * Derive the wall-graphic print list: the winning (non-blank) doc per wall frame,
 * minus the inner faces of the central cube cluster (only the 4 outer faces print).
 * Returns rows sorted by wall invId then code — the venue's rendered ground truth.
 */
function deriveWallPrints() {
  const { walls, wh } = loadWalls()
  const registered = walls.filter((w) => w.registry).sort((a, b) => a.registry.invId - b.registry.invId)
  const frames = computeWallFrames({ walls: registered, allWalls: walls, fallbackHeight: wh, fullFaces: PARED_COMPLETA_FACES })
  const wallById = new Map(walls.map((w) => [w.id, w]))

  const docs = []
  for (const d of readdirSync(PRINTS_DIR, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    try {
      docs.push(JSON.parse(readFileSync(path.join(PRINTS_DIR, d.name, 'doc.json'), 'utf8')))
    } catch {
      /* skip unreadable */
    }
  }
  const docByFrame = new Map()
  for (const d of docs) {
    const fid = d?.props?.frameId
    if (typeof fid !== 'string' || !fid) continue
    const cur = docByFrame.get(fid)
    if (!cur || frameDocRank(d) > frameDocRank(cur)) docByFrame.set(fid, d)
  }

  const cand = []
  for (const f of frames) {
    const d = docByFrame.get(f.id)
    if (!d || d.pageComponentId === 'blank') continue
    const w = wallById.get(f.wallId)
    const face = w.normalAxis === 'x' ? (f.side > 0 ? 'E' : 'W') : (f.side > 0 ? 'S' : 'N')
    cand.push({
      id: d.id,
      invId: f.invId,
      face,
      side: f.side,
      page: d.pageComponentId,
      wall: w,
      trimWidthMm: d.dimensions?.trimWidthMm,
      trimHeightMm: d.dimensions?.trimHeightMm,
    })
  }
  // Cube cluster: keep only the faces looking OUTWARD from the cluster centroid.
  const cube = cand.filter((c) => c.page === 'cubo-cara')
  if (cube.length) {
    const cZ = cube.reduce((s, c) => s + c.wall.cz, 0) / cube.length
    const cX = cube.reduce((s, c) => s + c.wall.cx, 0) / cube.length
    for (const c of cube) {
      const outer = c.wall.normalAxis === 'z' ? (c.wall.cz >= cZ ? 1 : -1) : (c.wall.cx >= cX ? 1 : -1)
      c._inner = c.side !== outer
    }
  }
  return cand.filter((c) => !c._inner).sort((a, b) => a.invId - b.invId || a.id.localeCompare(b.id))
}

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, dpi: EXPORT_DPI, only: null, exclude: null, list: false, bleed: null, marks: null, concurrency: 1, pxBudget: 1_400_000_000 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') args.out = argv[++i]
    else if (a === '--dpi') args.dpi = Number(argv[++i])
    else if (a === '--only') args.only = new Set(argv[++i].split(',').map((s) => s.trim().toLowerCase()))
    else if (a === '--exclude') args.exclude = new Set(argv[++i].split(',').map((s) => s.trim().toLowerCase()))
    else if (a === '--bleed') args.bleed = Number(argv[++i]) // per-export bleed override (mm)
    else if (a === '--marks') args.marks = argv[++i] // 'true' | 'false' — crop marks
    else if (a === '--concurrency') args.concurrency = Math.max(1, Number(argv[++i]) || 1)
    else if (a === '--px-budget') args.pxBudget = Math.max(1, Number(argv[++i]) || 1) * 1e9 // Gpx in-flight cap
    else if (a === '--list') args.list = true
  }
  return args
}

const fmtMB = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`
const fmtDur = (ms) => `${(ms / 1000).toFixed(0)}s`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  let rows = deriveWallPrints()
  if (args.only) rows = rows.filter((r) => args.only.has(r.id.toLowerCase()))
  if (args.exclude) rows = rows.filter((r) => !args.exclude.has(r.id.toLowerCase()))

  console.log(`Wall-associated prints: ${rows.length}`)
  for (const r of rows) {
    const wmm = (r.trimWidthMm / 1000).toFixed(2)
    const hmm = (r.trimHeightMm / 1000).toFixed(2)
    console.log(`  ${r.id.padEnd(14)} #${String(r.invId).padStart(2)}·${r.face}  ${wmm}×${hmm} m  [${r.page}]`)
  }
  if (args.list) return

  mkdirSync(args.out, { recursive: true })
  const workDir = path.join(ROOT, 'out', '_wallrender')
  mkdirSync(workDir, { recursive: true })

  // One bundle for the whole batch.
  const { bundle } = await import('@remotion/bundler')
  console.log(`\nBundling ${ENTRY} once …`)
  const serveUrl = await bundle({ entryPoint: path.resolve(ENTRY), webpackOverride: applyProjectWebpack })

  const manifest = []
  let done = 0
  let skipped = 0
  let failed = 0
  const t0 = Date.now()
  for (const r of rows) {
    const i = manifest.length + 1
    const outPdf = path.join(args.out, `${r.id}.pdf`)
    if (existsSync(outPdf) && statSync(outPdf).size > 0) {
      console.log(`[${i}/${rows.length}] ${r.id} — skip (PDF exists)`) // resumable
      skipped++
      manifest.push({ id: r.id, status: 'skipped', pdf: outPdf, bytes: statSync(outPdf).size })
      continue
    }
    const doc = JSON.parse(readFileSync(path.join(PRINTS_DIR, r.id, 'doc.json'), 'utf8'))
    doc.dpi = args.dpi
    // Per-export overrides (doc.json untouched): bleed (mm) + crop marks.
    if (args.bleed != null && Number.isFinite(args.bleed) && args.bleed >= 0) doc.dimensions.bleedMm = args.bleed
    if (args.marks === 'true') doc.dimensions.cropMarks = true
    else if (args.marks === 'false') doc.dimensions.cropMarks = false
    const outPng = path.join(workDir, `${r.id}.png`)
    const { width, height } = mediaSizePx(doc.dimensions, doc.dpi)
    const ts = Date.now()
    console.log(`\n[${i}/${rows.length}] ${r.id} — ${width}×${height}px @ ${doc.dpi}dpi (${(width * height / 1e6).toFixed(0)} Mpx)`)
    try {
      await renderPng(doc, false, outPng, 8000, serveUrl)
      await pngToCmykPdfX({
        png: outPng,
        outPdf,
        dpi: doc.dpi,
        makeBoxes: (W, H) => posterPdfBoxesPt(W, H, doc.dimensions.bleedMm),
        color: doc.color,
        idTag: doc.id,
      })
      const bytes = statSync(outPdf).size
      console.log(`  ✓ ${path.basename(outPdf)} (${fmtMB(bytes)}, ${fmtDur(Date.now() - ts)})`)
      manifest.push({ id: r.id, status: 'ok', invId: r.invId, face: r.face, page: r.page, trimWidthMm: r.trimWidthMm, trimHeightMm: r.trimHeightMm, pdf: outPdf, bytes, seconds: Math.round((Date.now() - ts) / 1000) })
      done++
    } catch (err) {
      console.error(`  ✗ ${r.id} FAILED: ${err instanceof Error ? err.message : err}`)
      manifest.push({ id: r.id, status: 'failed', error: String(err && err.message || err) })
      failed++
    } finally {
      rmSync(outPng, { force: true })
    }
  }

  writeFileSync(path.join(args.out, '_export-manifest.json'), JSON.stringify({ generatedAt: null, dpi: args.dpi, out: args.out, total: rows.length, done, skipped, failed, prints: manifest }, null, 2) + '\n')
  // Best-effort cleanup of the working dir.
  try { rmSync(workDir, { recursive: true, force: true }) } catch { /* ignore */ }
  console.log(`\nDONE — ${done} exported, ${skipped} skipped, ${failed} failed of ${rows.length}  (${fmtDur(Date.now() - t0)})`)
  console.log(`→ ${args.out}`)
  if (failed) process.exitCode = 1
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
})
