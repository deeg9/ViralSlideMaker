// Phase 82 (R1, R2, R3): the content-category framework contract.
//
// A content CATEGORY is distinct from the visual TEMPLATE — the category is
// what drives Gemini's copy. One CategoryModule per category; the registry
// (categories/index.ts) aggregates them, mirroring src/lib/render/templates/index.ts.
//
// Extensible framework (82-SPEC Constraints): adding Health & Wellness, Beauty,
// etc. later = drop in a new module + register it. Prompt assembly and routing
// do not change.

/**
 * A content category — distinct from the visual template — that drives
 * Gemini's copy. The registry aggregates one CategoryModule per category.
 */
export interface CategoryModule {
  /** Stable id — also the string-literal union member (e.g. 'news', 'facts'). */
  id: string
  /** Human-readable label for the creation-form category selector. */
  label: string
  /** One-line sub-label for the selector card. */
  tagline: string
  /**
   * True when the category ships a full prompt module this phase.
   * Framework-only categories (Health/Wellness, Beauty) set false → shown as
   * "coming soon" or omitted; never selectable for generation.
   */
  ready: boolean
  /**
   * Ordered list of curated template ids this category may use.
   * templateIds[0] is the category's DEFAULT template. The template picker
   * shows this subset when the category is selected.
   */
  templateIds: readonly string[]
  /**
   * Returns the category's headline-first system-prompt text.
   * Empty for framework-only categories.
   */
  buildPrompt: () => string
}
