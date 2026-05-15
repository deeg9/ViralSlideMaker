---
phase: 81-first-run-onboarding-tour
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/settings/profile/page.tsx
  - src/components/dashboard/reference-image-uploader.tsx
  - src/components/editor/visibility-dropdown.tsx
  - src/components/onboarding/first-run-welcome-dialog.tsx
  - src/components/onboarding/interactive-onboarding-checklist.tsx
  - src/components/onboarding/onboarding-provider.tsx
  - src/components/onboarding/onboarding-steps.ts
  - src/components/slides/generation-form.tsx
  - src/components/ui/dialog.tsx
  - src/lib/onboarding/actions.ts
  - supabase/migrations/20260515_v213_phase81_profiles_onboarding_completed_at.sql
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: findings_found
---

# Phase 81: Code Review Report

**Reviewed:** 2026-05-15
**Depth:** standard
**Files Reviewed:** 13 (Phase 81 scope)
**Status:** findings_found

## Summary

Phase 81 implements a first-run onboarding tour: a 4-slide welcome modal + persistent cross-route coachmark checklist, gated by `profiles.onboarding_completed_at`. The implementation is structurally sound — server actions are properly authenticated, the migration is atomic per Postgres implicit transactions, the `data-onboarding-id` selector contract (D-07) is honored, and Radix Dialog provides focus trap + Esc handling for the welcome modal. The OnboardingProvider correctly remounts per dashboard layout (no cross-user state leak risk).

Two correctness bugs put the tour at risk of failing its SPEC acceptance criteria, both centered on the `welcomeSeen` localStorage flag added under D-17. The flag is shared across user accounts on a device (no user-ID namespace), and it is never cleared on tour restart. The first defeats SPEC R2 in multi-user device scenarios; the second defeats SPEC R7 directly. Five warnings cover a duplicate profile fetch in the dashboard page (SPEC constraint violation), unsafe Supabase `error.message` propagation, a potentially-stale ref read in `completeStep`'s `setTimeout`, a missing Esc keybinding on the coachmark overlay, and an unmounted-component setState risk after restart.

## Critical Issues

### CR-01: `welcomeSeen` localStorage key is not user-namespaced — second user on shared device skips welcome modal

**File:** `src/components/onboarding/onboarding-provider.tsx:35`
**Issue:** `WELCOME_SEEN_STORAGE_KEY = 'onboarding_welcome_seen_at'` is a fixed string with no user-ID component. If User A completes the welcome modal (or clicks "Get Started") on a device, the key is written with no user scope. When User A signs out and User B (who has `onboarding_completed_at IS NULL` in the DB) signs in on the same browser, the provider's mount-time `useEffect` reads the existing localStorage value, sets `welcomeSeen=true`, and the welcome modal computes `isOpen = needsOnboarding && !welcomeSeen → false` — User B never sees the modal even though the server-derived `needsOnboarding` is true. SPEC R2 acceptance ("Manual test — set a test user's `onboarding_completed_at` to NULL, visit `/dashboard`, modal appears") fails on any shared/multi-account device. The prompt explicitly called this out.

**Fix:**
```ts
// Namespace by user ID — accept userId as a prop from the layout (which has it from supabase.auth.getUser()).
export interface OnboardingProviderProps {
  needsOnboarding: boolean
  userId: string                       // NEW: required prop
  onComplete?: () => void | Promise<unknown>
  children: React.ReactNode
}

const WELCOME_SEEN_STORAGE_KEY_PREFIX = 'onboarding_welcome_seen_at:'

// ...
const storageKey = `${WELCOME_SEEN_STORAGE_KEY_PREFIX}${userId}`
useEffect(() => {
  if (typeof window === 'undefined') return
  try {
    setWelcomeSeen(Boolean(window.localStorage.getItem(storageKey)))
  } catch {}
}, [storageKey])
```

Then update `markWelcomeSeen` and `resetTourState` to use `storageKey` (and also remove the old un-namespaced key on first run if found, to migrate forward without re-firing for any user who already completed). Pass `userId={user.id}` from `(dashboard)/layout.tsx`.

### CR-02: Restart-onboarding flow does not clear `welcomeSeen` localStorage — modal never re-fires (SPEC R7 violation)

**File:** `src/lib/onboarding/actions.ts:44-67` (server action), `src/app/(dashboard)/settings/profile/page.tsx:40-50` (caller)
**Issue:** SPEC R7 acceptance requires "user with `onboarding_completed_at` set clicks Restart, lands on `/dashboard`, modal appears." `restartOnboarding()` correctly NULLs the column, and the profile page navigates to `/dashboard`. However, the navigation from `/settings/profile` to `/dashboard` does NOT remount `(dashboard)/layout.tsx` (same route group), so the `OnboardingProvider` stays mounted, the mount-time `useEffect` does NOT re-run, and `welcomeSeen` remains `true` from the prior completed tour. The welcome modal evaluates `isOpen = needsOnboarding && !welcomeSeen` → `true && !true` → `false`. The modal does not re-appear. The provider exports `resetTourState()` which would clear localStorage, but nothing calls it from the restart path.

**Fix:** Two clean options — either is acceptable.

Option A (recommended) — clear localStorage on the client before navigating in the profile page:
```ts
function handleRestartTour() {
  setMessage(null)
  startRestartTour(async () => {
    const result = await restartOnboarding()
    if (!result.success) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    // Clear the mid-tour resume flag so the welcome modal re-fires on /dashboard.
    try {
      // If CR-01 is also fixed, use the user-namespaced key here.
      window.localStorage.removeItem('onboarding_welcome_seen_at')
    } catch {}
    router.push('/dashboard')
  })
}
```

Option B — have `OnboardingProvider` re-hydrate `welcomeSeen` whenever `needsOnboardingProp` flips from `false` to `true`:
```ts
useEffect(() => {
  setNeedsOnboarding(needsOnboardingProp)
  // When the server tells us the user needs onboarding again (post-restart),
  // re-read localStorage in case another tab/path cleared it, AND clear our own
  // welcomeSeen flag so the welcome modal can re-fire.
  if (needsOnboardingProp && typeof window !== 'undefined') {
    try { window.localStorage.removeItem(WELCOME_SEEN_STORAGE_KEY) } catch {}
    setWelcomeSeen(false)
  }
}, [needsOnboardingProp])
```

Option A is more explicit. Option B is more centralized but adds a side effect to every server-prop sync.

## Warnings

### WR-01: `dashboard/page.tsx` duplicates the `profiles` fetch from `(dashboard)/layout.tsx` — SPEC constraint violation

**File:** `src/app/(dashboard)/dashboard/page.tsx:18-19`
**Issue:** SPEC.md "Constraints" section explicitly states: *"The dashboard server component already reads `profiles` (line 16–19 of `dashboard/page.tsx`); add `onboarding_completed_at` to the existing `.select(...)` query rather than a separate round-trip."* The implementation added `onboarding_completed_at` to the LAYOUT's profile fetch (line 26 of `layout.tsx`) and left the dashboard page's separate `profiles.select('display_name')` round-trip in place. Both run on every dashboard render, costing an extra DB query per page load. The layout now has the full `{ username, display_name, onboarding_completed_at }`; the page should drop its own fetch and lift the `userName` derivation up (or accept it via props from a layout-level helper).

**Fix:** Remove the standalone `profiles.select('display_name')` in `dashboard/page.tsx` (lines 18-19) and derive `userName` either from the user object alone (`user.user_metadata.first_name || user.email?.split('@')[0]`) or by exposing the layout's already-fetched `userName` (e.g., via React Context or a server-only helper). The current double-fetch costs ~one extra round-trip per `/dashboard` render.

### WR-02: Supabase `error.message` returned raw to the client — minor info leak

**File:** `src/lib/onboarding/actions.ts:37, 61`
**Issue:** Both `markOnboardingComplete` and `restartOnboarding` return `error.message` directly from Supabase if the UPDATE fails. Supabase / PostgREST error messages can include constraint names, column hints, or RLS policy names that leak internal schema details to the client. Pre-PMF the impact is low, but the SPEC's "Public-by-default invariant" memory rule shows the project cares about defense-in-depth on what crosses the trust boundary.

**Fix:**
```ts
if (error) {
  console.error('[onboarding/markOnboardingComplete] supabase update failed:', error)
  return { success: false, error: 'Failed to update onboarding state' }
}
```

### WR-03: `completeStep`'s `setTimeout(..., 0)` reads `completedRef.current` that may not yet reflect the just-queued setState

**File:** `src/components/onboarding/onboarding-provider.tsx:150-166`
**Issue:** `completeStep` queues `setCompletedStepIds([...prev, id])`, then schedules `setTimeout(() => { ... ONBOARDING_STEPS.every(s => completedRef.current.includes(s.id)) ... }, 0)`. The ref is assigned during render via `completedRef.current = completedStepIds` (line 114). In React 18 auto-batching mode the setState typically commits before the macrotask fires, so the ref is updated in time — but this relies on React's commit-then-macrotask ordering and concurrent-mode interleaving could (per the React team's guidance) re-order updates. The classic "completion never fires" symptom would be: user clicks Next on the final step → `completeStep` runs → setTimeout reads stale ref (still missing the last id) → `all` is false → `finishTour()` is not called → checklist appears stuck in a "Finish" state with no progression.

**Fix:** Compute the next state synchronously inside the updater and decide there:
```ts
const completeStep = useCallback((id: OnboardingStepId) => {
  setCompletedStepIds((prev) => {
    if (prev.includes(id)) return prev
    const next = [...prev, id]
    // Defer finishTour to a microtask so the state update commits first,
    // but pass the computed `next` so we don't depend on a ref.
    if (ONBOARDING_STEPS.every((step) => next.includes(step.id))) {
      queueMicrotask(() => finishTour())
    }
    return next
  })
  setActiveStepId(null)
}, [finishTour])
```

The `completedRef` is then no longer needed for this call site.

### WR-04: Coachmark overlay has no Esc key handler — keyboard users cannot dismiss the spotlight

**File:** `src/components/onboarding/interactive-onboarding-checklist.tsx:247-369`
**Issue:** The welcome modal uses Radix Dialog (focus trap + Esc handled automatically), but the coachmark overlay is a custom `motion.div` portal with `role="dialog"` (line 488, 539) and no keyboard listener. Pressing Esc while a coachmark is active does nothing; the only dismiss path is clicking the small X button. SPEC acceptance ("No console errors during the full happy-path tour") passes, but keyboard accessibility is degraded. Note the backdrop also has `pointer-events: none` (intentional per the "underlying app stays interactive" comment) so clicking the backdrop also does not dismiss.

**Fix:** Add a key handler at the overlay level:
```ts
useEffect(() => {
  if (typeof window === 'undefined') return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onDismiss()
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [onDismiss])
```

Add inside `CoachmarkOverlay` so each active step gets the listener. Document that Esc *dismisses the current spotlight* (clears `activeStepId`) but does NOT skip the entire tour — Skip remains the dedicated full-skip control.

### WR-05: Profile page `handleRestartTour` may call `setMessage` after navigation unmounts the component

**File:** `src/app/(dashboard)/settings/profile/page.tsx:42-49`
**Issue:** `startRestartTour(async () => { const result = await restartOnboarding(); if (result.success) router.push('/dashboard'); else setMessage(...) })`. If `router.push` triggers unmount before `setMessage` (in the error branch), React logs a "Can't perform a state update on an unmounted component" warning. Low-probability path (only fires on error) but worth tightening. Note that `useTransition`'s pending state should be safe across unmounts.

**Fix:** Guard with a mounted ref:
```ts
const mountedRef = useRef(true)
useEffect(() => () => { mountedRef.current = false }, [])

function handleRestartTour() {
  setMessage(null)
  startRestartTour(async () => {
    const result = await restartOnboarding()
    if (!result.success) {
      if (mountedRef.current) setMessage({ type: 'error', text: result.error })
      return
    }
    router.push('/dashboard')
  })
}
```

## Info

### IN-01: Type assertion `(profile as { onboarding_completed_at?: string | null } | null)` works around missing generated types

**File:** `src/app/(dashboard)/layout.tsx:45-46`
**Issue:** The migration added `profiles.onboarding_completed_at` but Supabase-generated types in the repo haven't been regenerated, so the layout casts the row to a partial inline type. This works at runtime but defeats type safety — a future rename of the column would not surface here.

**Fix:** Regenerate Supabase types after the migration applies, e.g.:
```bash
npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
```
Then drop the inline cast and rely on the regenerated `Database['public']['Tables']['profiles']['Row']`. If type regen is out of scope for this phase, add a TODO comment naming the follow-up.

### IN-02: `Link` import unused in `dashboard/page.tsx`

**File:** `src/app/(dashboard)/dashboard/page.tsx:1`
**Issue:** `import Link from 'next/link'` is at the top but `Link` is not referenced anywhere in the rendered JSX (only `<ProjectList>`, `<Icon>`, `<UpgradePrompt>`, and `<FirstRunWelcomeDialog>` are used). Dead import.

**Fix:** Remove the `import Link from 'next/link'` line.

### IN-03: `resetTourState` is exported on the context but never wired

**File:** `src/components/onboarding/onboarding-provider.tsx:168-180`
**Issue:** The provider exposes `resetTourState` (clears localStorage, resets in-memory state, flips `needsOnboarding` to true). No consumer in Phase 81 calls it — `FirstRunWelcomeDialog`, `InteractiveOnboardingChecklist`, and the profile page all use `skipTour` / `finishTour` / direct server actions. If wired into the restart flow it would also fix CR-02. Either remove it or wire it.

**Fix:** Wire `resetTourState` into the restart path (would also resolve CR-02 — see Option B of CR-02 fix); or remove it from the interface to keep the API surface minimal. If kept, add a JSDoc comment naming the intended call site so future maintainers don't think it's load-bearing.

### IN-04: Magic color literals duplicated across components

**File:** `src/components/onboarding/first-run-welcome-dialog.tsx` (multiple lines), `src/components/onboarding/interactive-onboarding-checklist.tsx` (multiple lines), `src/components/ui/dialog.tsx:28, 71, 108, 120`
**Issue:** Brand color hexes (`#3d0000`, `#7d6161`, `#fff0f0`, `#fadbdb`, `#dbc1bc`) are inlined throughout. Project uses Tailwind tokens elsewhere; CONTEXT.md notes `bg-primary`/`text-primary-foreground` tokens exist. Out-of-v1-scope per review rules (style preference, not a bug), but a future palette tweak will require touching every file.

**Fix:** Extend `tailwind.config.ts` with named brand tokens (`onboarding-bg`, `onboarding-fg`, etc.) or reuse existing primary tokens. Defer to a follow-up if not already on the roadmap.

---

_Reviewed: 2026-05-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
