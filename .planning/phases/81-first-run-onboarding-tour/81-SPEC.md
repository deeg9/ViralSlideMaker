# Phase 81: First-Run Onboarding Tour — Specification

**Created:** 2026-05-15
**Ambiguity score:** 0.15 (gate: ≤ 0.20)
**Requirements:** 7 locked

## Goal

A first-time signed-in user lands on `/dashboard`, sees a 4-slide welcome modal, then advances through a cross-route interactive coachmark checklist that spotlights the 4 key product surfaces (reference uploader, topic input, generate button, publish toggle); skipping OR completing all steps marks `profiles.onboarding_completed_at` so the flow never auto-fires again for that user.

## Background

The product is pre-PMF (~50 users as of v2.8; v2.13 Style-from-Reference Generation shipped 2026-05-14). There is no first-run experience today: a newly signed-up user lands on `/dashboard` (`src/app/(dashboard)/dashboard/page.tsx`) and sees the project grid + upgrade prompt with no guidance on what to do first. The 4 key surfaces the user must reach to experience the "aha" moment span 2+ routes: reference uploader at `/style-from-reference` (recently polished as `quick-260515-iu1`), topic/prompt input on `/dashboard`, generate action on `/style-from-reference`, publish toggle inside the project editor.

A pre-existing `/onboarding/username` route (`src/app/(auth)/onboarding/username/page.tsx`) handles username claim during auth — this is a DIFFERENT flow and must not be conflated. The phase introduces a separate "first-run tour" concept, not a generic re-use of the `/onboarding` namespace.

Relevant installed deps: `motion@^12.38.0`, `@radix-ui/react-label@^2.1.8`, `@radix-ui/react-switch@^1.2.6`, `lucide-react@^1.14.0`. Missing deps that this phase will introduce: `embla-carousel-react` (welcome modal carousel) and `@radix-ui/react-dialog` (modal primitive). Existing UI primitives in `src/components/ui/`: `button.tsx`, `card.tsx`, `label.tsx`, `icon.tsx`. Missing primitives that may be required: `badge`, `switch`, `dialog`.

## Requirements

1. **Persistence column**: A `profiles.onboarding_completed_at timestamptz` column exists and gates whether the tour auto-fires.
   - Current: No `onboarding_completed_at` column on `profiles`. No DB-level signal for whether a user has seen the tour.
   - Target: New nullable `onboarding_completed_at timestamptz` column on `profiles`. Set to `now()` when the user skips OR completes the welcome modal + all checklist steps. The migration MUST backfill all existing rows to a non-null timestamp (e.g., `now()` at migration time) so the ~50 current users never see the tour.
   - Acceptance: `SELECT count(*) FROM profiles WHERE onboarding_completed_at IS NULL` returns 0 immediately after migration applied. New profile rows created after migration default to NULL until tour completion writes a value.

2. **Auto-fire gate**: The welcome modal auto-opens on `/dashboard` if and only if the signed-in user has `onboarding_completed_at IS NULL`.
   - Current: No tour exists; dashboard never auto-displays first-run UI.
   - Target: `/dashboard` server component reads `profiles.onboarding_completed_at` for the current user and passes a boolean prop to a client component that renders the welcome modal only when the flag is NULL.
   - Acceptance: Manual test — set a test user's `onboarding_completed_at` to NULL, visit `/dashboard`, modal appears. Set it to any timestamp, visit `/dashboard`, modal does not appear.

3. **Welcome modal — 4 slides, product-themed**: A modal carousel with 4 slides plays before the coachmark tour, with product-specific copy and placeholder SVG visuals (real screenshots ship in a follow-up quick task).
   - Current: No welcome modal exists.
   - Target: A new `<FirstRunWelcomeDialog />` component built on `@radix-ui/react-dialog` + `embla-carousel-react`. Slides: (1) Welcome to TikTok Slideshow Creator, (2) Upload references → mimic any style, (3) Type a topic → AI generates copy, (4) Publish to share. Each slide uses the placeholder-SVG pattern from the supplied design with TikTok-carousel-product copy. Buttons: Back / Skip (closes + marks completed) / Next (advances) / Get Started on slide 4 (closes + advances to checklist).
   - Acceptance: Modal renders 4 distinct slides with product-specific titles. Back is hidden on slide 1. "Get Started" replaces "Next" only on slide 4. Skip on any slide closes the modal AND writes `onboarding_completed_at`. Dots indicate active slide.

4. **Cross-route coachmark checklist with persistence**: An `<InteractiveOnboardingChecklist />` component renders as a fixed bottom-right card and persists across route navigation; clicking a step navigates the user to that step's route and spotlights the target element.
   - Current: No checklist or coachmark UI exists; no global state for in-progress onboarding.
   - Target: A persistent client-side state store (Zustand or React Context provider mounted at `(dashboard)/layout.tsx` level) holds: `{ activeStepId, completedStepIds[] }`. The checklist card mounts at the dashboard layout (so it survives navigation between `/dashboard`, `/style-from-reference`, and project editor routes). Clicking a step calls `router.push(targetRoute)` then sets `activeStepId` once the route mounts. The coachmark overlay reads `activeStepId` and spotlights the element matching that step's `data-onboarding-id` selector.
   - Acceptance: With tour active, clicking step "Reference uploader" navigates from `/dashboard` to `/style-from-reference` and the uploader card receives the spotlight ring. Manual page reload during the tour resumes at `activeStepId` (state survives reload via persisted store, OR re-derives from `completedStepIds` server-side).

5. **Stable selectors on 4 spotlight targets**: The 4 spotlight targets gain `data-onboarding-id` attributes that the coachmark queries instead of CSS class/structural selectors.
   - Current: The 4 target elements (reference uploader card, topic/prompt input, generate button, publish toggle) have no stable identifier for external querying. CSS classes and DOM structure are not contracts.
   - Target: Each of the 4 elements receives a `data-onboarding-id="<step-id>"` attribute. The coachmark component queries `[data-onboarding-id="step-id"]`, never structural selectors. The 4 step IDs are: `reference-upload`, `topic-input`, `generate-button`, `publish-toggle`.
   - Acceptance: `git grep "data-onboarding-id"` returns exactly 4 production source matches (plus tests). The 4 target elements are queryable via `document.querySelector('[data-onboarding-id="<id>"]')` in a Playwright/manual smoke test.

6. **Step completion semantics**: Either skipping the tour OR clicking through all 4 checklist steps marks the user complete; performing the actual action (uploading, generating, etc.) is NOT required.
   - Current: No completion concept exists.
   - Target: The checklist treats a step as "complete" when the user clicks Next on its coachmark (acknowledgement-based, not action-based). Skip button on the checklist card OR the modal closes the entire flow and writes `onboarding_completed_at`. Completing all 4 steps writes `onboarding_completed_at` and dismisses the checklist.
   - Acceptance: Clicking through 4 steps without uploading anything sets `onboarding_completed_at` to a non-null timestamp. Clicking Skip at any point sets `onboarding_completed_at` to a non-null timestamp. Subsequent visits to `/dashboard` do not re-show the tour.

7. **Manual restart entry point**: A user can re-trigger the tour after completion from a known surface (settings page).
   - Current: No restart mechanism exists (no tour to restart).
   - Target: `/settings/profile` (or a clearly-labeled adjacent settings page) gets a "Restart onboarding tour" button. Clicking it sets `onboarding_completed_at = NULL` and redirects to `/dashboard`, which re-fires the welcome modal.
   - Acceptance: Manual test — user with `onboarding_completed_at` set clicks Restart, lands on `/dashboard`, modal appears. The user's `onboarding_completed_at` is NULL after the click and non-NULL again after they finish/skip.

## Boundaries

**In scope:**
- Supabase migration: `profiles.onboarding_completed_at timestamptz` column + backfill for existing rows.
- Two new client components: `<FirstRunWelcomeDialog />` (4-slide modal carousel) and `<InteractiveOnboardingChecklist />` (4-step checklist + coachmark overlay).
- Global onboarding state provider mounted at the dashboard layout level so the checklist survives cross-route navigation.
- `data-onboarding-id` attributes added to the 4 target elements (reference uploader, topic input, generate button, publish toggle).
- Server-side read of `onboarding_completed_at` in `/dashboard` and pass-down to gate the modal.
- "Restart onboarding tour" button on a settings page.
- New deps: `embla-carousel-react`, `@radix-ui/react-dialog`. Optional shadcn primitives `badge`, `switch`, `dialog` added to `src/components/ui/` if not already present.
- Placeholder SVG visuals matching the pattern in the supplied welcome-modal design (4 distinct placeholder images).

**Out of scope:**
- Real product screenshots in the welcome modal — explicitly deferred to a follow-up quick task; placeholder SVGs ship in this phase. Reason: screenshot capture, polish, and dimensioning are design work that would block phase ship.
- Action-based step completion (watching for actual uploads, generations, publishes) — Reason: requires event listeners across multiple routes, significantly larger build, and current goal is acknowledgement-based tour, not gamified activation.
- Re-showing the tour to existing ~50 users — Reason: migration backfills them as completed. They have already learned the app; auto-firing the tour would annoy active users.
- iOS / React Native onboarding — Reason: web-first product; iOS comes later. iOS will need its own first-run flow design.
- Localization (i18n) of tour copy — Reason: project does not yet have a localization layer; English-only consistent with rest of product.
- Activation analytics events (e.g., "step_1_viewed", "step_3_completed" telemetry) — Reason: useful for later iteration but out of scope for v1 ship. Can be layered in once telemetry stack is decided.
- A/B testing infrastructure for tour copy variants — Reason: pre-PMF; ship the tour, learn from qualitative signal first.

## Constraints

- The checklist component MUST query targets via `[data-onboarding-id="..."]` only, never via CSS class or DOM structure. This is the load-bearing contract that prevents future renames from silently breaking the tour.
- The welcome modal MUST NOT block the dashboard from being interactive after dismiss; closing the modal must not leave a pointer-events-blocking overlay behind.
- The migration MUST backfill all existing `profiles` rows with a non-null `onboarding_completed_at` in the SAME transaction as the column addition (atomic), to guarantee no existing user is briefly eligible to see the tour during deploy.
- Public-by-default invariant from `[[feedback_public_by_default]]` is unaffected; the publish-toggle spotlight is informational only and must not change publish defaults.
- The dashboard server component already reads `profiles` (line 16–19 of `dashboard/page.tsx`); add `onboarding_completed_at` to the existing `.select(...)` query rather than a separate round-trip.
- The persistent checklist must be mounted in `(dashboard)/layout.tsx` so it survives navigation between `/dashboard`, `/style-from-reference`, and `/project/[id]` routes.

## Acceptance Criteria

- [ ] Migration adds `profiles.onboarding_completed_at timestamptz` column and backfills all existing rows to `now()` in the same transaction.
- [ ] `SELECT count(*) FROM profiles WHERE onboarding_completed_at IS NULL` returns 0 immediately after migration is applied.
- [ ] A new user (manually inserted with `onboarding_completed_at = NULL`) signing in and visiting `/dashboard` sees the welcome modal auto-open.
- [ ] The welcome modal has exactly 4 slides with TikTok-Slideshow-product-specific titles and copy (not the generic "Welcome to your new workspace" placeholders).
- [ ] Clicking Skip on the modal OR completing all 4 checklist steps writes a non-null `onboarding_completed_at` to the user's profile row.
- [ ] After completion, refreshing `/dashboard` does NOT re-show the modal.
- [ ] `git grep "data-onboarding-id"` returns 4 production-source matches corresponding to the 4 step IDs (`reference-upload`, `topic-input`, `generate-button`, `publish-toggle`).
- [ ] Clicking the checklist step for `reference-upload` from `/dashboard` navigates to `/style-from-reference` AND spotlights the uploader card (data-onboarding-id ring visible).
- [ ] A "Restart onboarding tour" button exists on a settings page; clicking it nulls `onboarding_completed_at` and redirects to `/dashboard` where the modal re-appears.
- [ ] No console errors during the full happy-path tour from welcome modal → 4 coachmark steps → completion.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                    |
|--------------------|-------|------|--------|----------------------------------------------------------|
| Goal Clarity       | 0.92  | 0.75 | ✓      | Specific 4 steps + persistence model + scope locked.     |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Explicit screenshot deferral + iOS deferral + analytics deferral. |
| Constraint Clarity | 0.80  | 0.65 | ✓      | Migration atomicity + data-attr selector contract locked.|
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 10 pass/fail checkboxes including migration + grep gate. |
| **Ambiguity**      | 0.15  | ≤0.20| ✓      |                                                          |

## Interview Log

| Round | Perspective                      | Question summary                                    | Decision locked                                                                |
|-------|----------------------------------|----------------------------------------------------|--------------------------------------------------------------------------------|
| 1     | Researcher + Boundary Keeper     | Trigger + persistence?                              | Once-per-user, Supabase `onboarding_completed_at` column                       |
| 1     | Researcher + Boundary Keeper     | Which 4 UI elements get spotlighted?                | `reference-upload`, `topic-input`, `generate-button`, `publish-toggle`         |
| 1     | Researcher + Boundary Keeper     | Welcome modal content treatment?                    | Product-specific copy + placeholder SVGs in v1; real screenshots in follow-up  |
| 2     | Boundary Keeper + Failure Analyst| Cross-route vs single-page tour?                    | Cross-route with persistent state (Zustand/context) and navigation per step    |
| 2     | Boundary Keeper + Failure Analyst| What counts as "complete"; what about existing users? | Skip OR click-through = complete; migration backfills existing 50 users        |
| 2     | Boundary Keeper + Failure Analyst| Screenshots in this phase?                          | Two-pass: placeholder SVGs ship now, real screenshots as separate quick task   |

---

*Phase: 81-first-run-onboarding-tour*
*Spec created: 2026-05-15*
*Next step: /gsd-discuss-phase 81 — implementation decisions (state store choice, dialog primitive layering, migration shape, where the restart button lives, how the checklist resumes after page reload)*
