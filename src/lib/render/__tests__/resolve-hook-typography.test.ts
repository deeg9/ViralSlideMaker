import { describe, it, expect } from 'vitest'
import { resolveHookTypography } from '../resolve-overlay'
import { textBoxesToLegacy } from '@/lib/editor/text-box-adapter'
import { highlightBar } from '../templates/highlight-bar'
import { editorialSerif } from '../templates/editorial-serif'
import type { SlideTemplate } from '../templates'
import type { SlideStyleOverrides, TextBox } from '@/lib/types/slide'

/**
 * quick-260515-nhf — regression suite for the shared hook-typography resolver.
 *
 * `resolveHookTypography` is the SINGLE source of truth for hook casing,
 * font family, and italic style precedence. Both render paths (editor
 * preview, Satori PNG export) plus the HTML render import it so they cannot
 * drift (TPLREND-05).
 *
 * quick-260515-o75 — the textTransform default was FLIPPED from the template's
 * `hookStyle` to `'none'` (render the hook EXACTLY as stored — WYSIWYG). A
 * template's `hookStyle: 'uppercase'` no longer force-caps stored hook text;
 * auto-uppercase is opt-IN via the per-TextBox `text_transform` field (the
 * ActiveTextBoxCard "Uppercase" toggle) or the `hook_text_transform` override.
 * Casing byte-identity to the pre-o75 (force-capped) behavior is intentionally
 * NOT preserved — user-accepted. fontFamily / fontStyle precedence is UNCHANGED
 * and its byte-identity assertions remain load-bearing.
 */

// editorial-serif has hookStyle:'normal' + headingFontFamily — we synthesize
// an italic variant locally because no shipped template uses hookStyle:'italic'.
const italicTemplate: SlideTemplate = {
  ...editorialSerif,
  hookStyle: 'italic',
}

describe('resolveHookTypography — hook casing/font/style precedence', () => {
  it('quick-260515-o75 WYSIWYG default: no overrides, no TextBox, uppercase-hookStyle template → textTransform "none"', () => {
    // THE bug fix. highlight-bar declares hookStyle:'uppercase'. With no
    // per-TextBox text_transform and no hook_text_transform override the
    // resolver must NOT force-cap — it renders the stored casing verbatim so
    // the canvas matches the inspector. This is the no-override slide on an
    // uppercase template the nhf attempt missed.
    const result = resolveHookTypography(undefined, undefined, highlightBar)
    expect(result).toEqual({
      textTransform: 'none',
      fontFamily: highlightBar.headingFontFamily ?? highlightBar.fontFamily,
      fontStyle: 'normal',
    })
  })

  it('byte-identity (TPLREND-05): no overrides → template values verbatim (normal template, headingFontFamily set)', () => {
    const result = resolveHookTypography(undefined, undefined, editorialSerif)
    expect(result).toEqual({
      textTransform: 'none',
      fontFamily: editorialSerif.headingFontFamily ?? editorialSerif.fontFamily,
      fontStyle: 'normal',
    })
  })

  it('byte-identity (TPLREND-05): italic template with no overrides → fontStyle italic', () => {
    const result = resolveHookTypography(undefined, undefined, italicTemplate)
    expect(result.fontStyle).toBe('italic')
    expect(result.textTransform).toBe('none')
  })

  it('overrides.hook_text_transform = none un-caps a template-uppercase hook', () => {
    const overrides: SlideStyleOverrides = { hook_text_transform: 'none' }
    const result = resolveHookTypography(overrides, undefined, highlightBar)
    expect(result.textTransform).toBe('none')
  })

  it('overrides.hook_text_transform = uppercase forces caps on a normal-hookStyle template', () => {
    const overrides: SlideStyleOverrides = { hook_text_transform: 'uppercase' }
    const result = resolveHookTypography(overrides, undefined, editorialSerif)
    expect(result.textTransform).toBe('uppercase')
  })

  it('overrides.hook_font_family wins over the template font family', () => {
    const overrides: SlideStyleOverrides = { hook_font_family: "'Bebas Neue', sans-serif" }
    const result = resolveHookTypography(overrides, undefined, highlightBar)
    expect(result.fontFamily).toBe("'Bebas Neue', sans-serif")
  })

  it('hookTextBox.text_transform applies when overrides.hook_text_transform is absent (defense-in-depth)', () => {
    const hookBox: TextBox = {
      id: 'h1',
      role: 'hook',
      text: 'Mixed Case Hook',
      text_transform: 'none',
      position: { anchor: 'top' },
    }
    const result = resolveHookTypography(undefined, hookBox, highlightBar)
    expect(result.textTransform).toBe('none')
  })

  it('precedence: explicit override wins over TextBox field wins over the WYSIWYG default', () => {
    const hookBox: TextBox = {
      id: 'h1',
      role: 'hook',
      text: 'Hook',
      text_transform: 'uppercase',
      position: { anchor: 'top' },
    }
    // override 'none' beats TextBox 'uppercase'.
    const overrides: SlideStyleOverrides = { hook_text_transform: 'none' }
    expect(
      resolveHookTypography(overrides, hookBox, highlightBar).textTransform,
    ).toBe('none')
    // With no override, the TextBox field (opt-in Uppercase toggle) wins over
    // the WYSIWYG default.
    expect(
      resolveHookTypography(undefined, hookBox, highlightBar).textTransform,
    ).toBe('uppercase')
    // quick-260515-o75: with neither, the default is now 'none' (WYSIWYG) —
    // a template's hookStyle:'uppercase' no longer force-caps stored text.
    expect(
      resolveHookTypography(undefined, undefined, highlightBar).textTransform,
    ).toBe('none')
  })

  it('threat T-o75-01: a malformed text_transform value degrades to the WYSIWYG default', () => {
    const overrides = { hook_text_transform: 'evil(); drop table' } as unknown as SlideStyleOverrides
    // Falls through to the new 'none' default — degrades to WYSIWYG, never
    // injects arbitrary CSS. Holds regardless of the template's hookStyle.
    expect(
      resolveHookTypography(overrides, undefined, highlightBar).textTransform,
    ).toBe('none')
    expect(
      resolveHookTypography(overrides, undefined, editorialSerif).textTransform,
    ).toBe('none')
  })
})

describe('text-box-adapter — text_transform dual-write round-trip', () => {
  it('deriving a slice from a hook box with text_transform set produces hook_text_transform in the patch', () => {
    const hookBox: TextBox = {
      id: 'h1',
      role: 'hook',
      text: 'Hook',
      text_transform: 'none',
      position: { anchor: 'top' },
    }
    const bodyBox: TextBox = {
      id: 'b1',
      role: 'body',
      text: 'Body',
      position: { anchor: 'bottom' },
    }
    const slice = textBoxesToLegacy([hookBox, bodyBox])
    expect(slice.style_overrides_patch.hook_text_transform).toBe('none')
  })

  it('a hook box without text_transform leaves hook_text_transform absent from the patch', () => {
    const hookBox: TextBox = {
      id: 'h1',
      role: 'hook',
      text: 'Hook',
      position: { anchor: 'top' },
    }
    const slice = textBoxesToLegacy([hookBox])
    expect('hook_text_transform' in slice.style_overrides_patch).toBe(false)
  })
})
