---
phase: 91-cross-cutting-mobile-foundation
status: findings_fixed
date: 2026-05-31
depth: standard
files_reviewed: 8
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
---

# Phase 91 Code Review — Cross-Cutting Mobile Foundation

**Depth:** standard. **Scope:** the 8 production source files changed in Phase 91 (commit `8d37cd7`). All changes are CSS/className/config-level — no logic, reducer, handler, or control-flow changes — so the review focused on CSS/iOS-Safari correctness, redundancy, and accessibility regressions.

Files reviewed:
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/layout/bottom-navbar.tsx`
- `src/components/layout/dashboard-shell.tsx`
- `src/components/editor/slide-editor.tsx`
- `src/components/slides/generation-form.tsx`
- `src/components/editor/ai-generate-tab.tsx`
- `src/components/editor/image-picker-panel.tsx`

## Findings

### WARNING-01 — Double-counted bottom safe-area inset (editor portlet) — FIXED

`dashboard-shell.tsx` added `pb-[env(safe-area-inset-bottom)]` to the `fixed inset-0` editor shell, AND `slide-editor.tsx`'s pinned bottom action portlet (Undo/Redo/Public/Export) had been given `mb-[max(1rem,env(safe-area-inset-bottom))]`. The portlet is the bottom-most element of the right `<aside>`, which lives *inside* the inset-padded shell. On a device with a non-zero home-indicator inset, both paddings stack → the portlet would float roughly **2× the inset** above the home indicator. Cosmetic over-gap, not a collision or data-loss issue, but it violates the research guidance ("pad the shell once / the handful of fixed bars," ARCHITECTURE Q1) and would look like a stray empty band under the action bar on iPhone.

**Fix applied (inline, this review):** reverted the portlet to its original static `mb-4`. The editor shell's `pb-[env(safe-area-inset-bottom)]` is now the single source of bottom-inset truth — it shrinks the `fixed inset-0` flex column by the inset, lifting the pinned portlet clear of the home indicator without the portlet self-padding. FOUND-01 remains satisfied (verified: portlet nests inside the inset-padded shell). VERIFICATION.md evidence for Truth #1 updated to match. `npx tsc --noEmit` still clean at the 20-error baseline after the revert.

### INFO-01 — FOUND-03 is a foundation sweep, not an app-wide completion

The `tap-44` utility + the 7-control editor-chrome sweep land the *foundation* for FOUND-03, but pervasive sub-44 targets remain on surfaces this phase intentionally did not touch (carousel chevrons, settings "Change" link, header account icon, slide/layer chips). This is by-design: per CONTEXT.md and ARCHITECTURE Q3, per-surface tap-target sweeps continue in Phases 93/94 as those surfaces are reworked, reusing the `tap-44` utility / the v2.10 `inset:-10px` pattern. Not a defect — the utility exists and the editor's always-visible chrome (the documented worst offender) is fixed. The Playwright sub-44 probe at 393px is the live regression gate for the remaining sweep.

## Non-Findings (explicitly checked, OK)

- **No `user-scalable=no` / `maximumScale`** in the viewport export — WCAG 1.4.4 respected (the comment even documents the prohibition).
- **No `<meta name=viewport>`** hand-written — App Router viewport export used correctly.
- **`tap-44` compiles** under Tailwind v4 PostCSS (emits `min-width: 44px`); placed correctly as a top-level `@utility` (not inside `@layer base`).
- **No glyph upscaling** — `Icon size="sm"` retained on all swept buttons; hit area grown via utility only.
- **Placeholder token `#7d6161/60`** matches the app's existing readable convention (page.tsx, search-box.tsx) — consistent, AA-contrast.
- **`text-base md:text-sm`** on the two editor inputs matches the `Input` primitive's own mobile-zoom-prevention convention.
- **Zero new dependencies**; `package.json` untouched.
- **No `100vh` left** in the editor; `dvh` swap preserves the `-140px`/`-80px` budget and `lg:` breakpoint.

## Summary

1 Warning (double-inset gap) found and **fixed inline**; 1 Info (expected continuation of the FOUND-03 sweep, no action). No Critical findings. The changeset is otherwise a clean, well-scoped CSS-foundation pass with no logic risk.
