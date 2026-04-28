---
phase: 34-api-spec-accuracy
plan: "01"
status: complete
shipped: 2026-04-28
requirements_closed: [SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05, SPEC-06, SPEC-07]
---

# Phase 34, Plan 01 — SUMMARY

## What shipped

Brought `src/lib/api/openapi.ts` into full alignment with the current
`src/lib/types/slide.ts` and `src/lib/types/project.ts`. `/docs` now
documents every field the API actually accepts and returns. No route
handlers changed, no behavior changes.

## Closed requirements

- **SPEC-01** — `Slide.hook_segments` / `body_segments` (TextSegment[]) added
- **SPEC-02** — `StyleOverrides.hook_text_effects` / `body_text_effects` /
  `layout` / `hide_watermark` added
- **SPEC-03** — `CustomText.text_effects` / `segments` added
- **SPEC-04** — new `TextSegment` schema in components
- **SPEC-05** — new `TextEffects` schema with `TextShadowEffect` /
  `TextOutlineEffect` / `TextHighlightEffect` sub-schemas
- **SPEC-06** — `Project.description` / `generation_status` added
- **SPEC-07** — `/carousel` POST 200 response now has `required` array
  and per-field descriptions; shape was already correct

## Files changed

- `src/lib/api/openapi.ts` — +75 lines (5 new schemas, 4 expanded
  schemas, 1 tightened response shape)

## Verification

- `npx tsc --noEmit | grep openapi` → empty
- `curl -sL -o /dev/null -w "%{http_code}\n" http://localhost:3000/docs` → 200
- `grep -cE "TextSegment|TextEffects|TextShadowEffect|hook_segments|body_segments|hide_watermark|generation_status" src/lib/api/openapi.ts` → 18 matches
- Manual browser check on `/docs`: Slide / StyleOverrides / Project / CustomText all expand to show new fields; new TextEffects sub-schemas resolve in the components panel

## Notes

The Scalar SPA (`@scalar/nextjs-api-reference`) renders client-side, so
curling the HTML alone doesn't show schema names — the verification
that matters is the in-browser render.

`PATCH /slides/{index}` route handler still rejects fields outside its
allow-list (hook_text, body_text, image_query, background_url,
style_overrides). Expanding it to accept custom_texts / custom_images /
segments / hide_watermark is API-02 in Phase 35, which is the right
place to ship that change atomically with its spec entry.
