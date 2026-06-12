import { pngToBrandCmykTiff } from './scripts/lib/brand-cmyk.mjs'
import path from 'node:path'
// monkey-test: process 8n1up in 2 explicit bands by cropping first, then brand each.
import { execFileSync } from 'node:child_process'
const ROOT = process.cwd()
const args = { srgbIcc: '/System/Library/ColorSync/Profiles/sRGB Profile.icc',
  cmykIcc: path.join(ROOT,'public/icc/PSOuncoated_v3_FOGRA52.icc'), intentName:'perceptual',
  brand:{rgb:'#0070f9',cmyk:[100,48,0,1],tol:0.03} }
const W=68031, H=17835, mid=9000
// crop two band PNGs from the big file
execFileSync('magick',['/tmp/8n1up.png','-crop',`${W}x${mid}+0+0`,'+repage','/tmp/b0.png'])
execFileSync('magick',['/tmp/8n1up.png','-crop',`${W}x${H-mid}+0+${mid}`,'+repage','/tmp/b1.png'])
console.log('cropped bands')
pngToBrandCmykTiff({srcPng:'/tmp/b0.png',outTiff:'/tmp/b0.tiff',...args})
console.log('b0 branded')
pngToBrandCmykTiff({srcPng:'/tmp/b1.png',outTiff:'/tmp/b1.tiff',...args})
console.log('b1 branded')
execFileSync('magick',['/tmp/b0.tiff','/tmp/b1.tiff','-append','-set','colorspace','CMYK','-compress','Zip','/tmp/bapp.tiff'])
console.log('appended')
