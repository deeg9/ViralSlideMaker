// Phase 85 Plan 02 (RECGEN-01):
// resolveLayoutRecipe — the single recipe-resolution entry point for the
// carousel-generation pipeline. Given a template id, it fetches that
// template's `layout_recipe` column and parses it through the Phase 84
// validation firewall.
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
//   - NEVER throws. A missing row, a null column, a DB error, or a
//     malformed recipe ALL degrade gracefully to `null`. Generation must
//     never break on recipe-resolution failure. Mirrors the registry.ts
//     "never throws — degrades to code-templates-only" contract.
//   - A `null` result means "no recipe" — applyLayoutRecipe is then a
//     no-op and the generation is byte-identically the pre-Phase-85 path.
//   - The 13 CODE templates carry NO layout_recipe (only DB templates can);
//     a code-template id short-circuits to `null` with no DB round-trip.
//   - A malformed recipe (parseLayoutRecipeSafe ok:false) → `null`, not an
//     error — bad recipe data degrades to the flat-style-only path.
// =====================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

import type { LayoutRecipe } from '@/lib/types/layout-recipe'
import { parseLayoutRecipeSafe } from '@/lib/validators/layout-recipe'
import { TEMPLATE_IDS } from '@/lib/render/templates'

// O(1) membership check for the code-template short-circuit.
const CODE_TEMPLATE_ID_SET: ReadonlySet<string> = new Set(TEMPLATE_IDS)

/**
 * Resolve a template id to its parsed LayoutRecipe, or `null` when the
 * template carries no (valid) recipe.
 *
 * Used by both `generateCarousel` paths immediately before applying the
 * recipe to the generated slides. Never throws.
 *
 * @param supabase   Any Supabase client (the templates table has a public
 *                   SELECT RLS policy — anon / user / admin all work).
 * @param templateId The resolved effective template id.
 * @returns          The parsed LayoutRecipe, or null.
 */
export async function resolveLayoutRecipe(
  supabase: SupabaseClient,
  templateId: string,
): Promise<LayoutRecipe | null> {
  // Code templates never carry a recipe — skip the DB round-trip entirely.
  if (CODE_TEMPLATE_ID_SET.has(templateId)) return null

  try {
    const { data, error } = await supabase
      .from('templates')
      .select('layout_recipe')
      .eq('id', templateId)
      .maybeSingle()

    if (error || !data) return null

    const raw = (data as { layout_recipe: unknown }).layout_recipe
    if (raw == null) return null

    const result = parseLayoutRecipeSafe(raw)
    // A malformed recipe degrades to the no-recipe path — generation must
    // never break on bad recipe data.
    return result.ok ? result.recipe : null
  } catch {
    return null
  }
}
