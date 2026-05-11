---
quick_task: generate-disabled-diagnosis
created: 2026-05-11
completed: 2026-05-11
status: complete
verdict: diagnosed-not-a-bug-affordance-shipped
---

# Quick: Generate-disabled — diagnosed + affordance shipped

## Diagnosis (was a No-Op)
`generateDisabled = !hasAtLeastOneAspect(state) || !refusalAcknowledgedOrAbsent(state)` (`spec-preview-panel.tsx:71-72`).

Two gates:
1. **No aspect checked** — `state.aspects.palette || .typography || .layout || .decorations` all false → disabled. Defends against the emit pipeline receiving "ignore everything" inputs.
2. **Refusal flag unacknowledged** — when EXTRACT-05 flags `contains_logo / contains_face / contains_watermark` AND `state.refusalAcknowledged` is false → disabled. PREVIEW-10 + LEGAL-03 right-of-publicity / copyright defense from Phase 79.

Both gates are intentional. The Meta/Ray-Ban test slideshow triggered the refusal flag (logo + face); clicking "Continue" on the inline `<RefusalWarning>` flipped `refusalAcknowledged` to true and enabled Generate. Working as designed.

## Affordance shipped
Disabled Generate now surfaces WHY:

1. **`title` attribute** (native HTML tooltip on hover):
   - If aspect gate: `"Check at least one aspect above (palette, typography, layout, or decorations) before generating."`
   - If refusal gate: `"Confirm the reference warning above to continue."`

2. **Inline `<p>` hint** below the button (testid `generate-cta-blocker`, `aria-describedby` linked):
   - Aspect gate: *"Check at least one aspect above to enable Generate."*
   - Refusal gate: *"Confirm the reference warning above to enable Generate."*

3. **Conditional render** — hint only shows when disabled; vanishes the moment the blocker resolves.

The two-tier surface (tooltip on hover for advanced users; persistent inline hint for everyone) closes the affordance loop without crowding the panel.

## Live verified
- Extract → no-refusal-flag case → Generate enabled by default → hint absent ✓
- Uncheck all 4 aspects → Generate disabled → hint "Check at least one aspect above to enable Generate." appears ✓
- (Refusal-gate path also confirmed in prior session: click Continue on warning → Generate enables)

## Files modified
- `src/components/style-from-reference/spec-preview-panel.tsx` (added title attr + inline hint, both conditional on the active blocker)
