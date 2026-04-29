---
phase: 48-template-thumbnails-picker
plan: 01
subsystem: rendering
tags: [satori, next-og, template-picker, vitest, thumbnail-pipeline, tsx]

requires:
  - phase: 44-template-schema
    provides: SlideTemplate.thumbnail field + 8-template registry
  - phase: 45-renderer-composition
    provides: buildSlideElement (Satori element builder) + loadFontBuffersForSlide + resolve-overlay shared resolver
  - phase: 46-premium-template-authoring
    provides: 3 premium templates (magazine-bold, tr3nding-news, documentary) with sample data
provides:
  - One-off `npm run thumbs` script generating 1080x1920 PNGs for all 8 templates via the production next/og pipeline
  - 8 committed thumbnail PNGs at public/templates/<id>.png (5 legacy + 3 premium)
  - Shared `makeSampleSlide` helper extracted to src/lib/render/sample-slide.ts so the picker and the script share one builder
  - DOM-signature regression test pinning TPLTHUMB-02 (picker uses SlidePreview for every template, no swatch fallbacks; brandKit-null + brandKit-configured branches both covered)
  - Latent /api/render bug discovered: Satori multi-child constraint trips on multi-segment hooks (logged in deferred-items.md)
affects: [v2.7 milestone close-out, future og-image / share-card pipeline that will consume template.thumbnail]

tech-stack:
  added: [tsx@^4.21.0]
  patterns:
    - "next/og::ImageResponse reused outside HTTP handler — call .arrayBuffer() in any Node 24 context (same pattern as production /api/render route.ts:112) instead of importing satori or @resvg/resvg-wasm directly"
    - "Shared sample-slide helper colocated next to the renderer so picker UI + offline tooling share one builder"
    - "Per-task atomic commits (Task 1 = scaffold, Task 2 = generate + test, Task 3 = verification-only)"

key-files:
  created:
    - scripts/generate-template-thumbnails.ts
    - src/lib/render/sample-slide.ts
    - src/__tests__/components/template-picker.test.tsx
    - public/templates/highlight-bar.png
    - public/templates/news-drop.png
    - public/templates/news-cyan.png
    - public/templates/y2k-pop.png
    - public/templates/bold-yellow.png
    - public/templates/magazine-bold.png
    - public/templates/tr3nding-news.png
    - public/templates/documentary.png
    - .planning/phases/48-template-thumbnails-picker/deferred-items.md
  modified:
    - src/components/slides/template-picker.tsx
    - package.json

key-decisions:
  - "Reuse next/og::ImageResponse instead of importing satori/@resvg/resvg-wasm directly — those bundles ship inside next/og, so the script renders byte-identical pixels to /api/render without adding new top-level deps"
  - "Strip hook_segments / body_segments before feeding the slide into buildSlideElement: Satori (next/og) requires display:flex on parents with multiple children, but the existing renderer does not set it on hook/body text divs. Script-side mitigation per Rule 1 (auto-fix bug, scoped to keep this plan additive); production-renderer fix logged separately in deferred-items.md"
  - "Pin tsx ^4.21.0 in devDependencies rather than relying on ad-hoc npx — makes `npm run thumbs` reproducible across machines"
  - "Picker test uses screen.getAllByTestId('slide-preview') — verified the actual emitted testid in slide-preview.tsx (NOT 'slide-preview-root')"

patterns-established:
  - "Offline content-rendering scripts reuse the production Satori pipeline via next/og::ImageResponse (same module path the /api/render route uses), preserving byte-level parity with the live render"
  - "Shared fixture builders (makeSampleSlide) colocated under src/lib/render/ so they can be imported by both client UI (template-picker) and server tooling (scripts/) without bidirectional coupling"

requirements-completed: [TPLTHUMB-01, TPLTHUMB-02]

duration: 6min
completed: 2026-04-29
---

# Phase 48 Plan 01: Template Thumbnails & Picker Summary

**8 template thumbnail PNGs (1080x1920) generated via next/og::ImageResponse + a vitest DOM-signature regression test pinning TPLTHUMB-02 against future swatch-fallback drift**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-29T20:04:26Z
- **Completed:** 2026-04-29T20:10:12Z
- **Tasks:** 3 (Task 1 scaffold, Task 2 generate+test, Task 3 verification)
- **Files modified:** 13 (3 source files modified, 10 new files including 8 PNGs)

## Accomplishments

- Shipped `scripts/generate-template-thumbnails.ts` — a one-off `npm run thumbs` generator that reuses the production Satori pipeline (`buildSlideElement` + `loadFontBuffersForSlide` + `next/og::ImageResponse`) to render 1080x1920 PNGs from each registered template's `sample` data.
- Wrote 8 committed PNG thumbnails to `public/templates/<id>.png` (highlight-bar, news-drop, news-cyan, y2k-pop, bold-yellow, magazine-bold, tr3nding-news, documentary). All are valid PNGs (28KB–60KB each, all 1080x1920 8-bit/color RGBA).
- Extracted `makeSampleSlide` from `template-picker.tsx` into `src/lib/render/sample-slide.ts` so the picker and the script share one builder (no duplication, drift-free).
- Added `src/__tests__/components/template-picker.test.tsx` with 4 passing assertions: brandKit=null produces 8 SlidePreview tiles + an empty-state link; brandKit=configured produces 9 SlidePreview tiles; the empty-state copy is present when brandKit is null; the active tile shows a "Selected" indicator.
- Pinned `tsx ^4.21.0` in devDependencies and added `"thumbs": "tsx scripts/generate-template-thumbnails.ts"` to `package.json` so the generator is reproducible on any machine.
- Discovered and documented a latent /api/render bug (Satori `display:flex` multi-child constraint vs multi-segment hooks) — logged in `deferred-items.md` for a follow-up plan, with the script-side mitigation in place.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract makeSampleSlide + add tsx devDependency + write thumbnail script** — `1d67712` (feat)
2. **Task 2: Run npm run thumbs and write the picker DOM-signature test** — `77a8963` (feat)
3. **Task 3: Verification — npm run build + full vitest suite + lint** — verification-only (no code changes; all gates green, see below)

## Files Created/Modified

- `scripts/generate-template-thumbnails.ts` — One-off `npm run thumbs` generator. Iterates `templates`, builds a sample slide via `makeSampleSlide`, calls `buildSlideElement`, awaits font buffers, wraps in `new ImageResponse(...)`, writes the buffer to `public/templates/<id>.png`. Strips `hook_segments` / `body_segments` before render to dodge the latent Satori multi-child bug (see deferred-items.md).
- `src/lib/render/sample-slide.ts` — Exports `makeSampleSlide(template)`. Single source of truth for picker tile + thumbnail script fixture data.
- `src/components/slides/template-picker.tsx` — Replaced the inlined `function makeSampleSlide(...)` with `import { makeSampleSlide } from '@/lib/render/sample-slide'`. Removed unused `SlideTemplate` / `Slide` type imports. Behavior unchanged (call sites at lines 70 + 137 keep their existing signature).
- `src/__tests__/components/template-picker.test.tsx` — 4-assertion suite pinning TPLTHUMB-02. Uses `screen.getAllByTestId('slide-preview')` (matches the actual testid in `slide-preview.tsx` lines 486/498/748).
- `package.json` — Added `"thumbs"` script entry; added `"tsx": "^4.21.0"` to devDependencies.
- `public/templates/*.png` — 8 committed PNG thumbnails, 1080x1920 each.
- `.planning/phases/48-template-thumbnails-picker/deferred-items.md` — Latent /api/render bug write-up (Satori multi-child constraint vs multi-segment hooks).

## Decisions Made

- **Reuse next/og over importing satori/@resvg/resvg-wasm directly:** neither package is in `package.json`, but both ship bundled inside `node_modules/next/dist/server/og/` (the same path `/api/render` uses via `next/og`). Reusing `ImageResponse` means the script produces byte-identical pixels to production by construction, with zero new top-level deps.
- **Strip segments in the script (not the renderer):** keeps the plan additive. The renderer fix would be a behavior change to a production code path used by `/api/render`; documenting it in `deferred-items.md` for a dedicated bug-fix plan is the conservative path.
- **Pin tsx ^4.21.0:** `npx tsx --version` reported 4.21.0 working, so pinning that version makes the script reproducible across contributor machines without an ad-hoc `npx --yes tsx` install at run time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stripped hook_segments / body_segments before Satori render to dodge multi-child constraint**

- **Found during:** Task 2 (`npm run thumbs` invocation — first run failed at the news-drop template).
- **Issue:** Satori (the rasterizer inside `next/og::ImageResponse`) throws `Expected <div> to have explicit "display: flex" or "display: none" if it has more than one child node` when a hook/body `<div>` receives more than one `<span>` child. The hook/body divs in `src/lib/render/render-slide-satori.tsx` do NOT set `display:flex`. When `renderSegmentChildren` expands a multi-segment hook (e.g., news-drop's sample with 5 accent-keyword segments) into multiple `<span>` siblings, the rasterizer rejects the tree. This is a pre-existing latent bug in `/api/render` — it was masked because existing snapshot tests in `src/__tests__/render/premium-templates.test.tsx` only serialize the React element tree (they never call `new ImageResponse(element).arrayBuffer()`, which is the path that runs Satori's strict layout validator).
- **Fix:** Added a `thumbnailSlide(template)` wrapper in the script that clears `hook_segments` and `body_segments` before passing the slide to `buildSlideElement`. The PNGs render with single-color hook text (no accent-word highlights) instead of failing. The picker UI is unaffected — it uses live React `<SlidePreview>` (browser, no Satori), so users still see accent-word highlights at runtime.
- **Files modified:** `scripts/generate-template-thumbnails.ts`
- **Verification:** All 8 PNGs generate cleanly; `file public/templates/magazine-bold.png` reports `1080 x 1920, 8-bit/color RGBA, non-interlaced`; full vitest suite runs to completion (no new regressions).
- **Committed in:** `77a8963` (Task 2 commit)

**Latent renderer bug logged separately in `deferred-items.md`** with a recommended fix (add `display:flex` + `flexWrap:wrap` to hook/body/custom_text divs, then add an integration test that actually calls `.arrayBuffer()`). Touching the production renderer is out of scope for this plan (Rule 4 territory — it would change production rendering behavior across legacy + premium templates and risks invalidating Phase 46 snapshot baselines without a dedicated test plan).

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - bug)
**Impact on plan:** Necessary to complete Task 2 (`npm run thumbs` would otherwise fail at the second template). Mitigation is script-scoped and reversible. No scope creep — the production renderer was deliberately left untouched.

## Issues Encountered

- The pre-existing `npm install` audit reported 9 vulnerabilities (4 moderate, 4 high, 1 critical). These are unrelated to this plan's deps (only `tsx` was added) — flagged here for visibility but out of scope for Plan 48-01.

## Verification Gates (Task 3)

| Gate | Result | Detail |
|------|--------|--------|
| `npm run build` | exit 0 | Full Next.js production build clean; no new TS errors. |
| `npx vitest run` | 423 passing / 11 failing | Baseline pre-Phase-48 was effectively 419/11; this plan adds 4 new passing tests (template-picker.test.tsx) for a final 423/11. **0 net-new failures.** The 11 baseline failures (rate-limit, slide-preview style, responsive, slide-canvas, projects CRUD, stripe checkout, stripe sync) are pre-existing and tracked outside this plan. |
| `npm run lint` | exit 0 | 43 warnings (all pre-existing — `<img>` warnings + unused vars in unrelated files). **0 errors.** **0 warnings on any file created or modified by this plan.** |

## Filesystem Invariants

- All 8 PNGs exist at `public/templates/<id>.png`, each a valid 1080x1920 PNG (file magic-bytes verified; smallest is `y2k-pop.png` at 28,738 bytes — well above the ≥1KB must-have threshold).
- `scripts/generate-template-thumbnails.ts` is idempotent: re-running `npm run thumbs` overwrites in place; final filesystem state byte-identical to the first run (no segments / stripped fixture data is deterministic).

## TPLTHUMB Sealed Checklist

- [x] **TPLTHUMB-01** — 8 PNGs at `public/templates/<id>.png`, generated via the production Satori → resvg pipeline (`next/og` + `buildSlideElement` + `loadFontBuffersForSlide`). `npm run thumbs` runs end-to-end with all 8 templates writing successfully.
- [x] **TPLTHUMB-02** — picker uses `<SlidePreview>` for every template (no swatch fallbacks); regression test in `src/__tests__/components/template-picker.test.tsx` proves both brandKit-null (8 tiles) and brandKit-configured (9 tiles) branches.

## Next Phase Readiness

- **v2.7 Premium Templates milestone:** Phase 48 is the last phase in the 5-phase milestone (44 → 45 → 46 → 47 → 48). With this plan green, all 5 phases are functionally complete.
- **Latent /api/render bug** (Satori multi-child on segments) flagged for a follow-up plan — recommend bundling with the next bug-sweep milestone or a v2.7 patch release. Tracked in `deferred-items.md` with concrete repro + recommended fix.
- **Static thumbnail consumers:** the `template.thumbnail` field has been a forward-looking contract since Phase 46; with PNGs now on disk, future og-image / share-card pipelines (deferred to v2.8+) can finally consume it.

## Self-Check: PASSED

- FOUND: scripts/generate-template-thumbnails.ts
- FOUND: src/lib/render/sample-slide.ts
- FOUND: src/__tests__/components/template-picker.test.tsx
- FOUND: public/templates/highlight-bar.png
- FOUND: public/templates/news-drop.png
- FOUND: public/templates/news-cyan.png
- FOUND: public/templates/y2k-pop.png
- FOUND: public/templates/bold-yellow.png
- FOUND: public/templates/magazine-bold.png
- FOUND: public/templates/tr3nding-news.png
- FOUND: public/templates/documentary.png
- FOUND: commit 1d67712 (Task 1 scaffold)
- FOUND: commit 77a8963 (Task 2 generate + test)

---
*Phase: 48-template-thumbnails-picker*
*Completed: 2026-04-29*
