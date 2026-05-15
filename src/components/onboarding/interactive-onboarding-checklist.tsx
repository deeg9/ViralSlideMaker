'use client'

// Phase 81 (R4, R5, R6): persistent bottom-right checklist card + coachmark
// overlay that spotlights the active step's target element.
//
// D-06: every motion import is from `motion/react`, NEVER `framer-motion`.
// D-07: target lookup is `document.querySelector(step.targetSelector)` where
//        targetSelector is `[data-onboarding-id="<id>"]`. No CSS classes,
//        no element IDs, no DOM-structure walks.
// D-09: if target is not in the DOM, render a centered "Take me there" panel
//        that navigates to step.route.
//
// The checklist is gated on (needsOnboarding && welcomeSeen && !isComplete).
// Mounted by the dashboard layout inside DashboardShell so it persists
// across client-side navigation between /dashboard, /style-from-reference,
// and /project/[id].

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { FocusScope } from '@radix-ui/react-focus-scope'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { useOnboarding } from './onboarding-provider'
import type { OnboardingStepDef, OnboardingStepId } from './onboarding-steps'

export function InteractiveOnboardingChecklist() {
  const {
    needsOnboarding,
    welcomeSeen,
    activeStepId,
    completedStepIds,
    isComplete,
    steps,
    startStep,
    completeStep,
    dismissActiveStep,
    skipTour,
  } = useOnboarding()

  const router = useRouter()
  const pathname = usePathname()

  const checklistVisible = needsOnboarding && welcomeSeen && !isComplete

  if (!checklistVisible) return null

  return (
    <>
      <ChecklistCard
        steps={steps}
        completedStepIds={completedStepIds}
        activeStepId={activeStepId}
        onStepClick={(step) => {
          startStep(step.id)
          if (pathname !== step.route) {
            router.push(step.route)
          }
        }}
        onSkip={skipTour}
      />
      <AnimatePresence>
        {activeStepId && (
          <CoachmarkOverlay
            key={activeStepId}
            stepId={activeStepId}
            steps={steps}
            completedStepIds={completedStepIds}
            pathname={pathname ?? ''}
            onNext={(stepId) => {
              completeStep(stepId)
              // completeStep clears activeStepId; pick next not-yet-completed step
              const nextStep = steps.find(
                (s) => s.id !== stepId && !completedStepIds.includes(s.id),
              )
              if (nextStep) {
                startStep(nextStep.id)
                if (pathname !== nextStep.route) {
                  router.push(nextStep.route)
                }
              }
              // If no next step, provider's completeStep cascade calls finishTour.
            }}
            onPrev={(stepId) => {
              const idx = steps.findIndex((s) => s.id === stepId)
              const prev = idx > 0 ? steps[idx - 1] : null
              if (prev) {
                startStep(prev.id)
                if (pathname !== prev.route) {
                  router.push(prev.route)
                }
              }
            }}
            onSkip={skipTour}
            onDismiss={dismissActiveStep}
            onNavigateToRoute={(route) => router.push(route)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

interface ChecklistCardProps {
  steps: readonly OnboardingStepDef[]
  completedStepIds: readonly OnboardingStepId[]
  activeStepId: OnboardingStepId | null
  onStepClick: (step: OnboardingStepDef) => void
  onSkip: () => void
}

function ChecklistCard({
  steps,
  completedStepIds,
  activeStepId,
  onStepClick,
  onSkip,
}: ChecklistCardProps) {
  const progressPct = (completedStepIds.length / steps.length) * 100

  return (
    <motion.aside
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 16, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed bottom-6 right-6 z-40 w-[320px] rounded-2xl bg-white shadow-2xl ring-1 ring-[#dbc1bc]/40 overflow-hidden"
      aria-label="Onboarding checklist"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-[#3d0000]">Get started</h2>
          <p className="text-[11px] text-[#7d6161]">
            {completedStepIds.length} of {steps.length} complete
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full p-1.5 hover:bg-[#fff0f0] transition-colors"
          aria-label="Skip onboarding tour"
        >
          <X className="size-4 text-[#7d6161]" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4">
        <div className="h-1 w-full rounded-full bg-[#fadbdb] overflow-hidden">
          <motion.div
            className="h-full bg-[#3d0000]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Step list */}
      <ul className="px-2 pt-3 pb-2">
        {steps.map((step) => {
          const isDone = completedStepIds.includes(step.id)
          const isActive = activeStepId === step.id
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onStepClick(step)}
                disabled={isDone}
                className={cn(
                  'w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                  isDone
                    ? 'opacity-60 cursor-default'
                    : 'hover:bg-[#fff0f0] cursor-pointer',
                  isActive && !isDone && 'bg-[#fff0f0]',
                )}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {isDone ? (
                    <CheckCircle2 className="size-5 text-[#3d0000]" aria-hidden />
                  ) : (
                    <Circle className="size-5 text-[#dbc1bc]" aria-hidden />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      isDone ? 'text-[#7d6161] line-through' : 'text-[#3d0000]',
                    )}
                  >
                    {step.title}
                  </span>
                  {!isDone && (
                    <span className="block text-[11px] text-[#7d6161] mt-0.5 truncate">
                      Tap to see how
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Footer */}
      <div className="border-t border-[#fadbdb]/40 px-4 py-2.5">
        <button
          type="button"
          onClick={onSkip}
          className="text-[11px] text-[#7d6161] hover:text-[#3d0000] transition-colors uppercase tracking-wide font-semibold"
        >
          Skip tour
        </button>
      </div>
    </motion.aside>
  )
}

interface CoachmarkOverlayProps {
  stepId: OnboardingStepId
  steps: readonly OnboardingStepDef[]
  completedStepIds: readonly OnboardingStepId[]
  pathname: string
  onNext: (stepId: OnboardingStepId) => void
  onPrev: (stepId: OnboardingStepId) => void
  onSkip: () => void
  onDismiss: () => void
  onNavigateToRoute: (route: string) => void
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

function CoachmarkOverlay({
  stepId,
  steps,
  completedStepIds,
  pathname,
  onNext,
  onPrev,
  onSkip,
  onDismiss,
  onNavigateToRoute,
}: CoachmarkOverlayProps) {
  const step = useMemo(() => steps.find((s) => s.id === stepId), [steps, stepId])
  const stepIndex = useMemo(() => steps.findIndex((s) => s.id === stepId), [steps, stepId])

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)

  // WR-04: Esc dismisses the active spotlight (clears activeStepId). The
  // overlay is not a Radix Dialog, so Radix's built-in Esc handler does
  // not apply. Skip-tour stays a separate, explicit action via the X /
  // "Skip tour" buttons; Esc is purely "close this spotlight."
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const measure = useCallback(() => {
    if (!step) return
    if (typeof document === 'undefined') return
    const target = document.querySelector(step.targetSelector)
    if (!target || !(target instanceof HTMLElement)) {
      setTargetRect(null)
      return
    }
    const rect = target.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setTargetRect(null)
      return
    }
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    })
  }, [step])

  useEffect(() => {
    measure()
    if (typeof window === 'undefined') return

    let rafHandle: number | null = null
    const scheduleMeasure = () => {
      if (rafHandle !== null) return
      rafHandle = window.requestAnimationFrame(() => {
        rafHandle = null
        measure()
      })
    }

    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('scroll', scheduleMeasure, true)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleMeasure)
      resizeObserver.observe(document.body)
    }

    // Re-measure shortly after mount in case the target lazy-renders.
    const retryTimeout = window.setTimeout(measure, 250)

    return () => {
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
      if (resizeObserver) resizeObserver.disconnect()
      if (rafHandle !== null) window.cancelAnimationFrame(rafHandle)
      window.clearTimeout(retryTimeout)
    }
  }, [measure, pathname, stepId])

  if (!step) return null

  // Compute next-not-completed for the Next button label.
  const remainingAfter = steps.filter(
    (s) => s.id !== stepId && !completedStepIds.includes(s.id),
  )
  const isLast = remainingAfter.length === 0
  const isFirst = stepIndex <= 0

  return (
    <>
      {/* Dim backdrop — pointer-events: none so the underlying app stays
          interactive. Acknowledgement-based tour: the user is not forced
          to interact with the highlighted element to advance. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[45] bg-black/40 pointer-events-none"
        aria-hidden
      />

      {targetRect ? (
        <SpotlightCoachmark
          step={step}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          targetRect={targetRect}
          isFirst={isFirst}
          isLast={isLast}
          onNext={() => onNext(stepId)}
          onPrev={() => onPrev(stepId)}
          onSkip={onSkip}
          onDismiss={onDismiss}
        />
      ) : (
        <CenteredFallbackCoachmark
          step={step}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          isFirst={isFirst}
          isLast={isLast}
          onTakeMeThere={() => onNavigateToRoute(step.route)}
          onNext={() => onNext(stepId)}
          onPrev={() => onPrev(stepId)}
          onSkip={onSkip}
          onDismiss={onDismiss}
        />
      )}
    </>
  )
}

interface SpotlightCoachmarkProps {
  step: OnboardingStepDef
  stepIndex: number
  totalSteps: number
  targetRect: TargetRect
  isFirst: boolean
  isLast: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onDismiss: () => void
}

function SpotlightCoachmark({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onSkip,
  onDismiss,
}: SpotlightCoachmarkProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tooltip = tooltipRef.current
    if (!tooltip) return

    const tw = tooltip.offsetWidth
    const th = tooltip.offsetHeight
    const margin = 16
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Preference: top → bottom → right → left. Clamp inside viewport.
    const candidates = [
      // Top
      {
        top: targetRect.top - th - margin,
        left: targetRect.left + targetRect.width / 2 - tw / 2,
      },
      // Bottom
      {
        top: targetRect.top + targetRect.height + margin,
        left: targetRect.left + targetRect.width / 2 - tw / 2,
      },
      // Right
      {
        top: targetRect.top + targetRect.height / 2 - th / 2,
        left: targetRect.left + targetRect.width + margin,
      },
      // Left
      {
        top: targetRect.top + targetRect.height / 2 - th / 2,
        left: targetRect.left - tw - margin,
      },
    ]

    const fits = (c: { top: number; left: number }) =>
      c.top >= margin &&
      c.left >= margin &&
      c.top + th <= vh - margin &&
      c.left + tw <= vw - margin

    const chosen = candidates.find(fits) ?? candidates[1]
    const clamped = {
      top: Math.max(margin, Math.min(chosen.top, vh - th - margin)),
      left: Math.max(margin, Math.min(chosen.left, vw - tw - margin)),
    }
    setTooltipPos(clamped)
  }, [targetRect])

  return (
    <>
      {/* Spotlight ring — pointer-events: none so underlying element stays clickable */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          top: targetRect.top - 6,
          left: targetRect.left - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
          pointerEvents: 'none',
          borderRadius: '14px',
          outline: '3px solid #3d0000',
          outlineOffset: '2px',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.05), 0 8px 28px rgba(61,0,0,0.25)',
          zIndex: 49,
        }}
        aria-hidden
      />

      {/* Tooltip — measured then positioned in a useEffect */}
      <motion.div
        ref={tooltipRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: tooltipPos ? 1 : 0, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          top: tooltipPos?.top ?? -9999,
          left: tooltipPos?.left ?? -9999,
          zIndex: 50,
        }}
        className="w-[300px] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-[#dbc1bc]/40"
        role="dialog"
        aria-labelledby={`coachmark-title-${step.id}`}
        tabIndex={-1}
      >
        <FocusScope trapped loop>
          <CoachmarkBody
            step={step}
            stepIndex={stepIndex}
            totalSteps={totalSteps}
            isFirst={isFirst}
            isLast={isLast}
            onNext={onNext}
            onPrev={onPrev}
            onSkip={onSkip}
            onDismiss={onDismiss}
          />
        </FocusScope>
      </motion.div>
    </>
  )
}

interface CenteredFallbackCoachmarkProps {
  step: OnboardingStepDef
  stepIndex: number
  totalSteps: number
  isFirst: boolean
  isLast: boolean
  onTakeMeThere: () => void
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onDismiss: () => void
}

function CenteredFallbackCoachmark({
  step,
  stepIndex,
  totalSteps,
  isFirst,
  isLast,
  onTakeMeThere,
  onNext,
  onPrev,
  onSkip,
  onDismiss,
}: CenteredFallbackCoachmarkProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      role="dialog"
      aria-labelledby={`coachmark-title-${step.id}`}
      tabIndex={-1}
    >
      <FocusScope trapped loop>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-[#dbc1bc]/40">
          <CoachmarkBody
            step={step}
            stepIndex={stepIndex}
            totalSteps={totalSteps}
            isFirst={isFirst}
            isLast={isLast}
            onNext={onNext}
            onPrev={onPrev}
            onSkip={onSkip}
            onDismiss={onDismiss}
            extraActions={
              <button
                type="button"
                onClick={onTakeMeThere}
                className="text-xs text-[#3d0000] hover:underline font-medium"
              >
                Take me there
              </button>
            }
          />
        </div>
      </FocusScope>
    </motion.div>
  )
}

interface CoachmarkBodyProps {
  step: OnboardingStepDef
  stepIndex: number
  totalSteps: number
  isFirst: boolean
  isLast: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onDismiss: () => void
  extraActions?: React.ReactNode
}

function CoachmarkBody({
  step,
  stepIndex,
  totalSteps,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onSkip,
  onDismiss,
  extraActions,
}: CoachmarkBodyProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#7d6161]">
            Step {stepIndex + 1} of {totalSteps}
          </p>
          <h3
            id={`coachmark-title-${step.id}`}
            className="text-base font-semibold text-[#3d0000] mt-1"
          >
            {step.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 hover:bg-[#fff0f0] transition-colors"
          aria-label="Close this step"
        >
          <X className="size-4 text-[#7d6161]" />
        </button>
      </div>

      <p className="text-sm text-[#7d6161] leading-relaxed">{step.description}</p>

      <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#fadbdb]/40">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-[#7d6161] hover:text-[#3d0000] transition-colors"
          >
            Skip tour
          </button>
          {extraActions}
        </div>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={onPrev}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#dbc1bc] text-[#3d0000] bg-white hover:bg-[#fff0f0] transition-colors text-xs font-medium"
            >
              <ChevronLeft className="size-3.5" />
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#3d0000] text-white hover:opacity-90 transition-opacity text-xs font-semibold"
          >
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ChevronRight className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
