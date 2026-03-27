import { describe, it, expect } from 'vitest'
import { resolveSlideStyles, SAFE_ZONE, type ResolvedSlideStyles } from './resolve-styles'
import type { Slide } from '../types/slide'
import type { SlideTemplate } from './templates'

const baseSlide: Slide = {
  hook_text: 'Test Hook',
  body_text: 'Test Body',
  image_query: 'test',
  is_cta: false,
  background_url: null,
  pexels_photo_id: null,
}

const baseTemplate: SlideTemplate = {
  id: 'test-template',
  name: 'Test',
  thumbnail: '/test.png',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '72px',
  bodyFontSize: '36px',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0.5,
  textAlign: 'center',
  textPosition: 'center',
  hookStyle: 'normal',
}

describe('resolveSlideStyles', () => {
  it('returns template defaults when no overrides', () => {
    const styles = resolveSlideStyles(baseSlide, baseTemplate)

    expect(styles.textColor).toBe('#ffffff')
    expect(styles.hookFontSize).toBe(72)
    expect(styles.bodyFontSize).toBe(36)
    expect(styles.hookFontFamily).toBe("'Inter', sans-serif")
    expect(styles.hookFontWeight).toBe(900)
    expect(styles.bodyFontWeight).toBe(400)
    expect(styles.textAlign).toBe('center')
    expect(styles.overlayOpacity).toBe(0.5)
  })

  it('applies text_color override, other fields still default', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { text_color: '#ff0000' },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)

    expect(styles.textColor).toBe('#ff0000')
    // Other fields remain default
    expect(styles.hookFontSize).toBe(72)
    expect(styles.hookFontFamily).toBe("'Inter', sans-serif")
  })

  it('applies hook_position override with computed hookWidth', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: {
        hook_position: { x: 20, y: 15 },
      },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)

    expect(styles.hookX).toBe(20)
    expect(styles.hookY).toBe(15)
    expect(styles.hookWidth).toBe(100 - 20 * 2) // 60
  })

  it('applies text_position top preset', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { text_position: 'top' },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)

    expect(styles.hookY).toBe(SAFE_ZONE.top.hookY) // 12
    expect(styles.bodyY).toBe(SAFE_ZONE.top.bodyY) // 30
  })

  it('converts overlay_opacity from 0-100 to 0-1', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { overlay_opacity: 50 },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)

    expect(styles.overlayOpacity).toBe(0.5)
  })

  it('handles hookStyle italic', () => {
    const template: SlideTemplate = { ...baseTemplate, hookStyle: 'italic' }
    const styles = resolveSlideStyles(baseSlide, template)

    expect(styles.hookFontStyle).toBe('italic')
    expect(styles.hookTextTransform).toBe('none')
  })

  it('handles hookStyle uppercase', () => {
    const template: SlideTemplate = { ...baseTemplate, hookStyle: 'uppercase' }
    const styles = resolveSlideStyles(baseSlide, template)

    expect(styles.hookTextTransform).toBe('uppercase')
    expect(styles.hookFontStyle).toBe('normal')
  })

  // Bold/Italic override tests
  it('returns hookFontWeight=700 when slide has hook_font_weight=700 override', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { hook_font_weight: 700 },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.hookFontWeight).toBe(700)
  })

  it('returns hookFontWeight=900 (default) when no hook_font_weight override', () => {
    const styles = resolveSlideStyles(baseSlide, baseTemplate)
    expect(styles.hookFontWeight).toBe(900)
  })

  it('returns bodyFontWeight=700 when slide has body_font_weight=700 override', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { body_font_weight: 700 },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.bodyFontWeight).toBe(700)
  })

  it('returns bodyFontWeight=400 (default) when no body_font_weight override', () => {
    const styles = resolveSlideStyles(baseSlide, baseTemplate)
    expect(styles.bodyFontWeight).toBe(400)
  })

  it('returns hookFontStyle=italic when slide has hook_font_style=italic override', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { hook_font_style: 'italic' },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.hookFontStyle).toBe('italic')
  })

  it('returns hookFontStyle from template.hookStyle when no hook_font_style override', () => {
    const template: SlideTemplate = { ...baseTemplate, hookStyle: 'italic' }
    const styles = resolveSlideStyles(baseSlide, template)
    expect(styles.hookFontStyle).toBe('italic')
  })

  it('returns bodyFontStyle=italic when slide has body_font_style=italic override', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { body_font_style: 'italic' },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.bodyFontStyle).toBe('italic')
  })

  it('returns bodyFontStyle=normal (default) when no body_font_style override', () => {
    const styles = resolveSlideStyles(baseSlide, baseTemplate)
    expect(styles.bodyFontStyle).toBe('normal')
  })
})
