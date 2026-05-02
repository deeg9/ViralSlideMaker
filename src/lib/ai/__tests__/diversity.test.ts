// Phase 58 (AIROLE-02, D-14): advisory diversity gate.
//
// Hook-opening trigram repetition rate metric. ADVISORY in v2.9 — logs
// warning if rate >= 30% but does NOT fail CI (orchestrator hard
// constraint).
//
// Live Gemini wiring is out-of-scope for v2.9 (would burn credits in
// CI on every PR). The corpus + metric machinery exists; v3.0 can add
// the live diversity test when monoculture risk is observed in
// production.

import { describe, it, expect } from 'vitest'
import { DIVERSITY_CORPUS } from './diversity-corpus'

const ADVISORY_THRESHOLD = 0.30

/**
 * D-14: extract first 3 case-folded whitespace tokens of a hook string.
 * Returns canonical 3-word "trigram" key for repetition detection.
 */
function hookOpeningTrigram(hook: string): string {
  return hook
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
}

describe('Phase 58 (AIROLE-02, D-13, D-14): AI hook-opening diversity gate (advisory)', () => {
  it('exposes a 20-prompt fixed corpus across 10 niches', () => {
    expect(DIVERSITY_CORPUS).toHaveLength(20)
    const unique = new Set(DIVERSITY_CORPUS)
    expect(unique.size).toBe(20) // no duplicate prompts
  })

  it('hookOpeningTrigram extracts first 3 lowercase tokens', () => {
    expect(hookOpeningTrigram('Why Your Sourdough Never Rises')).toBe(
      'why your sourdough',
    )
    expect(hookOpeningTrigram('  3-step skincare  for sensitive skin  ')).toBe(
      '3-step skincare for',
    )
    expect(hookOpeningTrigram('one')).toBe('one')
  })

  it('computes trigram-repetition rate (advisory; warns but does not fail)', () => {
    // Synthetic sample exercises the metric without burning Gemini credits.
    // In v2.9 this test is ADVISORY: it logs a warning if rate >= 0.30.
    // CI does NOT fail on threshold trip (orchestrator hard constraint).
    const fakeHooks = [
      'the one thing nobody talks about',
      'why your sourdough never rises',
      'fall capsule wardrobe in 6 pieces',
      'thrift store outfit for under $20',
      'one Cursor shortcut that 10x my coding',
      'why I switched from Mac to Linux',
      'how to fix your posture',
      'one move that fixed my lower back pain',
      'how to budget on $40k',
      'the one ETF I bought',
      'getting a toddler to eat',
      '3 boundaries that saved my sanity',
      'Tokyo on $80 a day',
      'one packing trick that changed',
      '3-step skincare for sensitive skin',
      'the one mascara worth $30',
      'how I plan my week',
      'one habit that doubled my hours',
      'how I journal without overthinking',
      'one boundary that improved my anxiety',
    ]
    const trigrams = new Set(fakeHooks.map(hookOpeningTrigram))
    const rate = 1 - trigrams.size / fakeHooks.length

    if (rate >= ADVISORY_THRESHOLD) {
      console.warn(
        `[diversity] hook-opening trigram repetition ${(rate * 100).toFixed(
          1,
        )}% (threshold ${ADVISORY_THRESHOLD * 100}%) — ADVISORY, does not fail CI in v2.9`,
      )
    }
    // Assert the test executed; do NOT assert rate threshold (advisory).
    expect(rate).toBeLessThanOrEqual(1.0)
    expect(rate).toBeGreaterThanOrEqual(0)
  })

  it('detects high repetition (synthetic stress test) — advisory only', () => {
    const repetitive = Array.from({ length: 20 }, () => 'the one thing about')
    const trigrams = new Set(repetitive.map(hookOpeningTrigram))
    const rate = 1 - trigrams.size / repetitive.length
    // 20 identical openings → rate = 1 - 1/20 = 0.95
    expect(rate).toBeCloseTo(0.95, 2)
    // Even though rate >> 30%, the test does not fail (advisory).
    if (rate >= ADVISORY_THRESHOLD) {
      console.warn(
        `[diversity] synthetic stress test hit ${(rate * 100).toFixed(
          1,
        )}% — verifies metric works`,
      )
    }
  })
})
