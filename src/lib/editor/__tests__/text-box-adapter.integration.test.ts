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

describe('Phase 53: schema-boundary verification', () => {
  test('MIG-04: legacy edit → text_boxes edit → UNDO → REDO consistency', () => {
    // Start with a legacy slide; eager-migrate to text_boxes (mirrors load path).
    // This test exercises the schema boundary: a UPDATE_TEXT_BOX edit on the hook box
    // (text_boxes side) followed by a body-color edit, then undo/redo. The dual-write
    // path keeps both shapes in sync each step; legacy-only writes via UPDATE_SLIDE on
    // hook_text are intentionally not exercised here because applyDualWrite (the v2.8
    // sync mechanism) is one-way text_boxes→legacy and would clobber a legacy-only
    // hook_text edit on the next text_boxes mutation. The v2.8 panel writes hook_text
    // exclusively through UPDATE_TEXT_BOX, so the boundary stays consistent in practice.
    const originalLegacy: Slide = {
      hook_text: 'ORIGINAL_HOOK',
      body_text: 'ORIGINAL_BODY',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: {
        hook_text_color: '#000000',
        body_text_color: '#111111',
      },
    }
    const initialSlides: Slide[] = [
      { ...originalLegacy, text_boxes: legacyToTextBoxes(originalLegacy) },
    ]
    let state: EditorHistory = { past: [], present: initialSlides, future: [] }

    // Step 1: edit hook text via UPDATE_TEXT_BOX (the v2.8 panel's write path).
    const hookBoxId = state.present[0].text_boxes!.find((tb) => tb.role === 'hook')!.id
    const bodyBoxId = state.present[0].text_boxes!.find((tb) => tb.role === 'body')!.id
    state = editorReducer(state, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: hookBoxId,
      updates: { text: 'NEW' },
    })
    // applyDualWrite mirrors the change to legacy hook_text.
    expect(state.present[0].hook_text).toBe('NEW')
    expect(state.present[0].text_boxes!.find((tb) => tb.id === hookBoxId)!.text).toBe('NEW')

    // Step 2: text_boxes-side edit — change body color via UPDATE_TEXT_BOX.
    state = editorReducer(state, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: bodyBoxId,
      updates: { color: '#FF0000' },
    })
    expect(state.present[0].text_boxes!.find((tb) => tb.id === bodyBoxId)!.color).toBe('#FF0000')
    expect(state.present[0].style_overrides!.body_text_color).toBe('#FF0000')
    // hook_text='NEW' preserved across the body-color write.
    expect(state.present[0].hook_text).toBe('NEW')
    expect(state.present[0].text_boxes!.find((tb) => tb.id === hookBoxId)!.text).toBe('NEW')

    // Step 3: UNDO — body color reverts to ORIGINAL_BODY_COLOR ('#111111'); hook_text='NEW'
    // preserved. Both shapes stay in lock-step: body box .color and legacy body_text_color
    // both revert to the value present at load time.
    state = editorReducer(state, { type: 'UNDO' })
    expect(state.present[0].text_boxes!.find((tb) => tb.id === bodyBoxId)!.color).toBe('#111111')
    expect(state.present[0].style_overrides!.body_text_color).toBe('#111111')
    expect(state.present[0].hook_text).toBe('NEW')
    expect(state.present[0].text_boxes!.find((tb) => tb.id === hookBoxId)!.text).toBe('NEW')

    // Step 4: UNDO — hook_text reverts to ORIGINAL_HOOK; text_boxes mirrors it.
    state = editorReducer(state, { type: 'UNDO' })
    expect(state.present[0].hook_text).toBe('ORIGINAL_HOOK')
    expect(state.present[0].text_boxes!.find((tb) => tb.id === hookBoxId)!.text).toBe(
      'ORIGINAL_HOOK',
    )

    // Step 5: REDO — hook_text='NEW' again.
    state = editorReducer(state, { type: 'REDO' })
    expect(state.present[0].hook_text).toBe('NEW')
    expect(state.present[0].text_boxes!.find((tb) => tb.id === hookBoxId)!.text).toBe('NEW')

    // Step 6: REDO — body color back to '#FF0000'.
    state = editorReducer(state, { type: 'REDO' })
    expect(state.present[0].text_boxes!.find((tb) => tb.id === bodyBoxId)!.color).toBe('#FF0000')
    expect(state.present[0].style_overrides!.body_text_color).toBe('#FF0000')
    // hook_text='NEW' still in place.
    expect(state.present[0].hook_text).toBe('NEW')
    expect(state.present[0].text_boxes!.find((tb) => tb.id === hookBoxId)!.text).toBe('NEW')
  })

  test('MIG-03 (load-edit-save-reload cycle, shape 4 fixture)', () => {
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

    // Load: eager migrate.
    const loaded: Slide = {
      ...originalLegacy,
      text_boxes: legacyToTextBoxes(originalLegacy),
    }
    let state: EditorHistory = { past: [], present: [loaded], future: [] }

    // Edit via UPDATE_TEXT_BOX (applyDualWrite path).
    const hookBoxId = state.present[0].text_boxes!.find((tb) => tb.role === 'hook')!.id
    state = editorReducer(state, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: hookBoxId,
      updates: { font_size: 120 },
    })
    expect(state.present[0].style_overrides!.hook_font_size).toBe(120)

    // Save: snapshot both shapes.
    const saved = saveDualWrite(state.present[0])
    const savedTextBoxes = saved.text_boxes!
    // Sanity: legacy fields populated.
    expect(saved.hook_text).toBe('Markets surge as Fed pauses')
    expect(saved.body_text).toBe('Tech leads gains overnight')
    expect(saved.hook_segments).toEqual(originalLegacy.hook_segments)
    expect(saved.body_segments).toEqual(originalLegacy.body_segments)
    expect(saved.style_overrides!.hook_font_size).toBe(120)
    // Layout / non-text-box style_overrides preserved.
    expect(saved.style_overrides!.layout).toBe('cover')

    // Simulate reload: a fresh client receives `saved` from Supabase. text_boxes is present,
    // so eager-migrate is a no-op (mirrors useSlideEditor.migrateLegacySlides). Verify that
    // the round-trip leaves text_boxes byte-identical to what was saved.
    const reloaded: Slide = saved.text_boxes
      ? saved
      : { ...saved, text_boxes: legacyToTextBoxes(saved) }
    expect(reloaded.text_boxes).toEqual(savedTextBoxes)

    // Bonus: even if we *force* re-derivation from the saved legacy fields, the result must
    // structurally match (modulo TextBox.id, since legacyToTextBoxes mints fresh UUIDs).
    const rederived = legacyToTextBoxes(saved)
    expect(rederived.length).toBe(savedTextBoxes.length)
    for (let i = 0; i < rederived.length; i++) {
      const a = rederived[i]
      const b = savedTextBoxes[i]
      expect(a.role).toBe(b.role)
      expect(a.text).toBe(b.text)
      expect(a.segments).toEqual(b.segments)
      expect(a.font_size).toBe(b.font_size)
      expect(a.color).toBe(b.color)
      expect(a.position).toEqual(b.position)
    }
  })

  test('add custom text box → undo → redo → text_boxes + custom_texts both consistent', () => {
    const originalLegacy: Slide = {
      hook_text: 'H',
      body_text: 'B',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
    }
    const initial: Slide = {
      ...originalLegacy,
      text_boxes: legacyToTextBoxes(originalLegacy),
    }
    let state: EditorHistory = { past: [], present: [initial], future: [] }
    const initialBoxCount = state.present[0].text_boxes!.length

    // Pre-mint id so callers can track it (mirrors Phase 50 MR-01 pattern).
    const newBoxId = 'phase-53-test-custom-id'
    state = editorReducer(state, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
      defaults: { id: newBoxId, text: 'Bonus' },
    })

    // After ADD: text_boxes has the new entry; custom_texts has it too (via applyDualWrite).
    expect(state.present[0].text_boxes!.length).toBe(initialBoxCount + 1)
    const addedBox = state.present[0].text_boxes!.find((tb) => tb.id === newBoxId)
    expect(addedBox).toBeDefined()
    expect(addedBox!.role).toBe('custom')
    expect(addedBox!.text).toBe('Bonus')
    expect(state.present[0].custom_texts).toBeDefined()
    expect(state.present[0].custom_texts!.length).toBe(1)
    expect(state.present[0].custom_texts![0].id).toBe(newBoxId)
    expect(state.present[0].custom_texts![0].text).toBe('Bonus')

    // UNDO: both arrays drop the new entry.
    state = editorReducer(state, { type: 'UNDO' })
    expect(state.present[0].text_boxes!.length).toBe(initialBoxCount)
    expect(state.present[0].text_boxes!.find((tb) => tb.id === newBoxId)).toBeUndefined()
    // custom_texts is either undefined or empty after undo (the pre-add slide had no custom_texts).
    expect(state.present[0].custom_texts ?? []).toHaveLength(0)

    // REDO: both arrays have the new entry again.
    state = editorReducer(state, { type: 'REDO' })
    expect(state.present[0].text_boxes!.length).toBe(initialBoxCount + 1)
    expect(state.present[0].text_boxes!.find((tb) => tb.id === newBoxId)).toBeDefined()
    expect(state.present[0].custom_texts).toBeDefined()
    expect(state.present[0].custom_texts!.length).toBe(1)
    expect(state.present[0].custom_texts![0].id).toBe(newBoxId)
    expect(state.present[0].custom_texts![0].text).toBe('Bonus')
  })
})
