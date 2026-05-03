import { describe, test, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Slide, TextBox, CustomImage, Watermark } from '@/lib/types/slide'
import { useSelectionModel } from '@/lib/editor/use-selection-model'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeTextBox(id: string): TextBox {
  return {
    id,
    role: 'custom',
    text: '',
    position: { anchor: 'custom', x: 0, y: 0, width: 50 },
  }
}

function makeCustomImage(id: string): CustomImage {
  return {
    id,
    url: 'https://example.com/x.png',
    x: 0,
    y: 0,
    width: 20,
    height: 20,
  }
}

function makeWatermark(id: string): Watermark {
  return { id, enabled: true, position: 'bottom-right' }
}

function makeSlide(opts: {
  text_boxes?: TextBox[]
  custom_images?: CustomImage[]
  watermark?: Watermark
} = {}): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: opts.text_boxes,
    custom_images: opts.custom_images,
    watermark: opts.watermark,
  }
}

const slideWithIds = (textBoxIds: string[]): Slide =>
  makeSlide({ text_boxes: textBoxIds.map(makeTextBox) })

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('useSelectionModel — initial state', () => {
  test('Test 1: empty presentSlides → ids=[] and primary=null', () => {
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [] }),
    )
    expect(result.current.ids).toEqual([])
    expect(result.current.primary).toBe(null)
  })
})

describe('useSelectionModel — replaceWith', () => {
  test('Test 2: replaceWith([a,b,c]) sets ids=[a,b,c] and primary=c', () => {
    const slide = slideWithIds(['a', 'b', 'c'])
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.replaceWith(['a', 'b', 'c'])
    })
    expect(result.current.ids).toEqual(['a', 'b', 'c'])
    expect(result.current.primary).toBe('c')
  })

  test('Test 3: replaceWith([]) sets primary=null', () => {
    const slide = slideWithIds(['a'])
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.replaceWith(['a'])
    })
    expect(result.current.primary).toBe('a')
    act(() => {
      result.current.replaceWith([])
    })
    expect(result.current.ids).toEqual([])
    expect(result.current.primary).toBe(null)
  })
})

describe('useSelectionModel — addToSelection', () => {
  test('Test 4: addToSelection on empty selection → ids=[a], primary=a', () => {
    const slide = slideWithIds(['a'])
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.addToSelection('a')
    })
    expect(result.current.ids).toEqual(['a'])
    expect(result.current.primary).toBe('a')
  })

  test('Test 5: addToSelection of duplicate → no change in ids', () => {
    const slide = slideWithIds(['a'])
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.addToSelection('a')
    })
    act(() => {
      result.current.addToSelection('a')
    })
    expect(result.current.ids).toEqual(['a'])
    expect(result.current.primary).toBe('a')
  })

  test('Test 6 (SEL-15): addToSelection preserves insertion order', () => {
    const slide = slideWithIds(['a', 'b', 'c'])
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.addToSelection('a')
    })
    act(() => {
      result.current.addToSelection('b')
    })
    act(() => {
      result.current.addToSelection('c')
    })
    expect(result.current.ids).toEqual(['a', 'b', 'c'])
    expect(result.current.primary).toBe('c')
  })
})

describe('useSelectionModel — removeFromSelection', () => {
  test('Test 7: removeFromSelection middle id preserves order; primary updates if matched', () => {
    const slide = slideWithIds(['a', 'b', 'c'])
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.replaceWith(['a', 'b', 'c'])
    })
    expect(result.current.primary).toBe('c')
    act(() => {
      result.current.removeFromSelection('b')
    })
    expect(result.current.ids).toEqual(['a', 'c'])
    expect(result.current.primary).toBe('c') // 'b' was not primary; unchanged

    // Now remove primary
    act(() => {
      result.current.removeFromSelection('c')
    })
    expect(result.current.ids).toEqual(['a'])
    expect(result.current.primary).toBe(null) // primary cleared on its own removal
  })
})

describe('useSelectionModel — toggleInSelection', () => {
  test('Test 8: toggle absent → adds; toggle present → removes', () => {
    const slide = slideWithIds(['a'])
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.toggleInSelection('a')
    })
    expect(result.current.ids).toEqual(['a'])
    expect(result.current.primary).toBe('a')

    act(() => {
      result.current.toggleInSelection('a')
    })
    expect(result.current.ids).toEqual([])
    expect(result.current.primary).toBe(null)
  })

  test('Test 9 (SEL-02 / SEL-03): Shift-click pattern: toggle a → toggle a → empty', () => {
    const slide = slideWithIds(['a'])
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.toggleInSelection('a')
    })
    act(() => {
      result.current.toggleInSelection('a')
    })
    expect(result.current.ids).toEqual([])
    expect(result.current.primary).toBe(null)
  })
})

describe('useSelectionModel — clear', () => {
  test('Test 10: clear() resets ids=[] and primary=null', () => {
    const slide = slideWithIds(['a', 'b'])
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.replaceWith(['a', 'b'])
    })
    expect(result.current.ids.length).toBe(2)
    act(() => {
      result.current.clear()
    })
    expect(result.current.ids).toEqual([])
    expect(result.current.primary).toBe(null)
  })
})

describe('useSelectionModel — selectAll', () => {
  test('Test 11 (SEL-07 contract): selectAll populates text_boxes ∪ custom_images ∪ watermark ids', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1'), makeTextBox('tb2')],
      custom_images: [makeCustomImage('ci1')],
      watermark: makeWatermark('w0'),
    })
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.selectAll(slide)
    })
    expect(result.current.ids).toEqual(['tb1', 'tb2', 'ci1', 'w0'])
    expect(result.current.primary).toBe('w0')
  })

  test('Test 12: selectAll on slide with no elements → ids=[], primary=null', () => {
    const slide = makeSlide({})
    const { result } = renderHook(() =>
      useSelectionModel({ slideIndex: 0, presentSlides: [slide] }),
    )
    act(() => {
      result.current.selectAll(slide)
    })
    expect(result.current.ids).toEqual([])
    expect(result.current.primary).toBe(null)
  })
})

describe('useSelectionModel — slide-switch reset (SEL-10)', () => {
  test('Test 13: slideIndex change from 0 → 1 clears ids and primary', () => {
    const slideA = slideWithIds(['a', 'b'])
    const slideB = slideWithIds(['x', 'y'])
    const { result, rerender } = renderHook(
      (props: { slideIndex: number; presentSlides: Slide[] }) =>
        useSelectionModel(props),
      { initialProps: { slideIndex: 0, presentSlides: [slideA, slideB] } },
    )
    act(() => {
      result.current.replaceWith(['a', 'b'])
    })
    expect(result.current.ids).toEqual(['a', 'b'])
    expect(result.current.primary).toBe('b')

    rerender({ slideIndex: 1, presentSlides: [slideA, slideB] })

    expect(result.current.ids).toEqual([])
    expect(result.current.primary).toBe(null)
  })
})

describe('useSelectionModel — stale-id pruning (SEL-11)', () => {
  test('Test 14: presentSlides mutation removing an id filters it out of ids', () => {
    const slideV1 = slideWithIds(['a', 'b', 'c'])
    const { result, rerender } = renderHook(
      (props: { slideIndex: number; presentSlides: Slide[] }) =>
        useSelectionModel(props),
      { initialProps: { slideIndex: 0, presentSlides: [slideV1] } },
    )
    act(() => {
      result.current.replaceWith(['a', 'b', 'c'])
    })
    expect(result.current.ids).toEqual(['a', 'b', 'c'])

    // Mutation: remove 'b'
    const slideV2 = slideWithIds(['a', 'c'])
    rerender({ slideIndex: 0, presentSlides: [slideV2] })

    expect(result.current.ids).toEqual(['a', 'c'])
  })

  test('Test 15: removing the primary id clears primary to null', () => {
    const slideV1 = slideWithIds(['a', 'b'])
    const { result, rerender } = renderHook(
      (props: { slideIndex: number; presentSlides: Slide[] }) =>
        useSelectionModel(props),
      { initialProps: { slideIndex: 0, presentSlides: [slideV1] } },
    )
    act(() => {
      result.current.replaceWith(['a', 'b'])
    })
    expect(result.current.primary).toBe('b')

    const slideV2 = slideWithIds(['a'])
    rerender({ slideIndex: 0, presentSlides: [slideV2] })

    // Per RESEARCH Q3 spec: primary clears if invalid (not auto-promote)
    expect(result.current.primary).toBe(null)
    expect(result.current.ids).toEqual(['a'])
  })

  test('Test 16: slide-switch ALWAYS clears (SEL-10 takes precedence over potential id-match)', () => {
    // Both slides happen to contain id 'a' — verify slide-switch still clears
    const slideA = slideWithIds(['a'])
    const slideB = slideWithIds(['a'])
    const { result, rerender } = renderHook(
      (props: { slideIndex: number; presentSlides: Slide[] }) =>
        useSelectionModel(props),
      { initialProps: { slideIndex: 0, presentSlides: [slideA, slideB] } },
    )
    act(() => {
      result.current.replaceWith(['a'])
    })
    expect(result.current.ids).toEqual(['a'])

    rerender({ slideIndex: 1, presentSlides: [slideA, slideB] })

    // Slide-switch ALWAYS clears, even if 'a' would have remained valid
    expect(result.current.ids).toEqual([])
    expect(result.current.primary).toBe(null)
  })
})

describe('useSelectionModel — ref-stable API (useMemo)', () => {
  test('Test 17: mutator references stable across re-renders that don\'t change ids', () => {
    const slide = slideWithIds(['a'])
    const { result, rerender } = renderHook(
      (props: { slideIndex: number; presentSlides: Slide[] }) =>
        useSelectionModel(props),
      { initialProps: { slideIndex: 0, presentSlides: [slide] } },
    )
    const clearRef1 = result.current.clear
    const replaceRef1 = result.current.replaceWith
    const addRef1 = result.current.addToSelection
    const removeRef1 = result.current.removeFromSelection
    const toggleRef1 = result.current.toggleInSelection
    const selectAllRef1 = result.current.selectAll

    // Re-render with the same props (same slide reference) — selection state unchanged
    rerender({ slideIndex: 0, presentSlides: [slide] })

    expect(result.current.clear).toBe(clearRef1)
    expect(result.current.replaceWith).toBe(replaceRef1)
    expect(result.current.addToSelection).toBe(addRef1)
    expect(result.current.removeFromSelection).toBe(removeRef1)
    expect(result.current.toggleInSelection).toBe(toggleRef1)
    expect(result.current.selectAll).toBe(selectAllRef1)
  })
})
