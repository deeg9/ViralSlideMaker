---
quick_task: tos-page-wire-fix
created: 2026-05-10
completed: 2026-05-10
status: complete
verdict: fixed-end-to-end-via-live-smoke
---

# Quick: ToS page-wire fix — STATUS: FIXED (end-to-end live verified)

## Symptom
Live smoke at `/style-from-reference/new` (free tier): drag-drop a PNG → "Failed to mint upload URL" red banner under the dropzone.

## Five fixes (each surfaced + verified by Playwright live smoke)

### Fix 1 — Page-wire (the original Plan 79-02 follow-on)
Server-side LEGAL-01 ToS gate was live; client clickwrap modal was never wired; uploader defaulted `tosAlreadyAccepted` to `true`. Page now reads ToS status server-side (`hasUserAcceptedCurrentTos`) + passes `tosAlreadyAccepted` + `acceptTosAction` props through `<StyleFromReferenceShell>` to `<ReferenceImageUploader>`.

### Fix 2 — TOS_REQUIRED reroute + better error surfacing
Uploader's generic catch surfaced "Failed to mint upload URL" for any non-2xx. Now: parses response, when `error.code === 'TOS_REQUIRED'` reopens the clickwrap modal with pending files queued; otherwise surfaces the server's actual error message. `ApiErrorCode` union extended with `'TOS_REQUIRED'` (pre-existing tsc error in the route).

### Fix 3 — Server→Client function-passing crash
First live retry: server-side runtime error `Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server"`. My initial page wired `const acceptTosAction = async () => acceptStyleFromReferenceTosAction(VERSION)` — RSC forbids inline closures across the Server→Client boundary. Added `acceptStyleFromReferenceTosCurrentVersionAction()` (no-arg wrapper) at the bottom of `actions.ts` (which is `'use server'`) and pass it directly.

### Fix 4 — Cookie-session auth on upload route (NOT Bearer)
Second live retry: 401 UNAUTHORIZED + "Invalid or missing API key" surfaced. The route used `withApiAuth` (designed for the public `/api/v1/*` REST API with API-key Bearer headers) but is called from the in-app browser fetch (cookies). Replaced `withApiAuth` with cookie-session auth (`createClient` from `@/lib/supabase/server` + `auth.getUser`) — mirrors `/api/render/route.ts`. Test mocks updated to mock `createClient` instead of `withApiAuth`.

### Fix 5 — Audit-log helper inserts sentinel row when sha256s empty
Third live retry: ToS modal Accept "succeeded" (no error) but next upload still 403'd. Root cause: `recordStyleFromReferenceTosAcceptance` early-returned `ok: true` when `sha256s: []` without inserting any row — the LEGAL-01 first-touch flow accepts ToS BEFORE any image is selected, so `sha256s` is always empty at that moment. Helper now inserts ONE row with sentinel `sha256: '__version_acceptance__'` when array is empty. Existing test updated from "no-op" assertion to sentinel-row assertion.

## Verification

### Unit tests (all GREEN)
- 17 uploader tests (10 baseline + 5 ToS clickwrap + 2 new TOS_REQUIRED reroute)
- 9 upload-url route tests (auth swap migrated cleanly)
- 11 audit-log + tos-version tests (sentinel-row semantic locked)

### Live Playwright smoke (the actual fix verification)
1. Navigate to `/style-from-reference/new` — page renders, no console errors
2. Click dropzone, upload `Screenshot 2026-05-10 at 9.00.43 PM.png`
3. ToS clickwrap modal opens with "Inspired by" framing copy ✓
4. Tick checkbox, click Accept and continue ✓
5. `POST /api/style-references/upload-url` returns **200 OK** ✓
6. Browser PUTs file directly to `https://...supabase.co/storage/v1/object/upload/sign/slide-references/<userId>/<uuid>-test-upload.png` → **200** ✓
7. Thumbnail renders in the gallery + "Extract style" button enables ✓

Screenshot saved at `.playwright-mcp/verified-upload-success.png`.

## Known follow-on (out of scope for this quick task)
Thumbnail rendering surfaces a 404 on `http://localhost:3000/style-from-reference/<userId>/<uuid>-test-upload.png` — the thumbnail's `<img src>` resolves the Storage path against the page origin instead of using a Storage signed READ URL. The file IS uploaded successfully (Supabase 200); only the on-page preview misses. Belongs in its own quick task or in the existing Phase 75 vision-extraction follow-on (which already mints signed READ URLs at extraction time).

## Files modified (this quick task, full list)
- `src/app/(dashboard)/style-from-reference/new/page.tsx`
- `src/app/(dashboard)/style-from-reference/actions.ts` (added no-arg wrapper)
- `src/components/style-from-reference/style-from-reference-shell.tsx`
- `src/components/dashboard/reference-image-uploader.tsx`
- `src/lib/api/errors.ts`
- `src/app/api/style-references/upload-url/route.ts` (auth pattern swap)
- `src/app/api/style-references/upload-url/__tests__/route.test.ts` (mock swap)
- `src/lib/legal/audit-log.ts` (sentinel-row insert)
- `src/lib/legal/__tests__/audit-log.test.ts` (sentinel test)
- `src/components/dashboard/__tests__/reference-image-uploader-tos-reroute.test.tsx` (new)
