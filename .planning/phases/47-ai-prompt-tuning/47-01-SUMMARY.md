---
phase: 47-ai-prompt-tuning
plan: 1
subsystem: ai
tags: [gemini, zod, schemas, templates, prompt-tuning]

# Dependency graph
requires:
  - phase: 46-premium-template-authoring
    provides: magazine-bold / tr3nding-news / documentary template constants (Phase 47 attaches aiVoiceNote to each)
  - phase: 44-template-schema-foundation
    provides: SlideTemplate interface + validateTemplateRegistry module-load gate
provides:
  - SlideTemplate.aiVoiceNote optional field on the interface
  - aiVoiceNote populated verbatim on magazine-bold, tr3nding-news, documentary
  - Gemini segmentSchema widened with optional highlightColor (STRING) + highlightStyle (enum ['pill'])
  - Zod TextSegmentSchema widened with optional highlightColor (string) + highlightStyle (z.literal('pill'))
affects: [47-02-validate-slides, 47-03-prompt-assembly-retry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod literal-vs-enum scoping: z.literal('pill') restricts AI authority while wider TextSegment renderer type still accepts 'pill' | 'block' for manual editor use"
    - "Optional Gemini schema fields stay outside `required` array — backward compatible with pre-Phase-47 responses"
    - "aiVoiceNote coexists with Phase 46 NEWS_TEMPLATES newsDropAddendum (two voice-tuning systems for different template tiers)"

key-files:
  created:
    - src/__tests__/ai/schemas.test.ts
  modified:
    - src/lib/render/templates/index.ts
    - src/lib/render/templates/magazine-bold.ts
    - src/lib/render/templates/tr3nding-news.ts
    - src/lib/render/templates/documentary.ts
    - src/lib/ai/generate-slides.ts
    - src/lib/ai/schemas.ts

key-decisions:
  - "AI authority for highlightStyle locked to z.literal('pill') — block reserved for renderer/manual editor use (TPLAI-03 D-03)"
  - "Voice notes shipped verbatim from CONTEXT.md Area 4 (no rewording per D-04)"
  - "Legacy 5 templates leave aiVoiceNote undefined — explicit backward-compat per D-04 (highlight-bar, news-drop, news-cyan, y2k-pop, bold-yellow untouched)"
  - "Gemini segmentSchema 'required' stays at ['text', 'accent'] — both new fields optional for full backward compat"

patterns-established:
  - "Tier-scoped schema fields: optional Zod fields with z.literal restrict AI authority while keeping the renderer-side type permissive"
  - "Verbatim voice-note injection point: SlideTemplate.aiVoiceNote is the consumer-facing schema field for Phase 47-03 prompt assembly"

requirements-completed: [TPLAI-03, TPLAI-04]

# Metrics
duration: 3min
completed: 2026-04-29
---

# Phase 47 Plan 1: Schema Surface Foundation Summary

**Schema-additive groundwork for AI prompt tuning: SlideTemplate gains aiVoiceNote, 3 premium templates carry verbatim voice-note strings, and both Gemini segmentSchema + Zod TextSegmentSchema accept optional highlightColor/highlightStyle for AI-emitted pill segments.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-29T19:04:25Z
- **Completed:** 2026-04-29T19:07:10Z
- **Tasks:** 2
- **Files modified:** 6 (+ 1 created)

## Accomplishments
- SlideTemplate interface gained `aiVoiceNote?: string` — the field Phase 47-03 prompt-assembly will read via `getTemplate(templateId).aiVoiceNote` and conditionally append to the system prompt.
- magazine-bold, tr3nding-news, documentary each carry a verbatim voice-note string from CONTEXT.md Area 4 (locked-text per D-04). Legacy 5 templates left untouched — explicit backward-compat clause.
- Gemini `responseSchema.segmentSchema` extended with optional `highlightColor` (STRING) + `highlightStyle` (enum `['pill']`). `required` stays at `['text', 'accent']` so any pre-Phase-47 Gemini response still parses.
- Zod `TextSegmentSchema` mirrored with `highlightColor: z.string().optional()` and `highlightStyle: z.literal('pill').optional()` — locks AI authority to pill-only while the wider renderer-side `TextSegment` type still permits `'pill' | 'block'` for manual editor use.

## Task Commits

Each task was committed atomically:

1. **Task 1: aiVoiceNote field + 3 verbatim voice-notes (TPLAI-04)** - `3d7bd00` (feat)
2. **Task 2 RED: failing test for highlightColor/highlightStyle** - `414b1c9` (test)
3. **Task 2 GREEN: widen segmentSchema + TextSegmentSchema (TPLAI-03)** - `3bf5a17` (feat)

## Files Created/Modified

- `src/lib/render/templates/index.ts` — Added `aiVoiceNote?: string` field to `SlideTemplate` interface (after `backgroundMode`).
- `src/lib/render/templates/magazine-bold.ts` — Populated `aiVoiceNote` verbatim ("Write in punchy news-style…").
- `src/lib/render/templates/tr3nding-news.ts` — Populated `aiVoiceNote` verbatim ("Write in viral-news pitch…").
- `src/lib/render/templates/documentary.ts` — Populated `aiVoiceNote` verbatim ("Write in story-led documentary tone…").
- `src/lib/ai/generate-slides.ts` — Extended `segmentSchema.properties` with optional `highlightColor` + `highlightStyle: enum ['pill']`. `required` array unchanged.
- `src/lib/ai/schemas.ts` — Extended `TextSegmentSchema` with optional `highlightColor: z.string()` + `highlightStyle: z.literal('pill')`.
- `src/__tests__/ai/schemas.test.ts` — Created with 4 tests (legacy compat, full TPLAI-03 shape, block-rejection lock, undefined optionals).

## Decisions Made
- **AI authority is pill-only for highlightStyle.** `z.literal('pill')` (not `z.enum(['pill', 'block'])`) deliberately scopes Gemini's authority. The renderer-side `TextSegment` type still permits both — this lets manual editor work (Phase 48+) emit `block` highlights without AI being able to.
- **Voice notes shipped verbatim from CONTEXT.md.** Per D-04, the three locked strings ship word-for-word with no rewording — Phase 47-03's prompt-assembly step is the next place these strings get composed.
- **Legacy 5 templates untouched.** highlight-bar, news-drop, news-cyan, y2k-pop, bold-yellow do NOT receive `aiVoiceNote`. NEWS_TEMPLATES `newsDropAddendum` continues to handle news-drop / news-cyan tonal guidance — the two systems coexist (D-04).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Plan was clean and acceptance criteria mapped 1:1 to grep checks. Two minor notes:
- Plan AC for `grep -n "z.literal('pill')"` matches the comment line on line 7 of `schemas.ts`. The actual usage (`z\n    .literal('pill')\n    .optional()`) is on lines 17–19, chained per the plan's own example. Both forms ship — the chained form is functionally equivalent and matches the plan's example block exactly.
- Three of the four schema tests pass before the GREEN edit (Zod by default strips unknown keys without erroring); only the block-rejection test was load-bearing for proving the schema widening shipped. RED gate confirmed via that single failing assertion.

## Verification Run

- `npm run build` → exit 0. Phase 44 `validateTemplateRegistry` runs at module load and stayed green with the 3 templates' new `aiVoiceNote` field.
- `npx vitest run src/__tests__/ai/schemas.test.ts` → 4/4 pass.
- `npx vitest run src/__tests__/render/legacy-templates-regression.test.tsx` → 5/5 pass (legacy snapshots unchanged).
- `npx tsc --noEmit` → 14 errors (baseline from Phase 46-02 unchanged; all in unrelated stripe/sync-subscription test mocks).
- Acceptance grep checks: `aiVoiceNote?: string` in index.ts (1 match), `aiVoiceNote:` in each of 3 premium templates (1 each), no matches in legacy 5, `highlightColor` + `highlightStyle` + `enum: ['pill']` + `required: ['text', 'accent']` all in generate-slides.ts.

## TDD Gate Compliance

Task 2 followed RED → GREEN sequence:
- RED commit: `414b1c9` (test) — 1/4 tests fail before GREEN.
- GREEN commit: `3bf5a17` (feat) — 4/4 tests pass after schema widening.
- REFACTOR not needed; implementation is already minimal.

## User Setup Required

None - no external service configuration required. Plan-level work is purely a TypeScript/Zod schema additive change.

## Next Phase Readiness

Plan 47-02 (validator + typo gate) and 47-03 (prompt assembly + retry wiring) now have the typed surface they need:
- Plan 47-02 can read `template.aiVoiceNote` for prompt context and consume the widened `TextSegmentSchema` when validating Gemini responses pre-CarouselSchema.parse.
- Plan 47-03 can call `getTemplate(templateId).aiVoiceNote` and conditionally append a `TEMPLATE VOICE NOTE:` block to the system prompt, then verify the AI emits per-segment `highlightColor` matching `template.accentColor`.

No blockers.

## Self-Check: PASSED

- Files created/modified all exist on disk.
- All 3 task commits in `git log --oneline`: 3d7bd00, 414b1c9, 3bf5a17.
- Build clean, schema tests 4/4, legacy regression 5/5, TS error count unchanged at baseline 14.

---
*Phase: 47-ai-prompt-tuning*
*Completed: 2026-04-29*
