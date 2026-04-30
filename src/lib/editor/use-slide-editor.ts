'use client'

import { useReducer, useCallback, useMemo, useState } from 'react'
import type { Slide } from '@/lib/types/slide'
import type { EditorAction } from '@/lib/editor/editor-actions'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'

/**
 * Phase 49: Eager migration on load. When slides arrive without `text_boxes`, derive the field
 * from legacy hook_text/body_text/custom_texts so the editor always operates on the unified
 * shape. Idempotent — slides that already have `text_boxes` are passed through unchanged.
 */
function migrateLegacySlides(slides: Slide[]): Slide[] {
  return slides.map((slide) =>
    slide.text_boxes ? slide : { ...slide, text_boxes: legacyToTextBoxes(slide) }
  )
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
    }),
    [state.present, canUndo, canRedo, undo, redo, isDirty, selectedTextBoxId]
  )
}
