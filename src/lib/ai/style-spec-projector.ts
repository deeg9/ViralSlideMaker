// Phase 77 Plan 01 (EMIT-07) + STYLESPEC-12 + TPLREND-05:
// projectStyleSpecToSlideOverrides — load-bearing translation of validated
// StyleSpec into the EXISTING SlideStyleOverrides shape. Zero new Slide
// fields introduced — by TypeScript construction (see
// style-spec-projector.types.ts ProjectedSlideOverrides Pick<>).
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
//   - Pure function: same (spec, template) → byte-identical JSON output
//     across N calls. No I/O, no Date.now, no random, no console.
//   - Immutable: never mutates spec or template.
//   - Emit ONLY values that round-trip through both renderers (Satori +
//     React preview). The Pick<>-typed ProjectedSlideOverrides is the
//     compile-time defense; the Phase 71 PTF parity gate is the runtime
//     defense (Plan 02 wires the EMIT-09 roundtrip test).
//   - Skip-emit semantics: when a spec field is undefined, emit NO key
//     in style_overrides. This is what lets applyAspectFilter
//     neutralization → template-default fallback work end-to-end. Adding
//     a value to style_overrides ALWAYS overrides the template.
//   - The projector deals with slide-LEVEL overrides only. The free-text
//     prompt nudge from spec is consumed by Plan 02 inside the Gemini
//     system prompt assembly — NOT here, NOT a slide field.
//   - The cadence section informs Plan 02's prompt cadence guidance —
//     NOT a slide field. Projector ignores it.
//   - Zero React, zero Gemini SDK, zero Supabase imports — verified
//     by source-grep test (Plan-spec Test 17). The forbidden literal
//     strings are intentionally NOT spelled out here so the firewall
//     test cannot trip on its own description.
// =====================================================================
//
// =====================================================================
// DEVIATION (Plan 77-01 grounding mismatch — see types module):
// The plan referenced 'background_color' + 'accent_color' on
// SlideStyleOverrides. Those fields DO NOT EXIST. We route palette
// through the existing v2.9 'derived_palette: string[]' slot, which
// templates with paletteMode: 'palette-dominant' already consume.
// Fixed-palette templates ignore it (zero-impact additive route).
// STYLESPEC-12's "no new Slide fields" rule is preserved.
// =====================================================================
//
// FIELD MAPPING TABLE (locked):
//
//   spec.palette.primary + accent → style_overrides.derived_palette
//                                    (existing v2.9 D-08 string[] slot;
//                                     [primary, accent].filter(Boolean))
//   spec.typography.hookFontCategory → style_overrides.hook_font_family
//                                       (catalog lookup: first registered
//                                        family in that category)
//   spec.typography.bodyFontCategory → style_overrides.body_font_family
//   spec.layout.hookPosition      → style_overrides.text_position
//                                    (closed-enum exact match —
//                                    BrandKitTextPosition shared with Slide)
//   spec.imagery.treatmentPreset  → style_overrides.treatment_applied
//                                    (Phase 54 D-03 descriptor slot)
//
// narrowDecorationAllowlist semantics:
//   - empty/undefined preferred* → return full corpus (AI_LUCIDE_ALLOWLIST,
//     AI_SHAPE_KINDS) so the AI emit may pick anything (no narrowing).
//   - non-empty preferred*       → return subset filtered against the
//     corpus; entries NOT in the corpus are silently dropped (mirror
//     v2.12 DECOR-05 silent-drop pattern; defense-in-depth alongside
//     Phase 75 Zod validation).

import type { StyleSpec } from '@/lib/types/style-spec'
import type { SlideTemplate } from '@/lib/render/templates'
import type { FontEntry } from '@/lib/fonts/font-catalog'
import { FONT_CATALOG } from '@/lib/fonts/font-catalog'
import { AI_LUCIDE_ALLOWLIST, AI_SHAPE_KINDS } from '@/lib/ai/schemas'
import type {
  ProjectedSlideOverrides,
  NarrowedDecorationAllowlist,
  ProjectedSpec,
} from '@/lib/ai/style-spec-projector.types'

// Build a deterministic category → family lookup table at module load.
// "Deterministic" = first registered family per category wins. Mirrors
// FONT_CATALOG iteration order so adding a new font of an existing
// category never silently flips the resolution.
const CATEGORY_TO_FAMILY: Readonly<Record<FontEntry['category'], string>> = (() => {
  const map: Partial<Record<FontEntry['category'], string>> = {}
  for (const entry of FONT_CATALOG) {
    if (!(entry.category in map)) {
      map[entry.category] = entry.family
    }
  }
  // Type-cast: FONT_CATALOG covers all 4 categories at module-init time.
  return map as Record<FontEntry['category'], string>
})()

// Closed-enum membership sets — O(1) silent-drop checks.
const LUCIDE_SET: ReadonlySet<string> = new Set(AI_LUCIDE_ALLOWLIST)
const SHAPE_SET: ReadonlySet<string> = new Set(AI_SHAPE_KINDS)

/**
 * Filter spec.decorations.preferredLucide / preferredShapes to subsets
 * of the v2.12 closed-enum corpora. Empty/undefined preferences fall
 * back to the full corpus (no narrowing).
 *
 * Plan 02 passes the result into the Gemini responseSchema's `enum:`
 * arrays so the AI emit can only pick decorations the spec endorses.
 */
export function narrowDecorationAllowlist(spec: StyleSpec): NarrowedDecorationAllowlist {
  const lucidePref = spec.decorations.preferredLucide
  const shapePref = spec.decorations.preferredShapes

  const lucide: readonly string[] =
    lucidePref && lucidePref.length > 0
      ? (lucidePref as readonly string[]).filter((name) => LUCIDE_SET.has(name))
      : [...AI_LUCIDE_ALLOWLIST]

  const shapes: readonly string[] =
    shapePref && shapePref.length > 0
      ? (shapePref as readonly string[]).filter((kind) => SHAPE_SET.has(kind))
      : [...AI_SHAPE_KINDS]

  return { lucide, shapes }
}

/**
 * Translate a (validated, possibly aspect-filtered, possibly brand-kit-merged)
 * StyleSpec into the EXISTING SlideStyleOverrides shape — strict subset
 * (Pick<>) by TypeScript construction.
 *
 * Pure. Immutable.
 *
 * @param spec     The (Phase-75-validated) StyleSpec.
 * @param _template The slide template — unused at this milestone but
 *                  reserved for future template-aware fallbacks. Accepted
 *                  to keep the projector contract stable for Plan 02.
 * @returns        ProjectedSpec: { style_overrides, decorations }.
 */
export function projectStyleSpecToSlideOverrides(
  spec: StyleSpec,
  // Reserved for future template-aware projection (e.g. resolving accent
  // contrast against template.backgroundColor). Phase 77 ships the slot
  // so Plan 02 + downstream callers do not need a signature change later.
  _template: SlideTemplate,
): ProjectedSpec {
  const style_overrides: ProjectedSlideOverrides = {}

  // Palette → derived_palette: string[] (existing v2.9 D-08 slot).
  // [primary, accent].filter(Boolean) preserves order so palette[0] is the
  // dominant color (matches v2.9 paletteMode='palette-dominant' contract:
  // first entry = dominant, subsequent entries = cluster colors).
  // primary is structurally required on StyleSpecPalette, so derived_palette
  // is always emitted with at least one entry. When neutralized via
  // applyAspectFilter, primary === '#FFFFFF' (NEUTRAL_PALETTE_DEFAULT) —
  // fixed-palette templates ignore derived_palette entirely (zero-impact).
  const palette: string[] = [spec.palette.primary]
  if (spec.palette.accent !== undefined) palette.push(spec.palette.accent)
  style_overrides.derived_palette = palette

  // Typography → font-family resolution via deterministic catalog lookup.
  // When category is undefined (NEUTRAL_TYPOGRAPHY_DEFAULT), skip emit so
  // template default wins.
  if (spec.typography.hookFontCategory !== undefined) {
    const family = CATEGORY_TO_FAMILY[spec.typography.hookFontCategory]
    if (family) style_overrides.hook_font_family = family
  }
  if (spec.typography.bodyFontCategory !== undefined) {
    const family = CATEGORY_TO_FAMILY[spec.typography.bodyFontCategory]
    if (family) style_overrides.body_font_family = family
  }

  // Layout.hookPosition → text_position (closed-enum exact match).
  // Skip emit when undefined (NEUTRAL_LAYOUT_DEFAULT) → template wins.
  if (spec.layout.hookPosition !== undefined) {
    style_overrides.text_position = spec.layout.hookPosition
  }

  // Imagery.treatmentPreset → treatment_applied (Phase 54 D-03 descriptor).
  if (spec.imagery.treatmentPreset !== undefined) {
    style_overrides.treatment_applied = spec.imagery.treatmentPreset
  }

  return {
    style_overrides,
    decorations: narrowDecorationAllowlist(spec),
  }
}
