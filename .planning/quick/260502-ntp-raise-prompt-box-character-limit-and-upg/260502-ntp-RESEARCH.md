# Quick Task 260502-ntp — Research

**Topic:** Raise the user-prompt textarea char limit, AND upgrade the Gemini 2.5 Flash system instruction so generated slides feel viral / aesthetic / editorial — not generic "GPT slop."
**Researched:** 2026-05-02
**Confidence:** HIGH on codebase facts; MEDIUM on web-sourced viral patterns (cross-verified across 3+ sources).

---

## Summary

The current setup is a **3-layer 500-char ceiling** (textarea attribute + 2 server-side route guards + 2 OpenAPI declarations) with a **strong but generic system prompt** that already does a lot right (per-template `aiVoiceNote`, length caps, slop guardrails for hooks, premium typo gate, role-aware copy guidance). The textarea limit is the easy half. The harder half is upgrading the system instruction to (a) match the *editorial / Notes-App-Chic / brutalist / paper-essay / magazine-bold* aesthetic the new templates ship, (b) explicitly forbid the most common AI-slop tells, and (c) lean harder on micro-story / counterintuitive-truth hook patterns that creators are actually using on TikTok carousels in 2025-2026. All raw materials below — planner picks the final wording.

---

## PART 1 — Codebase Reconnaissance

### 1.1 Current textarea limit (client side)

`src/components/slides/generation-form.tsx:198`

```tsx
<textarea
  value={topic}
  onChange={(e) => setTopic(e.target.value)}
  placeholder="e.g. 5 tips for growing your Instagram following, benefits of morning routines, how to start investing..."
  rows={6}
  disabled={busy}
  maxLength={500}
  ...
/>
```

Plus inline state: `const [topic, setTopic] = useState(currentTopic ?? '')` — no Zod parse on the client, just the HTML `maxLength`.

### 1.2 Server-side validation — RAISING THE CLIENT ALONE IS NOT ENOUGH

Three places enforce 500 server-side. All must be raised in lockstep, otherwise external API consumers get 400s past the new limit.

| File | Line | Constraint |
|---|---|---|
| `src/app/api/v1/carousel/route.ts` | 31 | `topic.length === 0 \|\| topic.length > 500` → `VALIDATION_ERROR` |
| `src/app/api/v1/projects/route.ts` | 37 | `topic.length > 500` → `VALIDATION_ERROR` |
| `src/lib/api/openapi.ts` | 376 | `CarouselRequest.topic` `maxLength: 500` (OpenAPI / Scalar `/docs`) |
| `src/lib/api/openapi.ts` | 539 | second `topic` declaration on a different request shape, also `maxLength: 500` |

**The dashboard server action does NOT validate length.** `src/app/(dashboard)/project/[id]/actions.ts:24-31` — `generateCarousel(...)` accepts `topic: string` and passes it through unchanged. So the dashboard itself is currently capped only by the client-side `maxLength`. (No matching Zod schema for topic exists anywhere in `src/lib/`.)

**Implication for planner:** raising the limit cleanly = one client edit + two REST route guards + two OpenAPI schema entries. Five touchpoints, all string-literal `500`.

### 1.3 Current Gemini system prompt (verbatim structure, model + config)

Builder lives at `src/lib/ai/prompts.ts:10-106` (`buildSystemPrompt(templateId)`). Composed of 6 sections, conditionally:

1. **Static base intro** (always): `"You are an expert TikTok carousel content creator. You generate slide content for vertical carousel posts (1080x1920 images)."`
2. **News Drop addendum** — only when `templateId ∈ {'news-drop', 'news-cyan'}`. Tabloid-headline rules + `hook_segments` + `layout: cover/body` + photojournalism image queries.
3. **Template Voice Note** — pulled from `template.aiVoiceNote` per registered template (see 1.4 below).
4. **Premium-tier addendum** — gated on `isPremiumTemplate(templateId)`:
   - LENGTH CAPS: hook ≤12 words, body ≤35 words
   - NO ORPHANS: hook + body must differ, <80% word overlap
   - SPELLING gate (28 known typos: MUSICAN, BUSSINESS, CARROUSEL, RECIEVE, SEPERATE, OCCURENCE, DEFINATELY, ACCOMODATE...)
   - HIGHLIGHTS: instructs Gemini to populate `highlightColor: '${accentHex}'` `highlightStyle: 'pill'` on action verbs / proper nouns / numbers
   - HOOK VARIETY (`AI_HOOK_VARIETY_ADDENDUM` — see 1.5).
5. **Per-Role Copy Guidance** (always): `cover` / `reframe` / `support` / `pivot` / `close` — with role-specific intent ("pattern-interrupt hook ≤8 words" / "wait, but tension" / "concrete evidence" / "unexpected angle" / "CTA").
6. **HOOK PATTERNS + SLIDE STRUCTURE RULES + WRITING STYLE + LAYOUT & DESIGN RULES** (always; ~30 lines of static guidance — listed in `prompts.ts:77-105`).

**Hook patterns currently advertised (lines 78-83):**
- Curiosity gaps: "The one thing about X that nobody talks about"
- Pattern interrupts: "Stop scrolling if you..." / "This changed everything"
- POV hooks: "POV: you just discovered..."
- Hot takes: "Unpopular opinion: X is actually..."
- Lists with stakes: "5 mistakes that are costing you..."
- Before/after: "I used to think X, then I learned Y"

**Writing style block (lines 92-97):**
- Conversational, not corporate
- Short sentences. Punchy. Direct.
- Use line breaks for emphasis
- Numbers and statistics when relevant
- Emoji sparingly (1-2 per carousel max, or zero)

**Model + config** — `src/lib/ai/generate-slides.ts:113-121`:
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
**No `temperature`, no `topK`, no `topP` set.** Gemini 2.5 Flash defaults apply (= `1.0`). Structured output via `responseMimeType: 'application/json'` + `responseSchema`.

### 1.4 Existing per-template `aiVoiceNote` strings (already shipped in v2.7 / v2.9)

Already wired. The new system prompt should keep using these — they're the per-template tone steering knobs.

| Template | Tier | `aiVoiceNote` |
|---|---|---|
| `paper-essay` | free | "Editorial essay register — restrained, mindful, single-idea-per-slide. Use lowercase serif headlines and short italic sub-text. Avoid hype, listicle tropes, or hedges." |
| `editorial-serif` | free | "Editorial register — restrained, declarative single sentences. Avoid hedges and filler. Reference cultural / institutional / personal nuance over listicle tropes." |
| `notes-app-chic` | free | "Personal first-person voice. Fragmented for ransom-note rhythm — short clauses, conversational tone. Like a stranger telling you about their week." |
| `brutalist-grid` | free | "Brutalist register — short declarative statements. No hedging, no soft sells. Confident assertions, often paradoxical or pointed." |
| `magazine-bold` | premium | "Write in punchy news-style: tabloid-pitched headlines, statistics over adjectives, action verbs over states-of-being. Tone is urgent and confident, like a magazine cover line." |
| `tr3nding-news`, `documentary` | premium | (declared in those files — same news / restrained register respectively) |

### 1.5 Existing slop guardrails (locked verbatim in `slop-guardrails.ts`)

Worth keeping. Don't duplicate; extend.

```ts
AI_HOOK_VARIETY_ADDENDUM =
  "Do not start hooks with 'In a world where', 'Did you know', or 'Imagine if'. " +
  "Vary hook openings across slides in the same carousel — no two slides should start with the same word or phrase pattern."
```

### 1.6 JSON output schema Gemini emits

Per slide (from `generate-slides.ts:33-85` and `schemas.ts`):

- `hook_text: string` — hook copy
- `hook_segments?: TextSegment[]` — per-word `{ text, accent, highlightColor?, highlightStyle? }`
- `body_text: string`
- `body_segments?: TextSegment[]`
- `image_query: string` — Pexels search terms
- `layout?: 'cover' | 'body'` — only used by news templates
- `is_cta: boolean`
- `role: 'cover' | 'reframe' | 'support' | 'pivot' | 'close'` — required
- `template_id_override?: string` — closed enum, invalid silently stripped

Carousel-level: `title`, `slides[]` (3-10).

### 1.7 Template aesthetic intent (what successful prompts must produce)

The 11 active templates split into roughly three voices. Hook copy that succeeds on each is *qualitatively different*:

- **Editorial / quiet** — `paper-essay`, `editorial-serif`, `documentary`. Lora/Playfair serifs, cream/black backgrounds, restrained sentences. Want: lowercase confessional truths, single-idea slides, NO hype.
- **Tabloid / news** — `news-drop`, `news-cyan`, `magazine-bold`, `tr3nding-news`. Anton/Archivo Black, mint pill highlights. Want: ALL-CAPS proper nouns, statistics, action verbs ("FIGHTS BACK", "$50M", "12 MINUTES").
- **Personal / first-person** — `notes-app-chic`, `brutalist-grid`, `highlight-bar`, `bold-yellow`, `y2k-pop`. Mixed display fonts, cream/yellow/cyan backgrounds. Want: short fragmented clauses, "i" statements, ransom-note rhythm.

A single system prompt has to flex across all three — **the per-template `aiVoiceNote` is the primary axis** that does this and should keep doing it.

---

## PART 2 — External Research (Viral Patterns + Gemini Specifics + Slop Markers)

### 2.1 TikTok carousel hook patterns that work in 2025-2026

Cross-verified across PostWaffle, MarketingBlocks, postnitro, ViralityWand, and independent creator sources.

**The 2-second / 1-second rule.** "You have about 2 seconds for your hook... TikTok scrolling is faster, your hook needs to work in 1 second, not 2... if your Instagram carousel slides have 30-40 words each, your TikTok versions should have 15-25 words per slide with bigger fonts." — *PostWaffle, "15 TikTok Carousel Hook Formulas," 2026.* This validates the existing "hook ≤12 words, body ≤35 words" cap on premium templates and arguably tightens it.

**Hook formulas creators are using (high-signal, recurring across 4+ sources):**

| Formula | Example | Mechanic |
|---|---|---|
| Insider / gatekept knowledge | "The strategy viral creators don't tell you" | Implies hidden value |
| Simplicity promise | "The only 3 things you need to [outcome]" | Cuts through noise |
| Paradox | "Why does [thing that seems wrong] actually work?" | Brain wants resolution |
| Proof-led, not promise-led | "This [thing] got me [specific result]" | Specific number = credibility |
| Contrarian | "Unpopular opinion: [take]" | Signals difference |
| Counterintuitive truth | "Staying is the default." | Confessional / cognitive speed bump |
| The silent X | "the silent way burnout starts" | Hints at hidden process |
| Micro-story open | "I quit my job to sell paintings. 6 months. 47 canvases. One sold yesterday." | Three-beat: setup, count, payoff |

**Body cadence patterns (from postnitro.ai carousel framework + GARIMASHARES + StoryCraft):**
- One idea per slide. Don't pack two.
- "Sequential storytelling — each swipe creates a small reveal and a mini 'aha'." — *postnitro.ai*
- "Long captions with breathing room in lowercase create a casual, talk-to-me feel." — *postnitro.ai* — confirms the lowercase-aesthetic instinct.
- Sensory verbs > adjectives. "FIGHTS BACK" > "very strong reaction".
- Numbers when they're real. Don't fake specificity.

**Topic framing — editorial vs hype voice.** The `paper-essay` / `editorial-serif` aesthetic wants the *Substack-essay* register: counterintuitive truth, restrained, no hype. The Notes-App-Chic / brutalist register wants the *micro-story / fragment* register. Forcing either into a "5 tips for X" listicle voice produces the look the templates were specifically designed to avoid.

### 2.2 Gemini 2.5 Flash prompt-engineering specifics for creative + structured output

**Temperature for creative writing (cross-verified, MEDIUM confidence — community + reelmind):**
- 0.4-0.7: general tasks + creative writing with constraints (good default for our use case)
- 0.8-1.0: highly creative, brainstorming
- ≥1.0 risks hallucinations (ours is currently default, which is **1.0**)

**The structured-output tradeoff (HIGH confidence — Google Cloud + ai.google.dev):**
- "Using structured output on tuned Gemini models can result in decreased model quality." — *Google AI for Developers, structured-output docs*
- "Keeping schemas flat is important — deeply nested objects increase failure rates."
- Our schema is moderately nested (`slides[].hook_segments[]`) but not pathological. No action needed.

**Gemini 3 series specific note (CITED, doesn't apply to us yet):**
- "For Gemini 3 series models, keeping temperature at the default 1.0 when using function calling is important — changing it may lead to looping or degraded performance."
- We're on `gemini-2.5-flash`, not 3. So `temperature` *is* a viable knob for us today.

**Recommended stance for planner:** the system instruction is the highest-leverage tool here, not temperature. Setting `temperature: 0.9-1.0` explicitly is fine; setting it lower for "consistency" would *worsen* creative output.

**Docs link:** https://ai.google.dev/gemini-api/docs/prompting-strategies (general Gemini prompt design); https://ai.google.dev/gemini-api/docs/structured-output (JSON schema mode).

### 2.3 AI-slop markers to explicitly forbid

From `tropes.fyi` (community-maintained AI-trope catalog), Wikipedia "Signs of AI writing," Plagiarism Today, Washington Post 2025-04, and Sean Goedecke "Why do AI models use so many em-dashes?" — cross-verified.

**Forbid in the new system prompt (high-confidence, recurring across 3+ sources):**

| Slop marker | Example to forbid |
|---|---|
| Em-dash addiction | "It's not X — it's Y" / scattered em dashes for drama |
| Pedagogical voice | "Let's dive in," "Let's unpack," "Let's break this down" |
| Filler transitions | "It's worth noting," "Importantly," "Notably," "Interestingly" |
| Magic adverbs | "quietly," "deeply," "fundamentally," "remarkably" |
| Grandiose nouns | "tapestry," "landscape," "paradigm," "ecosystem," "synergy" |
| Overused verbs | "delve into," "leverage," "utilize," "harness," "streamline" |
| "Serves as" dodge | "X serves as / stands as / represents Y" instead of "X is Y" |
| Negative parallelism | "It's not X. It's Y." — single most common AI tell |
| Tricolon / triadic abuse | "From X to Y to Z" / "A, B, and C" rhythm overload |
| "Imagine a world where" / "In a world where" | Already in `AI_HOOK_VARIETY_ADDENDUM` — keep |
| "Did you know" | Already forbidden — keep |
| False ranges | "From beginners to experts" with no real middle |
| Signposted conclusions | "In conclusion," "To sum up," "In summary" |
| Bold-first bullet pattern | every list item starts with **bolded label** |
| Listicle openers | "Here are 5..." / "Let's count down..." (clashes with editorial templates) |
| "Here's the kicker" / "Here's the thing" | False suspense |
| Hedging adverbs | "perhaps," "potentially," "arguably" — kill confidence |

**Source on em-dash specifically:** evidence is mixed. Sean Goedecke notes em-dashes alone aren't a reliable AI tell. *But* clustered em-dashes (multiple in a single short slide) are. Forbidding **two or more em dashes in any single slide's hook + body combined** is a defensible heuristic; a blanket ban is over-strict.

### 2.4 What the new prompt should ADD beyond what's there

Based on the gap between current `prompts.ts` and the patterns surfaced above:

1. **Explicit "AVOID" list** of the slop markers in 2.3. Today only `AI_HOOK_VARIETY_ADDENDUM` covers this, and only for 3 phrases.
2. **Stronger examples for each per-role voice.** The current per-role guidance is abstract ("pattern-interrupt hook ≤8 words"). Adding 1-2 concrete examples per role (cover/reframe/support/pivot/close) would lift quality more than any other single change.
3. **Aesthetic-register instruction tied to template family** (editorial / news / personal) — separate from per-template `aiVoiceNote`, framed as a register choice. Or fold register into a richer per-template note.
4. **Forbid listicle openers on editorial templates.** Currently the prompt advertises "Lists with stakes: '5 mistakes that are costing you...'" universally — this *clashes* with `paper-essay` and `editorial-serif`'s stated intent ("Avoid... listicle tropes").
5. **Concrete sensory-verb / proper-noun / number guidance** for hook construction beyond the current "Numbers and statistics when relevant."
6. **Lowercase-permission clause** — explicitly allow lowercase headlines on editorial / personal templates. Currently the prompt is ambiguous; AI defaults to title case.
7. **"Show, don't tell" via micro-story rhythm** — model the 3-beat fragment pattern ("setup. count. payoff.") that creators use in viral carousels.

### 2.5 Don't-hand-roll / keep-as-is

- **Don't replace per-template `aiVoiceNote`** — it's the right primitive, just under-used.
- **Don't lower the temperature.** Default 1.0 is fine for creative output on 2.5 Flash; lowering harms variety.
- **Don't add Zod for client topic length.** The HTML `maxLength` + REST route guard pair is sufficient. Adding Zod is overkill for one string field.
- **Don't break the existing JSON `responseSchema`.** All slop fixes are system-instruction text, not schema changes.

---

## Open Questions (for planner / user)

1. **What's the new char limit?** Common picks for prompt-style textareas: 1000, 2000, 4000. The viral carousel content people enter is genuinely longer than 500 (think detailed brand prompts, multi-paragraph briefs). 2000 is a safe, common default that won't strain Gemini's context. The user should confirm or pick.
2. **Should the upgraded system prompt be conditionally engaged via env flag** for safe rollback (mirroring v2.8's `NEXT_PUBLIC_NEW_TEXT_RAIL` pattern), or shipped unconditionally? Pre-PMF, unconditional is simpler.
3. **Does the legacy `HOOK PATTERNS` block** in `prompts.ts:77-83` survive in the new prompt, or get replaced with the richer 2025-2026 pattern catalog from 2.1? Recommend: replace, since the legacy patterns are 2023-era and now read as cliché.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `src/components/slides/generation-form.tsx` (line 198 — current `maxLength`)
- `src/app/api/v1/carousel/route.ts` (line 31 — server guard)
- `src/app/api/v1/projects/route.ts` (line 37 — server guard)
- `src/lib/api/openapi.ts` (lines 376, 539 — OpenAPI schema)
- `src/lib/ai/prompts.ts` (full system-prompt builder)
- `src/lib/ai/generate-slides.ts` (model = `gemini-2.5-flash`, no temperature set)
- `src/lib/ai/slop-guardrails.ts` (existing slop guards, locked verbatim)
- `src/lib/ai/schemas.ts` (Zod / Gemini response schema)
- `src/lib/render/templates/paper-essay.ts`, `notes-app-chic.ts`, etc. — `aiVoiceNote` strings

### Secondary (MEDIUM confidence — 2026 web sources, cross-verified)
- [PostWaffle — 15 TikTok Carousel Hook Formulas That Get People Swiping](https://www.postwaffle.com/blog/tiktok-carousel-hooks)
- [MarketingBlocks — 50+ Viral Hook Templates for Ads, Reels, TikTok or Captions (2026)](https://www.marketingblocks.ai/50-viral-hook-templates-for-ads-reels-tiktok-or-captions-2026-frameworks-examples-ai-prompts-included/)
- [postnitro.ai — Carousel Copywriting: The Complete Conversion Framework](https://postnitro.ai/blog/post/carousel-copywriting-framework)
- [postnitro.ai — 15 Strategies for Viral Instagram Carousels in 2025](https://postnitro.ai/blog/post/viral-instagram-carousels-strategies-2025)
- [ViralityWand — TikTok Carousel Posts: The Complete Guide for 2026](https://viralitywand.com/blog/tiktok-carousel-posts-guide/)
- [SendShort — Top 14 TikTok Hooks for 84.3% More Engagement (2026)](https://sendshort.ai/guides/tiktok-hooks/)
- [Cyndi Zaweski — Create Engaging Instagram Carousel Posts (2026)](https://www.cyndizaweski.com/articles/how-to-design-an-instagram-carousel-post-that-will-increase-your-engagement)

### Slop-marker cross-references
- [tropes.fyi — Top AI Writing Tropes to Avoid (community gist)](https://gist.github.com/ossa-ma/f3baa9d25154c33095e22272c631f5a1)
- [Wikipedia — Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
- [Sean Goedecke — Why do AI models use so many em-dashes?](https://www.seangoedecke.com/em-dashes/)
- [Washington Post 2025-04-09 — em-dash AI writing punctuation](https://www.washingtonpost.com/technology/2025/04/09/ai-em-dash-writing-punctuation-chatgpt/)
- [Plagiarism Today — Em Dashes, Hyphens and Spotting AI Writing (2025-06)](https://www.plagiarismtoday.com/2025/06/26/em-dashes-hyphens-and-spotting-ai-writing/)
- [wmedia.es — The humanizer skill in Claude Code](https://wmedia.es/en/tips/claude-code-humanizer-skill)

### Gemini-specific (HIGH confidence — official + Cloud)
- [Google AI for Developers — Prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- [Google AI for Developers — Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Google Cloud — Best Practices for Prompt Engineering with Gemini 2.5 Pro](https://medium.com/google-cloud/best-practices-for-prompt-engineering-with-gemini-2-5-pro-755cb473de70)
- [ReelMind — Gemini 2.5 Flash Temperature: Tech Specifications Explained](https://reelmind.ai/blog/gemini-2-5-flash-temperature-tech-specifications-explained)
- [Google Cloud — Structured Output with Gemini Models (Saverio Terracciano)](https://medium.com/google-cloud/structured-output-with-gemini-models-begging-borrowing-and-json-ing-f70ffd60eae6)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Default temperature for `gemini-2.5-flash` is `1.0` when not set | 1.3, 2.2 | Low — even if 0.7, the recommendation (don't lower) still holds |
| A2 | "Em-dash clusters" (≥2 per slide) is the safer rule than blanket ban | 2.3 | Low — planner can pick blanket ban if user prefers stricter voice |
| A3 | 2000 chars is a sensible new ceiling for the textarea | Open Q | Medium — user should confirm; could be 1000 or 4000 |
| A4 | The `(dashboard)/project/[id]/actions.ts` server action is the only un-validated entry point | 1.2 | Low — verified by grep for `topic` in `src/lib/services/`, `src/lib/api/`, no other length validators found |

## RESEARCH COMPLETE

`/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/.planning/quick/260502-ntp-raise-prompt-box-character-limit-and-upg/260502-ntp-RESEARCH.md`
