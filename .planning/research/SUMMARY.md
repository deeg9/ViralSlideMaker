# v2.9 Research Summary: Viral Visual Quality

**Project:** TikTok Slideshow Creator (ViralSlideMaker)
**Milestone:** v2.9 — Viral Visual Quality
**Researched:** 2026-04-30 / 2026-05-01
**Synthesized:** 2026-05-01
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

The single most important finding across all four research streams: **the 2026 viral aesthetic is deliberately imperfect, and our current defaults are optimally positioned to produce the opposite.** Clean Inter sans, centered headlines on muted stock photos, glossy gradients, no grain, predictable 9-slide uniformity — that is the canonical AI-slop fingerprint that platforms and audiences now actively reject. Mosseri's January 2026 thesis that "rawness is proof" is not aesthetic preference; it is an algorithmic signal. Save-rates and DM-sends now outrank likes, and the visual language that drives those signals is editorial, grain-textured, and asymmetric — not clean, centered, and polished.

The recommended path is narrow and specific: ship a server-side photo-treatment pipeline (sharp), add two new opinionated template families (Editorial-Serif, Notes-App-Chic), tighten AI prompts against slop tells, expand the display-font catalog, and promote `match-photos-to-slides.ts` from parked to shipped. That covers roughly 80% of the quality gap at pre-PMF cost levels. The temptation to also ship `stylize-image.ts` (AI photo restyling) should be resisted — Architecture and Pitfalls both flag it as architecturally conflicting with the deterministic treatment pipeline, high-latency, and legally risky on face photos. It belongs in a post-v2.9 milestone as a deliberate one-shot user action, not a generation default.

The biggest execution risk is not technical — it is building visual polish that does not move the metric that matters (creators ship-and-share). Every phase must have a quantitative success metric defined before work starts. If user interviews surface a non-visual blocker, that outranks any template work.

---

## What Research Confirmed (All 4 Sources Agree)

1. **The Satori parity invariant is load-bearing and must not be bypassed.** CSS filters (`filter: grayscale(1)`) are silently dropped by resvg-js even when Satori emits them. Any visual treatment that must survive export MUST be baked server-side as a PNG via sharp before the URL reaches the renderer. This is the established TPLREND-05 invariant from v2.7 Phase 45. Variable fonts are also broken (Satori issues #162/#712 unresolved as of 2026-05).

2. **Photo treatment (B&W / duotone / grain overlay) is the single highest-leverage visual upgrade.** All four researchers identify it as P1. LOW-to-MEDIUM build cost, HIGH visual impact, zero parity risk if baked server-side. Makes every existing template look 2026-current without a template rewrite.

3. **AI-slop guardrails are cheap and critical.** Three specific tells must be eliminated: default Inter as body font on premium templates, purple-to-blue gradient backgrounds (Imagen defaults to these), and "smiling diverse team" Pexels stock. These are the #1 and #2 cited slop tells in 2026. Each fix is a prompt string or template default — hours of work, not days.

4. **The Notes-App-Chic / Brutalist template family is the biggest differentiation gap.** No competitor in the AI-carousel category ships this aesthetic. Canva, aiCarousels.com, Plot, and Capsule all default to the commodity educational lane. The Loewe / Duolingo / Brand New / AIGA Eye on Design aesthetic is visually distinct, actively winning on platform, and technically buildable on our existing `TemplateOverlay[]` schema.

5. **Slide-role-aware AI generation (hook / reframe / supports / pivot / CTA arc) is table stakes for the educational lane.** Flat slide generation with no pacing arc reads as spam. This is a Gemini schema extension + prompt addendum — no new models needed.

6. **The parked experiments need a definitive ruling before work starts.** Architecture, Stack, and Pitfalls all flag that "parked" limbo creates confusion at build time. Decision required before Phase 54 begins. (See Parked Experiments Verdict below.)

7. **Pre-PMF cost discipline must gate every AI feature.** The $0.02/image Imagen 4 Fast model upgrade is clearly justified. Everything beyond that requires a validated user signal before spend.

---

## What Research Surprised Us With (Non-Obvious Findings)

1. **The algorithm penalizes visual homogeneity, not just content quality.** TikTok's September 2025 update fingerprints "AI editing patterns" — our identical-rhythm, identical-composition carousel structure is itself a suppression signal, independent of content. Per-slide template overrides (AI picks a different layout per slide) address this at the schema level without freeform composition complexity.

2. **Grain is the fastest path to "looks human."** The VSCO Film 02 reissue in February 2026 is the commercial proxy — grain texture is now default Instagram editing grammar. A 1080x1920 PNG noise tile committed to `public/textures/` and composited at layer 1.5 is the cheapest possible v2.9 feature. It cannot be done with CSS (Satori drops `feTurbulence`), so the pre-render PNG approach is both the correct solution and the only one.

3. **The Notes-App-Chic / Brutalist lane has zero AI-carousel competitors.** Verified independently: Canva, aiCarousels.com, Plot, and Capsule all lack it. It is a real, unoccupied lane with a buildable dependency chain already partially satisfied by v2.7's `TemplateOverlay[]` schema.

4. **TikTok Photo Mode auto-advance changes the carousel contract.** Slides are now experienced as frames in motion, not swipe-paced gallery items. Continuity across slides (Color-Walk, implied directional composition) matters more than it did 18 months ago. This argues for per-template "rhythm rules" rather than independent composition per slide.

5. **The Instagram grid aspect-ratio trap is silent and likely already hitting users.** Our hooks default to `top.hookY: 12`, which the 3:4 grid crop partially hides. A cheap CSS safe-zone overlay in the editor canvas fixes it — one component, no rendering changes.

6. **Gemini's JSON constrained-decoding degrades output diversity at a documented rate.** Academic evidence confirms 10-15% reasoning loss and monoculture risk from stacked schema constraints. We are probably already at or near the constraint ceiling from v2.7's stacked prompt rules. Adding more constraints without measuring output diversity first is a documented regression risk.

---

## Conflicts Resolved

### Conflict 1: stylize-image.ts — Ship With Model Bump (Stack) vs. Defer (Architecture + Pitfalls)

Stack research recommended promoting `stylize-image.ts` with a model upgrade to `gemini-3.1-flash-image-preview`. Architecture recommended deferring as a one-shot user action. Pitfalls recommended deferring to v3.0+.

**Recommendation: Defer to post-v2.9. Architecture and Pitfalls win.** The architectural conflict is decisive: if `treatPhoto()` runs on a stylize output URL and the user toggles treatment off, we revert to the AI-stylized image, not their original — confusing and architecturally dishonest. A three-URL-per-slide model is engineering debt introduced before PMF. Sharp-based B&W + duotone + grain delivers 80% of the visual win at 0% per-image cost and no legal risk. Keep the file in the repo, do not wire it into the v2.9 generation pipeline. The model string upgrade comment is still valid — note it for the post-PMF milestone.

### Conflict 2: match-photos-to-slides.ts — Ship in Phase 56/58 (Architecture) vs. Require User Signal First (Pitfalls)

**Recommendation: Ship it in Phase 58 (final), gated to premium tier, with cost protections.** The architectural fit is genuinely clean. The Pitfalls cost concern about "12 photos × vision tokens = 5-8x cost" applies to a vision-per-image implementation, not the text-based schema-output call in the actual parked file. With `MAX_PHOTOS = 8`, a content-hash cache, and a 10s timeout with index-order fallback, the concerns are fully mitigated.

### Conflict 3: Phase Count — 7 (Architecture) vs. 5 (Stack) vs. 8 P1 features (Features) vs. 5 (Pitfalls)

**Recommendation: 5 phases, numbered 54-58.** Architecture's 7 phases are merged: Schema + Renderer Extensions collapse into one phase (55), new Templates and editor toggle are adjacent enough to separate but resequenced, and AI prompt tuning lands last after all templates exist.

### Conflict 4: node-vibrant vs. sharp.stats() for Color Extraction

**Recommendation: Start with sharp.stats() in Phase 54, add @vibrant/node in Phase 57 when new templates require named accent roles.** `sharp.stats()` covers the treatment pipeline's needs. `@vibrant/node` is needed for templates that require semantically-labeled swatches for accent color selection. Install the dep when those templates are built.

### Conflict 5: Imagen Model Upgrade Timing

**Recommendation: Imagen 4 Fast in Phase 54 as a config-only change.** At $0.02/image, it is cheaper AND materially better on text rendering and detail. Standard ($0.04) is not worth 2x cost pre-PMF.

---

## Top 5 Highest-Leverage Features (Ranked by Impact-to-Cost)

| Rank | Feature | Impact | Cost | Phase |
|------|---------|--------|------|-------|
| 1 | **Photo treatment system** (B&W / duotone / grain overlay, baked via sharp before Satori) | HIGH — makes every existing template look 2026-current | LOW-MED — ~300 LOC new lib + 1 Storage bucket | 54, 55 |
| 2 | **AI-slop guardrails** (no Inter default on premium; Imagen prompt forbids gradient/glossy/3D; Pexels query favors documentary/portrait) | HIGH — cheapest quality floor, prevents worst output | LOW — prompt strings + template defaults | 54, 58 |
| 3 | **Slide-role-aware AI generation** (hook / reframe / supports / pivot / close schema + per-role prompt addenda) | HIGH — flat pacing is the #1 content-quality gap | MED — Gemini schema extension + system prompt addendum | 58 |
| 4 | **Notes-App-Chic template + decorative-overlay library** (paper-texture, ransom-note hook, tape strips, halftone, sticky notes) | HIGH — zero competitors ship this | MED — 2-3 templates + curated SVG/PNG asset library | 56, 57 |
| 5 | **Display-font expansion + hook size raise** (4-6 new display sans + 2 sharp-modern serifs via Fontsource static TTF; hook default raised to 110-130px on premium) | HIGH — Anton-everywhere is the single most identifiable tell | LOW — extend font catalog, update template defaults | 55, 56 |

**P2 features (ship if scope allows, not required to claim "viral visual quality"):** auto palette extraction (`@vibrant/node`), per-segment font family, AI hook A/B selector, imperfect-by-default jitter, Brutalist-Grid template, Editorial-Serif template (this one is low-cost and likely fits in Phase 56).

---

## Top 3 Anti-Patterns to Actively Avoid

### Anti-Pattern 1: Default Inter on Premium Templates

Inter Regular as default body font on premium templates is the #1 cited AI-slop tell for 2026 (925studios.co). Every competitor defaults to Inter or Poppins. We currently use Inter as a fallback.

**Prevention:** Each premium template must declare its own body font in the template schema. The template validator must require `bodyFontFamily` as a non-nullable field on premium templates. If a designer wants Inter on a premium template, they must explicitly declare it — not get it by default.

### Anti-Pattern 2: Smooth Gradient Backgrounds (from Imagen or Template Defaults)

Purple-to-blue, sunset orange-to-pink, teal-to-navy gradients are the #2 cited AI-slop tell, and Imagen's API defaults to these when given vague prompts. The fix is not "use better gradients" — it is "no gradient backgrounds by default."

**Prevention:** Mandatory Imagen prompt addendum: "Do not generate gradient backgrounds. Do not generate glossy 3D objects. Do not generate abstract color blobs. Generate documentary-style photographs with naturalistic lighting." Pexels query addendum: "Prioritize natural lighting, candid, editorial, portrait. Exclude: meeting, office, team, smiling, diverse group."

### Anti-Pattern 3: Skipping resolve-overlay.ts for "Just One Layer"

Adding a new visual effect (grain PNG, vignette div) directly in `render-slide-satori.tsx` instead of exporting it from `resolve-overlay.ts` and importing in both renderers. This is how the TPLREND-05 parity invariant breaks. Editor preview shows grain; exported PNG does not. In a pre-PMF product, a "my export looks different from the preview" bug is a churn event.

**Prevention:** Every new visual layer is a function exported from `src/lib/render/resolve-overlay.ts`. Both `render-slide-satori.tsx` and `slide-preview.tsx` import from the same module. Add a CI lint rule that fails if either renderer file contains a JSX element not imported from the resolver or from typed slide data.

---

## Recommended Phase Plan

**Merging:** Architecture's 7 phases (54-60), Stack's 5 tiers (A-E), Pitfalls' 5 categories, and Features' 8 P1 items into 5 cohesive phases.

---

### Phase 54 — Infrastructure Foundation

**Rationale:** Load-bearing. The photo-treatment pipeline (`treat.ts`) gates everything else. The Imagen model upgrade and AI-slop guardrails are zero-dependency changes that belong here.

**Delivers:**
- `src/lib/photo-treatment/treat.ts` — sharp pipeline: B&W / duotone / contrast-bump, idempotent SHA-256 cache, Supabase Storage `slide-backgrounds-treated` bucket + palette sidecar JSON
- `sharp.cache(false)` + `sharp.concurrency(1)` module config (prevents Pitfall #5 memory fragmentation)
- Model bump in `generate-image.ts`: `imagen-4.0-fast-generate-001` (one string change)
- AI-slop prompt guardrails: Imagen prompt addendum (no gradient/glossy/3D), Pexels query addendum (documentary preference, exclude office/team/smiling)
- Storage migration: `slide-backgrounds-treated` public bucket
- `treat.test.ts`: pure pipeline + idempotency tests

**Avoids:** Pitfall #2 (Satori CSS filter trap — we bake server-side), Pitfall #5 (sharp memory fragmentation), Pitfall #11 (Imagen 4 Fast is cheaper than current)

---

### Phase 55 — Schema + Renderer Extensions

**Rationale:** New templates must be built against working schema fields and working renderer layers. This phase is purposely template-free — it ships the infrastructure that templates consume, verified via existing templates with feature flags.

**Delivers:**
- `SlideTemplate` schema extensions: `grainMode?`, `vignette?`, `photoTreatment?`, `paletteMode?` (all optional; existing 8 templates unchanged)
- `Slide` schema additions: `original_source_url`, `style_overrides.derived_palette: string[]`, `style_overrides.treatment_applied: string`, `template_id_override?: string`
- `resolve-overlay.ts` additions: `renderGrain(intensity)`, `renderVignette(strength)` — exported, consumed by both renderers
- Generation pipeline writes `treatedUrl` to `slide.background_url` and palette to `slide.style_overrides.derived_palette`
- Font catalog expansion: 4-6 new display sans (Bebas Neue, Archivo Black, Plus Jakarta Sans Display, etc.) + 2 sharp-modern serifs (Playfair Display, Recoleta Bold equivalent) as static TTF via Fontsource
- Premium template body font fields: each existing premium template gets explicit non-Inter `bodyFontFamily`
- Hook default `fontSize` raised to 110-130px on premium templates
- `parity.test.tsx` for new resolver helpers
- Template validator extended to require `bodyFontFamily` on premium templates

**Avoids:** Pitfall #2 (allowlist pattern — new fields documented), Pitfall #3 (no new gradients), Pitfall #15 (existing templates unchanged — only additive fields)

---

### Phase 56 — New Templates + Decorative Library

**Rationale:** With schema and renderer infrastructure in place, new templates can be built against guaranteed-working primitives.

**Delivers:**
- Grain PNG asset set: `public/textures/grain-subtle.png`, `grain-medium.png`, `grain-heavy.png`, `paper-texture.png`, `xerox-grain.png` — generated via `scripts/build-textures.ts`, committed to repo
- Decorative-overlay asset library: 12-16 SVG/PNG assets (tape strips, sticky notes, halftone dot patterns, hand-drawn arrows, polaroid frame)
- **Editorial-Serif template** (`editorial-serif`): B&W bleed photo, Playfair Display 130px hook, cream accent, page counter top-right, medium grain overlay
- **Notes-App-Chic template** (`notes-app-chic`): paper-texture background, ransom-note hook (mixed fonts via segment `fontFamily`), tape-strip overlay, sticky-note overlay, halftone-dot accent, photocopier grain
- Per-segment `fontFamily?: string` on `TextSegment` schema (required for ransom-note hooks)
- Font-loader update to walk segment `fontFamily` fields
- `npm run textures` script added to package.json
- Thumbnail generation extended for new templates

**Avoids:** Pitfall #1 (templates are parametric — color/font/treatment are config, not hardcoded aesthetic), Pitfall #2 (no new CSS bypassing Satori allowlist)

**Research flag:** Notes-App-Chic asset curation needs a design-review pass against `@loewe`, `@duolingo`, Brand New reference carousels before Phase 57 starts. Asset quality determines whether the template reads as "craft" or "clip-art."

---

### Phase 57 — Editor Controls + Palette Extraction

**Rationale:** After new templates exist and the treatment pipeline is wired into generation, expose user-facing controls for treatment overrides and wire automatic palette extraction for templates that require it.

**Delivers:**
- `src/components/editor/photo-treatment-controls.tsx` — B&W toggle, duotone preset picker, grain intensity slider; wired to `editor-actions.ts: updateSlideTreatment()` server action; always re-treats from `slide.original_source_url` (never compounds)
- `@vibrant/node@^4.0.3` installed — palette extraction switched to named-role k-means for Editorial-Serif and Notes-App-Chic templates (need `Vibrant` / `DarkVibrant` / `Muted` roles for accent selection)
- Instagram grid safe-zone overlay in the canvas editor (CSS overlay, no rendering changes)
- Per-template `coverLayout` distinct from `innerLayout` (first-slide ≠ inner-slides; upper-third hook default on new templates)
- Retention policy on `slide-backgrounds-treated` bucket (7-day auto-purge for intermediate assets without a project link)

**Avoids:** Pitfall #5 (sharp serial-only already in Phase 54), Pitfall #9 (IG grid safe-zone), Pitfall #12 (retention policy)

**Research flag:** The photo-treatment-controls UI is new editor surface. If the right-rail is already crowded after v2.8's redesign, a UX design decision about placement is needed before Phase 57 starts.

---

### Phase 58 — AI Tightening + Parity QA + match-photos-to-slides

**Rationale:** AI prompt changes land last, after all templates exist (prompts reference template IDs by name). Parity QA is the ship gate. match-photos-to-slides is the final parked experiment to wire in.

**Delivers:**
- Slide-role-aware AI generation: Gemini schema extended with `role: 'cover' | 'reframe' | 'support' | 'pivot' | 'close'`; per-role prompt addenda
- `template_id_override` enum in Gemini response schema: AI can vary templates across slides
- AI prompt diversity gate: 20 carousels on fixed test prompts, measure trigram overlap; fail CI if hook opening repetition exceeds 30%
- `aiVoiceNote` updated for new templates
- No-AI-tell prompt additions: "Do not start hooks with 'In a world where', 'Did you know', 'Imagine if'. Vary hook opening across runs."
- **`match-photos-to-slides.ts` promoted from parked to shipped:** wired into the upload flow, gated to premium tier, `MAX_PHOTOS = 8`, cache by `(photoSetHash, slideManifestHash)`, fallback to index-order on failure or 10s timeout, cost tracked as `gemini_vision_match` credit line
- PNG metadata strip verification on ZIP export (assert no EXIF/XMP/C2PA)
- `scripts/render-parity-grid.ts` — opt-in script: every template × 3 sample slides, both renderers, manual visual audit
- Cascade-delete audit: deleting a project cleans hero thumbnail + treated background assets
- Template versioning policy: new templates get new IDs, never mutate shipped IDs in place
- Ship-gate checklist from PITFALLS.md verified before milestone-complete

**Avoids:** Pitfall #4 (diversity test harness before prompt change), Pitfall #6 (MAX_PHOTOS, cache, premium gate), Pitfall #8 (metadata strip, hook cadence rules), Pitfall #11 (credit ledger line), Pitfall #12 (cascade-delete audit), Pitfall #15 (template versioning policy)

**Research flag:** AI output diversity testing requires a fixed test corpus — 20 prompts across different creator niches must be written before Phase 58 starts. This is a planning artifact, not engineering work.

---

### Phase Ordering Rationale

- Phase 54 first: `treat.ts` is the only component with zero v2.9 dependencies. The Imagen model upgrade and slop guardrails are also zero-dependency. They also gate Phase 55's schema extensions (schema needs the `TreatmentSpec` types from `treat.ts`).
- Phase 55 before Phase 56: New templates must be built against working schema fields and working renderer layers.
- Phase 56 before Phase 57: The editor's treatment toggle is useless without templates that declare a `photoTreatment` spec. Palette extraction is unused without templates with `paletteMode: 'palette-dominant'`.
- Phase 58 last: AI prompts reference template IDs by name. Parity QA gates everything. match-photos ships last to avoid blocking earlier phases on an optional upgrade.
- No phase is blocked on `stylize-image.ts`: deferred to post-v2.9.

---

## Parked Experiments Verdict

### match-photos-to-slides.ts — SHIP in Phase 58 (premium-gated)

Architecturally clean. Output (`(string | null)[]` array) plugs directly into the `original_source_url` field added in Phase 55. The cost concern from Pitfalls is mis-scoped to a vision-per-image implementation; the actual parked file uses Gemini text output (JSON-schema-constrained). With `MAX_PHOTOS = 8`, a content-hash cache, and a 10s timeout with index-order fallback, all concerns are mitigated. Gate to premium tier to align cost with revenue. Ship in Phase 58 (last) so it does not block earlier phases.

### stylize-image.ts — DEFER to post-v2.9

Do not wire into the v2.9 generation pipeline. Three independent reasons from three different researchers:

1. **Architectural conflict** (Architecture): `treat.ts` and stylize both claim the "transformed photo" slot. Running both requires three URLs per slide (`user_original_url` / `stylized_url` / `treated_url`) — engineering debt introduced before PMF.

2. **Cost + latency** (Pitfalls): 8 slides × ~10s = 80s wall-clock, exceeding Vercel's 60s `maxDuration`. At $0.039-$0.134/image, a stylized carousel costs $0.31-$1.07 in raw model spend before user credits.

3. **Legal and quality risk** (Pitfalls): Non-deterministic output produces inconsistent faces across slides (uncanny valley). Pexels photos of real people stylized via AI cross right-of-publicity lines established in 2024-2025 case law (Reface/Kyland Young, Ninth Circuit).

**What to do with the file:** Keep it in the repo. Note the `gemini-3.1-flash-image-preview` upgrade target in a comment. Do not wire it. Re-evaluate post-PMF as a one-shot "restyle this photo" button — async, premium-only, background-only (no faces), locked to 3-5 style presets.

---

## Open Questions for Requirements Gathering

1. **What is the v2.9 success metric?** "Creators ship-and-share" is right directionally. But what is the measurable proxy — ZIP download rate? Published-to-Explore rate? Session-to-export rate? This must be defined before Phase 54 starts. Pitfall #13 is a real runway risk if it isn't.

2. **What are the Pexels exclusion terms for our actual user base?** The research-grounded guardrail (exclude: meeting, office, team, smiling, diverse group) may miss domain-specific slop for food creators, travel creators, or personal-brand creators. A 10-minute review of current user carousels on Explore would answer this.

3. **Should Notes-App-Chic be gated to premium or free?** It is the biggest differentiation feature. Free drives top-of-funnel sharing; premium drives upgrades. Pre-PMF, free is usually right — but this is a product decision, not a research decision.

4. **What are the per-role prompt addenda for each archetype?** The swipe arc structure (cover / reframe / support / pivot / close) is established. But the specific copy guidance per role requires user interview input or creator-reference QA, not more research.

5. **What is the per-carousel AI cost ceiling for free vs. premium?** Pitfalls established a model (Imagen 4 Fast = $0.02/image × 8 slides = $0.16 baseline). What is the maximum acceptable ceiling? This determines which features default-on vs. premium-gate.

6. **Is the Pangram Pangram font investment justified pre-PMF?** Stack research recommended PP Editorial New / PP Neue Montreal / PP Right Grotesk on the free-trial license during dev, $40/face/site web license at production launch ($120 for 3 faces). If Editorial-Serif can be built with Playfair Display (free, Google Fonts), is Pangram worth deferring until paid users exist?

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Model IDs, pricing, Satori constraints verified from official sources (Google AI docs, Satori GitHub, Pangram FAQ). One MEDIUM: `gemini-3.1-flash-image-preview` is in preview — stable per Google's 2-week deprecation notice policy, but preview. |
| Features | MEDIUM-HIGH | Archetypes and creator handles multi-source verified. Complexity estimates are codebase-grounded but not benchmarked. |
| Architecture | HIGH | Critical findings (Satori CSS filter silent-drop via satori#573, variable font breakage via #162/#712) verified from primary sources. Build-order grounded in the existing codebase read directly. |
| Pitfalls | MEDIUM-HIGH | Satori limits and AI pricing are HIGH (official sources). TikTok reach suppression numbers are MEDIUM (industry write-ups, not platform documentation). Sharp memory fragmentation is HIGH (primary engineering postmortems). |

**Critical gap:** None of the research can replace seeing the current product side-by-side against `@a24`, `@nytimes`, `@ssense`, `@loewe`, `@indiesleaze`, and `@halfbakedharvest` carousels. FEATURES.md recommends this as the cheapest v2.9 bar-setting exercise. Render the same topic through our current templates; score the gap. That visual QA is the one finding that cannot be synthesized from text.

---

## Sources / Cross-References

**PRIMARY (HIGH):**
- [vercel/satori#573](https://github.com/vercel/satori/issues/573) — CSS filter silent-drop in resvg-js (the single most important technical finding)
- [vercel/satori#162](https://github.com/vercel/satori/issues/162) + [#712](https://github.com/vercel/satori/issues/712) — variable font support broken, unresolved
- [Google AI Image Generation docs](https://ai.google.dev/gemini-api/docs/image-generation) — model IDs, pricing
- [Imagen 4 release announcement](https://developers.googleblog.com/imagen-4-now-available-in-the-gemini-api-and-google-ai-studio/) — GA, 10x faster, better text rendering
- [sharp issue #3052](https://github.com/lovell/sharp/issues/3052) + [#1041](https://github.com/lovell/sharp/issues/1041) — memory fragmentation under serverless load
- [Reface/Kyland Young right-of-publicity ruling](https://perkinscoie.com/insights/blog/refaceoff-animating-right-publicity-dawn-generative-ai) — legal precedent for face stylization

**SECONDARY (MEDIUM-HIGH):**
- [Aesthetics of Photography — Viral Visual Grammar of US Instagram 2026](https://aestheticsofphotography.com/the-viral-visual-grammar-of-us-instagram-in-2026-aesthetics-algorithms-and-attention/) — drives most FEATURES.md archetype findings
- [Canva — Imperfect by Design 2026](https://www.canva.com/newsroom/news/design-trends-2026/) — Notes App Chic, grain-as-authenticity
- [It's Nice That — Forward-thinking graphic trends 2026](https://www.itsnicethat.com/features/forward-thinking-graphic-trends-2026-graphic-design-120126) — Make Me a Copy, Pick-and-Mix typography
- [LLM constrained-decoding academic paper](https://arxiv.org/html/2501.10868v1) — 10-15% reasoning loss from JSON schema constraints

**Research files consumed:**
- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`

---

### Roadmap Implications Summary

**Suggested phases:** 5 (numbered 54-58)

1. **Phase 54 — Infrastructure Foundation** — photo-treatment pipeline + Imagen 4 Fast upgrade + AI-slop guardrails; gates everything else
2. **Phase 55 — Schema + Renderer Extensions** — SlideTemplate/Slide schema additions, renderGrain/renderVignette in resolver, font catalog expansion
3. **Phase 56 — New Templates + Decorative Library** — grain PNGs, Editorial-Serif, Notes-App-Chic, decorative overlay asset library
4. **Phase 57 — Editor Controls + Palette Extraction** — photo-treatment toggle UI, @vibrant/node, IG safe-zone overlay, retention policy
5. **Phase 58 — AI Tightening + Parity QA + match-photos** — slide-role schema, diversity gate, match-photos-to-slides shipped, ship-gate checklist

**Needs research during planning:** Phase 56 (Notes-App-Chic asset curation — visual QA against reference carousels before assets are produced), Phase 58 (test corpus of 20 prompts must exist before diversity gate can be written)

**Standard patterns (skip research-phase):** Phases 54, 55, 57 — all well-documented patterns established in the codebase
