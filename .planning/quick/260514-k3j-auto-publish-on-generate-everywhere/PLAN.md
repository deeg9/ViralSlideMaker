---
slug: auto-publish-on-generate-everywhere
quick_id: 260514-k3j
created: 2026-05-14
status: in-progress
---

# Auto-publish on generate (every code path)

## User report (verbatim)

> "Again, we need to make all slides public by default once they're generated, like this one that was generated and was private by default. I don't know why we keep doing this or why we haven't fixed this yet, but I've actually had to fix this like five fucking times. For the last fucking time, make all of the slides public by default."

## Why this keeps regressing

Visibility is implicit: a project is **Public** iff there's a `published_carousels` row with `unpublished_at IS NULL` for it. The editor's "Private/Public" pill reflects exactly that. There are **three** carousel-generation entry points, and the "auto-publish on generate" patch lives in only one of them:

| Entry point | Function | Auto-publishes today? |
|---|---|---|
| Main Create form (`generation-form.tsx`) | `app/(dashboard)/project/[id]/actions.ts → generateCarousel` (server action) | ✅ via inline `publishProjectToExplore` |
| Public API / MCP (`/api/v1/carousel`) | `lib/services/carousel.ts → generateCarousel` (service) | ❌ |
| Style-from-reference inline flow | `lib/services/carousel.ts → generateCarouselFromReferences` (service) | ❌ |

Whichever path the user took here landed them on a Private carousel. The fix that's been applied five times only patches the legacy form path; the API path and the style-from-reference path keep re-introducing the regression because they bypass the patched site.

## Fix — centralize auto-publish in a service helper

1. **New** `src/lib/services/auto-publish-on-generate.ts` — single best-effort wrapper around `publishProjectAdmin` (already exists in `src/lib/services/publish.ts`, uses admin client). Failures are non-fatal (warn + return) — the slide data is already persisted; user can manually republish from the editor.

2. **Edit** `src/lib/services/carousel.ts`:
   - `generateCarousel`: call `autoPublishOnGenerate(supabase, userId, projectId, carousel.title)` immediately after the final `UPDATE projects SET generation_status='complete'`.
   - `generateCarouselFromReferences`: same — after the UPDATE before `return`.

3. **Edit** `src/app/(dashboard)/project/[id]/actions.ts` — replace the inline `publishProjectToExplore` block (lines 332–343) with the same helper call (using `createAdminClient()`, which the file already imports). One code path, three call sites.

4. **Test** the helper: success calls `publishProjectAdmin` once with `{ title }`; failure path swallows error + warns.

## Files

- **New** `src/lib/services/auto-publish-on-generate.ts`
- **New** `src/lib/services/__tests__/auto-publish-on-generate.test.ts`
- `src/lib/services/carousel.ts` — two call sites
- `src/app/(dashboard)/project/[id]/actions.ts` — replace inline publish block

## Out of scope

- Adding an `is_public` column on `projects` (would duplicate the source-of-truth, larger refactor).
- The misleading "Default" badge on the Public option in `visibility-dropdown.tsx` — becomes truthful by construction once auto-publish actually defaults to Public, so no UI edit needed.
- Allowing users to opt out of auto-publish on generation (would be a per-user setting; not requested).

## Risk / regression net

- Hero PNG render is on the generation hot path. `publishProjectAdmin` already renders + uploads + inserts; latency on top of generation is ~1–3s. If it fails (font load, Satori crash), generation still succeeds — user just sees Private and can manually publish.
- No new DB columns, no migrations, no RLS changes.
- Tests assert helper behavior + tests assert both service generators call it (mocked).
