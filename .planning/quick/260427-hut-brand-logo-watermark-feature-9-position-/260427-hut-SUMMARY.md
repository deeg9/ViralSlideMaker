---
phase: 260427-hut
plan: 01
subsystem: brand-kit / render
tags: [watermark, brand-kit, render, satori, editor]
requires:
  - brand_kits table (003_create_brand_kits.sql)
  - logo upload pipeline (uploadLogo, getBrandKit)
  - existing renderers (render-slide.ts, render-slide-satori.tsx, slide-preview.tsx)
provides:
  - Brand logo watermark on every slide across 3 render paths
  - 9-position grid + size/opacity sliders + live preview tile in Brand Kit settings
  - Per-slide hide toggle in editor right panel
  - resolveWatermark() pure function shared by all render paths
affects:
  - Brand Kit settings flow
  - Slide editor (right panel, canvas, thumbnails)
  - /api/render and /api/v1/projects/[id]/download outputs
tech-stack:
  added: []
  patterns:
    - "Single resolver (resolveWatermark) consumed by 3 renderers — avoids drift"
    - "Brand kit threaded server -> client (project page -> SlideEditor -> SlidePreview)"
    - "Per-slide override stored as undefined when off (minimal style_overrides shape)"
key-files:
  created:
    - supabase/migrations/20260427_brand_kit_watermark.sql
    - src/lib/render/resolve-watermark.ts
    - src/lib/render/resolve-watermark.test.ts
  modified:
    - src/lib/types/brand-kit.ts
    - src/lib/types/slide.ts
    - src/app/(dashboard)/settings/brand-kit/actions.ts
    - src/components/brand-kit/brand-kit-form.tsx
    - src/lib/render/render-slide.ts
    - src/lib/render/render-slide-satori.tsx
    - src/components/slides/slide-preview.tsx
    - src/app/api/render/route.ts
    - src/app/api/v1/projects/[id]/download/route.ts
    - src/app/(dashboard)/project/[id]/page.tsx
    - src/components/editor/slide-editor.tsx
    - src/components/editor/slide-canvas.tsx
    - src/components/editor/slide-list.tsx
    - src/components/editor/sortable-slide.tsx
    - src/components/editor/text-editor-panel.tsx
decisions:
  - "Render watermark as plain <img> with pointer-events:none (no Rnd) so it never competes with custom_images for selection"
  - "Per-slide hide stored as undefined when off, true when on — avoids polluting style_overrides with hide_watermark:false"
  - "Form pre-selects bottom-right visually for guidance but persists null until the user clicks a cell"
  - "Server-side clamp on save (size 4–20, opacity 10–100) duplicates DB CHECK constraints as defense-in-depth"
metrics:
  duration: ~25 min
  completed_date: 2026-04-27
---

# 260427-hut: Brand Logo Watermark Summary

Closed the dead-end where uploaded logos sat in storage but never rendered. Added a 9-position grid + size/opacity sliders in Brand Kit settings, threaded the brand kit through every render path (live editor canvas, slide thumbnails, Satori PNG via /api/render, ZIP download), and added a per-slide hide toggle in the editor right panel.

## Tasks completed

| # | Task                                                                             | Commit  |
| - | -------------------------------------------------------------------------------- | ------- |
| 1 | Data model, migration, settings UI (9-grid + sliders + live preview tile)        | cad224d |
| 2 | Watermark resolver + render in DOM/Satori/SlidePreview + thread brandKit through | 9b4eb79 |
| 3 | Per-slide hide toggle in editor + resolveWatermark vitest suite                  | e94c3b1 |

## Verification

| Check                                                          | Result                  |
| -------------------------------------------------------------- | ----------------------- |
| `tsc --noEmit` for all touched files                           | clean (no new errors)   |
| `vitest run src/lib/render/resolve-watermark.test.ts`          | 24/24 passed            |
| `vitest run src/lib/render` (full render suite, no regressions) | 65/65 passed (2 files)  |

End-to-end smoke (manual, requires migration applied):
1. Settings → Brand Kit: upload logo, click bottom-right cell, size 10, opacity 60. Live preview tile updates instantly.
2. Open project → watermark renders on canvas + every thumbnail.
3. "Hide brand logo on this slide" toggle in right panel hides it on just that slide.
4. Download ZIP → every slide except the hidden one has the watermark.
5. `/api/render?projectId=…&slide=N` → Satori PNG includes watermark.

## Deviations from plan

### Function name in render-slide.ts (Rule 1 - alignment)

Plan referenced `buildSlideElement / equivalent` for `src/lib/render/render-slide.ts`. The actual exported function in that file is `buildSlideHtml` (the DOM/HTML renderer, used for node-html-to-image fallback). Modified `buildSlideHtml` to accept the new `brandKit` param and emit the watermark `<img>` after `customImageHtml`. Behavior matches the plan exactly; only the function name differed.

### Plumbing brandKit through SlideList → SortableSlide (Rule 3 - blocking)

Plan said "pass it to every `<SlidePreview brandKit={brandKit} ... />` instance (main canvas + thumbnail list)". To make this work, `brandKit` had to be threaded through two intermediate components the plan did not explicitly list:
- `src/components/editor/slide-list.tsx`
- `src/components/editor/sortable-slide.tsx`

Both are pure prop pass-through additions (optional `brandKit?: BrandKit | null`). No behavior change beyond forwarding.

### TextEditorPanel toggle uses Material Icons (Rule 3 - alignment)

Used existing `<Icon name="visibility|visibility_off">` from the project's icon system to keep the toggle visually consistent with other controls in the panel. Plan only specified label text; no design deviation.

## Authentication gates

None. Brand kit reads via existing `getBrandKit()` server action which already auths via Supabase session cookie.

## Migration

`supabase/migrations/20260427_brand_kit_watermark.sql` — adds 3 nullable columns + 3 CHECK constraints to `brand_kits`. Idempotent (`ADD COLUMN IF NOT EXISTS`). Constraints reject invalid positions and out-of-range size/opacity values. **Must be applied before users can save watermark settings** (`supabase migration up` or apply via dashboard).

## Self-Check: PASSED

Files exist:
- FOUND: supabase/migrations/20260427_brand_kit_watermark.sql
- FOUND: src/lib/render/resolve-watermark.ts
- FOUND: src/lib/render/resolve-watermark.test.ts

Commits exist:
- FOUND: cad224d (Task 1 — data model + settings UI)
- FOUND: 9b4eb79 (Task 2 — resolver + render paths)
- FOUND: e94c3b1 (Task 3 — toggle + tests)
