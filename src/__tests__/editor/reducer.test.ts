import { describe, it, expect } from 'vitest'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'
import type { EditorAction } from '@/lib/editor/editor-actions'
import type { Slide } from '@/lib/types/slide'

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: 'query',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...overrides,
  }
}

function makeHistory(slides: Slide[], past: Slide[][] = [], future: Slide[][] = []): EditorHistory {
  return { past, present: slides, future }
}

describe('editorReducer', () => {
  describe('ADD_SLIDE', () => {
    it('inserts a blank slide at specified index', () => {
      const state = makeHistory([makeSlide({ hook_text: 'First' })])
      const result = editorReducer(state, { type: 'ADD_SLIDE', index: 0 } as EditorAction)

      expect(result.present).toHaveLength(2)
      expect(result.present[0].hook_text).toBe('')
      expect(result.present[0].body_text).toBe('')
      expect(result.present[0].image_query).toBe('')
      expect(result.present[0].is_cta).toBe(false)
      expect(result.present[0].background_url).toBeNull()
      expect(result.present[0].pexels_photo_id).toBeNull()
      expect(result.present[1].hook_text).toBe('First')
    })

    it('pushes current state to past', () => {
      const state = makeHistory([makeSlide()])
      const result = editorReducer(state, { type: 'ADD_SLIDE', index: 0 } as EditorAction)

      expect(result.past).toHaveLength(1)
      expect(result.past[0]).toEqual(state.present)
    })

    it('clears future on new action', () => {
      const futureSlides = [makeSlide({ hook_text: 'Future' })]
      const state = makeHistory([makeSlide()], [], [futureSlides])
      const result = editorReducer(state, { type: 'ADD_SLIDE', index: 0 } as EditorAction)

      expect(result.future).toHaveLength(0)
    })
  })

  describe('REMOVE_SLIDE', () => {
    it('removes the slide at specified index', () => {
      const slides = [makeSlide({ hook_text: 'A' }), makeSlide({ hook_text: 'B' })]
      const state = makeHistory(slides)
      const result = editorReducer(state, { type: 'REMOVE_SLIDE', index: 0 } as EditorAction)

      expect(result.present).toHaveLength(1)
      expect(result.present[0].hook_text).toBe('B')
    })

    it('is a no-op if only 1 slide remains', () => {
      const state = makeHistory([makeSlide()])
      const result = editorReducer(state, { type: 'REMOVE_SLIDE', index: 0 } as EditorAction)

      expect(result.present).toHaveLength(1)
      // Should not push to history for no-op
      expect(result.past).toHaveLength(0)
    })
  })

  describe('DUPLICATE_SLIDE', () => {
    it('deep clones slide and inserts after original', () => {
      const slide = makeSlide({ hook_text: 'Original', style_overrides: { text_color: '#fff' } })
      const state = makeHistory([slide])
      const result = editorReducer(state, { type: 'DUPLICATE_SLIDE', index: 0 } as EditorAction)

      expect(result.present).toHaveLength(2)
      expect(result.present[1].hook_text).toBe('Original')
      expect(result.present[1].style_overrides?.text_color).toBe('#fff')
      // Verify deep clone (not same reference)
      expect(result.present[0]).not.toBe(result.present[1])
      if (result.present[0].style_overrides && result.present[1].style_overrides) {
        expect(result.present[0].style_overrides).not.toBe(result.present[1].style_overrides)
      }
    })
  })

  describe('REORDER_SLIDES', () => {
    it('moves a slide from one index to another', () => {
      const slides = [
        makeSlide({ hook_text: 'A' }),
        makeSlide({ hook_text: 'B' }),
        makeSlide({ hook_text: 'C' }),
      ]
      const state = makeHistory(slides)
      const result = editorReducer(state, { type: 'REORDER_SLIDES', from: 0, to: 2 } as EditorAction)

      expect(result.present[0].hook_text).toBe('B')
      expect(result.present[1].hook_text).toBe('C')
      expect(result.present[2].hook_text).toBe('A')
    })
  })

  describe('UPDATE_SLIDE', () => {
    it('merges partial updates into slide at index', () => {
      const state = makeHistory([makeSlide({ hook_text: 'Old' })])
      const result = editorReducer(state, {
        type: 'UPDATE_SLIDE',
        index: 0,
        updates: { hook_text: 'New' },
      } as EditorAction)

      expect(result.present[0].hook_text).toBe('New')
      expect(result.present[0].body_text).toBe('Body') // unchanged
    })

    it('merges style_overrides properties', () => {
      const slide = makeSlide({ style_overrides: { text_color: '#000' } })
      const state = makeHistory([slide])
      const result = editorReducer(state, {
        type: 'UPDATE_SLIDE',
        index: 0,
        updates: { style_overrides: { hook_font_size: 24 } },
      } as EditorAction)

      expect(result.present[0].style_overrides?.text_color).toBe('#000')
      expect(result.present[0].style_overrides?.hook_font_size).toBe(24)
    })
  })

  describe('SET_SLIDES', () => {
    it('replaces all slides', () => {
      const state = makeHistory([makeSlide()])
      const newSlides = [makeSlide({ hook_text: 'New1' }), makeSlide({ hook_text: 'New2' })]
      const result = editorReducer(state, { type: 'SET_SLIDES', slides: newSlides } as EditorAction)

      expect(result.present).toHaveLength(2)
      expect(result.present[0].hook_text).toBe('New1')
    })
  })

  describe('UNDO', () => {
    it('restores previous state from past', () => {
      const pastSlides = [makeSlide({ hook_text: 'Past' })]
      const currentSlides = [makeSlide({ hook_text: 'Current' })]
      const state = makeHistory(currentSlides, [pastSlides])
      const result = editorReducer(state, { type: 'UNDO' } as EditorAction)

      expect(result.present[0].hook_text).toBe('Past')
    })

    it('pushes current to future', () => {
      const pastSlides = [makeSlide({ hook_text: 'Past' })]
      const currentSlides = [makeSlide({ hook_text: 'Current' })]
      const state = makeHistory(currentSlides, [pastSlides])
      const result = editorReducer(state, { type: 'UNDO' } as EditorAction)

      expect(result.future).toHaveLength(1)
      expect(result.future[0][0].hook_text).toBe('Current')
    })

    it('returns state unchanged if past is empty', () => {
      const state = makeHistory([makeSlide()])
      const result = editorReducer(state, { type: 'UNDO' } as EditorAction)

      expect(result).toBe(state)
    })
  })

  describe('REDO', () => {
    it('restores next state from future', () => {
      const futureSlides = [makeSlide({ hook_text: 'Future' })]
      const currentSlides = [makeSlide({ hook_text: 'Current' })]
      const state = makeHistory(currentSlides, [], [futureSlides])
      const result = editorReducer(state, { type: 'REDO' } as EditorAction)

      expect(result.present[0].hook_text).toBe('Future')
    })

    it('pushes current to past', () => {
      const futureSlides = [makeSlide({ hook_text: 'Future' })]
      const currentSlides = [makeSlide({ hook_text: 'Current' })]
      const state = makeHistory(currentSlides, [], [futureSlides])
      const result = editorReducer(state, { type: 'REDO' } as EditorAction)

      expect(result.past).toHaveLength(1)
      expect(result.past[0][0].hook_text).toBe('Current')
    })

    it('returns state unchanged if future is empty', () => {
      const state = makeHistory([makeSlide()])
      const result = editorReducer(state, { type: 'REDO' } as EditorAction)

      expect(result).toBe(state)
    })
  })

  describe('History cap', () => {
    it('caps undo history at 50 entries', () => {
      let state = makeHistory([makeSlide()])
      // Perform 55 actions
      for (let i = 0; i < 55; i++) {
        state = editorReducer(state, {
          type: 'UPDATE_SLIDE',
          index: 0,
          updates: { hook_text: `v${i}` },
        } as EditorAction)
      }

      expect(state.past.length).toBeLessThanOrEqual(50)
    })
  })
})
