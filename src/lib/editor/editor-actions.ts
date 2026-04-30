import type { Slide, CustomText, CustomImage, TextBox, TextBoxRole } from '@/lib/types/slide'

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
  | { type: 'ADD_CUSTOM_IMAGE'; slideIndex: number; url: string }
  | { type: 'UPDATE_CUSTOM_IMAGE'; slideIndex: number; imageId: string; updates: Partial<CustomImage> }
  | { type: 'REMOVE_CUSTOM_IMAGE'; slideIndex: number; imageId: string }
  // Phase 49: text-box actions (route through pushHistory; selectedTextBoxId lives outside reducer)
  | {
      type: 'ADD_TEXT_BOX'
      slideIndex: number
      role: TextBoxRole
      defaults?: Partial<Omit<TextBox, 'id' | 'role'>>
    }
  | { type: 'UPDATE_TEXT_BOX'; slideIndex: number; textBoxId: string; updates: Partial<TextBox> }
  | { type: 'REMOVE_TEXT_BOX'; slideIndex: number; textBoxId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
