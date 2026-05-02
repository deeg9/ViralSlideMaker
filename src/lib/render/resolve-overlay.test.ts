import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import {
  resolveOverlayContent,
  SLOT_GEOMETRY,
  CANVAS,
  renderSegments,
  bottomCardBackground,
  renderGrain,
  renderVignette,
} from './resolve-overlay'
import type { Slide } from '@/lib/types/slide'

// Reusable fixture matching Murphy reference shape.
const baseSlide: Slide = {
  hook_text: 'FOLK SINGER FIGHTS BACK',
  body_text: 'Murphy Campbell is a folk singer.',
  image_query: '',
  is_cta: false,
  background_url: null,
  pexels_photo_id: null,
}

const baseCtx = {
  slideIndex: 0,
  totalSlides: 5,
  topic: 'folk-music',
  slide: baseSlide,
}

describe('resolveOverlayContent', () => {
  it('literal: returns content.text verbatim regardless of ctx', () => {
    const result = resolveOverlayContent({ type: 'literal', text: 'TR3NDING' }, baseCtx)
    expect(result).toBe('TR3NDING')
  })

  it("page-counter (default format): returns '1/5' for slideIndex=0, totalSlides=5", () => {
    const result = resolveOverlayContent(
      { type: 'page-counter' },
      { slideIndex: 0, totalSlides: 5, slide: baseSlide },
    )
    expect(result).toBe('1/5')
  })

  it("page-counter (custom format): substitutes {currentSlide} and {totalSlides}", () => {
    const result = resolveOverlayContent(
      { type: 'page-counter', format: 'Slide {currentSlide} of {totalSlides}' },
      { slideIndex: 2, totalSlides: 5, slide: baseSlide },
    )
    expect(result).toBe('Slide 3 of 5')
  })

  it("page-counter slide N of N: returns '5/5' for slideIndex=4, totalSlides=5", () => {
    const result = resolveOverlayContent(
      { type: 'page-counter' },
      { slideIndex: 4, totalSlides: 5, slide: baseSlide },
    )
    expect(result).toBe('5/5')
  })

  it("slide-field topic present: returns ctx.topic", () => {
    const result = resolveOverlayContent(
      { type: 'slide-field', field: 'topic' },
      { slideIndex: 0, totalSlides: 5, topic: 'folk-music', slide: baseSlide },
    )
    expect(result).toBe('folk-music')
  })

  it("slide-field topic missing: returns empty string (graceful fallback)", () => {
    const result = resolveOverlayContent(
      { type: 'slide-field', field: 'topic' },
      { slideIndex: 0, totalSlides: 5, slide: baseSlide },
    )
    expect(result).toBe('')
  })

  it("slide-field hook_text: returns ctx.slide.hook_text", () => {
    const result = resolveOverlayContent(
      { type: 'slide-field', field: 'hook_text' },
      baseCtx,
    )
    expect(result).toBe('FOLK SINGER FIGHTS BACK')
  })

  it("slide-field body_text: returns ctx.slide.body_text", () => {
    const result = resolveOverlayContent(
      { type: 'slide-field', field: 'body_text' },
      baseCtx,
    )
    expect(result).toBe('Murphy Campbell is a folk singer.')
  })

  it("slide-field hook_text empty: returns '' (does not throw)", () => {
    const emptySlide: Slide = { ...baseSlide, hook_text: '' }
    const result = resolveOverlayContent(
      { type: 'slide-field', field: 'hook_text' },
      { slideIndex: 0, totalSlides: 5, slide: emptySlide },
    )
    expect(result).toBe('')
  })
})

describe('SLOT_GEOMETRY', () => {
  it('exposes exactly the 5 named slot keys', () => {
    expect(Object.keys(SLOT_GEOMETRY).sort()).toEqual([
      'bottom-card',
      'free',
      'mid',
      'top-left',
      'top-right',
    ])
  })

  it("top-left: { left: 60, top: 60 }", () => {
    expect(SLOT_GEOMETRY['top-left']).toEqual({ left: 60, top: 60 })
  })

  it("top-right: { right: 60, top: 60 } (CSS right, not computed left)", () => {
    expect(SLOT_GEOMETRY['top-right']).toEqual({ right: 60, top: 60 })
  })

  it("mid: horizontally centered at 55% top with translateX(-50%)", () => {
    const mid = SLOT_GEOMETRY['mid']
    expect(mid).toMatchObject({
      left: '50%',
      top: '55%',
      transform: 'translateX(-50%)',
    })
  })

  it("bottom-card: full-width × 38% height anchored bottom with 80px padding", () => {
    expect(SLOT_GEOMETRY['bottom-card']).toEqual({
      left: 0,
      right: 0,
      bottom: 0,
      height: '38%',
      padding: 80,
    })
  })

  it("free: null (no auto-positioning)", () => {
    expect(SLOT_GEOMETRY['free']).toBeNull()
  })
})

describe('CANVAS', () => {
  it('exposes 1080×1920 canvas constants', () => {
    expect(CANVAS.W).toBe(1080)
    expect(CANVAS.H).toBe(1920)
  })
})

describe('renderSegments', () => {
  it('no segments (undefined): returns the bare string', () => {
    const result = renderSegments('FALLBACK', undefined, '#fff', '#0f0')
    expect(result).toBe('FALLBACK')
  })

  it('empty segments array: returns the bare string', () => {
    const result = renderSegments('FALLBACK', [], '#fff', '#0f0')
    expect(result).toBe('FALLBACK')
  })

  it('accent only (no pill): emits color span without backgroundColor or borderRadius', () => {
    const node = renderSegments(
      'WORD',
      [{ text: 'WORD', accent: true }],
      '#FFFFFF',
      '#9DECC1',
    )
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node))
    // Accent color present (React serializes hex as either hex or rgb()).
    expect(html).toMatch(/color:\s*(?:#9DECC1|rgb\(157,\s*236,\s*193\))/i)
    // No pill artifacts.
    expect(html.toLowerCase()).not.toContain('background-color')
    expect(html.toLowerCase()).not.toContain('border-radius')
  })

  it("pill style (default): emits backgroundColor + 4px 12px padding + 8px borderRadius + 8px marginRight (when not last)", () => {
    const node = renderSegments(
      'FIGHTS BACK PUNCH',
      [
        { text: 'FIGHTS BACK', highlightColor: '#9DECC1' },
        { text: 'PUNCH', highlightColor: '#9DECC1' },
      ],
      '#FFFFFF',
      '#9DECC1',
    )
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node))
    expect(html).toMatch(/background-color:\s*(?:#9DECC1|rgb\(157,\s*236,\s*193\))/i)
    expect(html).toMatch(/padding:\s*4px\s+12px/i)
    expect(html).toMatch(/border-radius:\s*8px/i)
    // First segment (not last) gets marginRight: 8px; last segment gets marginRight: 0.
    expect(html).toMatch(/margin-right:\s*8px/i)
  })

  it("block style: padding '4px 8px' and borderRadius '0' (not 8px)", () => {
    const node = renderSegments(
      'FIGHTS BACK',
      [
        {
          text: 'FIGHTS BACK',
          highlightColor: '#9DECC1',
          highlightStyle: 'block',
        },
      ],
      '#FFFFFF',
      '#9DECC1',
    )
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node))
    expect(html).toMatch(/padding:\s*4px\s+8px/i)
    // borderRadius should be 0 — match either '0' or '0px' but NOT '8px'.
    expect(html).not.toMatch(/border-radius:\s*8px/i)
    expect(html).toMatch(/border-radius:\s*0(?:px)?/i)
  })

  it("pill MUST NOT include box-decoration-break (parity contract with Satori — TPLREND-05)", () => {
    const node = renderSegments(
      'FIGHTS BACK',
      [{ text: 'FIGHTS BACK', highlightColor: '#9DECC1', highlightStyle: 'pill' }],
      '#FFFFFF',
      '#9DECC1',
    )
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node))
    expect(html.toLowerCase()).not.toContain('box-decoration-break')
  })

  it('separator preserved between consecutive segments (NBSP for flex-safe gap)', () => {
    const node = renderSegments(
      'A B',
      [{ text: 'A' }, { text: 'B' }],
      '#FFFFFF',
      '#9DECC1',
    )
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node))
    // First segment must have a trailing space (regular OR NBSP U+00A0) before
    // the second span starts. NBSP survives Satori/CSS flex child whitespace
    // collapse where regular space does not.
    expect(html).toMatch(/A[\s ]/)
  })
})

describe('bottomCardBackground', () => {
  it("6-digit hex: returns rgba with default alpha 0.85", () => {
    expect(bottomCardBackground('#000000')).toBe('rgba(0, 0, 0, 0.85)')
  })

  it("8-digit hex: passthrough verbatim (template-supplied alpha wins)", () => {
    expect(bottomCardBackground('#000000CC')).toBe('#000000CC')
  })

  it("3-digit hex: expanded to 6-digit then composed as rgba with 0.85 alpha", () => {
    expect(bottomCardBackground('#FFF')).toBe('rgba(255, 255, 255, 0.85)')
  })
})

describe('Phase 55: renderGrain (layer 1.5)', () => {
  it('returns an <img> with the correct src for each intensity', () => {
    const intensities = ['subtle', 'medium', 'heavy', 'paper', 'xerox'] as const
    for (const intensity of intensities) {
      const el = renderGrain(intensity) as React.ReactElement
      const props = el.props as Record<string, unknown>
      const style = props.style as Record<string, unknown>
      expect(el.type).toBe('img')
      expect(props.src).toBe(`/textures/grain-${intensity}.png`)
      expect(style.position).toBe('absolute')
      expect(style.width).toBe(1080)
      expect(style.height).toBe(1920)
      expect(style.pointerEvents).toBe('none')
      expect(props['data-layer']).toBe('grain')
    }
  })

  it('opacity map matches D-11 locked values', () => {
    const expected: Record<string, number> = {
      subtle: 0.04,
      medium: 0.08,
      heavy: 0.14,
      paper: 0.18,
      xerox: 0.22,
    }
    for (const [intensity, opacity] of Object.entries(expected)) {
      const el = renderGrain(intensity as 'subtle' | 'medium' | 'heavy' | 'paper' | 'xerox') as React.ReactElement
      const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
      expect(style.opacity).toBe(opacity)
    }
  })

  it('does NOT use CSS filter property (PARITY-04 / D-24)', () => {
    const el = renderGrain('medium') as React.ReactElement
    const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style).not.toHaveProperty('filter')
    expect(style).not.toHaveProperty('backdropFilter')
    expect(style).not.toHaveProperty('mixBlendMode')
  })
})

describe('Phase 55: renderVignette (layer 2.5)', () => {
  it('returns a <div> with radial-gradient backgroundImage', () => {
    const el = renderVignette(0.5) as React.ReactElement
    const props = el.props as Record<string, unknown>
    const style = props.style as Record<string, unknown>
    const bg = style.backgroundImage as string
    expect(el.type).toBe('div')
    expect(bg).toContain('radial-gradient')
    expect(bg).toContain('ellipse at center')
    expect(bg).toContain('transparent 40%')
    expect(bg).toContain('rgba(0,0,0,0.5)')
    expect(style.position).toBe('absolute')
    expect(style.width).toBe(1080)
    expect(style.height).toBe(1920)
    expect(style.pointerEvents).toBe('none')
    expect(props['data-layer']).toBe('vignette')
  })

  it('does NOT use CSS filter / backdrop-filter / mix-blend-mode (Pitfall #2 + D-24)', () => {
    const el = renderVignette(0.5) as React.ReactElement
    const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style).not.toHaveProperty('filter')
    expect(style).not.toHaveProperty('backdropFilter')
    expect(style).not.toHaveProperty('mixBlendMode')
  })

  it('strength interpolates into rgba alpha', () => {
    const el07 = renderVignette(0.7) as React.ReactElement
    const bg07 = ((el07.props as Record<string, unknown>).style as Record<string, unknown>).backgroundImage as string
    expect(bg07).toContain('rgba(0,0,0,0.7)')

    const el03 = renderVignette(0.3) as React.ReactElement
    const bg03 = ((el03.props as Record<string, unknown>).style as Record<string, unknown>).backgroundImage as string
    expect(bg03).toContain('rgba(0,0,0,0.3)')
  })
})
