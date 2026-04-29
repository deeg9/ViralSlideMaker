import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 46-02 — DOM-signature parity tests for the 3 NEW premium templates
 * rendered through <SlidePreview>.
 *
 * These tests prove the React preview emits the right overlay zones,
 * backgroundMode photo+card layers, and per-segment highlight pills with
 * byte-identical inline-style signatures to the Satori snapshots produced
 * in Plan 46-02 Task 1 (`premium-templates.test.tsx`).
 *
 * The TPLREND-05 parity contract: same shared resolver, same SLOT_GEOMETRY
 * anchors, same `<span>` markup for pills, NO `box-decoration-break: clone`.
 *
 * Polyfills: relies on `src/__tests__/setup.ts` ResizeObserver +
 * getBoundingClientRect stubs (added in Plan 45-03). Do NOT modify setup.ts.
 */

// styleHas helper — whitespace-tolerant CSS fragment matcher (per Plan 45-03)
function styleHas(el: Element, fragment: string): boolean {
  const css = el.getAttribute('style') ?? ''
  return (
    css.includes(fragment) ||
    css.replace(/\s/g, '').includes(fragment.replace(/\s/g, ''))
  )
}

// jsdom converts hex color literals (e.g. `#A8E0B0`) to `rgb(168, 224, 176)`
// when they're set as inline-style values on background / background-color /
// color. The byte-identical Satori snapshot keeps the hex; the React preview
// emits the rgb form. Both ARE the same color — this helper accepts either,
// matching the pattern already used in slide-preview-overlays.test.tsx
// (Plan 45-03, line 193).
function styleHasColor(el: Element, hex: string): boolean {
  const css = el.getAttribute('style') ?? ''
  if (css.toLowerCase().includes(hex.toLowerCase())) return true
  // Convert 6-digit hex → rgb(r, g, b)
  const h = hex.replace('#', '')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const rgb = `rgb(${r}, ${g}, ${b})`
  return css.includes(rgb) || css.replace(/\s/g, '').includes(rgb.replace(/\s/g, ''))
}

// Module-scope fixture — overridden per-test from each template's sample
function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'PLACEHOLDER',
    body_text: 'PLACEHOLDER',
    image_query: '',
    is_cta: false,
    background_url: 'https://example.com/photo.jpg',
    pexels_photo_id: null,
    ...overrides,
  }
}

describe('Phase 46 premium templates — <SlidePreview> DOM signature parity', () => {
  // ---- magazine-bold (5 tests) ----

  it('magazine-bold: renders top-left mint chip with topic text', () => {
    const template = getTemplate('magazine-bold')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
      hook_segments: template.sample!.hook_segments,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
        topic="folk-music"
      />,
    )
    const chip = screen.getByTestId('overlay-top-left')
    expect(chip.textContent).toBe('folk-music')
    expect(styleHasColor(chip, '#A8E0B0')).toBe(true)
    expect(styleHasColor(chip, '#000000')).toBe(true)
  })

  it('magazine-bold: renders top-right counter "1/5" with rgba(0,0,0,0.6) background', () => {
    const template = getTemplate('magazine-bold')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
        topic="folk-music"
      />,
    )
    const counter = screen.getByTestId('overlay-top-right')
    expect(counter.textContent).toBe('1/5')
    expect(styleHas(counter, 'rgba(0,0,0,0.6)') || styleHas(counter, 'rgba(0, 0, 0, 0.6)')).toBe(true)
  })

  it('magazine-bold: renders bottom-card with rgba(0,0,0,0.85) backgroundMode=image-with-bottom-card', () => {
    const template = getTemplate('magazine-bold')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
        topic="folk-music"
      />,
    )
    const bottomCard = screen.getByTestId('bottom-card')
    expect(bottomCard).toBeInTheDocument()
    expect(styleHas(bottomCard, 'rgba(0, 0, 0, 0.85)') || styleHas(bottomCard, 'rgba(0,0,0,0.85)')).toBe(true)
  })

  it('magazine-bold: renders mint pill <span> on FIGHTS BACK and CLONED HER VOICE segments with parity-locked style', () => {
    const template = getTemplate('magazine-bold')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
      hook_segments: template.sample!.hook_segments,
    })
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
        topic="folk-music"
      />,
    )
    const allSpans = container.querySelectorAll('span')
    const mintSpans = Array.from(allSpans).filter((s) => styleHasColor(s, '#A8E0B0'))
    // Two render branches × two pill segments = up to 4; minimum 2 from at least one branch
    expect(mintSpans.length).toBeGreaterThanOrEqual(2)
    // Parity-locked signature: 4×12 padding + 8px borderRadius
    const signaturePill = mintSpans.find((s) => styleHas(s, 'padding: 4px 12px') && styleHas(s, 'border-radius: 8px'))
    expect(signaturePill).toBeDefined()
    // No box-decoration-break — locked parity contract
    expect(styleHas(signaturePill!, 'box-decoration-break')).toBe(false)
  })

  it('magazine-bold: NO free-slot gradient overlay (only top-left + top-right declared)', () => {
    const template = getTemplate('magazine-bold')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
        topic="folk-music"
      />,
    )
    expect(screen.queryByTestId('overlay-free')).toBeNull()
  })

  // ---- tr3nding-news (4 tests) ----

  it('tr3nding-news: renders mid-pill TR3NDING with black bg + mint text + 40px borderRadius', () => {
    const template = getTemplate('tr3nding-news')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
      hook_segments: template.sample!.hook_segments,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const midPill = screen.getByTestId('overlay-mid')
    expect(midPill.textContent).toBe('TR3NDING')
    expect(styleHasColor(midPill, '#000000')).toBe(true)
    expect(styleHasColor(midPill, '#A8E0B0')).toBe(true)
    expect(styleHas(midPill, 'border-radius: 40px')).toBe(true)
  })

  it('tr3nding-news: renders top-right counter (sibling cohesion with magazine-bold)', () => {
    const template = getTemplate('tr3nding-news')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={2}
        slideIndex={2}
        totalSlides={5}
      />,
    )
    const counter = screen.getByTestId('overlay-top-right')
    expect(counter.textContent).toBe('3/5')
  })

  it('tr3nding-news: NO top-left chip — locked exclusion (mid-pill is the visual identity)', () => {
    const template = getTemplate('tr3nding-news')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    expect(screen.queryByTestId('overlay-top-left')).toBeNull()
  })

  it('tr3nding-news: renders mint pill spans on $50M and 12 MINUTES segments', () => {
    const template = getTemplate('tr3nding-news')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
      hook_segments: template.sample!.hook_segments,
    })
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const mintSpans = Array.from(container.querySelectorAll('span')).filter((s) => styleHasColor(s, '#A8E0B0'))
    expect(mintSpans.length).toBeGreaterThanOrEqual(2)
  })

  // ---- documentary (4 tests) ----

  it('documentary: renders bg-bleed full-bleed photo (image-bleed mode)', () => {
    const template = getTemplate('documentary')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    expect(screen.getByTestId('bg-bleed')).toBeInTheDocument()
  })

  it('documentary: NO bottom-card — image-bleed mode locks this', () => {
    const template = getTemplate('documentary')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    expect(screen.queryByTestId('bottom-card')).toBeNull()
  })

  it('documentary: renders ghosted top-right counter with transparent background', () => {
    const template = getTemplate('documentary')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const counter = screen.getByTestId('overlay-top-right')
    expect(counter.textContent).toBe('1/5')
    expect(styleHas(counter, 'background: transparent') || styleHas(counter, 'background-color: transparent')).toBe(true)
  })

  it('documentary: renders free-slot gradient overlay with linear-gradient string', () => {
    const template = getTemplate('documentary')
    const slide = makeSlide({
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    })
    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const gradient = screen.getByTestId('overlay-free')
    expect(styleHas(gradient, 'linear-gradient')).toBe(true)
    expect(styleHas(gradient, 'rgba(0, 0, 0, 0.85)') || styleHas(gradient, 'rgba(0,0,0,0.85)')).toBe(true)
  })
})
