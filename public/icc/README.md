# ICC profiles

Color profiles used by the print export (`scripts/export-print.mjs`). The CMYK
**output profile** is the single biggest lever on print vivacity — see
`specs/print-generator.md`.

| File | Space | Role |
| --- | --- | --- |
| `sRGB.icc` | RGB | Source profile for the rendered raster (untagged RGB → sRGB). |
| `PSOuncoated_v3_FOGRA52.icc` | CMYK | **Default output profile.** PSO Uncoated v3 (FOGRA52) — the European **uncoated** standard (ISO 12647-2:2013). The event prints are output on **fabric**, which behaves like uncoated stock (high dot gain, lower max density), so this predicts the delivered colour far better than a coated profile. |
| `CoatedFOGRA39.icc` | CMYK | Coated alternative — Coated FOGRA39, the European **coated** press standard (≈ ISO Coated v2). Use only for jobs printed on coated/glossy paper. Kept for reference. |
| `GenericCMYK.icc` | CMYK | Legacy Apple "Generic CMYK" placeholder. **Narrow gamut, desaturates badly — kept only for reference; do not use.** |

## Why uncoated (FOGRA52) is the default

The prints ship on **fabric**. Textile (like uncoated paper) absorbs ink and has
high tone-value increase, so a coated profile over-promises saturation the cloth
cannot physically hold. FOGRA52 is the European uncoated standard and is the
honest soft-proof for this substrate: colours read a touch more muted on screen,
but that matches the printed fabric instead of flattering it.

Gamut note: an **uncoated** profile has a *smaller* gamut than a coated one, so
vivid brand colour desaturates a little more than under coated FOGRA39. This is
expected and correct for fabric — it is still vastly better than the old
`GenericCMYK.icc` placeholder (which dropped mean artwork saturation to **56%**;
FOGRA-class profiles hold the high-60s/70s). The brand blue `#0070f9` is outside
**any** CMYK gamut and will clip regardless of profile — only a spot/Pantone ink
can hit it exactly. **Validate with a printed fabric strike-off before the run.**

## Swapping in the print shop's profile (one line, no code)

When the shop gives you their exact profile (their own **fabric/textile** ICC, or
e.g. PSO Coated v3 / FOGRA51 for coated stock):

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

`PSOuncoated_v3_FOGRA52.icc` is the ECI "PSO Uncoated v3 (FOGRA52)" profile
(ISO 12647-2:2013, wood-free uncoated), provided by ECI with permission of
Heidelberger Druckmaschinen AG and free to use, embed and exchange.
`CoatedFOGRA39.icc` is the `Coated_Fogra39L_VIGC_300` profile. FOGRA/ICC
characterization profiles are freely distributable. Replace either with your
print provider's exact profile for production.
