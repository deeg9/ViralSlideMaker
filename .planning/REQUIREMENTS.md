# Requirements: v2.9 Viral Visual Quality

**Milestone goal:** Upgrade the visual output of AI-generated carousel slides so they look like what's actually winning on TikTok and Instagram in early-to-mid 2026 — replicating proven patterns from successful creators rather than guessing.

**Research grounding:** Aesthetics of Photography "Viral Visual Grammar of US Instagram in 2026"; Canva "Imperfect by Design 2026"; It's Nice That graphic trends 2026; Mosseri Jan 2026 "rawness is proof"; verified Satori constraints (issues #573, #162, #712); Imagen 4 Fast pricing (Google AI docs); right-of-publicity precedent (Reface/Kyland Young, 9th Cir.). See `.planning/research/SUMMARY.md`.

**Success metric:** ZIP download rate per created carousel — proxy for "good enough to ship." Tracked in Phase 54 onward.

**Out-of-scope by user decision:** legacy schema sunset (deferred until post-PMF), `stylize-image.ts` (architectural conflict + Vercel timeout breach + face-stylization legal risk — defer to v3.0+), Pangram Pangram fonts ($120 deferred until paying users exist).

---

## Categories

- **TREAT** — Server-side photo treatment pipeline (sharp): B&W, duotone, grain, contrast-bump
- **SLOP** — AI-slop guardrails: prompt addenda, default-font lockdown, Pexels query exclusions
- **AIROLE** — Slide-role-aware AI generation (cover / reframe / support / pivot / close)
- **TPL** — New template families (Editorial-Serif, Notes-App-Chic, Brutalist-Grid)
- **TYPO** — Display-font catalog expansion + premium hook size
- **EDITOR** — Editor controls (treatment toggle, IG grid safe-zone overlay)
- **PALETTE** — Dominant-color palette extraction (`@vibrant/node`)
- **MATCH** — Premium photo→slide content-aware matching (`match-photos-to-slides.ts`)
- **PARITY** — Satori/React render parity verification + ship gate
- **METRIC** — ZIP download rate tracking

---

## TREAT — Photo treatment pipeline

- [ ] **TREAT-01** — `src/lib/photo-treatment/treat.ts` exposes `treatPhoto(sourceUrl, spec)` returning `{ url, palette }`. Uses sharp for transforms; idempotent via SHA-256 cache key of `(sourceUrl + spec)`. Supports presets: `bw`, `duotone-cream`, `duotone-cobalt`, `contrast-bump`.
- [ ] **TREAT-02** — Treated assets stored in new public Supabase Storage bucket `slide-backgrounds-treated`. Cache hit returns existing URL without re-processing.
- [ ] **TREAT-03** — Sharp module config locked: `sharp.cache(false)` and `sharp.concurrency(1)` set at module load to prevent serverless memory fragmentation.
- [ ] **TREAT-04** — Generation pipeline writes `treatedUrl` to `slide.background_url` and the original Pexels/Imagen URL to new field `slide.original_source_url`. Re-treating starts from `original_source_url`, never compounds.
- [ ] **TREAT-05** — Pure unit tests for treatment functions (no DB) verify byte-identical output for the same `(sourceUrl, spec)` pair across two invocations.
- [ ] **TREAT-06** — `slide-backgrounds-treated` bucket has 7-day retention policy on assets without an associated project (intermediate cache cleanup).

## SLOP — AI-slop guardrails

- [ ] **SLOP-01** — Imagen prompt mandatory addendum: "Do not generate gradient backgrounds. Do not generate glossy 3D objects or abstract color blobs. Generate documentary-style photographs with naturalistic lighting." Applied at every Imagen call site.
- [ ] **SLOP-02** — Pexels query addendum: append "natural lighting, candid, editorial, portrait" and exclude terms `meeting, office, team, smiling, diverse group` from the search query string before hitting Pexels API.
- [ ] **SLOP-03** — Template validator requires `bodyFontFamily: string` as non-nullable on every premium-tier template. Inter-as-default falls through is impossible by construction; templates must declare a body font explicitly.
- [ ] **SLOP-04** — AI hook generation system-prompt addendum: "Do not start hooks with 'In a world where', 'Did you know', 'Imagine if'. Vary hook openings across slides in the same carousel."
- [ ] **SLOP-05** — Existing 8 templates audited: any template defaulting to Inter as `bodyFontFamily` updated to declare a non-Inter font (Plus Jakarta Sans, Manrope, or Geist as alternates).

## AIROLE — Slide-role-aware AI generation

- [ ] **AIROLE-01** — Gemini slide-generation response schema extends each slide with `role: 'cover' | 'reframe' | 'support' | 'pivot' | 'close'`. First slide is always `cover`; last slide is `close`; middle slides distributed across `reframe`/`support`/`pivot` based on carousel length.
- [ ] **AIROLE-02** — System prompt includes per-role copy guidance (cover = pattern-interrupt hook ≤8 words; reframe = "wait, but" tension; support = concrete evidence/example; pivot = unexpected angle; close = action / CTA / bookmark prompt).
- [ ] **AIROLE-03** — Gemini response schema gains `template_id_override?: string` (closed enum, registry-validated). AI may pick a different template per slide for visual rhythm; null = use project template.
- [ ] **AIROLE-04** — Existing premium-tier guardrails (length caps, typo gate) preserved; v2.7 audit baseline (19/19 reqs) re-verified after prompt change.
- [ ] **AIROLE-05** — Server-side validator: if `role` field missing or invalid, default to legacy flat distribution. Never throws — user always gets a usable carousel.

## TPL — New template families

- [ ] **TPL-01** — `editorial-serif` template registered: B&W bleed photo (auto-treated via TREAT preset `bw`), Playfair Display 130px hook, cream `#F5EFE6` accent, page counter top-right, medium grain overlay (`grainMode: 'medium'`), Recoleta-equivalent body font (free).
- [ ] **TPL-02** — `notes-app-chic` template registered: paper-texture background (committed PNG asset), ransom-note hook (mixed fonts via per-segment `fontFamily`), tape-strip overlay, sticky-note overlay, halftone-dot accent, photocopier-grain overlay.
- [ ] **TPL-03** — `brutalist-grid` template registered: hard 8-column grid, type-as-image hero (oversized hook fills frame), high-contrast B&W with single accent color (per-template config), no decorative overlays — minimalist by construction.
- [ ] **TPL-04** — Decorative-overlay asset library: 12-16 SVG/PNG assets in `public/overlays/` — tape strips (3 variants), sticky notes (3 colors), halftone dot patterns (2 densities), hand-drawn arrows (4 directions), polaroid frame, paper torn-edge.
- [ ] **TPL-05** — Grain PNG asset set generated via `scripts/build-textures.ts` (committed): `grain-subtle.png`, `grain-medium.png`, `grain-heavy.png`, `paper-texture.png`, `xerox-grain.png` — all 1080×1920 tileable.
- [ ] **TPL-06** — Per-template `coverLayout` distinct from `innerLayout`: first slide may use upper-third hook + bleed photo; inner slides may use middle-third hook + tighter crop. Specified per new template.
- [ ] **TPL-07** — Per-`TextSegment` `fontFamily?: string` field added (required for `notes-app-chic` ransom-note hooks). Font loader walks segment-level fontFamily to register fonts with Satori.
- [ ] **TPL-08** — Thumbnail generation (`npm run thumbs`) extended for the 3 new templates; `/templates` picker DOM regression test updated to assert thumbnails resolve (no swatch fallback).
- [ ] **TPL-09** — All 3 new templates available to free-tier users (no paywall on differentiation features pre-PMF).
- [ ] **TPL-10** — All 3 new templates pass parity audit: same `(slide_data, template_id)` produces byte-identical output between React `<SlidePreview>` and Satori PNG export.

## TYPO — Typography expansion

- [ ] **TYPO-01** — Font catalog expands by 4-6 new display sans (free Google Fonts only): Bebas Neue, Archivo Black, Plus Jakarta Sans Display, Plus Jakarta Sans, Space Grotesk, Manrope. Registered as static TTF via Fontsource.
- [ ] **TYPO-02** — Font catalog expands by 2 sharp-modern serifs (free): Playfair Display, DM Serif Display.
- [ ] **TYPO-03** — Premium template hook default `fontSize` raised from current 88px to 110-130px range (per-template config).
- [ ] **TYPO-04** — Variable fonts NOT used (Satori issues #162/#712 unresolved). All fonts ship as static-weight TTF.
- [ ] **TYPO-05** — No paid font licenses in v2.9 (Pangram deferred until paying users exist).

## EDITOR — Editor controls

- [ ] **EDITOR-01** — `src/components/editor/photo-treatment-controls.tsx`: per-slide controls in right rail — B&W toggle, duotone preset picker (cream / cobalt), grain intensity (off / subtle / medium / heavy). Wired to `editor-actions.ts: updateSlideTreatment(slideIndex, spec)` server action.
- [ ] **EDITOR-02** — Treatment toggle always re-treats from `slide.original_source_url` (never compounds on already-treated output).
- [ ] **EDITOR-03** — Instagram grid safe-zone overlay rendered in canvas editor: 4:5 (1080×1350) crop bounds shown as dashed outline when "IG grid preview" toggle is on. CSS-only — no rendering changes.
- [ ] **EDITOR-04** — Treatment controls placement does not regress the v2.8 right-rail layout (no horizontal overflow, fits below `SlideSettings` section).

## PALETTE — Color palette extraction

- [ ] **PALETTE-01** — `@vibrant/node@^4.0.3` installed. `extractPalette(treatedUrl)` returns named roles `{ Vibrant, DarkVibrant, LightVibrant, Muted, DarkMuted, LightMuted }` as hex strings.
- [ ] **PALETTE-02** — `slide.style_overrides.derived_palette: string[]` populated at generation time (and on treatment override) via PALETTE-01.
- [ ] **PALETTE-03** — `editorial-serif` and `notes-app-chic` templates with `paletteMode: 'palette-dominant'` consume `derived_palette` for accent color selection (Vibrant for chip backgrounds; DarkMuted for text on light backgrounds).
- [ ] **PALETTE-04** — Palette extraction runs on the treated thumbnail (resized to ≤256×256 server-side) — not full-resolution — to keep Vercel function memory under budget.

## MATCH — Photo→slide content matching

- [ ] **MATCH-01** — `src/lib/ai/match-photos-to-slides.ts` (currently parked) wired into the upload flow. Premium-tier only.
- [ ] **MATCH-02** — `MAX_PHOTOS = 8` constant enforced. If user uploads >8, only first 8 sent to Gemini; rest fall through to index-order.
- [ ] **MATCH-03** — Result cached by `(photoSetSHA256, slideManifestSHA256)` key. Cache hit returns mapping without re-calling Gemini.
- [ ] **MATCH-04** — 10-second timeout on Gemini call. Timeout or API error falls through to existing index-order behavior — never blocks generation.
- [ ] **MATCH-05** — Gemini Vision usage tracked as `gemini_vision_match` credit-ledger line per call. Credit cost: 1 credit per match (covers 8 photos).

## PARITY — Render parity verification

- [ ] **PARITY-01** — `src/lib/render/__tests__/parity.test.tsx`: for each new template (editorial-serif, notes-app-chic, brutalist-grid), assert React preview HTML output and Satori SVG output reference identical resolver helpers from `src/lib/render/resolve-overlay.ts`.
- [ ] **PARITY-02** — `renderGrain(intensity)` and `renderVignette(strength)` exported from `src/lib/render/resolve-overlay.ts`. Both `render-slide-satori.tsx` and `slide-preview.tsx` consume from the same module — no duplicated layout JSX.
- [ ] **PARITY-03** — `scripts/render-parity-grid.ts` (manual / opt-in): renders every template × 3 sample slides through both renderers, outputs side-by-side PNG comparison grid for visual audit.
- [ ] **PARITY-04** — CSS filter properties (`filter: grayscale(...)`, `filter: blur(...)`, etc.) NOT used in any new render layer — server-side sharp pre-bake is the only path for photo treatment.
- [ ] **PARITY-05** — PNG export metadata strip verified: `downloadSlidesAsZip` output PNGs contain no EXIF / XMP / C2PA metadata (assert via `image-size` or equivalent in test).
- [ ] **PARITY-06** — Cascade-delete audit: deleting a project cleans hero thumbnail, treated background assets, and original-source uploads. Existing project-deletion code path extended.

## METRIC — Success metric tracking

- [ ] **METRIC-01** — `download_zip` event tracked per project (one event per ZIP download). Event payload includes `project_id`, `slide_count`, `template_id`, `user_tier`.
- [ ] **METRIC-02** — Dashboard query returns `zip_download_rate = downloads / created` for any time window. Surfaced in admin/analytics view (not user-facing).
- [ ] **METRIC-03** — Baseline captured at v2.9 milestone start (last 30 days pre-Phase-54 = baseline). Phase 58 ship gate references this baseline; success = post-launch rate ≥ baseline.

---

## Out of Scope (v2.9)

| Feature | Reason |
|---|---|
| Legacy schema sunset (`hook_text` / `body_text` etc.) | Pre-PMF — tech debt waits until users love the product. Deferred. |
| `stylize-image.ts` (AI photo restyling) | Architectural conflict with deterministic treatment cache; 80s wall-clock breaches Vercel 60s `maxDuration`; right-of-publicity legal risk on faces. Defer to v3.0+. |
| CANVAS-03 (Layers mini-list) | v2.8 Layer Strip covers ~90% of cases; resurface only if user complaint emerges. |
| AIGEN-01 (native Gemini `text_boxes[]` prompt) | v2.8 Phase 51 light-touch alternative produces equivalent state; no observable user gain from rewriting. |
| Pangram Pangram fonts | $120 at production launch — defer until paying users exist. Free Google Fonts cover Editorial-Serif (Playfair Display) and display sans needs. |
| Variable fonts | Satori issues #162/#712 unresolved as of 2026-05. Static TTF only. |
| iOS / React Native port | Web-first remains priority. |
| Real-time collaboration | Solo creator tool; out of scope across all milestones. |
| Auto-posting to TikTok/IG | Complex OAuth; defer indefinitely. |

---

## Locked Decisions (from research synthesis + user input 2026-05-01)

- **Photo treatment baked server-side via sharp** — CSS filters silently break Satori PNG export (vercel/satori#573). Pre-render is both correct and the only path.
- **Imagen 4 Fast** (`imagen-4.0-fast-generate-001`) replaces current Imagen 3. Cheaper ($0.02 vs $0.04/image), 10× faster, better text rendering. One-line config change.
- **5 phases (54-58)** chosen over 7 (Architecture proposed) or 5 with different boundaries (Stack proposed). Phases group by build-order dependency.
- **All 3 new templates free** for all users — pre-PMF, top-of-funnel sharing > premium gating.
- **`match-photos-to-slides.ts` ships** premium-gated in Phase 58 (last). Architecturally clean; cost concerns mitigated by `MAX_PHOTOS=8` + cache + timeout.
- **`stylize-image.ts` deferred** to post-v2.9. File stays in repo; not wired into pipeline. Re-evaluate post-PMF as one-shot user action with face-detection refusal.
- **Brutalist-Grid added to scope** beyond Top-5 features (user expansion 2026-05-01) — third differentiation template family.
- **Success metric = ZIP download rate.** Baseline measured at Phase 54 start; ship gate at Phase 58 verifies non-regression.
- **No Pangram fonts.** Free Google Fonts only — Playfair Display, DM Serif Display, Bebas Neue, Archivo Black, Plus Jakarta Sans, Space Grotesk, Manrope.

---

## Traceability

Roadmap approved 2026-05-01. Each requirement maps to exactly one phase.

| Requirement | Phase | Status |
|---|---|---|
| TREAT-01 | Phase 54 | Pending |
| TREAT-02 | Phase 54 | Pending |
| TREAT-03 | Phase 54 | Pending |
| TREAT-04 | Phase 54 | Pending |
| TREAT-05 | Phase 54 | Pending |
| TREAT-06 | Phase 54 | Pending |
| SLOP-01 | Phase 54 | Pending |
| SLOP-02 | Phase 54 | Pending |
| SLOP-03 | Phase 55 | Pending |
| SLOP-04 | Phase 54 | Pending |
| SLOP-05 | Phase 54 | Pending |
| AIROLE-01 | Phase 58 | Pending |
| AIROLE-02 | Phase 58 | Pending |
| AIROLE-03 | Phase 58 | Pending |
| AIROLE-04 | Phase 58 | Pending |
| AIROLE-05 | Phase 58 | Pending |
| TPL-01 | Phase 56 | Pending |
| TPL-02 | Phase 56 | Pending |
| TPL-03 | Phase 56 | Pending |
| TPL-04 | Phase 56 | Pending |
| TPL-05 | Phase 56 | Pending |
| TPL-06 | Phase 56 | Pending |
| TPL-07 | Phase 56 | Pending |
| TPL-08 | Phase 56 | Pending |
| TPL-09 | Phase 56 | Pending |
| TPL-10 | Phase 56 | Pending |
| TYPO-01 | Phase 55 | Pending |
| TYPO-02 | Phase 55 | Pending |
| TYPO-03 | Phase 55 | Pending |
| TYPO-04 | Phase 55 | Pending |
| TYPO-05 | Phase 55 | Pending |
| EDITOR-01 | Phase 57 | Pending |
| EDITOR-02 | Phase 57 | Pending |
| EDITOR-03 | Phase 57 | Pending |
| EDITOR-04 | Phase 57 | Pending |
| PALETTE-01 | Phase 57 | Pending |
| PALETTE-02 | Phase 57 | Pending |
| PALETTE-03 | Phase 57 | Pending |
| PALETTE-04 | Phase 57 | Pending |
| MATCH-01 | Phase 58 | Pending |
| MATCH-02 | Phase 58 | Pending |
| MATCH-03 | Phase 58 | Pending |
| MATCH-04 | Phase 58 | Pending |
| MATCH-05 | Phase 58 | Pending |
| PARITY-01 | Phase 58 | Pending |
| PARITY-02 | Phase 58 | Pending |
| PARITY-03 | Phase 58 | Pending |
| PARITY-04 | Phase 58 | Pending |
| PARITY-05 | Phase 58 | Pending |
| PARITY-06 | Phase 58 | Pending |
| METRIC-01 | Phase 54 | Pending |
| METRIC-02 | Phase 54 | Pending |
| METRIC-03 | Phase 54 | Pending |

**Coverage:** 53 / 53 requirements mapped (100%). No orphans, no duplicates.

### Per-phase summary

| Phase | Requirements |
|---|---|
| Phase 54 — Infrastructure Foundation | TREAT-01..06, SLOP-01, SLOP-02, SLOP-04, SLOP-05, METRIC-01..03 (13) |
| Phase 55 — Schema + Renderer Extensions | TYPO-01..05, SLOP-03 (6) |
| Phase 56 — New Templates + Decorative Library | TPL-01..10 (10) |
| Phase 57 — Editor Controls + Palette Extraction | EDITOR-01..04, PALETTE-01..04 (8) |
| Phase 58 — AI Tightening + Parity QA + match-photos | AIROLE-01..05, MATCH-01..05, PARITY-01..06 (16) |

**Refinements from the original proposed mapping:**
- SLOP-03 (template validator requires non-nullable `bodyFontFamily` on premium templates) moved from "Phase 54 + 58" bucket to **Phase 55**: the validator extension is a natural fit for Phase 55's `validateTemplateRegistry` extension scope, and Phase 55 must enforce `bodyFontFamily` on premium templates anyway (success criterion #5).
- METRIC-01..03 land entirely in **Phase 54** (event tracking, dashboard query, baseline capture). Phase 58's success criterion verifies the post-launch rate against the baseline but does not introduce new METRIC requirements.
- SLOP-01, 02, 04, 05 (Imagen / Pexels / hook-prompt addenda + existing-template audit) all land in **Phase 54** alongside the rest of the infrastructure foundation.

Phase plans will live under `.planning/phases/54/` … `.planning/phases/58/`. After roadmap approval, run `/gsd-discuss-phase 54` (or `/gsd-plan-phase 54` to skip discussion).
