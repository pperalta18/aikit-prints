/**
 * verify-print — acceptance gate for the CMYK PDF/X export.
 * ──────────────────────────────────────────────────────────
 * Exports a print to PDF (unless --no-export) and asserts the press contract on
 * the actual bytes: page is true CMYK (DevCMYK image), PDF/X-1a (PDF 1.3) with a
 * GTS_PDFX OutputIntent, and the boxes are right — BleedBox = MediaBox (full
 * media) and TrimBox = finished size, inset from the media by the bleed.
 *
 *   node scripts/verify-print.mjs [id] [--no-export]
 *   npm run verify:print            (defaults to sample-a4)
 *
 * Mirrors the project's other verify:* gates (render/probe shell, hard verdict).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { mmToPt } from '../src/print/geometry.ts'

const TOL = 1.0 // pt tolerance for box geometry

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
}

function parseBox(info, name) {
  const m = info.match(new RegExp(`${name}:\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)`))
  return m ? m.slice(1, 5).map(Number) : null
}

function near(a, b, tol = TOL) {
  return Math.abs(a - b) <= tol
}
function boxNear(a, b) {
  return a && b && a.every((v, i) => near(v, b[i]))
}

function main() {
  const argv = process.argv.slice(2)
  const id = argv.find((a) => !a.startsWith('--')) ?? 'sample-a4'
  const noExport = argv.includes('--no-export')

  const docPath = path.join('public', 'prints', id, 'doc.json')
  if (!existsSync(docPath)) fail(`doc not found: ${docPath}`)
  const doc = JSON.parse(readFileSync(docPath, 'utf8'))
  const pdf = path.join('out', 'prints', `${id}.pdf`)

  if (!noExport) {
    console.error(`Exporting ${id} → PDF …`)
    execFileSync('node', ['scripts/export-print.mjs', id, '--format', 'pdf'], { stdio: 'inherit' })
  }
  if (!existsSync(pdf)) fail(`PDF not found: ${pdf} (run without --no-export)`)

  const info = run('pdfinfo', ['-box', pdf])
  const mu = run('mutool', ['info', pdf])
  const bytes = readFileSync(pdf).toString('latin1')

  const { trimWidthMm, trimHeightMm, bleedMm } = doc.dimensions
  const b = mmToPt(bleedMm)
  const mediaW = mmToPt(trimWidthMm + 2 * bleedMm)
  const mediaH = mmToPt(trimHeightMm + 2 * bleedMm)
  const expMedia = [0, 0, mediaW, mediaH]
  const expTrim = [b, b, mediaW - b, mediaH - b]

  const media = parseBox(info, 'MediaBox')
  const bleed = parseBox(info, 'BleedBox')
  const trim = parseBox(info, 'TrimBox')

  const checks = [
    ['DevCMYK image (true CMYK)', /DevCMYK|DeviceCMYK/.test(mu)],
    ['PDF/X-1a (PDF version 1.3)', /PDF version:\s*1\.3/.test(info)],
    ['GTS_PDFX OutputIntent present', /GTS_PDFX/.test(bytes)],
    [`MediaBox = media [${expMedia.map((n) => n.toFixed(1))}]`, boxNear(media, expMedia)],
    [`BleedBox = MediaBox`, boxNear(bleed, media)],
    [`TrimBox = finished size inset by bleed [${expTrim.map((n) => n.toFixed(1))}]`, boxNear(trim, expTrim)],
  ]

  let ok = true
  console.log(`\nverify:print ${id} — ${pdf}`)
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? '✓' : '✗'} ${label}`)
    if (!pass) ok = false
  }
  console.log(`  (TrimBox actual: [${(trim ?? []).map((n) => n.toFixed(2)).join(', ')}])`)
  console.log(ok ? `[OK] ${id}: press-ready CMYK PDF/X` : `[FAIL] ${id}`)
  process.exit(ok ? 0 : 1)
}

function fail(msg) {
  console.error(`verify:print error: ${msg}`)
  process.exit(1)
}

main()
