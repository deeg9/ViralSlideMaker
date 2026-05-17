---
phase: quick-260517-jfg
plan: 01
subsystem: ui
tags: [editor, slide-controls, react, radix-switch, news-layout]

# Dependency graph
requires:
  - phase: quick-260515-ju8
    provides: SlideSettings removal — the news-layout control this plan re-surfaces
  - phase: quick-260517-iiy
    provides: Caption Card control card (Color + Photo-height) this plan extends
provides:
  - On/off "Caption panel" Switch in the editor ELEMENTS tab Caption Card
  - Bottom/Top position radiogroup mapping onto style_overrides.layout
  - Color row + Photo-height slider gated behind the panel-on state
affects: [editor, slide-background-controls, news-layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UI control maps onto an existing closed-enum field (style_overrides.layout) — no new field"
    - "OFF state DELETES the layout key (not set to undefined) for byte-identical full-bleed slides"

key-files:
  created: []
  modified:
    - src/components/editor/slide-background-controls.tsx
    - src/components/editor/__tests__/slide-background-controls.test.tsx

key-decisions:
  - "Reused style_overrides.layout for on/off + position — no new SlideStyleOverrides field"
  - "OFF deletes the layout key so the slide is byte-identical to one that never had a panel"
  - "Position radiogroup is hidden (not disabled) while OFF — position is meaningless with no panel"
  - "Color row + Photo-height slider hidden while OFF; heightDraft hooks stay unconditional (rules-of-hooks)"

patterns-established:
  - "Switch primitive (Radix) forwards data-testid via {...props} — testid works directly on the Switch"
  - "Bottom/Top radiogroup markup copied verbatim from caption-bar-controls.tsx button styling"

requirements-completed: [QUICK-260517-jfg]

# Metrics
duration: 7min
completed: 2026-05-17
---

# Phase quick-260517-jfg Plan 01: Caption Card on/off toggle + Bottom/Top position Summary

**Added an on/off "Caption panel" Switch and a Bottom/Top position radiogroup to the editor's Caption Card, both mapping onto the existing `style_overrides.layout` closed-enum field with zero render-path changes.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-17T14:03:00Z
- **Completed:** 2026-05-17T14:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- On/off "Caption panel" Switch (`caption-card-toggle`) — ON sets `layout: 'cover'`, OFF deletes the `layout` key so the slide reverts to a full-bleed photo.
- Bottom/Top position radiogroup (`caption-card-position-cover` / `-body`) — cover = panel at bottom, body = panel at top; shown only while the panel is ON.
- Color row and Photo-height slider gated behind `captionPanelOn` — hidden while the panel is OFF.
- 21 unit tests pass (13 pre-existing/gated + 8 new); tsc holds the 19-error baseline; lint:gates green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add on/off Switch + Bottom/Top radiogroup (TDD)** — `6d4176b` (test, RED) → `2ef1c48` (feat, GREEN)
2. **Task 2: Typecheck + lint-gate regression check** — verification-only, no code changes to commit

**Plan metadata:** handled by the orchestrator's docs commit.

_Note: Task 1 is TDD — test commit (RED) then feat commit (GREEN). No refactor commit needed; implementation was clean. Task 2 produced no code diff (pure verification)._

## Files Created/Modified
- `src/components/editor/slide-background-controls.tsx` — Added `Switch` import, `layout`/`captionPanelOn`/`position` derivations, a `setLayoutOff()` helper that deletes the `layout` key, the on/off toggle row, the Bottom/Top position radiogroup, and gated the Color + Photo-height JSX behind `captionPanelOn`. Updated the file's top doc comment.
- `src/components/editor/__tests__/slide-background-controls.test.tsx` — Added a `Caption panel toggle + position` describe block (8 tests); gated 5 pre-existing Color/height assertions behind a `layout: 'cover'` slide so they still exercise the now-conditional controls.

## Decisions Made
- **Reused `style_overrides.layout` for both controls** — the closed enum `'cover' | 'body'` carries on/off + top/bottom losslessly; all 3 renderers already handle `cover`/`body`/undefined, so no new field and no render-path code were needed (per the plan's `<key_finding>`).
- **OFF deletes the `layout` key** rather than setting it to `undefined` — the renderers' `newsZone` gate is truthy only when `layout` is a defined key, so deletion yields a slide byte-identical to one that never had a caption panel.
- **Position radiogroup hidden (not disabled) while OFF** — position is meaningless without a panel; the plan explicitly left this as the planner's call and hidden is simplest.

## Deviations from Plan

None - plan executed exactly as written.

The plan anticipated gating "existing tests that assert on Color/height controls" behind a `layout: 'cover'` slide. Five pre-existing tests (palette input, palette-icon button, fallback-swatch, resolved-swatch-active, and two height-slider seed tests) queried Color/height controls with layout-free slides; all were gated behind `layout: 'cover'` exactly as the plan's `<behavior>` block instructed ("only gate them behind a slide that has `layout: 'cover'`"). This is planned-for test maintenance, not a deviation.

## Issues Encountered
- First GREEN run left 2 height-slider tests red because they seeded the slider from layout-free slides — resolved by applying the plan-mandated `layout: 'cover'` gating to those two tests (one also kept its `news_image_height: 70` override). All 21 tests then passed.

## TDD Gate Compliance
- RED gate: `6d4176b` (`test(...)`) — 8 new tests failed before implementation.
- GREEN gate: `2ef1c48` (`feat(...)`) — all 21 tests passed after implementation.
- No REFACTOR commit — implementation needed no cleanup.

## Verification
- `npx vitest run src/components/editor/__tests__/slide-background-controls.test.tsx` — 21/21 pass.
- `npx tsc --noEmit` — exactly 19 `error TS` lines (documented baseline held, 0 new).
- `npm run lint:gates` — green (PARITY-05 closed-enum, prompt-token-budget, framing).
- `git diff --name-only` vs base — only the 2 planned files changed; no `src/lib/render/` file touched (render parity / byte-identity preserved by construction).
- `grep -rn "caption_card_enabled|caption_card_position" src/` — zero matches (no new field crept in).

## Self-Check: PASSED
- `src/components/editor/slide-background-controls.tsx` — FOUND (modified)
- `src/components/editor/__tests__/slide-background-controls.test.tsx` — FOUND (modified)
- Commit `6d4176b` (test, RED) — FOUND in git log
- Commit `2ef1c48` (feat, GREEN) — FOUND in git log

## Next Phase Readiness
- The news-layout control removed with `SlideSettings` (quick-260515-ju8) is now re-surfaced inside the Caption Card. No blockers.
- Pre-existing baseline (~19 tsc errors, stale render-snapshot / editor-fixture suites) is unrelated and untouched — see `deferred-items.md` in this plan folder.

---
*Phase: quick-260517-jfg*
*Completed: 2026-05-17*
