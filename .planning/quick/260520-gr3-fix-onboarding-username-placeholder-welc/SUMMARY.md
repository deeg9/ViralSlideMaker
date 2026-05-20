---
slug: fix-onboarding-username-placeholder-welc
quick_id: 260520-gr3
date: 2026-05-20
status: complete
commits:
  - 235f99b
  - 2a70d49
  - 522fee4
  - d4735b1
---

# Quick Task SUMMARY — onboarding fixes (username / welcome dialog / take-me-there)

User walked through the post-signup flow on 2026-05-20 and reported three
issues. All three are fixed in 4 atomic commits.

## What changed

### Commit `235f99b` — username step no longer leaks "diego"
- `src/app/(auth)/onboarding/username/page.tsx` — dropped the
  `suggestFromEmail(user.email)` pre-fill in the claim path. `suggestion`
  is always `''` now. The change path is unchanged.
- `src/app/(auth)/onboarding/username/claim-username-form.tsx` —
  `placeholder="yourhandle"` → `placeholder="username"`.

Verified live: GET `/onboarding/username?change=1` returns an empty input
with `placeholder="username"`.

### Commit `2a70d49` — welcome dialog: rename, drop references slide, globe
- `src/components/onboarding/first-run-welcome-dialog.tsx`:
  - Slide 1 title: `"Welcome to TikTok Slideshow Creator"` →
    `"Welcome to Viral Slide Maker"`. Same in the `sr-only` DialogTitle.
  - DialogDescription rewritten to say "Three slides…".
  - Removed the `"Bring your own references"` slide (SLIDES + palettes
    + labels + PlaceholderSvg index handling all updated for 3 slides).
  - Replaced the publish-to-share placeholder (card + arrow + checkmark)
    with a globe SVG: outer circle, equator line, prime meridian, two
    latitude ellipses, one side-meridian ellipse. Same palette family.

Verified live by triggering "Restart onboarding tour" from
`/settings/profile`, then DOM-inspecting the dialog: 3 progress dots,
visible heading on slide 3 is `"Publish to share"`, the globe SVG carries
the expected circle/equator/meridian markers.

### Commit `522fee4` — checklist: drop `reference-upload` + smart Take-Me-There
- `src/components/onboarding/onboarding-steps.ts` — removed the
  `reference-upload` step. Steps now: `topic-input`, `generate-button`,
  `publish-toggle`. D-08 locked-IDs comment updated accordingly.
- `src/components/onboarding/get-latest-project-id.ts` — new `'use server'`
  action returning the user's most recent project id (RLS-scoped) or
  `null`. Mirrors the dashboard projects loader.
- `src/components/onboarding/interactive-onboarding-checklist.tsx` —
  replaced `onNavigateToRoute(route)` with step-aware `onTakeMeThere(step)`.
  For publish-toggle, the handler resolves the user's most recent project
  id and routes to `/project/<id>`; for no-project users it auto-completes.

### Commit `d4735b1` — universal smart Take-Me-There + DOM-aware step click
Follow-up after Playwright live testing. Two refinements:

- Generalize the publish-toggle route resolution to ALL steps: topic-input
  and generate-button also live on `/project/[id]` (inside GenerationForm),
  not on `/dashboard`. The smart handler now does the same `scrollIntoView`
  → `getLatestProjectId` → `router.push('/project/<id>')` → auto-complete
  cascade for every step.
- Add a loop guard: if the user is already on the latest project's
  `/project/<id>` and the target is still not in the DOM (the project has
  slides already, so topic-input/generate-button are gone), auto-complete
  the step instead of re-routing to the same page.
- Make `onStepClick` DOM-aware: if the target is already in the DOM on the
  current page, skip the static `router.push(step.route)`. Without this,
  clicking the publish-toggle step from `/project/[id]` would yank the
  user back to `/dashboard` (where the target doesn't exist).

## Verification

- `npx tsc --noEmit` — zero errors in onboarding files (pre-existing
  test-mock errors unrelated to this task).
- `npx eslint src/components/onboarding src/app/(auth)/onboarding` — clean.
- Playwright live walkthrough:
  - `/onboarding/username?change=1` → empty input + `username` placeholder.
  - Restart tour → 3-slide welcome dialog with new copy + globe SVG.
  - Checklist shows 3 steps (no reference-upload).
  - Click `Type your topic` from `/dashboard` → Take-Me-There routes to
    most-recent project; if target isn't there, second click auto-completes.
  - Click `Publish to share` from `/project/[id]` → stays in place and
    spotlights the visibility dropdown (no off-page route).
  - Click `Publish to share` from `/dashboard` → routes to most-recent
    project (where the visibility dropdown lives).

## Locked-ID change

D-08 in `onboarding-steps.ts` previously listed
`reference-upload, topic-input, generate-button, publish-toggle`. After
this quick task, the locked IDs are `topic-input, generate-button,
publish-toggle`. The comment was updated in-file; SPEC update is deferred
to whoever next opens Phase 81 R-spec (out of scope for this quick task).
