// Phase 82 Gap B + Gap C/D: post-generation transform for News-category carousels.
//
// The R10 visual sign-off found two coupled defects in generated news slides:
//
//   Gap B — News does not highlight keywords. Generated news slides render
//   plain white text. Root causes: (1) Gemini-emitted `accent: true` alone
//   renders as two-color *text* — the renderer's PILL branch
//   (resolve-overlay.ts) only fires when a segment carries `highlightColor`;
//   the user's target (Screenshot 2026-05-17 at 2.13.25 PM.png) is a colored
//   pill behind the word. (2) `hook_segments` is schema-OPTIONAL in both the
//   Zod schema and the Gemini response schema, so Gemini can return a headline
//   with no segments at all — and on the user's test run it did, leaving the
//   headline entirely un-highlighted.
//
//   Gap C/D — generated headline sizing. Generation never sets `font_size`;
//   the R10-round-1 fix stamped a flat 200 onto every slide, which the R10
//   round-2 sign-off found overflows the slide and breaks mid-word for long
//   headlines (Gap D). The headline must AUTO-FIT — sized as large as fits its
//   box without overflowing or splitting a word — relative to where the text
//   is and where the caption card / black box is. Target: `~/Desktop/
//   Screenshot 2026-05-17 at 3.06.22 PM.png` (headline cleanly contained,
//   whole words). The fit uses the shared `fitHeadlineToBox` auto-fit
//   (hook-fit.ts); the renderer re-fits to a draggable caption card when one
//   is enabled (Plan 09).
//
// This module is the single shared fix: `generateSlideContent` invokes it for
// the news category AFTER `CarouselSchema.parse` and BEFORE `legacyToTextBoxes`,
// so the pill segments + headline size flow into both the legacy slide fields
// (read directly by both renderers) and the derived `text_boxes`.
//
// Pure module — no I/O, no Gemini, never throws. Mirrors validateAndRepair's
// documented in-place-mutation contract; also returns the carousel for chaining.

import { fitHeadlineToBox, type HeadlineBox } from '@/lib/render/hook-fit'

/** Phase 82 Gap D: the default news hook-zone box on the 1080×1920 canvas — a
 *  headline-only news slide (R4 default — no body, no caption card enabled at
 *  generation time). 842 ≈ 78% of the 1080 canvas (the practical news hook
 *  container width cited in hook-fit.ts's HOOK_FIT_REGISTRY comments); 620 is
 *  the headline-only vertical zone from the cover-layout hookY (~60%) down to
 *  the bottom safe margin. `promoteNewsHeadline` fits each headline to this box
 *  via `fitHeadlineToBox`; the renderer re-fits to a caption card when one is
 *  enabled on the slide (Plan 09). */
const NEWS_DEFAULT_HEADLINE_BOX: HeadlineBox = { widthPx: 842, heightPx: 620 }

// Connector / stopwords — never accented (mirrors the news.ts prompt rule).
// Lowercased for case-insensitive comparison.
const CONNECTOR_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'of', 'on', 'and', 'is', 'to', 'in', 'for',
  'with', 'at', 'by', 'as', 'or', 'but', 'from', 'into',
])

/** A loosely-typed text segment — composes with both the Zod-inferred
 *  `TextSegmentContent` and the renderer-side `TextSegment`. */
interface LooseSegment {
  text: string
  accent?: boolean
  highlightColor?: string
  highlightStyle?: 'pill'
  [k: string]: unknown
}

interface LooseNewsSlide {
  hook_text: string
  hook_segments?: LooseSegment[]
  style_overrides?: { hook_font_size?: number; [k: string]: unknown }
  [k: string]: unknown
}

/** Strip leading/trailing punctuation for the content-word length comparison
 *  (so "LAYOFFS." competes on the same footing as "LAYOFFS"). The segment
 *  TEXT itself keeps its punctuation — only the comparison key is stripped. */
function comparisonKey(word: string): string {
  return word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').toLowerCase()
}

function isConnector(word: string): boolean {
  return CONNECTOR_WORDS.has(comparisonKey(word))
}

/**
 * Derive pill-highlighted `hook_segments` from a bare `hook_text`.
 *
 * Splits on whitespace into one run per word. Marks the 1-2 LONGEST
 * non-connector words as accented pills (ties → earliest index wins). If the
 * headline has only connector words (or one word), the single longest word is
 * accented regardless — a news headline ALWAYS gets ≥ 1 pill.
 */
function deriveSegments(hookText: string, accentColorHex: string): LooseSegment[] {
  const words = hookText.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  // Candidate indices for accenting, ranked by content-word length desc.
  const contentIndices = words
    .map((w, i) => ({ i, len: comparisonKey(w).length, connector: isConnector(w) }))
    .filter((c) => !c.connector && c.len > 0)
    .sort((a, b) => (b.len - a.len) || (a.i - b.i))

  let accentIndices: number[]
  if (contentIndices.length > 0) {
    // Accent the 1-2 longest content words.
    const take = Math.min(2, contentIndices.length)
    accentIndices = contentIndices.slice(0, take).map((c) => c.i)
  } else {
    // All-connector / degenerate headline — accent the single longest word so
    // the guarantee (≥ 1 pill per headline) always holds.
    let longest = 0
    for (let i = 1; i < words.length; i++) {
      if (comparisonKey(words[i]).length > comparisonKey(words[longest]).length) longest = i
    }
    accentIndices = [longest]
  }
  const accentSet = new Set(accentIndices)

  return words.map((text, i) => {
    if (accentSet.has(i)) {
      return { text, accent: true, highlightColor: accentColorHex, highlightStyle: 'pill' as const }
    }
    return { text, accent: false }
  })
}

/**
 * Promote a News-category carousel to pill-highlighted, large-headline output.
 *
 * Per slide:
 *  - Gap B1 — if the slide already has accented `hook_segments`, every
 *    `accent: true` run gains `highlightColor = accentColorHex` +
 *    `highlightStyle: 'pill'` (mirrors the editor's `toggleAccent`).
 *  - Gap B2 — if the slide has no `hook_segments` / an empty array / none
 *    accented, segments are derived deterministically from `hook_text`.
 *  - Gap D — `style_overrides.hook_font_size` is set to an AUTO-FIT size:
 *    `fitHeadlineToBox(hook_text, NEWS_DEFAULT_HEADLINE_BOX)` — as large as fits
 *    the news hook box without overflowing or breaking mid-word, instead of a
 *    flat constant (a pre-existing `hook_font_size` is respected and left as-is).
 *
 * GUARANTEE: after this call every slide has `hook_segments` with ≥ 1 entry
 * where `accent === true && highlightColor === accentColorHex &&
 * highlightStyle === 'pill'`.
 *
 * Mutates in place and returns the same carousel object (for chaining).
 */
export function promoteNewsHeadline<T extends { slides: LooseNewsSlide[] }>(
  carousel: T,
  accentColorHex: string,
): T {
  for (const slide of carousel.slides) {
    const existing = slide.hook_segments
    const hasAccentedSegment =
      Array.isArray(existing) &&
      existing.length > 0 &&
      existing.some((s) => s.accent === true)

    if (hasAccentedSegment) {
      // Gap B1 — promote Gemini's existing accents to pills.
      slide.hook_segments = existing!.map((s) =>
        s.accent === true
          ? { ...s, accent: true, highlightColor: accentColorHex, highlightStyle: 'pill' as const }
          : { ...s, accent: false },
      )
    } else {
      // Gap B2 — Gemini emitted no usable segments; derive them so the
      // headline is never left plain (the "no highlight at all" defect).
      slide.hook_segments = deriveSegments(slide.hook_text ?? '', accentColorHex)
    }

    // Gap D — auto-fit headline size. Sized as large as fits the default news
    // hook box without overflowing or splitting a word — NOT a flat constant.
    // Respect a pre-existing override if present.
    const overrides = slide.style_overrides ?? {}
    if (overrides.hook_font_size == null) {
      const fitted = fitHeadlineToBox(slide.hook_text ?? '', NEWS_DEFAULT_HEADLINE_BOX)
      slide.style_overrides = { ...overrides, hook_font_size: fitted }
    }
  }
  return carousel
}
