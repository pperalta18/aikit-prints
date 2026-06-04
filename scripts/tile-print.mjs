/**
 * tile-print — slice a wall-sized render into printable panels (and back).
 * ────────────────────────────────────────────────────────────────────────
 * The AiKit Live walls are produced at real size — the hero (wall-2) is 22.5 m and
 * Naranja Mecánica (wall-4) is 28.5 m. No press outputs a 28 m image and no raster
 * pipeline renders one, so each wall ships as a row (or grid) of overlapping
 * panels the installer laps on the wall. This wraps the pure tiling geometry
 * (`src/print/tiling.ts`) with ImageMagick to actually cut the master raster — and
 * to recompose the panels into a single preview so you can confirm the slice is
 * lossless before sending it to print.
 *
 *   node scripts/tile-print.mjs <input.png> [options]
 *   npm run tile -- <input.png> [options]
 *
 * Options:
 *   --doc <id>           pull media size (mm) + dpi from public/prints/<id>/doc.json
 *                        (input then defaults to out/prints/<id>.png; base = id)
 *   --max-width <mm>     max printable panel width  (default 1500 — a 1.5 m roll)
 *   --max-height <mm>    max printable panel height (default: none → a single row)
 *   --overlap <mm>       shared seam between adjacent panels (default 20)
 *   --dpi <n>            raster DPI (default: doc dpi, else 150)
 *   --media-width <mm>   media width  (default: doc, else inferred from px/dpi)
 *   --media-height <mm>  media height (default: doc, else inferred from px/dpi)
 *   --out <dir>          output dir (default out/tiles/<base>)
 *   --recompose          stitch the panels in <out> back into <base>_preview.png
 *   --pdf                also wrap each PNG panel into a press-ready CMYK PDF/X
 *                        (<base>_tileN.pdf). Requires --doc (CMYK/ICC come from it).
 *   --plan-only          print the tile plan as JSON; touch no files
 *
 * Naming: <base>_tileN.png (1-based, row-major), matching the spec convention
 *         pared-{id}_{sala}_{slug}_tileN.png. A manifest.json records the plan.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { planTiles, tileName, panelEdges } from '../src/print/tiling.ts'
import { mediaSizeMm } from '../src/print/geometry.ts'
import { panelPdfBoxesPt } from '../src/print/pdfBoxes.ts'
import { pngToCmykPdfX } from './lib/cmyk-pdf.mjs'

const ROOT = process.cwd()
const MM_PER_INCH = 25.4

function parseArgs(argv) {
  const args = {
    input: null,
    doc: null,
    maxWidth: 1500,
    maxHeight: Infinity,
    overlap: 20,
    dpi: null,
    mediaWidth: null,
    mediaHeight: null,
    out: null,
    recompose: false,
    pdf: false,
    planOnly: false,
  }
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--recompose') args.recompose = true
    else if (a === '--pdf') args.pdf = true
    else if (a === '--plan-only') args.planOnly = true
    else if (a === '--doc') args.doc = argv[++i]
    else if (a === '--max-width') args.maxWidth = Number(argv[++i])
    else if (a === '--max-height') args.maxHeight = Number(argv[++i])
    else if (a === '--overlap') args.overlap = Number(argv[++i])
    else if (a === '--dpi') args.dpi = Number(argv[++i])
    else if (a === '--media-width') args.mediaWidth = Number(argv[++i])
    else if (a === '--media-height') args.mediaHeight = Number(argv[++i])
    else if (a === '--out') args.out = argv[++i]
    else positionals.push(a)
  }
  args.input = positionals[0] ?? null
  return args
}

/** Run a binary, surface stderr on failure. */
function run(cmd, cmdArgs) {
  try {
    return execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  } catch (err) {
    const stderr = err?.stderr?.toString?.() ?? ''
    throw new Error(`${cmd} failed:\n${stderr || err.message}`)
  }
}

/** Pixel dimensions of a raster via ImageMagick `identify`. */
function identifyPx(file) {
  const out = run('magick', ['identify', '-format', '%w %h', file]).trim()
  const [w, h] = out.split(/\s+/).map(Number)
  if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error(`could not read size of ${file}`)
  return { width: w, height: h }
}

function loadDoc(id) {
  const p = path.join(ROOT, 'public', 'prints', id, 'doc.json')
  if (!existsSync(p)) throw new Error(`doc.json not found: ${p}`)
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** Resolve input path, base name, media mm and dpi from flags ± a doc. */
function resolveSource(args) {
  let { input, dpi, mediaWidth, mediaHeight } = args
  let base = null

  if (args.doc) {
    const doc = loadDoc(args.doc)
    base = doc.id
    dpi = dpi ?? doc.dpi
    const media = mediaSizeMm(doc.dimensions)
    mediaWidth = mediaWidth ?? media.widthMm
    mediaHeight = mediaHeight ?? media.heightMm
    input = input ?? path.join('out', 'prints', `${doc.id}.png`)
  }

  if (!input) throw new Error('no input image (give a path, or --doc <id> with out/prints/<id>.png present)')
  if (!existsSync(input)) throw new Error(`input image not found: ${input}`)
  base = base ?? path.basename(input).replace(/\.[^.]+$/, '')
  dpi = dpi ?? 150

  // Image-only: infer the media size from the pixels at the given dpi.
  const px = identifyPx(input)
  if (mediaWidth == null) mediaWidth = (px.width / dpi) * MM_PER_INCH
  if (mediaHeight == null) mediaHeight = (px.height / dpi) * MM_PER_INCH

  return { input, base, dpi, mediaWidth, mediaHeight, px }
}

/** Clamp a crop rect to the real raster bounds (guards off-by-one rounding). */
function clampCrop(t, px) {
  const x = Math.max(0, Math.min(t.xPx, px.width))
  const y = Math.max(0, Math.min(t.yPx, px.height))
  const w = Math.max(1, Math.min(t.widthPx, px.width - x))
  const h = Math.max(1, Math.min(t.heightPx, px.height - y))
  return { x, y, w, h }
}

function slice({ input, base, plan, outDir, px }) {
  mkdirSync(outDir, { recursive: true })
  const files = []
  for (const t of plan.tiles) {
    const { x, y, w, h } = clampCrop(t, px)
    const name = tileName(`${base}.png`, t.index)
    const outFile = path.join(outDir, name)
    // +repage drops the virtual-canvas offset so each panel is a clean WxH image.
    run('magick', [input, '-crop', `${w}x${h}+${x}+${y}`, '+repage', outFile])
    files.push({ index: t.index, col: t.col, row: t.row, file: name, x, y, w, h, widthMm: t.widthMm, heightMm: t.heightMm })
    console.log(`  tile ${t.index}/${plan.count}  ${w}×${h}px  (${t.widthMm}×${t.heightMm}mm)  → ${name}`)
  }
  return files
}

/**
 * Wrap each sliced PNG panel into a press-ready CMYK PDF/X (`<base>_tileN.pdf`).
 * The colour/ICC/render-intent come from the doc; the page boxes come from
 * `panelPdfBoxesPt` — a lapped wall panel is full-bleed (MediaBox = BleedBox =
 * panel) and its TrimBox marks the finished wall edge only on the panel sides that
 * meet the master's outer media border. Mutates each `files[i].pdf`.
 */
async function slicePdfs({ doc, dpi, outDir, base, plan, files }) {
  for (const f of files) {
    const png = path.join(outDir, f.file)
    const pdfName = tileName(`${base}.pdf`, f.index)
    const outPdf = path.join(outDir, pdfName)
    const edges = panelEdges({ col: f.col, row: f.row }, plan.cols, plan.rows)
    await pngToCmykPdfX({
      png,
      outPdf,
      dpi,
      makeBoxes: (W, H) => panelPdfBoxesPt(W, H, doc.dimensions.bleedMm, edges),
      color: doc.color,
      idTag: `${base}-tile${f.index}`,
    })
    f.pdf = pdfName
    console.log(`  pdf  ${f.index}/${plan.count}  → ${pdfName} (${doc.color.pdfxVariant}, ICC ${path.basename(doc.color.iccProfile)})`)
  }
}

/** Composite the panels back at their offsets to verify a lossless slice. */
function recompose({ plan, outDir, base, files }) {
  const preview = path.join(outDir, `${base}_preview.png`)
  const argv = ['-size', `${plan.mediaWidthPx}x${plan.mediaHeightPx}`, 'xc:white']
  for (const f of files) {
    const fp = path.join(outDir, f.file)
    if (!existsSync(fp)) throw new Error(`missing panel for recompose: ${fp}`)
    argv.push(fp, '-geometry', `+${f.x}+${f.y}`, '-composite')
  }
  argv.push(preview)
  run('magick', argv)
  console.log(`recompose → ${preview} (${plan.mediaWidthPx}×${plan.mediaHeightPx}px)`)
  return preview
}

function writeManifest({ outDir, base, input, dpi, mediaWidth, mediaHeight, plan, files }) {
  const manifest = {
    base,
    source: input,
    dpi,
    mediaWidthMm: Math.round(mediaWidth * 100) / 100,
    mediaHeightMm: Math.round(mediaHeight * 100) / 100,
    cols: plan.cols,
    rows: plan.rows,
    count: plan.count,
    overlapMm: plan.overlapMm,
    tiles: files,
  }
  const p = path.join(outDir, 'manifest.json')
  writeFileSync(p, JSON.stringify(manifest, null, 2))
  console.log(`manifest → ${p}`)
  return manifest
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  // Fail fast before slicing: CMYK PDF/X panels need the doc's colour profile + ICC.
  if (args.pdf && !args.doc) {
    throw new Error('--pdf requires --doc <id> — the CMYK colour profile and ICC come from the doc.json')
  }
  const src = resolveSource(args)
  const outDir = args.out ?? path.join('out', 'tiles', src.base)

  const plan = planTiles({
    mediaWidthMm: src.mediaWidth,
    mediaHeightMm: src.mediaHeight,
    dpi: src.dpi,
    maxPanelWidthMm: args.maxWidth,
    maxPanelHeightMm: args.maxHeight,
    overlapMm: args.overlap,
  })

  console.log(
    `${src.base}: ${Math.round(src.mediaWidth)}×${Math.round(src.mediaHeight)}mm @ ${src.dpi}dpi ` +
      `(${src.px.width}×${src.px.height}px) → ${plan.cols}×${plan.rows} = ${plan.count} panel(s), ` +
      `≤${args.maxWidth}mm wide, ${args.overlap}mm overlap`,
  )

  if (args.planOnly) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  if (!plan.tiled) {
    console.log('media fits one panel — nothing to tile (use a smaller --max-width to force a split).')
  }

  if (args.recompose) {
    // Recompose from a prior slice's manifest (offsets + filenames).
    const manifestPath = path.join(outDir, 'manifest.json')
    if (!existsSync(manifestPath)) throw new Error(`no manifest at ${manifestPath} — run a slice first`)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    recompose({ plan, outDir, base: src.base, files: manifest.tiles })
    return
  }

  const files = slice({ input: src.input, base: src.base, plan, outDir, px: src.px })

  if (args.pdf) {
    const doc = loadDoc(args.doc)
    await slicePdfs({ doc, dpi: src.dpi, outDir, base: src.base, plan, files })
  }

  writeManifest({ outDir, base: src.base, input: src.input, dpi: src.dpi, mediaWidth: src.mediaWidth, mediaHeight: src.mediaHeight, plan, files })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}

export { parseArgs, resolveSource, clampCrop }
