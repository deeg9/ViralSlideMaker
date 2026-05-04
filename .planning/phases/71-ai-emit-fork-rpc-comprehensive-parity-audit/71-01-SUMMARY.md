---
phase: 71-ai-emit-fork-rpc-comprehensive-parity-audit
plan: 01
subsystem: ai
tags: [ai, gemini, decoration, schema, ingest, server-side-resolution, closed-enum, silent-drop, v2.12]

# Dependency graph
requires:
  - phase: 67-decor
    provides: DecorationSchema (Zod) + parseDecorationsArraySafe + IconDecorationSchema/ShapeDecorationSchema/DecorationContent type — full canonical Decoration validator that the AI ingest's final-parse gate consumes
  - phase: 69-decor-render
    provides: LUCIDE_DECORATION_ALLOWLIST (118-name closed-enum registry) — AI_LUCIDE_ALLOWLIST is the ~100-entry hand-curated subset
  - phase: 56-vibrant-palette
    provides: derived_palette node-vibrant indexing (0=Vibrant / 4=DarkMuted / 5=LightMuted) — locked role mapping consumed by resolveAIColor
  - phase: 58-airole
    provides: closed-enum AI emit + silent-drop pattern (template_id_override D-08) — Plan 71-01 mirrors the same defaulting pattern for decorations
provides:
  - DecorationEmitSchema (closed-enum AI emit subset of full DecorationSchema)
  - AI_LUCIDE_ALLOWLIST (100 PascalCase names) + AI_COLOR_TOKENS (6) + AI_POSITION_ANCHORS (7) + AI_SHAPE_KINDS (8)
  - resolveAIDecoration / resolveAIColor / resolveAIPosition / buildAIDecorationId pure-function resolvers
  - AI_POSITION_RECTS — locked safe-zone offsets (top/bottom rows in bands 8..24% / 76..92%, outside hook+body central band)
  - generate-slides.ts ingest adapter — triple-layer silent-drop pipeline (DecorationEmitSchema → resolveAIDecoration → DecorationSchema → maxItems=2 hard clamp)
affects: [71-02-fork-rpc-migration, 71-03-PTF17-comprehensive-parity-audit, 72-rotation-handles-aabb]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-enum AI emit (subset of full schema) — extends v2.9 D-08 template_id_override pattern to decorations[]"
    - "Triple-layer silent-drop ingest pipeline — closed-enum gate → resolver try/catch → final canonical-shape gate → hard-cap slice"
    - "Server-side token resolution — AI never emits raw hex / raw % coords; named tokens + semantic anchors only"
    - "Defense-in-depth maxItems clamp — Gemini schema soft cap + post-parse while-loop hard cap"

key-files:
  created:
    - src/lib/ai/resolve-ai-decoration.ts
    - src/lib/ai/__tests__/decoration-emit-schema.test.ts
    - src/lib/ai/__tests__/resolve-ai-decoration.test.ts
    - src/lib/ai/__tests__/decoration-ai-ingest.test.ts
  modified:
    - src/lib/ai/schemas.ts
    - src/lib/ai/generate-slides.ts

key-decisions:
  - "AI_LUCIDE_ALLOWLIST = 100 names (within [80, 110] sanity band) — explicit hand-curated subset of Phase 69's 118-name registry; categories preserved (status/nav/arrows/shapes/weather/people/social/comms/media/awards/nature/travel/commerce/editing/files/time/charts/misc)"
  - "SlideContentSchema.decorations is loose passthrough (z.array(z.unknown).optional) — keeps the field intact through Zod parse so the per-entry DecorationEmitSchema.safeParse + silent-drop runs at the ingest adapter layer; Zod's array() would fail-fast on first invalid entry, defeating the silent-drop semantics"
  - "SlideContentSchema.style_overrides is loose passthrough (z.record(z.unknown).optional) — required so resolveAIColor can read derived_palette in re-resolution scenarios; full SlideStyleOverrides shape is validated elsewhere"
  - "Color resolution choices: palette-light → derived_palette[5] (LightMuted), NOT [1] (LightVibrant) — LightVibrant is too saturated for AI 'soft light' semantics. on-light=#0F172A (slate-900-equivalent), on-dark=#F8FAFC (slate-50-equivalent) — matches editor text-on-surface defaults"
  - "Safe-zone rects locked: top rows y=8/h=16 (band 8..24%), bottom rows y=76/h=16 (band 76..92%), center y=42/h=16; all width=22%, x ∈ {8, 39, 70} for left/center/right. Avoids central 24..76% hook+body band"
  - "@google/genai responseSchema.maxItems is typed as string (gRPC int64 wire format) — passed as '2' not 2"

patterns-established:
  - "Triple-layer silent-drop pipeline (Gemini → CarouselSchema → DecorationEmitSchema → resolveAIDecoration → DecorationSchema → maxItems clamp) — extends v2.11 legacyToTextBoxes adapter pattern to decoration ingest"
  - "Loose Zod passthrough for fields whose canonical validation runs downstream — used for both `decorations` and `style_overrides` in SlideContentSchema; preserves silent-drop semantics by skipping fail-fast Zod array gating"
  - "Locked safe-zone offset constants — AI_POSITION_RECTS is the locked source of truth; modification requires updating both the unit test (Test 8 exact equality) and the carry-forward PTF17 fingerprint snapshot"

requirements-completed: [AI-01, AI-02, AI-03, AI-04]

# Metrics
duration: 8min
completed: 2026-05-04
---

# Phase 71 Plan 01: DecorationEmitSchema + resolveAIDecoration + Gemini ingest adapter Summary

**Closed-enum Gemini decoration emit (100-icon allowlist + 6 color tokens + 7 anchors) with server-side token-to-hex / anchor-to-safe-zone resolution and triple-layer silent-drop ingest at the AI boundary.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-04T09:47:32Z
- **Completed:** 2026-05-04T09:56:08Z
- **Tasks:** 3
- **Files modified:** 6 (2 modified, 4 created)

## Accomplishments

- DecorationEmitSchema lands as a closed-enum subset of the full Phase 67 DecorationSchema — AI is structurally prevented from emitting raw hex colors or raw % coordinates.
- 100-icon AI_LUCIDE_ALLOWLIST committed as the hand-curated PascalCase subset of Phase 69's 118-name registry (includes all 10 PTF13 fixtures + ~90 broadly applicable category-spanning names).
- resolveAIDecoration / resolveAIColor / resolveAIPosition pure-function resolvers translate AI's named tokens + semantic anchors into explicit hex + safe-zone % coords, with deterministic id generation and never-throws fallback semantics.
- Gemini responseSchema lifted with `decorations: ARRAY(maxItems='2')` per slide; post-Zod-parse ingest adapter runs the triple-layer silent-drop pipeline (DecorationEmitSchema.safeParse → resolveAIDecoration try/catch → DecorationSchema.safeParse → resolved.length < 2 hard clamp).
- 35 new tests across 3 files (12 schema + 13 resolver + 10 ingest) all GREEN; full AI suite 113/113 + Phase 67 PTF16 baseline 73/73 unchanged; tsc baseline 17 preserved.

## Task Commits

Each task was committed atomically:

1. **Task 1: DecorationEmitSchema + AI_LUCIDE_ALLOWLIST + token/anchor enums** — `4bf0900` (feat)
2. **Task 2: resolve-ai-decoration.ts (token + anchor resolvers + full Decoration constructor)** — `a84ab87` (feat)
3. **Task 3: Gemini responseSchema lift + post-Zod-parse ingest adapter** — `f255aa9` (feat)

## Files Created/Modified

- `src/lib/ai/schemas.ts` — Added AI_LUCIDE_ALLOWLIST (100 names), AI_COLOR_TOKENS (6), AI_POSITION_ANCHORS (7), AI_SHAPE_KINDS (8); IconDecorationEmitSchema + ShapeDecorationEmitSchema + DecorationEmitSchema discriminated union; DecorationEmitContent / IconDecorationEmitContent / ShapeDecorationEmitContent type exports. SlideContentSchema extended with loose `decorations` + `style_overrides` passthrough fields.
- `src/lib/ai/resolve-ai-decoration.ts` (NEW) — resolveAIColor / resolveAIPosition / buildAIDecorationId / resolveAIDecoration pure-function resolvers + AI_POSITION_RECTS locked safe-zone constants. ON_LIGHT_HEX (#0F172A) / ON_DARK_HEX (#F8FAFC) contrast pair constants.
- `src/lib/ai/generate-slides.ts` — responseSchema.slides[].decorations field (closed-enum lucideName / color / position / shapeKind enums; maxItems='2' soft cap); post-CarouselSchema.parse ingest pass with triple-layer silent-drop + hard maxItems=2 clamp; SlideContentWithTextBoxes type narrowed to `decorations?: DecorationContent[]`. Imports getTemplate / resolveAIDecoration / DecorationEmitSchema / AI enum constants.
- `src/lib/ai/__tests__/decoration-emit-schema.test.ts` (NEW) — 14 tests (12 plan tests + 2 enum sanity assertions): valid icon/shape parsing, unknown lucideName / raw hex / raw coord / unknown anchor / unknown shapeKind rejection, rotation passthrough, allowlist subset + size-band check, PTF13 fixtures present, type export round-trip.
- `src/lib/ai/__tests__/resolve-ai-decoration.test.ts` (NEW) — 15 tests (13 plan tests + 2 helper sanity): all 6 color tokens → hex (including fallback chains), all 7 anchors → distinct safe-zone rects, unknown-token / unknown-anchor fallbacks, full round-trip (icon + shape) validating against DecorationSchema, deterministic id, rotation passthrough.
- `src/lib/ai/__tests__/decoration-ai-ingest.test.ts` (NEW) — 10 tests: zero-decorations idempotent absence, single valid icon/shape resolution, unknown lucideName / raw hex / raw coord silent-drop, maxItems=2 server-side clamp (4 valid → 2 kept), mixed valid+invalid order-preserving silent-drop, malformed entries (string / null) silent-drop, rotation passthrough.

## Decisions Made

- **AI_LUCIDE_ALLOWLIST = 100 names** — chose 100 (centered in [80, 110] sanity band) to give Gemini broad but bounded vocabulary while keeping the closed-enum surface auditable. All 10 PTF13 fixtures included; categories from Phase 69 registry preserved in same order.
- **Loose Zod passthrough for decorations + style_overrides on SlideContentSchema** — chose option (A) variant: `z.array(z.unknown()).optional()` rather than `z.array(DecorationEmitSchema).optional()`. The strict variant would have triggered Zod's fail-fast array semantics, dropping ALL entries on a single bad item; the loose variant pushes per-entry safeParse to the ingest adapter where the silent-drop pipeline handles it cleanly. Same rationale for style_overrides — full SlideStyleOverrides shape lives elsewhere; here we just need the field to survive Zod parse so resolveAIColor can read derived_palette during re-resolution.
- **palette-light → derived_palette[5] (LightMuted), not [1] (LightVibrant)** — LightVibrant is too saturated for the "soft light surface" semantic AI implies when emitting `palette-light`. LightMuted is the desaturated lightest palette member from the Phase 56 node-vibrant ordering.
- **on-light = #0F172A / on-dark = #F8FAFC** — slate-900 / slate-50 equivalents, matching the editor's text-on-surface defaults. Deterministic constants (no template lookup) because these tokens explicitly mean "high-contrast text on a light/dark background regardless of palette."
- **AI_POSITION_RECTS locked geometry** — top/bottom rows at y=8/76 with height=16 (occupying bands 8..24% and 76..92%), all rects width=22%, x ∈ {8, 39, 70} for left/center/right symmetry. Center anchor at y=42 (between bands). All rects clear the central 24..76% band that contains hook+body text on default templates. Single source of truth for both the resolver and the locked Test 8 fingerprint.
- **maxItems string vs number** — `@google/genai`'s Schema type declares `maxItems?: string` (gRPC int64 wire format). Passed as `'2'` not `2`. This was the only TS error introduced by Task 3 and was fixed inline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SlideContentSchema needed loose passthrough for `decorations` field**
- **Found during:** Task 3 (Gemini ingest adapter)
- **Issue:** Plan recommended option (A) — `decorations: z.array(DecorationEmitSchema).optional()` on SlideContentSchema. But Zod's array validation is fail-fast: a single invalid entry would reject the entire array, defeating the per-entry silent-drop semantics that AI-04 requires. The plan's later "silent-drop on any per-entry validation failure" is incompatible with strict Zod array gating.
- **Fix:** Used `z.array(z.unknown()).optional()` so the field survives CarouselSchema.parse intact. Per-entry DecorationEmitSchema.safeParse + the resolveAIDecoration try/catch + final DecorationSchema.safeParse all run inside the ingest adapter loop, exactly matching the documented triple-layer silent-drop pattern. Result is observationally identical to option (A) for valid entries while preserving silent-drop on malformed ones.
- **Files modified:** src/lib/ai/schemas.ts (SlideContentSchema)
- **Verification:** Tests 4/5/6/8/9 in decoration-ai-ingest.test.ts assert the silent-drop semantics; all GREEN.
- **Committed in:** f255aa9 (Task 3 commit)

**2. [Rule 3 - Blocking] SlideContentSchema needed loose passthrough for `style_overrides` field**
- **Found during:** Task 3 (Test 3 — palette-vibrant resolution)
- **Issue:** SlideContentSchema didn't declare `style_overrides`, so Zod's default strip-unknown behavior dropped the field at CarouselSchema.parse. resolveAIColor's `slide.style_overrides?.derived_palette?.[0]` lookup always returned undefined, so palette-vibrant always fell back to template.accentColor. Test 3 expected `#123456` (derived_palette[0]) and got `#FFD600` (highlight-bar default accent).
- **Fix:** Added `style_overrides: z.record(z.string(), z.unknown()).optional()` to SlideContentSchema as loose passthrough. The full SlideStyleOverrides shape is validated by the editor side; here we just need the field to survive Zod so the resolver can read derived_palette during re-resolution scenarios.
- **Files modified:** src/lib/ai/schemas.ts (SlideContentSchema)
- **Verification:** Test 3 in decoration-ai-ingest.test.ts asserts the resolved fill matches derived_palette[0]; GREEN after fix.
- **Committed in:** f255aa9 (Task 3 commit)

**3. [Rule 1 - Bug] Raw passthrough field leaked when no entries resolved**
- **Found during:** Task 3 (Tests 4/5/6 — silent-drop assertions)
- **Issue:** When all rawEmitted entries fail validation (e.g., unknown lucideName), the early-return `if (resolved.length === 0) return slide` returned the original slide which still carried the raw passthrough `decorations: [...]` field. Tests 4/5/6 asserted `decorations === undefined` and got `[ { kind: 'icon', ...(3) } ]` (the unresolved raw entries leaked through).
- **Fix:** Strip the raw passthrough field unconditionally before any return. Use destructuring `const { decorations: _rawDrop, ...slideWithoutRaw } = slide` then return either `slideWithoutRaw` (no resolved) or `{ ...slideWithoutRaw, decorations: resolved }` (some resolved). Result preserves Phase 67 PTF16 idempotent-absence baseline: slides emitting 0 valid decorations have `decorations === undefined`.
- **Files modified:** src/lib/ai/generate-slides.ts (ingest adapter)
- **Verification:** Tests 4/5/6 (silent drop) + Test 1 (zero emit) all GREEN.
- **Committed in:** f255aa9 (Task 3 commit)

**4. [Rule 1 - Bug] Type widening on shapeKind through z.enum cast**
- **Found during:** Task 2 (resolve-ai-decoration.ts compile)
- **Issue:** Casting AI_SHAPE_KINDS through `z.enum(... as unknown as [string, ...string[]])` widens the inferred type of `emitted.shapeKind` to `string`, but ShapeDecorationContent.shapeKind is the closed enum `'rect'|'circle'|...`. Direct assignment failed tsc.
- **Fix:** Narrow at the assignment site: `shapeKind: emitted.shapeKind as ShapeDecorationContent['shapeKind']`. The DecorationEmitSchema closed-enum gate already guarantees the runtime value is in the canonical set; the cast is a type-system bridge.
- **Files modified:** src/lib/ai/resolve-ai-decoration.ts
- **Verification:** tsc baseline 17 preserved (no new errors).
- **Committed in:** a84ab87 (Task 2 commit)

**5. [Rule 1 - Bug] @google/genai Schema.maxItems is typed as string**
- **Found during:** Task 3 (responseSchema lift compile)
- **Issue:** `maxItems: 2` raised TS2322 — `@google/genai`'s Schema type declares `maxItems?: string` (gRPC int64 wire format requires strings).
- **Fix:** Pass as `'2'` with an inline comment explaining the wire-format convention.
- **Files modified:** src/lib/ai/generate-slides.ts (responseSchema)
- **Verification:** tsc baseline 17 preserved.
- **Committed in:** f255aa9 (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (3 blocking schema/type issues, 2 bugs in initial implementation)
**Impact on plan:** All deviations were inline fixes during the same task — no scope creep, no architectural changes. The two SlideContentSchema passthrough additions are necessary for the silent-drop and palette-resolution contracts to actually work end-to-end; both fall under Rule 3 (blocking issues that prevent completing the current task's done criteria).

## Issues Encountered

- None beyond the deviations documented above. The TDD RED → GREEN flow worked cleanly; each task's verification command passed on first GREEN run after fixes.

## Self-Check: PASSED

**Files verified to exist:**
- src/lib/ai/__tests__/decoration-emit-schema.test.ts: FOUND
- src/lib/ai/__tests__/resolve-ai-decoration.test.ts: FOUND
- src/lib/ai/__tests__/decoration-ai-ingest.test.ts: FOUND
- src/lib/ai/resolve-ai-decoration.ts: FOUND
- src/lib/ai/schemas.ts: FOUND (modified)
- src/lib/ai/generate-slides.ts: FOUND (modified)

**Commits verified:**
- 4bf0900 Task 1: FOUND
- a84ab87 Task 2: FOUND
- f255aa9 Task 3: FOUND

**Verification commands re-run at end:**
- `npx vitest run src/lib/ai/__tests__/` → 113/113 GREEN (10 test files)
- `npx vitest run src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx` → 73/73 GREEN (PTF16 baseline)
- `npx tsc --noEmit | grep -c "error TS"` → 17 (baseline preserved)

## Next Phase Readiness

- AI-01..04 all closed (4 of 7 phase requirements). Plan 71-02 (advisory monoculture gate AI-05 + fork RPC migration MIGR-01) and Plan 71-03 (PTF17 comprehensive parity audit + ship-gate sweep) can now consume the resolved Decoration[] from the ingest boundary.
- DecorationEmitSchema + resolveAIDecoration are the single source of truth for AI emit shape; Plan 71-03's PTF17 fixture pipes a Gemini-emitted decoration through the same resolver before fingerprint comparison.
- The closed-enum AI_LUCIDE_ALLOWLIST is now the lookup baseline Plan 71-02's diversity gate walks; the same constant Plan 70's picker may eventually consume for AI-suggested ordering.

---
*Phase: 71-ai-emit-fork-rpc-comprehensive-parity-audit*
*Completed: 2026-05-04*
