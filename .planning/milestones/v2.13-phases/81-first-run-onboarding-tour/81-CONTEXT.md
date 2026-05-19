# Phase 81: First-Run Onboarding Tour - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning
**Mode:** Auto (discuss-phase --auto in autonomous run; HOW decisions selected by Claude)

<domain>
## Phase Boundary

A first-time signed-in user lands on `/dashboard`, sees a 4-slide product-themed welcome modal, then advances through a persistent cross-route coachmark checklist that spotlights 4 key product surfaces (reference uploader, topic input, generate button, publish toggle). Skipping OR completing all steps marks `profiles.onboarding_completed_at` so the tour never auto-fires again. Migration backfills existing users as completed.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `81-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `81-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Supabase migration: `profiles.onboarding_completed_at timestamptz` column + backfill for existing rows.
- Two new client components: `<FirstRunWelcomeDialog />` (4-slide modal carousel) and `<InteractiveOnboardingChecklist />` (4-step checklist + coachmark overlay).
- Global onboarding state provider mounted at the dashboard layout level.
- `data-onboarding-id` attributes on the 4 target elements (`reference-upload`, `topic-input`, `generate-button`, `publish-toggle`).
- Server-side read of `onboarding_completed_at` in `/dashboard` and pass-down to gate the modal.
- "Restart onboarding tour" button on a settings page.
- New deps: `embla-carousel-react`, `@radix-ui/react-dialog`. Optional shadcn primitives `badge`, `switch`, `dialog` added to `src/components/ui/` if not already present.
- Placeholder SVG visuals matching the supplied welcome-modal pattern.

**Out of scope (from SPEC.md):**
- Real product screenshots (deferred to follow-up quick task).
- Action-based step completion (only acknowledgement-based: click Next on each coachmark).
- Re-showing tour to existing ~50 users (migration backfills as completed).
- iOS / React Native onboarding.
- Localization / i18n.
- Activation analytics events / telemetry.
- A/B testing infrastructure for tour copy variants.

</spec_lock>

<decisions>
## Implementation Decisions

### State Management
- **D-01: React Context for onboarding state, NOT Zustand.** No `zustand` / `jotai` / Redux installed today; adding a state-management dep for a single feature is over-build. A `<OnboardingProvider>` mounted in `src/app/(dashboard)/layout.tsx` (inside `DashboardShell`) holds `{ activeStepId, completedStepIds[], dispatch }`. Survives client-side route navigation between `/dashboard`, `/style-from-reference`, `/project/[id]`.
- **D-02: Initial state seeded from server.** `(dashboard)/layout.tsx` extends its existing `profiles.select('username, display_name')` to also fetch `onboarding_completed_at`, and passes a boolean `needsOnboarding` prop into a client `<OnboardingProvider>`. Server component is the source of truth; client context is the in-flight tour state only.
- **D-03: No per-step Supabase persistence.** Only `onboarding_completed_at` is written (on Skip or full completion). Step-by-step progress is in-memory in the React Context — page refresh during the tour resets to step 1 of the checklist (the welcome modal does NOT re-show because completion writes IMMEDIATELY only on skip/finish; mid-tour reload simply re-fires the welcome modal too, which is acceptable for v1). This avoids per-step DB writes and matches the SPEC's "acknowledgement-based, not action-based" semantic.

### Dialog & Modal Primitives
- **D-04: Add shadcn `dialog` primitive to `src/components/ui/dialog.tsx`.** Built on `@radix-ui/react-dialog` (new dep). Reusable for any future modal in the app, not scoped to onboarding. Matches existing shadcn-style primitives in `src/components/ui/` (button.tsx, card.tsx, label.tsx).
- **D-05: Embla for the welcome modal carousel.** Install `embla-carousel-react` (new dep). The supplied design uses Embla; no reason to swap for a different carousel lib.
- **D-06: Use `motion` (already installed v12) for animations.** The supplied component imports from `motion/react` — motion v12 supports this. The pasted coachmark component imports from `framer-motion` — REWRITE these imports to `motion/react` to match installed package; do NOT add framer-motion as a separate dep.

### Coachmark Targeting Contract
- **D-07: `data-onboarding-id` attribute is the ONLY selector contract.** The coachmark component MUST query `[data-onboarding-id="<step-id>"]`, never CSS classes, structural selectors, or `id=` attributes. Class names and DOM structure change; data-attrs are intentional contracts.
- **D-08: 4 step IDs are locked: `reference-upload`, `topic-input`, `generate-button`, `publish-toggle`.** Adding/renaming requires updating SPEC.md first.
- **D-09: When target element is not in DOM, coachmark falls back to centered modal explaining the step + a "Take me there" button** that navigates to the step's `route` field. Matches the placeholder treatment in the supplied component.

### Cross-Route Navigation
- **D-10: Each step has `{ id, title, description, route, targetSelector }`.** Clicking a step in the checklist calls `router.push(step.route)` and sets `activeStepId = step.id`. On route change, the coachmark overlay re-evaluates `document.querySelector(step.targetSelector)` and renders the spotlight when found.
- **D-11: Step → route map (must be confirmed in plan-phase against actual file locations):**
  - `reference-upload` → `/style-from-reference` (uploader card on that page)
  - `topic-input` → `/dashboard` (the topic prompt area; locate during plan-phase research)
  - `generate-button` → `/style-from-reference` (the generate-from-reference action; same page as upload)
  - `publish-toggle` → `/project/[id]` (the project editor publish toggle; will need a default/first-project ID, OR redirect to a representative published carousel — settle in plan-phase)

### Restart Entry Point
- **D-12: Restart button lives on `/settings/profile`.** `src/app/(dashboard)/settings/profile/page.tsx` exists. Add a small "Onboarding" subsection with a button "Restart onboarding tour" that nulls `onboarding_completed_at` via server action and redirects to `/dashboard`.

### Migration Shape
- **D-13: Single migration adds column AND backfills in one transaction.**
  ```sql
  ALTER TABLE profiles
    ADD COLUMN onboarding_completed_at timestamptz;
  UPDATE profiles
    SET onboarding_completed_at = now()
    WHERE onboarding_completed_at IS NULL;
  ```
  Order matters: column added FIRST, backfill SECOND. New rows after migration default to NULL. Existing rows (the ~50 current users) get a non-null timestamp and never see the tour.
- **D-14: No RLS policy changes needed.** Existing profile RLS (users can SELECT/UPDATE own row) already covers the new column.

### Routing Edge Cases
- **D-15: `/onboarding/username` claim ALWAYS runs first.** The existing `(dashboard)/layout.tsx` already redirects to `/onboarding/username` if `profile.username` is null. The new tour only fires AFTER username claim is complete and user lands on `/dashboard`. No interaction with the username flow.
- **D-16: Tour does NOT fire on `/style-from-reference`, `/project/[id]`, or other dashboard children when entered directly via URL or refresh.** Auto-fire is gated only by `/dashboard` page. Once the welcome modal closes, the checklist is what crosses routes (not the welcome modal).
- **D-17: If user refreshes the page mid-tour (checklist visible, welcome modal already closed)**, the checklist re-mounts from the provider but `activeStepId` resets to null (in-memory only). User clicks a step to resume — this is acceptable v1 behavior. Welcome modal does NOT re-show because the gate is `onboarding_completed_at`, and that's still NULL at this point — meaning the welcome modal WOULD re-show on `/dashboard` reload. **DECISION:** First click of "Get Started" on slide 4 of welcome modal writes a separate `onboarding_welcome_seen_at` flag (in-memory provider state, persisted to localStorage). Reload after welcome-modal-dismissed restores the checklist without re-showing the modal.

### Component File Locations
- **D-18: New files:**
  - `src/components/onboarding/onboarding-provider.tsx` — Context provider, mounted in dashboard layout.
  - `src/components/onboarding/first-run-welcome-dialog.tsx` — 4-slide modal.
  - `src/components/onboarding/interactive-onboarding-checklist.tsx` — checklist + coachmark overlay.
  - `src/components/onboarding/onboarding-steps.ts` — the locked step definitions (id, title, description, route, targetSelector).
  - `src/components/ui/dialog.tsx` — shadcn dialog primitive (new shared UI primitive).
  - `src/lib/onboarding/actions.ts` — server actions: `markOnboardingComplete`, `restartOnboarding`.
  - Migration: `supabase/migrations/<timestamp>_add_profiles_onboarding_completed_at.sql`.
- **D-19: Modified files:**
  - `src/app/(dashboard)/layout.tsx` — fetch `onboarding_completed_at`, render `<OnboardingProvider>` around `<DashboardShell>`.
  - `src/app/(dashboard)/dashboard/page.tsx` — mount `<FirstRunWelcomeDialog />` gated by `needsOnboarding` from provider.
  - `src/app/(dashboard)/settings/profile/page.tsx` — add "Restart onboarding tour" button.
  - The 4 target component files — add `data-onboarding-id` attributes (locate during plan-phase research).

### Claude's Discretion
- Exact placeholder-SVG content per slide (palette, accent colors, text). Use the supplied design's pattern but with TikTok-Slideshow-themed copy.
- Keyboard handling beyond what's already in the pasted components (Arrow keys, Escape, Enter/Space).
- Bundle-size budget: install `@radix-ui/react-dialog` + `embla-carousel-react` (~15 KB gz combined estimate). Likely under bundle-size CI thresholds; verify during execute-phase.
- TypeScript types for the OnboardingContext — derive from the canonical step definitions in `onboarding-steps.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 81 contracts
- `.planning/phases/81-first-run-onboarding-tour/81-SPEC.md` — Locked requirements (7) — MUST read before planning or implementing.

### Existing dashboard surface
- `src/app/(dashboard)/layout.tsx` — Server component layout. Already fetches `profiles.username, display_name`; extend with `onboarding_completed_at`. Already redirects to `/onboarding/username` if username null — tour fires only after username claim succeeds.
- `src/app/(dashboard)/dashboard/page.tsx` — Dashboard entry. Already reads `profile`. Extend with `onboarding_completed_at` and pass to welcome modal gate.
- `src/components/layout/dashboard-shell.tsx` — Where `<OnboardingProvider>` should wrap (or live inside) so checklist persists across dashboard children routes.
- `src/app/(dashboard)/settings/profile/page.tsx` — Existing settings page; add Restart button here.

### Coachmark targets (locate in plan-phase research)
- `src/components/style-from-reference/` (or equivalent) — `reference-upload` and `generate-button` targets.
- `src/app/(dashboard)/dashboard/page.tsx` or a child component — `topic-input` target (locate the topic/prompt entry surface).
- Project editor (likely `src/app/(dashboard)/project/[id]/` and a publish toggle subcomponent) — `publish-toggle` target.

### Existing onboarding namespace (NOT the tour — username claim)
- `src/app/(auth)/onboarding/username/page.tsx` — pre-existing username claim flow. The new tour MUST NOT collide with this route. Tour code lives in `src/components/onboarding/`, not in a `src/app/onboarding/*` route.

### Project conventions
- `.planning/PROJECT.md` — Project mission and current focus.
- `.planning/STATE.md` — Live milestone state (v2.13 complete; Phase 81 is post-ship extension).
- `[[feedback_public_by_default]]` — Public-by-default invariant for newly-generated carousels. The publish-toggle spotlight is informational; do not change publish defaults.

### Supplied design references (component patterns the user wants followed)
- Pasted in conversation: welcome modal (Embla + Motion + placeholder SVGs), interactive coachmark checklist (Radix Dialog + Framer-Motion → rewrite to `motion/react`), button/badge/switch/card/label shadcn primitives.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — shadcn Button with variant + size variants. Reused as-is in welcome modal and checklist (Back/Skip/Next/Get Started buttons + coachmark Prev/Next).
- `src/components/ui/card.tsx` — shadcn Card + CardHeader/CardTitle/CardDescription/CardContent/CardFooter. Reusable for checklist step rows.
- `src/components/ui/label.tsx` — shadcn Label. Probably not needed for tour, but available.
- `src/components/ui/icon.tsx` — wrapped Icon component. Use this OR lucide-react directly for X, Check, ChevronLeft, ChevronRight, CheckCircle2, Circle icons (the pasted component imports from `lucide-react` directly — match that style).
- `motion@^12.38.0` — animation library; the supplied components use `motion/react` (works on v12) and `framer-motion` (must rewrite to `motion/react`).
- `lucide-react@^1.14.0` — icon library, already installed (note: v1.14 is the version pinned by the project; the icon names used by the pasted component are stable across versions).
- `@radix-ui/react-label@^2.1.8`, `@radix-ui/react-switch@^2.x` — already installed; tour doesn't strictly need switch but it's available.
- `src/lib/supabase/server.ts` — Server-side Supabase client. Reuse in the layout fetch and in server actions for mark/restart.
- `src/lib/supabase/client.ts` (if exists) — Client-side Supabase client for any client-side reads (unlikely to be needed for this phase).

### Established Patterns
- **Server-component first**: layouts and pages are RSC, fetch data via `createClient()`, pass into client components as props.
- **shadcn primitives in `src/components/ui/`**: thin wrappers over Radix primitives + Tailwind variants. New `dialog.tsx` MUST follow the same pattern as `button.tsx` (cva variants, forwardRef, className merge via `cn()`).
- **Migrations live in `supabase/migrations/`** with timestamped filenames. (Verify exact convention during plan-phase by listing existing migrations.)
- **No localStorage abuse**: project has memory rule `[[feedback_public_by_default]]` about regressions; prefer server state over client-only state. The `onboarding_welcome_seen_at` localStorage flag in D-17 is a deliberate exception scoped to mid-tour resume only.
- **Tailwind config supports `bg-primary`, `text-primary-foreground`, etc.**: the supplied components use these tokens. Verify they exist in `tailwind.config.ts` during plan-phase.

### Integration Points
- `src/app/(dashboard)/layout.tsx` — `<OnboardingProvider>` wraps `<DashboardShell>` children. New `profiles` field added to the existing `.select(...)`.
- `src/app/(dashboard)/dashboard/page.tsx` — `<FirstRunWelcomeDialog />` rendered conditionally when `needsOnboarding` is true.
- `src/app/(dashboard)/settings/profile/page.tsx` — restart button + server action import.
- The 4 target components — single attribute addition: `data-onboarding-id="<step-id>"`. No logic changes to those components.

</code_context>

<specifics>
## Specific Ideas

- The supplied welcome-modal design (with placeholder SVGs and 4-slide carousel) is the design contract for `<FirstRunWelcomeDialog />`. Match its structure: image area on top, Embla carousel, dots indicator, grid-fade title/description, footer with Back / Skip / Next | Get Started.
- The supplied interactive-checklist design is the design contract for `<InteractiveOnboardingChecklist />`. Bottom-right fixed card with progress bar, step list with check circles, spotlight overlay with positioning logic that avoids covering the checklist card itself. Keep the positioning fallback logic from the original (top → bottom → right → left priority, then constrained fallback).
- Tour copy must be TikTok-Slideshow-specific:
  - Slide 1: "Welcome to TikTok Slideshow Creator" — "Type a topic, get a ready-to-post carousel in seconds."
  - Slide 2: "Bring your own references" — "Upload reference slideshow images and we'll mimic their visual style."
  - Slide 3: "Tell us your topic" — "Describe what you want, and AI generates the slides."
  - Slide 4: "Publish to share" — "Your carousel is public by default — share the link or fork ours."
- Checklist titles (short, action-oriented):
  - "Upload a reference image" — describes the reference uploader.
  - "Type your topic" — describes the topic input.
  - "Generate your carousel" — describes the generate action.
  - "Publish to share" — describes the publish toggle.

</specifics>

<deferred>
## Deferred Ideas

- Real product screenshots in the welcome modal — follow-up quick task after this phase ships. Capture 4 screenshots at consistent dimensions; swap placeholders in `first-run-welcome-dialog.tsx`.
- Activation analytics events (`onboarding_started`, `step_viewed`, `step_completed`, `onboarding_skipped`, `onboarding_completed`) — once telemetry stack is decided (PostHog? Plausible? custom?), instrument these events.
- A/B testing tour copy variants — pre-PMF; ship one version, learn from qualitative signal first.
- Action-based step completion (require the user to actually upload / type / generate / publish to advance) — much higher build complexity; revisit if acknowledgement-based tour does not move activation needle.
- iOS onboarding for the native app — distinct platform, distinct UX patterns; future iOS milestone.
- Localization of tour copy — once project introduces i18n layer.
- "What's new" / changelog tour for returning users on feature launches — separate feature pattern, not first-run.

</deferred>

---

*Phase: 81-first-run-onboarding-tour*
*Context gathered: 2026-05-15*
*Next step: /gsd-plan-phase 81 — break into PLAN files with task breakdown*
