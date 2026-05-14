---
slug: collapse-layers-panel
date: 2026-05-14
status: complete
---

# Collapse the Layers panel into an accordion (closed by default)

User asked: make the LAYERS section in the left sidebar a collapsible
accordion, closed by default.

## What changed

`src/components/editor/layers-panel/layers-panel.tsx` — the LAYERS header
became a `<button>` (toggles `bodyOpen` local state, default `false`).
A right-pointing chevron rotates 90° when open. Header text + chip-count
formatting unchanged.

The body (chips + group rows / "No elements" placeholder) is wrapped in
a `<div id="layers-panel-body">` that toggles a `hidden` class — the body
stays MOUNTED so the integration tests' `screen.getAllByTestId('layer-chip')`
queries keep working without each test needing to first click the toggle.

Accessibility: `aria-expanded` on the button, `aria-controls` pointing at
the body id, `data-testid="layers-panel-toggle"` for future tests.

## Tests

- 174/174 layers-panel suite passes unchanged.
- TS clean on the touched file.

## Files touched

- `src/components/editor/layers-panel/layers-panel.tsx`
