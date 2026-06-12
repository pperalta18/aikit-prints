/**
 * export-print — render a print document to a print-ready file.
 * ──────────────────────────────────────────────────────────────
 * Reads public/prints/<id>/doc.json, renders the `PrintPage` Remotion composition
 * (sized to the doc's media via calculateMetadata) to a still PNG at the EXPORT_DPI
 * standard (150 ppp; the doc's own low DPI is preview-only) — override with --dpi —
 * then emits — per --format:
 *   png  the rendered raster (sRGB, the master)
 *   jpg  a quality-controlled sRGB JPEG
 *   pdf  a true CMYK PDF/X with the doc's ICC profile as OutputIntent and correct
 *        MediaBox / BleedBox / TrimBox (the press deliverable)
 *
 *   node scripts/export-print.mjs <id> [options]
 *   npm run export -- <id> [options]
 *
 * Options:
 *   --format png|jpg|pdf   output format (default pdf)
 *   --dpi <n>              override the export DPI (default: 150, the EXPORT_DPI standard)
 *   --quality <1-100>      JPG quality (default 92)
 *   --guides              draw preview trim/safe guides (debug; png only)
 *   --out <dir>           output dir (default out/prints)
 *   --max-render-px <n>   per-tile screenshot cap, each side (default 8000). Walls
 *                         larger than this are rendered as a stitched tile grid
 *                         instead of one screenshot Chrome can't take.
 *
 * Wall-sized prints (e.g. 12 m @ 150 dpi ≈ 1 Gpx) exceed Chrome's single-screenshot
 * memory. The renderer then splits the media into a no-overlap grid of render-tiles
 * (≤ --max-render-px/side), renders each, and stitches them losslessly into the
 * master PNG — transparently; the PDF/JPG/tiling steps see the same master as before.
 *
 * Pipeline (pdf): renderStill PNG → magick PNG→sized RGB PDF → Ghostscript
 * sRGB→CMYK PDF/X + OutputIntent + Trim/Bleed boxes. Verified with pdfinfo/mutool.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { pngToCmykPdfX, buildPdfxDef } from './lib/cmyk-pdf.mjs'
import { posterPdfBoxesPt } from '../src/print/pdfBoxes.ts'
import { mediaSizeMm, mediaSizePx, MM_PER_INCH, EXPORT_DPI } from '../src/print/geometry.ts'
import { planTiles } from '../src/print/tiling.ts'

const ROOT = process.cwd()
const ENTRY = 'src/remotion/index.ts'
const COMPOSITION_ID = 'PrintPage'
/**
 * Per-render-tile pixel cap (each side). Chrome takes the still as a single
 * `Page.captureScreenshot`, which runs out of memory long before a wall-sized
 * raster (e.g. 72461×14882 ≈ 1.08 Gpx) fits. When a render must be tiled, each tile
 * is held to this on both axes (8000² ≈ 64 Mpx ≈ 256 MB bitmap — a comfortable
 * single screenshot; also under Chrome's 8192-px fast-path threshold).
 */
const DEFAULT_MAX_RENDER_PX = 8000
/**
 * When to tile at all. A render goes through one screenshot if it fits both: a
 * per-side ceiling and a total-area (bitmap-memory) budget. ~96 Mpx and 16k/side
 * keep ordinary walls (even a 12 m wall at its native low DPI) a single fast shot,
 * while gigapixel walls trip the budget and fall back to the stitched tile grid.
 * AREA_CAP > DEFAULT_MAX_RENDER_PX² guarantees a tripped budget always has an axis
 * the tile cap can actually split.
 */
const SINGLE_SHOT_DIM_CAP = 16000
const SINGLE_SHOT_AREA_CAP = 96_000_000

/** Mirror remotion.config.ts for the programmatic bundle: @→src + .riv + ?raw. */
function applyProjectWebpack(current) {
  return {
    ...current,
    resolve: {
      ...current.resolve,
      alias: { ...(current.resolve?.alias ?? {}), '@': path.join(ROOT, 'src') },
    },
    module: {
      ...current.module,
      rules: [
        ...(current.module?.rules ?? []),
        { test: /\.riv$/, type: 'asset/resource' },
        { resourceQuery: /raw/, type: 'asset/source' },
      ],
    },
  }
}

function parseArgs(argv) {
  const args = { id: null, format: 'pdf', dpi: null, quality: 92, guides: false, out: 'out/prints', bleed: null, marks: null, maxRenderPx: DEFAULT_MAX_RENDER_PX }
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--guides') args.guides = true
    else if (a === '--format') args.format = argv[++i]
    else if (a === '--dpi') args.dpi = Number(argv[++i])
    else if (a === '--quality') args.quality = Number(argv[++i])
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--bleed') args.bleed = Number(argv[++i])
    else if (a === '--marks') args.marks = argv[++i] // 'true' | 'false'
    else if (a === '--max-render-px') args.maxRenderPx = Number(argv[++i])
    else positionals.push(a)
  }
  args.id = positionals[0] ?? null
  return args
}

function loadDoc(id) {
  const p = path.join(ROOT, 'public', 'prints', id, 'doc.json')
  if (!existsSync(p)) {
    console.error(`Document not found: ${p}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** Run a binary, capture stdout; on failure surface stderr and rethrow. */
function run(cmd, cmdArgs) {
  try {
    return execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  } catch (err) {
    const stderr = err?.stderr?.toString?.() ?? ''
    throw new Error(`${cmd} failed:\n${stderr || err.message}`)
  }
}

/**
 * Stitch a grid of abutting render-tiles back into the full master raster. The
 * tiles have NO overlap and cover [0,W)×[0,H) exactly, so a flat composite at each
 * tile's offset reconstructs the master losslessly. ImageMagick is held to a modest
 * memory limit (it spills the wall-sized pixel cache to MAGICK_TMPDIR) so stitching
 * a gigapixel canvas never OOMs the way the single Chrome screenshot did.
 */
function stitchTiles(parts, mediaWidthPx, mediaHeightPx, outPng) {
  const argv = [
    '-limit', 'memory', '1GiB', '-limit', 'map', '4GiB',
    '-size', `${mediaWidthPx}x${mediaHeightPx}`, 'xc:white',
  ]
  for (const p of parts) argv.push(p.file, '-geometry', `+${p.x}+${p.y}`, '-composite')
  argv.push(outPng)
  run('magick', argv)
}

async function renderPng(doc, guides, outPng, maxRenderPx, prebuiltServeUrl = null) {
  const { selectComposition, renderStill, openBrowser } = await import('@remotion/renderer')
  // Reuse a caller-supplied bundle (batch exporter) so the Remotion webpack build
  // runs once across many prints; fall back to a one-off bundle for a single export.
  let serveUrl = prebuiltServeUrl
  if (!serveUrl) {
    const { bundle } = await import('@remotion/bundler')
    console.error(`Bundling ${ENTRY} …`)
    serveUrl = await bundle({ entryPoint: path.resolve(ENTRY), webpackOverride: applyProjectWebpack })
  }

  const { width: fullW, height: fullH } = mediaSizePx(doc.dimensions, doc.dpi)
  console.log(
    `${doc.id}: ${fullW}×${fullH}px @ ${doc.dpi}dpi ` +
      `(${doc.dimensions.trimWidthMm}×${doc.dimensions.trimHeightMm}mm + ${doc.dimensions.bleedMm}mm bleed)`,
  )
  mkdirSync(path.dirname(outPng), { recursive: true })

  // Whole-media render whenever it comfortably fits one screenshot.
  const fitsOneShot = fullW <= SINGLE_SHOT_DIM_CAP && fullH <= SINGLE_SHOT_DIM_CAP && fullW * fullH <= SINGLE_SHOT_AREA_CAP
  if (fitsOneShot) {
    const inputProps = { doc, showGuides: guides }
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps })
    await renderStill({ composition, serveUrl, output: outPng, inputProps, imageFormat: 'png', scale: 1 })
    return
  }

  // Too big for one screenshot: plan a no-overlap grid of render-tiles, each ≤
  // maxRenderPx per side, by reusing the panel-tiling geometry with overlap 0 (its
  // border-pinned crops cover the media exactly, so the stitch is lossless).
  const media = mediaSizeMm(doc.dimensions)
  const maxRenderMm = (maxRenderPx / doc.dpi) * MM_PER_INCH
  const plan = planTiles({
    mediaWidthMm: media.widthMm,
    mediaHeightMm: media.heightMm,
    dpi: doc.dpi,
    maxPanelWidthMm: maxRenderMm,
    maxPanelHeightMm: maxRenderMm,
    overlapMm: 0,
  })

  console.log(
    `  too large for one screenshot → render-tiling into ${plan.cols}×${plan.rows} = ${plan.count} ` +
      `tiles (≤${maxRenderPx}px/side), stitching the master`,
  )
  // One headless browser shared across every tile's selectComposition + renderStill.
  const browser = await openBrowser('chrome')
  const tileDir = path.join(path.dirname(outPng), `.${doc.id}.rtiles`)
  mkdirSync(tileDir, { recursive: true })
  const parts = []
  try {
    for (const t of plan.tiles) {
      const viewport = { xPx: t.xPx, yPx: t.yPx, widthPx: t.widthPx, heightPx: t.heightPx }
      const inputProps = { doc, showGuides: guides, viewport }
      const tileOut = path.join(tileDir, `r${t.index}.png`)
      // selectComposition with the viewport resolves the composition to the tile size;
      // renderStill then screenshots just that window of the (translated) full media.
      const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, puppeteerInstance: browser })
      await renderStill({ composition, serveUrl, output: tileOut, inputProps, imageFormat: 'png', scale: 1, puppeteerInstance: browser })
      parts.push({ file: tileOut, x: t.xPx, y: t.yPx })
      console.log(`  render-tile ${t.index}/${plan.count}  ${t.widthPx}×${t.heightPx}px @ +${t.xPx}+${t.yPx}`)
    }
  } finally {
    // Remotion 4.0.471's HeadlessBrowser.close() destructures `{silent}` from its
    // argument, so a bare close() throws — and being in `finally` it would skip the
    // stitch and lose the master. Pass the arg and never let teardown abort the export.
    try {
      await browser.close({ silent: true })
    } catch {
      /* ignore the headless-browser teardown quirk */
    }
  }

  stitchTiles(parts, plan.mediaWidthPx, plan.mediaHeightPx, outPng)
  rmSync(tileDir, { recursive: true, force: true })
  console.log(`  stitched ${plan.count} tiles → ${fullW}×${fullH}px master`)
}

/** PNG → quality-controlled sRGB JPEG at the right DPI metadata. */
function toJpg(png, jpg, dpi, quality) {
  // -density/-units must precede the raster input so they set its resolution.
  run('magick', ['-units', 'PixelsPerInch', '-density', String(dpi), png, '-quality', String(quality), jpg])
}

/** Print a verification summary: page boxes (pdfinfo) + image colorspace (mutool). */
function verifyPdf(pdf) {
  console.log('— verify —')
  try {
    const info = run('pdfinfo', ['-box', pdf])
    for (const line of info.split('\n')) {
      if (/Page size|MediaBox|BleedBox|TrimBox|CropBox|PDF version/.test(line)) console.log('  ' + line.trim())
    }
  } catch (e) {
    console.log('  pdfinfo: ' + e.message.split('\n')[0])
  }
  try {
    const mu = run('mutool', ['info', pdf])
    const cs = mu.split('\n').filter((l) => /DevCMYK|DeviceCMYK|DevRGB|DeviceRGB/.test(l))
    if (cs.length) console.log('  colorspace: ' + cs.map((l) => l.trim()).join(' | '))
    const hasIntent = /GTS_PDFX/.test(readFileSync(pdf).toString('latin1'))
    console.log('  OutputIntent (PDF/X): ' + (hasIntent ? 'present' : 'MISSING'))
  } catch (e) {
    console.log('  mutool: ' + e.message.split('\n')[0])
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.id) {
    console.error('Usage: node scripts/export-print.mjs <id> [--format png|jpg|pdf] [--dpi n] [--quality n] [--guides] [--max-render-px n]')
    process.exit(1)
  }
  const doc = loadDoc(args.id)
  // Export standard: render at EXPORT_DPI (150) for every deliverable, regardless of
  // the doc's (low) preview DPI. `--dpi <n>` overrides for a one-off.
  doc.dpi = Number.isFinite(args.dpi) && args.dpi > 0 ? args.dpi : EXPORT_DPI
  // Per-export overrides of bleed / crop marks (the doc.json stays untouched).
  if (args.bleed != null && Number.isFinite(args.bleed) && args.bleed >= 0) doc.dimensions.bleedMm = args.bleed
  if (args.marks === 'true') doc.dimensions.cropMarks = true
  else if (args.marks === 'false') doc.dimensions.cropMarks = false

  const outDir = args.out
  const outPng = path.join(outDir, `${doc.id}.png`)
  // Guides are a debug overlay — only ever for a png, never for a print deliverable.
  const wantGuides = args.guides && args.format === 'png'
  await renderPng(doc, wantGuides, outPng, args.maxRenderPx)

  if (args.format === 'png') {
    console.log(`PNG → ${outPng}`)
    return
  }

  if (args.format === 'jpg' || args.format === 'jpeg') {
    const outJpg = path.join(outDir, `${doc.id}.jpg`)
    toJpg(outPng, outJpg, doc.dpi, args.quality)
    console.log(`JPG → ${outJpg} (q${args.quality}, ${doc.dpi}dpi, sRGB)`)
    return
  }

  if (args.format === 'pdf') {
    const outPdf = path.join(outDir, `${doc.id}.pdf`)
    // Whole poster: MediaBox/BleedBox = full media (art bleeds to the edge),
    // TrimBox = finished size inset by the bleed on every side.
    await pngToCmykPdfX({
      png: outPng,
      outPdf,
      dpi: doc.dpi,
      makeBoxes: (W, H) => posterPdfBoxesPt(W, H, doc.dimensions.bleedMm),
      color: doc.color,
      idTag: doc.id,
    })
    console.log(`CMYK PDF/X → ${outPdf} (${doc.color.pdfxVariant}, ICC ${path.basename(doc.color.iccProfile)})`)
    verifyPdf(outPdf)
    return
  }

  console.error(`Unknown --format "${args.format}" (use png|jpg|pdf)`)
  process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : err)
    process.exit(1)
  })
}

export { applyProjectWebpack, parseArgs, loadDoc, buildPdfxDef, renderPng }
