# Neumorphism Engine

Computes the soft-shadow "neumorphic" look from a theme and a light source, so
the same surface can be re-lit at runtime instead of using fixed shadows.

## Capabilities

- Authors can render plates as **raised**, **recessed** (pressed / carved in), or **flat**.
- Authors can switch the whole scene between **light** and **dark** themes.
- Authors can move the **light source** to any corner (`tl`, `tr`, `bl`, `br`); every
  shadow re-orients accordingly. The light source can be animated.
- A raised plate shows its highlight on the lit corner and its shadow on the opposite
  corner; a recessed plate is the exact inverse (carved hole).
- Authors have a **secondary brand palette** (`BRAND`) for sparing accents — `red`,
  `orange`, `yellow`, `green`, `teal`, `purple`, `violet`, `pink` (plus `blue`). Blue
  (`KIT_BLUE`, `#0070f9`) stays the primary accent; the rest are reclusive (status,
  hang-up / window buttons, multi-series charts).

## Constraints

- Light mode surface is `#f4f4fa` (highlight `#ffffff`, shadow `#c9d7e8`); dark mode
  surface is `#161a20` (highlight `#212830`, shadow `#05070a`). Brand palette and surface
  values match the Figma "Economía de guerra" reference.
- Default grid module is 128px; default plate inset inside a cell is 22px.
- Flat state is rendered as a zero-offset shadow (not `none`) so it can interpolate
  smoothly to raised during animation.

## Related specs

- [Grid & Cells](./grid-and-cells.md) — consumes the engine to paint cells.
- [Storybook Catalog](./storybook-catalog.md) — Neo components + widgets built on the engine.

## Source

- [src/lib/neumorphism.ts](../src/lib/neumorphism.ts)
