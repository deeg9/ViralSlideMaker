---
quick_task: narrow-content-blocks-to-nudity-and-csam
quick_id: 260511-flj
created: 2026-05-11
status: ready-for-planning
---

# Quick Task 260511-flj: Narrow content blocks to nudity/CSAM only — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Task Boundary

Relax the legal-refusal gate so reference uploads containing faces, brand logos, watermarks, or notable people are NO LONGER gated behind a "Continue" click on `<RefusalWarning>`. Liability for IP / right-of-publicity / trademark exposure shifts to the user via an updated T&C clickwrap. The ONLY hard-blocked categories going forward are nudity / sexually-explicit content and CSAM (minors in sexual context).

This is a policy reversal of the Phase 75-76 PREVIEW-10 refusal-gate design + a strengthening of the Phase 79 LEGAL-05 T&C language. It does NOT touch Phase 79 LEGAL-01 (clickwrap modal mechanics), LEGAL-02 (audit table), or LEGAL-04 (DMCA doc) — those stay intact.

</domain>

<decisions>
## Implementation Decisions (locked from discussion)

### Refusal-warning UX
- **Remove the refusal gate entirely.** No `<RefusalWarning>` chip is rendered for `contains_face / contains_logo / contains_watermark`. Generate is enabled as soon as at least one aspect is checked. The user has already accepted liability at upload-time via the T&C clickwrap.
- Implementation guidance: drop `refusalAcknowledgedOrAbsent` from `generateDisabled` in `spec-preview-panel.tsx`. Remove the `<RefusalWarning>` mount from `style-from-reference-shell.tsx` (or whichever component currently passes `refusalWarningSlot`). Remove the `CONFIRM_REFUSAL_WARNING` action + `refusalAcknowledged` state field from `state-machine.ts`. Delete or skip the corresponding `refusal-warning.test.tsx` cases.
- The `<RefusalWarning>` component file can be deleted outright — keep the deletion atomic with the state-machine cleanup so no dead imports remain.
- The Phase 76-01 affordance-shipped tooltip + inline hint on the disabled Generate button should now only show the "Check at least one aspect" message — the refusal branch is dead.

### Refusal pre-pass (`src/lib/ai/refusal-pre-pass.ts`)
- The Gemini second-pass that returns `{contains_logo, contains_face, contains_watermark}` is no longer load-bearing once the UI gate is removed. **Delete the entire module + its parallel-call wiring in Phase 75-01's orchestrator** to save the per-image cost (~$0.001/image) and reduce extraction latency. Index-alignment placeholders disappear with the module.
- Update `extract-style-spec.ts` (or the Phase 75-01 orchestrator that calls both passes in parallel) to drop the refusal call, drop the `flags_per_reference` field from its return shape, and remove `refusalFlags` from the state-machine's initial state.
- Tests that reference `runRefusalPrePass`, `RefusalFlags`, or `refusalFlags` must be deleted or updated.

### T&C update (Phase 79 LEGAL-05 extension)
- **Add an explicit "Assumption of Liability for Reference Content" section** to `src/app/terms/page.tsx`. The clause must state that the user warrants they have the rights (or fair-use justification) to upload each reference image, and assumes all liability for any IP-infringement, trademark-dilution, right-of-publicity, or defamation claim arising from generated output that derives from those references. Mirror the Canva AI Product Terms pattern referenced in the existing Phase 79 LEGAL-05 implementation.
- **Bump `STYLE_FROM_REFERENCE_TOS_VERSION`** in `src/lib/legal/tos-version.ts` from the current value to a new dated version (e.g., `'2026-05-11-v2'`). This forces all existing users to re-accept via the existing Phase 79 LEGAL-01 clickwrap modal on their next upload — the audit table (`style_reference_uploads`) will record the new version per user.
- Update `tos-clickwrap-modal.tsx` copy only if the modal currently surfaces version-specific summary text. The mechanics (Dialog + checkbox + audit insert) are unchanged; this is a copy/version bump, not a behavior change.

### Hard blocks (nudity + CSAM only)
- Tighten the Gemini safety threshold for `HARM_CATEGORY_SEXUALLY_EXPLICIT` from `BLOCK_ONLY_HIGH` to `BLOCK_LOW_AND_ABOVE` on the MAIN style-extraction call in `extract-style-spec.ts`. This is the right vendor-side hook for the new policy — Gemini already refuses CSAM at the API level regardless of threshold.
- Keep `HARM_CATEGORY_HARASSMENT`, `HARM_CATEGORY_HATE_SPEECH`, `HARM_CATEGORY_DANGEROUS_CONTENT` at `BLOCK_ONLY_HIGH` (no behavior change there — user's policy is silent on these).
- When the main extraction returns `promptFeedback.blockReason` (sexually-explicit or otherwise), the existing safety-blocked error path already surfaces a terminal error to the UI. Verify that error copy reads as a hard block ("This reference can't be used — content not permitted") with no override CTA. Add a focused UI test if the current copy is generic.
- Do NOT add a custom client-side nudity detector. The Gemini safety filter is the single enforcement point; that mirrors v2.13's "no new vendor" posture and keeps the threat model in one place.

### Phase 79 LEGAL-03 "Inspired by" framing
- Stays in force. The LEGAL-03 grep gate (`scripts/grep-gates/inspired-by-framing.sh`) continues to forbid `exactly like / clone / copy this / duplicate the / stolen from / ripped from`. The new T&C copy must NOT use those tokens.
- The RefusalWarning copy that previously said "generated output will be inspired by the style, not the brand identity" is being removed, not rewritten. That framing now lives only in the T&C document and the panel header ("Inspired by your references").

</decisions>

<specifics>
## Specific File Targets

**Delete:**
- `src/components/style-from-reference/refusal-warning.tsx`
- `src/components/style-from-reference/__tests__/refusal-warning.test.tsx`
- `src/lib/ai/refusal-pre-pass.ts`
- Any test file under `src/lib/ai/__tests__/` exclusively covering refusal-pre-pass

**Modify (gate removal):**
- `src/components/style-from-reference/spec-preview-panel.tsx` — drop `refusalAcknowledgedOrAbsent`, simplify `generateDisabled`, remove `refusalWarningSlot` prop, simplify the affordance hint
- `src/components/style-from-reference/style-from-reference-shell.tsx` — remove `<RefusalWarning>` mount + the slot wiring
- `src/components/style-from-reference/state-machine.ts` — remove `refusalAcknowledged`, `refusalFlags`, and `CONFIRM_REFUSAL_WARNING` action
- `src/lib/ai/extract-style-spec.ts` — remove the parallel `runRefusalPrePass` call + drop `flags_per_reference` from the return shape; tighten `HARM_CATEGORY_SEXUALLY_EXPLICIT` to `BLOCK_LOW_AND_ABOVE`
- Any tests in `src/components/style-from-reference/__tests__/*.test.tsx` that assert refusal-acknowledgement behavior — delete those assertions or whole files

**Modify (T&C + version bump):**
- `src/app/terms/page.tsx` — add "Assumption of Liability for Reference Content" H2 section under or near the existing Phase 79 LEGAL-05 "Style-from-Reference Generation" section
- `src/lib/legal/tos-version.ts` — bump `STYLE_FROM_REFERENCE_TOS_VERSION` to `'2026-05-11-v2'` (or planner's choice of date+suffix)
- `src/components/style-from-reference/tos-clickwrap-modal.tsx` — if it surfaces version-specific summary text, update it; otherwise leave mechanics alone

**Verify (no change expected):**
- `scripts/grep-gates/inspired-by-framing.sh` runs clean after edits (no new forbidden tokens in T&C copy)
- Phase 79 LEGAL-01 clickwrap modal still fires on first upload after the version bump (existing audit table row's version ≠ new version)

</specifics>

<canonical_refs>
## Canonical References

- **Phase 75 CONTEXT** (`.planning/phases/75-vision-extraction-two-phase-architecture-safety-config/75-CONTEXT.md`) — D-05 locked the refusal-pre-pass design we are now reversing. Note in SUMMARY that this quick task supersedes Phase 75 D-05.
- **Phase 76 PLAN 03** (`.planning/phases/76-spec-preview-ui-per-aspect-controls-re-extract-recovery/76-03-PLAN.md`) — PREVIEW-10 RefusalWarning contract. The "Continue button dispatches CONFIRM_REFUSAL_WARNING" comment in `refusal-warning.tsx:13-15` documents the gate we're removing.
- **Phase 79 CONTEXT** (`.planning/phases/79-legal-hardening-tos-clickwrap-audit-log-copy-review/79-CONTEXT.md`) — LEGAL-01..06 design. We're extending LEGAL-05 (T&C copy) and bumping the version constant LEGAL-01 already uses; LEGAL-02/04 are untouched.
- **Prior diagnosis** (`.planning/quick/260511-generate-disabled-diagnosis/SUMMARY.md`) — confirms the gate is at `spec-preview-panel.tsx:71-72` and the affordance hint was shipped in the prior session. Both predicates of `generateDisabled` are documented there.
- **Gemini safety category constants** — `@google/genai` package: `HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT` + `HarmBlockThreshold.BLOCK_LOW_AND_ABOVE`. Already imported in `refusal-pre-pass.ts` and `extract-style-spec.ts`.

</canonical_refs>

<scope_boundary>
## Out of scope (explicit non-goals)

- Per-region legal compliance (EU GDPR, CCPA-specific clauses) — defer to a future legal pass.
- Signup-time blanket liability acknowledgment (the user explicitly chose "update existing Phase 79 ToS + bump version" over the broader signup-flow change).
- Violence / gore hard-block category (user did NOT select this in the discussion).
- Custom client-side nudity detector (Gemini safety filter is the single enforcement point).
- Refactoring or renaming the unchanged Phase 79 audit table / clickwrap modal mechanics.
- Modifying tests outside the refusal-warning / refusal-pre-pass / generate-disabled blast radius.

</scope_boundary>
