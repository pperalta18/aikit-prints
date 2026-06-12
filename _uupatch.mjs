// Test: patch an existing oversized CMYK PDF/X to real-scale via UserUnit (post-gs, pdf-lib).
import { PDFDocument, PDFName } from 'pdf-lib'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = process.argv[2]
const OUT = process.argv[3]
const LIMIT = 14400
const bytes = readFileSync(SRC)
const doc = await PDFDocument.load(bytes)
const page = doc.getPage(0)
const { width: W, height: H } = page.getSize()
const U = Math.max(1, Math.ceil(Math.max(W, H) / LIMIT))
console.log(`in: ${W}x${H} pt → U=${U} → box ${(W / U).toFixed(1)}x${(H / U).toFixed(1)} pt; physical stays ${(W * 25.4 / 72 / 1000).toFixed(2)}m`)

// Scale page content down by 1/U so it fits the shrunken box; UserUnit scales it back up.
page.scaleContent(1 / U, 1 / U)
const mb = page.getMediaBox(); const bb = page.getBleedBox(); const tb = page.getTrimBox(); const cb = page.getCropBox()
const sc = (b) => [b.x / U, b.y / U, b.width / U, b.height / U]
page.setMediaBox(...sc(mb))
page.setCropBox(...sc(cb))
page.setBleedBox(...sc(bb))
page.setTrimBox(...sc(tb))
page.node.set(PDFName.of('UserUnit'), doc.context.obj(U))

writeFileSync(OUT, await doc.save())
console.log('wrote', OUT)
