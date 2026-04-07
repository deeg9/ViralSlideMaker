import { describe, it, expect } from 'vitest'
import { resolveSlideStyles, resolveTextEffects, SAFE_ZONE, SHADOW_PRESETS, type ResolvedSlideStyles, type ResolvedTextEffectStyles } from './resolve-styles'
import type { Slide, TextEffects } from '../types/slide'
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

  // Font family override tests (Phase 12)
  it('returns overridden hookFontFamily when hook_font_family is set', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { hook_font_family: 'Playfair Display' },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.hookFontFamily).toBe("'Playfair Display', serif")
  })

  it('returns overridden bodyFontFamily when body_font_family is set', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { body_font_family: 'Montserrat' },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.bodyFontFamily).toBe("'Montserrat', sans-serif")
  })

  it('returns template.fontFamily when no font_family overrides (backward compat)', () => {
    const styles = resolveSlideStyles(baseSlide, baseTemplate)
    expect(styles.hookFontFamily).toBe("'Inter', sans-serif")
    expect(styles.bodyFontFamily).toBe("'Inter', sans-serif")
  })

  it('allows independent hook and body font families', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: {
        hook_font_family: 'Bebas Neue',
        body_font_family: 'Lora',
      },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.hookFontFamily).toBe("'Bebas Neue', system-ui")
    expect(styles.bodyFontFamily).toBe("'Lora', serif")
  })

  // Phase 19: Text effects integration tests
  it('returns empty hookEffects and bodyEffects when no effects are set', () => {
    const styles = resolveSlideStyles(baseSlide, baseTemplate)
    expect(styles.hookEffects).toEqual({})
    expect(styles.bodyEffects).toEqual({})
  })

  it('returns hookEffects with textShadow when hook_text_effects has shadow', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: {
        hook_text_effects: {
          shadow: { enabled: true, color: '#00000080', size: 'md' },
        },
      },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.hookEffects.textShadow).toBe('2px 2px 4px #00000080')
  })

  it('returns bodyEffects with outline when body_text_effects has outline', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: {
        body_text_effects: {
          outline: { enabled: true, color: '#FF0000', width: 3 },
        },
      },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.bodyEffects.WebkitTextStrokeWidth).toBe('3px')
    expect(styles.bodyEffects.WebkitTextStrokeColor).toBe('#FF0000')
    expect(styles.bodyEffects.paintOrder).toBe('stroke')
  })

  it('returns resolvedEffects on custom texts with text_effects', () => {
    const slide: Slide = {
      ...baseSlide,
      custom_texts: [
        {
          id: 'ct1',
          text: 'Custom',
          x: 10,
          y: 10,
          width: 80,
          text_effects: {
            shadow: { enabled: true, color: '#00000080', size: 'sm' },
          },
        },
      ],
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.customTexts[0].resolvedEffects.textShadow).toBe('1px 1px 2px #00000080')
  })

  it('returns empty resolvedEffects on custom texts without text_effects', () => {
    const slide: Slide = {
      ...baseSlide,
      custom_texts: [
        { id: 'ct1', text: 'Custom', x: 10, y: 10, width: 80 },
      ],
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.customTexts[0].resolvedEffects).toEqual({})
  })

  it('allows hook and body to have different effects simultaneously (FX-02)', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: {
        hook_text_effects: {
          shadow: { enabled: true, color: '#00000080', size: 'lg' },
        },
        body_text_effects: {
          outline: { enabled: true, color: '#FF0000', width: 2 },
        },
      },
    }
    const styles = resolveSlideStyles(slide, baseTemplate)
    expect(styles.hookEffects.textShadow).toBe('3px 4px 8px #00000080')
    expect(styles.hookEffects.WebkitTextStrokeWidth).toBeUndefined()
    expect(styles.bodyEffects.WebkitTextStrokeWidth).toBe('2px')
    expect(styles.bodyEffects.textShadow).toBeUndefined()
  })
})

describe('resolveTextEffects', () => {
  it('returns empty object for undefined effects', () => {
    expect(resolveTextEffects(undefined)).toEqual({})
  })

  it('returns empty object for disabled shadow', () => {
    const effects: TextEffects = {
      shadow: { enabled: false, color: '#000', size: 'md' },
    }
    expect(resolveTextEffects(effects)).toEqual({})
  })

  it('returns textShadow for enabled shadow (sm)', () => {
    const effects: TextEffects = {
      shadow: { enabled: true, color: '#00000080', size: 'sm' },
    }
    const result = resolveTextEffects(effects)
    expect(result.textShadow).toBe('1px 1px 2px #00000080')
  })

  it('returns textShadow for enabled shadow (md)', () => {
    const effects: TextEffects = {
      shadow: { enabled: true, color: '#00000080', size: 'md' },
    }
    const result = resolveTextEffects(effects)
    expect(result.textShadow).toBe('2px 2px 4px #00000080')
  })

  it('returns textShadow for enabled shadow (lg)', () => {
    const effects: TextEffects = {
      shadow: { enabled: true, color: '#00000080', size: 'lg' },
    }
    const result = resolveTextEffects(effects)
    expect(result.textShadow).toBe('3px 4px 8px #00000080')
  })

  it('returns outline properties for enabled outline', () => {
    const effects: TextEffects = {
      outline: { enabled: true, color: '#FF0000', width: 3 },
    }
    const result = resolveTextEffects(effects)
    expect(result.WebkitTextStrokeWidth).toBe('3px')
    expect(result.WebkitTextStrokeColor).toBe('#FF0000')
    expect(result.paintOrder).toBe('stroke')
  })

  it('returns empty object for disabled outline', () => {
    const effects: TextEffects = {
      outline: { enabled: false, color: '#FF0000', width: 3 },
    }
    expect(resolveTextEffects(effects)).toEqual({})
  })

  it('returns highlight data for enabled highlight', () => {
    const effects: TextEffects = {
      highlight: { enabled: true, color: '#000000CC', style: 'full', padding: 8 },
    }
    const result = resolveTextEffects(effects)
    expect(result.highlight).toEqual({
      enabled: true,
      color: '#000000CC',
      style: 'full',
      padding: 8,
    })
  })

  it('returns empty object for disabled highlight', () => {
    const effects: TextEffects = {
      highlight: { enabled: false, color: '#000000CC', style: 'full', padding: 8 },
    }
    expect(resolveTextEffects(effects)).toEqual({})
  })

  it('combines all three enabled effects', () => {
    const effects: TextEffects = {
      shadow: { enabled: true, color: '#00000080', size: 'md' },
      outline: { enabled: true, color: '#FF0000', width: 2 },
      highlight: { enabled: true, color: '#000000CC', style: 'tight', padding: 12 },
    }
    const result = resolveTextEffects(effects)
    expect(result.textShadow).toBe('2px 2px 4px #00000080')
    expect(result.WebkitTextStrokeWidth).toBe('2px')
    expect(result.WebkitTextStrokeColor).toBe('#FF0000')
    expect(result.paintOrder).toBe('stroke')
    expect(result.highlight).toEqual({
      enabled: true,
      color: '#000000CC',
      style: 'tight',
      padding: 12,
    })
  })

  it('SHADOW_PRESETS has sm, md, lg with correct values', () => {
    expect(SHADOW_PRESETS.sm).toEqual({ offsetX: 1, offsetY: 1, blur: 2 })
    expect(SHADOW_PRESETS.md).toEqual({ offsetX: 2, offsetY: 2, blur: 4 })
    expect(SHADOW_PRESETS.lg).toEqual({ offsetX: 3, offsetY: 4, blur: 8 })
  })
})

// Font catalog tests (Phase 12)
import { FONT_CATALOG, getFontEntry, DEFAULT_FONT, type FontEntry } from '../fonts/font-catalog'

describe('font-catalog', () => {
  it('getFontEntry returns Inter entry from catalog', () => {
    const entry = getFontEntry('Inter')
    expect(entry).toBeDefined()
    expect(entry!.family).toBe('Inter')
    expect(entry!.category).toBe('sans-serif')
  })

  it('getFontEntry returns undefined for nonexistent font', () => {
    const entry = getFontEntry('NonExistent')
    expect(entry).toBeUndefined()
  })

  it('FONT_CATALOG has at least 25 entries', () => {
    expect(FONT_CATALOG.length).toBeGreaterThanOrEqual(25)
  })

  it('DEFAULT_FONT is Inter', () => {
    expect(DEFAULT_FONT).toBe('Inter')
  })

  it('each entry has family, category, and variants', () => {
    for (const entry of FONT_CATALOG) {
      expect(entry.family).toBeTruthy()
      expect(['sans-serif', 'serif', 'display', 'handwriting']).toContain(entry.category)
      expect(entry.variants.length).toBeGreaterThan(0)
    }
  })
})
