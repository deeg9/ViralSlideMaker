import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview, scaleFontSizeOnCorner, ROLE_FONT_BOUNDS } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

// phase-59-c3 (FONTSCALE-02, FONTSCALE-04): corner-resize font-scale invariants.
//
// FONTSCALE-02 — past-cap clamp: dragging beyond the role font cap (240 hook /
// 120 body / 120 custom) yields the cap value, NOT a value larger than the cap.
// Width keeps growing independently (clamped to [20, 100] in the dispatch).
//
// FONTSCALE-04 — hook-fit override: when style_overrides.hook_font_size is set,
// the renderer reads the override (slide-preview.tsx precedence chain) and
// IGNORES the auto-shrink registry. Corner-drag writes through this same field.

describe('Phase 59 (FONTSCALE-02): scaleFontSizeOnCorner past-cap clamp', () => {
  it('widthRatio=1.0 leaves font_size unchanged', () => {
    expect(scaleFontSizeOnCorner(48, 864, 864, 'hook')).toBe(48)
    expect(scaleFontSizeOnCorner(24, 480, 480, 'body')).toBe(24)
  })

  it('widthRatio=1.25 scales hook 48 -> 60 (proportional)', () => {
    expect(scaleFontSizeOnCorner(48, 864, 1080, 'hook')).toBe(60)
  })

  it('FONTSCALE-02: widthRatio=1.5 from oldFontSize=240 (hook cap) yields 240 (clamped, not 360)', () => {
    expect(scaleFontSizeOnCorner(240, 864, 1296, 'hook')).toBe(240)
    expect(scaleFontSizeOnCorner(120, 480, 720, 'body')).toBe(120)
    expect(scaleFontSizeOnCorner(120, 480, 720, 'custom')).toBe(120)
  })

  it('FONTSCALE-02: widthRatio=0.5 from oldFontSize=20 (hook) yields 16 (clamped to role min, not 10)', () => {
    expect(scaleFontSizeOnCorner(20, 800, 400, 'hook')).toBe(16)
    expect(scaleFontSizeOnCorner(20, 800, 400, 'body')).toBe(14)
  })

  it('Role bounds match ActiveTextBoxCard slider min/max', () => {
    expect(ROLE_FONT_BOUNDS.hook).toEqual({ min: 16, max: 240 })
    expect(ROLE_FONT_BOUNDS.body).toEqual({ min: 14, max: 120 })
    expect(ROLE_FONT_BOUNDS.custom).toEqual({ min: 14, max: 120 })
  })
})

describe('Phase 59 (FONTSCALE-04): hook-fit auto-shrink override regression', () => {
  it('Corner-drag override writes style_overrides.hook_font_size; renderer reads it (NOT the auto-shrink)', () => {
    // 14-char hook on a template with hook-fit registry would normally auto-shrink.
    // The override at style_overrides.hook_font_size MUST win.
    const slide: Slide = {
      hook_text: 'STOP SCROLLING',  // 14 chars — would trigger hook-fit on news-drop
      body_text: 'Body',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      style_overrides: { hook_font_size: 80 },  // explicit override (corner-drag dispatch shape)
    }
    slide.text_boxes = legacyToTextBoxes(slide)

    // Pick a template with a hook-fit registry entry — news-drop is the canonical
    // example per CONTEXT.md FONTSCALE-04 spec. If 'news-drop' isn't a registered
    // template id, fall back to any template with hookFontSize defined.
    let template
    try {
      template = getTemplate('news-drop')
    } catch {
      template = getTemplate('highlight-bar')  // fallback — any template works since the override-wins logic is template-agnostic
    }

    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        editable={false}   // non-editable branch reads the override too — Satori parity
      />,
    )

    // The hook is rendered as a <p> with inline fontSize style. Find it via the
    // text content and assert the inline style contains '80px'.
    const hookEl = screen.getByText(/STOP SCROLLING/i)
    // Walk to the styled <p> ancestor (or the element itself if it carries the style)
    const styled = hookEl.tagName === 'P' ? hookEl : hookEl.closest('p') ?? hookEl.parentElement
    expect(styled).not.toBeNull()
    const fontSize = (styled as HTMLElement).style.fontSize
    expect(fontSize).toBe('80px')
  })

  it('Without override, renderer falls back to template default or hook-fit shrink (control)', () => {
    // No style_overrides.hook_font_size → renderer uses autoFitHookSize ?? baseHookSize.
    // We don't assert the exact value (template-dependent); we only assert it is NOT 80
    // (i.e., the override path is the only way to land on 80).
    const slide: Slide = {
      hook_text: 'STOP SCROLLING',
      body_text: 'Body',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
      // no style_overrides — fallback path
    }
    slide.text_boxes = legacyToTextBoxes(slide)
    let template
    try {
      template = getTemplate('news-drop')
    } catch {
      template = getTemplate('highlight-bar')
    }

    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        editable={false}
      />,
    )

    const hookEl = screen.getByText(/STOP SCROLLING/i)
    const styled = hookEl.tagName === 'P' ? hookEl : hookEl.closest('p') ?? hookEl.parentElement
    const fontSize = (styled as HTMLElement).style.fontSize
    // The control assertion: if the override path were broken and silently
    // emitted '80px' for the no-override case too, we'd see it here. Assert
    // the inline fontSize is a px value parseable to a number, and is NOT 80.
    expect(fontSize).toMatch(/\d+px/)
    expect(fontSize).not.toBe('80px')
  })
})
