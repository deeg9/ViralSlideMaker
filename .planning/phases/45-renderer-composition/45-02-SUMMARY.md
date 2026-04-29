---
phase: 45-renderer-composition
plan: 02
subsystem: renderer
tags: [renderer, satori, png-export, overlays, backgroundMode, highlight-pills, server, parity]

# Dependency graph
requires:
  - phase: 45-renderer-composition/01
    provides: resolveOverlayContent / SLOT_GEOMETRY / renderSegments / bottomCardBackground / OverlayResolveCtx (shared resolver foundation)
  - phase: 44-template-schema-foundation
    provides: SlideTemplate.overlays / SlideTemplate.backgroundMode / TemplateOverlay / OverlayContent / TextSegment.highlightColor types + module-load validator
provides:
  - "buildSlideElement(slide, template, brandKit, tier, origin, ctx?) — extended Satori entry that composes template.overlays, branches on template.backgroundMode, renders pill highlights, accepts optional ctx for page-counter / slide-field resolution"
  - "Satori snapshot test contract — 10 tests covering legacy template (no change), image-bleed, image-with-bottom-card with/without overlays, slide-field topic, mint-pill highlights, block highlights, missing-ctx fallback (counter→1/1, slide-field→''), and mutual-exclusion (style_overrides.layout wins over backgroundMode)"
  - "Server-side render context wiring at all 5 entry points (/api/render, /api/v1/projects/[id]/download, /(dashboard)/project/[id]/publish-actions, /lib/services/publish, /api/admin/seed-explore) — every Satori PNG export now resolves overlays via the shared resolveOverlayContent"
affects: [45-03-react-preview-wiring, 46-premium-template-authoring]

# Tech tracking
tech-stack:
  added: []   # zero new dependencies — shared resolver from 45-01 + existing renderer
  patterns:
    - "Shared resolver consumption — Satori imports resolveOverlayContent + SLOT_GEOMETRY + renderSegmentsShared + bottomCardBackground from resolve-overlay; the same imports will land in slide-preview.tsx in plan 45-03 for TPLREND-05 parity"
    - "Optional ctx + graceful fallback — buildSlideElement(...ctx?) lands behind a 6th optional parameter so legacy callsites stay green during the wave; resolveCtx normalizes missing values to slideIndex=0/totalSlides=1/topic=undefined per CONTEXT.md Area 4"
    - "Mutual-exclusion gate — useBgMode = !newsZone && backgroundMode != 'color' preserves legacy NEWS_LAYOUT path for the 5 existing templates (zero behavior change) while opening the new path for Phase 46+ templates"
    - "Snapshot stability via explicit overlay keys — `key={\\\\`overlay-\\${i}-\\${overlay.position}\\\\`}` per RESEARCH.md Pitfall 6 (React 19 minor-version churn protection)"
    - "Tree-walk test pattern — recursive walk() helper that descends into Array nodes (the result of template.overlays.map()) plus typeOf/styleOf/textOf/childrenOf accessors for targeted style + text assertions on top of toMatchSnapshot"
    - "Function-name preserving delegator — renderSegmentChildren is now a thin wrapper around renderSegmentsShared so the 3 existing callsites (hook/body/custom_texts) stay byte-identical at their call expressions"

key-files:
  created:
    - src/__tests__/render/render-slide-satori.test.tsx
    - src/__tests__/render/__snapshots__/render-slide-satori.test.tsx.snap
  modified:
    - src/lib/render/render-slide-satori.tsx
    - src/app/api/render/route.ts
    - src/app/api/v1/projects/[id]/download/route.ts
    - src/app/(dashboard)/project/[id]/publish-actions.ts
    - src/lib/services/publish.ts
    - src/app/api/admin/seed-explore/route.ts

key-decisions:
  - "Inserted bottom-card layer BEFORE overlay zones in JSX order so DOM stack matches CONTEXT.md Area 1 layers 3 → 4 (card surface → chips/counter/pill); hook+body remain emitted by existing positioning code (CONTEXT.md last paragraph: user-supplied positions still win)"
  - "Did NOT change rootStyle background-color logic — backgroundMode === 'image-bleed' / 'image-with-bottom-card' relies on the existing `if (!slide.background_url || newsZone) rootStyle.backgroundColor = template.backgroundColor` gate; when both backgroundMode is set and slide.background_url exists, no flat fill paints (correct per UI-SPEC layer 1)"
  - "Permissive index access on SLOT_GEOMETRY (`slot as Record<string, unknown> | null`) for the additive-nudge branches — the union type doesn't have `left` on every member, but the runtime guard `typeof === 'number'` narrows safely; chosen over creating a 6th overlay-specific type to keep the additive nudge ergonomic"
  - "renderSegmentChildren preserved as a thin delegator (NOT renamed/inlined) so the 3 internal call sites (hook line ~291, body line ~301, custom_texts line ~365) stay byte-identical at their call expressions — minimizes diff churn while routing all segment rendering through the shared pill-aware implementation"
  - "Explicit `key={\\\\`overlay-\\${i}-\\${overlay.position}\\\\`}` on the overlay map iteration per RESEARCH.md Pitfall 6 — React 19 minor versions sometimes auto-annotate keys, so the explicit key keeps snapshots stable across minor patches"
  - "Tree-walk helper updated to recurse into Array nodes — the original RESEARCH.md walk pattern stops at Array boundaries; we extended it because `template.overlays?.map()` returns an array that becomes a child of the root <div>, and tests need to reach the inner overlay <div>s"
  - "seed-explore passes `topic: undefined` rather than threading project.topic — seed-explore renders heroes from in-route `SeedEntry` fixtures (not from a `Project` row); resolver returns '' for slide-field topic, which is the documented graceful fallback and the right behavior for dev-only seeded carousels"

requirements-completed: [TPLREND-01, TPLREND-02, TPLREND-03, TPLREND-04]
# Note: server-side coverage; full TPLREND-05 (preview/export parity) lands when 45-03 wires the React preview.

# Metrics
duration: 7min
completed: 2026-04-29
---

# Phase 45 Plan 02: Satori Renderer Wiring Summary

**Extended `buildSlideElement` to compose `template.overlays` zones, branch on `template.backgroundMode`, render per-segment highlight pills via the shared resolver, and accept an optional `ctx` parameter — then threaded `ctx` through all 5 server callsites so Satori PNG export now uses the same `resolveOverlayContent` source as the upcoming React preview (TPLREND-05 server side).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-29T17:13:26Z
- **Completed:** 2026-04-29T17:20:45Z
- **Tasks:** 3 (RED → GREEN → callsite-wiring)
- **Files created:** 2 (render-slide-satori.test.tsx, render-slide-satori.test.tsx.snap)
- **Files modified:** 6 (render-slide-satori.tsx + 5 callsites)
- **Tests added:** 10 Satori snapshot tests (each with targeted tree-walk assertion)
- **Lines of code:** +1870 / −17 across the 8 changed files (snapshot file is 1313 of those lines)

## Accomplishments

- `buildSlideElement` accepts an optional 6th `ctx?: { slideIndex: number; totalSlides: number; topic?: string }` parameter. Missing ctx → graceful fallback (`slideIndex: 0`, `totalSlides: 1`, `topic: undefined`). No throws, no warnings — keeps any future caller that omits ctx green.
- Satori now imports `resolveOverlayContent`, `SLOT_GEOMETRY`, `renderSegmentsShared` (aliased), `bottomCardBackground`, and `OverlayResolveCtx` from `./resolve-overlay`. Single source of truth shared with the upcoming React preview.
- `renderSegmentChildren` is now a thin delegator to `renderSegmentsShared` — pill markup (mint-pill aesthetic from the Murphy reference) automatically lands at hook (line ~291), body (line ~301), and custom_texts (line ~365) without modifying their call expressions.
- New mutual-exclusion gate — `useBgMode = !newsZone && template.backgroundMode != null && template.backgroundMode !== 'color'`. The 5 existing templates leave `backgroundMode` undefined → `useBgMode` is false → byte-identical legacy snapshot (regression-safety contract from CONTEXT.md Area 3).
- New full-bleed `<img>` path implicitly handled by the existing background-image branch (already paints `width: W, height: H, objectFit: 'cover'` when `slide.background_url && !newsZone` — exactly what `backgroundMode: 'image-bleed'` requires per RESEARCH.md Pitfall 3).
- New bottom-card layer when `useBottomCard`: `position: absolute`, full width, `bottom: 0`, `height: '38%'`, `padding: 80`, `backgroundColor: bottomCardBackground(template.backgroundColor)`. Inserted AFTER tint, BEFORE overlays per CONTEXT.md Area 1 DOM order.
- New overlay zones layer: iterates `template.overlays`, anchors via `SLOT_GEOMETRY[overlay.position]`, resolves text via `resolveOverlayContent(overlay.content, resolveCtx)`, applies `overlay.style` as inline-style passthrough. Explicit `key={\`overlay-${i}-${overlay.position}\`}` for snapshot stability.
- All 5 server callsites now pass real `ctx` — `/api/render` uses request-scope `index` + `slide_data.length` + `project.topic`; the ZIP loop iterates with `i` + `slides.length` + `project.topic`; the two publish paths render slide 0 of a 1-slide payload with the project's topic; seed-explore passes `topic: undefined` (no Project in scope).
- 10/10 Satori snapshot tests pass; legacy-template snapshot has zero `bottom-card` / `bg-bleed` / `overlay-*` / `box-decoration-break` keys (regression-safety contract verified).
- Full vitest suite: 44 test files / 323 tests passing — same 7 files / 12 tests in baseline failure (rate-limit, slide-preview, responsive editor, slide-canvas Y-of-N, projects CRUD, stripe checkout, stripe sync-subscription) per `deferred-items.md`. Zero new regressions.
- TypeScript: 14 baseline errors (in test mocks for stripe / supabase / api-keys + the auth signal-mock drift) — unchanged before/after Phase 45-02.
- React preview (`slide-preview.tsx`) byte-identical — `git diff HEAD~3 HEAD -- src/components/slides/slide-preview.tsx` returns empty. Plan 45-03 will mirror this DOM order using the same shared resolver.

## Task Commits

Each task was committed atomically — TDD gate sequence preserved:

1. **Task 1 (RED): Write failing Satori snapshot tests** — `8ba4c9e` (test)
   - Confirmed RED: 7 of 10 tests fail because buildSlideElement does not yet accept `ctx`, does not emit overlay JSX, does not branch on `backgroundMode`, and does not route segments through the pill-aware shared resolver.
2. **Task 2 (GREEN): Extend buildSlideElement** — `9f692cd` (feat)
   - Imports added; 6th `ctx` param wired; useBgMode/useBottomCard gates derived; bottom-card + overlay-zones JSX layers inserted at the correct DOM-order positions; renderSegmentChildren delegated to shared helper. 10/10 tests pass.
3. **Task 3 (callsite wiring): Pass ctx to all 5 server callsites** — `b1b8683` (feat)
   - Each of /api/render, /api/v1/projects/[id]/download, /(dashboard)/project/[id]/publish-actions, /lib/services/publish, /api/admin/seed-explore now passes the 6th `ctx` argument with the right shape for its calling context.

_TDD gate compliance: RED commit (`8ba4c9e`) precedes GREEN (`9f692cd`) which precedes callsite-wiring (`b1b8683`) in `git log --oneline`. No REFACTOR phase needed — implementation hit GREEN cleanly after one walk-helper fix in the test file._

## Files Created/Modified

### Created

- `src/__tests__/render/render-slide-satori.test.tsx` (429 lines) — 10 vitest snapshot tests in one `describe` block:
  | # | Test name | Mode covered | Tree-walk assertion |
  |---|-----------|--------------|---------------------|
  | 1 | renders legacy template (no overlays, no backgroundMode) | regression safety | bottom-card div with `height: '38%'` ABSENT |
  | 2 | renders image-bleed full-bleed photo at 1080×1920 cover | image-bleed | `<img>` exists with width=1080 / height=1920 / objectFit='cover' |
  | 3 | renders image-with-bottom-card with full-bleed photo + tint + bottom card | image-with-bottom-card | full-bleed `<img>` + tint `<div>` (inset 0, opacity 0.4) + bottom-card `<div>` (height 38%, padding 80, rgba(0,0,0,0.85)) all present |
  | 4 | renders overlays at SLOT_GEOMETRY anchors with literal + page-counter content | overlays | top-left overlay (left:60, top:60) with text 'TR3NDING'; top-right overlay (right:60, top:60) with text '1/5' |
  | 5 | renders slide-field topic overlay using ctx.topic | slide-field | top-left overlay text content === 'folk-music' |
  | 6 | renders mint pill `<span>` on hook segment with highlightColor | hook pill | `<span>` with backgroundColor #9DECC1, padding '4px 12px', borderRadius '8px', marginRight '8px' |
  | 7 | renders block-style highlight `<span>` on body segment | body block | `<span>` with backgroundColor #FFFF00, padding '4px 8px', borderRadius '0' |
  | 8 | falls back gracefully when ctx is omitted — counter renders 1/1 | missing-ctx | top-right overlay text content === '1/1' |
  | 9 | falls back gracefully when ctx is omitted — slide-field topic resolves to empty | missing-ctx | top-left overlay text content === '' |
  | 10 | mutex: style_overrides.layout=cover wins over backgroundMode=image-with-bottom-card | mutual-exclusion | bottom-card div ABSENT (legacy NEWS_LAYOUT path runs) |
- `src/__tests__/render/__snapshots__/render-slide-satori.test.tsx.snap` (1313 lines) — vitest auto-generated snapshot baseline for the 10 tests above.

### Modified

- `src/lib/render/render-slide-satori.tsx` (+116 / −12 lines)
  - Added 5 imports from `./resolve-overlay`.
  - `renderSegmentChildren` (lines 32-49 → 45-52) replaced with a 4-line delegator to `renderSegmentsShared`.
  - `buildSlideElement` signature gained 6th `ctx?` parameter.
  - Function body now derives `resolveCtx`, `useBgMode`, `useBottomCard`.
  - JSX tree now emits bottom-card layer + overlay-zones layer in correct DOM order.

- `src/app/api/render/route.ts:97-102` — single-slide endpoint passes `{ slideIndex: index, totalSlides: (p.slide_data ?? []).length, topic: p.topic }`.
- `src/app/api/v1/projects/[id]/download/route.ts:73-80` — ZIP loop hoists `totalSlides = slides.length` and passes `{ slideIndex: i, totalSlides, topic: project.topic }` per slide.
- `src/app/(dashboard)/project/[id]/publish-actions.ts:51-55` — hero render passes `{ slideIndex: 0, totalSlides: 1, topic: project.topic }`.
- `src/lib/services/publish.ts:58-62` — same shape as publish-actions.
- `src/app/api/admin/seed-explore/route.ts:237-244` — dev-only seed passes `{ slideIndex: 0, totalSlides: 1, topic: undefined }` (no `Project` in scope; graceful-fallback path documented in CONTEXT.md Area 4).

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Bottom-card layer inserted BEFORE overlay zones in JSX order | Matches CONTEXT.md Area 1 DOM stack: layers 3 → 4 → 5 (card surface → chips/counter/pill → hook). Reversing them would put the chip/counter UNDER the card surface. |
| 2 | Did not extract a separate `bgImageNode` — reused existing background-image branch | The existing renderer already paints `<img>` at `width: W, height: H, objectFit: 'cover'` when `slide.background_url && !newsZone`. That is exactly what `backgroundMode: 'image-bleed'` requires per RESEARCH.md Pitfall 3. Adding a second branch would duplicate code and risk drift. |
| 3 | Permissive index access on SLOT_GEOMETRY for additive-nudge branches | The union type doesn't have `left` on every member, but the runtime guard `typeof === 'number'` narrows safely. Chosen over creating a 6th overlay-specific type to keep the additive nudge ergonomic. |
| 4 | `renderSegmentChildren` preserved as a delegator (not renamed/inlined) | The 3 internal call sites (hook/body/custom_texts) stay byte-identical at their call expressions. Minimizes diff churn while routing all segment rendering through the shared pill-aware implementation. |
| 5 | Explicit `key={\`overlay-${i}-${overlay.position}\`}` on the overlay map | RESEARCH.md Pitfall 6 — React 19 minor versions sometimes auto-annotate keys; the explicit key keeps snapshots stable across minor patches. |
| 6 | Tree-walk helper recurses into Array nodes | The original RESEARCH.md walk pattern stops at Array boundaries. `template.overlays?.map()` returns an array that becomes a child of the root `<div>`, and tests need to reach the inner overlay `<div>`s. |
| 7 | seed-explore passes `topic: undefined` rather than threading any seed-specific topic | seed-explore renders heroes from in-route `SeedEntry` fixtures (not from a `Project` row); resolver returns `''` for slide-field topic, which is the documented graceful fallback and the right behavior for dev-only seeded carousels. |

## Deviations from Plan

None functionally — plan executed as written. Two minor fidelity-preserving adjustments:

1. **Walk helper extension during GREEN (Rule 3 — auto-fix blocking issue):** the initial RED-state test file used the RESEARCH.md walk pattern verbatim, which doesn't recurse into Array nodes. Tests 4, 5, 8, 9 (overlay-positional assertions) failed in GREEN until the walk was extended to descend into Array children. This is a test-helper fix, not a deviation from the plan's `<behavior>`. Tracked in `key-decisions` table as decision 6.
2. **Permissive type assertion on SLOT_GEOMETRY index (Rule 3 — auto-fix blocking issue):** TypeScript's union narrowing rejected `slot.left` on the additive-nudge branch because top-right has no `left` member. Cast to `Record<string, unknown> | null` and added the runtime `typeof === 'number'` guard. Maintains type safety; no functional change. Tracked as decision 3.

Both adjustments are within scope per the task `<action>` description ("if the loop is currently a `for...of slides.entries()` ... adapt accordingly — the principle is ..."). No architectural change.

## Issues Encountered

**Pre-existing baseline test failures (out of scope, NOT caused by 45-02).**

Same 7 test files / 12 tests fail before AND after Plan 45-02:

| File | Failing tests |
|------|---------------|
| `src/__tests__/api/rate-limit.test.ts` | 2 (Upstash mock drift) |
| `src/__tests__/components/slide-preview.test.tsx` | 2 (slide-preview mock drift — pre-Phase-45) |
| `src/__tests__/editor/responsive.test.tsx` | 2 (editor layout mock drift) |
| `src/__tests__/editor/slide-preview.test.tsx` | 1 (SlideCanvas mock drift) |
| `src/__tests__/projects/crud.test.ts` | 3 (Supabase mock drift in CRUD) |
| `src/__tests__/stripe/checkout.test.ts` | 1 (Stripe mock drift) |
| `src/__tests__/stripe/sync-subscription.test.ts` | 1 (tier label drift Pro vs Creator) |

All 12 tests are documented in `.planning/phases/45-renderer-composition/deferred-items.md` and predate Phase 45. Verified by comparing test counts before and after Plan 45-02 commits.

**TypeScript baseline:** 14 pre-existing errors in test mocks (stripe / supabase / api-keys / auth signal-mock drift). `npx tsc --noEmit` returns the same 14 errors before and after Plan 45-02 — zero new errors introduced.

## TDD Gate Compliance

Plan declared `type: tdd` at the plan level + `tdd="true"` on Tasks 1, 2, 3. Gate sequence verified in `git log --oneline -5`:

- ✓ RED commit (`8ba4c9e` — `test(45-02): add failing Satori snapshot tests for overlays/backgroundMode/pills (RED)`) precedes GREEN
- ✓ GREEN commit (`9f692cd` — `feat(45-02): wire Satori renderer to shared resolver — overlays/backgroundMode/pills (GREEN)`) follows RED with implementation
- ✓ Callsite-wiring commit (`b1b8683` — `feat(45-02): pass ctx to buildSlideElement at all 5 server callsites`) follows GREEN

The RED phase was confirmed by vitest output: 7 of 10 tests failed due to missing overlay JSX / missing `ctx` parameter / missing background-mode branches / missing pill markup. Tests 1 (legacy) and 10 (mutex) and 2 (image-bleed — falls through to existing img branch) passed even in RED, which is consistent with their semantics.

REFACTOR phase: not applicable; the GREEN implementation hit all 10 tests with one walk-helper fix and one TS-narrowing fix. No code-cleanliness pass needed beyond inline comments documenting the layer-stack ordering and the additive-nudge logic.

## Threat Model Verification

Plan declared 4 STRIDE threats; all dispositions honored in implementation:

- **T-45-02-01 (Tampering / XSS via overlay text from `project.topic`, mitigate):** ✓ All overlay text emits as `{text}` children of `<div>`. React/Satori automatically escape text-node content for both renderers. The legacy HTML path (`render-slide.ts`) is NOT extended in this plan.
- **T-45-02-02 (Tampering via `template.overlays[i].style` inline-style passthrough, accept):** ✓ `template.overlays` is in-repo code, not user input. Phase 44 validator guards the SHAPE; values pass through verbatim per CONTEXT.md decision. `overlay.style` lands as `style={{ ...overlay.style ?? {} }}` directly — no normalization, no parser.
- **T-45-02-03 (Tampering via `slide.background_url` in `<img src>`, accept):** ✓ URLs already validated upstream by Pexels / upload / AI-generation flows. Existing `<img>` branch unchanged; the new `useBgMode` path reuses it without introducing any new attack surface.
- **T-45-02-04 (DoS via bottom-card text overflow, accept):** ✓ Hook continues to flow through existing `news-hook-fit.ts` auto-shrink helper; body uses `overflow: hidden`. Phase 47 prompt-tuning enforces word caps so this is rarely hit. Multi-line measurement deferred to v2.8+.

No new security-relevant surface beyond the threat register — bottom-card and overlay-zones layers are pure-presentation; no I/O, no parsing of untrusted strings.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for 45-03 (React preview wiring):**
- Same 5 exports from `resolve-overlay.ts` available client-side (no server-only deps in the resolver).
- DOM layer order to mirror in `<SlidePreview>`: bg `<img>` → tint `<div>` → bottom-card `<div>` (when `useBottomCard`) → overlay zones `<div>` map → hook `<div>` → body `<div>` → custom_images → brand watermark → forced watermark.
- Required prop additions on `<SlidePreview>`: `slideIndex?: number = 0`, `totalSlides?: number = 1`. Editor callsites (`slide-canvas.tsx`, `slide-grid.tsx`, `slide-list.tsx`) already iterate slide arrays — adding the props is local.
- Inline-style signatures for highlight pills (mirror these EXACTLY in slide-preview.tsx for TPLREND-05):
  - pill: `backgroundColor: <color>, padding: '4px 12px', borderRadius: '8px', marginRight: '8px'`
  - block: `backgroundColor: <color>, padding: '4px 8px', borderRadius: '0', marginRight: '8px'`
- Bottom-card style signature: `position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%', padding: 80, backgroundColor: bottomCardBackground(template.backgroundColor)`
- Overlay div signature: `position: 'absolute', ...SLOT_GEOMETRY[overlay.position], display: 'flex', alignItems: 'center', ...(overlay.style ?? {})`
- `box-decoration-break: clone` ban — slide-preview.tsx must NOT set this property even though browsers support it (parity contract with Satori, TPLREND-05). Document as inline comment per CONTEXT.md.
- Tests to extend (in `slide-preview.test.tsx`): page-counter renders correct text at index N of M; highlight-pill `<span>` carries exact inline-style signature matching Satori's; overlays render in BOTH non-editable AND editable branches of `<SlidePreview>`.

**Blockers:** none.

## Patterns Established for Plan 45-03

The React preview implementation must mirror EXACTLY this DOM order + shared resolver imports:

1. **Imports:** `import { resolveOverlayContent, SLOT_GEOMETRY, renderSegments, bottomCardBackground } from '@/lib/render/resolve-overlay'`
2. **Mutual-exclusion gate** identical to Satori: `useBgMode = !newsZone && template.backgroundMode != null && template.backgroundMode !== 'color'; useBottomCard = useBgMode && template.backgroundMode === 'image-with-bottom-card'`
3. **Graceful-fallback resolveCtx:** `{ slideIndex: slideIndex ?? 0, totalSlides: totalSlides ?? 1, topic, slide }`
4. **DOM layer order** (matches Satori; both branches of slide-preview.tsx must mirror):
   - Layer 1: bg `<img>` (`useBgMode` → full-bleed `100%/100% objectFit:cover`; React uses % since parent is scaled)
   - Layer 2: tint `<div>` (existing — keep)
   - Layer 3: bottom-card `<div>` (`useBottomCard`)
   - Layer 4: overlay zones `<div>` map (when `template.overlays` exists)
   - Layer 5: hook `<div>` (existing — keep, with shared `renderSegments` call)
   - Layer 6: body `<div>` (existing — keep, with shared `renderSegments` call)
   - Layers 7-9: custom_images / brand watermark / forced watermark (existing — keep)
5. **Pill spans:** route ALL hook/body/custom_texts segments through `renderSegments` from the shared resolver — do NOT inline a copy. Both editable and non-editable render branches must mirror this.

## Manual Smoke Note

Confirmed via `awk '/^exports\\[.+legacy-template-no-overlay-no-bg-mode/,/^\`;$/' .../render-slide-satori.test.tsx.snap | grep -E "bottom-card|bg-bleed|overlay-|height: '38%'|box-decoration-break"` returns NO content matches inside the legacy-template snapshot block (only the snapshot header line itself, which mentions "no-overlay-no-bg-mode" by name). The legacy-template snapshot has no Phase 45 layers — regression-safety contract verified.

## Self-Check: PASSED

Verified post-creation:

- ✓ FOUND: `src/__tests__/render/render-slide-satori.test.tsx` (429 lines, 10 `it()` blocks)
- ✓ FOUND: `src/__tests__/render/__snapshots__/render-slide-satori.test.tsx.snap` (10 snapshot entries)
- ✓ FOUND: `src/lib/render/render-slide-satori.tsx` extended (imports, ctx param, useBgMode/useBottomCard gates, bottom-card layer, overlay-zones layer)
- ✓ FOUND: 5 callsite files all pass `ctx` (verified via `grep -c "buildSlideElement.*ctx"` returning 1 per file)
- ✓ FOUND commit: `8ba4c9e` (RED) in `git log --oneline -5`
- ✓ FOUND commit: `9f692cd` (GREEN) in `git log --oneline -5`
- ✓ FOUND commit: `b1b8683` (callsite-wiring) in `git log --oneline -5`
- ✓ React preview unchanged: `git diff HEAD~3 HEAD -- src/components/slides/slide-preview.tsx` empty
- ✓ resolve-overlay.ts unchanged: `git diff HEAD~3 HEAD -- src/lib/render/resolve-overlay.ts` empty
- ✓ Test verification: `npx vitest run src/__tests__/render/render-slide-satori.test.tsx` → 10/10 passing
- ✓ Full suite: `npx vitest run` → 44 files / 323 tests passing; 7 files / 12 tests failed (all pre-existing baseline)
- ✓ TS verification: `npx tsc --noEmit | wc -l` → 14 baseline errors (zero new)
- ✓ Verification grep: `grep -c "buildSlideElement.*ctx"` returns 1 for each of 5 callsite files

---
*Phase: 45-renderer-composition*
*Plan: 02*
*Completed: 2026-04-29*
