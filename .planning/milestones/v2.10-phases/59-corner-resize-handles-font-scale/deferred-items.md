# Phase 59 — Deferred Items

Pre-existing test failures observed during 59-01 execution (out of scope for this plan):

1. `src/__tests__/editor/slide-preview.test.tsx > SlideCanvas > shows "Slide X of Y" indicator`
   - Failing in the working tree at base SHA e12a0fb. Not related to corner handles or onResizeStart.
   - Test references modified-but-uncommitted state from prior phase work.

2. `src/__tests__/components/slide-preview.test.tsx > SlidePreview > applies template textColor and fontFamily as inline styles`
   - Failing in the working tree at base SHA e12a0fb. Pre-existing.
   - Affects template style application, unrelated to react-rnd config.

Both failures pre-date Phase 59 work. Phase 59 plan 59-01 only modified `enableResizing`,
`resizeHandleStyles`, and added `onResizeStart` capture refs — none of these surfaces are
tested by the failing assertions above.

The `slide-preview.selection.test.tsx` suite (closest to 59-01's surface) passes 3/3.
