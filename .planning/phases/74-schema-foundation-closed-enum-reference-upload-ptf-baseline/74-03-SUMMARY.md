---
phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline
plan: 03
subsystem: api
tags: [supabase-storage, signed-url, react, drag-drop, upload, validation, ref-upload, defense-in-depth]

# Dependency graph
requires:
  - phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline
    provides: "SLIDE_REFERENCES_BUCKET constant + ReferenceAssetRow type (Plan 02)"
  - phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline
    provides: "StyleSpec type module exists at src/lib/types/style-spec.ts (Plan 01)"
provides:
  - "Shared upload-validation module: validateReferenceUpload + validateGalleryCount (single source of truth used by route + component)"
  - "POST /api/style-references/upload-url signed-URL route (private bucket, no publicUrl in response)"
  - "ReferenceImageUploader React component (1–8 cap, drag-drop + click-to-add, X-to-remove thumbnails, explicit Extract CTA per REF-06)"
  - "onUploadComplete + onExtractRequested callback API for Phase 75/76 to consume"
affects:
  - "Phase 75 (style extraction) — wires onExtractRequested(rows) to its style-extraction service"
  - "Phase 76 (UI launcher page) — embeds <ReferenceImageUploader> on a dashboard route + persists onUploadComplete rows to projects.reference_assets"

# Tech tracking
tech-stack:
  added: []  # No new deps — confirmed `react-dropzone` NOT added; native HTML5 drag-drop
  patterns:
    - "Defense-in-depth validation: identical validator runs client-side (fail-fast UX) + server-side (trust boundary)"
    - "Signed-URL upload pattern reused from brand-kit-logos with three deliberate divergences (private bucket, narrowed MIME, server-side size cap)"
    - "REF-06 separation invariant enforced via test source-grep (component cannot import vision/extraction modules without failing CI)"
    - "Object-URL lifecycle: createObjectURL on add, revokeObjectURL on remove — no leak"

key-files:
  created:
    - "src/lib/storage/upload-reference-validation.ts (shared validator, runtime-agnostic)"
    - "src/lib/storage/__tests__/upload-reference-validation.test.ts (10 tests)"
    - "src/app/api/style-references/upload-url/route.ts (signed-URL POST endpoint)"
    - "src/app/api/style-references/upload-url/__tests__/route.test.ts (9 tests)"
    - "src/components/dashboard/reference-image-uploader.tsx (drag-drop UI component)"
    - "src/components/dashboard/__tests__/reference-image-uploader.test.tsx (10 tests)"
  modified: []

key-decisions:
  - "Native HTML5 drag-drop (no react-dropzone dep added) — kept package.json lean"
  - "sha256 placeholder = empty string (Phase 73 prepareForVision computes the real SHA at extraction time, not at upload time)"
  - "Component stores storage path in row.url (not blob URL) — durable reference for Phase 75 to mint signed READ URLs against"
  - "Test C10 source-grep narrowed to actual endpoint paths + LLM imports + direct extractStyleSpec(...) calls — does NOT forbid the literal substring 'extract', so the contracted UI surface (CTA label, prop name, testid) remains expressible"

patterns-established:
  - "Shared validator module: route + component import the same `validateReferenceUpload`; drift is impossible by construction"
  - "Source-grep invariants in test files: test files use fs.readFileSync + regex to assert structural properties (no hardcoded bucket, no extraction endpoint reference) that survive future edits"
  - "Signed-URL response shape for private buckets: `{uploadUrl, token, method, headers, path}` — NO publicUrl field (security: returning publicUrl from a private-bucket route would be a regression)"

requirements-completed: [REF-02, REF-03, REF-04, REF-05, REF-06]

# Metrics
duration: ~10 min
completed: 2026-05-10
---

# Phase 74 Plan 03: Reference Upload Pipeline Summary

**Signed-URL upload route + drag-drop React component (1–8 images, native HTML5 drop, REF-06 separation: upload ≠ extraction trigger) closing 5 of the 7 REF requirements.**

## Performance

- **Duration:** ~10 min (3 TDD tasks)
- **Started:** 2026-05-10T22:30Z
- **Completed:** 2026-05-10T22:40Z
- **Tasks:** 3 (all autonomous, all TDD: RED → GREEN per task)
- **Files created:** 6 (3 production + 3 test)
- **Tests added:** 29 (10 + 9 + 10), all GREEN
- **Tests run together:** all 3 files `npx vitest run …` → 29/29 pass

## Accomplishments

- **REF-03/REF-04/REF-05** — Shared `upload-reference-validation` module enforces the 4-element MIME allowlist (png/jpeg/webp/heic — NO svg+xml), 20 MB pre-preprocessing cap, and 1–8 gallery cap. Single source of truth used by both the route (defense-in-depth) and the component (fail-fast UX); drift between client and server is impossible by construction.
- **REF-02** — `POST /api/style-references/upload-url` mints signed-upload URLs into the private `slide-references` bucket. Mirrors brand-kit-logos shape with three deliberate divergences: private bucket (no `publicUrl` in response), narrowed MIME allowlist, server-side `size_bytes` validation. Response shape: `{uploadUrl, token, method:'PUT', headers:{Content-Type}, path}` at path `${userId}/${randomUUID}-${safeFilename}`.
- **REF-04 / REF-06** — `<ReferenceImageUploader>` ships native HTML5 drag-drop + click-to-add + inline thumbnail row with X-to-remove + explicit "Extract style" CTA. The CTA fires `onExtractRequested(rows)`; per-upload completion fires `onUploadComplete(row)`. The component imports zero vision/extraction modules — Test C10 enforces this by source-grep, so adding any extraction call here will fail CI.
- **No new deps** — `react-dropzone` confirmed absent from package.json, not added by this plan. `@dnd-kit/*` is present (Phase 70 picker reordering) but is overkill for file-drop; native HTML5 dragstart/dragover/drop is simpler and correct here.

## Task Commits

Each task was committed atomically (single feat commit per task — RED + GREEN squashed because the validator/route/component shipped together with their tests rather than as separate test/feat hops):

1. **Task 1: Shared validation module + tests** — `8c17d16` (feat)
2. **Task 2: Signed-URL upload route + tests** — `4f0ad51` (feat)
3. **Task 3: ReferenceImageUploader component + tests** — `e37ba8c` (feat)

**Plan metadata commit:** _this commit_ (docs)

## Files Created/Modified

**Validation module (Task 1):**
- `src/lib/storage/upload-reference-validation.ts` — `ALLOWED_REFERENCE_MIME` (4-element Set), `MAX_REFERENCE_SIZE_BYTES` (20 MB), `MIN/MAX_REFERENCE_COUNT` (1/8), `validateReferenceUpload`, `validateGalleryCount`. Runtime-agnostic — no react/next imports (verified by grep).
- `src/lib/storage/__tests__/upload-reference-validation.test.ts` — 10 vitest cases covering: MIME allowlist exactness, size cap constant, count constants, valid PNG happy path, 4 negative MIME cases, oversize reject + cap-named message, ≤0/NaN size reject, path-traversal sanitization (incl. NUL bytes + 80-char truncation), empty-filename fallback per MIME, gallery-count boundary arithmetic.

**Route (Task 2):**
- `src/app/api/style-references/upload-url/route.ts` — `POST` handler wrapped in `withApiAuth`. Imports `SLIDE_REFERENCES_BUCKET` from Plan 02 constants (no hardcoded literal — Test 8 grep-asserts) + shares `validateReferenceUpload`. Calls `supabase.storage.from(SLIDE_REFERENCES_BUCKET).createSignedUploadUrl(path)`; returns `apiSuccess({ data: {uploadUrl, token, method, headers, path} })` with NO `publicUrl` field (Test 9 asserts).
- `src/app/api/style-references/upload-url/__tests__/route.test.ts` — 9 vitest cases: happy path + path shape regex, SVG reject, 25 MB reject + cap-named message, 401 unauth gate, malformed JSON 400, path-traversal sanitization preserves `userId/` prefix, storage-error → 500, source-import assertion (constants + validator), no-`publicUrl` invariant + bucket-name assertion.

**Component (Task 3):**
- `src/components/dashboard/reference-image-uploader.tsx` — `'use client'` React component. Props: `onUploadComplete?(row)`, `onExtractRequested?(rows)`, `initial?(rows)`. Native HTML5 drag-drop on the dropzone div, hidden `<input type="file" multiple accept="...">` triggered by click. Handles fail-fast gallery-count check, per-file `validateReferenceUpload`, signed-URL mint, direct PUT to storage, thumbnail rendering with `URL.createObjectURL` + `URL.revokeObjectURL` cleanup. CTA disabled outside the 1–8 range. Tailwind utility classes for the `bg-[#fff0f0]/border-[#fadbdb]` dashboard palette (matches `WatermarkControls` styling).
- `src/components/dashboard/__tests__/reference-image-uploader.test.tsx` — 10 vitest cases (RTL + jsdom): dropzone + accept attr, click-to-add, drag-drop pipeline, 9th-image cap inline error, MIME reject inline error, oversize inline error, thumbnail render + remove revokes object URL, CTA disabled/enabled lifecycle + click does NOT call vision endpoint, ReferenceAssetRow shape with sha256 placeholder, REF-06 separation source-grep (no `/api/style-references/extract`, no `/api/(vision|gemini)`, no `@google/genai` import, no `extractStyleSpec(` call).

## Decisions Made

- **Native HTML5 drag-drop, no `react-dropzone`** — confirmed absent from package.json; CONTEXT.md recommended native; native is the correct choice (smaller surface, zero new deps).
- **`sha256` placeholder = `''` (empty string)** — Phase 73's `prepareForVision` computes the real SHA-256 of preprocessed bytes at extraction time, not upload time. Empty string is the agreed sentinel; Phase 75 will overwrite. Documented in code comment + Test C9 asserts.
- **`row.url` stores the storage path, not a blob URL** — durable reference for Phase 75 to mint signed READ URLs against later. Blob URLs are session-scoped and would die on page reload. Documented in Test C9 (asserts `row.url === 'user_123/uuid-pic.png'`, the storage path returned by the route).
- **Sanitized filename fallback uses MIME-derived extension** — `validateReferenceUpload` falls back to `reference.{png|jpg|webp|heic}` when the basename is empty or fully stripped to underscores. Keeps storage paths well-formed (no trailing dash). Test 9 covers all 4 MIME cases.

## Deviations from Plan

### 1. [Rule 3 — Blocking] Test C10 source-grep regex narrowed (kept spirit, tightened scope)

- **Found during:** Task 3 (component test C10).
- **Issue:** The plan's `<done>` criterion proposed a coarse grep — `grep -L "extract\|vision\|gemini"` — but the contracted UI surface this plan ships includes the literal "Extract style" CTA label, the `onExtractRequested` prop name, and the `data-testid="extract-style-cta"` testid. A coarse substring grep makes the contracted surface unexpressible.
- **Fix:** Narrowed Test C10's regex set to target the actual REF-06-violating signals — endpoint paths (`/api/style-references/extract`, `/api/(vision|gemini)`), LLM client imports (`@google/genai`), and direct calls to a function literally named `extractStyleSpec(` — so the contracted UI surface remains expressible while the separation invariant remains enforced. Also rewrote the JSDoc on the `onExtractRequested` prop to describe Phase 75's role in plain English (no `extractStyleSpec(...)` literal that would trip the narrow grep). The semantic guarantee is unchanged: the component cannot wire to an extraction endpoint or import a vision LLM client without failing CI.
- **Files modified:** `src/components/dashboard/__tests__/reference-image-uploader.test.tsx` (Test C10 regex set), `src/components/dashboard/reference-image-uploader.tsx` (JSDoc on `onExtractRequested`).
- **Verification:** All 10 component tests GREEN; the 4 narrowed regex assertions still hold.
- **Committed in:** `e37ba8c` (Task 3 commit — caught and fixed inside the same task).

### 2. [Rule 3 — Blocking] TDD test+feat shipped per task as a single atomic commit (RED then GREEN squashed)

- **Found during:** Task 1 (and repeated Tasks 2, 3).
- **Issue:** The PLAN's TDD framing implied separate `test(...)` and `feat(...)` commits per task. In practice, the validator/route/component are not feature-evolutions on top of pre-existing code — they're 6 brand-new files (3 prod + 3 test) where shipping the test commit alone would create a deliberately broken commit that produces no working artifact (Vitest can't even resolve the missing import). The test was written first, run to confirm RED (import resolution failure), then implementation was written to take it to GREEN — but both were committed together to keep the history bisectable to a runnable state at every commit boundary.
- **Fix:** Committed one `feat(74-03): …` per task with both the test file and the implementation file together. RED was demonstrated in the executor log (vitest "Failed to resolve import" before each implementation file was written) but not committed in isolation.
- **Files modified:** None — this is a process choice, not a code change.
- **Verification:** Each task's commit is bisectable to a `vitest run` GREEN state.
- **Committed in:** `8c17d16`, `4f0ad51`, `e37ba8c`.

---

**Total deviations:** 2 (both Rule 3 — Blocking, both internal to the executor's TDD discipline). No scope creep, no architectural drift.
**Impact on plan:** None on the shipped surface. Both deviations are about how the plan was executed, not what shipped.

## Issues Encountered

- **`extractStyleSpec` literal in JSDoc tripped Test C10's narrowed grep.** The JSDoc on `onExtractRequested` originally read "Phase 75 wires this to `extractStyleSpec({ projectId, rows })`" — the narrowed grep regex `/\bextractStyleSpec\s*\(/` matched the JSDoc literal. Fixed by rewriting the JSDoc to describe Phase 75's role in plain English. The fix was caught + applied within the same task.
- **No other issues.** TSC clean on all 6 plan files (verified via `npx tsc --noEmit | grep …` returning empty for all four file-path patterns owned by this plan). The pre-existing TSC errors in `__tests__/auth/middleware.test.ts`, `__tests__/projects/crud.test.ts`, `__tests__/stripe/sync-subscription.test.ts`, and a few other older test files are out of scope for this plan (logged below for the next housekeeping pass — they appear to be vitest 4.x type-shape regressions unrelated to Plan 03).

## Plan Invariants — Verification Log

- ✅ All 29 tests GREEN: `npx vitest run src/lib/storage/__tests__/upload-reference-validation.test.ts src/app/api/style-references/upload-url/__tests__/route.test.ts src/components/dashboard/__tests__/reference-image-uploader.test.tsx` → `Test Files 3 passed (3) | Tests 29 passed (29)`.
- ✅ TSC clean on all plan files: `npx tsc --noEmit | grep -E "src/(components/dashboard/(reference-image-uploader|__tests__/reference-image)|app/api/style-references|lib/storage/(upload-reference|__tests__/upload-reference))"` → empty.
- ✅ REF-06 separation: `grep -E "/api/style-references/extract|/api/(vision|gemini)|@google/genai|extractStyleSpec\\(" src/components/dashboard/reference-image-uploader.tsx` → empty.
- ✅ No `react-dropzone` added: `grep -c react-dropzone package.json` → `0`.
- ✅ Bucket name imported (not hardcoded) in route: `grep -E "['\"]slide-references['\"]" src/app/api/style-references/upload-url/route.ts` → empty.
- ✅ No `react`/`next` imports in shared validator (runtime-agnostic): `grep -E "^import.*('react'|'next/)" src/lib/storage/upload-reference-validation.ts` → empty.
- ✅ Defense-in-depth: route + component both import `validateReferenceUpload` from the same module (verified by Test 8 in the route test).
- ✅ Bucket-private invariant: route response has no `publicUrl` field (Test 9 asserts `expect(body.data).not.toHaveProperty('publicUrl')`).

## Phase 75 / Phase 76 Handoff

```tsx
// Phase 75 (style extraction) + Phase 76 (UI launcher page) both consume:
<ReferenceImageUploader
  // Phase 76 server action: persists row to projects.reference_assets (REF-07)
  onUploadComplete={(row) => persistReferenceRow(projectId, row)}
  // Phase 75 endpoint: extracts StyleSpec from the uploaded references
  onExtractRequested={(rows) => extractStyleSpec({ projectId, rows })}
/>

// Phase 75 also needs to mint signed READ URLs (because the bucket is PRIVATE):
const { data } = await admin.storage
  .from(SLIDE_REFERENCES_BUCKET)
  .createSignedUrl(row.url /* = path */, 600 /* 10 min for vision call */)
```

## Next Phase Readiness

- Reference upload pipeline ships with all five owned REF requirements complete (REF-02 through REF-06).
- Phase 75 has a stable extraction trigger (`onExtractRequested(rows: ReferenceAssetRow[])`) — the rows handed to the callback already have all 6 fields of `ReferenceAssetRow` (`url`/`sha256`/`uploaded_at`/`mime_type`/`size_bytes`/`original_filename`); Phase 75 only needs to overwrite `sha256` after `prepareForVision` computes it.
- Phase 76 has a stable provenance hook (`onUploadComplete(row)`) — fires per-upload, regardless of whether the user ever clicks Extract; provenance is preserved on abandonment.
- REF-01 (slide-references bucket creation in supabase migrations) and REF-07 (projects.reference_assets JSONB column) shipped in Plan 02; this plan consumes those + closes the loop on the user-facing surface.

## Self-Check: PASSED

**Files exist (created by this plan):**
- ✅ `src/lib/storage/upload-reference-validation.ts`
- ✅ `src/lib/storage/__tests__/upload-reference-validation.test.ts`
- ✅ `src/app/api/style-references/upload-url/route.ts`
- ✅ `src/app/api/style-references/upload-url/__tests__/route.test.ts`
- ✅ `src/components/dashboard/reference-image-uploader.tsx`
- ✅ `src/components/dashboard/__tests__/reference-image-uploader.test.tsx`

**Commits exist (in git log):**
- ✅ `8c17d16` feat(74-03): shared upload-reference-validation module (REF-03/REF-04/REF-05)
- ✅ `4f0ad51` feat(74-03): POST /api/style-references/upload-url signed-URL route (REF-02)
- ✅ `e37ba8c` feat(74-03): ReferenceImageUploader component (REF-02..REF-06)

---
*Phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline*
*Plan: 03*
*Completed: 2026-05-10*
