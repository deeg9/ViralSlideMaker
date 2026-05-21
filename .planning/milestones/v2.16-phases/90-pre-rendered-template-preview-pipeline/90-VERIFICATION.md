---
phase: 90-pre-rendered-template-preview-pipeline
verified: 2026-05-21T04:02:19Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Open the project picker and visually inspect all picker-visible template tiles + the 16 cover PNGs in the template-previews bucket"
    expected: "Each tile shows a real photo-backed cover (or, for the 6 backgroundMode:'color'/pure-typography templates, an intentional flat-color cover) with legible sample text; no broken-image glyphs, no unflattering covers"
    why_human: "Visual quality of generated PNGs cannot be verified programmatically; the live run already wrote the PNGs to Supabase Storage (operator observation), not re-verifiable from the codebase"
  - test: "Run tests/e2e/template-picker-previews.spec.ts against an authenticated dev session (set E2E_PROJECT_URL + auth storage state)"
    expected: "Every picker tile is an <img> with non-empty src and naturalWidth > 0; zero [data-testid=slide-preview] nodes"
    why_human: "The picker is on the auth-gated /project/[id] route; the spec test.skip()s cleanly (3 skipped) when unauthenticated, so the end-to-end browser assertion needs an authenticated environment"
---

# Phase 90: Pre-Rendered Template Preview Pipeline Verification Report

**Phase Goal:** Replace the picker's live-render `<SlidePreview>` fallback with real photo-backed preview PNGs sourced from `christopherfill9@gmail.com`'s published carousels. Every code template gets a `preview` URL; the picker becomes a single-branch `<img>` component.
**Verified:** 2026-05-21T04:02:19Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Every code template (16 in `src/lib/render/templates/*.ts`, incl. `y2k-pop`) carries a non-empty, https URL-shaped `preview` field pointing at the `template-previews` bucket | ✓ VERIFIED | `grep -lE "preview:\s*'https" src/lib/render/templates/*.ts \| wc -l` = 16; `grep -l "storage/v1/object/public/template-previews/code-templates" ...` = 16. Forcing-function test `code-template-previews.test.ts` iterates all 16 `templates[]` entries — **1/1 GREEN** |
| 2   | The picker tile `<TemplateTilePreview>` is a single-branch `<img>` component — the `<SlidePreview>` fallback and `makeSampleSlide`/`SlidePreview` imports are deleted | ✓ VERIFIED | `grep -E "SlidePreview\|makeSampleSlide" src/components/slides/template-tile-preview.tsx` returns nothing; file is 18 lines, single `return <img src={template.preview} ...>`. `template-picker.tsx` does not import `makeSampleSlide` |
| 3   | The one-off pipeline `scripts/render-template-previews.ts` exists, is idempotent, and its pure-helper tests are green | ✓ VERIFIED | Script present (615 lines), exports `buildGapMap`/`previewStoragePath`/`rewriteTemplateSource`/`main`; helper test `render-template-previews.test.ts` **13/13 GREEN** incl. idempotency assertion; `upsert:true` ×3, `upsert:false`/`imageSource:'ai'` = 0 |
| 4   | The picker tests are rewritten to the `<img>` contract and the Playwright smoke exists | ✓ VERIFIED | `template-tile-preview.test.tsx` + `template-picker.test.tsx` **10/10 GREEN**, zero `slide-preview` testid assertions; `tests/e2e/template-picker-previews.spec.ts` exists, no `test.fixme`, asserts `naturalWidth` + zero `slide-preview` nodes |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `scripts/render-template-previews.ts` | Pipeline w/ exported pure helpers + `--dry-run` | ✓ VERIFIED | 615 lines, 4 named exports, all 4 RESEARCH pitfalls baked in, WR-03/04/05 hardening (commit 58e440e) |
| `scripts/__tests__/render-template-previews.test.ts` | Pure-helper unit tests | ✓ VERIFIED | 13/13 GREEN |
| `src/lib/render/templates/__tests__/code-template-previews.test.ts` | Forcing-function test, GREEN | ✓ VERIFIED | 1/1 GREEN — data-driven over all 16 `templates[]` entries |
| `src/lib/render/templates/*.ts` (×16) | Each carries a `preview:` URL line | ✓ VERIFIED | 16/16 wired to `template-previews/code-templates/{slug}.png` |
| `src/components/slides/template-tile-preview.tsx` | Single-branch `<img>`, ≤25 lines | ✓ VERIFIED | 18 lines, single `<img>`, no fallback imports |
| `src/components/slides/__tests__/template-tile-preview.test.tsx` | Rewritten to `<img>` contract | ✓ VERIFIED | GREEN, uses `queryByTestId` for null-assertion |
| `src/__tests__/components/template-picker.test.tsx` | Rewritten to `<img>`-count contract | ✓ VERIFIED | GREEN, uses `getAllByRole('img')`, WIRE-01 block preserved |
| `tests/e2e/template-picker-previews.spec.ts` | Finalized Playwright smoke | ✓ VERIFIED | Exists, no `test.fixme`, `naturalWidth` + zero-`slide-preview` assertions |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `template-tile-preview.tsx` | `template.preview` URL | `<img src={template.preview}>` | ✓ WIRED | 1 match for `src={template.preview}` |
| `template-picker.tsx` | `<TemplateTilePreview>` | import + JSX at line 70 | ✓ WIRED | Picker renders the single-branch tile |
| `render-template-previews.ts` | `renderCoverPreviewPng` | import (line 35) | ✓ WIRED | Cover-snapshot primitive |
| `render-template-previews.ts` | `generateCarousel` | lazy `await import` (line 477) | ✓ WIRED | Gap-fill generation, lazily imported to keep dry-run hermetic |
| `render-template-previews.ts` | `resolveTemplate` | import (line 34) | ✓ WIRED | Pitfall-1 mitigation present |
| `templates/*.ts` `preview` field | `template-previews` Storage bucket | public URL written by the script | ✓ WIRED | All 16 URLs match `storage/v1/object/public/template-previews/code-templates` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `template-tile-preview.tsx` | `template.preview` | The 16 wired `preview:` URLs in `templates/*.ts` (static config set by the live pipeline run) | Yes — all 16 are concrete https Supabase URLs | ✓ FLOWING (programmatically). The PNGs the URLs point to were written by the Plan-02 live run — that object existence is an operator observation, surfaced for human verification |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Forcing-function test green | `vitest run code-template-previews.test.ts` | 1/1 passed | ✓ PASS |
| Pure-helper tests green | `vitest run render-template-previews.test.ts` | 13/13 passed | ✓ PASS |
| Picker + tile-preview tests green | `vitest run template-tile-preview.test.tsx template-picker.test.tsx` | 10/10 passed | ✓ PASS |
| Render-parity fixture suites green (HARD GATE) | `vitest run legacy-templates-byte-identical legacy-templates-regression new-templates-parity` | 45/45 passed | ✓ PASS |
| tsc error count ≤ 20 (HARD GATE) | `tsc --noEmit \| grep -cE 'error TS'` | 20 | ✓ PASS |
| tsc — zero errors in phase-90 files (HARD GATE) | grep filtered to phase-90 files | none | ✓ PASS |
| E2E picker smoke against auth-gated route | `playwright test template-picker-previews.spec.ts` | 3 skipped (per 90-03-SUMMARY) | ? SKIP — needs authenticated env (routed to human verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PREVIEW-01 | 90-02 | Every code template has a `preview` field set to a public Supabase Storage URL | ✓ SATISFIED | 16/16 templates wired; forcing-function test GREEN. (REQUIREMENTS.md says "15" — known stale count omitting `y2k-pop`, documented in all 3 PLANs; 16 implemented = superset, no scope loss) |
| PREVIEW-02 | 90-02 | Preview PNGs sourced from `christopherfill9@gmail.com`'s carousels (gap-detect + generate) | ✓ SATISFIED (code) / human-confirm (live run) | Script queries the account, gap-fills via `generateCarousel`; 90-02-SUMMARY documents the live run (6 exemplars / 10 gaps). PNG existence in Storage = operator observation |
| PREVIEW-03 | 90-01 | One-off `scripts/render-template-previews.ts` automating gap-detect, snapshot, upload, source rewrite; idempotent | ✓ SATISFIED | Script present, 4 exported helpers, idempotent rewriter (test-proven), `--dry-run`, deterministic `code-templates/{slug}.png` paths |
| PREVIEW-04 | 90-03 | `<TemplateTilePreview>` simplified to single-branch `<img>`; `<SlidePreview>` fallback + `makeSampleSlide` import deleted | ✓ SATISFIED | Component is 18-line single `<img>`; no `SlidePreview`/`makeSampleSlide` in `template-tile-preview.tsx` or `template-picker.tsx` |
| PREVIEW-05 | 90-03 | Playwright smoke confirms all code/DB templates render as `<img>` with valid src, no broken images; `template-picker.test.tsx` updated | ✓ SATISFIED (unit) / human-confirm (e2e) | `template-picker.test.tsx` rewritten + GREEN; e2e spec finalized. Browser-level smoke needs an authenticated env (skips cleanly otherwise) — routed to human verification |

All 5 PREVIEW IDs declared across the 3 PLAN frontmatter blocks are accounted for and map cleanly to REQUIREMENTS.md. No orphaned requirements — REQUIREMENTS.md maps exactly PREVIEW-01..05 to Phase 90, all 5 claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `template-tile-preview.tsx` | 13 | `<img>` has no `onError` fallback for a missing/404 `preview` | ℹ️ Info | Pre-noted as REVIEW IN-03; all 16 code templates carry a `preview`, so no current breakage. DB templates without a `preview` would render a broken-image glyph. Not a phase-90 blocker — the broken image IS the intended forcing function per 90-CONTEXT |

No blocker- or warning-tier anti-patterns. The 5 code-review warnings (WR-01..WR-05) were all addressed: WR-01/02 fixed in commit `e21fd3a` (`flexWrap`/`flex-wrap` confirmed present in both `resolve-overlay.ts` and `render-slide.ts`); WR-03/04/05 fixed in commit `58e440e` (script hardening — per-template error recovery, brace-depth-counting rewriter, pagination fix).

### Human Verification Required

#### 1. Visual review of the 16 preview PNGs

**Test:** Open the project picker and visually inspect all picker-visible template tiles; also spot-check the 16 cover PNGs in the Supabase `template-previews/code-templates/` bucket.
**Expected:** Each tile shows a real photo-backed cover (or, for the 6 `backgroundMode:'color'`/pure-typography templates — `y2k-pop`, `bold-yellow`, `brutalist-grid`, `paper-essay`, `sunset-tabloid`, `soft-sage` — an intentional flat-color cover) with legible sample text; no broken-image glyphs, no clearly unflattering covers.
**Why human:** The live pipeline run already wrote the PNGs to Supabase Storage — that is an operator observation, not re-verifiable from the codebase. Generated-image visual quality cannot be judged programmatically. The script is idempotent, so any single unflattering cover can be cheaply re-rendered.

#### 2. End-to-end Playwright picker smoke against an authenticated session

**Test:** Run `npx playwright test tests/e2e/template-picker-previews.spec.ts --reporter=line` with `E2E_PROJECT_URL` set and an authenticated storage state configured.
**Expected:** Every picker tile is an `<img>` with a non-empty `src` and `naturalWidth > 0`; zero `[data-testid="slide-preview"]` nodes.
**Why human:** The picker lives on the auth-gated `/project/[id]` route; with no auth state the spec `test.skip()`s cleanly (3 skipped, the intended non-flaky behavior). The full browser-level assertion needs an authenticated environment. Note the single-branch `<img>` contract IS already proven in jsdom by the GREEN `template-picker.test.tsx`, which renders the real `<TemplatePicker>` and asserts `getAllByRole('img').length === pickerTemplates.length`.

### Gaps Summary

No gaps. All 4 observable truths are VERIFIED in the codebase, all 8 required artifacts pass all verification levels (exist, substantive, wired, data flowing), and all 6 key links are wired. All 5 PREVIEW requirement IDs are satisfied. All HARD GATES pass: tsc = 20 errors (≤ 20, none in phase-90 files), the 3 render-parity fixture suites are 45/45 GREEN, and the 5 code-review warnings (WR-01..WR-05) were fixed in commits `e21fd3a` + `58e440e` — `flexWrap`/`flex-wrap` confirmed present in `resolve-overlay.ts` and `render-slide.ts`.

Phase 90 introduces zero new test failures: the +2 picker-test delta that Plan 90-02 temporarily incurred was resolved by Plan 90-03 (both rewritten picker tests are now GREEN). The pre-existing ~66 base-SHA failures are documented and not phase-90 regressions.

Status is `human_needed` (not `passed`) solely because two items intrinsically require human/authenticated verification: (1) the visual quality of the generated PNGs and the operator-observed live-run upload, and (2) the end-to-end Playwright smoke on the auth-gated picker route. Both are expected, well-documented limitations — not defects. The phase goal is structurally and behaviorally achieved in the codebase.

---

_Verified: 2026-05-21T04:02:19Z_
_Verifier: Claude (gsd-verifier)_
