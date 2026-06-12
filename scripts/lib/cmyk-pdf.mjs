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
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { pngToBrandCmykTiff } from './brand-cmyk.mjs'

const ROOT = process.cwd()
const SRGB_PROFILE = path.join(ROOT, 'public', 'icc', 'sRGB.icc')

/** ICC rendering-intent names → Ghostscript -dRenderIntent codes. */
export const RENDER_INTENT = { perceptual: 0, relative: 1, saturation: 2, absolute: 3 }

/**
 * Brand-colour override applied to EVERY export: the brand blue must print on its
 * exact CMYK, not on whatever the generic ICC conversion yields. Brand pixels — the
 * blue at any opacity tint over white — are forced to `α × cmyk`; every off-line
 * pixel is ICC-converted as before. A doc opts out / overrides via `color.brand`
 * (set it to `null` to disable). See `brand-cmyk.mjs` for the tint model.
 * KIT_BLUE #0070f9 → C100 M48 Y0 K1.
 */
export const DEFAULT_BRAND = { rgb: '#0070f9', cmyk: [100, 48, 0, 1], tol: 0.03 }

/** Effective brand spec for a doc `color` block — explicit `brand` wins (incl. null). */
export function resolveBrand(color) {
  if (color && Object.prototype.hasOwnProperty.call(color, 'brand')) return color.brand
  return DEFAULT_BRAND
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
 * Already-CMYK PDF → CMYK PDF/X with ICC OutputIntent, WITHOUT recolouring. Used
 * when the raster was pre-converted to DeviceCMYK (the brand-override path): the
 * brand pixels already carry their exact CMYK, so Ghostscript must only add the
 * PDF/X OutputIntent and keep ink values bit-exact. `-sDefaultCMYKProfile=icc`
 * tags the incoming device CMYK as the output profile → the CMYK→CMYK transform is
 * identity, so C100 M48 Y0 K1 survives untouched.
 */
export function cmykPdfToPdfX(cmykInPdf, cmykPdf, color, idTag = 'print') {
  const icc = path.join(ROOT, 'public', color.iccProfile)
  if (!existsSync(icc)) throw new Error(`ICC profile not found: ${icc}`)
  const label = path.basename(icc).replace(/\.icc$/i, '')
  const defPath = path.join(os.tmpdir(), `pdfx-${idTag}-${process.pid}.ps`)
  writeFileSync(defPath, buildPdfxDef(icc, label))
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
      // Keep the CMYK raster lossless — never let pdfwrite re-encode it as JPEG, or
      // the exact brand ink (and the crisp edges) would be corrupted.
      '-dAutoFilterColorImages=false', '-dColorImageFilter=/FlateEncode',
      '-dAutoFilterGrayImages=false', '-dGrayImageFilter=/FlateEncode',
      '-dEncodeColorImages=true', '-dEncodeGrayImages=true',
      `-sDefaultCMYKProfile=${icc}`, // interpret incoming device CMYK as the output profile → identity
      `-sOutputICCProfile=${icc}`,
      `-sOutputFile=${cmykPdf}`,
      defPath,
      cmykInPdf,
    ])
  } finally {
    rmSync(defPath, { force: true })
  }
}

/**
 * Full pipeline: a PNG → a CMYK PDF/X at `outPdf`. `makeBoxes(Wpt,Hpt)` supplies
 * the page boxes (e.g. `posterPdfBoxesPt`/`panelPdfBoxesPt`); `color` is the doc's
 * colour block; `dpi` sizes the page. Temp RGB/boxed PDFs are cleaned up.
 *
 * Unless disabled (`color.brand: null`), the brand blue and its opacity tints are
 * forced to their exact CMYK first (brand-aware path): master PNG → DeviceCMYK TIFF
 * (brand pixels overridden, the rest ICC-converted) → CMYK PDF → boxes → PDF/X wrap
 * with no further recolour. Otherwise the plain sRGB→CMYK path runs.
 */
export async function pngToCmykPdfX({ png, outPdf, dpi, makeBoxes, color, idTag = 'print' }) {
  if (!existsSync(png)) throw new Error(`PNG not found: ${png}`)
  const midPdf = path.join(os.tmpdir(), `${idTag}-mid-${process.pid}.pdf`)
  const boxedPdf = path.join(os.tmpdir(), `${idTag}-boxed-${process.pid}.pdf`)
  const cmykTiff = path.join(os.tmpdir(), `${idTag}-brand-${process.pid}.tiff`)
  const bandDir = path.join(os.tmpdir(), `${idTag}-bands-${process.pid}`)
  const brand = resolveBrand(color)
  try {
    if (brand) {
      const cmykIcc = path.join(ROOT, 'public', color.iccProfile)
      if (!existsSync(cmykIcc)) throw new Error(`ICC profile not found: ${cmykIcc}`)
      const intentName = color.renderIntent ?? 'relative'
      const [iw, ih] = run('magick', ['identify', '-format', '%w %h', `${png}[0]`]).trim().split(/\s+/).map(Number)
      // ImageMagick (Q16) silently blanks any single raster > 2^30 px (~1.07 Gpx) when it
      // converts that raster to a PDF image — even though the brand CMYK TIFF itself is
      // correct. So above ~1 Gpx, build the page band-by-band: each CMYK band TIFF (< 2^30)
      // → its own sized PDF, stacked losslessly onto one page (no >2^30 raster ever reaches
      // magick's raster→PDF, and no monster `-append` either). Below that, single-shot.
      if (iw * ih > 1_000_000_000) {
        mkdirSync(bandDir, { recursive: true })
        const { bands, w, h } = pngToBrandCmykTiff({
          srcPng: png, outTiff: cmykTiff, srgbIcc: SRGB_PROFILE, cmykIcc, intentName, brand, bandDir,
        })
        const doc = await PDFDocument.create()
        const pageW = (w * 72) / dpi
        const pageH = (h * 72) / dpi
        const page = doc.addPage([pageW, pageH])
        for (const b of bands) {
          const bandPdf = path.join(bandDir, `${path.basename(b.tiff, '.tiff')}.pdf`)
          run('magick', ['-units', 'PixelsPerInch', '-density', String(dpi), b.tiff, '-compress', 'Zip', bandPdf])
          const src = await PDFDocument.load(readFileSync(bandPdf))
          const [emb] = await doc.embedPdf(src, [0])
          // b.y0 is the band's top offset (px from the image top); PDF y grows upward.
          page.drawPage(emb, { x: 0, y: pageH - (b.y0 * 72) / dpi - (b.h * 72) / dpi, width: (b.w * 72) / dpi, height: (b.h * 72) / dpi })
        }
        writeFileSync(midPdf, await doc.save())
      } else {
        pngToBrandCmykTiff({ srcPng: png, outTiff: cmykTiff, srgbIcc: SRGB_PROFILE, cmykIcc, intentName, brand })
        // CMYK TIFF → sized DeviceCMYK PDF (page = px/dpi, like pngToRgbPdf). Force Zip
        // (Flate) — magick's default for CMYK is lossy JPEG, which would smear the crisp
        // art and shift the exact brand ink.
        run('magick', ['-units', 'PixelsPerInch', '-density', String(dpi), cmykTiff, '-compress', 'Zip', midPdf])
      }
      await setPdfBoxes(midPdf, boxedPdf, makeBoxes)
      cmykPdfToPdfX(boxedPdf, outPdf, color, idTag)
    } else {
      pngToRgbPdf(png, midPdf, dpi)
      await setPdfBoxes(midPdf, boxedPdf, makeBoxes)
      rgbToCmykPdfX(boxedPdf, outPdf, color, idTag)
    }
  } finally {
    rmSync(midPdf, { force: true })
    rmSync(boxedPdf, { force: true })
    rmSync(cmykTiff, { force: true })
    rmSync(bandDir, { recursive: true, force: true })
  }
}
