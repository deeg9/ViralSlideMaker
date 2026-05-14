---
slug: fix-hook-text-align-center
quick_id: 260514-l9q
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# Fix hook text-align center — Summary

Clicking **Center** (or Right) on a hook text box now actually centers (or right-aligns) the rendered text — at any list-indent.

## Cause

The hook wrapper in the browser preview is `display: flex; flex-wrap: wrap` (Satori parity — multi-segment hooks need flex so each `<span>` is a flex item that wraps independently). In CSS, **`text-align` on a flex container does not position its flex-item children** — only `justify-content` does. The OUTER positioned div had `text-align: center` set correctly; the inner hook flex wrapper just ignored it. Body's wrapper isn't flex, so body centered normally — only the hook was affected. The list-indent=1 workaround dodged it accidentally by switching `renderTextBlock` to its slow path, which inserts a different child layout.

## Fix

- **New** `alignToJustifyContent(align)` helper in `src/lib/render/resolve-overlay.ts`:
  - `'center'` → `'center'`
  - `'right'` → `'flex-end'`
  - everything else → `'flex-start'`

- **`src/components/slides/slide-preview.tsx`** — `hookTextStyle` now sets `justifyContent: alignToJustifyContent(hookTextAlign)`.

- **`src/lib/render/render-slide-satori.tsx`** — same mapping applied to `hookStyle` AND `bodyStyle` so the two renderers stay byte-identical on the alignment axis (Satori already honored `text-align` here; the addition is defense-in-depth).

`text-align` is kept on every wrapper so Satori output is unchanged and the inline-text-align rule still cascades to non-flex descendants.

## Verification

- `npx tsc --noEmit`: clean for touched files.
- `npx vitest run -u` on `slide-preview`, `render-slide-satori`, `premium-templates`, `resolve-overlay` suites: **0 real-source failures**. 30 reported failures are all in stale `.claude/worktrees/agent-*` copies (unrelated to this work).
- 2 snapshots updated to reflect `justify-content` on the hook/body wrappers.

## Smoke

1. Open a hook text box.
2. Click the **Center** align button → hook text centers immediately.
3. Click **Right** → hook text right-aligns.
4. Both work regardless of list-indent.
5. Export PNG / publish → Satori output renders the same alignment as the editor preview.
