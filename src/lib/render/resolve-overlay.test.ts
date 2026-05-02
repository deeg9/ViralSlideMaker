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
  renderDecorativeOverlay,
  getVibrant,
  getDarkMuted,
  getEditorialSerifChipColors,
  getNotesAppChicAccentColor,
  resolveGrainIntensity,
} from './resolve-overlay'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from './templates'

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

describe('Phase 56: renderDecorativeOverlay (TPL-04)', () => {
  it('returns <img> with src=/overlays/{asset}.svg for SVG assets', () => {
    const el = renderDecorativeOverlay('tape-strip-1', { x: 60, y: 40 }) as React.ReactElement
    const props = el.props as Record<string, unknown>
    expect(el.type).toBe('img')
    expect(props.src).toBe('/overlays/tape-strip-1.svg')
    expect(props['data-layer']).toBe('decorative')
    expect(props['data-asset']).toBe('tape-strip-1')
  })

  it('returns <img> with src=/overlays/{asset}.png for halftone-dots-light', () => {
    const el = renderDecorativeOverlay('halftone-dots-light', { x: 0, y: 0 }) as React.ReactElement
    const props = el.props as Record<string, unknown>
    expect(props.src).toBe('/overlays/halftone-dots-light.png')
  })

  it('returns <img> with src=/overlays/{asset}.png for halftone-dots-dense', () => {
    const el = renderDecorativeOverlay('halftone-dots-dense', { x: 0, y: 0 }) as React.ReactElement
    const props = el.props as Record<string, unknown>
    expect(props.src).toBe('/overlays/halftone-dots-dense.png')
  })

  it('applies rotation/scale via transform', () => {
    const el = renderDecorativeOverlay('sticky-note-yellow', { x: 200, y: 300 }, { rotation: 12, scale: 0.8 }) as React.ReactElement
    const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style.transform).toBe('rotate(12deg) scale(0.8)')
  })

  it('omits transform when rotation===0 AND scale===1 (no options)', () => {
    const el = renderDecorativeOverlay('arrow-up', { x: 100, y: 100 }) as React.ReactElement
    const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style.transform).toBeUndefined()
  })

  it('applies opacity from options', () => {
    const el = renderDecorativeOverlay('halftone-dots-light', { x: 0, y: 0 }, { opacity: 0.5 }) as React.ReactElement
    const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style.opacity).toBe(0.5)
  })

  it('defaults opacity to 1 when not provided', () => {
    const el = renderDecorativeOverlay('arrow-right', { x: 0, y: 0 }) as React.ReactElement
    const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style.opacity).toBe(1)
  })

  it('uses absolute positioning at given pixel coords', () => {
    const el = renderDecorativeOverlay('polaroid-frame', { x: 200, y: 300 }) as React.ReactElement
    const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style.position).toBe('absolute')
    expect(style.top).toBe(300)
    expect(style.left).toBe(200)
  })

  it('does NOT use CSS filter / backdrop-filter / mix-blend-mode (PARITY-04)', () => {
    const el = renderDecorativeOverlay('tape-strip-1', { x: 0, y: 0 }, { rotation: 5 }) as React.ReactElement
    const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style).not.toHaveProperty('filter')
    expect(style).not.toHaveProperty('backdropFilter')
    expect(style).not.toHaveProperty('mixBlendMode')
  })

  it('pointerEvents is none (does not interfere with text selection / clicks)', () => {
    const el = renderDecorativeOverlay('sticky-note-pink', { x: 0, y: 0 }) as React.ReactElement
    const style = (el.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style.pointerEvents).toBe('none')
  })
})

describe('Phase 56: renderSegments segment-level fontFamily (TPL-07)', () => {
  it('applies segment fontFamily via inline style on a plain span', () => {
    const segments = [{ text: 'sample', fontFamily: "'Bebas Neue', sans-serif" }]
    const node = renderSegments('FALLBACK', segments, '#fff', '#0f0') as React.ReactElement[]
    const span = node[0]
    const style = (span.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style.fontFamily).toBe("'Bebas Neue', sans-serif")
  })

  it('applies segment fontFamily via inline style on a highlight pill', () => {
    const segments = [{ text: 'sell', fontFamily: "'Archivo Black', sans-serif", highlightColor: '#FFD86B', highlightStyle: 'pill' as const }]
    const node = renderSegments('FALLBACK', segments, '#fff', '#0f0') as React.ReactElement[]
    const span = node[0]
    const style = (span.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style.fontFamily).toBe("'Archivo Black', sans-serif")
    expect(style.backgroundColor).toBe('#FFD86B')
  })

  it('does NOT set fontFamily on plain span when segment.fontFamily is undefined', () => {
    const segments = [{ text: 'plain', accent: false }]
    const node = renderSegments('FALLBACK', segments, '#fff', '#0f0') as React.ReactElement[]
    const span = node[0]
    const style = (span.props as Record<string, unknown>).style as Record<string, unknown>
    expect(style.fontFamily).toBeUndefined()
  })
})

describe('Phase 57: palette-aware helpers (PALETTE-03, D-14, D-16)', () => {
  function makeSlide(palette?: string[], grain?: 'subtle' | 'medium' | 'heavy' | 'off'): Slide {
    return {
      hook_text: '', body_text: '', image_query: '', is_cta: false,
      background_url: null, pexels_photo_id: null,
      style_overrides: {
        ...(palette ? { derived_palette: palette } : {}),
        ...(grain ? { grain_intensity: grain } : {}),
      },
    } as Slide
  }

  function makeTemplate(opts: { paletteMode?: 'fixed' | 'palette-dominant'; grainMode?: 'subtle' | 'medium' | 'heavy' | 'paper' | 'xerox' } = {}): SlideTemplate {
    return {
      id: 't', name: 'T', description: '', tier: 'free',
      backgroundColor: '#fff', textColor: '#000',
      hookFontSize: 100, bodyFontSize: 30, fontFamily: 'sans',
      paletteMode: opts.paletteMode,
      grainMode: opts.grainMode,
    } as unknown as SlideTemplate
  }

  it('getVibrant returns derived_palette[0] or null', () => {
    expect(getVibrant(makeSlide(['#FF0000', '#000', '#fff', '#888', '#444', '#ccc']))).toBe('#FF0000')
    expect(getVibrant(makeSlide())).toBeNull()
  })

  it('getDarkMuted returns derived_palette[4] or null', () => {
    expect(getDarkMuted(makeSlide(['#A', '#B', '#C', '#D', '#444444', '#F']))).toBe('#444444')
    expect(getDarkMuted(makeSlide())).toBeNull()
  })

  it('getEditorialSerifChipColors returns brand fallback when paletteMode=fixed', () => {
    const slide = makeSlide(['#FF0000', '#800000', '#FFcccc', '#888', '#222', '#ccc'])
    const tmpl = makeTemplate({ paletteMode: 'fixed' })
    expect(getEditorialSerifChipColors(slide, tmpl)).toEqual({ background: '#F5EFE6', text: '#3d0000' })
  })

  it('getEditorialSerifChipColors uses Vibrant + DarkMuted when palette-dominant + palette set', () => {
    const slide = makeSlide(['#FF0000', '#800000', '#FFcccc', '#888', '#222222', '#ccc'])
    const tmpl = makeTemplate({ paletteMode: 'palette-dominant' })
    expect(getEditorialSerifChipColors(slide, tmpl)).toEqual({ background: '#FF0000', text: '#222222' })
  })

  it('getEditorialSerifChipColors falls back when palette-dominant but no palette', () => {
    const slide = makeSlide()
    const tmpl = makeTemplate({ paletteMode: 'palette-dominant' })
    expect(getEditorialSerifChipColors(slide, tmpl)).toEqual({ background: '#F5EFE6', text: '#3d0000' })
  })

  it('getNotesAppChicAccentColor returns sticky-yellow when fixed; Vibrant when dominant', () => {
    const slide = makeSlide(['#FF0000', '#800000', '#FFcccc', '#888', '#222', '#ccc'])
    expect(getNotesAppChicAccentColor(slide, makeTemplate({ paletteMode: 'fixed' }))).toBe('#FFE066')
    expect(getNotesAppChicAccentColor(slide, makeTemplate({ paletteMode: 'palette-dominant' }))).toBe('#FF0000')
    expect(getNotesAppChicAccentColor(makeSlide(), makeTemplate({ paletteMode: 'palette-dominant' }))).toBe('#FFE066')
  })

  it('resolveGrainIntensity prioritizes slide override over template grainMode', () => {
    expect(resolveGrainIntensity(makeSlide(undefined, 'medium'), makeTemplate({ grainMode: 'subtle' }))).toBe('medium')
  })

  it("resolveGrainIntensity returns 'off' when slide override is 'off' (does NOT fall through to template)", () => {
    expect(resolveGrainIntensity(makeSlide(undefined, 'off'), makeTemplate({ grainMode: 'medium' }))).toBe('off')
  })

  it('resolveGrainIntensity falls through to template grainMode for simple values', () => {
    expect(resolveGrainIntensity(makeSlide(), makeTemplate({ grainMode: 'heavy' }))).toBe('heavy')
  })

  it('resolveGrainIntensity ignores paper/xerox template grainMode (template-only)', () => {
    expect(resolveGrainIntensity(makeSlide(), makeTemplate({ grainMode: 'paper' }))).toBeUndefined()
    expect(resolveGrainIntensity(makeSlide(), makeTemplate({ grainMode: 'xerox' }))).toBeUndefined()
  })

  it('resolveGrainIntensity returns undefined when both slide and template are unset', () => {
    expect(resolveGrainIntensity(makeSlide(), makeTemplate())).toBeUndefined()
  })
})
