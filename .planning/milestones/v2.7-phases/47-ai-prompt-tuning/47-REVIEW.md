---
phase: 47
status: issues_found
depth: standard
reviewed_at: 2026-04-29T19:32:39Z
files_reviewed: 8
files_reviewed_list:
  - src/lib/ai/typos.ts
  - src/lib/ai/validate-slides.ts
  - src/lib/ai/prompts.ts
  - src/lib/ai/generate-slides.ts
  - src/lib/ai/schemas.ts
  - src/lib/render/templates/magazine-bold.ts
  - src/lib/render/templates/tr3nding-news.ts
  - src/lib/render/templates/documentary.ts
findings:
  critical: 0
  high: 0
  medium: 1
  low: 3
---

# Phase 47: Code Review Report

**Reviewed:** 2026-04-29T19:32:39Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 47 ships four features across two new files and four modified files: a curated typo gate (`typos.ts`, `validate-slides.ts`), a premium-tier prompt addendum with length caps and highlight pill rules, voice-note injection per template, and a retry-once wrapper in `generate-slides.ts`. The overall architecture is sound. The retry loop is strictly bounded at 2 Gemini calls with no recursion risk. The import graph is clean with no circular dependencies — the `PREMIUM_TEMPLATE_IDS` inlining in `validate-slides.ts` correctly avoids the `templates/index.ts` module-load cycle. Gemini network errors propagate normally as rejected promises; none are swallowed. All three locked areas of concern (retry bound, circular dep, Gemini error handling) pass cleanly.

Four findings are reported. One medium-severity issue is a false-positive risk in `KNOWN_TYPOS` where `NEEDLES` and `CALENDER` are legitimate English words that will trigger spurious retries for on-topic content (sewing/textiles). Three low-severity findings cover: `detectOrphans` running for all templates despite documented premium-only scope (harmless behaviorally), a silent warning-drop for non-premium non-typo warnings, and a `response.text!` null assertion that will produce an opaque error on Gemini null-response edge cases.

## Warnings

### WR-01: NEEDLES and CALENDER in KNOWN_TYPOS are real English words — false-positive retry risk

**File:** `src/lib/ai/typos.ts:13,16`
**Issue:** `NEEDLES` and `CALENDER` are both legitimate English words that can appear in normal carousel content. `NEEDLES` as a noun (sewing/knitting needles, acupuncture needles) or verb ("this needles me") will be tokenized to `NEEDLES` and flagged as a typo. `CALENDER` is a machine for pressing cloth or paper and is correct in textile/manufacturing contexts. The tokenizer in `validate-slides.ts:121` splits on `/[^A-Z]+/` — no semantic context is available — so the token `NEEDLES` always matches regardless of intended meaning. The practical effect: any carousel about sewing, knitting, acupuncture, or textile manufacturing will trigger a retry even when the AI's spelling is correct. After the retry produces the same correct word, `console.warn` fires and the slide persists. Two spurious Gemini calls and a logged warning for every such topic.

**Fix:** Remove `NEEDLES` and `CALENDER` from `KNOWN_TYPOS`. These entries cannot be distinguished from their correct-spelling counterparts using the token-based approach. The design decision in CONTEXT.md Area 2 notes `NEEDLES` as a special case "when meaning 'needless'" — that qualifier cannot be implemented with the current tokenizer. Removing them loses detection of a rare AI misspelling in exchange for eliminating false positives on common English words.

```ts
// src/lib/ai/typos.ts — remove these two entries:
// 'NEEDLES',   // real word: sewing needles, acupuncture needles, etc.
// 'CALENDER',  // real word: cloth/paper pressing machine
```

## Info

### IN-01: detectOrphans runs for all templates despite documented premium-only scope

**File:** `src/lib/ai/validate-slides.ts:74-107`
**Issue:** `detectOrphans` has no `isPremiumTemplate` guard, so it generates orphan warnings for legacy templates. The 47-02-SUMMARY explicitly states "length/orphan detection scoped to premium tier only (D-01)." In `validateAndRepair`, `detectOverflows` is guarded (via its own `isPremiumTemplate` check) but `detectOrphans` is not. The behavioral impact is low: the retry gate in `generate-slides.ts` uses `hasPremiumWarning = isPremiumTemplate(templateId) && warnings.length > 0`, so orphan warnings on legacy templates never trigger a retry. However, those warnings are silently dropped without any log, and the scope mismatch between code and documentation creates confusion for future maintainers.

**Fix:** Add a tier guard to `validateAndRepair` consistent with how `detectOverflows` is already gated, or add the guard inside `detectOrphans` itself:

```ts
// Option A — guard in validateAndRepair (mirrors detectOverflows pattern):
const orphans = isPremiumTemplate(templateId) ? detectOrphans(data.slides) : []

// Option B — guard inside detectOrphans signature (matches detectOverflows shape):
export function detectOrphans(
  slides: ReadonlyArray<{ hook_text: string; body_text: string }>,
  templateId?: string,
): OrphanFinding[] {
  if (!isPremiumTemplate(templateId)) return []
  // ... rest of existing logic unchanged
}
```

### IN-02: Non-retry-path warnings are silently dropped for legacy templates

**File:** `src/lib/ai/generate-slides.ts:93-118`
**Issue:** When `templateId` is a legacy template and no typo warnings are present, `validateAndRepair` may still return orphan warnings (see IN-01) which are computed but never logged. More generally, any warnings that exist but do not satisfy the `hasPremiumWarning || hasTypoWarning` gate are silently discarded — no `console.warn`, no caller-visible signal. This makes production debugging harder: a legacy template that consistently produces orphan-like slides will show no log trace.

**Fix:** After the retry branch resolves (or on the non-retry path), emit a `console.warn` for any non-empty warnings that were not acted upon:

```ts
// After the retry block, before CarouselSchema.parse:
if (warnings.length > 0 && !hasPremiumWarning && !hasTypoWarning) {
  console.warn(
    `[generate-slides] validation warnings not retried for templateId=${templateId ?? '<none>'}:`,
    warnings,
  )
}
```

### IN-03: response.text! non-null assertion produces opaque error on Gemini null response

**File:** `src/lib/ai/generate-slides.ts:89`
**Issue:** `return JSON.parse(response.text!)` uses a TypeScript non-null assertion. If Gemini returns a response where `text` is `null` or `undefined` (e.g., safety-filtered response, quota error that returns a partial object, or API edge case), `JSON.parse(undefined)` throws `SyntaxError: Unexpected token u in JSON at position 0` rather than a message that identifies the root cause. On retry, the same opaque error fires again. This is a pre-existing pattern (not introduced in Phase 47) but Phase 47 added a second call site via `callGemini`.

**Fix:** Add a guard before `JSON.parse` so the thrown error is actionable:

```ts
async function callGemini(contents: string): Promise<unknown> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: { systemInstruction, responseMimeType: 'application/json', responseSchema },
  })
  if (!response.text) {
    throw new Error(
      `[generate-slides] Gemini returned empty response.text (templateId=${templateId ?? '<none>'})`
    )
  }
  return JSON.parse(response.text)
}
```

---

_Reviewed: 2026-04-29T19:32:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
