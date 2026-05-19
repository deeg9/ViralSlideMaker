---
phase: 76-spec-preview-ui-per-aspect-controls-re-extract-recovery
plan: 01
subsystem: ui
tags: [react, useReducer, state-machine, server-actions, supabase-storage, vitest, testing-library, source-grep-firewall]

# Dependency graph
requires:
  - phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline
    provides: ReferenceImageUploader component + ReferenceAssetRow type + slide-references bucket constant
  - phase: 75-vision-extraction-two-phase-architecture-safety-config
    provides: extractStyleSpec orchestrator + ExtractResult discriminated union + RefusalFlags + ExtractTelemetry
provides:
  - dashboard route /dashboard/style-from-reference/new (server-component shell + client island)
  - extractStyleSpecAction Server Action (auth + Storage hydrate + tier map + Phase 75 pass-through)
  - regenerateAction Phase 77 placeholder seam
  - specPreviewReducer + initialSpecPreviewState (pure-function state machine)
  - StyleFromReferenceShell client island composing uploader + sticky strip + spec-preview panel
  - StickyReferenceStrip rendered outside conditional blocks (PREVIEW-09)
  - SpecPreviewPanel skeleton with slot testids + Generate/Re-extract CTAs (PREVIEW-01 invariant owner)
  - source-grep firewall test enforcing PREVIEW-01 invariant + LEGAL-03 forward-compat copy gate
affects: [76-02, 76-03, 77, 79]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reducer-as-invariant-defense: GENERATE_CLICK from non-preview status is a pure no-op + error setter, making PREVIEW-01 structurally enforceable in addition to view-layer guards"
    - "Source-grep firewall test: read shell file as text and assert structural invariants (no Generate CTA outside preview-gated subtree, no Gemini SDK import in Server Action) — drift-resistant alternative to view-layer assertions"
    - "Slot-with-testid skeleton: parent component renders empty mount points with documented testids; downstream waves fill the slots without modifying the parent's structural contract"
    - "Pass-through Server Action: Phase 75's discriminated-union ExtractResult is returned UNCHANGED; the client routes per result.ok / result.error, keeping error taxonomy single-sourced"
    - "Test isolation via mockReset() of per-call queues: vi.clearAllMocks() preserves mockReturnValue but does NOT clear mockResolvedValueOnce queues — prior tests can bleed unconsumed returns; targeted mockReset() drains them"

key-files:
  created:
    - src/components/style-from-reference/state-machine.ts
    - src/components/style-from-reference/style-from-reference-shell.tsx
    - src/components/style-from-reference/sticky-reference-strip.tsx
    - src/components/style-from-reference/spec-preview-panel.tsx
    - src/components/style-from-reference/__tests__/state-machine.test.ts
    - src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx
    - src/app/(dashboard)/style-from-reference/actions.ts
    - src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts
    - src/app/(dashboard)/style-from-reference/new/page.tsx
  modified: []

key-decisions:
  - "PREVIEW-01 enforced at TWO layers: (a) reducer rejects GENERATE_CLICK from any non-preview status with error='preview-required'; (b) shell renders SpecPreviewPanel ONLY behind state.status==='preview' guard. Source-grep test reads the shell file as text and fails any future refactor that hoists Generate CTA outside the preview subtree."
  - "Brand-kit-availability hydration via useEffect + BRAND_KIT_AVAILABILITY action (rather than passing prop through reducer's initialState arg) — keeps initialState fully serializable and avoids reducer-prop coupling."
  - "Storage hydration in Server Action uses admin (service-role) client because Phase 75's ExtractInput contract expects the admin client to flow through to the rate-cap RPC, AND the slide-references bucket per-user folder structure means user-scoped client could only download own refs anyway — admin matches the contract."
  - "regenerateAction is a documented Phase 77 placeholder shape ({ ok: false, error: 'not_implemented', detail: 'Phase 77 will wire the emit path' }) — Plan 76-03 wires the Generate CTA to it today; Phase 77 swaps the body without changing the seam."
  - "SpecPreviewPanel ships with empty slot mount-point divs (palette-slot, typography-slot, layout-slot, voice-note-slot, aspects-slot, brand-kit-slot, credit-cost-slot) — Plans 76-02/76-03 fill the slot CONTENT without modifying the structural contract or the reducer-driven Generate/Re-extract CTAs. File ownership stays with 76-01."
  - "Refusal warning is non-blocking BUT Generate CTA is gated until refusalAcknowledged=true when ANY ref has flags (PREVIEW-10 'confirm-and-continue'). Reducer + SpecPreviewPanel collaborate: dispatch CONFIRM_REFUSAL_WARNING flips the ack flag; SpecPreviewPanel reads refusalFlags + refusalAcknowledged to compute generateDisabled."

patterns-established:
  - "Reducer-as-invariant-defense: structural invariants (PREVIEW-01) live in the reducer as no-op transitions, NOT in view-layer if-statements that future refactors can drift through"
  - "Source-grep firewall test pattern: read source file as text (fs.readFileSync), assert structural regex invariants. Used for (a) PREVIEW-01 (no generate-cta testid in shell file), (b) Gemini-SDK firewall (no @google/genai import in Server Action), (c) LEGAL-03 forward-compat (no mimicry-framing tokens in shell-owned files), (d) 'use server' first non-empty non-comment line in actions.ts."
  - "Skeleton-with-slots panel pattern: parent component renders empty mount points with documented testids; downstream waves fill the slots without modifying the parent's structural contract"
  - "Discriminated-union pass-through Server Action: do NOT re-shape Phase 75's ExtractResult; the client narrows on result.ok and routes per result.error tag — keeps error taxonomy single-sourced"
  - "Per-call queue draining in beforeEach: when a test queues multiple mockResolvedValueOnce returns, vi.clearAllMocks() preserves the queue; use mockReset() on the specific mocks to drain it"

requirements-completed: [PREVIEW-01, PREVIEW-09]

# Metrics
duration: 10min
completed: 2026-05-10
---

# Phase 76 Plan 01: Spec-Preview Shell + State Machine + Server Action Summary

**Reducer-enforced PREVIEW-01 invariant + Server-Action seam to Phase 75 + sticky-strip-anchored shell that Plans 76-02/76-03 fill without re-architecting.**

## Performance

- **Duration:** ~10 min (1778456423 → 1778457022)
- **Started:** 2026-05-10T23:40:23Z
- **Completed:** 2026-05-10T23:50:23Z
- **Tasks:** 3
- **Files created:** 9 (4 components + 1 reducer + 1 action + 3 test files + 1 page)
- **Files modified:** 0

## Accomplishments

- **PREVIEW-01 invariant ships at two layers.** The `specPreviewReducer` rejects `GENERATE_CLICK` from any non-preview status with `error='preview-required'` AND the shell renders `<SpecPreviewPanel>` only behind a `state.status === 'preview'` guard. The source-grep test (Test 5) reads the shell file as text and asserts both invariants — drift-resistant against future refactors.
- **Server Action wraps Phase 75 with the auth + Storage hydrate + tier-map seam** the UI needed, returning the ExtractResult discriminated union UNCHANGED so Plan 76-03 can route `safety_blocked` / `cap_reached` / `insufficient_credits` / `extraction_failed` to the right recovery surface without re-shaping.
- **Sticky reference strip is rendered OUTSIDE the conditional spec-preview block** (PREVIEW-09), preserving the user-input → extracted-spec link across every status transition (idle / extracting / preview / generating / done / error).
- **SpecPreviewPanel skeleton owns the Generate + Re-extract CTAs** (because their enable/disable + click handlers are reducer-driven invariants) and exposes empty slot mount-points with stable testids that Plans 76-02 + 76-03 fill in their own waves.
- **regenerateAction Phase 77 placeholder** is documented and seam-stable; Plan 76-03 can wire the Generate CTA today, Phase 77 swaps the body.
- **31 tests GREEN**: 14 reducer transitions (Test 1–14), 8 Server Action behaviors (Test 1–8 incl. firewall grep gate), 9 shell composition tests (Test 1–9 incl. PREVIEW-01 source-grep + LEGAL-03 forward-compat copy gate).

## Task Commits

Each task followed strict TDD (RED test commit then GREEN implementation commit):

1. **Task 1: State machine + invariant tests**
   - `0b8ea85` (test) — 14 failing reducer tests pinning every transition + the PREVIEW-01 invariant
   - `9a1b8e0` (feat) — `specPreviewReducer` + `initialSpecPreviewState` with exhaustive switch and `_exhaustive: never` discriminated-union compile-time check
2. **Task 2: Server Action wrapper + auth/storage-fetch tests**
   - `beb7497` (test) — 8 failing Server Action tests (auth gate, empty refs, Storage failure, happy path, tier mapping, error pass-through, regenerate stub, firewall grep gate)
   - `191f677` (feat) — `extractStyleSpecAction` + `regenerateAction` (also tightened test isolation: `mockReset()` of per-call queues)
3. **Task 3: Page shell + sticky strip + spec-preview slot + composition tests**
   - `b9e69c5` (test) — 9 failing shell composition tests (incl. PREVIEW-01 source-grep gate Test 5 + LEGAL-03 forward-compat Test 9)
   - `2ac4dd1` (feat) — `StyleFromReferenceShell` + `StickyReferenceStrip` + `SpecPreviewPanel` skeleton + `/dashboard/style-from-reference/new/page.tsx`

## Files Created/Modified

- `src/components/style-from-reference/state-machine.ts` — pure reducer; 6 statuses, 14 actions, exhaustiveness check
- `src/components/style-from-reference/style-from-reference-shell.tsx` — client island; useReducer + Extract/Re-extract handlers calling Server Action
- `src/components/style-from-reference/sticky-reference-strip.tsx` — sticky thumbnail strip with `slotPerReference` extension point for Plan 76-03
- `src/components/style-from-reference/spec-preview-panel.tsx` — skeleton with slot testids + reducer-driven Generate/Re-extract CTAs
- `src/components/style-from-reference/__tests__/state-machine.test.ts` — 14 reducer transition + invariant tests
- `src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx` — 9 composition tests incl. source-grep firewall + LEGAL-03 copy gate
- `src/app/(dashboard)/style-from-reference/actions.ts` — Server Action wrapping Phase 75; `'use server'` first line; zero Gemini SDK imports
- `src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts` — 8 action tests with mocked Phase 75
- `src/app/(dashboard)/style-from-reference/new/page.tsx` — server-component route shell with auth redirect + brandKit fetch

## Decisions Made

All key decisions documented in frontmatter `key-decisions`. Highlights:

- **Two-layer PREVIEW-01 enforcement (reducer + view-layer + source-grep test).** Even if a future refactor leaks the Generate CTA into a non-preview subtree, the reducer no-ops the dispatch AND the source-grep test fails CI. Belt-and-braces because PREVIEW-01 is the load-bearing UX defense for v2.13.
- **Slot skeleton pattern.** SpecPreviewPanel ships empty mount-points with stable testids so Plans 76-02 + 76-03 can fill the slot CONTENT in their own waves without modifying the parent's structural contract. The Generate + Re-extract CTAs stay with 76-01 because their enable/disable rules are reducer-driven invariants.
- **Pass-through ExtractResult.** Server Action returns Phase 75's discriminated union UNCHANGED. Plan 76-03 will narrow on `result.error` to route `safety_blocked` (with `recovery_suggestion`) vs `cap_reached` (with `RateCapResult`) vs `extraction_failed` to the right recovery surface.
- **regenerateAction is a documented seam.** `{ ok: false, error: 'not_implemented', detail: 'Phase 77 will wire the emit path' }` lets Plan 76-03 wire the Generate CTA today; Phase 77 replaces the body.

## Deviations from Plan

None of substance. One small test-isolation adjustment was needed mid-Task-2:

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test isolation: `vi.clearAllMocks()` does not drain `mockResolvedValueOnce` queues**
- **Found during:** Task 2 (Test 5 tier-mapping regression)
- **Issue:** Test 5 queues 3 sequential `mockResolvedValueOnce` returns for each of `mockGetUser` / `mockGetUserTier` / `mockStorageDownload` / `mockExtractStyleSpec`. The original `beforeEach` used `vi.clearAllMocks()` which preserves `mockReturnValue` (good — keeps `createClient` / `createAdminClient` stubs intact) but does NOT clear queued one-time returns. Unconsumed returns from prior tests bled into Test 5 and caused tier-mapping assertions to fail.
- **Fix:** Tightened `beforeEach` to call `mockReset()` on the four per-call mocks (`mockGetUser`, `mockStorageDownload`, `mockGetUserTier`, `mockExtractStyleSpec`) while keeping `vi.clearAllMocks()` for global call-history clearing. Documented the gotcha inline.
- **Files modified:** `src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts`
- **Verification:** Test 5 passes; full action suite 8/8 GREEN; pattern documented in `tech-stack.patterns` for future test authors.
- **Committed in:** `191f677` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] LEGAL-03 self-trip in header comments**
- **Found during:** Task 3 (Test 9 forward-compat copy gate)
- **Issue:** Initial header comments in `style-from-reference-shell.tsx`, `sticky-reference-strip.tsx`, and `spec-preview-panel.tsx` literally listed the forbidden tokens (`exactly like / clone / copy this style / duplicate`) to document the policy — which then tripped the very gate they described.
- **Fix:** Rewrote each header to reference "forbidden mimicry-framing tokens" generically and pointed readers at the test file for the exact regex list. Test 9 now passes with zero literal forbidden-token occurrences in shell-owned files.
- **Files modified:** all three component files
- **Verification:** Test 9 passes; full shell suite 9/9 GREEN.
- **Committed in:** `2ac4dd1` (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs in test infrastructure / doc-comment self-trips)
**Impact on plan:** Both fixes were essential to land GREEN tests with the documented invariants. No scope creep. Test isolation pattern documented for downstream waves.

## Issues Encountered

- **Pre-existing TypeScript errors in unrelated test files** (`src/__tests__/auth/*.test.ts`, `src/__tests__/api/api-keys.test.ts`, `src/__tests__/projects/crud.test.ts`, `src/__tests__/stripe/*`, `src/components/editor/__tests__/slide-editor.treatment-sync.test.tsx`, `src/lib/services/__tests__/projects-delete.test.ts`) — these are out of scope per the SCOPE BOUNDARY rule. They predate Plan 76-01 and do not affect the Vercel build (per recent commit `539d9fa fix: Vercel build lint errors`). Logged here for visibility; not addressed.
- **No issues with the actual plan work.** All 31 plan tests GREEN on first GREEN run after each TDD cycle (modulo the two documented deviations).

## Next Phase Readiness

- **Plan 76-02 (Wave 2) is unblocked** — every slot testid it needs is in place: `palette-slot`, `typography-slot`, `layout-slot`, `voice-note-slot`, `aspects-slot`, `brand-kit-slot`, `credit-cost-slot`. The reducer exposes `state.spec`, `state.aspects`, `state.useBrandKitRemix`, `state.brandKitAvailable`, and `dispatch({ type: 'TOGGLE_ASPECT'|'TOGGLE_BRAND_KIT_REMIX' })` for the per-aspect controls + brand-kit toggle.
- **Plan 76-03 (Wave 2) is unblocked** — `error-mount` slot is exposed in the shell with `data-error-kind` for routing; `StickyReferenceStrip` accepts a `slotPerReference` callback for inline refusal-warning chips; `SpecPreviewPanel` accepts a `refusalWarningSlot` ReactNode prop. The reducer exposes `state.refusalFlags`, `state.refusalAcknowledged`, and `dispatch({ type: 'CONFIRM_REFUSAL_WARNING' })`.
- **Phase 77 (emit integration) is unblocked at the seam** — `regenerateAction` is the documented placeholder; the reducer's `generating` and `done` states + `GENERATE_DONE` action are already wired so Phase 77 only needs to swap `regenerateAction`'s body.
- **Phase 79 (legal grep gate) is partially front-run** — the LEGAL-03 forward-compat in-file gate (Test 9 in this plan) catches drift in the four shell-owned files Phase 76-01 created; Phase 79 will land the project-wide gate.

## Self-Check: PASSED

Verified all claimed artifacts exist and all claimed commits are reachable:

**Files created (9/9 found):**
- `src/components/style-from-reference/state-machine.ts` — FOUND
- `src/components/style-from-reference/style-from-reference-shell.tsx` — FOUND
- `src/components/style-from-reference/sticky-reference-strip.tsx` — FOUND
- `src/components/style-from-reference/spec-preview-panel.tsx` — FOUND
- `src/components/style-from-reference/__tests__/state-machine.test.ts` — FOUND
- `src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx` — FOUND
- `src/app/(dashboard)/style-from-reference/actions.ts` — FOUND
- `src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts` — FOUND
- `src/app/(dashboard)/style-from-reference/new/page.tsx` — FOUND

**Commits (6/6 reachable in `git log --oneline`):**
- `0b8ea85` — FOUND (test: failing reducer tests)
- `9a1b8e0` — FOUND (feat: specPreviewReducer)
- `beb7497` — FOUND (test: failing Server Action tests)
- `191f677` — FOUND (feat: extractStyleSpecAction + regenerateAction)
- `b9e69c5` — FOUND (test: failing shell composition tests)
- `2ac4dd1` — FOUND (feat: shell + sticky strip + SpecPreviewPanel skeleton + page)

**Verification gates:**
- `npx vitest run src/components/style-from-reference src/app/(dashboard)/style-from-reference` → 31/31 GREEN
- `grep -c "@google/genai" src/app/(dashboard)/style-from-reference/actions.ts` → `0` (firewall holds)
- `grep -c 'data-testid="generate-cta"' src/components/style-from-reference/style-from-reference-shell.tsx` → `0` (PREVIEW-01 source-grep gate holds)
- `npx tsc --noEmit` for new files → clean (only pre-existing unrelated errors remain)

---
*Phase: 76-spec-preview-ui-per-aspect-controls-re-extract-recovery*
*Completed: 2026-05-10*
