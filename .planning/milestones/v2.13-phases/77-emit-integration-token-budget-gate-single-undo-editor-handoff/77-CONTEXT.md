# Phase 77: Emit Integration + Token Budget Gate + Single-Undo + Editor Handoff - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Smart-discuss — most decisions locked; remaining grey areas covered

<domain>
## Phase Boundary

Wire the StyleSpec → Slide projector + Gemini text emit through both content paths (`mode: 'ai-copy' | 'user-copy'`), prove byte-identity round-trip via PTF17-mirror test, hand the result off to the existing v2.11/v2.12 editor with a single undo entry, and wire the dashboard "From references" badge.

14 reqs in scope: EMIT-01..10 + EDITOR-01..03 + PARITY-02. Phase 77 is the keystone — produces the first end-to-end style-from-reference output users see.

</domain>

<decisions>
## Locked specs (REQUIREMENTS.md + research)
- **New endpoint:** `src/lib/ai/generate-from-style-spec.ts` — accepts `{ style_spec, mode: 'ai-copy' | 'user-copy', topic?, user_copy?, brand_kit_remix?, aspects? }`, returns `Slide[]`
- **New orchestrator:** `generateCarouselFromReferences()` in `src/lib/services/carousel.ts` (sibling to existing `generateCarousel()`)
- **Existing `generateSlideContent` UNTOUCHED** — Phase 75 + Phase 77 add NEW endpoints; legacy path unchanged
- **Mode `ai-copy`:** user provides topic; Gemini generates new slide copy in the reference's voice (style spec replaces template `aiVoiceNote` when present — explicit precedence documented)
- **Mode `user-copy`:** user provides per-slide copy strings; Gemini structures into Slide segments + applies role + decoration choices (no copy generation)
- **Spec REPLACES template `aiVoiceNote`** when both present — explicit precedence; documented in code comment + test
- **CI prompt-token-budget gate:** fails build if `style_spec + topic + brand_kit + system_prompt` > 12K tokens (Gemini 2.5 Flash headroom)
- **StyleSpec → Slide projector:** emits ONLY values that round-trip through both renderers (no new Slide fields per Phase 74 STYLESPEC-12)
- **Triple-layer silent-drop pipeline + Zod validate at emit boundary** (mirror v2.12 + v2.9 patterns)
- **Single reducer dispatch + single `pushHistory` per generation** — undo restores pre-generation state in one Cmd+Z (mirror v2.12 BULK_ROTATE pattern)
- **Roundtrip PTF test** (`style-spec-roundtrip.test.ts`) proves byte-identity: spec → emit → render-preview ≡ render-PNG (mirror v2.12 PTF17)
- **Per-aspect filter:** Phase 76's `state.aspects` controls which spec sections apply at emit; emit zeros unchecked sections before passing to projector
- **Brand-kit merge:** Phase 76's `state.useBrandKitRemix` flag — when true, brand kit fields override extracted spec fields per-field (palette colors, font categories, etc.)
- **Editor handoff:** generated project lands in existing v2.11/v2.12 editor with no new wiring (same routing as today's Gemini emit flow)
- **"From references" badge** on dashboard list + project detail
- **Reference thumbnails persist** on project detail page

### Claude's Discretion
- **Per-aspect zeroing implementation:** `applyAspectFilter(spec, aspects): StyleSpec` helper that returns a copy with unchecked sections set to a "neutral default" (palette = template default, typography = template default, etc.) — keeps projector pure (consumes a spec, doesn't read filter flags)
- **Brand-kit merge implementation:** `applyBrandKitRemix(spec, brandKit): StyleSpec` helper that overrides palette[0..N] + font categories with brand kit values when toggle on; per-field merge
- **Server Action wiring:** Phase 76's `regenerateAction` stub gets filled here — calls `generateCarouselFromReferences()` + persists project + returns project_id for client to navigate to editor
- **Token budget gate location:** new `scripts/grep-gates/prompt-token-budget.cjs` invoked from `lint:gates` — uses tiktoken (or @anthropic-ai/tokenizer) to count tokens of the prompt template + sample spec + sample brand kit
- **Reference thumbnails on project detail:** read from existing `projects.reference_assets` JSONB column (Phase 74-02) and render in a small strip near the title
- **"From references" badge:** simple `<Badge>` UI element rendered when `project.style_spec !== null` — visible on dashboard project cards + project detail header

</decisions>

<code_context>
## Reusable Assets
- `src/lib/ai/extract-style-spec.ts` (Phase 75) — produces validated StyleSpec; Phase 77 consumes
- `src/lib/types/style-spec.ts` (Phase 74) — StyleSpec type
- `src/lib/types/projects-storage-constants.ts` (Phase 74) — STYLE_SPEC_COLUMN, REFERENCE_ASSETS_COLUMN
- `src/lib/ai/generate-slides.ts` (existing v2.x) — text-only Gemini call shape; mirror its prompt assembly + structured response pattern
- `src/lib/services/carousel.ts` (existing) — `generateCarousel()` orchestrator; sibling `generateCarouselFromReferences()` lands here
- `src/lib/editor/editor-reducer.ts` (existing v2.11+) — for the single-pushHistory pattern; mirror v2.12 BULK_ROTATE shape
- `src/app/(dashboard)/style-from-reference/actions.ts` (Phase 76) — `regenerateAction` stub gets filled
- `src/app/(dashboard)/dashboard/page.tsx` (Phase 76 modified) — add "From references" badge to project cards

## Established Patterns
- `generateCarousel()` returns `Slide[]` validated by Zod; persist via existing project create/update path
- Editor consumes `project.slides` JSONB; no new wiring needed (existing routing)
- v2.12 PTF17 `byte-identity-ai-emit-parity.test.tsx` (or similar — verify path) is the canonical mirror for Phase 77's roundtrip test
- Token counting via tiktoken (verify in package.json) OR `@anthropic-ai/tokenizer` (likely already a transitive dep) — pick whichever exists

## Integration Points
- New: `src/lib/ai/generate-from-style-spec.ts` (the projector + Gemini text call)
- New: `src/lib/ai/style-spec-aspect-filter.ts` (`applyAspectFilter`)
- New: `src/lib/ai/style-spec-brand-kit-merge.ts` (`applyBrandKitRemix`)
- Modified: `src/lib/services/carousel.ts` (add `generateCarouselFromReferences`)
- Modified: `src/app/(dashboard)/style-from-reference/actions.ts` (fill `regenerateAction`)
- New: `src/lib/render/__tests__/parity.style-spec-roundtrip.test.tsx` (PARITY-02 mirror of PTF17)
- New: `scripts/grep-gates/prompt-token-budget.cjs` (CI 12K-token gate)
- Modified: `src/app/(dashboard)/dashboard/page.tsx` (add badge to project cards)
- New: `src/components/projects/from-references-badge.tsx`
- Modified: project detail page (add reference thumbnails strip)

</code_context>

<specifics>
## Specifics
- The projector is the load-bearing translation: StyleSpec semantic fields → Slide concrete fields (palette → background colors / text colors; typography → font picks; layout → text positions; decorations → preferredLucide/preferredShapes hints; voice_note → aiVoiceNote replacement)
- The roundtrip PTF test verifies the projector's output is render-stable across both renderers (Satori + React preview) for a sample StyleSpec — exactly mirrors v2.12 Phase 71 PTF17
- Single-pushHistory: `dispatch({type: 'LOAD_PROJECT_FROM_STYLE_SPEC', payload: slides})` → reducer pushes ONE history entry; Cmd+Z restores empty project (or whatever was there)
- Aspect filter is pure: `(spec, aspects) → spec'` no side effects, no I/O
- Brand kit merge is pure: `(spec, brandKit) → spec'` no side effects
- Token budget gate generates a representative prompt template + max-size spec + max-size brand kit, asserts < 12K tokens

</specifics>

<deferred>
## Deferred
- N variants from one spec — defer to v2.14 P2
- Streaming response — anti-decision per research
- Per-slide style mapping — defer to v2.14 P2
- "Save spec as personal Style" reuse path — defer to v2.14 P2
- Public REST API for `regenerateFromReferences()` — defer to v2.14 P2

</deferred>
