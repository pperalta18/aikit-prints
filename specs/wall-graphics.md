# Wall Graphics Production (AiKit Live)

Production system + methodology for **all wall graphics** (vinyls / light-boxes)
of the AiKit Live expo: research → produce (code-rendered data-viz **or**
image-gen) → dimension to the real wall → apply in the 3D maquette at true scale →
export press-ready CMYK PDF/X. Covers the 20 wall graphics of the event space (the
confesionario booth is a curated object, not a wall graphic).

> AiKit Live — private premium B2B event, **2026-06-17, Finca El Olivar**,
> CMO/CFO audience. Guests walk a **6-room emotional funnel** *before* the talk.
> Central message: *"the human brain is great at creating and thinking, but we've
> trapped it acting like the slow CPU of an Excel — AI frees us from being robots."*

> **Source of meaning & copy:** the canonical creative brief (room narratives,
> every interactive/visual element, tone) lives in [`expo-guion.md`](./expo-guion.md).
> Its room numbering is **conceptual and does not map 1:1** to the physical walls
> below — read it for *what each room must say*, this doc + the wall registry for
> *which wall carries it*.

## The funnel (walk order)

Enter from the **south** (S1), exit **north** to the talk. The north `spawn`
marker is the **exit**, not the entrance.

1. **S1 · Bici — ¿WTF?** Sensory disruption, dramatic light. **No text.**
2. **S2 · Intro IA — Lo entiendo.** Demystify ("matrix multiplication", "you are the neuron").
3. **S3 · Velocidad / Showroom — Es inevitable.** Hockey-stick, scale & investment. **Densest in wall graphics.** Central nave with 3 cameras: IMAGE → TEXT+CODE → INVESTMENT.
4. **S4 · Ineficiencias — Somos ineficientes.** Cinema, human-slow vs AI. Never denigrate the visitor.
5. **S5 · Cuellos de botella — Tiene sentido.** The juice game; human marginal cost → zero.
6. **S6 · Pobreza histórica — Ya pasó antes.** Industrial revolution, salon timeline. Fast message (people are tired by now).
   Close: **cocktail** (classy, warm) and exit to the talk.

Expo tone is conceptual, provocative, dry-humoured; it **celebrates human
capability and never denigrates** (distinct from the darker, more urgent web tone).

## Non-negotiable principles

- **Message-first curation.** Every piece transmits **one** clear message (e.g.
  *the speed of AI*). The message decides which stats appear — **any figure that
  doesn't make that message land is cut**, however interesting. Data serves the
  room's emotional objective; it is never a data dump.
- **No blank walls** — none of the 20.
- **No spoilers** of what happens inside each experience. The wall **names,
  orients, and delivers one strong graphic**; it does not tell the ending.
- **The wall orders, not just decorates.** Background *families* signal "these
  belong together" and sequence; in timeline rooms the background **is** the
  left→right time axis.
- **High-end imagery.** Prefer very high-quality print / **light-box** (backlit
  "Apple-storefront" look), not flat matte — modelled and lit accordingly in 3D.
- **Screens / totems / objects are curation, not walls** — do not generate them
  (Will Smith screens, the juice totems, the confesionario interactive, the
  metacrilato box, etc.); only respect their space.

## Art direction

- Register: **rationalist / brutalist, very refined.** No florituras, no generic
  "AI-art", no cursi gradients, no stock.
- **Typography is the protagonist:** strict grid, clear hierarchy, lots of air,
  clean alignment. Brand palette; sober high-contrast default; per-room accent
  (combustion = warm; velocity = data on dark; juice = warm orange/gold; cocktail
  = warm classy) within one coherent system.
- **Honest, beautiful data-viz:** clear axes, legible labels, no needless 3D, no
  chartjunk. If a scale is distorted to fit/see, **say so on the piece**
  ("representado a escala"). Sources in a discreet caption.

## Format / museographic standards

- Research museographic standards **before** fixing type sizes; document the real
  **cm sizes** so all walls stay coherent.
- Mounting centre-line ~**1.45–1.60 m**; key content in the **eye band** (centre
  ~1.40–1.65 m).
- Titular cap-height legibility ≈ **1 cm per 3 m** of reading distance (verify and
  apply per wall against its real reading distance). Generous body; high contrast;
  avoid text over noisy image areas.
- **Reading-distance policy (per room, so all walls stay coherent):** S1/S2 = 4 m,
  S3/S4 = 5 m, S5/S6/cóctel = 3 m (a compound sala takes the conservative max). A
  print may declare its own `props.readingDistanceM` (the typographic pieces do, and
  they match the policy); otherwise the room policy supplies it. The resulting cap
  floors are 1.3 cm (4 m), 1.7 cm (5 m), 1.0 cm (3 m). Audited + documented by
  `legibility.ts` / `npm run legibility` (→ `out/legibility.md`).

## System architecture

- **Wall registry (single source of truth).** Extend
  `src/print/space/event-layout.json` walls with stable fields `{ invId 1..21,
  sala, tema, rol, research, estado: ok|prop|pend }`, read by `eventLayout.ts`.
  `invId N` maps to code `wall-(N-1)` (a *derived* id, so retiring a wall leaves a
  gap — e.g. `wall-16` for #17 — and never shifts the others). **Drift reconciled**:
  the two S3 transversal divisorias (12, 16) are centred 4 m walls, 2 m tall,
  splitting the nave into its three cameras; the confesionario (ex-#17) is a curated
  booth on divisoria 1's reverse, not a separate wall. The brief omits walls **3, 5,
  14, 15** — pieces proposed so no wall is blank.
- **Two production tracks.**
  - **Code track** — data/number pieces are **code-rendered** React/SVG print
    pages from a **versioned, sourced data file**. A text-to-image model must
    never render axes or figures (it hallucinates them).
  - **Image track** — `image-gen` is used **only where imagery genuinely earns
    it** (combustion texture, Naranja Mecánica light-box, real-world photo refs,
    salones, mood/identity). Extend `generate.py` for **gpt-image-1 img2img/edit**
    and add **tiling** (no single 28 m image; produce panels and compose).
  - **Hybrid** — code data layer over an AI atmospheric background (e.g. the hero).
- **3D application.** Each piece is a **print page** (raster pages load PNG via
  `staticFile`; data-viz pages render in code) mounted via the existing live-DOM
  path (drei `<Html occlude="blending">`, 1 unit = 1 m). **Done:** placement
  persistence (localStorage auto-save + JSON export/import) and **per-wall
  height** — each wall element may carry an optional `alturaM` (metres); the scene
  renders every wall at its own height and falls back to **2.5 m**, warning (once)
  for any wall still without a measured height. The "Altura por defecto" slider
  tunes only that fallback; measured walls ignore it. A backlit **light-box**
  material (`src/print/space/lightbox.ts`) is also done: a placement carries an
  optional `mount: 'vinyl' | 'lightbox'` + a brightness dial (0…2); a light-box
  renders an emissive backing, a warm additive spill-halo onto the wall, and a
  brightened DOM face (the "Apple-storefront" glow, e.g. id 4, S3 INVESTMENT
  image), toggled per-piece in the editor HUD. **Add:** **double-sided** support
  (ids 2, 12).
- **Export.** Reuse the print generator: `doc.json` (real mm size, low DPI for big
  walls, CMYK / CoatedFOGRA39) → `scripts/export-print.mjs` → CMYK PDF/X, tiled
  where needed.

## Wall frames — every face is a print (the blank base layer)

The venue is **not** an abstract list of pieces: it is **papered with blank frames**,
one per wall face, *before* any art exists. A **frame ("marco") is a print** — when
Pablo says "el marco N" he means designing on that print itself, never a physical
picture-frame element. There are **a lot of them**, and the set is **derived from the
committed geometry, never hand-baked**, so it tracks the real space:

- **Both faces of every registered wall** are framed independently (each face looks
  onto a different room and carries different art).
- A long face is **not one frame** — it is **cut into separately-printable panels**
  wherever (1) a perpendicular wall's end touches it (*abutment* — e.g. wall 18 splits
  wall 9's east face into `9-E-1` / `9-E-2`) or (2) the two free-standing showroom
  divisorias (12, 16) **project** onto the nave side walls (2, 11), splitting each into
  the three cámaras **IMAGE · TEXT+CODE · INVERSIÓN**.

**Each frame is associated with its numeric print** = the host wall's inventory id
(`invId`). The frame id is `{invId}-{face}-{panel|cámara}` — face `N`/`S` for horizontal
walls, `E`/`W` for vertical — e.g. `2-W-1`, `9-E-2`, `11-W-INVERSIÓN`. It materialises as
a real print document at `public/prints/marco-{slug}/doc.json` (`pageComponentId:
"blank"`, the wall's true mm size, CMYK). The wall link is carried as
**`props.frameWallInvId`** — *deliberately not* `props.invId`, which is the
**authored-content** print↔wall join (one finished piece per wall) used by the
control-table / legibility / coverage deliverables; the blank frames stay out of that
1-print-per-wall join.

**Computed, not authored.** `src/print/space/wallFrames.ts` (`computeWallFrames`) is pure
+ unit-tested; `npm run frames` (`scripts/generate-frames.mjs`) materialises one `marco-*`
doc per frame — re-runnable + deterministic (drops stale frames, adds new ones), so a
geometry change reflows the whole base layer with no manual cleanup. The `blank.tsx` page
renders the empty white panel, and the 3D maquette papers every wall face with its frames
so the operator sees the whole space before any art exists.

### Working model — design *on the print*, for the wall, as an exhibition

When we work a piece we work **on the print (the frame) itself**, not on an abstract
canvas. Two non-negotiables follow:

- **Design for the wall** — at its **true size**, in its real proportion and panels;
  the frame already carries the wall's mm dimensions, so the layout is anchored to the
  physical surface from the first move.
- **Design as exhibition / museography** — distance-anchored type
  ([Print Type & Style System](./print-typography.md)), key content in the eye band,
  the room's emotional objective and walk order, message-first curation, no blank walls,
  no spoilers. The frame is *where* the design happens; **the wall and the room are the
  brief.**

## Methodology (per piece)

1. **Understand the message** (message-first).
2. **Research** if it carries data/facts — WebSearch for **current** figures with
   **date + URL** (never training-only). Mandatory for every `research:true` wall.
3. **Produce** — code-render data-viz, **or** image-gen at print resolution
   (~150 dpi at real size; tile big walls by panels).
4. **Dimension** to the real wall — `largo_m` = canvas width; height from the 3D
   model (assume **2.5 m** and warn if absent); respect proportion, add bleed, key
   content in the eye band. **Perimeter walls (2, 4, 9, 11) are zoned canvases** —
   divide into thematic segments per room/camera, never one stretched poster.
5. **Apply** to the matching wall in 3D — verify orientation/face on double-sided
   (2, 12); model the backlight for light-box pieces (4, S3 image).
6. **Deliver** per the naming convention.

## Deliverables & naming

- Per wall: print-resolution image(s) **+ the wall already textured in 3D**.
- Naming: `pared-{id}_{sala}_{slug}.png` (+ `_tileN` for panels), e.g.
  `pared-04_S5_naranja-mecanica_tile1.png`.
- Per data piece: a **sources note** (figure, value, date, URL) beside the file —
  recorded in `wall-data.ts` per piece and consolidated by `sources.ts` /
  `npm run sources` (→ `out/sources.{md,csv}`); `assertSourcesNotes()` confirms every
  piece carries one.
- A **control table**: wall id, sala, estado, dpi, dimensions (m), research y/n.

## Per-wall inventory

`largo_m` = canvas width (wall's long footprint). `track`: C=code, I=image, H=hybrid.

| inv | code | sala | largo_m | orient | estado | track | research | message / role |
|----:|------|------|--------:|--------|--------|:-----:|:--------:|----------------|
| 1  | wall-0  | S1 Bici | 7.0 | horiz | ok | I | n | Combustion crosshatch → chaos, warm. **No text.** |
| 18 | wall-17 | S1 Bici | 5.0 | horiz | ok | I | n | Continues #1, "heating up". **No text.** |
| 9  | wall-8  | S1 perimeter W | 19.0 | vert | pend | I | n | Combustion intensifies along the run. Only S1 text = expo title at entrance. |
| 2  | wall-1  | S1 / S3 nave W | 22.5 | vert | prop | H | y | **Double-sided.** S1 face = combustion. S3 face = zoned light-box per nave camera; **hosts the HERO** at INVESTMENT. |
| 10 | wall-9  | S1→S2 | 6.0 | horiz | prop | C | n | Wayfinding: name + arrow to next zone. |
| 8  | wall-7  | S2 Intro IA | 8.5 | horiz | prop | C | y | **Model size to scale** (Perceptron→…→2025-26). "Not magic, it's matrix multiplication." **Data sourced** in `wall-data.ts` (`tamano-de-modelos`): parameter counts Perceptrón 512 → AlexNet 60 M → GPT-2 1.5 bn → GPT-3 175 bn → GPT-4 ≈1.8 T (est.) → Kimi K2 1 T (2025); log scale, ~10 orders. |
| 3  | wall-2  | S2/S3 | 8.5 | horiz | prop | C | n | **Proposed** (was unannotated): *Umbral S2→S3* — typographic title-band that orients & sequences the three nave cameras (IMAGE · TEXT+CODE · INVERSIÓN) with the S3 thesis "es inevitable"; demystify→velocity bridge. |
| 19 | wall-18 | S2/S6/cocktail | 7.0 | horiz | prop | H | n | (1) "You are a neuron" grouping; (2) cocktail/exit classy warm register. Only **1 of ~4** walls there is real. |
| 11 | wall-10 | S3 nave E | 23.0 | vert | prop | C | y | **Light-box.** Zoned acceleration charts per camera. **Data sourced** in `wall-data.ts` as a two-chart family on `invId 11` (`piecesByInvId(11)`): (A) `horizonte-de-tareas` — METR 50 % time horizon in seconds, GPT-2 2 s → GPT-4 4 min → o1 38 min → Claude 3.7 Sonnet 1 h → o3 2 h 1 min (doubling ≈7 mo; METR Time Horizon 1.1); (B) `ventana-de-contexto` — launch context window in tokens, GPT-3 2.048 → GPT-4 8.192 → Claude 2.1 200K → Gemini 1.5 Pro 1M (10M en investigación). Message-first: stock exponentials cut (hero's domain), US-vs-EU + #labs deferred. Log scales. |
| 12 | wall-11 | S3 divisoria 1 (IMAGE) | 4.0 | horiz | prop | H | n | **Double-sided, centred transversal (2 m tall).** Splits IMAGE↔TEXT+CODE. Entry = frame/identity for IMAGE screens; back = confesionario / Turing test. |
| 16 | wall-15 | S3 divisoria 2 (TEXT+CODE) | 4.0 | horiz | prop | C | y | **Centred transversal (2 m tall).** Splits TEXT+CODE↔INVERSIÓN. Code-gen value: "3 lines → 37-file app" vs a real team. **Data sourced** in `wall-data.ts` as a two-chart family on `invId 16` (`piecesByInvId(16)`): (A) `tiempo-de-desarrollo` — GitHub's controlled study (write a JS HTTP server), **161 min sin IA → 71 min con Copilot** (−55 %, IC 95 % 21–89 %; minutes, github.blog 2022); (B) `codigo-escrito-por-ia` — share of code already written by AI, **GitHub Copilot 46 %** (archivos con Copilot activo, 2023), **Microsoft ≤30 %** (Nadella, abr 2025), **Google >25 % del código nuevo** (Pichai, Q3 2024). Honest proxy (no invented "37-file = N engineers × €X" quote); per-bar scope noted. |
| 6  | wall-5  | S4 Cinema | 3.5 | vert | pend | I | n | **Propose.** Matte black, possible "sala" marquee. Keep very dark. |
| 7  | wall-6  | S4 Cinema | 9.0 | horiz | pend | I | n | **Propose.** Matte black / cinema texture; minimal elegant title if any. |
| 21 | wall-20 | S4 / S5 | 6.5 | horiz | pend | I | n | **Propose.** Transition cinema-black → warm juice branding. |
| 13 | wall-12 | S5 / S6 (reality) | 6.5 | horiz | prop | I | y | Game upgrades that **already exist**: autonomous trucks, dark factories. "This is not utopia, it is happening." **Refs sourced** in `wall-data.ts` (image-track reference schema `WALL_REFS`, `refsByInvId(13)` → `realidad-ya-existe`): Aurora — first commercial driverless heavy-duty trucking on US public roads (Dallas–Houston, may 2025; >100K driverless miles, zero incidents, Nov 2025); Xiaomi — Changping "dark factory" (10 M phones/yr, 81 % automation, Jul 2024; the "1 phone/sec" marketing is ~1 per 3.15 s real); WEF Global Lighthouse Network — 201 AI/4IR factories (Sep 2025); Waymo — 450K+ paid robotaxi rides/week (Dec 2025). Grounds the image so it depicts real deployments, not an AI-imagined future. |
| 4  | wall-3  | S5 Cuellos | 28.5 | vert | ok | I | n | **Light-box.** "NARANJA MECÁNICA" juice branding (approved); storefront-fridge glow. **Zoned/repeated**, not one stretched poster. Tagline TBD (3 candidates). |
| 20 | wall-19 | S6 Pobreza | 4.0 | horiz | prop | H | y | Salones by century → "¿cómo será el salón en 3-4 años?"; optional "Velázquez = X menús" (validate). **Refs sourced** in `wall-data.ts` (image-track schema `WALL_REFS`, `refsByInvId(20)` → `salones-por-siglos`): Velázquez (s. XVII) — top court-painter salary ≈ **48.300 €/año** (192 ducados / 72.000 mrs, gold equivalence, Archivo General de Simancas vía El Debate, nov 2025); running water in **<1/3** of Spanish dwellings in 1950 (IECA atlas); **TVE 1956** debut with ~600 sets (El Español); 2024 connected home **96,8 %** broadband / 99,5 % mobile (INE TIC 2024). **"Velázquez = X menús" validated → flagged fragile:** ≈ ~3.400 menús/año (÷14,20 €, Hostelería de España 2024), but it does **not land** — 48.300 €/año reads as middle-class today, not poverty, and 400-year purchasing-power conversions are unreliable; recommend reframe/cut, the message rides the salón, not the salary. |
| 5  | wall-4  | S5/S6 | 9.5 | horiz | prop | H | n | **Proposed** (was unannotated): *Puente S5→S6* — transition from the juice game (human marginal cost → 0) to the historical thesis "ya pasó antes"; warm→historical register, no data dump. |
| 14 | wall-13 | S5/S6 | 1.5 | horiz | prop | C | n | **Proposed** (was unannotated, tiny): *Micro-acento* — typographic accent / wayfinding, one strong phrase; no data at this size. |
| 15 | wall-14 | S5/S6 | 2.5 | vert | prop | I | n | **Proposed** (was unannotated, small): *Acento vertical* — warm identity/texture panel coherent with Naranja Mecánica and the S6 bridge; no data. |

> **Geometry reconciliation (committed = source of truth).** The 20 `wall`
> rectangles in `event-layout.json` map cleanly `invId N ↔ wall-(N-1)` — a *derived*
> id, so retiring the confesionario (#17) leaves a gap at `wall-16` without shifting
> any other wall. The registry fields `{ invId, sala, tema, rol, track, research,
> estado }` are carried per wall and read by `eventLayout.ts` (`findWallByInvId`,
> `findWallsBySala`). The two S3 divisorias now match the brief — inv 12 & inv 16 =
> **4.0 m**, centred in the nave and **2 m tall** (`alturaM`), splitting it into the
> three cameras; the confesionario booth (ex-inv 17) is curated on divisoria 1's
> reverse, not a separate wall. The four previously-unannotated walls **3, 5, 14, 15**
> carry decided pieces (`estado: prop`, no `track: C/I` left): 3 = *Umbral S2→S3* (C),
> 5 = *Puente S5→S6* (H), 14 = *Micro-acento* (C), 15 = *Acento vertical* (I) — all
> non-data (`research: n`), each coherent with its zone.

## Hero piece — "Sistema solar de la inversión"

S3 INVESTMENT camera (canvas on wall **2** face S3; context on **11**). Goal: a
director-level guest feels *"how can AI, as a market, be bigger than **this**?"* —
their sense of normality is betraying them. **Code-rendered** (circle **area** =
money) over an optional AI cosmic background — **never let AI invent the figures.**

- Each ball's **volume/area = money** (market cap / valuation). Giant balls
  (~3–4 m visual) = AI giants (OpenAI, Anthropic, Google/Alphabet, Nvidia,
  Microsoft…). **Marbles** = shock comparison references. Centre is **not** a sun:
  "it's AI." Final menacing read: *"this is AI."*
- Optional over-time: rings **2024 (grain of rice) → 2026 (huge)**; green = grows,
  red = falls; fading companies orbit in red.
- **Mandatory research — verify every figure with source + date.** Starting points
  to *check*, never use unverified: AI-giant valuations (public = market cap,
  private = last round); Spanish shock refs (Inditex, Iberdrola, Santander, BBVA,
  Telefónica, Repsol; **total IBEX 35**; **Spain GDP**); "huge in the imagination
  but small" markets (world coffee market ~$49 bn — verify & fix the definition).
  Hook lines ("[lab] > Telefónica+Repsol", "one AI co > the IBEX 35", "AI market >
  Spain GDP") **only if the numbers hold.**
- Render to data scale; if something tiny is enlarged to be seen, annotate
  ("ampliado, no a escala"); cite sources discreetly.

## Open / to confirm (non-blocking)

- **S3 nave entry direction** and which face of each divisoria (12, 16) faces each
  camera. Hypothesis: IMAGE → TEXT+CODE → INVESTMENT; confesionario booth on the
  reverse of divisoria 1 (#12).
- **Naranja Mecánica tagline** (wall 4): "Exprimido sin manos" / "Zumo de coste
  marginal cero" / "Recién hecho por una máquina" — mock all three until chosen.
- **S4 cinema (6, 7) and divisoria 21** are `pend` — propose coherent
  cinema-black / transition pieces, marked as proposals.
- **"Velázquez = X menús"** — ~~validate that it lands (Pablo himself doubts it)~~ **Validated → does not land cleanly.** The king's painter's top salary ≈ 48.300 €/año (gold equivalence, Archivo General de Simancas) ≈ ~3.400 menús del día (÷14,20 €, 2024). But 48.300 €/año reads as a middle-class salary today, not «pobreza», so the menús line undercuts the message; and 400-year purchasing-power conversions (oro / salario / cesta) diverge wildly. Recommendation: reframe or cut the "= X menús"; the salones-por-siglos imagery carries the message, not the salary. Recorded (with the verdict) in `wall-data.ts` `salones-por-siglos`.
- **Space production may have changed** — reconcile the inventory against committed
  geometry; iterate freely (redo a weak piece, add pieces the flow needs).

## Related specs

- [Print Generator](./print-generator.md) — `doc.json` model, CMYK PDF/X export, the 3D event-space preview that mounts prints on walls.
- [Generated Assets (image-gen)](./generated-assets.md) — fal.ai image generation, `public/<scene>/`, `staticFile` (extend for gpt-image-1 img2img + tiling).
- [Motion Language](./motion-language.md) — easing/beats if the hero gets an over-time animated version.

## Source

- [src/print/space/event-layout.json](../src/print/space/event-layout.json) — venue geometry + (to add) wall registry fields
- [src/print/space/eventLayout.ts](../src/print/space/eventLayout.ts) — wall model / parser
- [src/print/space/wallFrames.ts](../src/print/space/wallFrames.ts) — pure, unit-tested frame geometry: both faces of every wall, cut by abutment + nave-zone projection → the `{invId}-{face}-{panel|cámara}` blank `WallFrame[]` (the base layer; numeric-print association via the host wall's `invId`)
- [scripts/generate-frames.mjs](../scripts/generate-frames.mjs) — `npm run frames`: materialises one `public/prints/marco-*/doc.json` per frame (`pageComponentId: blank`, real mm size, `props.frameWallInvId`); re-runnable + deterministic
- [src/print/pages/blank.tsx](../src/print/pages/blank.tsx) — the empty white frame page
- [src/print/ui/EventSpaceScene.tsx](../src/print/ui/EventSpaceScene.tsx) — 3D scene, mount/placement (done: persistence, per-wall height, light-box; to add: double-sided); papers every wall face with its blank frames (`<WallFrames>`)
- [src/print/pages/](../src/print/pages/) — wall print pages (code-track data-viz + raster wall pages)
- [src/print/space/wall-data.ts](../src/print/space/wall-data.ts) — the versioned, **sourced** data file (Phase 3): every datum `{figure,value,date,sourceURL}` (+ `id/label/group/unit/note`), validated by `assertSourced` so nothing unverified ships; carries the researched **hero** figures (AI giants, Spanish refs, IBEX 35, Spain GDP, coffee market) and `heroHooks()` (claims validated against the numbers). Also hosts a parallel, equally-sourced **reference schema** for the image/hybrid track (`RefItem`/`RefPiece`, registry `WALL_REFS`, `assertRefsSourced`) — dated + sourced real-world references that ground the imagery of the image/hybrid walls (#13 "ya está ocurriendo" autonomous trucks / dark factories: Aurora, Xiaomi, WEF Lighthouse network, Waymo; #20 "salones por siglos": Velázquez's salary, running water in 1950, TVE 1956, the 2024 connected home — with the "Velázquez = X menús" hook validated and flagged fragile), kept separate from the chart data so it never relaxes the single-unit invariant; pure + unit-tested
- [src/print/pages/dataviz-scales.ts](../src/print/pages/dataviz-scales.ts) — honest data-viz maths (area∝value, lin/log axes, compact money, sources caption); pure + unit-tested
- [src/print/pages/dataviz-kit.tsx](../src/print/pages/dataviz-kit.tsx) — code-track "data on dark" rendering kit (value circles, axes, scale note, source caption)
- [src/print/pages/hero-solar.ts](../src/print/pages/hero-solar.ts) — pure hero geometry (giant/marble classification, `fitHeroMaxRadius`, deterministic rosette `layoutHeroSolar` — area∝money, no overlap, clear of the central "es IA" hole, enlarged-marble flagging); unit-tested
- [src/print/pages/hero-solar.tsx](../src/print/pages/hero-solar.tsx) — the hero print page "Sistema solar de la inversión" (renders `dataForWall(2)` as the rosette + centre "esto es IA" + scale/enlarged notes + source caption + verified hook lines)
- [src/print/space/heroPlacement.ts](../src/print/space/heroPlacement.ts) — pure mount of the hero on wall 2's S3 face (eye-band `eyeBandCenterY`, computed S3 `faceToward`, light-box, true scale); unit-tested
- [src/print/space/heroNave.ts](../src/print/space/heroNave.ts) — wall 2's S3 face as a **zoned light-box per nave camera** (`NAVE_CAMERA_ORDER` IMAGE·TEXT+CODE·INVERSIÓN, `naveS3ZonedPlacements` → one light-box `Placement` per camera bay, hero in the INVERSIÓN bay; composes `planZones` + the hero eye-band/S3-face logic); pure + unit-tested
- [scripts/export-print.mjs](../scripts/export-print.mjs) — CMYK PDF/X export pipeline
- [src/print/tiling.ts](../src/print/tiling.ts) — pure panel-split geometry (equal-width overlapping panels, lossless px crop grid, `_tileN` naming); unit-tested
- [scripts/tile-print.mjs](../scripts/tile-print.mjs) — `npm run tile` — slices a wall-sized render into printable panels (ImageMagick `-crop`) and recomposes them for a lossless preview; writes a `manifest.json`
- [src/print/space/controlTable.ts](../src/print/space/controlTable.ts) + [scripts/control-table.mjs](../scripts/control-table.mjs) — Phase-6 **control table** deliverable (`npm run control-table` → `out/control-table.{md,csv}`): joins registry/geometry ↔ authored prints → id, sala, estado, dpi, dims (m), research y/n; pure + unit-tested
- [src/print/space/legibility.ts](../src/print/space/legibility.ts) + [scripts/legibility.mjs](../scripts/legibility.mjs) — Phase-6 **museographic legibility pass** deliverable (`npm run legibility` → `out/legibility.{md,csv}`): per-wall eye-band fit (centre 1.45–1.60 m, `clampedByHeight` flag) + documented cap-height floor (1 cm/3 m via the per-room reading-distance policy `ROOM_READING_DISTANCE_M`) + per-room coherence; pure + unit-tested
- [src/print/space/sources.ts](../src/print/space/sources.ts) + [scripts/sources.mjs](../scripts/sources.mjs) — Phase-3/6 **sources note** deliverable (`npm run sources` → `out/sources.{md,csv}`): joins the code-track `WALL_DATA` + image-track `WALL_REFS` into one list of sourced pieces (per-piece note + `{figure,value,date,sourceURL}` rows + deduped hosts), with `assertSourcesNotes()` confirming every piece carries a note; pure + unit-tested
- [src/print/space/coverage.ts](../src/print/space/coverage.ts) + [scripts/coverage.mjs](../scripts/coverage.mjs) — Phase-6 **coverage & spoiler lint** deliverable (`npm run coverage` → `out/coverage.{md,csv}`): encodes the two non-negotiable principles — **no blank walls** (`assertNoBlankWalls` hard guard; blank = empty tema/rol, undecided `C/I` track, or a `(sin anotar)` placeholder — an open sub-decision like a "tagline TBD" is not blank) + **no spoilers** (S1 sensory rooms textless = no code typographic page; no non-adjacent funnel jump against `FUNNEL_ORDER`, exempting documented double-sided `[2,12]` and junction `[19]` walls). Reports the funnel walk (every room covered) + per-wall verdict; current: 21/21 cubiertos · 0 en blanco · 0 avisos · funnel completo; pure + unit-tested
- [~/.claude/skills/image-gen/generate.py](file:///Users/pabloperalta/.claude/skills/image-gen/generate.py) — image generation (extend for gpt-image-1 img2img + tiling)
