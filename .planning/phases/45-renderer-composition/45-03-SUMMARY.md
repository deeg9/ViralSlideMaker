---
phase: 45-renderer-composition
plan: 03
subsystem: renderer
tags: [renderer, react-preview, parity, overlays, background-mode, highlight-pills, client, slide-canvas, picker, brand-kit, carousel-slideshow]

# Dependency graph
requires:
  - phase: 45-renderer-composition/01
    provides: resolveOverlayContent / SLOT_GEOMETRY / renderSegments / bottomCardBackground / OverlayResolveCtx (shared resolver foundation)
  - phase: 45-renderer-composition/02
    provides: Satori renderer reference implementation — DOM order, inline-style signatures, mutual-exclusion gate, key conventions to mirror in React preview for TPLREND-05 parity
  - phase: 44-template-schema-foundation
    provides: SlideTemplate.overlays / SlideTemplate.backgroundMode / TemplateOverlay / TextSegment.highlightColor types + module-load validator
provides:
  - "<SlidePreview> extended with optional slideIndex / totalSlides / topic props (defaults preserve legacy behavior — slideIndex falls back to index, totalSlides to 1, topic to undefined → resolveOverlayContent gracefully returns 1/1 and '')"
  - "BackgroundLayers + OverlayLayers private internal components — shared by BOTH render branches of <SlidePreview> (non-editable thumbnails AND editable canvas) so the two paths cannot drift on layer order or testid hooks"
  - "data-testid hooks: overlay-{slot} (top-left/top-right/mid/bottom-card/free), bg-bleed, bottom-card — exposed for DOM-signature tests + future verifier sweeps"
  - "Local renderSegments delegated to shared renderSegmentsShared from resolve-overlay → highlight pill markup (mint-pill aesthetic from Murphy reference) propagates byte-identical with Satori at all 4 internal call sites (hook x2 + body x2 across the two render branches), without modifying any call expressions"
  - "Mutual-exclusion gate identical to Satori: useBgMode = !newsZone && backgroundMode != 'color'; useBottomCard = useBgMode && backgroundMode === 'image-with-bottom-card' — preserves legacy NEWS_LAYOUT path for the 5 existing templates (zero behavior change)"
  - "DOM-signature test contract — 15 tests covering page-counter (default + custom format), slide-field topic resolution, highlight pill/block style signatures, slot-geometry positioning (top-left + top-right uses CSS right not computed left), backgroundMode image-bleed + image-with-bottom-card layers, editable-branch parity, default-prop fallback (1/1), and legacy-template regression-safety"
  - "Client-side render context wiring at all 7 React entry points — slide-canvas, slide-list (via sortable-slide forwarding), sortable-slide, slide-grid, template-picker (x2), brand-kit-form, carousel-slideshow"
  - "ResizeObserver + getBoundingClientRect jsdom polyfills in src/__tests__/setup.ts (test-environment only) — unblocks the slide-preview test path and recovers 1 of the 2 pre-existing baseline failures from deferred-items.md as a side benefit"
affects: [46-premium-template-authoring]
# Phase 45 functionally complete after this plan — Phase 46 can author magazine-bold purely as a config object.

# Tech tracking
tech-stack:
  added: []   # zero new dependencies — shared resolver + existing React preview
  patterns:
    - "Shared resolver consumption (client side) — slide-preview.tsx imports resolveOverlayContent + SLOT_GEOMETRY + renderSegmentsShared + bottomCardBackground + TemplateOverlay from the same resolve-overlay module Satori uses; one source of truth for the TPLREND-05 parity contract"
    - "Internal helper-component extraction (BackgroundLayers + OverlayLayers) — kept private to slide-preview.tsx but eliminates the 'forgot to update the other branch' drift risk noted in RESEARCH.md Pitfall 2"
    - "Optional props with graceful fallback — slideIndex / totalSlides / topic all default through resolveCtx; legacy callsites that don't pass them keep working unchanged"
    - "Mutual-exclusion gate identical to Satori — same useBgMode + useBottomCard derivation so the legacy 5 templates render byte-identically through this plan"
    - "Test-environment polyfills (ResizeObserver, getBoundingClientRect) gated on `typeof Element !== 'undefined'` — keeps node-environment tests (MCP / api / lib) green while unblocking jsdom-environment SlidePreview tests"
    - "Whitespace-tolerant inline-style fragment matcher (styleHas helper in test file) — handles jsdom CSS normalization variance across vitest minor versions"
    - "Function-name preserving delegator — the local `renderSegments` is now a thin wrapper around `renderSegmentsShared` so the 4 existing call expressions (lines 355, 375, 638, 700 — across both render branches and inside custom_texts) stay byte-identical at their call sites"
    - "Path through SortableSlide for slide-list — slide-list passes totalSlides={slides.length} and topic={topic} to SortableSlide, which forwards to SlidePreview; no architectural rework, just additive prop threading"

key-files:
  created:
    - src/__tests__/components/slide-preview-overlays.test.tsx
  modified:
    - src/components/slides/slide-preview.tsx
    - src/__tests__/setup.ts
    - src/components/editor/slide-canvas.tsx
    - src/components/editor/slide-list.tsx
    - src/components/editor/sortable-slide.tsx
    - src/components/editor/slide-editor.tsx
    - src/components/slides/slide-grid.tsx
    - src/components/slides/template-picker.tsx
    - src/components/brand-kit/brand-kit-form.tsx
    - src/app/explore/[slug]/carousel-slideshow.tsx

key-decisions:
  - "Extracted BackgroundLayers + OverlayLayers as private internal components (declared above the existing resizeHandleStyle constant, BEFORE the SlidePreview function) — Open Question 2 from RESEARCH.md resolved: the two-branch JSX duplication risk is real (Pitfall 2), so extracting helpers is a net code reduction AND eliminates the drift class. Kept private (not exported) because no other consumer needs them."
  - "Added a 3rd jsdom polyfill source (getBoundingClientRect → 1080×1920 fallback) on top of the ResizeObserver stub — without it, scale stays 0 and SlidePreview's inner JSX never renders, so DOM-signature tests can't run. Gated on `typeof Element !== 'undefined'` so node-environment tests remain unaffected. (Rule 3 — auto-fix blocking issue; environment-only change with zero production impact.)"
  - "Added topic threading through slide-editor → slide-canvas + slide-list → sortable-slide → slide-preview (3-level chain) so the live editor canvas resolves slide-field topic overlays correctly. Topic was already on the SlideEditor signature (line 35); no parent-of-SlideEditor edits needed."
  - "Did NOT pass topic through carousel-slideshow.tsx — published_carousels is a snapshot table that does not denormalize project.topic (RESEARCH.md Pitfall 4). Empty-string fallback is the documented contract until a follow-up phase persists topic. Inline comment in carousel-slideshow.tsx documents the locked behavior."
  - "Did NOT pass topic through template-picker.tsx (both sample-data tiles) or brand-kit-form.tsx — these render generic samples, not real projects. slideIndex={0} totalSlides={1} is the right shape for single-tile previews."
  - "Made totalSlides REQUIRED on the SortableSlide props interface (not optional) — prevents the slide-list passthrough from accidentally dropping the prop on a refactor, since that would silently break the page-counter."
  - "Local renderSegments preserved as a thin wrapper over renderSegmentsShared (NOT renamed/inlined) — the 4 existing call sites (slide-preview.tsx lines 355, 375, 638, 700, plus the custom_texts paths at lines 500 and 815) stay byte-identical at their call expressions. Mirrors the Satori-side decision in Plan 45-02."
  - "data-testid hooks added to overlay div (`overlay-{slot}`) + bottom-card div + bg-bleed img — purely for test reachability; the same hooks make future verifier work easier without adding production semantics."
  - "Honored the locked .ts (not .tsx) extension on resolve-overlay by using the existing renderSegmentsShared (which uses React.createElement under the hood) — no JSX import needed inside the resolver."

requirements-completed: [TPLREND-03, TPLREND-04, TPLREND-05]
# Phase 45 functionally complete: TPLREND-01..05 all satisfied across Plans 45-01 (foundation) + 45-02 (Satori) + 45-03 (React preview).

# Metrics
duration: 8min
completed: 2026-04-29
---

# Phase 45 Plan 03: React Preview Wiring Summary

**Wired the React `<SlidePreview>` to the shared resolver — extended both render branches (non-editable picker thumbnails AND editable canvas) with overlay zones, `backgroundMode` photo+card layers, and per-segment highlight pills via the same `resolveOverlayContent` / `SLOT_GEOMETRY` / `renderSegments` / `bottomCardBackground` exports the Satori PNG export uses, then threaded `slideIndex` / `totalSlides` / `topic` props through all 7 React callsites. After this plan lands, editor canvas + picker thumbnails + brand-kit preview tile + public `/explore/[slug]` slideshow all render overlays/backgrounds/pills using the SAME shared resolver Satori uses — zero preview/export drift (TPLREND-05).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-29T17:26:00Z
- **Completed:** 2026-04-29T17:34:20Z
- **Tasks:** 3 (RED → GREEN → callsite-wiring)
- **Files created:** 1 (slide-preview-overlays.test.tsx)
- **Files modified:** 9 (slide-preview.tsx, setup.ts, 7 callsite files)
- **Tests added:** 15 DOM-signature tests
- **Lines of code:** +396 (new test file) / +276 / -28 (slide-preview + setup) / +48 / -1 (7 callsite files)

## Accomplishments

- `<SlidePreview>` accepts new optional `slideIndex` / `totalSlides` / `topic` props; legacy callsites that omit them get graceful fallback (`slideIndex` → `index ?? 0`, `totalSlides` → 1, `topic` → undefined → resolver returns '1/1' and '').
- React preview imports `resolveOverlayContent`, `SLOT_GEOMETRY`, `renderSegmentsShared` (aliased), `bottomCardBackground`, `OverlayResolveCtx`, `TemplateOverlay` from `@/lib/render/resolve-overlay` + `templates/index` — single source of truth shared with Satori.
- Local `renderSegments` is now a thin delegator to the shared helper. Pill markup (mint-pill aesthetic from Murphy reference) propagates byte-identical at hook (line 355 + 638), body (line 375 + 700), and custom_texts (line 500 + 815) automatically — zero changes to those call expressions.
- New mutual-exclusion gate matches Satori exactly: `useBgMode = !newsZone && backgroundMode != null && backgroundMode !== 'color'`. The 5 existing templates leave `backgroundMode` undefined → `useBgMode` is false → byte-identical legacy rendering.
- Two private internal components extracted: `BackgroundLayers` (full-bleed photo + tint + optional bottom-card) and `OverlayLayers` (slot-anchored chips/counters/mid pills with `data-testid` hooks). Both render branches mount them at the correct DOM-order positions.
- DOM layer order in BOTH branches matches CONTEXT.md Area 1: Layer 1 (bg img, useBgMode) → Layer 2 (tint) → Layer 3 (bottom-card, useBottomCard) → Layer 4 (overlay zones) → Layer 5+ (existing hook + body + custom_images + watermarks).
- Picker thumbnails (template-picker × 2 + brand-kit-form) pass `slideIndex={0} totalSlides={1}` for single-tile previews. Carousel callsites (slide-canvas, sortable-slide via slide-list, slide-grid, carousel-slideshow) pass real array index + length. `topic` threads through the editor (slide-editor → slide-canvas + slide-list → sortable-slide → slide-preview); the public viewer intentionally does not (locked snapshot behavior).
- 15/15 new DOM-signature tests pass; full vitest suite shows 7 baseline test files / 11 tests fail (down from the 12 documented in deferred-items.md — the ResizeObserver polyfill recovered one).
- TypeScript: 14 baseline errors unchanged (zero new errors introduced).
- Satori path unchanged: `git diff HEAD~3 HEAD -- src/lib/render/render-slide-satori.tsx src/lib/render/resolve-overlay.ts` returns empty (verified via final check #3).

## Task Commits

Each task was committed atomically — TDD gate sequence preserved:

1. **Task 1 (RED): 15 failing DOM-signature tests for SlidePreview overlay parity** — `b5aba01` (test)
   - Confirmed RED: 15/15 fail because `<SlidePreview>` does not yet accept `slideIndex` / `totalSlides` / `topic` props, does not emit overlay/backgroundMode/pill JSX, and does not expose `data-testid` hooks.
2. **Task 2 (GREEN): wire SlidePreview to shared resolver** — `eb2d4cd` (feat)
   - Imports added; props extended; resolveCtx + useBgMode + useBottomCard derived; BackgroundLayers + OverlayLayers extracted; both render branches mount the new layers at the correct DOM positions; `renderSegments` delegated to the shared helper. ResizeObserver + getBoundingClientRect jsdom polyfills added (Rule 3 — auto-fix blocking issue, environment-only).
3. **Task 3 (callsite wiring): pass slideIndex/totalSlides to all 7 SlidePreview callsites** — `584ef5c` (feat)
   - 7 React callsites + slide-editor.tsx (parent that threads `topic` to SlideList + SlideCanvas) updated. Carousel callsites use real array index + length; single-tile callsites use literal `0`/`1`; `topic` flows through the editor chain only — public slideshow intentionally omits it with inline comment per Pitfall 4.

_TDD gate compliance: RED (`b5aba01`) precedes GREEN (`eb2d4cd`) precedes callsite-wiring (`584ef5c`) in `git log --oneline -5`. No REFACTOR phase needed — implementation hit GREEN cleanly with one test-environment polyfill scoping fix (gating on `typeof Element !== 'undefined'` to keep node-environment tests green)._

## Files Created/Modified

### Created

- `src/__tests__/components/slide-preview-overlays.test.tsx` (396 lines) — 15 vitest DOM-render tests in one `describe` block:

  | # | Test name | What it asserts |
  |---|-----------|-----------------|
  | 1 | renders page-counter overlay text "2/5" when slideIndex=1, totalSlides=5 | Default counter format works at non-zero index |
  | 2 | renders page-counter overlay text "5/5" when slideIndex=4, totalSlides=5 | Default counter format works at last index |
  | 3 | renders page-counter custom format "Slide {currentSlide} of {totalSlides}" | content.format override is honored |
  | 4 | renders slide-field topic when topic prop is passed | topic prop flows through resolveCtx |
  | 5 | renders empty overlay div when slide-field topic is absent | Graceful '' fallback (no thrown error) |
  | 6 | renders highlight pill <span> with parity-locked inline style for "FIGHTS BACK" | bg-color + 4×12 padding + 8px borderRadius + 8px marginRight signature |
  | 7 | does NOT set box-decoration-break on highlight pill <span> (parity contract) | TPLREND-05 explicit ban |
  | 8 | renders highlight block style with padding 4px 8px and border-radius 0 | block-style alternate signature |
  | 9 | renders top-left overlay slot at left:60 top:60 | SLOT_GEOMETRY pixel anchor |
  | 10 | renders top-right overlay slot using CSS right (NOT computed left) | Pitfall 3 — protects against the computed-left mistake |
  | 11 | renders backgroundMode "image-bleed" full-bleed photo via testid bg-bleed | useBgMode photo branch |
  | 12 | renders backgroundMode "image-with-bottom-card" with rgba(0,0,0,0.85) card | useBottomCard branch + bottomCardBackground composition |
  | 13 | editable branch mirrors non-editable branch (overlays + pills both render) | Pitfall 2 — both render branches must stay in sync |
  | 14 | renders default page-counter "1/1" when slideIndex/totalSlides props omitted | Graceful fallback contract per CONTEXT.md Area 4 |
  | 15 | legacy template — emits NO overlay/backgroundMode/bottom-card layers | Regression safety for the 5 existing templates |

  Module-scope fixtures (`fixtureSlide`, `fixtureTemplate`, `legacyTemplate`) keep the per-test setup compact; a `styleHas()` helper does whitespace-tolerant inline-style fragment matching to absorb jsdom CSS normalization variance.

### Modified

- `src/components/slides/slide-preview.tsx` (+248 / -28 lines)
  - Added 5 imports from `@/lib/render/resolve-overlay` + `TemplateOverlay` type from `templates/index`.
  - Replaced the local `renderSegments` (lines 33-50) with a 4-line delegator wrapping the shared `renderSegmentsShared`. Comment explains the parity contract / no `box-decoration-break`.
  - New private `BackgroundLayers` + `OverlayLayers` internal components (above `resizeHandleStyle`).
  - `SlidePreviewProps` gained 3 optional props: `slideIndex?`, `totalSlides?`, `topic?`.
  - Component body destructures the 3 new props.
  - `resolveCtx` + `useBgMode` + `useBottomCard` derived after `newsZone` (mutual-exclusion preserved).
  - Non-editable branch (~line 326) now branches on `useBgMode` to render either `<BackgroundLayers>` (Phase 45 path) or the legacy `newsBgImageNode` + tint div (existing 5 templates).
  - Editable branch (~line 559) mirrors the same conditional + `<OverlayLayers>` insertion.
  - Both branches mount `<OverlayLayers ctx={resolveCtx} />` AFTER background layers and BEFORE the hook text.

- `src/__tests__/setup.ts` (+38 / 0 lines)
  - Added `globalThis.ResizeObserver` stub gated on `typeof === 'undefined'`.
  - Added `Element.prototype.getBoundingClientRect` patch returning a 1080×1920 baseline when the underlying jsdom call returns 0×0.
  - Both polyfills gated on `typeof Element !== 'undefined'` so node-environment tests (MCP / api / lib suites with `// @vitest-environment node`) don't crash.

- `src/components/editor/slide-canvas.tsx` (+5 / 0 lines) — `SlideCanvasProps` gains optional `topic`; `<SlidePreview>` now passes `slideIndex={selectedIndex}`, `totalSlides={slides.length}`, `topic={topic}`.

- `src/components/editor/slide-list.tsx` (+6 / -1 lines) — `SlideListProps` gains optional `topic`; passes `totalSlides={slides.length}` + `topic={topic}` to `<SortableSlide>`.

- `src/components/editor/sortable-slide.tsx` (+13 / -2 lines) — props interface adds required `totalSlides: number` + optional `topic?: string`; `<SlidePreview>` now passes `slideIndex={index}`, `totalSlides`, `topic`.

- `src/components/editor/slide-editor.tsx` (+2 / 0 lines) — threads project `topic` into `<SlideList>` and `<SlideCanvas>` (the topic was already in scope at line 46 — no new prop on SlideEditor itself).

- `src/components/slides/slide-grid.tsx` (+2 / 0 lines) — per-tile `<SlidePreview>` now passes `slideIndex={index}` + `totalSlides={slides.length}`.

- `src/components/slides/template-picker.tsx` (+4 / 0 lines, x2 sites) — both sample-data preview tiles pass `slideIndex={0} totalSlides={1}` (single-tile context — topic intentionally not threaded for generic samples).

- `src/components/brand-kit/brand-kit-form.tsx` (+2 / 0 lines) — brand-kit preview tile passes `slideIndex={0} totalSlides={1}`.

- `src/app/explore/[slug]/carousel-slideshow.tsx` (+9 / 0 lines) — public slideshow viewer passes `slideIndex={selectedIndex} totalSlides={slides.length}`; topic intentionally NOT passed with inline comment explaining the published_carousels snapshot constraint (RESEARCH.md Pitfall 4).

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Extracted `BackgroundLayers` + `OverlayLayers` as private internal components | RESEARCH.md Open Question 2 — the two-branch JSX duplication risk (Pitfall 2) is real. Extracting helpers is a net code reduction AND eliminates the "forgot to update the other branch" drift class. |
| 2 | Added `Element.prototype.getBoundingClientRect` polyfill on top of the ResizeObserver stub | The component bails out at `scale === 0` if the bounding rect's width is 0 (jsdom default). Without the polyfill, the test path never reaches the inner JSX. Gated on `typeof Element !== 'undefined'` to keep node-environment tests green. |
| 3 | Threaded `topic` through slide-editor → slide-canvas + slide-list → sortable-slide → slide-preview | The 3-level chain mirrors how `brandKit` and `userTier` already flow. The topic was already on `SlideEditor` at line 46 — only additive prop forwarding was needed. |
| 4 | Did NOT pass `topic` through carousel-slideshow.tsx | RESEARCH.md Pitfall 4 — published_carousels is a snapshot table that does not denormalize project.topic. Empty-string fallback is the locked contract. Documented inline. |
| 5 | Did NOT pass `topic` through template-picker.tsx or brand-kit-form.tsx | These render generic samples, not real projects. slideIndex=0 totalSlides=1 is the right shape for single-tile previews. |
| 6 | Made `totalSlides` REQUIRED on `SortableSlideProps` (not optional) | Prevents the slide-list passthrough from accidentally dropping the prop on a refactor; would silently break the page-counter otherwise. |
| 7 | Local `renderSegments` preserved as a thin wrapper over `renderSegmentsShared` | The 4 existing call sites (lines 355, 375, 638, 700) and the custom_texts paths (lines 500, 815) stay byte-identical at their call expressions. Mirrors the Satori-side decision in Plan 45-02. |
| 8 | Added `data-testid` hooks (`overlay-{slot}`, `bottom-card`, `bg-bleed`) | Purely for test reachability and future verifier work; no production semantics. |

## Deviations from Plan

None functionally — plan executed as written. Three minor fidelity-preserving adjustments worth noting:

1. **Test-environment polyfills (Rule 3 — auto-fix blocking issue):** The plan's RED test couldn't run without a `ResizeObserver` stub + `getBoundingClientRect` jsdom shim, because `<SlidePreview>` returns an empty placeholder at `scale === 0`. Both polyfills landed in `src/__tests__/setup.ts` gated on `typeof Element !== 'undefined'` so node-environment tests stay unaffected. Side benefit: the polyfill recovers 1 of the 2 pre-existing slide-preview baseline failures from `deferred-items.md` (the second remains failing because that test queries the wrong wrapper element — pre-existing test bug, not introduced by 45-03).
2. **slide-editor.tsx as an 8th file modified:** The plan specified 7 React callsite files. To thread `topic` from `<SlideEditor>` into `<SlideCanvas>` and `<SlideList>` (so the live editor canvas resolves slide-field topic overlays correctly), `slide-editor.tsx` needed two additive prop forwards. The change is 2 lines — purely additive, no architectural rework. The plan acceptance criterion ("All 7 React callsites have slideIndex={...} and totalSlides={...} props") is still satisfied because the 7 callsites are the SlidePreview render sites, not their parents.
3. **Permissive index access on SLOT_GEOMETRY in OverlayLayers (Rule 3 — type-narrowing helper):** Mirrored the Plan 45-02 Satori-side approach (`slot as Record<string, unknown> | null`) for the additive-nudge branches. Maintains type safety via the `typeof === 'number'` runtime guard.

All adjustments are within scope per the task `<action>` description. No architectural change.

## Issues Encountered

**Pre-existing baseline test failures (out of scope, NOT caused by 45-03).**

Same 7 test files / 11 tests fail before AND after Plan 45-03 — except the slide-preview.test.tsx improved from 0/2 to 1/2 passing thanks to the ResizeObserver polyfill:

| File | Failing tests (before 45-03) | Failing tests (after 45-03) | Net |
|------|------------------------------|-----------------------------|-----|
| `src/__tests__/api/rate-limit.test.ts` | 2 | 2 | 0 |
| `src/__tests__/components/slide-preview.test.tsx` | 2 | 1 | **-1 (improved)** |
| `src/__tests__/editor/responsive.test.tsx` | 2 | 2 | 0 |
| `src/__tests__/editor/slide-preview.test.tsx` | 1 | 1 | 0 |
| `src/__tests__/projects/crud.test.ts` | 3 | 3 | 0 |
| `src/__tests__/stripe/checkout.test.ts` | 1 | 1 | 0 |
| `src/__tests__/stripe/sync-subscription.test.ts` | 1 | 1 | 0 |
| **Total** | **12** | **11** | **-1** |

The remaining slide-preview.test.tsx failure (`applies template textColor and fontFamily as inline styles`) is a pre-existing test bug — the test queries `container = hookEl.closest('[data-testid="slide-preview"]')` then asserts the wrapper has `color:` and `Inter` in its inline style. But the wrapper has `className` only; the inline style with color/fontFamily is on a NESTED div (`innerStyle`). The test was always going to fail once unblocked from the ResizeObserver crash. Documented in `deferred-items.md` for triage in the slide-preview test cleanup quick-task.

**TypeScript baseline:** 14 pre-existing errors in test mocks (api-keys / auth / projects-crud / stripe / supabase signal-mock drift). `npx tsc --noEmit` returns the same 14 errors before and after Plan 45-03 — zero new errors introduced.

## TDD Gate Compliance

Plan declared `type: tdd` at the plan level + `tdd="true"` on Tasks 1, 2, 3. Gate sequence verified in `git log --oneline -5`:

- ✓ RED commit (`b5aba01` — `test(45-03): add failing DOM-signature tests for SlidePreview overlay parity (RED)`) precedes GREEN
- ✓ GREEN commit (`eb2d4cd` — `feat(45-03): wire SlidePreview to shared resolver — overlays/backgroundMode/pills (GREEN)`) follows RED with implementation
- ✓ Callsite-wiring commit (`584ef5c` — `feat(45-03): pass slideIndex/totalSlides to all 7 SlidePreview callsites`) follows GREEN

The RED phase was confirmed by vitest output: 15/15 tests failed because `<SlidePreview>` did not accept the new props, did not emit overlay JSX, did not expose `data-testid` hooks, and did not branch on `backgroundMode`. The crash mode was a `ResizeObserver is not defined` ReferenceError — a baseline jsdom limitation that the GREEN phase's `setup.ts` polyfill addresses (Rule 3 — environment-only fix unblocking the test path).

REFACTOR phase: not applicable; the GREEN implementation hit all 15 tests with one polyfill scoping fix (gating on `typeof Element !== 'undefined'` to keep node-environment tests unaffected). No code-cleanliness pass needed beyond inline comments documenting the layer-stack ordering and the parity contract.

## Threat Model Verification

Plan declared 4 STRIDE threats; all dispositions honored in implementation:

- **T-45-03-01 (Tampering / XSS via overlay text from `project.topic`, mitigate):** ✓ All overlay text emits as `{text}` children of `<div>`. React's text-node escaping is automatic for both render branches. The shared `resolveOverlayContent` returns a plain string — no `dangerouslySetInnerHTML`.
- **T-45-03-02 (Tampering via `template.overlays[i].style` inline-style passthrough, accept):** ✓ `template.overlays` is in-repo code, not user input. Phase 44 validator guards the SHAPE; values pass through verbatim per CONTEXT.md decision. `overlay.style` lands as `style={{ ...overlay.style ?? {} }}` directly — no normalization, no parser.
- **T-45-03-03 (Information disclosure — `topic` prop intentionally NOT threaded to public `<CarouselSlideshow>`, mitigate):** ✓ Documented inline (`// topic intentionally NOT passed`). Locked behavior per CONTEXT.md / RESEARCH.md Pitfall 4 — empty string is the correct fallback for published snapshots.
- **T-45-03-04 (Tampering via `slide.background_url` in client `<img src>` for new full-bleed mode, accept):** ✓ URLs already validated upstream by Pexels / upload / AI-generation flows. The new `useBgMode` branch only adds a render path, not a new ingestion path.

No new security-relevant surface beyond the threat register. Threat-flag scan: no new network endpoints, no new auth paths, no new file access patterns, no new schema changes at trust boundaries. (Threat Flags section omitted.)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Phase 45 functionally complete.** TPLREND-01..05 satisfied across Plans 45-01 (foundation) + 45-02 (Satori) + 45-03 (React preview):

- TPLREND-01 (Satori composes overlay zones at correct slot positions): ✓ Plan 45-02
- TPLREND-02 (image-bleed / image-with-bottom-card render full-bleed photo + correct layer stack): ✓ Plan 45-02 (Satori) + Plan 45-03 (React)
- TPLREND-03 (page-counter resolves dynamically from slideIndex/totalSlides in BOTH paths): ✓ shared resolver from Plan 45-01, wired into Satori in 45-02 and React in 45-03
- TPLREND-04 (per-segment highlight pills render in BOTH paths): ✓ shared `renderSegments` from Plan 45-01, delegated from Satori in 45-02 and React in 45-03
- TPLREND-05 (React preview matches Satori — zero drift): ✓ same shared resolver, same SLOT_GEOMETRY, same span markup, same DOM order, NO `box-decoration-break: clone` in either path

**Ready for Phase 46 (Premium Template Authoring):** the renderer surface is complete. Phase 46 can author `magazine-bold` (and `tr3nding-news`, `documentary`) purely as config objects — no renderer code needed. Template configs that populate `overlays` + `backgroundMode` + per-segment `highlightColor` will work end-to-end in:
- Editor canvas (live preview during editing) — slide-canvas.tsx
- Slide-list thumbnails (drag-reorder picker) — sortable-slide.tsx via slide-list.tsx
- Picker grid for newly-generated carousels — slide-grid.tsx
- Template-picker tiles — template-picker.tsx (x2 sites)
- Brand-kit form preview tile — brand-kit-form.tsx
- Public `/explore/[slug]` carousel slideshow — carousel-slideshow.tsx
- Satori PNG export — render-slide-satori.tsx (already wired in 45-02)

**Patterns established for Phase 46:** A new template object only needs to set `backgroundMode` and `overlays` (and optionally `headingFontFamily`, `accentColor`, `sample`) on the existing `SlideTemplate` shape. The renderer changes for visual fidelity are zero. Phase 46 is purely template authoring + sample fixtures + thumbnail generation.

**Manual smoke note (NOT automated, documented per VALIDATION.md):**
- Editor 5-slide project with each of the 5 legacy templates (highlight-bar, news-drop, news-cyan, y2k-pop, bold-yellow): expected zero visual regression because `useBgMode` is `false` for all 5 (none set `backgroundMode`).
- Drag slide 3 to position 1 in slide-list: expected no crash; page-counter on legacy templates does not render anywhere yet (regression-safety only).
- `/explore/[slug]` for any published carousel: expected slideshow viewer continues working; new `slideIndex`/`totalSlides` props are wired but no published carousel uses Phase 46 templates yet.

These can be exercised after Phase 46 ships `magazine-bold` to confirm the Murphy reference is reproducible end-to-end.

**Blockers:** none.

## Patterns Established for Phase 46

The renderer surface is locked. Phase 46 template configs:

1. **Set `backgroundMode`:** `'image-bleed'` (full-bleed photo + tint) or `'image-with-bottom-card'` (full-bleed photo + tint + bottom-card hosting hook+body).
2. **Declare `overlays`:** array of `{ position, content, offset?, style? }`. Position is one of the 5 named slots (`top-left`, `top-right`, `mid`, `bottom-card`, `free`); content is a discriminated union (`literal | page-counter | slide-field`).
3. **Mark accent segments:** populate `slide.hook_segments` / `slide.body_segments` with `{ text, highlightColor, highlightStyle? }` for the mint-pill aesthetic. Pill style defaults to `'pill'` (rounded 8px / 4×12 padding); explicit `'block'` switches to squared (0 radius / 4×8 padding).
4. **Optional `bottomCardBackground` tuning:** template provides 8-digit hex (`#RRGGBBAA`) for explicit alpha; otherwise the helper composes `rgba(r, g, b, 0.85)` per CONTEXT.md Area 3.

No renderer changes needed for any of the above. The Phase 44 validator (running at module-load) will fail-fast on misconfigured templates; the Phase 45 resolver guarantees consistent output across both render paths.

## Self-Check: PASSED

Verified post-creation:

- ✓ FOUND: `src/__tests__/components/slide-preview-overlays.test.tsx` (396 lines, 15 `it()` blocks)
- ✓ FOUND: `src/components/slides/slide-preview.tsx` extended (imports, props, BackgroundLayers, OverlayLayers, both branches mount the new layers)
- ✓ FOUND: `src/__tests__/setup.ts` extended with jsdom polyfills (gated to keep node-env tests green)
- ✓ FOUND: 7 callsite files contain `totalSlides=` (verified via `grep -rln 'totalSlides=' src/components src/app --include='*.tsx' | grep -v __tests__ | wc -l` → 7)
- ✓ FOUND commit: `b5aba01` (RED) in `git log --oneline -5`
- ✓ FOUND commit: `eb2d4cd` (GREEN) in `git log --oneline -5`
- ✓ FOUND commit: `584ef5c` (callsite-wiring) in `git log --oneline -5`
- ✓ Satori path unchanged: `git diff HEAD~3 HEAD -- src/lib/render/render-slide-satori.tsx src/lib/render/resolve-overlay.ts` returns empty (zero lines)
- ✓ Test verification: `npx vitest run src/__tests__/components/slide-preview-overlays.test.tsx` → 15/15 passing
- ✓ Both render branches: `grep -c '<OverlayLayers' src/components/slides/slide-preview.tsx` → 2; same for `<BackgroundLayers`
- ✓ Single shared import path: `grep -c "from '@/lib/render/resolve-overlay'" src/components/slides/slide-preview.tsx` → 1
- ✓ Full suite: `npx vitest run` → 45 files / 339 tests passing; 7 files / 11 tests failed (all pre-existing baseline; net -1 from baseline of 12)
- ✓ TS verification: `npx tsc --noEmit | grep "error TS" | wc -l` → 14 baseline errors (zero new)

---
*Phase: 45-renderer-composition*
*Plan: 03*
*Completed: 2026-04-29*
