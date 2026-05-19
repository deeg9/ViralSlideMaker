# Feature Spec: Caption-Card Text Placement

**Created:** 2026-05-19
**Status:** Spec — ready to route to `/gsd-quick` or a small phase (NOT a milestone)
**Origin:** User-reported bug, 2026-05-19, with screenshots — News Oracle template.

## The bug

On a template that ships a caption card (e.g. News Oracle), generated headline
text boxes are positioned **independently of the caption card**. Observed: the
caption card is snapped to the bottom edge (`caption_bar_position: bottom`,
height ~38%) but the AI-generated headline text box sits at the **top** of the
slide — card and text fully decoupled. The headline should land *inside* the
caption card's region.

## Goal

When a generated slide has a caption card enabled, the headline text box is
deterministically positioned within the caption card's geometry — so the text
always sits over the card, on every template that uses caption cards.

## Recommended design — deterministic post-process snap

A prompt rule will NOT fix this reliably (LLMs are poor at precise geometry —
that unreliability IS the current bug). Instead: a deterministic post-process
step in the generation pipeline.

- After slide generation, for any slide with `caption_bar_enabled === true`,
  compute the headline (hook) text-box position FROM the card geometry —
  `caption_bar_y`, `caption_bar_height_pct`, `caption_bar_position`
  (`bottom` | `top`) — and set `hook_position` / `text_position` accordingly.
- Reuse the existing machinery: `computeCaptionBarBottomPositions()` and the
  `CAPTION_BAR_BOTTOM_HOOK_Y_RANGE` / `CAPTION_BAR_BOTTOM_BODY_Y_RANGE`
  constants in `src/lib/ai/style-spec-projector-constants.ts`. Mirror the math
  for a top-snapped card.
- Code owns geometry; Gemini owns the words.

## Where to investigate (start here)

- `src/lib/ai/style-spec-projector-constants.ts` — `computeCaptionBarBottomPositions`,
  `CAPTION_BAR_BOTTOM_*` ranges (the deterministic positioner already exists —
  the question is why the news-category code-template generation path doesn't
  apply it).
- The news-layout caption-card defaulting from quick task `260518-8o0` — where
  `caption_bar_enabled` gets defaulted for news slides; the headline position
  should be set alongside it.
- `src/lib/ai/prompts.ts` (news addendum), `src/lib/ai/validate-slides.ts`,
  `src/lib/ai/generate-slides.ts` — the generation pipeline; find where the
  headline `text_position` / `hook_position` is currently set.
- `src/lib/render/resolve-overlay.ts` — `resolveCaptionBar` (how the card is
  rendered) — confirm the snap targets the same geometry the renderer uses.

## Open questions (resolve at discuss/brainstorm time)

1. **Scope** — News Oracle only? All code templates with caption cards? Or
   every slide with `caption_bar_enabled` regardless of template?
2. **Alignment within the card** — headline vertically centered in the card, or
   anchored toward the top of the card with body text below it?
3. **New generations only**, or also a re-layout pass for already-saved
   carousels whose text is mispositioned?
4. **Relationship to the `LayoutRecipe` path (Phase 85)** — a DB recipe template
   already carries caption-card geometry in its recipe and `applyLayoutRecipe`
   shapes slides from it. This rule is the **code-template equivalent**; ideally
   both paths share one caption-card → text-position helper. Decide whether to
   unify now or keep separate.

## Boundaries

- In scope: the headline/hook text box ↔ caption card geometry coupling for
  generation.
- Out of scope: the caption card's own geometry/defaults (already shipped); any
  schema change (the `caption_bar_*` fields already exist); editor drag behavior.

## Suggested routing

`/gsd-quick` — this is a focused, single-area generation-geometry fix on
existing machinery. It is quicker than a phase/milestone. Start fresh:
`/clear`, then `/gsd-quick` (or `/gsd-discuss-phase` if it grows), pointing at
this spec.

---

*Captured 2026-05-19 from a brainstorming session paused for context budget.*
