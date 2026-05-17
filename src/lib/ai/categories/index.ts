// Phase 82 (R1): the content-category registry.
//
// Mirrors src/lib/render/templates/index.ts — a typed interface (CategoryModule),
// an array export (CATEGORIES), an id-derived closed enum (CONTENT_CATEGORIES),
// and an id-keyed lookup (getCategory).
//
// Extensible framework (82-SPEC Constraints): Health & Wellness, Beauty, etc.
// join later by adding a module + an entry to CATEGORIES and CONTENT_CATEGORIES.
// Prompt assembly (buildSystemPrompt) and routing do not change. Only
// `ready: true` categories are registered here this phase.

import type { CategoryModule } from './types'
import { newsCategory } from './news'
import { factsCategory } from './facts'

export type { CategoryModule } from './types'

/** The ordered category registry. News first — it is the primary deliverable. */
export const CATEGORIES: CategoryModule[] = [newsCategory, factsCategory]

/**
 * The closed string-literal tuple of content-category ids. Kept explicit
 * (`as const`) so the union type stays narrow — deriving via `.map()` would
 * widen to `string[]`.
 */
export const CONTENT_CATEGORIES = ['news', 'facts'] as const

/** The content-category string-literal union (`'news' | 'facts'`). */
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number]

/**
 * Id-keyed category lookup. Returns `undefined` for an unknown id — the caller
 * decides the fallback. Generation-side code treats an unknown category as a
 * hard validation error; there is no silent fallback (SPEC R7).
 */
export function getCategory(id: string): CategoryModule | undefined {
  return CATEGORIES.find((c) => c.id === id)
}

/**
 * The default category the creation form preselects. News is the reported
 * pain point and the primary deliverable of this phase.
 */
export const DEFAULT_CATEGORY: ContentCategory = 'news'
