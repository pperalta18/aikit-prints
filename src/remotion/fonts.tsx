import { staticFile } from 'remotion';

/**
 * The neumorphic components expect the Universal Sans families. Vite resolves
 * the `/fonts/*` URLs in src/index.css against public/, but webpack (Remotion's
 * bundler) does not — so we re-declare @font-face here using `staticFile`,
 * which points at the same public/fonts assets through Remotion's static server.
 */
const FACES: Array<[string, string, string, string]> = [
  ['Universal Sans Text', 'fonts/Universal-Sans-Text-400.otf', 'opentype', '400'],
  ['Universal Sans Text', 'fonts/Universal-Sans-Text-550.otf', 'opentype', '500 600'],
  ['Universal Sans Text', 'fonts/Universal-Sans-Text-700.ttf', 'truetype', '700'],
  ['Universal Sans Display', 'fonts/Universal-Sans-Display-250.ttf', 'truetype', '250'],
  ['Universal Sans Display', 'fonts/Universal-Sans-Display-400.otf', 'opentype', '400'],
  ['Universal Sans Display', 'fonts/Universal-Sans-Display-550.otf', 'opentype', '500 600'],
  ['Universal Sans Display', 'fonts/Universal-Sans-Display-700.ttf', 'truetype', '700'],
  ['Universal Sans Display', 'fonts/Universal-Sans-Display-820.ttf', 'truetype', '800 900'],
];

const FONT_CSS = FACES.map(
  ([family, file, format, weight]) => `@font-face{
  font-family:'${family}';
  src:url('${staticFile(file)}') format('${format}');
  font-style:normal;font-weight:${weight};font-display:block;
}`,
).join('\n');

export const BODY_FONT =
  "'Universal Sans Text', ui-sans-serif, system-ui, sans-serif";

export function Fonts() {
  return <style>{FONT_CSS}</style>;
}
