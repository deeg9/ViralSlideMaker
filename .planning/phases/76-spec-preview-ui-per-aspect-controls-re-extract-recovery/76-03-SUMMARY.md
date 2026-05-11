---
phase: 76-spec-preview-ui-per-aspect-controls-re-extract-recovery
plan: 03
subsystem: ui
tags: [react, vitest, testing-library, jsdom, error-routing, recovery-ux, refusal-framing, source-grep-firewall, accessibility, legal-03-forward-compat]

# Dependency graph
requires:
  - phase: 76-spec-preview-ui-per-aspect-controls-re-extract-recovery
    plan: 01
    provides: SpecPreviewPanel skeleton with refusalWarningSlot prop + reducer state.refusalFlags/refusalAcknowledged/error/retriesRemaining + StickyReferenceStrip slotPerReference extension point + initialSpecPreviewState contract (retriesRemaining=2 default, UPLOAD_RESET resets to 2)
  - phase: 76-spec-preview-ui-per-aspect-controls-re-extract-recovery
    plan: 02
    provides: SpecPreviewPanel slot fills (PREVIEW-02..06+08+11); panel-level Generate disable predicates (refusalAcknowledgedOrAbsent + hasAtLeastOneAspect) UNTOUCHED; PerAspectToggles owns the no-aspects-selected hint
  - phase: 75-vision-extraction-two-phase-architecture-safety-config
    provides: ExtractError discriminated union with safety_blocked + recovery_suggestion field; RefusalFlags interface
provides:
  - RefusalWarning (PREVIEW-10) — inline chip beside flagged sticky-strip thumbnails with verbatim "Inspired by" framing copy + Continue button dispatching CONFIRM_REFUSAL_WARNING
  - SafetyBlockRecovery (PREVIEW-12) — full-panel surface that REPLACES the spec-preview panel when extract returns safety_blocked; surfaces Phase 75 recovery_suggestion + 3 affordances (Try-different-image / Describe-in-text disabled stub / guidance bullets)
  - ErrorRouter — switches by state.error.kind to specific recovery surfaces (no generic "Something went wrong"); routes safety_blocked → SafetyBlockRecovery; cap_reached + insufficient_credits → /pricing links; extraction_failed → CLEAR_ERROR Try-again; no-retries-left → UPLOAD_RESET []; reducer-guard kinds → inline hints; no-aspects-selected → null (PerAspectToggles owns it)
  - Re-extract counter visibility wiring (PREVIEW-07) — verified in integration tests (decrement-on-click invariant; counter visible at 2 / disabled at 0; no render-time decrement)
  - Dashboard "From references" CTA — entry-point Link card on /dashboard linking to /dashboard/style-from-reference/new
affects: [77]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dispatch-as-only-action: every recovery affordance dispatches a reducer action — no setState, no useEffect side effects in the recovery components. UPLOAD_RESET []  (Try-different-image), CLEAR_ERROR (Try-again), CONFIRM_REFUSAL_WARNING (Continue). Keeps the state machine the single source of truth for what the user has done."
    - "Verbatim CONTEXT.md framing copy as a load-bearing string: RefusalWarning hard-codes 'inspired by the style, not the brand identity' (PREVIEW-10 spec). A per-file LEGAL-03 grep test asserts the literal substring is present AND zero forbidden tokens. Phase 79's project-wide grep gate has nothing to fix in this surface."
    - "Disabled-affordance-with-tooltip pattern for forward-compat features: the 'Describe in text' button on SafetyBlockRecovery renders today as disabled + sr-only tooltip ('Coming in the next update'). Users SEE the alternative path exists; Phase 77 enables it. NO scope reduction — the affordance ships, just gated."
    - "Slot-callback null-guard at the mount: shell's slotPerReference returns null when refusalFlags[idx] is missing OR has zero positive hits. The chip itself ALSO returns null in the same condition (defense in depth). Two layers, same condition — protects against future misuse where someone passes RefusalWarning without checking the guard."
    - "TS exhaustiveness check on ErrorRouter switch: default branch assigns state.error.kind to a never-typed const. Adding a new ErrorKind member to state-machine.ts without a router case fails this assignment at compile time — the router can't silently miss a kind."
    - "Source-grep tests as test strategy when component-render is too noisy: dashboard/page.tsx is a server component with supabase + ensureSubscription side effects. Mocking that whole stack to render in jsdom adds noise without catching real bugs. A source-grep on the page file (link href + testid + LEGAL-03 grep) is the right granularity."
    - "Test-update-not-bug: Plan 76-01 Test 7 asserted the placeholder error-mount testid that Plan 76-03 was contractually required to remove (76-01 SUMMARY explicitly noted error-mount belonged to 76-03). The test was updated in this plan to assert the new behavior (SafetyBlockRecovery present + spec-preview absent on safety_blocked) — same intent at a different testid. Documented as Rule 1 deviation for traceability."

key-files:
  created:
    - src/components/style-from-reference/refusal-warning.tsx
    - src/components/style-from-reference/safety-block-recovery.tsx
    - src/components/style-from-reference/error-router.tsx
    - src/components/style-from-reference/__tests__/refusal-warning.test.tsx
    - src/components/style-from-reference/__tests__/safety-block-recovery.test.tsx
    - src/components/style-from-reference/__tests__/error-router.test.tsx
    - src/components/style-from-reference/__tests__/recovery-integration.test.tsx
    - src/components/style-from-reference/__tests__/dashboard-cta-smoke.test.tsx
  modified:
    - src/components/style-from-reference/style-from-reference-shell.tsx
    - src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx
    - src/app/(dashboard)/dashboard/page.tsx

key-decisions:
  - "ErrorRouter uses TS exhaustiveness check (default-never assignment) so any future ErrorKind member added without a router case fails at compile time. The reducer's ErrorKind union is the single source of truth; the router subscribes to it structurally."
  - "Refusal warning chip placement: positioned absolute below each flagged thumbnail with translate-y-full so it sits OUTSIDE the 12x12 thumbnail box (which has overflow-hidden for the rounded image). Larger min-width with text wrap so the verbatim PREVIEW-10 framing copy reads cleanly without overflow."
  - "SafetyBlockRecovery REPLACES the spec-preview panel (not a sibling banner). The reducer naturally enforces this: EXTRACT_ERROR transitions extracting → error (NOT extracting → preview), and the shell's SpecPreviewPanel render is gated on status === 'preview'. Recovery-integration Test 11 + shell Test 7 (updated) both verify the replacement invariant from different angles."
  - "Describe-in-text affordance ships now as a disabled button + tooltip rather than being deferred. Visible affordance + 'Coming in the next update' indicator = users see the path exists; Phase 77 enables it. NO scope reduction — the surface ships per CONTEXT.md PREVIEW-12."
  - "Updated Plan 76-01 shell Test 7 to assert the new behavior. The test originally expected the placeholder error-mount testid; Plan 76-03's contract removes that placeholder and replaces it with ErrorRouter. The 76-01 SUMMARY (and 76-02 SUMMARY 'Next Phase Readiness' section) explicitly noted error-mount belonged to 76-03 — this update was anticipated. Same test intent (safety_blocked surface present + spec-preview absent), updated assertion targets (safety-block-recovery testid + recovery-suggestion-text)."
  - "Dashboard CTA placement: between Welcome Header and Summary Cards. First-visit discoverability without crowding the existing project-creation affordance. Card-style visual treatment matches neighboring summary cards. Material Symbols 'image' icon for instant visual cue."
  - "Source-grep tests for the dashboard CTA. The page is a server component with multiple supabase + ensureSubscription + brand-kit side effects; jsdom rendering would mock most of the page without catching the wiring bug we want to prevent (link missing / wrong href / forbidden copy). 4 source-grep tests cover href + testid + reference-keyword + LEGAL-03."

requirements-completed: [PREVIEW-07, PREVIEW-10, PREVIEW-12]

# Metrics
duration: 8min
completed: 2026-05-11
---

# Phase 76 Plan 03: Recovery Surfaces — RefusalWarning + SafetyBlockRecovery + ErrorRouter + Re-Extract Wiring + Dashboard CTA

**Three new recovery components close Pitfalls 6 + 7 inside the v2.13 surface: every error kind gets a specific surface, every flagged reference gets an inline "Inspired by"-framing chip, the safety-block UX replaces the spec-preview with actionable guidance, and the dashboard now exposes the entry point. PREVIEW-01 single-CTA invariant + LEGAL-03 forward-compat clean across the whole Phase 76 surface.**

## Performance

- **Duration:** ~7m 51s (1778458000 → 1778458471)
- **Started:** 2026-05-11T00:06:40Z
- **Completed:** 2026-05-11T00:14:31Z
- **Tasks:** 3 (full TDD: 3 RED commits + 3 GREEN commits = 6 commits)
- **Files created:** 8 (3 components + 5 test files)
- **Files modified:** 3 (shell + shell test + dashboard page)

## Accomplishments

- **All 3 PREVIEW requirements in this plan's scope have visible UI surfaces verified by tests.** PREVIEW-07 (Re-extract counter visibility + decrement-on-click invariant), PREVIEW-10 (inline refusal warning chip with verbatim "Inspired by" framing), PREVIEW-12 (full SafetyBlockRecovery panel REPLACING the spec-preview when extract returns safety_blocked).
- **ErrorRouter ships with TS exhaustiveness — every user-facing ErrorKind has a specific surface.** No generic "Something went wrong" anywhere. Pitfall 6 (no path to try again on bad extraction) and Pitfall 7 (safety-block as generic error = catastrophic for fitness/lifestyle/fashion users) are closed inside the v2.13 surface. Adding a new ErrorKind to state-machine.ts without a router case fails TypeScript at compile time.
- **PREVIEW-01 invariant preserved.** SpecPreviewPanel still renders the Generate CTA exactly once (verified by source-grep gate). The reducer-driven disable predicates are UNTOUCHED. Plan 76-03 only added a new wiring at the shell level (slotPerReference + ErrorRouter) without touching the load-bearing structural contract.
- **PREVIEW-12 replacement invariant verified from two angles.** Shell Test 7 (updated): on safety_blocked, SafetyBlockRecovery is present AND SpecPreviewPanel is absent. Recovery-integration Test 11: same assertion at a different testid with explicit recovery_suggestion verbatim check. Two layers say the same thing — defends the "REPLACES the spec-preview" contract against silent UX drift.
- **PREVIEW-07 retry counter wiring verified end-to-end.** Test 12 (counter visible at 2 / disabled at 0). Test 13 (decrement-on-click invariant: a render with the same retriesRemaining shows the same count — no render-time decrement; reducer owns the decrement on RE_EXTRACT_CLICK).
- **PREVIEW-10 sticky-strip placement + ack flow verified.** Test 9 (refusal-warning chip is a child of the matching sticky-thumbnail container by index). Test 16 (end-to-end: extract → flagged ref → Generate disabled → click Continue inside the chip → Generate enables AND chip shows Acknowledged badge AND Continue button is gone).
- **30 new tests GREEN across 5 test files**: 7 (RefusalWarning) + 7 (SafetyBlockRecovery) + 8 (ErrorRouter) + 8 (recovery-integration) + 4 (dashboard-cta-smoke) = 34. Combined with prior 76-01 + 76-02 tests, **112/112 Phase 76 tests GREEN** (108 in `src/components/style-from-reference` + 4 in `src/app/(dashboard)/style-from-reference`).
- **LEGAL-03 forward-compat across every modified or created file: zero forbidden mimicry-framing tokens** (`exactly like / clone / copy this style / duplicate`) verified by per-file grep tests AND a project-level final grep across all 13 `src/components/style-from-reference/*.tsx` files plus `src/app/(dashboard)/dashboard/page.tsx`. Phase 79's project-wide gate has nothing to fix in this surface.
- **Zero TypeScript regressions** in any new or modified file (`npx tsc --noEmit` clean for the entire Phase 76 surface).
- **Lint gate green:** `npm run lint:gates` (Phase 74 closed-enum invariant) still passes — Plan 76-03 did not touch the StyleSpec types.

## Task Commits

Each task followed strict TDD: RED test commit then GREEN implementation commit.

1. **Task 1: RefusalWarning + SafetyBlockRecovery (PREVIEW-10/12)**
   - `87d8db0` (test) — 14 failing tests (7 RefusalWarning + 7 SafetyBlockRecovery)
   - `a912f5f` (feat) — 2 new component files; 15/15 GREEN (1 extra Test 4 split-out for SafetyBlockRecovery contract verification)
2. **Task 2: ErrorRouter + shell wiring + sticky strip + Re-extract verification (PREVIEW-07/10/12)**
   - `45d3313` (test) — 16 failing tests (8 ErrorRouter + 8 recovery-integration)
   - `68c19d7` (feat) — ErrorRouter component + shell modifications (replace ErrorMount placeholder with ErrorRouter, pass slotPerReference to StickyReferenceStrip, removed obsolete unused SpecPreviewState import); also updated 76-01 shell Test 7 to match the new contract; 61/61 GREEN
3. **Task 3: Dashboard "From references" CTA**
   - `e3c007d` (test) — 4 source-grep tests (3 RED + 1 already-GREEN as forward-compat guard)
   - `3abe01d` (feat) — Card-style Link in `dashboard/page.tsx` between Welcome and Summary sections; 4/4 GREEN

## Files Created/Modified

**Components (3 new files, all `'use client'`):**
- `refusal-warning.tsx` — inline chip beside flagged thumbnails; renders null when no positive flags; verbatim "Inspired by" framing copy from CONTEXT.md PREVIEW-10; Continue button dispatches CONFIRM_REFUSAL_WARNING; swaps to Acknowledged badge after ack; role=alert + aria-live=polite
- `safety-block-recovery.tsx` — full-panel surface with shield icon + heading + framing paragraph + recovery_suggestion verbatim block + 3-bullet guidance + 2 CTAs (Try-different-image dispatching UPLOAD_RESET []; Describe-in-text disabled stub + sr-only tooltip); role=region + aria-label
- `error-router.tsx` — switch by state.error.kind with TS-exhaustiveness default-never; routes safety_blocked → SafetyBlockRecovery; cap_reached + insufficient_credits → panels with /pricing links; extraction_failed → Try-again (CLEAR_ERROR); no-retries-left → Start-over (UPLOAD_RESET []); reducer-guard kinds → inline hints; no-aspects-selected → null

**Tests (5 new files, 34 tests total):**
- `refusal-warning.test.tsx` — 7 tests: null-render, "Inspired by" framing, multi-flag dedup, dispatch, ack-badge, a11y, LEGAL-03 grep
- `safety-block-recovery.test.tsx` — 7 tests: panel render, recovery_suggestion verbatim, Try-different-image dispatch (UPLOAD_RESET []), Describe-in-text disabled+tooltip, guidance bullets, region role, LEGAL-03 grep
- `error-router.test.tsx` — 8 tests: null state, all 6 user-facing error kinds with their specific surfaces + dispatch actions, no-aspects-selected → null, LEGAL-03 grep
- `recovery-integration.test.tsx` — 8 tests: sticky-strip refusal chip placement (Test 9), Generate gating on refusalAcknowledged (Test 10), spec-preview replaced by SafetyBlockRecovery (Test 11), retry counter visible + disabled at 0 (Test 12), decrement-on-click invariant (Test 13), error-mount placeholder removed (Test 14), PREVIEW-01 single-CTA holds (Test 15), end-to-end ack flow via shell (Test 16)
- `dashboard-cta-smoke.test.tsx` — 4 source-grep tests: link href + testid + reference-keyword copy + LEGAL-03 grep

**Modified:**
- `style-from-reference-shell.tsx` — added 2 imports (ErrorRouter + RefusalWarning); replaced placeholder ErrorMount stub with `<ErrorRouter state={state} dispatch={dispatch} />`; passed slotPerReference to StickyReferenceStrip rendering RefusalWarning per flagged reference; removed obsolete `SpecPreviewState` import + the local ErrorMount function; load-bearing PREVIEW-01 invariant + status==='preview' guard for SpecPreviewPanel UNTOUCHED
- `__tests__/style-from-reference-shell.test.tsx` — Test 7 updated to assert the new contract (SafetyBlockRecovery present + spec-preview absent + recovery-suggestion-text verbatim) instead of the removed placeholder error-mount testid; Tests 1-6 + 8-9 unchanged
- `app/(dashboard)/dashboard/page.tsx` — added Link import; new `<section>` between Welcome and Summary Cards rendering a card-style Link to `/dashboard/style-from-reference/new` with Material Symbols icon + "From references" heading + "inspired by their style" copy + data-testid="from-references-cta"

## Decisions Made

All decisions documented in frontmatter `key-decisions`. Highlights:

- **TS-exhaustiveness on ErrorRouter switch.** Default branch assigns `state.error.kind` to a never-typed const so adding a new ErrorKind member without a router case fails at compile time. Reducer's union is the single source of truth.
- **SafetyBlockRecovery REPLACES (not augments) the spec-preview panel.** The reducer naturally enforces this (EXTRACT_ERROR transitions to status='error', not 'preview'). Recovery-integration Test 11 + shell Test 7 verify the replacement from two angles.
- **Describe-in-text affordance ships as disabled stub + sr-only tooltip.** NO scope reduction — the surface is visible to users; Phase 77 enables it. CONTEXT.md PREVIEW-12 explicitly listed this as a required affordance.
- **Updated Plan 76-01 shell Test 7.** The placeholder error-mount testid belonged to 76-03 by contract (76-01 SUMMARY explicitly noted this). Same test intent (safety_blocked surface present + spec-preview absent), updated assertion targets.
- **Dashboard CTA placement + visual treatment.** Between Welcome and Summary Cards for first-visit discoverability; card-style for visual parity with neighboring summary cards.
- **Source-grep tests for dashboard CTA.** Page is a server component with multiple side effects; jsdom rendering would mock most of the page without catching the wiring bug. 4 source-grep tests are the right granularity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Initial ErrorRouter comment used the word "duplicate" which fails the LEGAL-03 forward-compat per-file grep**
- **Found during:** Task 2 GREEN (first run after implementing ErrorRouter)
- **Issue:** Comment line read "Returning null here avoids a duplicate hint surface." The `\bduplicate\b` token is one of the 4 forbidden LEGAL-03 mimicry-framing tokens being grep-gated. Test 8 (LEGAL-03 grep) failed with `forbidden token /\bduplicate\b/i in error-router.tsx: expected 1 to be 0`.
- **Fix:** Changed "duplicate" → "redundant" in the comment. Same meaning, no forbidden token. The component itself never had user-facing copy with this token — only the comment.
- **Files modified:** `src/components/style-from-reference/error-router.tsx`
- **Verification:** All 8 ErrorRouter tests + all 16 Task 2 tests now GREEN.
- **Committed in:** `68c19d7` (Task 2 GREEN commit)
- **Lesson documented:** Comments are subject to the same LEGAL-03 grep as user-facing copy. The grep gate is intentional — it forces engineers to internalize the framing language even in comments.

**2. [Rule 1 - Test fix, not bug] Plan 76-01 shell Test 7 asserted the placeholder error-mount testid that Plan 76-03 was contractually required to remove**
- **Found during:** Task 2 GREEN (after replacing ErrorMount with ErrorRouter in shell)
- **Issue:** Test 7 in `style-from-reference-shell.test.tsx` (Plan 76-01) asserted `screen.getByTestId('error-mount')` — the placeholder Plan 76-01 reserved for 76-03 to fill. Plan 76-03's contract is to REMOVE that placeholder and replace it with the ErrorRouter that routes safety_blocked → SafetyBlockRecovery. The 76-01 SUMMARY (under "Next Phase Readiness") explicitly noted: "error-mount slot in style-from-reference-shell.tsx is UNTOUCHED — 76-03 owns it." This update was anticipated.
- **Fix:** Updated Test 7 to assert the new contract: `safety-block-recovery` testid present, `spec-preview-panel` testid absent, old `error-mount` testid absent (positive assertion that the placeholder is gone), `recovery-suggestion-text` contains the verbatim Phase 75 suggestion. Same test intent (safety_blocked surface present + spec-preview absent), updated assertion targets.
- **Files modified:** `src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx`
- **Verification:** Test 7 + all other 76-01 shell tests still GREEN.
- **Committed in:** `68c19d7` (Task 2 GREEN commit)
- **Pattern:** Wave-based plans that pre-allocate slot testids for downstream waves should anticipate that the downstream wave will rename or replace those testids when filling the slot. Test 7's update is documented in the 76-01 → 76-03 transition.

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs — one a forbidden-token slip in a comment caught by the grep gate working as designed; one an anticipated test update at a wave-boundary slot testid).
**Impact on plan:** Zero. Both fixes were contained to a single file each. No scope creep, no missed requirements.

## Issues Encountered

- **Pre-existing TypeScript errors in unrelated test files** (same set Plans 76-01 and 76-02 SUMMARYs documented under SCOPE BOUNDARY: `src/__tests__/auth/*`, `src/__tests__/api/api-keys.test.ts`, `src/__tests__/projects/crud.test.ts`, `src/__tests__/stripe/*`, `src/components/editor/__tests__/slide-editor.treatment-sync.test.tsx`, `src/lib/services/__tests__/projects-delete.test.ts`). These predate Phase 76 and are out of scope. The Phase 76 surface (everything Plan 76-03 touched) is TS-clean.
- **No issues with the actual plan work.** All RED commits failed exactly as expected; both GREEN commits surfaced the two documented Rule 1 deviations. Final 112/112 Phase 76 tests GREEN.

## Phase 76 Completion Snapshot

Plan 76-03 closes Phase 76. All 12 PREVIEW requirements (PREVIEW-01..12) are now complete:

| Req | Plan | Surface |
|-----|------|---------|
| PREVIEW-01 | 76-01 | Mandatory non-skippable spec-preview panel + reducer guard |
| PREVIEW-02 | 76-02 | PaletteSwatches |
| PREVIEW-03 | 76-02 | FontCategoryBadges |
| PREVIEW-04 | 76-02 | LayoutSketch (9:16 SVG schematic) |
| PREVIEW-05 | 76-02 | VoiceNoteCaption |
| PREVIEW-06 | 76-02 | PerAspectToggles |
| PREVIEW-07 | 76-01 + 76-03 | Re-extract reducer + counter visibility wiring |
| PREVIEW-08 | 76-02 | BrandKitRemixToggle |
| PREVIEW-09 | 76-01 | StickyReferenceStrip |
| PREVIEW-10 | 76-03 | RefusalWarning chip |
| PREVIEW-11 | 76-02 | CreditCostDisplay |
| PREVIEW-12 | 76-03 | SafetyBlockRecovery |

Plus: dashboard "From references" CTA wires the v2.13 entry point.

## Next Phase Readiness

- **Phase 77 (emit integration) is unblocked at the seam.**
  - The reducer's `state.aspects`, `state.useBrandKitRemix`, and `state.refusalAcknowledged` are exactly as Plans 76-01 + 76-02 + 76-03 left them — Phase 77 reads these at emit time.
  - The Generate CTA's onClick handler dispatches `GENERATE_CLICK` which transitions to `status='generating'`. Phase 77 wires the actual emit pipeline at this transition (the shell renders a placeholder "Generating..." state today).
  - SafetyBlockRecovery's "Describe the style in text" affordance is the natural seam for Phase 77's user-copy emit mode. The disabled stub + tooltip is in place; Phase 77 enables the click handler and routes to its emit path.
  - Dashboard CTA links to `/dashboard/style-from-reference/new` (the route shipped by Plan 76-01). Production users now have an entry point.
- **Phase 79 LEGAL-03 forward-compat: zero work in this surface.** The per-file grep tests across all 13 component files and the dashboard page already assert what Phase 79's project-wide gate will assert. Drift in any single file fails CI before Phase 79 lands.
- **Pitfall 6 + Pitfall 7 closed inside the v2.13 surface.** Every error kind has a specific recovery surface (Pitfall 6); safety blocks surface specific recovery_suggestion text + actionable affordances (Pitfall 7). The "magic without affordance becomes broken without recourse" failure mode is structurally prevented.

## Verification Gates

- `npx vitest run src/components/style-from-reference src/app/(dashboard)/style-from-reference` → **112/112 GREEN** (16 test files)
- `grep -ciE "exactly like|clone|copy this style|duplicate" src/components/style-from-reference/*.tsx src/app/(dashboard)/dashboard/page.tsx` → **0 across all 14 files**
- `grep -c 'data-testid="generate-cta"' src/components/style-from-reference/spec-preview-panel.tsx` → **1** (PREVIEW-01 single-CTA invariant holds)
- `npm run lint:gates` → **PARITY-05: zero free-text closed-enum violations in src/** (Phase 74 closed-enum invariant unaffected — Plan 76-03 did not touch StyleSpec)
- `npx tsc --noEmit` for new/modified files → **clean** (pre-existing unrelated errors unchanged)

## Self-Check: PASSED

Verified all claimed artifacts exist and all claimed commits are reachable:

**Files created (8/8 found):**
- `src/components/style-from-reference/refusal-warning.tsx` — FOUND
- `src/components/style-from-reference/safety-block-recovery.tsx` — FOUND
- `src/components/style-from-reference/error-router.tsx` — FOUND
- `src/components/style-from-reference/__tests__/refusal-warning.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/safety-block-recovery.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/error-router.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/recovery-integration.test.tsx` — FOUND
- `src/components/style-from-reference/__tests__/dashboard-cta-smoke.test.tsx` — FOUND

**Files modified (3/3 found):**
- `src/components/style-from-reference/style-from-reference-shell.tsx` — FOUND
- `src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx` — FOUND
- `src/app/(dashboard)/dashboard/page.tsx` — FOUND

**Commits (6/6 reachable in `git log --oneline`):**
- `87d8db0` — FOUND (test: failing tests for RefusalWarning + SafetyBlockRecovery)
- `a912f5f` — FOUND (feat: RefusalWarning + SafetyBlockRecovery components PREVIEW-10/12)
- `45d3313` — FOUND (test: failing tests for ErrorRouter + recovery integration)
- `68c19d7` — FOUND (feat: ErrorRouter wires recovery surfaces; shell mounts router + refusal chips)
- `e3c007d` — FOUND (test: failing dashboard CTA smoke tests)
- `3abe01d` — FOUND (feat: dashboard "From references" CTA links to style-from-reference flow)

---
*Phase: 76-spec-preview-ui-per-aspect-controls-re-extract-recovery*
*Completed: 2026-05-11*
