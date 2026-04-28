---
name: style-upload-brand-kit-autofill
slug: 260428-sty-style-upload-brand-kit-autofill
created: 2026-04-28
status: planned
---

# Style Upload — Brand-Kit Auto-fill from Screenshot

## Goal

Let a user upload a screenshot of a carousel they like (theirs or someone
else's) and have ViralSlideMaker extract the visual style and pre-fill their
**Brand Kit** with the extracted values. The user reviews / tweaks / saves,
then uses the existing **"Your Brand Kit"** tile in the visual-style picker
to generate carousels that match.

This re-uses everything we already built (Brand Kit data model, Brand Kit
template tile, render-time resolution, watermark slots) instead of inventing
a parallel "uploaded styles" concept.

## Why this approach (vs. alternatives)

We considered three storage models:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. One-off ephemeral** (extract → use → discard) | Simplest UX, no DB | User must re-upload every time; no edit step | Rejected — users will want to refine |
| **B. Populate Brand Kit** (extract → fill brand-kit form → user saves) | Reuses all existing infra; user can tweak before locking | Brand Kit is single — overwriting is destructive | **Chosen** — confirm-before-overwrite is acceptable |
| **C. New "saved styles" library** (multi-style entity) | Power-user friendly | New table, naming, deletion, sharing — premature | Rejected — no signal users want >1 saved style |

## Scope

### 1. Vision-driven style extraction (server action)

New server action `extractStyleFromImage(uploadedUrl: string): Promise<StyleExtraction>`
in `src/app/(dashboard)/settings/brand-kit/actions.ts`.

- Calls Gemini 2.5 Flash with the image + a JSON-schema-constrained prompt.
- Schema (returned `StyleExtraction`):
  ```ts
  {
    primary_color: string       // hex, dominant brand color
    secondary_color: string     // hex, supporting color
    accent_color: string        // hex, attention-grabbing pop color
    background_color: string    // hex
    text_color: string          // hex, primary text color
    heading_font_family: string // closest match from FONT_CATALOG
    body_font_family: string    // closest match from FONT_CATALOG
    text_align: 'left'|'center'|'right'
    text_position: 'top'|'center'|'bottom'
    hook_style: 'uppercase'|'normal'|'italic'
    overlay_opacity_pct: number // 0-100
    confidence: { fonts: 0..1, colors: 0..1, layout: 0..1 }
  }
  ```
- Prompt explicitly constrains font choices to `FONT_CATALOG` family names so
  Gemini snaps to fonts we can actually render. Prompt also includes the
  current catalog inline so it knows the menu.
- Cost note: Gemini 2.5 Flash with a single image is ~$0.0001 per call —
  cheap. Charge 0 credits for extraction (call it a Pro/Plus perk via
  `userTier !== 'free'` gate, OR free as marketing).

### 2. UI: "Generate from screenshot" button on Brand Kit page

Adds to `src/components/brand-kit/brand-kit-form.tsx`:

- New top-of-form card "Generate from Reference" with:
  - File picker (single image, validates via existing `validateImageFile`).
  - On select: upload via existing `createUploadUrl` flow (or new
    `createBrandKitReferenceUploadUrl` if we want a separate bucket).
  - Calls `extractStyleFromImage(url)` server action.
  - Shows loading state ("Analyzing reference… ~3s").
- On success:
  - Pre-fills form fields with extracted values, **without saving** —
    user sees the diff visually (existing form fields highlight new values).
  - Renders a small "Confidence" badge per field group (fonts / colors /
    layout) so the user knows where to double-check.
  - Disclaimer line: *"We match the style, not the exact font. Review before
    saving."*
- User clicks "Save Brand Kit" (existing button) to commit. Existing save
  path requires no changes.

### 3. Optional: surface the extract button from the visual-style picker too

Quick-win secondary entry point: add a small "Upload reference" link below
the "Your Brand Kit" tile in the visual-style picker that deep-links to
`/settings/brand-kit` with a query param to auto-open the upload picker.

Out of scope for the first pass — listed for the follow-up.

## Schema changes

None. Brand Kit data model already covers every field the extractor returns
(see `src/lib/types/brand-kit.ts` and the 260427-bkt migration).

## Cost & limits

- Free-tier: 1 reference extract per day per user (rate-limited via existing
  `rateLimit()` helper, key `bk-extract:{userId}`).
- Pro/Plus: unlimited.
- File size: reuse the 5MB image cap from `validateImageFile`.

## Risks / open questions

- **Font identification accuracy.** Visual font ID is the weakest part of the
  pipeline — particularly for custom typefaces. Mitigation: snap to nearest
  catalog family, surface a confidence score, let the user override.
- **IP / legal framing.** Extracting general aesthetics is fine; pixel-perfect
  cloning isn't. The "match the style, not the exact font" disclaimer plus
  the human review step keeps this in safe territory.
- **Brand Kit overwrite UX.** If the user already has a populated Brand Kit,
  do we (a) silently overwrite, (b) show a diff/confirm, or (c) require the
  user to clear it first? **Recommendation: (b) — show extracted values as
  pending changes, user clicks Save to commit.** This is the path described
  above.
- **Logo extraction.** First pass does NOT extract a logo from the
  screenshot — too noisy (the screenshot itself is full of "logo-like"
  glyphs that aren't logos). User uploads logo separately via existing
  brand-kit logo flow.

## Verification

- `extractStyleFromImage` returns valid hex colors and a font from
  `FONT_CATALOG.map(f => f.family)`.
- On a manual smoke test with 3 reference screenshots (one news, one Y2K,
  one minimal), confidence reflects reality (high on dominant-color shots,
  lower on busy images).
- Brand Kit form fields update visibly after extraction; existing Save
  button persists the changes.
- No regression to existing brand-kit flow when the new card is unused.

## Estimated effort

- Server action + Gemini prompt: ~80 lines.
- UI card + state: ~120 lines in `brand-kit-form.tsx`.
- Tests: vitest mock of `GoogleGenAI.models.generateContent` + assertion that
  the JSON-schema response is correctly parsed and bucketed.
- Total: ~1 focused build session. Low risk, isolated surface.

## Suggested invocation when ready

```
/gsd-quick --validate "Build style upload — Brand Kit auto-fill from screenshot per .planning/quick/260428-sty-style-upload-brand-kit-autofill/PLAN.md"
```

`--validate` (plan-checking + verification) since this introduces a new AI
call with cost implications, but no `--research` needed (we already have the
Gemini SDK, the brand-kit pipeline, and the font catalog).
