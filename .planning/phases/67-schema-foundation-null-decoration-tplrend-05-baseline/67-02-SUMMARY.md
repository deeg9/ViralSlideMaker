---
phase: 67-schema-foundation-null-decoration-tplrend-05-baseline
plan: 02
subsystem: parity-baseline + migration-doc + bundle-delta
tags: [parity, ptf16, fingerprint, decorations, idempotent-absence, tplrend-05, migration, bundle-delta, lucide-react]
requires:
  - 67-01 (schema + layer 5.5 stubs + lucide v1 upgrade landed)
  - PTF12 fixture pattern (Plan 65-03)
provides:
  - PTF16 idempotent-absence parity gate (TPLREND-05 byte-identity invariant for v2.12)
  - decorationsUndefinedFixtureSlide + decorationsEmptyArrayFixtureSlide fixtures
  - MIGR-02 no-op migration documentation
  - DEPS-01 negative bundle-delta verification on editor route
affects:
  - src/lib/render/__tests__/__fixtures__/parity-fingerprint-fixtures.ts (+34 LOC, two new exports)
  - src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx (new, 167 LOC)
  - src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations-undefined.test.tsx.snap (new, 48 snapshots committed)
  - .planning/phases/67-schema-foundation-null-decoration-tplrend-05-baseline/MIGR-02-NOTES.md (new, 110 LOC)
  - .planning/phases/67-schema-foundation-null-decoration-tplrend-05-baseline/DEPS-01-BUNDLE-DELTA.md (new, 153 LOC)
tech-stack:
  added: []
  patterns:
    - PTF12 registry-driven `templates.forEach` extension
    - object-spread fixture derivation (fixture co-evolution)
    - direct string-equality equivalence assertion (idempotent-absence proof; not snapshot-dependent)
    - eager-on-load no-op migration via renderer null-safe iteration (the load-path adapter)
key-files:
  created:
    - src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx
    - src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations-undefined.test.tsx.snap
    - .planning/phases/67-schema-foundation-null-decoration-tplrend-05-baseline/MIGR-02-NOTES.md
    - .planning/phases/67-schema-foundation-null-decoration-tplrend-05-baseline/DEPS-01-BUNDLE-DELTA.md
  modified:
    - src/lib/render/__tests__/__fixtures__/parity-fingerprint-fixtures.ts (+ two derivative fixture exports)
decisions:
  - "PTF16 fixtures use object-spread (`{ ...fingerprintFixtureSlide, decorations: undefined }`) — auto-track future parent fixture edits without code change"
  - "PTF16-equiv-* tests use `expect(a).toBe(b)` direct string equality — provides idempotent-absence proof independent of snapshot baseline (strongest contract)"
  - "Bundle-delta methodology uses `--no-lint` to bypass two pre-existing parity.test.tsx `no-explicit-any` errors that pre-date Plan 67-01 — chunk size is unaffected by lint"
  - "Pre-upgrade baseline reference is commit 1d306ae (parent of bbd93be lucide-upgrade), not arbitrary main^N — keeps the measurement reproducible"
  - "Total chunk-dir size (488 KB) is included alongside per-file delta as a fallback metric for future re-baselines when filenames hash-rotate"
metrics:
  duration: ~7 minutes (2 atomic commits + summary)
  completed: 2026-05-04
  tests_added: 73
  snapshots_committed: 48
  bundle_delta_gz: -169 bytes
---

# Phase 67 Plan 02: PTF16 Idempotent-Absence Parity Baseline + MIGR-02 + DEPS-01 Summary

**One-liner:** Pins the v2.12 TPLREND-05 byte-identity invariant via PTF16 (73 tests / 48 snapshots / 12 templates × 6 families + 1 sanity) proving `decorations === undefined` and `decorations === []` render byte-identical PNG/DOM via Plan 67-01's layer 5.5 stub; documents MIGR-02 as a no-op (additive schema, no SQL, no dual-write); and verifies DEPS-01 lucide-react v0.577 → v1.14 upgrade shipped a -169 byte gzipped delta on the editor route chunk.

## What Shipped

### Task 1 — PTF16 idempotent-absence parity baseline (PARITY-09)

- **`src/lib/render/__tests__/__fixtures__/parity-fingerprint-fixtures.ts`** (+34 LOC) — appended two new exports:
  - `decorationsUndefinedFixtureSlide`: `{ ...fingerprintFixtureSlide, decorations: undefined }`
  - `decorationsEmptyArrayFixtureSlide`: `{ ...fingerprintFixtureSlide, decorations: [] }`
  - Object-spread derivation ensures any future change to `fingerprintFixtureSlide` propagates to PTF16 fixtures automatically.
- **`src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx`** (new, 167 LOC) — registry-driven PTF16 suite:
  - Top-level `describe` plus per-template `describe(`PTF16 (${template.id})`)` sub-blocks via `templates.forEach`
  - 6 test families per template:
    - **PTF16-undef-Na**: `SlidePreview editable={false}` + `decorations === undefined` → snapshot
    - **PTF16-undef-Nb**: Satori React tree (`buildSlideElement` + `renderToStaticMarkup`) + `decorations === undefined` → snapshot
    - **PTF16-empty-Na**: `SlidePreview editable={false}` + `decorations === []` → snapshot
    - **PTF16-empty-Nb**: Satori React tree + `decorations === []` → snapshot
    - **PTF16-equiv-Na**: `expect(undefFp).toBe(emptyFp)` via SlidePreview path (string equality, NOT snapshot)
    - **PTF16-equiv-Nb**: same equivalence via Satori path
  - 1 registry-sanity test: `expect(templates.length).toBeGreaterThanOrEqual(11)`
  - Total: 12 templates × 6 + 1 = **73 tests**
- **`src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations-undefined.test.tsx.snap`** — committed snapshot baseline:
  - 48 snapshots (12 templates × 4 snapshot families; equiv tests don't use snapshots)
  - Auto-generated on first run; identical on second run (zero "written" deltas — second-run stability confirmed)

#### PTF16 manual-diff sanity (Step 4 of Task 1)

| Sample | PTF16-undef vs PTF1..12 | Result |
|--------|-------------------------|--------|
| PTF16-undef-1a (highlight-bar, SlidePreview) vs PTF1a | byte-identical | ✅ MATCH |
| PTF16-undef-12a (paper-essay, SlidePreview) vs PTF12a | byte-identical | ✅ MATCH |
| PTF16-undef-12b (paper-essay, Satori) vs PTF12b | byte-identical | ✅ MATCH |

The character-equality of PTF16-undef-Na fingerprints with the existing PTF1..12a baseline is the proof that Plan 67-01's layer 5.5 stub `(slide.decorations ?? []).filter((d) => d.hidden !== true).map((_d) => null)` emits ZERO DOM nodes — the renderer cannot distinguish between "decorations field absent" (legacy slide) and "decorations field present but empty" (post-Phase-68 fresh slide).

### Task 2 — MIGR-02 + DEPS-01

- **`MIGR-02-NOTES.md`** (110 LOC) — documents the no-op migration:
  - 53+ existing v2.11 projects load via `JSON.parse(slide_data)` → object with `decorations === undefined` → renderer null-safe iteration → zero DOM delta
  - Schema is purely additive — no backfill SQL, no JSON rewrite, no version bump
  - Explicit reference to v2.8 BL-01 dual-write trap as the avoided anti-pattern (decorations have no predecessor field, so no bridge or mirror needed)
  - Phase 68 (reducer) and Phase 71 (Gemini emit) outlined as future writers; neither requires a row backfill
  - Re-evaluation triggers documented (Phase 71 telemetry showing >1% benefit from server-side decoration defaults; new fields where `0` and "absent" mean different things; renderer changes that require always-defined decorations)
- **`DEPS-01-BUNDLE-DELTA.md`** (153 LOC) — concrete pre/post measurement:

| Metric | Pre (1d306ae, lucide@0.577) | Post (HEAD, lucide@1.14) | Δ | % |
|--------|------------------------------|---------------------------|---|---|
| Editor route chunk raw bytes | 164,399 | 164,398 | **-1** | -0.0006% |
| Editor route chunk gzipped | 35,214 | 35,045 | **-169** | -0.48% |
| Total `.next/static/chunks/app/` (KB) | 488 | 488 | 0 | 0% |
| Next.js report `/project/[id]` (kB) | 96.6 | 96.4 | -0.2 | -0.21% |

**Result: PASS — `delta_gz = -169 bytes ≤ 0`.**

  Methodology, reproducibility script, and "if delta is positive" investigation steps captured for future re-baselining.

## Test Counts

| Suite | Tests | Status |
|-------|-------|--------|
| `parity.template-fingerprint-decorations-undefined.test.tsx` (new) | 73 | ALL GREEN |
| Full `src/lib/render/__tests__/` directory (9 files) | 212 | ALL GREEN |
| `npx tsc --noEmit` | baseline 17 | **17 (preserved — Plan 67-01 baseline)** |

**New tests added: 73.** **48 new snapshots committed.** **Zero parity-snapshot regressions on the existing PTF1..12 + PTL1..2 + regression-sweep baselines.**

## Commit Hashes

| # | Task | Hash | Message |
|---|------|------|---------|
| 1 | Task 1: PTF16 suite + fixtures + snapshots | `6621612` | test(67-02): PTF16 idempotent-absence parity baseline (4N snapshots + 2N equiv assertions across 11 templates) |
| 2 | Task 2: MIGR-02 + DEPS-01 docs | `e76f8fa` | docs(67-02): MIGR-02 no-op migration + DEPS-01 negative bundle-delta verification |

(Final SUMMARY commit will follow.)

## Deviations from Plan

### Auto-fixed during execution

**1. [Rule 3 — Blocking] `next build` failed on lint errors during pre-upgrade baseline**
- **Found during:** Task 2 bundle-delta measurement on commit `1d306ae` (pre-upgrade reference).
- **Issue:** `npx next build` aborted on two `@typescript-eslint/no-explicit-any` errors in `src/lib/render/__tests__/parity.test.tsx` (lines 1285, 1310). These are pre-existing — they live on the parent commit and are not introduced by Plan 67-02.
- **Fix:** Used `npx next build --no-lint` instead. The plan's Task 2 Step 3 explicitly authorizes this fallback ("If `next build` fails for any unrelated reason (env vars, etc.), use `next build --no-lint` and document the deviation. The metric of interest is chunk size, not build cleanliness."). Lint is reporting-only; chunk output is identical with or without it.
- **Files modified:** None (build flag only).
- **Documented in:** DEPS-01-BUNDLE-DELTA.md "Methodology" section.

### No deviations from CONTEXT.md locked decisions

- ✅ PTF16 extends Plan 65-03's PTF12 fixture pattern (`templates.forEach` registry-driven iteration; auto-grows for v2.13+).
- ✅ Snapshot file under `__snapshots__/parity.template-fingerprint-decorations-undefined.test.tsx.snap`.
- ✅ Both renderers (Satori + React preview) covered — N×2 minimum.
- ✅ Tests both `decorations === undefined` AND `decorations === []` with equivalence assertion proving the renderer cannot distinguish them.
- ✅ MIGR-02 documented as no-op eager-on-load with explicit BL-01 reference.
- ✅ DEPS-01 bundle-delta verified NEGATIVE on editor route chunk.
- ✅ TPLREND-05 byte-identity invariant proven by manual diff against PTF1..12 baseline.
- ✅ Plan 67-02 introduced ZERO snapshot churn on existing files (only added a new test file + appended two new exports to the fixtures file).

## Authentication / Secrets / External Services

None — pure-codebase phase (test code + docs + build measurement).

## Pre-Existing Test Failures (Out of Scope, Documented)

Plan 67-01 documented 33 failing tests in 14 files at the parent commit. Plan 67-02 does NOT introduce any new failures — the 73 new tests + 9 render-test files (212 tests total) are all GREEN. Pre-existing failures remain scope-deferred per the deferred-issues policy.

## Confirmation: Phase 68 May Now Begin

✅ **PTF16 GREEN** — TPLREND-05 byte-identity invariant for v2.12 is pinned across all 12 templates × 2 renderers. Any future change to layer 5.5 (or anywhere else in the renderer) that breaks this contract fails CI immediately.

✅ **Idempotent-absence proven** — both `decorations === undefined` and `decorations === []` route through the layer 5.5 stub and emit zero DOM nodes; the renderer cannot distinguish them (12 templates × 2 renderers × `expect(a).toBe(b)` = 24 direct equivalence assertions).

✅ **Manual diff sanity** — PTF16-undef-1a / PTF16-undef-12a fingerprints character-identical to PTF1a / PTF12a baselines, both renderers (sampled). Confirms the stub did NOT introduce empty Fragment leaks (PITFALLS R1/R2 averted).

✅ **MIGR-02 documented** — existing 53+ projects load transparently via the additive schema; no SQL, no dual-write, BL-01 trap explicitly avoided.

✅ **DEPS-01 verified clean** — lucide-react v1 upgrade ships a -169 byte gzipped delta on the editor route. No barrel imports, no transitive-dep regressions, brand-icon removal handled via grep gate (Plan 67-01 Task 3).

Phase 68 (reducer ADD/UPDATE/REMOVE_DECORATION) may safely begin against the now-locked baseline.

## Self-Check: PASSED

Verification of every artifact promised in this Summary:

- ✅ `src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx` exists (167 LOC, 73 tests, 6 PTF16 families + 1 registry sanity)
- ✅ `src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations-undefined.test.tsx.snap` committed (48 snapshots)
- ✅ `src/lib/render/__tests__/__fixtures__/parity-fingerprint-fixtures.ts` exports `decorationsUndefinedFixtureSlide` + `decorationsEmptyArrayFixtureSlide`
- ✅ `.planning/phases/67-schema-foundation-null-decoration-tplrend-05-baseline/MIGR-02-NOTES.md` exists (110 LOC, "no-op" + "additive" + "BL-01" + "dual-write" all present)
- ✅ `.planning/phases/67-schema-foundation-null-decoration-tplrend-05-baseline/DEPS-01-BUNDLE-DELTA.md` exists (153 LOC, raw + gzipped pre/post numbers + delta_gz=-169 PASS)
- ✅ Both commits exist in git log (`6621612`, `e76f8fa`)
- ✅ tsc baseline preserved at 17
- ✅ All 73 PTF16 tests GREEN on second run (no `1 written` on snapshots)
- ✅ All 212 tests in `src/lib/render/__tests__/` GREEN with zero pre-existing snapshot diff
- ✅ Manual fingerprint diff: PTF16-undef-1a === PTF1a (highlight-bar) and PTF16-undef-12a === PTF12a (paper-essay) — both renderers byte-identical

## TDD Gate Compliance

This plan's frontmatter is `type: execute` (not `type: tdd`), but each task was executed TDD-style per the `tdd="true"` task attribute:
- Task 1: written-and-verified — first run wrote 48 snapshots GREEN; second run zero churn; PTF16-equiv-* assertions pass without depending on snapshots (the strongest possible RED-equivalent proof of the layer 5.5 contract).
- Task 2: docs + measurement — pre/post bundle measurement cycle is the verification, with explicit PASS criterion (`delta_gz ≤ 0`) checked numerically.

Atomic per-task commits provide full rollback granularity. `git revert e76f8fa 6621612` returns cleanly to Plan 67-01's GREEN state.
