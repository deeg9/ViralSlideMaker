/**
 * quick-260517-fu9 — TextBackgroundControls extraction tests.
 *
 * The text-background ("highlight") color/style/padding control was an inner
 * `HighlightControls` component inside ActiveTextBoxCard. It is extracted here
 * so the Elements tab can mount the same control. These tests pin the four
 * behaviors the extracted component must keep verbatim — including the testids
 * and the `+ '88'` alpha-suffix convention the renderer depends on.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TextBackgroundControls } from '../text-background-controls'
import type { TextHighlightEffect } from '@/lib/types/slide'

const baseHighlight: TextHighlightEffect = {
  enabled: true,
  color: '#00000088',
  style: 'tight',
  padding: 8,
}

describe('quick-260517-fu9 — TextBackgroundControls', () => {
  it('renders the swatch color row with COLOR_SWATCHES + native palette opener', () => {
    const { container } = render(
      <TextBackgroundControls highlight={baseHighlight} onChange={vi.fn()} />,
    )
    const row = container.querySelector('[data-testid="highlight-color-row"]')
    expect(row).toBeTruthy()
    // 4 brand swatch buttons + 1 native color input opener
    expect(row?.querySelectorAll('button').length).toBe(4)
    expect(row?.querySelector('input[type="color"]')).toBeTruthy()
  })

  it('clicking a swatch calls onChange with the hex + 88 alpha suffix', () => {
    const onChange = vi.fn()
    const { container } = render(
      <TextBackgroundControls highlight={baseHighlight} onChange={onChange} />,
    )
    const firstSwatch = container.querySelector(
      '[data-testid="highlight-color-row"] button',
    ) as HTMLButtonElement
    fireEvent.click(firstSwatch)
    // first swatch is '#ffffff' → onChange({ color: '#ffffff88' })
    expect(onChange).toHaveBeenCalledWith({ color: '#ffffff88' })
  })

  it('clicking the style toggle calls onChange with the chosen style', () => {
    const onChange = vi.fn()
    const { container } = render(
      <TextBackgroundControls highlight={baseHighlight} onChange={onChange} />,
    )
    const fullBtn = container.querySelector(
      '[data-testid="highlight-style-full"]',
    ) as HTMLButtonElement
    fireEvent.click(fullBtn)
    expect(onChange).toHaveBeenCalledWith({ style: 'full' })
  })

  it('changing the padding range calls onChange with a numeric padding', () => {
    const onChange = vi.fn()
    const { container } = render(
      <TextBackgroundControls highlight={baseHighlight} onChange={onChange} />,
    )
    const padding = container.querySelector(
      '[data-testid="highlight-padding"]',
    ) as HTMLInputElement
    fireEvent.change(padding, { target: { value: '16' } })
    expect(onChange).toHaveBeenCalledWith({ padding: 16 })
  })
})
