---
phase: 80-composition-aware-style-extraction-replace-flat-stylespec-ta
plan: 04
subsystem: projector
tags: [v2.13, phase-80, projector, template-id-override, decoration-default-fix, archetype-routing]
requires:
  - "Plan 80-01 (src/lib/types/style-spec-archetypes.ts — SLIDE_ARCHETYPES, SlideArchetype, DEFAULT_FALLBACK_ARCHETYPE)"
  - "Plan 80-02 (src/lib/validators/style-spec.ts — validator resolves spec.slideArchetype + archetype_fallback counter event)"
  - "Phase 77 projector baseline (src/lib/ai/style-spec-projector.ts — purity contract, narrowDecorationAllowlist, projectStyleSpecToSlideOverrides)"
  - "Phase 55 D-08 Slide.template_id_override slot (slide.ts:275 — renderer reads from Slide top-level)"
  - "Phase 80 R6 locked ARCHETYPE_TO_TEMPLATE mapping (80-CONTEXT.md §Template Mapping)"
provides:
  - "ARCHETYPE_TO_TEMPLATE map + pickFlatColorTemplate palette-driven dispatch for all 8 archetypes (R6)"
  - "narrowDecorationAllowlist Phase 80 R7 fix: empty/undefined preferred* → empty narrowed list (was full corpus)"
  - "ProjectedSlideOverrides Pick<> widened to include template_id_override + layout"
  - "SlideStyleOverrides.template_id_override slot — projector routing carrier; lifted to Slide.template_id_override by consumer (deviation from plan grounding)"
  - "PROJECTOR FUSION lift in generate-from-style-spec.ts so style_overrides.template_id_override reaches Slide.template_id_override where the renderer reads it"
affects:
  - "Plan 80-05 (generate-from-style-spec.ts AI generation prompt) — projector now writes template_id_override; prompt must consume archetype + slot params consistent with the routed template (custom_images count for collage archetypes)"
  - "Plan 80-07 (integration tests) — refresh projector test fixtures: bump schema_version 1→2 + supply slideArchetype + expected template_id_override per archetype; verify end-to-end Meta-workers reference routes to magazine-bold"
  - "Phase 78 renderer template_id_override path (already wired) — now receives non-undefined values from spec-based generation"
tech-stack:
  added: []
  patterns:
    - "Closed-enum dispatch table via TypeScript Record<Exclude<SlideArchetype, 'flat-color-background'>, string> — exhaustive at compile time when ARCHETYPE_TO_TEMPLATE adds an entry per non-dispatched archetype"
    - "Self-contained hex→HSL hue converter (no new runtime dependency) for palette-driven template dispatch — pure / deterministic"
    - "Defense-in-depth fallback: spec.slideArchetype ?? DEFAULT_FALLBACK_ARCHETYPE in projector (Phase B validator already injects fallback; the ?? is a redundant safety paint)"
    - "Pick<>-typed projector carrier + downstream consumer lift — lets the projector type-check against SlideStyleOverrides while routing decisions flow to Slide top-level where the renderer reads them"
key-files:
  created:
    - "src/lib/ai/__tests__/style-spec-projector.archetype-smoke.test.ts"
  modified:
    - "src/lib/ai/style-spec-projector.ts"
    - "src/lib/ai/style-spec-projector.types.ts"
    - "src/lib/types/slide.ts"
    - "src/lib/ai/generate-from-style-spec.ts"
    - "src/lib/ai/__tests__/style-spec-projector.test.ts"
    - "src/lib/ai/__tests__/generate-from-style-spec.test.ts"
decisions:
  - "DEVIATION (Rule 1 / plan grounding bug): Plan 80-04 asserted SlideStyleOverrides already declared template_id_override?: string at slide.ts:275. VERIFIED: line 275 is on Slide top-level (Phase 55 D-08), NOT on SlideStyleOverrides. Added template_id_override?: string to SlideStyleOverrides as a routing carrier so the projector's Pick<> typechecks; consumer in generate-from-style-spec.ts LIFTS the value onto Slide.template_id_override after PROJECTOR FUSION. The SlideStyleOverrides slot is a routing carrier, not a render surface — the renderer reads from Slide.template_id_override (unchanged)."
  - "DEVIATION (Rule 2 / Critical functionality): the plan's two-file scope (projector + types) is insufficient to actually route the value to the renderer. Without lifting from style_overrides onto Slide top-level, the routing decision never reaches getTemplate(). Added a 3-line LIFT block in generate-from-style-spec.ts PROJECTOR FUSION; projected value WINS over Gemini-emitted slide override (spec is canonical)."
  - "Flat-color-background dispatch uses HSL hue ranges per the plan: yellow 45-65° → bold-yellow; pink/magenta 310-350° → y2k-pop; else bold-yellow default. The default is bold-yellow (not y2k-pop) per the plan; rationale: bold-yellow is the more visually-generic flat-color template that renders any palette legibly."
  - "Default fallback redundancy: Plan 02 validator ALREADY resolves spec.slideArchetype ?? DEFAULT_FALLBACK_ARCHETYPE at the Phase B firewall and emits archetype_fallback. The projector's `spec.slideArchetype ?? DEFAULT_FALLBACK_ARCHETYPE` is a defensive paint that costs nothing when the validator already ran; it ALSO protects projector consumers that might call the projector with a degraded spec (e.g. in test fixtures pre-Plan-02-runs)."
  - "No subscriptionTier branching introduced. Project policy (memory/project_template_tiering.md + 80-CONTEXT.md §Boundaries): all 13 templates available to all users; the projector MUST NOT consult tier. Verified by `grep -cE 'subscriptionTier|input\\.tier|spec\\.tier'` post-comment-strip = 0."
  - "Updated 2 existing projector tests (style-spec-projector.test.ts Test 11 + Test 13) and 1 emit-pipeline test (generate-from-style-spec.test.ts Test 2) that asserted the OLD `empty preferred → full corpus` behavior. These tests now assert the correct R7 behavior (empty → empty); rationale: they would fail correctness gates in CI and the plan's acceptance criteria explicitly required the R7 fix. The plan noted these failures were 'tracked for Plan 07' but Plan 07 covers fixture refreshes; the R7 expectation update is in-scope for Plan 04 since it directly validates the R7 fix the plan ships."
metrics:
  duration_minutes: 28
  completed: "2026-05-14"
  tasks_completed: 1
  files_created: 1
  files_modified: 6
  commits: 1
---

# Phase 80 Plan 04: Projector Emits template_id_override + Decoration Default Fix — Summary

Routed the Phase 77 projector to emit `style_overrides.template_id_override` for all 8 composition archetypes per the locked mapping (R6), fixed the long-standing decoration default bug that emitted spurious icons when references had none (R7), and lifted the Pick<>-typed carrier through the generate-from-style-spec PROJECTOR FUSION onto `Slide.template_id_override` where the renderer reads it. The projector remains pure / immutable / no-I/O / no-tier-branching. PARITY-05 closed-enum grep gate passes.

## ARCHETYPE_TO_TEMPLATE Map (R6)

```ts
const ARCHETYPE_TO_TEMPLATE: Readonly<
  Record<Exclude<SlideArchetype, 'flat-color-background'>, string>
> = {
  'caption-bar-bottom':      'magazine-bold',
  'caption-bar-top':         'magazine-bold', // + style_overrides.layout: 'cover'
  'full-bleed-text-overlay': 'news-drop',
  'photo-collage-2up':       'news-drop',   // + custom_images.length === 2 (Plan 05)
  'photo-collage-grid':      'news-drop',   // + custom_images.length === 4 (Plan 05)
  'editorial-serif':         'editorial-serif',
  'notes-sticker':           'notes-app-chic',
}
```

The 8th archetype (`flat-color-background`) is excluded from the static map because it dispatches palette-driven via `pickFlatColorTemplate(spec.palette.primary)`.

## flat-color-background HSL Dispatch (pickFlatColorTemplate)

| Primary hue (HSL) | Template     | Rationale                                       |
| ----------------- | ------------ | ----------------------------------------------- |
| `45°-65°` (yellow) | `bold-yellow` | Native yellow accent template                   |
| `310°-350°` (pink/magenta) | `y2k-pop`     | Native magenta-saturation aesthetic            |
| Else (blue, green, neutral, invalid hex) | `bold-yellow` | Default — visually-generic flat-color renderer |

Implementation uses a self-contained `hexToHue(hex)` helper (standard delta-of-max algorithm) — no new runtime dependency. Pure / deterministic.

## caption-bar-top Layout Override

`caption-bar-top` routes to `magazine-bold` AND emits `style_overrides.layout: 'cover'`. The template-side `cover` flag flips image/text ordering against magazine-bold's `image-with-bottom-card` background mode, landing the caption block at the top of the frame.

## R7 — narrowDecorationAllowlist Decoration Default Fix

**Before (broken):**
```
empty/undefined preferredLucide → return [...AI_LUCIDE_ALLOWLIST]  // FULL CORPUS
empty/undefined preferredShapes → return [...AI_SHAPE_KINDS]        // FULL CORPUS
```
The "fall back to full corpus" behavior allowed Gemini to emit icons the reference image did not declare. Traced as the root cause of the "spurious icons on Meta-workers reference" regression.

**After (Phase 80 R7):**
```
empty/undefined preferredLucide → []  // EMPTY LIST
empty/undefined preferredShapes → []  // EMPTY LIST
```
When the reference has zero decorations, downstream Gemini emit gets an empty closed-enum `responseSchema.enum: []` and cannot invent any icon at all.

`narrowDecorationAllowlist` semantics for non-empty preferences are unchanged — entries are still filtered against the corpus with silent-drop on unknowns (mirror DECOR-05 pattern).

## Default Fallback (DEFAULT_FALLBACK_ARCHETYPE)

When `spec.slideArchetype` is undefined or unrecognized, the projector defaults to `DEFAULT_FALLBACK_ARCHETYPE` (`'full-bleed-text-overlay'`), routing to `news-drop`. Plan 80-02 validator already resolves this fallback at the Phase B firewall and emits an `archetype_fallback` silent-drop counter event; the projector's `??` is a defensive paint that costs nothing when the validator already ran. It ALSO protects test/legacy callers that bypass the validator.

## Pick<> Widening — Types Module

`ProjectedSlideOverrides` Pick<> widened to include two new entries:

```ts
export type ProjectedSlideOverrides = Pick<
  SlideStyleOverrides,
  | 'derived_palette'
  | 'hook_font_family'
  | 'body_font_family'
  | 'text_position'
  | 'treatment_applied'
  | 'template_id_override' // Phase 80 R6 — emitted from spec.slideArchetype
  | 'layout'               // Phase 80 — required for caption-bar-top ('cover' override)
>
```

The `layout` field was already declared on `SlideStyleOverrides` (slide.ts:189) — no source change needed there.

`template_id_override` was NOT previously on `SlideStyleOverrides` — it lives at the `Slide` top level (slide.ts:275, Phase 55 D-08). To satisfy the Pick<> typecheck, `template_id_override?: string` was added to `SlideStyleOverrides` as a **routing carrier**. The renderer continues to read from `Slide.template_id_override` (unchanged); the carrier value is lifted in `generate-from-style-spec.ts` PROJECTOR FUSION. See "Deviations from Plan" below for the full grounding-correction trace.

## PROJECTOR FUSION Lift

`generate-from-style-spec.ts` gains a 3-line lift block immediately after merging projected `style_overrides` into each slide:

```ts
const liftedTemplateIdOverride: string | undefined =
  typeof mergedStyleOverrides.template_id_override === 'string'
    ? (mergedStyleOverrides.template_id_override as string)
    : ((slide as { template_id_override?: string }).template_id_override)
const slideWithProjector: SlideContent = {
  ...slide,
  style_overrides: mergedStyleOverrides,
  ...(liftedTemplateIdOverride !== undefined
    ? { template_id_override: liftedTemplateIdOverride }
    : {}),
}
```

Spec's projected value WINS over any Gemini-emitted slide-level override (the spec's archetype is the canonical routing decision; Gemini's emit is freed from making this choice).

## Purity / Immutability / No Tier Branching

- Projector remains pure: same `(spec, template)` → byte-identical JSON output across N calls (verified in archetype-smoke test).
- No I/O, no `Date.now`, no random, no console.
- `hexToHue` is pure / deterministic / O(1).
- No `subscriptionTier`, `input.tier`, or `spec.tier` access in code (grep gate: 0 post-comment-strip).
- PARITY-05 closed-enum grep gate continues to pass (no `reference_artist`, `reference_brand`, `copy_exactly`, `style_freetext`).

## Acceptance Criteria Verification

| Check                                                                                            | Threshold | Actual          | Status |
| ------------------------------------------------------------------------------------------------ | --------- | --------------- | ------ |
| `grep -c "ARCHETYPE_TO_TEMPLATE" src/lib/ai/style-spec-projector.ts`                            | ≥ 2       | 3               | PASS   |
| `grep -c "template_id_override" src/lib/ai/style-spec-projector.ts`                             | ≥ 2       | 5               | PASS   |
| `grep -c "template_id_override" src/lib/ai/style-spec-projector.types.ts`                       | ≥ 1       | 9               | PASS   |
| `grep -c "pickFlatColorTemplate\|hexToHue" src/lib/ai/style-spec-projector.ts`                  | ≥ 2       | 7               | PASS   |
| 6 distinct template-id values present                                                            | ≥ 6       | 16 occurrences  | PASS   |
| `grep -cE "subscriptionTier\|input\.tier\|spec\.tier" src/lib/ai/style-spec-projector.ts` (code) | == 0      | 0 (post-strip)  | PASS   |
| `grep -cE "reference_artist\|reference_brand\|copy_exactly\|style_freetext"`                    | == 0      | 0               | PASS   |
| `bash scripts/grep-gates/closed-enum-styleSpec.sh`                                              | exit 0    | 0 violations    | PASS   |
| Archetype smoke tests (14 new)                                                                   | all pass  | 14/14           | PASS   |
| Existing projector tests (post-update)                                                           | all pass  | 19/19           | PASS   |
| Generate-from-style-spec tests (post-update)                                                     | all pass  | 11/11           | PASS   |
| Full src/lib/ai/__tests__ run                                                                   | all pass  | 233/233         | PASS   |

## Success Criteria (Plan Spec)

- `projectStyleSpecToSlideOverrides(spec, _t)` with `spec.slideArchetype === 'caption-bar-bottom'` returns `style_overrides.template_id_override === 'magazine-bold'` — **PASS** (Meta-workers reference route)
- `projectStyleSpecToSlideOverrides(spec, _t)` with `spec.slideArchetype === 'full-bleed-text-overlay'` returns `style_overrides.template_id_override === 'news-drop'` — **PASS** (chip-sales reference route)
- `projectStyleSpecToSlideOverrides(spec, _t)` with `spec.slideArchetype === 'caption-bar-top'` returns both `template_id_override === 'magazine-bold'` AND `layout === 'cover'` — **PASS**
- `narrowDecorationAllowlist(spec)` with empty `preferredLucide` returns `{lucide: [], shapes: ...}` — **PASS**

All four plan-level success criteria verified via the new `style-spec-projector.archetype-smoke.test.ts` test file (14 tests).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan grounding bug] template_id_override is on Slide, not on SlideStyleOverrides**

- **Found during:** Reading the plan's read_first list at the start of Task 1.
- **Issue:** Plan grounding asserted "Existing SlideStyleOverrides shape (slide.ts) already declares template_id_override?: string at line 275" and "src/lib/types/slide.ts lines 270-280 (SlideStyleOverrides.template_id_override declaration)". Verified by direct inspection: slide.ts:275 is inside the `export interface Slide { ... }` block (top-level slide field, Phase 55 D-08), NOT inside `export interface SlideStyleOverrides`. The Pick<> widening would fail TypeScript compilation as planned.
- **Fix:** Added `template_id_override?: string` to `SlideStyleOverrides` as a documented **routing carrier** (NOT a render surface). The renderer continues to read from `Slide.template_id_override`. The consumer in `generate-from-style-spec.ts` PROJECTOR FUSION LIFTS the carrier value onto `Slide.template_id_override` so the renderer's `getTemplate(slide.template_id_override)` path picks it up. Field documented inline with this rationale on both `SlideStyleOverrides` (slide.ts) and in the `style-spec-projector.types.ts` DEVIATION header block.
- **Files modified:** `src/lib/types/slide.ts` (new field on SlideStyleOverrides), `src/lib/ai/style-spec-projector.types.ts` (Pick<> widening + deviation block), `src/lib/ai/generate-from-style-spec.ts` (PROJECTOR FUSION lift).
- **Commit:** `eab5580`

**2. [Rule 2 - Critical functionality missing in plan scope] PROJECTOR FUSION lift to Slide top-level**

- **Found during:** Tracing the data flow from projector emit → consumer → renderer.
- **Issue:** The plan's two-file scope (projector + types) is insufficient to actually route the value to the renderer. The projector emits `style_overrides.template_id_override = '...'`, but the consumer (`generate-from-style-spec.ts:353-359`) spreads `projected.style_overrides` into the slide's `style_overrides` object, leaving the value at `slide.style_overrides.template_id_override`. The renderer reads from `slide.template_id_override` (top-level) — so the routing decision NEVER reaches the renderer without a lift.
- **Fix:** Added a 3-line LIFT block in `generate-from-style-spec.ts` PROJECTOR FUSION that hoists `mergedStyleOverrides.template_id_override` (after projector wins over Gemini) onto `slideWithProjector.template_id_override` (slide top-level).
- **Files modified:** `src/lib/ai/generate-from-style-spec.ts` (LIFT block within the existing slidesProcessed map).
- **Commit:** `eab5580`

**3. [Rule 1 - Stale test expectations] Two projector tests asserted the OLD `empty preferred → full corpus` behavior**

- **Found during:** Running `npx vitest run src/lib/ai/__tests__/style-spec-projector.test.ts` post-implementation.
- **Issue:** `style-spec-projector.test.ts` Test 11 (`narrowDecorationAllowlist returns full AI_LUCIDE_ALLOWLIST when preferredLucide empty`) and Test 13 (`narrowDecorationAllowlist for preferredShapes: empty→full, ...`) explicitly asserted the BROKEN pre-Phase-80 behavior. The Plan 80 R7 fix correctly flips the behavior; these tests now assert wrong expectations.
- **Fix:** Updated both tests in place — Test 11 asserts `narrowed.lucide === []` and additionally guards against regression by checking `narrowed.lucide.length < AI_LUCIDE_ALLOWLIST.length`. Test 13 asserts `narrowDecorationAllowlist(specEmpty).shapes === []` with the same regression guard. Test names updated to reference Phase 80 R7. The plan noted these failures were "tracked for Plan 07" but Plan 07 covers fixture refreshes (schema_version + slideArchetype on test fixtures) — the R7 expectation update is in-scope for Plan 04 since it directly validates the R7 fix the plan ships.
- **Files modified:** `src/lib/ai/__tests__/style-spec-projector.test.ts` (Tests 11 + 13 updated in place — no new tests).
- **Commit:** `eab5580`

**4. [Rule 1 - Stale test expectation] Emit-pipeline test 2 asserted the OLD `empty preferred → full corpus` behavior at the Gemini responseSchema layer**

- **Found during:** Running the broader `src/lib/ai/__tests__/` suite post-implementation.
- **Issue:** `generate-from-style-spec.test.ts` Test 2 asserted `lucideEnum.length === AI_LUCIDE_ALLOWLIST.length` when `spec.preferredLucide === []` — the test specifically named the legacy behavior in its label. The Plan 80 R7 fix makes this enum empty so the AI cannot emit any icon at all.
- **Fix:** Updated Test 2 — asserts `lucideEnum.length === 0` and the regression guard `lucideEnum.length < AI_LUCIDE_ALLOWLIST.length`. Test name updated to reference Phase 80 R7.
- **Files modified:** `src/lib/ai/__tests__/generate-from-style-spec.test.ts` (Test 2 updated in place).
- **Commit:** `eab5580`

### Auth Gates

None.

## Deferred Issues

**1. Pre-existing snapshot test failures on `parity.template-fingerprint.test.tsx` (14 failures on baseline)**

- **Out-of-scope per SCOPE BOUNDARY rule** — these failures reproduce on the merged-from-main baseline BEFORE my changes, confirmed by stashing all task changes and re-running the test. The diff shows an unexpected `<div ...>1/1</div>` page counter element appearing in rendered output that the snapshots do not anticipate.
- **Not caused by this plan's changes.** Likely traces to a prior commit that wired page-counter overlays into templates without regenerating the parity snapshots, or to a missed `--update-snapshots` run during template-author work.
- **Action:** Logged here for a future plan to triage (likely a one-line snapshot regeneration commit if the new rendering is correct, otherwise a templates-side investigation).
- **Files affected:** `src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap`, `src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations-undefined.test.tsx.snap`.

**2. Test-fixture schema_version drift (pre-existing, tracked for Plan 80-07)**

- **Out-of-scope per plan acknowledgement.** TypeScript `noEmit` reports ~20 pre-existing test fixtures using `schema_version: 1` against the v2 type (literal 2). These are tracked in the plan's acceptance criteria: "Existing projector tests pass (or fail with archetype-related expectations only — those failures are tracked for Plan 07 to update test fixtures)." Plan 07 will refresh fixtures to `schema_version: 2` + supply matching `slideArchetype` + slot params.

## Threat Flags

None — Plan 80-04 introduces no new network endpoints, no new file-access patterns, no new auth surfaces, and no new schema boundaries beyond the closed-enum `template_id_override` carrier (which is already template-registry-bounded via Phase 78's `TEMPLATE_IDS` silent-strip path in `validate-slides.ts`).

## Ready Signal for Plan 80-07

Plan 80-04 ships the projector wiring that Plan 80-07's integration tests will exercise end-to-end. The contract Plan 80-07 should expect:

- Every Phase-80-validated StyleSpec passing through `projectStyleSpecToSlideOverrides` emits a non-undefined `template_id_override` resolving to a template registered in `src/lib/render/templates/index.ts`.
- The Meta-workers reference (`caption-bar-bottom` archetype) routes to `magazine-bold`.
- The chip-sales reference (`full-bleed-text-overlay` archetype) routes to `news-drop`.
- The full end-to-end generation flow lifts `template_id_override` onto `Slide.template_id_override` via `generate-from-style-spec.ts` PROJECTOR FUSION; the renderer picks it up via the existing Phase 78 path.
- Empty `preferredLucide` / `preferredShapes` on the spec produces zero `IconDecoration` and zero `ShapeDecoration` entries in generated slide output (R7 acceptance — verified at the Gemini responseSchema layer; end-to-end visual verification is Plan 80-07's responsibility).

## Self-Check: PASSED

**Files verified to exist:**

- FOUND: `src/lib/ai/style-spec-projector.ts` (modified)
- FOUND: `src/lib/ai/style-spec-projector.types.ts` (modified)
- FOUND: `src/lib/types/slide.ts` (modified — `template_id_override` added to `SlideStyleOverrides`)
- FOUND: `src/lib/ai/generate-from-style-spec.ts` (modified — PROJECTOR FUSION LIFT)
- FOUND: `src/lib/ai/__tests__/style-spec-projector.test.ts` (modified — Tests 11 + 13 reflect R7)
- FOUND: `src/lib/ai/__tests__/generate-from-style-spec.test.ts` (modified — Test 2 reflects R7)
- FOUND: `src/lib/ai/__tests__/style-spec-projector.archetype-smoke.test.ts` (created — 14 acceptance tests)

**Commit verified to exist:**

- FOUND: `eab5580` `feat(80-04): projector emits template_id_override from slideArchetype + decoration default fix`
