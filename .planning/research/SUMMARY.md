# Project Research Summary

**Project:** TikTok Carousel Creator — v2.17 Mobile Optimization
**Domain:** Retrofitting mobile-first / iOS Safari correctness onto an existing desktop-built Next.js 15 + React 19 + Tailwind v4 carousel editor
**Researched:** 2026-05-31
**Confidence:** HIGH

## Executive Summary

This is a focused retrofit milestone, not a ground-up rebuild. The empirical iPhone-15 audit confirms that public/view surfaces (explore, public carousel, public profile), the dashboard, and settings all reflow cleanly with zero horizontal overflow. The real work concentrates in two areas: (1) three cross-cutting CSS bugs that affect every surface — missing `viewport-fit=cover`, the iOS `100vh` overshoot, and 46 sub-40px tap targets in the editor alone — and (2) a genuine interaction rework of the slide editor so the 9:16 canvas gets room to breathe on a phone. The recommended approach is CSS-first with zero new heavy dependencies: the existing stack (Next.js `viewport` export, Tailwind v4 `dvh`/`env()` utilities, Pointer Events, `@radix-ui/react-dialog`) provides everything needed.

The defining structural change is the editor: on mobile the grid is already `grid-cols-1` below `lg`, so the three existing grid children (left aside, canvas, right aside) stack vertically. The mobile rework is fundamentally a re-hosting exercise — keep the canvas dominant, compress the left aside into a thin filmstrip, and re-host the right aside's TEXT/ELEMENTS/IMAGES panels into a bottom sheet built on the already-installed `@radix-ui/react-dialog`. Panel internals (`TextEditorPanel`, `ElementsPanel`, `ImagePickerPanel`) are reused byte-identical; only their container changes. This is a seam, not a rewrite.

The single highest-risk item — and the only genuine gate — is tap-to-edit-text on touch. The plumbing exists (`onTextBoxSelect` -> `requestPanelFocus`, `onTextBoxTextEdit`) but the audit explicitly marks it UNVERIFIED because Playwright cannot reproduce iOS keyboard behavior. If touch text-editing is broken, no amount of bottom-sheet polish matters. Verify and repair this on a real device or iOS Simulator before building the editor chrome-collapse and sheet rework. Two external dependencies must be flagged: a login credential is needed to audit the logged-out landing/auth pass, and iOS Simulator or physical iPhone access is required for the device-validation gate that is a hard milestone exit criterion.

---

## Key Findings

### Recommended Stack

**The headline finding: this milestone requires adding zero new dependencies.** Every requirement is met by the existing stack. The single line that unlocks the most work is the `viewport` export in `src/app/layout.tsx` (currently absent), which sets `viewport-fit=cover` and populates `env(safe-area-inset-*)` for the entire app. Until that line is present, every `env()` safe-area value reads `0` — invisible in devtools and Playwright, only broken on a real iPhone.

See `.planning/research/STACK.md` for exact syntax.

**Core technologies (existing, used differently):**
- `export const viewport: Viewport = { viewportFit: 'cover', width: 'device-width', initialScale: 1 }` in `layout.tsx` — the one change that makes `env(safe-area-inset-*)` non-zero on iPhone 15; must precede every safe-area fix
- Tailwind v4 `h-dvh` / `min-h-dvh` — fix the iOS `100vh` overshoot bug; already installed, just not applied to the editor shell (`slide-editor.tsx:1498` uses static `100vh`)
- Tailwind v4 arbitrary `env()` values (`pb-[max(1.5rem,env(safe-area-inset-bottom))]`) — wire safe-area insets to fixed bars; no plugin needed
- `touch-action: manipulation` (`touch-manipulation`) — eliminate the 300ms tap delay and double-tap-zoom on buttons without disabling page zoom (WCAG-safe); apply per control, not globally
- Pointer Events + `react-rnd` (already installed) — the canvas drag/select/rotate layer already works on touch; do NOT add a gesture library
- `@radix-ui/react-dialog` (already installed) — build the bottom-sheet primitive on top of the existing Radix Dialog; gives focus-trap, Esc-to-close, scroll-lock for free

**Optional (add only if triggered):**
- `tailwindcss-safe-area` — named utilities (`pb-safe`) instead of `env()` arbitrary syntax; pure DX sugar; skip unless the arbitrary syntax becomes noisy across many files
- `@use-gesture/react` — only if pinch-to-zoom text elements becomes a hard requirement AND hand-rolled two-pointer math is insufficient; defer past v2.17

### Expected Features

See `.planning/research/FEATURES.md` for the full prioritization matrix and competitor analysis.

**Must have — table stakes (v2.17 core):**
- `viewport-fit=cover` + safe-area insets on all fixed/sticky bars — foundation; `env()` reads 0 without it
- Global 44px tap-target pass (editor toolbar/chips, header icon, carousel chevrons, undo/redo) — 46 violations in editor alone (AUDIT X2)
- `>=16px` input font (no iOS auto-zoom) + prompt placeholder contrast fix (AUDIT X3)
- Verify and repair tap-to-edit-text on touch — the #1 risk; gates the entire editor
- Editor chrome-collapse so the 9:16 canvas gets real height — the defining editor task
- Bottom-sheet tool panels (re-host TEXT/ELEMENTS/IMAGES + rail controls into a sheet on `@radix-ui/react-dialog`)
- Finger-sized drag/resize/rotate handles (reuse v2.10 `inset:-10px` hit-zone pattern)
- Reachable, properly-sized undo/redo
- Filmstrip scroll affordance + `>=44px` slide/layer chips
- Template picker as a scannable 2-up grid (all 16 tiles visible — replaces the cramped horizontal row)
- Swipe-to-advance on public carousel viewer + sized chevrons (protect the conversion surface)

**Should have — differentiators (v2.17.x):**
- Pinch-zoom + two-finger pan on canvas (P2 — trigger: small-element editing pain reported)
- Auto-collapse chrome on canvas focus (the Canva-style polish on top of manual collapse)
- Double-tap text -> inline edit (layers on verified tap-to-edit)
- Keyboard-aware sticky submit for prompt + auth forms (needs logged-out credential first)

**Defer (v2.18+):**
- Haptic feedback on snap/handle-grab (iOS Safari Vibration API support is uneven — verify before committing)
- "Remix on your phone" one-tap public->editor conversion (requires the editor to be proven touch-usable first)
- Smart guides tuned for touch hysteresis (depends on stable pinch/pan gesture layer)

**Anti-features — do NOT do these:**
- `user-scalable=no` / `maximum-scale=1` — WCAG 1.4.4 violation; use `>=16px` inputs instead
- Porting marquee/group/multi-select to touch — fights pinch-pan, produces mis-selections; leave as desktop-only
- Cramming the full desktop right-rail onto 393px — use bottom-sheet progressive disclosure
- A FAB "+" in the tab bar — the project already removed the top "+" button (commit `8ea7833`); do not re-add
- Auto-focusing the prompt textarea on dashboard load — keyboard pops on load, covers the onboarding cue

### Architecture Approach

The entire editor mobile rework is a container re-host at one grid seam, not a component rewrite. `slide-editor.tsx` already renders a `grid-cols-1` single-column layout on mobile (below `lg:`); the three grid children — left aside (filmstrip + LayersPanel), center (SlideCanvas), right aside (TEXT/ELEMENTS/IMAGES + pinned portlet) — stack vertically. The mobile pass changes *how those children are arranged and hosted*, keeping every panel's internal logic and prop surface byte-identical.

See `.planning/research/ARCHITECTURE.md` for the full component inventory and exact line-number citations.

**Major components and their v2.17 actions:**

1. `src/app/layout.tsx` — **Modify**: add `viewport` export (one line; the foundation for everything else)
2. `src/components/layout/bottom-navbar.tsx` + `dashboard-shell.tsx` — **Modify**: consume `env(safe-area-inset-*)` on fixed/edge bars; swap `min-h-screen` to `min-h-dvh`
3. `src/app/globals.css` — **Modify**: add `@utility tap-44`; `-webkit-tap-highlight-color: transparent`; placeholder contrast fix
4. `src/components/ui/sheet.tsx` — **NEW**: thin bottom-sheet wrapper built on the already-installed `@radix-ui/react-dialog` (side=bottom, `max-h-[85dvh]`, safe-area padding); mirrors `dialog.tsx` structure exactly
5. `src/components/editor/slide-editor.tsx` — **Modify**: swap `100vh` -> `100dvh` (L1498); mobile arrangement (canvas-first); route TEXT/ELEMENTS/IMAGES panels through the new Sheet; 44px chrome buttons; persistent safe-area bottom action bar
6. `TextEditorPanel` / `ElementsPanel` / `ImagePickerPanel` — **Reuse unchanged** as sheet body content
7. `SlideCanvas` / `SlidePreview` — **Reuse unchanged**; gains height for free when siblings collapse; only handle hit-area sizing and tap-to-edit verification
8. `src/components/slides/template-picker.tsx` — **Modify**: horizontal row -> scannable 2-up grid (reuses `template-tile-preview.tsx` tiles)

**Breakpoint discipline (follow existing conventions, no new tokens):**
- `md:` (768px) = phone/desktop nav split (`BottomNavbar` is `md:hidden`; `sidebar-nav` is `hidden md:flex`)
- `lg:` (1024px) = 3-panel editor vs single-column mobile editor (`slide-editor.tsx:1501`)
- `isFullBleed` JS branch (`dashboard-shell.tsx:15`) = editor shell vs scrolling-page shell

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for the full 10-pitfall catalog with recovery strategies.

1. **`viewport-fit=cover` forgotten — `env(safe-area-inset-*)` silently reads `0`** — Set `viewportFit: 'cover'` in `layout.tsx` via the Next.js `viewport` export (NOT a manual `<meta>` tag, which App Router overrides). Land this first. Validate on a real device — Playwright always reports insets as 0.

2. **Tap-to-edit-text silently broken on touch** — The selection/edit plumbing was built for mouse events. On iOS, a tap may be absorbed by react-rnd's drag layer or the marquee state machine; `.focus()` called after an async hop is silently dropped by iOS. Verify on device BEFORE building bottom sheets. Fix: movement threshold to distinguish tap from drag; `.focus()` synchronously inside the gesture handler; stay on Pointer Events (no raw `onTouchStart`).

3. **Fat-finger destructive mis-taps — this project has real data-loss scars** — A dashboard card click once hard-deleted a project via an adjacent delete control. On a 44px-finger touch surface, adjacent destructive controls are worse than on desktop. Every hard-delete needs confirm-or-undo. Destructive controls must be separated from primary tap targets with enforced spacing so 44px hit areas do not overlap.

4. **The iOS `100vh` bug — content cut off / Export bar invisible at first paint** — `slide-editor.tsx:1498` uses `h-[calc(100vh-140px)]`. On iOS `100vh` equals the largest viewport (address bar retracted), so the bottom is cut off when the address bar is visible. Fix: `100dvh`. Validate on device — Playwright uses a static viewport, URL bar never collapses.

5. **Keyboard overlay in the `fixed inset-0` editor shell** — When the soft keyboard opens on iOS, it overlays (does not resize) the layout, hiding inputs in fixed layouts. Fix (cheapest first): `interactiveWidget: 'resizes-visual'` in the `viewport` export + `dvh` heights; then `window.visualViewport` translation for pinned elements; `scrollIntoView` as backstop. Do NOT use the `VirtualKeyboard` API — Chromium-only, absent in iOS Safari. Validate on device only.

6. **Playwright cannot sign off iOS-specific items** — Playwright does not reproduce safe-area insets, the `100vh` URL-bar collapse, the soft keyboard overlay, input-zoom behavior, iOS back-swipe, or pull-to-refresh. It IS useful for the 393px no-horizontal-overflow regression and the sub-44px tap-target probe (both already written). A dedicated real-device / iOS Simulator validation pass is a hard milestone exit criterion, not optional polish.

---

## Implications for Roadmap

Based on the combined research and audit, the build order is forced by hard dependencies. Phase A is a strict prerequisite — `env()` safe-area values read `0` until `viewport-fit=cover` is set, so every fixed-bar and sheet placement is wrong until Phase A lands. Phase B is a verification gate, not a construction phase; it must pass before Phase D is worth building.

### Phase A: Cross-cutting Foundation

**Rationale:** `env(safe-area-inset-*)` reads `0` until `viewport-fit=cover` is set. Every fixed-bar fix, every bottom-sheet placement, and the correct editor height are broken or unmeasurable until this lands. It touches the fewest components and is the lowest-risk change.

**Delivers:** An iPhone 15 where the bottom tab bar no longer collides with the home indicator; no iOS auto-zoom on inputs; readable prompt placeholder; correct `dvh` editor height shell; a shared `tap-44` utility ready for the sweep.

**Addresses:** AUDIT X1 (safe-area), AUDIT X2 (tap targets, foundation sweep), AUDIT X3 (contrast), iOS `100vh` bug (global shells)

**Avoids:** Pitfall 1 (viewport-fit), Pitfall 2 (100vh), Pitfall 5 (input-zoom), Pitfall 10 (fixed-bar jump)

**Files:** `src/app/layout.tsx` (viewport export), `src/components/layout/bottom-navbar.tsx` (safe-area pb), `src/components/layout/dashboard-shell.tsx` (dvh, safe-area), `src/app/globals.css` (tap-44 utility, tap-highlight reset, placeholder contrast), `src/components/editor/slide-editor.tsx` (100vh -> 100dvh swap only)

**Research flag:** No deeper research needed. Patterns are fully specified in STACK.md with exact syntax and verified line numbers.

---

### Phase B: Editor Touch Validation Gate

**Rationale:** This is a verify-and-repair gate, not a construction phase. The tap-to-edit-text flow (AUDIT #1 unverified risk) must be confirmed working on a real device before any editor chrome rework is built. The bottom-sheet TEXT panel is worthless if tapping a text element does not fire the keyboard. Phase A must land first (44px targets make the element tappable at all).

**Delivers:** Confirmed verdict: touch tap-to-select and tap-to-edit-text fires the iOS keyboard, mirrors selection in the rail, and text input persists on blur. OR: a diagnosis + repair of the tap/drag disambiguation and `.focus()` synchrony issues.

**Addresses:** AUDIT "core interaction UNVERIFIED — #1 risk"

**Avoids:** Pitfall 3 (tap-to-edit broken), building Phase D on a broken interaction

**Dependencies:** Phase A complete (44px targets), iOS Simulator or physical iPhone 15 access (external dependency — confirm availability before planning Phase B)

**Research flag:** Needs device investigation during execution. The specific failure mode (react-rnd drag stealing the tap, async focus drop, `onTextBoxSelect` pointer path) can only be diagnosed on device. Phase executor should be prepared to trace the Pointer Events path through react-rnd and the marquee state machine.

---

### Phase C: Bottom-Sheet Primitive

**Rationale:** A thin new `sheet.tsx` built on `@radix-ui/react-dialog` is needed before Phase D can route panels through sheets. Safe-area padding in the sheet requires Phase A's `env()` values to be populated.

**Delivers:** `src/components/ui/sheet.tsx` — exports `Sheet`, `SheetContent` (side=bottom, `max-h-[85dvh]`, `pb-[env(safe-area-inset-bottom)]`), `SheetHeader`, `SheetTitle`, `SheetClose`. Mirrors `dialog.tsx` structure.

**Addresses:** Bottom-sheet tool panels (table stakes), Phase D dependency

**Avoids:** Adding a new heavy dependency (`vaul`, `react-spring`, etc.); hand-rolling overlay/focus-trap from scratch

**Implementation note:** Ship as modal (Radix Dialog default) for v2.17. Revisit `modal={false}` or `vaul` only if device testing shows the modal dismiss-to-canvas flow feels wrong.

**Research flag:** No deeper research needed. `@radix-ui/react-dialog` is already in use in this codebase (`dialog.tsx`).

---

### Phase D: Editor Mobile Layout Rework

**Rationale:** With Phase A's foundation, Phase B's verified touch-editing, and Phase C's sheet primitive, the editor re-host is unblocked. This is the milestone's largest phase in code changes but is architecture-contained: all changes live in `slide-editor.tsx` and its direct children. Panel internals are reused byte-identical.

**Delivers:** A mobile editor where: the 9:16 canvas is the dominant surface; TEXT/ELEMENTS/IMAGES panels are accessible from thumb-height bottom-sheet tabs; the filmstrip is a thin horizontal strip with edge-fade affordance; LayersPanel is on-demand; Undo/Redo/Public/Export are persistent in a safe-area-padded bottom action bar at 44px.

**Addresses:** "Collapse chrome to maximize canvas" (table stakes), "Bottom-sheet tool panels" (table stakes), "Finger-sized handles", "Reachable undo/redo", "Filmstrip scroll affordance"

**Avoids:**
- Pitfall 4 (keyboard overlay — bottom-sheet must be verified on device with keyboard open)
- Pitfall 6 (destructive mis-taps — confirm/undo for slide delete and element delete; separate destructive controls from select targets; the project already has one data-loss scar from this pattern)
- Pitfall 7 (hover-only affordances — audit for any hover-reveal controls in the rail)
- Pitfall 8 (shortcut-only actions — ensure delete/duplicate/switch have tap affordances)
- Pitfall 9 (gesture conflicts — `touch-action` discipline on canvas and filmstrip; `overscroll-contain` on the fixed shell to prevent pull-to-refresh data loss)

**Device validation required:** confirm keyboard + bottom-sheet coexistence; drag does not trigger page scroll or back-swipe; filmstrip swipe does not scroll the page vertically.

**Research flag:** Plan a device pass mid-phase (not only at the end) to catch keyboard overlay issues before building too far on an untested assumption.

---

### Phase E: App-Wide Polish

**Rationale:** After the foundation and editor are solid, remaining polish items are independent and parallelizable. The logged-out pass (Phase E3) is externally blocked by a login credential and should be sequenced so it does not stall the editor track.

**Delivers:**
- E1: Template picker replaced with scannable 2-up grid (reuses `TemplateTilePreview` tiles; container change only)
- E2: Settings sub-nav scroll affordance; filmstrip/chip sizing; public carousel chevrons `>=44px`; swipe-to-advance on `/explore/[slug]`
- E3: Logged-out audit + fix of `/`, `/login`, `/signup`, `/onboarding/username`, `/forgot-password`, `/reset-password` at 393px — **BLOCKED on login credential** (external dependency)

**Research flag:** E1 and E2 need no research. E3 needs the credential before it can even be audited — flag as an external dependency at milestone planning time.

---

### Phase Ordering Rationale

- **A before everything:** `env(safe-area-inset-*)` reads `0` until `viewport-fit=cover` is set. No safe-area fix or sheet placement is correct until Phase A is merged.
- **B before D:** Phase B is a verification gate. Building bottom sheets around a broken tap-to-edit path wastes effort and compounds diagnosis complexity.
- **C before D:** `sheet.tsx` must exist before `slide-editor.tsx` can route panels through it.
- **E is parallel with D (after A):** Template picker, filmstrip polish, and public viewer fixes do not depend on the editor rework; they only depend on the foundation.
- **E3 is independently blocked:** Do not let the logged-out credential dependency stall the editor track. Sequence E3 after the editor phases or in parallel with a separate executor.

### Research Flags

Needs device investigation during execution:
- **Phase B:** tap-to-edit-text behavior on iOS; Pointer Events path through react-rnd; `.focus()` synchrony — Playwright cannot reproduce; only a Simulator or physical device can
- **Phase D (mid-phase):** keyboard + bottom-sheet coexistence on the `fixed inset-0` editor shell; gesture conflicts (canvas drag vs back-swipe, filmstrip vs vertical scroll, pull-to-refresh)

Standard patterns (skip research):
- **Phase A:** exact syntax fully specified in STACK.md with verified line numbers; no unknowns
- **Phase C:** `@radix-ui/react-dialog` is already used in this codebase; sheet construction is a well-documented pattern
- **Phase E1/E2:** container changes reusing existing components; no integration unknowns

### External Dependencies (flag before planning)

1. **Login credential** — required to audit `/`, `/login`, `/signup`, and related auth flows (Phase E3). The audit browser profile was already authenticated; no credential was available to log back in after logout. Without this, Phase E3 cannot be started.
2. **iOS Simulator (Xcode) or physical iPhone 15** — required for Phase B validation gate and Phase D device sign-off. Playwright cannot reproduce safe-area insets, the `100vh` URL-bar bug, the iOS soft keyboard overlay, or real multi-touch gestures. This is a hard milestone exit criterion, not optional.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every recommendation grounded in repo file reads (exact line numbers) + Context7-verified Next.js viewport API; alternatives considered and explicitly ruled out |
| Features | HIGH | Grounded in empirical audit (Playwright iPhone-15 probe) + competitor analysis (Canva, CapCut, Procreate, drawio); anti-features explicitly enumerated |
| Architecture | HIGH | Every integration point cites real file path + line number; build order derived from hard code dependencies, not heuristics |
| Pitfalls | HIGH | Grounded in iOS Safari platform behavior (cross-checked against STACK.md), the audit's empirical findings, and this project's actual destructive-mis-tap history |

**Overall confidence: HIGH**

### Gaps to Address

- **Tap-to-edit-text on touch (unverified):** The audit flags this as unconfirmed. It is the only table-stakes item with meaningful unknowns. Budget a real-device diagnosis pass as the first act of Phase B. If broken, repair scope is medium — pointer path disambiguation, `.focus()` synchrony, react-rnd drag threshold — but it must be confirmed before the editor rework proceeds.
- **Modal vs non-modal sheet:** The recommendation is modal (Radix Dialog default) for v2.17. If device testing reveals the dismiss-to-canvas flow feels too disruptive, the fallback is `modal={false}` or introducing `vaul`. Defer this decision to Phase D device testing.
- **iOS keyboard + bottom sheet coexistence:** `interactiveWidget: 'resizes-visual'` + `dvh` + `max-h-[85dvh]` should handle it, but this combination has not been tested on this specific `fixed inset-0` shell. Reserve time for a device pass mid-Phase D.
- **Logged-out surfaces (E3):** Not audited. Entirely blocked on a login credential. No data on these surfaces; treat as unknown until the credential is available.
- **Performance on real mid-range iPhone:** The audit ran in a Playwright headed window, not on a physical device. The 1,703-icon picker (already virtualized with `@tanstack/react-virtual`), filmstrip thumbnails, and canvas drag performance should be spot-checked on a real device during Phase D validation.

---

## Sources

### Primary (HIGH confidence)
- `.planning/mobile-audit/AUDIT.md` — empirical iPhone-15 Playwright audit; X1 (safe-area gap), X2 (46 sub-40px editor targets), X3 (low-contrast placeholder), tap-to-edit flagged unverified, per-surface verdicts
- `.planning/research/STACK.md` — Context7-verified Next.js `viewport` export API, Tailwind v4 utility inventory, Pointer Events / react-rnd reuse decision, keyboard handling layers, dependency decisions; repo file reads at exact line numbers
- `.planning/research/FEATURES.md` — mobile interaction patterns grounded in Canva/CapCut/Procreate/drawio/iOS HIG/Material 3/NN/g; feature prioritization matrix; anti-features; dependency graph
- `.planning/research/ARCHITECTURE.md` — repo file reads at exact line numbers (slide-editor.tsx L1498/1500-1501/1508/1576/1590/1603/1755/1803/1895/1977/1999; dashboard-shell.tsx L15/19/21; bottom-navbar.tsx L25); build order with dependency rationale; component inventory
- `.planning/research/PITFALLS.md` — 10 pitfalls with prevention, phase mapping, real-device validation requirements, recovery strategies; "looks done but isn't" checklist; grounded in this project's destructive-mis-tap history

### Secondary (MEDIUM-HIGH confidence)
- iOS Safari platform behavior (`100vh` overshoot, passive listeners, `env()` requires `viewport-fit=cover`, keyboard overlay in fixed layouts, input auto-zoom, edge back-swipe, pull-to-refresh, double-tap-zoom) — widely-documented web platform facts, cross-checked against Context7 documentation
- Competitor interaction analysis (Canva mobile bottom drawer, CapCut bottom toolbar, Procreate gesture handbook, drawio touch diagrams) — sourced from product documentation and UX research; used for feature categorization only, not technical decisions

### Notes
- `tailwindcss-safe-area` — confirmed Tailwind v4 support via Context7; classified as optional DX sugar
- `@use-gesture/react` 10.3.1 — confirmed React 19 compatible; classified as deferred (post-v2.17); non-passive listener management requirements documented

---
*Research completed: 2026-05-31*
*Ready for roadmap: yes*
