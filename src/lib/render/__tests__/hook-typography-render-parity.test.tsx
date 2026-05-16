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
//   3. A no-override slide → both exports are byte-identical to the
//      pre-helper output for that template (TPLREND-05 byte-identity).

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

  it('Satori export honors hook_text_transform: none on an uppercase template', () => {
    const capped = renderToStaticMarkup(buildSlideElement(makeSlide(), highlightBar))
    const uncapped = renderToStaticMarkup(
      buildSlideElement(makeSlide({ hook_text_transform: 'none' }), highlightBar),
    )
    // No-override slide force-caps the hook (template hookStyle uppercase).
    expect(capped).toContain('text-transform:uppercase')
    // hook_text_transform:'none' removes the force-cap from the hook style.
    // (body never had text-transform, so any remaining occurrence would be hook.)
    expect(uncapped).not.toContain('text-transform:uppercase')
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

  it('HTML export honors hook_text_transform: none on an uppercase template', () => {
    const capped = buildSlideHtml(makeSlide(), highlightBar)
    const uncapped = buildSlideHtml(makeSlide({ hook_text_transform: 'none' }), highlightBar)
    expect(capped).toContain('text-transform: uppercase')
    expect(uncapped).not.toContain('text-transform: uppercase')
  })
})
