# Phase 47: AI Prompt Tuning - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous batch table)

<domain>
## Phase Boundary

Tune the existing Gemini-driven `generateSlideContent` pipeline (`src/lib/ai/generate-slides.ts` + `src/lib/ai/prompts.ts` + `src/lib/ai/schemas.ts`) so AI-generated content fits the new compact magazine-style layouts (`magazine-bold`, `tr3nding-news`, `documentary`):

- Hooks ≤ 12 words, body ≤ 35 words for premium templates (TPLAI-01)
- No spelling typos via heuristic + curated typo list (TPLAI-02)
- Per-segment `highlightColor` set on action verbs / proper nouns / numbers, matching the template's accent color (TPLAI-03)
- Per-template "voice note" steers tone (TPLAI-04)

Server-side only — no UI changes. Existing Gemini 2.5 Flash integration is reused (no new framework). Existing 5 templates' generation behavior is unchanged.

What is in scope:
- Add length-cap validator (`src/lib/ai/validate-slides.ts`) running post-Gemini, pre-CarouselSchema-parse
- Add typo-detection pass with curated `KNOWN_TYPOS` set
- Add retry-once-with-addendum logic for both length and typo failures
- Extend `responseSchema` in `generate-slides.ts` to include optional `highlightColor` and `highlightStyle` on segments
- Extend `buildSystemPrompt(templateId)` with premium-tier rules (length caps, highlight pill instructions, voice notes)
- Add `aiVoiceNote?: string` field to `SlideTemplate` interface
- Populate `aiVoiceNote` on the 3 new templates (`magazine-bold`, `tr3nding-news`, `documentary`)
- Tests covering: length validator, typo detector, retry-once flow, schema with highlightColor, voice-note prompt assembly

What is NOT in scope:
- New AI framework or model swap (Gemini 2.5 Flash stays per project memory)
- New AI-SPEC eval infrastructure (existing prompt-tuning, not new agent design)
- Post-generation user-facing edits (Phase 48)
- Schema changes to slide structure (Phase 44 locked)
- Renderer changes (Phase 45 locked)
- Editing the 5 legacy templates (kept as-is — including news-drop / news-cyan NEWS_TEMPLATES addendum)
- Imagen / image-generation prompts (separate `src/lib/imagen/` module — out of scope)
- Caption generation (`src/lib/captions/` — out of scope)

</domain>

<decisions>
## Implementation Decisions

### Length Caps & Structure Rules (Area 1) — TPLAI-01
- **Caps:** hook ≤ 12 words, body ≤ 35 words. Word count via `text.trim().split(/\s+/).length`. Hyphenated words count as one. Numbers like `$50M` count as one word.
- **Scope:** PREMIUM TIER ONLY (`magazine-bold`, `tr3nding-news`, `documentary`). Existing 5 legacy templates keep current behavior unchanged. Detection via `isPremiumTemplate(templateId)` helper.
- **Enforcement:** BOTH prompt instruction AND server-side validator. Validator at `src/lib/ai/validate-slides.ts` (new). On overflow:
  1. Retry once with stricter prompt addendum specifying which slides overflowed and the cap.
  2. If retry still overflows: persist anyway, truncate at word boundary, log warning.
- **Orphan detection:** A slide is an "orphan" when `hook_text === body_text` OR word-overlap between hook and body ≥ 80%. Validator detects via simple word-set Jaccard overlap. Failure → retry-once → persist with warning.
- **Word count function:** `wordCount(text: string): number = text.trim().split(/\s+/).filter(Boolean).length`.

### Spelling Quality Gate (Area 2) — TPLAI-02
- **Detection strategy:** Heuristic curated typo list. `KNOWN_TYPOS` set in `src/lib/ai/typos.ts` (new). ~30 entries from common AI mis-spellings:
  - `MUSICAN`, `CARROUSEL`, `ENTREPRENUER`, `RECIEVE`, `SEPERATE`, `OCCURENCE`, `NEEDLES` (when meaning "needless"), `BUSSINESS`, `ACCOMODATE`, `CALENDER`, `DEFINATELY`, `EXISTANCE`, `MAINTENENCE`, `OCCASIONALY`, `PRIVILEDGE`, `RHYTM`, `SUPRISE`, `TOMMOROW`, `UNTILL`, `WIERD`, `AGGRESIVE`, `CONSCIOUSE`, `DISSAPPOINT`, `EMBARASS`, `GAURDIAN`, `HARRASS`, `INDEPENDANCE`, `MILLENIUM`, `PERSUE`, `RELEVENT`, etc.
- **Detection:** Case-insensitive substring match against the typo set, scanning `hook_text`, `body_text`, and per-segment `text` fields. Skip ALL-CAPS strings under 3 chars. Returns array of detected typos with locations.
- **Scope:** ALL templates (the gate is cheap and benefits everyone).
- **Action on detection:** Retry once with addendum `"the previous response contained spelling errors: [TYPO_LIST]. Generate again, ensuring correct spelling."`. If retry still fails, persist + console warning. Never indefinitely block the user.
- **Pipeline location:** After Gemini returns, BEFORE `CarouselSchema.parse(data)`. Wrapped in `validateAndRepair(data, options)` helper returning `{ data, retried: boolean, warnings: string[] }`.

### Auto-Segment with highlightColor (Area 3) — TPLAI-03
- **Authority:** Gemini sets `highlightColor` directly via expanded `responseSchema`. Add to `segmentSchema`:
  ```ts
  highlightColor: { type: Type.STRING, description: "Optional accent pill background hex (premium templates only)" }
  highlightStyle: { type: Type.STRING, enum: ['pill'], description: "Optional pill style" }
  ```
- **Selection rules (in prompt):** Action verbs + proper nouns + numbers/quantities. Cap: 2 highlighted spans per hook, 0–1 per body. Connector words (`a`, `the`, `of`, `on`, `and`, `is`, `to`, `for`) NEVER highlighted. Examples in prompt match Murphy reference: `"FIGHTS BACK"`, `"CLONED HER VOICE"`, `"$50M"`, `"12 MINUTES"`.
- **Color value source:** `template.accentColor` read from registry at prompt-build time. Embedded in prompt as the literal hex. Today both magazine-bold and tr3nding-news use `'#A8E0B0'`. Future templates with different accents update prompt automatically.
- **Documentary opt-out:** Documentary explicitly DOES NOT use highlight pills. Prompt instructs: "If template is `documentary`, do NOT populate `highlightColor` on any segment." Validator double-checks: documentary slides with `highlightColor` set → strip those fields silently before persisting.

### Template-Aware Voice Notes (Area 4) — TPLAI-04
- **Schema additive:** Add `aiVoiceNote?: string` field to `SlideTemplate` interface in `src/lib/render/templates/index.ts`. Optional. Existing 5 templates leave it undefined.
- **Voice notes (locked):**
  - `magazine-bold`: `'Write in punchy news-style: tabloid-pitched headlines, statistics over adjectives, action verbs over states-of-being. Tone is urgent and confident, like a magazine cover line.'`
  - `tr3nding-news`: `'Write in viral-news pitch: shocking specifics, breakout moments, money/time/scale numbers prominent. Tone is breaking-news energy.'`
  - `documentary`: `'Write in story-led documentary tone: subject-driven, considered, descriptive. Avoid breathless punctuation, hype words, or forced action verbs. Tone is the New Yorker, not BuzzFeed.'`
- **Prompt integration:** `buildSystemPrompt(templateId)` reads `getTemplate(templateId).aiVoiceNote` and conditionally appends a `TEMPLATE VOICE NOTE:` section to the system prompt. If undefined, behavior unchanged.
- **NEWS_TEMPLATES backward compat:** The existing `NEWS_TEMPLATES` Set (`news-drop`, `news-cyan`) and its detailed `newsDropAddendum` STAY AS-IS. Phase 47 does NOT migrate them to `aiVoiceNote` — that would risk regression on 2 existing templates that already have working tonal guidance. The two systems coexist (legacy detailed addendum + new lightweight voice note for premium templates).

### Claude's Discretion
- Exact wording of premium-tier system-prompt addendum (combining length caps + highlight rules + voice note in a coherent block).
- Whether to factor `validateAndRepair` retry logic into `generate-slides.ts` directly or in a new wrapper file. Recommend new file `src/lib/ai/validate-slides.ts` for testability.
- Test framework / location: existing Vitest infrastructure with new files under `src/__tests__/ai/`.
- Whether `KNOWN_TYPOS` ships as plain `Set<string>` constant or as a JSON data file. Recommend constant — single import, easy to extend.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/ai/generate-slides.ts` — main entry. `generateSlideContent(topic, slideCount, imageStyleHint?, templateId?)`. Calls Gemini, parses response via `CarouselSchema.parse`. Phase 47 wraps the parse with `validateAndRepair`.
- `src/lib/ai/prompts.ts` — `buildSystemPrompt(templateId)`. Currently has `NEWS_TEMPLATES` set + `newsDropAddendum`. Phase 47 adds premium-tier addendum + voice-note injection.
- `src/lib/ai/schemas.ts` — Zod `CarouselSchema`. Phase 47 extends segment schema to accept optional `highlightColor` + `highlightStyle`.
- `src/lib/render/templates/index.ts` — `SlideTemplate` interface. Phase 47 adds `aiVoiceNote?: string` field. `getTemplate(id)` already exists.
- `src/lib/render/templates/{magazine-bold,tr3nding-news,documentary}.ts` — Phase 46 templates. Phase 47 adds `aiVoiceNote` field to each.
- Gemini SDK: `@google/genai` already installed and configured with `GEMINI_API_KEY`.

### Established Patterns
- Server-side `responseSchema` is JSON Schema-style via `@google/genai` `Type` enum. Adding fields is additive — won't break existing slides without those fields.
- System prompts use template literals with conditional addenda (e.g., `newsDropAddendum`). Phase 47 follows this pattern for premium-tier addendum.
- Validation post-Gemini, pre-DB-persist is the established pattern (existing Zod parse). Phase 47's `validateAndRepair` slots between Gemini response and Zod parse.
- Tests for AI live under `src/__tests__/ai/` (will be a new directory — existing tests are under `src/__tests__/render/` and `src/__tests__/components/`).

### Integration Points
- API surface: `/api/v1/carousel/generate` and `/api/render` callers pass `templateId` already. Phase 47 reuses this — no new params.
- MCP `create_carousel` tool (`src/lib/mcp/tools.ts`) calls `generateSlideContent` directly. Phase 47 changes flow through automatically — no MCP code changes.
- `src/lib/services/ai-regen.ts` does per-slide regeneration. Phase 47 length-cap rules should optionally apply here too — flagged as a stretch goal in the executor's discretion.

</code_context>

<specifics>
## Specific Ideas

- Murphy reference (`/Users/deeg/Downloads/MurphyFolkSinger/murphy_carousel_slide_*.png`) is the visual fidelity target — Phase 47 prompt rules should reproduce that aesthetic when topic matches (folk singer / AI copyright). Specifically:
  - hook: "FOLK SINGER FIGHTS BACK AFTER AI CLONED HER VOICE" — 11 words, ≤12 ✓
  - body: "Murphy Campbell, a folk singer from Western North Carolina, sues OpenAI for copyright theft." — 14 words, ≤35 ✓
  - hook_segments with mint pill on "FIGHTS BACK" + "CLONED HER VOICE" — 2 pills ✓ (matches our cap)
- Spelling typos that Phase 46 sample data avoided: "MUSICAN" (would be a real risk in folk-singer topic), "BUSSINESS" (would be a risk in startup topic). Both belong in `KNOWN_TYPOS`.
- Voice note effect: the same topic "AI startup raises money" should produce visibly different copy in magazine-bold (`"STARTUP RAISES $50M IN 12 MINUTES"`) vs documentary (`"The minutes that built a billion-dollar bet"`). The latter is descriptive, story-led. The former is punchy, statistic-led.

</specifics>

<deferred>
## Deferred Ideas

- Per-template content-fit feedback loop (model generates → renderer measures overflow → model regenerates) — TPLAI-FUTURE-01, v2.8+.
- Length-cap rules applied to `src/lib/services/ai-regen.ts` per-slide regeneration — Claude's Discretion to include opportunistically; if not in this phase, captured for v2.8+.
- AI-driven A/B variant generation (multiple hooks per slide for user pick) — out of scope.
- Larger model (Gemini Pro) for premium-tier complex topics — out of scope; 2.5 Flash sufficient per project cost preference.
- Replacing `NEWS_TEMPLATES` `newsDropAddendum` with `aiVoiceNote` for unification — captured for v2.8+ alongside any news-drop / news-cyan refresh.
- External dictionary / hunspell integration — explicitly rejected (curated typo list is sufficient + zero new deps).

</deferred>
