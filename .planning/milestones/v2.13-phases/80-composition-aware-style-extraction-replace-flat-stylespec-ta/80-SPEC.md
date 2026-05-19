# Phase 80: Composition-Aware Style Extraction — Specification

**Created:** 2026-05-14
**Ambiguity score:** 0.152 (gate: ≤ 0.20)
**Requirements:** 12 locked

## Goal

Replace the flat-tag StyleSpec schema (palette mode + font category + hookPosition + density + treatmentPreset + decoration prefs + cadence) with a composition-aware schema that classifies each reference into one of 8 named slide archetypes plus per-archetype typed slot params, so the projector can emit `template_id_override` and the AI generator can faithfully reproduce captioned, collage, and highlight-rhythm layouts the renderer already supports.

## Background

Current state (2026-05-14):
- `StyleSpec` (Phase 74 contract at `src/lib/types/style-spec.ts`) is a flat categorical schema: `palette`, `typography`, `layout.{hookPosition,density}`, `imagery.treatmentPreset`, `decorations`, `rhythm`. Closed-enum + prompt-injection-defense invariants are load-bearing (PARITY-05, two-phase firewall).
- `extractStyleSpec` (Phase 75 at `src/lib/ai/extract-style-spec.ts`) calls Gemini Vision with the closed-enum `STYLE_SPEC_RESPONSE_SCHEMA`. Returns categorical tags only.
- `projectStyleSpecToSlideOverrides` (Phase 77 at `src/lib/ai/style-spec-projector.ts`) projects to existing `SlideStyleOverrides` fields. Never sets `template_id_override`.
- 13 templates exist in `src/lib/render/templates/`. `magazine-bold` and `tr3nding-news` use `backgroundMode: 'image-with-bottom-card'` — the "photo + dark caption block at bottom" composition exists in the renderer today but extraction never routes to it.
- `narrowDecorationAllowlist` falls back to the full 100-icon corpus when extracted `preferredLucide` is empty, causing icons to appear when references have none.
- `style_spec_cache` table holds schema_version=1 entries.

The triggering observation: a Meta-workers reference slide (photo top + solid black caption bar bottom + yellow-highlighted text) produced a `news-drop`-style output (single photo, text floating mid-frame, no caption bar). The schema cannot represent "text in a solid container," so extraction tagged hookPosition='bottom' and lost the structural intent. Same pattern for multi-photo collages, highlight rhythm, and decoration absence.

The renderer is already capable. The extraction schema is the bottleneck.

## Requirements

1. **Archetype enum on StyleSpec**: New closed-enum field classifies slide composition into one of 8 named types.
   - Current: `StyleSpec` has no `slideArchetype` field; composition is implicit in combinations of `hookPosition` + `treatmentPreset` + per-template defaults.
   - Target: `StyleSpec.slideArchetype: 'full-bleed-text-overlay' | 'caption-bar-bottom' | 'caption-bar-top' | 'photo-collage-2up' | 'photo-collage-grid' | 'flat-color-background' | 'editorial-serif' | 'notes-sticker'`. Imported from a single canonical constants module (PARITY-05).
   - Acceptance: TypeScript `StyleSpec` type contains `slideArchetype` field; constants module exposes the 8-value enum; PARITY-05 grep gate passes.

2. **Per-archetype slot params**: Each archetype declares its bounded, closed-enum slot parameters.
   - Current: No slot-param concept exists; layout knobs are flat.
   - Target: Each archetype has a typed slot-param object. Examples: `caption-bar-bottom` exposes `caption.background: 'solid' | 'gradient-dark' | 'translucent'` + `caption.heightFraction: 0.30 | 0.40 | 0.50`. `photo-collage-2up` exposes `split.direction: 'horizontal' | 'vertical'` + `split.ratio: '50-50' | '60-40' | '70-30'`. Slot params outside the archetype's declared set are silent-dropped at Phase B.
   - Acceptance: For each of the 8 archetypes, a test parses an example StyleSpec; slot params outside the archetype's declared set are silent-dropped via the silent-drop counter.

3. **Gemini responseSchema includes archetype**: Phase A vision call asks Gemini to classify composition first, then fill tokens.
   - Current: `STYLE_SPEC_RESPONSE_SCHEMA` has no archetype field; Gemini extracts tags only.
   - Target: `STYLE_SPEC_RESPONSE_SCHEMA` includes `slideArchetype` as a closed-enum property + per-archetype slot params; system prompt directs Gemini to classify composition first. If total enum count exceeds Gemini's branching limit (per Phase 75 inline warning), use `type:STRING` without enum and rely on Phase B validation (mirror existing decoration handling).
   - Acceptance: `extractStyleSpec` on the Meta-workers reference returns spec with `slideArchetype: 'caption-bar-bottom'`; on a single-photo + floating-text reference, returns `slideArchetype: 'full-bleed-text-overlay'`.

4. **schema_version bumps 1→2**: Schema breaks compatibility with v1.
   - Current: `STYLE_SPEC_VERSION: StyleSpecVersion = 1`.
   - Target: `STYLE_SPEC_VERSION = 2`. `parseStyleSpecSafe` rejects schema_version=1 payloads. `StyleSpecVersion` type updated.
   - Acceptance: A schema_version=1 payload passed to `parseStyleSpecSafe` returns `{ ok: false }`.

5. **Cache purge on deploy**: All schema_version=1 cache entries are removed.
   - Current: `style_spec_cache` table contains v1 entries; no purge policy.
   - Target: A Supabase migration file deletes `WHERE schema_version != 2` (or equivalent) on deploy. New extractions repopulate v2 entries.
   - Acceptance: Migration file exists in `supabase/migrations/`; after running on a populated cache, `SELECT COUNT(*) FROM style_spec_cache WHERE schema_version != 2` returns 0.

6. **Projector emits template_id_override based on archetype**: Each archetype maps to exactly one template.
   - Current: `projectStyleSpecToSlideOverrides` emits `derived_palette`, `hook_font_family`, `text_position`, etc., but never sets `template_id_override`.
   - Target: Given a StyleSpec with `slideArchetype`, the projector emits `template_id_override` per a closed mapping. Locked initial map: `caption-bar-bottom → magazine-bold`, `caption-bar-top → tr3nding-news` (or alternate), `full-bleed-text-overlay → news-drop`, `photo-collage-2up → news-drop` (with custom_images), `photo-collage-grid → news-drop` (with custom_images), `flat-color-background → bold-yellow` or `y2k-pop` (palette-driven), `editorial-serif → editorial-serif`, `notes-sticker → notes-app-chic`. Final mapping confirmed in 80-DOCS.md. No tier branching (all templates available to all users).
   - Acceptance: For each of the 8 archetypes, projecting an example StyleSpec produces the expected `style_overrides.template_id_override`.

7. **Decoration defaults fix**: When extraction returns empty `preferredLucide`, no icons are emitted downstream.
   - Current: `narrowDecorationAllowlist` (style-spec-projector.ts:107-110) falls back to the full 100-icon `AI_LUCIDE_ALLOWLIST` when `preferredLucide` is empty, allowing icons to appear when references have none.
   - Target: Empty `preferredLucide` (length 0 OR undefined) → empty narrowed list. The AI generator emits zero `IconDecoration` entries when the narrowed list is empty.
   - Acceptance: Projecting with `spec.decorations.preferredLucide = []` returns `decorations.lucide = []`. End-to-end generation on Meta-workers reference produces zero `IconDecoration` entries on output slides.

8. **AI generation prompt honors archetype + slot params**: `generate-from-style-spec.ts` is updated to consume archetype.
   - Current: Generation prompt uses palette, fonts, hookPosition, density — not archetype.
   - Target: System prompt includes the projected archetype + slot params and directs Gemini to set `text_position`, segment highlights, and `custom_images` count consistent with the archetype.
   - Acceptance: For `caption-bar-bottom` archetype, generated slide has `text_position: 'bottom'` and `template_id_override: 'magazine-bold'`. For `photo-collage-2up`, generated slide has exactly 2 entries in `custom_images`.

9. **Template-to-archetype mapping committed as DOCS**: The mapping is a versioned deliverable.
   - Current: No mapping document exists.
   - Target: `.planning/phases/80-composition-aware-style-extraction-replace-flat-stylespec-ta/80-DOCS.md` contains a table mapping each of the 8 archetypes to its canonical template_id, the slot params declared for that archetype with defaults, and one example reference image (path or short description).
   - Acceptance: File exists; contains exactly 8 archetype rows; each row references a valid template id from `src/lib/render/templates/index.ts`.

10. **Reference-set verification**: Visual fidelity verified against 3–5 curated references.
    - Current: Only Meta-workers and chip-sales screenshots have been compared informally; no curated set.
    - Target: A reference set of 3–5 images is captured under the phase dir (e.g., `80-references/`); VERIFICATION.md lists each reference with its expected archetype and a side-by-side comparison checklist (text container present/absent, photo composition matches, highlights pattern, spurious icons absent, font category correct, palette match).
    - Acceptance: VERIFICATION.md exists with 3–5 reference entries; each entry has expected archetype, actual extracted archetype, and ≥4 pass/fail checks marked.

11. **Closed-enum invariant preserved**: PARITY-05 grep gate continues to pass.
    - Current: PARITY-05 grep gate enforces closed-enum-only on StyleSpec string fields (except `voice_note`).
    - Target: All new fields (archetype, slot params) use closed enums imported from canonical modules. No new free-text fields. `voice_note` retained as the only free-text field (sanitized).
    - Acceptance: PARITY-05 CI grep gate passes on schema_version=2 codebase.

12. **Two-phase firewall preserved**: rawGemini / rawObject source-grep gate continues to pass.
    - Current: `extract-style-spec.test.ts` source-grep gate asserts every `rawGemini` / `rawObject` reference occurs strictly BEFORE the `parseStyleSpecSafe(...)` call line.
    - Target: New extraction code respects this invariant; archetype + slot params flow through Phase B validation; raw Gemini bytes are out of scope post-Phase B.
    - Acceptance: Source-grep firewall test in `extract-style-spec.test.ts` passes on schema_version=2 codebase.

## Boundaries

**In scope:**
- Add `slideArchetype` 8-value closed-enum to `StyleSpec` type
- Add per-archetype typed slot params (closed-enum where strings; numeric where literal)
- Update `STYLE_SPEC_RESPONSE_SCHEMA` (Gemini responseSchema) + system prompt
- Bump `STYLE_SPEC_VERSION` and `StyleSpecVersion` type 1 → 2
- Supabase migration purging schema_version != 2 cache rows
- Update `projectStyleSpecToSlideOverrides` to emit `template_id_override` from archetype
- Fix decoration default (empty `preferredLucide` → empty narrowed list, not full corpus)
- Update `generate-from-style-spec.ts` prompt to consume archetype + slot params
- Commit `80-DOCS.md` archetype→template mapping table
- Curate 3–5 reference set + `80-VERIFICATION.md` with documented expected vs actual archetype

**Out of scope:**
- **Renderer changes** — no wiring of the `bottom-card` overlay slot, no `imageGrid` primitive. Use existing 13 templates as-is. Renderer-side fidelity improvements are a future phase. Reason: ship the schema redesign and routing without renderer risk; existing templates already support the target compositions structurally.
- **Removing `voice_note` free-text field** — keep as Phase 74 contract. Reason: schema-version-bump in this phase is already breaking; removing voice_note compounds the migration without enough payoff pre-PMF.
- **Tier-aware archetype gating** — all 13 templates available to all users; no tier branching in the projector. Reason: project policy (see memory/project_template_tiering.md) — premium-tier.ts is a marker, not a gate.
- **Editing existing templates' visual design** — templates are the routing target, not the deliverable. Reason: schema/extraction is the bottleneck, not template visuals.
- **Adding new templates** — work within the existing 13. Reason: this phase classifies into existing primitives; adding templates is a separate visual-design phase.
- **Backfilling existing v1 cache entries by re-classification** — purge instead. Reason: cache is pre-PMF / small; re-classification heuristics risk mis-categorization and add code complexity.

## Constraints

- Closed-enum invariant (PARITY-05) MUST hold: no new free-text fields except the retained `voice_note`. New enums imported from canonical modules (single source of truth).
- Two-phase firewall MUST hold: `rawGemini` / `rawObject` references only BEFORE `parseStyleSpecSafe(...)` call line. Archetype + slot params flow through Phase B.
- Vision call timeout stays at 10s (`EXTRACTION_TIMEOUT_MS`). Archetype classification cannot extend latency — same call, expanded schema.
- Gemini responseSchema branching limit: if total enum count across `slideArchetype` + slot params exceeds Gemini's documented branching limit (see Phase 75 inline note about the 100-icon allowlist failing the constraint), fall back to `type:STRING` without enum at the Gemini layer and rely on Phase B Zod validation (mirror existing decoration handling).
- Cache migration runs on deploy without read/write coordination — small pre-PMF cache; brief miss window is acceptable.
- All 13 templates remain available to all tiers; projector MUST NOT branch on `subscriptionTier`. Any tier check around template selection that is encountered during this phase should be flagged for separate removal.
- `schema_version` constant change MUST be coordinated with `parseStyleSpecSafe` to reject v1 inputs (no silent coercion).

## Acceptance Criteria

- [ ] `StyleSpec.slideArchetype` field exists with the locked 8-value closed enum
- [ ] Each archetype has a typed slot-param object validated by Zod
- [ ] `STYLE_SPEC_VERSION` constant equals 2; `parseStyleSpecSafe` rejects v1 payloads
- [ ] Supabase migration purging schema_version != 2 rows is committed to `supabase/migrations/`
- [ ] Projector emits `template_id_override` for all 8 archetypes per the locked mapping
- [ ] Meta-workers reference extracts to `slideArchetype: 'caption-bar-bottom'` and routes to `template_id_override: 'magazine-bold'`
- [ ] A floating-text-overlay reference extracts to `slideArchetype: 'full-bleed-text-overlay'`
- [ ] Empty `preferredLucide` → zero `IconDecoration` entries on output slides
- [ ] `generate-from-style-spec.ts` system prompt receives and uses archetype + slot params
- [ ] `80-DOCS.md` mapping committed with 8 rows (archetype, template_id, slot params, example)
- [ ] `80-VERIFICATION.md` lists 3–5 references with expected + actual archetypes and ≥4 pass/fail checks each
- [ ] PARITY-05 grep gate passes on the schema_version=2 codebase
- [ ] Two-phase firewall source-grep gate in `extract-style-spec.test.ts` passes

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                                          |
|--------------------|-------|------|--------|------------------------------------------------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | 8 archetypes locked; schema redesign + projection scope locked                                 |
| Boundary Clarity   | 0.88  | 0.70 | ✓      | Renderer OUT, voice_note OUT, tier-branching OUT (all templates available); explicit in/out    |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Cache purge, schema bump policy, two-phase firewall, closed-enum invariant, tier policy locked |
| Acceptance Criteria| 0.75  | 0.70 | ✓      | 13 pass/fail criteria; reference-set verification methodology committed                        |
| **Ambiguity**      | 0.152 | ≤0.20| ✓      | Gate passed                                                                                    |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective       | Question summary                            | Decision locked                                                              |
|-------|-------------------|---------------------------------------------|------------------------------------------------------------------------------|
| 1     | Researcher        | Lock the 8 proposed archetypes?             | Yes — lock all 8 as drafted                                                  |
| 1     | Boundary Keeper   | Renderer scope?                             | Extractor + projector only; renderer changes OUT                             |
| 1     | Failure Analyst   | Success bar for verification?               | 3–5 named references with expected+actual archetype + visual checklist       |
| 2     | Boundary Keeper   | Cache migration policy?                     | Purge schema_version != 2 entries on deploy                                  |
| 2     | Boundary Keeper   | Tier handling for premium-marked templates? | Moot — all 13 templates available to all tiers (project decision, memory'd)  |
| 2     | Boundary Keeper   | What's explicitly OUT of scope?             | Only voice_note removal OUT; AI prompt update + decoration fix + DOCS = IN   |

---

*Phase: 80-composition-aware-style-extraction-replace-flat-stylespec-ta*
*Spec created: 2026-05-14*
*Next step: /gsd-discuss-phase 80 — implementation decisions (slot-param shapes per archetype, mapping disambiguation, Gemini schema branching workaround, migration mechanics)*
