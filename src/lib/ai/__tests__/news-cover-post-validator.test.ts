/**
 * quick-260520-064 Task 3 (R3): post-validator that coerces overly-long
 * news-oracle cover accessory_labels to the safe 'BREAKING NEWS' fallback.
 *
 * Cover-only; news-oracle-only; mutates in place; never throws.
 */

import { describe, it, expect } from 'vitest'
import { applyNewsCoverAccessoryLabelGuard } from '@/lib/ai/generate-slides'

/** Minimal carousel shape the guard reads. */
type GuardSlide = { role?: string; accessory_label?: string }
function build(slides: GuardSlide[]): { slides: GuardSlide[] } {
  return { slides }
}

describe('quick-260520-064 R3 — applyNewsCoverAccessoryLabelGuard', () => {
  it('1. coerces a >24-char accessory_label on a news-oracle cover to "BREAKING NEWS"', () => {
    const carousel = build([
      { role: 'cover', accessory_label: 'BREAKING NEWS RIGHT NOW IT IS HAPPENING' },
    ])
    applyNewsCoverAccessoryLabelGuard(carousel, 'news-oracle')
    expect(carousel.slides[0].accessory_label).toBe('BREAKING NEWS')
  })

  it('2. coerces a >3-word accessory_label on a news-oracle cover to "BREAKING NEWS"', () => {
    const carousel = build([
      { role: 'cover', accessory_label: 'ALERT TODAY MORNING NEWSDESK SCOOP' },
    ])
    applyNewsCoverAccessoryLabelGuard(carousel, 'news-oracle')
    expect(carousel.slides[0].accessory_label).toBe('BREAKING NEWS')
  })

  it('3. leaves a 1-word 9-char label "EXCLUSIVE" UNCHANGED', () => {
    const carousel = build([{ role: 'cover', accessory_label: 'EXCLUSIVE' }])
    applyNewsCoverAccessoryLabelGuard(carousel, 'news-oracle')
    expect(carousel.slides[0].accessory_label).toBe('EXCLUSIVE')
  })

  it('4. leaves accessory_label === undefined UNCHANGED (adapter handles the unset case)', () => {
    const carousel = build([{ role: 'cover' }])
    applyNewsCoverAccessoryLabelGuard(carousel, 'news-oracle')
    expect(carousel.slides[0].accessory_label).toBeUndefined()
  })

  it('5. leaves accessory_label === "" UNCHANGED (user opt-out semantic preserved)', () => {
    const carousel = build([{ role: 'cover', accessory_label: '' }])
    applyNewsCoverAccessoryLabelGuard(carousel, 'news-oracle')
    expect(carousel.slides[0].accessory_label).toBe('')
  })

  it('6. leaves a long label on a non-cover slide UNCHANGED (cover-only guard)', () => {
    const carousel = build([
      { role: 'support', accessory_label: 'A VERY LONG SUPPORT KICKER THAT EXCEEDS BOTH BOUNDS' },
    ])
    applyNewsCoverAccessoryLabelGuard(carousel, 'news-oracle')
    expect(carousel.slides[0].accessory_label).toBe(
      'A VERY LONG SUPPORT KICKER THAT EXCEEDS BOTH BOUNDS',
    )
  })

  it('7. leaves a long label on a non-news-oracle template UNCHANGED (news-oracle-only guard)', () => {
    const carousel = build([
      { role: 'cover', accessory_label: 'A VERY LONG TR3NDING KICKER THAT EXCEEDS BOUNDS' },
    ])
    applyNewsCoverAccessoryLabelGuard(carousel, 'tr3nding-news')
    expect(carousel.slides[0].accessory_label).toBe(
      'A VERY LONG TR3NDING KICKER THAT EXCEEDS BOUNDS',
    )
  })

  it('8. never throws — empty slides + missing role both pass safely', () => {
    expect(() => applyNewsCoverAccessoryLabelGuard({ slides: [] }, 'news-oracle')).not.toThrow()
    expect(() =>
      applyNewsCoverAccessoryLabelGuard(build([{ accessory_label: 'TOO LONG TO COUNT WORDS HERE' }]), 'news-oracle'),
    ).not.toThrow()
    // templateId undefined → fast-skip, no mutation.
    const c = build([{ role: 'cover', accessory_label: 'A VERY LONG SUSPICIOUS KICKER' }])
    expect(() => applyNewsCoverAccessoryLabelGuard(c, undefined)).not.toThrow()
    expect(c.slides[0].accessory_label).toBe('A VERY LONG SUSPICIOUS KICKER')
  })
})
