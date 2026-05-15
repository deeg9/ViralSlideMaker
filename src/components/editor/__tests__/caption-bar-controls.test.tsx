import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CaptionBarControls } from '../caption-bar-controls'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * quick-260515-k12 — unit coverage for the Caption Bar control card + the
 * UPDATE_SLIDE noHistory channel.
 *
 * The card self-gates on `backgroundMode === 'image-with-bottom-card'`, emits
 * merged `style_overrides` patches, and uses a preview-on-change /
 * commit-on-release split so a slider drag records exactly ONE undo entry
 * (KBD-09). The color picker emits explicit hex strings (PCL12).
 */

const BOTTOM_CARD_TMPL = getTemplate('magazine-bold')
const NON_BOTTOM_CARD_TMPL = getTemplate('highlight-bar')

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...overrides,
  }
}

describe('CaptionBarControls', () => {
  it('renders the card for an image-with-bottom-card template', () => {
    render(
      <CaptionBarControls
        slide={makeSlide()}
        template={BOTTOM_CARD_TMPL}
        onSlideUpdate={vi.fn()}
        onSlidePreview={vi.fn()}
      />,
    )
    expect(screen.getByTestId('caption-bar-controls')).toBeTruthy()
  })

  it('renders null for a non-bottom-card template', () => {
    const { container } = render(
      <CaptionBarControls
        slide={makeSlide()}
        template={NON_BOTTOM_CARD_TMPL}
        onSlideUpdate={vi.fn()}
        onSlidePreview={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('caption-bar-controls')).toBeNull()
  })

  it('height slider: change previews, pointerUp commits (KBD-09 one undo per gesture)', () => {
    const onSlideUpdate = vi.fn()
    const onSlidePreview = vi.fn()
    render(
      <CaptionBarControls
        slide={makeSlide()}
        template={BOTTOM_CARD_TMPL}
        onSlideUpdate={onSlideUpdate}
        onSlidePreview={onSlidePreview}
      />,
    )
    const slider = screen.getByTestId('caption-bar-height')
    fireEvent.change(slider, { target: { value: '50' } })
    expect(onSlidePreview).toHaveBeenCalledWith({
      style_overrides: expect.objectContaining({ caption_bar_height_pct: 50 }),
    })
    expect(onSlideUpdate).not.toHaveBeenCalled()
    fireEvent.pointerUp(slider)
    expect(onSlideUpdate).toHaveBeenCalledTimes(1)
    expect(onSlideUpdate).toHaveBeenCalledWith({
      style_overrides: expect.objectContaining({ caption_bar_height_pct: 50 }),
    })
  })

  it('color picker emits an explicit hex string (PCL12)', () => {
    const onSlideUpdate = vi.fn()
    render(
      <CaptionBarControls
        slide={makeSlide()}
        template={BOTTOM_CARD_TMPL}
        onSlideUpdate={onSlideUpdate}
        onSlidePreview={vi.fn()}
      />,
    )
    const colorInput = screen.getByTestId('caption-bar-color')
    fireEvent.change(colorInput, { target: { value: '#3d0000' } })
    expect(onSlideUpdate).toHaveBeenCalledTimes(1)
    const patch = onSlideUpdate.mock.calls[0][0]
    expect(patch.style_overrides.caption_bar_color).toBe('#3d0000')
    expect(patch.style_overrides.caption_bar_color.startsWith('#')).toBe(true)
  })

  it('clicking the Top position button emits caption_bar_position: top', () => {
    const onSlideUpdate = vi.fn()
    render(
      <CaptionBarControls
        slide={makeSlide()}
        template={BOTTOM_CARD_TMPL}
        onSlideUpdate={onSlideUpdate}
        onSlidePreview={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('caption-bar-position-top'))
    expect(onSlideUpdate).toHaveBeenCalledWith({
      style_overrides: expect.objectContaining({ caption_bar_position: 'top' }),
    })
  })

  it('opacity slider preview emits a 0..1 caption_bar_opacity', () => {
    const onSlidePreview = vi.fn()
    render(
      <CaptionBarControls
        slide={makeSlide()}
        template={BOTTOM_CARD_TMPL}
        onSlideUpdate={vi.fn()}
        onSlidePreview={onSlidePreview}
      />,
    )
    const slider = screen.getByTestId('caption-bar-opacity')
    fireEvent.change(slider, { target: { value: '60' } })
    expect(onSlidePreview).toHaveBeenCalledWith({
      style_overrides: expect.objectContaining({ caption_bar_opacity: 0.6 }),
    })
  })
})

describe('UPDATE_SLIDE noHistory channel', () => {
  function makeState(slides: Slide[]): EditorHistory {
    return { past: [], present: slides, future: [] }
  }

  it('a plain UPDATE_SLIDE grows the past array by one', () => {
    const state = makeState([makeSlide()])
    const next = editorReducer(state, {
      type: 'UPDATE_SLIDE',
      index: 0,
      updates: { style_overrides: { caption_bar_height_pct: 50 } },
    })
    expect(next.past.length).toBe(1)
    expect(next.present[0].style_overrides?.caption_bar_height_pct).toBe(50)
  })

  it('UPDATE_SLIDE with noHistory:true does NOT grow the past array', () => {
    const state = makeState([makeSlide()])
    const next = editorReducer(state, {
      type: 'UPDATE_SLIDE',
      index: 0,
      updates: { style_overrides: { caption_bar_height_pct: 50 } },
      noHistory: true,
    })
    expect(next.past.length).toBe(0)
    expect(next.present[0].style_overrides?.caption_bar_height_pct).toBe(50)
  })
})
