/**
 * export-print — render a print document to a print-ready file.
 * ──────────────────────────────────────────────────────────────
 * Reads public/prints/<id>/doc.json, renders the `PrintPage` Remotion composition
 * (sized to the doc's media via calculateMetadata) to a still PNG at the doc's DPI,
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
 *   --dpi <n>              override the doc DPI (default: doc.dpi)
 *   --quality <1-100>      JPG quality (default 92)
 *   --guides              draw preview trim/safe guides (debug; png only)
 *   --out <dir>           output dir (default out/prints)
 *
 * Pipeline (pdf): renderStill PNG → magick PNG→sized RGB PDF → Ghostscript
 * sRGB→CMYK PDF/X + OutputIntent + Trim/Bleed boxes. Verified with pdfinfo/mutool.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { pngToCmykPdfX, buildPdfxDef } from './lib/cmyk-pdf.mjs'
import { posterPdfBoxesPt } from '../src/print/pdfBoxes.ts'

const ROOT = process.cwd()
const ENTRY = 'src/remotion/index.ts'
const COMPOSITION_ID = 'PrintPage'

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
  const args = { id: null, format: 'pdf', dpi: null, quality: 92, guides: false, out: 'out/prints', bleed: null, marks: null }
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

async function renderPng(doc, guides, outPng) {
  const { bundle } = await import('@remotion/bundler')
  const { selectComposition, renderStill } = await import('@remotion/renderer')
  console.error(`Bundling ${ENTRY} …`)
  const serveUrl = await bundle({ entryPoint: path.resolve(ENTRY), webpackOverride: applyProjectWebpack })
  const inputProps = { doc, showGuides: guides }
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps })
  console.log(
    `${doc.id}: ${composition.width}×${composition.height}px @ ${doc.dpi}dpi ` +
      `(${doc.dimensions.trimWidthMm}×${doc.dimensions.trimHeightMm}mm + ${doc.dimensions.bleedMm}mm bleed)`,
  )
  mkdirSync(path.dirname(outPng), { recursive: true })
  await renderStill({ composition, serveUrl, output: outPng, inputProps, imageFormat: 'png', scale: 1 })
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
    console.error('Usage: node scripts/export-print.mjs <id> [--format png|jpg|pdf] [--dpi n] [--quality n] [--guides]')
    process.exit(1)
  }
  const doc = loadDoc(args.id)
  if (args.dpi) doc.dpi = args.dpi
  // Per-export overrides of bleed / crop marks (the doc.json stays untouched).
  if (args.bleed != null && Number.isFinite(args.bleed) && args.bleed >= 0) doc.dimensions.bleedMm = args.bleed
  if (args.marks === 'true') doc.dimensions.cropMarks = true
  else if (args.marks === 'false') doc.dimensions.cropMarks = false

  const outDir = args.out
  const outPng = path.join(outDir, `${doc.id}.png`)
  // Guides are a debug overlay — only ever for a png, never for a print deliverable.
  const wantGuides = args.guides && args.format === 'png'
  await renderPng(doc, wantGuides, outPng)

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

export { applyProjectWebpack, parseArgs, loadDoc, buildPdfxDef }
