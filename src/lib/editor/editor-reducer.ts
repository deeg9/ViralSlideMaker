// Stub - to be implemented
import type { Slide } from '@/lib/types/slide'

export interface EditorHistory {
  past: Slide[][]
  present: Slide[]
  future: Slide[][]
}

export function editorReducer(state: EditorHistory, action: unknown): EditorHistory {
  return state
}
