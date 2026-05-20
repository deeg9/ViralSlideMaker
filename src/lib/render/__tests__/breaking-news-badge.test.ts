/**
 * quick-260519-bkn: gating + geometry tests for the shared BREAKING NEWS
 * badge spec.
 */
import { describe, it, expect } from 'vitest'
import {
  BREAKING_NEWS_BADGE,
  shouldShowBreakingNewsBadge,
  breakingNewsBadgeTopPct,
  BREAKING_NEWS_CANVAS_H,
} from '../breaking-news-badge'

describe('shouldShowBreakingNewsBadge — gate', () => {
  it('returns true ONLY for news-oracle covers', () => {
    expect(shouldShowBreakingNewsBadge('news-oracle', 'cover')).toBe(true)
  })

  it('returns false for news-oracle non-cover slides', () => {
    expect(shouldShowBreakingNewsBadge('news-oracle', 'body')).toBe(false)
    expect(shouldShowBreakingNewsBadge('news-oracle', 'support')).toBe(false)
    expect(shouldShowBreakingNewsBadge('news-oracle', 'close')).toBe(false)
    expect(shouldShowBreakingNewsBadge('news-oracle', undefined)).toBe(false)
    expect(shouldShowBreakingNewsBadge('news-oracle', null)).toBe(false)
  })

  it('returns false for cover slides on other templates', () => {
    expect(shouldShowBreakingNewsBadge('news-drop', 'cover')).toBe(false)
    expect(shouldShowBreakingNewsBadge('news-cyan', 'cover')).toBe(false)
    expect(shouldShowBreakingNewsBadge('tr3nding-news', 'cover')).toBe(false)
    expect(shouldShowBreakingNewsBadge('magazine-bold', 'cover')).toBe(false)
  })
})

describe('breakingNewsBadgeTopPct — geometry', () => {
  it('puts the badge bottom edge above the caption-card top by the configured offset', () => {
    // For a card at y=62%, badge bottom should be at 62%*1920 - 28 = 1190.4 - 28 = 1162.4 px.
    // Badge top = badge bottom - totalHeightPx (36) = 1126.4 px = 58.67% of 1920.
    const topPct = breakingNewsBadgeTopPct(62)
    const expectedTopPx =
      (62 / 100) * BREAKING_NEWS_CANVAS_H -
      BREAKING_NEWS_BADGE.bottomOffsetPx -
      BREAKING_NEWS_BADGE.totalHeightPx
    expect(topPct).toBeCloseTo((expectedTopPx / BREAKING_NEWS_CANVAS_H) * 100, 5)
  })

  it('scales linearly with the card top edge', () => {
    const a = breakingNewsBadgeTopPct(50)
    const b = breakingNewsBadgeTopPct(60)
    // 10% increase in card top should also shift the badge top by ~10%.
    expect(b - a).toBeCloseTo(10, 5)
  })
})

describe('BREAKING_NEWS_BADGE spec — frozen baseline', () => {
  it('matches the published spec from PLAN.md', () => {
    expect(BREAKING_NEWS_BADGE.text).toBe('BREAKING NEWS')
    expect(BREAKING_NEWS_BADGE.fontSizePx).toBe(28)
    expect(BREAKING_NEWS_BADGE.letterSpacingPx).toBe(4)
    expect(BREAKING_NEWS_BADGE.lineLengthPx).toBe(96)
    expect(BREAKING_NEWS_BADGE.lineThicknessPx).toBe(2)
    expect(BREAKING_NEWS_BADGE.lineGapPx).toBe(16)
    expect(BREAKING_NEWS_BADGE.bottomOffsetPx).toBe(28)
  })
})
