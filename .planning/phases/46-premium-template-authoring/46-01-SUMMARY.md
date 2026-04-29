---
phase: 46-premium-template-authoring
plan: 01
subsystem: ui
tags: [templates, magazine-bold, tr3nding-news, documentary, overlays, backgroundMode, premium-tier, satori, react-preview]

# Dependency graph
requires:
  - phase: 44-template-schema-foundation
    provides: SlideTemplate.overlays + backgroundMode + TextSegment.highlightColor/highlightStyle schema; validateTemplateRegistry module-load gate
  - phase: 45-renderer-composition
    provides: resolveOverlayContent + SLOT_GEOMETRY + renderSegments + bottomCardBackground; Satori + React preview composition surfaces consume template.overlays/backgroundMode
provides:
  - magazine-bold premium template (Murphy reference, image-with-bottom-card + mint topic chip + counter)
  - tr3nding-news premium template (sibling mid-pill variant, black pill with mint TR3NDING text)
  - documentary premium template (minimal photo-forward, image-bleed + free-slot bottom-darken gradient)
  - 8-template registry (5 legacy + 3 Phase 46 premium); highlight-bar preserved at index 0 for getTemplate fallback
  - Sample data populated for all 3 → template picker mini-previews render real slides (TPLNEW-04)
  - Phase 44 validator green for all 8 templates at module load
affects: [phase-47-ai-prompt-tuning, phase-48-template-thumbnails-and-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Premium-tier cohesion contract (mint #A8E0B0 + Anton/Inter on magazine-bold + tr3nding-news; deliberate divergence on documentary)"
    - "Free-slot overlay used as styled-div surface — first non-trivial use of the free slot in v2.7 (documentary gradient)"
    - "Schema-shape compatibility comments in template files to document intentional drops of unsupported style fields (width/height/opacity per Phase 44 locked TemplateOverlay.style union)"
    - "Test contract update colocated with the production change that drives it (5→8 length + overlays-presence partition kept in src/__tests__/render/templates.test.ts)"

key-files:
  created:
    - src/lib/render/templates/magazine-bold.ts
    - src/lib/render/templates/tr3nding-news.ts
    - src/lib/render/templates/documentary.ts
    - .planning/phases/46-premium-template-authoring/46-01-SUMMARY.md
  modified:
    - src/lib/render/templates/index.ts
    - src/__tests__/render/templates.test.ts

key-decisions:
  - "Dropped width/height/opacity overlay style fields not present in Phase 44 TemplateOverlay.style union; gradient sizing delegated to free-slot wrapper at offset.y=1340; counter ghosting achieved via background:transparent + padding:0"
  - "Field ordering in each new template TS module mirrors news-drop.ts for diff readability (id → backgroundMode → overlays → sample)"
  - "documentary gradient overlay placed LAST in overlays array per 46-CONTEXT.md decision (explicit DOM-order intent — overlays render below hook/body)"
  - "Updated src/__tests__/render/templates.test.ts to expect 8 entries + partition overlays presence by template id (legacy 5 = undefined, premium 3 = non-empty array). This is in-scope per Rule 1 because the failure was DIRECTLY caused by this task's intentional registry growth"

patterns-established:
  - "Premium-tier cohesion vs deliberate divergence: siblings (magazine-bold + tr3nding-news) share identity tokens (mint #A8E0B0 + Anton hook + Inter body + image-with-bottom-card), divergent template (documentary) drops accent + condensed display font + segment pills in a single coherent direction"
  - "Schema-locked authoring: when CONTEXT/UI-SPEC tokens reference fields outside the current TemplateOverlay.style union, drop those fields in-template with a documented schema-shape note (do NOT extend the union — Phase 44 is locked)"
  - "Registry append for new tiers: append AFTER existing templates to preserve getTemplate(id) array[0] fallback contract for legacy template_id values"

requirements-completed: [TPLNEW-01, TPLNEW-02, TPLNEW-03, TPLNEW-04]

# Metrics
duration: 4min
completed: 2026-04-29
---

# Phase 46 Plan 01: Author 3 Premium Templates + Registry Wire-Up Summary

**Three new premium templates (magazine-bold, tr3nding-news, documentary) shipped as TS modules + wired into the 8-template registry; Phase 44 validator green at module load; npm run build exits 0; zero new TypeScript errors and zero new test regressions vs the 45-03 baseline.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-29T18:20:20Z
- **Completed:** 2026-04-29T18:24:04Z
- **Tasks:** 2
- **Files modified:** 5 (3 created + 2 modified)

## Accomplishments

- `magazineBold` SlideTemplate constant — Murphy reference flagship: image-with-bottom-card mode, top-left mint topic chip (slide-field topic), top-right page counter pill, Anton hook + Inter body, mint #A8E0B0 accent + hook_segments pill highlights, all locked tokens verbatim from 46-UI-SPEC.md.
- `tr3ndingNews` SlideTemplate constant — sibling mid-pill variant: same premium-tier identity (mint + Anton/Inter + image-with-bottom-card) but mid-slot black pill with mint TR3NDING literal in place of magazine-bold's top-left chip.
- `documentary` SlideTemplate constant — minimal photo-forward divergence: image-bleed + ghosted top-right counter (transparent background, padding 0) + free-slot linear-gradient overlay at offset.y=1340 (first non-trivial use of free slot in v2.7); Inter for both hook and body, no mint, no segments, hookStyle 'normal'.
- All 3 templates ship populated `sample` data (story-shaped real content, not lorem) so the template picker mini-previews render actual slides via Phase 45's `<SlidePreview>` consumption (TPLNEW-04).
- Registry expanded 5→8 with the 3 new templates appended AFTER `boldYellow`; `highlightBar` remains at index 0 so `getTemplate(id)` array[0] fallback contract is preserved.
- Phase 44 `validateTemplateRegistry` (top-level call at templates/index.ts module load) passes for all 8 templates — `npm run build` exits 0; the validator vetted 5 new overlay declarations across the 3 premium templates (1 top-left + 2 top-right + 1 mid + 1 free) with no slot/content/duplicate-slot misconfigurations.

## Task Commits

1. **Task 1: Author magazine-bold + tr3nding-news + documentary template TS modules** — `a349745` (feat)
2. **Task 2: Register 3 new templates in templates/index.ts (after the existing 5)** — `75fd72f` (feat)

## Files Created/Modified

- `src/lib/render/templates/magazine-bold.ts` — Murphy-reference flagship premium template (69 lines)
- `src/lib/render/templates/tr3nding-news.ts` — mid-pill variant premium template (67 lines)
- `src/lib/render/templates/documentary.ts` — minimal photo-forward divergence template (67 lines)
- `src/lib/render/templates/index.ts` — Added 3 imports + 3 array entries; preserved highlightBar at index 0 + the `validateTemplateRegistry(templates)` top-level call
- `src/__tests__/render/templates.test.ts` — Updated registry-shape assertions to match Phase 46's intentional registry growth (5→8 entries; overlays-presence partition by template id; see Deviations)

## Decisions Made

- **Dropped width/height/opacity overlay style fields:** 46-CONTEXT.md / 46-UI-SPEC.md describe the documentary gradient with `width: '1080px'` + `height: '580px'` and the documentary counter with `opacity: 0.7`. None of those keys are part of Phase 44's locked `TemplateOverlay.style` union (`background | color | padding | borderRadius | fontSize | fontWeight | textTransform`). Per the plan's critical-correctness rules, these are dropped in this plan. Visual intent preserved via the supported tokens: gradient sized through Phase 45's free-slot wrapper at `offset: { x: 0, y: 1340 }` (1920 − 580 = 1340), counter "ghosted" feel via `background: 'transparent'` + `padding: '0'`. Documented inline in `documentary.ts` and `magazine-bold.ts` schema-shape notes.
- **Field ordering follows news-drop.ts:** id → name → thumbnail → fontFamily → headingFontFamily → font sizes → text/background/overlay colors → overlayOpacity → textAlign → textPosition → hookStyle → accentColor → backgroundMode → overlays → sample. Maximizes diff readability for future template authors.
- **documentary gradient overlay placed LAST in overlays array:** matches 46-CONTEXT.md Area 3 explicit DOM-order intent — Phase 45 layer stack puts overlays BELOW hook/body, so the gradient sits beneath the text without occluding it.
- **highlightBar stays at index 0:** preserves `getTemplate(id)` array[0] fallback contract for legacy template_id values from before the v2.5 trim. New premium tier appended AFTER boldYellow.
- **Test contract update colocated with production change:** Updated `src/__tests__/render/templates.test.ts` to assert 8 entries (not 5) + partition `overlays` presence by template id (legacy 5 = undefined, premium 3 = non-empty array). The old assertion (`expect(templates).toHaveLength(5)`) was a stale shape contract that this task INTENTIONALLY breaks per the plan; updating it is in-scope per Rule 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Update src/__tests__/render/templates.test.ts assertions to match Phase 46's 8-template registry**

- **Found during:** Task 2 (registry wire-up — full vitest run after the registry edit)
- **Issue:** Two assertions in `src/__tests__/render/templates.test.ts` encoded the pre-Phase-46 registry shape (`expect(templates).toHaveLength(5)`) and the pre-Phase-46 overlay invariant (`expect(t.overlays).toBeUndefined()` for every template). Phase 46 deliberately changes both contracts: the registry now has 8 entries, and 3 of them declare `overlays`. Without an update, the suite reported 13 failures (11 pre-existing + 2 newly broken by Task 2's intentional registry growth).
- **Fix:** Updated the `length === 5` assertion to `length === 8` with an updated test name. Updated the "module-load validator passes" test to partition by template id: legacy 5 (`highlight-bar`, `news-drop`, `news-cyan`, `y2k-pop`, `bold-yellow`) MUST have `overlays === undefined`; premium 3 (`magazine-bold`, `tr3nding-news`, `documentary`) MUST declare a non-empty `overlays` array. Added an `unexpected template id` defensive throw to catch future drift.
- **Files modified:** `src/__tests__/render/templates.test.ts`
- **Verification:** `npx vitest run src/__tests__/render/templates.test.ts` → 8 passed / 0 failed. Full suite: 339 passed / 11 failed (matches the 45-03 baseline noted in plan verification — zero new regressions).
- **Committed in:** `75fd72f` (Task 2 commit — colocated with the production change that drives the contract change)
- **Scope justification:** This failure was DIRECTLY caused by Task 2's intentional registry growth (the plan explicitly states the registry will go 5→8). It is NOT a pre-existing failure (those are tracked in `.planning/phases/45-renderer-composition/deferred-items.md`). Per executor scope rules, in-scope auto-fix.

---

**Total deviations:** 1 auto-fixed (1 bug — pre-existing test contract that the plan's intentional registry growth invalidated)
**Impact on plan:** Necessary for build/test correctness. No scope creep — only the assertions invalidated by the registry change were touched.

## Issues Encountered

None. The build passed on the first run (validator green for all 8 templates at module load), TypeScript stayed at the 14-error baseline, and the only test-suite delta vs the 45-03 baseline was the templates.test.ts assertion updates noted above.

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `npm run build` exit code | 0 | 0 | PASS |
| Phase 44 validator at module load (8 templates) | green | green | PASS |
| `npx tsc --noEmit` total errors | 14 (baseline) | 14 | PASS |
| New TS errors in 3 new template files | 0 | 0 | PASS |
| `vitest run` total | ~339 pass / ~11 fail (45-03 baseline) | 339 pass / 11 fail | PASS |
| All 3 new template ids resolvable via `getTemplate()` | yes | yes (validator confirms) | PASS |
| `getTemplate('nonexistent')` falls back to `highlight-bar` | yes | yes (test 4 in templates.test.ts) | PASS |
| highlightBar at registry index 0 | yes | yes (grep of array head) | PASS |
| Mint #A8E0B0 in magazine-bold + tr3nding-news (cohesion) | ≥ 3 each | 4 each | PASS |
| Mint absent from documentary (divergence) | 0 | 0 | PASS |
| Anton absent from documentary (divergence) | 0 | 0 | PASS |
| hook_segments absent from documentary (divergence) | 0 | 0 | PASS |
| Gradient string verbatim | 1 match | 1 match | PASS |

## User Setup Required

None — no external service configuration required. Template thumbnail PNGs at `/templates/<id>.png` paths are decorative until Phase 48 generates them; Phase 45's sample-driven mini-previews render real slides in the picker today.

## Next Phase Readiness

- **Plan 46-02 ready:** Closes TPLNEW-05 with the regression snapshot test (5 legacy templates) + new-template snapshot tests + DOM signature parity tests for the 3 premium templates. All consumed contracts (Phase 44 schema, Phase 45 renderer, Phase 46 template configs) are now committed and stable.
- **Phase 47 (AI Prompt Tuning) ready to plan:** AI prompt context can now reference `magazine-bold`, `tr3nding-news`, `documentary` by id; their `accentColor` and `name` metadata is loaded into the registry.
- **Phase 48 (Thumbnails & Picker):** Three new `thumbnail: '/templates/<id>.png'` paths now declared but PNGs do not exist on disk — Phase 48 owns generation. Picker renders real `<SlidePreview>` mini-previews via populated `sample` data in the meantime.

## Self-Check: PASSED

- File `src/lib/render/templates/magazine-bold.ts` — FOUND
- File `src/lib/render/templates/tr3nding-news.ts` — FOUND
- File `src/lib/render/templates/documentary.ts` — FOUND
- File `src/lib/render/templates/index.ts` — FOUND (modified)
- File `src/__tests__/render/templates.test.ts` — FOUND (modified)
- Commit `a349745` — FOUND in git log
- Commit `75fd72f` — FOUND in git log

---
*Phase: 46-premium-template-authoring*
*Completed: 2026-04-29*
