# Feature Research — v2.13 Style-from-Reference Generation

**Domain:** Reference-driven generation for TikTok / Instagram carousel image creation
**Researched:** 2026-05-10
**Confidence:** HIGH (prior art is well-documented across Midjourney, Adobe Firefly, Canva, Figma + a direct competitor "Swipe Carousel" doing the exact thing)

---

## 0. Prior Art Survey (the table the rest of this file is built on)

This is the load-bearing reference. Every "table-stakes / differentiator / anti-feature" call below cites at least one of these.

| Tool | Input shape | What it extracts | Strength control | "What was extracted" preview | Two-content-path split | Source |
|---|---|---|---|---|---|---|
| **Midjourney `--sref`** (web) | Drag-drop 1–N images into the *paintbrush* slot in the prompt bar; OR `--sref <URL>`; OR `--sref <code>`; OR `--sref random` | "Visual elements of the original image, such as colors, composition, texture, background, and overall atmosphere" — explicitly **NOT** subject/character/content. Costumes/outfits/props "often merge in" anyway. | Numeric `--sw 0..1000`, default `100` (web has a slider). Separate slider for **Visual Intensity** vs **Style Strength**. | NO style-spec preview — only the reference-image thumbnails are shown. The "extracted" style is opaque (an embedding). User can't see "what colors / what fonts." | NO — Midjourney always generates content; user can't supply content separate from prompt | [Midjourney Style Reference docs](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference); [Style Creator](https://docs.midjourney.com/hc/en-us/articles/41308374558221-Style-Creator); [Andrei Kovalev guide](https://midlibrary.io/midguide/midjourney-style-reference-sref-for-photographers); [Weird Wonderful AI Art guide](https://weirdwonderfulai.art/resources/a-guide-to-sref-style-reference-in-midjourney/) |
| **Adobe Firefly Style Reference** (web) | Drag-drop OR "Upload Your Own Image" OR pick from curated *Reference gallery* (3D / Landscapes / Lighting / Texture). | Look-and-feel: "watercolor / pencil sketch / textured landscape / AI-generated art." Per Photoshop Essentials, also a separate **Structure Reference** for layout/composition. | Two sliders: **Visual Intensity** (subtle ↔ intense) and **Strength** (ignore reference ↔ match closely). Structure Reference uses Low/Medium/High. | NO structured spec preview — but hovering the reference tag shows the source image. | NO — Firefly is text-to-image only; there's no separate "I'll provide the words" path. | [Firefly Style Reference help](https://helpx.adobe.com/firefly/web/generate-images-with-text-to-image/customize-generated-images/reference-images-for-styling.html); [Generative Match feature page](https://www.adobe.com/products/firefly/features/generative-match.html); [Adobe community thread on the two sliders](https://community.adobe.com/t5/adobe-firefly-discussions/style-reference-sliders-visual-intensity-vs-strength/td-p/14608574) |
| **Adobe Firefly rights confirmation** | Modal pops on first upload | n/a | n/a | n/a | n/a | "Firefly will ask you to confirm that you have the rights to use the image." ([helpx.adobe.com](https://helpx.adobe.com/firefly/web/generate-images-with-text-to-image/customize-generated-images/reference-images-for-styling.html)) |
| **Canva Magic Design** | Prompt + optional logo/image/media upload; brand-kit autopopulates colors/fonts | "Custom templates to match." Brand kit applies palette + fonts. Magic Design returns a **gallery of template variations** the user picks from. | NO numeric slider — it's a pick-the-result UX, not a tune-the-input UX. | YES (sort of) — the user is shown 5–10 generated template options and chooses one; that **acts as** a preview of "extracted style." | NO explicit split — but you can edit the result freely once chosen. | [Canva Magic Design](https://www.canva.com/magic-design/); [Magic Design help](https://www.canva.com/help/use-magic-design/); [Brand Kit help](https://www.canva.com/help/brand-kit/) |
| **Canva Dream Lab (style transfer)** | Click `+` icon in description box → upload reference image → write prompt | Aesthetics, objects, textures from the reference (Leonardo.ai-powered). | Image-by-image generation; weight is implicit (no exposed slider in current help docs) | NO style-spec preview; user judges output, regenerates. | Implicit — text prompt is required; it's not "style only, no copy." | [Canva Dream Lab help](https://www.canva.com/help/generate-with-dreamlab/); [Create on-brand images with AI](https://www.canva.com/help/create-onbrand-images-with-ai/) |
| **Figma First Draft / Figma Make** | Text prompt + attached images (as **reference**) + attached PDFs (as brand guidelines / PRDs) | "Reads the image and uses it to guide the layout, colors, and positioning of the generated output." Limitation called out: cannot use your own design system. | Implicit — model picks. | NO spec preview — user sees generated wireframe and iterates. | Yes, kind of — attaching a PDF brand guideline is the "I supply the structure, AI applies it" pattern. | [First Draft with Figma AI](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI); [Attach files to a prompt](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-designs-and-images-to-a-prompt) |
| **Figma plugins: image.to.design / Codia / Refore / Banani** | Drop screenshot / image → "Editable Layers" button → AI rebuilds as Figma layers | **Visual hierarchy, UI components, text, auto-layout groups, meaningful layer names.** This is closer to "clone the template" than "vibe transfer." | NO strength control — it's a 1:1 reconstruction. | Implicit preview — output IS the spec. User sees layers/colors/fonts named in the layers panel. | n/a (one-shot reconstruction, not generation) | [image.to.design](https://divriots.com/blog/image-to-design-now-converts-screenshots/); [Codia AI Design](https://www.figma.com/community/plugin/1329812760871373657/codia-ai-design-screenshot-to-editable-figma-design); [Banani screenshot-to-UI](https://www.banani.co/product/screenshot-to-ui-design) |
| **Swipe Carousel** ⭐ direct competitor | "Upload competitor slides" / "Paste any Instagram post URL and we extract all carousel slides automatically" / "From YouTube" URL | Per their landing page: **"Your palette, backgrounds and accents… Keep hierarchy and spacing… Same layout, same flow—transformed to your brand style."** AI "learns your colors, fonts, and style from examples." | Not exposed numerically; the user sees competitor-vs-yours side-by-side preview | YES — explicit "Competitor" vs "Your Brand" side-by-side comparison view | YES — explicitly: **"Keep exact text or let AI make it more engaging, professional, or casual"** + "Generate alternative headlines and hooks in seconds." Both paths shipped. | [swipecarousel.com](https://www.swipecarousel.com/) (verified directly via WebFetch 2026-05-10) |
| **dembrandt / designlang / extract-design-system** (CLI / MCP, not direct competitors but pattern reference) | URL or screenshot | Color palette (oklch), typographic scale, spacing system, border radii, shadows — all as **DTCG design tokens** | n/a (extraction only, no generation) | YES — the output IS a structured token JSON, fully visible/editable | n/a | [dembrandt](https://github.com/dembrandt/dembrandt); [designlang](https://www.designlang.app/vs/design-extractor); [extract-design-system](https://github.com/arvindrk/extract-design-system) |
| **PostNitro / aiCarousels / WaveGen / Insta Posts** (incumbents) | Topic / URL / blog text → AI → carousel. Brand kit (colors, fonts, logo) applied. | Brand assets only — none of these support "upload an example carousel and clone its design." | n/a | n/a | n/a (text-input only) | [PostNitro](https://postnitro.ai/); [aiCarousels import doc](https://www.aicarousels.com/blog/ai-import-carousel); [WaveGen](https://wavegen.ai/carousel-maker); [Insta Posts](https://instaposts.ai/ai-carousel-generator) |

**Headline takeaways from prior art:**

1. **Swipe Carousel is the only direct competitor doing exactly v2.13's wedge**, and they explicitly ship BOTH content paths. We are not pioneering this UX — we are catching up. (Confidence: HIGH — confirmed via WebFetch on 2026-05-10.)
2. **Every general-purpose tool (Midjourney, Firefly, Canva Dream Lab) hides "what was extracted" behind an opaque embedding.** Users tune via slider, judge by output, regenerate. None show a structured "here's the palette + fonts + layout we pulled out."
3. **Every design-system tool (image.to.design, Codia, dembrandt) shows the spec as the output** — palette swatches, named font, layer tree. This is the *opposite* posture and it works because the user is a designer.
4. **Strength sliders are universal** in the embedding-style tools (Midjourney `--sw`, Firefly Visual Intensity + Strength). They are absent in the "pick from N variations" tools (Canva Magic Design).
5. **Multi-image upload is normal.** Midjourney accepts N reference URLs separated by spaces. Firefly accepts one at a time but supports adding multiple. Swipe Carousel takes "competitor slides" plural.
6. **Rights confirmation is a one-time modal** in Firefly. Nothing else surfaces it. (We should mirror Firefly given Reface/Kyland Young precedent already in our v2.9 deferred list.)

---

## 1. Feature Landscape

### Table Stakes (Users Expect These — Must Ship in v2.13)

Features users will assume exist. Missing these = product feels broken or worse than free competitors.

| Feature | Why Expected | Complexity | Notes / Depends On |
|---------|--------------|------------|--------------------|
| **Multi-image upload (1–N)** | Midjourney, Swipe Carousel, Firefly all support N references. A single image won't capture slide-to-slide structure (hook vs body vs close). | M | UX: drag-drop zone with thumbnails. Cap at 8 (Pexels match-photo limit precedent in v2.9 + carousel sweet-spot 8–10 slides). Existing infra: Supabase Storage bucket pattern (`slide-backgrounds-treated` v2.9). |
| **Visible "what we extracted" preview before generate** | Designer-tool norm (image.to.design, Codia, dembrandt). Users won't trust an opaque vision-LLM call without seeing the receipts. The few-shot tools that hide this (Midjourney) get away with it because output is fast and cheap to retry; ours is one-shot 5+ slide generation. | M | Show: palette swatches (3–5), font pairing (heading + body name), one-line "vibe" label ("editorial / brutalist / notes-app"), per-slide layout sketch. Re-uses the v2.9 `derived_palette` rendering pattern. |
| **Edit the extracted spec before generate** | Once we show it, users will want to override — "this isn't quite my brand pink." Canva-tier tools always let users pick a color. | M | Color swatch click-to-replace, font dropdown swap (use existing 4-font catalog). Generate button gated on spec-confirmation. No need for full spec-JSON editor in v2.13. |
| **Two clearly labeled content paths: AI-writes-copy vs I-supply-copy** | Swipe Carousel ships both: *"Generate alternative headlines and hooks in seconds"* AND *"Keep exact text or let AI make it more engaging."* Single biggest UX choice in this milestone. | M | See section 5 — prefer ONE flow with a toggle, NOT separate entry points. |
| **Drop result into existing editor for refinement** | Existing app behavior; users will assume parity with the v1.0 Gemini emit flow. | S | Already wired — Gemini → editor handoff is the v1.0 baseline. New emit path just needs to populate `text_boxes[]` + `decorations[]` + `style_overrides`. |
| **Rights confirmation on first upload** | Firefly is the canonical pattern: *"Firefly will ask you to confirm that you have the rights to use the image."* Reface / Kyland Young 9th Cir. precedent already in our v2.9 Key Decisions table. Cheap insurance. | S | One-time per-account modal. Persist `accepted_reference_rights_at` on profile. Localstorage fallback for anon flow if we have one. |
| **Visible cost** ("this generation will use 1 credit") | Existing app pattern — every Imagen / Gemini call shows credit deduction. Users will assume parity. | S | Reuse v2.2 credit ledger + v2.6 `gemini_vision_match` charge-then-refund-on-failure pattern from `match-photos-to-slides.ts`. |
| **Result is editable, not flattened** | Without this, we ship Canva-Magic-Design (pick-from-gallery) UX instead of our editor-first UX. The editor is our existing differentiator (v2.11+v2.12). Flattened = strategy collision. | S | Output schema is the existing `Slide` shape including `decorations[]` (v2.12) — no schema lift needed. |
| **Drag-drop AND click-to-add upload** | Midjourney + Firefly + Swipe Carousel + Canva all support both. Not having drag-drop on a 2026-shipped tool feels archaic. | S | Reuse the v1.0 user-image-upload component if it exists. |
| **Reference thumbnails stay visible during edit + generate** | All prior art keeps the sources visible (Midjourney shows them in the prompt bar; Firefly hovers them in a tag; Swipe shows them in the side-by-side). Users get anxious if their inputs disappear. | S | Sticky thumbnail strip above generate button. |

### Differentiators (Competitive Advantage — could split into v2.14 if scope explodes)

Features that set the product apart. Not assumed, but valued.

| Feature | Value Proposition | Complexity | Notes / Depends On |
|---------|-------------------|------------|--------------------|
| **"Remix this style with my Brand Kit" overlay** | Unique to us — no competitor has both a brand kit AND reference extraction. Lets users get the *layout* of the reference but force their *colors/fonts*. Solves the "I love this design but I have a brand book" problem. | M | Toggle: `[ ] Use my Brand Kit (overrides extracted palette + fonts)`. Depends on existing Brand Kit (v1.0). |
| **Per-slide style mapping** ("slide 1 = hook style, slide 2-N = body style, last = CTA") | Vision LLM can detect slide *role* per the v2.9 cover/reframe/support/pivot/close roles. Generic competitors apply one style to all slides. We can be smarter. | M | Vision LLM emits `inferred_slide_role` per reference image. Existing role enum from v2.9 Phase 58. |
| **Transparent style-spec JSON ("show me the extracted spec")** | Power users / devs / API consumers will want to inspect or version-control the spec. Nobody else exposes it (everyone hides behind embeddings). Aligns with our REST API + MCP positioning (v2.5/v2.6). | S | Collapsible JSON viewer. Style spec is already structured (we're emitting it from Gemini). Just don't hide it. |
| **"Try this style" gallery — preset spec library** | Like Firefly's curated *Reference gallery* (3D / Landscapes / Lighting / Texture). Lets users skip upload and pick a style we curated from the v2.9 templates (editorial-serif, notes-app-chic, brutalist-grid). | S | Reuses the v2.9 template registry. Maps each template → an exemplar style spec. |
| **Save extracted spec as a personal "Style"** | Like Midjourney's `--sref` codes — once you find a good one, you reuse it. Lets users build a personal library of brand styles. | M | New `user_styles` table; serialize the spec JSON. Fork RPC strip pattern from v2.4. Probably v2.14, not v2.13. |
| **"Generate variants" (3–5 spec variations to pick from)** | Canva Magic Design pattern — generate a small gallery, user picks. Hedges against vision-LLM being slightly off. | M | 3× the cost per generation; gate to 1× by default with "show variants" button. |
| **URL paste → screenshot → extract** | Swipe Carousel ships this: *"Paste any Instagram post URL and we extract all carousel slides automatically."* Big UX win — no need to download then re-upload. | L | Requires headless-browser screenshot service or Instagram graph API. Probably v2.14 — image upload is the v2.13 wedge. |
| **Clipboard paste (Cmd+V on a screenshot)** | Standard 2026 UX in design tools. Removes the "save → find file → upload" friction loop. | S | Browser `paste` event → File API. Modern browsers all support this. |

### Anti-Features (Looks Attractive, Should NOT Build)

Features that would seem good but create real problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **"Perfect 1:1 clone" framing** ("we'll exactly recreate this design") | Sounds magical. Users want it. | (a) Legal: explicit cloning of identifiable creators' work invites Reface / Kyland Young 9th Cir. precedent — already in our v2.9 Key Decisions. (b) Quality: vision LLM will fall short of pixel-perfect; framing as "clone" sets up failure mode. (c) Strategy: clone is a one-shot transaction; "inspired by" gives users agency to remix in our editor (which is our actual moat). | **Frame as "inspired by this style."** This is exactly the framing in our `.planning/PROJECT.md` v2.13 milestone description. Hold the line. |
| **Automatic copyright / "is this copyrighted?" detection** | "Stop users from uploading Apple's slides!" sounds responsible. | (a) False positives kill UX — every uploaded slide will probably trip some OCR'd brand name. (b) False negatives create false sense of safety. (c) Adobe doesn't even attempt this — they just put a one-line *"confirm you have the rights"* checkbox. (d) Massive scope creep (image hashing, brand database, ML classifier). | **Mirror Firefly's one-line rights confirmation.** Cheap, legally sufficient, no engineering. |
| **Style "blend" of N references with weighted slider per reference** | Midjourney supports per-image weight (`::w` syntax). Users will ask for it. | Vision-LLM-extracted style spec is structured (palette, fonts, layout enum). "Blend" of structured data is meaningless ("60% serif + 40% sans" isn't a font). The Midjourney pattern works because it's blending *embeddings*, not structured tokens. | **Single style spec extracted from N reference images** — vision LLM averages/picks dominant features. No per-image weighting UI. |
| **Real-time spec preview as user uploads each image** | "Show me the spec building up live" sounds slick. | Vision LLM call is 3–5 seconds and 1 credit. Doing it per-upload burns credits + creates jarring "spec keeps changing" UX before the user has even committed. | **Single "Extract style" button** the user clicks after uploading 1–N images. One vision call, one credit, one spec. |
| **Editing the extracted spec via a JSON textbox** | "Power users will want it." | (a) Conflicts with v2.11+v2.12 editor philosophy (visual editing). (b) JSON edit means we have to validate user-entered specs server-side, retry path, error UX. (c) Users who want JSON have the public REST API (v2.5). | **Visual spec editor** (color swatches, font dropdown). For JSON, point to the API. (Differentiator above: "show me the JSON" as a read-only viewer is fine; *editing* the JSON is the anti-feature.) |
| **Auto-detect TikTok-vs-Instagram-vs-LinkedIn from reference and force aspect ratio** | "We can guess from the dimensions!" | App is 9:16 only by spec. Adding aspect-ratio auto-detect requires multi-aspect renderer, opens 4:5 vs 1:1 vs 9:16 schema work that v2.9 deferred (only added safe-zone *overlay*, not multi-aspect output). | **Always emit 9:16.** If reference is 4:5 or 1:1, treat it as a style-only reference, not a layout-shape reference. |
| **"Detect AI-generated reference" (and reject)** | "Stop slop loops!" | Not technically reliable. Punishes legitimate users (many real designers use AI in their workflow). | **No detection.** Trust users; let our own AI-slop guardrails (v2.9 Imagen prompt addendum, hook variety) govern *output* quality. |
| **Style transfer onto user-uploaded photos (apply reference's photo treatment to the user's photos)** | Sounds powerful. | (a) Architecturally collides with v2.9 deterministic photo-treatment cache (`stylize-image.ts` deferred to v3.0+ for exactly this reason — see PROJECT.md Key Decisions). (b) Vercel timeout breach risk. (c) Right-of-publicity legal risk on faces. | **Extract palette + treatment preset (b/w / duotone / grain) from reference and apply via existing v2.9 treatment pipeline.** Don't try to actually "transfer" pixels — pick the closest preset. |
| **Replace existing topic-prompt flow with reference-only flow** | "Reference is better, kill the old flow." | (a) Pre-PMF — don't break what users already do. (b) Reference flow assumes user has *something to reference*, which not every user does. | **v2.13 ships reference flow as a NEW entry point alongside the existing topic-prompt flow.** Both available. |

---

## 2. Feature Dependencies

```
Multi-image upload (table stakes)
   └──requires──> Supabase Storage bucket (existing v2.9 infra — add `style-references/` prefix or new bucket)
   └──requires──> Rights-confirmation modal (table stakes)

Vision LLM style extraction
   └──requires──> Multi-image upload
   └──requires──> Gemini 2.5 Flash vision capability (existing — already used by `match-photos-to-slides.ts` v2.9 Phase 58)
   └──requires──> Credit ledger entry `gemini_style_extract` (mirror v2.6 `gemini_vision_match` pattern)

Visible "what we extracted" preview
   └──requires──> Vision LLM style extraction
   └──requires──> Style spec JSON schema (NEW — see ARCHITECTURE.md)
   └──requires──> Palette swatch + font preview component (NEW — small React component, reuses `react-colorful` v2.12 DEPS-04)

Edit extracted spec before generate
   └──requires──> Visible preview
   └──requires──> Existing font catalog (4 fonts shipped in v2.9 Phase 55 + Inter/Plus Jakarta Sans)

Two content paths (AI-writes vs user-supplies)
   └──requires──> Style spec confirmation step
   └──requires──> Existing Gemini emit pipeline (v1.0) for "AI writes copy" path
   └──requires──> NEW lightweight "style-only" emit path (skip copy generation, apply spec to user-supplied text)

Drop result into editor
   └──requires──> Existing editor handoff (v1.0 baseline — already wired)
   └──requires──> Output Slide schema includes decorations[] (v2.12 DECOR-01)

"Remix with my Brand Kit" overlay (differentiator)
   └──requires──> Existing Brand Kit (v1.0)
   └──requires──> Style spec confirmation step
   └──enhances──> Edit extracted spec (Brand Kit values pre-populate the spec edit fields)

Per-slide style mapping (differentiator)
   └──requires──> Vision LLM emits per-image inferred_slide_role
   └──enhances──> Existing v2.9 role enum (cover/reframe/support/pivot/close)

Transparent spec JSON viewer (differentiator)
   └──requires──> Visible preview
   └──conflicts──with──> JSON-editable spec (anti-feature) — keep this READ-ONLY only

URL paste → screenshot extract (differentiator, defer to v2.14)
   └──requires──> Headless screenshot service OR Instagram Graph API
   └──conflicts──with──> v2.13 ship-lean wedge — defer

Clipboard paste (differentiator, cheap)
   └──requires──> Multi-image upload
   └──can ship in v2.13 if upload component is touched anyway
```

### Dependency notes

- **Multi-image upload + rights confirmation must ship together.** Firefly's pattern: confirmation triggers on first upload, never again. Doing rights modal AFTER upload is too late.
- **Vision LLM extract → spec preview → edit spec → generate** is a 4-step linear flow. Don't try to parallelize the spec-preview with the generate step in v2.13 — users need the explicit confirmation step (it's the table-stakes feature that incumbents lack).
- **Two content paths converge after the spec-confirmation step.** Both call the same generate endpoint with a flag (`copy_source: 'ai' | 'user'`). See section 5.
- **The "Remix with Brand Kit" toggle is at the spec-confirmation step**, not at upload. Users need to see what the AI extracted *before* deciding to override it with their kit.
- **Per-slide style mapping is a v2.13 stretch goal** — if vision LLM cost / latency permits one extra annotation per image. If not, defer to v2.14.

---

## 3. MVP Definition

### Launch With (v2.13 — lean wedge)

Minimum to validate "users will upload references and prefer this over the topic-prompt flow."

- [ ] **Multi-image upload (1–8) with drag-drop + click-to-add** — table stakes; cap at 8 mirrors v2.9 Pexels match-photo cap and carousel sweet-spot
- [ ] **Rights-confirmation modal (one-time per account)** — table stakes; mirrors Firefly
- [ ] **Vision LLM style extraction** (Gemini 2.5 Flash) emitting structured style spec — core capability
- [ ] **Visible spec preview** (palette swatches + font names + one-line vibe label) — table stakes; differentiates us from Midjourney/Firefly opacity
- [ ] **Edit spec before generate** (color click-to-replace, font dropdown swap) — table stakes
- [ ] **Two-path toggle: "AI writes copy" vs "I'll supply copy"** — table stakes; both paths from Swipe Carousel verified
- [ ] **Generate → drop into existing editor** — table stakes; reuses v1.0 + v2.12 handoff
- [ ] **Reference thumbnails sticky during edit + generate** — table stakes
- [ ] **Visible credit cost** (1 credit for extract, 1 for generate; mirror v2.6 charge-then-refund) — table stakes
- [ ] **"Remix with my Brand Kit" toggle on spec-confirmation step** — differentiator but cheap (just override fields); ship if existing Brand Kit values are easy to read

### Add After Validation (v2.14)

Triggered by: users actually use v2.13 and ask for these.

- [ ] **Per-slide style mapping** (vision LLM emits inferred slide role per image) — trigger: users complain that "all slides look the same"
- [ ] **Save extracted spec as a personal "Style"** (Midjourney `--sref` codes pattern) — trigger: users re-upload the same references repeatedly
- [ ] **"Try this style" preset gallery** (curated specs from v2.9 templates) — trigger: users abandon the upload step (analytics signal); cheap to add
- [ ] **Generate 3 variants** instead of 1 — trigger: users hit "regenerate" >2× per generation (analytics signal)
- [ ] **Clipboard paste** (Cmd+V on screenshot) — trigger: piggyback on any v2.14 upload-component refactor; otherwise ship in v2.13 if upload component is touched anyway
- [ ] **Read-only spec JSON viewer** (collapsible) — trigger: any user / API consumer asks; very cheap

### Future Consideration (v2.15+ / v3.0+)

Defer until PMF or strong signal.

- [ ] **URL paste → screenshot extract** (Swipe Carousel parity) — defer: requires headless browser or Instagram Graph API; outside v2.13 wedge
- [ ] **Multi-aspect output (4:5, 1:1)** — defer: per v2.9 deferred decision; only safe-zone overlay shipped
- [ ] **"Style transfer" to user photos** (`stylize-image.ts`) — DEFINITIVELY DEFERRED per v2.9 Key Decisions (Vercel timeout, legal risk on faces)
- [ ] **Public API endpoint for extraction** — defer until REST API users (v2.5) explicitly ask
- [ ] **MCP tool for extraction** — defer until MCP usage data shows demand
- [ ] **Style "marketplace"** (publish + remix specs publicly, like Explore for v2.4) — defer; pre-PMF do not build community feature on community feature

---

## 4. Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-image upload (1–8) | HIGH | LOW | P1 |
| Rights confirmation modal | LOW (until lawsuit) | LOW | P1 |
| Vision LLM style extraction | HIGH (the core capability) | MEDIUM (prompt eng + schema) | P1 |
| Visible spec preview | HIGH (the differentiator) | MEDIUM | P1 |
| Edit spec before generate | HIGH | MEDIUM | P1 |
| Two-path content toggle | HIGH | LOW | P1 |
| Drop result in editor | HIGH | LOW (already wired) | P1 |
| Reference thumbnails sticky | MEDIUM | LOW | P1 |
| Visible credit cost | MEDIUM | LOW (existing pattern) | P1 |
| "Remix with Brand Kit" toggle | HIGH (unique to us) | LOW | P1 (if Brand Kit read is easy) |
| Per-slide style mapping | MEDIUM | MEDIUM | P2 |
| Save spec as personal Style | MEDIUM | MEDIUM | P2 |
| "Try this style" preset gallery | MEDIUM | LOW | P2 |
| Generate N variants | MEDIUM | MEDIUM (3× cost) | P2 |
| Clipboard paste | LOW (nice) | LOW | P2 (or P1 piggyback) |
| Read-only spec JSON viewer | LOW (power users) | LOW | P2 |
| URL paste → screenshot | HIGH (Swipe parity) | HIGH | P3 |
| Multi-aspect output | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.13 launch
- P2: Should have for v2.14
- P3: Nice to have, future consideration

---

## 5. Content-Path Split — UX Recommendation

**Recommendation: ONE flow with a toggle at the spec-confirmation step. NOT separate entry points.**

Rationale (with prior art backing):

1. **Swipe Carousel ships both paths under one upload entry.** Their copy: *"Keep exact text or let AI make it more engaging, professional, or casual."* This is the only direct competitor in our domain doing this exact feature, and they made the toggle choice.
2. **Two entry points doubles cognitive load on the home/dashboard.** Users would see "Generate from topic" + "Generate from reference (AI copy)" + "Generate from reference (my copy)" = three CTAs. Pre-PMF this is too much.
3. **The upload + extract step is identical for both paths.** No reason to split it.
4. **Toggle at the spec-confirmation step makes the choice contextual** — user has just seen the extracted spec; the natural next question is "what should the words be?"

### Concrete UX

```
┌─────────────────────────────────────────────────────────┐
│  Upload reference slideshow images                       │
│  ┌───────────────────────────────────────────────┐      │
│  │  [Drag & drop] or [Click to upload]            │      │
│  │  Cap: 8 images. PNG, JPG, WebP.                │      │
│  └───────────────────────────────────────────────┘      │
│  [thumb] [thumb] [thumb]              [Extract style →]  │
└─────────────────────────────────────────────────────────┘

           ⬇ (1 credit, ~3-5s, vision LLM call)

┌─────────────────────────────────────────────────────────┐
│  Extracted style                                         │
│                                                          │
│  Vibe: Editorial serif, bleed photography                │
│                                                          │
│  Palette:  ⬛ ⬜ 🟫 🟦 🟧   (click to override)           │
│  Heading:  Playfair Display ▾                            │
│  Body:     Inter ▾                                       │
│  Layout:   Cover · 3 supporting · CTA close              │
│                                                          │
│  [ ] Use my Brand Kit instead (overrides palette+fonts)  │
│                                                          │
│  ────────────────────────────────────────────────────   │
│                                                          │
│  Content:                                                │
│   ◉ Let AI write copy in this style                      │
│   ○ I'll supply my own copy                              │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │ (if AI: topic prompt input)                 │         │
│  │ (if user: per-slide text inputs, # = N from │         │
│  │  reference, prefilled placeholders matching │         │
│  │  inferred role)                             │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  [thumb] [thumb] [thumb]   ← references stay visible    │
│                                                          │
│                              [Generate carousel →]       │
└─────────────────────────────────────────────────────────┘

           ⬇ (1 credit, drops into existing editor)

┌─────────────────────────────────────────────────────────┐
│              Existing editor (v2.11 + v2.12)             │
│              with TextBoxes, decorations, etc.           │
└─────────────────────────────────────────────────────────┘
```

### Why this layout works

- **Mirrors Swipe Carousel's verified-shipped pattern** — single upload, two-path content choice contextually after spec is shown.
- **Spec preview before generate is the load-bearing differentiator** vs. Midjourney/Firefly opacity. Users see receipts before spending the second credit.
- **Brand Kit toggle is right next to the palette swatches** — natural place to ask "wait, override these with my brand?"
- **Reference thumbnails persist** through generate step (Midjourney + Swipe Carousel pattern).
- **Credit accounting is two clear charges**: 1 extract + 1 generate. Mirrors v2.6 `gemini_vision_match` charge-then-refund pattern.
- **"I'll supply my own copy" path pre-fills text inputs based on inferred slide count from references.** If reference has 5 slides, user gets 5 input boxes with placeholder hints ("Hook — pattern interrupt", "Body — supporting evidence", etc., matching v2.9 role taxonomy).

---

## 6. Competitor Feature Analysis

| Feature | Midjourney `--sref` | Adobe Firefly | Canva Magic Design / Dream Lab | Swipe Carousel | **Our Approach (v2.13)** |
|---------|---------------------|---------------|-------------------------------|----------------|--------------------------|
| Reference upload count | N (URL list) | 1 at a time | 1 (Dream Lab); N media in Magic Design | N (slides plural) | 1–8 (cap mirrors v2.9 Pexels match cap) |
| Drag-drop upload | YES (web) | YES | YES | YES | YES (table stakes) |
| URL paste extract | --sref URL | NO | NO | YES (Instagram URL → all slides) | NO in v2.13, YES in v2.14 |
| Clipboard paste | NO | NO | NO | NO | OPTIONAL v2.13 piggyback |
| What's extracted | Embedding (opaque) | Embedding (opaque) | Embedding (opaque) | "Colors, fonts, style, hierarchy, spacing, layout" (claimed; opaque to user) | **Structured spec: palette + fonts + layout enum + per-slide role** (visible to user) |
| Spec preview before generate | NO | NO | NO (Magic Design shows N variants instead) | YES (side-by-side) | **YES (palette swatches + font names + vibe label + layout sketch)** |
| Edit spec before generate | NO | NO (only sliders) | NO | UNCLEAR | **YES (click swatch to replace, dropdown to swap font)** |
| Strength slider | YES (`--sw 0..1000`) | YES (Visual Intensity + Strength) | NO | NO (visual side-by-side instead) | NO (we expose structured edits instead — better leverage) |
| Two content paths | NO | NO | NO | YES | **YES (toggle at spec-confirmation)** |
| Brand kit overlay | NO | Limited | YES (one-click) | YES (set once, applied always) | **YES (toggle at spec-confirmation; uses existing v1.0 Brand Kit)** |
| Rights confirmation | NO (Discord context) | YES (one-time modal) | Implicit (T&Cs) | Unclear | **YES (one-time modal, mirror Firefly)** |
| Output is editable | NO (image only) | NO (image only) | YES | YES | **YES (drops into v2.11 + v2.12 editor — our existing moat)** |
| Save extracted as reusable code | YES (sref codes) | NO | NO | NO | **NO in v2.13, YES in v2.14 (`user_styles`)** |

---

## 7. Sources

### Direct competitor (verified via WebFetch 2026-05-10)
- [Swipe Carousel landing page](https://www.swipecarousel.com/) — the only direct competitor doing exactly v2.13's feature set with both content paths shipped

### Reference-driven generation prior art
- [Midjourney Style Reference docs](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference)
- [Midjourney Style Creator](https://docs.midjourney.com/hc/en-us/articles/41308374558221-Style-Creator)
- [Midjourney Omni Reference](https://docs.midjourney.com/hc/en-us/articles/36285124473997-Omni-Reference)
- [Adobe Firefly Style Reference help](https://helpx.adobe.com/firefly/web/generate-images-with-text-to-image/customize-generated-images/reference-images-for-styling.html)
- [Adobe Firefly Generative Match](https://www.adobe.com/products/firefly/features/generative-match.html)
- [Adobe community: Visual Intensity vs Strength sliders](https://community.adobe.com/t5/adobe-firefly-discussions/style-reference-sliders-visual-intensity-vs-strength/td-p/14608574)
- [Canva Dream Lab help](https://www.canva.com/help/generate-with-dreamlab/) (verified via WebFetch 2026-05-10 — 403 on the help page, but search summary content used)
- [Canva Magic Design](https://www.canva.com/magic-design/)
- [Canva Brand Kit](https://www.canva.com/help/brand-kit/)
- [Canva Create on-brand images with AI](https://www.canva.com/help/create-onbrand-images-with-ai/)
- [Figma First Draft help](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI)
- [Figma attach files to a prompt](https://help.figma.com/hc/en-us/articles/31304529835671-Attach-designs-and-images-to-a-prompt)

### Screenshot-to-design plugins (the "extract spec" UX pattern)
- [image.to.design](https://divriots.com/blog/image-to-design-now-converts-screenshots/)
- [Codia AI Design](https://www.figma.com/community/plugin/1329812760871373657/codia-ai-design-screenshot-to-editable-figma-design)
- [Banani screenshot-to-UI](https://www.banani.co/product/screenshot-to-ui-design)
- [Refore screenshot-to-Figma](https://www.figma.com/community/plugin/1541719377051770998/screenshot-to-figma-by-refore-transforms-any-ui-screenshot-into-editable-figma-design)
- [anything.to.design blog: turn screenshots into editable designs](https://anything.to.design/blog/how-to-turn-screenshots-into-editable-figma-design/)

### Design-token / spec extraction (the "structured spec" pattern)
- [dembrandt — design system extractor](https://github.com/dembrandt/dembrandt)
- [designlang — design extractor](https://www.designlang.app/vs/design-extractor)
- [extract-design-system CLI](https://github.com/arvindrk/extract-design-system)

### Carousel-specific incumbents (no reference upload — context only)
- [PostNitro](https://postnitro.ai/) (verified via WebFetch — no reference-upload feature confirmed)
- [aiCarousels.com](https://www.aicarousels.com/) + [import doc](https://www.aicarousels.com/blog/ai-import-carousel) (verified via WebFetch — text-input only, no image reference)
- [WaveGen carousel maker](https://wavegen.ai/carousel-maker)
- [Insta Posts carousel generator](https://instaposts.ai/ai-carousel-generator)
- [Simplified AI carousel generator](https://simplified.com/ai-carousel-generator)
- [ContentDrips](https://contentdrips.com/)

### UX context
- [NN/g — Designing effective carousels](https://www.nngroup.com/articles/designing-effective-carousels/) (carousel sweet-spot 3–10)
- [Mailchimp — carousel design best practices](https://mailchimp.com/resources/carousel-slider-design-best-practices/)

### Internal references
- `.planning/PROJECT.md` (v2.13 milestone definition + v2.9 Key Decisions on `stylize-image.ts` deferral + Reface/Kyland Young 9th Cir. precedent)

---

## Confidence Assessment

| Section | Confidence | Why |
|---------|------------|-----|
| Prior art table | HIGH | Multiple verified sources per row; Swipe Carousel verified directly via WebFetch |
| Table stakes | HIGH | Every item has 2+ prior-art citations |
| Differentiators | HIGH | Each maps cleanly to a gap in prior art |
| Anti-features | HIGH | Each has either (a) PROJECT.md decision backing, (b) explicit prior-art absence, or (c) architectural conflict with shipped systems |
| Two-path UX recommendation | MEDIUM-HIGH | Backed by Swipe Carousel directly (the only competitor doing both paths) — but their UX details are inferred from landing-page copy, not their actual product. Worth a quick QA validation when v2.13 betas. |
| Per-slide role mapping | MEDIUM | Maps to existing v2.9 role enum cleanly, but vision LLM accuracy on this is unverified — flag for phase-specific research |
| Cap of 8 reference images | MEDIUM | Mirrors v2.9 Pexels match cap (precedent) and carousel sweet-spot — but no direct competitor data on optimal upload count |

---

*Feature research for: TikTok carousel style-from-reference generation (v2.13)*
*Researched: 2026-05-10*
