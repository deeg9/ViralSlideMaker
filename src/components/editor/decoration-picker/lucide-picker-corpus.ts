/**
 * PICKER-03 (Phase 70 Plan 02 Task 1): LucidePicker fuzzy-search corpus.
 *
 * Pre-built once at module load from LUCIDE_DECORATION_ALLOWLIST (Phase 69-01;
 * 118 PascalCase names) + a derived space-separated word form. ufuzzy index
 * (`@leeoniya/ufuzzy`) handles typo tolerance + fuzzy substring matching.
 *
 * The 250ms user-facing debounce lives in lucide-picker.tsx (Task 2); this
 * module is intentionally pure + synchronous so unit tests can drive it
 * without timer plumbing.
 *
 * Contract:
 *   - Empty / whitespace query → returns the FULL corpus (no-op filter).
 *   - Non-matching query → returns empty array (no false positives).
 *   - Module-level corpus build → re-importing returns the same array
 *     reference (Test 8); a per-call rebuild would re-allocate every keystroke.
 *
 * STRIDE T-70-10 / T-70-13: ufuzzy operates on string indices only. The query
 * text never reaches innerHTML; the picker renders displayName + searchTokens
 * as React text (auto-escaped). No tampering surface. The 250ms debounce
 * (Task 2) caps the call rate so even a 10kHz key event firehose runs the
 * filter ≤ 4 times per second.
 */
import { LUCIDE_DECORATION_ALLOWLIST } from '@/lib/render/decorations/registry'
import uFuzzy from '@leeoniya/ufuzzy'

export interface PickerCorpusEntry {
  /** PascalCase canonical name from LUCIDE_DECORATION_ALLOWLIST (e.g. "ArrowRight"). */
  lucideName: string
  /** PascalCase split into space-separated words for the UI label (e.g. "Arrow Right"). */
  displayName: string
  /** Lowercase searchable string — the ufuzzy haystack entry for this icon. */
  searchTokens: string
}

/**
 * Convert PascalCase → space-separated. "ArrowRight" → "Arrow Right",
 * "X" → "X", "Heart" → "Heart". The leading-letter case isn't significant
 * because we lowercase the haystack for the ufuzzy index.
 */
function pascalCaseToWords(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').trim()
}

/**
 * Module-level corpus. Constructed once at import time; downstream test
 * `Test 8` asserts re-import yields the SAME array reference (no per-call
 * rebuild). Single source of truth for the picker enumeration.
 */
export const LUCIDE_PICKER_CORPUS: readonly PickerCorpusEntry[] =
  LUCIDE_DECORATION_ALLOWLIST.map((name) => {
    const display = pascalCaseToWords(name)
    return {
      lucideName: name,
      displayName: display,
      // Two casings for fuzzy matching: lowered PascalCase + lowered spaced
      // form. ufuzzy's term boundary detection picks up matches across either
      // (e.g. "arrow" matches both "arrowright" and "arrow right").
      searchTokens: `${name.toLowerCase()} ${display.toLowerCase()}`,
    }
  })

/** Pre-extracted haystack — separate array kept in sync at module load so
 *  ufuzzy.search can iterate plain strings without a per-call .map(). */
const SEARCH_HAYSTACK: readonly string[] = LUCIDE_PICKER_CORPUS.map(
  (e) => e.searchTokens,
)

/**
 * ufuzzy options. `intraIns: 1` allows ONE inserted character between matched
 * needle chars within a term — enables 1-char typo tolerance ("hart" → "Heart")
 * without false-positive explosion. Module-level instance so every call shares
 * the regex compilation cost (one-time at import).
 */
const FUZZY_OPTS = { intraIns: 1 }

/** Singleton ufuzzy instance; created once at module import. */
const fuzzy = new uFuzzy(FUZZY_OPTS)

/**
 * Fuzzy-filter the corpus by a user-supplied query. Empty / whitespace query
 * is a no-op (returns the full corpus). Non-matching query returns [].
 *
 * Returns a fresh array on every call (no aliasing of the module-level
 * corpus), so the caller can sort / slice / mutate without poisoning the
 * shared state.
 */
export function filterIcons(
  query: string,
  corpus: readonly PickerCorpusEntry[] = LUCIDE_PICKER_CORPUS,
): PickerCorpusEntry[] {
  if (!query.trim()) return corpus.slice() // no-op filter

  const haystack = SEARCH_HAYSTACK as string[]
  const needle = query.toLowerCase()
  // ufuzzy.search returns [idxs, info, order] — but for our use case the
  // simpler .filter() pre-pass gives the indices we need without the
  // ranking-info overhead.
  const idxs = fuzzy.filter(haystack, needle)
  if (!idxs || idxs.length === 0) return []
  return idxs.map((i) => corpus[i])
}

/** Factory for tests + future advanced consumers (e.g. ranking + highlighting
 *  in a future plan). The default `filterIcons` already wraps a singleton; this
 *  exists for callers that want their own scoped instance. */
export function createUfuzzy(): uFuzzy {
  return new uFuzzy(FUZZY_OPTS)
}
