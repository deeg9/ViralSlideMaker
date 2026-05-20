// Phase 81 first-run tour — canonical step definitions.
//
// D-07 contract: the coachmark in interactive-onboarding-checklist.tsx finds
// its target ONLY via `document.querySelector(step.targetSelector)` where
// targetSelector is `[data-onboarding-id="<id>"]`. Never via CSS classes,
// element IDs, or DOM-structure walks. Class names and structural selectors
// are not contracts — `data-onboarding-id` is.
//
// D-08 locked IDs (changing or adding requires editing 81-SPEC.md first):
//   topic-input, generate-button, publish-toggle
//
// quick-260520-gr3 (2026-05-20): removed the `reference-upload` step. We are
// pivoting away from references-first messaging in the post-signup tour
// (welcome dialog dropped the matching slide). If references-first returns
// later the step can be reintroduced here in a single place.
//
// Route choice: the topic-input and generate-button surfaces live inline on
// `/dashboard` (GenerationForm is mounted there). The publish-toggle lives
// inside the project editor (/project/[id]); when the user activates that
// step from /dashboard, the checklist's "Take me there" fallback resolves
// the user's most recent project id via getLatestProjectId() and routes
// to /project/<id>. If they have no projects yet, the step is auto-completed.

export const ONBOARDING_STEPS = [
  {
    id: 'topic-input',
    title: 'Type your topic',
    description: 'Describe the carousel you want — AI generates the slides.',
    route: '/dashboard',
    targetSelector: '[data-onboarding-id="topic-input"]',
  },
  {
    id: 'generate-button',
    title: 'Generate your carousel',
    description: 'Hit Generate Carousel and we deliver a ready-to-post slideshow.',
    route: '/dashboard',
    targetSelector: '[data-onboarding-id="generate-button"]',
  },
  {
    id: 'publish-toggle',
    title: 'Publish to share',
    description: 'Your carousel is public by default — open a project to flip visibility.',
    // route is /dashboard for the case where no project exists yet; the
    // "Take me there" handler resolves a real /project/<id> at click time.
    route: '/dashboard',
    targetSelector: '[data-onboarding-id="publish-toggle"]',
  },
] as const

export type OnboardingStepDef = (typeof ONBOARDING_STEPS)[number]
export type OnboardingStepId = OnboardingStepDef['id']

export function getStepById(id: OnboardingStepId): OnboardingStepDef {
  const step = ONBOARDING_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Unknown onboarding step: ${id}`)
  return step
}

export function getStepIndex(id: OnboardingStepId): number {
  return ONBOARDING_STEPS.findIndex((s) => s.id === id)
}
