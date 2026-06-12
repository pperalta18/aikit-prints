#!/usr/bin/env node
/**
 * half-pdf — PDF a mitad de tamaño físico para los muros gigantes (entrega imprenta).
 * ────────────────────────────────────────────────────────────────────────────────
 * Reescala SOLO la geometría de página (boxes + UserUnit) — el ráster CMYK embebido
 * no se recomprime: lossless, mismo contenido. Un export a 150 ppp queda en 300 ppp
 * efectivos a mitad de tamaño (= 150 ppp reales al imprimir al 200 %).
 *
 *   node scripts/half-pdf.mjs <src.pdf...> --out <dir>
 *
 * Conserva las cinco cajas PDF (Media/Crop/Bleed/Trim/Art, con su inset de sangre)
 * y recalcula el menor /UserUnit entero que mantiene la caja bajo el límite clásico
 * de Acrobat (14 400 pt por lado). Generalización del antiguo `_tmp_half_pdf.mjs`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { PDFDocument, PDFName, PDFNumber } from 'pdf-lib'

const ACRO_MAX = 14400 // pt por lado sin UserUnit

function parseArgs(argv) {
  const args = { srcs: [], out: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i]
    else args.srcs.push(argv[i])
  }
  return args
}

const { srcs, out } = parseArgs(process.argv.slice(2))
if (!srcs.length || !out) {
  console.error('Usage: node scripts/half-pdf.mjs <src.pdf...> --out <dir>')
  process.exit(1)
}

mkdirSync(out, { recursive: true })
for (const src of srcs) {
  const doc = await PDFDocument.load(readFileSync(src))
  const page = doc.getPage(0)
  const { width: w0, height: h0 } = page.getMediaBox()
  const u0 = page.node.get(PDFName.of('UserUnit'))?.asNumber?.() ?? 1
  // tamaño físico actual (pt) → objetivo = la mitad
  const physW = w0 * u0, physH = h0 * u0
  const targetW = physW / 2, targetH = physH / 2
  // menor UserUnit entero que deja la caja dentro del límite clásico
  const u1 = Math.max(1, Math.ceil(targetW / ACRO_MAX), Math.ceil(targetH / ACRO_MAX))
  const boxW = targetW / u1
  const s = boxW / w0 // escala del contenido (unidades de página)
  // capturar las cajas originales ANTES de escalar (conservan el inset de sangre)
  const boxes = {}
  for (const k of ['MediaBox', 'CropBox', 'BleedBox', 'TrimBox', 'ArtBox']) {
    const b = page.node.get(PDFName.of(k))
    if (b) boxes[k] = b.asArray().map((n) => n.asNumber())
  }
  page.scale(s, s)
  for (const [k, arr] of Object.entries(boxes)) {
    page.node.set(PDFName.of(k), doc.context.obj(arr.map((n) => n * s)))
  }
  if (u1 > 1) page.node.set(PDFName.of('UserUnit'), PDFNumber.of(u1))
  else page.node.delete(PDFName.of('UserUnit'))
  const bytes = await doc.save({ useObjectStreams: false })
  const dest = join(out, basename(src))
  writeFileSync(dest, bytes)
  const mm = (pt) => (pt / 72) * 25.4
  console.log(
    `${basename(src)}: fis ${mm(physW).toFixed(0)}×${mm(physH).toFixed(0)}mm → mitad ${mm(targetW).toFixed(0)}×${mm(targetH).toFixed(0)}mm (caja ${boxW.toFixed(0)}pt, UserUnit ${u1}, s=${s.toFixed(4)})`,
  )
}
console.log('DONE')
