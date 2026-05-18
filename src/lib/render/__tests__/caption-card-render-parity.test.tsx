import { describe, it, expect } from 'vitest'
import { buildSlideHtml } from '@/lib/render/render-slide'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

/**
 * quick-260517-k2n — 3-path render-parity suite for the reworked caption card.
 *
 * The caption card is an independent draggable/resizable colored rectangle. It
 * must render identically across the editor canvas, the Satori PNG export and
 * the HTML export (TPLREND-05 / PARITY-01). All three paths consume the SAME
 * shared `resolveCaptionBar`.
 *
 * The HTML path previously rendered NO caption card — this suite pins the
 * newly-added div. Byte-identity: a slide WITHOUT caption_bar_enabled produces
 * no card in any path.
 */

const template: SlideTemplate = {
  id: 'fixture-cc',
  name: 'Fixture CC',
  thumbnail: '',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '110px',
  bodyFontSize: '32px',
  textColor: '#111111',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0.4,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'uppercase',
}

function makeSlide(overrides?: SlideStyleOverrides): Slide {
  return {
    hook_text: 'CAPTION CARD HOOK',
    body_text: 'Body copy beneath the card.',
    image_query: '',
    is_cta: false,
    background_url: 'https://example.com/photo.jpg',
    pexels_photo_id: null,
    style_overrides: overrides,
  }
}

// Recursive Satori element-tree flatten.
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
function styleOf(node: unknown): Record<string, unknown> | null {
  return (
    (node as { props?: { style?: Record<string, unknown> } }).props?.style ??
    null
  )
}
function keyOf(node: unknown): unknown {
  return (node as { key?: unknown }).key
}

// ---------------------------------------------------------------------------
// HTML render path — render-slide.ts (previously rendered NO caption card)
// ---------------------------------------------------------------------------

describe('caption card — HTML render (render-slide.ts)', () => {
  it('byte-identity (TPLREND-05): no caption_bar_enabled → no caption card', () => {
    const html = buildSlideHtml(makeSlide(), template)
    expect(html).not.toContain('z-index:2;')
  })

  it('renders a caption-card div when caption_bar_enabled is true', () => {
    const html = buildSlideHtml(
      makeSlide({
        caption_bar_enabled: true,
        caption_bar_x: 10,
        caption_bar_y: 20,
        caption_bar_width: 80,
        caption_bar_height_pct: 50,
      }),
      template,
    )
    // Resolved percents emitted verbatim into inline style.
    expect(html).toContain('left:10%')
    expect(html).toContain('top:20%')
    expect(html).toContain('width:80%')
    expect(html).toContain('height:50%')
    expect(html).toContain('z-index:2;')
  })

  it('renders the card on any template — not backgroundMode-gated', () => {
    const html = buildSlideHtml(
      makeSlide({ caption_bar_enabled: true }),
      template,
    )
    // Default geometry: x:0, width:100, height:38, y:62.
    expect(html).toContain('left:0%')
    expect(html).toContain('top:62%')
    expect(html).toContain('width:100%')
    expect(html).toContain('height:38%')
  })
})

// ---------------------------------------------------------------------------
// Satori render path — render-slide-satori.tsx
// ---------------------------------------------------------------------------

describe('caption card — Satori render (render-slide-satori.tsx)', () => {
  it('byte-identity (TPLREND-05): no caption_bar_enabled → no caption-card node', () => {
    const tree = buildSlideElement(makeSlide(), template)
    const nodes = walk(tree)
    expect(nodes.find((n) => keyOf(n) === 'caption-card')).toBeUndefined()
  })

  it('renders an enabled caption-card node with px geometry', () => {
    const tree = buildSlideElement(
      makeSlide({
        caption_bar_enabled: true,
        caption_bar_x: 10,
        caption_bar_y: 20,
        caption_bar_width: 80,
        caption_bar_height_pct: 50,
      }),
      template,
    )
    const card = walk(tree).find((n) => keyOf(n) === 'caption-card')
    expect(card).toBeDefined()
    const style = styleOf(card)!
    // W=1080 H=1920 — explicit numeric px.
    expect(style.left).toBe(108) // round(10/100*1080)
    expect(style.top).toBe(384) // round(20/100*1920)
    expect(style.width).toBe(864) // round(80/100*1080)
    expect(style.height).toBe(960) // round(50/100*1920)
  })
})

// ---------------------------------------------------------------------------
// 3-path agreement
// ---------------------------------------------------------------------------

describe('caption card — Satori px ↔ HTML percent agreement', () => {
  it('Satori px equal the HTML percents converted against W/H', () => {
    const overrides: SlideStyleOverrides = {
      caption_bar_enabled: true,
      caption_bar_x: 25,
      caption_bar_y: 40,
      caption_bar_width: 50,
      caption_bar_height_pct: 30,
    }
    const W = 1080
    const H = 1920
    const card = walk(buildSlideElement(makeSlide(overrides), template)).find(
      (n) => keyOf(n) === 'caption-card',
    )
    const style = styleOf(card)!
    const html = buildSlideHtml(makeSlide(overrides), template)
    expect(style.left).toBe(Math.round((25 / 100) * W))
    expect(style.top).toBe(Math.round((40 / 100) * H))
    expect(html).toContain('left:25%')
    expect(html).toContain('top:40%')
    expect(html).toContain('width:50%')
    expect(html).toContain('height:30%')
  })
})

// ---------------------------------------------------------------------------
// quick-260518-8o0 — news-layout photo is full-bleed + seeded caption card
// ---------------------------------------------------------------------------

describe('news-layout — full-bleed photo + seeded caption card', () => {
  it('Test 1 (parity): a news-layout slide emits a full-bleed photo in both export paths', () => {
    // News-layout slide: template has NO backgroundMode, overrides.layout set.
    const newsSlide = makeSlide({ layout: 'cover' })
    // HTML: full-bleed photo — folded into the CSS background-image branch
    // (no constrained <img> zone). Identical mechanism to non-news photos.
    const html = buildSlideHtml(newsSlide, template)
    expect(html).toContain("background-image: url('https://example.com/photo.jpg')")
    // The old constrained news <img> zone is gone.
    expect(html).not.toContain('top:55%')
    expect(html).not.toContain('height:55%; object-fit:cover; z-index:0')
    // Satori: the background <img> is full-bleed (top:0, width:W, height:H).
    const imgNodes = walk(buildSlideElement(newsSlide, template)).filter(
      (n) => (n as { type?: string }).type === 'img',
    )
    const bgImg = imgNodes.find((n) => {
      const s = styleOf(n)
      return s != null && s.objectFit === 'cover'
    })
    expect(bgImg).toBeDefined()
    const bgStyle = styleOf(bgImg)!
    expect(bgStyle.top).toBe(0)
    expect(bgStyle.width).toBe(1080)
    expect(bgStyle.height).toBe(1920)
  })

  it('Test 2 (parity): the same news slide emits a seeded caption card in both paths', () => {
    const newsSlide = makeSlide({ layout: 'cover' })
    // HTML: seeded bottom-region card (x:0, width:100, height:38, y:62).
    const html = buildSlideHtml(newsSlide, template)
    expect(html).toContain('z-index:2;')
    expect(html).toContain('left:0%')
    expect(html).toContain('top:62%')
    expect(html).toContain('width:100%; height:38%')
    // Satori: a caption-card node exists at the seeded geometry.
    const card = walk(buildSlideElement(newsSlide, template)).find(
      (n) => keyOf(n) === 'caption-card',
    )
    expect(card).toBeDefined()
    const style = styleOf(card)!
    expect(style.left).toBe(0)
    expect(style.top).toBe(Math.round((62 / 100) * 1920))
    expect(style.width).toBe(1080)
    expect(style.height).toBe(Math.round((38 / 100) * 1920))
  })

  it('Test 3 (byte-identity): a non-news slide emits a full-bleed photo and NO caption card', () => {
    // No `layout` override → not a news slide.
    const plainSlide = makeSlide()
    const html = buildSlideHtml(plainSlide, template)
    // Non-news photo path uses the CSS background-image (unchanged).
    expect(html).toContain("background-image: url('https://example.com/photo.jpg')")
    expect(html).not.toContain('z-index:2;')
    const card = walk(buildSlideElement(plainSlide, template)).find(
      (n) => keyOf(n) === 'caption-card',
    )
    expect(card).toBeUndefined()
  })
})
