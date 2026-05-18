// Phase 82 Gap E + Gap-D render-wiring — unit tests for the whole-word wrap in
// renderSegments and the caption-card-aware news headline re-fit.

import { describe, it, expect } from 'vitest'
import {
  renderSegments,
  resolveNewsHeadlineFit,
  resolveCaptionBar,
  bottomCardBackground,
} from '../resolve-overlay'
import { magazineBold } from '../templates/magazine-bold'
import { newsDrop } from '../templates/news-drop'
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

describe('quick-260518-8o0 — resolveCaptionBar news-layout default', () => {
  it('Test 1: an unedited news-layout slide resolves enabled:true with bottom-region black geometry', () => {
    const bar = resolveCaptionBar(undefined, newsDrop, true)
    expect(bar.enabled).toBe(true)
    expect(bar.heightPct).toBe(38)
    expect(bar.x).toBe(0)
    expect(bar.width).toBe(100)
    expect(bar.y).toBe(100 - bar.heightPct)
    expect(bar.position).toBe('bottom')
    expect(bar.backgroundColor).toBe(bottomCardBackground('#000000'))
    expect(bar.backgroundColor).toBe('rgba(0, 0, 0, 0.85)')
  })

  it('Test 2: a non-news unedited slide resolves enabled:false (byte-identity)', () => {
    expect(resolveCaptionBar({}, magazineBold, false).enabled).toBe(false)
    expect(resolveCaptionBar(undefined, magazineBold).enabled).toBe(false)
  })

  it('Test 3: explicit caption_bar_enabled:false beats the news default', () => {
    const bar = resolveCaptionBar({ caption_bar_enabled: false }, newsDrop, true)
    expect(bar.enabled).toBe(false)
  })

  it('Test 4: explicit caption_bar_enabled:true still works on non-news slides', () => {
    const bar = resolveCaptionBar({ caption_bar_enabled: true }, magazineBold, false)
    expect(bar.enabled).toBe(true)
  })

  it('Test 5: an already-customized caption card resolves the same regardless of isNewsLayoutSlide', () => {
    const custom = {
      caption_bar_enabled: true,
      caption_bar_color: '#123456',
      caption_bar_opacity: 0.5,
      caption_bar_x: 12,
      caption_bar_y: 34,
      caption_bar_width: 56,
      caption_bar_height_pct: 45,
    }
    const asNews = resolveCaptionBar(custom, newsDrop, true)
    const asNonNews = resolveCaptionBar(custom, newsDrop, false)
    expect(asNews).toEqual(asNonNews)
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

  it('a narrower caption card yields a smaller headline size (WIDTH coupling kept)', () => {
    // Phase 82 width/overflow safety: a narrower card forces a smaller font so
    // the headline never overflows the card horizontally / breaks mid-word.
    const wide = resolveCaptionBar(
      { caption_bar_enabled: true, caption_bar_width: 95 },
      magazineBold,
    )
    const narrow = resolveCaptionBar(
      { caption_bar_enabled: true, caption_bar_width: 50 },
      magazineBold,
    )
    const hook = 'MAJOR TECH COMPANY ANNOUNCES 19,000 LAYOFFS'
    const fitWide = resolveNewsHeadlineFit(wide, hook, 200, true)
    const fitNarrow = resolveNewsHeadlineFit(narrow, hook, 200, true)
    expect(fitNarrow).toBeLessThan(fitWide)
  })

  // quick-260518-ch8 checkpoint-feedback fix — the caption card's Height
  // slider must NOT resize the headline (or any other element). The headline
  // auto-fit uses a fixed reference height, so changing caption_bar_height_pct
  // leaves resolveNewsHeadlineFit's result unchanged. Only the card's own
  // visual height grows; the headline font size is invariant.
  it('the headline font size is INVARIANT to caption card height', () => {
    const hook = 'ORACLE CUTS 30,000'
    const sizes = [10, 25, 38, 60, 90].map((heightPct) => {
      const bar = resolveCaptionBar(
        {
          caption_bar_enabled: true,
          caption_bar_width: 100,
          caption_bar_height_pct: heightPct,
        },
        magazineBold,
      )
      return resolveNewsHeadlineFit(bar, hook, 200, true)
    })
    // Every height — from the 10% floor to the 90% ceiling — produces the
    // SAME headline font size. The Height slider does not touch the headline.
    for (const size of sizes) {
      expect(size).toBe(sizes[0])
    }
  })

  it('a slide at the DEFAULT caption height re-fits identically to the fixed reference (byte-identity)', () => {
    // The fixed reference height equals the 38% default, so a default-height
    // slide's headline fit is unchanged by this fix — byte-identity (TPLREND-05).
    const hook = 'MAJOR TECH COMPANY ANNOUNCES 19,000 LAYOFFS'
    const defaultHeight = resolveCaptionBar(
      { caption_bar_enabled: true, caption_bar_width: 90 },
      magazineBold,
    )
    const explicit38 = resolveCaptionBar(
      { caption_bar_enabled: true, caption_bar_width: 90, caption_bar_height_pct: 38 },
      magazineBold,
    )
    const tall = resolveCaptionBar(
      { caption_bar_enabled: true, caption_bar_width: 90, caption_bar_height_pct: 90 },
      magazineBold,
    )
    const fitDefault = resolveNewsHeadlineFit(defaultHeight, hook, 200, true)
    expect(resolveNewsHeadlineFit(explicit38, hook, 200, true)).toBe(fitDefault)
    // A non-default (tall) height now matches the 38% result instead of scaling.
    expect(resolveNewsHeadlineFit(tall, hook, 200, true)).toBe(fitDefault)
  })
})
