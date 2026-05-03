import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as fs from 'fs'
import * as path from 'path'
import type { Slide, TextBox, CustomImage, Watermark } from '@/lib/types/slide'
import type { Selection } from '@/lib/editor/use-selection-model'
import { MultiSelectTypeBar } from '../multi-select-type-bar'

/**
 * Phase 60 (SEL-12): MultiSelectTypeBar minimal-viable tests.
 *
 * The bar renders ONLY when N >= 2 elements are selected. Phase 60 surface:
 * count + type breakdown + Delete button. Property fields (font, color,
 * treatment) arrive in Phase 63 alongside the alignment toolbar.
 *
 * NO key-object UX (PITFALL-12.3): bar must not surface "primary".
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
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

function makeSelection(ids: string[]): Selection {
  return { ids, primary: ids.length > 0 ? ids[ids.length - 1] : null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('MultiSelectTypeBar — Phase 60 minimal surface (SEL-12)', () => {
  it('Test 1: renders header with N = selection.ids.length (3 elements)', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('a'), makeTextBox('b')],
      custom_images: [makeCustomImage('c')],
    })
    const selection = makeSelection(['a', 'b', 'c'])
    render(
      <MultiSelectTypeBar
        slide={slide}
        selection={selection}
        onBulkDelete={vi.fn()}
      />,
    )
    expect(screen.getByText(/3 elements selected/i)).toBeInTheDocument()
  })

  it('Test 2: renders type breakdown for mixed text+image selection', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('t1'), makeTextBox('t2')],
      custom_images: [makeCustomImage('i1')],
    })
    const selection = makeSelection(['t1', 't2', 'i1'])
    render(
      <MultiSelectTypeBar
        slide={slide}
        selection={selection}
        onBulkDelete={vi.fn()}
      />,
    )
    // 2 text boxes + 1 image
    expect(screen.getByText(/2 text boxes/i)).toBeInTheDocument()
    expect(screen.getByText(/^1 image$/i)).toBeInTheDocument()
  })

  it('Test 2b: watermark in selection shows "1 watermark"', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('t1')],
      watermark: makeWatermark('w_0'),
    })
    const selection = makeSelection(['t1', 'w_0'])
    render(
      <MultiSelectTypeBar
        slide={slide}
        selection={selection}
        onBulkDelete={vi.fn()}
      />,
    )
    expect(screen.getByText(/1 watermark/i)).toBeInTheDocument()
  })

  it('Test 3: renders single Delete button labeled "Delete N elements"', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a'), makeCustomImage('b')],
    })
    const selection = makeSelection(['a', 'b'])
    render(
      <MultiSelectTypeBar
        slide={slide}
        selection={selection}
        onBulkDelete={vi.fn()}
      />,
    )
    const btn = screen.getByRole('button', { name: /delete 2 elements/i })
    expect(btn).toBeInTheDocument()
  })

  it('Test 4: clicking Delete invokes onBulkDelete with selection.ids', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a'), makeCustomImage('b')],
    })
    const selection = makeSelection(['a', 'b'])
    const onBulkDelete = vi.fn()
    render(
      <MultiSelectTypeBar
        slide={slide}
        selection={selection}
        onBulkDelete={onBulkDelete}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete 2 elements/i }))
    expect(onBulkDelete).toHaveBeenCalledTimes(1)
    expect(onBulkDelete).toHaveBeenCalledWith(['a', 'b'])
  })

  it('Test 5: mixed selection breakdown (text + image + watermark) all rendered', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('t1')],
      custom_images: [makeCustomImage('i1'), makeCustomImage('i2')],
      watermark: makeWatermark('w_0'),
    })
    const selection = makeSelection(['t1', 'i1', 'i2', 'w_0'])
    render(
      <MultiSelectTypeBar
        slide={slide}
        selection={selection}
        onBulkDelete={vi.fn()}
      />,
    )
    expect(screen.getByText(/^1 text box$/i)).toBeInTheDocument()
    expect(screen.getByText(/^2 images$/i)).toBeInTheDocument()
    expect(screen.getByText(/1 watermark/i)).toBeInTheDocument()
    expect(screen.getByText(/4 elements selected/i)).toBeInTheDocument()
  })

  it('Test 6: does NOT render font/color/treatment property fields (Phase 60 deferred)', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('a'), makeTextBox('b')],
    })
    const selection = makeSelection(['a', 'b'])
    const { container } = render(
      <MultiSelectTypeBar
        slide={slide}
        selection={selection}
        onBulkDelete={vi.fn()}
      />,
    )
    // No <input type="color"> / fontFamily picker / treatment dropdown
    expect(container.querySelector('input[type="color"]')).toBeNull()
    expect(container.querySelector('select')).toBeNull()
    // No font/color/treatment label substrings
    expect(container.textContent ?? '').not.toMatch(/font/i)
    expect(container.textContent ?? '').not.toMatch(/color/i)
    expect(container.textContent ?? '').not.toMatch(/treatment/i)
  })

  it('Test 7: source file declares "use client"', () => {
    const filePath = path.resolve(
      process.cwd(),
      'src/components/editor/multi-select-type-bar.tsx',
    )
    const src = fs.readFileSync(filePath, 'utf8')
    expect(src).toMatch(/^['"]use client['"]/m)
  })

  it('Test 8 (PITFALL-12.3): no "primary" / "key object" UX in rendered output', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('a'), makeTextBox('b')],
    })
    const selection: Selection = { ids: ['a', 'b'], primary: 'b' }
    const { container } = render(
      <MultiSelectTypeBar
        slide={slide}
        selection={selection}
        onBulkDelete={vi.fn()}
      />,
    )
    expect(container.textContent ?? '').not.toMatch(/primary/i)
    expect(container.textContent ?? '').not.toMatch(/key object/i)
    expect(container.textContent ?? '').not.toMatch(/key element/i)
  })
})
