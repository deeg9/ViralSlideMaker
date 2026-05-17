import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { buildSlideHtml } from '@/lib/render/render-slide'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { SlidePreview } from '@/components/slides/slide-preview'
import { renderTightHighlight } from '@/lib/render/resolve-overlay'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { Slide, TextEffects } from '@/lib/types/slide'

/**
 * quick-260517-iiy — render-parity suite for the FIXED `tight` highlight.
 *
 * ROOT CAUSE (pre-fix): `tight` wrapped text in ONE inline <span> with
 * `box-decoration-break: clone`. For segment-less plain text that span held a
 * single text node, so it rendered as one continuous padded inline run — a
 * horizontal bar — not one pill per visual line. Satori has no
 * box-decoration-break and silently fell back to full-width, so tight was also
 * non-parity.
 *
 * FIX: `tight` renders one `inline-block` padded pill PER VISUAL LINE (split on
 * `\n`) inside a `flex-direction: column` container. Line-deterministic — no
 * reliance on inline flow / box-decoration-break — so canvas, HTML, and Satori
 * produce structurally identical per-line spans (TPLREND-05).
 *
 * Invariants pinned here:
 *   - tight multi-line  → N per-line padded pills (NOT one full-width strip)
 *   - tight single-line → ONE inline-block padded pill hugging the line
 *   - `full` highlight  → unchanged background-on-container
 *   - no highlight      → no extra highlight markup
 */

const HL_COLOR = '#3d000088'

function tightEffects(): TextEffects {
  return { highlight: { enabled: true, color: HL_COLOR, style: 'tight', padding: 8 } }
}
function fullEffects(): TextEffects {
  return { highlight: { enabled: true, color: HL_COLOR, style: 'full', padding: 8 } }
}

const baseTemplate: SlideTemplate = {
  id: 'fixture-tpl',
  name: 'Fixture',
  thumbnail: '',
  fontFamily: "'Inter', sans-serif",
  hookFontSize: '110px',
  bodyFontSize: '32px',
  textColor: '#111111',
  backgroundColor: '#FFFFFF',
  overlayColor: '#000000',
  overlayOpacity: 0.4,
  textAlign: 'left',
  textPosition: 'bottom',
  hookStyle: 'none',
}

// A hook with three visual lines — the multi-line scenario.
const MULTILINE_HOOK = 'LINE ONE\nLINE TWO\nLINE THREE'

function slide(over: Partial<Slide>): Slide {
  return {
    hook_text: MULTILINE_HOOK,
    body_text: 'Body copy here.',
    image_query: '',
    is_cta: false,
    background_url: 'https://example.com/x.jpg',
    pexels_photo_id: null,
    style_overrides: {},
    ...over,
  }
}

const tightSlide = slide({ style_overrides: { hook_text_effects: tightEffects() } })
const fullSlide = slide({ style_overrides: { hook_text_effects: fullEffects() } })
const plainSlide = slide({})

// Recursive React-element-tree flatten (mirrors background-color-override.test.tsx).
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
    for (const k of kids) out.push(...walk(kids ? kids : []))
  } else if (kids != null) {
    out.push(...walk(kids))
  }
  return out
}
function styleOf(node: unknown): Record<string, unknown> | null {
  return (node as { props?: { style?: Record<string, unknown> } }).props?.style ?? null
}

// ---------------------------------------------------------------------------
// Shared helper — renderTightHighlight (resolve-overlay.ts)
// ---------------------------------------------------------------------------

describe('renderTightHighlight — shared per-line pill helper', () => {
  it('renders one padded inline-block pill per \\n-split line', () => {
    const node = renderTightHighlight(
      MULTILINE_HOOK,
      undefined,
      undefined,
      undefined,
      '#111111',
      '#111111',
      { enabled: true, color: HL_COLOR, style: 'tight', padding: 8 },
      'left',
    )
    const all = walk(node)
    // Per-line pills carry the highlight backgroundColor; the column container
    // does NOT. Exactly 3 lines → exactly 3 pill spans.
    const pills = all.filter((n) => {
      const s = styleOf(n)
      return s != null && s.backgroundColor === HL_COLOR
    })
    expect(pills.length).toBe(3)
    // Each pill hugs its own text — inline-block, not full-width block.
    for (const p of pills) {
      const s = styleOf(p)!
      expect(s.display).toBe('inline-block')
      expect(s.padding).toBeDefined()
    }
  })

  it('renders ONE pill for single-line text', () => {
    const node = renderTightHighlight(
      'SINGLE LINE',
      undefined,
      undefined,
      undefined,
      '#111111',
      '#111111',
      { enabled: true, color: HL_COLOR, style: 'tight', padding: 8 },
      'center',
    )
    const pills = walk(node).filter((n) => styleOf(n)?.backgroundColor === HL_COLOR)
    expect(pills.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Satori PNG render path — render-slide-satori.tsx
// ---------------------------------------------------------------------------

describe('tight highlight — Satori PNG render', () => {
  it('renders one per-line pill (NOT a single full-width strip)', () => {
    const element = buildSlideElement(tightSlide, baseTemplate, null, 'free', 'http://localhost')
    const pills = walk(element).filter((n) => styleOf(n)?.backgroundColor === HL_COLOR)
    expect(pills.length).toBe(3)
    for (const p of pills) {
      expect(styleOf(p)!.display).toBe('inline-block')
    }
  })

  it('full highlight still paints background on the container (unchanged)', () => {
    const element = buildSlideElement(fullSlide, baseTemplate, null, 'free', 'http://localhost')
    const tinted = walk(element).filter((n) => styleOf(n)?.backgroundColor === HL_COLOR)
    // exactly one tinted node, and it is NOT an inline-block pill
    expect(tinted.length).toBe(1)
    expect(styleOf(tinted[0])!.display).not.toBe('inline-block')
  })

  it('no highlight → no tinted highlight node', () => {
    const element = buildSlideElement(plainSlide, baseTemplate, null, 'free', 'http://localhost')
    const tinted = walk(element).filter((n) => styleOf(n)?.backgroundColor === HL_COLOR)
    expect(tinted.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// HTML render path — render-slide.ts
// ---------------------------------------------------------------------------

describe('tight highlight — HTML render', () => {
  it('emits one per-line inline-block pill span (NOT box-decoration-break strip)', () => {
    const html = buildSlideHtml(tightSlide, baseTemplate)
    // No box-decoration-break hack anymore.
    expect(html).not.toContain('box-decoration-break')
    // One inline-block span per line — three lines.
    const pillCount = (html.match(/display:\s*inline-block/g) ?? []).length
    expect(pillCount).toBeGreaterThanOrEqual(3)
    // Each pill carries the highlight color.
    const colored = (html.match(new RegExp(HL_COLOR, 'g')) ?? []).length
    expect(colored).toBeGreaterThanOrEqual(3)
  })

  it('full highlight still paints background on the container', () => {
    const html = buildSlideHtml(fullSlide, baseTemplate)
    expect(html).toContain(`background-color: ${HL_COLOR}`)
    expect(html).not.toContain('box-decoration-break')
  })

  it('no highlight → no highlight color in output', () => {
    const html = buildSlideHtml(plainSlide, baseTemplate)
    expect(html).not.toContain(HL_COLOR)
  })
})

// ---------------------------------------------------------------------------
// Editor canvas render path — slide-preview.tsx
// ---------------------------------------------------------------------------

describe('tight highlight — editor canvas', () => {
  it('renders one per-line inline-block pill (NOT a horizontal bar)', () => {
    const { container } = render(
      <SlidePreview slide={tightSlide} template={baseTemplate} index={0} slideIndex={0} totalSlides={5} />,
    )
    const spans = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.style.display === 'inline-block' && s.style.backgroundColor !== '',
    )
    expect(spans.length).toBe(3)
  })

  it('no highlight slide has no inline-block highlight pills', () => {
    const { container } = render(
      <SlidePreview slide={plainSlide} template={baseTemplate} index={0} slideIndex={0} totalSlides={5} />,
    )
    const spans = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.style.display === 'inline-block' && s.style.backgroundColor !== '',
    )
    expect(spans.length).toBe(0)
  })
})
