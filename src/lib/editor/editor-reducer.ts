import type { Slide, TextBox, TextBoxPosition, TextBoxRole } from '@/lib/types/slide'
import type { EditorAction } from '@/lib/editor/editor-actions'
import { textBoxesToLegacy } from '@/lib/editor/text-box-adapter'

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
