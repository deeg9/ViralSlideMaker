# Phase 55 Discussion Log — Schema + Renderer Extensions

**Mode:** `--auto` (Claude-decided defaults; no interactive Q&A)
**Date:** 2026-04-30
**Inputs:** `.planning/research/SUMMARY.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/REQUIREMENTS.md` §TYPO+SLOP, `.planning/ROADMAP.md` §"Phase 55", `.planning/phases/54-infrastructure-foundation/{54-CONTEXT.md, 54-VERIFICATION.md, 54-SUMMARY.md}`, codebase audit (`resolve-overlay.ts`, `templates/index.ts`, `templates/validate.ts`, `slide.ts`, `font-catalog.ts`, the 3 premium templates).

---

## Auto-resolved gray areas

Each gray area resolved using research synthesis + Phase 54 carry-forward signals + codebase audit findings. Decisions locked in CONTEXT.md `<decisions>` (D-01..D-27).

### `photoTreatment` typing — closed string vs. TreatmentPreset re-export
- **Q:** Should `template.photoTreatment` be typed as the full `TreatmentPreset` union from `treat.ts`, or as a closed string of `kind` values?
- **Auto-decision:** Closed string `'bw' | 'duotone-cream' | 'duotone-cobalt' | 'contrast-bump'` (D-02).
- **Reasoning:** Re-exporting `TreatmentPreset` from `treat.ts` would force `templates/index.ts` to import from `photo-treatment/`, and `treat.ts` imports `sharp`. A client-side bundle (slide-preview.tsx imports templates) would pull `sharp` into the browser — Pitfall #5 trigger. Closed string keeps `templates/` client-safe; Phase 56 generation pipeline maps string → `TreatmentPreset` shape inline at the `treatPhoto` call site.

### `vignette` schema — bare number vs. object
- **Q:** Architecture doc proposes `vignette?: number`. Object-wrapped `{ strength: number }` is more extensible. Pick one?
- **Auto-decision:** Object `{ strength: number }` (D-04).
- **Reasoning:** Future-proofing for `vignette.color` / `vignette.center` / `vignette.shape` without schema break. Cost is one extra field access; existing 8 templates leave it undefined → no behavior delta.

### `grainMode` enum — 3-value or 5-value?
- **Q:** Architecture doc proposes `'subtle' | 'medium' | 'strong'`. REQUIREMENTS-paraphrased task uses `'subtle' | 'medium' | 'heavy' | 'paper' | 'xerox'` (matches Phase 56 PNG asset names).
- **Auto-decision:** 5-value enum (D-03).
- **Reasoning:** Phase 56 ships 5 distinct grain PNG assets named `grain-subtle`, `grain-medium`, `grain-heavy`, `paper-texture`, `xerox-grain`. Renaming `'strong'`→`'heavy'` aligns the enum with the asset filename convention so the resolver helper can compute the path string-mechanically (`/textures/grain-${intensity}.png`).

### Grain PNG asset strategy in Phase 55
- **Q:** Should Phase 55 commit placeholder PNG files (1×1 transparent, etc.) so `<img>` requests don't 404, or leave the paths unresolved until Phase 56?
- **Auto-decision:** No placeholders (D-10).
- **Reasoning:** Existing 8 templates leave `grainMode` undefined → `renderGrain` is never invoked at runtime → 404s are not user-visible. Phase 56's first task generates the real PNGs; pre-committing stubs creates merge churn against `scripts/build-textures.ts` output. Helper unit tests validate the JSX shape without actually loading the asset.

### `bodyFontFamily` — required on all templates or premium-only?
- **Q:** REQUIREMENTS.md SLOP-03 says "premium-tier only". Adding to all 8 templates would change behavior on legacy 5 (renderer would split heading vs body).
- **Auto-decision:** Optional on the type; runtime-required on premium-tier via validator (D-07).
- **Reasoning:** Static type stays optional → legacy templates compile without modification. Validator enforces premium-tier contract at module load → SLOP-03 satisfied. Same dual-layer pattern as Phase 44 overlay validation.

### Tr3nding-news Inter font — Phase 54 carry-forward or Phase 55 incidental?
- **Q:** Phase 54 SLOP-05 audit caught only magazine-bold + documentary. Tr3nding-news still has `fontFamily: "'Inter', sans-serif"` (line 17). Does Phase 55 fix this, or is it a separate carry-forward task?
- **Auto-decision:** Phase 55 fixes it as part of the SLOP-03 validator landing (D-23).
- **Reasoning:** Without the swap, the new SLOP-03 validator throws at module load (validator requires non-empty `bodyFontFamily` on tr3nding-news; we add `bodyFontFamily: "'Plus Jakarta Sans'"` AND swap the existing `fontFamily` to match for consistency). Plus, leaving Inter on tr3nding-news but not the other 2 premium templates produces a visually-incoherent "premium tier" — fixing it is a 1-line incidental change.

### `paletteMode` consumer logic in Phase 55?
- **Q:** Phase 57 ships templates that consume `'palette-dominant'`. Phase 55 only adds the field. Should the renderer branch on the field or leave it as a no-op?
- **Auto-decision:** No-op fallback to `'fixed'` behavior in Phase 55 (D-05).
- **Reasoning:** Consumer logic without consumer templates is dead code. Phase 57 wires the branch when `editorial-serif` and `notes-app-chic` exist. Field is "wire-active" (declared, validated by TS) without runtime branching.

### `coverLayout` validator extension?
- **Q:** Should `validateTemplateRegistry` validate the shape of `coverLayout` if a template declares it?
- **Auto-decision:** No (D-06 + Deferred).
- **Reasoning:** TypeScript catches malformed objects at compile time. No template declares `coverLayout` in Phase 55 (Phase 56 `editorial-serif` is the first consumer). Validator extension waits for Phase 56.

### Font catalog — Fontsource install vs. live Google Fonts API
- **Q:** REQUIREMENTS TYPO-01 mentions "registered as static TTF via Fontsource". Current `load-font.ts` fetches from Google Fonts CSS API at render time.
- **Auto-decision:** Catalog entries only in Phase 55; Fontsource installation deferred to Phase 56 (D-14).
- **Reasoning:** The catalog drives the dev font picker UI; render-time font fetching uses the CSS-API trick. Fontsource is only required when a template ships that consumes a new font at render time AND we want the buffer pre-bundled. Phase 56 templates consume Playfair Display / mixed fonts → that's when Fontsource install pays for itself.

### Plus Jakarta Sans Display — separate family or alias?
- **Q:** REQUIREMENTS TYPO-01 lists "Plus Jakarta Sans Display, Plus Jakarta Sans" as if they're separate families.
- **Auto-decision:** Single family — Plus Jakarta Sans IS the display variant on Google Fonts (D-15).
- **Reasoning:** Confirmed via Google Fonts research: there is no separate "Plus Jakarta Sans Display" family. Already in catalog. Net new catalog additions = 4 (Archivo Black, Space Grotesk, Manrope, DM Serif Display).

### Hook-size values — exact px choices within 110-130px
- **Q:** Per-template values for `magazine-bold` / `tr3nding-news` / `documentary`?
- **Auto-decision:** 120 / 120 / 110 (D-18).
- **Reasoning:** magazine-bold + tr3nding-news are sibling premium templates with shared aesthetic (Murphy reference targets large) → 120px middle of range. Documentary is the minimal aesthetic (smaller hook, more breathing room) → 110px lower bound.

### Premium-tier source of truth — new constant or duplicate inline?
- **Q:** Currently `__tests__/render/templates.test.ts:44` inlines `premiumIds = new Set(['magazine-bold', 'tr3nding-news', 'documentary'])`. Add a top-level export, or duplicate in validator?
- **Auto-decision:** Add `PREMIUM_TEMPLATE_IDS` exported constant in `templates/index.ts` (D-21).
- **Reasoning:** Three call sites already need this set (test, validator, `validate-slides.ts:isPremiumTemplate`). Single source of truth + exported constant matches the v2.6 `auth-core.ts` pattern (one place, multiple importers).

### `Slide` schema additions — top-level vs. nested under `style_overrides`
- **Q:** Where do `original_source_url`, `derived_palette`, `treatment_applied`, `template_id_override` live?
- **Auto-decision:** Mixed — top-level for identity-style fields (`original_source_url`, `template_id_override`); nested under `style_overrides` for treatment-derived data (`derived_palette`, `treatment_applied`) (D-08).
- **Reasoning:** Architecture doc + REQUIREMENTS already specify this layout. `style_overrides` is the established home for renderer-affecting per-slide config (Phase 11/12/13/19 precedent). `original_source_url` is identity (which photo this came from) → top-level. `template_id_override` is structural override (which template renders this slide) → top-level.

### Test for byte-identical legacy 5
- **Q:** Snapshot test (`toMatchSnapshot`) vs. JSON-stringify-and-hash fixture?
- **Auto-decision:** Hash-fixture approach for the dedicated regression test (D-26 specifics).
- **Reasoning:** Hash-fixture is more strict (any field reordering or key addition fails) — exactly the contract Phase 55 owes the legacy templates. Existing `premium-templates.test.tsx` snapshot tests cover render-output diffs; the new `legacy-templates-byte-identical.test.tsx` covers SCHEMA OBJECT diffs. Two layers, complementary.

### CSS-filter lint vs. test
- **Q:** Custom ESLint rule, or simple Jest test that reads the file and asserts no `filter:` substring?
- **Auto-decision:** Jest test (D-25).
- **Reasoning:** ESLint rule is more "correct" but adds tooling complexity (custom rule package, configuration). Jest test is 10 lines, runs in the existing test suite, fails fast. v2.10 is the right time to upgrade to a real lint rule.

### Plan count
- **Q:** REQUIREMENTS says "2-3 plans (TBD via /gsd-plan-phase)". Default split?
- **Auto-decision:** 2 plans default; planner may add a 3rd if scope warrants (D-27).
- **Reasoning:** Plan 55-01 = schema + types + validator (compile-time + module-load). Plan 55-02 = resolver helpers + renderer wiring + tests (runtime + parity). The font catalog + hook-size raises are small enough to fold into 55-01 unless the planner sees a cleaner split. Two plans match Phase 54's pattern.

---

## Decisions NOT made (deferred to planner)

- Exact opacity values in `renderGrain` `opacityMap` — D-11 starts with `{ subtle: 0.04, medium: 0.08, heavy: 0.14, paper: 0.18, xerox: 0.22 }`; tunable in Phase 56 once real PNGs exist.
- Whether to refactor `isPremiumTemplate` to consume `PREMIUM_TEMPLATE_IDS` — depends on import-cycle inspection. Default: refactor; if cycle emerges, document and revert.
- Whether to fold Plan 55-03 (font catalog + hook size) into 55-01 vs 55-02 — planner judgment.
- Whether legacy-templates-byte-identical fixture is JSON `__snapshots__/` directory or inline `expect(...).toMatchSnapshot()` — default: inline, matches existing test conventions.

---

## Risks flagged for planner attention

1. **Module-load failure if validator lands before tr3nding-news font swap.** Plan 55-01 task ordering MUST be: (1) interface field addition, (2) tr3nding-news swap, (3) magazine-bold + documentary `bodyFontFamily` addition, (4) validator extension. Any other order produces a runtime crash on first import.
2. **Snapshot diffs from hook-size raises are intentional.** Plan-checker should be told upfront so it doesn't flag the diffs as regression. Plan 55 must explicitly enumerate expected snapshot updates.
3. **Render-time grain PNG 404s in Phase 55** — acceptable because existing 8 templates don't declare `grainMode`. But if a Phase 55 test or dev server somehow invokes `renderGrain('subtle')` directly, the `<img>` will 404. Resolver helper unit tests should validate JSX shape, NOT do a network fetch.
4. **Client-bundle pollution from `treat.ts` import** — guarded by D-02 (closed string typing). If a future maintainer "improves" `photoTreatment` typing by importing `TreatmentPreset` from `treat.ts`, sharp gets pulled into the browser bundle. Document this prominently in CONTEXT.md and the field's JSDoc.
5. **Import cycle risk on `PREMIUM_TEMPLATE_IDS`** — `templates/index.ts` imports validators; if validators import `PREMIUM_TEMPLATE_IDS` from `index.ts`, cycle. Planner must check Node-resolution order and break the cycle if it emerges (move constant to a leaf module like `templates/premium-tier.ts`).

---

*Phase 55 Discussion Log*
*Mode: --auto / 2026-04-30*
