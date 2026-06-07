/**
 * bake-softproof-lut — pre-bake the ICC soft-proof transform as a 3D LUT (PNG).
 * ──────────────────────────────────────────────────────────────────────────────
 * The export pipeline converts sRGB → CMYK with a print ICC profile (FOGRA52 by
 * default) and forces the brand blue to its EXACT CMYK (see brand-cmyk.mjs). To let
 * the in-app preview show a faithful "how it prints" soft-proof WITHOUT shipping a
 * colour-management engine to the browser, we bake the round-trip once here:
 *
 *     sRGB  →[doc intent]→  CMYK(profile)  →[relative+BPC]→  sRGB(monitor)
 *
 * applied to an identity RGB grid. The result is a 3D LUT the browser trilinearly
 * samples per pixel. We use the SAME ImageMagick ICC engine and profiles the export
 * uses, so the proof tracks the real conversion (minus the gs/IM CMM nuance, which
 * for a screen proof is negligible — brand pixels are handled exactly, below).
 *
 * Two artefacts per profile:
 *   · <base>.<intent>.lut.png  — the proof LUT. Layout: N×N×N grid (N=GRID) packed
 *     width=N, height=N·N, pixel(x = rᵢ, y = gᵢ + bᵢ·N) holds the proofed sRGB of
 *     the identity colour (rᵢ,gᵢ,bᵢ)/(N−1). Unambiguous, so the browser sampler is
 *     a plain index — no Hald-ordering guesswork.
 *   · <base>.brand.png — a 256×1 ramp: the brand ink at tint α (α·CMYK) converted
 *     CMYK→sRGB. The browser maps every brand-tint pixel through this, matching the
 *     export's exact-brand override instead of the ICC's generic blue.
 *
 * Run:  npm run softproof:bake
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ICC_DIR = path.join(ROOT, 'public', 'icc')
const OUT_DIR = path.join(ICC_DIR, 'softproof')
const SRGB = path.join(ICC_DIR, 'sRGB.icc')

/** LUT grid resolution per channel. 33 is the .cube standard — smooth + tiny. */
const GRID = 33
/** Brand ink, mirrored from scripts/lib/cmyk-pdf.mjs DEFAULT_BRAND. */
const BRAND_CMYK = [100, 48, 0, 1] // C M Y K, percent
/** ICC render intents we bake (export resolves color.renderIntent, default relative). */
const INTENTS = ['perceptual', 'relative', 'saturation', 'absolute']
/** CMYK output profiles to bake (skip any that are absent). */
const PROFILES = ['PSOuncoated_v3_FOGRA52.icc', 'CoatedFOGRA39.icc', 'GenericCMYK.icc']

const imName = (intent) => intent.charAt(0).toUpperCase() + intent.slice(1)

function run(args, input) {
  return execFileSync('magick', args, { input, maxBuffer: 1 << 28 })
}

/** Identity sRGB grid as raw RGB bytes, packed width=GRID, height=GRID·GRID. */
function identityGrid() {
  const n = GRID
  const buf = Buffer.allocUnsafe(n * n * n * 3)
  const q = (i) => Math.round((i / (n - 1)) * 255)
  let o = 0
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++) {
        buf[o++] = q(r)
        buf[o++] = q(g)
        buf[o++] = q(b)
      }
    }
  }
  return buf
}

/** Bake one proof LUT: identity → sRGB → CMYK(profile,intent) → sRGB. */
function bakeLut(cmykIcc, intent, outFile) {
  const n = GRID
  const png = run(
    [
      '-size', `${n}x${n * n}`, '-depth', '8', 'RGB:-',
      '-profile', SRGB, // assign source sRGB (raw bytes are sRGB-encoded)
      '-black-point-compensation', '-intent', imName(intent),
      '-profile', cmykIcc, // sRGB → CMYK with the doc's intent
      '-black-point-compensation', '-intent', 'Relative',
      '-profile', SRGB, // CMYK → monitor sRGB (proof back-leg)
      'PNG24:-',
    ],
    identityGrid(),
  )
  writeFileSync(outFile, png)
  return png
}

/** Bake the brand ramp: α·(brand CMYK) → sRGB, 256 steps. */
function bakeBrandRamp(cmykIcc, outFile) {
  const [C, M, Y, K] = BRAND_CMYK
  const raw = Buffer.allocUnsafe(256 * 4)
  for (let x = 0; x < 256; x++) {
    const a = x / 255
    raw[x * 4] = Math.round(a * C * 2.55)
    raw[x * 4 + 1] = Math.round(a * M * 2.55)
    raw[x * 4 + 2] = Math.round(a * Y * 2.55)
    raw[x * 4 + 3] = Math.round(a * K * 2.55)
  }
  const png = run(
    [
      '-size', '256x1', '-depth', '8', 'CMYK:-',
      '-profile', cmykIcc, // assign source CMYK profile
      '-black-point-compensation', '-intent', 'Relative',
      '-profile', SRGB, // CMYK → sRGB
      'PNG24:-',
    ],
    raw,
  )
  writeFileSync(outFile, png)
}

/** Decode a PNG to {w,h,rgb} via ImageMagick (sanity checks only). */
function decode(file) {
  const [w, h] = run(['identify', '-format', '%w %h', file]).toString().trim().split(/\s+/).map(Number)
  const rgb = run([file, '-depth', '8', 'RGB:-'])
  return { w, h, rgb }
}

function main() {
  if (!existsSync(SRGB)) throw new Error(`missing ${SRGB}`)
  mkdirSync(OUT_DIR, { recursive: true })

  let baked = 0
  for (const prof of PROFILES) {
    const cmykIcc = path.join(ICC_DIR, prof)
    if (!existsSync(cmykIcc)) {
      console.log(`· skip ${prof} (not found)`)
      continue
    }
    const base = prof.replace(/\.icc$/i, '')
    for (const intent of INTENTS) {
      const out = path.join(OUT_DIR, `${base}.${intent}.lut.png`)
      bakeLut(cmykIcc, intent, out)
      baked++
      console.log(`✓ ${path.relative(ROOT, out)}`)
    }
    const ramp = path.join(OUT_DIR, `${base}.brand.png`)
    bakeBrandRamp(cmykIcc, ramp)
    console.log(`✓ ${path.relative(ROOT, ramp)}`)
  }

  // ── sanity: relative LUT of the default profile ──────────────────────────────
  const sample = path.join(OUT_DIR, `${PROFILES[0].replace(/\.icc$/i, '')}.relative.lut.png`)
  if (existsSync(sample)) {
    const n = GRID
    const { w, h, rgb } = decode(sample)
    const at = (ri, gi, bi) => {
      const x = ri, y = gi + bi * n, o = (y * w + x) * 3
      return [rgb[o], rgb[o + 1], rgb[o + 2]]
    }
    const white = at(n - 1, n - 1, n - 1)
    const black = at(0, 0, 0)
    const red = at(n - 1, 0, 0)
    const green = at(0, n - 1, 0)
    console.log(`\nsanity (${w}x${h}, grid ${n}):`)
    console.log(`  white → ${white}   (paper, expect near 255)`)
    console.log(`  black → ${black}`)
    console.log(`  pure red 255,0,0 → ${red}   (expect dulled, R<255 or G/B raised)`)
    console.log(`  pure green 0,255,0 → ${green}   (expect notably compressed)`)
    if (red[0] === 255 && red[1] === 0 && red[2] === 0) {
      throw new Error('LUT looks like a no-op identity — ICC transform did not apply')
    }
  }
  console.log(`\nDone — ${baked} LUT(s) in ${path.relative(ROOT, OUT_DIR)}/`)
}

main()
