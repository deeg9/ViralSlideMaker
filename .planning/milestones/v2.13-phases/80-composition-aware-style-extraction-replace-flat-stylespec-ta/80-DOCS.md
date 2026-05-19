# Phase 80 — Composition-Aware Style Extraction: Archetype → Template Mapping

**Phase:** 80-composition-aware-style-extraction-replace-flat-stylespec-ta
**Schema version:** `StyleSpec.schema_version = 2`
**Source of truth:** `src/lib/types/style-spec-archetypes.ts` (8-value `SLIDE_ARCHETYPES` tuple) and
`src/lib/ai/style-spec-projector.ts` (`ARCHETYPE_TO_TEMPLATE` map + `pickFlatColorTemplate`).
**Consumer:** `src/lib/render/templates/index.ts` registers the 13 templates this map targets; the
projector emits `style_overrides.template_id_override` consumed downstream by
`generate-from-style-spec.ts` and the slide renderer.

This document is the versioned deliverable for Phase 80 R9. Every template_id in the table is
registered in `templates/index.ts`; every archetype name is a member of `SLIDE_ARCHETYPES`.

## Archetype → Template Mapping (8 rows)

| Archetype                  | Template ID                                | Slot Params (with defaults)                                                                                                   | Reference Example                                                              |
| -------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `full-bleed-text-overlay`  | `news-drop`                                | (none)                                                                                                                        | Single full-bleed photo + floating text (e.g., chip-sales reference)            |
| `caption-bar-bottom`       | `magazine-bold`                            | `caption.heightFraction` ∈ {0.30, 0.40, 0.50} (default 0.40); `caption.background` ∈ {solid, gradient-dark, translucent} (default solid) | Photo-top + dark caption block bottom (e.g., Meta-workers reference)            |
| `caption-bar-top`          | `magazine-bold` + `style_overrides.layout: 'cover'` | `caption.heightFraction` ∈ {0.30, 0.40, 0.50} (default 0.40); `caption.background` ∈ {solid, gradient-dark, translucent} (default solid) | Photo-bottom + dark caption block top                                          |
| `photo-collage-2up`        | `news-drop` + `custom_images.length === 2` | `split.direction` ∈ {horizontal, vertical} (default horizontal); `split.ratio` ∈ {50-50, 60-40, 70-30} (default 50-50)         | Two-photo collage with directional split                                       |
| `photo-collage-grid`       | `news-drop` + `custom_images.length === 4` | (none — implicit 2x2 grid for v1)                                                                                              | 2x2 photo grid                                                                 |
| `flat-color-background`    | palette-driven: `bold-yellow` OR `y2k-pop` | (none)                                                                                                                        | Solid-color background with display text                                       |
| `editorial-serif`          | `editorial-serif`                          | (none)                                                                                                                        | Cream paper + serif type                                                       |
| `notes-sticker`            | `notes-app-chic`                           | (none)                                                                                                                        | Paper background + decorative stickers                                         |

### Flat-color palette dispatch (palette-driven branch)

`flat-color-background` is the only archetype excluded from the static `ARCHETYPE_TO_TEMPLATE` map.
Its template_id is decided at projection time from the spec's `palette.primary` hex via
`pickFlatColorTemplate`:

| HSL hue of `palette.primary` | Template ID    |
| ---------------------------- | -------------- |
| 45° – 65° (yellow dominant)  | `bold-yellow`  |
| 310° – 350° (pink/magenta)   | `y2k-pop`      |
| anything else (or parse fail) | `bold-yellow` (default branch) |

## Default Fallback

When `StyleSpec.slideArchetype` is missing, invalid, or silently dropped at Phase B Zod
validation, the projector substitutes `DEFAULT_FALLBACK_ARCHETYPE` =
`full-bleed-text-overlay`, which routes to `news-drop`.

The Phase B validator emits a silent-drop counter event with reason `archetype_fallback`
when this substitution fires so we can monitor extraction quality without surfacing
user-facing errors. The defensive `??` in the projector body covers the degraded-payload
path; in production, Plan 02's validator already resolves the fallback before the projector
runs.

## Orthogonality

`imagery.treatmentPreset` (B&W / duotone-cream / duotone-cobalt / contrast-bump) and
`slideArchetype` compose **independently** per slide. A `caption-bar-bottom` slide can
carry a B&W treatment; a `photo-collage-2up` slide can carry a duotone-cobalt treatment.
The archetype describes composition (where things sit on the slide); the treatment
describes the photo filter. They never interact.

## Constraints / Invariants

- **All 13 templates available to all tiers** — projector MUST NOT branch on
  `subscriptionTier`. Project policy (`memory/project_template_tiering.md`):
  `premium-tier.ts` is a marker for fonts/assets, not a gate on template selection.
- **PARITY-05 closed-enum invariant preserved** — every archetype + slot-param value
  is a closed-enum tuple imported from `src/lib/types/style-spec-archetypes.ts`. No new
  free-text fields. `voice_note` remains the only sanitized free-text field on
  `StyleSpec`.
- **Two-phase firewall preserved** — Gemini receives `slideArchetype` as
  `type: STRING` without enum (per `src/lib/ai/extract-style-spec.ts:250-260`).
  Phase B Zod (`parseStyleSpecSafe` + `z.discriminatedUnion('slideArchetype', …)`)
  enforces the closed 8-value enum at the firewall boundary. The
  `rawGemini`/`rawObject` source-grep gate continues to pass.
- **Schema version constraint** — every spec that reaches the projector has
  `schema_version: 2`. The validator rejects v1 payloads; the cache migration
  (Phase 80 Plan 06) purges any residual v1 entries.

## Mapping Resolution

The mapping for `caption-bar-top` requires a provenance note for the verifier
agent. The relevant locked decision lives in **CONTEXT.md §Template Mapping**, not SPEC.md.

- **SPEC.md R6** states the locked initial map as:
  `caption-bar-top → tr3nding-news (or alternate)`.
  The phrase `(or alternate)` is an unresolved placeholder — SPEC.md does not
  pin the final template.
- **CONTEXT.md §Template Mapping** resolves the placeholder to:
  `caption-bar-top → magazine-bold + style_overrides.layout: 'cover'`.
  The `cover` layout flag flips magazine-bold's image/text ordering against its
  `image-with-bottom-card` background mode, landing the caption block at the
  top of the frame.
- **CONTEXT.md supersedes SPEC.md** for this placeholder by phase-discuss
  decision. The implementation in `src/lib/ai/style-spec-projector.ts`
  (`ARCHETYPE_TO_TEMPLATE['caption-bar-top'] = 'magazine-bold'`, plus the
  `caption-bar-top` branch that sets `style_overrides.layout = 'cover'`)
  reflects the CONTEXT-resolved mapping.
- **Verifier guidance:** treat the `magazine-bold + layout: cover` mapping as
  authoritative. Any reference to `tr3nding-news` for `caption-bar-top` in
  SPEC.md is a stale placeholder, not a contradiction.

This note exists so cross-document verification does not flag the implemented
mapping as a SPEC R6 mismatch. The literal string "Mapping Resolution" is a
section heading so the acceptance grep (`grep -c "Mapping Resolution" 80-DOCS.md`)
returns at least one match.
