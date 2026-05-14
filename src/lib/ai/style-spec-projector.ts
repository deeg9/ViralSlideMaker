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
//   spec.slideArchetype           → style_overrides.template_id_override
//                                    (via ARCHETYPE_TO_TEMPLATE map; the
//                                    flat-color-background archetype dispatches
//                                    palette-driven via pickFlatColorTemplate).
//                                    Phase 80 R6. Consumer
//                                    (generate-from-style-spec.ts) LIFTS
//                                    this onto Slide.template_id_override
//                                    after PROJECTOR FUSION where the
//                                    renderer actually reads it.
//   spec.slideArchetype === 'caption-bar-top' → style_overrides.layout = 'cover'
//                                    (template-side 'cover' flag flips
//                                    image/text ordering; combined with
//                                    magazine-bold image-with-bottom-card
//                                    mode, the caption block lands at top).
//
// narrowDecorationAllowlist semantics (Phase 80 R7):
//   - empty/undefined preferred* → return EMPTY list. The reference image
//     had no decorations; downstream generation MUST NOT invent icons. This
//     fixes the "spurious icons on Meta-workers" regression where the prior
//     fall-back-to-full-corpus behavior let Gemini emit icons the reference
//     did not declare.
//   - non-empty preferred*       → return subset filtered against the
//     corpus; entries NOT in the corpus are silently dropped (mirror
//     v2.12 DECOR-05 silent-drop pattern; defense-in-depth alongside
//     Phase 75 Zod validation).

import type { StyleSpec } from '@/lib/types/style-spec'
import type { SlideTemplate } from '@/lib/render/templates'
import type { FontEntry } from '@/lib/fonts/font-catalog'
import { FONT_CATALOG } from '@/lib/fonts/font-catalog'
import { AI_LUCIDE_ALLOWLIST, AI_SHAPE_KINDS } from '@/lib/ai/schemas'
import {
  DEFAULT_FALLBACK_ARCHETYPE,
  type SlideArchetype,
} from '@/lib/types/style-spec-archetypes'
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
 * Phase 80 R6 — Archetype → template_id mapping (locked in
 * 80-CONTEXT.md §Template Mapping).
 *
 * The `flat-color-background` archetype is EXCLUDED from this static map
 * because its dispatch depends on the spec's primary palette hue
 * (yellow → 'bold-yellow', pink/magenta → 'y2k-pop', else default
 * 'bold-yellow'). See pickFlatColorTemplate below.
 *
 * `caption-bar-top` also routes to `magazine-bold` (same template as
 * `caption-bar-bottom`); the projector additionally emits
 * `style_overrides.layout = 'cover'` to flip image/text order against
 * magazine-bold's `image-with-bottom-card` background mode, landing the
 * caption block at the top.
 *
 * `photo-collage-2up` and `photo-collage-grid` both route to `news-drop`;
 * the AI generation prompt (Plan 05) emits `custom_images` of length 2 or
 * 4 respectively to drive the collage geometry.
 *
 * Single source of truth — DO NOT redefine this map in any consumer.
 */
const ARCHETYPE_TO_TEMPLATE: Readonly<
  Record<Exclude<SlideArchetype, 'flat-color-background'>, string>
> = {
  'caption-bar-bottom': 'magazine-bold',
  'caption-bar-top': 'magazine-bold', // + style_overrides.layout: 'cover' applied below
  'full-bleed-text-overlay': 'news-drop',
  'photo-collage-2up': 'news-drop', // + custom_images.length === 2 emitted by Plan 05 prompt
  'photo-collage-grid': 'news-drop', // + custom_images.length === 4 emitted by Plan 05 prompt
  'editorial-serif': 'editorial-serif',
  'notes-sticker': 'notes-app-chic',
}

/**
 * Phase 80 R6 — Palette-driven dispatch for the `flat-color-background`
 * archetype.
 *
 *   yellow dominant (HSL hue ~45-65°)    → 'bold-yellow'
 *   pink/magenta dominant (~310-350°)    → 'y2k-pop'
 *   else                                   → 'bold-yellow' (default)
 *
 * Pure / deterministic — uses a self-contained hex → HSL hue converter so
 * the projector takes no new runtime dependency.
 */
export function pickFlatColorTemplate(primaryHex: string): string {
  const h = hexToHue(primaryHex)
  if (h === null) return 'bold-yellow'
  if (h >= 45 && h <= 65) return 'bold-yellow'
  if (h >= 310 && h <= 350) return 'y2k-pop'
  return 'bold-yellow'
}

/**
 * Hex (#rrggbb or rrggbb) → hue in [0, 360); returns null on parse
 * failure. Pure, deterministic.
 *
 * Standard hex-to-HSL hue extraction (delta-of-max algorithm). Saturation
 * + lightness are intentionally not computed — pickFlatColorTemplate only
 * needs the hue axis.
 */
function hexToHue(hex: string): number | null {
  const m = /^#?([0-9a-fA-F]{6})/.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 0xff) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) return 0
  let hue: number
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue *= 60
  if (hue < 0) hue += 360
  return hue
}

/**
 * Filter spec.decorations.preferredLucide / preferredShapes to subsets
 * of the v2.12 closed-enum corpora.
 *
 * Phase 80 R7 — empty/undefined preferences return an EMPTY list (NOT the
 * full corpus). Rationale: when the reference image has no icons or shapes,
 * downstream generation MUST emit zero decorations. The prior
 * "fall back to full corpus" behavior allowed Gemini to invent icons the
 * reference did not declare (the spurious-icons regression observed on the
 * Meta-workers reference traced to this branch).
 *
 * Plan 02 passes the result into the Gemini responseSchema's `enum:`
 * arrays so the AI emit can only pick decorations the spec endorses.
 */
export function narrowDecorationAllowlist(spec: StyleSpec): NarrowedDecorationAllowlist {
  const lucidePref = spec.decorations.preferredLucide
  const shapePref = spec.decorations.preferredShapes

  // Phase 80 R7: empty/undefined → empty list (not full corpus).
  const lucide: readonly string[] =
    lucidePref && lucidePref.length > 0
      ? (lucidePref as readonly string[]).filter((name) => LUCIDE_SET.has(name))
      : []

  const shapes: readonly string[] =
    shapePref && shapePref.length > 0
      ? (shapePref as readonly string[]).filter((kind) => SHAPE_SET.has(kind))
      : []

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

  // Phase 80 R6: emit template_id_override from spec.slideArchetype.
  //
  // Default-fallback when archetype absent: DEFAULT_FALLBACK_ARCHETYPE
  // ('full-bleed-text-overlay'). Phase 80 Plan 02 validator already
  // resolves the fallback at the Phase B firewall and emits an
  // `archetype_fallback` silent-drop counter event; this `??` is a
  // defensive paint that costs nothing when the validator already ran.
  //
  // NO subscriptionTier branching. Project policy
  // (memory/project_template_tiering.md + 80-CONTEXT.md decisions
  // §Boundaries): all 13 templates available to all users; the projector
  // MUST NOT consult tier.
  const archetype: SlideArchetype = spec.slideArchetype ?? DEFAULT_FALLBACK_ARCHETYPE
  if (archetype === 'flat-color-background') {
    style_overrides.template_id_override = pickFlatColorTemplate(spec.palette.primary)
  } else {
    style_overrides.template_id_override = ARCHETYPE_TO_TEMPLATE[archetype]
  }
  // caption-bar-top: also set layout: 'cover'. The template-side 'cover'
  // flag flips image/text ordering; combined with magazine-bold's
  // `image-with-bottom-card` background mode, the caption block lands at
  // the top of the frame (the reference composition for top-caption slides).
  if (archetype === 'caption-bar-top') {
    style_overrides.layout = 'cover'
  }

  return {
    style_overrides,
    decorations: narrowDecorationAllowlist(spec),
  }
}
