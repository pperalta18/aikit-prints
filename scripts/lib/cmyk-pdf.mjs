/**
 * cmyk-pdf — shared PNG → CMYK PDF/X builder.
 * ───────────────────────────────────────────
 * The press deliverable for every print (a whole poster *or* one wall panel) is a
 * true-CMYK PDF/X with an ICC OutputIntent and correct Media/Bleed/Trim boxes.
 * That pipeline is identical regardless of what produced the PNG, so it lives here
 * and is shared by `export-print.mjs` (renders then exports the whole media) and
 * `tile-print.mjs` (slices the master, then exports each panel). One Ghostscript
 * invocation, one source of truth.
 *
 * Pipeline: PNG → (magick) sized RGB PDF → (pdf-lib) page boxes → (Ghostscript)
 * sRGB→CMYK PDF/X + GTS_PDFX OutputIntent. Verified with pdfinfo / mutool.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'

const ROOT = process.cwd()
const SRGB_PROFILE = path.join(ROOT, 'public', 'icc', 'sRGB.icc')

/** ICC rendering-intent names → Ghostscript -dRenderIntent codes. */
export const RENDER_INTENT = { perceptual: 0, relative: 1, saturation: 2, absolute: 3 }

/** Run a binary, capture stdout; on failure surface stderr and rethrow. */
function run(cmd, cmdArgs) {
  try {
    return execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  } catch (err) {
    const stderr = err?.stderr?.toString?.() ?? ''
    throw new Error(`${cmd} failed:\n${stderr || err.message}`)
  }
}

/** PNG → RGB PDF whose page is exactly the media physical size (px / dpi). */
export function pngToRgbPdf(png, rgbPdf, dpi) {
  // -density/-units must precede the raster input: placed after it, ImageMagick
  // ignores them for the raster→PDF page size and the page comes out mis-scaled.
  run('magick', ['-units', 'PixelsPerInch', '-density', String(dpi), png, rgbPdf])
}

/**
 * Set the PDF page boxes (pdf-lib). `makeBoxes(widthPt, heightPt)` receives the
 * *actual* rendered page size (read from the RGB PDF, so the boxes never drift from
 * the magick page by sub-point px rounding) and returns `{media,bleed,trim}` as
 * `[x,y,w,h]` arrays. Ghostscript preserves the source boxes downstream.
 */
export async function setPdfBoxes(inPdf, outPdf, makeBoxes) {
  const pdf = await PDFDocument.load(readFileSync(inPdf))
  const page = pdf.getPage(0)
  const { width: W, height: H } = page.getSize()
  const boxes = makeBoxes(W, H)
  page.setMediaBox(...boxes.media)
  page.setBleedBox(...boxes.bleed)
  page.setTrimBox(...boxes.trim)
  writeFileSync(outPdf, await pdf.save())
}

/** The PostScript prologue declaring a CMYK (N=4) ICC OutputIntent for PDF/X. */
export function buildPdfxDef(iccAbsPath, label) {
  return `%!
/ICCProfile (${iccAbsPath}) def

[/_objdef {icc_PDFX} /type /stream /OBJ pdfmark
[{icc_PDFX} <</N 4>> /PUT pdfmark
[{icc_PDFX} ICCProfile (r) file /PUT pdfmark

[/_objdef {OutputIntent_PDFX} /type /dict /OBJ pdfmark
[{OutputIntent_PDFX} <<
  /Type /OutputIntent
  /S /GTS_PDFX
  /OutputCondition (Commercial and specialty printing)
  /OutputConditionIdentifier (${label})
  /RegistryName (http://www.color.org)
  /Info (${label})
  /DestOutputProfile {icc_PDFX}
>> /PUT pdfmark
[{Catalog} <</OutputIntents [ {OutputIntent_PDFX} ]>> /PUT pdfmark
`
}

/**
 * RGB PDF → CMYK PDF/X with ICC OutputIntent. `color` is the doc's `color` block
 * (`{ iccProfile, renderIntent, pdfxVariant }`); `iccProfile` is resolved under
 * `public/`. `label` defaults to the ICC base name.
 */
export function rgbToCmykPdfX(rgbPdf, cmykPdf, color, idTag = 'print') {
  const icc = path.join(ROOT, 'public', color.iccProfile)
  if (!existsSync(icc)) throw new Error(`ICC profile not found: ${icc}`)
  const label = path.basename(icc).replace(/\.icc$/i, '')
  const defPath = path.join(os.tmpdir(), `pdfx-${idTag}-${process.pid}.ps`)
  writeFileSync(defPath, buildPdfxDef(icc, label))

  // Rendering intent drives the sRGB→CMYK gamut mapping. `relative` keeps in-gamut
  // colours at full strength and clips only what is out of gamut (vivid brand
  // colour survives); `perceptual` compresses everything and looks duller. Set
  // explicitly — GS's implicit default is profile-dependent.
  const intentName = color.renderIntent ?? 'relative'
  const intent = RENDER_INTENT[intentName] ?? RENDER_INTENT.relative

  if (color.pdfxVariant === 'x4') {
    console.error('note: PDF/X-4 not fully implemented — producing an X-1a-style CMYK PDF (F5).')
  }
  try {
    run('gs', [
      '-dPDFX',
      '-dBATCH',
      '-dNOPAUSE',
      '-dNOSAFER',
      '-dPDFXCompatibilityPolicy=1',
      '-sColorConversionStrategy=CMYK',
      '-sProcessColorModel=DeviceCMYK',
      '-sDEVICE=pdfwrite',
      '-dPDFSETTINGS=/prepress',
      `-dRenderIntent=${intent}`,
      `-sDefaultRGBProfile=${SRGB_PROFILE}`,
      `-sOutputICCProfile=${icc}`,
      `-sOutputFile=${cmykPdf}`,
      defPath,
      rgbPdf,
    ])
  } finally {
    rmSync(defPath, { force: true })
  }
}

/**
 * Full pipeline: a PNG → a CMYK PDF/X at `outPdf`. `makeBoxes(Wpt,Hpt)` supplies
 * the page boxes (e.g. `posterPdfBoxesPt`/`panelPdfBoxesPt`); `color` is the doc's
 * colour block; `dpi` sizes the page. Temp RGB/boxed PDFs are cleaned up.
 */
export async function pngToCmykPdfX({ png, outPdf, dpi, makeBoxes, color, idTag = 'print' }) {
  if (!existsSync(png)) throw new Error(`PNG not found: ${png}`)
  const rgbPdf = path.join(os.tmpdir(), `${idTag}-rgb-${process.pid}.pdf`)
  const boxedPdf = path.join(os.tmpdir(), `${idTag}-boxed-${process.pid}.pdf`)
  try {
    pngToRgbPdf(png, rgbPdf, dpi)
    await setPdfBoxes(rgbPdf, boxedPdf, makeBoxes)
    rgbToCmykPdfX(boxedPdf, outPdf, color, idTag)
  } finally {
    rmSync(rgbPdf, { force: true })
    rmSync(boxedPdf, { force: true })
  }
}
