// Phase 77 Plan 01 (EMIT-07) + Phase 76 (PREVIEW-06):
// applyAspectFilter — pure helper that returns a copy of a StyleSpec with
// unchecked sections replaced by neutral defaults.
//
// =====================================================================
// CONTRACT (load-bearing — DO NOT VIOLATE):
// =====================================================================
//   - Pure function: same (spec, aspects) → byte-identical JSON output
//     across N calls. No I/O, no Date.now(), no Math.random(), no console.
//   - Immutable: never mutates the input spec.
//   - Per-aspect zeroing is the UPSTREAM seam that lets the projector
//     stay pure. The projector consumes a spec ONLY — it never reads
//     aspect flags. By neutralizing sections here BEFORE the spec
//     reaches the projector, downstream code falls back to template
//     defaults wherever the user unchecked an aspect (CONTEXT.md
//     "Claude's Discretion" §Per-aspect zeroing implementation).
//   - Sections preserved across all aspect combinations: schema_version,
//     voice_note, rhythm, imagery. Only the 4 toggles defined by
//     SpecPreviewAspects are zeroable here.
// =====================================================================
//
// NEUTRAL_*_DEFAULT semantics:
//   - NEUTRAL_PALETTE_DEFAULT: solid white. Downstream projector sees
//     primary='#FFFFFF' as the spec's preferred background; if the
//     template has its own backgroundColor and the projector chooses
//     not to emit a style_overrides.background_color (because primary
//     equals the neutral default), template wins. The constant is
//     "neutral" not "absent" — a primary is structurally required
//     by the StyleSpecPalette type.
//   - NEUTRAL_TYPOGRAPHY_DEFAULT: both font categories undefined.
//     Projector skips emitting hook_font_family / body_font_family →
//     template defaults win (Test 6 in projector tests).
//   - NEUTRAL_LAYOUT_DEFAULT: hookPosition + density undefined →
//     projector skips emitting text_position → template default wins.
//   - NEUTRAL_DECORATIONS_DEFAULT: empty preferredLucide / preferredShapes
//     arrays. Plan 02's narrowDecorationAllowlist treats empty as
//     "no spec preference" and falls back to the full allowlist, so
//     neutralized decorations behave like "AI may pick anything in the
//     v2.12 corpus" — same as a fresh project today.
//
// Plan 02 (Wave 2) consumes this helper inside generate-from-style-spec.ts
// and wires the projector's downstream contract. This module ships with
// zero React, zero Gemini SDK, zero Supabase imports — verified by
// source-grep gate (`done` block of Task 1).

import type { StyleSpec, StyleSpecPalette, StyleSpecTypography, StyleSpecLayout, StyleSpecDecorations } from '@/lib/types/style-spec'
import type { SpecPreviewAspects } from '@/components/style-from-reference/state-machine'

/**
 * Neutral palette default. White solid background — template-default-equivalent.
 * Downstream projector falls back to template.backgroundColor when palette is
 * neutralized (palette aspect unchecked).
 */
export const NEUTRAL_PALETTE_DEFAULT: StyleSpecPalette = Object.freeze({
  mode: 'solid',
  primary: '#FFFFFF',
}) as StyleSpecPalette

/**
 * Neutral typography default. Both font categories undefined → projector
 * skips emitting hook_font_family / body_font_family → template wins.
 */
export const NEUTRAL_TYPOGRAPHY_DEFAULT: StyleSpecTypography = Object.freeze({}) as StyleSpecTypography

/**
 * Neutral layout default. hookPosition + density undefined → projector
 * skips emitting text_position → template wins.
 */
export const NEUTRAL_LAYOUT_DEFAULT: StyleSpecLayout = Object.freeze({}) as StyleSpecLayout

/**
 * Neutral decorations default. Empty arrays — narrowDecorationAllowlist
 * (Task 3) treats empty as "no spec preference" and returns the full
 * AI_LUCIDE_ALLOWLIST / AI_SHAPE_KINDS, so neutralized decorations
 * behave like "no narrowing applied".
 */
export const NEUTRAL_DECORATIONS_DEFAULT: StyleSpecDecorations = Object.freeze({
  preferredLucide: [],
  preferredShapes: [],
}) as StyleSpecDecorations

/**
 * Returns a NEW StyleSpec with sections replaced by neutral defaults
 * wherever the corresponding aspect flag is false.
 *
 * Pure. Immutable. Referentially transparent.
 *
 * @param spec    The validated StyleSpec from Phase 75 extraction.
 * @param aspects The 4 aspect toggles from Phase 76 state-machine.
 * @returns       A new StyleSpec; input is never mutated.
 */
export function applyAspectFilter(
  spec: StyleSpec,
  aspects: SpecPreviewAspects,
): StyleSpec {
  return {
    schema_version: spec.schema_version,
    palette: aspects.palette ? { ...spec.palette } : { ...NEUTRAL_PALETTE_DEFAULT },
    typography: aspects.typography ? { ...spec.typography } : { ...NEUTRAL_TYPOGRAPHY_DEFAULT },
    layout: aspects.layout ? { ...spec.layout } : { ...NEUTRAL_LAYOUT_DEFAULT },
    imagery: { ...spec.imagery },
    decorations: aspects.decorations
      ? {
          ...spec.decorations,
          preferredLucide: spec.decorations.preferredLucide ? [...spec.decorations.preferredLucide] : undefined,
          preferredShapes: spec.decorations.preferredShapes ? [...spec.decorations.preferredShapes] : undefined,
        }
      : {
          preferredLucide: [],
          preferredShapes: [],
        },
    rhythm: { ...spec.rhythm },
    voice_note: spec.voice_note,
  }
}
