---
quick_task: narrow-content-blocks-to-nudity-and-csam
quick_id: 260511-flj
created: 2026-05-11
completed: 2026-05-11
status: complete
---

# Quick Task 260511-flj: Narrow content blocks to nudity/CSAM only — Summary

**Shipped:** Refusal pre-pass module + RefusalWarning Continue gate deleted entirely; Gemini `HARM_CATEGORY_SEXUALLY_EXPLICIT` threshold tightened from `BLOCK_ONLY_HIGH` to `BLOCK_LOW_AND_ABOVE` on the main vision extraction call; new T&C Section 7b "Assumption of Liability for Reference Content" added; `STYLE_FROM_REFERENCE_TOS_VERSION` bumped `2026-05-10-v1` → `2026-05-11-v2` to force universal re-acceptance via Phase 79 LEGAL-01 clickwrap.

**Net effect on the user flow:** Upload a reference with a face / logo / watermark and Generate now enables as soon as a single aspect (palette / typography / layout / decorations) is checked — no Continue click required, no chip beside the thumbnail. Upload a reference with nudity / sexually-explicit content and the extract returns terminal `safety_blocked` → the SafetyBlockRecovery surface renders with NO override CTA (regression-test pinned). Liability for IP / right-of-publicity / trademark / defamation claims shifts contractually to the user via the strengthened Section 7b clickwrap copy — every existing user re-accepts on their next style-from-reference upload because the bumped version literal forces `hasUserAcceptedCurrentTos()` to return false.

## Supersedes

| Phase | Decision | Why reversed |
|-------|----------|--------------|
| Phase 75 | **D-05** — Refusal pre-pass (second Gemini Vision call classifying each reference for `{contains_logo, contains_face, contains_watermark}`) | The UI gate it fed (PREVIEW-10) is gone, so the module is no longer load-bearing. Cost saving: ~$0.001/image per extraction. Liability moved to T&C clickwrap. |
| Phase 76 | **PREVIEW-10** — RefusalWarning Continue gate (Generate disabled until user explicitly acknowledges each flagged reference via `CONFIRM_REFUSAL_WARNING`) | Continue gate was UX friction without meaningful legal cover — Gemini doesn't reliably distinguish "use of a face owned by Getty" from "use of any face". A per-user T&C re-acceptance with explicit assumption-of-liability copy gives stronger contractual cover at lower UX cost. PRESERVES the underlying legal posture by strengthening the T&C clickwrap copy + bumping the version. |

## Files deleted (4)

- `src/components/style-from-reference/refusal-warning.tsx`
- `src/components/style-from-reference/__tests__/refusal-warning.test.tsx`
- `src/lib/ai/refusal-pre-pass.ts`
- `src/lib/ai/__tests__/refusal-pre-pass.test.ts`

## Files modified

### Task 1 (deletion pass — commit `8a82dfb`)

- `src/components/style-from-reference/state-machine.ts` — drop `refusalFlags`, `refusalAcknowledged`, `CONFIRM_REFUSAL_WARNING` action; drop `refusalFlags` from `EXTRACT_SUCCESS` payload; remove `RefusalFlags` import from deleted module
- `src/components/style-from-reference/spec-preview-panel.tsx` — `generateDisabled = !hasAtLeastOneAspect(state)` (single-predicate); remove `refusalWarningSlot` prop + the `refusalAcknowledgedOrAbsent` helper; simplify title/hint copy
- `src/components/style-from-reference/style-from-reference-shell.tsx` — remove `RefusalWarning` import + the `slotPerReference={...}` per-thumbnail wiring on `<StickyReferenceStrip>`; drop `refusalFlags: result.refusal_flags` from `EXTRACT_SUCCESS` dispatch
- `src/lib/ai/extract-style-spec.ts` — remove `runRefusalPrePass` import + the parallel `Promise.all([runRefusalPrePass(...), withSingleRetry(...)])` call (now a bare `await withSingleRetry(() => callGeminiVisionWithTimeout(prepared))`); `visionCallsCount = 1` (was 2); drop `refusal_flags` from success returns (cache-hit + non-cached); tighten `VISION_SAFETY_SETTINGS[2].threshold` from `BLOCK_ONLY_HIGH` → **`BLOCK_LOW_AND_ABOVE`** for `HARM_CATEGORY_SEXUALLY_EXPLICIT` (other 3 categories unchanged at `BLOCK_ONLY_HIGH`)
- `src/lib/ai/extract-style-spec.types.ts` — drop `refusal_flags` from `ExtractSuccess`; drop `import type { RefusalFlags }` + `export type { RefusalFlags }` re-export; update telemetry JSDoc to say "1 on a non-cached extraction"
- `src/components/style-from-reference/__tests__/state-machine.test.ts` — drop `RefusalFlags` import + `FLAGS_FACE` / `FLAGS_NONE` constants; rewrite Test 4 (`EXTRACT_SUCCESS`) to assert spec set without refusalFlags; delete Test 13 (`CONFIRM_REFUSAL_WARNING`); drop refusalFlags/refusalAcknowledged from helper fixtures and Test 12 (`UPLOAD_RESET`)
- `src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx` — drop `refusal_flags: []` from `ExtractResult` fixture
- `src/components/style-from-reference/__tests__/recovery-integration.test.tsx` — delete Test 9 (PREVIEW-10 sticky-strip placement), Test 10 (PREVIEW-10 Generate gating), Test 16 (`CONFIRM_REFUSAL_WARNING` ack flow); drop `refusal_flags: []` from all fixtures
- `src/lib/ai/__tests__/extract-style-spec.test.ts` — delete `vi.mock('../refusal-pre-pass', ...)` block; delete Test 12 (refusal errored → ok:true); delete parallel-dispatch assertions in Test 2 (refusalStarted / Math.abs / wallClock vs sum); change `visionCallsCount` expectations 2 → 1; drop every `result.refusal_flags` assertion; add `BLOCK_LOW_AND_ABOVE` to the `HarmBlockThreshold` mock so the orchestrator import doesn't crash
- `src/lib/ai/__tests__/extract-style-spec.types.test.ts` — drop `RefusalFlags` import; drop `refusal_flags: []` from Type test 3 `ExtractSuccess` fixture; delete Type test 6 (`RefusalFlags` re-export contract)
- `src/app/(dashboard)/style-from-reference/__tests__/actions.test.ts` — drop `refusal_flags: []` from three `ExtractSuccess`-shaped fixtures
- `src/app/(dashboard)/style-from-reference/__tests__/regenerate-action.test.ts` — drop `refusal_flags: []` from four `ExtractSuccess`-shaped fixtures

### Task 2 (T&C + version bump + safety-block hard-block test — commit `2210d3a`)

- `src/lib/legal/tos-version.ts` — `STYLE_FROM_REFERENCE_TOS_VERSION` literal swap `'2026-05-10-v1'` → **`'2026-05-11-v2'`**; bump-discipline comment block updated with one-line note citing this quick task
- `src/app/terms/page.tsx` — add a new H2 `<section>` `"7b. Assumption of Liability for Reference Content"` directly after Section 7a, with 4 paragraphs covering (1) rights-warranty by the uploader, (2) explicit assumption of liability for IP infringement, trademark dilution, right-of-publicity, and defamation claims, (3) explicit disclaimer that ViralSlideMaker is not the user's legal counsel, (4) takedown-process pointer mirroring Section 7a's DMCA path. Copy uses approved "inspired by" / "derive style cues from" / "aesthetic patterns drawn from" framing — passes the Phase 79 LEGAL-03 grep gate verbatim. "Last updated" string bumped `March 20, 2026` → `May 11, 2026`
- `src/components/style-from-reference/__tests__/safety-block-recovery.test.tsx` — new `describe` block titled `"quick 260511-flj: SafetyBlockRecovery — no-override hard-block invariant"` with 3 `it()` cases pinning: (a) zero buttons whose accessible name matches `/force|anyway|override|proceed anyway|i accept|continue anyway/i`, (b) the "Try a different image" CTA dispatches `{ type: 'UPLOAD_RESET' }` exactly (not `GENERATE_CLICK`, not `CONFIRM*`, not `FORCE*`), (c) the panel header still reads "We couldn't analyze that reference" (pins the existing copy so a future softening regression fails CI)
- `src/lib/legal/__tests__/tos-version.test.ts` — update the two literal-value assertions from `'2026-05-10-v1'` to `'2026-05-11-v2'` (format-shape assertion `^\d{4}-\d{2}-\d{2}-v\d+$` continues to apply unchanged)

### Files INTENTIONALLY left untouched

- `src/components/style-from-reference/tos-clickwrap-modal.tsx` — already imports `STYLE_FROM_REFERENCE_TOS_VERSION` directly and renders it twice (label + audit-record-string). Re-reading after the bump confirms no version-specific summary copy exists in this file (lines 86–100 describe the feature, not the specific clause). The displayed version literal will update automatically on next render. No edit needed.

## New `STYLE_FROM_REFERENCE_TOS_VERSION` value + per-user effect

**`STYLE_FROM_REFERENCE_TOS_VERSION = '2026-05-11-v2'`**

Every existing audit row in the `style_reference_uploads` table records `tos_version = '2026-05-10-v1'` (the prior literal). Because `hasUserAcceptedCurrentTos()` does an `eq('tos_version', STYLE_FROM_REFERENCE_TOS_VERSION)` filter on the user's rows, the bump means **every existing user's `hasUserAcceptedCurrentTos()` now returns `false`** — the Phase 79 LEGAL-01 clickwrap modal will fire on their next style-from-reference upload, surfacing the bumped Section 7b assumption-of-liability copy and recording a new audit row with `tos_version = '2026-05-11-v2'`. No data migration is required; the audit table holds both old and new versions side-by-side for the 12-month retention window.

## Gemini `HARM_CATEGORY_SEXUALLY_EXPLICIT` threshold change

**`BLOCK_ONLY_HIGH` → `BLOCK_LOW_AND_ABOVE`** in `src/lib/ai/extract-style-spec.ts` `VISION_SAFETY_SETTINGS`. The other three categories (`HARM_CATEGORY_HARASSMENT`, `HARM_CATEGORY_HATE_SPEECH`, `HARM_CATEGORY_DANGEROUS_CONTENT`) remain at `BLOCK_ONLY_HIGH` — user policy was silent on those.

Effect: more uploads (especially fashion / fitness / lifestyle with high skin exposure) will trip Gemini's `promptFeedback.blockReason = 'IMAGE_SAFETY'` path. That path is **unchanged** in this task — it still routes through Step 6 of the orchestrator, refunds the credit, and returns `{ ok: false, error: 'safety_blocked', reason, recovery_suggestion, ... }`. The Phase 76 PREVIEW-12 SafetyBlockRecovery surface renders verbatim; the new Task 2 regression test pins the no-override invariant against future copy drift.

CSAM remains hard-blocked at Gemini's API layer regardless of threshold — Google's category-specific CSAM enforcement is non-tunable.

## Out-of-scope items (intentionally not done)

- No signup-time blanket liability acknowledgment (the user explicitly chose "update existing Phase 79 ToS + bump version" over a broader signup-flow change)
- No violence / gore hard-block category (not in the user's policy)
- No custom client-side nudity detector (Gemini safety filter is the single enforcement point — preserves v2.13's "no new vendor" posture and keeps the threat model in one place)
- No edit to `src/components/style-from-reference/tos-clickwrap-modal.tsx` (no version-specific summary copy lives in that file; modal version literal updates automatically via the imported constant)
- No re-deletion or modification of unchanged Phase 79 mechanics (LEGAL-01 modal wiring, LEGAL-02 audit table schema, LEGAL-04 DMCA doc, LEGAL-06 retention crons all remain intact)

## Verification recap

- 4 deleted files no longer exist on disk
- Zero non-comment, non-supersedes-marker references to `runRefusalPrePass`, `CONFIRM_REFUSAL_WARNING`, `refusalAcknowledged`, `refusal_flags`, `refusalFlags`, `refusalWarningSlot`, `RefusalWarning`, `RefusalFlags` remain in `src/`
- `HARM_CATEGORY_SEXUALLY_EXPLICIT` threshold = `BLOCK_LOW_AND_ABOVE` exactly once in `src/lib/ai/extract-style-spec.ts`'s `VISION_SAFETY_SETTINGS`
- `STYLE_FROM_REFERENCE_TOS_VERSION = '2026-05-11-v2'` is the only literal in `src/lib/legal/tos-version.ts`
- `bash scripts/grep-gates/inspired-by-framing.sh` exits 0
- `npm run lint:gates` exits 0 (closed-enum + token-budget + inspired-by-framing all green)
- All targeted vitest suites pass: 78/78 in Task 1's listed files; 11/11 in `safety-block-recovery.test.tsx` (3 new no-override tests added); 3/3 in `tos-version.test.ts`; 8/8 in `tos-clickwrap-modal.test.tsx`
- `npx tsc --noEmit` error count = 19 (unchanged from pre-task baseline; STATE.md historical figure of 17 has drifted to 19 in the project, but neither task added new errors)

## Live smoke recommended after deploy

1. Log in as `seller@example.com` (active dev account), navigate to style-from-reference, upload a reference with a face/logo (e.g., the Meta/Ray-Ban slideshow from the prior diagnosis session). Expected:
   - ToS clickwrap modal opens (because the user previously accepted v1, not v2)
   - After accepting, Generate enables as soon as one aspect is checked (no Continue gate on the reference)
   - `/terms` renders Section 7b with the new assumption-of-liability copy + the new "Last updated: May 11, 2026" stamp
2. Hard-block path: upload a reference with overt nudity. Expected: extract returns `safety_blocked`; SafetyBlockRecovery surface renders the "We couldn't analyze that reference" header + Phase 75 `recovery_suggestion` verbatim; NO "Continue anyway" / "Force" / "Override" / "I accept" CTA anywhere on the panel.
