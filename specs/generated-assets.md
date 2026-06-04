# Generated Assets (image-gen)

**Keywords**: image generation, fal.ai, GPT Image 2, `/image-gen` skill,
generate.py, assets, photos, illustrations, figures, product shots, hero banners,
category thumbnails, portraits, avatars, textures, logos, staticFile, public/,
scene imagery, mockup imagery, storefront photos, no-text prompts.

## Purpose

Whenever a scene, mockup, or composition needs imagery that doesn't exist yet,
**generate it with the image-gen skill** instead of shipping a placeholder, an
empty box, or "a grey rectangle here". Always match the generated style to the
specific case so the asset looks native to the surface it lands on.

This is a standing project convention: if an image would make the thing read as
real, and none is available, generate it.

## When to use

- A **Remotion scene** needs real imagery — e.g. the Documents scene's newspaper
  photo, scientific chart, magazine spread, product shot and flow diagram, each
  matched to its document archetype and bleeding off-frame.
- A **mockup or layout** needs visuals — e.g. if asked to lay out an **online
  store**, generate the product photos, the hero/lifestyle banner and the
  category thumbnails, all in one coherent style so the storefront reads as one
  brand. Likewise: an article needs a header image, a profile needs a portrait,
  a dashboard needs an avatar, a landing needs a hero.
- Any time "an image would sell this" and there isn't one already in
  `artifacts/` or `public/`.

Don't use it for things better made in code: UI chrome, gradients, charts driven
by data, simple icons (prefer the curated **Hugeicons** set), or neumorphic
plates (use the engine). Reach for a real image only when a *photo/illustration*
is what's missing.

## Workflow

1. **Plan the asset list.** Decide each file and write a concrete, style-matched
   prompt: subject + style + lighting + background, tied to where it lands
   (era of the document, brand palette, neumorphic light surface `#f4f4fa`, etc.).
2. **Run the helper** (the skill wraps submit / poll / download). Generate
   independent assets in parallel:

   ```bash
   python3 ~/.claude/skills/image-gen/generate.py "<prompt>" \
     --out public/<scene>/<name>.png --size landscape_16_9 --quality medium
   ```

3. **Commit the PNGs** under `public/<scene>/` and load them in Remotion / React
   with `staticFile('<scene>/<name>.png')` — webpack (Remotion's bundler) does
   **not** resolve `/…` URLs against `public/` the way Vite does.
4. **Verify**: read the generated image and confirm it matches before wiring it
   in; regenerate the prompt if not.

## Conventions / Constraints

- **Location**: one folder per scene/feature under `public/` (e.g. `public/docs/`).
- **Style cohesion**: prompts must pin the style so a set of assets looks like one
  brand/world (same lighting, palette, background treatment).
- **`no text`**: add it to the prompt whenever real text is overlaid in code —
  model-rendered text comes out garbled. (The Documents scene overlays all words
  itself, so every prompt ends with "no text".)
- **Size to the crop**: if the asset bleeds / is zoomed, oversize it.
  `--quality medium` is fine for fast drafts and bleeding crops; use `high` for
  hero or full-frame assets.
- **Determinism**: generated images are **committed static files**, never
  generated at render time. `staticFile` keeps Remotion renders reproducible and
  distributable across machines (same rule as no `Date.now()` / `Math.random()`).
- **Credentials**: `FAL_KEY` from the environment or `~/.claude/fal.env` (the
  skill handles it). Never hardcode the key.

## Related specs

- [Product Video (Remotion)](./product-video.md) — scenes that consume generated assets.
- [Storybook Catalog](./storybook-catalog.md) — storefront / POS / landing widgets that may need imagery.
- [Neumorphism Engine](./neumorphism-engine.md) — surface colour + brand palette to match prompts against.
- [Device Mockups (3D)](./device-mockups.md) — screenshots/UI painted onto devices (a different kind of asset).

## Source

- **Skill**: `~/.claude/skills/image-gen/` (`generate.py`) — invoked as `/image-gen`.
- **Assets**: [public/docs/](../public/docs) (and future `public/<scene>/`).
- **Consumer example**: [src/remotion/DocumentsVideo.tsx](../src/remotion/DocumentsVideo.tsx).
