import type { Slide } from '@/lib/types/slide'

export type EditorAction =
  | { type: 'ADD_SLIDE'; index: number }
  | { type: 'REMOVE_SLIDE'; index: number }
  | { type: 'DUPLICATE_SLIDE'; index: number }
  | { type: 'REORDER_SLIDES'; from: number; to: number }
  | { type: 'UPDATE_SLIDE'; index: number; updates: Partial<Slide> }
  | { type: 'SET_SLIDES'; slides: Slide[] }
  | { type: 'UNDO' }
  | { type: 'REDO' }
