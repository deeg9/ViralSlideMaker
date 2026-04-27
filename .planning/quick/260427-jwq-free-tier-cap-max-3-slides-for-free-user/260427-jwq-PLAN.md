---
phase: 260427-jwq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/slides/generation-form.tsx
  - src/app/(dashboard)/project/[id]/actions.ts
  - src/app/api/v1/carousel/route.ts
autonomous: true
requirements:
  - QUICK-260427-jwq
must_haves:
  truths:
    - "Free users see the slide-count slider hard-capped at 3 (max attribute = 3)"
    - "Free users see a padlock badge + 'Upgrade for more slides' link beneath the slider"
    - "The upgrade link routes to /settings/subscription"
    - "Paid users (plus/pro) keep the full 3-20 slider range with no padlock UI"
    - "If a free user POSTs slideCount > 3 to the server action, it returns an error with upgradeEligible: true"
    - "If a free user POSTs slideCount > 3 to /api/v1/carousel, it returns a 4xx VALIDATION_ERROR"
    - "CreateProjectDialog (?new=1 deep link) is unaffected — it only collects title/description, not slideCount"
  artifacts:
    - path: src/components/slides/generation-form.tsx
      provides: "Slider capped at 3 for free tier + upsell link beneath slider"
      contains: "FREE_TIER_MAX_SLIDES"
    - path: src/app/(dashboard)/project/[id]/actions.ts
      provides: "Server-side tier re-check in generateCarousel before content generation"
      contains: "upgradeEligible"
    - path: src/app/api/v1/carousel/route.ts
      provides: "API route validates slideCount against tier (free => max 3)"
      contains: "getUserTier"
  key_links:
    - from: "src/components/slides/generation-form.tsx"
      to: "/settings/subscription"
      via: "<Link href> beneath slider"
      pattern: "settings/subscription"
    - from: "src/app/(dashboard)/project/[id]/actions.ts"
      to: "src/lib/credits/check-credits.ts"
      via: "getUserTier(user.id)"
      pattern: "getUserTier"
    - from: "src/app/api/v1/carousel/route.ts"
      to: "src/lib/credits/check-credits.ts"
      via: "getUserTier(ctx.userId)"
      pattern: "getUserTier"
---

<objective>
Cap the slide-count slider at 3 for free users with a visible upgrade upsell, and enforce the cap on both the server action and the public API route so it cannot be bypassed by tampering with the client.

Purpose: Convert the slide-count selector from a soft visual into a real monetization gate. Free users should feel the limit and have a one-click path to upgrade; paid users should see no change.

Output:
- `generation-form.tsx`: slider `max` becomes 3 when `userTier === 'free'`, with a padlock badge + upgrade link.
- `actions.ts` (server action) and `api/v1/carousel/route.ts` (public API): tier re-check, return existing error shape with `upgradeEligible: true` (action) or `VALIDATION_ERROR` (API) when free users exceed 3.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@src/components/slides/generation-form.tsx
@src/app/(dashboard)/project/[id]/actions.ts
@src/lib/services/carousel.ts
@src/lib/credits/check-credits.ts
@src/app/api/v1/carousel/route.ts

<interfaces>
<!-- Key contracts the executor needs. Use these directly. -->

From src/lib/credits/check-credits.ts:
```typescript
export async function getUserTier(userId: string): Promise<SubscriptionTier>  // returns 'free' | 'plus' | 'pro'
```

From src/components/slides/generation-form.tsx:
```typescript
interface GenerationFormProps {
  projectId: string
  currentTopic?: string
  currentTemplateId?: string
  hasSlides: boolean
  userTier?: 'free' | 'pro' | 'plus'   // already wired through props
}
// Existing local: const isPaidUser = userTier !== 'free'
```

From src/app/(dashboard)/project/[id]/actions.ts:
```typescript
export async function generateCarousel(
  projectId: string,
  topic: string,
  templateId: string,
  imageSource: 'stock' | 'ai' = 'stock',
  slideCount: number = 7,
  advancedOptions?: { font?: string; fontColor?: string; imagePrompt?: string }
): Promise<{ success: true; slideCount: number } | { success: false; error: string; upgradeEligible?: boolean }>
```

From src/app/api/v1/carousel/route.ts:
```typescript
// withApiAuth ctx shape: { userId, keyId, supabase, creditBalance }  -- no `tier` field, must call getUserTier(ctx.userId)
// Existing slideCount validation pattern uses apiError('VALIDATION_ERROR', '...', 400)
```

Note: `CreateProjectDialog` only collects title/description and calls `createProject(formData)` — it does NOT pick a slide count, so no cap is needed there. Slide count is chosen later in `GenerationForm`. Confirmed by reading the file.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Cap slider at 3 for free users + add upsell link (client)</name>
  <files>src/components/slides/generation-form.tsx</files>
  <action>
Modify the "Number of Slides" block (around lines 109-131) to enforce a free-tier cap with visible upsell:

1. Add a constant near the top of the file (after imports, outside the component): `const FREE_TIER_MAX_SLIDES = 3`.

2. Inside the component, after the existing `isPaidUser` derivation, compute the effective max:
   ```ts
   const sliderMax = isPaidUser ? 20 : FREE_TIER_MAX_SLIDES
   ```

3. Clamp the initial state so free users don't start at 7 (which would exceed their cap):
   - Change `useState(7)` to `useState(isPaidUser ? 7 : FREE_TIER_MAX_SLIDES)`.

4. In the slider `<input type="range" ...>`:
   - Replace `max={20}` with `max={sliderMax}`.
   - Keep `min={3}` for paid users, but for free users this means the only legal values are 3 (since min=3, max=3 — slider effectively locked at 3). To honor the design ("Free users can pick 1 or 2 or 3"), change `min={isPaidUser ? 3 : 1}` and `max={sliderMax}`. Free users get 1/2/3; paid users keep 3-20.
   - Update the range labels below the slider: change the left "3" / right "20" spans to use the same min/max:
     ```tsx
     <span className="text-[10px] text-[#7d6161]">{isPaidUser ? 3 : 1}</span>
     <span className="text-[10px] text-[#7d6161]">{sliderMax}</span>
     ```

5. Beneath the slider's max-label row, when `!isPaidUser`, render a small upsell row using the existing color palette and `next/link` (add `import Link from 'next/link'` at the top if not present):
   ```tsx
   {!isPaidUser && (
     <div className="flex items-center gap-1.5 mt-2 ml-1">
       <Icon name="lock" size="sm" className="text-[#7d6161]" />
       <Link
         href="/settings/subscription"
         className="text-[11px] font-semibold text-[#3d0000] hover:underline"
       >
         Upgrade for more slides
       </Link>
     </div>
   )}
   ```
   (The `Icon` component is already imported. `lock` is a Material Symbols glyph — matches the existing icon style used elsewhere in the form. The user-facing copy in the design says "padlock badge" — `lock` icon satisfies this.)

6. Also clamp on submit as a defensive measure (in case state was set elsewhere): in `handleSubmit`, before calling `generateCarousel`, compute:
   ```ts
   const effectiveSlideCount = isPaidUser ? slideCount : Math.min(slideCount, FREE_TIER_MAX_SLIDES)
   ```
   and pass `effectiveSlideCount` to `generateCarousel(...)` instead of `slideCount`.

Do NOT touch the AI image-source button gate or any other section.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "generation-form" || echo "tsc clean for generation-form"</automated>
  </verify>
  <done>
- `FREE_TIER_MAX_SLIDES = 3` constant exists in the file.
- Slider `max` is `3` when `userTier === 'free'`, `20` otherwise.
- Padlock icon + "Upgrade for more slides" link visible beneath slider for free users only.
- Link `href` is `/settings/subscription`.
- Initial `slideCount` state respects the cap (free user starts at 3, not 7).
- `handleSubmit` passes a clamped `effectiveSlideCount` to `generateCarousel`.
- `npx tsc --noEmit` reports no new errors for this file.
  </done>
</task>

<task type="auto">
  <name>Task 2: Server-side tier re-check in action + API route</name>
  <files>src/app/(dashboard)/project/[id]/actions.ts, src/app/api/v1/carousel/route.ts</files>
  <action>
Add server-side enforcement so the cap cannot be bypassed by editing client state or calling the API directly.

**A. `src/app/(dashboard)/project/[id]/actions.ts`** (`generateCarousel` server action):

1. Add `getUserTier` to the existing import from `@/lib/credits/check-credits`:
   ```ts
   import { checkCredits, deductCredit, getCreditBalance, getUserTier } from '@/lib/credits/check-credits'
   ```

2. Inside `generateCarousel`, after the `ensureSubscription(user.id)` call and the existing `checkCredits()` block (around line 39-46), insert a tier-cap check BEFORE any credit deduction or AI work:
   ```ts
   // Free-tier slide-count cap (matches client-side gate in generation-form.tsx)
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
   This MUST run before `deductCredit(...)` so a rejected request does not consume credits.

**B. `src/app/api/v1/carousel/route.ts`** (public API route):

1. Add `getUserTier` to the import from `@/lib/credits/check-credits`:
   ```ts
   import { deductCreditAdmin, getUserTier } from '@/lib/credits/check-credits'
   ```

2. After the existing `slideCount` integer/range validation (around lines 39-42) and BEFORE the credit balance check / deduction (line 48+), insert:
   ```ts
   // Free-tier slide-count cap
   const tier = await getUserTier(ctx.userId)
   if (tier === 'free' && validSlideCount > 3) {
     return apiError(
       'VALIDATION_ERROR',
       'Free plan is limited to 3 slides per carousel. Upgrade to plus or pro for up to 20.',
       400
     )
   }
   ```
   Place this BEFORE `deductCreditAdmin(...)` so rejected requests do not consume credits. Use the existing `apiError` helper and the existing `VALIDATION_ERROR` code (consistent with how the route reports the existing 3-20 range check).

Do NOT modify `src/lib/services/carousel.ts` — it is a pure helper called only after auth/cap gating in both the action and the route. Adding a duplicate check there would be redundant; the two callers above are the only entry points.

Do NOT touch `CreateProjectDialog` — it only collects title/description and never chooses a slide count.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | grep -E "(actions\.ts|carousel/route\.ts)" || echo "tsc clean for action + api route"</automated>
  </verify>
  <done>
- `getUserTier` imported in both `actions.ts` and `api/v1/carousel/route.ts`.
- Server action returns `{ success: false, error: '...', upgradeEligible: true }` when `tier === 'free' && slideCount > 3`.
- API route returns `apiError('VALIDATION_ERROR', ..., 400)` when free user requests > 3 slides.
- Both checks run BEFORE credit deduction (no credit charged for rejected requests).
- `npx tsc --noEmit` reports no new errors for either file.
- `services/carousel.ts` is NOT modified (single source of cap enforcement is at the two call sites).
  </done>
</task>

</tasks>

<verification>
End-to-end manual smoke (executor should perform after both tasks land):

1. **Free user UI:** Sign in as a free user, open a project, observe the slider — max is 3, padlock + "Upgrade for more slides" link visible beneath, link href = `/settings/subscription`.
2. **Paid user UI:** Sign in as a plus/pro user, open the same project — slider goes 3-20, no padlock, no upsell link.
3. **Server enforcement (action):** As a free user, manually call `generateCarousel(projectId, 'test', 'bold-minimal', 'stock', 5)` from devtools or by tampering — expect `{ success: false, upgradeEligible: true }` and verify no credit was deducted (check `getCreditBalance` before/after).
4. **Server enforcement (API):** With a free-tier API key, `POST /api/v1/carousel` with `slideCount: 5` — expect HTTP 400 `VALIDATION_ERROR` and no credit deducted.

Type check: `npx tsc --noEmit` clean for all three modified files.
</verification>

<success_criteria>
- Free users cannot select more than 3 slides via UI (slider max = 3).
- Free users see a padlock + upgrade link routing to `/settings/subscription`.
- Free users cannot exceed 3 slides via server action OR public API (both reject before deducting credits).
- Paid users see and experience no behavioral change (3-20 slider, no padlock, server allows up to 20).
- `CreateProjectDialog` (`?new=1`) is unmodified (no slide count there to cap).
- TypeScript compiles clean.
</success_criteria>

<output>
After completion, create `.planning/quick/260427-jwq-free-tier-cap-max-3-slides-for-free-user/260427-jwq-SUMMARY.md` summarizing files changed, the constant added, and the two new server-side rejection paths.
</output>
