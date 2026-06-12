// Lossless edge-crop of a print PDF: shrink the page boxes to a new trim (no re-raster,
// the embedded image is clipped by the box) and redraw the cut-edge crop marks as vector
// CMYK (K100). Then run _uupatch.mjs for UserUnit. Args: <src> <out> <left|right> <cropMm>
import { PDFDocument, cmyk } from 'pdf-lib'
import { readFileSync, writeFileSync } from 'node:fs'

const [src, out, side, cropMmS] = process.argv.slice(2)
const cropMm = Number(cropMmS)
const PT = (mm) => (mm / 25.4) * 72
const bleed = PT(4)      // 4 mm bleed (matches the export)
const len = PT(3)        // crop-mark length 3 mm
const wln = 0.5          // hairline 0.5 pt
const crop = PT(cropMm)
const BLACK = cmyk(0, 0, 0, 1) // registration K100

const doc = await PDFDocument.load(readFileSync(src))
const page = doc.getPage(0)
const { width: W, height: H } = page.getSize()
const Wp = W - crop // new page width

// New boxes. For a RIGHT crop keep origin at 0; for a LEFT crop use a non-zero MediaBox
// origin = crop (the kept region is [crop .. W]); content stays put, box clips the rest.
const ox = side === 'left' ? crop : 0
page.setMediaBox(ox, 0, Wp, H)
page.setCropBox(ox, 0, Wp, H)
page.setBleedBox(ox, 0, Wp, H)
const trimL = ox + bleed
const trimR = ox + Wp - bleed
const trimB = bleed
const trimT = H - bleed
page.setTrimBox(trimL, trimB, trimR - trimL, trimT - trimB)

// Redraw the two cut-edge corners' marks (vertical + horizontal tick each), in the bleed.
const vtick = (x, y) => page.drawRectangle({ x: x - wln / 2, y, width: wln, height: len, color: BLACK })
const htick = (x, y) => page.drawRectangle({ x, y: y - wln / 2, width: len, height: wln, color: BLACK })
if (side === 'left') {
  vtick(trimL, trimT); htick(trimL - len, trimT)   // top-left
  vtick(trimL, trimB - len); htick(trimL - len, trimB) // bottom-left
} else {
  vtick(trimR, trimT); htick(trimR, trimT)          // top-right
  vtick(trimR, trimB - len); htick(trimR, trimB)     // bottom-right
}

writeFileSync(out, await doc.save())
console.log(`${side} crop ${cropMm}mm: ${(W * 25.4 / 72 / 1000).toFixed(2)}m → ${(Wp * 25.4 / 72 / 1000).toFixed(2)}m (trim ${((trimR - trimL) * 25.4 / 72 / 1000).toFixed(3)}m)`)
