import { describe, it, expect } from 'vitest'
import { mergeWithBrandKit } from './get-effective-template'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'

const baseTemplate: SlideTemplate = {
  id: 'test-template',
  name: 'Test',
  thumbnail: '',
  fontFamily: "'Lora', serif",
  hookFontSize: '100px',
  bodyFontSize: '34px',
  textColor: '#1F1F1F',
  backgroundColor: '#F2EBDA',
  overlayColor: '#000000',
  overlayOpacity: 0,
  textAlign: 'center',
  textPosition: 'center',
  hookStyle: 'normal',
}

const baseBrandKit: BrandKit = {
  user_id: 'u',
  text_color: '#ffffff',
  background_color: '#1a1a2e',
  body_font_family: 'Inter',
  heading_font_family: 'Inter',
} as BrandKit

describe('mergeWithBrandKit', () => {
  it('returns template unchanged when brandKit is null', () => {
    expect(mergeWithBrandKit(baseTemplate, null)).toEqual(baseTemplate)
  })

  it('paints brand-kit colors and fonts onto a non-fixed template', () => {
    const merged = mergeWithBrandKit(baseTemplate, baseBrandKit)
    expect(merged.textColor).toBe('#ffffff')
    expect(merged.backgroundColor).toBe('#1a1a2e')
    expect(merged.fontFamily).toBe("'Inter', sans-serif")
    expect(merged.headingFontFamily).toBe("'Inter', sans-serif")
  })

  it('returns template unchanged when paletteMode is fixed (paper-essay/brutalist-grid lockdown)', () => {
    const fixed: SlideTemplate = { ...baseTemplate, paletteMode: 'fixed' }
    const merged = mergeWithBrandKit(fixed, baseBrandKit)
    expect(merged).toBe(fixed) // identity-equal — no shallow clone
    expect(merged.textColor).toBe('#1F1F1F')
    expect(merged.backgroundColor).toBe('#F2EBDA')
    expect(merged.fontFamily).toBe("'Lora', serif")
  })

  it('still applies brand-kit overrides to palette-dominant templates', () => {
    const palette: SlideTemplate = { ...baseTemplate, paletteMode: 'palette-dominant' }
    const merged = mergeWithBrandKit(palette, baseBrandKit)
    expect(merged.textColor).toBe('#ffffff')
    expect(merged.backgroundColor).toBe('#1a1a2e')
  })
})
