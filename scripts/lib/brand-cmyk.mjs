/**
 * brand-cmyk — force the brand blue (and its opacity tints) to an EXACT CMYK.
 * ──────────────────────────────────────────────────────────────────────────
 * The press pipeline rasterises every print to sRGB, then ICC-converts sRGB→CMYK.
 * A generic ICC conversion does NOT land the brand blue on the brand's specified
 * CMYK (e.g. KIT_BLUE #0070f9 → ~C89 M50 Y0 K0 instead of the wanted C100 M48 Y0 K1).
 *
 * The designs use the brand blue as a *tint over white*: a flat fill is the blue at
 * 100 %, the warp "globo" and other elements are the same blue at lower opacity. So
 * every brand pixel lies on the line  white → KIT_BLUE  in sRGB, and its tint
 * fraction is  α = 1 − R/255  (KIT_BLUE.R = 0, white.R = 255). We map such a pixel to
 * α × (the brand CMYK) — i.e. the brand ink at α tint — and leave every off-line
 * pixel (black hole, graphite spheres, greys, photos) to the normal ICC conversion.
 *
 * A pixel counts as "brand" when, taking α from its red channel, its green and blue
 * channels match what KIT_BLUE-over-white would give at that α, within `tol`
 * (fraction of full scale). That admits the flat fills, the opacity tints and AA
 * edges, while rejecting greys/near-blacks (which sit well off the line).
 *
 * Pipeline: ImageMagick produces the ICC base CMYK and the raw sRGB bytes; a single
 * streaming Node pass writes the final DeviceCMYK by overriding brand pixels with
 * their exact ink. Streaming in pixel chunks keeps memory bounded, so gigapixel
 * masters convert in one linear pass (no per-pixel ImageMagick `-fx`, no dozen
 * intermediate gigapixel rasters).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, openSync, readSync, writeSync, closeSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function run(cmd, cmdArgs) {
  try {
    return execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  } catch (err) {
    const stderr = err?.stderr?.toString?.() ?? ''
    throw new Error(`${cmd} failed:\n${stderr || err.message}`)
  }
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** Read exactly `len` bytes from `fd` (sequential) into `buf`, or throw on short read. */
function readFull(fd, buf, len) {
  let got = 0
  while (got < len) {
    const n = readSync(fd, buf, got, len - got, null)
    if (n <= 0) throw new Error(`brand-cmyk: unexpected EOF (${got}/${len})`)
    got += n
  }
}

/** Write exactly `len` bytes from `buf` to `fd` (sequential). */
function writeFull(fd, buf, len) {
  let put = 0
  while (put < len) put += writeSync(fd, buf, put, len - put, null)
}

/**
 * Build the DeviceCMYK TIFF for `srcPng`, overriding brand-tint pixels.
 *  - srcPng     the sRGB master raster
 *  - outTiff    destination DeviceCMYK TIFF
 *  - srgbIcc/cmykIcc  absolute ICC paths
 *  - intentName perceptual|relative|saturation|absolute (the doc's render intent)
 *  - brand      { rgb:'#0070f9', cmyk:[100,48,0,1], tol:0.03 }
 */
export function pngToBrandCmykTiff({ srcPng, outTiff, srgbIcc, cmykIcc, intentName = 'relative', brand, bandDir = null }) {
  if (!existsSync(srcPng)) throw new Error(`PNG not found: ${srcPng}`)
  const [br, bg, bb] = Array.isArray(brand.rgb) ? brand.rgb : hexToRgb(brand.rgb)
  if (br !== 0) {
    // The α = 1 − R/255 derivation needs the brand hue's red channel at 0 (KIT_BLUE
    // #0070f9 → R=0). A hue with R≠0 needs the general projection-onto-line form —
    // guard rather than silently mis-map.
    throw new Error(`brand-cmyk: only a hue with red=0 (KIT_BLUE-style) is supported, got rgb [${br},${bg},${bb}]`)
  }
  const [C, M, Y, K] = brand.cmyk // percentages 0..100 (Y forced to 0 below for the blue)
  const tol = brand.tol ?? 0.03
  const tol255 = tol * 255

  // 8-bit factors. negR = 255−R = 255·α, so the brand ink at tint α is negR·(C,M,Y,K)/100.
  const fC = C / 100
  const fM = M / 100
  const fK = K / 100
  // KIT_BLUE-over-white predicted green/blue at tint α:  G = 255 − negR·(255−G_blue)/255.
  const fG = (255 - bg) / 255
  const fB = (255 - bb) / 255
  const intentArg = intentName.charAt(0).toUpperCase() + intentName.slice(1)

  const [w, h] = run('magick', ['identify', '-format', '%w %h', srcPng + '[0]']).trim().split(/\s+/).map(Number)
  if (!w || !h) throw new Error(`brand-cmyk: could not read dimensions of ${srcPng}`)
  const total = w * h

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'brandcmyk-'))
  const f = (n) => path.join(tmp, n)
  try {
    // Process the master in horizontal BANDS. Two ImageMagick limits bite on a
    // wall-sized master and BOTH silently blank the output (no error):
    //   1. raw stream I/O overflows past ~2^32 bytes (4 GB) — the 4-byte CMYK plane
    //      hits that at w·h > 2^30 px (~1.07 Gpx);
    //   2. a crop+ICC-profile pipeline run directly on a >2^30-px input corrupts.
    // So we (a) cap each band's raw plane well under 4 GB, and (b) PRE-CROP each band
    // to its own small PNG first (a plain crop is robust), then run the profile/brand
    // pass on that sub-2^30-px band. Full-width bands concatenate losslessly, so the
    // per-band TIFFs `-append` back into the exact same raster.
    const LIM = ['-limit', 'memory', '24GiB', '-limit', 'map', '24GiB'] // keep the gigapixel cache in RAM
    const BAND_RAW_CAP = 2_000_000_000 // bytes; 4-byte CMYK plane → ≤ 2 GB per band (also < 2^30 px)
    const bandH = Math.max(1, Math.min(h, Math.floor(BAND_RAW_CAP / (w * 4))))
    const nBands = Math.ceil(h / bandH)
    const bands = [] // { tiff, w, h, y0 } per horizontal band

    const CHUNK = 4_000_000 // pixels per chunk (≈ 12 MB rgb + 16 MB cmyk in flight)
    const rgb = Buffer.allocUnsafe(CHUNK * 3)
    const base = Buffer.allocUnsafe(CHUNK * 4)
    const out = Buffer.allocUnsafe(CHUNK * 4)

    for (let b = 0; b < nBands; b++) {
      const y0 = b * bandH
      const bh = Math.min(bandH, h - y0)
      const bandTotal = w * bh
      // Pre-crop the band to its own PNG. The source can exceed 2^30 px, and on such
      // a source a crop run with a raised `-limit` silently blanks the output — a plain
      // crop at IM's default (disk-backed) cache survives it. So NO `-limit` here; every
      // downstream op runs on the sub-2^30-px band, where `-limit` is safe (and faster).
      const bandPng = f('band.png')
      run('magick', [srcPng, '-crop', `${w}x${bh}+0+${y0}`, '+repage', bandPng])
      // ICC base CMYK (raw device bytes) for this band — the non-brand fallback.
      run('magick', [...LIM, bandPng, '-background', 'white', '-alpha', 'remove', '-alpha', 'off',
        '-profile', srgbIcc, '-intent', intentArg, '-black-point-compensation',
        '-profile', cmykIcc, '-depth', '8', `CMYK:${f('base.cmyk')}`])
      // Raw sRGB bytes for this band (flattened on white, matching the design ground).
      run('magick', [...LIM, bandPng, '-background', 'white', '-alpha', 'remove', '-alpha', 'off',
        '-depth', '8', `RGB:${f('src.rgb')}`])

      // One streaming pass over the band: per pixel, brand-override or keep the ICC base.
      const rgbFd = openSync(f('src.rgb'), 'r')
      const baseFd = openSync(f('base.cmyk'), 'r')
      const outFd = openSync(f('out.cmyk'), 'w')
      try {
        let done = 0
        while (done < bandTotal) {
          const n = Math.min(CHUNK, bandTotal - done)
          readFull(rgbFd, rgb, n * 3)
          readFull(baseFd, base, n * 4)
          for (let i = 0; i < n; i++) {
            const r3 = i * 3, c4 = i * 4
            const R = rgb[r3], G = rgb[r3 + 1], B = rgb[r3 + 2]
            const negR = 255 - R
            const gPred = 255 - negR * fG
            const bPred = 255 - negR * fB
            if (Math.abs(G - gPred) <= tol255 && Math.abs(B - bPred) <= tol255) {
              out[c4] = Math.round(negR * fC)
              out[c4 + 1] = Math.round(negR * fM)
              out[c4 + 2] = 0
              out[c4 + 3] = Math.round(negR * fK)
            } else {
              out[c4] = base[c4]
              out[c4 + 1] = base[c4 + 1]
              out[c4 + 2] = base[c4 + 2]
              out[c4 + 3] = base[c4 + 3]
            }
          }
          writeFull(outFd, out, n * 4)
          done += n
        }
      } finally {
        closeSync(rgbFd); closeSync(baseFd); closeSync(outFd)
      }

      // Band raw DeviceCMYK → band TIFF (each well under the raw-I/O ceiling). When the
      // caller wants the bands back (bandDir set), write them there so they survive this
      // function's scratch cleanup; otherwise they live in scratch and get `-append`ed.
      const bt = bandDir
        ? path.join(bandDir, `band_${String(b).padStart(3, '0')}.tiff`)
        : f(`band_${String(b).padStart(3, '0')}.tiff`)
      run('magick', [...LIM, '-size', `${w}x${bh}`, '-depth', '8', `CMYK:${f('out.cmyk')}`,
        '-set', 'colorspace', 'CMYK', '-compress', 'Zip', bt])
      rmSync(bandPng, { force: true })
      bands.push({ tiff: bt, w, h: bh, y0 })
    }

    // With bandDir set, hand the per-band TIFFs (each < 2^30 px) back to the caller so it
    // can build the PDF band-by-band — assembling/converting a single >2^30-px raster is
    // exactly what blanks downstream (ImageMagick can't convert it to PDF whole). Without
    // it, stack the bands into the full DeviceCMYK master here (safe only when ≤ 2^30 px).
    if (bandDir) return { bands, w, h }
    run('magick', [...LIM, ...bands.map((b) => b.tiff), '-append', '-set', 'colorspace', 'CMYK', '-compress', 'Zip', outTiff])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return outTiff
}
