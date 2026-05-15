---
quick_id: 260515-spn
slug: add-orbital-loader-extracting-state
status: complete
started: 2026-05-15
completed: 2026-05-15
---

# Plan — Add OrbitalLoader to ExtractingState

## What

Add a spinning loading icon next to the "Analyzing your references..." heading
on the Copy Style card, so users have a clear visual cue that reference
extraction is in-flight.

## Where

- Component (new): `src/components/ui/orbital-loader.tsx` — verbatim from the
  user-supplied spec (motion/react + cva, 3 concentric counter-rotating rings).
- Consumer (edit): `src/components/style-from-reference/style-from-reference-shell.tsx`
  → `ExtractingState()` function. Restructure inner layout so the heading and
  the loader sit in a flex row, with the subtext below.

## Constraints

- Must keep `data-testid="extracting-state"`, `role="status"`,
  `aria-live="polite"`, and the literal text "Analyzing your references" —
  Test 3 in `style-from-reference-shell.test.tsx` asserts all four.
- `motion` (^12.38.0) and `class-variance-authority` (^0.7.1) are already
  in package.json. No new deps.
- Loader sized `w-6 h-6` for visual balance with `text-sm` heading in `p-6`
  card. (The third concentric ring is naturally suppressed at this size — only
  two rings render, which still reads as an orbital spinner.)
