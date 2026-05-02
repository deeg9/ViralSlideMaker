# Phase 55: Schema + Renderer Extensions - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** `--auto` (Claude-decided defaults grounded in v2.9 research synthesis + Phase 54 carry-forward + codebase audit)

<domain>
## Phase Boundary

`SlideTemplate` and `Slide` schemas gain the additive optional fields the new templates will consume. `src/lib/render/resolve-overlay.ts` gains `renderGrain` / `renderVignette` helpers consumed by BOTH renderers. The font catalog expands to add the v2.9 display sans + sharp-modern serif families. `validateTemplateRegistry` is extended to require `bodyFontFamily` on every premium-tier template (SLOP-03). Premium templates' default hook `fontSize` is raised from 88px to a per-template 110-130px (TYPO-03). **Existing 8 templates remain byte-identical at the rendering layer** — schema additions are optional; only premium templates declare the new `bodyFontFamily` field (most already have `fontFamily`, so the addition is a single explicit alias, not a behavior change).

**In scope:**
- `SlideTemplate` schema additions (`grainMode?`, `vignette?`, `photoTreatment?`, `paletteMode?`, per-template `coverLayout?`, `bodyFontFamily` REQUIRED on premium-tier)
- `Slide` schema additions (`original_source_url?`, `style_overrides.derived_palette?`, `style_overrides.treatment_applied?`, `template_id_override?`)
- `renderGrain(intensity)` + `renderVignette(strength)` exported from `resolve-overlay.ts`; consumed by `render-slide-satori.tsx` and `slide-preview.tsx` from the same module
- Font catalog expansion in `src/lib/fonts/font-catalog.ts`: 4-6 new display sans (Bebas Neue [exists] / Archivo Black / Plus Jakarta Sans Display / Plus Jakarta Sans [exists] / Space Grotesk / Manrope) + 2 serifs (Playfair Display [exists] / DM Serif Display) — adding only the missing entries
- Premium template hook `fontSize` raised: magazine-bold 72→120px, tr3nding-news 72→120px, documentary 56→110px (per-template; planner discretion within 110-130px range, lower bound for documentary's minimal aesthetic)
- `validateTemplateRegistry` extension: assert non-empty string `bodyFontFamily` on every premium template (`magazine-bold`, `tr3nding-news`, `documentary`)
- `tr3nding-news.ts` font fix: still on `'Inter'` per Phase 54 partial scope; Phase 55 swaps to `'Plus Jakarta Sans'` to align with magazine-bold + documentary AND satisfy the new validator
- Lint-friendly assertion in tests: scan `resolve-overlay.ts` + new render layers for `filter:` properties (grayscale/blur/etc.) and fail if found
- Snapshot/regression test on at least 2 representative templates to prove byte-identical output post-schema-addition

**Out of scope (deferred to later phases):**
- New `editorial-serif`, `notes-app-chic`, `brutalist-grid` templates (Phase 56)
- Grain PNG asset generation (Phase 56) — Phase 55 ships placeholder paths, no committed PNG required
- Decorative overlay asset library (Phase 56)
- Per-segment `fontFamily?` on `TextSegment` (Phase 56 — only required for `notes-app-chic` ransom-note hooks)
- `npm run thumbs` extension for new templates (Phase 56)
- Editor UI for treatment overrides + photo-treatment-controls panel (Phase 57)
- `@vibrant/node` named-role palette extraction (Phase 57 — Phase 54 ships `sharp.stats()` derived palette)
- `paletteMode: 'palette-dominant'` consumer wiring in renderers (Phase 57 when palette-aware templates ship)
- Slide-role-aware AI generation + `match-photos-to-slides.ts` premium gating (Phase 58)
- Parity test harness (`render-parity-grid.ts`) — Phase 58
- Generation-pipeline integration of `treatPhoto()` outputs into `slide.background_url` (Phase 56 per Phase 54 carry-forward)

</domain>

<decisions>
## Implementation Decisions

### Schema additions — types layer

- **D-01: `SlideTemplate` field additions land in `src/lib/render/templates/index.ts`** (the canonical `SlideTemplate` interface). All schema-additive fields are optional EXCEPT `bodyFontFamily`, which is OPTIONAL on the type but REQUIRED on premium-tier templates by the runtime validator (SLOP-03). Rationale: keeping it optional on the static type avoids breaking the 5 legacy templates' compile-time shape. The validator enforces the contract for premium-tier at module load — same pattern as Phase 44 overlay validation.

- **D-02: `photoTreatment` field uses a closed-string union, NOT a re-export of `TreatmentPreset` from `treat.ts`.** Type signature:
  ```ts
  photoTreatment?: 'bw' | 'duotone-cream' | 'duotone-cobalt' | 'contrast-bump'
  ```
  Reasoning: importing `TreatmentPreset` from `src/lib/photo-treatment/treat.ts` into `templates/index.ts` would pull `sharp` into the client bundle (Vercel #1 Pitfall trigger). Phase 56 generation pipeline maps `template.photoTreatment` string → `TreatmentPreset` shape inline before calling `treatPhoto`. Closed enum = parity with `TreatmentPreset['kind']`; defaults (contrast / intensity) are spec-default at the call site.

- **D-03: `grainMode` accepts the 5 values matching the Phase 56 grain PNG set:** `'subtle' | 'medium' | 'heavy' | 'paper' | 'xerox'`. Architecture doc proposed `'subtle' | 'medium' | 'strong'`; we widen to 5 because Phase 56 ships 5 distinct grain PNG assets (`grain-subtle.png`, `grain-medium.png`, `grain-heavy.png`, `paper-texture.png`, `xerox-grain.png`) and renaming `'strong'`→`'heavy'` aligns the enum with the asset filename convention. Existing 8 templates leave it undefined.

- **D-04: `vignette` is an object `{ strength: number }`, not a bare number.** Architecture doc proposed `vignette?: number`. Object wrapping is more extensible (future fields: `vignette.color`, `vignette.center`, `vignette.shape`) without a schema break. Cost: 1 additional field access per render call. `strength` is 0-1 normalized; renderer maps to opacity. Existing 8 templates leave it undefined.

- **D-05: `paletteMode` is a closed enum `'fixed' | 'palette-dominant'`.** When undefined, behavior is `'fixed'` (template `accentColor` wins). `'palette-dominant'` consumer logic ships in Phase 57 (`editorial-serif` and `notes-app-chic` templates that consume derived palette). Phase 55 only adds the field; renderers do not branch on it yet (or branch with a no-op fallback to `'fixed'` so the field is wire-active without behavior change).

- **D-06: `coverLayout?` is per-template, distinct from default `innerLayout`.** Type signature locked as a structural alias of the existing layout primitives — first-slide variant of `textPosition`/`textAlign`/`hookFontSize`. Concrete shape:
  ```ts
  coverLayout?: {
    textPosition?: 'top' | 'center' | 'bottom'
    textAlign?: 'left' | 'center' | 'right'
    hookFontSize?: string
    hookStyle?: 'uppercase' | 'normal' | 'italic'
  }
  ```
  Renderer applies `coverLayout` overrides ONLY when `slideIndex === 0` (the cover slide). Existing 8 templates leave it undefined → cover slide uses default layout (zero behavior change).

- **D-07: `bodyFontFamily: string` is added to `SlideTemplate`** as OPTIONAL on the type. Validator enforces non-empty string on the 3 premium templates. Legacy 5 templates leave it undefined. Rationale: legacy 5 templates have a single `fontFamily` field that already covers body usage; adding `bodyFontFamily` to all 8 would change rendering behavior on the 5 legacy paths (renderer would pick `bodyFontFamily` over `fontFamily` for body slot). Premium templates already have a separate `headingFontFamily`, so adding `bodyFontFamily` is the natural symmetric pair.

### `Slide` schema additions

- **D-08: All `Slide` additions are optional and land in `src/lib/types/slide.ts`.** No required field migrations.
  - `original_source_url?: string` on `Slide` — populated at generation time in Phase 56 (Phase 55 only adds the field; nothing reads/writes it yet beyond the type).
  - `style_overrides.derived_palette?: string[]` — array of hex strings (`['#A8E0B0', '#001a2c', ...]`). Phase 56 generation pipeline writes from `treatPhoto` palette output; Phase 57 templates consume.
  - `style_overrides.treatment_applied?: string` — the SHA-256 cache-key suffix or preset descriptor; lets the editor know what treatment is currently baked. Phase 57 surfaces this in the right-rail.
  - `template_id_override?: string` — closed enum at runtime via `validateAndRepair` (Phase 58 wires AI to populate this; Phase 55 only adds the field). When unset, project template wins.

### Resolver helpers (TPLREND-05 parity invariant)

- **D-09: `renderGrain` and `renderVignette` exported from `src/lib/render/resolve-overlay.ts`.** Both renderers (`render-slide-satori.tsx` server, `slide-preview.tsx` client) import the same exported helpers. Verified via test: grep both renderer files for `renderGrain` / `renderVignette` and assert the import path is `@/lib/render/resolve-overlay` (or `./resolve-overlay`).

- **D-10: `renderGrain(intensity)` returns `<img>` element pointing to placeholder paths in Phase 55.** The actual PNG assets ship in Phase 56. For Phase 55, the strategy is:
  - Path format: `/textures/grain-${intensity}.png` (resolves to `public/textures/grain-${intensity}.png` at runtime).
  - **No placeholder PNGs committed in Phase 55** (don't pre-create empty/stub assets — they'd get force-overwritten by Phase 56 `scripts/build-textures.ts` and pollute the diff). Instead, the helper renders an `<img>` with the future path; in Phase 55 these requests return 404, but no template declares `grainMode` yet, so the helper is never invoked at runtime.
  - Tests validate the helper signature, opacity-map output, and DOM shape without actually loading the PNG (test imports the helper, asserts return-value structure).
  - Phase 56's first task is `scripts/build-textures.ts` → commits the 5 PNGs → Phase 55 helper paths resolve correctly without any code change.

- **D-11: `renderGrain` opacity map locked:** `{ subtle: 0.04, medium: 0.08, heavy: 0.14, paper: 0.18, xerox: 0.22 }`. Numerical values are tunable in Phase 56 once real PNGs exist; structure is locked in Phase 55.

- **D-12: `renderVignette(strength: number)` returns a `<div>` with inline `backgroundImage: radial-gradient(...)`.** No CSS filter, no backdrop-filter, no mix-blend-mode (Pitfall #2 — Satori silently drops these). Pure radial-gradient is supported in BOTH Satori and React DOM. Strength 0-1 maps to the alpha channel of the outer `rgba(0,0,0,${strength})`. Inner stop at 40% transparent, outer at 100%.

- **D-13: Helpers are ABSOLUTELY POSITIONED full-canvas (`top: 0 left: 0 w: 1080 h: 1920`).** The DOM/JSX z-order across both renderers MUST be: photo background → grain (1.5) → overlay color (2) → vignette (2.5) → hook/body text (3) → overlays (4). Phase 55 documents the layer order in `resolve-overlay.ts` head comment so Phase 56 templates know where their effects sit. Existing 8 templates do not declare grain/vignette → layers 1.5/2.5 are absent → no behavior change.

### Font catalog expansion (TYPO-01, TYPO-02, TYPO-04)

- **D-14: Font catalog additions are entries-only in `src/lib/fonts/font-catalog.ts`.** No Fontsource install required for the catalog itself — current `load-font.ts` fetches via Google Fonts CSS API at render time (TTF transcoded via User-Agent trick). The catalog only registers which families + variants exist for the dev font picker UI. **Fontsource installation is deferred to Phase 56** when a template actually consumes one of the new fonts at render time and needs the buffer pre-bundled.

- **D-15: Catalog audit reveals already-present families:** `Plus Jakarta Sans` (line 163), `Playfair Display` (line 178), `Bebas Neue` (line 243). **Net additions are: `Archivo Black`, `Space Grotesk`, `Manrope`, `DM Serif Display`** (4 new entries). `Plus Jakarta Sans Display` is NOT a real Google Font family — Plus Jakarta Sans IS the display variant — so it's elided from the additions list. The REQUIREMENTS.md TYPO-01 line "Plus Jakarta Sans Display, Plus Jakarta Sans" is treated as a single family.

- **D-16: All new entries use static-weight TTF variants.** No variable-axis `wght@100..900` entries. Per TYPO-04 + Pitfall #2 (Satori #162/#712 unresolved). Each new entry lists the static weights Google Fonts publishes for that family — researched per-family and committed as locked variant arrays.

- **D-17: No Pangram / paid font entries (TYPO-05).** Font catalog stays free Google Fonts only.

### Hook-size raise (TYPO-03)

- **D-18: Per-template hook size raise — values locked:**
  - `magazine-bold`: `hookFontSize: '72px'` → `'120px'` (1.67× — Murphy reference targets large)
  - `tr3nding-news`: `hookFontSize: '72px'` → `'120px'` (sibling cohesion with magazine-bold)
  - `documentary`: `hookFontSize: '56px'` → `'110px'` (lower bound — minimal aesthetic; smallest of the three)
  - Legacy 5 templates: UNCHANGED
- **D-19: Raised sizes pass through the existing `news-hook-fit.ts` auto-shrink path** for hook-text overflow (8-word hooks at 120px on 1080px canvas leave headroom; 12-word hooks auto-shrink). No changes to `news-hook-fit.ts` logic. Snapshot tests update accordingly.

### Template validator extension (SLOP-03)

- **D-20: `validateTemplateRegistry` extension lives in `src/lib/render/templates/validate.ts`.** New top-level loop (or addition to existing per-template loop) that checks: if `template.id` is in the premium-set `{magazine-bold, tr3nding-news, documentary}`, then `typeof template.bodyFontFamily === 'string' && template.bodyFontFamily.length > 0` MUST hold; otherwise throw the standard `[template-registry]` error.
- **D-21: Premium-set source of truth.** Add a new exported constant `PREMIUM_TEMPLATE_IDS = ['magazine-bold', 'tr3nding-news', 'documentary']` in `templates/index.ts`. Mirror the same set referenced in `__tests__/render/templates.test.ts:44` (currently inline). The new constant is consumed by both `validateTemplateRegistry` (Phase 55) and existing test files (refactor opt-in, not required).
- **D-22: All 3 premium templates explicitly declare `bodyFontFamily`** in their template files:
  - `magazine-bold.ts`: `bodyFontFamily: "'Plus Jakarta Sans', sans-serif"` (alias of existing `fontFamily`)
  - `tr3nding-news.ts`: `bodyFontFamily: "'Plus Jakarta Sans', sans-serif"` AND `fontFamily` swapped from `'Inter'` to `'Plus Jakarta Sans'` (carry-forward of incomplete Phase 54 scope — Phase 54 only updated magazine-bold + documentary)
  - `documentary.ts`: `bodyFontFamily: "'Plus Jakarta Sans', sans-serif"` (alias of existing `fontFamily`)

### Tr3nding-news font carry-forward

- **D-23: Tr3nding-news `'Inter'` → `'Plus Jakarta Sans'` swap.** Phase 54 verification audit caught only magazine-bold + documentary. Tr3nding-news is also premium-tier and currently has `fontFamily: "'Inter', sans-serif"` (line 17). Phase 55 fixes this AS PART OF the SLOP-03 validator landing — without the swap, the new validator would throw at module load on `tr3nding-news` (since the validator requires non-Inter `bodyFontFamily`, but more importantly tr3nding-news as the only remaining Inter premium template would silently fail SLOP-03 / SLOP-05 contract). Update accompanying snapshot in `premium-templates.test.tsx` if it asserts on `'Inter'`.

### CSS filter ban (PARITY-04 carry-forward)

- **D-24: CSS filter properties (`filter: grayscale(...)`, `filter: blur(...)`, `filter: hue-rotate(...)`, etc.) banned in any new render layer.** Server-side sharp pre-bake from Phase 54 is the only path for photo treatment.
- **D-25: Lint-friendly test assertion** lives at `src/lib/render/__tests__/no-css-filter.test.ts` (NEW). Reads `resolve-overlay.ts` via Node `fs.readFile`, asserts no `filter:` substring (with negative-lookbehind for `backdrop-filter:` which doesn't apply here). Same test scans the new `renderGrain` / `renderVignette` helper bodies. Phase 58 extends this to scan templates and parity test files.

### Existing-templates byte-identical guarantee

- **D-26: Snapshot regression on representative templates.** `premium-templates.test.tsx` already snapshots `magazine-bold`, `tr3nding-news`, `documentary`. Phase 55 plan must:
  1. Run existing snapshots and confirm they capture the pre-Phase-55 output.
  2. Apply Phase 55 changes (font catalog additions, validator extension, hook-size bumps, tr3nding-news font swap, premium template `bodyFontFamily` additions).
  3. **EXPECTED snapshot diffs:** hook-size on premium templates (intentional per TYPO-03), tr3nding-news font (`Inter` → `Plus Jakarta Sans`).
  4. **PROHIBITED snapshot diffs:** any change on legacy 5 templates (`highlight-bar`, `news-drop`, `news-cyan`, `y2k-pop`, `bold-yellow`).
  5. Add a new test file `src/__tests__/render/legacy-templates-byte-identical.test.tsx` that snapshots all 5 legacy templates AGAINST the pre-Phase-55 output (commit a known-good fixture, then assert match post-changes).

### Plan structure (rough — gsd-planner refines)

- **D-27:** Phase 55 splits into ~2-3 plans:
  - **Plan 55-01: Schema + types layer.** `SlideTemplate` field additions (`grainMode`, `vignette`, `photoTreatment`, `paletteMode`, `coverLayout`, `bodyFontFamily`); `Slide` schema additions (`original_source_url`, `style_overrides.derived_palette`, `style_overrides.treatment_applied`, `template_id_override`); `PREMIUM_TEMPLATE_IDS` constant; `validateTemplateRegistry` extension for `bodyFontFamily`; tr3nding-news font swap + 3 premium templates `bodyFontFamily` declarations; legacy-templates-byte-identical regression test. *(Wave 1)*
  - **Plan 55-02: Resolver helpers + renderer wiring.** `renderGrain` + `renderVignette` exports from `resolve-overlay.ts`; both renderers wired (consume from same module via existing pattern); CSS-filter no-use lint test; resolver helper unit tests; layer-order documentation comment. *(Wave 2, depends on 55-01)*
  - **Plan 55-03 (optional, planner discretion):** Font catalog expansion (4 new entries) + premium hook size raises (`magazine-bold`/`tr3nding-news`/`documentary` `hookFontSize`) + snapshot updates. Could merge into 55-01 or 55-02 if planner judges scope is small. *(Wave 3 if separate)*

### Claude's Discretion

- Exact 0-1 strength values for `renderVignette` test inputs (planner picks 0.3 / 0.5 / 0.7 representative samples)
- Exact opacity values in the grain `opacityMap` (D-11 starting values can be tuned during code review if Phase 56 templates produce visually-wrong results)
- Whether to fold Plan 55-03 into 55-01 or 55-02
- Whether the legacy-templates byte-identical fixture is committed as JSON snapshots (`__snapshots__/`) or as inline `expect(...).toMatchSnapshot()` calls. Default: inline `toMatchSnapshot` (matches existing test conventions at `premium-templates.test.tsx`)
- Whether to also extend `validateTemplateRegistry` to validate `coverLayout` shape (only required if a Phase 55 template starts using it — none do; defer to Phase 56's `editorial-serif` plan)
- Whether to refactor `validate-slides.ts:isPremiumTemplate` to import the new `PREMIUM_TEMPLATE_IDS` constant. Default: refactor for DRY; if it changes test snapshots unexpectedly, revert and document.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (this milestone)
- `.planning/research/SUMMARY.md` §"Phase 55 — Schema + Renderer Extensions" + §"Top 3 Anti-Patterns to Actively Avoid" (#3: Skipping resolve-overlay for "just one layer")
- `.planning/research/ARCHITECTURE.md` §"Pattern 2: New Layers Land in resolve-overlay.ts, Not in Renderers" + §"Pattern 3: Schema-Additive Template Extensions"
- `.planning/research/PITFALLS.md` Pitfall #2 (Satori silent-ignore on filters), Pitfall #5 (sharp memory — caller-side; Phase 55 does NOT import sharp into client modules)

### Requirements
- `.planning/REQUIREMENTS.md` §TYPO-01..05 + §SLOP-03 — Phase 55 requirement specifications
- `.planning/ROADMAP.md` §"Phase 55: Schema + Renderer Extensions" — goal + 5 success criteria + dependency on Phase 54

### Prior phase carry-forward
- `.planning/phases/54-infrastructure-foundation/54-CONTEXT.md` D-08 (defer `original_source_url` to Phase 55), D-13/D-14 (Inter→Plus Jakarta swap on magazine-bold + documentary; tr3nding-news NOT covered → Phase 55 carry-forward via D-23 above)
- `.planning/phases/54-infrastructure-foundation/54-VERIFICATION.md` (PASSED 2026-04-30; SLOP-05 covered 2 of 3 premium templates)
- `.planning/phases/54-infrastructure-foundation/54-SUMMARY.md` — what Phase 54 actually shipped

### Existing infrastructure (extend, do not duplicate)
- `src/lib/render/resolve-overlay.ts` — TPLREND-05 parity-critical resolver. Add `renderGrain` + `renderVignette` exports here. Existing functions (`resolveOverlayContent`, `renderSegments`, `pickContrastColor`, `bottomCardBackground`, `SLOT_GEOMETRY`, `CANVAS`) remain untouched.
- `src/lib/render/render-slide-satori.tsx` — server PNG export renderer. Imports from `resolve-overlay`. Phase 55 adds 2 new helper invocations conditional on `template.grainMode` / `template.vignette` truthiness.
- `src/components/slides/slide-preview.tsx` — React DOM preview renderer. Imports from `resolve-overlay`. Same conditional invocations as Satori.
- `src/lib/render/templates/index.ts` — `SlideTemplate` interface + registry + `validateTemplateRegistry` top-level call site. Phase 55 extends interface + adds `PREMIUM_TEMPLATE_IDS` export.
- `src/lib/render/templates/validate.ts` — Phase 44 validator. Phase 55 extends with `bodyFontFamily` premium-tier check.
- `src/lib/render/templates/magazine-bold.ts`, `tr3nding-news.ts`, `documentary.ts` — premium templates. Phase 55 adds `bodyFontFamily` to all three; swaps `tr3nding-news` font from Inter to Plus Jakarta Sans; raises hook sizes.
- `src/lib/types/slide.ts` — `Slide` + `SlideStyleOverrides` interfaces. Phase 55 adds 4 optional fields.
- `src/lib/fonts/font-catalog.ts` — font picker catalog. Phase 55 adds 4 new family entries (Archivo Black, Space Grotesk, Manrope, DM Serif Display).
- `src/lib/ai/validate-slides.ts:isPremiumTemplate` — premium-tier predicate. Phase 55 may refactor to consume `PREMIUM_TEMPLATE_IDS` (D-27 discretion).

### Existing tests (extend or reuse — do not break)
- `src/__tests__/render/premium-templates.test.tsx` — premium template snapshots. Phase 55 may produce expected diffs (hook size, tr3nding-news font) — update snapshots intentionally.
- `src/__tests__/render/templates.test.ts` — registry-shape validation. Currently inlines `premiumIds = new Set(['magazine-bold', 'tr3nding-news', 'documentary'])`. Phase 55 may refactor to consume `PREMIUM_TEMPLATE_IDS`.
- `src/lib/render/resolve-overlay.test.ts` — existing resolver tests. Phase 55 adds `renderGrain` + `renderVignette` test cases.
- `src/__tests__/render/templates.test.ts` validate.test.ts — registry validation tests. Phase 55 adds tests for the new `bodyFontFamily` premium-tier rule (positive: passes when present; negative: fails when missing on a premium template; neutral: passes when missing on legacy).

### External
- [vercel/satori#162](https://github.com/vercel/satori/issues/162) — variable-fonts unresolved (TYPO-04 justification)
- [vercel/satori#712](https://github.com/vercel/satori/issues/712) — variable-fonts unresolved (TYPO-04 justification)
- [vercel/satori#573](https://github.com/vercel/satori/issues/573) — CSS filter silent-drop (PARITY-04 + D-24 justification)
- Google Fonts API — variant lists for Archivo Black, Space Grotesk, Manrope, DM Serif Display

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/render/resolve-overlay.ts`** — already exports 5 helpers consumed by both renderers. Phase 55 follows the established pattern (export from this module, import in both renderers).
- **`React.createElement` JSX-free pattern** — `resolve-overlay.ts` lives at `.ts` (not `.tsx`) and uses `React.createElement` directly. Phase 55 helpers MUST follow the same pattern to keep the resolver tier-neutral.
- **`SlideTemplate` interface optional-field convention** — Phase 44/45/46 added 6 optional fields (`headingFontFamily`, `accentColor`, `sample`, `overlays`, `backgroundMode`, `aiVoiceNote`). Phase 55 follows the same shape: optional fields, JSDoc explaining when they're consumed.
- **`validateTemplateRegistry` per-template loop** — Phase 44's validator already iterates the registry once. Phase 55 adds one more check inside the existing loop (no second-pass scan needed).
- **Font catalog entry pattern** — Plus Jakarta Sans / Playfair Display / Bebas Neue are already registered. Phase 55 follows the exact same shape: `{ family, category, variants: [{ weight, style }, ...] }`.

### Established Patterns
- **Single shared resolver → multi-site import** — `renderSegments`, `resolveOverlayContent`, `bottomCardBackground` already follow this. Phase 55's `renderGrain`/`renderVignette` are textbook applications.
- **Schema-additive optional-field migrations** — Phase 11/12/13/19 of v2.x repeatedly extended `SlideStyleOverrides` with optional fields. Phase 55's 3 additions match the precedent (`derived_palette`, `treatment_applied`, plus a top-level `original_source_url` and `template_id_override`).
- **Closed-enum runtime validation** — `validateAndRepair` (Phase 28+) drops invalid enum values rather than throw. Phase 55 should follow this pattern for `template_id_override` (Phase 58 wires it; Phase 55 only adds field).
- **Premium-tier gating via predicate function** — `isPremiumTemplate(templateId)` is the canonical way to fork behavior. Phase 55's validator extension uses the same logic (could even import the predicate, though circular-import risk between `validate.ts` ↔ `validate-slides.ts` may force inlining).

### Integration Points
- **`SlideTemplate` interface** at `src/lib/render/templates/index.ts:42-81`. Phase 55 adds 6 fields after `aiVoiceNote` (line 80).
- **`validateTemplateRegistry`** at `src/lib/render/templates/validate.ts:53`. Phase 55 adds a `bodyFontFamily` check inside the existing for-loop, before the overlay validation.
- **`Slide` interface** at `src/lib/types/slide.ts:130-149`. Phase 55 adds `original_source_url?` and `template_id_override?` after `text_boxes?` (line 148). `SlideStyleOverrides` (line 99) gets `derived_palette?` and `treatment_applied?` additions.
- **Font picker UI** consumes `FONT_CATALOG` via `getFontEntry()` and the picker render lists. New entries appear automatically in the picker without any UI code change.
- **Renderer DOM stack** — `slide-preview.tsx` renders layers in DOM order (top-of-file = back layer; bottom = front). Phase 55 inserts grain at layer 1.5 (above photo, below overlay), vignette at 2.5 (above overlay, below text). Both renderers must agree on insertion point.

### Don't Touch
- The 5 legacy templates (`highlight-bar`, `news-drop`, `news-cyan`, `y2k-pop`, `bold-yellow`) — Phase 55 schema additions are optional; legacy templates leave them undefined; render output MUST be byte-identical pre/post Phase 55.
- The 9-layer DOM stack ordering on existing rendered output — Phase 55 inserts new optional layers, but they're absent unless the template opts in.
- `news-hook-fit.ts` — auto-shrink logic for hook overflow; works correctly with new 110-130px sizes.
- Phase 49 `text_boxes[]` unified text-box model — Phase 55 doesn't touch the unified pipeline; just adds adjacent fields.
- Generation pipeline integration of `treatPhoto()` outputs — Phase 56 wires this; Phase 55 only declares the schema slot.
- Editor UI right-rail / `SlideSettings` — Phase 57.

</code_context>

<specifics>
## Specific Ideas

- **Schema-addition ordering:** add fields in `SlideTemplate` interface in this order so JSDoc tells the v2.9 story: `bodyFontFamily` first (premium-required), then `coverLayout` (per-template variant), then `grainMode` / `vignette` (visual layers), then `photoTreatment` / `paletteMode` (data-pipeline declarations). Each field's JSDoc cites its requirement ID (TYPO-01, SLOP-03, etc.).
- **Test target = byte-identical legacy 5.** Plan 55-01 must produce a regression test that survives even if the planner re-orders schema fields. The test reads each legacy template's serialized object via `JSON.stringify(template)`, hashes it, and asserts the hash matches a committed fixture. (Test commits a `legacy-template-hashes.json` fixture; Phase 55's last task updates the fixture if any non-additive changes are intentional — none should be.)
- **Validator failure surface:** the `[template-registry]` error format already exists. New error string for SLOP-03: `[template-registry] Template '${id}' is premium-tier but missing required 'bodyFontFamily' field`. Test asserts the exact string (close-coupled, but matches Phase 44 convention).
- **Tr3nding-news fix is non-negotiable.** Without it, the SLOP-03 validator throws at module load on every dev/build/prod start, rendering the app unrunnable. Phase 55 plan 55-01 MUST sequence: (1) add bodyFontFamily field to interface (compile-time only, no runtime change), (2) update tr3nding-news.ts (change Inter → Plus Jakarta Sans, add bodyFontFamily), (3) update magazine-bold + documentary (add bodyFontFamily declaration), (4) extend validator (now passes because all 3 premium templates have the field). Out-of-order causes module-load failure.
- **Font catalog audit data:** Archivo Black is single-weight 400 only on Google Fonts; Space Grotesk has weights 300/400/500/600/700; Manrope has weights 200-800; DM Serif Display has only 400 normal + 400 italic. The planner should research-confirm these on the live Google Fonts API before committing the variants array. Wrong variant lists cause `load-font.ts` to 404 at render time.
- **Hook-size raises are intentional snapshot diffs.** Plan 55-01 (or 55-03) must explicitly call out the snapshot update in the plan-checker output as expected, not as a regression.

</specifics>

<deferred>
## Deferred Ideas

- **Per-segment `fontFamily?` on `TextSegment`** — required only by Phase 56's `notes-app-chic` ransom-note hooks. Adding it in Phase 55 is dead schema until Phase 56 ships. Defer.
- **Asset PNG pre-creation** — Phase 56 ships `scripts/build-textures.ts` which generates the 5 grain PNGs deterministically. Pre-committing empty/stub PNGs in Phase 55 creates merge churn and breaks the "one source of truth = scripts/build-textures.ts" pattern.
- **`paletteMode: 'palette-dominant'` consumer logic** — Phase 57 ships `editorial-serif` and `notes-app-chic` templates that consume derived palettes. Phase 55 only adds the field; renderer branching is Phase 57.
- **Variable fonts** — Satori #162/#712 unresolved. Permanent defer until upstream fixes.
- **`@vibrant/node` named-role palette** — Phase 57. Phase 54 ships `sharp.stats()` palette; Phase 55 stores it as `string[]` (hex array); Phase 57 swaps the extraction implementation without changing the schema shape.
- **Pangram fonts** — paid licenses; defer until paying-user revenue exists. Per TYPO-05.
- **Lint rule (vs. test) for CSS-filter ban** — could become a custom ESLint rule in v2.10. For Phase 55, a single Jest test asserting no `filter:` in `resolve-overlay.ts` + new helpers is sufficient.
- **`coverLayout` validator** — only valuable when a template starts declaring it. Phase 56 `editorial-serif` is the first consumer. Phase 55's `validateTemplateRegistry` does not validate `coverLayout` shape (TypeScript catches malformed objects at compile time anyway).
- **Refactor of `isPremiumTemplate` to import `PREMIUM_TEMPLATE_IDS`** — DRY win, but introduces an import cycle risk between `templates/` and `ai/`. Defer if the planner discovers a cycle; otherwise opportunistic refactor.

</deferred>

---

*Phase: 55-Schema-Renderer-Extensions*
*Context gathered: 2026-04-30*
