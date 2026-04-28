---
phase: 37-ai-image-sources
status: complete
shipped: 2026-04-28
requirements_closed: [API-09, API-10, API-11]
---

# Phase 37 — SUMMARY

## What shipped

3 endpoints + a shared AI-regen service module.

| Endpoint | Method | Cost |
|---|---|---|
| Pexels search | `POST /pexels/search` | free |
| AI image gen | `POST /projects/{id}/slides/{index}/generate-image` | 1 credit |
| AI text regen | `POST /projects/{id}/slides/{index}/regenerate-text` | free |

## Files

- **New** `src/lib/services/ai-regen.ts`:
  - `regenerateSlideText(slide, topic, index, customPrompt?)` — extracted from the editor's server-action; calls Gemini 2.5 Flash with structured JSON output
  - `generateImagenBackgroundAdmin(admin, userId, prompt, projectId, slideIndex)` — admin-client variant of the existing `generateImagenBackground`. Pre-deducts via `deduct_credits` RPC (passed `p_user_id` so it doesn't depend on `auth.uid()`), refunds on safety filter or upstream errors.
- **New** `src/app/api/v1/pexels/search/route.ts`
- **New** `src/app/api/v1/projects/[id]/slides/[index]/generate-image/route.ts`
- **New** `src/app/api/v1/projects/[id]/slides/[index]/regenerate-text/route.ts`

## Decisions (defaults applied)

- **Pexels orientation default:** portrait (matches dashboard default for 9:16 carousels). `landscape` and `square` allowed.
- **Pexels perPage default:** 12 (max 80 per Pexels' API limit).
- **AI image gen persistence:** ALWAYS persists the new URL to `slide.background_url`, sets `slide.image_query` to the prompt used, and clears `pexels_photo_id`. The dashboard does the same; offering an opt-out would surprise callers.
- **AI text regen persistence:** OPT-IN via `persist: true` body param. Default returns the new text without writing — lets callers inspect before committing.
- **Topic source:** uses `project.topic` if set, else falls back to `project.title`. Mirrors the editor flow.
- **Credit deduction path:** `generate-image` checks `ctx.creditBalance` first (cheap pre-check, avoids hitting Imagen unnecessarily), then `generateImagenBackgroundAdmin` does the atomic deduct via RPC. On upstream failure, the credit is refunded and a structured error is returned.

## Verification

- `npx tsc --noEmit | grep -E "pexels|generate-image|regenerate-text|ai-regen"` → empty
- `curl /api/v1/pexels/search` → 401 (no API key, expected)
- `curl /api/v1/projects/test/slides/0/generate-image` → 401 (no API key, expected)

## Out of scope

- AI image-query regen (the `regenerateSlideImageQuery` flow that produces a new query string then searches Pexels). Probably folded into a future endpoint or accomplished by chaining `regenerate-text` + `pexels/search`.
- Upload custom images via API. Currently the only paths to add custom images are via `slide.background_url` (set to any HTTPS URL) or by providing custom_images array via the slide PATCH. A signed-upload-URL endpoint can ship in v2.6.
