# Print Type & Style System

The **type voice for the print environment** — the wall graphics, signage and
editorial text pieces exported as CMYK PDF/X. One coherent set of styles (grounds,
a heading scale, body, fonts, rules) so every print reads as one system and any
agent can lay out a new text wall without re-inventing sizes by eye.

> **Scope: print only.** These styles live in `src/print/` and apply to the print
> pieces. They are **not** the Remotion product videos / keynote (`src/remotion/`)
> and must not be wired into them. The print env owns its own fonts
> (`src/print/printFonts.tsx`) precisely so it stays decoupled from Remotion.

**Sources**: `src/print/pages/tipografia.ts` (scale maths), `src/print/pages/tipografia-kit.tsx`
(palettes + type styles + ground/rule/lockup), `src/print/pages/tipografia.tsx`
(the editorial text-wall page), `src/print/printFonts.tsx` (print-owned @font-face).
First proven on print **`marco-5-s-1`** (`public/prints/marco-5-s-1/doc.json`).

---

## The styles

### Grounds (palette) — chosen by `doc.theme`

`tipoPalette(theme)` → one of two grounds (`TipoPalette`): every colour token a
print needs (`bg`, `field`, `ink`, `inkSoft`, `muted`, `faint`, `hairline`, `accent`).

- **Light (default)** — `TIPO_LIGHT`: **clean white** ground, neutral near-black
  ink (`#141414`), cool greys for the descending hierarchy, one warm accent
  (`BRAND.orange`). *Muy fino, muy simple.*
- **Dark** — `TIPO_DARK`: deep ink ground, warm white type — one family with the
  velocity-room "data on dark" walls.

Flip ground with a one-line `doc.json` change (`"theme": "light" | "dark"`).

### Type scale — four headings + body + eyebrow

`eventTypeScale({ trimHeightMm, readingDistanceM, ratio?, h1CapFraction? })` returns
point sizes (for `geo.pt`) **and** the rendered cap-heights in mm. Hierarchy comes
from **size**, not weight — every heading is the hairline cut.

| Level | How it is sized | Role |
| --- | --- | --- |
| **H1** | `h1CapFraction` × trim height (proportion of the wall) | protagonist statement |
| **H2** | H1 / ratio | secondary line |
| **H3** | H1 / ratio² | tertiary deck |
| **H4** | H1 / ratio³ | smallest heading — bridge into body |
| **body** | the *comfort* size for the reading distance, clamped ≤ H4 | paragraph snippets |
| **eyebrow** | a fraction of body | tracked uppercase locator |

The headings are a **modular chord** (one `ratio`, default `EVENT_TYPE_RATIO` ≈ 1.6,
a "major sixth"; a wide/short wall can pass a larger ratio to separate them faster).

### Sizing law (museographic, researched)

Cap-height ∝ reading distance. Three anchors, all in `tipografia.ts` / `wayfinding.ts`:

- **Legibility floor** `CAP_CM_PER_METRE` — ≈ **1 cm of cap-height per 3 m**. The
  minimum nothing may drop below; **every level is clamped to it** (`minCapHeightMm`).
- **Comfort target** `COMFORT_CAP_CM_PER_METRE` — ≈ **1 inch per 10 ft** (~2.5 cm /
  3 m, ~2.5× the floor). **Body is sized to comfort**, never to the bare minimum.
- **Cap-height vs em** — the eye resolves the cap-height, CSS sizes the em, so
  `font-size = capHeight / capRatio` (`DISPLAY_CAP_RATIO` ≈ 0.72, `TEXT_CAP_RATIO`
  ≈ 0.70). `bodyMeasureMm()` gives a readable column width (≈45–75 char measure).

Sources: exhibition type guides (FARM, Canadian Museum for Human Rights) +
environmental-graphics "1 in / 10 ft" rule. Eye-band centre ~1.45–1.60 m (handled
per piece; a full-wall vinyl like `5-S-1` covers the whole wall instead).

### Fonts (print-owned)

`src/print/printFonts.tsx` declares the @font-face rules the print type system needs
via `staticFile`, so a page is self-sufficient in **both** hosts a print renders in —
the Vite app preview (`/prints.html`) and the headless Remotion export — and stays
safe in SSR tests. A page renders **`<PrintFonts />`** once and styles text with the
exported family constants:

- `PRINT_DISPLAY_HAIR` — headings. The **hairline (250 / weight-class 200) Display
  cut, exposed as its own single-face family** (`Universal Sans Display Hair`),
  because the browser's multi-weight matcher otherwise falls back to weight 400 and
  kills the *muy fino* look.
- `PRINT_TEXT_FONT` — body + eyebrow (Universal Sans Text).

### Ornament

One disciplined accent (a short tick / the warm rule), full-width **hairline rules**
(`Rule`, mm-thick so they read at distance), and the discreet **`Lockup`**
("AiKit Live"). Nothing else — no gradients on the light ground, no stock, no shouting.

---

## Authoring a print with this system

**Reuse the page (fastest)** — point a `doc.json` at the `tipografia` page and pass
the words as `props`:

```jsonc
// public/prints/<id>/doc.json
{
  "pageComponentId": "tipografia",
  "theme": "light",
  "dimensions": { "trimWidthMm": 9500, "trimHeightMm": 2500, "bleedMm": 10, ... },
  "dpi": 36,
  "color": { "mode": "cmyk", "iccProfile": "icc/CoatedFOGRA39.icc",
             "renderIntent": "relative", "pdfxVariant": "x1a" },
  "props": {
    "readingDistanceM": 3,
    "eyebrow": "S5 → S6 · El puente",
    "h1": "Coste marginal → 0",
    "h2": "Lo escaso se vuelve abundante.",
    "h3": "Ya pasó antes.",
    "h4": "Y vuelve a pasar.",
    "paragraphs": ["…", "…"],
    "ratio": 1.9,
    "h1CapFraction": 0.15
  }
}
```

**Build a new page** — import the kit + scale, render `<PrintFonts/>`, size every
level via `eventTypeScale` (so it stays legible + coherent), lay out in `geo` units:

```tsx
import { PrintFonts } from '../printFonts'
import { eventTypeScale } from './tipografia'
import { tipoPalette, TipoField, tipoH1, tipoBody, /* … */ } from './tipografia-kit'

const scale = eventTypeScale({ trimHeightMm: H, readingDistanceM })
// …render <PrintFonts/>, a <TipoField/>, then text via tipoH1(geo, scale.h1Pt, pal)…
```

## Rules for agents

- **Never hand-pick pt sizes** for print text — call `eventTypeScale` so every level
  clears the legibility floor and the hierarchy stays coherent across walls.
- **Reference the `PRINT_*` font constants and render `<PrintFonts/>`** — do not add
  print fonts to `src/remotion/fonts.tsx` or app CSS; the print env owns them.
- **Keep it print-scoped** — this system is for `src/print/` pieces, not the videos.
- Author in physical units via `geo` (`geo.mm` layout, `geo.pt` type); CMYK / FOGRA39
  / PDF/X, `renderIntent` ≠ `perceptual` for flat type. Gate with `npm run verify:print <id>`.

## Tested invariants

`tipografia.test.ts` proves the scale: the four-heading modular chord
(H1 > H2 > H3 > H4 ≥ body), body sized to comfort and clamped into the hierarchy,
**no level below the legibility floor**, pt⇄cap round-trips, determinism, input
validation. `tipografia-doc.test.ts` proves `5-S-1`'s authored doc: registration,
the CMYK/FOGRA39/PDF-X contract, physical fit to wall 5 (full-wall vinyl), legibility
at the reading distance, and that the real four headings + body render (not a blank).
