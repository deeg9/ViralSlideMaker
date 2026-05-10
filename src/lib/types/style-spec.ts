// Phase 74 Plan 01 (STYLESPEC-01..09):
// Closed-enum StyleSpec contract for v2.13 reference-image style extraction.
//
// Lands ALL of: STYLESPEC-01 (type exists), STYLESPEC-03 (palette closed enum),
// STYLESPEC-04 (typography from font-catalog categories), STYLESPEC-05
// (decorations.preferredLucide from registry allowlist), STYLESPEC-06
// (decorations.preferredShapes from ShapeKind), STYLESPEC-07
// (layout.hookPosition from BrandKitTextPosition), STYLESPEC-08
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

import type { FontEntry } from '@/lib/fonts/font-catalog'
import type { LucideDecorationName } from '@/lib/render/decorations/registry'
import type { ShapeKind } from '@/lib/types/decoration'
import type { BrandKitTextPosition } from '@/lib/types/brand-kit'
import type { TreatmentPreset } from '@/lib/photo-treatment/treat'

/** Schema version literal — bump when StyleSpec shape changes. Cheap
    future-proofing per CONTEXT.md Claude's discretion. */
export type StyleSpecVersion = 1
export const STYLE_SPEC_VERSION: StyleSpecVersion = 1

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
 * from BrandKitTextPosition (top | center | bottom). Density is a closed
 * enum local to this contract (3 values).
 */
export interface StyleSpecLayout {
  hookPosition?: BrandKitTextPosition
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
 */
export interface StyleSpec {
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
}
