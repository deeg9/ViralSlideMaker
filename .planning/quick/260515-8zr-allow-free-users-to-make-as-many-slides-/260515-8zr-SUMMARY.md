---
quick_id: 260515-8zr
type: execute
status: completed
completed_at: 2026-05-15
duration_minutes: 4
commits:
  - c78c7e2 -- feat(260515-8zr): remove four free-tier slide-count gates
  - 1e7ad08 -- docs(260515-8zr): remove free-tier slide-cap from OpenAPI 400 description
files_modified:
  - src/app/(dashboard)/project/[id]/actions.ts
  - src/app/api/v1/carousel/route.ts
  - src/lib/mcp/tools.ts
  - src/components/slides/generation-form.tsx
  - src/lib/api/openapi.ts
deliberately_untouched:
  - FREE_TIER_PROJECT_LIMIT (project-count cap in check-credits.ts / route.ts / tools.ts)
  - forced free-tier watermark (openapi.ts line 182)
  - AI image paid gate (generation-form.tsx lines 503/521)
  - autoPublishOnGenerate (post-generation path)
  - Universal 3..10 server-side slideCount validation (actions.ts clampedCount, route.ts NaN/range guard)
---

# Quick 260515-8zr: Allow free users to make as many slides as paid users — Summary

## One-liner

Removed all four free-tier `slideCount > 3` gates (server action, REST route, MCP tool, client form) plus the matching OpenAPI 400 description — free and paid users now share the same 3..10 slide range; project-count cap and AI-image paid gates are preserved.

## What changed

### Gate 1 — `src/app/(dashboard)/project/[id]/actions.ts`

- Deleted the `// Free-tier slide-count cap` comment, local `tier` const, `FREE_TIER_MAX_SLIDES = 3` const, and the `if (tier === 'free' && slideCount > FREE_TIER_MAX_SLIDES) { return ... }` block (was lines 59–68).
- `getUserTier` was orphaned in this file — pruned from the named-imports line (`import { checkCredits, deductCredit, getCreditBalance } from '@/lib/credits/check-credits'`).
- One downstream `tier` reference on line 173 (`isPremium = tier !== 'free'` for vision-match gate) was repointed to `credits.tier` (already in scope from the earlier `checkCredits()` call). This was a Rule 3 fix — the plan's `<interfaces>` note had asserted all subsequent `tier` references came from `credits.tier`, but tsc surfaced one that didn't; using `credits.tier` keeps the gate behavior byte-identical.

### Gate 2 — `src/app/api/v1/carousel/route.ts`

- Deleted the `// Free-tier slide-count cap` comment + `if (tier === 'free' && validSlideCount > 3) { ... }` block (was lines 53–61).
- Kept `const tier = await getUserTier(ctx.userId)` (relocated under the new `// Free-tier project-count cap` comment); reused by `checkProjectLimit(ctx.userId, tier)`.
- Universal validation `validSlideCount < 3 || validSlideCount > 10` (line 45) untouched.

### Gate 3 — `src/lib/mcp/tools.ts`

- Deleted the `// Free-tier slide-count cap` block (was lines 186–192).
- Kept `const tier = await getUserTier(userId)` — used by `checkProjectLimit(userId, tier)` below.
- Rewrote the now-stale `// Validation order mirrors /api/v1/carousel/route.ts:53-71 (slide-count cap before project-cap).` comment to `// Project-count cap (mirrors /api/v1/carousel/route.ts).`.

### Gate 4 — `src/components/slides/generation-form.tsx`

- Deleted top-of-file `const FREE_TIER_MAX_SLIDES = 3`.
- `sliderMax = isPaidUser ? 10 : FREE_TIER_MAX_SLIDES` → `sliderMax = 10`.
- `useState(isPaidUser ? 7 : FREE_TIER_MAX_SLIDES)` → `useState(7)`.
- `effectiveSlideCount = isPaidUser ? slideCount : Math.min(slideCount, FREE_TIER_MAX_SLIDES)` → `effectiveSlideCount = slideCount` (kept as alias for clarity at the call site).
- Slider `min={isPaidUser ? 3 : 1}` → `min={3}` (universal floor matches the server's 3..10 validation).
- Range label `<span>{isPaidUser ? 3 : 1}</span>` → `<span>3</span>`.
- Deleted the entire `{!isPaidUser && (...)}` "Upgrade for more slides" lock-icon + Link nudge block.
- `Link` import (`next/link`) was orphaned — pruned.
- `isPaidUser` const kept (still gates the AI-image background button on lines 503/521).

### Gate 5 — `src/lib/api/openapi.ts`

- Line 463 description: `'Validation error (invalid topic, slideCount out of range, free-tier slide cap, free-tier project cap)'` → `'Validation error (invalid topic, slideCount out of range, free-tier project cap)'`.
- Line 182 (`forced free-tier watermark`) deliberately untouched — different feature.

## Deviations from plan

### Auto-fixed Issues

**1. [Rule 3 — blocking issue] Repoint stale `tier` reference in actions.ts:173**

- **Found during:** Task 1, post-edit `npx tsc --noEmit` reported `error TS2304: Cannot find name 'tier'` at `src/app/(dashboard)/project/[id]/actions.ts(173,25)`.
- **Issue:** The plan's `<interfaces>` block claimed "subsequent `tier` references in this file all come from `credits.tier`, not this local." This was only mostly true — line 173's `isPremium = tier !== 'free'` (the Phase 58 vision-match premium gate) was previously satisfied by the local `tier` const that the plan instructed me to delete.
- **Fix:** Changed `const isPremium = tier !== 'free'` to `const isPremium = credits.tier !== 'free'`. `credits` is in scope from the earlier `checkCredits()` call (line 50) and exposes `.tier` (the same source the plan implicitly assumed). Behavior is byte-identical — both `getUserTier(user.id)` and `checkCredits().tier` return the user's effective tier.
- **Files modified:** `src/app/(dashboard)/project/[id]/actions.ts` (one-line change at line 173).
- **Commit:** `c78c7e2` (folded into Task 1).

### Deferred Issues (out of scope per Rule scope-boundary)

- **`useCallback` unused-import warning** in `src/components/slides/generation-form.tsx:3:63`. Verified pre-existing via `git stash && npm run lint` on the unmodified baseline — same warning surfaces. Not introduced by this task.

## Verification

### Grep gates (all empty)

```
$ grep -rn "FREE_TIER_MAX_SLIDES" src/                                      # (empty)
$ grep -rn "limited to 3 slides" src/                                       # (empty)
$ grep -rn "free-tier slide cap" src/ docs/                                 # (empty)
$ grep -rn "tier === 'free' && validSlideCount > 3" src/                    # (empty)
$ grep -rn "tier === 'free' && slideCount > " src/                          # (empty)
```

### Project-count cap untouched (must still appear — confirmed)

```
src/lib/credits/check-credits.ts:45:export const FREE_TIER_PROJECT_LIMIT = 3
src/lib/credits/check-credits.ts:54:  return (count ?? 0) < FREE_TIER_PROJECT_LIMIT
src/app/api/v1/carousel/route.ts:8:  FREE_TIER_PROJECT_LIMIT,
src/app/api/v1/carousel/route.ts:59:      `Free plan is limited to ${FREE_TIER_PROJECT_LIMIT} projects. Upgrade for unlimited.`,
src/lib/mcp/tools.ts:36:  FREE_TIER_PROJECT_LIMIT,
src/lib/mcp/tools.ts:193:          `Free plan is limited to ${FREE_TIER_PROJECT_LIMIT} projects. Upgrade for unlimited.`
```

### AI-image paid gate preserved

```
src/components/slides/generation-form.tsx:52:  const isPaidUser = userTier !== 'free'
src/components/slides/generation-form.tsx:503:              if (!isPaidUser) {
src/components/slides/generation-form.tsx:521:              {isPaidUser ? '1 credit per slide' : 'Hobbyist / Creator only'}
```

### Universal 3..10 server-side validation preserved

```
src/app/(dashboard)/project/[id]/actions.ts:85: const clampedCount = Math.max(3, Math.min(10, slideCount))
src/app/api/v1/carousel/route.ts:45: ... validSlideCount < 3 || validSlideCount > 10 ...
```

### Type check

`npx tsc --noEmit` filtered to changed files (`generation-form|actions\.ts|carousel/route|mcp/tools|FREE_TIER_MAX_SLIDES`): zero errors.

### Lint

`npm run lint` on the four code files: 0 errors, 1 warning (pre-existing `useCallback` import — see Deferred Issues).

### Tests

`npx vitest run src/__tests__/credits/check-credits.test.ts src/__tests__/mcp/tools/create_carousel.test.ts`: **22/22 passed** (2 test files, 549 ms). Covers `checkProjectLimit` (project-count cap) + `create_carousel` MCP happy path — both confirm the project-count cap and existing MCP behavior survive intact.

No OpenAPI snapshot tests exist in the repo (verified via `find src -name "openapi*.test.*"` returning empty).

## Things deliberately left alone

- **`FREE_TIER_PROJECT_LIMIT = 3`** in `src/lib/credits/check-credits.ts` and its consumers in `route.ts` / `mcp/tools.ts` — project-count cap is a separate feature.
- **Forced free-tier watermark** description in `src/lib/api/openapi.ts:182` — separate feature.
- **AI-image source paid gate** in `generation-form.tsx`:
  - Line 52: `const isPaidUser = userTier !== 'free'` (kept).
  - Line 503: `if (!isPaidUser) { setShowUpgradePrompt(true); return }` for `imageSource === 'ai'` (kept).
  - Line 521: `{isPaidUser ? '1 credit per slide' : 'Hobbyist / Creator only'}` label on the AI background button (kept).
- **`autoPublishOnGenerate`** helper / public-by-default post-generation path — no edits touched generation post-processing (per project memory `feedback_public_by_default.md`).
- **Universal 3..10 floor/ceiling**: `Math.max(3, Math.min(10, slideCount))` in `actions.ts:85` and `validSlideCount < 3 || validSlideCount > 10` in `route.ts:45` — tier-agnostic server-side validation, kept.

## Self-Check: PASSED

- Files modified (5/5 in plan): all exist, all in correct content state.
- Commits (2): `c78c7e2` (feat) + `1e7ad08` (docs) — both present in `git log`.
- All grep gates empty; all preserved-feature greps non-empty.
- 22/22 targeted vitest tests green; typecheck clean for changed files.
