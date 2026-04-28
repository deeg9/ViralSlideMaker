---
name: style-upload-brand-kit-autofill
slug: 260428-sty-style-upload-brand-kit-autofill
date: 2026-04-28
status: complete
commit: b00c6c5
---

# Summary — Style Upload via Brand Kit Auto-fill

## What changed

**`src/app/(dashboard)/settings/brand-kit/actions.ts`** — new
`extractStyleFromImage(formData)` server action:

- Validates the file via existing `validateImageFile`.
- Tiered cooldown via existing in-memory `rateLimit`: free = 24h,
  paid = 30s, keyed `bk-extract:{userId}`.
- Calls Gemini 2.5 Flash with the image as `inlineData`, prompt that
  injects the live `FONT_CATALOG` family list so the model can only
  pick fonts we actually render, and a JSON-schema-constrained
  response.
- `sanitizeStyle()` enforces: hex regex on colors, enum on
  `text_align` / `text_position` / `hook_style`, `snapFont()`
  matches model output to nearest catalog entry (fallback Inter),
  numeric clamps on `overlay_opacity_pct` and `confidence`. Bad
  shapes fall back to safe defaults instead of corrupting the form.
- Returns `{ success, style }` or `{ success:false, error }`.

**`src/components/brand-kit/brand-kit-form.tsx`** — new top-of-form
"Generate from Reference" card:

- Hidden file picker driven by a primary CTA.
- Loading state: "Analyzing reference… ~3s".
- On success: pre-fills primary/secondary/accent/bg/text colors,
  heading + body fonts, text align, text position, hook style, and
  overlay opacity via existing state setters — does NOT save.
- Shows three confidence badges (Colors / Fonts / Layout) with
  green/yellow/red palette by `value >= 0.75 / 0.5 / *`.
- Disclaimer: *"We match the style, not the exact font. Review
  before saving."*
- Existing "Save Brand Kit" button commits.

## Why Option B (vs A or C from the PLAN)

Brand Kit already covers every field the extractor returns and is
already wired into the visual-style picker as the "Your Brand Kit"
tile. Auto-fill into Brand Kit is the cheapest, most durable shape:
no new tables, no parallel "uploaded styles" concept, user gets to
review/tweak before locking.

## Verification

- `npx tsc --noEmit` clean for both changed files.
- `npx next lint` only surfaces pre-existing warnings (unused
  `fontFamily` setter, `<img>` tags from earlier code) — no new
  warnings introduced.
- Output sanitization: malformed AI response → safe defaults rather
  than corrupted form state.

## Out of scope (future)

- Logo extraction from the screenshot — too noisy on busy carousels.
- Deep-link entry point from the visual-style picker tile.
- Per-user history of past extractions.
- Upstash Redis–backed rate limit (in-memory limiter is fine for
  single-instance dev/staging, noted in the action's comment).
