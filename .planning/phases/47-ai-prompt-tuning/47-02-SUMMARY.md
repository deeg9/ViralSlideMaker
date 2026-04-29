---
phase: 47-ai-prompt-tuning
plan: 2
subsystem: ai
tags: [validation, typo-detection, jaccard, gemini, premium-templates]

# Dependency graph
requires:
  - phase: 47-ai-prompt-tuning
    provides: TextSegmentSchema widened with optional highlightColor + highlightStyle (Plan 47-01) — validateAndRepair targets the same shape post-Gemini, pre-Zod-parse
  - phase: 46-premium-template-authoring
    provides: 3 premium template ids (magazine-bold, tr3nding-news, documentary) — inlined as PREMIUM_TEMPLATE_IDS for tier scoping
provides:
  - KNOWN_TYPOS Set<string> of 30 curated mis-spellings (TPLAI-02 detection allowlist)
  - wordCount, isPremiumTemplate, detectOverflows, detectOrphans, detectTypos, validateAndRepair pure helpers
  - OverflowFinding, OrphanFinding, TypoFinding, ValidateAndRepairOptions, ValidateAndRepairResult interfaces
  - Documentary opt-out: silent strip of highlightColor/highlightStyle on documentary slides
affects: [47-03-prompt-assembly-retry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure post-Gemini validator: validateAndRepair never throws, never calls Gemini, always returns { data, retried, warnings } — retry orchestration deferred to caller (Plan 47-03)"
    - "Inlined PREMIUM_TEMPLATE_IDS in validate-slides.ts to avoid circular dep: src/lib/render/templates/index.ts imports the validator at module load (Phase 44 gate), so the validator must not import back"
    - "Token-based typo detection: split on /[^A-Z]+/ then Set lookup — avoids substring false positives where a typo is inside a longer legitimate word; <3-char tokens skipped to avoid single-letter accents"

key-files:
  created:
    - src/lib/ai/typos.ts
    - src/lib/ai/validate-slides.ts
    - src/__tests__/ai/typos.test.ts
    - src/__tests__/ai/validate-slides.test.ts
  modified: []

key-decisions:
  - "PREMIUM_TEMPLATE_IDS inlined (not imported from templates/index.ts) — guards against the Phase 44 module-load circular-dep risk (validateTemplateRegistry runs at templates/index.ts module load)"
  - "Documentary highlight strip is SILENT (no warning emitted) — per CONTEXT.md Area 3 + threat T-47-06 disposition: the strip is intentional and the field is template-incompatible, not a quality defect to surface"
  - "Typo detection scoped to ALL templates (D-02), but length/orphan detection scoped to premium tier only (D-01) — legacy 5 templates always return [] from detectOverflows for backward compat"
  - "validateAndRepair returns retried:false unconditionally — the retry-once-against-Gemini wrapper is Plan 47-03's job; this helper SURFACES warnings, never blocks the caller"

patterns-established:
  - "Pre-Zod-parse validator pattern: post-Gemini JSON.parse → validateAndRepair → CarouselSchema.parse. Plan 47-03 wires the retry-on-warnings layer between steps 2 and 3."
  - "Tier-scoped helper pattern: isPremiumTemplate guards detectOverflows; legacy templates short-circuit to [] without per-slide work — keeps the legacy path zero-cost."
  - "Mutating-but-pure helper: validateAndRepair mutates segment fields in place for the documentary strip. The data lifecycle is owned by the caller; mutation is a documented contract, not a hidden side effect."

requirements-completed: [TPLAI-01, TPLAI-02]

# Metrics
duration: 3min
completed: 2026-04-29
---

# Phase 47 Plan 2: Validate-Slides Helpers Summary

**Pure-logic post-Gemini validation surface: KNOWN_TYPOS allowlist + 6 helpers (wordCount / isPremiumTemplate / detectOverflows / detectOrphans / detectTypos / validateAndRepair) covering length caps, orphan detection, typo gate, and documentary highlight strip — all pure, never-throws, returning { data, retried, warnings } for Plan 47-03 retry-orchestration to consume.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-29T19:09:42Z
- **Completed:** 2026-04-29T19:12:25Z
- **Tasks:** 2 (RED + GREEN)
- **Files created:** 4 (2 source + 2 test)
- **Files modified:** 0

## Accomplishments
- `KNOWN_TYPOS` Set<string> with exactly 30 uppercase entries from CONTEXT.md Area 2 — the curated typo allowlist for the TPLAI-02 spelling gate.
- `validate-slides.ts` ships 6 named exports + 4 supporting interfaces, implementing all rules from Areas 1-3 of CONTEXT.md: hook ≤12 / body ≤35 length caps (premium-tier only), Jaccard ≥ 0.80 orphan detection (all templates) with exact-equality short-circuit, tokenized substring typo detection (all templates) with <3-char token skip, and the silent documentary highlight strip.
- `validateAndRepair` orchestrator is deliberately pure-and-never-throws — no Gemini call, no I/O, no thrown exceptions. Returns `{ data, retried: false, warnings: string[] }` so Plan 47-03 can wrap it with retry-once-against-Gemini logic without re-engineering this layer.
- 29/29 tests pass on the first GREEN run; npm run build exits 0; tsc --noEmit holds at the baseline 14 errors (zero new errors on the 2 new source files).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for typos + validate-slides helpers** — `5fca218` (test) — 29 tests / 2 files / 306 lines added; vitest fails with module-not-found as expected
2. **Task 2 (GREEN): Implement KNOWN_TYPOS + 6 helpers** — `7663f6b` (feat) — 270 lines added across 2 source files; all 29 tests pass

_TDD discipline: RED commit precedes GREEN commit; the test commit fails the suite, the feat commit makes it green._

## Files Created/Modified

- `src/lib/ai/typos.ts` — KNOWN_TYPOS Set<string> with 30 uppercase entries (MUSICAN, CARROUSEL, ENTREPRENUER, ... RELEVENT). Single named export. Caller-side `.toUpperCase()` normalization is the documented contract.
- `src/lib/ai/validate-slides.ts` — 6 named exports (`wordCount`, `isPremiumTemplate`, `detectOverflows`, `detectOrphans`, `detectTypos`, `validateAndRepair`) + 4 supporting interfaces (`OverflowFinding`, `OrphanFinding`, `TypoFinding`, `ValidateAndRepairOptions`, `ValidateAndRepairResult`). Inlined `PREMIUM_TEMPLATE_IDS = new Set(['magazine-bold', 'tr3nding-news', 'documentary'])` to dodge circular dep on templates/index.ts. Constants: `HOOK_CAP = 12`, `BODY_CAP = 35`, `ORPHAN_JACCARD_THRESHOLD = 0.80`.
- `src/__tests__/ai/typos.test.ts` — 4 tests: Set instance, size ≥ 30, contains-required-30, all-uppercase invariant.
- `src/__tests__/ai/validate-slides.test.ts` — 25 tests (5 wordCount + 5 isPremiumTemplate + 4 detectOverflows + 3 detectOrphans + 4 detectTypos + 4 validateAndRepair) including the documentary-strip case and the magazine-bold-preserves case for the documentary opt-out symmetry.

## Decisions Made
- **PREMIUM_TEMPLATE_IDS inlined, not imported.** Phase 44's `validateTemplateRegistry` runs at module load via top-level call in `templates/index.ts`. If `validate-slides.ts` ever needs to be imported from `templates/index.ts` (e.g., to validate registry data), an import in the other direction becomes a circular dep. Inlining the 3-element set keeps this file dependency-light and side-effect-free.
- **Documentary strip is silent.** No warning is emitted when highlightColor/highlightStyle is stripped on documentary slides. Per CONTEXT.md Area 3 + threat T-47-06: the strip is an intentional template-semantics correction (documentary explicitly opts out of pills regardless), not a quality defect. Surfacing it as a warning would force the Plan 47-03 caller to filter noise.
- **detectOrphans flags exact equality even at 100% overlap.** The Jaccard short-circuit (`hook_text === body_text`) is defensive — a literal duplicate is always an orphan, regardless of token overlap. This makes the test for hook===body deterministic and avoids any edge case where the Jaccard math hits a numerical quirk on identical sets.
- **Token tokenizer uses `/[^A-Z]+/` (no backtracking).** Per threat T-47-05 disposition: simple character-class split avoids regex pathological-input DoS. Each token is then a single Set.has lookup — O(1) per token, O(N) per slide.

## Deviations from Plan

None - plan executed exactly as written. The provided implementation block in Task 2's `<action>` was used verbatim (with one added comment block at the top tying the file to Areas 1-3). All 29 RED tests passed on the first GREEN run; no auto-fixes, no scope adjustments, no architectural decisions surfaced.

## Issues Encountered

None. Two minor process notes:
- Initial parallel `grep -c "it(" ...` + `ls src/lib/ai/typos.ts src/lib/ai/validate-slides.ts ...` Bash call failed because the `ls` of non-existent files returned exit-1, which cancelled the parallel `npx vitest` call mid-flight. Re-ran vitest serially. No impact on the RED gate verification — the count check still confirmed 4 + 25 tests, and vitest still confirmed module-not-found failure on a second run.
- One acceptance-criterion grep (`grep -F "documentary" src/lib/ai/validate-slides.ts`) returned 3 matches instead of 1 — two from comment lines explaining the documentary opt-out, one from the locked premium id literal. The literal is present (line confirmed via context), so the acceptance criterion holds.

## Verification Run

- `npx vitest run src/__tests__/ai/typos.test.ts src/__tests__/ai/validate-slides.test.ts` → **29/29 pass** (4 typos + 25 validate-slides; duration ~6ms test runtime / ~364ms total)
- `npm run build` → **exit 0** — no module-load regressions; new files referenced only from tests in this plan; Phase 44 `validateTemplateRegistry` stayed green at module load with no template-registry changes
- `npx tsc --noEmit` → **14 errors** (baseline unchanged from Phase 47-01; all in unrelated stripe/sync-subscription test mocks; zero new errors on `src/lib/ai/typos.ts` or `src/lib/ai/validate-slides.ts`)
- Acceptance grep checks all green:
  - `grep -c "^export" src/lib/ai/validate-slides.ts` → 11 (≥ 6 required: 6 functions + 5 interfaces)
  - `PREMIUM_TEMPLATE_IDS` found (1 declaration + 1 use)
  - `magazine-bold`, `tr3nding-news`, `documentary` all literal in file
  - `HOOK_CAP = 12`, `BODY_CAP = 35`, `0.80` all literal in file

## TDD Gate Compliance

Plan-level TDD discipline followed:
- RED commit `5fca218`: `test(47-02): add failing tests for typos + validate-slides helpers (RED)` — 29 tests fail with module-not-found
- GREEN commit `7663f6b`: `feat(47-02): implement KNOWN_TYPOS + validate-slides helpers (GREEN)` — 29/29 pass
- REFACTOR not needed; implementation is already minimal and matches the plan's reference block.

## User Setup Required

None - pure-logic helpers, no external service configuration required.

## Next Phase Readiness

Plan 47-03 (prompt assembly + retry wiring) has the complete validation surface it needs:
- Import `validateAndRepair` from `@/lib/ai/validate-slides` to wrap Gemini's `JSON.parse` output before `CarouselSchema.parse(data)`. Pass `{ templateId }` from the caller.
- Use the returned `warnings: string[]` to drive the retry-once-with-addendum logic per CONTEXT.md Area 1 (length retry) and Area 2 (typo retry). Build the addendum from the warning strings (already in human-readable form like `"slide 0 hook_text has 13 words (cap 12)"` and `"slide 0 hook_text contains typo 'MUSICAN'"`).
- For the documentary template, no special handling needed in 47-03 — the silent strip already happened inside `validateAndRepair` before the warning list was built.
- Import `isPremiumTemplate` from the same module if 47-03 needs to gate the premium-tier prompt addendum (length caps + highlight pill instructions + voice note) on the same condition the validator uses — single source of truth for the tier check.

No blockers.

## Self-Check: PASSED

- `src/lib/ai/typos.ts` exists on disk
- `src/lib/ai/validate-slides.ts` exists on disk
- `src/__tests__/ai/typos.test.ts` exists on disk
- `src/__tests__/ai/validate-slides.test.ts` exists on disk
- Commit `5fca218` (test, RED) found in `git log --oneline`
- Commit `7663f6b` (feat, GREEN) found in `git log --oneline`
- 29/29 tests passing, build clean, tsc baseline held

---
*Phase: 47-ai-prompt-tuning*
*Completed: 2026-04-29*
