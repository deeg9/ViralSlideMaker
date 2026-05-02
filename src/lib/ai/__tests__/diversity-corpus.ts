// Phase 58 (AIROLE-02, D-13): 20-prompt fixed corpus across 10 creator
// niches, 2 per niche. Locked verbatim — future phases can extend per
// category, never replace.
//
// Used by diversity.test.ts (advisory) to measure hook-opening trigram
// repetition. Threshold 30% per D-14. ADVISORY in v2.9 — logs warning
// but does not fail CI (orchestrator hard constraint).

export const DIVERSITY_CORPUS: ReadonlyArray<string> = [
  // Food
  '5 ways to use leftover rice',
  'why your sourdough never rises',
  // Fashion
  'fall capsule wardrobe in 6 pieces',
  'thrift store outfit for under $20',
  // Tech
  'one Cursor shortcut that 10x my coding',
  'why I switched from Mac to Linux',
  // Fitness
  'how to fix your posture while working from home',
  'one move that fixed my lower back pain',
  // Finance
  'how to budget on $40k a year',
  'the one ETF I bought instead of stocks',
  // Parenting
  'getting a toddler to eat vegetables',
  '3 boundaries that saved my sanity as a new mom',
  // Travel
  'Tokyo on $80 a day',
  'one packing trick that changed my carry-on game',
  // Beauty
  '3-step skincare for sensitive skin',
  'the one mascara worth $30',
  // Productivity
  'how I plan my week in 15 minutes',
  'one habit that doubled my deep-work hours',
  // Mental health
  'how I journal without overthinking',
  'one boundary that improved my anxiety',
] as const
