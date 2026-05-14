import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { TextEditorPanel } from '../text-editor-panel'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * Right-rail composition order regression test.
 *
 * Locks the v2.8 right-rail composition order:
 *
 *   layer-strip → active-text-box-card → slide-settings → watermark-controls
 *
 * quick-260514-drop-photo-treatment-white-cards: photo-treatment-controls
 * was unmounted from this panel; the surface itself (component + standalone
 * tests) still exists for future re-introduction. If a future phase changes
 * child order, this test fails and forces an intentional update.
 */

const TMPL = getTemplate('editorial-serif')

function makeSlide(): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: 'https://example.com/img.png',
    original_source_url: 'https://example.com/img.png',
    pexels_photo_id: null,
  }
}

describe('TextEditorPanel composition order (EDITOR-04)', () => {
  it('renders LayerStrip → ActiveTextBoxCard in order', () => {
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide()}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )

    const panel = container.querySelector('[data-testid="text-editor-panel"]')
    expect(panel).toBeTruthy()

    // ActiveTextBoxCard renders one of two testids depending on whether a box
    // is selected: 'active-text-box-card' OR 'active-text-box-card-empty'.
    const named = ['layer-strip', 'active-text-box-card', 'active-text-box-card-empty']
    const all = Array.from(panel!.querySelectorAll('[data-testid]'))
      .map((el) => el.getAttribute('data-testid'))
      .filter((id): id is string => !!id && named.includes(id))

    const firstIndex: Record<string, number> = {}
    all.forEach((id, i) => {
      if (firstIndex[id] === undefined) firstIndex[id] = i
    })

    expect(firstIndex['layer-strip']).toBeDefined()
    const activeIndex = firstIndex['active-text-box-card'] ?? firstIndex['active-text-box-card-empty']
    expect(activeIndex, 'expected active-text-box-card OR active-text-box-card-empty in panel').toBeDefined()

    expect(firstIndex['layer-strip']).toBeLessThan(activeIndex)
  })

  it('PhotoTreatmentControls is NOT mounted in the TEXT tab (quick-260514-drop-photo-treatment-white-cards)', () => {
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide()}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="photo-treatment-controls"]')).toBeNull()
  })

  it('SlideSettings and WatermarkControls are NOT mounted in the TEXT tab (quick-260514-move-slide-cards-to-elements)', () => {
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide()}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="slide-settings"]')).toBeNull()
    expect(container.querySelector('[data-testid="watermark-controls"]')).toBeNull()
  })
})
