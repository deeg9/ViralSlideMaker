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
