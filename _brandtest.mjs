import { pngToBrandCmykTiff } from './scripts/lib/brand-cmyk.mjs'
import path from 'node:path'
const ROOT = process.cwd()
pngToBrandCmykTiff({
  srcPng: '/tmp/relief.png',
  outTiff: '/tmp/relief-brand.tiff',
  srgbIcc: '/System/Library/ColorSync/Profiles/sRGB Profile.icc',
  cmykIcc: path.join(ROOT, 'public/icc/PSOuncoated_v3_FOGRA52.icc'),
  intentName: 'perceptual',
  brand: { rgb: '#0070f9', cmyk: [100,48,0,1], tol: 0.03 },
})
console.log('brand tiff done')
