---
quick_id: 260515-spn
slug: add-orbital-loader-extracting-state
status: complete
completed: 2026-05-15
---

# Summary — Add OrbitalLoader to ExtractingState

## What changed

Added a spinning loader to the right of "Analyzing your references..." on
the Copy Style card so users have a clear visual cue that reference
extraction is in flight.

- **New:** `src/components/ui/orbital-loader.tsx` — `<OrbitalLoader>`
  component verbatim from the user spec. Three concentric counter-rotating
  rings via `motion/react`; sized via `className` (default `w-16 h-16`).
  Supports optional `message` + `messagePlacement` (top/bottom/left/right)
  through `class-variance-authority`.
- **Edit:** `src/components/style-from-reference/style-from-reference-shell.tsx`
  → `ExtractingState()`. The heading and loader now share a flex row
  (`flex items-center justify-center gap-3`); the subtext stays underneath.
  Loader sized `w-6 h-6` (24 px) for visual balance with the `text-sm`
  heading. Card padding, border, and centering are unchanged.

## Why this layout

The user asked for the spinner "to the right of where it says 'Analyzing
your references'". A flex row inside the existing centered card honors
that placement while keeping the subtitle directly below the heading where
it has always been.

## Constraints honored

- `data-testid="extracting-state"`, `role="status"`, `aria-live="polite"`,
  and the literal "Analyzing your references" string are all preserved —
  Test 3 in `style-from-reference-shell.test.tsx` still passes.
- No new dependencies (`motion` ^12.38.0 + `class-variance-authority` ^0.7.1
  were already in `package.json`).
- The ring color (`border-t-foreground` → `#281718`) is visible against
  the rose-tinted `#fff0f0` card background.

## Verification

- `npx tsc --noEmit` — no new errors in the two touched files.
- `npx vitest run style-from-reference-shell.test.tsx` — 9 files, 81 tests
  passing (including Test 3 which guards the extracting-state contract).
