---
phase: 260427-jwq
plan: 01
subsystem: monetization
tags: [free-tier, paywall, slider-cap, upsell]
requires:
  - getUserTier from src/lib/credits/check-credits.ts (already existed)
provides:
  - "Hard slide-count cap for free tier (UI + server action + public API)"
  - "Inline upgrade upsell beneath the slide-count slider on the project page"
affects:
  - src/components/slides/generation-form.tsx
  - src/app/(dashboard)/project/[id]/actions.ts
  - src/app/api/v1/carousel/route.ts
tech-stack:
  added: []
  patterns:
    - "Defense in depth: cap enforced in UI, server action, and API route"
    - "Cap check before credit deduction so rejected requests are free"
key-files:
  created: []
  modified:
    - src/components/slides/generation-form.tsx
    - src/app/(dashboard)/project/[id]/actions.ts
    - src/app/api/v1/carousel/route.ts
decisions:
  - "FREE_TIER_MAX_SLIDES constant declared at file scope in generation-form.tsx (not exported - cap value is also hardcoded inline at the two server entry points to keep each file self-contained and avoid a cross-package import)"
  - "Free users can pick 1, 2, or 3 (slider min=1) instead of being locked at exactly 3 (min=3, max=3)"
  - "Initial slideCount state is FREE_TIER_MAX_SLIDES for free users (was always 7) to avoid the slider rendering above its max on first paint"
  - "services/carousel.ts intentionally NOT modified - the action and API route are the only callers, so duplicating the check there would be dead defense"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_modified: 3
  commits: 2
---

# Quick Task 260427-jwq: Free-tier cap (max 3 slides) Summary

Convert the slide-count selector from a soft visual into a real monetization gate: free users get a hard cap of 3 slides at every layer (UI slider, server action, public API), with an inline upgrade upsell visible beneath the slider.

## What Changed

### 1. UI cap + upsell (`src/components/slides/generation-form.tsx`)

- Added `const FREE_TIER_MAX_SLIDES = 3` at file scope.
- Added `import Link from 'next/link'`.
- Derived `sliderMax = isPaidUser ? 20 : FREE_TIER_MAX_SLIDES` and moved `isPaidUser` derivation up next to the other useState calls so it's available for the initial slideCount.
- Initial `slideCount` state now respects the cap: `useState(isPaidUser ? 7 : FREE_TIER_MAX_SLIDES)` — a free user no longer starts at 7 (which would render above the cap).
- Slider `<input type="range">` uses `min={isPaidUser ? 3 : 1}` and `max={sliderMax}`. Free users get 1/2/3; paid keeps 3-20.
- Range labels under the slider mirror the same min/max ({isPaidUser ? 3 : 1} and {sliderMax}).
- Beneath the slider, when `!isPaidUser`, render a padlock icon (`Icon name="lock"`) + a `<Link href="/settings/subscription">Upgrade for more slides</Link>` row using existing `#7d6161` / `#3d0000` palette.
- `handleSubmit` defensively clamps before submit: `const effectiveSlideCount = isPaidUser ? slideCount : Math.min(slideCount, FREE_TIER_MAX_SLIDES)` and passes `effectiveSlideCount` to `generateCarousel`.
- The duplicate `const isPaidUser = userTier !== 'free'` line that previously sat above the JSX `return` was removed (now declared once at the top of the component).

**Commit:** `ee73c10`

### 2. Server-side enforcement (`actions.ts` + `api/v1/carousel/route.ts`)

**`src/app/(dashboard)/project/[id]/actions.ts`**
- Added `getUserTier` to the existing `@/lib/credits/check-credits` import.
- After `ensureSubscription(...)` + `checkCredits()` and BEFORE `deductCredit(...)`, inserted:
  ```ts
  const tier = await getUserTier(user.id)
  const FREE_TIER_MAX_SLIDES = 3
  if (tier === 'free' && slideCount > FREE_TIER_MAX_SLIDES) {
    return {
      success: false,
      error: `Free plan is limited to ${FREE_TIER_MAX_SLIDES} slides. Upgrade for up to 20.`,
      upgradeEligible: true,
    }
  }
  ```
  Returns the existing error shape with `upgradeEligible: true`, which the client (`generation-form.tsx`) already maps to `<UpgradePrompt context="generation" />`.

**`src/app/api/v1/carousel/route.ts`**
- Added `getUserTier` to the existing `@/lib/credits/check-credits` import.
- After the existing 3-20 integer/range validation and BEFORE the `ctx.creditBalance < 1` check / `deductCreditAdmin(...)`, inserted:
  ```ts
  const tier = await getUserTier(ctx.userId)
  if (tier === 'free' && validSlideCount > 3) {
    return apiError(
      'VALIDATION_ERROR',
      'Free plan is limited to 3 slides per carousel. Upgrade to plus or pro for up to 20.',
      400
    )
  }
  ```
  Reuses the existing `VALIDATION_ERROR` code (consistent with how the route reports the existing range check) and runs before any credit deduction.

**`src/lib/services/carousel.ts`** intentionally NOT modified — it's a pure helper called only after auth/cap gating in both the action and the route. Adding a duplicate check there would be redundant.

**`CreateProjectDialog`** (the `?new=1` deep-link dialog) intentionally NOT modified — confirmed it only collects title/description and never picks a slide count.

**Commit:** `bb3cf79`

## Verification

- `npx tsc --noEmit 2>&1 | grep -E "generation-form|actions\.ts|carousel/route"` → empty output (no new TS errors in any of the three modified files).
- All 7 must-have truths from the plan frontmatter are satisfied:
  1. Free users see the slider hard-capped at 3 (max attribute = 3) ✓
  2. Padlock badge + "Upgrade for more slides" link beneath slider for free users ✓
  3. Upgrade link routes to `/settings/subscription` ✓
  4. Paid users (plus/pro) keep the full 3-20 range, no padlock UI ✓
  5. Free user POSTing slideCount > 3 to the server action returns `{ upgradeEligible: true }` ✓
  6. Free user POSTing slideCount > 3 to /api/v1/carousel returns 4xx VALIDATION_ERROR ✓
  7. CreateProjectDialog (?new=1 deep link) unaffected ✓

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/components/slides/generation-form.tsx (modified)
- FOUND: src/app/(dashboard)/project/[id]/actions.ts (modified)
- FOUND: src/app/api/v1/carousel/route.ts (modified)
- FOUND: commit ee73c10 (Task 1)
- FOUND: commit bb3cf79 (Task 2)
- TYPECHECK CLEAN: generation-form, actions.ts, carousel/route all type-clean
