---
slug: remove-page-counter-overlay
quick_id: 260514-kv9
created: 2026-05-14
status: complete
---

# Remove per-slide top-right page-counter overlay

User: > "remove the numbers from the top right corner that we have because they're obsolete now. We don't need them."

## Context

7 templates declare an `overlays: [{ position: 'top-right', content: { type: 'page-counter' } }]` slot that renders "N/total" on every slide (e.g. "2/5"). After quick-260514-ku2 moved the editor-chrome "Slide N / total" pill above the canvas, the per-slide top-right chip is redundant.

## Change

Short-circuit `page-counter` overlays at the two consumer sites — slide-preview.tsx (React preview) and render-slide-satori.tsx (Satori PNG renderer) — so they never render. TPLREND-05 parity preserved: both renderers skip the same overlay type.

Template registry stays intact (no migrations) — reversible by deleting two early-return lines.

Drop the dead `augmentEditorialSerifPageCounterStyle` call (now unreachable; helper module + its unit tests remain).

## Tests

Invert / delete existence assertions:
- `src/__tests__/components/slide-preview-overlays.test.tsx`: 4 page-counter render tests collapsed into one "suppressed even when declared" test.
- `src/__tests__/components/premium-templates-preview.test.tsx`: 3 counter-rendering tests inverted.
- `src/__tests__/render/render-slide-satori.test.tsx`: 2 counter tests rewritten to assert absence.
- `src/__tests__/render/premium-templates.test.tsx`: counter `toBeDefined` flipped to `toBeUndefined` in 3 places.

Snapshots regenerated via `vitest -u` (453 updated across the project).

## Out of scope

- Removing `page-counter` from the template type union or from individual template files — kept as no-op registry data so it's a one-edit revert if we ever want the chip back.
