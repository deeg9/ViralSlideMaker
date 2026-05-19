---
phase: 75-vision-extraction-two-phase-architecture-safety-config
plan: 02
subsystem: ai/safety
tags: [vision, refusal-pre-pass, gemini, safety-config, graceful-degradation, tdd]
requirements_completed: [EXTRACT-05, EXTRACT-06]
dependency_graph:
  requires:
    - "src/lib/preprocessing/style-reference-prep.ts (PreparedReference type)"
    - "@google/genai (^1.46.0; GoogleGenAI client + Type/HarmCategory/HarmBlockThreshold enums)"
  provides:
    - "runRefusalPrePass(prepared, opts?): Promise<RefusalResult> — second Gemini Vision call, graceful-degradation contract"
    - "RefusalFlags type (LOCKED contract Plan 75-01 imports + Phase 76 UI consumes)"
    - "RefusalResult type (LOCKED contract Plan 75-01 imports)"
    - "REFUSAL_TIMEOUT_MS, REFUSAL_RESPONSE_SCHEMA, REFUSAL_GEMINI_MODEL, REFUSAL_SAFETY_SETTINGS exports"
  affects:
    - "Plan 75-01 (Wave 2 orchestrator) — runs runRefusalPrePass in Promise.all parallel with main extraction"
    - "Phase 76 spec-preview UI — surfaces RefusalFlags as 'Inspired by'-framed warnings + confirm-and-continue control (PREVIEW-10)"
tech_stack:
  added: []
  patterns:
    - "Module-level GoogleGenAI client (mirror match-photos-to-slides line 6)"
    - "Promise.race(geminiPromise, timeoutPromise) for 10s budget (mirror match-photos-to-slides lines 196-199)"
    - "Closed-enum boolean responseSchema (responseMimeType: 'application/json' + responseSchema)"
    - "Graceful-degradation contract — function NEVER throws; every error path returns errored:true with all-false placeholders preserving input array length"
    - "Single round-trip per batch (N references in one inlineData array, not N separate calls)"
key_files:
  created:
    - "src/lib/ai/refusal-pre-pass.ts (355 lines)"
    - "src/lib/ai/__tests__/refusal-pre-pass.test.ts (406 lines, 17 tests GREEN)"
  modified: []
decisions:
  - "Validation strategy: fail-closed-on-validation. If ANY entry in the response is malformed (missing field, wrong type, length mismatch), ALL flags fall back to all-false placeholders. The orchestrator never sees partial flags — keeps the contract simple and the threat-model T-75-02-01 mitigation tight."
  - "Empty input → no Gemini call. prepareForVision (Phase 73) is the gate that produces an empty array; we don't bill a refusal call for that."
  - "Safety block on the REFUSAL call → graceful degrade (NOT a hard error). Differs from Plan 75-01's main extraction handling per CONTEXT.md D-Discretion: refusal is a soft check, refusal failure NEVER blocks the user."
  - "Module-level GoogleGenAI client init mirrors match-photos-to-slides.ts line 6. opts.ai injection surface exists ONLY for tests; production callers omit it."
metrics:
  duration: "~30 minutes"
  completed_date: "2026-05-10"
  tasks_completed: 1
  tests_passing: 17
  files_changed: 2
  lines_added: 761
---

# Phase 75 Plan 02: Refusal Pre-Pass Summary

Standalone Gemini 2.5 Flash Vision call classifying each preprocessed reference for `{contains_logo, contains_face, contains_watermark}` via closed-enum boolean responseSchema, with a load-bearing graceful-degradation contract — refusal failure NEVER blocks the user (CONTEXT.md D-Discretion + EXTRACT-05).

## What Was Built

Single module + tests:

- **`src/lib/ai/refusal-pre-pass.ts`** (355 lines) — exports `runRefusalPrePass`, `RefusalFlags`, `RefusalResult`, `REFUSAL_TIMEOUT_MS`, `REFUSAL_RESPONSE_SCHEMA`, plus the constants `REFUSAL_GEMINI_MODEL` and `REFUSAL_SAFETY_SETTINGS`.
- **`src/lib/ai/__tests__/refusal-pre-pass.test.ts`** (406 lines, 17 tests GREEN) — mocks `@google/genai`, no real Gemini calls. Coverage: happy path single + multi (with INDEX ALIGNMENT), graceful degradation across 6 failure modes (network throw, timeout, safety block, malformed JSON, wrong-length array, non-boolean fields), efficiency invariants (single call, empty-input no-op), exports surface, and the never-throws contract.

## Cross-Reference: Locked Contract for Plan 75-01

Plan 75-01 (Wave 2 orchestrator) imports the following exact shapes from this module — the contract is LOCKED:

```typescript
export interface RefusalFlags {
  contains_logo: boolean
  contains_face: boolean
  contains_watermark: boolean
}

export interface RefusalResult {
  flags_per_reference: RefusalFlags[] // index-aligned with input; length always equals input.length
  errored: boolean                     // true on ANY failure (timeout, network, safety, parse, validation)
  duration_ms: number                  // for telemetry capture in Plan 75-01
}

export async function runRefusalPrePass(
  prepared: PreparedReference[],
  opts?: { ai?: GoogleGenAI; timeoutMs?: number },
): Promise<RefusalResult>
```

The orchestrator pattern (Plan 75-01) is `Promise.all([mainExtraction, runRefusalPrePass(prepared)])` so combined wall time is `max(main, refusal)`, not their sum (CONTEXT.md Discretion). When `errored: true`, the orchestrator treats it as "no flags surfaced" per D-Discretion — the Phase 76 UI shows extraction results without refusal warnings (and may render a small "refusal check unavailable" indicator).

## Phase 76 Handoff

When `errored: false` AND any flag in `flags_per_reference[i]` is `true`, Phase 76's spec-preview UI MUST:

1. Render the flag(s) on the corresponding reference thumbnail with the **"Inspired by"** framing copy (per EXTRACT-05 — positive flags are warnings, NOT auto-rejections).
2. Surface a **confirm-and-continue** control (PREVIEW-10) so the user explicitly acknowledges the flag before proceeding.
3. Never block extraction or downstream emit on the basis of a positive flag — the user gets the choice (CONTEXT.md D-05 + EXTRACT-05).

When `errored: true`, the Phase 76 UI MUST NOT render any refusal warnings (placeholders are all-false). Optionally render a passive "refusal check unavailable — proceeding with no flags" indicator for transparency.

## Cost Note

Adds ~$0.001 per image extra per CONTEXT.md (Gemini 2.5 Flash @ $0.30/1M input + $2.50/1M output, with the closed-enum boolean responseSchema keeping output tokens minimal).

**Single-round-trip-per-batch invariant** keeps cost bounded: a session with N=8 references is exactly ONE refusal call, not 8. Verified by Test 10 (input has 5 references → `mockGenerateContent` called exactly once).

## Graceful-Degradation Evidence (the never-throws contract)

The contract: `runRefusalPrePass` MUST NEVER throw. Every failure mode returns a `RefusalResult` with `errored: true` and all-false placeholders preserving input array length. Verified by these tests:

| Test | Failure mode                              | Assertion that the function did not throw                            |
| ---- | ----------------------------------------- | -------------------------------------------------------------------- |
| 3    | Gemini throws network error               | `try/catch` wrapper around `await runRefusalPrePass(...)` — `threw === false` |
| 4    | Gemini hangs → 10s Promise.race timeout   | Fake timers + advance past `REFUSAL_TIMEOUT_MS + 1` — `threw === false` |
| 5    | Safety block on the refusal call          | `response.promptFeedback.blockReason: 'SAFETY'` — returns `errored: true` (not throws) |
| 6    | Malformed JSON                            | `text: 'not json'` — `JSON.parse` swallowed inside try/catch          |
| 7    | Wrong-length array (length mismatch)      | Input N=3, response references.length=1 — placeholders preserve input length 3 |
| 8    | Non-boolean fields (type mismatch)        | `contains_logo: 'yes'` etc. — strict per-entry validator falls back  |
| 12   | Synchronous explosion inside generateContent | Mock throws synchronously — outer catch returns RefusalResult        |

All seven failure-path tests assert the function returns the `RefusalResult` shape — no test had to handle a thrown exception. T-75-02-04 mitigation holds across the full failure surface.

## Verification Gates (all passing)

```
Type.STRING in source                                      0   ✓ (closed-enum invariant)
GEMINI_API_KEY in test file                                0   ✓ (no-real-Gemini gate)
HARM_CATEGORY_(HARASSMENT|HATE_SPEECH|...) in source       4   ✓ (≥4 required)
BLOCK_ONLY_HIGH in source                                  5   ✓ (4 in safety settings + 1 import; ≥4 required)
ai.models.generateContent invocations in source            1   ✓ (single round-trip per batch)
Required exports                                           8/8 ✓ (runRefusalPrePass, RefusalFlags, RefusalResult,
                                                                  RefusalPrePassOptions, REFUSAL_TIMEOUT_MS,
                                                                  REFUSAL_GEMINI_MODEL, REFUSAL_SAFETY_SETTINGS,
                                                                  REFUSAL_RESPONSE_SCHEMA)
Tests passing                                              17/17 ✓
tsc errors on src/lib/ai/refusal-pre-pass.ts               0   ✓ (pre-existing zod/google-auth lib errors out of scope)
```

## TDD Gate Compliance

| Gate     | Commit                                    |
| -------- | ----------------------------------------- |
| RED      | `2efdf10 test(75-02): add failing tests for refusal pre-pass (RED)` — verified import error before implementation existed |
| GREEN    | `5467956 feat(75-02): implement runRefusalPrePass — refusal pre-pass second Gemini Vision call` — 17/17 tests passing |
| REFACTOR | (skipped — implementation already clean against the plan's blueprint)        |

## Deviations from Plan

None — plan executed exactly as written. The plan's blueprint included a complete reference implementation in the `<action>` block; the executed code mirrors it with one minor refinement: the `JSON.parse` is wrapped in its own try/catch (not just the outer try) so that the malformed-JSON path returns the placeholder shape via the explicit length-mismatch branch, identical externally. No threat-model adjustments needed; all six T-75-02-* mitigations are wired exactly as the plan called out.

The plan called for "12 behavior tests" but the executor wrote 17 `it` blocks — the additional 5 are gate-style assertions on exports, schema shape, and integration call args (model name, safetySettings shape, parts array shape). All extra tests are GREEN and documented in the test file header. This is more coverage, not less.

## Authentication Gates

None — the entire test surface mocks `@google/genai`, so no real Gemini API key was needed at test time. Production callers will use the module-level `defaultAi` client which reads `process.env.GEMINI_API_KEY` at runtime (mirror of `match-photos-to-slides.ts` line 6).

## Known Stubs

None. This module is a complete vertical slice — runtime behavior is fully wired and tests cover every contract surface Plan 75-01 will consume.

## Threat Flags

None — all threat-model surfaces in the plan's `<threat_model>` (T-75-02-01 through T-75-02-06) are addressed in the implementation per the plan's blueprint. No new threat surfaces were introduced.

## Self-Check: PASSED

- `src/lib/ai/refusal-pre-pass.ts` — FOUND (355 lines)
- `src/lib/ai/__tests__/refusal-pre-pass.test.ts` — FOUND (406 lines)
- Commit `2efdf10` (RED) — FOUND in `git log --oneline`
- Commit `5467956` (GREEN) — FOUND in `git log --oneline`
- All 17 tests GREEN at the time of writing this summary.
