// Validation gate for the brand-cmyk gigapixel banding fix.
// Runs the REAL pngToBrandCmykTiff on the full >2^30-px master, then checks that
// every vertical third (the 3 internal bands) carries content — i.e. none is blank.
import { pngToBrandCmykTiff } from './scripts/lib/brand-cmyk.mjs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = '/tmp/8n1up.png'
const OUT = '/tmp/8n1-fixed.tiff'
const t0 = Date.now()
console.log('branding full gigapixel master via fixed function…')
pngToBrandCmykTiff({
  srcPng: SRC,
  outTiff: OUT,
  srgbIcc: '/System/Library/ColorSync/Profiles/sRGB Profile.icc',
  cmykIcc: path.join(ROOT, 'public/icc/PSOuncoated_v3_FOGRA52.icc'),
  intentName: 'perceptual',
  brand: { rgb: '#0070f9', cmyk: [100, 48, 0, 1], tol: 0.03 },
})
console.log(`branded in ${Math.round((Date.now() - t0) / 1000)}s → ${OUT}`)

// Thumbnail for eyeballing.
execFileSync('magick', [OUT, '-resize', '700x', 'out/_check/RESUME-8n1-fixed.png'])

// Per-third mean over the CMYK composite. A blank band ≈ all-zero ink (mean≈0).
const thirds = ['top', 'mid', 'bot']
for (let i = 0; i < 3; i++) {
  const mean = execFileSync('magick', [
    OUT, '-crop', `100%x33%+0+${i * 33}%`, '+repage',
    '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:',
  ]).toString().trim()
  console.log(`  band ${thirds[i]}: ink-mean=${mean}  ${Number(mean) < 0.0005 ? '*** BLANK ***' : 'has content'}`)
}
console.log('VALIDATION DONE')
