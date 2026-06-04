import type { CSSProperties } from 'react'
import { Img, staticFile, getRemotionEnvironment } from 'remotion'
import type { PrintGeometry } from '../geometry'
import { PRINT_DISPLAY_HAIR, PRINT_TEXT_FONT } from '../printFonts'
import type { TipoPalette } from './tipografia-kit'

/**
 * cuadro-kit — the **museum-cartela** type register + the hung-painting frame.
 * ──────────────────────────────────────────────────────────────────────────
 * A second voice on top of the event type system (`tipografia-kit`): where that
 * kit is the *wall headline* register (read across the room), this one is the
 * **museum label** register — the fine, quiet typography of a `cartela` you read
 * at arm's length, standing in front of a hung work. Same fonts, same two
 * grounds (it reuses `TipoPalette`), so a `cuadro` wall stays one family with the
 * rest of the print system; it only adds the *small, intimate* end of the voice
 * the brief asked for ("necesitas más estilos de texto"):
 *
 *   • `cartelaEyebrow` — the room/section locator above the title (tracked caps).
 *   • `cartelaTitle`   — the allegorical work-title (hairline Display, intimate).
 *   • `cartelaSubtitle`— an optional quiet second line / dedication.
 *   • `cartelaBody`    — the fine editorial label text (Text face, airy leading).
 *   • `cartelaMeta`    — the *ficha técnica* (técnica · soporte · colección · año).
 *
 * Sizes are NOT hand-picked here — the page sizes every level through the
 * unit-tested `eventTypeScale` at the *approach* reading distance (≈1.5–1.8 m,
 * because you step up to a label), so the cartela clears the legibility floor at
 * that distance while staying small enough that **the image is the protagonist**.
 * Pure inline styles (Remotion has no Tailwind); the page passes points it got
 * from the scale into these recipes via `geo.pt`.
 */

/* ── the museum-label type register (sized in points via geo) ─────────────────── */

/** Eyebrow — the room/section locator above the title. Tracked, upper, quiet. */
export function cartelaEyebrow(geo: PrintGeometry, sizePt: number, color: string, weight = 600): CSSProperties {
  return {
    fontFamily: PRINT_TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    letterSpacing: geo.pt(sizePt * 0.2),
    textTransform: 'uppercase',
    lineHeight: 1.1,
    color,
    margin: 0,
  }
}

/** Title — the allegorical work-title. Hairline Display, intimate size, ink. */
export function cartelaTitle(geo: PrintGeometry, sizePt: number, pal: TipoPalette, weight = 400): CSSProperties {
  return {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.04,
    letterSpacing: geo.pt(-sizePt * 0.008),
    color: pal.ink,
    margin: 0,
  }
}

/** Subtitle — an optional quiet second line. Hairline Display, softer colour. */
export function cartelaSubtitle(geo: PrintGeometry, sizePt: number, pal: TipoPalette, weight = 400): CSSProperties {
  return {
    fontFamily: PRINT_DISPLAY_HAIR,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.14,
    letterSpacing: geo.pt(-sizePt * 0.004),
    color: pal.inkSoft,
    margin: 0,
  }
}

/** Body — the fine editorial label text. Text face, airy museographic leading. */
export function cartelaBody(geo: PrintGeometry, sizePt: number, pal: TipoPalette, weight = 400): CSSProperties {
  return {
    fontFamily: PRINT_TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    lineHeight: 1.62,
    color: pal.inkSoft,
    margin: 0,
  }
}

/** Meta — the *ficha técnica* line. Smallest, lightly tracked, faint. Not upper. */
export function cartelaMeta(geo: PrintGeometry, sizePt: number, color: string, weight = 500): CSSProperties {
  return {
    fontFamily: PRINT_TEXT_FONT,
    fontSize: geo.pt(sizePt),
    fontWeight: weight,
    letterSpacing: geo.pt(sizePt * 0.04),
    lineHeight: 1.3,
    color,
    margin: 0,
  }
}

/* ── a short label divider (the one rule on the cartela) ─────────────────────── */

/** A short hairline rule under the title block — the cartela's only ornament. */
export function CartelaDivider({
  geo,
  pal,
  widthMm,
  color,
  thicknessMm = 0.8,
}: {
  geo: PrintGeometry
  pal: TipoPalette
  /** Rule length in mm. */
  widthMm: number
  color?: string
  /** Rule thickness in mm. */
  thicknessMm?: number
}) {
  return (
    <div
      style={{
        width: geo.mm(widthMm),
        height: Math.max(1, geo.mm(thicknessMm)),
        background: color ?? pal.hairline,
      }}
    />
  )
}

/* ── the hung painting (framed raster) ───────────────────────────────────────── */

/**
 * The painting itself: a raster relief mounted to fill its (absolutely-positioned)
 * parent box, lifted off the gallery wall by a soft drop shadow and traced by a
 * faint mat keyline so it reads as a *hung work*. `object-fit: contain` keeps the
 * carved stone frame of the relief fully visible (size the box to the asset's
 * aspect so there's no letterbox).
 *
 * Mirrors the `raster-wall` host split: Remotion's `<Img>` waits for the bitmap to
 * decode (so the deterministic `renderStill` export never captures it blank), but
 * `<Img>` needs a composition context and throws in the plain browser preview, so
 * a bare `<img>` is used there. `staticFile` keeps the path valid in both hosts.
 */
export function Painting({
  geo,
  src,
  alt,
  pal,
  shadow = true,
  keyline = true,
}: {
  geo: PrintGeometry
  /** Path relative to `public/` (already normalised), for `staticFile`. */
  src: string
  alt?: string
  pal: TipoPalette
  shadow?: boolean
  keyline?: boolean
}) {
  const file = staticFile(src)
  const imgStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: 'center',
    display: 'block',
  }
  const frameStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: pal.bg,
    boxShadow: shadow ? `0 ${geo.mm(7)}px ${geo.mm(26)}px rgba(20,20,20,0.18)` : undefined,
    outline: keyline ? `${Math.max(1, geo.mm(0.6))}px solid ${pal.hairline}` : undefined,
    outlineOffset: 0,
  }
  return (
    <div style={frameStyle}>
      {getRemotionEnvironment().isRendering ? (
        <Img src={file} alt={alt ?? ''} style={imgStyle} />
      ) : (
        <img src={file} alt={alt ?? ''} style={imgStyle} />
      )}
    </div>
  )
}
