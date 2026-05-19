---
phase: 75-vision-extraction-two-phase-architecture-safety-config
plan: 03
subsystem: ai
tags: [node-vibrant, palette, deterministic, vision, color-extraction, server-only]

# Dependency graph
requires:
  - phase: 73-cost-rails
    provides: prepareForVision (PreparedReference.bytes — JPEG@85 ≤1024×1024 EXIF-stripped)
  - phase: 74-stylespec-schema
    provides: StyleSpec palette field shape (the merge target for Plan 75-01)
provides:
  - extractPaletteFromBytes(bytes) — deterministic node-vibrant wrapper, 1-6 hex strings + dominant
  - mergePalettes(palettes[]) — multi-image dominant-color voting with lex tiebreaker (fully order-independent)
  - PALETTE_TARGET_SIZE constant (6) — matches StyleSpec palette budget
  - FALLBACK_NEUTRAL_HEX constant (#808080) — graceful-degradation guard
affects:
  - 75-01 (extract-style-spec orchestrator): consumes both exports after cache-miss + charge, BEFORE Phase B parseStyleSpecSafe
  - Future v2.14 per-slide style mapping: same palette primitives reusable

# Tech tracking
tech-stack:
  added: []  # node-vibrant@^4.0.4 already in package.json from v2.9
  patterns:
    - server-only module via /node subpath import (bundlers fail on accidental client import)
    - lex-tiebreaker on every sort key for full determinism (no Map-iteration-order leaks)
    - graceful-fallback contract (never throws; always returns ≥1 valid hex)

key-files:
  created:
    - src/lib/ai/palette-extraction.ts (213 lines)
    - src/lib/ai/__tests__/palette-extraction.test.ts (352 lines)
  modified: []

key-decisions:
  - "Followed plan exactly: dominant-color voting (per CONTEXT.md Discretion: 'more interpretable than weighted average')"
  - "Lex tiebreaker on every sort key — covers both dominant voting AND per-hex frequency sort, so output is byte-identical regardless of input ORDER (added an order-independence sub-test under Test 7 for regression coverage)"
  - "REAL node-vibrant calls in tests (not mocked) — the determinism guarantee IS the test; mocking would defeat its purpose (per plan instruction)"
  - "FALLBACK_NEUTRAL_HEX = #808080 (per plan); brand-fallback color #7d6161 used by src/lib/photo-treatment/palette.ts is a v2.9 NamedPalette concern, intentionally separate"

patterns-established:
  - "Server-only AI primitives: /node subpath import + SERVER-ONLY header comment (mirrors src/lib/photo-treatment/palette.ts pattern)"
  - "Source-grep gates inside vitest: read source file via node:fs and assert on import patterns (catches refactor regressions automatically)"
  - "Hex normalization at the trust boundary: every Vibrant hex passes normalizeHex() before reaching ExtractedPalette (T-75-03-01 mitigation)"

requirements-completed: [EXTRACT-04]

# Metrics
duration: ~12min
completed: 2026-05-10
---

# Phase 75 Plan 03: Deterministic Palette Extraction Summary

**node-vibrant wrapper + multi-image dominant-color voting merge — the load-bearing determinism layer for v2.13 vision extraction (D-07 / EXTRACT-04: Gemini is NEVER involved in palette).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-10T16:04:00Z (approx)
- **Completed:** 2026-05-10T16:16:00Z (approx)
- **Tasks:** 1 (TDD: RED + GREEN, no REFACTOR needed)
- **Files modified:** 2 created, 0 modified

## Accomplishments

- **`extractPaletteFromBytes(bytes: Buffer): Promise<ExtractedPalette>`** — pure / deterministic node-vibrant wrapper. Same Buffer → deeply equal output (asserted by Test 1, the load-bearing D-07 gate). Returns 1-6 unique uppercase 6-digit hex strings + dominant color (highest-population swatch).
- **`mergePalettes(palettes[]): ExtractedPalette`** — N-palette merge via dominant-color voting (per CONTEXT.md Discretion). Tiebreaker: lexicographically-lower hex wins. Order-independent: shuffling the input palette array does not change output.
- **Graceful fallbacks everywhere:** Vibrant returns no swatches → `FALLBACK_NEUTRAL_HEX` (`#808080`). Empty merge input → same fallback. Vibrant decode error → caught, logged, fallback. Never throws.
- **Server-only enforcement:** `import { Vibrant } from 'node-vibrant/node'` (the /node subpath). Bare `'node-vibrant'` resolves to a throw-on-import stub per package.json `exports`, so accidental client bundling fails at build time (T-75-03-04 mitigation).
- **Hex canonicalization at the trust boundary:** `normalizeHex()` strict-canonicalizes every hex from Vibrant (uppercase, leading `#`, exactly 6 digits, padded if short, expanded if 3-digit). Test 12 asserts `/^#[0-9A-Fa-f]{6}$/` invariant on real output (T-75-03-01 mitigation).

## Task Commits

1. **Task 1 RED — failing tests** — `35f35ac` (test)
2. **Task 1 GREEN — implementation** — `4477cb3` (feat)

(No REFACTOR commit: implementation is small, single-responsibility, and matched the plan's pseudocode closely. No cleanup opportunity surfaced.)

**Plan metadata:** _to be added by final SUMMARY commit below._

## Files Created/Modified

- **`src/lib/ai/palette-extraction.ts`** (213 lines) — Module exports: `PALETTE_TARGET_SIZE`, `FALLBACK_NEUTRAL_HEX`, `ExtractedPalette` (interface), `extractPaletteFromBytes`, `mergePalettes`. Header comment names Phase 75, EXTRACT-04, D-07, Discretion, PITFALLS Pitfall 2b, and the SERVER-ONLY warning per the plan.
- **`src/lib/ai/__tests__/palette-extraction.test.ts`** (352 lines) — 13 tests across 12 describe groups (Test 7 has 2 sub-tests: original tiebreaker + an extra order-independence regression). Real (non-mocked) node-vibrant calls on tiny in-memory sharp images. Source-grep gates for `node-vibrant/node` subpath + zero `@google/genai` references.

## Verification Evidence

```
Test Files  1 passed (1)
     Tests  13 passed (13)
   Duration ~660ms (entire suite, including real Vibrant decoding)
```

**All gates pass:**
- Subpath import gate: `from 'node-vibrant/node'` present at line 33
- No-bare-import gate: `grep -cE "from 'node-vibrant'\$|from 'node-vibrant';" src/lib/ai/palette-extraction.ts` → `0`
- No-Gemini gate: `grep -cE "@google/genai|GoogleGenAI" src/lib/ai/palette-extraction.ts` → `0`
- Determinism test present: 4 mentions of "deterministic" / "same bytes" in test file
- Required exports: `PALETTE_TARGET_SIZE`, `FALLBACK_NEUTRAL_HEX`, `ExtractedPalette`, `extractPaletteFromBytes`, `mergePalettes` (all `^export`)
- `tsc -p tsconfig.json` → ZERO `palette-extraction` errors (pre-existing test-mock errors elsewhere in the repo are out-of-scope per Rule "SCOPE BOUNDARY")
- `eslint` → clean on both new files

**Determinism evidence (load-bearing per D-07):**

> Test 1 — `extractPaletteFromBytes — determinism (D-07 load-bearing) > returns deeply equal output when called twice with the same bytes` — PASSED in 19 ms.

Two consecutive calls on the same 64×64 quadrant Buffer produced byte-identical `ExtractedPalette` objects. This is the regression gate for the load-bearing determinism guarantee.

## Decisions Made

Followed plan as specified. Two minor execution details worth noting for downstream consumers:

1. **Order-independence sub-test added under Test 7** — the plan specified determinism across two CALLS on the same input; I added a second sub-test asserting determinism across two DIFFERENT input ORDERS (reversing the input array). This is a stricter form of the same guarantee and protects against accidental Map-iteration-order regressions if the merge algorithm is later refactored.
2. **REFACTOR commit skipped** — TDD allows skipping REFACTOR if no cleanup opportunity surfaces. The implementation matched the plan's pseudocode 1:1, so no rewrite was warranted.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Cross-references for Plan 75-01 (orchestrator)

This module is the input to the Plan 75-01 orchestrator's "merge palette into Gemini's raw output before parseStyleSpecSafe runs" step. Three handoff notes:

1. **Field-name translation:** `ExtractedPalette` returns `{ hex: string[], dominant: string }` — a PRE-merge shape. The StyleSpec palette field is `StyleSpecPalette = { mode, primary, secondary?, accent? }` (see `src/lib/types/style-spec.ts` lines 55-63). The orchestrator must translate: `dominant` → `primary`, `hex[1]` → `secondary` (if present), `hex[2]` → `accent` (if present). The `mode` field stays Gemini's call (categorical inference per D-07: gradient vs duotone vs solid vs photo is a categorical role decision, not a hex-extraction one).
2. **Call site:** AFTER cache-miss + charge, BEFORE Phase B `parseStyleSpecSafe`. Orchestrator pseudocode:
   ```typescript
   const palettes = await Promise.all(
     references.map((ref) => extractPaletteFromBytes(ref.bytes))
   )
   const merged = mergePalettes(palettes)
   const rawWithPalette = { ...rawFromGemini, palette: { ...rawFromGemini.palette, primary: merged.dominant, secondary: merged.hex[1], accent: merged.hex[2] } }
   const safe = parseStyleSpecSafe(rawWithPalette)
   ```
3. **Performance:** node-vibrant on a ≤1024×1024 JPEG@85 (Phase 73 prep output) completes in ~50ms server-side per research/STACK.md. For an 8-reference batch (UI cap): ~400ms total via `Promise.all`. Well under the orchestrator's 10s budget — palette extraction is NOT the latency hot-path.

## Next Phase Readiness

- **Plan 75-01 (extract-style-spec orchestrator):** Both exports (`extractPaletteFromBytes`, `mergePalettes`) and all type/constant exports are ready to import from `@/lib/ai/palette-extraction`. The handoff notes above describe the exact merge into the StyleSpec palette field.
- **Sibling Plan 75-02 (refusal-pre-pass):** Already landed (commit `5467956`). Disjoint files; no integration concerns.
- **No blockers.**

## Self-Check: PASSED

- ✅ `src/lib/ai/palette-extraction.ts` — exists (213 lines)
- ✅ `src/lib/ai/__tests__/palette-extraction.test.ts` — exists (352 lines)
- ✅ Commit `35f35ac` (test RED) — exists in git log
- ✅ Commit `4477cb3` (feat GREEN) — exists in git log
- ✅ All 13 tests GREEN
- ✅ All verification gates pass

---
*Phase: 75-vision-extraction-two-phase-architecture-safety-config*
*Completed: 2026-05-10*
