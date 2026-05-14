import { describe, it, expect } from 'vitest'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { getTemplate } from '@/lib/render/templates'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 46-02 — Satori snapshot tests for the 3 NEW premium templates
 * (`magazine-bold`, `tr3nding-news`, `documentary`).
 *
 * Each template gets:
 *   1. A snapshot of its `buildSlideElement(...)` output rendered against the
 *      template's own `sample` data + a fixed `ctx` (slideIndex 0, total 5,
 *      topic 'folk-music').
 *   2. Targeted tree-walk assertions on the locked tokens from
 *      46-CONTEXT.md / 46-UI-SPEC.md so a future regression that DOES emit
 *      something but with wrong content fails LOUD on the assertion
 *      (not just on snapshot drift).
 *
 * Locked tokens validated:
 *   - mint hex `#A8E0B0` (magazine-bold + tr3nding-news, ABSENT from documentary)
 *   - mid-pill literal `'TR3NDING'` (tr3nding-news only)
 *   - bottom-card layer `rgba(0, 0, 0, 0.85)` (magazine-bold + tr3nding-news;
 *     ABSENT from documentary which uses image-bleed)
 *   - ghosted page-counter `'1/5'` with `background: 'transparent'` (documentary)
 *   - free-slot gradient containing `linear-gradient` + `rgba(0,0,0,0.85)` (documentary)
 *
 * Helpers (walk / styleOf / typeOf / textOf) are inlined per Plan 45-02
 * pattern — cross-file test-helper exports have not been used elsewhere
 * in this suite.
 */

// -----------------------------------------------------------------------------
// Tree-walk helpers (mirrors src/__tests__/render/render-slide-satori.test.tsx)
// -----------------------------------------------------------------------------

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

function styleOf(node: unknown): Record<string, unknown> | null {
  const props = (node as { props?: { style?: Record<string, unknown> } }).props
  return props?.style ?? null
}

function typeOf(node: unknown): string | unknown {
  return (node as { type?: unknown })?.type
}

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
// Module-scope fixtures
// -----------------------------------------------------------------------------

const baseSlide: Slide = {
  hook_text: 'PLACEHOLDER',
  body_text: 'PLACEHOLDER',
  image_query: '',
  is_cta: false,
  background_url: 'https://example.com/folk.jpg',
  pexels_photo_id: null,
}

const ctx = { slideIndex: 0, totalSlides: 5, topic: 'folk-music' }

// -----------------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------------

describe('Phase 46 premium templates — Satori snapshots', () => {
  // 1. magazine-bold
  it('magazine-bold: renders image-with-bottom-card + top-left mint chip + top-right counter + bottom-card + mint pill segments', () => {
    const template = getTemplate('magazine-bold')
    const slide: Slide = {
      ...baseSlide,
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
      hook_segments: template.sample!.hook_segments,
    }
    const element = buildSlideElement(slide, template, null, 'pro', 'http://localhost', ctx)
    expect(element).toMatchSnapshot('magazine-bold-bottom-card-with-overlays')

    const nodes = walk(element)

    // Bottom-card layer present (rgba(0,0,0,0.85) per Phase 45 bottomCardBackground)
    const bottomCardNode = nodes.find((n) => {
      const s = styleOf(n)
      return s && s.height === 730 && s.top === 1190 && typeof s.backgroundColor === 'string' &&
        (s.backgroundColor as string).includes('rgba(0, 0, 0, 0.85)')
    })
    expect(bottomCardNode).toBeDefined()

    // Top-left mint chip overlay present — mint background, black text, topic content
    const mintChip = nodes.find((n) => {
      const s = styleOf(n)
      return s && s.background === '#A8E0B0' && s.color === '#000000'
    })
    expect(mintChip).toBeDefined()
    expect(textOf(mintChip)).toBe('folk-music')

    // quick-260514-kv9: page-counter overlay suppressed everywhere.
    const counter = nodes.find((n) => textOf(n) === '1/5' && styleOf(n)?.background === 'rgba(0,0,0,0.6)')
    expect(counter).toBeUndefined()

    // Mint pill spans on hook segments — match parity-locked signature
    const pillSpans = nodes.filter((n) => {
      const s = styleOf(n)
      return s && (s.backgroundColor === '#A8E0B0' || s.background === '#A8E0B0') &&
        typeOf(n) === 'span'
    })
    expect(pillSpans.length).toBeGreaterThanOrEqual(2)  // 'FIGHTS BACK' + 'CLONED HER VOICE'
  })

  // 2. tr3nding-news
  it('tr3nding-news: renders image-with-bottom-card + top-right counter + mid-pill TR3NDING + mint pill segments', () => {
    const template = getTemplate('tr3nding-news')
    const slide: Slide = {
      ...baseSlide,
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
      hook_segments: template.sample!.hook_segments,
    }
    const element = buildSlideElement(slide, template, null, 'pro', 'http://localhost', ctx)
    expect(element).toMatchSnapshot('tr3nding-news-bottom-card-with-mid-pill')

    const nodes = walk(element)

    // Bottom-card present
    const bottomCardNode = nodes.find((n) => {
      const s = styleOf(n)
      return s && s.height === 730 && s.top === 1190 && typeof s.backgroundColor === 'string' &&
        (s.backgroundColor as string).includes('rgba(0, 0, 0, 0.85)')
    })
    expect(bottomCardNode).toBeDefined()

    // Mid-pill literal 'TR3NDING' — black background, mint text, fully rounded
    const midPill = nodes.find((n) => textOf(n) === 'TR3NDING' && styleOf(n)?.color === '#A8E0B0')
    expect(midPill).toBeDefined()
    expect((styleOf(midPill) as Record<string, unknown>).background).toBe('#000000')
    expect((styleOf(midPill) as Record<string, unknown>).borderRadius).toBe('40px')

    // quick-260514-kv9: page-counter overlay suppressed everywhere.
    const counter = nodes.find((n) => textOf(n) === '1/5' && styleOf(n)?.background === 'rgba(0,0,0,0.6)')
    expect(counter).toBeUndefined()

    // Mint pill spans on hook segments
    const pillSpans = nodes.filter((n) => {
      const s = styleOf(n)
      return s && (s.backgroundColor === '#A8E0B0' || s.background === '#A8E0B0') &&
        typeOf(n) === 'span'
    })
    expect(pillSpans.length).toBeGreaterThanOrEqual(2)  // '$50M' + '12 MINUTES'

    // NO top-left chip — locked exclusion (mid-pill is the visual identity)
    const topLeftChip = nodes.find((n) => {
      const s = styleOf(n)
      return s && s.background === '#A8E0B0' && s.color === '#000000'
    })
    expect(topLeftChip).toBeUndefined()
  })

  // 3. documentary
  it('documentary: renders image-bleed full-bleed + ghosted top-right counter + free-slot gradient + NO bottom-card + NO mint accent', () => {
    const template = getTemplate('documentary')
    const slide: Slide = {
      ...baseSlide,
      hook_text: template.sample!.hook_text,
      body_text: template.sample!.body_text,
    }
    const element = buildSlideElement(slide, template, null, 'pro', 'http://localhost', ctx)
    expect(element).toMatchSnapshot('documentary-image-bleed-with-gradient-overlay')

    const nodes = walk(element)

    // NO bottom-card — image-bleed locks this
    const bottomCardNode = nodes.find((n) => {
      const s = styleOf(n)
      return s && s.height === 730 && s.top === 1190 && typeof s.backgroundColor === 'string' &&
        (s.backgroundColor as string).includes('rgba(0, 0, 0, 0.85)')
    })
    expect(bottomCardNode).toBeUndefined()

    // quick-260514-kv9: page-counter overlay suppressed everywhere.
    const ghostedCounter = nodes.find((n) => textOf(n) === '1/5' && styleOf(n)?.background === 'transparent')
    expect(ghostedCounter).toBeUndefined()

    // Free-slot gradient overlay — linear-gradient string in background, offset y=1340
    const gradientOverlay = nodes.find((n) => {
      const s = styleOf(n)
      return s && typeof s.background === 'string' &&
        (s.background as string).includes('linear-gradient') &&
        (s.background as string).includes('rgba(0,0,0,0.85)')
    })
    expect(gradientOverlay).toBeDefined()

    // NO mint accent anywhere — documentary deliberately omits #A8E0B0
    const mintNode = nodes.find((n) => {
      const s = styleOf(n)
      return s && (
        (typeof s.background === 'string' && s.background === '#A8E0B0') ||
        (typeof s.backgroundColor === 'string' && s.backgroundColor === '#A8E0B0') ||
        (typeof s.color === 'string' && s.color === '#A8E0B0')
      )
    })
    expect(mintNode).toBeUndefined()
  })
})
