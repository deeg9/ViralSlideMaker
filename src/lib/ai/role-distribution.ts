// Phase 58 (AIROLE-01, D-05): deterministic role distribution by carousel length.
// Pure function — no I/O, no Gemini, no randomness. Easily unit-testable.

export type SlideRole = 'cover' | 'reframe' | 'support' | 'pivot' | 'close'

export const SLIDE_ROLES: readonly SlideRole[] = [
  'cover',
  'reframe',
  'support',
  'pivot',
  'close',
] as const

const ROLE_TABLE: Record<number, SlideRole[]> = {
  3: ['cover', 'support', 'close'],
  4: ['cover', 'reframe', 'support', 'close'],
  5: ['cover', 'reframe', 'support', 'pivot', 'close'],
  6: ['cover', 'reframe', 'support', 'support', 'pivot', 'close'],
  7: ['cover', 'reframe', 'support', 'support', 'pivot', 'support', 'close'],
  8: [
    'cover',
    'reframe',
    'support',
    'support',
    'pivot',
    'support',
    'support',
    'close',
  ],
  9: [
    'cover',
    'reframe',
    'support',
    'support',
    'pivot',
    'support',
    'support',
    'pivot',
    'close',
  ],
  10: [
    'cover',
    'reframe',
    'support',
    'support',
    'support',
    'pivot',
    'support',
    'support',
    'pivot',
    'close',
  ],
}

/**
 * Phase 58 (AIROLE-01, D-05). Returns a deterministic role array
 * for a carousel of length n. clampedCount in generateCarousel is
 * already capped at 10 — no defaults needed beyond [3, 10].
 *
 * For out-of-range n (defensive — should never happen post-clamp):
 * fall back to ['cover', ...n-2 'support', 'close'].
 */
export function assignSlideRoles(n: number): SlideRole[] {
  if (n in ROLE_TABLE) return [...ROLE_TABLE[n]]
  if (n <= 0) return []
  if (n === 1) return ['cover']
  if (n === 2) return ['cover', 'close']
  // n > 10 — defensive fallback.
  return ['cover', ...(Array(n - 2).fill('support') as SlideRole[]), 'close']
}
