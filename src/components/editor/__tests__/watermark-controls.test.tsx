import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WatermarkControls } from '../watermark-controls'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

/**
 * quick-260502-er5: watermark-controls component unit tests.
 * Asserts tier gating (free locked, paid functional), upload button
 * behavior, position picker visibility, and custom-logo preview state.
 */

function makeSlide(watermark?: NonNullable<SlideStyleOverrides['watermark']>): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: 'https://example.com/photo.png',
    pexels_photo_id: null,
    ...(watermark ? { style_overrides: { watermark } } : {}),
  }
}

describe('WatermarkControls — tier gating', () => {
  it('free tier: Switch is disabled and a Pro chip + upgrade hint render', () => {
    const onChange = vi.fn()
    render(
      <WatermarkControls
        slide={makeSlide()}
        userTier="free"
        isPending={false}
        onWatermarkChange={onChange}
        onCustomLogoUpload={vi.fn()}
        onCustomLogoRemove={vi.fn()}
      />,
    )

    // Pro chip visible
    expect(screen.getByText('Pro')).toBeTruthy()
    // Upgrade hint visible
    expect(screen.getByText(/Upgrade to Pro to remove the ViralSlideMaker watermark/i)).toBeTruthy()
    // Switch is disabled
    const switchEl = screen.getByRole('switch')
    expect((switchEl as HTMLButtonElement).disabled).toBe(true)
  })

  it('free tier: position picker NOT rendered', () => {
    const { container } = render(
      <WatermarkControls
        slide={makeSlide()}
        userTier="free"
        isPending={false}
        onWatermarkChange={vi.fn()}
      />,
    )
    expect(container.querySelector('[role="radiogroup"]')).toBeFalsy()
  })

  it('free tier: upload button NOT rendered', () => {
    render(
      <WatermarkControls
        slide={makeSlide()}
        userTier="free"
        isPending={false}
        onWatermarkChange={vi.fn()}
        onCustomLogoUpload={vi.fn()}
      />,
    )
    expect(screen.queryByText(/Upload logo/i)).toBeNull()
  })

  it('free tier: clicking the disabled switch does NOT fire onWatermarkChange', () => {
    const onChange = vi.fn()
    render(
      <WatermarkControls
        slide={makeSlide()}
        userTier="free"
        isPending={false}
        onWatermarkChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('paid (pro) tier: Switch is enabled, no Pro chip, no upgrade hint', () => {
    render(
      <WatermarkControls
        slide={makeSlide()}
        userTier="pro"
        isPending={false}
        onWatermarkChange={vi.fn()}
        onCustomLogoUpload={vi.fn()}
      />,
    )
    expect(screen.queryByText('Pro')).toBeNull()
    expect(screen.queryByText(/Upgrade to Pro to remove/i)).toBeNull()
    const switchEl = screen.getByRole('switch')
    expect((switchEl as HTMLButtonElement).disabled).toBe(false)
  })

  it('paid (plus) tier with watermark enabled: position picker visible', () => {
    const { container } = render(
      <WatermarkControls
        slide={makeSlide({ enabled: true })}
        userTier="plus"
        isPending={false}
        onWatermarkChange={vi.fn()}
      />,
    )
    const radiogroup = container.querySelector('[role="radiogroup"]')
    expect(radiogroup).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Bottom Left/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Bottom Right/i })).toBeTruthy()
  })

  it('paid tier: clicking position fires onWatermarkChange with that position', () => {
    const onChange = vi.fn()
    render(
      <WatermarkControls
        slide={makeSlide({ enabled: true })}
        userTier="pro"
        isPending={false}
        onWatermarkChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /Bottom Right/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ position: 'bottom-right' }),
    )
  })

  it('paid tier: clicking the switch fires onWatermarkChange with enabled toggled', () => {
    const onChange = vi.fn()
    render(
      <WatermarkControls
        slide={makeSlide()}
        userTier="pro"
        isPending={false}
        onWatermarkChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    )
  })

  it('paid tier with no custom logo: Upload logo button rendered', () => {
    render(
      <WatermarkControls
        slide={makeSlide()}
        userTier="pro"
        isPending={false}
        onWatermarkChange={vi.fn()}
        onCustomLogoUpload={vi.fn()}
      />,
    )
    expect(screen.getByText(/Upload logo/i)).toBeTruthy()
  })

  it('paid tier with custom logo: preview img + Remove button rendered', () => {
    render(
      <WatermarkControls
        slide={makeSlide({ customLogoUrl: 'https://cdn.example.com/logo.png' })}
        userTier="pro"
        isPending={false}
        onWatermarkChange={vi.fn()}
        onCustomLogoUpload={vi.fn()}
        onCustomLogoRemove={vi.fn()}
      />,
    )
    const img = screen.getByAltText(/Custom watermark logo/i) as HTMLImageElement
    expect(img.src).toContain('cdn.example.com/logo.png')
    expect(screen.getByText(/Remove/i)).toBeTruthy()
    // Upload button NOT rendered when a logo is already set
    expect(screen.queryByText(/Upload logo/i)).toBeNull()
  })

  it('paid tier: clicking Remove fires onCustomLogoRemove', () => {
    const onRemove = vi.fn()
    render(
      <WatermarkControls
        slide={makeSlide({ customLogoUrl: 'https://cdn.example.com/logo.png' })}
        userTier="pro"
        isPending={false}
        onWatermarkChange={vi.fn()}
        onCustomLogoRemove={onRemove}
      />,
    )
    fireEvent.click(screen.getByText(/Remove/i))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('isPending=true renders the Saving… spinner row', () => {
    render(
      <WatermarkControls
        slide={makeSlide()}
        userTier="pro"
        isPending={true}
        onWatermarkChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/Saving…/i)).toBeTruthy()
  })
})
