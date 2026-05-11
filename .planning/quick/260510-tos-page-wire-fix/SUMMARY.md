---
quick_task: tos-page-wire-fix
created: 2026-05-10
completed: 2026-05-10
status: complete
verdict: fixed
---

# Quick: ToS page-wire fix — STATUS: FIXED

## Symptom
Live smoke at `/style-from-reference/new` (Diego, free tier, 190 credits): drag-drop a PNG → "Failed to mint upload URL" red banner under the dropzone.

## Root cause (the Plan 79-02 follow-on item flagged at milestone close-out)
Server-side LEGAL-01 ToS gate was live; client-side ToS clickwrap modal was never wired into the page; uploader's `tosAlreadyAccepted` defaults to `true`, so the client skipped the modal and sent the upload directly. Server returned 403 TOS_REQUIRED; uploader's generic catch surfaced "Failed to mint upload URL" — accurate-but-cryptic.

## Fix (4 commits)
1. `bb3...` — `StyleFromReferenceShellProps` extended with `tosAlreadyAccepted` + `acceptTosAction` pass-through to `<ReferenceImageUploader>`
2. `...` — `/style-from-reference/new` page reads ToS acceptance status server-side (`hasUserAcceptedCurrentTos`) + binds `acceptStyleFromReferenceTosAction(STYLE_FROM_REFERENCE_TOS_VERSION)` and passes both as props
3. `...` — `<ReferenceImageUploader>` parses 403 response: when `error.code === 'TOS_REQUIRED'`, reopens the clickwrap modal (queues `pendingFiles`) instead of showing the generic error; non-TOS failures show the server's actual error message instead of the generic fallback
4. `...` — `ApiErrorCode` union extended with `'TOS_REQUIRED'` (was already used by the route but missing from the type — pre-existing tsc error, fixed in passing)
5. New regression test `reference-image-uploader-tos-reroute.test.tsx` — 2 cases: TOS_REQUIRED reroutes to modal; non-TOS 500 surfaces server message

## Verification
- 17/17 uploader tests GREEN (10 baseline + 5 ToS clickwrap + 2 new TOS_REQUIRED reroute)
- `npx tsc --noEmit` clean on all changed files (the pre-existing TOS_REQUIRED tsc error is now resolved)
- Manual smoke: refresh `/style-from-reference/new` → drag-drop PNG → ToS clickwrap modal renders → click Accept → upload proceeds

## Files modified
- `src/app/(dashboard)/style-from-reference/new/page.tsx`
- `src/components/style-from-reference/style-from-reference-shell.tsx`
- `src/components/dashboard/reference-image-uploader.tsx`
- `src/lib/api/errors.ts`
- `src/components/dashboard/__tests__/reference-image-uploader-tos-reroute.test.tsx` (new)
