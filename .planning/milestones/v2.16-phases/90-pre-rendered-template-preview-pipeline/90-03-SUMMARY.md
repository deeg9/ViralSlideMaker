---
phase: 90-pre-rendered-template-preview-pipeline
plan: 03
subsystem: template-preview-pipeline
tags: [picker, single-branch-img, test-rewrite, playwright-e2e, forcing-function]
requires:
  - "src/lib/render/templates/*.ts — all 16 code templates carry a `preview` URL (from 90-02)"
  - "tests/e2e/template-picker-previews.spec.ts — Playwright skeleton (test.fixme) from 90-01"
provides:
  - "src/components/slides/template-tile-preview.tsx — single-branch <img> (the <SlidePreview> fallback deleted)"
  - "src/components/slides/__tests__/template-tile-preview.test.tsx — rewritten to the single-branch <img> contract"
  - "src/__tests__/components/template-picker.test.tsx — rewritten to count <img> tiles, no slide-preview testids"
  - "tests/e2e/template-picker-previews.spec.ts — finalized picker smoke (no test.fixme)"
affects:
  - "src/components/slides/template-tile-preview.tsx (collapsed two branches to one)"
  - "src/components/slides/__tests__/template-tile-preview.test.tsx (rewritten)"
  - "src/__tests__/components/template-picker.test.tsx (TPLTHUMB-02 block rewritten; WIRE-01 block untouched)"
  - "tests/e2e/template-picker-previews.spec.ts (finalized)"
tech-stack:
  added: []
  patterns:
    - "Playwright auth-gated route smoke: navigate, detect a /login redirect, test.skip() with a clear message — non-flaky when no auth state is configured"
    - "Picker tiles carry no wrapper testid — <TemplateTilePreview> emits <img alt=\"Preview of {name}\">, so e2e locates tiles by that alt-text contract"
key-files:
  created:
    - ".planning/phases/90-pre-rendered-template-preview-pipeline/90-03-SUMMARY.md"
  modified:
    - "src/components/slides/template-tile-preview.tsx"
    - "src/components/slides/__tests__/template-tile-preview.test.tsx"
    - "src/__tests__/components/template-picker.test.tsx"
    - "tests/e2e/template-picker-previews.spec.ts"
decisions:
  - "Fixed a stale pre-existing test bug: the TPLTHUMB-02 Phase-56 test asserted notes-app-chic renders as a visible picker tile, but notes-app-chic is in HIDDEN_FROM_PICKER (added by Phase 82 keeper filtering) — only editorial-serif is a genuinely visible Phase-56 keeper. This failure was masked until now by the two getAllByTestId('slide-preview') failures the same block carried."
  - "The e2e picker smoke targets the auth-gated /project/[id] route; the spec navigates and test.skip()s with a clear message when redirected to /login, so it is committed and runnable but non-flaky in an unauthenticated environment. The equivalent single-branch <img> contract is fully proven by the green template-picker.test.tsx, which renders the real <TemplatePicker> and asserts getAllByRole('img').length === pickerTemplates.length."
metrics:
  duration: ~25m
  completed: 2026-05-20
requirements: [PREVIEW-04, PREVIEW-05]
---

# Phase 90 Plan 03: Picker Simplification + Tests Summary

`<TemplateTilePreview>` collapsed from a two-branch (PNG-or-live-render) component
to a single-branch `<img>` — the `<SlidePreview>` fallback and its dead
`makeSampleSlide` / `SlidePreview` imports are deleted. The two unit tests that
asserted the deleted fallback are rewritten to the `<img>` contract, and the
Plan-01 Playwright picker smoke is finalized. The +2 forcing-function test
failures from Plan 02 are now RESOLVED.

## What Was Done

**Task 1 — Collapse `template-tile-preview.tsx` + rewrite its unit test** (commit `a79afdc`)
- `src/components/slides/template-tile-preview.tsx` — deleted the `if (template.preview ...)`
  branch, the `<SlidePreview>` fallback `return`, and the two now-unused imports
  (`makeSampleSlide`, `SlidePreview`). The component is now 18 lines: it always
  renders exactly one `<img src={template.preview} alt={`Preview of ${template.name}`}>`.
  The stale Phase-86 two-branch doc-comment was replaced with the Phase-90
  single-branch forcing-function rationale.
- `src/components/slides/__tests__/template-tile-preview.test.tsx` — deleted the
  `renders <SlidePreview> ... when template.preview is absent` test (that branch
  is gone). Generalized the surviving tests so a CODE template fixture (now
  carrying a `preview` URL) also asserts `getByRole('img')` + the correct `src` +
  `queryByTestId('slide-preview') === null`. 3/3 GREEN.
- `src/lib/render/sample-slide.ts` and `src/components/slides/slide-preview.tsx`
  were NOT touched — those modules stay (`scripts/generate-template-thumbnails.ts`
  still imports `makeSampleSlide`). `template-picker.tsx` was NOT touched — it
  never imported `makeSampleSlide`.

**Task 2 — Rewrite `template-picker.test.tsx` + finalize the Playwright smoke** (commit `bed6308`)
- `src/__tests__/components/template-picker.test.tsx` — in the TPLTHUMB-02 block,
  replaced both `screen.getAllByTestId('slide-preview')` calls with
  `screen.getAllByRole('img')` (expected count stays `pickerTemplates.length` —
  one `<img>` per visible tile). Renamed the test/comment text away from
  "SlidePreview" to "preview img". The WIRE-01 DB-template-merge block and the
  "Selected indicator" test were left UNCHANGED. 7/7 GREEN.
- `tests/e2e/template-picker-previews.spec.ts` — removed the `test.fixme`
  skeleton markers and the SKELETON banner. The finalized spec navigates to the
  picker route, locates tiles by `img[alt^="Preview of "]` (the actual
  `<TemplateTilePreview>` contract — the picker has no wrapper testid), and
  asserts: every tile `<img>` has a non-empty `src`, zero
  `[data-testid="slide-preview"]` nodes, and `naturalWidth > 0` per tile (no
  broken images). Because the picker is on the auth-gated `/project/[id]` route,
  the spec `test.skip()`s with a clear message if redirected to `/login`.

## Playwright Smoke Verdict

The finalized spec was run against the live local dev server (reachable at
`http://localhost:3000`, HTTP 200):

```
npx playwright test tests/e2e/template-picker-previews.spec.ts --reporter=line
→ 3 skipped
```

All 3 specs **skipped cleanly** — the picker route is auth-gated and, with no
authenticated storage state configured in this environment, the spec navigated,
detected the `/login` redirect, and `test.skip()`d with the documented message
(set `E2E_PROJECT_URL` + an auth state to run the full assertion). This is the
intended non-flaky behavior, not a failure.

The equivalent single-branch `<img>` contract IS fully verified by the rewritten
`template-picker.test.tsx`, which renders the **real `<TemplatePicker>`** in
jsdom and asserts `getAllByRole('img').length === pickerTemplates.length` with
zero `slide-preview` nodes — proving every visible tile is an `<img>`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale Phase-56 assertion — `notes-app-chic` is hidden from the picker**
- **Found during:** Task 2 — after swapping `getAllByTestId('slide-preview')` →
  `getAllByRole('img')`, the TPLTHUMB-02 test
  `renders visible Phase 56 templates (editorial-serif, notes-app-chic) ...`
  still failed: `Unable to find an element with the text: Notes App Chic`.
- **Issue:** The test's `visiblePhase56Templates` array included `notes-app-chic`,
  but `notes-app-chic` is a member of `HIDDEN_FROM_PICKER`
  (`src/lib/render/templates/index.ts`) — added by the Phase-82 keeper filtering.
  The keeper-filtered `pickerTemplates` is exactly 5 templates
  (`news-oracle`, `tr3nding-news`, `bold-yellow`, `editorial-serif`, `y2k-pop`);
  among the Phase-56 templates only `editorial-serif` is genuinely visible.
  The test bug pre-dates this plan — it was masked because the same TPLTHUMB-02
  block carried two `getAllByTestId('slide-preview')` assertions that failed
  first (the Plan-02 forcing-function fallout), so this third failure never
  surfaced until those were fixed.
- **Fix:** Removed `notes-app-chic` from `visiblePhase56Templates` (leaving
  `editorial-serif`), renamed the test, and updated the comment to note that
  both `notes-app-chic` and `brutalist-grid` are hidden via `HIDDEN_FROM_PICKER`.
  In scope — Task 2 explicitly rewrites the TPLTHUMB-02 tile-counting tests.
- **Files modified:** `src/__tests__/components/template-picker.test.tsx`
- **Commit:** `bed6308`

### Scope Note — e2e route selector

The Plan-01 skeleton located tiles via `[data-testid="template-tile"] img`, but
`template-picker.tsx` renders NO `data-testid="template-tile"` wrapper (verified).
The finalized spec locates tiles by `img[alt^="Preview of "]` — the actual
contract `<TemplateTilePreview>` emits. This is a selector correction within the
plan's explicit "finalize the spec" instruction, not a behavior change.

## Verification Results

- **`<TemplateTilePreview>` is single-branch** —
  `grep -c "makeSampleSlide\|SlidePreview\|slide-preview" src/components/slides/template-tile-preview.tsx`
  returns **0**; `grep -c "src={template.preview}"` returns **1**; component is
  **18 lines** (≤ 25).
- **`template-tile-preview.test.tsx`** — `npx vitest run` **3/3 GREEN**; zero
  `getByTestId('slide-preview')` assertions remain (a `queryByTestId(...) === null`
  assertion is present and expected).
- **`template-picker.test.tsx`** — `npx vitest run` **7/7 GREEN** (including the
  unchanged WIRE-01 DB-template-merge block); `grep -c "slide-preview"` returns
  **0**; `getAllByRole('img')` appears **3×**.
- **`tests/e2e/template-picker-previews.spec.ts`** — finalized: zero `test.fixme`,
  asserts zero `[data-testid="slide-preview"]` nodes and `naturalWidth > 0` per
  tile; runs `3 skipped` against the live dev server (auth-gated route — clean
  documented skip).
- **`npx tsc --noEmit`** — **20 errors** (== baseline); **zero** in any
  phase-90-touched file.
- **3 render-parity fixture suites** (`legacy-templates-byte-identical`,
  `legacy-templates-regression`, `new-templates-parity`) — **45/45 GREEN**.
- **Full `npx vitest run`** — **65 failed / 3333 passed / 9 skipped** (3408
  total). Plan 02's `main` baseline was **68 failed** (66 pre-v2.16 baseline + 2
  intended forcing-function failures). After this plan: the +2 forcing-function
  failures (`template-picker.test.tsx`, `template-tile-preview.test.tsx`) are
  **RESOLVED** (68 → 66), and the one stale Phase-56 test bug fixed here drops it
  further (66 → 65). **Zero new failures**; the +2 Plan-02 delta is fully
  resolved as the critical constraint required.

## Self-Check: PASSED

- All 4 modified files verified present on disk
  (`template-tile-preview.tsx`, `template-tile-preview.test.tsx`,
  `template-picker.test.tsx`, `template-picker-previews.spec.ts`).
- Both task commits (`a79afdc`, `bed6308`) verified in `git log`.
- SUMMARY.md created at the phase directory path.
