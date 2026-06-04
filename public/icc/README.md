# ICC profiles

Color profiles used by the print export (`scripts/export-print.mjs`). The CMYK
**output profile** is the single biggest lever on print vivacity — see
`specs/print-generator.md`.

| File | Space | Role |
| --- | --- | --- |
| `sRGB.icc` | RGB | Source profile for the rendered raster (untagged RGB → sRGB). |
| `CoatedFOGRA39.icc` | CMYK | **Default output profile.** Coated FOGRA39 — the European coated press standard (≈ ISO Coated v2). |
| `GenericCMYK.icc` | CMYK | Legacy Apple "Generic CMYK" placeholder. **Narrow gamut, desaturates badly — kept only for reference; do not use.** |

## Why FOGRA39 is the default

The original `GenericCMYK.icc` (Apple's "Generic CMYK Profile") has a small gamut
and clips vivid colour hard. Measured on the real credencial artwork, mean
saturation dropped to **56%**; through FOGRA39 it holds at **71%** (KIT_BLUE
`#0070f9` goes 49% → 61%). FOGRA39 is also the standard most European print shops
use, so the on-screen soft-proof closely matches the delivered job.

## Swapping in the print shop's profile (one line, no code)

When the shop gives you their exact profile (often PSO Coated v3 / FOGRA51 for
coated stock, or a PSO Uncoated profile for uncoated):

1. Drop their `.icc` into this folder.
2. Point each `public/prints/<id>/doc.json` at it:
   ```json
   "color": { "mode": "cmyk", "iccProfile": "icc/THEIR_PROFILE.icc", "renderIntent": "relative", "pdfxVariant": "x1a" }
   ```
3. Re-export: `npm run export -- <id> --format pdf` and gate with `npm run verify:print <id>`.

`renderIntent` maps colour into the target gamut: `relative` (default) keeps
in-gamut colour at full strength and clips only out-of-gamut colour; `saturation`
is marginally punchier for flat brand graphics; `perceptual` is for photos.

## Provenance

`CoatedFOGRA39.icc` is the `Coated_Fogra39L_VIGC_300` profile (FOGRA characterization
data). FOGRA/ICC characterization profiles are freely distributable. Replace with
your print provider's profile for production.
