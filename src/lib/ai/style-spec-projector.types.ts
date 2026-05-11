// Phase 77 Plan 01 (EMIT-07) — projector return-type contract.
//
// =====================================================================
// STYLESPEC-12 / TPLREND-05 BY-CONSTRUCTION DEFENSE:
// =====================================================================
// ProjectedSlideOverrides is a `Pick<SlideStyleOverrides, ...>` of the
// EXISTING SlideStyleOverrides type. Adding a new field at the projector
// requires THREE coordinated changes:
//   1. Widen this Pick<> here.
//   2. Add the field to SlideStyleOverrides in src/lib/types/slide.ts.
//   3. Extend the Phase 74 zero-new-fields PTF baselines.
//
// A projector author who introduces a "new" field would fail TypeScript
// compilation at step 1 — the structural defense against accidental
// Slide-shape widening lives in this file. Phase 71 v2.12 PTF parity
// gate catches the same drift dynamically; this file catches it
// statically before tests run.
//
// =====================================================================
// PICK SET (locked):
// =====================================================================
//   - derived_palette    ← [spec.palette.primary, spec.palette.accent]
//                          (existing v2.9 SlideStyleOverrides field used by
//                          templates with paletteMode: 'palette-dominant';
//                          see DEVIATION note below)
//   - hook_font_family   ← spec.typography.hookFontCategory (catalog lookup)
//   - body_font_family   ← spec.typography.bodyFontCategory (catalog lookup)
//   - text_position      ← spec.layout.hookPosition (closed-enum exact match)
//   - treatment_applied  ← spec.imagery.treatmentPreset (descriptor string;
//                          Phase 54 D-03 cache-key suffix slot)
//
// =====================================================================
// DEVIATION (Rule 1 / Rule 2 — Plan 77-01 grounding mismatch):
// =====================================================================
// The original plan grounding referenced 'background_color' and
// 'accent_color' fields on SlideStyleOverrides. THOSE FIELDS DO NOT
// EXIST in src/lib/types/slide.ts as of Phase 76. The actual
// SlideStyleOverrides ships:
//   text_color, hook_text_color, body_text_color (text colors),
//   derived_palette: string[] (v2.9 D-08, used by paletteMode='palette-dominant'),
//   treatment_applied: string (v2.9 Phase 54).
// Per-slide background color overrides are NOT a concept in v2.x — the
// slide's background image (Slide.background_url) + the template's
// backgroundColor handle that. The plan's "DO NOT add any new field"
// rule is load-bearing; we honor it by routing palette colors through
// derived_palette[] instead.
//
// Behavior preserved:
//   - palette-dominant templates render derived_palette[0] as accent
//     (Phase 57 wires this read).
//   - fixed-palette templates ignore derived_palette unchanged.
// =====================================================================
//
// NOT PICKED (intentional):
//   - hook_text_color / body_text_color: spec.palette has no semantic text
//     color — template's textColor wins (or downstream contrast-resolver runs).
//   - text_align: spec.layout has no align field; template wins.
//   - layout (cover/body): spec doesn't model this; template wins.
//   - All v2.9 visual-effects fields (grain_intensity, watermark, etc.):
//     not part of style extraction surface.

import type { SlideStyleOverrides } from '@/lib/types/slide'

/**
 * Strict structural subset of SlideStyleOverrides — projector MUST NOT
 * widen this. TPLREND-05 / STYLESPEC-12 by construction.
 */
export type ProjectedSlideOverrides = Pick<
  SlideStyleOverrides,
  | 'derived_palette'
  | 'hook_font_family'
  | 'body_font_family'
  | 'text_position'
  | 'treatment_applied'
>

/**
 * Output of narrowDecorationAllowlist — both arrays are subsets of the
 * v2.12 closed-enum corpora (AI_LUCIDE_ALLOWLIST + AI_SHAPE_KINDS).
 * Plan 02 passes these into the Gemini responseSchema's `enum:` arrays
 * so the AI can only emit decorations the spec endorses.
 */
export interface NarrowedDecorationAllowlist {
  lucide: readonly string[]
  shapes: readonly string[]
}

/**
 * Composite output of projectStyleSpecToSlideOverrides.
 */
export interface ProjectedSpec {
  style_overrides: ProjectedSlideOverrides
  decorations: NarrowedDecorationAllowlist
}
