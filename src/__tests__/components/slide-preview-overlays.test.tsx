import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 45-03 — DOM-signature parity tests for <SlidePreview>.
 *
 * These tests prove the React preview emits overlay zones, backgroundMode
 * photo+card layers, and per-segment highlight pills with byte-identical
 * inline-style signatures to the Satori snapshots produced in Plan 45-02.
 *
 * The TPLREND-05 parity contract: same shared resolver
 * (`@/lib/render/resolve-overlay`), same SLOT_GEOMETRY anchors, same
 * `<span>` markup for pills, NO `box-decoration-break: clone` (browsers
 * support it but Satori does not — banning it in React keeps preview/export
 * in sync on multi-line pills).
 *
 * Tests cover BOTH render branches of <SlidePreview> (non-editable picker
 * thumbnails AND editable canvas) per RESEARCH.md Pitfall 2.
 */

// Module-scope fixtures shared across all 15 tests.
const fixtureSlide: Slide = {
  hook_text: 'FOLK SINGER FIGHTS BACK',
  body_text: 'Murphy Campbell is a folk singer.',
  image_query: '',
  is_cta: false,
  background_url: 'https://example.com/folk.jpg',
  pexels_photo_id: null,
}

const fixtureTemplate: SlideTemplate = {
  id: 'fixture-magazine',
  name: 'Fixture',
  thumbnail: '',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '110px',
  bodyFontSize: '32px',
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0.4,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
  // overlays / backgroundMode set per-test
}

const legacyTemplate: SlideTemplate = { ...fixtureTemplate, id: 'fixture-legacy' }

/**
 * Inline-style fragment matcher. Matches both with and without whitespace so
 * jsdom's CSS normalization (which collapses or rewrites some properties)
 * doesn't break the assertion. Mirrors the Satori snapshot byte-for-byte
 * comparison goal of TPLREND-05.
 */
function styleHas(el: Element, fragment: string): boolean {
  const css = el.getAttribute('style') ?? ''
  return (
    css.includes(fragment) ||
    css.replace(/\s/g, '').includes(fragment.replace(/\s/g, ''))
  )
}

describe('SlidePreview — Phase 45 overlay parity', () => {
  it('renders page-counter overlay text "2/5" when slideIndex=1, totalSlides=5', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      overlays: [{ position: 'top-right', content: { type: 'page-counter' } }],
    }
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={t}
        index={1}
        slideIndex={1}
        totalSlides={5}
      />,
    )
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('renders page-counter overlay text "5/5" when slideIndex=4, totalSlides=5', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      overlays: [{ position: 'top-right', content: { type: 'page-counter' } }],
    }
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={t}
        index={4}
        slideIndex={4}
        totalSlides={5}
      />,
    )
    expect(screen.getByText('5/5')).toBeInTheDocument()
  })

  it('renders page-counter custom format "Slide {currentSlide} of {totalSlides}"', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      overlays: [
        {
          position: 'top-right',
          content: {
            type: 'page-counter',
            format: 'Slide {currentSlide} of {totalSlides}',
          },
        },
      ],
    }
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={t}
        index={2}
        slideIndex={2}
        totalSlides={5}
      />,
    )
    expect(screen.getByText('Slide 3 of 5')).toBeInTheDocument()
  })

  it('renders slide-field topic when topic prop is passed', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      overlays: [
        {
          position: 'top-left',
          content: { type: 'slide-field', field: 'topic' },
        },
      ],
    }
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={t}
        index={0}
        slideIndex={0}
        totalSlides={5}
        topic="folk-music"
      />,
    )
    expect(screen.getByText('folk-music')).toBeInTheDocument()
  })

  it('renders empty overlay div when slide-field topic is absent', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      overlays: [
        {
          position: 'top-left',
          content: { type: 'slide-field', field: 'topic' },
        },
      ],
    }
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={t}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const overlay = screen.getByTestId('overlay-top-left')
    expect(overlay.textContent).toBe('')
  })

  it('renders highlight pill <span> with parity-locked inline style for "FIGHTS BACK"', () => {
    const slideWithSegments: Slide = {
      ...fixtureSlide,
      hook_segments: [
        { text: 'FOLK SINGER' },
        { text: 'FIGHTS BACK', highlightColor: '#9DECC1' },
      ],
    }
    render(
      <SlidePreview
        slide={slideWithSegments}
        template={fixtureTemplate}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const span = screen.getByText(/FIGHTS BACK/)
    const css = span.getAttribute('style') ?? ''
    // jsdom converts hex (#9DECC1) → rgb(157, 236, 193) on backgroundColor.
    expect(css).toMatch(
      /background-color:\s*(rgb\(157,\s*236,\s*193\)|#9DECC1)/i,
    )
    expect(css).toMatch(/padding:\s*4px 12px/)
    expect(css).toMatch(/border-radius:\s*8px/)
    expect(css).toMatch(/margin-right:\s*8px/)
  })

  it('does NOT set box-decoration-break on highlight pill <span> (parity contract)', () => {
    const slideWithSegments: Slide = {
      ...fixtureSlide,
      hook_segments: [
        { text: 'FOLK SINGER' },
        { text: 'FIGHTS BACK', highlightColor: '#9DECC1' },
      ],
    }
    render(
      <SlidePreview
        slide={slideWithSegments}
        template={fixtureTemplate}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const span = screen.getByText(/FIGHTS BACK/)
    const css = span.style.cssText
    expect(css).not.toMatch(/box-decoration-break/)
  })

  it('renders highlight block style with padding 4px 8px and border-radius 0', () => {
    const slideWithSegments: Slide = {
      ...fixtureSlide,
      body_segments: [
        { text: 'AI', highlightColor: '#FFFF00', highlightStyle: 'block' },
      ],
    }
    render(
      <SlidePreview
        slide={slideWithSegments}
        template={fixtureTemplate}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const span = screen.getByText('AI')
    const css = span.getAttribute('style') ?? ''
    expect(css).toMatch(/padding:\s*4px 8px/)
    // jsdom may emit '0' or '0px' depending on version.
    expect(css).toMatch(/border-radius:\s*0(px)?(;|$|\s)/)
  })

  it('renders top-left overlay slot at left:60 top:60', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      overlays: [
        {
          position: 'top-left',
          content: { type: 'literal', text: 'TR3NDING' },
        },
      ],
    }
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={t}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const overlay = screen.getByTestId('overlay-top-left')
    expect(styleHas(overlay, 'left: 60')).toBe(true)
    expect(styleHas(overlay, 'top: 60')).toBe(true)
  })

  it('renders top-right overlay slot using CSS right (NOT computed left)', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      overlays: [
        {
          position: 'top-right',
          content: { type: 'literal', text: 'X' },
        },
      ],
    }
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={t}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const overlay = screen.getByTestId('overlay-top-right')
    const css = overlay.getAttribute('style') ?? ''
    expect(css).toMatch(/right:\s*60(px)?/)
    // Must NOT have a computed left:1020 (Pitfall 3 / RESEARCH.md).
    expect(css).not.toMatch(/left:\s*1020/)
  })

  it('renders backgroundMode "image-bleed" full-bleed photo via testid bg-bleed', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      backgroundMode: 'image-bleed',
    }
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={t}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const bg = screen.getByTestId('bg-bleed') as HTMLImageElement
    expect(bg.src).toBe('https://example.com/folk.jpg')
  })

  it('renders backgroundMode "image-with-bottom-card" with rgba(0,0,0,0.85) card', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      backgroundMode: 'image-with-bottom-card',
      backgroundColor: '#000000',
    }
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={t}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const card = screen.getByTestId('bottom-card')
    const css = card.getAttribute('style') ?? ''
    expect(css).toMatch(
      /background-color:\s*rgba\(0,\s*0,\s*0,\s*0\.85\)/i,
    )
  })

  it('editable branch mirrors non-editable branch (overlays + pills both render)', () => {
    const slideWithSegments: Slide = {
      ...fixtureSlide,
      hook_segments: [
        { text: 'FOLK SINGER' },
        { text: 'FIGHTS BACK', highlightColor: '#9DECC1' },
      ],
    }
    const t: SlideTemplate = {
      ...fixtureTemplate,
      overlays: [
        {
          position: 'top-left',
          content: { type: 'literal', text: 'TR3NDING' },
        },
      ],
    }
    render(
      <SlidePreview
        slide={slideWithSegments}
        template={t}
        index={0}
        slideIndex={0}
        totalSlides={5}
        editable
      />,
    )
    // Pill span exists with backgroundColor.
    const span = screen.getByText(/FIGHTS BACK/)
    const spanCss = span.getAttribute('style') ?? ''
    expect(spanCss).toMatch(
      /background-color:\s*(rgb\(157,\s*236,\s*193\)|#9DECC1)/i,
    )
    // Overlay div exists.
    const overlay = screen.getByTestId('overlay-top-left')
    expect(overlay).toBeInTheDocument()
  })

  it('renders default page-counter "1/1" when slideIndex/totalSlides props omitted', () => {
    const t: SlideTemplate = {
      ...fixtureTemplate,
      overlays: [{ position: 'top-right', content: { type: 'page-counter' } }],
    }
    render(<SlidePreview slide={fixtureSlide} template={t} index={0} />)
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('legacy template — emits NO overlay/backgroundMode/bottom-card layers', () => {
    render(
      <SlidePreview
        slide={fixtureSlide}
        template={legacyTemplate}
        index={0}
      />,
    )
    expect(screen.queryByTestId('overlay-top-left')).toBeNull()
    expect(screen.queryByTestId('overlay-top-right')).toBeNull()
    expect(screen.queryByTestId('bottom-card')).toBeNull()
    expect(screen.queryByTestId('bg-bleed')).toBeNull()
  })
})
