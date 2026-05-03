import type { Slide, CustomText, CustomImage, TextBox, TextBoxRole } from '@/lib/types/slide'
import type {
  AlignAxis,
  AlignTarget,
  DistributeAxis,
} from '@/lib/editor/transforms/align'

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
  // Phase 62 (GROUP-02, GROUP-04, GROUP-05, KBD-09): assign a shared groupId
  // to every id in `ids` in a single dispatch. Behavior contract (locked
  // decisions in 62-CONTEXT.md):
  //   - ids.length <= 1 → silent no-op (no pushHistory; state ref unchanged).
  //     Cmd+G with N<=1 selected MUST NOT mutate history (PITFALL-3.4).
  //   - ids.length >= 2 → assign action.groupId to every listed id; the
  //     reducer trusts the caller's groupId (no re-generation) so the
  //     dispatch site can record the new id for follow-on selection updates
  //     in the same gesture (Plan 62-03 keyboard handler).
  //   - "Subset-of-existing-group dissolves prior group" (no nested groups —
  //     PITFALL-3.3): if any listed id already carries a different groupId,
  //     the OLD group is dissolved entirely. Non-listed members of any old
  //     group hit by the cascade have their groupId cleared, NOT preserved.
  //     The flat schema cannot represent "remaining members still grouped
  //     after the new group steals some" — and we don't try.
  //   - Single pushHistory per dispatch (KBD-09 / PERF-01) — exactly one
  //     undo step per Cmd+G gesture.
  //   - text_boxes mutations route through applyDualWrite (BL-01).
  //
  // groupId construction is the dispatcher's responsibility (Plan 62-03):
  // `g_${slideIndex}_${Date.now().toString(36)}` per CONTEXT D-01 (nanoid
  // is NOT a dependency).
  | {
      type: 'GROUP'
      slideIndex: number
      ids: string[]      // text_boxes ∪ custom_images ∪ watermark ids
      groupId: string    // pre-generated by caller; reducer trusts it
    }
  // Phase 62 (GROUP-03, KBD-09): clear groupId on every listed id in a
  // single dispatch. Behavior contract:
  //   - Caller may pass the full group OR a subset; the reducer never
  //     "expands" the list. If a subset is passed, the group "shrinks" but
  //     the un-listed members keep their groupId (no cascade — that's
  //     GROUP-only behavior).
  //   - Idempotent on already-ungrouped ids: if NO listed id carries a
  //     groupId, return state unchanged (no pushHistory dispatch).
  //   - Lossless across unlimited group/ungroup cycles — absolute positions
  //     are preserved byte-identically (Test U3 pins this).
  //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
  //   - text_boxes mutations route through applyDualWrite (BL-01).
  | {
      type: 'UNGROUP'
      slideIndex: number
      ids: string[]      // members to clear; caller may pass full group or subset
    }
  // Phase 63 (ALIGN-03..05, ALIGN-08, ALIGN-09, ALIGN-10): single-dispatch
  // ALIGN action. The pure align.ts module computes integer-rounded patches
  // (Math.round at the boundary; ALIGN-09) and pre-filters out locked +
  // watermark + structural-anchor TextBoxes (ALIGN-10 move-side). The
  // reducer:
  //   - applies patches to text_boxes / custom_images,
  //   - routes text_boxes mutations through applyDualWrite (BL-01),
  //   - calls pushHistory exactly once per dispatch (ALIGN-08 = PERF-01),
  //   - short-circuits ref-equal when no candidates produced patches (empty
  //     ids, all-locked selection, only-watermark selection — Test AR7/AR7b).
  // Locked + watermark are INCLUDED in the union AABB read at align.ts via
  // computeSelectionBounds (Phase 63 D-01 closes the Plan 60-05 read-side gap).
  | {
      type: 'ALIGN'
      slideIndex: number
      ids: string[]
      axis: AlignAxis
      target: AlignTarget
    }
  // Phase 63 (ALIGN-04, ALIGN-05, ALIGN-08, ALIGN-09, ALIGN-10): single-
  // dispatch DISTRIBUTE action. The pure align.ts module enforces the
  // N>=3 gate (returns [] when N<3 — ALIGN-06 conservative pure-fn
  // enforcement, with the toolbar disabling the button at N<3 in Plan
  // 63-02). Same single-pushHistory + applyDualWrite contract as ALIGN.
  | {
      type: 'DISTRIBUTE'
      slideIndex: number
      ids: string[]
      axis: DistributeAxis
    }
  // Phase 64 Plan 01 (LOCK-03, LOCK-04, KBD-09): toggle `locked` on every listed
  // id in a single dispatch. Behavior contract (per 64-CONTEXT.md decisions):
  //   - Sets `locked = action.locked` on every text_box / custom_image /
  //     watermark id whose locked field would CHANGE; ref-equal short-circuit
  //     when no change (matches UNGROUP idempotency).
  //   - Single pushHistory per dispatch (KBD-09 / PERF-01 carry-forward).
  //   - text_boxes mutations route through applyDualWrite (BL-01).
  //   - Used by Cmd+Shift+L tinykeys binding in slide-editor.tsx (Plan 64-01).
  //   - Caller is single-source-of-truth for the toggle math (majority/all-
  //     locked decision lives in the dispatch site, not the reducer).
  | {
      type: 'SET_LOCKED'
      slideIndex: number
      ids: string[]      // text_boxes ∪ custom_images ∪ watermark ids
      locked: boolean
    }
  // Phase 64 Plan 02 (LOCK-07, KBD-09): toggle `hidden` on every listed id in
  // a single dispatch. Behavior identical to SET_LOCKED. The `hidden` field is
  // honored by BOTH renderers (slide-preview + render-slide-satori) starting
  // in this same plan — TPLREND-05 byte-identity preserved.
  //   - Single pushHistory per dispatch.
  //   - text_boxes mutations route through applyDualWrite (BL-01).
  //   - Used by Phase 65 layers panel "visibility toggle"; Phase 64 ships
  //     the action contract + renderer support, no user-facing keybinding.
  | {
      type: 'SET_HIDDEN'
      slideIndex: number
      ids: string[]      // text_boxes ∪ custom_images ∪ watermark ids
      hidden: boolean
    }
  | { type: 'UNDO' }
  | { type: 'REDO' }
