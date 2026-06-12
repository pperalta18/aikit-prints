// Feasibility test: does gs (with -dPDFX, PDF/X-4) preserve /UserUnit and emit PDF 1.6?
import { PDFDocument, PDFName, PDFNumber, rgb } from 'pdf-lib'
import { writeFileSync } from 'node:fs'

const doc = await PDFDocument.create()
const page = doc.addPage([2000, 1000]) // small page (well under 14400)
page.drawRectangle({ x: 100, y: 100, width: 1800, height: 800, color: rgb(0.1, 0.2, 0.3) })
page.node.set(PDFName.of('UserUnit'), PDFNumber.of(5)) // physical = 2000*5/72 in
writeFileSync('/tmp/uu-in.pdf', await doc.save())
console.log('wrote /tmp/uu-in.pdf with UserUnit=5')
