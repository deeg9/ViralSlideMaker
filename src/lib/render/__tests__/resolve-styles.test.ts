/**
 * quick-260520-064 Task 1: type-widening + ruled-highlight helper coverage.
 *
 * This file is created by the kicker-as-accessory_label conversion. Its tests
 * cover:
 *   - the `TextHighlightEffect.style` enum now accepts `'ruled'`
 *   - the resolver's `ResolvedTextEffectStyles.highlight.style` field also
 *     accepts `'ruled'` after the type widening
 *   - the new shared geometry helper `RULED_HIGHLIGHT` exports the 7 frozen
 *     constants byte-identical to the deleted breaking-news-badge.ts spec
 *   - `ruledHighlightTopPctFromCaptionCardY` matches the deleted
 *     `breakingNewsBadgeTopPct` formula to 4 decimal places at the
 *     CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT reference value
 *   - `liveCaptionCardTopPct` mirrors `resolveCaptionBar(...).y` math
 *     across all four fallback branches.
 */

import { describe, it, expect } from 'vitest'
import { resolveTextEffects, type ResolvedTextEffectStyles } from '../resolve-styles'
import type { TextHighlightEffect } from '@/lib/types/slide'
import {
  RULED_HIGHLIGHT,
  ruledHighlightTopPctFromCaptionCardY,
  liveCaptionCardTopPct,
} from '../ruled-highlight'
import { CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT } from '../hook-fit'
import { newsOracle } from '../templates/news-oracle'

describe("quick-260520-064 Task 1 — TextHighlightEffect.style accepts 'ruled'", () => {
  it("type-level: 'tight' | 'full' | 'ruled' all satisfy TextHighlightEffect.style", () => {
    // Compile-time check: these `satisfies` expressions fail to compile if the
    // enum is not widened. Runtime asserts are a thin smoke layer on top.
    const tight = { enabled: true, color: '#000000CC', style: 'tight', padding: 8 } satisfies TextHighlightEffect
    const full = { enabled: true, color: '#000000CC', style: 'full', padding: 8 } satisfies TextHighlightEffect
    const ruled = { enabled: true, color: '#000000CC', style: 'ruled', padding: 16 } satisfies TextHighlightEffect
    expect(tight.style).toBe('tight')
    expect(full.style).toBe('full')
    expect(ruled.style).toBe('ruled')
  })

  it("resolveTextEffects passes 'ruled' through to ResolvedTextEffectStyles.highlight", () => {
    const resolved: ResolvedTextEffectStyles = resolveTextEffects({
      highlight: { enabled: true, color: '#ffffff', style: 'ruled', padding: 16 },
    })
    expect(resolved.highlight?.style).toBe('ruled')
    expect(resolved.highlight?.enabled).toBe(true)
    expect(resolved.highlight?.color).toBe('#ffffff')
  })
})

describe('quick-260520-064 Task 1 — RULED_HIGHLIGHT geometry constants', () => {
  it('matches the frozen breaking-news-badge baseline byte-for-byte', () => {
    expect(RULED_HIGHLIGHT.fontSizePx).toBe(28)
    expect(RULED_HIGHLIGHT.letterSpacingPx).toBe(4)
    expect(RULED_HIGHLIGHT.lineLengthPx).toBe(96)
    expect(RULED_HIGHLIGHT.lineThicknessPx).toBe(2)
    expect(RULED_HIGHLIGHT.lineGapPx).toBe(16)
    expect(RULED_HIGHLIGHT.bottomOffsetPx).toBe(28)
    expect(RULED_HIGHLIGHT.totalHeightPx).toBe(36)
  })

  it('ruledHighlightTopPctFromCaptionCardY matches the deleted breakingNewsBadgeTopPct formula', () => {
    // Reproduce the deleted formula inline so this test stands on its own
    // (the source-of-truth file is deleted in Task 4).
    const cardTopPct = CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT
    const H = 1920
    const cardTopPx = (cardTopPct / 100) * H
    const expectedTopPx = cardTopPx - 28 /* bottomOffset */ - 36 /* totalHeight */
    const expectedPct = (expectedTopPx / H) * 100
    expect(ruledHighlightTopPctFromCaptionCardY(cardTopPct)).toBeCloseTo(expectedPct, 4)
  })

  it('ruledHighlightTopPctFromCaptionCardY scales linearly with the card top edge', () => {
    const a = ruledHighlightTopPctFromCaptionCardY(50)
    const b = ruledHighlightTopPctFromCaptionCardY(60)
    expect(b - a).toBeCloseTo(10, 5)
  })
})

describe('quick-260520-064 Task 1 — liveCaptionCardTopPct mirrors resolveCaptionBar Y math', () => {
  it("no overrides: returns 100 - template.captionCardDefaults?.heightPct (news-oracle = 100-42 = 58)", () => {
    const expected = 100 - (newsOracle.captionCardDefaults?.heightPct ?? CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT)
    expect(liveCaptionCardTopPct(undefined, newsOracle)).toBeCloseTo(expected, 4)
  })

  it('explicit caption_bar_y wins (drag)', () => {
    expect(liveCaptionCardTopPct({ caption_bar_y: 70 }, newsOracle)).toBe(70)
  })

  it('caption_bar_height_pct alone: bottom-default → 100 - heightPct', () => {
    expect(liveCaptionCardTopPct({ caption_bar_height_pct: 50 }, newsOracle)).toBe(50)
  })

  it('caption_bar_position = top: positionY = 0', () => {
    expect(liveCaptionCardTopPct({ caption_bar_position: 'top' }, newsOracle)).toBe(0)
  })

  it('explicit caption_bar_y wins over position-derived default', () => {
    expect(
      liveCaptionCardTopPct({ caption_bar_position: 'top', caption_bar_y: 5 }, newsOracle),
    ).toBe(5)
  })
})
