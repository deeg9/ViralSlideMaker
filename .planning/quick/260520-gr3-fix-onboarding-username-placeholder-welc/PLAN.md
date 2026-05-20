---
slug: fix-onboarding-username-placeholder-welc
quick_id: 260520-gr3
date: 2026-05-20
status: in-progress
---

# Quick Task: Fix onboarding flow — username, welcome dialog, take-me-there

Three independent fixes captured by the user on 2026-05-20 while walking through
the post-signup flow.

## Scope

### Fix 1 — Username step shouldn't leak the email-derived suggestion
- `src/app/(auth)/onboarding/username/page.tsx`: in the **claim** branch (no
  current username yet), stop calling `suggestFromEmail(user.email)`. Pass
  `suggestion = ''` so the input starts blank.
- `src/app/(auth)/onboarding/username/claim-username-form.tsx`: change the
  `placeholder` from `"yourhandle"` to `"username"`.
- The `change` branch (existing username) is unaffected.

### Fix 2 — Welcome dialog: rename, drop references slide, swap publish icon
- `src/components/onboarding/first-run-welcome-dialog.tsx`:
  - Slide 1 title: `"Welcome to TikTok Slideshow Creator"` → `"Welcome to Viral Slide Maker"`.
  - `<DialogTitle className="sr-only">` text: same rename.
  - `<DialogDescription>`: drop the "Upload references" sentence, drop the
    "Four slides" framing — it's now 3 slides.
  - Remove the SLIDES entry for "Bring your own references".
  - Update `palettes` (4 → 3) and `labels` (4 → 3) in `PlaceholderSvg` so the
    indices line up with the new slide order: Welcome, Topic, Publish.
  - Replace the Publish-to-share `PlaceholderSvg` (currently card + arrow +
    checkmark) with a clean globe: outer circle, equator, meridian, soft
    secondary meridians. Same palette.
  - All remaining motion + Embla wiring untouched. SPEC R3 comment updated to
    reflect 3 slides.

### Fix 3 — Take-Me-There actually navigates / spotlights
- `src/components/onboarding/onboarding-steps.ts`:
  - Drop the `reference-upload` step entirely (consistent with welcome dialog).
  - Final ordered steps: `topic-input`, `generate-button`, `publish-toggle`.
  - Keep the D-07 / D-08 contract comment; note that `reference-upload` was
    removed in this quick task.
- `src/components/onboarding/interactive-onboarding-checklist.tsx`:
  - Make the Centered fallback's "Take me there" action **smart**:
    1. First, re-query `document.querySelector(step.targetSelector)`. If the
       element exists (the user is on the right page but it scrolled out of
       view), call `scrollIntoView({ behavior: 'smooth', block: 'center' })`
       and trigger a re-measure so the spotlight appears.
    2. If the element is not in the DOM and the step is `publish-toggle`,
       resolve the most-recent project id (server action — see below) and
       `router.push('/project/<id>')`. If the user has no projects, mark the
       step completed via `completeStep('publish-toggle')` and dismiss the
       coachmark — there is nothing to spotlight yet.
    3. Otherwise, fall back to `router.push(step.route)` as before.
- New server action `src/components/onboarding/get-latest-project-id.ts` (or
  inline in an existing onboarding actions file if one exists): returns the
  user's most recent project id, or `null`. Implementation reuses the same
  Supabase server client + `projects` table pattern already used by
  `RecentCarousels` so we don't drift from that loader.

## Verification
- `npm run typecheck`
- `npm run test -- src/components/onboarding` (vitest pattern)
- Manual smoke: dev server already running on local; sign in with onboarding
  reset, walk through new flow, confirm:
  - Username field empty + `username` placeholder
  - Welcome carousel shows 3 slides, no references slide, globe icon on slide 3
  - Click topic-input step → spotlight on dashboard
  - Click generate-button step → spotlight on dashboard
  - Click publish-toggle step → routes to /project/<latest> OR completes if no projects

## Commit plan
- 3 atomic commits (one per fix) so each can be reverted independently.
- Conventional commit: `fix(quick-260520-gr3): ...`
