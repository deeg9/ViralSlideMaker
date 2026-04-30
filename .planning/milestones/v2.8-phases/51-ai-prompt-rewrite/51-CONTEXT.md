# Phase 51: AI Prompt Rewrite - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** Auto-resolved (`--auto`) — scope reduced after Phase 49+50 implementation reality

<domain>
## Phase Boundary

After Phase 49 (eager migration on load + reducer write-through) and Phase 50 (UI redesign), the data path is:

```
AI emits hook_text/body_text → saved to Supabase as legacy fields
  → user opens project → eager migration in useReducer initializer
  → slide.text_boxes populated → new panel reads text_boxes
  → user edits via new panel → reducer write-through syncs both shapes
  → save persists both shapes
```

The AI prompt **does not need to emit `text_boxes[]` directly** — the eager-migration path produces the same observable state with zero risk to v2.7's audit-passed premium-tier quality.

**Light-touch scope for Phase 51:**

In scope:
- Verify the existing AI generation flow (`generateSlideContent`, `regenerateSlideText`) produces slides that open cleanly in the new panel (text_boxes populated via eager migration, all v2.7 features intact).
- Add a small post-generation `slidesWithTextBoxes()` helper that runs `legacyToTextBoxes()` once at the AI ingest boundary so text_boxes is populated BEFORE the slide hits Supabase (instead of being derived only on next load). Belt-and-suspenders for AIGEN-04's "validator never throws" requirement.
- Re-run v2.7's premium-tier audit (19/19 reqs) end-to-end with the new editor to confirm zero regression.
- Document AIGEN-01's literal deferral (Gemini schema unchanged for v2.8) with rationale.

Out of scope:
- Rewriting Gemini's JSON schema to emit `text_boxes[]` directly (deferred to v2.9 alongside legacy field sunset).
- New voice-note variants for multi-text-box templates (defer until templates with 3+ text boxes exist).
- Multi-text-box template generation (no current template emits more than 2 boxes from AI).

</domain>

<decisions>
## Implementation Decisions

### AIGEN-01 deferred (light-touch alternative)

- **D-01:** Gemini's JSON schema continues to emit `{ hook_text, body_text, hook_segments, body_segments }`. **Reason:** v2.7 just shipped audit-passed premium tier (19/19 reqs, magazine-bold matches Murphy reference). Rewriting the schema risks regressing quality (typo gates, voice notes, accent color emission, length caps) for zero observable user gain. The eager migration on load + reducer write-through (Phase 49+50) produces identical `text_boxes[]` state.
- **D-02:** Document AIGEN-01 as **deferred to v2.9** in REQUIREMENTS.md. The light-touch alternative ships in this phase: a `slidesWithTextBoxes()` helper that runs `legacyToTextBoxes()` at the AI-ingest boundary, persisting `text_boxes[]` alongside legacy fields immediately (rather than deriving on next load).
- **D-03:** AIGEN-04 (validator never throws) is satisfied by the existing `validateAndRepair` from v2.7 (`src/lib/ai/validate-slides.ts`). Add a single guarded test that `legacyToTextBoxes(slide)` never throws for any post-validate output, even on edge cases (empty hook, no segments, malformed accent colors). If it does throw, the helper's surface should fall back to a 2-box default with role hook+body and original text intact.

### Generation pipeline integration

- **D-04: Insertion point** — `generateSlideContent` (in `src/lib/ai/generate-slides.ts`) is the canonical AI generation entry. After validateAndRepair runs and Carousel parsing succeeds, run a single map step:
  ```ts
  return result.slides.map((slide) => ({ ...slide, text_boxes: legacyToTextBoxes(slide) }))
  ```
- **D-05: regenerateSlideText surface** — `regenerateSlideText` (server action) already returns `{ hook_text, body_text }`. The client-side `handleRegenerateText` in slide-editor.tsx (already updated in Phase 49 via review-fix HR-01) computes the matching text_boxes update. No server-side change needed.
- **D-06: Premium-tier voice notes preserved** — the existing voice notes in `src/lib/templates/*.ts` (magazine-bold, tr3nding-news, documentary) operate on `hook_text` / `body_text` directly. No change.

### Verification

- **D-07: Re-run v2.7 audit** — load `.planning/milestones/v2.7-MILESTONE-AUDIT.md`, identify the 19 requirements, run a smoke test against the new editor verifying each closed requirement still passes.
- **D-08: Test surface** — single new test file: `src/lib/ai/__tests__/slides-with-text-boxes.test.ts`. Tests:
  - Real Carousel output → all slides have `text_boxes[]`
  - Edge case: hook_text='' → text_boxes still has hook entry with text=''
  - Edge case: missing segments → text_boxes' segments are absent (not crashed)
  - Doesn't throw on any output passing `validateAndRepair`

### Claude's Discretion

- Whether `slidesWithTextBoxes` is a new exported helper or inlined into `generateSlideContent`'s return: implementation choice. Prefer inlined (fewer files, single call site).
- Whether to also wire it into `regenerateSlideText` server action: probably no — that action returns text fields, not slides; the client-side update in slide-editor.tsx handles the text_boxes patch.

### Folded Todos

None.

</decisions>

<canonical_refs>
## Canonical References

### Plan & spec
- `~/.claude/plans/users-deeg-desktop-screenshot-2026-04-3-replicated-seal.md` — Phase 51 milestone scope
- `.planning/REQUIREMENTS.md` — AIGEN-01..05 requirements (AIGEN-01 will be marked deferred per D-02)
- `.planning/phases/49-schema-unification-migration/49-VERIFICATION.md` — confirms eager-migration handles AI output
- `.planning/phases/50-right-rail-redesign/50-VERIFICATION.md` — confirms write-through keeps shapes in sync
- `.planning/milestones/v2.7-MILESTONE-AUDIT.md` — 19/19 reqs to re-verify

### Code references
- `src/lib/ai/generate-slides.ts` — `generateSlideContent` entry point
- `src/lib/ai/validate-slides.ts` — `validateAndRepair` (v2.7 — never throws)
- `src/lib/ai/prompts.ts` — system prompt assembly with voice-note addenda
- `src/lib/ai/schemas.ts` — Carousel/Slide Zod schemas (unchanged)
- `src/lib/editor/text-box-adapter.ts` — `legacyToTextBoxes` (Phase 49)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `legacyToTextBoxes` — single import, single call site
- `validateAndRepair` from v2.7 already provides the "never throws" contract

### Established Patterns
- AI generation pipeline outputs are sourced from `Carousel` Zod schema; downstream code trusts the shape

### Integration Points
- `src/lib/ai/generate-slides.ts` — the one place to add the post-processing map step
- `src/lib/ai/__tests__/` — test directory for the new spec

</code_context>

<specifics>
## Specific Ideas

- The user's milestone goal was a **panel redesign**, not an AI prompt overhaul. Phase 51's original spec (rewrite Gemini schema) was over-scoped relative to user intent. This phase honors the spirit (text_boxes is consistently populated post-AI) without churning the prompt.
- Premium-tier audit re-verification is the real risk surface. If anything regressed, it's there.

</specifics>

<deferred>
## Deferred Ideas

- Gemini schema rewrite to emit `text_boxes[]` directly — defer to v2.9 alongside legacy field sunset.
- Multi-text-box template generation (3+ boxes per slide) — defer until a template needs it.
- Per-text-box voice notes — defer until premium templates need it.

### Reviewed Todos (not folded)

None.

</deferred>

---

*Phase: 51-ai-prompt-rewrite*
*Context gathered: 2026-04-30*
