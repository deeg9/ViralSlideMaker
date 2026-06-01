---
plan_id: 91-2
phase: 91
title: Editor foundation — 100vh→dvh, 44px chrome tap targets, pinned-portlet safe-area
wave: 2
depends_on: [91-1]
files_modified:
  - src/components/editor/slide-editor.tsx
requirements:
  - FOUND-02
  - FOUND-03
  - FOUND-01
autonomous: true
---

# Plan 91-2 — Editor foundation

**Goal:** Apply the editor-local foundation fixes that depend on Plan 91-1: swap the static iOS-overshooting `100vh` editor height to `dvh` (FOUND-02), grow the editor's always-visible chrome icon buttons to a ≥44×44px touch target using the `tap-44` utility added in 91-1 (FOUND-03), and pad the editor's pinned bottom Undo/Redo/Public/Export portlet with `env(safe-area-inset-bottom)` so it clears the home indicator (FOUND-01). All changes live in `src/components/editor/slide-editor.tsx` and are container/className-level — no logic, no reducer, no handler changes.

**Requirements covered:** FOUND-02 (dvh), FOUND-03 (editor 44px chrome — the documented "46 sub-40px controls" foundation sweep for the always-visible chrome buttons), FOUND-01 (editor pinned-portlet safe-area).

**Depends on:** Plan 91-1 (the `@utility tap-44` must exist; the `viewport-fit=cover` export must be live for the portlet's `env()` padding to populate on device).

**Scope fence:** This plan sizes the always-visible editor *chrome* buttons (back, add/dup/delete/add-text slide actions, undo/redo, Export). It does NOT restructure the editor layout, re-host panels into sheets, resize on-canvas drag/rotate handles, or re-space the destructive delete control away from its neighbors — those are Phase 93 (EDIT-02/03/05). The delete button is sized to 44px here (FOUND-03) but its *adjacency spacing* hardening is explicitly deferred to Phase 93's EDIT-05.

---

<task id="91-2-1" type="execute">
<title>Swap the editor shell height from 100vh to 100dvh</title>
<read_first>
- src/components/editor/slide-editor.tsx (L1498 — `h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)]`; this is the only 100vh in the editor)
- .planning/research/STACK.md (§2 — dvh fixes the iOS 100vh address-bar overshoot)
</read_first>
<action>
In `src/components/editor/slide-editor.tsx` at L1498, change the root div height from `h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)]` to `h-[calc(100dvh-140px)] lg:h-[calc(100dvh-80px)]`. `100dvh` tracks the live iOS viewport (address bar showing/hiding); on desktop it equals `100vh`. The `-140px`/`-80px` subtrahends and the `lg:` breakpoint are unchanged. The `min-h-0 flex` children already in place need no structural change.
</action>
<acceptance_criteria>
- src/components/editor/slide-editor.tsx contains `h-[calc(100dvh-140px)]` and `lg:h-[calc(100dvh-80px)]`
- src/components/editor/slide-editor.tsx no longer contains `100vh` (grep `grep -n "100vh" src/components/editor/slide-editor.tsx` returns nothing)
- `npx tsc --noEmit` introduces no NEW errors vs baseline
</acceptance_criteria>
</task>

<task id="91-2-2" type="execute">
<title>Grow the editor chrome icon buttons to a 44px tap target</title>
<read_first>
- src/components/editor/slide-editor.tsx (L1513 back Link; L1532 add, L1542 duplicate, L1552 delete, L1560 add-text slide-action buttons; L2001 undo, L2009 redo — all currently `p-1.5` around an `Icon size="sm"`, ~32–36px hit area)
- src/app/globals.css (the `@utility tap-44` added in Plan 91-1)
- .planning/research/STACK.md (§4 — keep the glyph at design size, grow the HIT AREA; do not upscale the icon)
</read_first>
<action>
Add the `tap-44` utility class to each of these always-visible editor chrome controls so each meets ≥44×44px: the back-to-dashboard `<Link>` (L1513), the four slide-action `<button>`s — Add (L1532), Duplicate (L1542), Delete (L1552), Add Text Box (L1560) — and the Undo (L2001) and Redo (L2009) `<button>`s. Append `tap-44` to each element's existing className (keep `p-1.5`, the colors, `rounded-lg`, hover/active states, and `disabled:opacity-*`). Do NOT change the `Icon` `size="sm"` (glyph stays its design size; tap-44 grows the box). Do NOT funnel these through the `Button` primitive (out of scope, large regression surface). Leave the delete button's red styling and its position as-is — destructive *spacing* hardening is Phase 93/EDIT-05, not this task. The Export button (L2025) is already a full-width `px-3 py-1.5` flex button comfortably over 44px tall in context; leave it unchanged.
</action>
<acceptance_criteria>
- src/components/editor/slide-editor.tsx: the back Link (around L1513) className contains `tap-44`
- The Add, Duplicate, Delete, and Add-Text slide-action buttons (around L1532/1542/1552/1560) each contain `tap-44` in className
- The Undo and Redo buttons (around L2001/2009) each contain `tap-44` in className
- `grep -c "tap-44" src/components/editor/slide-editor.tsx` returns at least 7
- Each swept control still contains its original `p-1.5` and `rounded-lg` classes (no class removed)
- The `Icon` components on those buttons still use `size="sm"` (glyph not upscaled)
- `npx tsc --noEmit` introduces no NEW errors vs baseline
</acceptance_criteria>
</task>

<task id="91-2-3" type="execute">
<title>Pad the pinned editor bottom portlet with safe-area-inset-bottom</title>
<read_first>
- src/components/editor/slide-editor.tsx (L1999 — the pinned `bg-white border-2 … rounded-2xl p-4 space-y-3 mx-4 mt-2 mb-4` portlet holding Undo/Redo + VisibilityDropdown + Export; it pins to the bottom of the right aside)
- .planning/research/ARCHITECTURE.md (Q1 / A2 — the editor's pinned Export/Undo/Public portlet is an edge-anchored bar and must clear env(safe-area-inset-bottom))
</read_first>
<action>
In `src/components/editor/slide-editor.tsx` at the pinned portlet container (L1999), add bottom safe-area breathing room so the portlet clears the home indicator on iOS: change its bottom margin to honor the inset by appending `mb-[max(1rem,env(safe-area-inset-bottom))]` and removing the static `mb-4` (1rem = the existing 16px floor via max()). Keep `mx-4 mt-2`, the background, border, `rounded-2xl`, `p-4`, and `space-y-3`. Change nothing inside the portlet.
</action>
<acceptance_criteria>
- src/components/editor/slide-editor.tsx contains `mb-[max(1rem,env(safe-area-inset-bottom))]` on the pinned portlet
- The pinned portlet no longer has a standalone `mb-4` class
- The portlet still contains `mx-4 mt-2`, `rounded-2xl`, and `p-4`
- `npx tsc --noEmit` introduces no NEW errors vs baseline
</acceptance_criteria>
</task>

---

## Verification criteria

1. `slide-editor.tsx` contains `100dvh` (twice, base + `lg:`) and no `100vh`.
2. At least 7 editor chrome controls carry `tap-44`; glyphs remain `size="sm"`; no original class removed.
3. The pinned bottom portlet consumes `env(safe-area-inset-bottom)` via `mb-[max(1rem,env(safe-area-inset-bottom))]`.
4. `npx tsc --noEmit` shows no NEW errors beyond the 20-error baseline.

## must_haves (goal-backward)

- **FOUND-02:** the only editor `100vh` is now `100dvh` — editor height tracks the iOS URL bar (device-confirmable).
- **FOUND-03:** the always-visible editor chrome buttons now meet ≥44×44px via `tap-44` (regression-gateable by the existing Playwright sub-44 probe at 393px).
- **FOUND-01 (editor):** the pinned bottom action portlet clears the home indicator via safe-area padding.

## Device / human-needed items

- **FOUND-02 (dvh) — physical iPhone 15 required.** Playwright uses a static viewport; the URL bar never collapses, so the overshoot fix can only be confirmed on device (editor bottom/Export bar not cut off at first paint with the address bar visible).
- **FOUND-01 (editor portlet safe-area) — device required** (insets read 0 off-device).
- **FOUND-03 (44px)** — Playwright-gateable at 393px via the existing sub-44 probe, but the probe run is out of this code-phase's scope (no dev server / Playwright per run constraints); satisfied here by source assertion that each control carries `tap-44`.
