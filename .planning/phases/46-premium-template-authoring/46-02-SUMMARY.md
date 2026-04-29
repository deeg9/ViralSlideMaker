---
phase: 46-premium-template-authoring
plan: 02
subsystem: testing
tags: [testing, vitest, snapshot, regression, dom-signature, parity, premium-templates, legacy-regression, satori, slide-preview]

# Dependency graph
requires:
  - phase: 44-template-schema-foundation
    provides: SlideTemplate.overlays + backgroundMode + TextSegment.highlightColor/highlightStyle schema (consumed by the test fixtures)
  - phase: 45-renderer-composition
    provides: buildSlideElement (Satori path) + <SlidePreview> overlay/backgroundMode wiring + setup.ts jsdom polyfills (ResizeObserver + getBoundingClientRect)
  - phase: 46-premium-template-authoring (Plan 46-01)
    provides: 3 new premium templates + 8-template registry + sample data
provides:
  - Satori snapshot suite for the 3 new premium templates (3 tests, 3 stored snapshots) — locked tokens (#A8E0B0, TR3NDING, linear-gradient, 1/5) verified to materialize
  - Legacy-template regression gate (5 tests, 5 stored snapshots) — TPLNEW-05 sealed; baseline file proven free of Phase 45 layer markers (bottom-card / bg-bleed / overlay-*)
  - DOM-signature parity tests for the 3 new premium templates rendered through <SlidePreview> (13 tests, no snapshots) — testid hooks + parity-locked pill <span> markup + box-decoration-break exclusion
  - Phase 46 functionally complete (TPLNEW-01..04 from 46-01 + TPLNEW-05 from this plan = 5/5)
affects: [phase-47-ai-prompt-tuning, phase-48-template-thumbnails-and-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "jsdom hex→rgb tolerant matcher (styleHasColor) — accepts either #HEX or rgb(r,g,b) form, mirrors Plan 45-03 precedent in slide-preview-overlays.test.tsx for templates that use #A8E0B0 or #000000 tokens"
    - "Snapshot regression gate file pattern — drives a closed list of legacy template ids through buildSlideElement with a fixed Slide fixture; sanity-asserts overlays/backgroundMode remain undefined; structural-only (no segments / custom_texts) for a stable baseline"
    - "Tree-walk + targeted assertion pattern colocated in test files (helpers inlined per Plan 45-02 — no cross-file helper exports yet); style-equality on `#A8E0B0` checks both `background` and `backgroundColor` props because Satori React tree preserves the as-authored property name"

key-files:
  created:
    - src/__tests__/render/premium-templates.test.tsx
    - src/__tests__/render/legacy-templates-regression.test.tsx
    - src/__tests__/components/premium-templates-preview.test.tsx
    - src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap
    - src/__tests__/render/__snapshots__/legacy-templates-regression.test.tsx.snap
    - .planning/phases/46-premium-template-authoring/46-02-SUMMARY.md
  modified: []

key-decisions:
  - "Inlined walk/styleOf/typeOf/textOf helpers in premium-templates.test.tsx (per Plan 45-02 precedent — no shared test-helper module exists yet; inline keeps the file self-contained and readable)"
  - "Added a styleHasColor helper that accepts both `#HEX` and `rgb(r,g,b)` because jsdom converts hex literals to rgb on inline-style background/background-color/color (mirrors slide-preview-overlays.test.tsx line 193 pattern). styleHas (verbatim from Plan 45-03) used for non-color CSS fragments (border-radius, padding, transparent, linear-gradient)"
  - "Legacy regression fixture deliberately simple — no hook_segments, no custom_texts/images, no style_overrides — to keep the baseline stable and the regression signal clear (this is a structural gate, not a content-coverage test)"
  - "Magazine-bold mint chip + tr3nding-news mid-pill nodes match by `s.background === '#A8E0B0'` (Satori path emits the as-authored property name `background`), while pill `<span>` nodes match `s.backgroundColor === '#A8E0B0'` (renderSegments emits `backgroundColor`). The premium-templates Satori test filters on both forms to be robust to either path"

patterns-established:
  - "TPLNEW-05 regression-gate pattern: snapshot all legacy-template Satori output with a fixed Slide fixture; the test fails LOUD on byte drift (acts as the canary against silent renderer / template-config drift introduced by future phases)"
  - "Three-layer template test contract: (1) Satori snapshot per new template (regression of authored-tree), (2) Tree-walk targeted token assertions per template (locks visible identity tokens), (3) DOM-signature parity test through <SlidePreview> per template (testid + inline-style parity vs Satori). Pattern available for Phase 48+ template additions"
  - "jsdom-tolerant color matchers: when asserting on `#HEX` tokens in DOM tests, prefer a helper that accepts the rgb form too — jsdom rewrites hex on background/background-color/color but Satori preserves it. The matcher absorbs the difference without requiring a renderer change"

requirements-completed: [TPLNEW-05]

# Metrics
duration: 5min
completed: 2026-04-29
---

# Phase 46 Plan 02: Premium-Template Test Coverage + Legacy Regression Gate Summary

**21 new tests across 3 files seal the Phase 46 test contract — Satori snapshots cover the 3 new premium templates, the 5 legacy templates get a byte-identical regression gate (TPLNEW-05), and DOM-signature parity through `<SlidePreview>` proves the React preview emits matching testid hooks + parity-locked pill `<span>` markup.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-29T18:28:11Z
- **Completed:** 2026-04-29T18:33:12Z
- **Tasks:** 2
- **Files created:** 5 (3 test files + 2 snapshot files)
- **Files modified:** 0

## Accomplishments

- **Satori snapshot suite for the 3 new premium templates** — 3 `it()` cases in `src/__tests__/render/premium-templates.test.tsx`, each with one `expect(...).toMatchSnapshot()` plus targeted tree-walk assertions for the locked tokens (mint hex `#A8E0B0` chip + pill `<span>`s, mid-pill literal `'TR3NDING'`, ghosted transparent counter, free-slot `linear-gradient` overlay, page counter `'1/5'`, no-mint exclusion in documentary). All 3 templates pass on first run.
- **TPLNEW-05 legacy-template regression gate sealed** — 5 `it()` cases in `src/__tests__/render/legacy-templates-regression.test.tsx`, one per legacy template id (`highlight-bar`, `news-drop`, `news-cyan`, `y2k-pop`, `bold-yellow`). Each test sanity-asserts `template.id`, `template.overlays === undefined`, and `template.backgroundMode === undefined`, then snapshots the `buildSlideElement(...)` output against a fixed Slide fixture. Baseline snapshot file verified free of Phase 45 layer markers (`bottom-card`, `bg-bleed`, `overlay-top-left`, `overlay-top-right`, `overlay-mid`, `overlay-free` → 0 matches).
- **DOM-signature parity tests via `<SlidePreview>`** — 13 `it()` cases in `src/__tests__/components/premium-templates-preview.test.tsx` (5 magazine-bold + 4 tr3nding-news + 4 documentary). Asserts `data-testid` hooks reach the right zones, mint pill `<span>` markup matches the parity-locked signature (`padding: 4px 12px` + `border-radius: 8px`), `box-decoration-break` is absent (TPLREND-05 parity contract), and template-specific exclusions hold (no `overlay-free` on magazine-bold; no `overlay-top-left` on tr3nding-news; no `bottom-card` on documentary).
- **Premium snapshot file proven to contain locked literal tokens** — `__snapshots__/premium-templates.test.tsx.snap` contains `#A8E0B0` (×6), `TR3NDING` (×2), `linear-gradient` (×1), and `1/5` (×3) — confirms the rendered tree carries the visual-identity tokens beyond the JSX layer-shape captured by the snapshot.
- **Full Vitest suite delta exactly matches plan target** — passing test count went from 339 baseline → 360 (+21 = 3 + 5 + 13). Failing count unchanged at 11 (the documented baseline tracked in `.planning/phases/45-renderer-composition/deferred-items.md`). Zero new regressions.
- **Build and TS still clean** — `npm run build` exits 0 (Phase 44 validator + Plan 46-01 registry intact); `npx tsc --noEmit` reports 14 errors total (matches the 14-baseline; zero new errors in any of the 3 new test files).

## Task Commits

Each task was committed atomically:

1. **Task 1: Premium-template Satori snapshot tests + regression gate for legacy 5** — `ad8571b` (test)
2. **Task 2: DOM signature parity tests for 3 new premium templates via `<SlidePreview>`** — `3e133ea` (test)

## Files Created/Modified

- `src/__tests__/render/premium-templates.test.tsx` — 3 Satori snapshot tests for magazine-bold + tr3nding-news + documentary, plus tree-walk assertions on locked tokens (216 lines)
- `src/__tests__/render/legacy-templates-regression.test.tsx` — TPLNEW-05 gate; 5 snapshot tests across the legacy template ids with a fixed Slide fixture (62 lines)
- `src/__tests__/components/premium-templates-preview.test.tsx` — 13 DOM-signature parity tests for the 3 new templates rendered through `<SlidePreview>`; includes a jsdom-tolerant `styleHasColor` helper (338 lines)
- `src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap` — 3 stored Satori snapshots (auto-written on first run)
- `src/__tests__/render/__snapshots__/legacy-templates-regression.test.tsx.snap` — 5 stored Satori snapshots (auto-written on first run; verified free of Phase 45 layer markers)

## Decisions Made

- **Inlined walk/styleOf/typeOf/textOf helpers in `premium-templates.test.tsx`** — copied verbatim from `src/__tests__/render/render-slide-satori.test.tsx` (Plan 45-02). Cross-file test-helper exports have not been used elsewhere in the suite; inline keeps each test file self-contained and the diff readable. If a third file needs them later, factor at that point.
- **Added a `styleHasColor` helper alongside `styleHas`** — jsdom converts hex literals to `rgb(r, g, b)` on inline `background` / `background-color` / `color`, so a strict-equality match on `#A8E0B0` fails for elements that go through a render branch with `style={{ background: '#A8E0B0' }}`. The helper accepts either form and only handles 6-digit hex (the only case the premium templates use). Mirrors the precedent in `src/__tests__/components/slide-preview-overlays.test.tsx` (Plan 45-03 line 193). `styleHas` is preserved verbatim and used for non-color CSS fragments (`padding: 4px 12px`, `border-radius: 8px`, `linear-gradient`, `transparent`).
- **Premium snapshot tree-walk filters on BOTH `background` and `backgroundColor` props for the mint hex** — the Satori React tree preserves the as-authored property name. The overlay div (Phase 45 `OverlayLayers`/`buildSlideElement` overlay map) emits `style.background` because `magazine-bold.ts`'s overlay style sets `background:`. The pill `<span>` (Phase 45 `renderSegments`) emits `style.backgroundColor` because `renderSegments` writes `backgroundColor` directly. Filter on both to be robust to either path.
- **Legacy regression fixture is intentionally simple** — no `hook_segments`, no `custom_texts`/`custom_images`, no `style_overrides`. The TPLNEW-05 contract is structural ("did the legacy template's authored tree change between v2.6 and now"), not content-coverage. A simpler fixture means fewer failure modes for the gate to crash on, and the assertion stays focused on the regression signal.
- **Documentary `bottom-card` absence test uses the `height: '38%' + rgba(0, 0, 0, 0.85)` signature** — same fingerprint as `legacyTemplate.bottom-card-no-overlays` test in Plan 45-02 (line 198), so a future renderer change that renames or restyles `bottom-card` will also surface here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hex-vs-rgb mismatch in 4 of 13 DOM-parity assertions on first run**

- **Found during:** Task 2 (initial verification run)
- **Issue:** 4 tests asserted that `screen.getByTestId('overlay-top-left').style` (and similar) contained the literal substring `#A8E0B0` or `#000000`. jsdom converts hex literals to `rgb(168, 224, 176)` and `rgb(0, 0, 0)` respectively when they're set via inline style on `background` / `background-color` / `color`. The tests therefore failed even though the rendered DOM was structurally and visually correct. This pattern is the same one already noted in `src/__tests__/components/slide-preview-overlays.test.tsx` (Plan 45-03 line 193 — `expect(css).toMatch(/background-color:\s*(rgb\(157,\s*236,\s*193\)|#9DECC1)/i)`).
- **Fix:** Added a small `styleHasColor(el, hex)` helper that accepts both forms (literal `#HEX` and the converted `rgb(r, g, b)`). Updated the 4 affected assertions (`magazine-bold` chip color, `magazine-bold` mint pill spans, `tr3nding-news` mid-pill bg+color, `tr3nding-news` mint pill spans) to use it. Left `styleHas` (verbatim from Plan 45-03) for non-color CSS fragments — `padding: 4px 12px`, `border-radius: 8px`, `border-radius: 40px`, `background: transparent`, `linear-gradient`, `box-decoration-break`.
- **Files modified:** `src/__tests__/components/premium-templates-preview.test.tsx`
- **Verification:** `npx vitest run src/__tests__/components/premium-templates-preview.test.tsx` → 13/13 passed. Full suite: 360 passed / 11 failed (matches the plan-target baseline — zero new regressions).
- **Committed in:** `3e133ea` (Task 2 commit — colocated with the production-shape change that drives the matcher)
- **Scope justification:** This was a test-environment plumbing issue inside the file the task is creating (Rule 1 — bug in this task's own file). It does NOT touch any production code, does NOT change the Satori render path, and does NOT change Phase 45's parity-locked pill markup. The matcher absorbs jsdom's CSS normalization without weakening the assertion: every test still requires the mint color to be present on the right element, just expressed in either of the two forms the test environment can emit.

---

**Total deviations:** 1 auto-fixed (1 bug — jsdom test-environment CSS-normalization tolerance; the same precedent is already established in Plan 45-03's slide-preview-overlays.test.tsx)
**Impact on plan:** Necessary for the DOM-signature parity tests to actually pass. No scope creep — only the matcher in the new test file was touched; production code, render paths, and existing tests are unmodified.

## Issues Encountered

None beyond the documented deviation. The Satori snapshot path (Task 1) passed on first run because Satori snapshots capture the React-tree property values verbatim (no jsdom normalization is involved).

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `npx vitest run src/__tests__/render/premium-templates.test.tsx` | 3/3 pass | 3/3 | PASS |
| `npx vitest run src/__tests__/render/legacy-templates-regression.test.tsx` | 5/5 pass | 5/5 | PASS |
| `npx vitest run src/__tests__/components/premium-templates-preview.test.tsx` | 13/13 pass | 13/13 | PASS |
| Full Vitest passing total | ≥ 360 (baseline 339 + 3 + 5 + 13) | 360 | PASS |
| Full Vitest failing total | 11 (baseline unchanged) | 11 | PASS |
| Legacy snapshot file: 0 Phase 45 layer markers | 0 | 0 | PASS |
| Premium snapshot file contains `#A8E0B0` | ≥ 1 | 6 | PASS |
| Premium snapshot file contains `TR3NDING` | ≥ 1 | 2 | PASS |
| Premium snapshot file contains `linear-gradient` | ≥ 1 | 1 | PASS |
| Premium snapshot file contains `1/5` | ≥ 1 | 3 | PASS |
| `grep` magazine-bold/tr3nding-news/documentary in premium-templates.test.tsx | ≥ 3 | 20 | PASS |
| `grep` legacy ids in legacy-templates-regression.test.tsx | ≥ 5 | 7 | PASS |
| `grep` `getTemplate('magazine-bold'\|tr3nding-news'\|documentary')` in preview test | ≥ 13 | 13 | PASS |
| `grep` `data-testid\|getByTestId\|queryByTestId` in preview test | ≥ 10 | 11 | PASS |
| `box-decoration-break` parity-contract negative assertion (preview test) | exists | 1 assertion (3 total mentions: 1 doc + 1 inline comment + 1 expect) | PASS |
| `npm run build` exit code | 0 | 0 | PASS |
| `npx tsc --noEmit` total errors | 14 (baseline) | 14 | PASS |
| New TS errors in the 3 new test files | 0 | 0 | PASS |

## User Setup Required

None — no external service configuration required. The 3 new test files use only the existing Vitest + @testing-library/react + jsdom toolchain and the existing `setup.ts` polyfills (added in Plan 45-03).

## Next Phase Readiness

- **Phase 46 functionally complete.** Requirements TPLNEW-01..04 (from Plan 46-01) + TPLNEW-05 (from this plan) = 5/5 satisfied. Ready for `/gsd-verify-phase 46`.
- **Phase 47 (AI Prompt Tuning) ready to plan.** All consumed contracts (Phase 44 schema, Phase 45 renderer, Phase 46 template configs + test gates) are committed and stable. Phase 47 can reference `magazine-bold`, `tr3nding-news`, `documentary` by id with confidence; any prompt tuning that affects template selection will be guarded by the regression + parity test gates introduced here.
- **Phase 48 (Thumbnails & Picker):** No blockers. Phase 48's thumbnail-generation pipeline can run against the populated `sample` data on each new template; the legacy regression gate will catch any unintended renderer change introduced as a side effect.

## Self-Check: PASSED

- File `src/__tests__/render/premium-templates.test.tsx` — FOUND
- File `src/__tests__/render/legacy-templates-regression.test.tsx` — FOUND
- File `src/__tests__/components/premium-templates-preview.test.tsx` — FOUND
- File `src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap` — FOUND
- File `src/__tests__/render/__snapshots__/legacy-templates-regression.test.tsx.snap` — FOUND
- Commit `ad8571b` — FOUND in git log
- Commit `3e133ea` — FOUND in git log

---
*Phase: 46-premium-template-authoring*
*Completed: 2026-04-29*
