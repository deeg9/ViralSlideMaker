import { describe, test, expect } from 'vitest'
import type { Slide } from '@/lib/types/slide'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'
import {
  legacyToTextBoxes,
  textBoxesToLegacy,
} from '@/lib/editor/text-box-adapter'

/**
 * Mirrors the production save path in slide-editor.tsx `doSave`. Single source of truth so
 * the integration test exercises the same dual-write transform the UI runs.
 */
function saveDualWrite(slide: Slide): Slide {
  if (!slide.text_boxes) return slide
  const slice = textBoxesToLegacy(slide.text_boxes)
  const out: Slide = {
    ...slide,
    hook_text: slice.hook_text,
    body_text: slice.body_text,
  }
  if (slice.hook_segments !== undefined) out.hook_segments = slice.hook_segments
  else delete out.hook_segments
  if (slice.body_segments !== undefined) out.body_segments = slice.body_segments
  else delete out.body_segments
  if (slice.custom_texts !== undefined) out.custom_texts = slice.custom_texts
  else delete out.custom_texts
  if (Object.keys(slice.style_overrides_patch).length > 0 || slide.style_overrides) {
    out.style_overrides = {
      ...(slide.style_overrides ?? {}),
      ...slice.style_overrides_patch,
    }
  }
  return out
}

describe('text-box-adapter integration — full lifecycle', () => {
  test('legacy slide → load (eager migrate) → ADD_TEXT_BOX → UNDO → REDO → save (dual-write)', () => {
    // Shape 4 fixture from Plan 49-01: news template with segments + accents.
    const originalLegacy: Slide = {
      hook_text: 'Markets surge as Fed pauses',
      body_text: 'Tech leads gains overnight',
      hook_segments: [
        { text: 'Markets ' },
        { text: 'surge', accent: true },
        { text: ' as Fed ' },
        { text: 'pauses', accent: true, highlightColor: '#A8E6CF', highlightStyle: 'pill' },
      ],
      body_segments: [
        { text: 'Tech ' },
        { text: 'leads', accent: true },
        { text: ' gains overnight' },
      ],
      image_query: 'stock market chart',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: {
        hook_font_size: 96,
        body_font_size: 56,
        text_color: '#0a0a0a',
        hook_text_color: '#0a0a0a',
        body_text_color: '#3d0000',
        text_align: 'left',
        layout: 'cover',
      },
    }

    // 1) Eager migrate on load (mirrors useSlideEditor.migrateLegacySlides).
    const slidesWithBoxes: Slide[] = [
      { ...originalLegacy, text_boxes: legacyToTextBoxes(originalLegacy) },
    ]
    expect(slidesWithBoxes[0].text_boxes!.length).toBe(2) // hook + body
    expect(slidesWithBoxes[0].text_boxes![0].role).toBe('hook')
    expect(slidesWithBoxes[0].text_boxes![1].role).toBe('body')

    let state: EditorHistory = { past: [], present: slidesWithBoxes, future: [] }
    const initialBoxCount = state.present[0].text_boxes!.length

    // 2) ADD_TEXT_BOX (custom)
    state = editorReducer(state, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
      defaults: { text: 'Bonus' },
    })
    expect(state.present[0].text_boxes!.length).toBe(initialBoxCount + 1)
    expect(state.present[0].text_boxes![initialBoxCount].text).toBe('Bonus')

    // 3) UNDO restores prior state
    state = editorReducer(state, { type: 'UNDO' })
    expect(state.present[0].text_boxes!.length).toBe(initialBoxCount)

    // 4) REDO brings back the added box
    state = editorReducer(state, { type: 'REDO' })
    expect(state.present[0].text_boxes!.length).toBe(initialBoxCount + 1)
    expect(state.present[0].text_boxes![initialBoxCount].text).toBe('Bonus')

    // 5) Save (dual-write): legacy fields populated AND text_boxes preserved.
    const saved = state.present.map(saveDualWrite)
    expect(saved[0].hook_text).toBe(originalLegacy.hook_text)
    expect(saved[0].body_text).toBe(originalLegacy.body_text)
    expect(saved[0].hook_segments).toEqual(originalLegacy.hook_segments)
    expect(saved[0].body_segments).toEqual(originalLegacy.body_segments)
    // The added box should now appear in custom_texts
    expect(saved[0].custom_texts).toBeDefined()
    expect(saved[0].custom_texts!.length).toBe(1)
    expect(saved[0].custom_texts![0].text).toBe('Bonus')
    // text_boxes preserved alongside legacy fields
    expect(saved[0].text_boxes).toBeDefined()
    expect(saved[0].text_boxes!.length).toBe(initialBoxCount + 1)
    // style_overrides untouched-but-merged: layout still 'cover'
    expect(saved[0].style_overrides?.layout).toBe('cover')
    expect(saved[0].style_overrides?.text_align).toBe('left')
  })

  test('reload after dual-write produces identical text_boxes via eager migrate', () => {
    const originalLegacy: Slide = {
      hook_text: 'Hello',
      body_text: 'World',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
    }
    // First load
    const firstLoad: Slide = { ...originalLegacy, text_boxes: legacyToTextBoxes(originalLegacy) }
    // Save (dual-write)
    const saved = saveDualWrite(firstLoad)
    expect(saved.hook_text).toBe('Hello')
    expect(saved.body_text).toBe('World')
    expect(saved.text_boxes).toBeDefined()
    // Re-load: text_boxes is already present, so eager-migrate should be a no-op.
    // (Mirroring useSlideEditor.migrateLegacySlides logic.)
    const reloaded = saved.text_boxes ? saved : { ...saved, text_boxes: legacyToTextBoxes(saved) }
    expect(reloaded.text_boxes).toEqual(saved.text_boxes)
    expect(reloaded.text_boxes![0].role).toBe('hook')
    expect(reloaded.text_boxes![1].role).toBe('body')
  })
})
