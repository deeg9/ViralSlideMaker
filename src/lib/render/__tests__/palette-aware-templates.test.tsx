import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  augmentEditorialSerifPageCounterStyle,
  getEditorialSerifChipColors,
  getNotesAppChicAccentColor,
  renderDecorativeOverlay,
} from '@/lib/render/resolve-overlay'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 57 (PALETTE-02, PALETTE-03, D-13..D-16): palette-aware template
 * resolver smoke tests.
 *
 * Asserts:
 *   - editorial-serif page-counter chip uses Vibrant + DarkMuted when
 *     paletteMode='palette-dominant' AND derived_palette set
 *   - falls back to brand cream + deep-brown when palette unset
 *   - notes-app-chic sticky-note tint = Vibrant when palette-dominant
 *   - falls back to #FFE066 when palette unset
 *   - renderDecorativeOverlay accepts tintColor option (D-15)
 */

const editorialSerif = getTemplate('editorial-serif')
const notesAppChic = getTemplate('notes-app-chic')

function makeSlide(palette?: string[]): Slide {
  return {
    hook_text: '', body_text: '', image_query: '', is_cta: false,
    background_url: 'https://example.com/treated.png',
    pexels_photo_id: null,
    style_overrides: palette ? { derived_palette: palette } : {},
  }
}

const SAMPLE_PALETTE = [
  '#FF6347', // Vibrant
  '#8B0000', // DarkVibrant
  '#FFD4CC', // LightVibrant
  '#998877', // Muted
  '#3d2222', // DarkMuted
  '#E0D5C8', // LightMuted
]

describe('Phase 57: editorial-serif palette consumption (D-14)', () => {
  it('paletteMode is palette-dominant after Phase 57 flip', () => {
    expect(editorialSerif.paletteMode).toBe('palette-dominant')
  })

  it('chip background = Vibrant + text = DarkMuted when palette set', () => {
    const colors = getEditorialSerifChipColors(makeSlide(SAMPLE_PALETTE), editorialSerif)
    expect(colors.background).toBe('#FF6347')
    expect(colors.text).toBe('#3d2222')
  })

  it('falls back to brand cream + deep-brown when derived_palette empty', () => {
    const colors = getEditorialSerifChipColors(makeSlide(), editorialSerif)
    expect(colors.background).toBe('#F5EFE6')
    expect(colors.text).toBe('#3d0000')
  })

  it('augmentEditorialSerifPageCounterStyle injects Vibrant background when palette set', () => {
    const baseStyle = { fontSize: '28px', color: '#F5EFE6' }
    const augmented = augmentEditorialSerifPageCounterStyle(
      baseStyle,
      makeSlide(SAMPLE_PALETTE),
      editorialSerif,
    )
    expect(augmented.background).toBe('#FF6347')
    expect(augmented.color).toBe('#3d2222')
    // Original fontSize preserved
    expect(augmented.fontSize).toBe('28px')
  })

  it('augmentEditorialSerifPageCounterStyle returns base style verbatim when palette unset', () => {
    const baseStyle = { fontSize: '28px', color: '#F5EFE6' }
    const augmented = augmentEditorialSerifPageCounterStyle(
      baseStyle,
      makeSlide(),
      editorialSerif,
    )
    expect(augmented.color).toBe('#F5EFE6')
    expect(augmented.background).toBeUndefined()
  })

  it('augmentEditorialSerifPageCounterStyle is no-op for non-editorial-serif templates', () => {
    const otherTemplate = getTemplate('magazine-bold')
    const baseStyle = { fontSize: '28px' }
    const augmented = augmentEditorialSerifPageCounterStyle(
      baseStyle,
      makeSlide(SAMPLE_PALETTE),
      otherTemplate,
    )
    expect(augmented.background).toBeUndefined()
    expect(augmented.fontSize).toBe('28px')
  })
})

describe('Phase 57: notes-app-chic palette consumption (D-15)', () => {
  it('paletteMode is palette-dominant after Phase 57 flip', () => {
    expect(notesAppChic.paletteMode).toBe('palette-dominant')
  })

  it('accent = Vibrant when palette set', () => {
    expect(getNotesAppChicAccentColor(makeSlide(SAMPLE_PALETTE), notesAppChic)).toBe('#FF6347')
  })

  it('accent = #FFE066 when palette unset', () => {
    expect(getNotesAppChicAccentColor(makeSlide(), notesAppChic)).toBe('#FFE066')
  })

  it('renderDecorativeOverlay tintColor injects via inline color style (D-15)', () => {
    const node = renderDecorativeOverlay(
      'sticky-note-accent',
      { x: 100, y: 200 },
      { tintColor: '#FF0000' },
    )
    const html = renderToStaticMarkup(node as React.ReactElement)
    // The tintColor injects via CSS `color:` so SVGs that use fill="currentColor" pick it up.
    expect(html).toMatch(/color:\s*#FF0000|color:\s*rgb\(255,\s*0,\s*0\)/i)
  })
})
