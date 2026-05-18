import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildSlideHtml } from '@/lib/render/render-slide'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { SlidePreview } from '@/components/slides/slide-preview'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * quick-260517-h8z — render-parity suite for the `background_color` override.
 *
 * quick-260518-8o0 UPDATE: the news-layout black headline backdrop is now a
 * caption card, and the news photo is a full-bleed background (identical to the
 * non-news path). `background_color` is KEPT but its role narrowed — it is now
 * the RAW slide background, only visible when there is NO photo (a full-bleed
 * photo paints over it). This suite therefore exercises `background_color` on a
 * PHOTO-LESS news-layout slide (where the raw background is actually visible)
 * and the OLD `news_image_height` suite is removed (the override is retired —
 * the news photo no longer has a movable photo/caption boundary).
 *
 * `style_overrides.background_color` is an optional hex override resolved
 * IDENTICALLY in all three render paths (canvas / Satori PNG / HTML) via
 * `overrides.background_color ?? template.backgroundColor`. The TPLREND-05
 * byte-identity contract: a slide WITHOUT the override renders exactly
 * `template.backgroundColor`. Mirrors the `overlay_color` precedent
 * (quick-260515-overlay-color-picker).
 */

// ---------------------------------------------------------------------------
// Fixtures — a news-carousel `cover` slide with NO photo, so the raw slide
// background_color is the visible backdrop (the production scenario for the
// `background_color` control after the quick-260518-8o0 full-bleed change).
// ---------------------------------------------------------------------------

const newsTemplate: SlideTemplate = {
  id: 'fixture-news',
  name: 'Fixture News',
  thumbnail: '',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '110px',
  bodyFontSize: '32px',
  textColor: '#111111',
  backgroundColor: '#FFEE00', // the legacy "yellow panel" default
  overlayColor: '#000000',
  overlayOpacity: 0.4,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
}

// No background_url — the raw slide background is the visible backdrop.
const coverSlideBase: Slide = {
  hook_text: 'NVIDIA CHIP SALES TO CHINA',
  body_text: 'A colored panel sits behind the headline.',
  image_query: '',
  is_cta: false,
  background_url: null,
  pexels_photo_id: null,
  style_overrides: { layout: 'cover' },
}

const OVERRIDE_HEX = '#3D6BE5'

const slideWithOverride: Slide = {
  ...coverSlideBase,
  style_overrides: { layout: 'cover', background_color: OVERRIDE_HEX },
}

// Recursive element-tree flatten (mirrors render-slide-satori.test.tsx walk()).
function walk(node: unknown): unknown[] {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) {
    const out: unknown[] = []
    for (const k of node) out.push(...walk(k))
    return out
  }
  const out: unknown[] = [node]
  const kids = (node as { props?: { children?: unknown } }).props?.children
  if (Array.isArray(kids)) {
    for (const k of kids) out.push(...walk(k))
  } else if (kids != null) {
    out.push(...walk(kids))
  }
  return out
}
function styleOf(node: unknown): Record<string, unknown> | null {
  return (node as { props?: { style?: Record<string, unknown> } }).props?.style ?? null
}

// hex → rgb() — jsdom normalizes inline backgroundColor hex to rgb().
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

// ---------------------------------------------------------------------------
// HTML render path — render-slide.ts
// ---------------------------------------------------------------------------

describe('background_color override — HTML render (render-slide.ts)', () => {
  it('byte-identity (TPLREND-05): no override → template.backgroundColor', () => {
    const html = buildSlideHtml(coverSlideBase, newsTemplate)
    expect(html).toContain(`background-color: ${newsTemplate.backgroundColor}`)
    expect(html).not.toContain(`background-color: ${OVERRIDE_HEX}`)
  })

  it('honors style_overrides.background_color on a photo-less news-cover slide', () => {
    const html = buildSlideHtml(slideWithOverride, newsTemplate)
    expect(html).toContain(`background-color: ${OVERRIDE_HEX}`)
    expect(html).not.toContain(`background-color: ${newsTemplate.backgroundColor}`)
  })
})

// ---------------------------------------------------------------------------
// Satori PNG render path — render-slide-satori.tsx
// ---------------------------------------------------------------------------

describe('background_color override — Satori PNG render (render-slide-satori.tsx)', () => {
  it('byte-identity (TPLREND-05): no override → rootStyle.backgroundColor = template default', () => {
    const element = buildSlideElement(
      coverSlideBase,
      newsTemplate,
      null,
      'free',
      'http://localhost',
    )
    const rootStyle = styleOf(element)
    expect(rootStyle?.backgroundColor).toBe(newsTemplate.backgroundColor)
  })

  it('honors style_overrides.background_color on a photo-less news-cover slide', () => {
    const element = buildSlideElement(
      slideWithOverride,
      newsTemplate,
      null,
      'free',
      'http://localhost',
    )
    const rootStyle = styleOf(element)
    expect(rootStyle?.backgroundColor).toBe(OVERRIDE_HEX)
  })
})

// ---------------------------------------------------------------------------
// Editor canvas render path — slide-preview.tsx
// ---------------------------------------------------------------------------

describe('background_color override — editor canvas (slide-preview.tsx)', () => {
  it('byte-identity (TPLREND-05): no override → inner div backgroundColor = template default', () => {
    render(
      <SlidePreview
        slide={coverSlideBase}
        template={newsTemplate}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const inner = screen.getByTestId('slide-preview').firstElementChild as HTMLElement
    expect(inner.style.backgroundColor).toBe(hexToRgb(newsTemplate.backgroundColor))
  })

  it('honors style_overrides.background_color on a photo-less news-cover slide', () => {
    render(
      <SlidePreview
        slide={slideWithOverride}
        template={newsTemplate}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    const inner = screen.getByTestId('slide-preview').firstElementChild as HTMLElement
    expect(inner.style.backgroundColor).toBe(hexToRgb(OVERRIDE_HEX))
  })
})

// ===========================================================================
// quick-260518-8o0 — the news-layout photo is now FULL-BLEED.
//
// The old `news_image_height` override (quick-260517-iiy) is retired: the news
// photo has no movable photo/caption boundary anymore — it is a permanent
// full-bleed background. These cases pin the new behavior across all 3 paths.
// ===========================================================================

const coverSlideWithPhoto: Slide = {
  ...coverSlideBase,
  background_url: 'https://example.com/circuit-board.jpg',
}

describe('quick-260518-8o0 — news photo is full-bleed', () => {
  it('HTML: a news-cover slide with a photo emits a full-bleed CSS background-image', () => {
    const html = buildSlideHtml(coverSlideWithPhoto, newsTemplate)
    expect(html).toContain(
      "background-image: url('https://example.com/circuit-board.jpg')",
    )
    // No constrained news <img> zone any more.
    expect(html).not.toContain('object-fit:cover; z-index:0;')
  })

  it('Satori: the news photo <img> is full-bleed (top:0, width 1080, height 1920)', () => {
    const element = buildSlideElement(
      coverSlideWithPhoto,
      newsTemplate,
      null,
      'free',
      'http://localhost',
    )
    const img = walk(element).find((n) => {
      const node = n as { type?: string; props?: { src?: string } }
      return node.type === 'img' && node.props?.src === coverSlideWithPhoto.background_url
    })
    expect(img).toBeDefined()
    const s = styleOf(img)!
    expect(s.top).toBe(0)
    expect(s.width).toBe(1080)
    expect(s.height).toBe(1920)
  })

  it('editor canvas: a news-cover photo renders full-bleed via CSS backgroundImage (no <img>)', () => {
    const { container } = render(
      <SlidePreview
        slide={coverSlideWithPhoto}
        template={newsTemplate}
        index={0}
        slideIndex={0}
        totalSlides={5}
      />,
    )
    // The constrained news <img> is gone — the photo is the inner div's CSS background.
    const img = Array.from(container.querySelectorAll('img')).find(
      (el) => el.getAttribute('src') === coverSlideWithPhoto.background_url,
    )
    expect(img).toBeUndefined()
    const inner = screen.getByTestId('slide-preview').firstElementChild as HTMLElement
    expect(inner.style.backgroundImage).toContain(coverSlideWithPhoto.background_url!)
  })
})
