---
quick_id: 260515-999
slug: fix-highlight-words-marker
status: complete
created: 2026-05-15
completed: 2026-05-15
---

# Summary — fix-highlight-words-marker

The right-panel "Highlight words" toggle now paints a marker-style pill (Word /
Figma / Canva semantics) behind the highlighted word instead of changing its
text color. The "Highlight color" picker repaints every already-accented
segment so the picker controls the actual visible marker color, not just the
default for the next toggle.

## What changed

- `src/components/editor/text-rail/ActiveTextBoxCard.tsx`
  - `toggleAccent`: on toggle ON writes `highlightColor` (effective accent
    color = `textBox.accent_color ?? template.accentColor`) + `highlightStyle:
    'pill'` alongside `accent: true`. On toggle OFF strips both fields and
    flips `accent: false`.
  - New `handleAccentColorChange`: when the user picks a new highlight color,
    propagates it to every segment with `accent: true` (writing
    `highlightColor` + defaulting `highlightStyle` to `pill`) AND dispatches
    `accent_color`. Wired in place of the old one-line inline updater on the
    `AccentWordsDisclosure`.
  - Captured `effectiveAccentColor = textBox.accent_color ?? accentColor` at
    the top of the render body so the nested function declarations don't lose
    the `textBox` non-null narrowing.
- `src/components/editor/text-rail/__tests__/ActiveTextBoxCard.test.tsx`
  - New `Highlight words (pill marker behavior)` suite — 5 cases covering
    toggle-on, toggle-off, accentColor fallback to template default,
    repaint-on-color-pick, and no-segment-touch when nothing is accented.

## What stayed the same

- `resolve-overlay.ts:renderSegments` — untouched. Legacy templates
  (`news-drop`, `news-cyan`) that hard-code `accent: true` without
  `highlightColor` keep their existing color-only news-headline look.
- AI generation / prompts — untouched. AI prompts already instruct emit of
  `highlightColor` + `highlightStyle: 'pill'` on hook segments, and that
  branch was already rendering correctly; the bug was strictly in the UI
  toggle path.
- Existing slides that have body segments with only `accent: true` and no
  `highlightColor` continue to render as text-color (their pre-fix behavior).
  Users re-toggle the body chips in the right panel to migrate to the new
  pill rendering. Decision logged in PLAN.md per user request.

## How to verify visually

1. Open a generated slide in the editor.
2. Select the body text box; expand "Highlight words" in the right rail.
3. Pick a "Highlight color" (e.g. `#FFD166`), then toggle 1-2 body words on.
4. Confirm those words render as filled pills on the canvas — text in a
   contrast-picked color (black on light, white on dark), background in the
   picked color — same look as the hook in the user's screenshot.
5. Pick a different highlight color; every pill in the box repaints to the
   new color in real time.

## Tests

- `npx vitest run src/components/editor/text-rail/__tests__/ActiveTextBoxCard.test.tsx` → 122 / 122 pass (5 new cases included).
- `npx tsc --noEmit` clean for the changed files. Pre-existing TS errors
  elsewhere in repo (stripe / mock / worktree leftovers) untouched.
- Pre-existing 4 failures in `text-editor-panel.regression.test.tsx`
  (LayerStrip chip count) reproduce on `main` without these changes —
  unrelated.
