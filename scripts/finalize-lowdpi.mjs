#!/usr/bin/env node
/**
 * finalize-lowdpi — turn a verified lower-DPI master PNG into a 150-ppp CMYK PDF/X.
 * ─────────────────────────────────────────────────────────────────────────────
 * A handful of image-dense wall prints (cuadro / mosaico / pared-combinada) have a
 * single image *element* wider than ~32767 px at 150 ppp — Chromium/Skia's max
 * bitmap dimension — so `<Img>.decode()` fails on the tiled render and those images
 * drop out. They DO render whole at a lower DPI (smaller element px). This takes
 * that verified low-DPI master and resamples it to the exact 150-ppp pixel size,
 * then runs the SAME CMYK PDF/X pipeline (real-scale boxes, FOGRA52, brand override)
 * so the deliverable is uniform 150 ppp.
 *
 *   node scripts/finalize-lowdpi.mjs <id> --src <png> --out <dir>
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { pngToCmykPdfX } from './lib/cmyk-pdf.mjs'
import { posterPdfBoxesPt } from '../src/print/pdfBoxes.ts'
import { mediaSizePx, EXPORT_DPI } from '../src/print/geometry.ts'

const ROOT = process.cwd()

function parse(argv) {
  const a = { id: null, src: null, out: 'out/prints' }
  const pos = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src') a.src = argv[++i]
    else if (argv[i] === '--out') a.out = argv[++i]
    else if (argv[i] === '--bleed') a.bleed = Number(argv[++i])
    else pos.push(argv[i])
  }
  a.id = pos[0]
  return a
}

async function main() {
  const args = parse(process.argv.slice(2))
  const doc = JSON.parse(readFileSync(path.join(ROOT, 'public/prints', args.id, 'doc.json'), 'utf8'))
  // Bleed override must match the bleed the low-DPI source PNG was rendered with, so
  // the 150-ppp target pixel size and the PDF boxes stay consistent (real scale).
  if (args.bleed != null && Number.isFinite(args.bleed) && args.bleed >= 0) doc.dimensions.bleedMm = args.bleed
  const src = args.src ?? path.join('out/_fix2', `${args.id}.png`)
  if (!existsSync(src)) throw new Error(`source PNG not found: ${src}`)
  const { width, height } = mediaSizePx(doc.dimensions, EXPORT_DPI) // exact 150-ppp pixel size
  mkdirSync(args.out, { recursive: true })
  const up = path.join('out/_fix2', `${args.id}.up150.png`)
  // Resample to the exact 150-ppp media pixel size. It's only a mild ~1.25× upscale,
  // so a Triangle (bilinear) filter is plenty and avoids Lanczos's huge kernel cost on
  // a gigapixel canvas. Give ImageMagick a big RAM budget (the box has tens of GB
  // free) so it keeps the pixel cache in memory instead of disk-thrashing.
  console.log(`${args.id}: resample → ${width}×${height}px (150 ppp)`)
  execFileSync('magick', ['-limit', 'memory', '24GiB', '-limit', 'map', '24GiB', src, '-filter', 'Triangle', '-resize', `${width}x${height}!`, up], { stdio: ['ignore', 'inherit', 'inherit'] })
  const outPdf = path.join(args.out, `${args.id}.pdf`)
  await pngToCmykPdfX({
    png: up,
    outPdf,
    dpi: EXPORT_DPI,
    makeBoxes: (W, H) => posterPdfBoxesPt(W, H, doc.dimensions.bleedMm),
    color: doc.color,
    idTag: doc.id,
  })
  rmSync(up, { force: true })
  console.log(`✓ ${outPdf} (${(statSync(outPdf).size / 1e6).toFixed(1)} MB)`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exit(1)
})
