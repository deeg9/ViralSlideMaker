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
  useRef,
  useState,
} from 'react'

import {
  ONBOARDING_STEPS,
  type OnboardingStepDef,
  type OnboardingStepId,
} from './onboarding-steps'

const WELCOME_SEEN_STORAGE_KEY = 'onboarding_welcome_seen_at'

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
   * Server-action wrapper that writes profile.onboarding_completed_at = now().
   * Wired by src/app/(dashboard)/layout.tsx → @/lib/onboarding/actions.markOnboardingComplete.
   */
  onComplete?: () => void | Promise<void>
  children: React.ReactNode
}

export function OnboardingProvider({
  needsOnboarding: needsOnboardingProp,
  onComplete,
  children,
}: OnboardingProviderProps) {
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
      const value = window.localStorage.getItem(WELCOME_SEEN_STORAGE_KEY)
      setWelcomeSeen(Boolean(value))
    } catch {
      // localStorage unavailable (private mode / blocked) — keep welcomeSeen=false.
    }
  }, [])

  // In-memory tour progression. Resets on hard reload — acceptable v1 behavior
  // per D-17 (welcomeSeen survives so the modal doesn't re-fire).
  const [activeStepId, setActiveStepId] = useState<OnboardingStepId | null>(null)
  const [completedStepIds, setCompletedStepIds] = useState<readonly OnboardingStepId[]>([])

  const isComplete = useMemo(() => {
    if (completedStepIds.length < ONBOARDING_STEPS.length) return false
    return ONBOARDING_STEPS.every((step) => completedStepIds.includes(step.id))
  }, [completedStepIds])

  // Keep a ref so callbacks scheduled via setTimeout / .then() see the
  // latest completedStepIds without stale-closure bugs.
  const completedRef = useRef(completedStepIds)
  completedRef.current = completedStepIds

  const markWelcomeSeen = useCallback(() => {
    setWelcomeSeen(true)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, new Date().toISOString())
    } catch {
      // Storage unavailable — in-memory flag still flips so the welcome
      // closes for the rest of this session.
    }
  }, [])

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
      setCompletedStepIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      setActiveStepId(null)

      // If this completion finishes the whole tour, schedule finishTour on
      // the next tick so consumers re-render with isComplete=true once
      // before the tour unmounts.
      setTimeout(() => {
        const all = ONBOARDING_STEPS.every((step) =>
          completedRef.current.includes(step.id),
        )
        if (all) finishTour()
      }, 0)
    },
    [finishTour],
  )

  const resetTourState = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(WELCOME_SEEN_STORAGE_KEY)
      } catch {
        // ignore
      }
    }
    setWelcomeSeen(false)
    setActiveStepId(null)
    setCompletedStepIds([])
    setNeedsOnboarding(true)
  }, [])

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
