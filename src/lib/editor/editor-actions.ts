import type { Slide, CustomText } from '@/lib/types/slide'

export type EditorAction =
  | { type: 'ADD_SLIDE'; index: number }
  | { type: 'REMOVE_SLIDE'; index: number }
  | { type: 'DUPLICATE_SLIDE'; index: number }
  | { type: 'REORDER_SLIDES'; from: number; to: number }
  | { type: 'UPDATE_SLIDE'; index: number; updates: Partial<Slide> }
  | { type: 'SET_SLIDES'; slides: Slide[] }
  | { type: 'ADD_CUSTOM_TEXT'; slideIndex: number }
  | { type: 'UPDATE_CUSTOM_TEXT'; slideIndex: number; textId: string; updates: Partial<CustomText> }
  | { type: 'REMOVE_CUSTOM_TEXT'; slideIndex: number; textId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
