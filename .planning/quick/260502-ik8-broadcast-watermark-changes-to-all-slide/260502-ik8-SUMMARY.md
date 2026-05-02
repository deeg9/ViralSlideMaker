---
quick_id: 260502-ik8
date: 2026-05-02
status: complete
description: Watermark toggle / position / custom-logo upload+remove now broadcast to ALL slides in the project instead of mutating only the active slide
commits:
  - 015a3e3 fix(quick-260502-ik8/t1): broadcast watermark changes to all slides
  - d7723e6 test(quick-260502-ik8/t2): broadcast watermark changes to all slides
files_changed:
  - src/app/(dashboard)/project/[id]/editor-actions.ts
  - src/components/editor/slide-editor.tsx
  - src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx
  - src/components/editor/__tests__/slide-editor.treatment-sync.test.tsx (mock-shape adjustment only)
---

# 260502-ik8 — Project-wide watermark broadcast

## Symptom

On paid tier, clicking **Show watermark** in the right rail flipped `enabled: true` on the active slide only — sibling slides kept their previous watermark state. Same was true for the position picker, custom-logo upload, and custom-logo remove. The user's mental model: watermark is a project-wide setting, not per-slide.

## Fix — broadcast architecture

Schema stays per-slide (`slide.style_overrides.watermark` JSONB), but every write fans out to all slides:

1. **Server**: `updateSlideWatermark(projectId, slideIndex, patch)` removed; replaced by `updateProjectWatermark(projectId, patch)` that loops every slide, merges `{ ...existing, ...patch }` into each `style_overrides.watermark`, and writes the full `slide_data` array in one Supabase update. Same auth + paid-tier guard as before.
2. **Client**: three handlers (`handleSlideWatermarkChange`, `handleWatermarkLogoUpload`, `handleWatermarkLogoRemove`) now build a `next = slides.map(...)` client-side and dispatch `{ type: 'SET_SLIDES', slides: next }`. `SET_SLIDES` already runs through `pushHistory`, so a project-wide change is one undo step.
3. **Reducer**: untouched.

Rejected alternative: moving watermark to a `projects.watermark` JSONB column. Required a migration + new aggregation logic + per-slide override fallback. Pre-PMF — broadcast is faster and the per-slide schema can stay if anyone ever wants per-slide overrides later.

`updateSlideWatermark` was deleted (grep confirmed only the rewritten handlers + the watermark-sync test referenced it).

## Verification

| Check | Result |
|-------|--------|
| `npx eslint` (slide-editor.tsx + editor-actions.ts + new test) | clean (1 pre-existing unused-var warning, not from this diff) |
| `npx vitest run slide-editor.watermark-sync.test.tsx` | **4/4 pass** (toggle ON broadcast, toggle OFF broadcast, logo remove broadcast, sibling-keys preserved) |
| `npx vitest run watermark-controls.test.tsx` | regression-free |
| `npx vitest run slide-editor.shortcuts.test.tsx` | regression-free |
| `npx vitest run slide-editor.treatment-sync.test.tsx` | regression-free (mock-shape adjustment held) |
| Combined run | 25/25 pass |
| `grep -rn "updateSlideWatermark" src/` | 0 matches (cleanly removed) |

**Live Playwright verification (paid tier, project with 7 slides):**

- Initial: watermark off, **0** `ViralSlideMaker.com` watermarks visible.
- Click "Show watermark" once → switch flips checked, **8** watermarks render (7 slide thumbnails + 1 active canvas) — all slides simultaneously, no refresh.
- Click "Show watermark" again → all 8 disappear immediately, returning to 0.
- Click "Show watermark" again → DB query confirms `(SELECT COUNT(*) FROM jsonb_array_elements(slide_data) AS s WHERE (s->'style_overrides'->'watermark'->>'enabled')::boolean = true)` returns **7 of 7** — all slides persisted.
- Test account tier was bumped from `free` → `plus` for the run, then reverted to `free`.

## Notes / artefacts

- `currentSlide` (the line-91 hoist from quick-260502-fai) is still used by `handleSlideTreatmentChange`. The watermark handlers no longer need it; their dep arrays now reference `slides` instead.
- Treatment, photo settings, hook/body positions, and other per-slide style overrides remain per-slide — only watermark broadcasts.
- No DB migration. Existing per-slide watermark state in `slide_data` is honored on next render; the next watermark write rebroadcasts.

## Out of scope

- Free tier behavior (forced watermark always renders on every slide via `resolveForcedWatermark` regardless of `enabled`).
- Per-slide watermark override (intentionally removed — could be re-added with a "different on this slide" affordance if a user ever asks).
- Cross-project watermark settings (e.g., "always show my logo on all new projects") — separate quick if surfaced.
