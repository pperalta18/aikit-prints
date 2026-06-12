import { pngToCmykPdfX } from './scripts/lib/cmyk-pdf.mjs'
import { posterPdfBoxesPt } from './src/print/pdfBoxes.ts'
import { readFileSync } from 'node:fs'
const [id, png, outPdf] = process.argv.slice(2)
const doc = JSON.parse(readFileSync(`./public/prints/${id}/doc.json`, 'utf8'))
await pngToCmykPdfX({
  png, outPdf, dpi: 150,
  makeBoxes: (W, H) => posterPdfBoxesPt(W, H, doc.dimensions.bleedMm),
  color: doc.color, idTag: `${id}-test`,
})
console.log('done', outPdf)
