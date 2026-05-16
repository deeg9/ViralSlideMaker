// quick-260515-nhf — render-path parity for hook typography.
//
// =====================================================================
// What this test pins
// =====================================================================
// Before this quick task the Satori PNG export (`buildSlideElement`) and
// the HTML export (`buildSlideHtml`) each derived hook casing + font family
// divergently from the editor canvas:
//
//   - Satori hardcoded `template.headingFontFamily ?? template.fontFamily`
//     for the hook and IGNORED `overrides.hook_font_family` — a user's hook
//     font pick survived on the editor canvas but silently reverted in the
//     exported PNG (a direct TPLREND-05 violation).
//   - Casing came straight from `template.hookStyle` with NO override path:
//     a template's `hookStyle: 'uppercase'` force-capped the hook and the
//     inspector had nothing it could write to undo it.
//
// All three render paths now resolve hook casing/font/style through the
// single shared `resolveHookTypography` helper. This file pins:
//   1. A hook box with `hook_font_family` override → the Satori export emits
//      that font family on the hook div (the export-parity bug fix).
//   2. A hook box with `hook_text_transform: 'none'` on an uppercase
//      template → neither export force-caps the hook.
//   3. A no-override slide → both exports emit a STABLE hook font-family
//      (TPLREND-05 byte-identity for fonts).
//
// quick-260515-o75 — hook casing is now WYSIWYG; a template's
// `hookStyle: 'uppercase'` no longer force-caps stored hook text. The
// no-override casing assertions below were inverted FROM "force-caps" TO
// "renders as stored" — this is the intended fix, not a regression. Casing
// byte-identity to the pre-o75 (force-capped) output is intentionally NOT
// preserved (user-accepted). Font-family / font-size assertions are
// unchanged and stay load-bearing.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { buildSlideHtml } from '@/lib/render/render-slide'
import { highlightBar } from '@/lib/render/templates/highlight-bar'
import type { Slide } from '@/lib/types/slide'

const OVERRIDE_FONT = "'Bebas Neue', sans-serif"

// highlight-bar: hookStyle 'uppercase', fontFamily 'Inter', no headingFontFamily.
function makeSlide(over?: Partial<Slide['style_overrides']>): Slide {
  return {
    hook_text: 'mixed case hook',
    body_text: 'body copy',
    image_query: 'nhf-fixture',
    is_cta: false,
    background_url: 'https://example.com/nhf-bg.jpg',
    pexels_photo_id: 1,
    style_overrides: over ? { ...over } : undefined,
    text_boxes: [
      { id: 'tb-h', role: 'hook', text: 'mixed case hook', position: { anchor: 'top' } },
      { id: 'tb-b', role: 'body', text: 'body copy', position: { anchor: 'bottom' } },
    ],
  }
}

describe('quick-260515-nhf: hook typography render-path parity', () => {
  it('Satori export honors overrides.hook_font_family on the hook div', () => {
    const html = renderToStaticMarkup(
      buildSlideElement(makeSlide({ hook_font_family: OVERRIDE_FONT }), highlightBar),
    )
    // The hook style div now carries the override font (was hardcoded Inter).
    expect(html).toContain('Bebas Neue')
  })

  it('Satori export with NO hook_font_family override keeps the template hook font', () => {
    const html = renderToStaticMarkup(buildSlideElement(makeSlide(), highlightBar))
    // highlight-bar fontFamily is 'Inter'; no headingFontFamily declared.
    expect(html).toContain('Inter')
    expect(html).not.toContain('Bebas Neue')
  })

  it('Satori export: hook is WYSIWYG by default; hook_text_transform:uppercase opts into caps', () => {
    // quick-260515-o75: a no-override slide on an uppercase-hookStyle template
    // NO LONGER force-caps — the hook renders exactly as stored.
    const wysiwyg = renderToStaticMarkup(buildSlideElement(makeSlide(), highlightBar))
    // Opt-in: a hook TextBox with text_transform:'uppercase' DOES force-cap.
    const optIn = renderToStaticMarkup(
      buildSlideElement(makeSlide({ hook_text_transform: 'uppercase' }), highlightBar),
    )
    // (body never had text-transform, so any occurrence below is the hook.)
    expect(wysiwyg).not.toContain('text-transform:uppercase')
    expect(optIn).toContain('text-transform:uppercase')
  })

  it('byte-identity (TPLREND-05): no-override Satori export is stable', () => {
    const a = renderToStaticMarkup(buildSlideElement(makeSlide(), highlightBar))
    const b = renderToStaticMarkup(buildSlideElement(makeSlide(), highlightBar))
    expect(a).toBe(b)
  })

  it('HTML export honors hook_font_family override on the .hook rule', () => {
    const html = buildSlideHtml(makeSlide({ hook_font_family: OVERRIDE_FONT }), highlightBar)
    expect(html).toContain(`font-family: ${OVERRIDE_FONT}`)
  })

  it('byte-identity (TPLREND-05): HTML export emits NO explicit hook font-family when un-overridden', () => {
    const html = buildSlideHtml(makeSlide(), highlightBar)
    // The legacy HTML path leaves .hook with no font-family so it inherits
    // template.fontFamily from <body>. An explicit hook font-family is
    // emitted ONLY when the user overrode it.
    const hookRuleStart = html.indexOf('.hook {')
    const hookRuleEnd = html.indexOf('}', hookRuleStart)
    const hookRule = html.slice(hookRuleStart, hookRuleEnd)
    expect(hookRule).not.toContain('font-family')
  })

  it('HTML export: hook is WYSIWYG by default; hook_text_transform:uppercase opts into caps', () => {
    // quick-260515-o75: no-override slide on an uppercase template no longer
    // emits `text-transform: uppercase` on the .hook rule.
    const wysiwyg = buildSlideHtml(makeSlide(), highlightBar)
    const optIn = buildSlideHtml(makeSlide({ hook_text_transform: 'uppercase' }), highlightBar)
    expect(wysiwyg).not.toContain('text-transform: uppercase')
    expect(optIn).toContain('text-transform: uppercase')
  })
})

// =====================================================================
// quick-260515-o75 — the bug: a hook with a stored lowercase word renders
// uppercase on canvas / PNG / HTML. nhf shipped the override mechanism but
// left the DEFAULT as template-forced uppercase, so no-override slides (the
// common case) never changed. This group pins the no-override WYSIWYG fix.
// =====================================================================

// Mirrors the user's reported slide: a hook on the highlight-bar template
// (hookStyle:'uppercase') whose stored text ends in a deliberately lowercase
// word, with NO text_transform and NO hook_text_transform override.
function makeLowercaseWordSlide(over?: Partial<Slide['style_overrides']>): Slide {
  const hook = "THE CHIP WAR JUST GOT REAL: TRUMP'S NEW movie"
  return {
    hook_text: hook,
    body_text: 'body copy',
    image_query: 'o75-fixture',
    is_cta: false,
    background_url: 'https://example.com/o75-bg.jpg',
    pexels_photo_id: 1,
    style_overrides: over ? { ...over } : undefined,
    text_boxes: [
      { id: 'tb-h', role: 'hook', text: hook, position: { anchor: 'top' } },
      { id: 'tb-b', role: 'body', text: 'body copy', position: { anchor: 'bottom' } },
    ],
  }
}

describe('quick-260515-o75: stored lowercase hook word renders WYSIWYG', () => {
  it('Satori PNG export does NOT force-cap a no-override hook on an uppercase template', () => {
    const html = renderToStaticMarkup(
      buildSlideElement(makeLowercaseWordSlide(), highlightBar),
    )
    // The deliberately-lowercase word "movie" must survive: no forced caps.
    expect(html).not.toContain('text-transform:uppercase')
  })

  it('HTML export .hook rule carries NO text-transform:uppercase for a no-override hook', () => {
    const html = buildSlideHtml(makeLowercaseWordSlide(), highlightBar)
    const hookRuleStart = html.indexOf('.hook {')
    const hookRule = html.slice(hookRuleStart, html.indexOf('}', hookRuleStart))
    expect(hookRule).not.toContain('text-transform: uppercase')
  })

  it('opt-in: the SAME slide with hook_text_transform:uppercase DOES force-cap in both exports', () => {
    const optIn = makeLowercaseWordSlide({ hook_text_transform: 'uppercase' })
    const satori = renderToStaticMarkup(buildSlideElement(optIn, highlightBar))
    expect(satori).toContain('text-transform:uppercase')

    const html = buildSlideHtml(optIn, highlightBar)
    const hookRuleStart = html.indexOf('.hook {')
    const hookRule = html.slice(hookRuleStart, html.indexOf('}', hookRuleStart))
    expect(hookRule).toContain('text-transform: uppercase')
  })
})
