---
phase: 82-category-driven-generation-headline-first-copy-engine-conten
plan: 01
subsystem: ai
tags: [schema, zod, gemini, headline-first, accessory-label, text-boxes]

requires: []
provides:
  - "body_text optional end-to-end (Zod + Gemini responseSchema + Slide type)"
  - "optional accessory_label field in both schemas + the legacy->text_boxes adapter"
  - "headline-only slides validate and render without a body text box"
affects: [82-02, 82-03, 82-04, 82-05]

tech-stack:
  added: []
  patterns:
    - "Optional-field back-compat: keep deprecated fields optional, never rename/remove"

key-files:
  created:
    - src/lib/ai/__tests__/optional-body-accessory-label.test.ts
  modified:
    - src/lib/ai/schemas.ts
    - src/lib/ai/generate-slides.ts
    - src/lib/ai/validate-slides.ts
    - src/lib/editor/text-box-adapter.ts
    - src/lib/types/slide.ts

key-decisions:
  - "Slide.body_text made optional too (it was @deprecated v2.8) — cleanest fix for the SlideContentWithTextBoxes -> Slide[] assignment; 6 consumer sites + 1 dev script guarded with `?? ''`"
  - "accessory_label mapped to a distinct small (32px) uppercase top-anchored role='custom' TextBox — not merged into the headline"
  - "validateAndRepair body checks (overflow/orphan/typo) guarded to skip when body_text is absent — never auto-fills a placeholder"

patterns-established:
  - "Headline-only slides are first-class: an absent body produces no body box, no validation error"
---

# Plan 82-01 Summary — Optional body_text + accessory_label

## What was built

`body_text` is now optional across the whole generation/ingest pipeline (R4), and a new
optional `accessory_label` field (R5) lets Gemini emit a small kicker/one-liner.

- **Zod** (`schemas.ts`): `body_text` → `.optional()`; new `accessory_label` optional string.
- **Gemini responseSchema** (`generate-slides.ts`): `body_text` dropped from the slide-level
  `required` array (kept as a property); `accessory_label` property added.
- **`Slide` type** (`slide.ts`): `body_text` made optional; new `accessory_label?: string`.
- **Adapter** (`text-box-adapter.ts`): the body `TextBox` is emitted only when `body_text`
  is non-empty; `accessory_label` maps to a distinct small (32px) uppercase top-anchored
  `role: 'custom'` box — not merged into the headline.
- **`validateAndRepair`** (`validate-slides.ts`): `detectOverflows` / `detectOrphans` /
  `detectTypos` body checks skip gracefully when `body_text` is absent — no auto-fill.

## Back-compat

6 consumer call sites (renderers, AI image-prompt callers) + 1 dev script were guarded
with `?? ''` so the optional `Slide.body_text` does not break the byte-identity renderers.
tsc error count unchanged at the 19-error pre-existing baseline (test-mock noise only).

## Verification

- `optional-body-accessory-label.test.ts` — 7 tests passing (headline-only validates,
  empty-body validates, back-compat carousel validates, accessory_label present/absent,
  adapter omits body box / maps label distinctly).
- Render-parity suite — 574 tests green, no snapshot changes (renderer `?? ''` guards
  are byte-safe).

## Unblocks

Wave 2 (Plans 03, 04) and Wave 3 (Plan 05) — the schema foundation for headline-first
copy is in place.
