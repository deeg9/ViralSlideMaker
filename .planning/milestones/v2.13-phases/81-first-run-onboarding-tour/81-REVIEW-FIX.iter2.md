---
phase: 81-first-run-onboarding-tour
fixed_at: 2026-05-15T00:00:00Z
review_path: .planning/phases/81-first-run-onboarding-tour/81-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 81: Code Review Fix Report

**Fixed at:** 2026-05-15
**Source review:** `.planning/phases/81-first-run-onboarding-tour/81-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 7
- Fixed: 6
- Skipped: 1

The CR-02 fix also incidentally resolved IN-03 (`resetTourState` was previously dead code; the restart-tour path now wires it) and WR-05 (mountedRef guard rolled into the same edit). IN-02 (unused `Link` import in `dashboard/page.tsx`) was incidentally fixed and then reverted along with WR-01 (see Skipped Issues).

## Fixed Issues

### CR-01: User-namespace the `welcomeSeen` localStorage key

**Files modified:** `src/components/onboarding/onboarding-provider.tsx`, `src/app/(dashboard)/layout.tsx`
**Commit:** `105180a`
**Applied fix:** Replaced the fixed `WELCOME_SEEN_STORAGE_KEY = 'onboarding_welcome_seen_at'` with a per-user `welcomeSeenStorageKey(userId)` helper that produces `onboarding_welcome_seen_at:<userId>`. Added a required `userId: string` prop to `OnboardingProvider` and wired `user.id` from the dashboard layout. The mount-time `useEffect` now reads the namespaced key and unconditionally clears the legacy un-namespaced key once so existing browsers upgrade forward without cross-user leak. `markWelcomeSeen` and `resetTourState` use the new namespaced key. Verified: `npx tsc --noEmit` reports zero errors in either modified file.

### CR-02: Clear `welcomeSeen` on tour restart so the modal re-fires

**Files modified:** `src/app/(dashboard)/settings/profile/page.tsx`
**Commit:** `2c7f8f7`
**Applied fix:** `handleRestartTour` now pulls `resetTourState` from `useOnboarding()` and calls it immediately after `restartOnboarding()` succeeds, before `router.push('/dashboard')`. This clears the user-namespaced `welcomeSeen` localStorage key and resets in-memory tour state, so the welcome modal re-evaluates `isOpen = needsOnboarding && !welcomeSeen` as `true && true → true` on the next dashboard render. SPEC R7 acceptance ("user with `onboarding_completed_at` set clicks Restart, lands on `/dashboard`, modal appears") is now satisfied. This same commit also addresses WR-05 (mounted-ref guard around `setMessage`) and incidentally retires IN-03 (`resetTourState` is no longer dead code).

### WR-02: Redact Supabase `error.message` in server-action responses

**Files modified:** `src/lib/onboarding/actions.ts`
**Commit:** `c143d75`
**Applied fix:** Both `markOnboardingComplete` and `restartOnboarding` now return generic messages (`'Failed to update onboarding state'`, `'Failed to restart onboarding tour'`) and `console.error` the underlying Supabase / PostgREST error server-side so diagnostics survive without crossing the trust boundary. Verified: tsc clean.

### WR-03: Compute completion in the setState updater, drop the stale ref

**Files modified:** `src/components/onboarding/onboarding-provider.tsx`
**Commit:** `b089c47`
**Applied fix:** Replaced the `setTimeout(..., 0)` + `completedRef` pattern with a functional updater. `setCompletedStepIds` computes `next` synchronously, evaluates `ONBOARDING_STEPS.every((s) => next.includes(s.id))` against that newly-computed array, and schedules `finishTour()` via `queueMicrotask` if all steps are present. The `useRef` import is removed along with the now-unused ref binding. This fix requires human verification per the logic-bug clause of the verification strategy: the completion-cascade timing is observably correct under React 18 auto-batching, but the original implementation's symptom (completion never fires) was theoretical and not reproduced — a quick happy-path manual test is recommended before phase verification signs off.

### WR-04: Esc key dismisses the active coachmark spotlight

**Files modified:** `src/components/onboarding/interactive-onboarding-checklist.tsx`
**Commit:** `63f46de`
**Applied fix:** Added a window-level `keydown` listener inside `CoachmarkOverlay` that calls `onDismiss()` on `Escape`. Keyboard users can now close the spotlight without reaching for the small X button. Per the fix-comment in the code, Esc is purely "close this spotlight" — the explicit Skip-tour controls remain the only way to mark the whole tour skipped, matching the SPEC's distinction between dismissing a step and abandoning the tour.

### WR-05: Mounted-ref guard prevents setState on unmounted component after restart navigation

**Files modified:** `src/app/(dashboard)/settings/profile/page.tsx`
**Commit:** `2c7f8f7` (rolled into the CR-02 commit because both edits target the same `handleRestartTour` flow)
**Applied fix:** Added a `mountedRef` initialized to `true` and flipped to `false` in a cleanup effect. The error branch of `handleRestartTour` now guards `setMessage` behind `mountedRef.current`. Low-probability path (error branch only) but eliminates the React unmounted-component warning entirely.

## Skipped Issues

### WR-01: Duplicate `profiles` fetch in `dashboard/page.tsx`

**File:** `src/app/(dashboard)/dashboard/page.tsx:18-19`
**Reason:** code context differs from review — fix would introduce a regression. The duplicate `profiles.select('display_name')` round-trip in `dashboard/page.tsx` is PRE-EXISTING baseline behavior (present in commit `0763140` before Phase 81 started), not introduced by Phase 81. Phase 81 added `onboarding_completed_at` to the LAYOUT's pre-existing select rather than to the page's. The SPEC constraint at line 83 (*"add `onboarding_completed_at` to the existing `.select(...)` query rather than a separate round-trip"*) was technically violated, but the actual round-trip count is unchanged from the pre-phase baseline: both the layout's select and the page's select were already running.

Removing the page's `profile.display_name` read would change behavior for any user whose `profiles.display_name` differs from `auth.user_metadata.first_name` — losing the custom display name in the dashboard header. That's an unrelated correctness regression. The correct cleanup is a separate refactor (pass the layout's already-fetched display name down via React Context or a server-only helper), which is out of scope for a code-review-fix pass.

Recommendation for the human reviewer: log a follow-up `chore` task to fold the layout's profile fetch into the page or vice versa, but do NOT take this fix as part of Phase 81 ship.

**Original issue:** "SPEC.md 'Constraints' section explicitly states: *'The dashboard server component already reads `profiles` (line 16–19 of `dashboard/page.tsx`); add `onboarding_completed_at` to the existing `.select(...)` query rather than a separate round-trip.'* The implementation added `onboarding_completed_at` to the LAYOUT's profile fetch and left the dashboard page's separate `profiles.select('display_name')` round-trip in place."

## Verification

After all fixes, `npx tsc --noEmit` was run. All TypeScript errors reported are in pre-existing `__tests__/` files (unrelated Mock/Procedure issues across api-keys, auth/logout, auth/middleware, auth/signup, projects/crud, stripe/sync-subscription, slide-editor.treatment-sync, audit-log, projects-delete — none of which were touched by Phase 81 or by this fix pass). Zero TypeScript errors were introduced in any of the modified files:

- `src/components/onboarding/onboarding-provider.tsx`
- `src/components/onboarding/interactive-onboarding-checklist.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/settings/profile/page.tsx`
- `src/lib/onboarding/actions.ts`

---

_Fixed: 2026-05-15_
_Fixer: Claude (gsd-code-fixer, inline)_
_Iteration: 1_
