/**
 * Phase 55 (D-21, D-Risk #5, SLOP-03): single source of truth for premium-tier
 * classification, in a leaf module to avoid the import cycle between
 * `templates/index.ts` (which imports `validateTemplateRegistry` from `./validate`)
 * and `templates/validate.ts` (which needs PREMIUM_TEMPLATE_IDS at module-load time).
 *
 * Consumed by:
 *   - templates/index.ts (re-exports for public API consumers)
 *   - templates/validate.ts (premium bodyFontFamily check)
 *   - tests (templates.test.ts, validate.test.ts)
 *   - validate-slides.ts:isPremiumTemplate (opportunistic refactor — see CONTEXT.md D-27)
 */
export const PREMIUM_TEMPLATE_IDS = ['magazine-bold', 'tr3nding-news', 'documentary'] as const

export type PremiumTemplateId = typeof PREMIUM_TEMPLATE_IDS[number]
