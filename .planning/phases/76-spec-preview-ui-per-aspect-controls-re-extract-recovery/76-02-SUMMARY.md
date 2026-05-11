---
phase: 76-spec-preview-ui-per-aspect-controls-re-extract-recovery
plan: 02
subsystem: ui
tags: [react, vitest, testing-library, jsdom, svg-schematic, source-grep-firewall, accessibility, brand-kit-merge-preview]

# Dependency graph
requires:
  - phase: 76-spec-preview-ui-per-aspect-controls-re-extract-recovery
    plan: 01
    provides: SpecPreviewPanel skeleton with 7 slot testids + reducer-driven Generate/Re-extract CTAs + state machine exposing aspects/useBrandKitRemix/brandKitAvailable + dispatch actions TOGGLE_ASPECT/TOGGLE_BRAND_KIT_REMIX
  - phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline
    provides: StyleSpec closed-enum types + BrandKit type
provides:
  - PaletteSwatches (PREVIEW-02) — 1–6 colored squares with hex labels + closed-enum mode badge
  - FontCategoryBadges (PREVIEW-03) — hook + body category pills with graceful "not detected" fallback
  - LayoutSketch (PREVIEW-04) — 9:16 SVG schematic with hookPosition rect + body density lines + decoration density circles
  - VoiceNoteCaption (PREVIEW-05) — single-line "Style notes:" caption with truncate+nowrap defense
  - PerAspectToggles (PREVIEW-06) — 4-checkbox group dispatching TOGGLE_ASPECT + inline empty-state hint
  - BrandKitRemixToggle (PREVIEW-08) — null when no kit; two-column merge preview with per-field arrow indicators when ON
  - CreditCostDisplay (PREVIEW-11) — "Generating will use N credit(s)" with aria-describedby tooltip
  - SpecPreviewPanel slot fills wiring all 7 children into the testids 76-01 reserved
affects: [76-03, 77]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Slot-fill-without-contract-break: SpecPreviewPanel's empty mount-point divs from 76-01 keep their data-testid + data-slot wrappers; 76-02 only renders children INSIDE them. PREVIEW-01 single-CTA invariant + Generate/Re-extract reducer-driven disable rules untouched."
    - "Defensive null-guard at the slot boundary: even though SpecPreviewState.spec is non-null when status='preview' (per the EXTRACT_SUCCESS reducer contract), each slot wraps its child in `{spec ? <Child /> : null}` so future status-machine changes can't crash the panel through TS-narrowed-but-nullable spec."
    - "PREVIEW-06 view-layer parity hint: PerAspectToggles renders an inline 'Select at least one aspect to generate.' alert when zero are checked — the same condition the reducer's GENERATE_CLICK guard rejects with no-aspects-selected. View + reducer say the same thing in two layers."
    - "Two-column merge preview with per-field arrows: BrandKitRemixToggle renders an Extracted-vs-BrandKit grid where each row's arrow (→) appears IFF brandKit has a non-null value AND extracted has a value — visualizes which fields the merge will override at emit time (Phase 77 owns the merge itself)."
    - "Deterministic SVG schematic: LayoutSketch uses fixed numeric bands per enum value (top y=15, center y=70, bottom y=115; tight=5 lines, medium=3, airy=1; dense=4 circles, moderate=2, sparse=0) so tests pin element counts + attribute values without snapshot churn."
    - "jsdom-tolerant inline-style assertions: tests for inline backgroundColor accept EITHER the original hex OR rgb(...) since React serializes color names through the CSSOM. Documents the gotcha for future authors of style-attribute tests."
    - "LEGAL-03 forward-compat in-component grep: each new component file ships with a per-file forbidden-token grep test (in addition to the panel-file grep) — drift in any component fails CI before Phase 79's project-wide gate lands."

key-files:
  created:
    - src/components/style-from-reference/palette-swatches.tsx
    - src/components/style-from-reference/font-category-badges.tsx
    - src/components/style-from-reference/layout-sketch.tsx
    - src/components/style-from-reference/voice-note-caption.tsx
    - src/components/style-from-reference/per-aspect-toggles.tsx
    - src/components/style-from-reference/brand-kit-remix-toggle.tsx
    - src/components/style-from-reference/credit-cost-display.tsx
    - src/components/style-from-reference/__tests__/palette-swatches.test.tsx
    - src/components/style-from-reference/__tests__/font-category-badges.test.tsx
    - src/components/style-from-reference/__tests__/layout-sketch.test.tsx
    - src/components/style-from-reference/__tests__/voice-note-caption.test.tsx
    - src/components/style-from-reference/__tests__/per-aspect-toggles.test.tsx
    - src/components/style-from-reference/__tests__/brand-kit-remix-toggle.test.tsx
    - src/components/style-from-reference/__tests__/credit-cost-display.test.tsx
    - src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx
  modified:
    - src/components/style-from-reference/spec-preview-panel.tsx

key-decisions:
  - "Defensive null-guard per slot. Each slot in SpecPreviewPanel wraps its child in `{spec ? <Child /> : null}` even though the shell only mounts the panel under status='preview' (where spec is non-null). Belt-and-braces against future reducer changes that could TS-narrow spec to null in preview state."
  - "PerAspectToggles renders inline empty-state hint as view-layer parity for the reducer's no-aspects-selected guard. The reducer rejects GENERATE_CLICK when zero aspects are checked; the view shows 'Select at least one aspect to generate.' at the same condition. Two layers say the same thing — defends PREVIEW-06 against silent UX drift."
  - "BrandKitRemixToggle ships the FULL two-column merge preview now (per CONTEXT.md decision, NO scope reduction). The actual per-field merge happens at emit time (Phase 77 concern); this surface is the user-facing preview that visualizes which fields will be overridden when the toggle is ON. Per-field arrow indicators render IFF brand kit has a non-null value AND extracted has a value."
  - "LayoutSketch uses deterministic numeric bands (no Math.random) so tests can pin element counts + y-coordinate ordering without snapshot churn. Hook y bands: top=15, center=70, bottom=115 (well-separated). Body lines: tight=5, medium=3, airy=1. Decoration circles: dense=4, moderate=2, sparse=0."
  - "Inline-style assertions accept either the literal hex OR jsdom's normalized rgb(...). React's CSSOM serializes #a8e0b0 → rgb(168, 224, 176); the contract is 'inline backgroundColor reflects the input,' not the literal token. Documented in tech-stack.patterns for future test authors."
  - "Each new component file carries its own LEGAL-03 forward-compat grep test (in addition to the panel-level integration grep). Drift in any single component fails CI before Phase 79's project-wide gate lands."

requirements-completed: [PREVIEW-02, PREVIEW-03, PREVIEW-04, PREVIEW-05, PREVIEW-06, PREVIEW-08, PREVIEW-11]

# Metrics
duration: 8min
completed: 2026-05-11
---

# Phase 76 Plan 02: Spec-Preview Slot Fills — Display Components + Per-Aspect Controls + Brand-Kit Remix + Credit Cost

**7 reusable client components fill the 76-01 slot contract; SpecPreviewPanel becomes a fully-rendered surface for PREVIEW-02..06 + 08 + 11 without altering the load-bearing PREVIEW-01 invariant or the reducer-driven CTA disable rules.**

## Performance

- **Duration:** ~8 min (1778457272 → 1778457737)
- **Started:** 2026-05-10T23:54:32Z
- **Completed:** 2026-05-11T00:02:17Z
- **Tasks:** 3 (full TDD: 3 RED commits + 3 GREEN commits = 6 commits)
- **Files created:** 15 (7 components + 8 test files)
- **Files modified:** 1 (spec-preview-panel.tsx — slot-content fill only)

## Accomplishments

- **All 7 PREVIEW requirements in this plan's scope have visible UI surfaces verified by tests.** PREVIEW-02 (palette swatches with hex labels), PREVIEW-03 (font category badges), PREVIEW-04 (9:16 layout sketch), PREVIEW-05 (sanitized voice_note caption), PREVIEW-06 (per-aspect toggles + inline empty-state hint), PREVIEW-08 (brand-kit remix toggle with two-column merge preview), PREVIEW-11 (visible credit cost with tooltip).
- **PREVIEW-01 invariant preserved.** SpecPreviewPanel still renders the Generate CTA exactly once (verified by source-grep gate in the integration test). The reducer-driven disable predicates (`hasAtLeastOneAspect`, `refusalAcknowledgedOrAbsent`) are UNTOUCHED — Plan 76-02 only filled slot CONTENT inside the structural contract 76-01 reserved.
- **PerAspectToggles ships with a view-layer empty-state hint** ("Select at least one aspect to generate.") that mirrors the reducer's `no-aspects-selected` guard. Two-layer enforcement of PREVIEW-06 — defends against silent UX drift if a future refactor breaks one layer.
- **BrandKitRemixToggle ships the FULL two-column "Extracted vs Brand Kit" merge preview** with per-field arrow indicators (no scope reduction per CONTEXT.md). Phase 77 owns the actual merge at emit time; this surface visualizes which fields will be overridden.
- **LayoutSketch uses deterministic numeric bands** so tests pin counts + coordinates without snapshot churn. Test 2 asserts `yTop < yCenter < yBottom` for hook position; Tests 3/4 assert exact element counts per density enum value.
- **46 new tests GREEN across 8 test files**: 6 (PaletteSwatches) + 4 (FontCategoryBadges) + 6 (LayoutSketch) + 5 (VoiceNoteCaption) + 6 (PerAspectToggles) + 7 (BrandKitRemixToggle) + 5 (CreditCostDisplay) + 7 (SpecPreviewPanel integration) = 46. Combined with 76-01's 31 tests, **77/77 Phase 76 tests GREEN**.
- **Zero TypeScript regressions** in any new or modified file (`npx tsc --noEmit` clean for the Phase 76 surface).
- **LEGAL-03 forward-compat: zero forbidden mimicry-framing tokens** across all 10 `src/components/style-from-reference/*.tsx` files (verified by per-file grep tests AND the panel-level integration grep). Phase 79's project-wide gate has nothing to fix in this surface.

## Task Commits

Each task followed strict TDD: RED test commit then GREEN implementation commit.

1. **Task 1: 4 display components (PREVIEW-02..05)**
   - `43ef671` (test) — 21 failing tests across 4 test files (palette/fonts/layout/voice-note)
   - `a14b7f2` (feat) — PaletteSwatches + FontCategoryBadges + LayoutSketch + VoiceNoteCaption (4 files, ~330 LoC). Test fix: Test 3 in palette-swatches.test.tsx loosened to accept jsdom's rgb(...) normalization OR the literal hex.
2. **Task 2: 3 control components (PREVIEW-06 + 08 + 11)**
   - `5536bbf` (test) — 18 failing tests across 3 test files (per-aspect/brand-kit/credit-cost)
   - `687bb66` (feat) — PerAspectToggles + BrandKitRemixToggle + CreditCostDisplay (3 files, ~270 LoC)
3. **Task 3: SpecPreviewPanel slot fills + integration test**
   - `04c62d7` (test) — 7 integration tests (2 newly RED, 5 already-GREEN passive guards)
   - `5272372` (feat) — Edited spec-preview-panel.tsx: imported the 7 children and rendered them inside the existing slot wrappers; updated leading docstring to reflect the slot fills

## Files Created/Modified

**Components (7 new files, all `'use client'`):**
- `palette-swatches.tsx` — 1–6 swatches with hex labels in `<code>`; mode badge title-cased; optional `extras` prop bridges to PREVIEW-02 4–6 range
- `font-category-badges.tsx` — hook + body pills via 4-category catalog; graceful "Typography: not detected" fallback; `<ul role=list aria-label>`
- `layout-sketch.tsx` — `<svg viewBox="0 0 90 160" role="img" aria-label="Layout sketch — schematic preview">` with deterministic hook rect / body lines / decoration circles
- `voice-note-caption.tsx` — `"Style notes:"` prefix + truncate+nowrap value; `null` when undefined
- `per-aspect-toggles.tsx` — `<fieldset aria-label>` with 4 labeled checkboxes; inline empty-state hint
- `brand-kit-remix-toggle.tsx` — `null` when no brand kit; toggle + two-column merge preview with per-field arrows when ON
- `credit-cost-display.tsx` — pluralized "Generating will use N credit(s)" + `<button aria-describedby>` → sr-only tooltip span

**Tests (8 new files):**
- 7 per-component test files + 1 SpecPreviewPanel integration test file = 46 new tests

**Modified:**
- `spec-preview-panel.tsx` — added 7 imports; replaced empty slot mount-point divs with rendered children (each guarded with `{spec ? <Child /> : null}`); updated leading docstring. Generate/Re-extract CTAs + their reducer-driven disable predicates UNTOUCHED.

## Decisions Made

All decisions documented in frontmatter `key-decisions`. Highlights:

- **Defensive null-guard per slot.** SpecPreviewState.spec is `StyleSpec | null` at the type level; the shell only renders this panel under `status === 'preview'` (where spec is non-null per the EXTRACT_SUCCESS contract). Each slot wraps its child in `{spec ? <Child /> : null}` so future reducer changes can't crash the panel.
- **PREVIEW-06 enforcement parity.** PerAspectToggles renders an inline empty-state hint at the same condition the reducer rejects with `no-aspects-selected`. Two layers say the same thing — defends PREVIEW-06 against silent UX drift.
- **Full brand-kit merge preview now (no scope reduction).** BrandKitRemixToggle ships the two-column "Extracted vs Brand Kit" preview with per-field arrow indicators today. Phase 77 owns the actual per-field merge at emit time; this surface is the user-facing preview.
- **LayoutSketch deterministic bands.** Hook y bands: top=15, center=70, bottom=115. Body lines: tight=5, medium=3, airy=1. Decoration circles: dense=4, moderate=2, sparse=0. Tests pin counts + coordinates without snapshot churn.
- **jsdom-tolerant inline-style assertions** for backgroundColor (rgb-or-hex contract documented for future test authors).
- **Per-component LEGAL-03 grep tests** in addition to the panel-level integration grep. Drift in any single component fails CI before Phase 79's project-wide gate lands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 3 in palette-swatches.test.tsx was overly strict about React's inline-style serialization**
- **Found during:** Task 1 GREEN (first run after implementing PaletteSwatches)
- **Issue:** Test 3 asserted `(swatch.getAttribute('style') ?? '').toLowerCase().toContain('#a8e0b0')`, but React's CSSOM normalizes `#a8e0b0` to `rgb(168, 224, 176)` when serializing the style attribute. The contract is "the inline backgroundColor reflects the input hex," not "the literal hex token must appear in the style string." The component is correct — the test assertion was the bug.
- **Fix:** Loosened the assertion to accept EITHER the original hex OR the rgb-equivalent (`rgb(168, 224, 176)` with optional whitespace). Also added a sanity check that `swatch.style.backgroundColor.length > 0` to confirm React preserved the value as a non-empty CSS color.
- **Files modified:** `src/components/style-from-reference/__tests__/palette-swatches.test.tsx`
- **Verification:** All 6 PaletteSwatches tests + all 21 Task 1 tests now GREEN.
- **Committed in:** `a14b7f2` (Task 1 GREEN commit)
- **Pattern documented:** Added to `tech-stack.patterns` so future authors of inline-style tests don't re-trip the same gotcha.

---

**Total deviations:** 1 auto-fixed (Rule 1 bug — test assertion was overly strict about React's CSSOM serialization)
**Impact on plan:** Zero. Fix was contained to the test file; component implementation is unchanged. No scope creep, no missed requirements.

## Issues Encountered

- **Pre-existing TypeScript errors in unrelated test files** (same set Plan 76-01's SUMMARY documented under SCOPE BOUNDARY: `src/__tests__/auth/*.test.ts`, `src/__tests__/api/api-keys.test.ts`, `src/__tests__/projects/crud.test.ts`, `src/__tests__/stripe/*`, `src/components/editor/__tests__/slide-editor.treatment-sync.test.tsx`, `src/lib/services/__tests__/projects-delete.test.ts`). These predate Phase 76 and are out of scope. The Phase 76 surface (everything Plan 76-02 touched) is TS-clean.
- **No issues with the actual plan work.** All RED commits failed exactly as expected; all GREEN commits passed on first run modulo the one documented Rule 1 deviation in Test 3.

## Next Phase Readiness

- **Plan 76-03 (Wave 3) is unblocked.** Plan 76-02 only filled slot CONTENT; the structural contract is preserved:
  - `error-mount` slot in `style-from-reference-shell.tsx` is UNTOUCHED — 76-03 owns it.
  - `refusalWarningSlot` ReactNode prop on SpecPreviewPanel is UNTOUCHED — 76-03 will inject inline RefusalWarning chips here.
  - `StickyReferenceStrip`'s `slotPerReference` extension point is UNTOUCHED — 76-03 will use it for per-reference inline refusal-warning chips.
  - Reducer's `state.refusalFlags`, `state.refusalAcknowledged`, and `dispatch({ type: 'CONFIRM_REFUSAL_WARNING' })` are exactly as 76-01 left them — 76-03 wires them.
  - SpecPreviewPanel's existing `refusalAcknowledgedOrAbsent` Generate-disable predicate already gates on the ack flag — 76-03 only needs to render the acknowledgment surface.
- **Phase 77 (emit integration) is unblocked at the seam.** PerAspectToggles dispatches into `state.aspects`; BrandKitRemixToggle dispatches into `state.useBrandKitRemix`. Both flow into the reducer state Phase 77 will read at emit time.

## Self-Check: PASSED

Verified all claimed artifacts exist and all claimed commits are reachable:

**Files created (15/15 found):**
- `src/components/style-from-reference/palette-swatches.tsx` — FOUND
- `src/components/style-from-reference/font-category-badges.tsx` — FOUND
- `src/components/style-from-reference/layout-sketch.tsx` — FOUND
- `src/components/style-from-reference/voice-note-caption.tsx` — FOUND
- `src/components/style-from-reference/per-aspect-toggles.tsx` — FOUND
- `src/components/style-from-reference/brand-kit-remix-toggle.tsx` — FOUND
- `src/components/style-from-reference/credit-cost-display.tsx` — FOUND
- `src/components/style-from-reference/__tests__/palette-swatches.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/font-category-badges.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/layout-sketch.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/voice-note-caption.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/per-aspect-toggles.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/brand-kit-remix-toggle.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/credit-cost-display.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx` — FOUND

**Files modified (1/1 found):**
- `src/components/style-from-reference/spec-preview-panel.tsx` — FOUND

**Commits (6/6 reachable in `git log --oneline`):**
- `43ef671` — FOUND (test: failing tests for 4 spec-preview display components)
- `a14b7f2` — FOUND (feat: 4 spec-preview display components PREVIEW-02..05)
- `5536bbf` — FOUND (test: failing tests for spec-preview controls PREVIEW-06/08/11)
- `687bb66` — FOUND (feat: per-aspect / brand-kit / credit-cost controls)
- `04c62d7` — FOUND (test: failing integration tests for SpecPreviewPanel slot fills)
- `5272372` — FOUND (feat: wire 7 children into SpecPreviewPanel slots)

**Verification gates:**
- `npx vitest run src/components/style-from-reference src/app/(dashboard)/style-from-reference` → 77/77 GREEN
- `grep -ciE "exactly like|clone|copy this style|duplicate" src/components/style-from-reference/*.tsx` → 0 across all 10 files
- `grep -c 'data-testid="generate-cta"' src/components/style-from-reference/spec-preview-panel.tsx` → 1 (PREVIEW-01 single-CTA invariant holds)
- `npx tsc --noEmit` for new/modified files → clean (pre-existing unrelated errors unchanged)

---
*Phase: 76-spec-preview-ui-per-aspect-controls-re-extract-recovery*
*Completed: 2026-05-11*
