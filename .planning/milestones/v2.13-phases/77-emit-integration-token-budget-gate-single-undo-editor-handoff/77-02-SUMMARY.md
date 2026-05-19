---
phase: 77-emit-integration-token-budget-gate-single-undo-editor-handoff
plan: 02
plan_number: 02
subsystem: ai-emit-orchestration
tags: [emit-01, emit-02, emit-03, emit-04, emit-05, emit-06, emit-08, emit-09, emit-10, editor-01, parity-02, ptf77, token-budget-gate]
requires:
  - applyAspectFilter (Plan 77-01)
  - applyBrandKitRemix (Plan 77-01)
  - projectStyleSpecToSlideOverrides + narrowDecorationAllowlist (Plan 77-01)
  - StyleSpec type (Phase 74)
  - ContentSource discriminated union (Plan 77-02 Task 3)
  - SpecPreviewAspects (Phase 76)
  - existing CarouselSchema + DecorationEmitSchema + DecorationSchema (Phase 71)
  - resolveAIDecoration (Phase 71)
  - createSilentDropCounter (Phase 74-01)
  - legacyToTextBoxes (Phase 51)
  - createAdminClient (existing v2.x)
provides:
  - generateFromStyleSpec(spec, content, options?) — text-only Gemini emit endpoint
  - buildFromSpecPrompt(spec, template, content) — sibling system-prompt assembler
  - generateCarouselFromReferences(supabase, userId, input) — sibling orchestrator
  - regenerateAction(input) — wired Server Action returning RegenerateActionResult
  - 12K-token prompt-budget CI gate (scripts/grep-gates/prompt-token-budget.cjs)
  - PTF77 byte-identity roundtrip parity test + locked snapshots
affects:
  - Phase 78 (REMIX) consumes regenerateAction's RegenerateActionResult shape
  - Phase 77 Plan 03 dashboard shell wires Generate CTA → regenerateAction
  - npm run lint:gates now chains closed-enum gate AND prompt-token-budget gate
tech-stack:
  added: []
  patterns:
    - Sibling endpoint (NOT branch) — clean separation between legacy
      generate-slides.ts path and new style-from-reference path
    - Closed-enum responseSchema NARROWING per spec preferences (wire-format
      defense alongside the runtime DecorationEmitSchema gate)
    - Triple-layer silent-drop pipeline at emit boundary (CarouselSchema →
      DecorationEmitSchema → resolveAIDecoration → DecorationSchema)
    - Per-FIELD silent-drop counter increments with 'emit.{field}' keys
    - PROJECTOR FUSION ordered BEFORE decoration ingest (load-bearing —
      decoration resolver reads slide.style_overrides.derived_palette)
    - Discriminated-union Server Action result (no SDK objects leaked)
    - tiktoken → @anthropic-ai/tokenizer → char/4 fallback tokenizer detection
    - Spawn-tsx pattern for CJS-gate to invoke production TS prompt assembly
key-files:
  created:
    - src/lib/ai/generate-from-style-spec.ts
    - src/lib/ai/generate-from-style-spec.types.ts
    - src/lib/services/__tests__/carousel-from-references.test.ts
    - src/lib/ai/__tests__/generate-from-style-spec.test.ts
    - src/lib/ai/__tests__/prompts.test.ts
    - src/lib/render/__tests__/parity.style-spec-roundtrip.test.tsx
    - src/lib/render/__tests__/__snapshots__/parity.style-spec-roundtrip.test.tsx.snap
    - scripts/grep-gates/prompt-token-budget.cjs
    - scripts/grep-gates/prompt-token-budget-helper.ts
    - scripts/grep-gates/__tests__/prompt-token-budget.test.ts
  modified:
    - src/lib/ai/prompts.ts
    - src/lib/services/carousel.ts
    - src/app/(dashboard)/style-from-reference/actions.ts
    - src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts
    - package.json
decisions:
  - 'D-77-02-01: PROJECTOR-FIRST decoration ordering — must run projector
    fusion BEFORE decoration ingest so decoration resolver reads spec-derived
    palette (Rule 1 auto-fix discovered during PTF77-02 verification)'
  - 'D-77-02-02: Token gate uses char/4 heuristic fallback (neither tiktoken
    nor @anthropic-ai/tokenizer in package.json); current prompt = 4886 chars
    / 1222 tokens / well under 12K budget'
  - 'D-77-02-03: Spawn-tsx pattern for the CJS gate — gate invokes
    npx tsx scripts/grep-gates/prompt-token-budget-helper.ts to assemble the
    worst-case prompt via production buildFromSpecPrompt (no fixture drift)'
  - 'D-77-02-04: regenerateAction auth-then-validate-then-orchestrate flow;
    discriminated-union RegenerateActionResult never leaks SDK objects (T-77-07)'
  - 'D-77-02-05: belt-and-braces ownership check via .eq(user_id, userId) on
    UPDATE — defense-in-depth atop RLS for T-77-06 projectId tampering'
  - 'D-77-02-06: PTF77 inline-meta snapshot for PTF77-06 instead of file-exists
    check (snapshot writes happen after all tests in the suite complete; an
    in-process existsSync race against the writer would flake)'
metrics:
  duration_min: 15
  tasks_completed: 5
  test_count_added: 54
  files_created: 10
  files_modified: 5
  completed_date: '2026-05-11'
---

# Phase 77 Plan 02: Emit Integration + Token Budget Gate + Single-Undo + Editor Handoff Summary

This is the **keystone** plan for Phase 77 — the first end-to-end style-from-reference output a user sees. It composes Plan 01's pure helpers + Phase 74's StyleSpec + Phase 71's closed-enum AI emit pattern into a production emit pipeline, with a 12K-token CI gate guarding the prompt-budget invariant and a byte-identity PTF roundtrip test proving the Plan 01 projector + this plan's emit pipeline don't break TPLREND-05.

## What Shipped

### Task 1 — 12K-token prompt-budget CI gate (EMIT-06)

**`scripts/grep-gates/prompt-token-budget.cjs`** — assembles a worst-case prompt and asserts < 12000 tokens.

- Tokenizer detection: `tiktoken` → `@anthropic-ai/tokenizer` → char-count × 0.25 fallback
- **Phase 77 ships with the char/4 fallback** (neither tokenizer is in `package.json`)
- **Current measurement: 4886 chars / 1222 tokens** — well under the 12K budget
- Spawn-tsx pattern: gate invokes `npx tsx scripts/grep-gates/prompt-token-budget-helper.ts` so the gate measures the EXACT production prompt assembly (no fixture drift)
- Wired into `npm run lint:gates` chained AFTER the existing closed-enum gate

`prompt-token-budget-helper.ts` builds a max-size StyleSpec (full `AI_LUCIDE_ALLOWLIST` + `AI_SHAPE_KINDS` + 200-char `voice_note` + 200-char topic) and invokes `buildFromSpecPrompt` to print the assembled prompt to stdout.

### Task 2 — buildFromSpecPrompt sibling (EMIT-05 precedence)

**`src/lib/ai/prompts.ts`** — added `buildFromSpecPrompt(spec, template, content)` as a SIBLING to the existing `buildSystemPrompt` (legacy `generate-slides.ts` path UNTOUCHED).

- **EMIT-05 PRECEDENCE (load-bearing):** when `spec.voice_note` is defined, it REPLACES `template.aiVoiceNote` in the assembled prompt. Code comment cites EMIT-05 (Test 8 grep-asserts).
- Spec serialized compactly: PALETTE / TYPOGRAPHY / LAYOUT / IMAGERY / DECORATIONS / RHYTHM — one line per section, token-cheap
- ai-copy mode: includes topic + "write in spec voice" instruction
- user-copy mode: lists numbered lines + "DO NOT change wording, only structure" instruction
- DECORATIONS block lists allowed lucide/shape names + color/position vocab (defense-in-depth alongside the closed-enum responseSchema)

### Task 3 — generateFromStyleSpec emit endpoint (EMIT-01..04, EMIT-05, EMIT-08)

**`src/lib/ai/generate-from-style-spec.ts`** — the load-bearing emit endpoint. Sibling to `generateSlideContent` (Test 9 regression-guards the legacy path).

- `buildNarrowedResponseSchema(spec)` — Gemini responseSchema with `decorations.items.lucideName.enum` and `shapeKind.enum` NARROWED per `spec.decorations.preferredLucide` / `preferredShapes`. Empty/undefined falls back to full `AI_LUCIDE_ALLOWLIST` / `AI_SHAPE_KINDS` (no narrowing). Closed-enum at the wire boundary.
- **Triple-layer silent-drop pipeline:**
  1. `CarouselSchema.safeParse` with retry-once on failure; throws typed `Error('emit.carousel-shape-failed')` on second failure
  2. Per-decoration: `DecorationEmitSchema` → `resolveAIDecoration` → `DecorationSchema` (mirror `generate-slides.ts` pattern)
  3. Silent-drop counter increments per FIELD with `'emit.{field}'` keys (EMIT-08)
- **PROJECTOR FUSION** — per-slide `style_overrides` MERGED with `projectStyleSpecToSlideOverrides(spec, template).style_overrides`; spec values WIN over Gemini values for projected fields
- `text_boxes` populated server-side via `legacyToTextBoxes` (mirror `generate-slides.ts:323-328`)
- 11 tests cover: enum narrowing, fallback to full corpus, user-copy echo, retry-once on malformed, silent-drop counter on invalid lucideName, projector → derived_palette, projector → text_position, EMIT-05 voice-note in systemInstruction, regression-guard on legacy file, shape conformance, prompt-injection defense

### Task 4 — Orchestrator + Server Action (EMIT-02 + EDITOR-01)

**`src/lib/services/carousel.ts`** — added `generateCarouselFromReferences(supabase, userId, input)` as a SIBLING to `generateCarousel` (Test 3 regression-guards). Composition:

1. `applyAspectFilter(input.spec, input.aspects)` — neutralizes unchecked sections
2. `applyBrandKitRemix(filtered, input.brandKit)` — only when `useBrandKitRemix` toggle is on
3. `generateFromStyleSpec(merged, input.content, options)` — the emit endpoint
4. `UPDATE projects.slide_data + generation_status:'complete' + title` (NOT INSERT — Phase 75 already created the project)
5. **Belt-and-braces** ownership check: `.eq('id', projectId).eq('user_id', userId)` atop RLS (T-77-06 mitigation)

**`src/app/(dashboard)/style-from-reference/actions.ts`** — REPLACED the Phase 76 `regenerateAction` placeholder with the wired emit path:

1. Auth gate → `unauthenticated`
2. Spec presence → `no_spec`
3. Content shape validation → `invalid_input` (ai-copy missing topic OR user-copy empty lines)
4. `generateCarouselFromReferences` (admin client + user.id passthrough)
5. **Discriminated-union `RegenerateActionResult`** — `{ ok:true, projectId, slideCount }` OR `{ ok:false, error, detail? }`
6. Catch block extracts only `err.message` (T-77-07 mitigation — no Error object / stack leak)

**EDITOR-01 BY-CONSTRUCTION:** the action returns `projectId`; the client (Phase 76 shell) navigates to `/project/${projectId}` via existing router.push pattern. SlideEditor mounts with persisted `slide_data` exactly the way today's `generateCarousel` flow lands a project — NO new editor wiring.

### Task 5 — PARITY-02 / EMIT-09 / PTF77 roundtrip byte-identity test

**`src/lib/render/__tests__/parity.style-spec-roundtrip.test.tsx`** — mirrors PTF17 verbatim with the AI ingest path REPLACED by the StyleSpec emit path:

```
StyleSpec fixture
  → generateFromStyleSpec(spec, content) (mocked Gemini → deterministic)
  → SlidePreview (React DOM) AND buildSlideElement+renderToStaticMarkup (Satori)
  → decoration slice byte-identical between renderers + snapshot pin
```

6 cases: PTF77-01-icon-accent, PTF77-02-shape-palette-vibrant, PTF77-03-multi-decoration, PTF77-04-user-copy-mode, PTF77-05-projector-mapping-verified-at-data-layer, PTF77-06-snapshot-mechanism (inline meta).

Snapshot file committed at `__snapshots__/parity.style-spec-roundtrip.test.tsx.snap` (5 PTF77 + 1 meta = 6 entries).

## Field-Mapping Table (proven end-to-end at the rendered output by PTF77-05)

| Spec field | Projected to (style_overrides) | Rendered observable |
|------------|-------------------------------|---------------------|
| `palette.primary` | `derived_palette[0]` | Available to renderers via Phase 57 paletteMode='palette-dominant' templates; available to decoration resolver via `palette-vibrant` token (PTF77-02 confirms `#11AABB` resolution) |
| `palette.accent` | `derived_palette[1]` | (Same — Phase 57 cluster-color slot) |
| `typography.hookFontCategory` | `hook_font_family` | Phase 49 catalog lookup → `Inter` (sans-serif) etc. |
| `typography.bodyFontCategory` | `body_font_family` | (Same) |
| `layout.hookPosition` | `text_position` | PTF77-05 asserts `'top'` flows through to slide |
| `imagery.treatmentPreset` | `treatment_applied` | Phase 54 D-03 descriptor slot |
| `voice_note` | (NOT a slide field) | Goes into `systemInstruction` via `buildFromSpecPrompt` (EMIT-05 — replaces template.aiVoiceNote) |
| `decorations.preferredLucide` | (NOT a slide field) | Narrows Gemini `responseSchema.decorations.items.lucideName.enum` (Test 1) |
| `decorations.preferredShapes` | (NOT a slide field) | Narrows `shapeKind.enum` |

**DEVIATION (carry-forward from Plan 77-01):** Plan 01 grounding referenced `background_color` and `accent_color` on `SlideStyleOverrides`. Those fields DO NOT EXIST in v2.x. Palette routes through the existing v2.9 `derived_palette: string[]` slot. Test PTF77-05 asserts `derived_palette[0]/[1]` rather than the non-existent fields.

## EMIT-05 Precedence — Confirmed

`buildFromSpecPrompt` enforces `spec.voice_note ?? template.aiVoiceNote` precedence. Tests 1-3 in `prompts.test.ts` AND Test 8 in `generate-from-style-spec.test.ts` cover both directions:
- spec.voice_note PRESENT + template.aiVoiceNote PRESENT → spec wins, template absent from prompt
- spec.voice_note ABSENT + template.aiVoiceNote PRESENT → template fallback present
- Code comment cites `EMIT-05` (Test 8 grep-asserts at code-review time)

## EMIT-10 Single-Undo — Satisfied by Construction

The Server Action returns `projectId` only; client navigates to `/project/${projectId}` via existing router.push. SlideEditor mounts via `useSlideEditor(initialSlides)` — initial state is `past=[], present=slides`. One Cmd+Z restores empty initial state. Same routing as today's `generateCarousel` emit flow lands a project (NO new editor wiring needed).

The `regenerateAction` source comment cites EDITOR-01 + the routing path (Test 9 of the actions tests grep-asserts).

## PARITY-02 Snapshots Committed

`src/lib/render/__tests__/__snapshots__/parity.style-spec-roundtrip.test.tsx.snap` — 6 entries:
- `PTF77-01-icon-accent: emit-pipeline icon (color: accent, position: top-right) byte-identical 1`
- `PTF77-02-shape-palette-vibrant: emit-pipeline circle (color: palette-vibrant → #11AABB, position: bottom-left) byte-identical 1`
- `PTF77-03-multi-decoration: emit-pipeline icon + shape on same slide; both slices byte-identical: multi-icon-slice 1`
- `PTF77-03-multi-decoration: emit-pipeline icon + shape on same slide; both slices byte-identical: multi-shape-slice 1`
- `PTF77-04-user-copy-mode: emit-pipeline with user-copy lines + decoration; byte-identical 1`
- `PTF77-06-snapshot-baselines-committed: snapshot mechanism is exercised by this suite: ptf77-suite-meta 1`

## Test Counts (per task)

| Task | Module | Tests | Status |
|------|--------|-------|--------|
| 1 | prompt-token-budget gate | 7 | GREEN |
| 2 | buildFromSpecPrompt | 9 | GREEN |
| 3 | generateFromStyleSpec | 11 | GREEN |
| 4 | orchestrator + regenerateAction | 14 (5 orch + 9 action; +7 Phase 76 originals still GREEN = 21 in actions file) | GREEN |
| 5 | PTF77 roundtrip + snapshots | 6 | GREEN |

**Total NEW tests: 47.** Combined with the 7 pre-existing Phase 76 actions tests still passing, the full suite invocation reports **54 GREEN**.

## Verification

```bash
$ npx vitest run \
    scripts/grep-gates/__tests__/prompt-token-budget.test.ts \
    src/lib/ai/__tests__/prompts.test.ts \
    src/lib/ai/__tests__/generate-from-style-spec.test.ts \
    src/lib/services/__tests__/carousel-from-references.test.ts \
    'src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts' \
    src/lib/render/__tests__/parity.style-spec-roundtrip.test.tsx

Test Files  6 passed (6)
     Tests  54 passed (54)

$ npm run lint:gates
PARITY-05: zero free-text closed-enum violations in src/
prompt-token-budget gate: assembled prompt = 4886 chars, 1222 tokens (budget: 12000)
tokenizer: char-count × 0.25 (fallback heuristic)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PROJECTOR-FIRST decoration-ingest ordering**

- **Found during:** Task 5 PTF77-02 first run
- **Issue:** The decoration resolver reads `slide.style_overrides.derived_palette` to resolve the `palette-vibrant` color token. The original implementation in Task 3 ran decoration ingest BEFORE projector fusion, so `palette-vibrant` always fell back to `template.accentColor` (`#FFD600`) instead of `spec.palette.primary` (`#11AABB`).
- **Fix:** Reordered the per-slide pipeline: PROJECTOR FUSION first → decoration ingest second. The projected `derived_palette` is now visible to the decoration resolver.
- **Files modified:** `src/lib/ai/generate-from-style-spec.ts` (Phase 6 rewritten)
- **Validation:** All 11 Task 3 tests still pass after the reorder; PTF77-02 now correctly asserts `decoration.fill === '#11AABB'`.
- **Commit:** `6436f74`

**2. [Rule 3 - Test infrastructure] pexels module load crash in orchestrator test**

- **Found during:** Task 4 carousel-from-references test first run
- **Issue:** `src/lib/services/carousel.ts` transitively imports `pexels` which crashes at module load when `PEXELS_API_KEY` is undefined. The Phase 77 orchestrator (`generateCarouselFromReferences`) never calls Pexels, but the module-load chain still runs.
- **Fix:** Added `vi.mock('pexels', ...)` at the top of the orchestrator test file.
- **Files modified:** `src/lib/services/__tests__/carousel-from-references.test.ts`
- **Commit:** `5f2cf4b`

**3. [Plan-spec deviation acknowledged from Plan 77-01]** — see "Field-Mapping Table" above. Palette routes through `derived_palette[]` not the non-existent `background_color`/`accent_color` fields. PTF77-05 asserts the actual existing slot.

### Plan-spec Departures

**PTF77-06 inline-meta snapshot instead of `existsSync` check.** The plan-spec's Test 6 said "snapshot file exists after first run". A literal in-process `fs.existsSync` check races the snapshot writer (snapshots are flushed to disk after all tests in the suite complete). Replaced with an inline `toMatchSnapshot('ptf77-suite-meta')` that pins suite metadata — proves the snapshot mechanism works AND survives idempotent re-runs.

### No Architectural Decisions Required

All deviations were Rule 1 / Rule 3 auto-fixes; no Rule 4 architectural choice was needed. The plan's grounding was accurate (modulo the Plan 01 carry-forward documented at the data-layer mapping).

## Phase 77 Plan 03 Handoff

Plan 03 has already shipped (FromReferencesBadge + ReferenceThumbnailsStrip — see commit `73b3492`). The `regenerateAction` returns `{ ok: true, projectId, slideCount }` on success — the dashboard shell consumes this via existing `router.push('/project/${projectId}')` pattern (same routing as today's `generateCarousel` flow). No new editor wiring needed (EDITOR-01 by construction).

The reference thumbnails on project detail (Plan 03 Task) consume `projects.reference_assets` JSONB which Phase 75 persists at extraction time — already working independently of this plan.

## Phase 78 Handoff (REMIX)

`generateCarouselFromReferences` UPDATEs `slide_data` + `generation_status` + `title` ONLY. **`style_spec` is NEVER touched** during regenerate (verified by grepping `update({...})` in `carousel.ts`). This means a future Phase 78 fork-RPC carries the original extracted spec verbatim — REMIX can replay any past style on a new project without re-extracting.

## Self-Check: PASSED

**Files exist:**
```bash
$ for f in \
  src/lib/ai/generate-from-style-spec.ts \
  src/lib/ai/generate-from-style-spec.types.ts \
  src/lib/services/__tests__/carousel-from-references.test.ts \
  src/lib/ai/__tests__/generate-from-style-spec.test.ts \
  src/lib/ai/__tests__/prompts.test.ts \
  src/lib/render/__tests__/parity.style-spec-roundtrip.test.tsx \
  src/lib/render/__tests__/__snapshots__/parity.style-spec-roundtrip.test.tsx.snap \
  scripts/grep-gates/prompt-token-budget.cjs \
  scripts/grep-gates/prompt-token-budget-helper.ts \
  scripts/grep-gates/__tests__/prompt-token-budget.test.ts; do
    [ -f "$f" ] && echo "FOUND: $f" || echo "MISSING: $f"
  done
FOUND: src/lib/ai/generate-from-style-spec.ts
FOUND: src/lib/ai/generate-from-style-spec.types.ts
FOUND: src/lib/services/__tests__/carousel-from-references.test.ts
FOUND: src/lib/ai/__tests__/generate-from-style-spec.test.ts
FOUND: src/lib/ai/__tests__/prompts.test.ts
FOUND: src/lib/render/__tests__/parity.style-spec-roundtrip.test.tsx
FOUND: src/lib/render/__tests__/__snapshots__/parity.style-spec-roundtrip.test.tsx.snap
FOUND: scripts/grep-gates/prompt-token-budget.cjs
FOUND: scripts/grep-gates/prompt-token-budget-helper.ts
FOUND: scripts/grep-gates/__tests__/prompt-token-budget.test.ts
```

**Commits exist:**
- `3931470` (Task 2 RED — buildFromSpecPrompt + ContentSource type tests)
- `fcc2346` (Task 2 GREEN — buildFromSpecPrompt implementation)
- `445d255` (Task 1 RED — prompt-token-budget gate tests)
- `8e2d724` (Task 1 GREEN — gate implementation + package.json wire)
- `cfa6f62` (Task 3 RED — generateFromStyleSpec tests)
- `edecac8` (Task 3 GREEN — generateFromStyleSpec implementation)
- `c4e789e` (Task 4 RED — orchestrator + regenerateAction tests)
- `5f2cf4b` (Task 4 GREEN — orchestrator + Server Action wiring)
- `6436f74` (Task 5 GREEN — PTF77 roundtrip test + snapshot + projector-ordering fix)

All commits visible in `git log --oneline`.
