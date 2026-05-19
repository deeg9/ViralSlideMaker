---
phase: 78-remix-fork-publish-snapshot
plan: 02
subsystem: ui
tags: [server-action, ui, regenerate, fork, remix, base-ui-dialog, vitest, legal-03]

# Dependency graph
requires:
  - phase: 78-remix-fork-publish-snapshot
    provides: published_carousels.{style_spec, reference_assets} columns; fork_published_carousel RPC inherits both into new project row; publishProjectAdmin snapshots both at publish time (Plan 78-01)
  - phase: 77-style-from-spec-emit-editor-handoff
    provides: generateCarouselFromReferences orchestrator (EMIT-02); ReferenceThumbnailsStrip component (EDITOR-03); regenerateAction Server Action shape (EMIT-02 + EDITOR-01); content-source + spec-aspects types
  - phase: 75-vision-extraction-two-phase-architecture-safety-config
    provides: extractStyleSpec orchestrator (EXTRACT-01..08) — vision + closed-enum firewall + cache + rate-cap + ledger
  - phase: 74-style-spec-storage-foundation
    provides: SLIDE_REFERENCES_BUCKET / ReferenceAssetRow / Project.reference_assets type
provides:
  - regenerateFromReferencesAction Server Action — sibling-create composition of Phase 75 extract + Phase 77 emit against inherited references
  - <RegenerateFromReferencesButton> client component — base-ui Dialog confirmation modal with LEGAL-03 "Inspired by" framing + 1-credit cost indicator
  - Project detail page wires the button next to <ReferenceThumbnailsStrip> on the editor view
  - REMIX-04 verification integration test — proves Plan 78-01 fork RPC + Phase 77-03 strip together render inherited reference thumbnails on forks
affects: [79-legal-hardening (LEGAL-03 grep gate consumes the "Inspired by" framing this plan establishes), future remix-with-different-aspects UX (deferred to v2.14+)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sibling-create invariant — regenerate creates a NEW project row owned by the current user; source row is read-only throughout
    - Server-Action composition — auth → source-lookup → references-gate → sibling-create → extract → emit (single seam at the action; UI dispatches once)
    - Action-side LEGAL-03 surface — UI copy lives in the client component; the action returns no user-facing strings (error union codes only)
    - Source-grep wire test for async RSC pages — when full-tree render is too costly, assert import + JSX + prop binding via fs grep (mirrors the "use server" firewall test pattern)
    - End-to-end verification via mocked-row integration test — render the RSC with a mocked Supabase return and assert the rendered tree (no live DB)

key-files:
  created:
    - src/app/(dashboard)/style-from-reference/__tests__/regenerate-action.test.ts
    - src/components/projects/regenerate-from-references-button.tsx
    - src/components/projects/__tests__/regenerate-from-references-button.test.tsx
    - src/app/(dashboard)/project/[id]/__tests__/regenerate-button-wire.test.ts
    - src/app/(dashboard)/project/[id]/__tests__/forked-project-references-strip.test.tsx
  modified:
    - src/app/(dashboard)/style-from-reference/actions.ts
    - src/app/(dashboard)/project/[id]/page.tsx

key-decisions:
  - "Used base-ui Dialog (project standard; same primitive as <ProjectNamingDialog>) instead of shadcn Dialog (which is not installed). Plan's 'shadcn <Dialog>' phrasing was a generic 'use the project's modal primitive' pointer."
  - "Sibling-create routes through createProjectService (existing service) rather than direct INSERT — preserves the ownership/RLS invariants the rest of the codebase already enforces."
  - "Source-grep smoke test for the page wire (Task 3) instead of full-tree render — the page is an async RSC and full-tree mounting would require mocking 4+ server modules; the SOURCE-GREP pattern is already established in the actions.ts firewall test."
  - "The full-tree integration test (Task 4) does mount the page; it mocks the dashboard children (editor + dialog + form) so only the strip + button stay live. This is the minimum surface that proves REMIX-04 + REMIX-05 co-render."
  - "Action returns ONLY error-code enums (no user-facing detail strings) — the button component owns the copy mapping. Keeps LEGAL-03 review surface bounded to the client component."

patterns-established:
  - "Sibling-create action shape — { sourceProjectId } in, { ok: true, projectId } out; client navigates to /project/{newProjectId}. Future 'Regenerate with different aspects' (v2.14 deferred) will follow this same shape."
  - "RSC integration test seam — mock createClient at the module boundary, return a row from .from('projects').select(...).eq(...).single(), invoke `await Page({ params })`, render the result. Editor + dialog children are stubbed; the surfaces under test stay live. Reusable for future detail-page surface tests."

requirements-completed:
  - REMIX-04
  - REMIX-05

# Metrics
duration: 8min
completed: 2026-05-11
---

# Phase 78 Plan 02: Regenerate from References Summary

**Sibling-create Server Action + base-ui Dialog button on the project detail page exposes one-click "Generate a new project inspired by these references" against inherited reference assets — composes Phase 75 extract + Phase 77 emit; LEGAL-03 framing throughout; REMIX-04 inheritance verified end-to-end.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-11T01:28:24Z
- **Completed:** 2026-05-11T01:36:12Z
- **Tasks:** 4
- **Files modified:** 7 (5 created, 2 modified)
- **Tests added:** 26 (all GREEN; 4 RED→GREEN gates in the TDD tasks)

## Accomplishments

- `regenerateFromReferencesAction` ships the Phase 78 REMIX-05 entry point as a sibling-create composition: auth → source lookup → references-non-empty gate → NEW project row (user-owned) → Phase 75 `extractStyleSpec` → Phase 77 `generateCarouselFromReferences` → return `{ ok: true, projectId }`. Source row is never written to.
- `<RegenerateFromReferencesButton>` ships as a client component with a base-ui Dialog modal carrying LEGAL-03-compliant copy ("Generate a new project inspired by these references", "Generating will use 1 credit") and full pending/error UX (disabled confirm, inline error banner with friendly per-error-code messages).
- Project detail page wires the button into a flex row next to `<ReferenceThumbnailsStrip>`, gated on `reference_assets` non-empty so legacy projects (every pre-v2.13 project) keep byte-identical layout.
- REMIX-04 verification integration test mounts the page with a mocked fork-shape row (post-Plan 78-01 RPC return) and asserts the strip + 3 inherited `<img>` thumbs + button trigger all render — proves Plan 78-01 + Phase 77-03 + Plan 78-02 stack satisfy REMIX-04.
- LEGAL-03 grep tests on both rendered output and source file (Tests 11 + 12 in the button suite) — zero forbidden tokens; "Inspired by" copy positively asserted. Gives Phase 79's repo-wide grep gate a clean pass.

## Task Commits

Each task was committed atomically following the plan's RED → GREEN cadence:

1. **Task 1 RED — `regenerateFromReferencesAction` failing tests** — `c6b0e88` (test)
2. **Task 1 GREEN — `regenerateFromReferencesAction` implementation** — `d399046` (feat)
3. **Task 2 RED — `<RegenerateFromReferencesButton>` failing tests** — `5be9e99` (test)
4. **Task 2 GREEN — `<RegenerateFromReferencesButton>` implementation** — `98b9de6` (feat)
5. **Task 3 RED — wire test for project detail page** — `459b991` (test)
6. **Task 3 GREEN — wire button into project detail page** — `495c141` (feat)
7. **Task 4 — REMIX-04 verification integration test (RED+GREEN combined per plan)** — `f6e5bb7` (test)

## Files Created/Modified

- `src/app/(dashboard)/style-from-reference/actions.ts` — Added `regenerateFromReferencesAction` as a sibling to `regenerateAction` (Phase 77-02). 175 lines net added; preserves the existing `'use server'` directive + Phase 75 firewall (no `@google/genai` import).
- `src/app/(dashboard)/style-from-reference/__tests__/regenerate-action.test.ts` — 9 tests covering auth gate, source-not-found, no-references (null + empty), happy path, extract failure, emit failure, sibling-create invariant, userId-from-auth + spec passthrough.
- `src/components/projects/regenerate-from-references-button.tsx` — Client component using base-ui Dialog (project standard). Internal null-render gate on `reference_assets` non-empty. Pending state disables confirm; error banner with per-code friendly mapping; success → `router.push('/project/{newProjectId}')`.
- `src/components/projects/__tests__/regenerate-from-references-button.test.tsx` — 12 tests covering the conditional render gate (3 negative + 1 positive), modal trigger + LEGAL-03 copy, "1 credit" cost indicator, action dispatch + payload, success navigation, loading + error UX, LEGAL-03 grep on rendered output + source.
- `src/app/(dashboard)/project/[id]/page.tsx` — Imports `RegenerateFromReferencesButton`; in the `hasSlides` editor branch wraps `<ReferenceThumbnailsStrip>` + the button in a flex row gated on `reference_assets` non-empty. Empty/legacy state: page renders byte-identical to pre-Plan-78-02 layout.
- `src/app/(dashboard)/project/[id]/__tests__/regenerate-button-wire.test.ts` — 3 SOURCE-GREP smoke tests (import + JSX + prop binding) — pragmatic seam since the page is an async RSC.
- `src/app/(dashboard)/project/[id]/__tests__/forked-project-references-strip.test.tsx` — 2 integration tests rendering the page with mocked Supabase row: (a) fork shape with 3 inherited refs → strip + button mount; (b) legacy shape → neither mounts (back-compat invariant).

## Decisions Made

- **base-ui Dialog over shadcn Dialog** — The codebase uses `@base-ui/react/dialog` (see `<ProjectNamingDialog>`); shadcn Dialog primitive is not installed in `src/components/ui/`. The plan's "shadcn `<Dialog>`" phrasing was a generic "use the project's modal primitive" pointer; using the project standard preserves consistency and avoids a new dependency.
- **Sibling-create routes through `createProjectService`** — Reuses the existing service rather than a direct INSERT; preserves ownership/RLS invariants and matches the rest of the codebase. Test 8 explicitly verifies the source projectId never appears in any write surface.
- **Action returns error codes only; UI maps to user-facing copy** — Bounds the LEGAL-03 review surface to the client component. The action's `RegenerateFromReferencesActionResult` carries `error: 'unauthenticated' | 'source_not_found' | 'no_references' | 'extract_failed' | 'emit_failed'` plus an optional `detail` for diagnostics; the button maps each to a friendly inline-banner message.
- **Source-grep wire test for the page (Task 3)** — Async RSC pages are costly to full-tree render (4+ server-module mocks needed). The SOURCE-GREP pattern is already established in this codebase (see `actions.test.ts` Test 8 for the `'use server'` firewall + `@google/genai` ban grep). Asserts import + JSX + prop binding — covers the wire concern at low cost.
- **Full-tree integration test for REMIX-04 (Task 4)** — The verification REQUIREMENT (REMIX-04: "Forker sees inherited reference thumbnails on their fork") justifies the cost. We mock the dashboard children (editor + dialog + form) so only the strip + button stay live in the rendered tree. Two tests: forked-shape positive + legacy back-compat negative.
- **Default `topic` derivation** — The action derives `topic` for the new project from `source.topic ?? source.title ?? 'Inspired by references'`. The button doesn't ask the user for a title; the source metadata is the best signal at confirmation time. Future v2.14 "regenerate with different aspects" can reopen this if telemetry shows users want to change the topic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LEGAL-03 grep failure on initial GREEN — copy contained "stays exactly as it is"**
- **Found during:** Task 2 (RegenerateFromReferencesButton GREEN run)
- **Issue:** The modal `Dialog.Description` initially read "Your current project stays exactly as it is." The phrase "exactly as" matches the LEGAL-03 forbidden token "exactly like" via the source-grep gate (Test 12) — the substring "exactly " appears, and the test rightly flags any "exactly"-leading phrase as risky framing. A header comment also literally enumerated the forbidden tokens (`"exactly like / clone / copy / duplicate"`), which the source-grep also matched.
- **Fix:** (a) Replaced description with "Your current project is not modified." which carries the same user reassurance with no forbidden token. (b) Replaced the comment's literal enumeration with a pointer to the canonical list in the test file ("see Test 11 + 12 in regenerate-from-references-button.test.tsx for the canonical list").
- **Files modified:** `src/components/projects/regenerate-from-references-button.tsx`
- **Verification:** Test 12 now PASSES; all 12 tests in the button suite GREEN. LEGAL-03 invariant defended structurally — the canonical forbidden list is in one place (the test), and the source file no longer accidentally violates by quoting the list.
- **Committed in:** `98b9de6` (Task 2 GREEN commit — fixes folded into the same atomic commit since this was a within-RED-iteration adjustment, not a post-GREEN regression)

**2. [Rule 3 - Blocking] Test 4 (REMIX-04 integration) failed at module-load — Pexels client errored on missing API key**
- **Found during:** Task 4 first run
- **Issue:** Mounting `ProjectPage` in jsdom transitively loads `RegenerateFromReferencesButton` → its server-action import → `regenerateFromReferencesAction` → `extract-style-spec.ts` (Gemini client) and `carousel.ts` (Pexels client). Both clients construct at module-evaluation time and throw when `GEMINI_API_KEY` / `PEXELS_API_KEY` are unset in the test env. The test errored before any assertion ran.
- **Fix:** Mocked `@/app/(dashboard)/style-from-reference/actions` at the module boundary — the button only invokes the action on click (after assertion), so an inert mock fully decouples mount-time render from server-side module loading. Mount-time render is the only thing under test for REMIX-04 + the button trigger.
- **Files modified:** `src/app/(dashboard)/project/[id]/__tests__/forked-project-references-strip.test.tsx` (added the mock + a comment explaining why)
- **Verification:** Both REMIX-04 tests now PASS (forked-shape + legacy back-compat). The action's own behavior is comprehensively tested in `regenerate-action.test.ts` (9 tests, all GREEN); decoupling the page mount from the action import is the correct seam.
- **Committed in:** `f6e5bb7` (Task 4 commit — fix folded into the same atomic commit since this was a within-task adjustment before any GREEN signal)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes are correctness/test-infrastructure adjustments inside individual tasks — no scope change, no new requirements pulled in, no decisions reopened. Both surfaces (the LEGAL-03 framing and the action-import decoupling) are defended structurally going forward.

## Issues Encountered

- **Pre-existing test failures NOT caused by this plan.** Did not run the full test suite as a regression check (per SCOPE BOUNDARY: only auto-fix issues directly caused by current task changes). All tests directly adjacent to this plan's changes (style-from-reference actions test + projects component tests + project detail-page tests + Plan 78-01's publish-snapshot test) are GREEN — 67 tests across 8 files. `npm run lint:gates` passes (closed-enum + 12K-token-budget). 

## TDD Gate Compliance

Tasks 1, 2, and 3 followed the plan-level TDD discipline:

- **Task 1:** RED commit `c6b0e88` (test only, 9 failing tests) precedes GREEN commit `d399046` (feat, all 9 GREEN). Verified in git log.
- **Task 2:** RED commit `5be9e99` (test only, fails at module-import resolution — 12 tests would all fail) precedes GREEN commit `98b9de6` (feat, all 12 GREEN). Verified in git log.
- **Task 3:** RED commit `459b991` (test only, 3 failing source-grep assertions) precedes GREEN commit `495c141` (feat, all 3 GREEN). Verified in git log.
- **Task 4:** Plan explicitly specified RED+GREEN combined per the integration-test convention; commit `f6e5bb7` ships both the test + the test infra (action-mock decoupling for module-load) atomically. The two assertions both GREEN at commit time.

No REFACTOR commits — all GREEN implementations were minimal-by-construction (the action is one composition function, the button is one component with one Dialog, the wire is a 6-line page edit).

## User Setup Required

None — no external service configuration required. The action runs against the operator's existing Supabase + Gemini + Pexels deployment (already configured for Phase 75/77 ship). Plan 78-01's two migrations (already shipped per its SUMMARY) are the only operator action that gates the regenerate flow.

## Next Phase Readiness

Phase 78 is now functionally complete:
- REMIX-01..03 shipped in Plan 78-01 (publish_carousels columns + fork RPC inheritance + publish snapshot)
- REMIX-04 satisfied by Phase 77-03 strip composition + Plan 78-01 fork RPC inheritance — verified by Task 4 integration test in this plan
- REMIX-05 shipped here (action + button + page wire)

Phase 79 (Legal Hardening) consumes nothing from Plan 78-02 directly — but the "Inspired by" framing throughout this plan's UI copy (modal title + description + cost indicator + alt text) is positioned for Phase 79's repo-wide LEGAL-03 grep gate to pass on this surface. The forbidden-token list lives in this plan's test files and matches the v2.13 spec's LEGAL-03 list verbatim.

## Self-Check: PASSED

All files verified on disk; all 7 task commits verified in git log:

**Files (5 created, 2 modified):**
- `src/app/(dashboard)/style-from-reference/actions.ts` (modified)
- `src/app/(dashboard)/style-from-reference/__tests__/regenerate-action.test.ts` (created)
- `src/components/projects/regenerate-from-references-button.tsx` (created)
- `src/components/projects/__tests__/regenerate-from-references-button.test.tsx` (created)
- `src/app/(dashboard)/project/[id]/page.tsx` (modified)
- `src/app/(dashboard)/project/[id]/__tests__/regenerate-button-wire.test.ts` (created)
- `src/app/(dashboard)/project/[id]/__tests__/forked-project-references-strip.test.tsx` (created)

**Commits:** c6b0e88, d399046, 5be9e99, 98b9de6, 459b991, 495c141, f6e5bb7

---
*Phase: 78-remix-fork-publish-snapshot*
*Completed: 2026-05-11*
