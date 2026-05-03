import type { Slide, TextBox, TextBoxPosition, TextBoxRole } from '@/lib/types/slide'
import type { EditorAction } from '@/lib/editor/editor-actions'
import { textBoxesToLegacy } from '@/lib/editor/text-box-adapter'
import {
  alignElements,
  distributeElements,
  type AlignPatch,
} from '@/lib/editor/transforms/align'
import { applyZOrderToArray } from '@/lib/editor/transforms/z-order'

const MAX_HISTORY = 50

/**
 * Phase 50 (BL-01): write-through helper. After any reducer mutation to
 * `slide.text_boxes`, derive a fresh legacy slice via `textBoxesToLegacy`
 * and merge it back into the slide's legacy fields + style_overrides in
 * the SAME reducer step.
 *
 * Why: `slide-preview.tsx` (and Satori PNG export, HTML export) read from
 * `slide.hook_text` / `slide.body_text` / `slide.hook_segments` /
 * `slide.body_segments` / `slide.style_overrides.{hook,body}_*`. Dual-write
 * at save time is too late — the live preview renders before save, so the
 * canvas would show stale content for every per-text-box edit.
 *
 * Phase 53 may flip slide-preview to read from `text_boxes` natively; until
 * then this guarantees both shapes stay in lock-step.
 */
function applyDualWrite(slide: Slide, nextTextBoxes: TextBox[]): Slide {
  const slice = textBoxesToLegacy(nextTextBoxes)
  const out: Slide = {
    ...slide,
    text_boxes: nextTextBoxes,
    hook_text: slice.hook_text,
    body_text: slice.body_text,
  }
  if (slice.hook_segments !== undefined) {
    out.hook_segments = slice.hook_segments
  } else {
    delete out.hook_segments
  }
  if (slice.body_segments !== undefined) {
    out.body_segments = slice.body_segments
  } else {
    delete out.body_segments
  }
  if (slice.custom_texts !== undefined) {
    out.custom_texts = slice.custom_texts
  } else {
    delete out.custom_texts
  }
  if (
    Object.keys(slice.style_overrides_patch).length > 0 ||
    slide.style_overrides
  ) {
    out.style_overrides = {
      ...(slide.style_overrides ?? {}),
      ...slice.style_overrides_patch,
    }
  }
  return out
}

export interface EditorHistory {
  past: Slide[][]
  present: Slide[]
  future: Slide[][]
}

function blankSlide(): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
}

function deepCloneSlide(slide: Slide): Slide {
  return JSON.parse(JSON.stringify(slide))
}

function defaultPositionForRole(role: TextBoxRole): TextBoxPosition {
  switch (role) {
    case 'hook':
      return { anchor: 'top' }
    case 'body':
      return { anchor: 'bottom' }
    case 'custom':
    default:
      // Mirrors existing custom_text defaults at editor-reducer.ts ADD_CUSTOM_TEXT case.
      return { anchor: 'custom', x: 20, y: 50, width: 60 }
  }
}

/**
 * Phase 63 (ALIGN-03..05): apply integer-rounded position patches from
 * align.ts to a slide. Routes text_boxes mutations through applyDualWrite
 * (BL-01).
 *
 * The pure align.ts module is the rounding boundary (PITFALL-4.4 — ALIGN-09).
 * This helper does NOT re-round — would double-round (defense-in-depth in
 * the wrong direction). Watermark patches are not produced by align.ts;
 * defense-in-depth here just means "skip if a future caller passes a
 * watermark patch by mistake".
 *
 * Returns the same `slide` reference unchanged when no patch matched any
 * element on the slide — lets the caller skip pushHistory.
 */
function applyAlignPatches(slide: Slide, patches: AlignPatch[]): Slide {
  if (patches.length === 0) return slide

  const patchById = new Map<string, { x?: number; y?: number }>()
  for (const p of patches) patchById.set(p.id, p.patch)

  let textBoxesChanged = false
  let nextTextBoxes = slide.text_boxes
  if (slide.text_boxes) {
    nextTextBoxes = slide.text_boxes.map((tb) => {
      const p = patchById.get(tb.id)
      if (!p) return tb
      // Defense-in-depth: align.ts already filtered structural anchors out.
      if (tb.position.anchor !== 'custom') return tb
      textBoxesChanged = true
      return {
        ...tb,
        position: {
          ...tb.position,
          ...(p.x !== undefined ? { x: p.x } : {}),
          ...(p.y !== undefined ? { y: p.y } : {}),
        },
      }
    })
  }

  let customImagesChanged = false
  let nextCustomImages = slide.custom_images
  if (slide.custom_images) {
    nextCustomImages = slide.custom_images.map((ci) => {
      const p = patchById.get(ci.id)
      if (!p) return ci
      // Defense-in-depth: align.ts already filtered locked images out.
      if (ci.locked === true) return ci
      customImagesChanged = true
      return {
        ...ci,
        ...(p.x !== undefined ? { x: p.x } : {}),
        ...(p.y !== undefined ? { y: p.y } : {}),
      }
    })
  }

  if (!textBoxesChanged && !customImagesChanged) return slide

  let next: Slide = slide
  if (textBoxesChanged && nextTextBoxes !== undefined) {
    next = applyDualWrite(next, nextTextBoxes)
  }
  if (customImagesChanged) {
    next = { ...next, custom_images: nextCustomImages }
  }
  return next
}

function pushHistory(state: EditorHistory, newPresent: Slide[]): EditorHistory {
  const past = [...state.past, state.present]
  if (past.length > MAX_HISTORY) {
    past.shift()
  }
  return { past, present: newPresent, future: [] }
}

export function editorReducer(state: EditorHistory, action: EditorAction): EditorHistory {
  switch (action.type) {
    case 'ADD_SLIDE': {
      const slides = [...state.present]
      slides.splice(action.index, 0, blankSlide())
      return pushHistory(state, slides)
    }

    case 'REMOVE_SLIDE': {
      if (state.present.length <= 1) return state
      const slides = state.present.filter((_, i) => i !== action.index)
      return pushHistory(state, slides)
    }

    case 'DUPLICATE_SLIDE': {
      const slides = [...state.present]
      const clone = deepCloneSlide(slides[action.index])
      // Phase 49 (MR-01): regenerate IDs on the cloned slide so text_boxes /
      // custom_texts / custom_images don't collide across slides. Per-slide
      // reducer scoping protects current call sites, but flat ID lookups in
      // future code (drag between slides, analytics, selection) would be
      // broken by duplicate IDs.
      if (clone.text_boxes) {
        clone.text_boxes = clone.text_boxes.map((tb) => ({ ...tb, id: crypto.randomUUID() }))
      }
      if (clone.custom_texts) {
        clone.custom_texts = clone.custom_texts.map((ct) => ({ ...ct, id: crypto.randomUUID() }))
      }
      if (clone.custom_images) {
        clone.custom_images = clone.custom_images.map((ci) => ({ ...ci, id: crypto.randomUUID() }))
      }
      slides.splice(action.index + 1, 0, clone)
      return pushHistory(state, slides)
    }

    case 'REORDER_SLIDES': {
      const slides = [...state.present]
      const [moved] = slides.splice(action.from, 1)
      slides.splice(action.to, 0, moved)
      return pushHistory(state, slides)
    }

    case 'UPDATE_SLIDE': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.index) return slide
        const updated = { ...slide, ...action.updates }
        // Merge style_overrides instead of replacing
        if (action.updates.style_overrides && slide.style_overrides) {
          updated.style_overrides = {
            ...slide.style_overrides,
            ...action.updates.style_overrides,
          }
        }
        return updated
      })
      return pushHistory(state, slides)
    }

    case 'SET_SLIDES': {
      return pushHistory(state, action.slides)
    }

    case 'ADD_CUSTOM_TEXT': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const newText = {
          id: crypto.randomUUID(),
          text: 'New Text',
          x: 20,
          y: 50,
          width: 60,
          font_size: 48,
          font_weight: 400,
          color: slide.style_overrides?.text_color ?? '#ffffff',
        }
        return {
          ...slide,
          custom_texts: [...(slide.custom_texts ?? []), newText],
        }
      })
      return pushHistory(state, slides)
    }

    case 'UPDATE_CUSTOM_TEXT': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const custom_texts = (slide.custom_texts ?? []).map((ct) =>
          ct.id === action.textId ? { ...ct, ...action.updates } : ct
        )
        return { ...slide, custom_texts }
      })
      return pushHistory(state, slides)
    }

    case 'REMOVE_CUSTOM_TEXT': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const custom_texts = (slide.custom_texts ?? []).filter(
          (ct) => ct.id !== action.textId
        )
        return { ...slide, custom_texts }
      })
      return pushHistory(state, slides)
    }

    case 'ADD_CUSTOM_IMAGE': {
      const init = action.initial
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const newImage = {
          id: crypto.randomUUID(),
          url: action.url,
          x: init?.x ?? 20,
          y: init?.y ?? 30,
          width: init?.width ?? 40,
          height: init?.height ?? 40,
          opacity: init?.opacity ?? 100,
        }
        return {
          ...slide,
          custom_images: [...(slide.custom_images ?? []), newImage],
        }
      })
      return pushHistory(state, slides)
    }

    case 'UPDATE_CUSTOM_IMAGE': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const custom_images = (slide.custom_images ?? []).map((ci) =>
          ci.id === action.imageId ? { ...ci, ...action.updates } : ci
        )
        return { ...slide, custom_images }
      })
      return pushHistory(state, slides)
    }

    case 'REMOVE_CUSTOM_IMAGE': {
      // Phase 64 Plan 01 (LOCK-04): if the targeted image is locked,
      // return state unchanged (no pushHistory; reducers stay pure — the
      // dispatch site is responsible for any user-visible feedback).
      const targetSlide = state.present[action.slideIndex]
      const targetCi = (targetSlide?.custom_images ?? []).find(
        (ci) => ci.id === action.imageId,
      )
      if (targetCi?.locked === true) return state
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const custom_images = (slide.custom_images ?? []).filter(
          (ci) => ci.id !== action.imageId
        )
        return { ...slide, custom_images }
      })
      return pushHistory(state, slides)
    }

    case 'ADD_TEXT_BOX': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const { defaults } = action
        const newBox: TextBox = {
          id: defaults?.id ?? crypto.randomUUID(),
          role: action.role,
          text: defaults?.text ?? 'New Text',
          position: defaults?.position ?? defaultPositionForRole(action.role),
          ...(defaults?.segments !== undefined ? { segments: defaults.segments } : {}),
          ...(defaults?.font_family !== undefined ? { font_family: defaults.font_family } : {}),
          ...(defaults?.font_size !== undefined ? { font_size: defaults.font_size } : {}),
          ...(defaults?.font_weight !== undefined ? { font_weight: defaults.font_weight } : {}),
          ...(defaults?.font_style !== undefined ? { font_style: defaults.font_style } : {}),
          ...(defaults?.color !== undefined ? { color: defaults.color } : {}),
          ...(defaults?.text_align !== undefined ? { text_align: defaults.text_align } : {}),
          ...(defaults?.effects !== undefined ? { effects: defaults.effects } : {}),
        }
        const nextTextBoxes = [...(slide.text_boxes ?? []), newBox]
        return applyDualWrite(slide, nextTextBoxes)
      })
      return pushHistory(state, slides)
    }

    case 'UPDATE_TEXT_BOX': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const nextTextBoxes = (slide.text_boxes ?? []).map((tb) =>
          tb.id === action.textBoxId ? { ...tb, ...action.updates } : tb
        )
        return applyDualWrite(slide, nextTextBoxes)
      })
      return pushHistory(state, slides)
    }

    case 'REMOVE_TEXT_BOX': {
      // Phase 64 Plan 01 (LOCK-04): if the targeted text_box is locked,
      // return state unchanged (no pushHistory; reducers stay pure).
      const targetSlide = state.present[action.slideIndex]
      const targetTb = (targetSlide?.text_boxes ?? []).find(
        (tb) => tb.id === action.textBoxId,
      )
      if (targetTb?.locked === true) return state
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const nextTextBoxes = (slide.text_boxes ?? []).filter(
          (tb) => tb.id !== action.textBoxId
        )
        return applyDualWrite(slide, nextTextBoxes)
      })
      return pushHistory(state, slides)
    }

    // Phase 60 (PERF-01): single dispatch per drag gesture (onDragStop only —
    // never per-tick onDrag; matches v2.10 onResizeStop precedent). The
    // reducer:
    //   - calls pushHistory() exactly once (PERF-01),
    //   - routes text_boxes through applyDualWrite() so legacy fields stay
    //     in lock-step with text_boxes (BL-01),
    //   - skips locked elements (Phase 64 honor — declared here so Phase 64
    //     doesn't need to re-touch the reducer),
    //   - skips text_boxes with anchor !== 'custom' (structural anchors
    //     don't carry x/y — RESEARCH Q7 conservative choice),
    //   - skips watermark entirely (Watermark.position is an enum, not a
    //     freeform x/y — RESEARCH Q7 lines 1249-1254; Phase 62/63 may
    //     revisit when groups + alignment land).
    case 'BULK_TRANSLATE': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const idSet = new Set(action.ids)

        // Update text_boxes (custom-anchor only, skip locked).
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (!idSet.has(tb.id)) return tb
            if (tb.locked === true) return tb              // Phase 64 honor
            if (tb.position.anchor !== 'custom') return tb // structural anchors skipped
            return {
              ...tb,
              position: {
                ...tb.position,
                x: (tb.position.x ?? 0) + action.deltaX,
                y: (tb.position.y ?? 0) + action.deltaY,
              },
            }
          })
        }

        // Update custom_images (skip locked).
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (!idSet.has(ci.id)) return ci
            if (ci.locked === true) return ci              // Phase 64 honor
            return { ...ci, x: ci.x + action.deltaX, y: ci.y + action.deltaY }
          })
        }

        // Watermark: SKIPPED in Phase 60. Watermark.position is enum-only;
        // freeform translation requires a future schema extension. Known gap.

        let next: Slide = slide
        if (nextTextBoxes !== slide.text_boxes && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (nextCustomImages !== slide.custom_images) {
          next = { ...next, custom_images: nextCustomImages }
        }
        return next
      })
      return pushHistory(state, slides)  // PERF-01: exactly one pushHistory
    }

    // Phase 60 (HIGH-1 review-fix): bulk delete in a single dispatch — mirrors
    // BULK_TRANSLATE shape. Pre-fix, slide-editor.tsx onBulkDelete looped over
    // ids and called removeTextBox / handleRemoveCustomImage per element; each
    // helper pushed its own history entry, so a 5-element bulk delete required
    // 5× Cmd+Z to undo. This action collapses the gesture to one history entry.
    //
    // Filtering rules (kept consistent with the per-id pre-fix behavior):
    //   - text_boxes with role !== 'custom' are KEPT (hook/body are non-
    //     deletable; the pre-fix loop's `if (tb?.role === 'custom')` gate
    //     skipped them silently).
    //   - text_boxes with locked === true are KEPT (Phase 64 honor; matches
    //     BULK_TRANSLATE precedent — declared here so Phase 64 doesn't need
    //     to re-touch the reducer).
    //   - custom_images with locked === true are KEPT (same Phase 64 honor).
    //   - watermark is NEVER deleted by this action (lives on slide.watermark,
    //     not in text_boxes/custom_images; mirrors existing v2.10 behavior).
    //
    // Routes text_boxes through applyDualWrite so legacy hook_text /
    // body_text / custom_texts mirror the surviving text_boxes (BL-01).
    case 'BULK_DELETE': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const idSet = new Set(action.ids)

        const prevTextBoxes = slide.text_boxes ?? []
        const nextTextBoxes = prevTextBoxes.filter(
          (tb) =>
            !idSet.has(tb.id) ||
            tb.role !== 'custom' ||
            tb.locked === true,
        )

        const prevCustomImages = slide.custom_images ?? []
        const nextCustomImages = prevCustomImages.filter(
          (ci) => !idSet.has(ci.id) || ci.locked === true,
        )

        let next: Slide = slide
        if (nextTextBoxes.length !== prevTextBoxes.length) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (nextCustomImages.length !== prevCustomImages.length) {
          next = { ...next, custom_images: nextCustomImages }
        }
        return next
      })
      // Phase 64 Plan 01 (LOCK-04 SL8b): if no slide actually changed —
      // e.g. every requested id was locked or otherwise non-deletable —
      // short-circuit ref-equal so the no-op gesture doesn't pollute undo
      // history. Mirrors the ALIGN/DISTRIBUTE pattern at lines 675/690.
      if (slides.every((s, i) => s === state.present[i])) return state
      return pushHistory(state, slides)  // PERF-01: exactly one pushHistory
    }

    // Phase 62 (GROUP-02, GROUP-04, GROUP-05, KBD-09, BL-01): GROUP single-
    // dispatch contract.
    //   - ids.length <= 1 → silent no-op (return state unchanged; PITFALL-3.4).
    //   - ids.length >= 2 → assign action.groupId to every listed id; the
    //     reducer trusts the caller-provided groupId.
    //   - "Subset of an existing group dissolves prior group" cascade
    //     (PITFALL-3.3 — flat schema only): if any listed id already carries
    //     a different groupId, the OLD group is dissolved entirely. Any
    //     non-listed members of any old groupId hit by the cascade have
    //     their groupId cleared.
    //   - text_boxes mutations route through applyDualWrite (BL-01).
    //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
    case 'GROUP': {
      if (action.ids.length <= 1) return state // GROUP-04 / PITFALL-3.4

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const idSet = new Set(action.ids)

        // Detect prior groupIds among the selected ids — drives the
        // "subset dissolves prior group" cascade for unselected members.
        const oldGroupIds = new Set<string>()
        for (const tb of slide.text_boxes ?? []) {
          if (idSet.has(tb.id) && tb.groupId !== undefined && tb.groupId !== action.groupId) {
            oldGroupIds.add(tb.groupId)
          }
        }
        for (const ci of slide.custom_images ?? []) {
          if (idSet.has(ci.id) && ci.groupId !== undefined && ci.groupId !== action.groupId) {
            oldGroupIds.add(ci.groupId)
          }
        }
        if (
          slide.watermark &&
          idSet.has(slide.watermark.id) &&
          slide.watermark.groupId !== undefined &&
          slide.watermark.groupId !== action.groupId
        ) {
          oldGroupIds.add(slide.watermark.groupId)
        }

        // Walk text_boxes
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (idSet.has(tb.id)) {
              return tb.groupId === action.groupId ? tb : { ...tb, groupId: action.groupId }
            }
            if (tb.groupId !== undefined && oldGroupIds.has(tb.groupId)) {
              // Subset cascade: clear groupId on un-listed members of dissolved old group.
              const { groupId: _g, ...rest } = tb
              return rest as TextBox
            }
            return tb
          })
        }

        // Walk custom_images
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (idSet.has(ci.id)) {
              return ci.groupId === action.groupId ? ci : { ...ci, groupId: action.groupId }
            }
            if (ci.groupId !== undefined && oldGroupIds.has(ci.groupId)) {
              const { groupId: _g, ...rest } = ci
              return rest
            }
            return ci
          })
        }

        // Watermark: single optional value
        let nextWatermark = slide.watermark
        if (slide.watermark) {
          if (idSet.has(slide.watermark.id)) {
            nextWatermark =
              slide.watermark.groupId === action.groupId
                ? slide.watermark
                : { ...slide.watermark, groupId: action.groupId }
          } else if (
            slide.watermark.groupId !== undefined &&
            oldGroupIds.has(slide.watermark.groupId)
          ) {
            const { groupId: _g, ...rest } = slide.watermark
            nextWatermark = rest
          }
        }

        let next: Slide = slide
        if (nextTextBoxes !== slide.text_boxes && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (nextCustomImages !== slide.custom_images) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (nextWatermark !== slide.watermark) {
          next = { ...next, watermark: nextWatermark }
        }
        return next
      })
      return pushHistory(state, slides)  // KBD-09: exactly one pushHistory
    }

    // Phase 62 (GROUP-03, KBD-09, BL-01): UNGROUP single-dispatch contract.
    //   - Clear groupId on every listed id; un-listed members keep theirs
    //     (no cascade — that's GROUP-only behavior).
    //   - Idempotent on already-ungrouped: if NO listed id carries a groupId,
    //     return state unchanged (no pushHistory dispatch).
    //   - Lossless across unlimited cycles — absolute positions preserved
    //     byte-identically (Test U3 pins this).
    //   - text_boxes mutations route through applyDualWrite (BL-01).
    //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
    case 'UNGROUP': {
      const idSet = new Set(action.ids)
      let anyChange = false

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide

        let textBoxesChanged = false
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (idSet.has(tb.id) && tb.groupId !== undefined) {
              textBoxesChanged = true
              const { groupId: _g, ...rest } = tb
              return rest as TextBox
            }
            return tb
          })
        }

        let customImagesChanged = false
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (idSet.has(ci.id) && ci.groupId !== undefined) {
              customImagesChanged = true
              const { groupId: _g, ...rest } = ci
              return rest
            }
            return ci
          })
        }

        let watermarkChanged = false
        let nextWatermark = slide.watermark
        if (
          slide.watermark &&
          idSet.has(slide.watermark.id) &&
          slide.watermark.groupId !== undefined
        ) {
          watermarkChanged = true
          const { groupId: _g, ...rest } = slide.watermark
          nextWatermark = rest
        }

        if (!textBoxesChanged && !customImagesChanged && !watermarkChanged) {
          return slide
        }
        anyChange = true

        let next: Slide = slide
        if (textBoxesChanged && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (customImagesChanged) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (watermarkChanged) {
          next = { ...next, watermark: nextWatermark }
        }
        return next
      })

      if (!anyChange) return state // U4 idempotency
      return pushHistory(state, slides)  // KBD-09: exactly one pushHistory
    }

    // Phase 64 Plan 01 (LOCK-03, KBD-09, BL-01): SET_LOCKED single-dispatch
    // contract.
    //   - ids.length === 0 → ref-equal short-circuit (no pushHistory; matches
    //     UNGROUP idempotency from Plan 62).
    //   - For each listed id, set locked = action.locked ONLY when it would
    //     change (i.e. (existing locked ?? false) !== action.locked). When no
    //     element actually toggles, return state unchanged (handles SL2/SL9).
    //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
    //   - text_boxes mutations route through applyDualWrite (BL-01) so legacy
    //     hook_text/body_text/custom_texts mirror stays well-formed (SL5).
    //   - Watermark + custom_images participate via the same idSet walk.
    //   - Caller is single-source-of-truth for the toggle math. The reducer
    //     trusts the boolean — toggle math (majority/all-locked decision)
    //     lives in the dispatch site (slide-editor.tsx Cmd+Shift+L closure).
    case 'SET_LOCKED': {
      if (action.ids.length === 0) return state // SL6 ref-equal
      const idSet = new Set(action.ids)
      let anyChange = false

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide

        let textBoxesChanged = false
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (!idSet.has(tb.id)) return tb
            if ((tb.locked ?? false) === action.locked) return tb
            textBoxesChanged = true
            return { ...tb, locked: action.locked }
          })
        }

        let customImagesChanged = false
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (!idSet.has(ci.id)) return ci
            if ((ci.locked ?? false) === action.locked) return ci
            customImagesChanged = true
            return { ...ci, locked: action.locked }
          })
        }

        let watermarkChanged = false
        let nextWatermark = slide.watermark
        if (
          slide.watermark &&
          idSet.has(slide.watermark.id) &&
          (slide.watermark.locked ?? false) !== action.locked
        ) {
          watermarkChanged = true
          nextWatermark = { ...slide.watermark, locked: action.locked }
        }

        if (!textBoxesChanged && !customImagesChanged && !watermarkChanged) {
          return slide
        }
        anyChange = true

        let next: Slide = slide
        if (textBoxesChanged && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (customImagesChanged) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (watermarkChanged) {
          next = { ...next, watermark: nextWatermark }
        }
        return next
      })

      if (!anyChange) return state // SL2/SL9 ref-equal
      return pushHistory(state, slides)  // KBD-09: exactly one pushHistory
    }

    // Phase 64 Plan 02 (LOCK-07, KBD-09, BL-01): SET_HIDDEN single-dispatch
    // contract — IDENTICAL shape to SET_LOCKED (locked → hidden field swap).
    //   - ids.length === 0 → ref-equal short-circuit (no pushHistory; matches
    //     UNGROUP idempotency from Plan 62 / SET_LOCKED from Plan 64-01).
    //   - For each listed id, set hidden = action.hidden ONLY when it would
    //     change (i.e. (existing hidden ?? false) !== action.hidden). When no
    //     element actually toggles, return state unchanged (handles SH2/SH5).
    //   - Single pushHistory per dispatch (KBD-09 / PERF-01).
    //   - text_boxes mutations route through applyDualWrite (BL-01) so legacy
    //     hook_text/body_text/custom_texts mirror stays well-formed (SH4).
    //   - Watermark + custom_images participate via the same idSet walk.
    //   - Both renderers (slide-preview + render-slide-satori) honor the
    //     `hidden` field at element iteration sites — TPLREND-05 byte-identity
    //     preserved (Plan 64-02 lands the renderer filter alongside this case).
    case 'SET_HIDDEN': {
      if (action.ids.length === 0) return state // SH5 ref-equal
      const idSet = new Set(action.ids)
      let anyChange = false

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide

        let textBoxesChanged = false
        let nextTextBoxes = slide.text_boxes
        if (slide.text_boxes) {
          nextTextBoxes = slide.text_boxes.map((tb) => {
            if (!idSet.has(tb.id)) return tb
            if ((tb.hidden ?? false) === action.hidden) return tb
            textBoxesChanged = true
            return { ...tb, hidden: action.hidden }
          })
        }

        let customImagesChanged = false
        let nextCustomImages = slide.custom_images
        if (slide.custom_images) {
          nextCustomImages = slide.custom_images.map((ci) => {
            if (!idSet.has(ci.id)) return ci
            if ((ci.hidden ?? false) === action.hidden) return ci
            customImagesChanged = true
            return { ...ci, hidden: action.hidden }
          })
        }

        let watermarkChanged = false
        let nextWatermark = slide.watermark
        if (
          slide.watermark &&
          idSet.has(slide.watermark.id) &&
          (slide.watermark.hidden ?? false) !== action.hidden
        ) {
          watermarkChanged = true
          nextWatermark = { ...slide.watermark, hidden: action.hidden }
        }

        if (!textBoxesChanged && !customImagesChanged && !watermarkChanged) {
          return slide
        }
        anyChange = true

        let next: Slide = slide
        if (textBoxesChanged && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (customImagesChanged) {
          next = { ...next, custom_images: nextCustomImages }
        }
        if (watermarkChanged) {
          next = { ...next, watermark: nextWatermark }
        }
        return next
      })

      if (!anyChange) return state // SH2 ref-equal
      return pushHistory(state, slides)  // KBD-09: exactly one pushHistory
    }

    // Phase 63 (ALIGN-03..05, ALIGN-08, ALIGN-09, ALIGN-10): single-dispatch
    // ALIGN action.
    //   - alignElements (pure align.ts) computes integer-rounded patches
    //     (Math.round at the boundary; ALIGN-09) and pre-filters out locked
    //     elements + watermark + structural-anchor TextBoxes (ALIGN-10
    //     move-side).
    //   - applyAlignPatches applies them, routing text_boxes through
    //     applyDualWrite (BL-01).
    //   - Single pushHistory per dispatch (ALIGN-08 = PERF-01).
    //   - Ref-equal short-circuit when no slide changed (empty ids,
    //     all-locked selection, only-watermark selection — Tests AR7/AR7b).
    case 'ALIGN': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const patches = alignElements(slide, action.ids, action.axis, action.target)
        if (patches.length === 0) return slide
        return applyAlignPatches(slide, patches)
      })
      if (slides.every((s, i) => s === state.present[i])) return state
      return pushHistory(state, slides)  // ALIGN-08: exactly one pushHistory
    }

    // Phase 63 (ALIGN-04, ALIGN-05, ALIGN-08, ALIGN-09, ALIGN-10): single-
    // dispatch DISTRIBUTE action. Same shape as ALIGN; pure
    // distributeElements enforces N>=3 gate + locked/watermark filter +
    // gap-equal math (PITFALL-4.6).
    case 'DISTRIBUTE': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const patches = distributeElements(slide, action.ids, action.axis)
        if (patches.length === 0) return slide
        return applyAlignPatches(slide, patches)
      })
      if (slides.every((s, i) => s === state.present[i])) return state
      return pushHistory(state, slides)  // ALIGN-08: exactly one pushHistory
    }

    // Phase 64 Plan 03 (ZORDER-01..07, KBD-09): single Z_ORDER action routes
    // per-scope internally. The pure transform `applyZOrderToArray` operates
    // within ONE element-type array (text_boxes OR custom_images); the reducer
    // calls it once per scope and merges the results into the slide. Watermark
    // is a single slot — `applyZOrderToArray` on a length-1 implicit scope is
    // always a ref-equal no-op (ZR7), so we skip watermark handling entirely.
    //
    // Contract:
    //   - Empty ids → ref-equal short-circuit (ZR6).
    //   - Cross-scope multi-selection → both arrays mutate, ONE pushHistory
    //     entry (ZR3 / KBD-09 / PERF-01).
    //   - text_boxes mutations route through applyDualWrite (BL-01) so the
    //     legacy custom_texts mirror reflects the new array order (ZR5).
    //   - No-op when no array changed (unknown ids, watermark-only ids,
    //     adjacent-edge selections — ZR7 / ZR8).
    //
    // ZORDER-05 (Satori parity invariant) is enforced inside
    // `applyZOrderToArray` — array splice ONLY, never CSS layering. The pure
    // transform's grep gate confirms zero references to that property in
    // its source.
    case 'Z_ORDER': {
      if (action.ids.length === 0) return state // ZR6 ref-equal
      const idSet = new Set(action.ids)
      let anyChange = false

      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide

        let nextTextBoxes = slide.text_boxes
        let textBoxesChanged = false
        if (slide.text_boxes) {
          const candidate = applyZOrderToArray(slide.text_boxes, idSet, action.op)
          if (candidate !== slide.text_boxes) {
            nextTextBoxes = candidate
            textBoxesChanged = true
          }
        }

        let nextCustomImages = slide.custom_images
        let customImagesChanged = false
        if (slide.custom_images) {
          const candidate = applyZOrderToArray(slide.custom_images, idSet, action.op)
          if (candidate !== slide.custom_images) {
            nextCustomImages = candidate
            customImagesChanged = true
          }
        }

        // Watermark: single slot. applyZOrderToArray on a length-1 implicit
        // scope is a ref-equal no-op (the algorithm short-circuits when no
        // swap is possible at array bounds). We don't construct the array;
        // the watermark id simply matches no scope and the reducer no-ops.

        if (!textBoxesChanged && !customImagesChanged) {
          return slide
        }
        anyChange = true

        let next: Slide = slide
        if (textBoxesChanged && nextTextBoxes !== undefined) {
          next = applyDualWrite(next, nextTextBoxes)
        }
        if (customImagesChanged) {
          next = { ...next, custom_images: nextCustomImages }
        }
        return next
      })

      if (!anyChange) return state // ZR7 / ZR8 ref-equal short-circuit
      return pushHistory(state, slides) // KBD-09: exactly one pushHistory
    }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const past = state.past.slice(0, -1)
      return {
        past,
        present: previous,
        future: [state.present, ...state.future],
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      const future = state.future.slice(1)
      return {
        past: [...state.past, state.present],
        present: next,
        future,
      }
    }

    default:
      return state
  }
}
