// Phase 81 first-run tour — canonical step definitions.
//
// D-07 contract: the coachmark in interactive-onboarding-checklist.tsx finds
// its target ONLY via `document.querySelector(step.targetSelector)` where
// targetSelector is `[data-onboarding-id="<id>"]`. Never via CSS classes,
// element IDs, or DOM-structure walks. Class names and structural selectors
// are not contracts — `data-onboarding-id` is.
//
// D-08 locked IDs (changing or adding requires editing 81-SPEC.md first):
//   reference-upload, topic-input, generate-button, publish-toggle
//
// Route choice: the reference-upload, topic-input, and generate-button
// surfaces all live inline on `/dashboard` today — GenerationForm embeds
// <StyleFromReferenceShell> via a collapsible "Copy style" section, and the
// large "Generate Carousel" submit is on the same form. CONTEXT.md D-11
// described `/style-from-reference` as a separate route; the codebase moved
// that flow inline. If a dedicated route returns later, only this file
// changes (single source of truth for tour routing).
//
// The publish-toggle lives inside the project editor (/project/[id]). When
// the user is on /dashboard and activates that step, the coachmark falls
// back to its centered "Take me there" panel per D-09 — acceptable v1
// behavior.

export const ONBOARDING_STEPS = [
  {
    id: 'reference-upload',
    title: 'Upload a reference image',
    description: 'Pick a slideshow you like — we will mimic its visual style.',
    route: '/dashboard',
    targetSelector: '[data-onboarding-id="reference-upload"]',
  },
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
