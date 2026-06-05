#!/usr/bin/env node
/**
 * preview-prints — fast low-DPI PNG previews of many prints in one bundle.
 * ─────────────────────────────────────────────────────────────────────────
 * The design-iteration loop tool: bundles the Remotion entry ONCE, then renders
 * each requested print to a small PNG (DPI overridden low so a whole wall fits a
 * single screenshot and renders in a second or two). NOT a deliverable — this is
 * purely for eyeballing composition / spacing while re-laying out pages.
 *
 *   node scripts/preview-prints.mjs <id...> [--dpi n] [--out dir]
 *
 * Reuses the export pipeline's webpack override so aliases/loaders match.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { applyProjectWebpack } from './export-print.mjs'
import { mediaSizePx } from '../src/print/geometry.ts'

const ROOT = process.cwd()
const ENTRY = 'src/remotion/index.ts'
const COMPOSITION_ID = 'PrintPage'

function parseArgs(argv) {
  const args = { ids: [], dpi: 14, out: 'out/preview' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dpi') args.dpi = Number(argv[++i])
    else if (a === '--out') args.out = argv[++i]
    else args.ids.push(a)
  }
  return args
}

function loadDoc(id) {
  const p = path.join(ROOT, 'public', 'prints', id, 'doc.json')
  if (!existsSync(p)) throw new Error(`Document not found: ${p}`)
  return JSON.parse(readFileSync(p, 'utf8'))
}

async function main() {
  const { ids, dpi, out } = parseArgs(process.argv.slice(2))
  if (!ids.length) {
    console.error('Usage: node scripts/preview-prints.mjs <id...> [--dpi n] [--out dir]')
    process.exit(1)
  }
  const { bundle } = await import('@remotion/bundler')
  const { selectComposition, renderStill, openBrowser } = await import('@remotion/renderer')
  console.error(`Bundling ${ENTRY} …`)
  const serveUrl = await bundle({ entryPoint: path.resolve(ENTRY), webpackOverride: applyProjectWebpack })
  const browser = await openBrowser('chrome')
  mkdirSync(path.join(ROOT, out), { recursive: true })

  try {
    for (const id of ids) {
      let doc
      try {
        doc = loadDoc(id)
      } catch (e) {
        console.log(`  ✗ ${id}: ${e.message}`)
        continue
      }
      doc.dpi = dpi
      const { width, height } = mediaSizePx(doc.dimensions, dpi)
      const outPng = path.join(ROOT, out, `${id}.png`)
      const inputProps = { doc, showGuides: false }
      const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, puppeteerInstance: browser })
      await renderStill({ composition, serveUrl, output: outPng, inputProps, imageFormat: 'png', scale: 1, puppeteerInstance: browser })
      console.log(`  ✓ ${id.padEnd(24)} ${width}×${height}px  (${doc.dimensions.trimWidthMm}×${doc.dimensions.trimHeightMm}mm @ ${dpi}dpi) → ${path.relative(ROOT, outPng)}`)
    }
  } finally {
    try {
      await browser.close({ silent: true })
    } catch {
      /* ignore headless teardown quirk (see export-print) */
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
})
