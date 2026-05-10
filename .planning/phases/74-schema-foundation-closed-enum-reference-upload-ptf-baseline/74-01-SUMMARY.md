---
phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline
plan: 01
subsystem: validation
tags: [zod, typescript, closed-enum, prompt-injection-defense, silent-drop, ci-gate, style-spec, ai-ingest]

# Dependency graph
requires:
  - phase: 67-decoration-discriminated-union
    provides: parseDecorationsArraySafe silent-drop pattern (mirrored, this plan adds counter)
  - phase: 69-decoration-renderer
    provides: LUCIDE_DECORATION_ALLOWLIST (closed-enum source for decorations.preferredLucide)
  - phase: 54-photo-treatment-foundation
    provides: TreatmentPreset type (closed-enum source for imagery.treatmentPreset)
  - phase: 55-typography
    provides: FontEntry['category'] (closed-enum source for typography.{hook,body}FontCategory)
  - phase: 67-decoration-discriminated-union
    provides: ShapeKind type (closed-enum source for decorations.preferredShapes)
provides:
  - StyleSpec TypeScript interface (palette/typography/layout/imagery/decorations/rhythm/voice_note + schema_version=1)
  - parseStyleSpecSafe Zod entry point with per-call silent-drop counter
  - StyleSpecSchema Zod schema with catchall(z.never()) on every nested object
  - createSilentDropCounter generic observability primitive (reusable beyond StyleSpec)
  - SilentDropCounter + SilentDropEvent + SilentDropReason types
  - PARITY-05 closed-enum CI grep gate (scripts/grep-gates/closed-enum-styleSpec.sh)
  - npm "lint:gates" script wiring
affects:
  - 75-vision-extraction (imports parseStyleSpecSafe + StyleSpec; counter wired to telemetry)
  - 76-style-spec-rendering (consumes StyleSpec at render boundary)
  - 77-emit-boundary (EMIT-08 reuses createSilentDropCounter at emit boundary; PARITY-03 verification)
  - all future v2.13+ phases (closed-enum invariant enforced in CI forever)

# Tech tracking
tech-stack:
  added: []  # no new dependencies — used existing zod 4.3.6
  patterns:
    - "Closed-enum invariant via TYPE IMPORTS (single source of truth, never redefine)"
    - "catchall(z.never()) on every nested Zod object (additive-smuggling defense)"
    - "Per-field silent-drop counter (granular telemetry, NOT one-per-call)"
    - "Per-field walker pre-strips unknowns BEFORE safeParse (belt-AND-suspenders)"
    - "raw_value truncation to <=200 stringified chars (prompt-injection log spam defense)"
    - "Default observability hook never throws (defense-in-depth — silent-drop is silent by contract)"
    - "Comment-strip filter in grep gate (self-invalidating-grep-gate anti-pattern defense)"
    - "git grep --untracked in CI gate (catches forbidden tokens at PR time, not after merge)"

key-files:
  created:
    - src/lib/types/style-spec.ts (135 lines)
    - src/lib/validators/style-spec.ts (404 lines)
    - src/lib/validators/silent-drop-counter.ts (143 lines)
    - scripts/grep-gates/closed-enum-styleSpec.sh (45 lines, executable)
    - src/lib/types/__tests__/style-spec.test.ts (176 lines, 10 tests)
    - src/lib/validators/__tests__/style-spec.test.ts (226 lines, 13 tests)
    - src/lib/validators/__tests__/silent-drop-counter.test.ts (178 lines, 9 tests)
    - scripts/grep-gates/__tests__/closed-enum-styleSpec.test.ts (109 lines, 5 tests)
  modified:
    - package.json (added "lint:gates" script)

key-decisions:
  - "Used per-field walker BEFORE safeParse to enable granular silent-drop events (alternative: rely on safeParse error-path → loses field-level granularity)"
  - "catchall(z.never()) on EVERY nested object as belt-AND-suspenders, even though walker pre-strips — defense-in-depth against future schema-evolution mistakes"
  - "Truncate raw_value to 200 stringified chars (NOT raw chars) so JSON.stringify wrapping does not exceed cap — defends prompt-injection log spam"
  - "Default onDrop hook wrapped in try/catch — never crash parse path on broken global logger"
  - "Silent-drop counter per-instance (not singleton) — Phase 75 caller decides aggregation strategy"
  - "Grep gate uses git grep --untracked so brand-new .ts files trip the gate at PR time (not after merge)"
  - "Grep gate strip-comment filter prevents the gate from tripping on its own header documentation in production source files"
  - "STYLE_SPEC_VERSION constant exported alongside StyleSpecVersion type for runtime introspection in tests"

patterns-established:
  - "StyleSpec is the canonical AI-ingest contract; all closed-enum string fields MUST type-import from existing modules — never redefine. PARITY-05 grep gate enforces in CI forever."
  - "Silent-drop counter API (createSilentDropCounter / SilentDropEvent / onDrop hook) is the standard observability primitive for additive-smuggling defenses anywhere in the codebase (Phase 77 EMIT-08 will reuse)."
  - "voice_note is the ONLY free-text field; sanitization (HTML-block-strip → tag-strip → whitespace-collapse → 200-char-cap) is the canonical pattern for any future free-text input that survives a closed-enum review."

requirements-completed:
  - STYLESPEC-01
  - STYLESPEC-03
  - STYLESPEC-04
  - STYLESPEC-05
  - STYLESPEC-06
  - STYLESPEC-07
  - STYLESPEC-08
  - STYLESPEC-09
  - STYLESPEC-10
  - PARITY-03
  - PARITY-05

# Metrics
duration: ~9min
completed: 2026-05-10
---

# Phase 74 Plan 01: Schema Foundation — Closed-Enum StyleSpec + Zod Validator + Silent-Drop Counter + CI Grep Gate Summary

**StyleSpec contract published with three-layer closed-enum defense (compile-time type imports + runtime catchall(z.never()) + CI grep gate) and a reusable silent-drop counter wired into a per-field walker that pre-strips unknown enum values + unknown fields BEFORE safeParse — load-bearing AI-ingest defense for v2.13.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-10T22:19:53Z
- **Completed:** 2026-05-10T22:28:51Z
- **Tasks:** 3 (all RED→GREEN, no checkpoints)
- **Files modified:** 9 (8 created + 1 modified)
- **Tests added:** 37 (9 silent-drop counter + 10 type + 13 validator + 5 grep-gate)
- **Tests passing:** 37 / 37 (100%)
- **Production lines:** 727 (135 type + 404 validator + 143 counter + 45 shell)
- **Test lines:** 689

## Accomplishments

- **StyleSpec contract published** at `src/lib/types/style-spec.ts` with all 7 sections (palette, typography, layout, imagery, decorations, rhythm, voice_note) + `schema_version: 1`. Every closed-enum string field is a TYPE IMPORT from an existing module (5 sources: font-catalog, decoration registry, decoration types, brand-kit, photo-treatment) — single source of truth so the grep gate stays effective forever.
- **parseStyleSpecSafe Zod validator** at `src/lib/validators/style-spec.ts` implements per-field walker that pre-strips unknown enum values + unknown fields into a granular silent-drop counter BEFORE running `StyleSpecSchema.safeParse`. Every nested Zod object also ends with `.catchall(z.never())` for belt-AND-suspenders additive-smuggling defense (10 catchalls — verified by grep).
- **Silent-drop counter** at `src/lib/validators/silent-drop-counter.ts` is per-instance (NOT singleton), increments per stripped FIELD (NOT per parse call — granular telemetry per CONTEXT.md), emits structured single-line JSON to `console.warn` by default (greppable for `style_spec_drop`), accepts a caller-supplied `onDrop` hook for telemetry-sink injection (Phase 75 will wire), truncates `raw_value` to ≤200 stringified chars to defend against prompt-injection log spam (PITFALLS Pitfall 3), and never throws even if the underlying logger crashes.
- **voice_note sanitization** strips `<script>`/`<style>` blocks first (full content deletion), then remaining HTML tags, then collapses whitespace (single line), then caps at 200 chars. Each transformation that changes the string fires one sanitization event.
- **PARITY-05 closed-enum CI grep gate** at `scripts/grep-gates/closed-enum-styleSpec.sh` blocks `reference_artist|reference_brand|copy_exactly|style_freetext` from production code. Uses `git grep --untracked` so freshly-added `.ts` files trip at PR time. Excludes `__tests__` + `*.test.*` + `*.spec.*` so validator tests can legitimately pass forbidden tokens as INPUT to verify they are stripped. Comment-strip filter prevents the gate from tripping on its own documentation. Wired to `npm run lint:gates`.
- **Phase 75 import contract published**: `parseStyleSpecSafe`, `StyleSpec`, `StyleSpecSchema`, `createSilentDropCounter` ready for downstream consumption with no further setup.

## Task Commits

Each task was committed atomically (TDD RED→GREEN within a single feat commit per task per the plan's tdd="true" framing — RED tests + GREEN implementation co-committed since test files are part of the same task's `<files>`):

1. **Task 1: Silent-drop counter + tests (RED→GREEN)** — `1fcc7a3` (feat)
2. **Task 2: StyleSpec type + Zod validator + tests (RED→GREEN)** — `e3aebcb` (feat)
3. **Task 3: CI grep gate + lint:gates wiring + tests** — `0e248d9` (feat)

## Closed-Enum Imports Used (5 source modules, single source of truth)

Per the verification gate `git grep -nE "import.*from\s+'@/lib/(fonts/font-catalog|render/decorations/registry|types/decoration|types/brand-kit|photo-treatment/treat)'" src/lib/types/style-spec.ts | wc -l` → **5** (verified):

| Closed enum source                              | StyleSpec field(s)                               | Requirement |
| ----------------------------------------------- | ------------------------------------------------ | ----------- |
| `@/lib/fonts/font-catalog` (FontEntry.category) | typography.hookFontCategory + bodyFontCategory   | STYLESPEC-04 |
| `@/lib/render/decorations/registry`             | decorations.preferredLucide                      | STYLESPEC-05 |
| `@/lib/types/decoration` (ShapeKind)            | decorations.preferredShapes                      | STYLESPEC-06 |
| `@/lib/types/brand-kit` (BrandKitTextPosition)  | layout.hookPosition                              | STYLESPEC-07 |
| `@/lib/photo-treatment/treat` (TreatmentPreset) | imagery.treatmentPreset                          | STYLESPEC-08 |

Plus three closed enums **local to this contract** (no other module owns them — they are architectural decisions of the StyleSpec contract itself, locked in CONTEXT.md):

- `palette.mode`: `'solid' | 'duotone' | 'gradient' | 'photo'` (STYLESPEC-03, locked CONTEXT.md D-XX)
- `layout.density`: `'tight' | 'medium' | 'airy'`
- `decorations.density`: `'sparse' | 'moderate' | 'dense'`
- `rhythm.cadence`: `'punchy' | 'flowing' | 'sparse'`

## Silent-Drop Counter API (published for Phase 75 + 77 consumption)

```typescript
import { createSilentDropCounter } from '@/lib/validators/silent-drop-counter'
import { parseStyleSpecSafe } from '@/lib/validators/style-spec'
import type { StyleSpec } from '@/lib/types/style-spec'

// Phase 75 extract-style-spec.ts:
const counter = createSilentDropCounter({
  onDrop: (event) => telemetry.emit('style_spec_drop', event),
})
const result = parseStyleSpecSafe(geminiRawJson, { counter })
if (!result.ok) {
  throw new StyleExtractionError('canonical-shape', { drops: counter.getEvents() })
}
const validated: StyleSpec = result.spec

// Phase 77 EMIT-08 reuses createSilentDropCounter at the emit boundary
// for symmetric ingest+emit silent-drop telemetry (PARITY-03 verification).
```

The 4 SilentDropReason values are a closed union enforced at compile time:
- `unknown_enum_value` (string was not in the closed enum)
- `unknown_field` (key was not in the schema's known surface — INJECTION DEFENSE)
- `sanitization` (voice_note transformation changed the value)
- `parse_error` (root-level catastrophic failure or post-clean schema mismatch)

## Decisions Made

1. **Per-field walker pre-strips BEFORE safeParse** — alternative was relying on `safeParse` error-path to surface unknown fields, but that loses field-level granularity (Zod errors are aggregated). The walker enables `field: 'typography.hookFontCategory', reason: 'unknown_enum_value'` precision.
2. **catchall(z.never()) on every nested object even though walker pre-strips** — belt-AND-suspenders defense. If a future schema-evolution mistake bypasses the walker (e.g. someone forgets to add a new section to `KNOWN_SECTION_FIELDS`), the catchall still fails the parse loudly instead of silently smuggling.
3. **raw_value truncation measured on JSON.stringify form, not raw chars** — strings get wrapped in `"…"` by JSON.stringify (adding 2 chars), so naive 200-char truncation produces 202-char serialized output. Truncating to 198 raw chars for strings keeps the serialized form ≤200.
4. **Default onDrop hook wrapped in try/catch** — silent-drop is silent by contract; never crash the parse path on a broken global logger. Verified by Test 7 (mocked console.warn that throws).
5. **Counter is per-instance, not singleton** — two parses in the same process produce independent counters. Phase 75's caller chooses whether to aggregate across calls (e.g. via a long-lived counter passed to every parse) or treat each parse independently.
6. **Grep gate uses `git grep --untracked`** — catches forbidden tokens in newly-added files at PR time, not after merge. Verified by G2 test (writes a temp file, runs gate, expects exit 1).
7. **Grep gate strip-comment filter** — defends against the self-invalidating-grep-gate anti-pattern (the gate's own header comment in production source files mentions the forbidden tokens; without the strip, the gate would trip on itself).
8. **`STYLE_SPEC_VERSION` constant exported alongside `StyleSpecVersion` type** — gives the validator a runtime value to use as the default after a schema_version mismatch, plus enables runtime introspection in tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] voice_note HTML sanitization needed `<script>`/`<style>` block stripping**
- **Found during:** Task 2 GREEN (Test V6 failed: `<script>alert(1)</script>Hello` → `alert(1)Hello`, expected `Hello`)
- **Issue:** Plan's specified sanitizer (`String(s).replace(/<[^>]*>/g, '')`) strips tags but leaves their content — `alert(1)` survived after `<script>` was removed. Test V6 expected the script CONTENT to also be stripped.
- **Fix:** Added a pre-pass `HTML_BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi` that strips script/style blocks (tag + contents) before the general tag-strip regex. Defends against XSS-like adversarial payloads embedded in voice_note (PITFALLS Pitfall 3).
- **Files modified:** src/lib/validators/style-spec.ts
- **Verification:** Test V6 passes; all 13 validator tests GREEN.
- **Committed in:** e3aebcb (Task 2 commit)

**2. [Rule 3 - Blocking] Grep gate needed `--untracked` flag**
- **Found during:** Task 3 GREEN (Test G2 failed: gate exit was 0 even with a fixture file containing `'reference_artist'`)
- **Issue:** `git grep` only searches TRACKED files by default, so a freshly-added `.ts` fixture would not trip the gate until after it was committed — defeating the PR-time enforcement intent.
- **Fix:** Added `--untracked` to the `git grep` invocation. Now the gate sees both tracked and untracked production source files.
- **Files modified:** scripts/grep-gates/closed-enum-styleSpec.sh
- **Verification:** Test G2 passes; gate still emits success line on the actual checkout.
- **Committed in:** 0e248d9 (Task 3 commit)

**3. [Rule 3 - Blocking] Type test `_bad` array element typing under strict mode**
- **Found during:** Task 2 GREEN (`tsc --noEmit` reported `'_bad' is possibly 'undefined'` on `_bad[0]` — because `StyleSpec['decorations']['preferredLucide']` is `LucideDecorationName[] | undefined`)
- **Issue:** Optional array fields produce `T[] | undefined`; reading `_bad[0]` then becomes `T | undefined`.
- **Fix:** Used `NonNullable<...>` to extract the array type. Also chained an optional access on a separate `length` read.
- **Files modified:** src/lib/types/__tests__/style-spec.test.ts
- **Verification:** `npx tsc --noEmit` clean on plan files.
- **Committed in:** e3aebcb (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 3 - Blocking)
**Impact on plan:** All three deviations were blocking issues discovered during GREEN — the original spec was almost-correct but missed a corner case in each. None expanded scope; each was a tightening of behavior the plan already intended.

## Issues Encountered

- **Sibling Plan 74-02 RED-phase test files surface tsc errors** for `projects-style-spec-columns.test.ts` referencing `projects-storage-constants` (which sibling owns). These are out-of-scope per `<parallel_execution>` boundary and will resolve when sibling commits its `src/lib/types/projects-storage-constants.ts`. Documented but not fixed (Rule 4 — sibling-owned).
- **package.json git index race** anticipated by `<parallel_execution>` did NOT occur — single retry was unnecessary.

## Verification Results

All plan-level verification gates passed:

| Gate | Expected | Actual | Status |
|------|----------|--------|--------|
| All Task 1 tests pass | 7+ | 9 | PASS |
| All Task 2 tests pass | 22 | 23 | PASS (added Test V13 schema sanity) |
| All Task 3 tests pass | 5 | 5 | PASS |
| `npx tsc --noEmit` clean on new files | yes | yes | PASS |
| `npm run lint:gates` exits 0 | yes | yes | PASS |
| Closed-enum source imports in style-spec.ts | ≥5 | 5 | PASS |
| `catchall(z.never())` count in style-spec.ts validator | ≥7 | 10 | PASS |
| StyleSpec has `schema_version: 1` field | yes | yes | PASS |
| Script `chmod +x` (executable) | yes | yes | PASS |
| Script committed | yes | yes (commit 0e248d9) | PASS |

## User Setup Required

None — no external service configuration required. The `lint:gates` script is pure local CI; future phases can add it to a pre-commit hook or PR-check workflow without further wiring.

## Next Phase Readiness

- **Phase 75 (vision-extraction)** can immediately consume:
  ```typescript
  import type { StyleSpec } from '@/lib/types/style-spec'
  import { parseStyleSpecSafe } from '@/lib/validators/style-spec'
  import { createSilentDropCounter } from '@/lib/validators/silent-drop-counter'
  ```
  No further wiring needed. The counter accepts an `onDrop` hook so Phase 75 can route events to its preferred telemetry sink (e.g. `telemetry.emit('style_spec_drop', event)`).
- **Phase 77 (emit boundary)** can reuse `createSilentDropCounter` at the emit boundary for symmetric ingest+emit silent-drop telemetry (PARITY-03 end-to-end verification).
- **CI integration** is one-line: add `npm run lint:gates` to a pre-commit hook or PR check workflow whenever ready. The gate is permanent — every future PR must pass it.

## Self-Check

Verified all claims:

**Files exist:**
- `src/lib/types/style-spec.ts` — FOUND
- `src/lib/validators/style-spec.ts` — FOUND
- `src/lib/validators/silent-drop-counter.ts` — FOUND
- `scripts/grep-gates/closed-enum-styleSpec.sh` — FOUND (executable)
- `src/lib/types/__tests__/style-spec.test.ts` — FOUND
- `src/lib/validators/__tests__/style-spec.test.ts` — FOUND
- `src/lib/validators/__tests__/silent-drop-counter.test.ts` — FOUND
- `scripts/grep-gates/__tests__/closed-enum-styleSpec.test.ts` — FOUND
- `package.json` — MODIFIED (lint:gates script added)

**Commits exist:**
- `1fcc7a3` Task 1 — FOUND in git log
- `e3aebcb` Task 2 — FOUND in git log
- `0e248d9` Task 3 — FOUND in git log

## Self-Check: PASSED

---
*Phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline*
*Completed: 2026-05-10*
