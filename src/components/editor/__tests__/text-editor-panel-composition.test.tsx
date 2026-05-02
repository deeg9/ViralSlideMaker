import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { TextEditorPanel } from '../text-editor-panel'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 57 (EDITOR-04, D-11, D-28): right-rail composition snapshot.
 *
 * Asserts the v2.8 right-rail composition order is preserved with the
 * Phase 57 PhotoTreatmentControls inserted between SlideSettings and the
 * conditional CustomTextEditor block:
 *
 *   layer-strip → active-text-box-card → slide-settings → photo-treatment-controls
 *
 * If a future phase changes child order, this test fails and forces an
 * intentional update.
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
  it('renders LayerStrip → ActiveTextBoxCard → SlideSettings → PhotoTreatmentControls in order', () => {
    const { container } = render(
      <TextEditorPanel
        slide={makeSlide()}
        template={TMPL}
        selectedTextBoxId={null}
        onSelectTextBox={vi.fn()}
        onTextBoxAction={vi.fn()}
        onUpdate={vi.fn()}
        onSlideTreatmentChange={vi.fn()}
        isTreatmentPending={false}
      />,
    )

    // The outer panel has data-testid="text-editor-panel"; collect direct children with data-testid
    const panel = container.querySelector('[data-testid="text-editor-panel"]')
    expect(panel).toBeTruthy()

    // ActiveTextBoxCard renders one of two testids depending on whether a box
    // is selected: 'active-text-box-card' OR 'active-text-box-card-empty'.
    // Either satisfies composition order.
    const named = ['layer-strip', 'active-text-box-card', 'active-text-box-card-empty', 'slide-settings', 'photo-treatment-controls']
    const all = Array.from(panel!.querySelectorAll('[data-testid]'))
      .map((el) => el.getAttribute('data-testid'))
      .filter((id): id is string => !!id && named.includes(id))

    // Each named testid should appear in our expected order. Some may be repeated
    // (e.g., nested data-testids in children) but FIRST appearance must be in order.
    const firstIndex: Record<string, number> = {}
    all.forEach((id, i) => {
      if (firstIndex[id] === undefined) firstIndex[id] = i
    })

    // All required markers present; ActiveTextBoxCard variants are ORed
    expect(firstIndex['layer-strip']).toBeDefined()
    expect(firstIndex['slide-settings']).toBeDefined()
    expect(firstIndex['photo-treatment-controls']).toBeDefined()
    const activeIndex = firstIndex['active-text-box-card'] ?? firstIndex['active-text-box-card-empty']
    expect(activeIndex, 'expected active-text-box-card OR active-text-box-card-empty in panel').toBeDefined()

    expect(firstIndex['layer-strip']).toBeLessThan(activeIndex)
    expect(activeIndex).toBeLessThan(firstIndex['slide-settings'])
    expect(firstIndex['slide-settings']).toBeLessThan(firstIndex['photo-treatment-controls'])
  })

  it('PhotoTreatmentControls renders even when onSlideTreatmentChange is omitted (D-29)', () => {
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
    expect(container.querySelector('[data-testid="photo-treatment-controls"]')).toBeTruthy()
  })
})
