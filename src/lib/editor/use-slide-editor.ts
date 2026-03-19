'use client'

import { useReducer, useCallback, useMemo } from 'react'
import type { Slide } from '@/lib/types/slide'
import type { EditorAction } from '@/lib/editor/editor-actions'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'

function createInitialState(slides: Slide[]): EditorHistory {
  return { past: [], present: slides, future: [] }
}

export function useSlideEditor(initialSlides: Slide[]) {
  const [state, dispatch] = useReducer(editorReducer, initialSlides, createInitialState)

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
    }),
    [state.present, canUndo, canRedo, undo, redo, isDirty]
  )
}
