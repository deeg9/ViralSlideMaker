---
quick_task: generate-disabled-diagnosis
created: 2026-05-11
completed: 2026-05-11
status: complete
verdict: not-a-bug-by-design-PREVIEW-10
---

# Quick: Generate button disabled — DIAGNOSED, not a bug

## Cause
`generateDisabled = !hasAtLeastOneAspect(state) || !refusalAcknowledgedOrAbsent(state)` (`spec-preview-panel.tsx:71-72`).

When the extracted refusal flags include any `contains_logo / contains_face / contains_watermark` (our Meta/Ray-Ban test image triggered both logo + face), `refusalAcknowledgedOrAbsent` returns `false` until the user clicks the "Continue" button on the inline `<RefusalWarning>` next to the flagged reference thumbnail (which dispatches `REFUSAL_ACKNOWLEDGED`).

This is PREVIEW-10 working as designed — *"Inline refusal warning when EXTRACT-05 flags logo/face/watermark; 'Inspired by' framing + confirm-and-continue"*. The user MUST acknowledge before generating; the gate is intentional copyright/right-of-publicity defense from Phase 79 LEGAL-03.

## Live verified
Clicked Continue on the refusal warning → Generate button enabled instantly.

## Recommendation (not applied here)
The current disabled state has no affordance explaining WHY. A user without context will stare at a disabled button. Two cheap UX improvements:
1. `title` attribute on disabled Generate: `"Confirm the reference warning above to continue"`.
2. Visual cue (e.g., red dot, animated arrow) on the Continue button while Generate is gated.

Neither shipped in this quick task — diagnosis only. The user asked for diagnosis, not UX polish.
