# Phase 91 — Cross-Cutting Mobile Foundation — CONTEXT

**Milestone:** v2.17 Mobile Optimization
**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Mode:** Non-interactive (subagent-authored discuss). Decisions below are final and grounded in `.planning/research/{SUMMARY,STACK,ARCHITECTURE}.md` + `.planning/mobile-audit/AUDIT.md`.

---

## Phase boundary — what IS and ISN'T in scope

This is the **CSS-first foundation** phase. It lands the cross-cutting iOS-Safari correctness primitives that every later phase (92–95) depends on. It touches the fewest components and is the lowest-risk change in the milestone, but it is a **hard prerequisite**: `env(safe-area-inset-*)` reads `0` until `viewport-fit=cover` ships, so no fixed-bar or bottom-sheet placement in any later phase is correct until this merges.

### IN scope (the A1–A5 set from ARCHITECTURE Q6)
- **A1 — `viewport` export** in `src/app/layout.tsx` with `viewportFit: 'cover'` (+ `width: 'device-width'`, `initialScale: 1`). The single highest-leverage line in the whole milestone. (FOUND-01 enabler.)
- **A2 — Safe-area insets on fixed/edge bars:** `bottom-navbar.tsx` (`pb-6` → `pb-[max(1.5rem,env(safe-area-inset-bottom))]`); editor pinned action portlet in `slide-editor.tsx`; `dashboard-shell.tsx` fixed editor shell respects top/bottom insets. (FOUND-01.)
- **A3 — `@utility tap-44`** in `globals.css` + sweep onto the editor's raw `p-1.5` chrome icon buttons (add/dup/del/add-text/undo/redo) and any sub-44 chevrons reachable here. Plus `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` discipline on swept controls. (FOUND-03.)
- **A4 — Input zoom + contrast:** confirm text inputs are ≥16px on mobile (the `Input` primitive already renders `text-base`; the prompt textarea is `text-base` — OK). Fix the near-invisible prompt/editor placeholders that use `placeholder:text-[#dbc1bc]` to a WCAG-AA-contrast token. (FOUND-04.)
- **A5 — iOS `100vh` → `dvh`:** `slide-editor.tsx:1498` `h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)]` → `dvh`. Also swap the non-editor `min-h-screen` shells to `min-h-dvh` where low-risk. (FOUND-02.)

### OUT of scope (explicitly deferred to later phases / milestones)
- The editor layout rework, bottom-sheet primitive (`sheet.tsx`), filmstrip re-host, LayersPanel demotion — **Phases 92/93**. This phase does NOT restructure the editor; it only swaps the height unit + sizes existing chrome buttons.
- Tap-to-edit-text verification/repair — **Phase 92** (device gate).
- Template-picker grid, settings sub-nav, swipe viewer, 393px typography — **Phase 94**.
- Logged-out/auth pass — **Phase 95** (credential-blocked).
- Any new dependency (`@use-gesture`, `vaul`, `tailwindcss-safe-area`) — **out of scope for the entire milestone.** Arbitrary `env()` values + a single `@utility` cover everything here.

---

## Implementation decisions (final)

1. **Viewport via the Next App-Router export, not a `<meta>` tag.** App Router owns the viewport meta; a hand-written tag is overridden. Keep the existing Material Symbols `<link>` in `<head>`. `interactiveWidget` is deferred to the editor/keyboard phase (93) — not needed for the foundation and best validated alongside the keyboard work; adding it here would be an untested change with no observable foundation-phase benefit.

2. **Safe-area via arbitrary `env()` values, no plugin.** Use `max(designPadding, env(safe-area-inset-*))` so non-notched/devtools contexts keep the original padding. Only ~3 fixed bars consume insets; a `tailwindcss-safe-area` plugin or a global `AppFrame` wrapper is rejected (8+ independent `min-h-screen` roots; no shared shell — per ARCHITECTURE Q1).

3. **Tap targets: `@utility tap-44` + sweep the ~10 editor raw buttons; do NOT refactor the `Button` primitive.** Funneling editor chrome through `Button` is a large regression surface and `Button`'s icon sizes are sub-44 anyway. For dense affordances that can't grow visually (handles/chips) the v2.10 `inset:-10px` pseudo-expander remains available — but heavy chip/handle re-sizing belongs to Phase 93; this phase sizes the always-visible chrome icon buttons and any trivially-swept chevrons. `min-width/height:44px` is the target; we keep glyphs at design size and grow the hit area (no glyph upscaling).

4. **Placeholder contrast.** `#dbc1bc` on white/`#fff8f7` fails WCAG AA. Replace the faint `placeholder:text-[#dbc1bc]` occurrences with the established readable token used elsewhere in the app — `placeholder:text-[#7d6161]/60` (`--muted-foreground` at 60%), which is already the convention on `page.tsx`, `search-box.tsx`, and the onboarding form. This keeps a single placeholder treatment across the app and clears X3. Files: `generation-form.tsx:346`, `ai-generate-tab.tsx:120`, `image-picker-panel.tsx:194`.

5. **`dvh` swap is mechanical and safe.** `100dvh` tracks the iOS address bar; on desktop it equals `100vh`. The `min-h-0` flex children already in place mean the swap needs no structural change. Non-editor `min-h-screen` → `min-h-dvh` is a low-priority safety swap; apply where it's a clean one-token change and skip anywhere it risks layout regressions.

6. **`-webkit-tap-highlight-color: transparent`** set once globally (base layer). The app already uses `active:bg-*` press feedback, so the native grey flash is redundant. `touch-action: manipulation` applied to the swept tap-44 controls (kills the 300ms delay + double-tap-zoom without disabling page pinch-zoom — WCAG-safe; never `user-scalable=no`).

---

## Verification posture (honest, per milestone exit criteria)

- **FOUND-01 (safe-area) is on-device-only.** Playwright/devtools always report `env(safe-area-inset-*)` as `0`; the inset rendering and home-indicator clearance can ONLY be confirmed on the user's physical iPhone 15. This phase implements it correctly to spec and marks the on-device confirmation as a **human-needed** checkpoint in VERIFICATION — not a claimed pass. This is expected and correct.
- **FOUND-02 (`dvh`)** — the URL-bar collapse is likewise device-only; static-viewport Playwright never collapses the bar. Code correctness verified by the mechanical swap; live behavior is a device checkpoint.
- **FOUND-03 (44px)** — regression-gateable by the existing Playwright sub-44 probe at 393px, but the probe run itself is out of this code-phase's scope (no dev server / Playwright per the run constraints). Verified by code inspection that swept controls meet `min 44×44`.
- **FOUND-04 (16px + contrast)** — 16px is statically verifiable (inputs are `text-base`); contrast is statically verifiable against WCAG AA for the chosen token.

## Baseline (for honest reporting)
- `tsc --noEmit`: **20 pre-existing errors, all in `*.test.ts(x)` files** (auth/stripe/projects/legal test mocks). This is the known baseline; report NEW errors only.
- Full test suite has a known fixture-failure baseline; report NEW failures only.

## Files this phase will touch
- `src/app/layout.tsx` (viewport export) — FOUND-01
- `src/components/layout/bottom-navbar.tsx` (safe-area pb) — FOUND-01
- `src/components/layout/dashboard-shell.tsx` (safe-area on fixed shell; optional min-h-dvh) — FOUND-01/02
- `src/app/globals.css` (`@utility tap-44`, tap-highlight reset) — FOUND-03
- `src/components/editor/slide-editor.tsx` (100vh→dvh L1498; tap-44 on chrome buttons + portlet safe-area) — FOUND-02/03/01
- `src/components/slides/generation-form.tsx`, `src/components/editor/ai-generate-tab.tsx`, `src/components/editor/image-picker-panel.tsx` (placeholder contrast) — FOUND-04
