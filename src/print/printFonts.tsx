import { staticFile } from 'remotion'

/**
 * printFonts — the font faces the **print style system** owns.
 * ──────────────────────────────────────────────────────────────────────────
 * This lives in the **print** environment on purpose: the print pieces are a world
 * of their own (CMYK walls, signage, credentials), *not* the Remotion product
 * videos. So the type voice declares its own faces here and references them by the
 * `PRINT_*` family constants — a print page is self-sufficient regardless of host.
 *
 * Why a dedicated component and not just the global font CSS:
 *   • The hairline (250 / weight-class 200) Display cut is exposed as its **own
 *     single-face family** — `Universal Sans Display Hair` — because the browser's
 *     multi-weight matcher otherwise falls back to 400 and kills the *muy fino* look.
 *   • `staticFile()` resolves the `/fonts/*` URLs in **both** hosts a print renders
 *     in — the Vite app preview (`/prints.html`) *and* the headless Remotion
 *     `renderStill` export — and returns a plain string under Node, so a page that
 *     renders `<PrintFonts/>` stays safe in `renderToStaticMarkup` SSR tests.
 *
 * Usage: a print page renders `<PrintFonts />` once, then styles its text with the
 * `PRINT_*` family constants (see `pages/tipografia-kit.tsx`). Documented in
 * `specs/print-typography.md`.
 */

/** [family, file, format, weight] — the faces the print type system needs. */
const PRINT_FACES: Array<[string, string, string, string]> = [
  ['Universal Sans Text', 'fonts/Universal-Sans-Text-400.otf', 'opentype', '400'],
  ['Universal Sans Text', 'fonts/Universal-Sans-Text-550.otf', 'opentype', '500 600'],
  ['Universal Sans Text', 'fonts/Universal-Sans-Text-700.ttf', 'truetype', '700'],
  // The hairline cut as its own one-weight family so 400-fallback can't happen.
  ['Universal Sans Display Hair', 'fonts/Universal-Sans-Display-250.ttf', 'truetype', '400'],
  // The legible Display cuts (Regular / Medium) for headings that must read at size.
  ['Universal Sans Display', 'fonts/Universal-Sans-Display-400.otf', 'opentype', '400'],
  ['Universal Sans Display', 'fonts/Universal-Sans-Display-550.otf', 'opentype', '500 600'],
]

const PRINT_FONT_CSS = PRINT_FACES.map(
  ([family, file, format, weight]) => `@font-face{
  font-family:'${family}';
  src:url('${staticFile(file)}') format('${format}');
  font-style:normal;font-weight:${weight};font-display:block;
}`,
).join('\n')

/** Body / labels — Universal Sans Text. */
export const PRINT_TEXT_FONT = "'Universal Sans Text', ui-sans-serif, system-ui, sans-serif"

/** Headings — the true hairline Display cut (size, not weight, carries hierarchy). */
export const PRINT_DISPLAY_HAIR =
  "'Universal Sans Display Hair', 'Universal Sans Display', ui-sans-serif, system-ui, sans-serif"

/** Headings — the legible Display cut (Regular/Medium) for titles that must read at size. */
export const PRINT_DISPLAY = "'Universal Sans Display', ui-sans-serif, system-ui, sans-serif"

/** Inject the print type system's @font-face rules. Render once per print page. */
export function PrintFonts() {
  return <style>{PRINT_FONT_CSS}</style>
}
