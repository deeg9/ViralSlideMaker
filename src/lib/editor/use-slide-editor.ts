'use client'

import { useReducer, useCallback, useMemo, useState } from 'react'
import type { Slide } from '@/lib/types/slide'
import type { EditorAction } from '@/lib/editor/editor-actions'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
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
function migrateLegacySlides(slides: Slide[]): Slide[] {
  return slides.map((slide, slideIndex) => {
    const next: Slide = slide.text_boxes
      ? slide
      : { ...slide, text_boxes: legacyToTextBoxes(slide) }
    if (!next.watermark) {
      const wm = legacyWatermarkToElement(next, slideIndex)
      if (wm) next.watermark = wm
    }
    return next
  })
}

function createInitialState(slides: Slide[]): EditorHistory {
  return { past: [], present: migrateLegacySlides(slides), future: [] }
}

export function useSlideEditor(initialSlides: Slide[]) {
  const [state, dispatch] = useReducer(editorReducer, initialSlides, createInitialState)

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
