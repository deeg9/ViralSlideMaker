# Deferred Items — Phase 44

Pre-existing issues observed during Phase 44 execution but **out of scope** for this plan
(per executor scope boundary: only auto-fix issues directly caused by current task changes).

## Pre-existing TypeScript errors in test files (14 total)

`npx tsc --noEmit` reports 14 errors all in `src/__tests__/*` files. None reference
the files modified by Phase 44 (`src/lib/types/slide.ts`, `src/lib/render/templates/index.ts`).
Confirmed unchanged from baseline (`git stash` snapshot pre-edit).

Affected test files:
- `src/__tests__/api/api-keys.test.ts` (TS2352 — `null` cast to `Record<string, unknown>`)
- `src/__tests__/auth/logout.test.ts` (TS2348 — vitest `Mock<Procedure | Constructable>` not callable)
- `src/__tests__/auth/middleware.test.ts` (TS2348 ×5)
- `src/__tests__/auth/signup.test.ts` (TS2348 ×2)
- `src/__tests__/projects/crud.test.ts` (TS2348)
- `src/__tests__/stripe/sync-subscription.test.ts` (TS2353 + TS2339 + TS2348 ×2)

Likely cause: vitest mock typing drift (looks like a vitest version where bare `vi.fn()`
return is not directly callable by the test code's mock-builder pattern).

## Pre-existing vitest failures (12 tests across 7 files)

`npx vitest run` reports 12 failing tests, all in test files unrelated to Phase 44.
Confirmed identical pass/fail counts (41 passed / 7 failed test files) before and after
Phase 44 edits via `git stash` baseline check.

Affected test files:
- `src/__tests__/api/rate-limit.test.ts`
- `src/__tests__/components/slide-preview.test.tsx`
- `src/__tests__/editor/responsive.test.tsx`
- `src/__tests__/editor/slide-preview.test.tsx`
- `src/__tests__/projects/crud.test.ts`
- `src/__tests__/stripe/checkout.test.ts`
- `src/__tests__/stripe/sync-subscription.test.ts`

`src/__tests__/render/templates.test.ts` (the registry suite this plan must not regress)
passes 7/7 both before and after the Phase 44 edits.

## Disposition

Not addressed by Phase 44. Recommend a dedicated test-hygiene quick task or include
in Phase 45 prerequisites if the renderer composition work touches the slide-preview
component tests directly.
