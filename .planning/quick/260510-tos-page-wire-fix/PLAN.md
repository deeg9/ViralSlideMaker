---
quick_task: tos-page-wire-fix
created: 2026-05-10
status: in-progress
trigger: "Live smoke: 'Failed to mint upload URL' on first PNG upload at /style-from-reference/new"
---

# Quick: Fix ToS page wiring + better error surfacing

## Problem (root cause)

Live smoke (Diego, free tier, 190 credits) hit "Failed to mint upload URL" on first PNG upload. Root cause is the Plan 79-02 follow-on item I flagged at milestone close-out:

1. **Server-side ToS gate is ON.** `POST /api/style-references/upload-url` runs `hasUserAcceptedCurrentTos(admin, userId, '2026-05-10-v1')` BEFORE minting. No audit row exists for the user → returns `403 TOS_REQUIRED`.
2. **Client-side ToS modal is NOT wired.** Page (`src/app/(dashboard)/style-from-reference/new/page.tsx`) instantiates `<StyleFromReferenceShell>` without `tosAlreadyAccepted` / `acceptTosAction` props.
3. **`<StyleFromReferenceShell>` doesn't accept those props at all** — it doesn't pass them through to `<ReferenceImageUploader>`.
4. **`<ReferenceImageUploader>` defaults `tosAlreadyAccepted` to `true`** (`props.tosAlreadyAccepted ?? true` line 86) — client thinks ToS is accepted and skips the clickwrap modal, sends upload anyway.
5. **Uploader error catch is generic** — both network failure AND `403 TOS_REQUIRED` show "Failed to mint upload URL." User has no idea what went wrong.

## Fix (3 surgical edits + 1 wiring)

1. **Add ToS props to `StyleFromReferenceShellProps`** + pass-through to `<ReferenceImageUploader>`.
2. **Wire the page** — server-side read of ToS acceptance status via `hasUserAcceptedCurrentTos`; pass `tosAlreadyAccepted` + bound `acceptStyleFromReferenceTosAction` into the shell.
3. **Better error surfacing in uploader** — when mint route returns 403 with `code: 'TOS_REQUIRED'`, show the modal (force re-acceptance) rather than the generic error.
4. **Test** — add a focused vitest covering the new prop pass-through + error-routing behaviors.

## Acceptance

- Visit `/style-from-reference/new` as a user who has never accepted ToS → ToS clickwrap modal renders before first upload
- Click Accept → upload proceeds, signed URL minted, file uploads successfully
- On subsequent uploads same session, no modal, fast path
- TOS_REQUIRED error from server (e.g., ToS version bumped) re-surfaces the modal rather than the generic error

## Files modified

- `src/app/(dashboard)/style-from-reference/new/page.tsx` (server-side ToS check + pass props)
- `src/components/style-from-reference/style-from-reference-shell.tsx` (extend props + pass-through)
- `src/components/dashboard/reference-image-uploader.tsx` (route TOS_REQUIRED → reopen modal instead of generic error)
- `src/components/dashboard/__tests__/reference-image-uploader-tos-reroute.test.tsx` (new — targeted regression test)
