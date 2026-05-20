'use client'

import { useReducer, useCallback, useMemo, useState } from 'react'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates'
import type { EditorAction } from '@/lib/editor/editor-actions'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'
import { legacyToTextBoxes, textBoxesToLegacy } from '@/lib/editor/text-box-adapter'
import { legacyWatermarkToElement } from '@/lib/editor/watermark-adapter'

/**
 * Phase 49: Eager migration on load. When slides arrive without `text_boxes`, derive the field
 * from legacy hook_text/body_text/custom_texts so the editor always operates on the unified
 * shape. Idempotent — slides that already have `text_boxes` are passed through unchanged.
 *
 * Phase 60 (WMARK-04): Also mints `slide.watermark` from `style_overrides.watermark` /
 * `style_overrides.hide_watermark` via `legacyWatermarkToElement`. Idempotent — slides
 * that already have `watermark` are passed through unchanged. The legacy
 * `style_overrides.watermark` slot is RETAINED populated so the existing
 * `resolveForcedWatermark` (which reads from the legacy slot for free-tier opt-out
 * handling) continues to work unchanged. Both paths coexist for one milestone
 * (sunset target: v2.12+ post-PMF).
 */
// quick-260520-064: `template` threads through so legacyToTextBoxes can apply
// the D1 fallback (inject a 'BREAKING NEWS' 'ruled' kicker on news-oracle
// covers with an unset accessory_label). Optional — existing callers without
// a template in scope continue to compile and behave byte-identically.
function migrateLegacySlides(slides: Slide[], template?: SlideTemplate): Slide[] {
  return slides.map((slide, slideIndex) => {
    let next: Slide
    if (slide.text_boxes) {
      // text_boxes already populated (server-side AI-ingest path) — pass
      // through unchanged. The custom_texts mirror was already produced at
      // ingest time (or by a prior edit's applyDualWrite).
      next = slide
    } else {
      const nextTextBoxes = legacyToTextBoxes(slide, template)
      next = { ...slide, text_boxes: nextTextBoxes }
      // quick-260520-064: dual-write text_boxes → custom_texts at migration
      // time so the adapter-injected D1 kicker (a role='custom' box) is
      // visible to the renderers on first load. Without this, the renderers'
      // `slide.custom_texts.map(...)` iteration would not see the kicker
      // until the first edit fires applyDualWrite in the reducer.
      const slice = textBoxesToLegacy(nextTextBoxes)
      if (slice.custom_texts !== undefined && slice.custom_texts.length > 0) {
        next = { ...next, custom_texts: slice.custom_texts }
      }
    }
    if (!next.watermark) {
      const wm = legacyWatermarkToElement(next, slideIndex)
      if (wm) {
        // Phase 60 (HIGH-2 review-fix): always shallow-copy before injecting
        // `watermark`. The fast path above (slide.text_boxes already populated)
        // had `next === slide`, so `next.watermark = wm` mutated caller data.
        // Copy here so callers' `initialSlides` references stay pristine.
        next = { ...next, watermark: wm }
      }
    }
    return next
  })
}

function createInitialState(
  init: { slides: Slide[]; template?: SlideTemplate },
): EditorHistory {
  return {
    past: [],
    present: migrateLegacySlides(init.slides, init.template),
    future: [],
  }
}

export function useSlideEditor(initialSlides: Slide[], template?: SlideTemplate) {
  // quick-260520-064: bundle slides + template into the reducer-init arg so
  // createInitialState can thread template into migrateLegacySlides without
  // changing useReducer's "init function" shape.
  const [state, dispatch] = useReducer(
    editorReducer,
    { slides: initialSlides, template },
    createInitialState,
  )

  // Phase 49: selection state for the new TextBox-driven right rail (Phase 50 consumes this).
  // Stored OUTSIDE the editor history — selection changes never push undo/redo.
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null)

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  /**
   * Remove a text box. Also clears `selectedTextBoxId` if it matched —
   * the caller does not need to clear selection separately.
   *
   * Phase 49 (MR-03): provides a single entry point so the asymmetry with
   * `handleRemoveCustomText` (which clears `selectedCustomTextId`) doesn't
   * become a foot-gun for the first Phase 50 consumer of REMOVE_TEXT_BOX.
   */
  const removeTextBox = useCallback((slideIndex: number, textBoxId: string) => {
    dispatch({ type: 'REMOVE_TEXT_BOX', slideIndex, textBoxId })
    setSelectedTextBoxId((current) => (current === textBoxId ? null : current))
  }, [])

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0
  const isDirty = state.past.length > 0

  return useMemo(
    () => ({
      slides: state.present,
      dispatch: dispatch as React.Dispatch<EditorAction>,
      canUndo,
      canRedo,
      undo,
      redo,
      isDirty,
      selectedTextBoxId,
      setSelectedTextBoxId,
      removeTextBox,
    }),
    [state.present, canUndo, canRedo, undo, redo, isDirty, selectedTextBoxId, removeTextBox]
  )
}
