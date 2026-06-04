# aikit-prints

Standalone **print framework** for AiKit Live: neumorphic CMYK wall graphics,
signage, credentials and editorial text walls, plus a 3D event-space preview to
mount prints on the venue walls at real scale.

It was extracted from the `neo-work` monorepo and is fully self-contained — no
Remotion product videos, no keynote/grid app, no Storybook.

## Quick start

```bash
npm install
npm run dev          # open the print generator GUI (http://localhost:5173)
```

Each print is a document at `public/prints/<id>/doc.json`. The GUI lists them,
previews them live, and can export them.

## Exporting print-ready files

```bash
npm run export -- <id> --format pdf      # CMYK PDF/X at the doc's DPI
npm run export -- <id> --format png      # raster proof
npm run tile   -- <id>                   # split an oversize wall into panels
```

The PDF/CMYK pipeline shells out to these tools — install them first
(macOS: `brew install ghostscript imagemagick mupdf-tools poppler`):

| tool        | binary    | used for                          |
| ----------- | --------- | --------------------------------- |
| Ghostscript | `gs`      | RGB→CMYK PDF/X conversion          |
| ImageMagick | `magick`  | PNG → sized RGB PDF                |
| MuPDF       | `mutool`  | PDF post-processing                |
| poppler     | `pdfinfo` | PDF box verification              |

## Space / layout tools

```bash
npm run control-table   # per-wall control table
npm run legibility       # legibility report
npm run coverage         # wall-coverage report
npm run sources          # source-attribution report
npm run frames           # (re)generate the full-bleed marco frames — DESTRUCTIVE
npm run verify:print     # verify a doc's print geometry/DPI
```

## Tests

```bash
npm test     # node unit tests: geometry, type scales, tiling
```

## Layout

```
src/print/            print system (pages, space/3D, geometry, GUI)
src/remotion/         single PrintPage composition for headless export
src/lib, src/stories, src/components   shared neumorphic design language
scripts/              export + space-analysis CLIs
public/prints/<id>/   print documents (doc.json + assets)
public/{fonts,brand,icc}   Universal Sans fonts · AiKit Live logo · CMYK profiles
specs/                print typography, generated assets, wall graphics, brief
```

See `specs/print-typography.md` before laying out any print text.
