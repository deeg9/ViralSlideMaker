import { describe, it, expect } from 'vitest'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import type { SlideTemplate } from '@/lib/render/templates'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 45 — Satori snapshot tests for overlay composition, backgroundMode
 * branches, highlight pill rendering, and missing-ctx graceful fallback.
 *
 * Strategy: snapshot the React element tree returned by buildSlideElement —
 * NOT PNG bytes (pixel-diff is deferred to v3.0+). Tree-walk helpers extract
 * specific layers for targeted assertions on top of the snapshots.
 *
 * RED state expectation (Task 1):
 *   - buildSlideElement does NOT yet accept a 6th `ctx` parameter.
 *   - It does NOT emit overlay JSX from `template.overlays`.
 *   - It does NOT branch on `template.backgroundMode`.
 *   - It does NOT yet route segments through the pill-aware shared resolver.
 * Tests 2, 3, 4, 5, 6, 7, 8, 9 fail. Tests 1 and 10 may pass.
 */

// Recursive flatten helper — walks an element tree (props.children may be
// array, single child, or null) into a flat node list. RESEARCH.md walk pattern.
// When `node` itself is an Array (e.g. the result of `template.overlays.map`),
// we recurse into each element directly — arrays have no `props`.
function walk(node: unknown): unknown[] {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) {
    const out: unknown[] = []
    for (const k of node) out.push(...walk(k))
    return out
  }
  const out: unknown[] = [node]
  const props = (node as { props?: { children?: unknown } }).props
  const kids = props?.children
  if (Array.isArray(kids)) {
    for (const k of kids) out.push(...walk(k))
  } else if (kids != null) {
    out.push(...walk(kids))
  }
  return out
}

// Convenience: extract style and text-content from an element-like node.
function styleOf(node: unknown): Record<string, unknown> | null {
  const props = (node as { props?: { style?: Record<string, unknown> } }).props
  return props?.style ?? null
}

function typeOf(node: unknown): string | unknown {
  return (node as { type?: unknown })?.type
}

function childrenOf(node: unknown): unknown {
  return (node as { props?: { children?: unknown } }).props?.children
}

// Recursively concatenate plain-string descendants of a node into a single string.
function textOf(node: unknown): string {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object') {
    const c = (node as { props?: { children?: unknown } }).props?.children
    return textOf(c)
  }
  return ''
}

// -----------------------------------------------------------------------------
// Fixtures (module-scope, per RESEARCH.md Example 4)
// -----------------------------------------------------------------------------

const baseSlide: Slide = {
  hook_text: 'FOLK SINGER FIGHTS BACK',
  body_text: 'Murphy Campbell is a folk singer.',
  image_query: '',
  is_cta: false,
  background_url: 'https://example.com/folk.jpg',
  pexels_photo_id: null,
}

const baseTemplate: SlideTemplate = {
  id: 'fixture-magazine',
  name: 'Fixture',
  thumbnail: '',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '110px',
  bodyFontSize: '32px',
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0.4,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
}

// Both `overlays` and `backgroundMode` undefined → legacy 5-template behavior.
const legacyTemplate: SlideTemplate = { ...baseTemplate, id: 'fixture-legacy' }

// -----------------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------------

describe('buildSlideElement — Phase 45 overlay composition', () => {
  // Test 1 — Legacy template snapshot (regression-safety contract).
  // CONTEXT.md Area 3 last paragraph: existing 5 templates leave overlays +
  // backgroundMode undefined → zero behavior change.
  it('renders legacy template (no overlays, no backgroundMode) — no behavior change', () => {
    const element = buildSlideElement(
      baseSlide,
      legacyTemplate,
      'free',
      'http://localhost',
    )
    expect(element).toMatchSnapshot('legacy-template-no-overlay-no-bg-mode')

    // Sanity: no bottom-card, no overlay-* keys, no full-bleed `bg-bleed` key.
    const nodes = walk(element)
    const styles = nodes.map(styleOf).filter((s): s is Record<string, unknown> => s != null)
    const bottomCard = styles.find((s) => s.height === '38%' && s.padding === 80)
    expect(bottomCard).toBeUndefined()
  })

  // Test 2 — image-bleed mode.
  it('renders image-bleed full-bleed photo at 1080×1920 cover', () => {
    const tpl: SlideTemplate = { ...baseTemplate, backgroundMode: 'image-bleed' }
    const element = buildSlideElement(
      baseSlide,
      tpl,
      'free',
      'http://localhost',
    )
    expect(element).toMatchSnapshot('image-bleed-no-overlays')

    const nodes = walk(element)
    // Find the full-bleed <img>: width:1080 && height:1920 && objectFit:'cover'
    const bleedImg = nodes.find((n) => {
      if (typeOf(n) !== 'img') return false
      const s = styleOf(n)
      return (
        s != null &&
        s.width === 1080 &&
        s.height === 1920 &&
        s.objectFit === 'cover'
      )
    })
    expect(bleedImg).toBeDefined()
  })

  // Test 3 — image-with-bottom-card mode with the opt-in caption card.
  // quick-260517-k2n: the caption card is no longer always-on chrome for
  // image-with-bottom-card templates — it renders only when
  // style_overrides.caption_bar_enabled === true. The fixture sets that flag so
  // the caption-card layer renders; resolveCaptionBar maps the template's
  // #000000 backgroundColor through bottomCardBackground → rgba(0, 0, 0, 0.85).
  it('renders image-with-bottom-card with full-bleed photo + tint + caption card', () => {
    const tpl: SlideTemplate = {
      ...baseTemplate,
      backgroundMode: 'image-with-bottom-card',
      backgroundColor: '#000000',
    }
    const slideWithCaption: Slide = {
      ...baseSlide,
      style_overrides: { caption_bar_enabled: true },
    }
    const element = buildSlideElement(
      slideWithCaption,
      tpl,
      'free',
      'http://localhost',
    )
    expect(element).toMatchSnapshot('image-with-bottom-card-no-overlays')

    const nodes = walk(element)

    // (a) Full-bleed <img>
    const bleedImg = nodes.find((n) => {
      if (typeOf(n) !== 'img') return false
      const s = styleOf(n)
      return s != null && s.width === 1080 && s.height === 1920 && s.objectFit === 'cover'
    })
    expect(bleedImg).toBeDefined()

    // (b) Tint <div>: position:absolute, inset 0, opacity = overlayOpacity, backgroundColor = overlayColor
    const tint = nodes.find((n) => {
      if (typeOf(n) !== 'div') return false
      const s = styleOf(n)
      if (s == null) return false
      return (
        s.position === 'absolute' &&
        (s.top === 0 || s.top === '0') &&
        (s.left === 0 || s.left === '0') &&
        (s.right === 0 || s.right === '0') &&
        (s.bottom === 0 || s.bottom === '0') &&
        s.backgroundColor === '#000000' &&
        s.opacity === 0.4
      )
    })
    expect(tint).toBeDefined()

    // (c) Caption-card <div>: top:1190 (62% of 1920), height:730 (38% of 1920),
    // rgba bg. quick-260517-k2n — the reworked caption card is an absolute flex
    // column with NO padding (unlike the retired bottom-card chrome). Satori
    // does not honor `bottom: 0 + height: %` together — explicit numeric pixels
    // are required for proper anchoring.
    const captionCard = nodes.find((n) => {
      if (typeOf(n) !== 'div') return false
      const s = styleOf(n)
      if (s == null) return false
      return (
        s.height === 730 &&
        s.top === 1190 &&
        s.flexDirection === 'column' &&
        s.backgroundColor === 'rgba(0, 0, 0, 0.85)'
      )
    })
    expect(captionCard).toBeDefined()
  })

  // Test 4 — Overlays in image-with-bottom-card mode. quick-260514-kv9:
  // page-counter is now suppressed at the consumer; the test asserts the
  // literal overlay still renders AND the page-counter slot does not.
  it('renders literal overlay; suppresses page-counter overlay (TPLREND-05 parity)', () => {
    const tpl: SlideTemplate = {
      ...baseTemplate,
      backgroundMode: 'image-with-bottom-card',
      overlays: [
        { position: 'top-left', content: { type: 'literal', text: 'TR3NDING' } },
        { position: 'top-right', content: { type: 'page-counter' } },
      ],
    }
    const element = buildSlideElement(
      baseSlide,
      tpl,
      'free',
      'http://localhost',
      { slideIndex: 0, totalSlides: 5, topic: 'folk-music' },
    )
    expect(element).toMatchSnapshot('image-with-bottom-card-with-overlays')

    const nodes = walk(element)

    // top-left overlay still renders.
    const topLeft = nodes.find((n) => {
      if (typeOf(n) !== 'div') return false
      const s = styleOf(n)
      if (s == null || s.left !== 60 || s.top !== 60) return false
      return textOf(childrenOf(n)).includes('TR3NDING')
    })
    expect(topLeft).toBeDefined()

    // top-right page-counter overlay should NOT render — quick-260514-kv9.
    const topRight = nodes.find((n) => {
      if (typeOf(n) !== 'div') return false
      const s = styleOf(n)
      if (s == null || s.right !== 60 || s.top !== 60) return false
      return textOf(childrenOf(n)).includes('1/5')
    })
    expect(topRight).toBeUndefined()
  })

  // Test 5 — slide-field topic via shared resolver.
  it('renders slide-field topic overlay using ctx.topic', () => {
    const tpl: SlideTemplate = {
      ...baseTemplate,
      backgroundMode: 'image-with-bottom-card',
      overlays: [
        { position: 'top-left', content: { type: 'slide-field', field: 'topic' } },
      ],
    }
    const element = buildSlideElement(
      baseSlide,
      tpl,
      'free',
      'http://localhost',
      { slideIndex: 0, totalSlides: 5, topic: 'folk-music' },
    )
    expect(element).toMatchSnapshot('overlay-slide-field-topic')

    const nodes = walk(element)
    const topicOverlay = nodes.find((n) => {
      if (typeOf(n) !== 'div') return false
      const s = styleOf(n)
      if (s == null || s.left !== 60 || s.top !== 60) return false
      return textOf(childrenOf(n)).includes('folk-music')
    })
    expect(topicOverlay).toBeDefined()
  })

  // Test 6 — Mint pill highlight on hook segments.
  it('renders mint pill <span> on hook segment with highlightColor', () => {
    const slide: Slide = {
      ...baseSlide,
      hook_segments: [
        { text: 'FOLK SINGER' },
        { text: 'FIGHTS BACK', highlightColor: '#9DECC1', highlightStyle: 'pill' },
        { text: 'AGAIN' },
      ],
    }
    const element = buildSlideElement(
      slide,
      baseTemplate,
      'free',
      'http://localhost',
    )
    expect(element).toMatchSnapshot('hook-with-mint-pill')

    const nodes = walk(element)
    // Pill is at index 1 (not last), so marginRight is '8px'.
    const pillSpan = nodes.find((n) => {
      if (typeOf(n) !== 'span') return false
      const s = styleOf(n)
      if (s == null) return false
      return (
        s.backgroundColor === '#9DECC1' &&
        s.padding === '4px 12px' &&
        s.borderRadius === '8px' &&
        s.marginRight === '8px'
      )
    })
    expect(pillSpan).toBeDefined()
  })

  // Test 7 — Block highlight style on body.
  it('renders block-style highlight <span> on body segment', () => {
    const slide: Slide = {
      ...baseSlide,
      body_segments: [
        { text: 'AI', highlightColor: '#FFFF00', highlightStyle: 'block' },
      ],
    }
    const element = buildSlideElement(
      slide,
      baseTemplate,
      'free',
      'http://localhost',
    )
    expect(element).toMatchSnapshot('body-with-block-highlight')

    const nodes = walk(element)
    const blockSpan = nodes.find((n) => {
      if (typeOf(n) !== 'span') return false
      const s = styleOf(n)
      if (s == null) return false
      return (
        s.backgroundColor === '#FFFF00' &&
        s.padding === '4px 8px' &&
        s.borderRadius === '0'
      )
    })
    expect(blockSpan).toBeDefined()
  })

  // Test 8 — Missing ctx → page-counter overlay is suppressed entirely
  // (quick-260514-kv9). Previously this asserted the '1/1' fallback render;
  // the overlay is now short-circuited at the consumer before that fallback
  // is reached.
  it('page-counter overlay is suppressed even when ctx is omitted', () => {
    const tpl: SlideTemplate = {
      ...baseTemplate,
      overlays: [{ position: 'top-right', content: { type: 'page-counter' } }],
    }
    const element = buildSlideElement(
      baseSlide,
      tpl,
      'free',
      'http://localhost',
      // ctx intentionally omitted
    )
    const nodes = walk(element)
    const counterOverlay = nodes.find((n) => {
      if (typeOf(n) !== 'div') return false
      const s = styleOf(n)
      if (s == null || s.right !== 60 || s.top !== 60) return false
      return textOf(childrenOf(n)).trim() === '1/1'
    })
    expect(counterOverlay).toBeUndefined()
  })

  // Test 9 — Missing ctx + slide-field topic → ''.
  it('falls back gracefully when ctx is omitted — slide-field topic resolves to empty', () => {
    const tpl: SlideTemplate = {
      ...baseTemplate,
      overlays: [
        { position: 'top-left', content: { type: 'slide-field', field: 'topic' } },
      ],
    }
    const element = buildSlideElement(
      baseSlide,
      tpl,
      'free',
      'http://localhost',
      // ctx intentionally omitted
    )
    expect(element).toMatchSnapshot('missing-ctx-slide-field-empty')

    const nodes = walk(element)
    const topicOverlay = nodes.find((n) => {
      if (typeOf(n) !== 'div') return false
      const s = styleOf(n)
      return s != null && s.left === 60 && s.top === 60
    })
    expect(topicOverlay).toBeDefined()
    // Text content should be empty string (no thrown error).
    expect(textOf(childrenOf(topicOverlay))).toBe('')
  })

  // Test 10 — Mutual-exclusion: style_overrides.layout wins over backgroundMode.
  it('mutex: style_overrides.layout=cover wins over backgroundMode=image-with-bottom-card', () => {
    const slide: Slide = {
      ...baseSlide,
      style_overrides: { layout: 'cover' },
    }
    const tpl: SlideTemplate = {
      ...baseTemplate,
      backgroundMode: 'image-with-bottom-card',
    }
    const element = buildSlideElement(
      slide,
      tpl,
      'free',
      'http://localhost',
    )
    expect(element).toMatchSnapshot('mutex-news-layout-wins')

    const nodes = walk(element)
    // No caption/bottom card div should be present: the legacy NEWS_LAYOUT path
    // runs (layout=cover wins) AND the fixture sets no caption_bar_enabled
    // override, so resolveCaptionBar(...).enabled is false (quick-260517-k2n).
    const bottomCard = nodes.find((n) => {
      if (typeOf(n) !== 'div') return false
      const s = styleOf(n)
      return s != null && s.height === '38%' && s.padding === 80
    })
    expect(bottomCard).toBeUndefined()
  })
})
