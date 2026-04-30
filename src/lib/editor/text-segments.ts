import type { TextSegment } from '@/lib/types/slide'

/**
 * Phase 50: extracted from text-editor-panel.tsx for reuse by
 * AccentWordsDisclosure (and by the legacy panel until v2.9 sunset).
 *
 * Splits a string into per-word segments, each defaulted to accent=false.
 * Used as the seed value when the user opens the accent-toggler on a slide
 * that doesn't yet have segments stored. Empty / whitespace-only input
 * returns [] so the caller can treat that as "no chips to render".
 */
export function splitToSegments(text: string): TextSegment[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  return trimmed.split(/\s+/).map((word) => ({ text: word, accent: false }))
}
