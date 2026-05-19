# Quick Task 260519-hym: Snap generated headline text into caption-card geometry - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Task Boundary

When a generated slide has a caption card enabled (`caption_bar_enabled === true`),
the headline (hook) text box must be deterministically positioned within the
caption card's geometry — so the text always sits over the card. This is a
post-process snap in the generation pipeline; code owns geometry, Gemini owns
the words.

Canonical spec: `.planning/CAPTION-CARD-TEXT-PLACEMENT-SPEC.md`

</domain>

<decisions>
## Implementation Decisions

### Scope (user decision)
- Apply to **any slide with `caption_bar_enabled === true`**, template-agnostic.
- Do NOT gate on template type (not News Oracle-only, not a code-template
  allowlist). The snap triggers off the flag alone, so every current and future
  caption-card template is covered without per-template wiring.

### Retro-fix vs new-only (user decision)
- **New generations only.** The deterministic snap runs at generation time.
- No re-layout pass over already-saved carousels. Saved carousels with
  mispositioned text are explicitly out of scope.

### Alignment within the card (Claude's Discretion — locked)
- **Headline anchored toward the top of the card; body text below it.**
- Rationale: the existing machinery already exposes a separate
  `CAPTION_BAR_BOTTOM_HOOK_Y_RANGE` and `CAPTION_BAR_BOTTOM_BODY_Y_RANGE` —
  hook-on-top / body-below is what `computeCaptionBarBottomPositions()` is
  already built to produce. Reuse those ranges directly rather than inventing a
  centered single-block layout.
- Mirror the same hook-top / body-below relationship for a top-positioned card
  (`caption_bar_position: top`).

### Phase 85 / LayoutRecipe relationship (Claude's Discretion — locked)
- **Write one reusable caption-card → text-position helper; wire it into the
  code-template generation path only.** Leave `applyLayoutRecipe` (Phase 85)
  untouched — a DB recipe already carries caption-card geometry in its recipe
  and that path works.
- Design the helper to be extraction-ready (pure function over caption-card
  geometry) so Phase 85 can adopt it later without a rewrite, but do NOT
  retrofit `applyLayoutRecipe` in this task — that would expand scope and test
  surface into Phase 85 code.

</decisions>

<specifics>
## Specific Ideas

- Reuse `computeCaptionBarBottomPositions()` and the `CAPTION_BAR_BOTTOM_*`
  constants in `src/lib/ai/style-spec-projector-constants.ts`. Mirror the math
  for a top-snapped card (`caption_bar_position: top`).
- Inputs to the snap: `caption_bar_y`, `caption_bar_height_pct`,
  `caption_bar_position`. Outputs: `hook_position` / `text_position` (and the
  body text position) for the slide.
- Root-cause first: the deterministic positioner already exists — investigate
  why the news-category code-template generation path doesn't apply it. The
  fix should set the headline position alongside where `caption_bar_enabled`
  gets defaulted (the news-layout caption-card defaulting from quick task
  `260518-8o0`).
- Confirm the snap targets the same geometry the renderer uses —
  `resolveCaptionBar` in `src/lib/render/resolve-overlay.ts`.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/CAPTION-CARD-TEXT-PLACEMENT-SPEC.md` — the feature spec this task
  implements (the bug, recommended design, where to investigate, boundaries).

</canonical_refs>
