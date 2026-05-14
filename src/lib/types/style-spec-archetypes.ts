// Phase 80 Plan 01 (R1, R2, R4, R11):
// Canonical archetypes module for the composition-aware StyleSpec schema.
//
// Lands the load-bearing type contract for v2.13 phase 80
// (composition-aware style extraction):
//   - SLIDE_ARCHETYPES: closed 8-value tuple of named slide archetypes.
//   - SlideArchetype: type alias derived from the tuple.
//   - CAPTION_HEIGHT_FRACTIONS / CAPTION_BACKGROUNDS / SPLIT_DIRECTIONS /
//     SPLIT_RATIOS: closed-enum tuples for the per-archetype slot params.
//   - CaptionBarSlots / PhotoCollage2upSlots / EmptySlots: per-archetype
//     slot-param interfaces.
//   - ArchetypeSlots: TypeScript discriminated union keyed on
//     `slideArchetype` so consumers narrow exactly on the discriminator the
//     top-level StyleSpec uses. Zod (Plan 02) keys
//     `z.discriminatedUnion('slideArchetype', ...)` on the same field.
//   - DEFAULT_FALLBACK_ARCHETYPE: shared fallback constant for Plan 02
//     validator and Plan 04 projector.
//
// =====================================================================
// CLOSED-ENUM INVARIANT (LOAD-BEARING — DO NOT VIOLATE):
// =====================================================================
// Every string field below is a closed-enum tuple defined ONCE in this
// module and consumed downstream by:
//   - Plan 02 (validator):   z.discriminatedUnion('slideArchetype', ...)
//   - Plan 03 (extractor):   Gemini system-prompt archetype taxonomy
//   - Plan 04 (projector):   ARCHETYPE_TO_TEMPLATE map +
//                            DEFAULT_FALLBACK_ARCHETFYPE on silent-drop
//   - Plan 05 (generation):  system prompt for AI generator
//   - Plan 06 (migration):   purges schema_version != 2 cache rows
//
// DO NOT add free-text fields like reference_artist / reference_brand /
// copy_exactly / style_freetext (PARITY-05 CI grep gate WILL fail). The
// closed-enum schema is THE primary architectural defense against
//   1. Legal risk (named-artist style mimicry).
//   2. Prompt-injection landing zone — adversarial directive payloads
//      embedded in reference image text would flow through unsanitized.
// See .planning/phases/80-composition-aware-style-extraction-replace-flat-stylespec-ta/
// 80-CONTEXT.md decisions §Schema Integration + §Slot Param Value Spaces.
// =====================================================================
//
// NOTE: numeric and string slot params alike are imported FROM THIS MODULE
// — never redefined inline at consumer call sites. Redefining a tuple
// locally creates two drifting sources of truth and silently breaks the
// PARITY-05 grep gate.

/**
 * Canonical 8-value archetype enum.
 *
 * Order is load-bearing: it matches the prompt ordering Plan 03 emits to
 * Gemini AND the mapping order Plan 04 (`ARCHETYPE_TO_TEMPLATE`) reads. Do
 * NOT reorder or add archetypes without bumping `STYLE_SPEC_VERSION` in
 * `style-spec.ts` (closed-enum + version invariants per
 * 80-CONTEXT.md §Schema Integration).
 */
export const SLIDE_ARCHETYPES = [
  'full-bleed-text-overlay',
  'caption-bar-bottom',
  'caption-bar-top',
  'photo-collage-2up',
  'photo-collage-grid',
  'flat-color-background',
  'editorial-serif',
  'notes-sticker',
] as const

/** Closed-enum string union derived from {@link SLIDE_ARCHETYPES}. */
export type SlideArchetype = (typeof SLIDE_ARCHETYPES)[number]

/**
 * Caption-bar height fraction enum (closed). Three sizes matching observed
 * reference variance for `caption-bar-bottom` + `caption-bar-top`. Numeric
 * literals (not strings) so downstream renderer math operates directly.
 * Open numeric ranges are explicitly rejected — see 80-CONTEXT.md
 * §Slot Param Value Spaces.
 */
export const CAPTION_HEIGHT_FRACTIONS = [0.3, 0.4, 0.5] as const

/**
 * Caption-bar background style enum (closed). Covers magazine-bold-style
 * solid cards, documentary gradient overlays, and translucent variants.
 * Extensible later; locked at 3 values for v1.
 */
export const CAPTION_BACKGROUNDS = ['solid', 'gradient-dark', 'translucent'] as const

/** Photo-collage split direction enum (closed). */
export const SPLIT_DIRECTIONS = ['horizontal', 'vertical'] as const

/**
 * Photo-collage split ratio enum (closed). Readable string literals (not
 * numeric tuples) for JSON debuggability and grep-ability. Extensible
 * later; locked at 3 values for v1.
 */
export const SPLIT_RATIOS = ['50-50', '60-40', '70-30'] as const

/**
 * Slot-param shape for caption-bar archetypes (`caption-bar-bottom` AND
 * `caption-bar-top`). Both archetypes share the same caption slot params;
 * the discriminator value distinguishes them.
 *
 * All sub-properties are optional — extraction may classify the archetype
 * without committing to exact slot values; Plan 02 silent-drops invalid
 * values at the firewall boundary.
 */
export interface CaptionBarSlots {
  caption: {
    heightFraction?: (typeof CAPTION_HEIGHT_FRACTIONS)[number]
    background?: (typeof CAPTION_BACKGROUNDS)[number]
  }
}

/**
 * Slot-param shape for `photo-collage-2up` archetype. Drives the
 * `custom_images` layout the AI generator emits (Plan 05); `split.ratio`
 * + `split.direction` map to the renderer's existing positioning math.
 */
export interface PhotoCollage2upSlots {
  split: {
    direction?: (typeof SPLIT_DIRECTIONS)[number]
    ratio?: (typeof SPLIT_RATIOS)[number]
  }
}

/**
 * Placeholder shape for archetypes that declare no slot params in v1.
 * Used by: `full-bleed-text-overlay`, `photo-collage-grid`,
 * `flat-color-background`, `editorial-serif`, `notes-sticker`.
 *
 * Kept as a named interface (not inlined `{}`) so future slot-param
 * additions per archetype land at a single named extension point.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional placeholder; see docblock above
export interface EmptySlots {}

/**
 * Discriminated union of per-archetype slot blocks. The discriminator
 * field name is `slideArchetype` (NOT `archetype`) so it composes with
 * `StyleSpec`'s top-level `slideArchetype` field for a single keyed shape
 * and Zod's `z.discriminatedUnion('slideArchetype', [...])` (Plan 02)
 * keys cleanly without renaming.
 *
 * Narrowing: when `spec.slideArchetype === 'caption-bar-bottom'`, the
 * type system grants `spec.caption` typed access; with
 * `'photo-collage-2up'`, `spec.split` typed access. All sub-fields
 * remain optional per 80-CONTEXT.md slot-param shapes.
 */
export type ArchetypeSlots =
  | ({ slideArchetype: 'full-bleed-text-overlay' } & EmptySlots)
  | ({ slideArchetype: 'caption-bar-bottom' } & CaptionBarSlots)
  | ({ slideArchetype: 'caption-bar-top' } & CaptionBarSlots)
  | ({ slideArchetype: 'photo-collage-2up' } & PhotoCollage2upSlots)
  | ({ slideArchetype: 'photo-collage-grid' } & EmptySlots)
  | ({ slideArchetype: 'flat-color-background' } & EmptySlots)
  | ({ slideArchetype: 'editorial-serif' } & EmptySlots)
  | ({ slideArchetype: 'notes-sticker' } & EmptySlots)

/**
 * Default fallback archetype used when extraction returns no archetype
 * field or Phase B Zod validation drops the value as out-of-enum.
 *
 * Choice rationale (80-CONTEXT.md §Template Mapping): `full-bleed-text-overlay`
 * is lowest-risk — it renders legibly against any photo and routes to the
 * existing `news-drop` template with no extra slot params required.
 *
 * Plan 02 (validator) and Plan 04 (projector) MUST import this constant
 * directly; do NOT re-derive the fallback in either consumer.
 */
export const DEFAULT_FALLBACK_ARCHETYPE: SlideArchetype = 'full-bleed-text-overlay'
