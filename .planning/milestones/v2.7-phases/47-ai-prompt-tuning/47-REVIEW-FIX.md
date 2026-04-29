---
phase: 47
fixed_at: 2026-04-29T19:35:00Z
review_path: .planning/phases/47-ai-prompt-tuning/47-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 47: Code Review Fix Report

**Fixed at:** 2026-04-29T19:35:00Z
**Source review:** .planning/phases/47-ai-prompt-tuning/47-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: NEEDLES and CALENDER in KNOWN_TYPOS are real English words — false-positive retry risk

**Files modified:** `src/lib/ai/typos.ts`, `src/__tests__/ai/typos.test.ts`
**Commits:** `6c42835` (source), `e19f674` (test update)
**Applied fix:** Removed `'NEEDLES'` and `'CALENDER'` from the `KNOWN_TYPOS` Set. Updated the
file header comment to 28 entries with an explanation of the removal rationale. Updated
`typos.test.ts` to lower the size threshold from 30 to 28, remove both words from the
required-entries list, and add a new explicit assertion that neither word is present.
Test suite went from 63 → 64 tests, all passing.

### IN-01: detectOrphans runs for all templates despite documented premium-only scope

**Files modified:** `src/lib/ai/validate-slides.ts`
**Commit:** `6f64454`
**Applied fix:** Applied Option A from the review suggestion — added inline ternary guard in
`validateAndRepair` at the `detectOrphans` callsite:
`const orphans = isPremiumTemplate(templateId) ? detectOrphans(data.slides) : []`
This mirrors the existing `detectOverflows` pattern and keeps legacy templates from
generating orphan warnings that were previously silently discarded.

### IN-02: Non-retry-path warnings are silently dropped for legacy templates

**Files modified:** `src/lib/ai/generate-slides.ts`
**Commit:** `1d4f999`
**Applied fix:** Added `console.warn` block before the final `CarouselSchema.parse(data)` call,
guarded by `warnings.length > 0 && !hasPremiumWarning && !hasTypoWarning`. Emits:
`[generate-slides] N validation warning(s) (no retry) for templateId=<id>: [...]`
Covers the legacy-template / non-typo warning case that was previously invisible in
production logs.

### IN-03: response.text! non-null assertion produces opaque error on Gemini null response

**Files modified:** `src/lib/ai/generate-slides.ts`
**Commit:** `905bea4`
**Applied fix:** Replaced `return JSON.parse(response.text!)` inside the `callGemini` inner
function with an explicit null guard:
```ts
if (!response.text) {
  throw new Error(
    `[generate-slides] Gemini returned empty response.text (templateId=${templateId ?? '<none>'})`
  )
}
return JSON.parse(response.text)
```
The guard is inside `callGemini`, so it covers both the initial call and the retry path
with a single change. Non-null assertion `!` removed.

---

## Test Results

```
Test Files: 5 passed (5)
Tests:      64 passed (64)
Duration:   ~506ms
```

All 64 AI tests pass. Build: clean (zero errors; pre-existing ESLint warnings only).

---

_Fixed: 2026-04-29T19:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
