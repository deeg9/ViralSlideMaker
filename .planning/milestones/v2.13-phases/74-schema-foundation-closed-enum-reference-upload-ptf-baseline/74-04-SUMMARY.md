---
phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline
plan: 04
plan_number: 4
subsystem: parity-testing
tags: [parity, ptf-baseline, style-spec, slide-type, regression-gate, tplrend-05, stylespec-11, stylespec-12]
requirements:
  - STYLESPEC-11
  - STYLESPEC-12
  - PARITY-01
dependency_graph:
  requires:
    - 74-01  # StyleSpec type (type-only import for compat assertion)
    - 74-02  # projects.style_spec / reference_assets columns (jsonb-nullable)
    - Phase 67 Plan 02 PTF16  # mirrored verbatim
    - Phase 65 Plan 03 PTF fingerprint helpers (computeStructuralFingerprint, fingerprintFixtureSlide)
  provides:
    - PTF74 fingerprint baseline (48 snapshots) — load-bearing regression gate for Phases 75/76/77/78/79
    - STYLESPEC-12 invariant test — Slide-type drift detection
  affects:
    - All future PRs touching src/lib/types/slide.ts (will trip STYLESPEC-12)
    - All future PRs touching renderers (will trip PTF74 if they branch on style_spec)
tech_stack:
  added:
    - "@ts-expect-error directive precision (per-property, not per-object)"
  patterns:
    - "Idempotent absence (null ≡ undefined) via direct string equality"
    - "Source-grep + AST-via-regex for type-shape invariants"
    - "Snapshot baseline as load-bearing committed artifact"
key_files:
  created:
    - src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx
    - src/lib/render/__tests__/__snapshots__/parity.style-spec-absent-baseline.test.tsx.snap
    - src/lib/types/__tests__/slide-zero-new-fields.test.ts
  modified: []
key_decisions:
  - "Mirrored Phase 67 Plan 02 PTF16 verbatim — same 12-template × 2-renderer matrix, same fingerprint helper, same equiv pattern"
  - "Reused fingerprintFixtureSlide + computeStructuralFingerprint from Phase 65 Plan 03 — zero fixture duplication"
  - "Type-only StyleSpec import asserts Plan 74-01 compat without any runtime coupling between renderer and spec"
  - "V212_TRAILING_EDGE_SLIDE_FIELDS pinned at 16 fields (planning-time approximation said 14 — corrected after direct read of slide.ts)"
  - "@ts-expect-error placed on the offending property line, not the enclosing object opener — TS2578 only suppresses when adjacent to the actual error"
metrics:
  duration_minutes: 4
  completed_date: 2026-05-10
  tasks_completed: 2
  tests_written: 89  # 74 PTF74 + 15 STYLESPEC-12
  tests_passing: 89
  snapshots_committed: 48
  files_created: 3
  files_modified: 0
---

# Phase 74 Plan 04: PTF Baseline + Slide Zero-New-Fields Invariant Summary

**One-liner:** Locks v2.12 trailing-edge rendering parity (48 fingerprint snapshots across 12 templates × 2 renderers) AND captures the Slide field set as a frozen invariant — both gates BEFORE Phase 75 vision-extraction code lands.

## What Shipped

### Task 1: PTF74 style-spec-absent baseline
**Commit:** `a009f37` — `test(74-04): PTF74 style-spec-absent baseline locks legacy v2.12 rendering`

- **74 tests GREEN** (12 templates × 6 cases per template + 2 sanity tests)
- **48 fingerprint snapshots committed** (12 templates × 2 renderer paths × 2 cases [null + undef])
- **6 cases per template:**
  - PTF74-null-Na: SlidePreview + style_spec=null → snapshot
  - PTF74-null-Nb: Satori + style_spec=null → snapshot
  - PTF74-undef-Na: SlidePreview + style_spec=undefined → snapshot
  - PTF74-undef-Nb: Satori + style_spec=undefined → snapshot
  - PTF74-equiv-Na: null-fingerprint EXACTLY EQUALS undef-fingerprint via SlidePreview (direct string equality)
  - PTF74-equiv-Nb: null-fingerprint EXACTLY EQUALS undef-fingerprint via Satori (direct string equality)
- **2 sanity tests:**
  - registry sanity (templates.length === 12)
  - project shape sanity (legacy fixture accepts style_spec=null + reference_assets=null AND slide-level shape unaffected)

**Byte-identity verification (extra rigor):** The 48 PTF74 snapshots were programmatically diffed against the existing 48 PTF16-undef snapshots from Phase 67 Plan 02. **All 48 pairs are byte-identical** — empirical proof that both renderers (SlidePreview React preview + Satori React tree) are upstream-blind to style_spec / reference_assets. The renderer cannot read what isn't on the slide.

### Task 2: STYLESPEC-12 Slide zero-new-fields invariant
**Commit:** `fc7ef93` — `test(74-04): STYLESPEC-12 Slide zero-new-fields invariant`

- **15 tests GREEN** (1 field-set equality + 1 field-count + 6 forbidden-spec greps + 4 forbidden-freetext greps + 2 type-level + 1 phase-stamp)
- **V212_TRAILING_EDGE_SLIDE_FIELDS** pinned at 16 fields with phase-by-phase provenance:
  `hook_text`, `body_text`, `hook_segments`, `body_segments`, `image_query`, `is_cta`, `background_url`, `pexels_photo_id`, `style_overrides`, `custom_texts`, `custom_images`, `text_boxes`, `watermark`, `original_source_url`, `template_id_override`, `decorations`
- **6 forbidden v2.13 spec fields** (must not appear on Slide source): `style_spec`, `styleSpec`, `reference_assets`, `referenceAssets`, `styleHints`, `styleHintsApplied`
- **4 forbidden free-text fields** (D-01 closed-enum invariant — must not appear ANYWHERE on Slide source): `reference_artist`, `reference_brand`, `copy_exactly`, `style_freetext`
- **Type-level @ts-expect-error gate** (4 fixtures): catches drift even if grep misses it; if any forbidden field becomes valid on Slide, TS2578 "Unused @ts-expect-error directive" fires at compile time

## STYLESPEC-11 Hard-Constraint Compliance

Per ROADMAP + STYLESPEC-11: PTF baseline test MUST be GREEN and committed BEFORE Phase 75 vision-extraction code lands.

**Verified:**
```
$ git log --oneline -- src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx
a009f37 test(74-04): PTF74 style-spec-absent baseline locks legacy v2.12 rendering

$ git log --oneline --all -- 'src/lib/ai/extract-style-spec*'
(empty — Phase 75 has not started)
```

The PTF74 baseline + STYLESPEC-12 invariant are committed to `main` BEFORE any Phase 75 commit could possibly land. STYLESPEC-11 ordering preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @ts-expect-error placement on enclosing-object line**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** Initial implementation placed `@ts-expect-error` on the `const _bad1: Slide = {` line; TS2578 fired because the directive on an `=` line doesn't suppress an error on a property line several lines below. Net: 4 unused-directive errors + 4 real type errors leaking through.
- **Fix:** Moved each `@ts-expect-error` to the line IMMEDIATELY before the offending property (`style_spec: ...`, `reference_assets: ...`, `styleHints: ...`, `reference_artist: ...`).
- **Files modified:** `src/lib/types/__tests__/slide-zero-new-fields.test.ts`
- **Commit:** `fc7ef93` (post-fix; the bug never landed in a separate commit)

**2. [Plan accuracy correction] V212_TRAILING_EDGE_SLIDE_FIELDS field count**
- **Found during:** Task 2 implementation, on direct read of `src/lib/types/slide.ts`
- **Issue:** PLAN.md approximated the field set at 14 fields with a placeholder list. Direct read of slide.ts (lines 241-281) showed 16 fields actually exported on `Slide` at v2.12 trailing edge.
- **Action:** Captured the actual 16-field set with phase-by-phase provenance comments documenting which Phase introduced each field. Plan explicitly invited this verification ("OPEN src/lib/types/slide.ts and verify the EXACT v2.12 trailing-edge field set...DOCUMENT WHY in a code comment").
- **Not a deviation** — plan permitted + required this correction.

### Out-of-scope discoveries (not addressed)

- Pre-existing uncommitted modifications in `src/app/(dashboard)/project/[id]/page.tsx`, `src/components/layout/{bottom,top}-navbar.tsx`, `src/components/projects/project-list.tsx`, plus untracked `src/components/projects/project-naming-dialog.tsx` + `start-new-project.tsx`. These predate Plan 74-04 and are unrelated to phase 74 scope. Left untouched per scope boundary rule.

## Verification Checklist

- [x] PLAN truth #1: PTF baseline test exists, GREEN, 48 snapshots committed (12 templates × 2 renderers × 2 cases [null + undef])
- [x] PLAN truth #2: STYLESPEC-12 invariant test exists; source-grep snapshot of Slide field names committed; future drift fails
- [x] PLAN truth #3: Test GREEN + committed BEFORE Phase 75 starts (verified by `git log --all` on extract-style-spec*)
- [x] PLAN truth #4: Equivalence assertion — null-fingerprint EXACTLY EQUALS undef-fingerprint per template per renderer (24 equiv assertions, all GREEN via direct string equality)
- [x] PLAN truth #5: Test file mirrors PTF16 structure verbatim (same `computeStructuralFingerprint`, same template-iteration, same SlidePreview + Satori dual-path)
- [x] PLAN artifact: parity.style-spec-absent-baseline.test.tsx — 233 lines, contains `describe('Phase 74` ✓
- [x] PLAN artifact: parity.style-spec-absent-baseline.test.tsx.snap — 97 lines, 48 exports
- [x] PLAN artifact: slide-zero-new-fields.test.ts — 273 lines, contains `STYLESPEC-12` ✓
- [x] PLAN key_link: imports `templates` from `@/lib/render/templates` ✓
- [x] PLAN key_link: type-only import of `StyleSpec` from `@/lib/types/style-spec` ✓
- [x] PLAN key_link: source-greps `src/lib/types/slide.ts` ✓
- [x] `npx tsc --noEmit` clean on both new files
- [x] No tasks deferred or skipped
- [x] Both task commits made; no out-of-scope files staged

## Phase 75 Handoff (Mirror of v2.12 Phase 71's PTF17 Gate)

The CI workflow for any PR touching style-spec / vision-extraction code in Phase 75 should add:

```yaml
- run: npx vitest run src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx
- run: npx vitest run src/lib/types/__tests__/slide-zero-new-fields.test.ts
```

Phase 77 (EMIT-09 byte-identity proof) builds on this baseline: the spec→emit→render path must produce slides that, when style_spec is then redacted, render to a fingerprint within the snapshot baseline (i.e. the projector emits ONLY values that round-trip through both renderers, per EMIT-07).

## Snapshot Baseline Warning (LOAD-BEARING)

The snapshot file `parity.style-spec-absent-baseline.test.tsx.snap` IS the v2.12 trailing-edge baseline. **DO NOT regenerate casually.** If a future PR breaks this test, the correct response is to FIX the breaking change, not to regenerate the snapshot. Regenerating destroys the regression evidence. This warning is also pinned as a header comment in the test file itself.

## Self-Check: PASSED

**File existence:**
- FOUND: src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx
- FOUND: src/lib/render/__tests__/__snapshots__/parity.style-spec-absent-baseline.test.tsx.snap
- FOUND: src/lib/types/__tests__/slide-zero-new-fields.test.ts

**Commit existence:**
- FOUND: a009f37 (Task 1: PTF74 baseline)
- FOUND: fc7ef93 (Task 2: STYLESPEC-12 invariant)

**Test execution:**
- 89/89 tests GREEN (74 PTF74 + 15 STYLESPEC-12)
- 0 errors from `tsc --noEmit` on both new files
- 48 snapshots written + committed

**Hard-constraint compliance:**
- PTF74 commit (a009f37) lands BEFORE any Phase 75 extract-style-spec.ts commit (which does not yet exist)
- STYLESPEC-11 ordering invariant satisfied
