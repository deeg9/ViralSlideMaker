---
slug: auto-publish-on-generate-everywhere
quick_id: 260514-k3j
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# Auto-publish on generate — every code path — Summary

## User report (verbatim)

> "Again, we need to make all slides public by default once they're generated, like this one that was generated and was private by default. I don't know why we keep doing this or why we haven't fixed this yet, but I've actually had to fix this like five fucking times. For the last fucking time, make all of the slides public by default."

## Why this regression kept coming back

Visibility is implicit: a project is **Public** iff a `published_carousels` row exists for it with `unpublished_at IS NULL`. The editor pill renders that fact verbatim. There are **three** carousel-generation entry points in the codebase, but the auto-publish patch lived in only **one** of them, so any new path that bypassed it shipped Private-by-default:

| Path | Caller of | Auto-publish before this fix |
|---|---|---|
| Main Create form (`generation-form.tsx`) | `app/(dashboard)/project/[id]/actions.ts → generateCarousel` (server action) | ✅ inline (~10 lines) |
| Public API / MCP (`/api/v1/carousel`) | `lib/services/carousel.ts → generateCarousel` (service) | ❌ |
| Style-from-reference inline flow | `lib/services/carousel.ts → generateCarouselFromReferences` (service) | ❌ |

Whichever new path landed without the patch generated Private carousels. Every "fix" added the patch to one site, then the next generation feature shipped without it.

## The fix — one ritual, three call sites

**New helper** `src/lib/services/auto-publish-on-generate.ts` — single best-effort wrapper around `publishProjectAdmin` (already in `lib/services/publish.ts`):

```ts
export async function autoPublishOnGenerate(
  admin: SupabaseClient,
  userId: string,
  projectId: string,
  title: string,
): Promise<void>
```

Best-effort by design: if hero render / upload / RPC fail, the slide data is already persisted — user keeps their work and can republish manually. Failures land in `console.warn` for server logs.

**All three generation paths now call it as the last step after persisting slide_data + generation_status:'complete':**

1. `lib/services/carousel.ts → generateCarousel` — covers `/api/v1/carousel`.
2. `lib/services/carousel.ts → generateCarouselFromReferences` — covers style-from-reference.
3. `app/(dashboard)/project/[id]/actions.ts → generateCarousel` — covers the main Create form. The previous ~10-line inline `publishProjectToExplore` block was replaced with a 2-line `createAdminClient()` + `autoPublishOnGenerate(...)` call. Same outcome, same code path as the other two.

Future regression net: any new generation entry point is a one-line call away from honoring the contract. The helper's docstring lists all current call sites — adding a new one without wiring this in is now an obvious omission.

## Files changed

- **New** `src/lib/services/auto-publish-on-generate.ts` — the centralized helper.
- **New** `src/lib/services/__tests__/auto-publish-on-generate.test.ts` — 3 tests (success forwards args; failure result is swallowed + logged; thrown error is swallowed + logged).
- `src/lib/services/carousel.ts` — import helper; call at the end of `generateCarousel` and `generateCarouselFromReferences`.
- `src/app/(dashboard)/project/[id]/actions.ts` — replace inline `publishProjectToExplore` block with helper call; drop unused `publishProjectToExplore` import.

## Verification

- `npx vitest run src/lib/services/`: **5 of 5 test files passing**, 24 tests green (includes new helper tests + existing `carousel-from-references` + `publish-style-spec-snapshot` + `publish-template-id-snapshot` + `projects-delete`).
- `npx tsc --noEmit`: **no new errors** beyond the pre-existing baseline.
- `npx eslint` on touched files: clean (one pre-existing unused-var warning in `carousel.ts` unrelated to this work).

## Manual smoke checklist (user)

1. Open `/create`, generate a carousel via topic → editor opens → footer pill reads **Public** ✅.
2. Open `/create`, use Style-from-Reference (upload images + extract spec + emit) → editor opens → pill reads **Public** ✅.
3. POST to `/api/v1/carousel` (e.g. via MCP) → land on `/project/{id}` → pill reads **Public** ✅.
4. Existing projects are unaffected — auto-publish only runs once during generation. Manual publish/unpublish via the dropdown still works the same way.

## Notes

- The "Default" badge on the Public option in `visibility-dropdown.tsx` was always semantically correct; with this fix it's now also behaviorally correct.
- Hero PNG render is the heaviest part of publish. It adds ~1–3s to generation latency. Acceptable trade-off for the "just works" UX the user is asking for.
- No DB migrations, no schema changes, no RLS changes.
