---
phase: quick
plan: 260327-do7
subsystem: ui
tags: [generation, advanced-options, font-picker, ai-regenerate, gemini]

requires:
  - phase: 12
    provides: FONT_CATALOG with curated Google Fonts
provides:
  - Advanced Options on generation page (font, font color, AI image prompt)
  - Custom instruction inputs for editor AI regenerate (text + image)
  - advancedOptions param on generateCarousel server action
  - customPrompt param on regenerateSlideText/ImageQuery server actions
affects: [generation, editor, ai-prompts]

tech-stack:
  added: []
  patterns:
    - Collapsible advanced options section with chevron toggle
    - Custom prompt inputs alongside AI action buttons

key-files:
  created: []
  modified:
    - src/components/slides/generation-form.tsx
    - src/app/(dashboard)/project/[id]/page.tsx
    - src/app/(dashboard)/project/[id]/actions.ts
    - src/app/(dashboard)/project/[id]/editor-actions.ts
    - src/components/editor/image-picker-panel.tsx
    - src/components/editor/slide-editor.tsx
    - src/lib/ai/generate-slides.ts
    - src/lib/imagen/generate-prompt.ts

key-decisions:
  - "Font/color advanced options apply as style_overrides on every slide, not per-slide"
  - "Image prompt hint threaded to both generateSlideContent (for stock image_query) and generateImagePrompt (for AI images)"

requirements-completed: [quick-task]

duration: 3min
completed: 2026-03-27
---

# Quick Task 260327-do7: Generation Page Advanced Options + AI Regenerate Inputs Summary

**Collapsible Advanced Options (font, color, image style) on generation page plus custom instruction inputs for editor AI regenerate buttons**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T16:54:40Z
- **Completed:** 2026-03-27T16:58:01Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Generation page subtitle updated to "content idea" and placeholder shows carousel content examples
- Collapsible Advanced Options section with font picker (optgroup by category), font color swatches + custom picker, and AI image style hint textarea
- Advanced options threaded through generateCarousel to apply font/color as style_overrides and image hint to both stock and AI image generation
- Editor sidebar AI regenerate buttons now have companion text inputs for custom instructions (text + image)
- Custom prompts flow through slide-editor to editor-actions server actions and influence Gemini AI output

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy changes + Advanced Options on generation page** - `850e6ef` (feat)
2. **Task 2: AI regenerate custom instruction inputs in editor sidebar** - `075cd8c` (feat)

## Files Created/Modified
- `src/app/(dashboard)/project/[id]/page.tsx` - Updated subtitle copy
- `src/components/slides/generation-form.tsx` - Added Advanced Options collapsible section with font/color/image prompt fields
- `src/app/(dashboard)/project/[id]/actions.ts` - Added advancedOptions param to generateCarousel, applies style_overrides
- `src/lib/ai/generate-slides.ts` - Added imageStyleHint param to generateSlideContent
- `src/lib/imagen/generate-prompt.ts` - Added userImagePrompt param to generateImagePrompt
- `src/app/(dashboard)/project/[id]/editor-actions.ts` - Added customPrompt params to regenerateSlideText and regenerateSlideImageQuery
- `src/components/editor/image-picker-panel.tsx` - Added text/image prompt inputs below regenerate buttons
- `src/components/editor/slide-editor.tsx` - Updated handlers to thread custom prompts to server actions

## Decisions Made
- Font/color advanced options apply as style_overrides on every generated slide (not per-slide) for consistency
- Image prompt hint is threaded to both generateSlideContent (influences stock image_query values) and generateImagePrompt (influences AI image prompts)
- Color swatches use common brand colors (#ffffff, #3d0000, #000000, #7d6161) plus custom color picker with reset button

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - all features are fully wired.

## User Setup Required

None - no external service configuration required.

---
*Quick task: 260327-do7*
*Completed: 2026-03-27*
