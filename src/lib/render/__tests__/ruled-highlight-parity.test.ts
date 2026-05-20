/**
 * quick-260520-064 Task 5: 3-surface render-parity coverage for the 'ruled'
 * highlight kicker (the news-oracle BREAKING NEWS replacement).
 *
 * Each test renders a fixture slide through one of three paths and asserts
 * STRUCTURAL parity (not byte-identity — Satori and HTML inherently emit
 * divergent markup):
 *   - Canvas (slide-preview.tsx via @testing-library/react)
 *   - Satori (buildSlideElement — walk the React-element tree, no rasterization)
 *   - HTML (buildSlideHtml — assert on the serialized HTML string)
 *
 * Surface coverage for:
 *   - Cases 1-3: positive happy path × 3 surfaces (Y, rules, gap, text)
 *   - Case 4: negative opt-out (accessory_label === '')
 *   - Case 5: live-Y end-to-end (Blocker 1)
 *   - Case 6: cc.enabled gate end-to-end (Blocker 2)
 *   - Case 7: rule color follows tb.color (Warning 4)
 *   - Case 8: hook/body 'ruled' safety — plain text, no rules, no pill (Warning 5)
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { buildSlideHtml } from '@/lib/render/render-slide'
import { newsOracle } from '@/lib/render/templates/news-oracle'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import {
  RULED_HIGHLIGHT,
  ruledHighlightTopPctFromCaptionCardY,
  liveCaptionCardTopPct,
} from '@/lib/render/ruled-highlight'
import type { Slide, SlideStyleOverrides, TextBox } from '@/lib/types/slide'

/** Build a news-oracle cover slide for the parity tests. */
function newsCoverFixture(
  styleOverrides: SlideStyleOverrides = { caption_bar_enabled: true },
  extra: Partial<Slide> & { accessory_label?: string | undefined } = {},
): Slide {
  const slide: Slide = {
    hook_text: 'ORACLE CUTS 30,000 JOBS',
    body_text: '',
    image_query: 'tech layoffs',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    style_overrides: styleOverrides,
    ...(({ role: 'cover' } as unknown) as Partial<Slide>),
    ...extra,
  }
  // Apply the same migration the editor mount + AI ingest paths do: populate
  // text_boxes via the template-aware adapter, then mirror to custom_texts so
  // the renderers (which iterate slide.custom_texts) see the kicker.
  const tbs = legacyToTextBoxes(slide, newsOracle)
  slide.text_boxes = tbs
  // Mirror text_boxes → custom_texts (role='custom' only) so renderers paint
  // the kicker on first render — same pattern as use-slide-editor.ts.
  slide.custom_texts = tbs
    .filter((tb) => tb.role === 'custom')
    .map((tb) => ({
      id: tb.id,
      text: tb.text,
      x: tb.position.x ?? 0,
      y: tb.position.y ?? 0,
      width: tb.position.width ?? 60,
      ...(tb.font_family !== undefined ? { font_family: tb.font_family } : {}),
      ...(tb.font_size !== undefined ? { font_size: tb.font_size } : {}),
      ...(tb.font_weight !== undefined ? { font_weight: tb.font_weight } : {}),
      ...(tb.color !== undefined ? { color: tb.color } : {}),
      ...(tb.text_align !== undefined ? { text_align: tb.text_align } : {}),
      ...(tb.effects !== undefined ? { text_effects: tb.effects } : {}),
    }))
  return slide
}

/** Recursive Satori element-tree flatten (mirrors caption-card-render-parity). */
function walk(node: unknown): unknown[] {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) {
    const out: unknown[] = []
    for (const k of node) out.push(...walk(k))
    return out
  }
  const out: unknown[] = [node]
  const kids = (node as { props?: { children?: unknown } }).props?.children
  if (Array.isArray(kids)) {
    for (const k of kids) out.push(...walk(k))
  } else if (kids != null) {
    out.push(...walk(kids))
  }
  return out
}

describe('quick-260520-064 — 3-surface ruled-kicker parity', () => {
  // ---------------------------------------------------------------------
  // Case 1: Canvas (SlidePreview editable={false})
  // ---------------------------------------------------------------------
  describe('Case 1 — Canvas (slide-preview.tsx)', () => {
    it('1a. renders BREAKING NEWS text', () => {
      const slide = newsCoverFixture()
      const { container } = render(
        React.createElement(SlidePreview, {
          slide,
          template: newsOracle,
          index: 0,
          editable: false,
        }),
      )
      expect(container.textContent).toContain('BREAKING NEWS')
    })

    it('1b. emits exactly TWO flanking rules at 96×2 px (positive class)', () => {
      const slide = newsCoverFixture()
      const { container } = render(
        React.createElement(SlidePreview, {
          slide,
          template: newsOracle,
          index: 0,
          editable: false,
        }),
      )
      // Find divs with the ruled rule geometry — width:96px AND height:2px.
      const allDivs = Array.from(container.querySelectorAll('div'))
      const rules = allDivs.filter(
        (d) => d.style.width === '96px' && d.style.height === '2px',
      )
      expect(rules.length).toBe(2)
    })

    it('1c. container Y matches liveCaptionCardTopPct → ruledHighlightTopPctFromCaptionCardY', () => {
      const slide = newsCoverFixture({ caption_bar_enabled: true })
      const { container } = render(
        React.createElement(SlidePreview, {
          slide,
          template: newsOracle,
          index: 0,
          editable: false,
        }),
      )
      const expectedY = ruledHighlightTopPctFromCaptionCardY(
        liveCaptionCardTopPct(slide.style_overrides, newsOracle),
      )
      // The kicker container's `top` should be expectedY%. Find the container
      // by locating the BREAKING NEWS text and walking up to the absolute-positioned div.
      const kickerSpan = Array.from(container.querySelectorAll('span,div')).find(
        (el) => el.textContent === 'BREAKING NEWS',
      )
      expect(kickerSpan).toBeDefined()
      let cursor: HTMLElement | null = kickerSpan as HTMLElement | null
      while (cursor && cursor.style.position !== 'absolute') {
        cursor = cursor.parentElement
      }
      expect(cursor).not.toBeNull()
      const topStyle = cursor!.style.top // '<num>%'
      const topPct = parseFloat(topStyle.replace('%', ''))
      expect(topPct).toBeCloseTo(expectedY, 1)
    })
  })

  // ---------------------------------------------------------------------
  // Case 2: Satori (buildSlideElement — React-element tree)
  // ---------------------------------------------------------------------
  describe('Case 2 — Satori (buildSlideElement)', () => {
    it('2a. React-element tree contains BREAKING NEWS', () => {
      const slide = newsCoverFixture()
      const tree = buildSlideElement(slide, newsOracle)
      const all = walk(tree)
      const hit = all.find((n) => {
        const props = (n as { props?: { children?: unknown } }).props
        return props?.children === 'BREAKING NEWS'
      })
      expect(hit).toBeDefined()
    })

    it('2b. exactly TWO rule divs (96 × 2) flank the kicker text', () => {
      const slide = newsCoverFixture()
      const tree = buildSlideElement(slide, newsOracle)
      const all = walk(tree)
      const rules = all.filter((n) => {
        const style = (n as { props?: { style?: { width?: unknown; height?: unknown } } })
          .props?.style
        return (
          style?.width === RULED_HIGHLIGHT.lineLengthPx &&
          style?.height === RULED_HIGHLIGHT.lineThicknessPx
        )
      })
      expect(rules.length).toBe(2)
    })
  })

  // ---------------------------------------------------------------------
  // Case 3: HTML (buildSlideHtml — serialized string)
  // ---------------------------------------------------------------------
  describe('Case 3 — HTML (buildSlideHtml)', () => {
    it('3a. HTML string contains >BREAKING NEWS<', () => {
      const slide = newsCoverFixture()
      const html = buildSlideHtml(slide, newsOracle)
      expect(html).toContain('>BREAKING NEWS<')
    })

    it('3b. emits TWO rule divs with width:96px height:2px background-color:#ffffff', () => {
      const slide = newsCoverFixture()
      const html = buildSlideHtml(slide, newsOracle)
      // newsOracle.textColor = '#ffffff'. The rule fill must match.
      const ruleRegex = /width:96px[^"]*height:2px[^"]*background-color:#ffffff/gi
      const matches = html.match(ruleRegex) ?? []
      expect(matches.length).toBe(2)
    })

    it('3c. contains gap:16px on the kicker container', () => {
      const slide = newsCoverFixture()
      const html = buildSlideHtml(slide, newsOracle)
      expect(html).toContain(`gap:${RULED_HIGHLIGHT.lineGapPx}px`)
    })
  })

  // ---------------------------------------------------------------------
  // Case 4: Negative — accessory_label === '' opts out on all surfaces
  // ---------------------------------------------------------------------
  describe('Case 4 — opt-out (accessory_label === "") on all three surfaces', () => {
    it('4a. Canvas: no BREAKING NEWS text', () => {
      const slide = newsCoverFixture({ caption_bar_enabled: true }, {
        accessory_label: '',
      })
      const { container } = render(
        React.createElement(SlidePreview, {
          slide,
          template: newsOracle,
          index: 0,
          editable: false,
        }),
      )
      expect(container.textContent).not.toContain('BREAKING NEWS')
    })

    it('4b. Satori: no BREAKING NEWS text', () => {
      const slide = newsCoverFixture({ caption_bar_enabled: true }, {
        accessory_label: '',
      })
      const tree = buildSlideElement(slide, newsOracle)
      const all = walk(tree)
      const hit = all.find((n) => {
        const props = (n as { props?: { children?: unknown } }).props
        return props?.children === 'BREAKING NEWS'
      })
      expect(hit).toBeUndefined()
    })

    it('4c. HTML: no BREAKING NEWS text', () => {
      const slide = newsCoverFixture({ caption_bar_enabled: true }, {
        accessory_label: '',
      })
      const html = buildSlideHtml(slide, newsOracle)
      expect(html).not.toContain('BREAKING NEWS')
    })
  })

  // ---------------------------------------------------------------------
  // Case 5: live-Y end-to-end (Blocker 1)
  // ---------------------------------------------------------------------
  describe('Case 5 — live-Y end-to-end (Blocker 1 surface coverage)', () => {
    it('5a. Canvas: kicker top tracks caption_bar_y=70', () => {
      const slide = newsCoverFixture({ caption_bar_enabled: true, caption_bar_y: 70 })
      const { container } = render(
        React.createElement(SlidePreview, {
          slide,
          template: newsOracle,
          index: 0,
          editable: false,
        }),
      )
      const kickerSpan = Array.from(container.querySelectorAll('span,div')).find(
        (el) => el.textContent === 'BREAKING NEWS',
      )
      expect(kickerSpan).toBeDefined()
      let cursor: HTMLElement | null = kickerSpan as HTMLElement | null
      while (cursor && cursor.style.position !== 'absolute') {
        cursor = cursor.parentElement
      }
      expect(cursor).not.toBeNull()
      const topPct = parseFloat(cursor!.style.top.replace('%', ''))
      expect(topPct).toBeCloseTo(ruledHighlightTopPctFromCaptionCardY(70), 1)
    })

    it('5b. HTML: kicker top% matches ruledHighlightTopPctFromCaptionCardY(70)', () => {
      const slide = newsCoverFixture({ caption_bar_enabled: true, caption_bar_y: 70 })
      const html = buildSlideHtml(slide, newsOracle)
      const expected = ruledHighlightTopPctFromCaptionCardY(70)
      // Match the `top:` part of the kicker custom-text div.
      // Tolerant: 4 decimals; the adapter writes the y% verbatim into custom_texts.y.
      const topRegex = /top:([\d.]+)%[^"]*display:flex[^"]*gap:16px/
      const match = html.match(topRegex)
      expect(match).not.toBeNull()
      const topPct = parseFloat(match![1])
      expect(topPct).toBeCloseTo(expected, 4)
    })
  })

  // ---------------------------------------------------------------------
  // Case 6: cc.enabled gate end-to-end (Blocker 2)
  // ---------------------------------------------------------------------
  describe('Case 6 — cc.enabled gate end-to-end (Blocker 2 surface coverage)', () => {
    it('6a. Canvas: no kicker when caption_bar_enabled === false', () => {
      const slide = newsCoverFixture({ caption_bar_enabled: false })
      const { container } = render(
        React.createElement(SlidePreview, {
          slide,
          template: newsOracle,
          index: 0,
          editable: false,
        }),
      )
      expect(container.textContent).not.toContain('BREAKING NEWS')
    })

    it('6b. Satori: no kicker when caption_bar_enabled === false', () => {
      const slide = newsCoverFixture({ caption_bar_enabled: false })
      const tree = buildSlideElement(slide, newsOracle)
      const all = walk(tree)
      const hit = all.find((n) => {
        const props = (n as { props?: { children?: unknown } }).props
        return props?.children === 'BREAKING NEWS'
      })
      expect(hit).toBeUndefined()
    })

    it('6c. HTML: no kicker when caption_bar_enabled === false', () => {
      const slide = newsCoverFixture({ caption_bar_enabled: false })
      const html = buildSlideHtml(slide, newsOracle)
      expect(html).not.toContain('BREAKING NEWS')
    })
  })

  // ---------------------------------------------------------------------
  // Case 7: Rule color follows tb.color, NOT effects.highlight.color (Warning 4)
  // ---------------------------------------------------------------------
  describe('Case 7 — rule color follows tb.color (Warning 4)', () => {
    /**
     * Hand-roll a TextBox with tb.color !== effects.highlight.color so we can
     * prove the renderers paint rules in tb.color.
     */
    function handRolledRedKickerSlide(): Slide {
      const slide: Slide = {
        hook_text: 'HOOK',
        body_text: '',
        image_query: 'q',
        is_cta: false,
        background_url: null,
        pexels_photo_id: null,
      }
      const kicker: TextBox = {
        id: 'kicker-red',
        role: 'custom',
        text: 'TEST KICKER',
        font_family: newsOracle.fontFamily,
        font_size: RULED_HIGHLIGHT.fontSizePx,
        font_weight: 400,
        text_transform: 'uppercase',
        text_align: 'center',
        color: '#FF0000',
        effects: {
          highlight: {
            enabled: true,
            color: '#00FF00', // explicit green; renderers must NOT use this for rules
            style: 'ruled',
            padding: 16,
          },
        },
        position: { anchor: 'custom', x: 0, y: 50, width: 100 },
      }
      slide.text_boxes = [kicker]
      slide.custom_texts = [
        {
          id: kicker.id,
          text: kicker.text,
          x: 0,
          y: 50,
          width: 100,
          font_family: kicker.font_family,
          font_size: kicker.font_size,
          font_weight: kicker.font_weight,
          color: kicker.color,
          text_align: kicker.text_align,
          text_effects: kicker.effects,
        },
      ]
      return slide
    }

    it('7a. HTML: rules carry background-color:#ff0000 (TEXT color), not #00ff00 (highlight.color)', () => {
      const slide = handRolledRedKickerSlide()
      const html = buildSlideHtml(slide, newsOracle)
      expect(html).toContain('>TEST KICKER<')
      // 2 rule divs in tb.color (#FF0000 — adapter wrote #FF0000, renderer
      // lowercases on string interpolation depending on browser/satori — but
      // we wrote the literal '#FF0000' through; assert case-insensitive).
      const redRules =
        html.match(/width:96px[^"]*height:2px[^"]*background-color:#FF0000/gi) ?? []
      expect(redRules.length).toBe(2)
      // No rule div should be painted in the highlight.color (#00FF00).
      const greenRules =
        html.match(/width:96px[^"]*height:2px[^"]*background-color:#00FF00/gi) ?? []
      expect(greenRules.length).toBe(0)
    })
  })

  // ---------------------------------------------------------------------
  // Case 8: Hook/body 'ruled' fall-through safety (Warning 5)
  // ---------------------------------------------------------------------
  describe("Case 8 — hook/body 'ruled' safety (Warning 5)", () => {
    /** Hand-roll a slide with a HOOK box carrying style: 'ruled'. */
    function hookRuledSlide(): Slide {
      const slide: Slide = {
        hook_text: 'A HOOK',
        body_text: '',
        image_query: 'q',
        is_cta: false,
        background_url: null,
        pexels_photo_id: null,
        style_overrides: {
          hook_text_effects: {
            highlight: { enabled: true, color: '#000000CC', style: 'ruled', padding: 16 },
          },
        },
      }
      slide.text_boxes = [
        {
          id: 'hook-id',
          role: 'hook',
          text: 'A HOOK',
          effects: {
            highlight: { enabled: true, color: '#000000CC', style: 'ruled', padding: 16 },
          },
          position: { anchor: 'top' },
        },
      ]
      return slide
    }

    /** Hand-roll a slide with a BODY box carrying style: 'ruled'. */
    function bodyRuledSlide(): Slide {
      const slide: Slide = {
        hook_text: 'A HOOK',
        body_text: 'A BODY',
        image_query: 'q',
        is_cta: false,
        background_url: null,
        pexels_photo_id: null,
        style_overrides: {
          body_text_effects: {
            highlight: { enabled: true, color: '#000000CC', style: 'ruled', padding: 16 },
          },
        },
      }
      slide.text_boxes = [
        { id: 'h', role: 'hook', text: 'A HOOK', position: { anchor: 'top' } },
        {
          id: 'b',
          role: 'body',
          text: 'A BODY',
          effects: {
            highlight: { enabled: true, color: '#000000CC', style: 'ruled', padding: 16 },
          },
          position: { anchor: 'bottom' },
        },
      ]
      return slide
    }

    it('8a. HTML hook with style: "ruled" renders plain text, ZERO rule divs', () => {
      const slide = hookRuledSlide()
      let html = ''
      expect(() => {
        html = buildSlideHtml(slide, newsOracle)
      }).not.toThrow()
      // Hook text present.
      expect(html).toContain('A HOOK')
      // ZERO ruled-geometry rule divs (no 96×2 rules in the .hook block).
      const rules = html.match(/width:96px[^"]*height:2px/gi) ?? []
      expect(rules.length).toBe(0)
      // W3 lock-down: NO background-color pill smuggled from the existing
      // tight/full branch — the hook container must NOT carry the highlight
      // color (#000000CC or its rgba form) as a background-color.
      expect(html).not.toMatch(/background-color:#000000CC/i)
      expect(html).not.toMatch(/background-color:\s*rgba\(0,\s*0,\s*0,\s*0\.8\)/i)
    })

    it('8b. HTML body with style: "ruled" renders plain text, ZERO rule divs', () => {
      const slide = bodyRuledSlide()
      let html = ''
      expect(() => {
        html = buildSlideHtml(slide, newsOracle)
      }).not.toThrow()
      expect(html).toContain('A BODY')
      const rules = html.match(/width:96px[^"]*height:2px/gi) ?? []
      expect(rules.length).toBe(0)
      // W3 lock-down: hook/body 'ruled' must not paint a background-color pill
      // from the tight/full branch on the body either.
      expect(html).not.toMatch(/background-color:#000000CC/i)
      expect(html).not.toMatch(/background-color:\s*rgba\(0,\s*0,\s*0,\s*0\.8\)/i)
    })
  })
})
