---
slug: slide-counter-above-canvas
quick_id: 260514-ku2
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# Slide counter above canvas — Summary

Moved the "Slide N / total" pill from below the canvas to above it.

- `src/components/editor/slide-canvas.tsx`: extracted the counter chip from below the navigation-arrows row (it lived after the closing `</div>` of the canvas frame) and placed it as the first child of the outer `slide-canvas` wrapper. Margin flipped from `mt-4` to `mb-4` so spacing reads correctly above the canvas. No prop, state, or behavior change.

`npx tsc --noEmit`: clean for the touched file.

Commit: 61233cc
