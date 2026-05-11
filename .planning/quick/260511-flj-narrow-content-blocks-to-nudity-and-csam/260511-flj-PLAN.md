---
quick_task: narrow-content-blocks-to-nudity-and-csam
quick_id: 260511-flj
type: execute
wave: 1
depends_on: []
files_modified:
  # Task 1 (gate + module deletion)
  - src/components/style-from-reference/refusal-warning.tsx              # DELETE
  - src/components/style-from-reference/__tests__/refusal-warning.test.tsx # DELETE
  - src/lib/ai/refusal-pre-pass.ts                                       # DELETE
  - src/lib/ai/__tests__/refusal-pre-pass.test.ts                        # DELETE
  - src/components/style-from-reference/spec-preview-panel.tsx
  - src/components/style-from-reference/style-from-reference-shell.tsx
  - src/components/style-from-reference/state-machine.ts
  - src/lib/ai/extract-style-spec.ts
  - src/lib/ai/extract-style-spec.types.ts
  - src/components/style-from-reference/__tests__/state-machine.test.ts
  - src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx
  - src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx
  - src/components/style-from-reference/__tests__/recovery-integration.test.tsx
  - src/lib/ai/__tests__/extract-style-spec.test.ts
  - src/lib/ai/__tests__/extract-style-spec.types.test.ts
  - src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts
  - src/app/(dashboard)/style-from-reference/__tests__/regenerate-action.test.ts
  # Task 2 (T&C + version bump + safety-block hard-block test)
  - src/app/terms/page.tsx
  - src/lib/legal/tos-version.ts
  - src/components/style-from-reference/__tests__/safety-block-recovery.test.tsx
autonomous: true
supersedes:
  - phase: 75
    decision_id: D-05
    reason: "Refusal pre-pass module (second Gemini call returning contains_logo/face/watermark) is no longer load-bearing — the UI gate it fed is being removed. Liability shifted to user via Phase 79 LEGAL-05 T&C update + version bump in this task."
  - phase: 76
    decision_id: PREVIEW-10
    reason: "RefusalWarning Continue gate (requiring user click before Generate enables on flagged refs) is removed. Generate now enables as soon as one aspect is checked. Reverses the gate but PRESERVES the underlying legal posture by strengthening the T&C clickwrap copy + bumping STYLE_FROM_REFERENCE_TOS_VERSION to force re-acceptance."

must_haves:
  truths:
    - "User uploads a reference with a face/logo/watermark and Generate enables as soon as one aspect is checked (no Continue click required)."
    - "User uploads a reference with nudity / sexually-explicit content and the extract returns terminal 'This reference can't be used' surface with NO override CTA."
    - "Every existing user must re-accept the ToS on their next style-from-reference upload (STYLE_FROM_REFERENCE_TOS_VERSION changed; LEGAL-01 clickwrap re-fires because hasUserAcceptedCurrentTos() reads the new literal)."
    - "/terms page renders a paragraph that explicitly says the user assumes liability for IP/right-of-publicity/trademark/defamation claims arising from uploaded references."
    - "Zero references to runRefusalPrePass, RefusalFlags, refusalFlags, refusalAcknowledged, CONFIRM_REFUSAL_WARNING, or RefusalWarning remain in src/."
    - "No new vendor / no client-side nudity detector was introduced; only Gemini HARM_CATEGORY_SEXUALLY_EXPLICIT threshold was tightened."
  artifacts:
    - path: src/components/style-from-reference/refusal-warning.tsx
      provides: "MUST NOT EXIST after Task 1 (deleted)"
    - path: src/lib/ai/refusal-pre-pass.ts
      provides: "MUST NOT EXIST after Task 1 (deleted)"
    - path: src/components/style-from-reference/spec-preview-panel.tsx
      provides: "Generate disabled ONLY when no aspect is checked (single-predicate generateDisabled)"
      forbids: "refusalAcknowledgedOrAbsent, refusalWarningSlot, refusalFlags"
    - path: src/components/style-from-reference/state-machine.ts
      provides: "SpecPreviewState without refusalFlags or refusalAcknowledged; SpecPreviewAction without CONFIRM_REFUSAL_WARNING; EXTRACT_SUCCESS payload no longer carries refusalFlags"
    - path: src/lib/ai/extract-style-spec.ts
      provides: "Phase A vision call uses HARM_CATEGORY_SEXUALLY_EXPLICIT: BLOCK_LOW_AND_ABOVE; orchestrator no longer calls runRefusalPrePass; ExtractSuccess no longer carries refusal_flags"
    - path: src/lib/legal/tos-version.ts
      provides: "STYLE_FROM_REFERENCE_TOS_VERSION = '2026-05-11-v2' (or planner-chosen date+suffix that compiles against the existing format test)"
    - path: src/app/terms/page.tsx
      provides: "Section 7b 'Assumption of Liability for Reference Content' H2 with IP/right-of-publicity/trademark/defamation warrant + liability-assumption clauses (Canva AI Product Terms pattern)"
  key_links:
    - from: src/lib/ai/extract-style-spec.ts
      to: '@google/genai HarmBlockThreshold.BLOCK_LOW_AND_ABOVE'
      via: "VISION_SAFETY_SETTINGS HARM_CATEGORY_SEXUALLY_EXPLICIT entry"
      pattern: "HARM_CATEGORY_SEXUALLY_EXPLICIT.*BLOCK_LOW_AND_ABOVE"
    - from: src/lib/legal/tos-version.ts
      to: src/app/terms/page.tsx (rendered ver literal) AND src/lib/legal/audit-log.ts (hasUserAcceptedCurrentTos)
      via: "STYLE_FROM_REFERENCE_TOS_VERSION import — bump forces clickwrap re-fire"
      pattern: "STYLE_FROM_REFERENCE_TOS_VERSION = '20"
    - from: src/components/style-from-reference/spec-preview-panel.tsx
      to: state-machine.ts (SpecPreviewState shape)
      via: "single-predicate generateDisabled = !hasAtLeastOneAspect(state)"
      pattern: "generateDisabled = !hasAtLeastOneAspect"
---

<objective>
Reverse the Phase 76 PREVIEW-10 RefusalWarning Continue gate AND delete the Phase 75 D-05 refusal pre-pass module entirely. Shift legal liability for IP / right-of-publicity / trademark / defamation claims onto the user via an extended Phase 79 LEGAL-05 T&C section and a STYLE_FROM_REFERENCE_TOS_VERSION bump that forces every existing user to re-accept on their next upload. Tighten the Gemini HARM_CATEGORY_SEXUALLY_EXPLICIT threshold from BLOCK_ONLY_HIGH to BLOCK_LOW_AND_ABOVE so nudity/CSAM remain hard-blocked at the vendor boundary.

Purpose: The Continue-gate flow was friction without meaningful legal cover (Gemini doesn't reliably distinguish "use of a face that's owned by Getty" from "use of any face"); a per-user T&C re-acceptance with explicit assumption-of-liability copy gives stronger contractual cover at lower UX cost AND saves the ~$0.001/image refusal pre-pass call.

Output: One coherent deletion-pass + one T&C-strengthening task. Two atomic commits. Lint:gates still green (inspired-by-framing.sh continues to pass). Existing typecheck baseline preserved. All previously-green tests either still green or replaced with new assertions reflecting the new contract.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260511-flj-narrow-content-blocks-to-nudity-and-csam/260511-flj-CONTEXT.md
@.planning/quick/260511-generate-disabled-diagnosis/SUMMARY.md
@.planning/phases/79-legal-hardening-tos-clickwrap-audit-log-copy-review/79-CONTEXT.md
@src/components/style-from-reference/spec-preview-panel.tsx
@src/components/style-from-reference/state-machine.ts
@src/components/style-from-reference/style-from-reference-shell.tsx
@src/components/style-from-reference/refusal-warning.tsx
@src/lib/ai/refusal-pre-pass.ts
@src/lib/ai/extract-style-spec.ts
@src/lib/ai/extract-style-spec.types.ts
@src/app/terms/page.tsx
@src/lib/legal/tos-version.ts
@src/components/style-from-reference/tos-clickwrap-modal.tsx
@src/components/style-from-reference/safety-block-recovery.tsx
@scripts/grep-gates/inspired-by-framing.sh

<interfaces>
<!-- The contracts that change in Task 1. Executor uses these directly — no further codebase exploration needed for the deletion pass. -->

Current (DELETE these shapes):
```typescript
// src/lib/ai/refusal-pre-pass.ts (entire file deleted)
export interface RefusalFlags { contains_logo: boolean; contains_face: boolean; contains_watermark: boolean }
export interface RefusalResult { flags_per_reference: RefusalFlags[]; errored: boolean; duration_ms: number }
export async function runRefusalPrePass(prepared: PreparedReference[], opts?: RefusalPrePassOptions): Promise<RefusalResult>

// src/lib/ai/extract-style-spec.types.ts — drop refusal_flags from ExtractSuccess
export interface ExtractSuccess {
  ok: true
  spec: StyleSpec
  refusal_flags: RefusalFlags[]   // <— REMOVE
  cached: boolean
  telemetry: ExtractTelemetry
}

// src/components/style-from-reference/state-machine.ts — drop these
interface SpecPreviewState {
  ...
  refusalFlags: RefusalFlags[]          // <— REMOVE
  refusalAcknowledged: boolean          // <— REMOVE
  ...
}
type SpecPreviewAction =
  ...
  | { type: 'EXTRACT_SUCCESS'; spec: StyleSpec; refusalFlags: RefusalFlags[]; telemetry: ExtractTelemetry } // <— drop refusalFlags from payload
  | { type: 'CONFIRM_REFUSAL_WARNING' } // <— REMOVE entirely
```

Target shapes (KEEP after Task 1):
```typescript
// src/lib/ai/extract-style-spec.types.ts
export interface ExtractSuccess {
  ok: true
  spec: StyleSpec
  cached: boolean
  telemetry: ExtractTelemetry
}

// src/components/style-from-reference/state-machine.ts
interface SpecPreviewState { /* no refusalFlags, no refusalAcknowledged */ ... }
type SpecPreviewAction =
  | ... (everything EXCEPT CONFIRM_REFUSAL_WARNING)
  | { type: 'EXTRACT_SUCCESS'; spec: StyleSpec; telemetry: ExtractTelemetry }  // refusalFlags removed from payload

// src/components/style-from-reference/spec-preview-panel.tsx
// generateDisabled = !hasAtLeastOneAspect(state)   // single predicate
// title/aria hint: ONLY the "Check at least one aspect" branch survives
// refusalWarningSlot prop REMOVED from SpecPreviewPanelProps

// src/lib/ai/extract-style-spec.ts — VISION_SAFETY_SETTINGS
export const VISION_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE }, // TIGHTENED
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
]

// extractStyleSpec orchestrator Step 5 — drop parallel refusal call:
// const rawGemini = await withSingleRetry(() => callGeminiVisionWithTimeout(prepared))
// visionCallsCount = 1   // <— was 2
// On success, return WITHOUT refusal_flags:
// return { ok: true, spec: parseResult.spec, cached: false, telemetry: {...} }
// On cache hit, same shape: drop refusal_flags: [] from the return.
```

The Task 2 T&C section anchor (Section 7a "Style-from-Reference Generation" already exists at src/app/terms/page.tsx:115-134). Add Section 7b directly AFTER it.

The audit-log helper `hasUserAcceptedCurrentTos()` (referenced in src/lib/legal/tos-version.ts:18 commentary) reads STYLE_FROM_REFERENCE_TOS_VERSION; bumping the constant is the entire mechanism by which existing users are forced to re-accept. No new wiring needed.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Delete refusal pre-pass + RefusalWarning gate; tighten Gemini sexually-explicit threshold; update affected tests</name>
  <files>
    src/components/style-from-reference/refusal-warning.tsx (DELETE),
    src/components/style-from-reference/__tests__/refusal-warning.test.tsx (DELETE),
    src/lib/ai/refusal-pre-pass.ts (DELETE),
    src/lib/ai/__tests__/refusal-pre-pass.test.ts (DELETE),
    src/components/style-from-reference/spec-preview-panel.tsx,
    src/components/style-from-reference/style-from-reference-shell.tsx,
    src/components/style-from-reference/state-machine.ts,
    src/lib/ai/extract-style-spec.ts,
    src/lib/ai/extract-style-spec.types.ts,
    src/components/style-from-reference/__tests__/state-machine.test.ts,
    src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx,
    src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx,
    src/components/style-from-reference/__tests__/recovery-integration.test.tsx,
    src/lib/ai/__tests__/extract-style-spec.test.ts,
    src/lib/ai/__tests__/extract-style-spec.types.test.ts,
    src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts,
    src/app/(dashboard)/style-from-reference/__tests__/regenerate-action.test.ts
  </files>
  <behavior>
    Reducer / state-machine:
    - `SpecPreviewState` no longer has `refusalFlags` or `refusalAcknowledged` fields
    - `SpecPreviewAction` no longer has `CONFIRM_REFUSAL_WARNING` variant
    - `EXTRACT_SUCCESS` payload no longer carries `refusalFlags` (only `spec` + `telemetry`)
    - `initialSpecPreviewState` no longer initializes either removed field
    - Existing state-machine tests for Test 4 (EXTRACT_SUCCESS), Test 13 (CONFIRM_REFUSAL_WARNING), and any UPLOAD_RESET assertion that references refusalFlags/refusalAcknowledged are either DELETED (Test 13 — entire CONFIRM_REFUSAL_WARNING case is gone) or rewritten (Test 4 — assert spec set without refusalFlags; UPLOAD_RESET — drop those assertions)
    - All other reducer behaviors (PREVIEW-01 invariant, retry budget, brand-kit availability, error kinds, aspects toggles) UNCHANGED

    UI panel:
    - `generateDisabled` reduces to `!hasAtLeastOneAspect(state)` (single predicate)
    - `refusalAcknowledgedOrAbsent` helper is removed
    - `refusalWarningSlot` prop is removed from `SpecPreviewPanelProps`; the `{props.refusalWarningSlot ?? null}` render line is removed
    - `title` attr and inline hint copy: ONLY the "Check at least one aspect…" branch survives; ternaries collapse to that single string
    - Existing affordance test cases (aspect-gate path) remain GREEN; refusal-gate path test cases are removed

    Shell:
    - `<RefusalWarning>` import deleted
    - `<StickyReferenceStrip slotPerReference={...}>` slot callback returns null unconditionally OR the `slotPerReference` prop is omitted entirely (preferred: omit, so unused refusalFlags state cannot be reintroduced silently)
    - `dispatchExtractResult` no longer reads `result.refusal_flags`; the `EXTRACT_SUCCESS` dispatch payload drops `refusalFlags`

    Orchestrator:
    - `src/lib/ai/extract-style-spec.ts` Step 5 no longer wraps in `Promise.all([runRefusalPrePass(...), withSingleRetry(...)])` — it's a bare `await withSingleRetry(() => callGeminiVisionWithTimeout(prepared))`
    - `visionCallsCount` is set to 1 on the non-cached success path (was 2)
    - The `import { runRefusalPrePass } from './refusal-pre-pass'` line is removed
    - On success the return shape drops `refusal_flags` (cache-hit + non-cached branches both)
    - `VISION_SAFETY_SETTINGS[2].threshold` changes from `BLOCK_ONLY_HIGH` to `BLOCK_LOW_AND_ABOVE` for `HARM_CATEGORY_SEXUALLY_EXPLICIT`
    - Other three categories (HARASSMENT, HATE_SPEECH, DANGEROUS_CONTENT) UNCHANGED at BLOCK_ONLY_HIGH

    Types module:
    - `src/lib/ai/extract-style-spec.types.ts` drops `refusal_flags` from `ExtractSuccess`; drops `import type { RefusalFlags } from './refusal-pre-pass'` and the `export type { RefusalFlags }` re-export
    - `vision_calls_count` JSDoc comment updated to say "1 on a non-cached extraction" (was 2)

    Test files:
    - `extract-style-spec.test.ts`: Test 12 ("refusal returns errored:true → orchestrator still returns ok:true") is DELETED; parallel-dispatch assertions (refusalStarted / refusalDelayMs / Math.abs(refusalStarted - geminiStarted)) are DELETED; `vi.mock('../refusal-pre-pass', ...)` block DELETED; all `result.refusal_flags` assertions DELETED; `visionCallsCount` expectations updated from 2 → 1
    - `extract-style-spec.types.test.ts`: `RefusalFlags` import + `refusal_flags` field assertion DELETED from Type test 3
    - `actions.test.ts` + `regenerate-action.test.ts` in src/app/(dashboard)/style-from-reference/__tests__/: drop the `refusal_flags: []` field from any `ExtractSuccess`-shaped fixture
    - `state-machine.test.ts`: drop `refusalFlags` / `refusalAcknowledged` from helper fixtures and constants; delete CONFIRM_REFUSAL_WARNING case; rewrite EXTRACT_SUCCESS test to assert spec set without refusalFlags
    - `spec-preview-panel-integration.test.tsx`: drop the `refusal_flags: []` field; if any test asserts `refusalWarningSlot` rendering, delete that assertion
    - `style-from-reference-shell.test.tsx`: delete Test 9 (PREVIEW-10 sticky-strip refusal-warning placement) and Test 10 (PREVIEW-10 Generate gating); delete refusal-warning DOM assertions; drop refusal_flags from any ExtractResult fixture; if Test 5 (source-grep firewall) catalogs CTA-in-preview, it stays green
    - `recovery-integration.test.tsx`: drop `refusal_flags: []` from fixtures

    Hard-block path (preserved + verified by Task 2 test):
    - The `safety_blocked` error branch in extract-style-spec.ts (Step 6) is UNCHANGED — it still detects `rawGemini.promptFeedback?.blockReason` and returns `{ ok: false, error: 'safety_blocked', reason, recovery_suggestion, ... }`. The tightened SEXUALLY_EXPLICIT threshold means more uploads will trigger this path, which is the intended behavior.
  </behavior>
  <action>
    1. **Delete files outright** (use `rm` via Bash for the four files in <files>):
       - src/components/style-from-reference/refusal-warning.tsx
       - src/components/style-from-reference/__tests__/refusal-warning.test.tsx
       - src/lib/ai/refusal-pre-pass.ts
       - src/lib/ai/__tests__/refusal-pre-pass.test.ts

    2. **Edit `src/components/style-from-reference/state-machine.ts`:**
       - Remove the `import type { RefusalFlags } from '@/lib/ai/refusal-pre-pass'` line (the module is gone)
       - Remove `refusalFlags: RefusalFlags[]` and `refusalAcknowledged: boolean` from `SpecPreviewState`
       - Remove `refusalFlags: action.refusalFlags,` and `refusalAcknowledged: false,` from the EXTRACT_SUCCESS reducer case
       - Remove `refusalFlags: RefusalFlags[]` from the `EXTRACT_SUCCESS` action variant
       - Delete the entire `| { type: 'CONFIRM_REFUSAL_WARNING' }` action variant + its reducer case
       - Remove `refusalFlags: [],` and `refusalAcknowledged: false,` from `initialSpecPreviewState`
       - Update the comment header to note PREVIEW-10 is superseded (one-liner: "quick 260511-flj: PREVIEW-10 refusal gate REMOVED — liability shifted to T&C")

    3. **Edit `src/components/style-from-reference/spec-preview-panel.tsx`:**
       - Delete the `refusalAcknowledgedOrAbsent(state)` helper
       - Reduce `generateDisabled` to: `const generateDisabled = !hasAtLeastOneAspect(state)`
       - Remove the `refusalWarningSlot?: ReactNode` prop from `SpecPreviewPanelProps`
       - Delete the `{props.refusalWarningSlot ?? null}` render line
       - Simplify `title` attr: `generateDisabled ? 'Check at least one aspect above (palette, typography, layout, or decorations) before generating.' : undefined`
       - Simplify inline hint copy: `'Check at least one aspect above to enable Generate.'` (drop the ternary)
       - Update the JSDoc header block (Plan 76-03 commentary lines 18-21) to a one-liner pointing at quick 260511-flj

    4. **Edit `src/components/style-from-reference/style-from-reference-shell.tsx`:**
       - Delete `import { RefusalWarning } from './refusal-warning'`
       - In `dispatchExtractResult`, drop `refusalFlags: result.refusal_flags` from the EXTRACT_SUCCESS dispatch payload
       - Remove the `slotPerReference={...}` prop entirely from `<StickyReferenceStrip>` — the strip renders without per-reference slot wiring
       - Update header comments (lines 32-33, 136-138, 194-195) — drop Plan 76-03 RefusalWarning references; note quick 260511-flj supersedes PREVIEW-10

    5. **Edit `src/lib/ai/extract-style-spec.types.ts`:**
       - Delete the `import type { RefusalFlags } from './refusal-pre-pass'` line
       - Delete the `export type { RefusalFlags }` re-export
       - Remove `refusal_flags: RefusalFlags[]` from `ExtractSuccess`
       - Update the JSDoc on `vision_calls_count` to say "1 on a non-cached extraction" (was 2)

    6. **Edit `src/lib/ai/extract-style-spec.ts`:**
       - Delete `import { runRefusalPrePass } from './refusal-pre-pass'`
       - Change `VISION_SAFETY_SETTINGS` entry for `HARM_CATEGORY_SEXUALLY_EXPLICIT` from `BLOCK_ONLY_HIGH` to `BLOCK_LOW_AND_ABOVE`. Inline comment: `// quick 260511-flj: tightened per locked decision — nudity/CSAM is the only hard-block category; logos/faces/watermarks moved to T&C assumption-of-liability.`
       - In `extractStyleSpec`, replace the `Promise.all([runRefusalPrePass(prepared), withSingleRetry(...)])` with a bare `const rawGemini = await withSingleRetry(() => callGeminiVisionWithTimeout(prepared))`
       - Change `visionCallsCount = 2` to `visionCallsCount = 1`
       - Drop `refusal_flags: refusal.flags_per_reference` (and `refusal_flags: []` on the cache-hit branch) from the success return shape
       - Update the file-header JSDoc Step-5 commentary (lines 408-410) to reflect the single call

    7. **Test updates (in this order — each must keep the file compiling):**
       - `src/components/style-from-reference/__tests__/state-machine.test.ts`: drop `RefusalFlags` import, `FLAGS_FACE` / `FLAGS_NONE` constants if unused after gate-removal, the `refusalFlags` + `refusalAcknowledged` fields from helper fixtures and assertions, delete Test 13 (CONFIRM_REFUSAL_WARNING) entirely, rewrite Test 4 to assert spec set without refusalFlags, update UPLOAD_RESET test to drop the cleared-refusal assertions
       - `src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx`: drop `refusal_flags: []` field; delete any refusalWarningSlot assertion
       - `src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx`: delete Test 9 + Test 10 entirely; drop refusal_flags field from all ExtractResult fixtures; if any fixture uses RefusalFlags type, remove
       - `src/components/style-from-reference/__tests__/recovery-integration.test.tsx`: drop `refusal_flags: []` from fixtures
       - `src/lib/ai/__tests__/extract-style-spec.test.ts`: delete the `vi.mock('../refusal-pre-pass', ...)` block; delete Test 12 (refusal errored) entirely; delete parallel-dispatch assertions in the timing test (refusalStarted, refusalDelayMs, Math.abs); change `visionCallsCount` expectations from 2 → 1; drop every `result.refusal_flags` assertion
       - `src/lib/ai/__tests__/extract-style-spec.types.test.ts`: drop RefusalFlags import + the refusal_flags assertion in Type test 3
       - `src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts` + `regenerate-action.test.ts`: drop `refusal_flags: []` from every ExtractSuccess fixture (the field no longer exists on the type)

    NOTE: Do NOT touch tos-version.ts, terms/page.tsx, tos-clickwrap-modal.tsx, or safety-block-recovery.tsx in this task — those belong to Task 2 (cleaner per-commit blast radius + independent revert path).
  </action>
  <verify>
    <automated>
      # Compile + typecheck baseline preserved (project has 17 baseline tsc errors per STATE.md — verify count unchanged):
      cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | tail -5

      # Targeted test suites must pass:
      npx vitest run src/components/style-from-reference/__tests__/state-machine.test.ts src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx src/components/style-from-reference/__tests__/recovery-integration.test.tsx src/lib/ai/__tests__/extract-style-spec.test.ts src/lib/ai/__tests__/extract-style-spec.types.test.ts 'src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts' 'src/app/(dashboard)/style-from-reference/__tests__/regenerate-action.test.ts'

      # Structural zero-references gate (treat header comments separately):
      # 1. Module files must be gone
      test ! -f src/components/style-from-reference/refusal-warning.tsx && test ! -f src/lib/ai/refusal-pre-pass.ts && test ! -f src/components/style-from-reference/__tests__/refusal-warning.test.tsx && test ! -f src/lib/ai/__tests__/refusal-pre-pass.test.ts && echo "OK: 4 files deleted"

      # 2. Zero CODE references to the removed surface in src/ (strip comments — quick 260511-generate-disabled lesson: bare grep -c trips self-invalidating-grep gates because header docs are allowed to mention the supersedes marker):
      grep -rn "runRefusalPrePass\|CONFIRM_REFUSAL_WARNING\|refusalAcknowledged\|refusal_flags\|refusalFlags\|refusalWarningSlot\|RefusalWarning\|RefusalFlags" src/ | grep -v '^[^:]\+:[0-9]\+:[[:space:]]*//' | grep -v '^[^:]\+:[0-9]\+:[[:space:]]*\*' | grep -v 'quick 260511-flj' ; echo "EXIT=$?"
      # Expected EXIT=1 (grep finds nothing) — any non-comment, non-supersedes-marker hit fails the task

      # 3. SEXUALLY_EXPLICIT threshold flipped exactly in extract-style-spec.ts:
      grep -A1 'HARM_CATEGORY_SEXUALLY_EXPLICIT' src/lib/ai/extract-style-spec.ts | grep -c 'BLOCK_LOW_AND_ABOVE'
      # Expected 1 (exactly one match — the VISION_SAFETY_SETTINGS entry)

      # 4. inspired-by-framing.sh still passes (no copy regression):
      bash scripts/grep-gates/inspired-by-framing.sh
    </automated>
  </verify>
  <done>
    - The 4 deleted files no longer exist on disk
    - `npx tsc --noEmit` error count equals the existing 17-baseline (or fewer — never higher)
    - All listed vitest test files pass
    - Zero non-comment-non-supersedes-marker references to the removed surface remain in `src/`
    - `HARM_CATEGORY_SEXUALLY_EXPLICIT` threshold is `BLOCK_LOW_AND_ABOVE` exactly once in `src/lib/ai/extract-style-spec.ts`; the other three categories remain at `BLOCK_ONLY_HIGH`
    - `bash scripts/grep-gates/inspired-by-framing.sh` exits 0
    - Reducer header carries a one-line "quick 260511-flj supersedes Phase 76 PREVIEW-10" marker so future readers know why the gate disappeared
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add Assumption-of-Liability T&C section, bump STYLE_FROM_REFERENCE_TOS_VERSION, add hard-block-no-override regression test</name>
  <files>
    src/app/terms/page.tsx,
    src/lib/legal/tos-version.ts,
    src/components/style-from-reference/__tests__/safety-block-recovery.test.tsx
  </files>
  <behavior>
    T&C page (src/app/terms/page.tsx):
    - A NEW H2 section titled "7b. Assumption of Liability for Reference Content" exists, rendered immediately after the existing Section 7a "Style-from-Reference Generation"
    - Section 7b contains paragraphs covering at minimum:
      1. A representation-and-warranty that the user has the rights (or a defensible fair-use position) to upload each reference image
      2. An explicit assumption of liability for IP-infringement claims, trademark-dilution claims, right-of-publicity claims, and defamation claims arising from generated output derived from the user's references
      3. A statement that ViralSlideMaker is not a substitute for legal counsel and the user accepts the risk
      4. A reference to the DMCA takedown process for third-party complaint resolution (link/path consistent with the existing Section 7a wording)
    - Copy passes the LEGAL-03 inspired-by-framing grep gate (no `exactly like / clone / copy this / duplicate the / stolen from / ripped from` tokens — use synonyms like "derive style cues from", "inspired by", "draw aesthetic patterns from")
    - "Last updated" date string at top of page is bumped to 2026-05-11 (or current commit date) so legal page diff is visible to users

    ToS version constant (src/lib/legal/tos-version.ts):
    - `STYLE_FROM_REFERENCE_TOS_VERSION` literal is bumped from `'2026-05-10-v1'` to `'2026-05-11-v2'` (format: `YYYY-MM-DD-vN` per existing format invariant)
    - The bump-discipline comment block is updated to note this quick task triggered the bump (one-liner reference to `260511-flj`)
    - No new exports, no signature changes — purely a literal swap so every existing audit row's tos_version != current tos_version and the LEGAL-01 clickwrap re-fires for every user on next upload

    ToS clickwrap modal (src/components/style-from-reference/tos-clickwrap-modal.tsx):
    - NO EDIT EXPECTED. The modal already reads the version constant indirectly via import, and the displayed "Terms version: {STYLE_FROM_REFERENCE_TOS_VERSION}" string updates automatically. Per CONTEXT.md: "Update tos-clickwrap-modal.tsx copy only if it surfaces version-specific summary text" — review confirms the modal only surfaces the literal version + framing copy, both of which need no further change. Add inline confirmation comment ONLY if no edit is needed: skip the file entirely.

    Safety-block-recovery regression test (src/components/style-from-reference/__tests__/safety-block-recovery.test.tsx):
    - A new test asserts the rendered surface has NO override CTA. Specifically: the "Try a different image" button must dispatch UPLOAD_RESET (not GENERATE_CLICK / not "continue anyway"), and the panel renders no element matching the patterns `force/anyway/override/continue anyway/proceed/i accept` or any button whose handler dispatches CONFIRM-or-FORCE-shaped actions. The panel must read as terminal for this reference (user's only paths forward: try a different image, or describe in text — both leave the original reference behind).
    - Existing tests in this file continue to pass.

    Verification path (no production code change):
    - `bash scripts/grep-gates/inspired-by-framing.sh` continues to exit 0 after T&C edit (the new copy uses approved framing).
    - `src/lib/legal/__tests__/tos-version.test.ts` (existing format test) continues to pass against the new `2026-05-11-v2` literal (format `YYYY-MM-DD-vN` preserved).
  </behavior>
  <action>
    1. **Edit `src/lib/legal/tos-version.ts`:**
       - Change `export const STYLE_FROM_REFERENCE_TOS_VERSION = '2026-05-10-v1' as const` → `export const STYLE_FROM_REFERENCE_TOS_VERSION = '2026-05-11-v2' as const`
       - Update the JSDoc BUMP DISCIPLINE block (lines 17-21) with a one-line note: `// 2026-05-11: bumped to v2 — quick 260511-flj added Section 7b "Assumption of Liability for Reference Content" and removed the in-app RefusalWarning gate; forcing universal re-acceptance.`

    2. **Edit `src/app/terms/page.tsx`:**
       - Update the "Last updated" string at line 24 from "March 20, 2026" to "May 11, 2026"
       - Add a NEW `<section>` block immediately AFTER the existing Section 7a closing `</section>` (around line 134). Section heading: `<h2 className="text-xl font-semibold text-[#3d0000] mb-3">7b. Assumption of Liability for Reference Content</h2>`. Body paragraphs as described in `<behavior>` above — 3–4 short paragraphs. Use plain `<p className="mt-3">` formatting consistent with surrounding sections. Use the established framing tokens (`inspired by`, `derive style cues from`, `aesthetic patterns`) — do NOT use any token forbidden by `scripts/grep-gates/inspired-by-framing.sh`.
       - The clause MUST mirror the Canva AI Product Terms posture cited in Phase 79 LEGAL-05 (operator-perspective: user warrants rights, user assumes liability, platform reserves takedown rights). Match the existing tone of Section 7a (which says "we are not able to provide legal advice").
       - Do NOT add a section number renumbering (keep it 7b — adding "7a, 7b" matches the existing 6.Subheading style with "Your Content / Stock Images / Our Content").

    3. **Add `src/components/style-from-reference/__tests__/safety-block-recovery.test.tsx`** (or APPEND a new `describe` block if the file already exists — check first; from the file listing it exists already). The new test:
       - Renders `<SafetyBlockRecovery recoverySuggestion="Try cropping high-skin areas" dispatch={vi.fn()} />`
       - Asserts the rendered DOM contains zero buttons / links whose accessible name matches `/force|anyway|override|proceed anyway|i accept|continue anyway/i`
       - Asserts the "Try a different image" CTA, when clicked, dispatches `{ type: 'UPLOAD_RESET', references: [] }` — NOT `GENERATE_CLICK`
       - Asserts the recovery panel header text reads as a hard refusal for THIS reference ("We couldn't analyze that reference" — already the production copy) — the test pins the existing copy so a future copy regression to a softer "Optional: try anyway" surface fails CI
       - One concise `it()` per assertion; same describe block; ~30 LOC total
       - Inline comment at the top of the new describe block: `// quick 260511-flj: nudity/CSAM is the single hard-block category; this regression pins the no-override invariant.`

    4. **Verify tos-clickwrap-modal.tsx needs no edit:**
       - Read the file (already loaded into the executor's context — it imports STYLE_FROM_REFERENCE_TOS_VERSION directly and renders it twice).
       - Confirm no version-specific summary copy (lines 86-100 are version-agnostic — they describe the feature, not the specific clause). 
       - If the executor finds any version-specific text that needs updating, edit it; otherwise leave the file untouched.

    5. **Run `bash scripts/grep-gates/inspired-by-framing.sh`** locally to confirm the new T&C copy doesn't introduce forbidden tokens. If it fails, revise the new copy until it passes.

    NOTE: After this task lands and is deployed, every existing user who had previously accepted v1 will see the LEGAL-01 clickwrap modal on their next style-from-reference upload — this is the intended legal effect. No data migration is required (audit table records both old + new versions side-by-side).
  </action>
  <verify>
    <automated>
      cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow

      # 1. ToS version literal bumped to 2026-05-11-v2 (or planner-chosen newer date+suffix):
      grep -c "STYLE_FROM_REFERENCE_TOS_VERSION = '2026-05-11-v2'" src/lib/legal/tos-version.ts
      # Expected: 1

      # 2. Section 7b H2 exists in terms page:
      grep -c '7b. Assumption of Liability for Reference Content' src/app/terms/page.tsx
      # Expected: 1

      # 3. inspired-by-framing.sh still passes after T&C edit:
      bash scripts/grep-gates/inspired-by-framing.sh

      # 4. Existing tos-version format test still passes:
      npx vitest run src/lib/legal/__tests__/tos-version.test.ts

      # 5. Safety-block-recovery test passes (existing + new no-override assertion):
      npx vitest run src/components/style-from-reference/__tests__/safety-block-recovery.test.tsx

      # 6. ToS clickwrap modal test (which renders the version literal) still passes against the bumped constant:
      npx vitest run src/components/style-from-reference/__tests__/tos-clickwrap-modal.tsx

      # 7. Typecheck baseline unchanged:
      npx tsc --noEmit 2>&1 | tail -5
    </automated>
  </verify>
  <done>
    - `STYLE_FROM_REFERENCE_TOS_VERSION === '2026-05-11-v2'` (or planner-chosen newer literal matching `YYYY-MM-DD-vN`)
    - Section 7b H2 with assumption-of-liability paragraphs exists in `src/app/terms/page.tsx`; rendered in the live `/terms` route (visual smoke optional but encouraged)
    - `bash scripts/grep-gates/inspired-by-framing.sh` exits 0
    - `src/lib/legal/__tests__/tos-version.test.ts` passes against the new literal (format `YYYY-MM-DD-vN` enforced)
    - The new no-override regression test in `safety-block-recovery.test.tsx` passes — the panel exposes NO "force/anyway/override/proceed/continue anyway/i accept" CTA
    - `npx tsc --noEmit` error count remains at the 17 baseline
    - Per-user effect documented in SUMMARY.md: "Every existing user will re-accept on next upload via Phase 79 LEGAL-01 clickwrap (audit table records v2026-05-11-v2)."
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user → reference upload (Phase 74 LEGAL-01 clickwrap) | Untrusted bytes + warranty of rights cross here |
| Gemini API → extract orchestrator | Untrusted vision output crosses here (always was; closed-enum + Phase B firewall stays in place) |

## STRIDE Threat Register (delta vs Phase 75/76/79 — only changed surfaces)

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-flj-01 | Information Disclosure | T&C page Section 7b | accept | Public ToS page; intentional disclosure of contractual posture |
| T-flj-02 | Repudiation | User uploads infringing content, denies acceptance | mitigate | Audit table (Phase 79 LEGAL-02) records sha256 + user_id + bumped tos_version + accepted_at; bumped version forces re-acceptance event for every existing user |
| T-flj-03 | Tampering | Bypassing the safety_blocked path to push nudity/CSAM through | mitigate | Gemini HARM_CATEGORY_SEXUALLY_EXPLICIT tightened to BLOCK_LOW_AND_ABOVE at vendor boundary; safety-block-recovery surface has zero override CTA (Task 2 regression test pins this); two-phase firewall (Phase 75 EXTRACT-02) prevents bytes from reaching emit on any block |
| T-flj-04 | Elevation of Privilege | User finds removed CONFIRM_REFUSAL_WARNING action still routes through reducer | mitigate | Action variant deleted from SpecPreviewAction union; TypeScript exhaustiveness check (`_exhaustive: never`) in state-machine.ts catches any stray dispatch at compile time; runtime no-op fallthrough as second line of defense |
| T-flj-05 | Denial of Service | Tightened safety threshold blocks legitimate fashion/fitness uploads at higher rate (Pitfall 7 churn risk) | accept | CONTEXT.md explicitly accepts this tradeoff ("no custom client-side nudity detector"). Mitigation = the existing PREVIEW-12 SafetyBlockRecovery surface (Phase 76) gives users specific retry guidance. The user policy is "false positives on lifestyle is acceptable cost of single enforcement point." |
| T-flj-06 | Tampering | A future PR re-introduces refusal_flags by reusing a leftover RefusalFlags import path | mitigate | Task 1 deletes the source module entirely; any future import will fail at module-resolution time. Zero-references grep gate in Task 1's verify block catches drift during code review. |
</threat_model>

<verification>
- Both tasks land green: typecheck baseline preserved, full vitest target suite passes for each task's listed files, both grep gates (inspired-by-framing + the zero-references gate in Task 1) exit 0
- `npm run lint:gates` (which wires inspired-by-framing.sh + the existing Phase 74 closed-enum + Phase 77 token-budget gates) still exits 0 across both tasks
- Live smoke (manual, recommended after deploy): log in as the test bigdfill@gmail.com account, navigate to style-from-reference, upload a reference with a face/logo (e.g., the Meta/Ray-Ban slideshow from the prior diagnosis session). Expected:
  1. ToS clickwrap modal opens (because the user previously accepted v1, not v2)
  2. After accepting, Generate enables as soon as one aspect is checked (no Continue gate on the reference)
  3. /terms page renders Section 7b with the new assumption-of-liability copy
- Live smoke for the hard-block path: attempt to upload a reference with overt nudity. Expected: extract returns safety_blocked, the SafetyBlockRecovery surface renders with the "We couldn't analyze that reference" header + recovery suggestion, and there is NO "Continue anyway" CTA anywhere on the panel.
</verification>

<success_criteria>
- Refusal pre-pass + RefusalWarning gate fully removed (4 files deleted; zero non-comment references remain)
- Generate enables on a single aspect-checked state regardless of reference content (face/logo/watermark no longer gate)
- STYLE_FROM_REFERENCE_TOS_VERSION bumped; LEGAL-01 clickwrap re-fires for every existing user on next upload
- Section 7b Assumption of Liability exists in /terms; passes inspired-by-framing grep gate
- Gemini HARM_CATEGORY_SEXUALLY_EXPLICIT threshold = BLOCK_LOW_AND_ABOVE on the main extraction call; other three categories unchanged
- SafetyBlockRecovery panel has no override CTA — verified by a focused regression test (Task 2)
- Typecheck baseline (17 errors per STATE.md) unchanged
- Vitest target suites for both tasks pass
- `bash scripts/grep-gates/inspired-by-framing.sh` exits 0
- SUMMARY.md explicitly notes this quick task SUPERSEDES Phase 75 D-05 and Phase 76 PREVIEW-10 (so future readers searching the planning history understand the reversal)
</success_criteria>

<output>
After completion, create `.planning/quick/260511-flj-narrow-content-blocks-to-nudity-and-csam/SUMMARY.md` summarizing:

- Files deleted (4) + files modified (the rest)
- Confirmation that PREVIEW-10 + Phase 75 D-05 are now superseded — with a one-paragraph "why we reversed" pointing at this CONTEXT.md
- The new STYLE_FROM_REFERENCE_TOS_VERSION literal + the per-user re-acceptance effect ("every existing audit row's tos_version != current; LEGAL-01 modal re-fires on next upload")
- The single new hard-block category: nudity/sexually-explicit (Gemini BLOCK_LOW_AND_ABOVE); CSAM remains hard-blocked at Gemini's API layer regardless of threshold
- Out-of-scope items intentionally not done: no signup-time blanket liability flow; no violence/gore block; no client-side nudity detector
- A `## Supersedes` block listing the two prior locked decisions being reversed (Phase 75 D-05; Phase 76 PREVIEW-10) so the project history search surfaces this reversal
</output>
