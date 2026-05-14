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
//   - NEUTRAL_DECORATIONS_DEFAULT: explicit FULL corpora — the entire
//     AI_LUCIDE_ALLOWLIST and AI_SHAPE_KINDS are listed as preferred. After
//     Phase 80 R7, narrowDecorationAllowlist returns [] for empty/undefined
//     preferences (correct extracted-empty semantics — "reference had no
//     icons → emit none"). To preserve the user-facing contract that
//     unchecking the decorations aspect means "AI may pick anything in the
//     v2.12 corpus" (free choice, same as a fresh project), the
//     neutralization path must materialize the corpus EXPLICITLY here.
//     Downstream narrowDecorationAllowlist sees non-empty preferences and
//     correctly returns the full corpus subset → free-choice behavior is
//     preserved. The distinction between "user neutralized decorations" and
//     "reference had no icons" is now encoded structurally (full corpus vs.
//     empty/absent), not via a side-channel flag (Phase 80 CR-02).
//
// Plan 02 (Wave 2) consumes this helper inside generate-from-style-spec.ts
// and wires the projector's downstream contract. This module ships with
// zero React, zero Gemini SDK, zero Supabase imports — verified by
// source-grep gate (`done` block of Task 1).

import type { StyleSpec, StyleSpecPalette, StyleSpecTypography, StyleSpecLayout, StyleSpecDecorations } from '@/lib/types/style-spec'
import type { SpecPreviewAspects } from '@/components/style-from-reference/state-machine'
import { AI_LUCIDE_ALLOWLIST, AI_SHAPE_KINDS } from '@/lib/ai/schemas'
import type { LucideDecorationName } from '@/lib/render/decorations/registry'
import type { ShapeKind } from '@/lib/types/decoration'

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
 * Neutral decorations default. After Phase 80 R7, narrowDecorationAllowlist
 * returns an EMPTY list for empty/undefined preferred* (correct semantics
 * for extracted-empty: "reference had no icons → emit none"). To preserve
 * the user-facing contract that unchecking the decorations aspect means
 * "AI may pick anything in the v2.12 corpus" (free-choice — same as a
 * fresh project), this constant materializes the FULL corpora explicitly.
 * narrowDecorationAllowlist then sees a non-empty preferred list and
 * returns the full corpus subset, distinguishing user-neutralization
 * (free choice) from extractor-empty (zero icons) without a side-channel
 * flag. Phase 80 CR-02.
 *
 * The arrays are frozen for immutability; downstream consumers (aspect-filter
 * body, narrowDecorationAllowlist) MUST NOT mutate.
 */
export const NEUTRAL_DECORATIONS_DEFAULT: StyleSpecDecorations = Object.freeze({
  preferredLucide: Object.freeze([...AI_LUCIDE_ALLOWLIST]) as readonly LucideDecorationName[] as LucideDecorationName[],
  preferredShapes: Object.freeze([...AI_SHAPE_KINDS]) as readonly ShapeKind[] as ShapeKind[],
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
  // Phase 80 cascade: spread `...spec` FIRST so the StyleSpec & ArchetypeSlots
  // intersection (slideArchetype discriminator + per-archetype slot params
  // — `caption`, `split`) flows through automatically. Aspect-filter's intent
  // is to neutralize the 4 aspect categories below; archetype is structural
  // composition and MUST be preserved (NOT neutralized). Subsequent field
  // overrides below shadow only the 4 aspects + imagery/rhythm/voice_note.
  return {
    ...spec,
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
          // Phase 80 CR-02: neutralization expands to the FULL corpora — this
          // is the "user explicitly said 'any decoration'" signal. R7's
          // narrowDecorationAllowlist returns [] only when preferred* is
          // empty/undefined (extracted-empty path); a full-corpus preferred*
          // produces a full-corpus narrowed list (free-choice). DO NOT
          // collapse this back to []; that would re-introduce the bug where
          // toggling decorations OFF silently suppresses ALL icons.
          preferredLucide: [...AI_LUCIDE_ALLOWLIST] as LucideDecorationName[],
          preferredShapes: [...AI_SHAPE_KINDS] as ShapeKind[],
        },
    rhythm: { ...spec.rhythm },
    voice_note: spec.voice_note,
  }
}
