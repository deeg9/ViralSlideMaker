'use client'

// Phase 81 first-run tour — React Context provider for in-flight tour state.
//
// D-01: React Context, NOT zustand/jotai/redux. No new state-management dep.
// D-02: Server component seeds `needsOnboarding` from
//        `profiles.onboarding_completed_at IS NULL`. The context owns only
//        the in-flight tour state (which step is active, which are done).
// D-03: No per-step DB writes. Only Skip OR full completion writes the
//        profiles.onboarding_completed_at timestamp (via the onComplete prop
//        supplied by the layout, which wires the server action).
// D-17: localStorage `onboarding_welcome_seen_at` flag is the ONE exception
//        to "no localStorage abuse" — scoped to mid-tour resume so the
//        welcome modal doesn't re-fire on reload between welcome-dismiss
//        and checklist-finish.
// D-06: any animation imports must come from `motion/react`, never
//        `framer-motion`. This file currently uses no motion at all.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ONBOARDING_STEPS,
  type OnboardingStepDef,
  type OnboardingStepId,
} from './onboarding-steps'

// User-namespaced localStorage key (CR-01 fix). The previous un-namespaced
// key 'onboarding_welcome_seen_at' would have made User B inherit User A's
// "welcome seen" state on a shared device, silently suppressing User B's
// welcome modal even though the server-derived needsOnboarding=true.
const WELCOME_SEEN_STORAGE_KEY_PREFIX = 'onboarding_welcome_seen_at:'
// Legacy un-namespaced key — cleared on first run after upgrade to avoid
// stale state from existing browsers.
const LEGACY_WELCOME_SEEN_STORAGE_KEY = 'onboarding_welcome_seen_at'

function welcomeSeenStorageKey(userId: string): string {
  return `${WELCOME_SEEN_STORAGE_KEY_PREFIX}${userId}`
}

export interface OnboardingContextValue {
  // Server-seeded
  needsOnboarding: boolean
  // localStorage-hydrated
  welcomeSeen: boolean
  // In-memory tour state
  activeStepId: OnboardingStepId | null
  completedStepIds: readonly OnboardingStepId[]
  isComplete: boolean
  // Static
  steps: readonly OnboardingStepDef[]
  // Actions
  markWelcomeSeen: () => void
  startStep: (id: OnboardingStepId) => void
  completeStep: (id: OnboardingStepId) => void
  dismissActiveStep: () => void
  skipTour: () => void
  finishTour: () => void
  resetTourState: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export interface OnboardingProviderProps {
  /** Derived in the dashboard layout from profile.onboarding_completed_at IS NULL. */
  needsOnboarding: boolean
  /**
   * Authenticated user ID used to namespace the localStorage `welcomeSeen`
   * flag (CR-01). Required: a shared device with multiple Supabase accounts
   * MUST NOT share the un-namespaced flag, otherwise User B inherits
   * User A's "welcome seen" and silently skips their welcome modal.
   */
  userId: string
  /**
   * Server-action wrapper that writes profile.onboarding_completed_at = now().
   * Wired by src/app/(dashboard)/layout.tsx → @/lib/onboarding/actions.markOnboardingComplete.
   * Any return value (server actions typically return a result tuple) is
   * ignored — the provider only cares that the action settles.
   */
  onComplete?: () => void | Promise<unknown>
  children: React.ReactNode
}

export function OnboardingProvider({
  needsOnboarding: needsOnboardingProp,
  userId,
  onComplete,
  children,
}: OnboardingProviderProps) {
  const storageKey = welcomeSeenStorageKey(userId)
  // Optimistically allow flipping needsOnboarding to false after skip/finish
  // so the welcome modal hides immediately while the server action settles.
  const [needsOnboarding, setNeedsOnboarding] = useState(needsOnboardingProp)

  // Re-sync if the server-component re-renders with a fresh value
  // (e.g. after `revalidatePath('/dashboard')` from a server action).
  useEffect(() => {
    setNeedsOnboarding(needsOnboardingProp)
  }, [needsOnboardingProp])

  // localStorage-backed welcomeSeen flag (D-17).
  const [welcomeSeen, setWelcomeSeen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      // CR-01: forget the legacy un-namespaced key once, so a user upgrading
      // from a build that wrote it does not inherit a stale "welcomeSeen"
      // value tied to a different account on the same device.
      window.localStorage.removeItem(LEGACY_WELCOME_SEEN_STORAGE_KEY)
      const value = window.localStorage.getItem(storageKey)
      setWelcomeSeen(Boolean(value))
    } catch {
      // localStorage unavailable (private mode / blocked) — keep welcomeSeen=false.
    }
  }, [storageKey])

  // In-memory tour progression. Resets on hard reload — acceptable v1 behavior
  // per D-17 (welcomeSeen survives so the modal doesn't re-fire).
  const [activeStepId, setActiveStepId] = useState<OnboardingStepId | null>(null)
  const [completedStepIds, setCompletedStepIds] = useState<readonly OnboardingStepId[]>([])

  const isComplete = useMemo(() => {
    if (completedStepIds.length < ONBOARDING_STEPS.length) return false
    return ONBOARDING_STEPS.every((step) => completedStepIds.includes(step.id))
  }, [completedStepIds])

  // WR-03: the previous implementation kept a ref of completedStepIds and
  // checked "all done" inside setTimeout(...), relying on React having
  // committed the state update before the macrotask fires. That ordering
  // is implementation-dependent in concurrent mode. The fix below uses the
  // functional setState updater to compute `next` synchronously and
  // schedules finishTour against `next` itself — no ref needed.

  const markWelcomeSeen = useCallback(() => {
    setWelcomeSeen(true)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, new Date().toISOString())
    } catch {
      // Storage unavailable — in-memory flag still flips so the welcome
      // closes for the rest of this session.
    }
  }, [storageKey])

  const startStep = useCallback((id: OnboardingStepId) => {
    setActiveStepId(id)
  }, [])

  const dismissActiveStep = useCallback(() => {
    setActiveStepId(null)
  }, [])

  const finishTour = useCallback(() => {
    setNeedsOnboarding(false)
    setActiveStepId(null)
    void onComplete?.()
  }, [onComplete])

  const skipTour = useCallback(() => {
    // Skipping marks complete in the DB but does NOT touch the welcomeSeen
    // flag — the user explicitly opted out, so subsequent reloads also
    // see needsOnboarding=false from the server and nothing fires.
    setNeedsOnboarding(false)
    setActiveStepId(null)
    void onComplete?.()
  }, [onComplete])

  const completeStep = useCallback(
    (id: OnboardingStepId) => {
      setCompletedStepIds((prev) => {
        const next = prev.includes(id) ? prev : [...prev, id]
        // WR-03: decide "all done" against the synchronously-computed
        // next array — no setTimeout/ref dependency on React commit
        // ordering. queueMicrotask schedules finishTour AFTER this
        // updater returns and React commits the new state, but
        // BEFORE the next paint, so the checklist re-renders with
        // isComplete=true once before the tour unmounts.
        if (ONBOARDING_STEPS.every((step) => next.includes(step.id))) {
          queueMicrotask(() => finishTour())
        }
        return next
      })
      setActiveStepId(null)
    },
    [finishTour],
  )

  const resetTourState = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey)
        // Defensive: legacy key should already be gone, but a tab that
        // never ran the mount-time cleanup could still hold it.
        window.localStorage.removeItem(LEGACY_WELCOME_SEEN_STORAGE_KEY)
      } catch {
        // ignore
      }
    }
    setWelcomeSeen(false)
    setActiveStepId(null)
    setCompletedStepIds([])
    setNeedsOnboarding(true)
  }, [storageKey])

  const value = useMemo<OnboardingContextValue>(
    () => ({
      needsOnboarding,
      welcomeSeen,
      activeStepId,
      completedStepIds,
      isComplete,
      steps: ONBOARDING_STEPS,
      markWelcomeSeen,
      startStep,
      completeStep,
      dismissActiveStep,
      skipTour,
      finishTour,
      resetTourState,
    }),
    [
      needsOnboarding,
      welcomeSeen,
      activeStepId,
      completedStepIds,
      isComplete,
      markWelcomeSeen,
      startStep,
      completeStep,
      dismissActiveStep,
      skipTour,
      finishTour,
      resetTourState,
    ],
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboarding must be used within <OnboardingProvider>')
  }
  return ctx
}
