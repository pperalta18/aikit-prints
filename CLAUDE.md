# AiKit Prints

Standalone print framework for AiKit Live — neumorphic CMYK wall graphics,
signage, credentials and editorial text walls. Extracted from `neo-work`; this
project has **no dependency** on it and carries none of the Remotion product
videos, the keynote/grid app or Storybook.

## What's here

- `src/print/` — the whole print system: pages (`pages/`), the 3D event-space
  preview (`ui/EventSpaceScene`, `space/`), geometry/tiling/PDF box math, and
  the operator GUI (`ui/PrintsApp`). Entry: `src/print/main.tsx`.
- `src/remotion/` — a single generic `PrintPage` composition used by the export
  pipeline to `renderStill` each print at its exact pixel size. Nothing else.
- `src/lib/neumorphism.ts`, `src/stories/neo/*`, `src/components/Aikit*Logo` —
  the shared neumorphic design language the prints reuse.
- `scripts/` — export (`export-print`), tiling (`tile-print`) and the space
  analysis tools (control-table, legibility, sources, coverage, frames, verify).
- `public/prints/<id>/doc.json` — every print is a document; `public/{fonts,brand,icc}`
  hold the Universal Sans fonts, the AiKit Live logo and the CMYK ICC profiles.

## Running

- `npm run dev` — the print generator GUI (the live app where design is judged).
- `npm run export -- <id> --format pdf` — render a print to a CMYK PDF/X.
  Needs the system binaries **ghostscript (`gs`)**, **ImageMagick (`magick`)**,
  **mupdf (`mutool`)** and **poppler (`pdfinfo`)** on PATH.
- `npm test` — node unit tests (geometry, scales, tiling — no browser/GL).

## Print styles

Print pieces share one **print-only** type & style system — grounds/palette, a
distance-anchored four-heading scale, and print-owned fonts (hairline Universal
Sans Display). **Read `specs/print-typography.md` before laying out print text.**
Size text via `eventTypeScale` (never hand-pick pt) and use the `tipografia-kit`
styles + `PRINT_*` fonts (`<PrintFonts/>`).

## Generated Assets

When a layout needs imagery that doesn't exist yet, generate it (don't ship
placeholders). Commit PNGs under `public/prints/<id>/assets/` and load them via
`staticFile`. See `specs/generated-assets.md`.

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for commands.
Core: `open <url>` → `snapshot -i` (refs @e1…) → `click @e1` / `fill @e2 "text"`.
