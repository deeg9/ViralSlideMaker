import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplatePicker } from '@/components/slides/template-picker'
import { templates } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'

/**
 * Phase 48-01 — TPLTHUMB-02 regression test.
 *
 * Locks the picker against future regressions where a template might
 * silently fall back to a swatch / text-only label instead of rendering
 * via <SlidePreview> + makeSampleSlide.
 *
 * Polyfills: relies on src/__tests__/setup.ts (ResizeObserver +
 * getBoundingClientRect 1080x1920 fallback) so SlidePreview can compute
 * its scale and render its inner DOM (testid: 'slide-preview').
 */

describe('<TemplatePicker> TPLTHUMB-02 parity', () => {
  it('renders exactly 8 SlidePreview tiles for the templates list when brandKit is null', () => {
    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
        brandKit={null}
      />,
    )
    // brandKit=null -> empty-state link in slot 0 (NOT a SlidePreview).
    // Templates iteration -> exactly 8 SlidePreview instances.
    const previews = screen.getAllByTestId('slide-preview')
    expect(previews.length).toBe(templates.length)
    expect(templates.length).toBe(8) // schema invariant - guards against future drift
  })

  it('renders exactly 9 SlidePreview tiles when brandKit is configured (8 templates + brand-kit tile)', () => {
    const configuredBrandKit: BrandKit = {
      // Minimum fields for isBrandKitConfigured() to return true:
      //   hasColors -> background_color + text_color, OR
      //   hasFont   -> body_font_family / heading_font_family / font_family
      background_color: '#3d0000',
      text_color: '#ffffff',
      accent_color: null,
      body_font_family: 'Inter',
      heading_font_family: 'Anton',
      font_family: null,
      // The remaining BrandKit fields are optional for the picker -
      // the test only needs isBrandKitConfigured() to pass.
    } as unknown as BrandKit

    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
        brandKit={configuredBrandKit}
      />,
    )
    const previews = screen.getAllByTestId('slide-preview')
    // templates.length + 1 brand-kit tile = total SlidePreview instances.
    expect(previews.length).toBe(templates.length + 1)
  })

  it('shows brand-kit empty-state link (not a SlidePreview) when brandKit is null', () => {
    render(
      <TemplatePicker
        selectedId="bold-yellow"
        onSelect={vi.fn()}
        brandKit={null}
      />,
    )
    // Empty-state copy lives in the dashed-border anchor; it should NOT
    // be wrapped in a SlidePreview. The string is split across a <br />,
    // so a regex match against just the first text node is the safe check.
    expect(screen.getByText(/Build your/i)).toBeInTheDocument()
  })

  it('renders a "Selected" indicator on the active template tile', () => {
    render(
      <TemplatePicker
        selectedId="magazine-bold"
        onSelect={vi.fn()}
        brandKit={null}
      />,
    )
    // At least one tile must be in the Selected state.
    expect(screen.getAllByText(/Selected/i).length).toBeGreaterThanOrEqual(1)
  })
})
