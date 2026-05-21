// Phase 74 Plan 01 (STYLESPEC-01..09):
// Closed-enum StyleSpec contract for v2.13 reference-image style extraction.
//
// Lands ALL of: STYLESPEC-01 (type exists), STYLESPEC-03 (palette closed enum),
// STYLESPEC-04 (typography from font-catalog categories), STYLESPEC-05
// (decorations.preferredLucide from registry allowlist), STYLESPEC-06
// (decorations.preferredShapes from ShapeKind), STYLESPEC-07
// (layout.hookPosition from the local HookTextPosition enum), STYLESPEC-08
// (imagery.treatmentPreset from TreatmentPreset.kind), STYLESPEC-09
// (voice_note is the ONLY free-text field — sanitized by the validator).
//
// =====================================================================
// CLOSED-ENUM INVARIANT (LOAD-BEARING — DO NOT VIOLATE):
// =====================================================================
// Every string field MUST import its allowed values from an existing
// constants module — single source of truth, so the PARITY-05 grep gate
// stays effective forever. Redefining an enum locally would create two
// drifting sources of truth and silently break the gate.
//
// DO NOT add free-text fields like reference_artist / reference_brand /
// copy_exactly / style_freetext (CI grep gate WILL fail). Those fields
// are forbidden because they expose:
//   1. Legal risk (named-artist style mimicry).
//   2. Prompt-injection landing zone — adversarial directive payloads
//      embedded in reference image text would flow through unsanitized
//      (PITFALLS.md Pitfall 3).
// The closed-enum schema is THE primary architectural defense. See
// .planning/research/SUMMARY.md tension 3 + ARCHITECTURE.md §Q1.
// =====================================================================
//
// Phase 75 (extract-style-spec.ts) will import:
//   import type { StyleSpec } from '@/lib/types/style-spec'
//   import { parseStyleSpecSafe } from '@/lib/validators/style-spec'
//   import { createSilentDropCounter } from '@/lib/validators/silent-drop-counter'
//
// =====================================================================
// PHASE 80 EXTENSION (composition-aware schema):
// =====================================================================
// STYLE_SPEC_VERSION is bumped 1 → 2 to land the composition-aware shape.
//   - `slideArchetype` is an 8-value closed enum imported from
//     `@/lib/types/style-spec-archetypes` (SLIDE_ARCHETYPES tuple).
//   - `ArchetypeSlots` is a TypeScript discriminated union keyed on
//     `slideArchetype`; it supplies the discriminator AND the per-archetype
//     slot block (e.g. `caption` for caption-bar archetypes, `split` for
//     photo-collage-2up) in a single keyed shape. The top-level StyleSpec
//     composes via intersection (`& ArchetypeSlots`).
//   - PARITY-05 closed-enum invariant is preserved: no new free-text
//     fields. `voice_note` remains the sole free-text field.
//
// Downstream consumers blocked-on this contract:
//   - Plan 02 enforces the discriminated union at the Zod boundary
//     (`z.discriminatedUnion('slideArchetype', [...])`) and rejects
//     schema_version != 2 payloads.
//   - Plan 03 expands the Gemini system prompt + responseSchema to
//     elicit archetype classification.
//   - Plan 04 emits `template_id_override` from `slideArchetype` per the
//     locked ARCHETYPE_TO_TEMPLATE map and uses DEFAULT_FALLBACK_ARCHETYPE
//     when extraction returns no archetype.
//   - Plan 06 purges all schema_version != 2 cache rows on deploy.
// =====================================================================

import type { FontEntry } from '@/lib/fonts/font-catalog'
import type { LucideDecorationName } from '@/lib/render/decorations/registry'
import type { ShapeKind } from '@/lib/types/decoration'
import type { TreatmentPreset } from '@/lib/photo-treatment/treat'
import type { ArchetypeSlots } from '@/lib/types/style-spec-archetypes'

/** Schema version literal — bump when StyleSpec shape changes. Cheap
    future-proofing per CONTEXT.md Claude's discretion.
    Always 2; bumped at Phase 80 (composition-aware schema). */
export type StyleSpecVersion = 2
export const STYLE_SPEC_VERSION: StyleSpecVersion = 2

/** Coarse vertical text placement for the hook — a 3-value literal union.
    Relocated in-file from a shelved module in Phase 89 (BKSHELVE-09); it is
    a generic layout primitive owned by this contract.

    Named HookTextPosition (not TextPosition) deliberately: `@/lib/types/slide`
    already exports an unrelated `TextPosition` `{x, y}` coordinate interface,
    and the bare name invited a wrong auto-import (Phase 89 review WR-02). */
export type HookTextPosition = 'top' | 'center' | 'bottom'

/**
 * Palette section — color mode + role colors (all hex, validated by Zod).
 *
 * `mode` closed enum: locked in CONTEXT.md per D-XX (palette modes are not
 * importable from another module — they are an architectural decision local
 * to this contract). Hex color strings are validated at the Zod boundary
 * via the same hex regex pattern as src/lib/ai/schemas.ts (WR-02).
 */
export interface StyleSpecPalette {
  mode: 'solid' | 'duotone' | 'gradient' | 'photo'
  /** Primary brand/background color (hex). */
  primary: string
  /** Secondary supporting color (hex). Required for duotone + gradient. */
  secondary?: string
  /** Accent / highlight color (hex). */
  accent?: string
}

/**
 * Typography section — font categories from the 4-category catalog
 * (sans-serif | serif | display | handwriting). NOT family names — those
 * are 30+ entries and would couple the extracted spec to specific fonts.
 * Categories are stable; specific families resolve downstream.
 */
export interface StyleSpecTypography {
  hookFontCategory?: FontEntry['category']
  bodyFontCategory?: FontEntry['category']
}

/**
 * Layout section — coarse positioning + density. hookPosition is sourced
 * from the local HookTextPosition enum (top | center | bottom). Density is
 * a closed enum local to this contract (3 values).
 */
export interface StyleSpecLayout {
  hookPosition?: HookTextPosition
  density?: 'tight' | 'medium' | 'airy'
}

/**
 * Imagery section — sharp treatment preset. treatmentPreset is sourced
 * from TreatmentPreset['kind'] (4 kinds: bw | duotone-cream | duotone-cobalt
 * | contrast-bump). Bump configurations (gamma, intensity, etc.) are NOT
 * extracted from the reference — they are downstream defaults.
 */
export interface StyleSpecImagery {
  treatmentPreset?: TreatmentPreset['kind']
}

/**
 * Decorations section — closed-enum lists of preferred lucide icons +
 * shape primitives. preferredLucide values MUST match
 * LUCIDE_DECORATION_ALLOWLIST. preferredShapes values MUST be ShapeKind.
 * Density is a closed enum local to this contract.
 */
export interface StyleSpecDecorations {
  preferredLucide?: LucideDecorationName[]
  preferredShapes?: ShapeKind[]
  density?: 'sparse' | 'moderate' | 'dense'
}

/**
 * Rhythm section — narrative cadence. Closed enum local to this contract
 * (3 values). Drives downstream text generation cadence.
 */
export interface StyleSpecRhythm {
  cadence?: 'punchy' | 'flowing' | 'sparse'
}

/**
 * Top-level StyleSpec — the contract Phase 75 extraction emits and Phase
 * 77 emit-boundary verification consumes.
 *
 * NOTE: voice_note is the ONLY free-text field (STYLESPEC-09). The Zod
 * validator HTML-strips, single-lines, and length-caps it at 200 chars
 * before storage. Every other string field is a closed enum.
 *
 * Phase 80: intersected with `ArchetypeSlots` (a discriminated union keyed
 * on `slideArchetype`). This supplies the 8-value archetype discriminator
 * AND the per-archetype slot block in a single keyed shape, so consumers
 * narrow on `spec.slideArchetype === '...'` to access typed slot fields
 * (e.g. `spec.caption` for caption-bar archetypes). The change from
 * `interface` to `type` is required because TypeScript `interface` cannot
 * extend a discriminated union; downstream `import type { StyleSpec }`
 * usage is wire-compatible.
 */
export type StyleSpec = {
  schema_version: StyleSpecVersion
  palette: StyleSpecPalette
  typography: StyleSpecTypography
  layout: StyleSpecLayout
  imagery: StyleSpecImagery
  decorations: StyleSpecDecorations
  rhythm: StyleSpecRhythm
  /** ONLY free-text field. Sanitized at the Zod boundary
      (HTML-stripped, single line, <=200 chars). */
  voice_note?: string
} & ArchetypeSlots
