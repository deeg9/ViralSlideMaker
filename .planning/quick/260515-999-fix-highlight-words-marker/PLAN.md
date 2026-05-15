---
quick_id: 260515-999
slug: fix-highlight-words-marker
status: in-progress
created: 2026-05-15
---

# Fix Highlight Words: render as marker, not text-color change

## Problem

Right-panel "HIGHLIGHT WORDS" feature is broken for the body text box.

In the user's screenshot, the hook ("TRUMP'S SHOCKING CHIP DEAL EXPOSED!") shows
each highlighted word with a lime background pill behind black text — the
Word/Figma/Canva marker behavior. The body ("A controversial move allowed China
access to vital US AI tech.") with words controversial / China / access / AI tech
toggled "highlighted" just renders those words in a different *text color* — no
background highlight at all.

Two render paths in `resolve-overlay.ts:renderSegments()`:
- `seg.highlightColor` set → pill span: `backgroundColor`, contrast-picked text
  color, padding, border-radius. This is the correct marker look.
- `seg.accent: true` only → plain span with `color = accentColor`. Just changes
  the text color. This is what the body falls into.

The hook in the screenshot rendered correctly because its segments have
`highlightColor` set (the AI prompt emits these for hooks). The body segments
in that slide were created with only `accent: true` — either by AI generation
(body highlights are optional in the prompt) or by the user toggling chips in
the right panel.

The UI toggle path is the real bug: `ActiveTextBoxCard.toggleAccent` only flips
`seg.accent`, never sets `highlightColor`. So no matter what color the user
picks in "HIGHLIGHT COLOR", body words never get a background — only a hue
change.

## Decision

Make the right-panel "Highlight words" toggle apply a real pill highlight by
also writing `highlightColor` + `highlightStyle: 'pill'` to the segment. Leave
the renderer untouched so legacy templates (`news-drop`, `news-cyan`) that
hard-code `accent: true` without `highlightColor` keep their existing
color-only news-headline look.

Decisions confirmed with the user:
- **Style:** `pill` for both hook and body (matches the screenshot's hook).
- **Existing broken slides:** no auto-migration. The user re-toggles the chips
  in the right panel and the new logic writes the pill fields. Avoids any risk
  of mutating slides where color-only accent was intentional.

## Scope

Touch only the right-panel toggle + color-picker handlers. No renderer change,
no template change, no schema change, no migration.

### File 1: `src/components/editor/text-rail/ActiveTextBoxCard.tsx`

**`toggleAccent(index)` (line 139-144):** on toggle ON, add
`highlightColor: <effective accent_color>` and `highlightStyle: 'pill'` to the
segment. On toggle OFF, strip those fields and clear `accent`. Effective accent
color = `textBox.accent_color ?? template.accentColor` — same resolution the
chip-wall already uses.

**`onChangeAccentColor` (line 364):** in addition to dispatching
`{ accent_color: hex }`, rewrite `highlightColor` on every segment with
`accent: true` so the picker actually updates the visible pills (not just the
"default for new toggles").

### File 2: `src/components/editor/text-rail/__tests__/ActiveTextBoxCard.test.tsx`

Add tests:
1. Toggling a segment ON calls `onUpdate({ segments })` with that segment now
   having `accent: true`, `highlightColor` = effective accent color, and
   `highlightStyle: 'pill'`.
2. Toggling a segment OFF clears `highlightColor` and `highlightStyle`.
3. Picking a new accent color propagates `highlightColor` to all existing
   `accent: true` segments AND dispatches the new `accent_color`.
4. Picking a new accent color does NOT touch segments where `accent` is false.

## Acceptance

- `pnpm test` (or `npm test`) passes — new + existing.
- `pnpm typecheck` passes.
- Manual sanity in the editor: load a slide, select the body text box, toggle
  a body word from the HIGHLIGHT WORDS chip wall — that word now renders with a
  pill background in the live canvas (same visual treatment as the hook).
- Existing news-drop / news-cyan slides still render their accent words in
  color-only mode (no regression — renderer is unchanged).

## Out of scope

- Renderer changes in `resolve-overlay.ts`.
- AI prompt / generation changes (the AI already emits `highlightColor` per
  the prompt; this is about the UI path).
- Migration / backfill for existing slides — the user explicitly opted out.
- Per-textbox pill-vs-block selector — defaulting both to `pill` per user
  decision. If needed later, add a small style picker next to "HIGHLIGHT COLOR".
