import { describe, test, expect } from 'vitest'
import type { Slide, TextBox } from '@/lib/types/slide'
import {
  legacyToTextBoxes,
  textBoxesToLegacy,
  type LegacySlice,
} from '@/lib/editor/text-box-adapter'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Reconstruct a slide from the original + the adapter's round-trip slice.
 * Mirrors what the production save path does: write text_boxes alongside the legacy fields,
 * deep-merging style_overrides_patch into the existing style_overrides.
 */
function applyLegacySlice(original: Slide, slice: LegacySlice): Slide {
  const merged: Slide = {
    ...original,
    hook_text: slice.hook_text,
    body_text: slice.body_text,
  }
  // segments: only set when present (legacy fields are optional)
  if (slice.hook_segments !== undefined) {
    merged.hook_segments = slice.hook_segments
  } else {
    delete (merged as Partial<Slide>).hook_segments
  }
  if (slice.body_segments !== undefined) {
    merged.body_segments = slice.body_segments
  } else {
    delete (merged as Partial<Slide>).body_segments
  }
  if (slice.custom_texts !== undefined) {
    merged.custom_texts = slice.custom_texts
  } else {
    delete (merged as Partial<Slide>).custom_texts
  }
  // Deep-merge style_overrides_patch into existing style_overrides.
  if (Object.keys(slice.style_overrides_patch).length > 0 || original.style_overrides) {
    merged.style_overrides = {
      ...(original.style_overrides ?? {}),
      ...slice.style_overrides_patch,
    }
  }
  return merged
}

/** Strip generated TextBox.id values for comparison. */
function stripBoxIds(slide: Slide): Slide {
  if (!slide.text_boxes) return slide
  return {
    ...slide,
    text_boxes: slide.text_boxes.map((tb) => ({ ...tb, id: 'STRIPPED' })),
  }
}

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

function shape1HookBodyOnly(): Slide {
  return {
    hook_text: 'Bold hook',
    body_text: 'Brief body line',
    image_query: 'mountain sunrise',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
}

function shape2HookBodyOneCustom(): Slide {
  return {
    hook_text: 'Hook here',
    body_text: 'Body here',
    image_query: 'office desk',
    is_cta: false,
    background_url: 'https://example.com/bg.jpg',
    pexels_photo_id: 12345,
    custom_texts: [
      {
        id: 'ct-fixed-1',
        text: 'Source: Forbes',
        x: 70,
        y: 90,
        width: 25,
        font_family: 'Inter',
        font_size: 24,
        font_weight: 500,
        color: '#888888',
        text_align: 'right',
      },
    ],
  }
}

function shape3HookBodyEffects(): Slide {
  return {
    hook_text: 'Stunning headline',
    body_text: 'Supporting body copy',
    image_query: 'busy street',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    style_overrides: {
      hook_text_color: '#ffffff',
      body_text_color: '#cccccc',
      hook_text_effects: {
        shadow: { enabled: true, color: '#00000080', size: 'lg' },
        outline: { enabled: true, color: '#000000', width: 3 },
      },
      body_text_effects: {
        highlight: { enabled: true, color: '#000000CC', style: 'tight', padding: 8 },
      },
      overlay_opacity: 35,
    },
  }
}

function shape4NewsAccentSegments(): Slide {
  return {
    hook_text: 'Markets surge as Fed pauses',
    body_text: 'Tech leads gains overnight',
    hook_segments: [
      { text: 'Markets ' },
      { text: 'surge', accent: true },
      { text: ' as Fed ' },
      { text: 'pauses', accent: true, highlightColor: '#A8E6CF', highlightStyle: 'pill' },
    ],
    body_segments: [
      { text: 'Tech ' },
      { text: 'leads', accent: true },
      { text: ' gains overnight' },
    ],
    image_query: 'stock market chart',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    style_overrides: {
      hook_font_size: 96,
      body_font_size: 56,
      text_color: '#0a0a0a',
      hook_text_color: '#0a0a0a',
      body_text_color: '#3d0000',
      text_align: 'left',
      layout: 'cover',
    },
  }
}

function shape5MagazineBoldOverlaysCustomTexts(): Slide {
  return {
    hook_text: 'THE BIG IDEA',
    body_text: 'A monthly deep-dive into ideas that move markets and minds.',
    image_query: 'editorial photo',
    is_cta: false,
    background_url: 'https://example.com/cover.jpg',
    pexels_photo_id: 4242,
    style_overrides: {
      hook_font_size: 144,
      body_font_size: 32,
      hook_font_weight: 900,
      body_font_weight: 400,
      hook_font_family: 'Playfair Display',
      body_font_family: 'Inter',
      hook_font_style: 'normal',
      body_font_style: 'italic',
      hook_text_color: '#ffffff',
      body_text_color: '#fefefe',
      hook_width: 80,
      body_width: 70,
      hook_position: { x: 10, y: 15 },
      body_position: { x: 15, y: 78 },
      overlay_opacity: 50,
      hide_watermark: true,
      hook_text_effects: {
        shadow: { enabled: true, color: '#000000B3', size: 'md' },
      },
    },
    custom_texts: [
      {
        id: 'ct-fixed-2',
        text: 'Issue 04 / 2026',
        x: 10,
        y: 6,
        width: 30,
        font_family: 'Inter',
        font_size: 18,
        font_weight: 600,
        color: '#ffffff',
        text_align: 'left',
      },
      {
        id: 'ct-fixed-3',
        text: 'Read inside →',
        x: 75,
        y: 92,
        width: 22,
        font_family: 'Inter',
        font_size: 20,
        font_weight: 700,
        color: '#ffffff',
        text_align: 'right',
        text_effects: {
          shadow: { enabled: true, color: '#000000CC', size: 'sm' },
        },
      },
    ],
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('text-box-adapter', () => {
  describe('legacyToTextBoxes → textBoxesToLegacy round-trip', () => {
    function assertRoundTrip(original: Slide) {
      const boxes = legacyToTextBoxes(original)
      const slice = textBoxesToLegacy(boxes)
      const reconstructed = applyLegacySlice(original, slice)

      // Compare without text_boxes (this round-trip is about legacy fields only)
      const originalForCmp: Slide = { ...original }
      delete (originalForCmp as Partial<Slide>).text_boxes
      const reconstructedForCmp: Slide = { ...reconstructed }
      delete (reconstructedForCmp as Partial<Slide>).text_boxes
      expect(reconstructedForCmp).toEqual(originalForCmp)
    }

    test('shape 1: hook + body only', () => {
      assertRoundTrip(shape1HookBodyOnly())
    })

    test('shape 2: hook + body + 1 custom_text', () => {
      assertRoundTrip(shape2HookBodyOneCustom())
    })

    test('shape 3: hook + body + shadow + outline effects', () => {
      assertRoundTrip(shape3HookBodyEffects())
    })

    test('shape 4: news template with accent segments + highlight pills', () => {
      assertRoundTrip(shape4NewsAccentSegments())
    })

    test('shape 5: magazine-bold with overlays + custom_texts + bottom-card style_overrides', () => {
      assertRoundTrip(shape5MagazineBoldOverlaysCustomTexts())
    })
  })

  describe('legacyToTextBoxes — derivation', () => {
    test('hook TextBox is at index 0 with role="hook"', () => {
      const boxes = legacyToTextBoxes(shape1HookBodyOnly())
      expect(boxes[0].role).toBe('hook')
      expect(boxes[0].text).toBe('Bold hook')
    })

    test('body TextBox is at index 1 with role="body"', () => {
      const boxes = legacyToTextBoxes(shape1HookBodyOnly())
      expect(boxes[1].role).toBe('body')
      expect(boxes[1].text).toBe('Brief body line')
    })

    test('custom_texts map to TextBoxes with role="custom" preserving order', () => {
      const boxes = legacyToTextBoxes(shape5MagazineBoldOverlaysCustomTexts())
      // boxes[0] hook, boxes[1] body, boxes[2..] customs in original order
      expect(boxes[2].role).toBe('custom')
      expect(boxes[2].text).toBe('Issue 04 / 2026')
      expect(boxes[3].role).toBe('custom')
      expect(boxes[3].text).toBe('Read inside →')
    })

    test('each TextBox gets a unique id', () => {
      const boxes = legacyToTextBoxes(shape5MagazineBoldOverlaysCustomTexts())
      const ids = boxes.map((b) => b.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
      expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
    })

    test('missing hook_text produces empty TextBox at index 0', () => {
      const slide: Slide = {
        ...shape1HookBodyOnly(),
        hook_text: '',
      }
      const boxes = legacyToTextBoxes(slide)
      expect(boxes[0].role).toBe('hook')
      expect(boxes[0].text).toBe('')
    })

    test('hook_position present → hook anchor is "custom"', () => {
      const boxes = legacyToTextBoxes(shape5MagazineBoldOverlaysCustomTexts())
      expect(boxes[0].position.anchor).toBe('custom')
      expect(boxes[0].position.x).toBe(10)
      expect(boxes[0].position.y).toBe(15)
      expect(boxes[0].position.width).toBe(80)
    })

    test('text_position absent → hook anchor "top", body anchor "bottom"', () => {
      const boxes = legacyToTextBoxes(shape1HookBodyOnly())
      expect(boxes[0].position.anchor).toBe('top')
      expect(boxes[1].position.anchor).toBe('bottom')
    })

    test('hook_text_effects copied to box.effects', () => {
      const boxes = legacyToTextBoxes(shape3HookBodyEffects())
      expect(boxes[0].effects?.shadow?.enabled).toBe(true)
      expect(boxes[0].effects?.outline?.enabled).toBe(true)
      expect(boxes[1].effects?.highlight?.enabled).toBe(true)
    })
  })

  describe('textBoxesToLegacy — inverse', () => {
    test('hook_text comes from role="hook" TextBox', () => {
      const boxes: TextBox[] = [
        { id: 'a', role: 'hook', text: 'My hook', position: { anchor: 'top' } },
        { id: 'b', role: 'body', text: 'My body', position: { anchor: 'bottom' } },
      ]
      const slice = textBoxesToLegacy(boxes)
      expect(slice.hook_text).toBe('My hook')
    })

    test('body_text comes from role="body" TextBox', () => {
      const boxes: TextBox[] = [
        { id: 'a', role: 'hook', text: 'My hook', position: { anchor: 'top' } },
        { id: 'b', role: 'body', text: 'My body', position: { anchor: 'bottom' } },
      ]
      const slice = textBoxesToLegacy(boxes)
      expect(slice.body_text).toBe('My body')
    })

    test('custom_texts come from role="custom" TextBoxes', () => {
      const boxes: TextBox[] = [
        { id: 'a', role: 'hook', text: 'h', position: { anchor: 'top' } },
        { id: 'b', role: 'body', text: 'b', position: { anchor: 'bottom' } },
        {
          id: 'c1',
          role: 'custom',
          text: 'foo',
          position: { anchor: 'custom', x: 10, y: 20, width: 30 },
        },
        {
          id: 'c2',
          role: 'custom',
          text: 'bar',
          position: { anchor: 'custom', x: 50, y: 60, width: 40 },
          color: '#ff0000',
        },
      ]
      const slice = textBoxesToLegacy(boxes)
      expect(slice.custom_texts).toBeDefined()
      expect(slice.custom_texts!.length).toBe(2)
      expect(slice.custom_texts![0].text).toBe('foo')
      expect(slice.custom_texts![1].text).toBe('bar')
      expect(slice.custom_texts![1].color).toBe('#ff0000')
    })

    test('style_overrides_patch contains hook_*/body_* derived fields', () => {
      const boxes: TextBox[] = [
        {
          id: 'a',
          role: 'hook',
          text: 'h',
          font_family: 'Inter',
          font_size: 88,
          font_weight: 800,
          color: '#fafafa',
          position: { anchor: 'top', width: 90 },
          effects: { shadow: { enabled: true, color: '#00000080', size: 'lg' } },
        },
        {
          id: 'b',
          role: 'body',
          text: 'b',
          font_family: 'Inter',
          font_size: 32,
          color: '#dddddd',
          position: { anchor: 'bottom' },
        },
      ]
      const slice = textBoxesToLegacy(boxes)
      expect(slice.style_overrides_patch.hook_font_family).toBe('Inter')
      expect(slice.style_overrides_patch.hook_font_size).toBe(88)
      expect(slice.style_overrides_patch.hook_font_weight).toBe(800)
      expect(slice.style_overrides_patch.hook_text_color).toBe('#fafafa')
      expect(slice.style_overrides_patch.hook_width).toBe(90)
      expect(slice.style_overrides_patch.hook_text_effects?.shadow?.enabled).toBe(true)
      expect(slice.style_overrides_patch.body_font_family).toBe('Inter')
      expect(slice.style_overrides_patch.body_font_size).toBe(32)
      expect(slice.style_overrides_patch.body_text_color).toBe('#dddddd')
    })

    test('extra TextBoxes beyond 1 hook + 1 body land in custom_texts as role-coerced entries', () => {
      const boxes: TextBox[] = [
        { id: 'h1', role: 'hook', text: 'first hook', position: { anchor: 'top' } },
        {
          id: 'h2',
          role: 'hook',
          text: 'second hook (becomes custom)',
          position: { anchor: 'custom', x: 5, y: 5, width: 50 },
        },
        { id: 'b1', role: 'body', text: 'body', position: { anchor: 'bottom' } },
        {
          id: 'c1',
          role: 'custom',
          text: 'a custom',
          position: { anchor: 'custom', x: 10, y: 20, width: 30 },
        },
      ]
      const slice = textBoxesToLegacy(boxes)
      expect(slice.hook_text).toBe('first hook')
      expect(slice.body_text).toBe('body')
      // Two extras: the second hook + the explicit custom box
      expect(slice.custom_texts).toBeDefined()
      expect(slice.custom_texts!.length).toBe(2)
      expect(slice.custom_texts![0].text).toBe('second hook (becomes custom)')
      expect(slice.custom_texts![1].text).toBe('a custom')
    })

    test('missing hook role produces hook_text=""', () => {
      const boxes: TextBox[] = [
        { id: 'b', role: 'body', text: 'body only', position: { anchor: 'bottom' } },
      ]
      const slice = textBoxesToLegacy(boxes)
      expect(slice.hook_text).toBe('')
      expect(slice.body_text).toBe('body only')
    })

    test('missing body role produces body_text=""', () => {
      const boxes: TextBox[] = [
        { id: 'h', role: 'hook', text: 'hook only', position: { anchor: 'top' } },
      ]
      const slice = textBoxesToLegacy(boxes)
      expect(slice.hook_text).toBe('hook only')
      expect(slice.body_text).toBe('')
    })
  })
})

// =====================================================================
// quick-260520-064 — accessory_label as kicker
// =====================================================================
// Coverage map:
//   - 8 baseline cases (D1 truth table)
//   - 5 live-Y cases (Blocker 1)
//   - 4 cc.enabled-gate cases (Blocker 2)
//   - 1 rule-color anti-assertion (Warning 4 — adapter-level companion to
//     the Task 5 render-surface coverage)
// =====================================================================

import { newsOracle } from '@/lib/render/templates/news-oracle'
import { chromePulse } from '@/lib/render/templates/chrome-pulse'
import {
  RULED_HIGHLIGHT,
  ruledHighlightTopPctFromCaptionCardY,
  liveCaptionCardTopPct,
} from '@/lib/render/ruled-highlight'
import { CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT } from '@/lib/render/hook-fit'

/** Build a minimal news-oracle cover slide for the kicker-injection tests. */
function newsCoverSlide(
  overrides: Partial<Slide> = {},
  styleOverrides: Slide['style_overrides'] = { caption_bar_enabled: true },
): Slide {
  return {
    hook_text: 'ORACLE CUTS 30,000 JOBS',
    body_text: '',
    image_query: 'tech layoffs',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    style_overrides: styleOverrides,
    // `role` is not on the Slide type but is read structurally by the
    // adapter (and the renderers). Cast for the test fixture.
    ...(({ role: 'cover' } as unknown) as Partial<Slide>),
    ...overrides,
  }
}

describe('quick-260520-064 — accessory_label as kicker', () => {
  describe('baseline truth table (D1)', () => {
    test('1. undefined accessory_label + news-oracle cover + caption_bar_enabled → BREAKING NEWS ruled kicker', () => {
      const slide = newsCoverSlide()
      const boxes = legacyToTextBoxes(slide, newsOracle)
      const kicker = boxes.find((b) => b.role === 'custom' && b.text === 'BREAKING NEWS')
      expect(kicker).toBeDefined()
      expect(kicker?.effects?.highlight).toEqual({
        enabled: true,
        color: newsOracle.textColor, // '#ffffff'
        style: 'ruled',
        padding: 16,
      })
      expect(kicker?.position.anchor).toBe('custom')
      // No Y-related overrides → cardTopPct = 100 - newsOracle.captionCardDefaults.heightPct (42).
      const expectedY = ruledHighlightTopPctFromCaptionCardY(
        liveCaptionCardTopPct(slide.style_overrides, newsOracle),
      )
      expect(kicker?.position.y).toBeCloseTo(expectedY, 4)
    })

    test('2. explicit empty accessory_label → no kicker (user opt-out)', () => {
      const slide = newsCoverSlide({ accessory_label: '' })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      expect(boxes.find((b) => b.role === 'custom')).toBeUndefined()
    })

    test('3. accessory_label="EXCLUSIVE" + news-oracle cover → custom ruled kicker', () => {
      const slide = newsCoverSlide({ accessory_label: 'EXCLUSIVE' })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      const kicker = boxes.find((b) => b.role === 'custom')
      expect(kicker?.text).toBe('EXCLUSIVE')
      expect(kicker?.effects?.highlight?.style).toBe('ruled')
      // News-oracle cover wins over the legacy TR3NDING tight default.
      expect(kicker?.color).toBe(newsOracle.textColor)
    })

    test('4. accessory_label="EXCLUSIVE" + non-news-oracle template → preserve TR3NDING tight pill', () => {
      const slide = newsCoverSlide({ accessory_label: 'EXCLUSIVE' })
      const boxes = legacyToTextBoxes(slide, chromePulse)
      const kicker = boxes.find((b) => b.role === 'custom')
      // Existing TR3NDING-pill defaults (unchanged behavior).
      expect(kicker?.text).toBe('EXCLUSIVE')
      expect(kicker?.effects?.highlight?.style).toBe('tight')
      expect(kicker?.color).toBe('#FFFFFF')
      expect(kicker?.effects?.highlight?.color).toBe('#000000CC')
      expect(kicker?.position).toEqual({ anchor: 'custom', x: 20, y: 3, width: 60 })
    })

    test('5. undefined accessory_label + news-oracle template + non-cover role → no kicker', () => {
      const slide = newsCoverSlide({
        ...(({ role: 'support' } as unknown) as Partial<Slide>),
      })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      expect(boxes.find((b) => b.role === 'custom')).toBeUndefined()
    })

    test('6. undefined accessory_label + non-news-oracle cover → no kicker (back-compat for other templates)', () => {
      const slide = newsCoverSlide()
      const boxes = legacyToTextBoxes(slide, chromePulse)
      expect(boxes.find((b) => b.role === 'custom')).toBeUndefined()
    })

    test('7. one-arg legacyToTextBoxes(slide) on news-oracle cover → no kicker (back-compat for ~30 test callers)', () => {
      const slide = newsCoverSlide()
      const boxes = legacyToTextBoxes(slide)
      expect(boxes.find((b) => b.role === 'custom')).toBeUndefined()
    })

    test('8. textBoxesToLegacy round-trip: dragged kicker survives to custom_texts', () => {
      const slide = newsCoverSlide()
      const boxes = legacyToTextBoxes(slide, newsOracle)
      const kicker = boxes.find((b) => b.role === 'custom')!
      // Simulate user dragging the kicker.
      kicker.position = { anchor: 'custom', x: 10, y: 50, width: 100 }
      const slice = textBoxesToLegacy(boxes)
      expect(slice.custom_texts).toBeDefined()
      expect(slice.custom_texts?.length).toBe(1)
      expect(slice.custom_texts?.[0].x).toBe(10)
      expect(slice.custom_texts?.[0].y).toBe(50)
      expect(slice.custom_texts?.[0].text).toBe('BREAKING NEWS')
    })
  })

  describe('live caption-card Y (Blocker 1)', () => {
    test('9. kicker Y follows user-edited caption_bar_y (drag)', () => {
      const slide = newsCoverSlide({}, { caption_bar_enabled: true, caption_bar_y: 70 })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      const kicker = boxes.find((b) => b.role === 'custom')!
      expect(kicker.position.y).toBeCloseTo(ruledHighlightTopPctFromCaptionCardY(70), 4)
    })

    test('10. kicker Y follows user-edited caption_bar_height_pct (bottom default)', () => {
      const slide = newsCoverSlide({}, { caption_bar_enabled: true, caption_bar_height_pct: 50 })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      const kicker = boxes.find((b) => b.role === 'custom')!
      // cardTopPct = 100 - heightPct = 50.
      expect(kicker.position.y).toBeCloseTo(ruledHighlightTopPctFromCaptionCardY(50), 4)
    })

    test("11. kicker Y honors caption_bar_position='top'", () => {
      const slide = newsCoverSlide({}, { caption_bar_enabled: true, caption_bar_position: 'top' })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      const kicker = boxes.find((b) => b.role === 'custom')!
      expect(kicker.position.y).toBeCloseTo(ruledHighlightTopPctFromCaptionCardY(0), 4)
    })

    test('12. kicker Y uses template-default heightPct when no overrides set', () => {
      const slide = newsCoverSlide({}, { caption_bar_enabled: true })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      const kicker = boxes.find((b) => b.role === 'custom')!
      const tplH =
        newsOracle.captionCardDefaults?.heightPct ?? CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT
      expect(kicker.position.y).toBeCloseTo(
        ruledHighlightTopPctFromCaptionCardY(100 - tplH),
        4,
      )
    })

    test('13. production-baseline live-Y (2026-05-20 — caption_bar_y=67.3, height=34)', () => {
      const slide = newsCoverSlide(
        {},
        { caption_bar_enabled: true, caption_bar_y: 67.3, caption_bar_height_pct: 34 },
      )
      const boxes = legacyToTextBoxes(slide, newsOracle)
      const kicker = boxes.find((b) => b.role === 'custom')!
      // Live Y must land at ruledHighlightTopPctFromCaptionCardY(67.3),
      // NOT the template-default Y derived from heightPct (the frozen-default
      // implementation would have un-anchored the kicker from the user-moved card).
      expect(kicker.position.y).toBeCloseTo(ruledHighlightTopPctFromCaptionCardY(67.3), 4)
      // W2 (anti-assertion): the template-default Y must NOT match — derive it
      // dynamically so this test stays correct if news-oracle's heightPct is
      // ever tweaked.
      const templateDefaultCardTop =
        100 - (newsOracle.captionCardDefaults?.heightPct ?? CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT)
      expect(kicker.position.y).not.toBeCloseTo(
        ruledHighlightTopPctFromCaptionCardY(templateDefaultCardTop),
        4,
      )
    })
  })

  describe('cc.enabled gate (Blocker 2)', () => {
    test('14. no kicker when caption_bar_enabled === false', () => {
      const slide = newsCoverSlide({}, { caption_bar_enabled: false })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      expect(boxes.find((b) => b.role === 'custom')).toBeUndefined()
    })

    test('15. no kicker when caption_bar_enabled is absent AND no layout (chrome was hidden)', () => {
      const slide = newsCoverSlide({}, {})
      const boxes = legacyToTextBoxes(slide, newsOracle)
      expect(boxes.find((b) => b.role === 'custom')).toBeUndefined()
    })

    test('16. kicker WHEN caption_bar_enabled === true (explicit enable)', () => {
      const slide = newsCoverSlide({}, { caption_bar_enabled: true })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      expect(boxes.find((b) => b.role === 'custom' && b.text === 'BREAKING NEWS')).toBeDefined()
    })

    test("17. kicker WHEN caption_bar_enabled is absent AND layout='cover' (news-layout default fires)", () => {
      const slide = newsCoverSlide({}, { layout: 'cover' })
      const boxes = legacyToTextBoxes(slide, newsOracle)
      expect(boxes.find((b) => b.role === 'custom' && b.text === 'BREAKING NEWS')).toBeDefined()
    })
  })

  describe('rule color (Warning 4)', () => {
    test('18. adapter writes color=template.textColor on the ruled kicker (rules paint in tb.color, NOT effects.highlight.color)', () => {
      const slide = newsCoverSlide()
      const boxes = legacyToTextBoxes(slide, newsOracle)
      const kicker = boxes.find((b) => b.role === 'custom' && b.text === 'BREAKING NEWS')!
      // Adapter wires tb.color = template.textColor; renderers paint rules in
      // that value. effects.highlight.color is informational only.
      expect(kicker.color).toBe(newsOracle.textColor)
      // Rule fontSize matches RULED_HIGHLIGHT geometry.
      expect(kicker.font_size).toBe(RULED_HIGHLIGHT.fontSizePx)
    })
  })
})
