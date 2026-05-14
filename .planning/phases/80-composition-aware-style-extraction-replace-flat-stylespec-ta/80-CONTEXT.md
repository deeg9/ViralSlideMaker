# Phase 80: Composition-Aware Style Extraction — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the flat-tag StyleSpec (palette mode + font category + hookPosition + density + treatmentPreset + decoration prefs + cadence) with a composition-aware schema that classifies references into one of 8 named slide archetypes plus per-archetype typed slot params. The projector emits `template_id_override` based on archetype; the AI generation prompt consumes archetype + slot params to set `text_position`, segment highlights, and `custom_images` count consistent with the reference's composition.

Touches the schema (Phase 74 contract), the extractor (Phase 75 vision call), the projector (Phase 77 emit boundary), the AI generation prompt (`generate-from-style-spec.ts`), and the `style_spec_cache` table (schema_version bump 1→2 with v1 entries purged).

OUT of scope: any renderer changes (no wiring of the `bottom-card` overlay slot, no `imageGrid` primitive); removing the `voice_note` free-text field; tier-aware archetype gating (all 13 templates available to all users); editing templates; adding new templates; backfilling v1 cache entries (purge-and-repopulate instead).

Success bar: 3–5 curated references classify to their expected archetype (Meta-workers + chip-sales references MUST pass); PARITY-05 closed-enum grep gate and rawGemini/rawObject two-phase firewall gate continue to pass on the schema_version=2 codebase.

</domain>

<decisions>
## Implementation Decisions

### Schema Integration
- `slideArchetype` is sent to Gemini as `type:STRING` (no `enum` in `responseSchema`); Phase B Zod validation enforces the closed 8-value enum at the firewall boundary. Mirrors the existing 100-icon allowlist workaround documented in `src/lib/ai/extract-style-spec.ts:204` (Gemini's responseSchema branching limit). Rationale: as per-archetype slot params multiply, total enum branching could grow; safer to keep Gemini's schema unconstrained on string fields and rely on Phase B (where it's already load-bearing).
- Slot-params are typed as a **discriminated union** keyed on `slideArchetype`. TypeScript shape: `type ArchetypeSlots = { archetype: 'caption-bar-bottom', caption: {...} } | { archetype: 'photo-collage-2up', split: {...} } | ...`. Zod validator uses `z.discriminatedUnion('slideArchetype', [...])` to enforce per-archetype slot validity. Wrong slot params for an archetype → TypeScript error AND Phase B silent-drop.
- Canonical archetype vocabulary + slot-param shapes live in a new module: `src/lib/types/style-spec-archetypes.ts`. The existing `src/lib/types/style-spec.ts` continues to define the top-level `StyleSpec` shape and the version constant; the archetypes module exports the enums + per-archetype slot-param types. Clean PARITY-05 grep gate target.
- `STYLE_SPEC_VERSION` stays in `src/lib/types/style-spec.ts`; bumped 1 → 2 in place. The `StyleSpecVersion` type literal updates to `2`. Single source of truth for version constant.

### Slot Param Value Spaces
- `caption.heightFraction` is an enum of three values: `0.30 | 0.40 | 0.50`. Closed-enum invariant; matches observed reference variance across 3 caption-block sizes. Open numbers explicitly rejected.
- `caption.background` is an enum: `'solid' | 'gradient-dark' | 'translucent'`. Covers magazine-bold (solid card), documentary-style gradient overlays, and translucent caption variants. Extensible later; locked at 3 values for v1.
- `split.ratio` (collage archetypes) is an enum of strings: `'50-50' | '60-40' | '70-30'`. Readable JSON, closed-enum, extensible. Numeric tuples explicitly rejected.
- Archetype and `imagery.treatmentPreset` (B&W / duotone-cream / duotone-cobalt / contrast-bump) are **orthogonal**. A `caption-bar-bottom` slide can independently carry a B&W treatment. The archetype describes composition; the treatment describes the photo filter. They compose per slide.

### Template Mapping
- **`caption-bar-bottom` → `magazine-bold`** (`image-with-bottom-card` backgroundMode is already wired). Caption slot params drive `style_overrides`.
- **`caption-bar-top` → `magazine-bold` + `style_overrides.layout: 'cover'`**. The `cover` layout flag flips image/text order; combined with the bottom-card mode, this lands the card at the top. Verified via templates/magazine-bold.ts layout-switching logic.
- **`full-bleed-text-overlay` → `news-drop`**. Full-bleed photo + floating text — the existing news-drop composition.
- **`photo-collage-2up` → `news-drop`** with `custom_images: [...]` of length 2 emitted by the AI generation prompt (using `split.direction` + `split.ratio` to position). The projector sets `template_id_override='news-drop'`; the slide data carries the collage geometry.
- **`photo-collage-grid` → `news-drop`** with `custom_images: [...]` of length 4 emitted by the AI generation prompt (2x2 grid). Same projector pattern as 2up.
- **`flat-color-background` → palette-driven choice**: dominant yellow (HSL hue ~45–65°) → `bold-yellow`; dominant pink/magenta (~310–350°) → `y2k-pop`; else default `bold-yellow`. Closed switch on `palette.primary` hex. Documented in 80-DOCS.md mapping table.
- **`editorial-serif` → `editorial-serif`** (1:1 — the template already exists with the target composition).
- **`notes-sticker` → `notes-app-chic`** (1:1).
- **Default fallback archetype** when extraction returns no archetype field or schema validation drops it: `full-bleed-text-overlay`. Lowest-risk; renders legibly against any photo; routes to news-drop. The Phase B validator emits a silent-drop counter event when this fallback fires so we can monitor.

### Verification, Fixtures, and Migration Mechanics
- Reference fixtures (3–5 curated reference images) live in `.planning/phases/80-composition-aware-style-extraction-replace-flat-stylespec-ta/fixtures/`. Phase-scoped, accessible to the verifier agent, does not bloat the test bundle. Each fixture has a sibling `.md` with expected archetype + slot params.
- Verification is **both** automated and manual:
  - Automated: integration test (`src/lib/ai/__tests__/composition-aware-extraction.integration.test.ts` or similar) loads each fixture, calls `extractStyleSpec`, asserts the returned `slideArchetype` matches expected.
  - Manual: VERIFICATION.md captures the side-by-side visual comparison checklist (text container present/absent, photo composition matches, highlight rhythm, no spurious icons, palette/font category match).
- Cache migration runs as a Supabase migration file in `supabase/migrations/` (standard repo pattern). Migration SQL: `DELETE FROM style_spec_cache WHERE schema_version != 2;` (or equivalent column name verified against the existing schema). Runs on deploy via the standard `supabase db push` flow; no app-startup coordination needed.
- Verification pass threshold: **3 of 5 references must pass**, with two named MUST-pass references: Meta-workers reference (must classify as `caption-bar-bottom`) and chip-sales reference (must classify as `full-bleed-text-overlay`). The remaining 1–2 of 5 are pass-or-flag; if they fail, capture the failure in VERIFICATION.md for follow-up but it doesn't block phase completion.

### Claude's Discretion
- Exact HSL hue ranges for the `flat-color-background` palette-driven dispatch (currently sketched as yellow ~45–65°, pink ~310–350°) — refine during planning if a deterministic algorithm is cleaner than HSL bucket-matching.
- Exact wording of the Gemini system prompt update for archetype classification — discretion to draft, will be reviewed at code level.
- Whether to consolidate the 3 photo-archetype mappings (`full-bleed-text-overlay`, `photo-collage-2up`, `photo-collage-grid`) into a single `news-drop` route with `custom_images.length` differentiating, OR keep three named mappings in code. Code-level decision.
- Silent-drop counter telemetry field names for archetype-related drops (mirror existing v2.13 silent-drop counter naming convention from `silent-drop-counter.ts`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from prior v2.13 phases)
- `src/lib/types/style-spec.ts` — Phase 74 contract module; extend with `slideArchetype` field and bump `STYLE_SPEC_VERSION`.
- `src/lib/ai/extract-style-spec.ts` — Phase 75 orchestrator with the load-bearing two-phase firewall and `STYLE_SPEC_RESPONSE_SCHEMA`. Schema needs new `slideArchetype` property; system prompt needs an archetype-classification preamble.
- `src/lib/ai/style-spec-projector.ts` — Phase 77 projector; gains a closed map `ARCHETYPE_TO_TEMPLATE` and emits `template_id_override` from `spec.slideArchetype`.
- `src/lib/validators/style-spec.ts` — Phase 74 Zod validator (`parseStyleSpecSafe`); gains `z.discriminatedUnion` for slot-param validation and rejects schema_version=1 payloads.
- `src/lib/validators/silent-drop-counter.ts` — existing counter; new drop events for archetype fallback and slot-param mismatch.
- `src/lib/cache/style-spec-cache.ts` — `lookupStyleSpec`, `persistStyleSpec`; lookup should filter `WHERE schema_version = 2` defensively.
- `src/lib/render/templates/index.ts` — the 13-template registry; mapping target. No template code is modified.
- `src/lib/render/decorations/registry.ts` — `LUCIDE_DECORATION_ALLOWLIST` and `AI_LUCIDE_ALLOWLIST`. The decoration-default fix touches `narrowDecorationAllowlist` in `style-spec-projector.ts:107-110`.
- `src/lib/ai/generate-from-style-spec.ts` — system prompt assembly; gains archetype + slot-param context in the prompt body.

### Established Patterns (mirror exactly)
- Vision-call shape: `src/lib/ai/match-photos-to-slides.ts` — `Promise.race(call, timeout)`, charge-then-refund credit ledger, structured error taxonomy. Already mirrored by `extract-style-spec.ts`.
- Closed-enum import discipline: every string field's allowed values import from a canonical constants module (PARITY-05 grep gate). The new archetype + slot-param enums follow this rule — `style-spec-archetypes.ts` is the single source of truth.
- `responseSchema` workaround for large enums: use `type: Type.STRING` (no enum) at Gemini, validate at Phase B Zod boundary (precedent: `decorations.preferredLucide` in extract-style-spec.ts:204).
- Schema version bump pattern: literal type update + constant bump in `style-spec.ts`; `parseStyleSpecSafe` rejects non-current versions explicitly.
- Cache migration pattern: Supabase migration file in `supabase/migrations/YYYYMMDDHHMMSS_<slug>.sql`. Idempotent SQL.

### Integration Points
- `extract-style-spec.ts` `STYLE_SPEC_RESPONSE_SCHEMA` (lines 134–243) — add `slideArchetype` property + slot-param sub-properties.
- `extract-style-spec.ts` `buildVisionParts` system prompt (line 286) — add archetype-classification preamble (instruct Gemini to classify composition first, then fill slot params).
- `style-spec-projector.ts` `projectStyleSpecToSlideOverrides` (line 133) — add `template_id_override` emission from archetype. Also fix `narrowDecorationAllowlist` (line 107) so empty `preferredLucide` returns empty array, not the full corpus.
- `generate-from-style-spec.ts` system prompt — receive archetype + slot params in the projected style context.
- `supabase/migrations/` — new migration file purging schema_version != 2 rows.
- `src/lib/ai/__tests__/extract-style-spec.test.ts` — source-grep firewall gate (rawGemini/rawObject) MUST continue to pass.
- PARITY-05 grep gate — verify on new archetype/slot enums.

### Project-Level Constraints (from PROJECT.md, STATE.md, REQUIREMENTS.md, prior CONTEXT.md)
- Closed-enum invariant (STYLESPEC-03..09, PARITY-05): no new free-text fields except retained `voice_note`.
- Two-phase firewall (EXTRACT-02): rawGemini/rawObject only before `parseStyleSpecSafe(...)`.
- 10s vision-call timeout (EXTRACT-06): archetype classification stays within the existing single call; no new round-trips.
- `node-vibrant` palette extraction is host-deterministic and unchanged; archetype work does not touch palette logic.
- All 13 templates available to all subscription tiers (project memory `project_template_tiering.md`): projector MUST NOT branch on tier.
- Pre-PMF (memory `project_pmf_status.md`): purge-and-repopulate cache is acceptable; no zero-downtime migration ceremony.
- Cheapest viable AI (memory `feedback_gemini_cost.md`): keep Gemini 2.5 Flash; no model upgrade for archetype classification.

</code_context>

<specifics>
## Specific Ideas

- Meta-workers reference slide (photo-top + solid black caption bar bottom + yellow-highlighted text on body, condensed display font) is the canonical caption-bar-bottom test case. MUST pass.
- Chip-sales reference (US-approves-chip-sales-to-china slide; single full-bleed circuit-board photo + text floating mid-frame) is the canonical full-bleed-text-overlay test case. MUST pass.
- The "unwanted icons" bug observed in current output (icons appearing when the reference has none) traces to `style-spec-projector.ts:107-110` falling back to the full 100-icon allowlist when `preferredLucide` is empty. Fix: empty preferred → empty narrowed list.
- The renderer ALREADY supports `image-with-bottom-card` (magazine-bold, tr3nding-news) — the schema redesign exposes this capability rather than adding it.
- Highlight-rhythm fidelity (multi-word yellow accents in Meta-workers): already supported via `TextSegment.highlightColor + highlightStyle: 'pill'` per word. Generation prompt should be nudged to emit ≥3 highlighted segments for `caption-bar-bottom` references when palette includes a high-saturation accent.

</specifics>

<deferred>
## Deferred Ideas

- Wiring the standalone `bottom-card` overlay slot (`OverlaySlot` enum) into a template directly. Currently used only via `backgroundMode: 'image-with-bottom-card'`. Future renderer-phase work.
- `imageGrid` primitive for cleaner collage layouts (vs. manual `custom_images` positioning). Future renderer-phase work.
- `TextBox.background` field for cleaner caption blocks without `ShapeDecoration` workarounds. Future renderer-phase work.
- Removing the `voice_note` free-text field once archetype classification + slot params cover its inferential role. Future schema-cleanup work.
- Adding new templates that natively model archetypes the current 13 don't cleanly serve. Future visual-design phase.
- Tier-aware archetype expansion (none planned; project policy is all-templates-available).

</deferred>
