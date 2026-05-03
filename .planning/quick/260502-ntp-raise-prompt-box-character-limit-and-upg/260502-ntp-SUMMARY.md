---
phase: quick-260502-ntp
status: complete
date: 2026-05-03
---

# Quick Task 260502-ntp: Summary

Raised the topic-prompt textarea's character ceiling from **500 → 2000** across every layer that enforced it, and upgraded the Gemini 2.5 Flash system instruction so generated slide copy reads as 2026 viral-carousel material instead of 2023 GPT slop.

## Files changed

### Task 1 — char limit (commit `01d03d5`)

| File | Line | Change |
|------|------|--------|
| `src/components/slides/generation-form.tsx` | 198 | `maxLength={500}` → `maxLength={2000}` |
| `src/components/slides/generation-form.tsx` | 220-225 | New `<span>{topic.length} / 2000</span>` counter inserted between attach and submit buttons in the textarea's bottom action row. `pointer-events-none` + `aria-live="polite"` + `tabular-nums`. |
| `src/app/api/v1/carousel/route.ts` | 31-32 | Server validator + error message `1-500` → `1-2000`. |
| `src/app/api/v1/projects/route.ts` | 37-38 | Optional-topic validator + error message `max 500` → `max 2000`. |
| `src/lib/api/openapi.ts` | 376 | `CarouselRequest.topic.maxLength` 500 → 2000. |
| `src/lib/api/openapi.ts` | 539 | createProject inline `topic.maxLength` 500 → 2000. |

Grep verified: zero residual `500` literals tied to `topic` remain in `src/`.

### Task 2 — Gemini system prompt upgrade (commit `8c4fa69`)

| File | Change |
|------|--------|
| `src/lib/ai/slop-guardrails.ts` | Appended `AI_SLOP_AVOID_ADDENDUM` (new export). All existing constants — `IMAGEN_ADDENDUM`, `AI_HOOK_VARIETY_ADDENDUM`, `PEXELS_POSITIVE_TERMS`, `PEXELS_NEGATIVE_ALT_TERMS`, helper functions — byte-identical. |
| `src/lib/ai/prompts.ts` | Extended import to `{ AI_HOOK_VARIETY_ADDENDUM, AI_SLOP_AVOID_ADDENDUM }`. Replaced the 6-bullet legacy HOOK PATTERNS block (POV / Unpopular opinion / 5 mistakes / Before-after) with the 8-formula 2025-26 catalog + REGISTER block + interpolated `${AI_SLOP_AVOID_ADDENDUM}`. `SLIDE STRUCTURE RULES`, `WRITING STYLE`, `LAYOUT & DESIGN RULES`, `perRoleGuidance`, `voiceNoteBlock`, `premiumAddendum`, `newsDropAddendum` blocks unchanged. |

## What shipped (verbatim text)

### New HOOK PATTERNS block

```
HOOK PATTERNS — proven 2025-26 viral carousel formulas. Pick whichever fits the slide's role and the active TEMPLATE VOICE NOTE; vary across slides:
- Insider / gatekept knowledge: "the strategy viral creators don't tell you" — implies hidden value.
- Simplicity promise: "the only 3 things you need to [outcome]" — cuts through noise with a small number.
- Paradox: "why does [thing that seems wrong] actually work?" — the brain wants resolution.
- Proof-led, not promise-led: "this got me [specific result]" — specific number = credibility. Never fake the number.
- Contrarian, but grounded: "[take that runs against the consensus]" — must be defensible, not contrarian-for-its-own-sake.
- Counterintuitive truth: "Staying is the default." / "most people quit before the boring part." — confessional, single sentence, no setup.
- The silent X: "the silent way burnout starts" / "the quiet reason X stops working" — hints at a hidden process.
- Micro-story open (3-beat fragment): "I quit my job to sell paintings. 6 months. 47 canvases. One sold yesterday." — setup, count, payoff.

REGISTER — match hook voice to template family:
- Editorial / quiet templates (paper-essay, editorial-serif, documentary): lowercase serif headlines, restrained declaratives, ONE idea per slide. NO listicle openers, NO hype, NO ALL-CAPS. Short confessional truths read best.
- Tabloid / news templates (news-drop, news-cyan, magazine-bold, tr3nding-news): ALL-CAPS proper nouns, statistics, action verbs ("FIGHTS BACK", "$50M", "12 MINUTES"). Tabloid headline cadence.
- Personal / first-person templates (notes-app-chic, brutalist-grid, highlight-bar, bold-yellow, y2k-pop): fragmented short clauses, lowercase, ransom-note rhythm, "i" statements. Talk-to-me feel.
The TEMPLATE VOICE NOTE above (when present) overrides any conflict with this register guidance.
```

### `AI_SLOP_AVOID_ADDENDUM` (full)

17 anti-patterns covering: negative parallelism, em-dash clusters (≥2 in one slide reads as AI), pedagogical openers, filler transitions, magic adverbs, grandiose nouns, overused verbs, the "serves as" dodge, tricolon abuse, listicle openers, signposted conclusions, bold-first bullet pattern, hedging adverbs, false ranges, and the already-forbidden "in a world where" / "did you know".

## Locked decisions honored

- **D-01:** All 5 char-limit touchpoints raised together — no silent truncation gap.
- **D-02:** Shipped unconditionally. Zero env flags / `NEXT_PUBLIC_*` gates added.
- **D-03:** Legacy HOOK PATTERNS block removed wholesale (not kept alongside).
- Gemini stays on `gemini-2.5-flash` (cheapest viable model per project memory).
- No `temperature` override added (default 1.0 is correct for creative output).
- Response JSON `responseSchema` unchanged.
- Per-template `aiVoiceNote` registry untouched and given precedence-on-conflict in the new REGISTER block.

## Verification

- `npx tsc --noEmit` — no new TS errors in changed files (pre-existing test-mock errors unrelated).
- `npx vitest run src/lib/ai/__tests__/slop-guardrails.test.ts` — 12/12 pass; locked-verbatim grep tests on `IMAGEN_ADDENDUM` + `AI_HOOK_VARIETY_ADDENDUM` still satisfied.
- Grep gates from PLAN.md: zero residual `500` literals on topic touchpoints; zero legacy `POV hooks` / `Unpopular opinion` / `5 mistakes that are costing you` substrings in `prompts.ts`; new addendum referenced exactly twice (import + interpolation).

## Manual QA

Not run in this session — code-only changes. Recommended smoke after deploy: generate one paper-essay carousel with a 1500-char prompt, confirm the counter shows `1500 / 2000`, confirm hooks don't carry "POV:" / "Unpopular opinion:" / em-dash clusters, confirm voice still reads as restrained editorial.

## Commits

- `01d03d5` — feat(quick-260502-ntp/t1): raise topic char limit 500 -> 2000 + add live counter
- `8c4fa69` — feat(quick-260502-ntp/t2): upgrade Gemini system prompt with 2025-26 hook patterns + slop forbid list
