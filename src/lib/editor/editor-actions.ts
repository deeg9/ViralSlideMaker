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
  | {
      type: 'ADD_CUSTOM_IMAGE'
      slideIndex: number
      url: string
      // Optional position/size overrides for non-photo inserts (e.g. dividers
      // from the Elements panel land centered + narrow + short instead of the
      // photo defaults). Backward-compatible — omit and the reducer keeps the
      // 20/30/40/40 photo defaults.
      initial?: { x: number; y: number; width: number; height: number; opacity?: number }
    }
  | { type: 'UPDATE_CUSTOM_IMAGE'; slideIndex: number; imageId: string; updates: Partial<CustomImage> }
  | { type: 'REMOVE_CUSTOM_IMAGE'; slideIndex: number; imageId: string }
  // Phase 49: text-box actions (route through pushHistory; selectedTextBoxId lives outside reducer)
  | {
      type: 'ADD_TEXT_BOX'
      slideIndex: number
      role: TextBoxRole
      // Phase 50 (MR-01): callers may pre-generate `id` so they can call
      // setSelectedTextBoxId(newId) immediately after dispatch (the reducer
      // doesn't return the new id). Omitted `id` falls back to crypto.randomUUID().
      defaults?: Partial<Omit<TextBox, 'role'>>
    }
  | { type: 'UPDATE_TEXT_BOX'; slideIndex: number; textBoxId: string; updates: Partial<TextBox> }
  | { type: 'REMOVE_TEXT_BOX'; slideIndex: number; textBoxId: string }
  // Phase 60 (PERF-01): bulk multi-element translate. Single dispatch on
  // onDragStop only — never per-tick onDrag (carry-forward of v2.10
  // onResizeStop precedent at editor-reducer.test.ts:486-532). Phase 60
  // declares the action; group drag handlers wire it in Phase 62.
  // Reducer skips: locked elements (Phase 64 honor), TextBoxes with
  // anchor !== 'custom' (no x/y to translate), and watermark (enum-only
  // position; freeform translation requires future schema extension —
  // Phase 62/63 may revisit).
  | {
      type: 'BULK_TRANSLATE'
      slideIndex: number
      ids: string[]      // text_boxes ∪ custom_images ∪ watermark ids
      deltaX: number     // % of canvas width (0-100 reference)
      deltaY: number     // % of canvas height (0-100 reference)
    }
  // Phase 60 (HIGH-1 review-fix): bulk delete. Single dispatch per gesture
  // (one pushHistory call) so a 5-element bulk delete is one Cmd+Z, not five.
  // Mirrors BULK_TRANSLATE shape. Reducer skips:
  //   - locked elements (Phase 64 honor; matches BULK_TRANSLATE),
  //   - text_boxes with role !== 'custom' (hook/body are not deletable —
  //     matches the existing per-id `removeTextBox` policy in slide-editor.tsx
  //     onBulkDelete loop pre-fix),
  //   - watermark (lives on slide.watermark, not in text_boxes/custom_images;
  //     never deleted by this action — matches v2.10 behavior).
  | {
      type: 'BULK_DELETE'
      slideIndex: number
      ids: string[]      // text_boxes ∪ custom_images ids (watermark never deleted)
    }
  | { type: 'UNDO' }
  | { type: 'REDO' }
