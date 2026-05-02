---
quick_id: 260502-fai
date: 2026-05-02
status: complete
description: Fix paid-tier watermark toggle — dispatch UPDATE_SLIDE alongside server action
commits:
  - 7dc2551 fix(quick-260502-fai/t1): dispatch UPDATE_SLIDE in watermark handlers for local-state sync
  - 3dc5dbf test(quick-260502-fai/t2): regression test for paid-tier watermark dispatch sync
files_changed:
  - src/components/editor/slide-editor.tsx
  - src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx
---

# 260502-fai — Paid-tier watermark toggle live-update fix

## Symptom (user-reported)

On paid tier (plus/pro), clicking the **Show watermark** Switch in the editor right rail did nothing visible — the toggle stayed off and the watermark never appeared in `<SlidePreview>` until a hard refresh. Free tier behavior was unaffected (watermark forced on, switch disabled).

## Root cause

`handleSlideWatermarkChange`, `handleWatermarkLogoUpload`, and `handleWatermarkLogoRemove` in `src/components/editor/slide-editor.tsx:103-146` only called the `updateSlideWatermark` server action. They never dispatched to the editor reducer, so `slides[selectedIndex].style_overrides.watermark` in client React state stayed unchanged. `<WatermarkControls>` and `<SlidePreview>` both read from that state, so the UI looked frozen until a hard reload re-fetched server data.

## Fix

Three handlers now dispatch `UPDATE_SLIDE` with the **exact merge shape** the server uses (`{ ...existingWatermark, ...patch }` nested inside `style_overrides`), then invoke the existing server action inside the same `useTransition`. `currentSlide = slides[selectedIndex]` was hoisted above the handlers; `currentSlide` and `dispatch` were added to the `useCallback` dep arrays.

## Test fallback in Task 2

**Not taken.** A clean integration test at `src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx` was achievable by mocking the editor-actions module and rendering `<SlideEditor>` with thin children stubs. Three vitest cases cover toggle-on, toggle-off, and logo-remove paths. The `buildWatermarkUpdate` helper-extraction escape hatch was unnecessary.

## Verification

| Check | Result |
|-------|--------|
| `npx eslint src/components/editor/slide-editor.tsx` | clean (1 pre-existing unused-var warning, not our diff) |
| `npx vitest run slide-editor.watermark-sync.test.tsx` | 3/3 pass |
| `npx vitest run watermark-controls.test.tsx` | 12/12 pass (regression-free) |
| `npx vitest run slide-editor.shortcuts.test.tsx` | 5/5 pass (regression-free vs `currentSlide` hoist) |
| Free-tier sanity (Playwright) | switch disabled, watermark renders forced — unchanged |
| Paid-tier toggle on (Playwright, plus tier) | switch flips checked, `ViralSlideMaker.com` renders in preview, position picker reveals — no refresh |
| Paid-tier toggle off (Playwright, plus tier) | switch flips unchecked, watermark disappears, position picker hides — no refresh |
| Persistence (Playwright, plus tier) | toggle on → hard reload → state preserved, watermark still visible |

Verification was run against `bigdfill@gmail.com` (the active session). The user's tier was bumped from `free` → `plus` for the duration of the test, then reverted to `free` — no permanent state changes to the local Supabase project.

## Out of scope (follow-up)

`handleSlideTreatmentChange` (slide-editor.tsx, ~line 92) has the **same local-state-sync bug shape** — it persists treatment changes via the server action but never dispatches to the reducer. Not user-reported, so left untouched per quick-task scope. A future quick should mirror this fix's pattern across that handler if a user reports laggy treatment changes.

An inline comment in `slide-editor.tsx` flags the follow-up at the watermark handler block.
