// Phase 54 (D-09, D-10, D-11, D-12, SLOP-01/02/04): Single source of truth
// for AI-slop guardrails. Imported by every Imagen call site, the Pexels
// search wrapper, and the premium-tier system-prompt assembly.
//
// Strings below are LOCKED VERBATIM by Phase 54 CONTEXT.md decisions. The
// unit test in __tests__/slop-guardrails.test.ts grep-checks the literal
// substrings — accidental mutation breaks tests in CI. Update via a new
// CONTEXT decision (D-XX), never silently.

export const IMAGEN_ADDENDUM: string =
  "Do not generate gradient backgrounds. " +
  "Do not generate glossy 3D objects or abstract color blobs. " +
  "Do not generate purple-to-blue, sunset orange-to-pink, or teal-to-navy gradients. " +
  "Generate documentary-style photographs with naturalistic lighting."

export const AI_HOOK_VARIETY_ADDENDUM: string =
  "Do not start hooks with 'In a world where', 'Did you know', or 'Imagine if'. " +
  "Vary hook openings across slides in the same carousel — no two slides should start with the same word or phrase pattern."

export const PEXELS_POSITIVE_TERMS = ' natural lighting, candid, editorial, portrait' as const

export const PEXELS_NEGATIVE_ALT_TERMS = [
  'meeting',
  'office',
  'team',
  'smiling',
  'diverse group',
  'business meeting',
  'group of people',
] as const

/**
 * Append positive terms to a Pexels query string (D-11). The Pexels API
 * weights all terms; appending steers results toward editorial photography
 * without dropping the user's intent.
 */
export function pexelsQueryWithGuardrails(query: string): string {
  return `${query}${PEXELS_POSITIVE_TERMS}`
}

/**
 * Drop photos whose alt text contains any of the negative terms (case-
 * insensitive). Per D-11, NEVER block generation: if filtering empties the
 * result set, return the original photos unchanged. Tracking failure /
 * over-aggressive filtering must not stall the slide pipeline.
 */
export function filterPexelsResultsByAlt<T extends { alt?: string | null }>(
  photos: T[],
): T[] {
  const filtered = photos.filter((p) => {
    const alt = (p.alt ?? '').toLowerCase()
    return !PEXELS_NEGATIVE_ALT_TERMS.some((neg) => alt.includes(neg))
  })
  return filtered.length > 0 ? filtered : photos
}

// Quick-260502-ntp: forbid list for the Gemini system prompt — synthesized
// from tropes.fyi, the Wikipedia "Signs of AI writing" page, Plagiarism
// Today's 2025 AI-tells survey, and the Goedecke em-dash analysis. Imported
// by prompts.ts and appended unconditionally to every system instruction.
// Lives here (not inline in prompts.ts) so it's a single source of truth and
// individually testable.
//
// The em-dash rule is intentionally a "cluster" rule, not a blanket ban —
// isolated em-dashes are fine; >=2 in one slide reads as AI.
export const AI_SLOP_AVOID_ADDENDUM: string =
  "AVOID — these patterns make copy read as AI-generated. Do not use any of them:\n" +
  "- Negative parallelism: 'It's not X. It's Y.' / 'It's not just X — it's Y.'\n" +
  "- Em-dash clusters: never use more than one em-dash (—) in a single slide's hook + body combined.\n" +
  "- Pedagogical openers: 'Let's dive in', 'Let's unpack', 'Let's break this down', 'Buckle up'.\n" +
  "- Filler transitions: 'It's worth noting', 'Importantly', 'Notably', 'Interestingly', 'Here's the thing', 'Here's the kicker'.\n" +
  "- Magic adverbs as adjective-boosters: 'quietly', 'deeply', 'fundamentally', 'remarkably', 'genuinely'.\n" +
  "- Grandiose abstract nouns: 'tapestry', 'landscape', 'paradigm', 'ecosystem', 'synergy', 'journey', 'realm'.\n" +
  "- Overused verbs: 'delve into', 'leverage', 'utilize', 'harness', 'streamline', 'unlock', 'unleash', 'navigate'.\n" +
  "- The 'serves as' dodge: write 'X is Y', not 'X serves as Y' / 'X stands as Y' / 'X represents Y'.\n" +
  "- Tricolon abuse: avoid stacked 'A, B, and C' / 'from X to Y to Z' rhythms more than once per carousel.\n" +
  "- Listicle openers ('Here are 5...', 'Let's count down...') — these clash with editorial / personal templates.\n" +
  "- Signposted conclusions: 'In conclusion', 'To sum up', 'In summary', 'All in all'.\n" +
  "- Bold-first bullet pattern where every list item begins with a bolded label followed by a colon.\n" +
  "- Hedging adverbs that drain confidence: 'perhaps', 'potentially', 'arguably', 'somewhat', 'generally'.\n" +
  "- False ranges: 'from beginners to experts' with no real middle. State the actual audience.\n" +
  "- 'Imagine a world where' / 'In a world where' / 'Did you know' — already forbidden, repeated for emphasis."
