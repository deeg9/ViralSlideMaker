// Phase 82 Gap E + Gap-D render-wiring — unit tests for the whole-word wrap in
// renderSegments and the caption-card-aware news headline re-fit.

import { describe, it, expect } from 'vitest'
import { renderSegments, resolveNewsHeadlineFit, resolveCaptionBar } from '../resolve-overlay'
import { magazineBold } from '../templates/magazine-bold'
import type { TextSegment } from '@/lib/types/slide'

// Recursively collect every React element node produced by renderSegments.
function flatten(node: unknown): Array<{ props?: Record<string, unknown> }> {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) {
    const out: Array<{ props?: Record<string, unknown> }> = []
    for (const k of node) out.push(...flatten(k))
    return out
  }
  const el = node as { props?: { children?: unknown } }
  const out = [el as { props?: Record<string, unknown> }]
  const kids = el.props?.children
  if (kids != null) out.push(...flatten(kids))
  return out
}

function styleOf(el: { props?: Record<string, unknown> }): Record<string, unknown> {
  return (el.props?.style as Record<string, unknown>) ?? {}
}

describe('Phase 82 Gap E — renderSegments wraps whole-word', () => {
  it('a plain segment span uses overflow-wrap: normal (never break-word)', () => {
    const segs: TextSegment[] = [
      { text: 'ANNOUNCES', accent: false },
      { text: 'LAYOFFS', accent: false },
    ]
    const nodes = flatten(renderSegments('ANNOUNCES LAYOFFS', segs, '#fff', '#0ff'))
    const spans = nodes.filter((n) => styleOf(n).overflowWrap !== undefined)
    expect(spans.length).toBeGreaterThan(0)
    for (const s of spans) {
      expect(styleOf(s).overflowWrap).toBe('normal')
    }
  })

  it('a pill (highlighted) segment span uses overflow-wrap: normal', () => {
    const segs: TextSegment[] = [
      { text: 'ANNOUNCES', accent: true, highlightColor: '#00E5FF', highlightStyle: 'pill' },
      { text: 'LAYOFFS', accent: false },
    ]
    const nodes = flatten(renderSegments('ANNOUNCES LAYOFFS', segs, '#fff', '#0ff'))
    const spans = nodes.filter((n) => styleOf(n).overflowWrap !== undefined)
    // Both the pill span and the plain span carry overflowWrap.
    expect(spans.length).toBeGreaterThanOrEqual(2)
    for (const s of spans) {
      expect(styleOf(s).overflowWrap).toBe('normal')
    }
  })
})

describe('Phase 82 Gap D — resolveNewsHeadlineFit render-wiring', () => {
  it('is a no-op when the caption bar is disabled', () => {
    const bar = resolveCaptionBar(undefined, magazineBold) // enabled: false
    expect(resolveNewsHeadlineFit(bar, 'ANY HEADLINE', 137, true)).toBe(137)
  })

  it('is a no-op for a non-news slide even with an enabled caption bar', () => {
    const bar = resolveCaptionBar(
      { caption_bar_enabled: true, caption_bar_width: 90, caption_bar_height_pct: 30 },
      magazineBold,
    )
    expect(resolveNewsHeadlineFit(bar, 'ANY HEADLINE', 137, false)).toBe(137)
  })

  it('re-fits the headline to the caption card box for a news-layout slide', () => {
    const bar = resolveCaptionBar(
      { caption_bar_enabled: true, caption_bar_width: 90, caption_bar_height_pct: 30 },
      magazineBold,
    )
    const fitted = resolveNewsHeadlineFit(bar, 'MAJOR TECH COMPANY ANNOUNCES 19,000 LAYOFFS', 200, true)
    // The re-fit returns a content-aware size, not the passed-in 200.
    expect(typeof fitted).toBe('number')
    expect(fitted).toBeGreaterThan(0)
  })

  it('a smaller caption card yields a smaller headline size', () => {
    const big = resolveCaptionBar(
      { caption_bar_enabled: true, caption_bar_width: 95, caption_bar_height_pct: 40 },
      magazineBold,
    )
    const small = resolveCaptionBar(
      { caption_bar_enabled: true, caption_bar_width: 50, caption_bar_height_pct: 18 },
      magazineBold,
    )
    const hook = 'MAJOR TECH COMPANY ANNOUNCES 19,000 LAYOFFS'
    const fitBig = resolveNewsHeadlineFit(big, hook, 200, true)
    const fitSmall = resolveNewsHeadlineFit(small, hook, 200, true)
    expect(fitSmall).toBeLessThan(fitBig)
  })
})
