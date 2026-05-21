---
phase: 89-brand-kit-shelving-full-removal
plan: 02
subsystem: render
tags: [brand-kit, render, publish, satori, resolver, removal, parity]

# Dependency graph
requires:
  - phase: 89-01
    provides: brand-kit UI surfaces + API routes already removed; SlideEditor/GenerationForm still carry brandKit props for this plan to strip
provides:
  - getTemplate('brand-kit') resolves to news-oracle via a one-line defensive fallback (legacy projects never crash render/publish/fork/download)
  - render/publish/download/seed paths are brand-kit-free — no synthesizeBrandKitTemplate, no mergeWithBrandKit, no effectiveTemplate
  - buildSlideElement / buildSlideHtml signatures with no brandKit positional argument
  - editor + project component tree threads no brandKit prop
  - the FULL SlidePreview brand-kit React contract (props-interface entry, JSX prop, type index) removed; wave 2 ends tsc-clean
affects: [89-03, 89-04, render-pipeline, editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolver normalize-then-fallback: id === 'brand-kit' ? 'news-oracle' : id before .find(), ?? templates[0] tail unchanged"
    - "Atomic positional-signature edit: signature + EVERY 3+-arg call site (production + tests + scripts) in one commit; DELETE the param so stale callers fail tsc loudly"
    - "resolveWatermark kept and fed literal null — short-circuits to null, byte-identical, parity surface unchanged"

key-files:
  created:
    - src/lib/render/templates/__tests__/getTemplate-brand-kit-fallback.test.ts
  modified:
    - src/lib/render/templates/index.ts
    - src/lib/render/render-slide.ts
    - src/lib/render/render-slide-satori.tsx
    - src/lib/render/resolve-per-slide-template.ts
    - src/lib/render/preview-render.ts
    - src/app/api/render/route.ts
    - src/app/api/v1/projects/[id]/download/route.ts
    - src/lib/services/publish.ts
    - src/app/(dashboard)/project/[id]/publish-actions.ts
    - src/app/api/admin/seed-explore/route.ts
    - src/components/slides/slide-preview.tsx
    - src/components/editor/slide-editor.tsx
    - src/components/editor/slide-list.tsx
    - src/components/editor/sortable-slide.tsx
    - src/components/editor/slide-canvas.tsx
    - src/components/editor/text-editor-panel.tsx
    - src/components/editor/text-editor-panel-legacy.tsx
    - src/components/editor/elements-panel.tsx
    - src/components/editor/text-rail/ActiveTextBoxCard.tsx
    - src/components/editor/text-rail/decoration-card.tsx
    - src/components/projects/project-card.tsx
    - src/components/projects/project-list.tsx
    - src/app/(dashboard)/dashboard/page.tsx

key-decisions:
  - "Inlined the literal 'brand-kit' in getTemplate's fallback — no import of BRAND_KIT_TEMPLATE_ID (the module is deleted in Plan 04)"
  - "Fixed 4 out-of-inventory scripts/ call sites + 2 out-of-files_modified test files to hold the 20-error tsc baseline (Rule 3 / STEP A grep sweep)"
  - "decoration-card swatch row degrades to derived_palette only — brand-kit colors gone; acceptable UX change under full removal"
  - "parity.quick-260511 fully stripped of brand-kit content (not just JSX props) so the acceptance grep returns clean — the file is git rm'd in Plan 03 anyway"

requirements-completed: [BKSHELVE-05, BKSHELVE-07]

# Metrics
duration: 17min
completed: 2026-05-20
---

# Phase 89 Plan 02: Brand-Kit Render/Publish Removal & Resolver Fallback Summary

**Stripped brand-kit from every render/publish/download path, deleted the `brandKit` positional argument from `buildSlideElement`/`buildSlideHtml` atomically across 20+ call sites, removed the full `SlidePreview` brand-kit React contract and its editor prop-drilling chain, and added the defensive `getTemplate('brand-kit') → news-oracle` resolver fallback — with the 3 BKSHELVE-05 fixture suites staying GREEN at 45/45.**

## Performance

- **Duration:** ~17 min
- **Tasks:** 3 (Task 1 was TDD: RED + GREEN)
- **Files changed:** 43 (1 created, 42 modified) across 4 commits

## Accomplishments

- **Wave-0 resolver fallback (Task 1, TDD).** Added `getTemplate-brand-kit-fallback.test.ts` (RED — Test 1 failed: `'brand-kit'` resolved to `highlight-bar`), then added the one-line `id === 'brand-kit' ? 'news-oracle' : id` normalize to `getTemplate()` (GREEN — all 3 pass). The generic `?? templates[0]` unknown-id fallback is untouched. Threat T-89-03 (legacy `template_id` DoS) mitigated.
- **Atomic signature change (Task 2).** Deleted the `brandKit` positional arg #3 from `buildSlideElement` (render-slide-satori.tsx) and `buildSlideHtml` (render-slide.ts) signatures, then updated EVERY 3+-positional-arg call site in the same commit — production (`preview-render.ts`), the BKSHELVE-05 hard-gate suite, all 10 `render-slide-satori.test.tsx` calls, and every other render test. Threat T-89-04 (half-applied positional shift) mitigated by deleting the param (not passing `null`) so stale callers fail `tsc`.
- **Brand-kit-free render/publish/download.** `render/route.ts`, `download/route.ts`, `publish.ts`, `publish-actions.ts`, `seed-explore/route.ts` resolve templates via `resolveTemplate`/`getTemplate` only — no `synthesizeBrandKitTemplate`, no `mergeWithBrandKit`, no dangling `effectiveTemplate`. `renderHeroBuffer`/`renderHero`/`renderMinimalHero` lost their `brandKit` params.
- **Full SlidePreview contract removal (Task 3).** Removed the `brandKit` props-interface entry, the destructure, every editor/project JSX pass-through, and the `Parameters<typeof SlidePreview>` type index. The editor + project component tree (10 components) carries no `brandKit` prop. Wave 2 ends `tsc`-clean.
- **HARD GATE held.** The 3 fixture suites (`legacy-templates-byte-identical`, `legacy-templates-regression`, `new-templates-parity`) stay GREEN at **45/45** — no fixture regenerated. `resolveWatermark` kept and fed literal `null` (short-circuits to null → byte-identical).

## Task Commits

1. **Task 1 RED — failing fallback test** — `f0581f8` (test)
2. **Task 1 GREEN — resolver fallback** — `a889c24` (feat)
3. **Task 2 — render/publish/download strip + atomic arg removal** — `ee3b2ee` (feat)
4. **Task 3 — brandKit prop chain + SlidePreview contract removal** — `9d01f0e` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed 4 out-of-inventory `scripts/` call sites**
- **Found during:** Task 2 (STEP A exhaustive grep — the plan's STEP A explicitly mandates fixing 3+-arg call sites surfaced outside the inventory).
- **Issue:** `scripts/test-murphy-carousel.ts`, `scripts/generate-template-thumbnails.ts`, `scripts/render-parity-grid.ts` each had a 6-arg `buildSlideElement` call; `scripts/rerender-hero-by-slug.ts` passed `brandKit` to `renderHeroBuffer`. The plan's STEP A greps only `src/`; `tsc` compiles `scripts/` too, so these 4 raised the error count above 20.
- **Fix:** Dropped the positional `brandKit` arg from the 3 `buildSlideElement` calls; removed the `brandKit` arg + the now-dead brand-kit fetch + `BrandKit` import from `rerender-hero-by-slug.ts`.
- **Commit:** `ee3b2ee`

**2. [Rule 1 - Bug] `preview-render.test.ts` ctx arg-index shift**
- **Found during:** Task 2 verification.
- **Issue:** `preview-render.test.ts` asserts `args[5]` is the `ctx` object; removing `brandKit` shifted `ctx` from index 5 to index 4.
- **Fix:** `expect(args[5])` → `expect(args[4])` with a Phase-89 comment.
- **Commit:** `ee3b2ee`

**3. [Rule 3 - Blocking] `parity.publish-render-vs-slide-preview.test.tsx` 3+-arg calls**
- **Found during:** Task 2 STEP A grep sweep.
- **Issue:** This file (in `files_modified` but not the inventory's `buildSlideElement` list) has two 6-arg `buildSlideElement` calls that broke against the new signature.
- **Fix:** Dropped the positional `brandKit` arg #3 from both. The file's brand-kit *content* (`mergeWithBrandKit`, `brandKitFixture`) is left for Plan 03, which deletes the file.
- **Commit:** `ee3b2ee`

**4. [Rule 3 - Blocking] 2 out-of-`files_modified` test files broken by the SlidePreview/DecorationCard prop removal**
- **Found during:** Task 3 verification.
- **Issue:** `text-editor-panel.regression.test.tsx` passed `brandKit={null}` to `TextEditorPanel`; `decoration-card.test.tsx` passed `brandKit={FAKE_BRAND_KIT}` to `DecorationCard` — both `error TS2322` after the prop removals, pushing `tsc` to 23.
- **Fix:** Removed the `brandKit` JSX prop from `text-editor-panel.regression.test.tsx`; removed the `BrandKit` import, the `FAKE_BRAND_KIT` fixture, and the now-invalid `'renders brand-kit swatches'` `it()` block from `decoration-card.test.tsx`.
- **Commit:** `9d01f0e`

## Decisions Made

- **Inlined `'brand-kit'`** in the `getTemplate` fallback — no import of `BRAND_KIT_TEMPLATE_ID` (CONTEXT permits inlining; the module is deleted in Plan 04).
- **`parity.quick-260511-uk1-snapshot-template.test.tsx` fully stripped** of brand-kit content (the `BrandKit` import, the `brandKitFixture`, all `brandKit` JSX props/comments) rather than only the JSX props — the Task 3 acceptance grep requires the file to be brand-kit-token-free, and the file is `git rm`'d in Plan 03 regardless. The (now-vacuous) brand-kit-independence assertions were rewritten as render-stability assertions.
- **`decoration-card` swatch row UX change:** removing `brandKit` drops brand-kit colors from the color-swatch row, leaving only `derivedPalette`. Acceptable per "full removal" — noted as a deliberate UX change.
- **`resolveWatermark` kept (Pitfall 3).** Every caller now passes literal `null`; the resolver short-circuits to `null`. Deleting it would change the render element tree and over-extend the parity surface for zero requirement benefit.

## Deferred Issues

Logged to `.planning/phases/89-brand-kit-shelving-full-removal/deferred-items.md` (all verified PRE-EXISTING on the plan base SHA — NOT caused by this plan, per SCOPE BOUNDARY):

- **t3x-template parity snapshot suites** — `parity.style-spec-absent-baseline.test.tsx`, `parity.template-fingerprint-decorations-undefined.test.tsx`, `parity.template-fingerprint.test.tsx` have failing snapshots for `tr3nding-news`/`sunset-tabloid`/`soft-sage` (the quick-260519-t3x additions whose snapshots were never regenerated). The 3 BKSHELVE-05 byte-identity fixture suites are unaffected and stay GREEN 45/45.
- **Pre-existing editor suite failures** — `phase-70-final-regression-sweep.test.ts`, `slide-editor.treatment-sync.test.tsx`, `slide-editor.watermark-sync.test.tsx`, `text-editor-panel.regression.test.tsx` (16 failing tests). Identical failure counts on the untouched main repo.

## Notes / Tooling

- The committed `vitest.config.ts` excludes `**/.claude/worktrees/**`, which swallows every test inside this agent's own worktree. To run suites from within the worktree, a non-committed `vitest.worktree.config.ts` (vitest defaults only, no worktree exclude) was created and used via `--config`. It is left untracked and was never staged.

## Next Phase Readiness

- All render/publish/download paths are brand-kit-free; legacy `template_id === 'brand-kit'` projects resolve to `news-oracle`.
- The `SlidePreview` brand-kit contract is fully gone; wave 2 ends `tsc`-clean (20 errors, all pre-existing test-mock noise, none in a plan-touched file).
- The brand-kit library `src/lib/brand-kit/` and `src/lib/types/brand-kit.ts` are STILL ALIVE (consumed by `parity.publish-render-vs-slide-preview.test.tsx`, generation/AI code) — deleted in Plan 04 after Plan 03 strips the remaining consumers.
- Plan 03 (`parity.publish-render-vs-slide-preview.test.tsx`, `per-slide-template-override.test.tsx`, `parity.quick-260511...test.tsx` `git rm`, generation/AI strip) can proceed — its files compile entering wave 3.

## Verification Results

- **HARD GATE** — `legacy-templates-byte-identical` + `legacy-templates-regression` + `new-templates-parity`: **45/45 GREEN** (no fixture regenerated).
- **Wave-0** — `getTemplate-brand-kit-fallback.test.ts`: **3/3 pass**; full `templates/__tests__` dir 33/33.
- **`tsc --noEmit`** — **20 errors** (= baseline; all pre-existing test-mock noise; none in any plan-touched file).
- **Render-core grep** — `mergeWithBrandKit`/`synthesizeBrandKitTemplate`/`effectiveTemplate` across `api/render/`, `publish.ts`, `seed-explore/route.ts`, `render-slide.ts`, `render-slide-satori.tsx`: **zero**.
- **Component-tree grep** — `brandKit`/`BrandKit` across `slide-preview.tsx`, `components/editor/`, `components/projects/`, `dashboard/page.tsx`: **zero**.
- **`render-slide-satori.test.tsx`** — exactly 10 `buildSlideElement` calls, NONE passing a 3rd positional arg.

## Self-Check: PASSED

- `src/lib/render/templates/__tests__/getTemplate-brand-kit-fallback.test.ts` — FOUND
- `src/lib/render/templates/index.ts` — FOUND, `news-oracle` fallback present
- `src/lib/render/render-slide-satori.tsx` — FOUND, `buildSlideElement` has no `brandKit` arg
- Commits `f0581f8`, `a889c24`, `ee3b2ee`, `9d01f0e` — all present in `git log`

---
*Phase: 89-brand-kit-shelving-full-removal*
*Completed: 2026-05-20*
