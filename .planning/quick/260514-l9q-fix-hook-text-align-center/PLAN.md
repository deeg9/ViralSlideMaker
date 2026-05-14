---
slug: fix-hook-text-align-center
quick_id: 260514-l9q
created: 2026-05-14
status: complete
---

# Fix: hook text won't center unless list-indent ≥ 1

User: > "The text won't center a line unless the indent is at 1. … I've got indent at 0 and the align centered, but it's not working. When I put the indent at 1, then the align will be centered."

## Root cause

The hook's wrapper in `slide-preview.tsx` is `display: flex; flex-wrap: wrap; width: 100%` (mirrors `render-slide-satori.tsx`'s `hookStyle` — Satori needs this so multi-segment hooks emit `<span>` siblings that wrap correctly). In the browser, **`text-align: center` does not align flex items** — `justify-content: center` does. Result: clicking "Center" in the editor sets `text-align: center` on the OUTER positioned div (correctly), but the inner flex hook wrapper's children stay flex-start.

The body wrapper in the browser preview is NOT `display: flex`, so it centers normally. That's why only the hook had the bug.

Bumping `list_indent` to 1 changes the rendered output (fast-path `renderSegments` → slow-path `renderTextBlock`), which inserts a single full-width column-flex `<span>` between the hook flex container and the text. That single child happens to dodge the bug (because the column-flex wrapper isn't a single inline string — it's a `width: 100%` block that establishes its own layout, and text-align cascades to the inner line spans differently). Not a clean fix to rely on this side effect.

## Change

Add a tiny helper `alignToJustifyContent(align)` in `src/lib/render/resolve-overlay.ts`. Apply it as `justifyContent` on the hook flex wrapper in both renderers:

- **`src/components/slides/slide-preview.tsx`** — `hookTextStyle` gets `justifyContent: alignToJustifyContent(hookTextAlign)`.
- **`src/lib/render/render-slide-satori.tsx`** — `hookStyle` AND `bodyStyle` get the same. (Satori interprets `text-align` correctly on flex elements, so the user didn't see a Satori bug — but adding `justifyContent` keeps the two renderers byte-identical on the alignment axis and prevents future divergence.)

`text-align` is kept on the wrappers (Satori uses it, and browsers ignoring it on flex elements means it's a no-op now — no regression for non-flex descendants that might inherit it).

## Files

- `src/lib/render/resolve-overlay.ts` — new `alignToJustifyContent` helper export.
- `src/components/slides/slide-preview.tsx` — import + apply on hook wrapper.
- `src/lib/render/render-slide-satori.tsx` — import + apply on hook and body wrappers.
- 2 snapshot files regenerated (`premium-templates`, `render-slide-satori`).

## Verification

- `npx tsc --noEmit`: clean for touched files.
- `npx vitest run -u` on the four affected suites (slide-preview, render-slide-satori, premium-templates, resolve-overlay): real-source failures **0**. 30 reported failures are all in stale `.claude/worktrees/agent-*` copies — unrelated.
