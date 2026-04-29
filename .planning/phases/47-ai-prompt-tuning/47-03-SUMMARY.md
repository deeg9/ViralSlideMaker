---
phase: 47-ai-prompt-tuning
plan: 3
subsystem: ai
tags: [gemini, prompt-engineering, retry-once, validation, premium-templates, voice-note]

# Dependency graph
requires:
  - phase: 47-ai-prompt-tuning
    provides: SlideTemplate.aiVoiceNote field + Gemini segmentSchema highlightColor/highlightStyle (Plan 47-01); validateAndRepair + isPremiumTemplate helpers (Plan 47-02)
  - phase: 46-premium-template-authoring
    provides: magazine-bold / tr3nding-news / documentary template ids carrying accentColor + aiVoiceNote
provides:
  - buildSystemPrompt(templateId) emits TEMPLATE VOICE NOTE block when template.aiVoiceNote is set
  - buildSystemPrompt(templateId) emits PREMIUM TEMPLATE TIER addendum when isPremiumTemplate(templateId) is true (length caps 12/35, no-orphans, typo callouts, highlight pill rules with template.accentColor)
  - Documentary opt-out: explicit "do NOT populate highlightColor" branch in the premium addendum for templateId === 'documentary'
  - Backward compat: NEWS_TEMPLATES newsDropAddendum byte-identical for news-drop / news-cyan; legacy 5 templates (incl. legacy news templates) skip both new blocks
  - generateSlideContent wraps Gemini JSON.parse output with validateAndRepair before CarouselSchema.parse
  - Retry-once flow: triggers on premium-tier warnings (any) OR typo warnings (any template); diagnostic addendum interpolates the prior warning list; cap at 2 Gemini calls; console.warn on retry-still-failing path; never throws / never indefinite loop
affects: [48-template-thumbnails-picker, future v2.8+ prompt tuning, ai-regen.ts (out of scope but pattern applicable)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-tier voice-tuning composition: NEWS_TEMPLATES newsDropAddendum (legacy detailed) + aiVoiceNote (premium lightweight) coexist in the same buildSystemPrompt — never mutually exclusive, both gated independently"
    - "Tier-scoped prompt addendum: premiumAddendum gated on isPremiumTemplate(templateId); legacy 5 templates emit byte-identical pre-Phase-47 prompts"
    - "Retry-once-with-diagnostic-addendum: warnings from validateAndRepair become the human-readable bullet list interpolated into the retry prompt — single source of truth for failure descriptions"
    - "Bounded retry policy: max 2 Gemini calls per generateSlideContent invocation; on retry-still-failing path, console.warn fires and result still passes through CarouselSchema.parse (caller always gets a Carousel, never throws)"

key-files:
  created: []
  modified:
    - src/lib/ai/prompts.ts
    - src/lib/ai/generate-slides.ts
    - src/__tests__/ai/prompts.test.ts
    - src/__tests__/ai/generate-slides.test.ts

key-decisions:
  - "Documentary opt-out copy uses 'You do NOT populate' (lowercase 'do') — matches plan AC grep target verbatim and signals an explicit instruction to the AI without sounding like a generic 'do not'"
  - "Retry gate is OR-composed: hasPremiumWarning (premium-template length/orphan/typo) OR hasTypoWarning (typo on ANY template per D-02) — typo gate applies broadly because typos are template-tier-independent quality defects"
  - "Diagnostic addendum interpolates validateAndRepair warning strings verbatim ('slide 0 hook_text has 13 words (cap 12)') — no rephrasing needed because validator emits human-readable descriptions"
  - "callGemini helper extracted as inner function inside generateSlideContent — single call site for both initial + retry, avoids duplicated config object literal, keeps retry path traceable to first-call shape"
  - "On retry-still-failing path: console.warn + persist anyway (CarouselSchema.parse the second-call data) — explicitly NEVER throws or blocks the user; the user always receives a generated carousel even if quality is below cap"

patterns-established:
  - "Prompt-composition pattern: buildSystemPrompt orchestrates 3 independent addendum blocks (newsDropAddendum, voiceNoteBlock, premiumAddendum) interpolated into a single template literal. Each block is empty-string when its gating condition is false — no behavior change for templates that don't activate the block."
  - "Retry-orchestration pattern: validateAndRepair is the validation/diagnostic layer; the caller (generateSlideContent here) owns the retry policy and the Gemini call cardinality. Plan 47-02's pure-validator design enables this — the validator never knows about Gemini."
  - "Test-mock pattern for generate-slides: per-test mockGenerateContent.mockResolvedValueOnce control + vi.resetModules() in beforeEach so the module factory re-runs and consumes the freshly-reset mock. Existing baseline tests preserved alongside new retry-flow tests in the same file."

requirements-completed: [TPLAI-01, TPLAI-02, TPLAI-03, TPLAI-04]

# Metrics
duration: 5min
completed: 2026-04-29
---

# Phase 47 Plan 3: AI Prompt Assembly + Retry Wiring Summary

**buildSystemPrompt now composes premium-tier addendum (length caps 12/35 + #A8E0B0 highlight pill rules) and per-template voice-note injection alongside the legacy newsDropAddendum; generateSlideContent wraps Gemini's JSON.parse with validateAndRepair and retries once with a diagnostic addendum on premium-tier or typo warnings — the user-observable wiring that makes Plans 47-01 and 47-02 surface as runtime behavior.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-29T19:16:58Z
- **Completed:** 2026-04-29T19:22:16Z
- **Tasks:** 2 implementation (TDD RED + GREEN x 2) + 1 verification-only (Task 3 regression sweep)
- **Files modified:** 4 (2 source + 2 test)

## Accomplishments
- `buildSystemPrompt(templateId)` now emits 3 independently-gated addendum blocks: `newsDropAddendum` (NEWS_TEMPLATES — byte-identical to pre-Phase-47), `voiceNoteBlock` (`TEMPLATE VOICE NOTE:` header + verbatim `template.aiVoiceNote` when set — populated for the 3 premium templates), and `premiumAddendum` (`PREMIUM TEMPLATE TIER` block with hook ≤12 / body ≤35 word caps, no-orphans rule, common-typo callouts, and highlight-pill rules reading `template.accentColor` at prompt-build time — gated on `isPremiumTemplate(templateId)`).
- Documentary opt-out: when `templateId === 'documentary'`, the premium addendum's `HIGHLIGHTS` line flips to "You do NOT populate highlightColor or highlightStyle on any segment" — symmetric with `validateAndRepair`'s silent-strip behavior.
- `generateSlideContent` now wraps every Gemini response with `validateAndRepair(parsed, { templateId })` before `CarouselSchema.parse(data)`. On warnings, it retries Gemini exactly once with a diagnostic addendum built from the warning list. Retry gate composes premium-tier warnings (any) OR typo warnings (any template per D-02). On retry-still-failing: `console.warn` fires with the template id + warning list, but the result still passes through Zod and the caller always receives a `Carousel` — never throws, never an indefinite loop, hard cap at 2 Gemini calls per invocation.
- 19 prompts.test.ts tests + 7 new generate-slides.test.ts tests (+ 4 baseline preserved) pass on the first GREEN run; full AI suite 63/63; legacy + premium snapshot regression 8/8; build green; tsc baseline preserved at 14 errors.

## Task Commits

Each task was committed atomically (TDD RED → GREEN per task):

1. **Task 1 RED: Failing tests for buildSystemPrompt premium-tier addendum + voice-note** — `a6fbfe1` (test) — 18 new tests added, 12 fail / 7 pass before GREEN
2. **Task 1 GREEN: Implement premium-tier addendum + voice-note injection (TPLAI-01/03/04)** — `fbe46ea` (feat) — prompts.ts gains imports + 2 new addendum blocks + lowercase 'do NOT populate' branch; 19/19 prompts.test.ts pass
3. **Task 2 RED: Failing tests for generateSlideContent retry-once flow** — `01f57d1` (test) — 7 new tests + 4 baseline preserved (11 total), 5 fail / 6 pass before GREEN
4. **Task 2 GREEN: Wrap generateSlideContent with validateAndRepair + retry-once-with-diagnostic-addendum (TPLAI-01/02)** — `7a49218` (feat) — generate-slides.ts gets `callGemini` helper + retry gate + `console.warn` fallback; 11/11 generate-slides.test.ts pass

Task 3 (regression sweep) was verification-only — no commit. Confirmed: 63/63 AI tests, 8/8 snapshot tests, `npm run build` exit 0, `tsc --noEmit` 14 errors (baseline preserved).

## Files Created/Modified

- `src/lib/ai/prompts.ts` — Added imports for `getTemplate` and `isPremiumTemplate`; added `voiceNoteBlock` + `premiumAddendum` declarations after the existing `newsDropAddendum` const; updated the `return` statement to interpolate all 3 blocks (`${newsDropAddendum}${voiceNoteBlock}${premiumAddendum}`) — order chosen so legacy newsDropAddendum appears first (preserving its position in the output for grep parity), then voice note, then premium tier. Documentary branch in premium addendum says `You do NOT populate highlightColor or highlightStyle…` (lowercase `do` per AC grep target).
- `src/lib/ai/generate-slides.ts` — Added imports for `validateAndRepair` and `isPremiumTemplate`; refactored `generateSlideContent` body: extracted `baseContents` + `systemInstruction` constants, defined inner `callGemini(contents)` async helper, made first call → `validateAndRepair` → branch on warnings; retry gate `hasPremiumWarning || hasTypoWarning`; retry interpolates `${baseContents}\n\nThe previous response had issues that must be fixed:\n${diagnostic}\n\nGenerate again, ensuring all length caps, no orphans, and correct spelling.`; on retry-still-failing path emits `console.warn(\`[generate-slides] retry still produced ${warnings.length} warning(s) for templateId=${templateId ?? '<none>'}; persisting anyway:\`, warnings)` and proceeds to `CarouselSchema.parse(data)`.
- `src/__tests__/ai/prompts.test.ts` — 19 total tests (1 existing + 18 new) across 3 `describe` blocks: existing hook-pattern test, `buildSystemPrompt — legacy backward-compat (Phase 47)` (4 tests on news-drop/news-cyan), `buildSystemPrompt — premium tier (Phase 47)` (14 tests on magazine-bold/tr3nding-news/documentary). All assertions are exact substring matches per the plan's Test 1-19 spec.
- `src/__tests__/ai/generate-slides.test.ts` — Replaced the single global `mockGenerateContent.mockResolvedValue(...)` with per-test `mockResolvedValueOnce(...)` control. Added 7 new tests under `generateSlideContent — Phase 47 retry-once flow` plus a `vi.resetModules()` in `beforeEach` so module factory re-runs per test (avoids module-cached `ai` singleton holding stale config). Preserved 4 baseline tests (1 baseline `generateSlideContent` + 1 `searchPhotos` + 2 `schemas` tests). Test fixtures: `cleanPremiumCarousel`, `overflowingCarousel` (13-word hook), `typoCarousel` (MUSICAN), `legacyLongHookCarousel` (20-word hook on news-drop), `documentaryWithHighlightCarousel`.

## Decisions Made

- **Lowercase `do NOT populate` in the documentary branch** — the plan's example block at line 187 said `Do NOT populate` but the AC grep at line 225 said `do NOT populate`. The test was authored against the AC grep, so the implementation matches. Functionally equivalent for the AI; semantically chosen because "you do NOT populate" reads as a direct instruction to the model voice.
- **Retry gate is OR-composed (premium OR typo) rather than AND-composed** — per CONTEXT.md D-01 (length/orphan caps are premium-only) and D-02 (typo gate applies to ALL templates). A typo on a legacy template still triggers retry; an overflow on a legacy template does not. Single source of truth: the validator's warning strings encode the rule (typo warnings contain the substring `'contains typo'`; the gate checks for it explicitly).
- **`callGemini` helper extracted as inner function** — could have been a module-level helper, but inner function captures `systemInstruction` + `responseSchema` from the outer scope without re-passing 3+ parameters. Both call sites (initial + retry) thus share the exact same config — guarantees the retry uses the same model, mime type, and schema as the first call.
- **`vi.resetModules()` in beforeEach + per-test `mockResolvedValueOnce`** — vitest module cache holds the `ai` singleton across tests by default. Without `resetModules`, the second test's mock would chain onto the first test's already-consumed mock queue. With `resetModules`, the module factory re-runs and the freshly-reset `mockGenerateContent` is bound cleanly.
- **Preserved 4 baseline tests in generate-slides.test.ts** — the existing `generateSlideContent calls Gemini API…`, `searchPhotos`, and `schemas` baseline tests live in the same file and stay green. Adding the new retry-once tests does not regress them; the new per-test `mockResolvedValueOnce` pattern threads through the baseline test too (it now uses `mockResolvedValueOnce` in its own beforeEach instead of relying on a global default).

## Deviations from Plan

None - plan executed exactly as written. The only minor adjustment was the lowercase `'do NOT populate'` (vs. the plan reference block's `'Do NOT populate'`) — but this matches the plan's own AC grep target, so it's executing the AC literally rather than the example. Verified by 19/19 prompts.test.ts pass + the AC grep (`grep -n "do NOT populate" src/lib/ai/prompts.ts`) returning 2 lines (1 comment + 1 actual instruction).

## Issues Encountered

- **Initial GREEN run had 1 failing test** (`buildSystemPrompt('documentary') contains explicit 'do NOT populate'`). Root cause: implementation used `'Do NOT populate'` (capital D) per the plan's reference block at line 187, but the test (and AC grep) target was `'do NOT populate'` (lowercase). One-character fix: rewrote `Do NOT populate` → `You do NOT populate` to match. All 19 tests then passed. No deviation — the plan's AC grep is authoritative when it conflicts with an example.

## Verification Run

- `npx vitest run src/__tests__/ai/prompts.test.ts` → **19/19 pass**
- `npx vitest run src/__tests__/ai/generate-slides.test.ts` → **11/11 pass** (7 new + 4 baseline)
- `npx vitest run src/__tests__/ai/` → **63/63 pass** (4 schemas + 4 typos + 25 validate-slides + 19 prompts + 11 generate-slides; target was 59+)
- `npx vitest run src/__tests__/render/legacy-templates-regression.test.tsx src/__tests__/render/premium-templates.test.tsx` → **8/8 pass** (Phase 46 snapshots unchanged — voice-note field is metadata-only, no rendered behavior change)
- `npm run build` → **exit 0** (Phase 44 `validateTemplateRegistry` runs at module load with the 3 premium templates' `aiVoiceNote` fields and stays green)
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **14** (baseline from Phase 47-02 unchanged; all 14 in unrelated stripe/sync-subscription test mocks; zero new errors on the 2 modified source files)
- `npx vitest run` (full suite) → **418 passed / 11 failed** — the 11 failures are the pre-existing baseline (slide-preview, rate-limit, editor responsive, projects CRUD, stripe checkout, stripe sync) carried since Phase 46. Zero new regressions from Phase 47-03.
- Acceptance grep checks all green:
  - `grep -c "NEWS_TEMPLATES" src/lib/ai/prompts.ts` → 3 (1 declaration + 1 use + 1 doc comment; "still present, untouched" — true)
  - `grep -c "newsDropAddendum" src/lib/ai/prompts.ts` → 3 (declaration + interpolation + 1 reference, all untouched)
  - `grep -c "voiceNoteBlock" src/lib/ai/prompts.ts` → 2 (declaration + interpolation)
  - `grep -c "premiumAddendum" src/lib/ai/prompts.ts` → 2 (declaration + interpolation)
  - `grep -c "TEMPLATE VOICE NOTE:" src/lib/ai/prompts.ts` → 1
  - `grep -c "PREMIUM TEMPLATE TIER" src/lib/ai/prompts.ts` → 1
  - `grep -c "isPremiumTemplate" src/lib/ai/prompts.ts` → 3 (1 import + 1 use + 1 in comment); `grep -c "isPremiumTemplate" src/lib/ai/generate-slides.ts` → 2 (import + use)
  - `grep -c "getTemplate" src/lib/ai/prompts.ts` → 2 (import + use)
  - `grep -c "do NOT populate" src/lib/ai/prompts.ts` → 2 (1 comment + 1 actual instruction; runtime prompt has exactly 1 occurrence)
  - `grep -F -c "MUSICAN" src/lib/ai/prompts.ts` → 1 (typo callout in addendum)
  - `grep -c "validateAndRepair" src/lib/ai/generate-slides.ts` → 4 (1 import + 3 uses across initial + retry call sites + the destructured retry result)
  - `grep -c "callGemini" src/lib/ai/generate-slides.ts` → 3 (helper definition + 2 call sites)
  - `grep -F -c "previous response had issues" src/lib/ai/generate-slides.ts` → 1 (retry diagnostic preamble)
  - `grep -F -c "console.warn" src/lib/ai/generate-slides.ts` → 1 (final-fallback warning)
  - `grep -F -c "CarouselSchema.parse(data)" src/lib/ai/generate-slides.ts` → 1 (single Zod gate at end, AFTER retry logic)
  - `grep -c "it(" src/__tests__/ai/prompts.test.ts` → 19
  - `grep -c "it(" src/__tests__/ai/generate-slides.test.ts` → 11 (7 new + 4 baseline)
  - `grep -F -c "mockGenerateContent" src/__tests__/ai/generate-slides.test.ts` → 22 (mock pattern in heavy use)
  - `grep -F -c "toHaveBeenCalledTimes" src/__tests__/ai/generate-slides.test.ts` → 7 (asserting call counts on retry-flow tests)

## TDD Gate Compliance

Both tasks followed strict RED → GREEN sequence:

- **Task 1**: RED commit `a6fbfe1` (test) — 12 fails / 7 pass on first run; GREEN commit `fbe46ea` (feat) — 19/19 pass after the lowercase `'do NOT populate'` fix
- **Task 2**: RED commit `01f57d1` (test) — 5 fails / 6 pass on first run; GREEN commit `7a49218` (feat) — 11/11 pass on first run after the implementation landed

REFACTOR not needed for either task; implementations already minimal.

## User Setup Required

None - no external service configuration required. This plan is purely application code (prompt-string composition + Gemini SDK call orchestration). The Gemini API key is already provisioned (`GEMINI_API_KEY` env var) and unchanged.

## Next Phase Readiness

Phase 47 is functionally complete: TPLAI-01 (length caps), TPLAI-02 (typo gate), TPLAI-03 (highlight pills), TPLAI-04 (voice notes) all satisfied. End-to-end runtime path for premium templates:

1. UI/API caller passes `templateId='magazine-bold'` (or tr3nding-news / documentary) to `generateSlideContent`.
2. `buildSystemPrompt('magazine-bold')` composes the system prompt with `newsDropAddendum` (empty for premium), `voiceNoteBlock` ("Write in punchy news-style…"), and `premiumAddendum` (length caps + #A8E0B0 highlight rules).
3. Gemini returns JSON. `JSON.parse` → `validateAndRepair(data, { templateId: 'magazine-bold' })` produces `{ data, retried: false, warnings }`.
4. If warnings exist (premium tier → any warning fires; typo gate → any-template typo fires), `callGemini` re-runs with a diagnostic addendum.
5. Final result passes through `CarouselSchema.parse` and is returned to the caller. User-observable: hook ≤12 words, body ≤35 words, mint pills on action verbs/proper nouns/numbers (magazine-bold + tr3nding-news), or minimal-aesthetic no-pill output (documentary).

Phase 48 (template thumbnails + picker) can ship next. No blockers, no carry-over deferred items, no architectural decisions surfaced. The retry-flow pattern is also available to be opportunistically applied to `src/lib/services/ai-regen.ts` per-slide regeneration in v2.8+ (CONTEXT.md deferred ideas).

## Self-Check: PASSED

- `src/lib/ai/prompts.ts` — modifications confirmed on disk (2 new const declarations + return-statement interpolation update)
- `src/lib/ai/generate-slides.ts` — modifications confirmed on disk (2 new imports + refactored function body with `callGemini` helper)
- `src/__tests__/ai/prompts.test.ts` — confirmed on disk; 19 tests passing
- `src/__tests__/ai/generate-slides.test.ts` — confirmed on disk; 11 tests passing
- All 4 task commits in `git log --oneline`: a6fbfe1 (test, Task 1 RED), fbe46ea (feat, Task 1 GREEN), 01f57d1 (test, Task 2 RED), 7a49218 (feat, Task 2 GREEN)
- Build clean, AI suite 63/63, snapshot regression 8/8, full suite 418/429 (11 baseline failures only — zero new regressions), tsc baseline 14 errors held

---
*Phase: 47-ai-prompt-tuning*
*Completed: 2026-04-29*
