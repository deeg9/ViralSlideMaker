---
phase: quick-260502-ntp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/slides/generation-form.tsx
  - src/app/api/v1/carousel/route.ts
  - src/app/api/v1/projects/route.ts
  - src/lib/api/openapi.ts
  - src/lib/ai/prompts.ts
  - src/lib/ai/slop-guardrails.ts
autonomous: true
requirements:
  - QUICK-260502-NTP-01  # Raise textarea + REST + OpenAPI char ceiling 500 → 2000
  - QUICK-260502-NTP-02  # Upgrade Gemini system prompt: 2025-26 hook patterns + slop forbid list
user_setup: []

must_haves:
  truths:
    - "User can paste up to 2000 characters into the slideshow-topic textarea without truncation."
    - "POST /api/v1/carousel accepts topic strings up to 2000 chars and rejects 2001+ with VALIDATION_ERROR."
    - "POST /api/v1/projects accepts optional topic strings up to 2000 chars and rejects 2001+ with VALIDATION_ERROR."
    - "OpenAPI / Scalar /docs page advertises maxLength: 2000 on both topic fields."
    - "User sees a live character counter on the textarea showing usage against the 2000 ceiling."
    - "Gemini 2.5 Flash system prompt no longer contains the 2023-era 'POV:' / 'Unpopular opinion:' / '5 mistakes that are costing you' HOOK PATTERNS block."
    - "Gemini 2.5 Flash system prompt advertises the 2025-26 hook formulas (curiosity gap, simplicity promise, paradox, proof-led, contrarian, counterintuitive truth, the silent X, micro-story open)."
    - "Gemini 2.5 Flash system prompt contains an explicit AVOID list covering em-dash clusters, pedagogical openers, filler transitions, magic adverbs, grandiose nouns, overused verbs, 'serves as' dodge, negative parallelism, listicle openers, signposted conclusions, hedging adverbs."
    - "Per-template aiVoiceNote registry still flows through buildSystemPrompt unchanged — paper-essay still receives its 'lowercase serif, restrained' voice note."
    - "Gemini model stays gemini-2.5-flash; no temperature override is added."
    - "Response JSON schema is unchanged."
  artifacts:
    - path: "src/components/slides/generation-form.tsx"
      provides: "Textarea with maxLength=2000 + visible char counter"
      contains: "maxLength={2000}"
    - path: "src/app/api/v1/carousel/route.ts"
      provides: "Server-side topic length validator (1-2000)"
      contains: "topic.length > 2000"
    - path: "src/app/api/v1/projects/route.ts"
      provides: "Server-side optional-topic length validator (≤2000)"
      contains: "topic.length > 2000"
    - path: "src/lib/api/openapi.ts"
      provides: "OpenAPI schema declarations for both topic fields"
      contains: "maxLength: 2000"
    - path: "src/lib/ai/prompts.ts"
      provides: "buildSystemPrompt with 2025-26 hook patterns + slop forbid list"
      contains: "AI_SLOP_AVOID_ADDENDUM"
    - path: "src/lib/ai/slop-guardrails.ts"
      provides: "Exported AI_SLOP_AVOID_ADDENDUM constant — single source of truth for slop forbid list"
      contains: "export const AI_SLOP_AVOID_ADDENDUM"
  key_links:
    - from: "src/components/slides/generation-form.tsx (textarea)"
      to: "src/app/api/v1/carousel/route.ts (POST validator)"
      via: "topic field on POST body"
      pattern: "topic\\.length > 2000"
    - from: "src/lib/ai/prompts.ts (buildSystemPrompt)"
      to: "src/lib/ai/slop-guardrails.ts (AI_SLOP_AVOID_ADDENDUM)"
      via: "named import alongside AI_HOOK_VARIETY_ADDENDUM"
      pattern: "import \\{ AI_HOOK_VARIETY_ADDENDUM, AI_SLOP_AVOID_ADDENDUM \\}"
    - from: "src/lib/ai/prompts.ts (buildSystemPrompt return)"
      to: "src/lib/ai/generate-slides.ts (config.systemInstruction)"
      via: "systemInstruction passed to ai.models.generateContent"
      pattern: "model: 'gemini-2\\.5-flash'"
---

<objective>
Raise the slideshow-topic textarea's character ceiling from 500 → 2000 across every layer that enforces it (client UI + 2 REST route validators + 2 OpenAPI declarations), and upgrade the Gemini 2.5 Flash system prompt so generated slide copy comes out more aesthetic, creative, and on-voice with the editorial templates by replacing the 2023-era HOOK PATTERNS block with 2025-26 viral hook formulas and adding a comprehensive AVOID list of AI-slop tells.

Purpose: Power-users genuinely want to paste multi-paragraph briefs (per RESEARCH.md §1.2 + Open Question 1, the user has answered "2000"). Today the 500-char ceiling silently truncates them at the textarea, and even if a power-user bypasses the client they hit 400s from the REST guards. Separately, the current system prompt produces "GPT-slop"-flavored hooks that clash with the editorial / Notes-App-Chic / brutalist / paper-essay templates we ship — the legacy "POV: / Unpopular opinion: / 5 mistakes that are costing you" patterns read as 2023 and now actively undermine the templates' aesthetic intent.

Output:
- Five files modified to raise the char limit + one new visible counter on the textarea
- Two files modified to upgrade the Gemini system instruction (prompts.ts swap + new slop-guardrails.ts constant)
- Zero schema/model/temperature/aiVoiceNote changes (per locked decisions)
- Zero env flags / feature gates (per locked decision 2 — pre-PMF, ship unconditionally)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260502-ntp-raise-prompt-box-character-limit-and-upg/260502-ntp-RESEARCH.md

<interfaces>
<!-- Exact current state of each touchpoint, captured during planning so the executor doesn't re-explore. -->

src/components/slides/generation-form.tsx (lines 188-200, current):
```tsx
<label className="block text-[0.75rem] uppercase font-bold tracking-[0.05em] text-[#7d6161] mb-3 ml-1">
  Presentation Prompt
</label>
<div className="relative">
  <textarea
    value={topic}
    onChange={(e) => setTopic(e.target.value)}
    placeholder="e.g. 5 tips for growing your Instagram following, benefits of morning routines, how to start investing..."
    rows={6}
    disabled={busy}
    maxLength={500}
    className="w-full bg-white pt-6 px-6 pb-16 rounded-xl border-b-2 border-[#dbc1bc]/30 focus:border-[#3d0000] focus:ring-0 transition-all text-lg resize-none placeholder:text-[#dbc1bc] disabled:opacity-50"
  />
```
Topic state lives at the top of the component as `const [topic, setTopic] = useState(currentTopic ?? '')`.

src/app/api/v1/carousel/route.ts (line 31, current):
```ts
if (typeof topic !== 'string' || topic.length === 0 || topic.length > 500) {
  return apiError('VALIDATION_ERROR', 'topic must be a string between 1 and 500 characters', 400)
}
```

src/app/api/v1/projects/route.ts (line 37, current):
```ts
if (topic !== undefined && (typeof topic !== 'string' || topic.length > 500)) {
  return apiError('VALIDATION_ERROR', 'topic must be a string with max 500 characters', 400)
}
```

src/lib/api/openapi.ts (line 376, current — CarouselRequest schema):
```ts
topic: { type: 'string' as const, minLength: 1, maxLength: 500 },
```

src/lib/api/openapi.ts (line 539, current — createProject inline schema):
```ts
topic: { type: 'string' as const, maxLength: 500 },
```

src/lib/ai/prompts.ts (lines 1-3, current import block):
```ts
import { getTemplate } from '@/lib/render/templates'
import { isPremiumTemplate } from './validate-slides'
import { AI_HOOK_VARIETY_ADDENDUM } from './slop-guardrails'
```

src/lib/ai/prompts.ts (lines 77-83, current — the legacy HOOK PATTERNS block to REPLACE wholesale):
```
HOOK PATTERNS - Use these proven TikTok hook formulas:
- Curiosity gaps: "The one thing about X that nobody talks about"
- Pattern interrupts: "Stop scrolling if you..." / "This changed everything"
- POV hooks: "POV: you just discovered..."
- Hot takes: "Unpopular opinion: X is actually..."
- Lists with stakes: "5 mistakes that are costing you..."
- Before/after: "I used to think X, then I learned Y"
```

src/lib/ai/prompts.ts (line 76, current return statement — note the template literal interpolation order):
```ts
return `You are an expert TikTok carousel content creator. You generate slide content for vertical carousel posts (1080x1920 images).${newsDropAddendum}${voiceNoteBlock}${premiumAddendum}${perRoleGuidance}
HOOK PATTERNS - Use these proven TikTok hook formulas:
...
```

src/lib/ai/slop-guardrails.ts (current top-level exports — DO NOT mutate existing constants, ADD a new one):
- `IMAGEN_ADDENDUM` (locked verbatim — DO NOT TOUCH)
- `AI_HOOK_VARIETY_ADDENDUM` (locked verbatim — DO NOT TOUCH)
- `PEXELS_POSITIVE_TERMS` / `PEXELS_NEGATIVE_ALT_TERMS` / helper functions (DO NOT TOUCH)

src/lib/ai/generate-slides.ts (lines 113-121, current — confirms model + no temperature override; DO NOT MODIFY this file):
```ts
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents,
  config: {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema,
  },
})
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Raise topic char ceiling 500 → 2000 across all 5 touchpoints + add textarea counter</name>
  <files>src/components/slides/generation-form.tsx, src/app/api/v1/carousel/route.ts, src/app/api/v1/projects/route.ts, src/lib/api/openapi.ts</files>
  <action>
Per locked decision D-01: raise the topic character ceiling from 500 to 2000 in EVERY layer that enforces it. RESEARCH.md §1.2 catalogued exactly five string-literal `500` occurrences across four files; updating fewer than all five would silently truncate power-user input at whichever layer remains at 500. Do all five edits in this single task — they are tightly coupled.

EDIT 1 — `src/components/slides/generation-form.tsx` line 198:
- Replace `maxLength={500}` with `maxLength={2000}` on the topic textarea.

EDIT 2 — `src/components/slides/generation-form.tsx` (textarea visibility hint, also in this file):
- Add a small live character counter inside the existing absolute-positioned bottom action row (the `<div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">` at lines 203-229). The row currently has two children: the attach button (left) and the submit button (right) with `justify-between`. Insert a counter sibling between them so the layout stays balanced.
- Implementation pattern (keep `pointer-events-none` on the counter — it's read-only):
  ```tsx
  <span
    className="pointer-events-none text-[0.65rem] tracking-wide text-[#7d6161]/60 tabular-nums"
    aria-live="polite"
  >
    {topic.length} / 2000
  </span>
  ```
- Place it as the middle flex child so the layout becomes `[attach] [counter] [submit]`. The counter must update on every `setTopic` call (it reads `topic.length` directly from state — no extra wiring).
- Counter must NOT block clicks (`pointer-events-none` per existing pattern — only the buttons get `pointer-events-auto`).
- Counter color/sizing: muted to match the existing `text-[#7d6161]` palette without competing with the buttons. Use `tabular-nums` so digit-width doesn't jitter the layout as the user types.

EDIT 3 — `src/app/api/v1/carousel/route.ts` line 31-33:
- Replace `topic.length > 500` with `topic.length > 2000`.
- Replace error message `'topic must be a string between 1 and 500 characters'` with `'topic must be a string between 1 and 2000 characters'`.

EDIT 4 — `src/app/api/v1/projects/route.ts` line 37-39:
- Replace `topic.length > 500` with `topic.length > 2000`.
- Replace error message `'topic must be a string with max 500 characters'` with `'topic must be a string with max 2000 characters'`.

EDIT 5 — `src/lib/api/openapi.ts` line 376 (`CarouselRequest.topic`):
- Replace `maxLength: 500` with `maxLength: 2000`.

EDIT 6 — `src/lib/api/openapi.ts` line 539 (createProject inline `topic`):
- Replace `maxLength: 500` with `maxLength: 2000`.

DO NOT add Zod validation. RESEARCH.md §2.5 confirms HTML `maxLength` + REST route guards are sufficient — Zod is overkill for one string field, would expand scope, and the dashboard server action at `src/app/(dashboard)/project/[id]/actions.ts` is intentionally pass-through (RESEARCH.md §1.2).

DO NOT change the textarea `rows={6}` or any other styling.

DO NOT change the `placeholder` text — it still demonstrates the use-case shape.

After all six edits, run a workspace grep to confirm zero residual `500` literals tied to `topic`:
```bash
grep -rn "topic.length > 500\|maxLength.*500\|maxLength={500}\|max 500 characters\|between 1 and 500 characters" src/
```
Expected: zero results. If any match remains, you missed a touchpoint — fix before declaring done.
  </action>
  <verify>
    <automated>grep -rn "topic.length > 500\|maxLength={500}\|max 500 characters\|between 1 and 500 characters" src/ | grep -v '^#' | wc -l | awk '{ if ($1 == 0) print "PASS: zero residual 500-char topic references"; else { print "FAIL: " $1 " residual 500 references"; exit 1 } }' && grep -n "maxLength={2000}" src/components/slides/generation-form.tsx && grep -n "topic.length > 2000" src/app/api/v1/carousel/route.ts && grep -n "topic.length > 2000" src/app/api/v1/projects/route.ts && grep -cn "maxLength: 2000" src/lib/api/openapi.ts | awk -F: '{ if ($2 >= 2) print "PASS: openapi has both maxLength: 2000"; else { print "FAIL: openapi missing one"; exit 1 } }' && grep -n "{topic.length} / 2000" src/components/slides/generation-form.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
- All 5 string-literal `500` ceilings raised to 2000 (textarea attribute + 2 REST guards + 2 OpenAPI entries).
- Visible `{topic.length} / 2000` counter rendered in the textarea's bottom action row, between attach and submit buttons.
- Counter has `pointer-events-none` and `aria-live="polite"`.
- Error messages on the two REST guards updated to say "2000" not "500".
- `npx tsc --noEmit` passes with zero new errors.
- Zero residual `500` literals remain on lines that touch `topic` or its `maxLength`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Upgrade Gemini 2.5 Flash system prompt — replace HOOK PATTERNS block + add slop AVOID list</name>
  <files>src/lib/ai/slop-guardrails.ts, src/lib/ai/prompts.ts</files>
  <action>
Per locked decisions D-02 (ship unconditionally, no env gate) and D-03 (replace HOOK PATTERNS wholesale, do NOT keep alongside): swap the 2023-era hook patterns for the 2025-26 catalog from RESEARCH.md §2.1, and append a comprehensive AVOID list synthesized from RESEARCH.md §2.3. The slop forbid list lives in `slop-guardrails.ts` (single source of truth, alongside `AI_HOOK_VARIETY_ADDENDUM`) so it's testable in isolation and importable from any future call site.

DO NOT modify `IMAGEN_ADDENDUM`, `AI_HOOK_VARIETY_ADDENDUM`, `PEXELS_POSITIVE_TERMS`, `PEXELS_NEGATIVE_ALT_TERMS`, or the helper functions in `slop-guardrails.ts` — they are locked verbatim by Phase 54 D-XX decisions and grep-tested in CI (per the file's header comment).

DO NOT change the Gemini model (stays `gemini-2.5-flash` per locked decision and project memory: cheapest viable model).

DO NOT add a `temperature` override (RESEARCH.md §2.2 confirms default 1.0 is correct for creative output; lowering would hurt variety).

DO NOT modify `responseSchema` or anything in `generate-slides.ts` (locked decision: pure system-instruction text changes only).

DO NOT touch any per-template `aiVoiceNote` strings — they remain the per-template tone-steering primitive (RESEARCH.md §1.4 + §2.5).

DO NOT change `perRoleGuidance`, `newsDropAddendum`, `voiceNoteBlock`, or `premiumAddendum`. They stay exactly as they are.

EDIT 1 — append a new export to `src/lib/ai/slop-guardrails.ts` (do NOT alter existing exports). Add at the bottom of the file (after `filterPexelsResultsByAlt`):

```ts
/**
 * Quick-260502-ntp: forbid list for Gemini system prompt — synthesized from
 * tropes.fyi, Wikipedia "Signs of AI writing," Plagiarism Today (2025-06),
 * and the Goedecke em-dash analysis. Imported by `prompts.ts` and appended
 * unconditionally to every system instruction. Lives here (not inline in
 * prompts.ts) so it's a single source of truth and individually testable.
 *
 * The em-dash rule is intentionally a "cluster" rule, not a blanket ban —
 * isolated em-dashes are fine, ≥2 in one slide reads as AI.
 */
export const AI_SLOP_AVOID_ADDENDUM: string =
  "AVOID — these patterns make copy read as AI-generated. Do not use any of them:\n" +
  "- Negative parallelism: 'It's not X. It's Y.' / 'It's not just X — it's Y.'\n" +
  "- Em-dash clusters: never use more than one em-dash (—) in a single slide's hook + body combined.\n" +
  "- Pedagogical openers: 'Let's dive in', 'Let's unpack', 'Let's break this down', 'Buckle up'.\n" +
  "- Filler transitions: 'It's worth noting', 'Importantly', 'Notably', 'Interestingly', 'Here's the thing', 'Here's the kicker'.\n" +
  "- Magic adverbs as adjective-boosters: 'quietly', 'deeply', 'fundamentally', 'remarkably', 'genuinely'.\n" +
  "- Grandiose abstract nouns: 'tapestry', 'landscape', 'paradigm', 'ecosystem', 'synergy', 'journey', 'realm'.\n" +
  "- Overused verbs: 'delve into', 'leverage', 'utilize', 'harness', 'streamline', 'unlock', 'unleash', 'navigate'.\n" +
  "- The 'serves as' dodge: write 'X is Y', not 'X serves as Y' / 'X stands as Y' / 'X represents Y'.\n" +
  "- Tricolon abuse: avoid stacked 'A, B, and C' / 'from X to Y to Z' rhythms more than once per carousel.\n" +
  "- Listicle openers ('Here are 5...', 'Let's count down...') — these clash with editorial / personal templates.\n" +
  "- Signposted conclusions: 'In conclusion', 'To sum up', 'In summary', 'All in all'.\n" +
  "- Bold-first bullet pattern where every list item begins with a bolded label followed by a colon.\n" +
  "- Hedging adverbs that drain confidence: 'perhaps', 'potentially', 'arguably', 'somewhat', 'generally'.\n" +
  "- False ranges: 'from beginners to experts' with no real middle. State the actual audience.\n" +
  "- 'Imagine a world where' / 'In a world where' / 'Did you know' — already forbidden, repeated for emphasis."
```

EDIT 2 — `src/lib/ai/prompts.ts` line 3 (extend the existing import):

Current:
```ts
import { AI_HOOK_VARIETY_ADDENDUM } from './slop-guardrails'
```

Replace with:
```ts
import { AI_HOOK_VARIETY_ADDENDUM, AI_SLOP_AVOID_ADDENDUM } from './slop-guardrails'
```

EDIT 3 — `src/lib/ai/prompts.ts` lines 76-83. The current return statement begins:
```
return `You are an expert TikTok carousel content creator. You generate slide content for vertical carousel posts (1080x1920 images).${newsDropAddendum}${voiceNoteBlock}${premiumAddendum}${perRoleGuidance}
HOOK PATTERNS - Use these proven TikTok hook formulas:
- Curiosity gaps: "The one thing about X that nobody talks about"
- Pattern interrupts: "Stop scrolling if you..." / "This changed everything"
- POV hooks: "POV: you just discovered..."
- Hot takes: "Unpopular opinion: X is actually..."
- Lists with stakes: "5 mistakes that are costing you..."
- Before/after: "I used to think X, then I learned Y"
```

Replace the entire `HOOK PATTERNS` block (lines 77-83 in the current file — the line `HOOK PATTERNS - Use these proven TikTok hook formulas:` through the final `Before/after:` bullet inclusive) with the new 2025-26 catalog below. Leave the lines BEFORE it (the `${perRoleGuidance}` close + return-template-literal opener) and AFTER it (`SLIDE STRUCTURE RULES:` onward) UNCHANGED.

New block — paste verbatim where the old HOOK PATTERNS block was:

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

${AI_SLOP_AVOID_ADDENDUM}
```

NOTE on the `${AI_SLOP_AVOID_ADDENDUM}` interpolation: this is inside the same backtick-delimited template literal that returns from `buildSystemPrompt`, so the `${...}` syntax is correct — DO NOT escape it. Verify after the edit by reading the surrounding lines: the opening backtick is on line 76 after `return ` and the closing backtick is on the final line of the function (currently line 105). The new `${AI_SLOP_AVOID_ADDENDUM}` interpolation must sit between the new HOOK PATTERNS / REGISTER blocks and the existing `SLIDE STRUCTURE RULES:` block — i.e., still inside that single template literal.

EDIT 4 — sanity check the surrounding blocks remain intact. After your edit, lines from `SLIDE STRUCTURE RULES:` through `Keep text concise per slide — aim for a glanceable read (under 3 seconds per slide).` and the final closing backtick of the template literal MUST be untouched. Run:
```bash
grep -n "SLIDE STRUCTURE RULES:\|WRITING STYLE:\|LAYOUT & DESIGN RULES" src/lib/ai/prompts.ts
```
Expected: each substring still appears exactly once.

EDIT 5 — verify the legacy patterns are gone. Run:
```bash
grep -E "POV hooks|Unpopular opinion: X is actually|5 mistakes that are costing you|POV: you just discovered" src/lib/ai/prompts.ts
```
Expected: zero matches. If any remain, the replacement was incomplete.

EDIT 6 — verify the new addendum is wired through. Run:
```bash
grep -n "AI_SLOP_AVOID_ADDENDUM" src/lib/ai/prompts.ts
```
Expected: 2 matches (1 in the import, 1 in the template literal interpolation).

DO NOT add a unit test in this task. The slop-guardrails test suite (`src/lib/ai/__tests__/slop-guardrails.test.ts` per the file header in slop-guardrails.ts) grep-tests the existing locked constants verbatim; adding `AI_SLOP_AVOID_ADDENDUM` test coverage there is an enhancement and out of scope for this quick task. Existing tests must still pass — that's the bar.
  </action>
  <verify>
    <automated>grep -c "AI_SLOP_AVOID_ADDENDUM" src/lib/ai/slop-guardrails.ts | awk '{ if ($1 >= 1) print "PASS: addendum exported"; else { print "FAIL: addendum missing"; exit 1 } }' && grep -c "AI_SLOP_AVOID_ADDENDUM" src/lib/ai/prompts.ts | awk '{ if ($1 == 2) print "PASS: addendum imported and interpolated"; else { print "FAIL: expected 2 references in prompts.ts, found " $1; exit 1 } }' && grep -E "POV hooks|Unpopular opinion: X is actually|5 mistakes that are costing you|POV: you just discovered" src/lib/ai/prompts.ts | grep -v '^#' | wc -l | awk '{ if ($1 == 0) print "PASS: legacy hook patterns removed"; else { print "FAIL: " $1 " legacy hook patterns remain"; exit 1 } }' && grep -c "Insider / gatekept knowledge\|Simplicity promise\|Counterintuitive truth\|Micro-story open\|the silent way burnout starts" src/lib/ai/prompts.ts | awk '{ if ($1 >= 4) print "PASS: 2025-26 hook patterns present"; else { print "FAIL: only " $1 " new hook patterns found"; exit 1 } }' && grep -c "SLIDE STRUCTURE RULES:" src/lib/ai/prompts.ts | awk '{ if ($1 == 1) print "PASS: SLIDE STRUCTURE RULES intact"; else { print "FAIL"; exit 1 } }' && grep -c "WRITING STYLE:" src/lib/ai/prompts.ts | awk '{ if ($1 == 1) print "PASS: WRITING STYLE intact"; else { print "FAIL"; exit 1 } }' && grep -c "model: 'gemini-2.5-flash'" src/lib/ai/generate-slides.ts | awk '{ if ($1 == 1) print "PASS: model unchanged"; else { print "FAIL"; exit 1 } }' && (grep -c "temperature" src/lib/ai/generate-slides.ts || echo 0) | awk '{ if ($1 == 0) print "PASS: no temperature override added"; else { print "FAIL: temperature now appears in generate-slides.ts"; exit 1 } }' && npx tsc --noEmit && npx vitest run src/lib/ai/__tests__/slop-guardrails.test.ts 2>&1 | tail -5</automated>
  </verify>
  <done>
- `AI_SLOP_AVOID_ADDENDUM` exported from `src/lib/ai/slop-guardrails.ts` covering the 17-item slop-marker forbid list from RESEARCH.md §2.3.
- `prompts.ts` imports `AI_SLOP_AVOID_ADDENDUM` alongside the existing `AI_HOOK_VARIETY_ADDENDUM` (one combined named-import line).
- The legacy 6-bullet HOOK PATTERNS block (POV / Unpopular opinion / 5 mistakes / Before-after) is fully gone from `prompts.ts`.
- The new HOOK PATTERNS block lists at least the 8 formulas: Insider/gatekept, Simplicity promise, Paradox, Proof-led, Contrarian-but-grounded, Counterintuitive truth, The silent X, Micro-story open.
- A REGISTER section ties hook voice to template family (editorial / tabloid / personal), explicitly noting that TEMPLATE VOICE NOTE overrides on conflict (so per-template `aiVoiceNote` keeps primacy).
- `${AI_SLOP_AVOID_ADDENDUM}` is interpolated inside the same backtick template literal that returns from `buildSystemPrompt`, after the new HOOK PATTERNS + REGISTER blocks and before `SLIDE STRUCTURE RULES:`.
- `IMAGEN_ADDENDUM`, `AI_HOOK_VARIETY_ADDENDUM`, `PEXELS_POSITIVE_TERMS`, `PEXELS_NEGATIVE_ALT_TERMS`, `pexelsQueryWithGuardrails`, `filterPexelsResultsByAlt` in `slop-guardrails.ts` are byte-identical to before.
- `SLIDE STRUCTURE RULES:`, `WRITING STYLE:`, `LAYOUT & DESIGN RULES`, `perRoleGuidance`, `newsDropAddendum`, `voiceNoteBlock`, `premiumAddendum` blocks all appear exactly once and are unchanged.
- Gemini model still `gemini-2.5-flash` in `generate-slides.ts`.
- No `temperature` field added to the `config` object in `generate-slides.ts`.
- `npx tsc --noEmit` passes.
- Existing `slop-guardrails.test.ts` suite passes (the locked-verbatim grep-checks for `IMAGEN_ADDENDUM` + `AI_HOOK_VARIETY_ADDENDUM` are still satisfied because we did not mutate those strings).
  </done>
</task>

</tasks>

<verification>
End-to-end functional check (manual smoke, optional but informative):
1. `npm run dev` → navigate to slideshow generation form → paste a 1500-character topic. Counter shows `1500 / 2000`. Submit. No 400 error. Carousel generates.
2. Inspect any generated carousel against an editorial template (e.g., `paper-essay`). Hooks should NOT contain "POV:", "Unpopular opinion:", or "5 mistakes that are costing you" patterns. Hooks should NOT contain em-dash clusters (≥2 em-dashes per slide). Hooks SHOULD reflect the per-template voice note (paper-essay → lowercase serif, restrained, single-idea).
3. `curl -X POST .../api/v1/carousel` with a 2001-char topic → expect 400 `VALIDATION_ERROR` with new "between 1 and 2000" message.
4. Visit `/docs` (Scalar OpenAPI page) → confirm both `topic` fields show `maxLength: 2000`.

Automated regression bar:
- `npx tsc --noEmit` clean.
- Existing `slop-guardrails.test.ts` green.
- No new TypeScript errors in either modified file.
</verification>

<success_criteria>
1. All 5 RESEARCH.md §1.2 touchpoints raised from 500 → 2000 (textarea attribute + `carousel/route.ts` + `projects/route.ts` + 2 OpenAPI declarations); error messages updated to mention "2000".
2. Live `{topic.length} / 2000` counter visible in the textarea's bottom action row, between attach and submit, with `pointer-events-none` and `aria-live="polite"`.
3. Legacy 2023-era HOOK PATTERNS block (POV / Unpopular opinion / 5 mistakes that are costing you / I-used-to-think-X-then-Y) wholly removed from `prompts.ts`.
4. New 2025-26 HOOK PATTERNS catalog (8 formulas from RESEARCH.md §2.1) substituted in.
5. New REGISTER block ties hook voice to editorial / tabloid / personal template families and gives `aiVoiceNote` precedence on conflict.
6. New `AI_SLOP_AVOID_ADDENDUM` constant exported from `slop-guardrails.ts` and interpolated into the system prompt.
7. Per-template `aiVoiceNote` registry untouched and still flows into the prompt via `voiceNoteBlock`.
8. Gemini model still `gemini-2.5-flash`. No `temperature` override added. Response JSON schema unchanged.
9. No env flag / `NEXT_PUBLIC_*` gate introduced (D-02: ship unconditionally).
10. `npx tsc --noEmit` passes; existing `slop-guardrails.test.ts` passes.
</success_criteria>

<output>
After completion, create `.planning/quick/260502-ntp-raise-prompt-box-character-limit-and-upg/260502-ntp-SUMMARY.md` capturing:
- Files changed + line-level diff intent
- The full new HOOK PATTERNS + REGISTER block as shipped (so future quick tasks can diff against it)
- The full new `AI_SLOP_AVOID_ADDENDUM` string as shipped
- One-shot manual QA result: "generated a paper-essay carousel with prompt X, hooks read as Y" (qualitative — pre-PMF, no formal metric)
- Commit SHA
</output>
