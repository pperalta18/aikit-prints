import type { PrintPageComponent } from '../types'
import { SampleA4 } from './sample-a4'
import { AikitEventBadge } from './aikit-event-badge'
import { Signage } from './signage'
import { ExhibitionWallPanel } from './exhibition-wall-panel'
import { AgiTimeline } from './agi-timeline'
import { AikitLiveMural } from './aikit-live-mural'
import { Bienvenida } from './bienvenida'
import { Llegada } from './llegada'
import { Direccional } from './direccional'
import { Plano } from './plano'
import { IdentificadorSala } from './identificador-sala'
import { Acreditacion } from './acreditacion'
import { Aseos } from './aseos'
import { AccesoRestringido } from './acceso-restringido'
import { Wifi } from './wifi'
import { Mesa } from './mesa'
import { Credencial } from './credencial'
import { RasterWall } from './raster-wall'
// Explicit `.tsx`: `hero-solar.ts` (pure math) shares the basename, so a bare
// `./hero-solar` would resolve to the math module, not the page component.
import { HeroSolar } from './hero-solar.tsx'
// Code-track model-scale pair (9E1 + 8S1). `escala-modelos.ts` is the shared math,
// `escala-modelos-kit.tsx` the kit — distinct basenames, so bare page imports are safe.
import { Escala9E1 } from './escala-9e1'
import { Escala8S1 } from './escala-8s1'
// Same basename caveat: `aceleracion.ts` is the pure layout math.
import { Aceleracion } from './aceleracion.tsx'
// Same basename caveat: `codigo.ts` is the pure bar-chart math.
import { Codigo } from './codigo.tsx'
// Typographic / wayfinding wall graphic. `wayfinding.ts` (museographic math) and
// `wayfinding-kit.tsx` (the kit) are separate basenames, so a bare import is safe.
import { WayfindingS1S2 } from './wayfinding-s1-s2'
// Same basename caveat as hero/model-sizes: `umbral.ts` is the pure layout math.
import { Umbral } from './umbral.tsx'
// Same basename caveat: `micro-acento.ts` is the pure wrap/type-scale math.
import { MicroAcento } from './micro-acento.tsx'
// Event typographic system (editorial text wall). `tipografia.ts` (the type-scale
// math) + `tipografia-kit.tsx` (the kit) share/neighbour the basename → explicit `.tsx`.
import { Tipografia } from './tipografia.tsx'
// Central S2 cube faces (22-S/23-N/24-E/25-W): painted ground + editorial numeral + title.
import { CuboCara } from './cubo-cara'
// Same basename caveat: `galaxy.ts` is the pure layout math (phyllotaxis + slicing).
import { Galaxy } from './galaxy.tsx'
// Reusable empty frame — a correctly-sized, press-ready blank canvas (one page, many docs).
import { Blank } from './blank'
// Reusable flat colour field — a full-bleed solid fill (one page, many docs).
import { Solid } from './solid'
// Small editorial next-room indicator (left-margin "marginalia" tag). First on wall 2-W-1.
import { ProximaSala } from './proxima-sala'
// Museum-painting page (relief image as protagonist + fine cartela). `cuadro.ts`
// (pure layout maths) shares the basename, so the page import is explicit `.tsx`.
import { Cuadro } from './cuadro.tsx'
// Image-track #11 (wall 11-W-IMAGE): editorial museum-grid timeline of AI image
// generation (2023→hoy) — tiled panels w/ seams, giant staggered years, image
// mosaics per era, arrows, one blue accent on «2026 · HOY».
import { EvolucionImagen } from './evolucion-imagen'
// Code-track #11 (wall 11-W-TEXT+CODE): context window as relatable text volume
// (unas páginas → una novela → dos biblias). Real sourced data, √-scaled stacks.
import { Contexto } from './contexto'
// Image-track video evolution (wall 2-E-IMAGE): Will Smith eating spaghetti —
// per-year columns of video frames, quality climbing left→right (hockey-stick).
import { EvolucionVideo } from './evolucion-video'
// Gallery-row of paintings (wall 11-E-1): one framed «cuadro» per century — the
// home through the ages (VII · X · XII · XVII · XIX · XX · XXI), image + caption.
import { Hogares } from './hogares'
// Image-track #13 (13-N-1 / 13-S-1): «La Naranja Mecánica» — each game upgrade
// (autonomous truck, dark factory…) paired with a framed real photo: ya está pasando.
import { NaranjaMecanica } from './naranja-mecanica'
// Section-title wall (01 · La energía artificial): the Figma slide composition rebuilt
// in the «El Año Cero» register — ink on warm paper, single blue accent, a carved «01»
// and a neumorphic light-bulb relief (the allegory of «artificial energy»).
import { SeccionEnergiaArtificial } from './seccion-01-energia-artificial'
// Editorial table-of-contents wall (5-S-1, S5→S6 bridge): a narrow ruled «índice»
// held to the left — nº · room · deck per entry, one KIT_BLUE «you-are-here» tick.
import { Indice } from './indice'
// Code-track #10 (10-N-1, S1→S2): «La última palabra» — a sea of phrases each missing
// its final word (blank rule); filling any one needs a world model, not autocomplete.
// `palabra-faltante.ts` (corpus + deterministic packer) shares the basename → explicit `.tsx`.
import { PalabraFaltante } from './palabra-faltante.tsx'
// Galaxia · warp espacio-tiempo (free-standing canvas «galaxia-warp», the three INVERSIÓN
// walls joined): a gravity-well drawn por celdas, darkening into the IA+Nvidia black hole.
// `warp.ts` (pure geometry) shares the basename → explicit `.tsx`.
import { Warp } from './warp.tsx'
// Brand mosaic wall (11-E-2 «La Naranja Mecánica»): a full-height grid of brand
// imagery — photos sized by format + solid orange cells + placeholders, filling the
// whole wall. `mosaico.ts` (pure bay-packing) shares the basename → explicit `.tsx`.
import { Mosaico } from './mosaico.tsx'

/**
 * Page registry — maps a `doc.pageComponentId` to its React component. Add a new
 * print page here after authoring it under `src/print/pages/`.
 */
export const PRINT_PAGES: Record<string, PrintPageComponent> = {
  'sample-a4': SampleA4,
  'aikit-event-badge': AikitEventBadge,
  signage: Signage,
  'exhibition-wall-panel': ExhibitionWallPanel,
  'agi-timeline': AgiTimeline,
  'aikit-live-mural': AikitLiveMural,
  // ── AiKit Live signage system (editorial wayfinding family) ──
  bienvenida: Bienvenida,
  llegada: Llegada,
  direccional: Direccional,
  plano: Plano,
  'identificador-sala': IdentificadorSala,
  acreditacion: Acreditacion,
  aseos: Aseos,
  'acceso-restringido': AccesoRestringido,
  wifi: Wifi,
  mesa: Mesa,
  // ── Accreditation cards (lanyard credentials: speaker · host · staff · guest) ──
  credencial: Credencial,
  // ── Image-track wall graphics (reusable full-bleed raster; one page, many docs) ──
  'raster-wall': RasterWall,
  // ── Code-track hero (wall 2, S3 INVESTMENT face): circle area ∝ money ──
  'hero-solar': HeroSolar,
  // ── Code-track model-scale pair (S2 "tamaño de modelos"): one shared area scale ──
  // 9E1 = Perceptrón · AlexNet · GPT-2 (the small ones); 8S1 = GPT-4, the fragment.
  'escala-9e1': Escala9E1,
  'escala-8s1': Escala8S1,
  // ── Code-track #11 (wall 11, S3): zoned acceleration charts (task horizon + context) ──
  aceleracion: Aceleracion,
  // ── Code-track #16 (wall 16, S3): zoned code-gen value charts (dev time + AI-written %) ──
  codigo: Codigo,
  // ── Code-track #10 (wall 10, S1→S2): typographic wayfinding — name + arrow to next zone ──
  'wayfinding-s1-s2': WayfindingS1S2,
  // ── Small next-room indicator (wall 2-W-1): left-margin filete + room name, quiet/editorial ──
  'proxima-sala': ProximaSala,
  // ── Code-track #3 (wall 3, S2→S3): typographic title-band — sequences the 3 nave cameras ──
  umbral: Umbral,
  // ── Code-track #14 (wall 14, S5→S6): typographic micro-accent — one strong phrase ──
  'micro-acento': MicroAcento,
  // ── Event typographic system (editorial text wall): 3 headings + body snippets ──
  tipografia: Tipografia,
  // ── Central S2 cube faces: painted ground + big hairline numeral (01–04) + title ──
  'cubo-cara': CuboCara,
  // ── Galaxia de mercados (5N1 + 2-E-inv + 11-W-inv): area ∝ valoración, one shared scale ──
  galaxy: Galaxy,
  // ── Reusable empty frame: a press-ready blank canvas at the doc's real size ──
  blank: Blank,
  // ── Reusable flat colour field: a full-bleed solid fill (props.fill) ──
  solid: Solid,
  // ── Museum-painting walls (3-N-1, 8-N-1, 19-N-1): allegorical relief + cartela ──
  cuadro: Cuadro,
  // ── Image-track #11 (11-W-IMAGE): timeline of AI image generation (años + muestras) ──
  'evolucion-imagen': EvolucionImagen,
  // ── Code-track #11 (11-W-TEXT+CODE): ventana de contexto como volumen de texto legible ──
  contexto: Contexto,
  // ── Image-track video (2-E-IMAGE): Will Smith comiendo espaguetis, columnas de frames/año ──
  'evolucion-video': EvolucionVideo,
  // ── Gallery row (11-E-1): one framed painting per century — «el hogar a través de los siglos» ──
  hogares: Hogares,
  // ── Image-track #13 (13-N-1 / 13-S-1): «La Naranja Mecánica» — asset del juego → prueba real ──
  'naranja-mecanica': NaranjaMecanica,
  // ── Section-title wall (01 · La energía artificial): carved «01» + light-bulb relief, El Año Cero register ──
  'seccion-01-energia-artificial': SeccionEnergiaArtificial,
  // ── Editorial índice (5-S-1, S5→S6 bridge): narrow ruled table-of-contents on the left ──
  indice: Indice,
  // ── «La última palabra» (10-N-1, S1→S2): un mar de frases con la última palabra omitida ──
  'palabra-faltante': PalabraFaltante,
  // ── Galaxia · warp espacio-tiempo (canvas libre 23.5×2.5 m): pozo gravitatorio por celdas ──
  warp: Warp,
  // ── Brand mosaic (11-E-2 «La Naranja Mecánica»): full-height grid de marca (foto · sólido · placeholder) ──
  mosaico: Mosaico,
}

export function getPrintPage(id: string): PrintPageComponent | undefined {
  return PRINT_PAGES[id]
}
