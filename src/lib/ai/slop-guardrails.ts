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
