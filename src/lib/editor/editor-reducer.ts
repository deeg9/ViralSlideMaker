import type { Slide, TextBox, TextBoxPosition, TextBoxRole } from '@/lib/types/slide'
import type { EditorAction } from '@/lib/editor/editor-actions'

const MAX_HISTORY = 50

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
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const newImage = {
          id: crypto.randomUUID(),
          url: action.url,
          x: 20,
          y: 30,
          width: 40,
          height: 40,
          opacity: 100,
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
          id: crypto.randomUUID(),
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
        return {
          ...slide,
          text_boxes: [...(slide.text_boxes ?? []), newBox],
        }
      })
      return pushHistory(state, slides)
    }

    case 'UPDATE_TEXT_BOX': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const text_boxes = (slide.text_boxes ?? []).map((tb) =>
          tb.id === action.textBoxId ? { ...tb, ...action.updates } : tb
        )
        return { ...slide, text_boxes }
      })
      return pushHistory(state, slides)
    }

    case 'REMOVE_TEXT_BOX': {
      const slides = state.present.map((slide, i) => {
        if (i !== action.slideIndex) return slide
        const text_boxes = (slide.text_boxes ?? []).filter(
          (tb) => tb.id !== action.textBoxId
        )
        return { ...slide, text_boxes }
      })
      return pushHistory(state, slides)
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
