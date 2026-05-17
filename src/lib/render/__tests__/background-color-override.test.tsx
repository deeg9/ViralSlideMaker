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
 * The user's "yellow panel" is the slide background color — visible on a
 * news-carousel `cover` layout where the photo is a constrained <img> covering
 * only the top 55%. `template.backgroundColor` paints the bottom ~45%.
 *
 * `style_overrides.background_color` is an optional hex override resolved
 * IDENTICALLY in all three render paths (canvas / Satori PNG / HTML) via
 * `overrides.background_color ?? template.backgroundColor`. The TPLREND-05
 * byte-identity contract: a slide WITHOUT the override must render exactly
 * `template.backgroundColor` — unchanged from before. Mirrors the
 * `overlay_color` precedent (quick-260515-overlay-color-picker).
 */

// ---------------------------------------------------------------------------
// Fixtures — a news-carousel `cover` slide (the exact production scenario).
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

const coverSlideBase: Slide = {
  hook_text: 'NVIDIA CHIP SALES TO CHINA',
  body_text: 'A constrained cover photo sits above a colored panel.',
  image_query: '',
  is_cta: false,
  background_url: 'https://example.com/circuit-board.jpg',
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
    expect(html).not.toContain(OVERRIDE_HEX)
  })

  it('honors style_overrides.background_color on a news-cover slide', () => {
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

  it('honors style_overrides.background_color on a news-cover slide', () => {
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

  it('honors style_overrides.background_color on a news-cover slide', () => {
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
