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

// quick-260510-brand-kit-scope: brand kit overrides ONLY apply to the
// synthesized brand-kit template (BRAND_KIT_TEMPLATE_ID). For any built-in
// template, mergeWithBrandKit is a passthrough — picking "news-cyan" means
// getting news-cyan, not news-cyan with the brand kit's accent + bg painted
// over it. Previously the merge layer applied to all non-`paletteMode:'fixed'`
// templates and produced editor/export divergence (editor renders raw
// template, export renders brand-kit-overridden colors).
describe('mergeWithBrandKit (post-quick-260510)', () => {
  it('returns template unchanged when brandKit is null', () => {
    expect(mergeWithBrandKit(baseTemplate, null)).toEqual(baseTemplate)
  })

  it('returns template unchanged for any built-in template, even with a brand kit set', () => {
    const merged = mergeWithBrandKit(baseTemplate, baseBrandKit)
    expect(merged).toBe(baseTemplate) // identity-equal — passthrough
    expect(merged.textColor).toBe('#1F1F1F')
    expect(merged.backgroundColor).toBe('#F2EBDA')
    expect(merged.fontFamily).toBe("'Lora', serif")
  })

  it('returns template unchanged when paletteMode is fixed (paper-essay/brutalist-grid)', () => {
    const fixed: SlideTemplate = { ...baseTemplate, paletteMode: 'fixed' }
    const merged = mergeWithBrandKit(fixed, baseBrandKit)
    expect(merged).toBe(fixed)
  })

  it('returns template unchanged for palette-dominant templates too', () => {
    // editorial-serif and notes-app-chic source colors from the slide image
    // palette, not from the brand kit. Now that built-ins are passthrough,
    // these are explicitly left alone too.
    const palette: SlideTemplate = { ...baseTemplate, paletteMode: 'palette-dominant' }
    const merged = mergeWithBrandKit(palette, baseBrandKit)
    expect(merged).toBe(palette)
    expect(merged.textColor).toBe('#1F1F1F')
    expect(merged.backgroundColor).toBe('#F2EBDA')
  })
})
