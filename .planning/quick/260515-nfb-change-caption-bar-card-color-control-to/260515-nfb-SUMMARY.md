---
quick_task: 260515-nfb
title: Change Caption Bar card Color control to swatch-row picker
status: complete
completed: 2026-05-15
subsystem: editor
tags: [ui, editor, color-picker, caption-bar]
key-files:
  modified:
    - src/components/editor/caption-bar-controls.tsx
    - src/components/editor/__tests__/caption-bar-controls.test.tsx
decisions:
  - "Reused exported COLOR_SWATCHES (['#ffffff','#3d0000','#7d6161','#fadbdb']) rather than defining a new palette — exactly the white/maroon/grey-brown/light-pink set in the reference screenshot."
metrics:
  tasks: 2
  files: 2
  commits: 2
  tests_added: 3
---

# Quick Task 260515-nfb: Change Caption Bar card Color control to swatch-row picker Summary

Replaced the Caption Bar control card's single native `<input type="color">` black-rectangle swatch with a swatch-row picker — a row of round `COLOR_SWATCHES` preset color circles plus a circular palette-icon button (hidden native color input) — mirroring the `AccentWordsDisclosure` "Highlight color" row pattern. Pure UI control swap; no data-model change.

## What Changed

### Task 1 — Swap the Color row for a swatch-row picker (`caption-bar-controls.tsx`)
- Added `import { COLOR_SWATCHES } from './text-rail/color-swatches'`.
- Replaced the inline-right native `<input type="color">` rectangle block with a vertical `space-y-1` container: a `Color` label above a `flex gap-3` row.
- The row renders four round `w-6 h-6 rounded-full` preset swatch `<button>`s (`COLOR_SWATCHES`). Each commits its hex via `patch({ caption_bar_color: swatch }, true)` → `onSlideUpdate`. The white swatch gets a `1px solid #dbc1bc` border so it stays visible. The swatch whose hex matches the resolved `color` gets `ring-2 ring-[#3d0000] ring-offset-1` and `aria-pressed="true"`.
- After the swatches, a circular palette-icon `<label>` tile wraps a `material-symbols-outlined` "palette" glyph plus an `sr-only` native `<input type="color">` for arbitrary custom hex — still committing via `patch({ caption_bar_color: e.target.value }, true)` (PCL12 explicit-hex path preserved).
- `data-testid="caption-bar-color"` kept on the hidden native input so the existing PCL12 test resolves it unchanged. New testids: `caption-bar-color-swatch-{hex}` per swatch, `caption-bar-color-palette` on the palette tile.
- Updated the file-top doc comment's Color sentence to describe the swatch row.
- Untouched: `patch` helper, `toColorInputValue`, Height/Opacity sliders, Position radiogroup, visibility gate, every prop, the data model.

### Task 2 — Swatch-row test coverage (`caption-bar-controls.test.tsx`)
Added three cases to the existing `describe('CaptionBarControls')` block (committed in the TDD RED phase):
1. `clicking a preset swatch commits caption_bar_color` — clicks `caption-bar-color-swatch-#3d0000`, asserts `onSlideUpdate` called with `caption_bar_color: '#3d0000'`.
2. `the palette-icon button is present` — asserts `getByTestId('caption-bar-color-palette')` is truthy.
3. `the swatch matching the resolved color is marked active` — renders a slide with `style_overrides.caption_bar_color: '#3d0000'`, asserts that swatch has `aria-pressed="true"` and the others `aria-pressed="false"`.
The existing PCL12 test (`color picker emits an explicit hex string`) was preserved unchanged — it still targets the hidden native input.

## TDD Cycle
- **RED** (`4d9ca6e`): Added the 3 swatch-row tests against unchanged code — 3 failed, 8 passed (PCL12 included).
- **GREEN** (`c1343aa`): Implemented the swatch-row picker — all 11 tests pass.
- REFACTOR: not needed.

## Verification

- `npx vitest run src/components/editor/__tests__/caption-bar-controls.test.tsx` — 11/11 pass.
- `npm run lint:gates` — all 3 grep gates pass (closed-enum, prompt-token-budget, inspired-by-framing); no `currentColor`/`inherit`/CSS-var introduced.
- `npx tsc --noEmit` — 19 errors, all pre-existing in test-mock files (auth/stripe/legal); zero new, zero in `caption-bar-controls.tsx`. Matches the documented ~19 baseline.

## Deviations from Plan

None — plan executed exactly as written. Task 2's three test cases were authored during Task 1's TDD RED phase (`tdd="true"`), so they were already committed and passing by the time Task 2 was reached; no separate Task 2 commit was needed.

## Commits

- `4d9ca6e` test(quick-260515-nfb): add failing tests for Caption Bar swatch-row color picker
- `c1343aa` feat(quick-260515-nfb): swap Caption Bar Color row for swatch-row picker

## Self-Check: PASSED

- FOUND: src/components/editor/caption-bar-controls.tsx
- FOUND: src/components/editor/__tests__/caption-bar-controls.test.tsx
- FOUND commit: 4d9ca6e
- FOUND commit: c1343aa
