// Phase 82 Gap B + Gap D — tests for the News-category post-generation
// transform. Pure unit tests over promoteNewsHeadline — no network, no Gemini.
//
// Fixtures use the 82-VISUAL-SIGNOFF fixed test topic
// ("Major tech company announces 19,000 layoffs").

import { describe, it, expect } from 'vitest'
import { promoteNewsHeadline } from '@/lib/ai/categories/promote-news-headline'
import { HEADLINE_FIT_CEILING, HEADLINE_FIT_FLOOR } from '@/lib/render/hook-fit'

const NEWS_CYAN_ACCENT = '#00E5FF'

// Minimal carousel-shaped fixture builder.
function carousel(slides: Array<Record<string, unknown>>) {
  return { title: 'Test', slides: slides as never }
}

describe('Phase 82 Gap B1 — promote existing accents to pills', () => {
  it('an accented segment gains highlightColor + highlightStyle:pill', () => {
    const c = carousel([
      {
        hook_text: 'TECH GIANT CUTS 19000 JOBS',
        hook_segments: [
          { text: 'TECH', accent: true },
          { text: 'GIANT', accent: false },
          { text: 'CUTS', accent: false },
          { text: '19000', accent: true },
          { text: 'JOBS', accent: false },
        ],
      },
    ])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const segs = (c.slides[0] as { hook_segments: Array<Record<string, unknown>> }).hook_segments
    const accented = segs.filter((s) => s.accent === true)
    expect(accented.length).toBe(2)
    for (const s of accented) {
      expect(s.highlightColor).toBe(NEWS_CYAN_ACCENT)
      expect(s.highlightStyle).toBe('pill')
    }
  })

  it('a non-accent segment keeps NO highlightColor', () => {
    const c = carousel([
      {
        hook_text: 'TECH GIANT',
        hook_segments: [
          { text: 'TECH', accent: true },
          { text: 'GIANT', accent: false },
        ],
      },
    ])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const segs = (c.slides[0] as { hook_segments: Array<Record<string, unknown>> }).hook_segments
    const plain = segs.find((s) => s.text === 'GIANT')!
    expect(plain.highlightColor).toBeUndefined()
    expect(plain.highlightStyle).toBeUndefined()
  })
})

describe('Phase 82 Gap B2 — backfill when Gemini emits no usable segments', () => {
  it('a slide with NO hook_segments gets a derived non-empty pill array', () => {
    const c = carousel([
      { hook_text: 'MAJOR TECH COMPANY ANNOUNCES 19000 LAYOFFS' },
    ])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const segs = (c.slides[0] as { hook_segments: Array<Record<string, unknown>> }).hook_segments
    expect(Array.isArray(segs)).toBe(true)
    expect(segs.length).toBeGreaterThan(0)
    // Runs concatenate back to the headline (whitespace-normalized).
    expect(segs.map((s) => s.text).join(' ')).toBe('MAJOR TECH COMPANY ANNOUNCES 19000 LAYOFFS')
    // >= 1 accented pill.
    const accented = segs.filter((s) => s.accent === true)
    expect(accented.length).toBeGreaterThanOrEqual(1)
    for (const s of accented) {
      expect(s.highlightColor).toBe(NEWS_CYAN_ACCENT)
      expect(s.highlightStyle).toBe('pill')
    }
  })

  it('an EMPTY hook_segments array also triggers the backfill', () => {
    const c = carousel([
      { hook_text: 'CITY COUNCIL APPROVES DOWNTOWN TRANSIT LINE', hook_segments: [] },
    ])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const segs = (c.slides[0] as { hook_segments: Array<Record<string, unknown>> }).hook_segments
    expect(segs.length).toBeGreaterThan(0)
    expect(segs.some((s) => s.accent === true && s.highlightStyle === 'pill')).toBe(true)
  })

  it('a segments array with NO accented entry triggers the backfill', () => {
    const c = carousel([
      {
        hook_text: 'STOCKS RALLY ON FED NEWS',
        hook_segments: [
          { text: 'STOCKS', accent: false },
          { text: 'RALLY', accent: false },
        ],
      },
    ])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const segs = (c.slides[0] as { hook_segments: Array<Record<string, unknown>> }).hook_segments
    expect(segs.some((s) => s.accent === true && s.highlightColor === NEWS_CYAN_ACCENT)).toBe(true)
  })

  it('never accents a connector word', () => {
    const c = carousel([{ hook_text: 'THE CITY OF DETROIT' }])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const segs = (c.slides[0] as { hook_segments: Array<Record<string, unknown>> }).hook_segments
    const accentedTexts = segs.filter((s) => s.accent === true).map((s) => s.text)
    for (const t of accentedTexts) {
      expect(['THE', 'OF']).not.toContain(t)
    }
    // A content word ('CITY' or 'DETROIT') was picked.
    expect(accentedTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('guarantees >= 1 pill even for a degenerate / all-connector headline', () => {
    const c = carousel([
      { hook_text: 'THE AND OF' },
      { hook_text: 'BREAKING' },
    ])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    for (const slide of c.slides as Array<{ hook_segments: Array<Record<string, unknown>> }>) {
      const accented = slide.hook_segments.filter((s) => s.accent === true)
      expect(accented.length).toBeGreaterThanOrEqual(1)
      expect(accented[0].highlightStyle).toBe('pill')
    }
  })
})

describe('Phase 82 Gap D — auto-fit headline size (no flat constant)', () => {
  it('every slide gets a numeric hook_font_size within the auto-fit range', () => {
    const c = carousel([
      { hook_text: 'MAJOR TECH COMPANY ANNOUNCES 19000 LAYOFFS' },
      { hook_text: 'CEO BLAMES AI SHIFT' },
    ])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    for (const slide of c.slides as Array<{ style_overrides?: { hook_font_size?: number } }>) {
      const size = slide.style_overrides?.hook_font_size
      expect(typeof size).toBe('number')
      expect(size!).toBeGreaterThanOrEqual(HEADLINE_FIT_FLOOR)
      expect(size!).toBeLessThanOrEqual(HEADLINE_FIT_CEILING)
    }
  })

  it('a long headline gets a SMALLER size than a short headline (content-aware, not flat)', () => {
    const c = carousel([
      { hook_text: 'BREAKING' },
      { hook_text: 'MAJOR TECH COMPANY ANNOUNCES 19000 LAYOFFS NATIONWIDE TODAY' },
    ])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const shortSize = (c.slides[0] as { style_overrides: { hook_font_size: number } })
      .style_overrides.hook_font_size
    const longSize = (c.slides[1] as { style_overrides: { hook_font_size: number } })
      .style_overrides.hook_font_size
    // A flat constant would make these equal — the auto-fit makes them differ.
    expect(longSize).toBeLessThan(shortSize)
  })

  it('a short headline is sized near the ceiling so it dominates the slide', () => {
    const c = carousel([{ hook_text: 'BREAKING' }])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const size = (c.slides[0] as { style_overrides: { hook_font_size: number } })
      .style_overrides.hook_font_size
    expect(size).toBeGreaterThanOrEqual(200)
  })

  it('respects a pre-existing hook_font_size override', () => {
    const c = carousel([
      { hook_text: 'TECH LAYOFFS', style_overrides: { hook_font_size: 150, layout: 'cover' } },
    ])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const ov = (c.slides[0] as { style_overrides: { hook_font_size: number; layout: string } })
      .style_overrides
    expect(ov.hook_font_size).toBe(150)
    // pre-existing sibling fields preserved.
    expect(ov.layout).toBe('cover')
  })
})

describe('Phase 82 — idempotence', () => {
  it('a second call is a no-op (pills + size already set)', () => {
    const c = carousel([{ hook_text: 'MAJOR TECH COMPANY ANNOUNCES 19000 LAYOFFS' }])
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    const firstSegs = JSON.stringify((c.slides[0] as { hook_segments: unknown }).hook_segments)
    const firstSize = (c.slides[0] as { style_overrides: { hook_font_size: number } })
      .style_overrides.hook_font_size
    promoteNewsHeadline(c, NEWS_CYAN_ACCENT)
    expect(JSON.stringify((c.slides[0] as { hook_segments: unknown }).hook_segments)).toBe(firstSegs)
    expect((c.slides[0] as { style_overrides: { hook_font_size: number } }).style_overrides.hook_font_size)
      .toBe(firstSize)
  })
})
