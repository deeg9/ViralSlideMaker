import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhotoTreatmentControls } from '../photo-treatment-controls'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 57 (EDITOR-01, D-08, D-12): photo-treatment-controls component
 * unit tests. Asserts disabled-state stub, switch + radio behavior,
 * active-value mirroring, and pending-state spinner.
 */

const TMPL = getTemplate('editorial-serif')

function makeSlide(opts: Partial<Slide> = {}): Slide {
  return {
    hook_text: '', body_text: '',
    image_query: '', is_cta: false,
    background_url: 'https://example.com/treated.png',
    original_source_url: 'https://example.com/original.png',
    pexels_photo_id: null,
    ...opts,
  }
}

describe('PhotoTreatmentControls', () => {
  it('renders disabled-state stub when slide has no photo at all (D-12)', () => {
    const slide = makeSlide({ background_url: null, original_source_url: undefined })
    const { container } = render(
      <PhotoTreatmentControls
        slide={slide}
        template={TMPL}
        isPending={false}
        onTreatmentChange={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-state="disabled-no-photo"]')).toBeTruthy()
    expect(screen.getByText(/Add a photo to apply treatments/i)).toBeTruthy()
    // Switch + radios are NOT rendered
    expect(container.querySelector('[role="radiogroup"]')).toBeFalsy()
  })

  it('Switch onChange fires onTreatmentChange with kind:bw, grain:off', () => {
    const onChange = vi.fn()
    render(
      <PhotoTreatmentControls
        slide={makeSlide()}
        template={TMPL}
        isPending={false}
        onTreatmentChange={onChange}
      />,
    )
    const sw = screen.getByLabelText(/black and white/i)
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith({ kind: 'bw', grain: 'off' })
  })

  it('selecting Cream duotone fires kind:duotone-cream and visually flips B&W off', () => {
    const onChange = vi.fn()
    const slide = makeSlide({
      style_overrides: { treatment_applied: 'bw' },
    })
    const { rerender } = render(
      <PhotoTreatmentControls
        slide={slide}
        template={TMPL}
        isPending={false}
        onTreatmentChange={onChange}
      />,
    )
    const cream = screen.getByRole('radio', { name: /cream/i })
    fireEvent.click(cream)
    expect(onChange).toHaveBeenCalledWith({ kind: 'duotone-cream', grain: 'off' })

    // Simulate parent persisting the new spec
    rerender(
      <PhotoTreatmentControls
        slide={makeSlide({ style_overrides: { treatment_applied: 'duotone-cream' } })}
        template={TMPL}
        isPending={false}
        onTreatmentChange={onChange}
      />,
    )
    const sw = screen.getByLabelText(/black and white/i)
    expect(sw.getAttribute('data-state')).toBe('unchecked')
  })

  it('selecting grain Medium fires grain:medium', () => {
    const onChange = vi.fn()
    render(
      <PhotoTreatmentControls
        slide={makeSlide()}
        template={TMPL}
        isPending={false}
        onTreatmentChange={onChange}
      />,
    )
    const medium = screen.getByRole('radio', { name: /medium/i })
    fireEvent.click(medium)
    expect(onChange).toHaveBeenCalledWith({ kind: 'none', grain: 'medium' })
  })

  it('active-value mirroring: treatment_applied=bw makes Switch ON; grain_intensity=subtle makes Subtle radio active', () => {
    render(
      <PhotoTreatmentControls
        slide={makeSlide({
          style_overrides: { treatment_applied: 'bw', grain_intensity: 'subtle' },
        })}
        template={TMPL}
        isPending={false}
        onTreatmentChange={vi.fn()}
      />,
    )
    const sw = screen.getByLabelText(/black and white/i)
    expect(sw.getAttribute('data-state')).toBe('checked')
    const subtle = screen.getByRole('radio', { name: /subtle/i })
    expect(subtle.getAttribute('aria-checked')).toBe('true')
  })

  it('isPending=true shows spinner; false hides it', () => {
    const { rerender, container } = render(
      <PhotoTreatmentControls
        slide={makeSlide()}
        template={TMPL}
        isPending={true}
        onTreatmentChange={vi.fn()}
      />,
    )
    expect(container.textContent).toMatch(/treating/i)

    rerender(
      <PhotoTreatmentControls
        slide={makeSlide()}
        template={TMPL}
        isPending={false}
        onTreatmentChange={vi.fn()}
      />,
    )
    expect(container.textContent).not.toMatch(/treating/i)
  })

  it('renders read-only when onTreatmentChange omitted (D-29)', () => {
    render(
      <PhotoTreatmentControls
        slide={makeSlide()}
        template={TMPL}
        isPending={false}
      />,
    )
    const sw = screen.getByLabelText(/black and white/i)
    expect(sw.hasAttribute('disabled')).toBe(true)
  })
})
