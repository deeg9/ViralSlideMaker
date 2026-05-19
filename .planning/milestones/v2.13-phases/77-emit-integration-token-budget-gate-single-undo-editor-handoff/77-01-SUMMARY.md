---
phase: 77-emit-integration-token-budget-gate-single-undo-editor-handoff
plan: 01
plan_number: 01
subsystem: ai-emit-helpers
tags: [emit-07, stylespec-12, tplrend-05, pure-helpers, projector, brand-kit-merge, aspect-filter]
requires:
  - StyleSpec type (Phase 74)
  - SlideStyleOverrides type (existing v2.x)
  - SpecPreviewAspects type (Phase 76 state machine)
  - BrandKit type (existing v2.x)
  - FONT_CATALOG (existing v2.x)
  - AI_LUCIDE_ALLOWLIST + AI_SHAPE_KINDS (Phase 71)
provides:
  - applyAspectFilter (per-aspect zeroing seam — keeps projector pure)
  - NEUTRAL_PALETTE_DEFAULT / NEUTRAL_TYPOGRAPHY_DEFAULT / NEUTRAL_LAYOUT_DEFAULT / NEUTRAL_DECORATIONS_DEFAULT (constants)
  - applyBrandKitRemix (per-field merge of brand-kit colors + font categories over spec)
  - projectStyleSpecToSlideOverrides (load-bearing StyleSpec → existing SlideStyleOverrides projector)
  - narrowDecorationAllowlist (silent-drop allowlist filter for AI emit)
  - ProjectedSlideOverrides + NarrowedDecorationAllowlist + ProjectedSpec types
affects:
  - Plan 77-02 (Wave 2) consumes all 4 helpers in generate-from-style-spec.ts
  - Phase 77 PARITY-02 roundtrip test consumes projector output
tech-stack:
  added: []
  patterns:
    - Pure-function with referential-transparency invariant (matches Phase 75 firewall)
    - Pick<>-typed return contract as compile-time defense (matches Phase 71 PTF byte-identity)
    - Silent-drop on closed-enum membership (matches Phase 71 v2.12 DECOR-05)
    - Object.is short-circuit for null-input identity (matches Phase 76 reducer pattern)
    - Frozen NEUTRAL_*_DEFAULT constants for immutable defaults
key-files:
  created:
    - src/lib/ai/style-spec-aspect-filter.ts
    - src/lib/ai/style-spec-brand-kit-merge.ts
    - src/lib/ai/style-spec-projector.ts
    - src/lib/ai/style-spec-projector.types.ts
    - src/lib/ai/__tests__/style-spec-aspect-filter.test.ts
    - src/lib/ai/__tests__/style-spec-brand-kit-merge.test.ts
    - src/lib/ai/__tests__/style-spec-projector.test.ts
  modified: []
decisions:
  - 'D-77-01-01: Route palette through derived_palette: string[] (DEVIATION — original plan referenced background_color/accent_color SlideStyleOverrides fields that DO NOT EXIST in v2.x)'
  - 'D-77-01-02: Deterministic category→family resolver picks first FONT_CATALOG entry per category (Inter / Playfair Display / Bebas Neue / Dancing Script for sans-serif/serif/display/handwriting)'
  - 'D-77-01-03: NEUTRAL_DECORATIONS_DEFAULT uses empty arrays (not undefined) — narrowDecorationAllowlist treats empty as "no preference" → returns full corpus'
  - 'D-77-01-04: applyBrandKitRemix uses Object.is referential-equality short-circuit when brandKit is null (zero-allocation path for the common toggle-off case)'
  - 'D-77-01-05: ProjectedSlideOverrides Pick<> reserves _template parameter slot in projector signature for future template-aware contrast resolution (Plan 02+ stable contract)'
metrics:
  duration_min: 10
  tasks_completed: 3
  test_count_added: 42
  files_created: 7
  files_modified: 0
  completed_date: '2026-05-11'
---

# Phase 77 Plan 01: Pure StyleSpec Helpers (applyAspectFilter + applyBrandKitRemix + projectStyleSpecToSlideOverrides) Summary

Three pure helpers — zero I/O, zero React, zero Gemini SDK, zero Supabase — that compose the emit-side seam Plan 77-02 will wire into `generateCarouselFromReferences()`. The projector is the load-bearing translation: `StyleSpec` semantic fields become existing `SlideStyleOverrides` fields, with the `Pick<>`-based `ProjectedSlideOverrides` type proving zero new Slide fields by TypeScript construction (STYLESPEC-12 / TPLREND-05 compile-time defense).

## What Shipped

### Helpers (3 modules + 1 type module)

**`src/lib/ai/style-spec-aspect-filter.ts`** — `applyAspectFilter(spec, aspects): StyleSpec`
- Returns a new StyleSpec with sections replaced by `NEUTRAL_*_DEFAULT` wherever `aspects.{palette,typography,layout,decorations} === false`
- Imagery, rhythm, voice_note, schema_version preserved across all aspect combinations (not part of the 4-toggle surface)
- Exports 4 frozen `NEUTRAL_*_DEFAULT` constants for downstream identity checks
- Pure + immutable + referentially transparent

**`src/lib/ai/style-spec-brand-kit-merge.ts`** — `applyBrandKitRemix(spec, brandKit | null): StyleSpec`
- `null` brandKit short-circuits via `Object.is === spec` (zero-allocation common path)
- Per-field merge: `primary_color` / `secondary_color` / `accent_color` override `palette.primary/secondary/accent` only when non-null
- `heading_font_family` / `body_font_family` resolved to font categories via `getFontEntry(family)` catalog lookup; unknown families silently leave spec category in place
- `palette.mode` always preserved from spec (BrandKit has no mode field)
- layout + imagery + decorations + rhythm + voice_note + schema_version untouched

**`src/lib/ai/style-spec-projector.ts`** — `projectStyleSpecToSlideOverrides(spec, template): ProjectedSpec`
- Translates StyleSpec into `style_overrides: ProjectedSlideOverrides` + `decorations: NarrowedDecorationAllowlist`
- Skip-emit semantics: undefined spec fields produce no override key → template defaults win (this is what makes `applyAspectFilter` neutralization work end-to-end)
- Deterministic category → family lookup (first registered family per category)
- `_template` parameter reserved for future template-aware fallbacks

**`src/lib/ai/style-spec-projector.ts`** — `narrowDecorationAllowlist(spec): NarrowedDecorationAllowlist`
- Empty/undefined `preferredLucide` / `preferredShapes` → full `AI_LUCIDE_ALLOWLIST` / `AI_SHAPE_KINDS` (no narrowing)
- Non-empty → subset filtered by O(1) Set membership check; entries not in the corpus silently dropped (mirror v2.12 DECOR-05)

**`src/lib/ai/style-spec-projector.types.ts`** — Type contracts
- `ProjectedSlideOverrides = Pick<SlideStyleOverrides, 'derived_palette' | 'hook_font_family' | 'body_font_family' | 'text_position' | 'treatment_applied'>` — strict subset; any future projector author who tries to introduce a new Slide field would fail TypeScript compilation
- `NarrowedDecorationAllowlist = { lucide, shapes }` — Plan 02 passes these into Gemini responseSchema `enum:` arrays
- `ProjectedSpec` composite

### Field Mapping Table (locked)

| Spec field                       | Override field                  | Notes                                                                 |
| -------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| `palette.primary` + `accent`     | `derived_palette: string[]`     | DEVIATION — see below; `[primary, accent].filter(Boolean)`            |
| `typography.hookFontCategory`    | `hook_font_family: string`      | Catalog lookup; first registered family per category                  |
| `typography.bodyFontCategory`    | `body_font_family: string`      | Catalog lookup                                                        |
| `layout.hookPosition`            | `text_position: 'top'|'center'|'bottom'` | Closed-enum exact match (BrandKitTextPosition shared)         |
| `imagery.treatmentPreset`        | `treatment_applied: string`     | Phase 54 D-03 descriptor slot                                         |
| `voice_note`                     | (NOT a slide field)             | Plan 02 passes to Gemini system prompt                                |
| `rhythm.cadence`                 | (NOT a slide field)             | Plan 02 prompt cadence guidance                                       |
| `decorations.preferredLucide`    | NarrowedDecorationAllowlist.lucide | Plan 02 passes to Gemini responseSchema enum                       |
| `decorations.preferredShapes`    | NarrowedDecorationAllowlist.shapes | Plan 02 passes to Gemini responseSchema enum                       |

### Pick<> Set on ProjectedSlideOverrides (locked)

The plan's "no new Slide fields" rule is enforced structurally:

```typescript
type ProjectedSlideOverrides = Pick<
  SlideStyleOverrides,
  | 'derived_palette'
  | 'hook_font_family'
  | 'body_font_family'
  | 'text_position'
  | 'treatment_applied'
>
```

Plan 02's roundtrip PTF can assert byte-identity against EXACTLY these 5 fields and know the projector's universe.

### NEUTRAL_*_DEFAULT semantics (the contract Plan 02 + editor handoff rely on)

| Constant                       | Value                                                      | Downstream behavior                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEUTRAL_PALETTE_DEFAULT`      | `{ mode: 'solid', primary: '#FFFFFF' }`                   | Projector emits `derived_palette: ['#FFFFFF']`; fixed-palette templates ignore this entirely (zero-impact additive route through palette-dominant feature)     |
| `NEUTRAL_TYPOGRAPHY_DEFAULT`   | `{}` (both font categories undefined)                      | Projector skips emitting hook/body_font_family → template defaults win                                                                                         |
| `NEUTRAL_LAYOUT_DEFAULT`       | `{}` (hookPosition + density undefined)                    | Projector skips emitting text_position → template default wins                                                                                                 |
| `NEUTRAL_DECORATIONS_DEFAULT`  | `{ preferredLucide: [], preferredShapes: [] }`             | narrowDecorationAllowlist treats empty as "no preference" → returns full AI_LUCIDE_ALLOWLIST / AI_SHAPE_KINDS, so neutralized decorations behave like "no narrowing" |

This is the contract Plan 02 + the editor handoff rely on: when a user unchecks an aspect in the Phase 76 spec-preview UI, the spec section is neutralized upstream, the projector emits no override for that section, and the chosen template's defaults flow through unchanged into the editor.

## Phase 77 Plan 02 Handoff

Plan 77-02 (Wave 2) composes the 3 functions inside `generate-from-style-spec.ts`:

```typescript
import { applyAspectFilter } from '@/lib/ai/style-spec-aspect-filter'
import { applyBrandKitRemix } from '@/lib/ai/style-spec-brand-kit-merge'
import {
  projectStyleSpecToSlideOverrides,
  narrowDecorationAllowlist,
} from '@/lib/ai/style-spec-projector'

// Composition order (locked):
//   1. filtered = applyAspectFilter(spec, aspects)
//   2. merged = applyBrandKitRemix(filtered, brandKit ?? null)
//   3. projected = projectStyleSpecToSlideOverrides(merged, template)
//   4. Plan 02 sets per-slide style_overrides = { ...templateDefaults, ...projected.style_overrides }
//   5. Plan 02 passes projected.decorations.{lucide,shapes} into Gemini responseSchema enum arrays
```

**Function signatures Plan 02 will call:**

```typescript
applyAspectFilter(spec: StyleSpec, aspects: SpecPreviewAspects): StyleSpec
applyBrandKitRemix(spec: StyleSpec, brandKit: BrandKit | null): StyleSpec
projectStyleSpecToSlideOverrides(spec: StyleSpec, template: SlideTemplate): ProjectedSpec
narrowDecorationAllowlist(spec: StyleSpec): NarrowedDecorationAllowlist
```

## Test Counts (per task)

| Task | Helper                              | Tests | Status |
| ---- | ----------------------------------- | ----- | ------ |
| 1    | applyAspectFilter                   | 12    | GREEN  |
| 2    | applyBrandKitRemix                  | 11    | GREEN  |
| 3    | projectStyleSpecToSlideOverrides + narrowDecorationAllowlist | 19 (plan-spec required ≥17; +2 added for derived_palette deviation coverage) | GREEN  |

**Total: 42 GREEN.** Source-grep firewall verified: zero React / Gemini SDK / Supabase imports across all 3 helpers.

## Verification

```bash
$ npx vitest run \
    src/lib/ai/__tests__/style-spec-aspect-filter.test.ts \
    src/lib/ai/__tests__/style-spec-brand-kit-merge.test.ts \
    src/lib/ai/__tests__/style-spec-projector.test.ts

Test Files  3 passed (3)
     Tests  42 passed (42)

$ npm run lint:gates
PARITY-05: zero free-text closed-enum violations in src/

$ npx tsc --noEmit (filtered for our files)
[zero errors in style-spec-aspect-filter.ts | style-spec-brand-kit-merge.ts | style-spec-projector.ts | style-spec-projector.types.ts]
```

Pre-existing `npx tsc --noEmit` errors in unrelated files (Stripe, treatment-sync, projects-delete) are out of scope per executor SCOPE BOUNDARY rule. Pre-existing `vitest` failures (37 in unrelated test suites: render-slide-satori, premium-templates, generate-slides, rate-limit, etc.) are likewise out of scope. None are caused by this plan's changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug + Rule 2 - Missing critical functionality] Plan grounding referenced non-existent SlideStyleOverrides fields**

- **Found during:** Task 3 — `npx tsc --noEmit` after writing the projector
- **Issue:** Plan-spec Test 2/3 + grounding comment instructed projector to map `spec.palette.primary → style_overrides.background_color` and `spec.palette.accent → style_overrides.accent_color`. **Those two fields DO NOT EXIST in `SlideStyleOverrides`** (verified via direct read of `src/lib/types/slide.ts:163-216`). The `Pick<>` constraint failed at compile time; the runtime tests would have failed too.
- **Fix:** Per the plan's load-bearing rule "DO NOT add any new field to SlideStyleOverrides — TypeScript ProjectedSlideOverrides type CONSTRAINS the output by construction" + "read the actual existing field, never invent one", I routed palette colors through the EXISTING v2.9 `derived_palette: string[]` slot. This field is consumed by templates with `paletteMode: 'palette-dominant'` (Phase 57 wires the read). Fixed-palette templates ignore it entirely (zero-impact additive route).
- **Rationale:** Adding a per-slide `background_color` field would have violated STYLESPEC-12 by requiring a new SlideStyleOverrides field, breaking the Phase 74 zero-new-fields PTF baselines and the Phase 71 byte-identity parity gate. Routing through `derived_palette` honors the structural defense.
- **Files modified:** `src/lib/ai/style-spec-projector.ts`, `src/lib/ai/style-spec-projector.types.ts`, `src/lib/ai/__tests__/style-spec-projector.test.ts` (Tests 2/3 updated; Test 3b added for accent-undefined coverage)
- **Commits:** `15b9673` (implementation + test updates)
- **Visibility:** Documented at the top of both `style-spec-projector.ts` and `style-spec-projector.types.ts` under "DEVIATION" header so Plan 02 + downstream maintainers see it immediately.
- **Plan 02 implication:** Plan 02's roundtrip PTF should assert byte-identity on `derived_palette[0]` (dominant) + `derived_palette[1]` (accent, when present), not on a non-existent `background_color`. This update needs to land in Plan 02's test fixtures.

**2. [Rule 1 - Bug] Source-grep test 17 self-tripped on comment mention of `@google/genai`**

- **Found during:** Task 3 GREEN verification — Test 17 failed catching my own header-comment mention of the forbidden import literal in the contract docstring
- **Issue:** Test 17 reads the projector source as text and asserts zero matches of `/from 'react'/`, `/@google\/genai/`, `/@supabase/`. My header comment listed those literal strings as documentation of what was forbidden, which made the firewall trip on its own description.
- **Fix:** Replaced literal `@google/genai` and `@supabase` strings in the comment with friendly descriptions ("Gemini SDK", "Supabase") and added a meta-comment explaining why the literals were intentionally excluded.
- **Files modified:** `src/lib/ai/style-spec-projector.ts` (header comment only)
- **Commit:** `15b9673`

### Added Test (additive coverage)

**Test 3b** — `emits derived_palette with only primary when spec.palette.accent undefined`. Added because the deviation introduced a new code path (palette array length depends on accent presence). Plan-spec required ≥17 projector tests; total shipped is 19.

## Self-Check: PASSED

**Files exist:**
```bash
$ for f in src/lib/ai/style-spec-aspect-filter.ts src/lib/ai/style-spec-brand-kit-merge.ts src/lib/ai/style-spec-projector.ts src/lib/ai/style-spec-projector.types.ts src/lib/ai/__tests__/style-spec-aspect-filter.test.ts src/lib/ai/__tests__/style-spec-brand-kit-merge.test.ts src/lib/ai/__tests__/style-spec-projector.test.ts; do
    [ -f "$f" ] && echo "FOUND: $f" || echo "MISSING: $f"
  done
FOUND: src/lib/ai/style-spec-aspect-filter.ts
FOUND: src/lib/ai/style-spec-brand-kit-merge.ts
FOUND: src/lib/ai/style-spec-projector.ts
FOUND: src/lib/ai/style-spec-projector.types.ts
FOUND: src/lib/ai/__tests__/style-spec-aspect-filter.test.ts
FOUND: src/lib/ai/__tests__/style-spec-brand-kit-merge.test.ts
FOUND: src/lib/ai/__tests__/style-spec-projector.test.ts
```

**Commits exist:**
- `1d1a608` (Task 1 RED)
- `2155914` (Task 1 GREEN)
- `50ba167` (Task 2 RED)
- `a7d8b91` (Task 2 GREEN)
- `d5d14d1` (Task 3 RED)
- `15b9673` (Task 3 GREEN, includes deviation fix)
