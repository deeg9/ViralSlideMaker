# Architecture Research — v2.17 Mobile Optimization (Integration)

**Domain:** Mobile-first integration/refactor of an existing Next.js 15 (App Router) + React 19 + Tailwind v4 (CSS-first) + Supabase app. Target: iPhone 15 (393px). NOT greenfield.
**Researched:** 2026-05-31
**Confidence:** HIGH (every claim below is grounded in a file read directly from this repo; integration points cite real paths + line numbers)

> **Scope note:** This document answers *where mobile-first changes plug into THIS codebase* — exact files, new-vs-modified, a bottom-sheet reuse/build call, and a dependency-ordered build sequence. It assumes the platform decisions in `STACK.md` (Next `viewport` export, `dvh`, `env(safe-area-inset-*)`, Pointer Events, no gesture lib) and the UX targets in `FEATURES.md` (re-host rails into bottom sheets, 44px taps, chrome-collapse). It does not re-derive those.
>
> **This file replaces a stale v2.13 (Style-from-Reference) ARCHITECTURE.md.**

---

## The single most important architectural fact

**The editor's three panels stack vertically on mobile because the grid is `grid-cols-1` below `lg`.**

`slide-editor.tsx:1500-1501`:
```
grid grid-cols-1 lg:grid-cols-[260px_1fr_340px] flex-1 min-h-0 overflow-hidden
```

On desktop this is a 3-column layout (left filmstrip/layers aside | canvas | right tab-rail aside). On mobile (`grid-cols-1`) the **same three `<aside>`/canvas children stack top-to-bottom inside one scroll column**, which is exactly the "header + filmstrip + Layers + canvas + 3 tabs + rail + export bar all fighting for height" stack the AUDIT describes. The canvas (`SlideCanvas`, the middle grid child) is sandwiched between the left aside (filmstrip + LayersPanel) above it and the right aside (TEXT/ELEMENTS/IMAGES tabs + panel body + pinned Undo/Redo/Public/Export portlet) below it.

**This single seam is the lever for the entire editor mobile pass.** The mobile rework is fundamentally: *change how these three already-built children are arranged and hosted on small screens* — keep the canvas mounted and visible, demote the left aside (filmstrip → thin horizontal strip; Layers → on-demand), and re-host the right aside's tab panels into a bottom sheet. The internals of every panel are reused unchanged.

---

## System Overview — the editor layout/height chain (mapped)

```
┌──────────────────────────────────────────────────────────────────────┐
│ src/app/layout.tsx  (root)                                            │
│   • <html>/<body>; Inter font; Material Symbols link                  │
│   • NO `viewport` export today → env(safe-area-inset-*) all 0  ← FIX  │
├──────────────────────────────────────────────────────────────────────┤
│ DashboardShell  (src/components/layout/dashboard-shell.tsx)           │
│   isFullBleed = pathname.startsWith('/project/')                      │
│   editor branch:  `fixed inset-0 overflow-hidden flex flex-col`  L19  │
│     ├─ <TopNavbar variant="app">                                     │
│     ├─ <main class="flex-1 min-h-0 overflow-y-auto">           L21    │
│     │     └─ {children} = ProjectPage                                 │
│     └─ <BottomNavbar>  (md:hidden, fixed bottom-0, pb-6)  ← safe-area │
├──────────────────────────────────────────────────────────────────────┤
│ ProjectPage  (src/app/(dashboard)/project/[id]/page.tsx)             │
│   hasSlides ? <SlideEditor …> : <GenerationForm …>                   │
├──────────────────────────────────────────────────────────────────────┤
│ SlideEditor  (src/components/editor/slide-editor.tsx)                │
│   root div  `h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)]`  L1498   │
│        ▲ STATIC 100vh (iOS overshoot bug) ← swap to dvh              │
│   └─ grid  grid-cols-1 lg:grid-cols-[260px_1fr_340px]  L1500-1501    │
│        ├─ LEFT  <aside>  L1508                                        │
│        │    ├─ actions row (back/title; add/dup/del/text icons)     │
│        │    ├─ <SlideList>     (filmstrip)        L1576              │
│        │    └─ <LayersPanel>                      L1590              │
│        ├─ CENTER <SlideCanvas>  L1603  → <SlidePreview> (the canvas) │
│        └─ RIGHT  <aside>  L1755                                       │
│             ├─ Tab buttons  TEXT | ELEMENTS | IMAGES   L1757-1788    │
│             ├─ scroll body  `flex-1 overflow-auto`    L1791         │
│             │    • TEXT      → <TextEditorPanel>      L1803          │
│             │    • ELEMENTS  → <ElementsPanel>        L1895          │
│             │    • IMAGES    → <ImagePickerPanel>     L1977          │
│             └─ PINNED portlet (outside scroll)        L1999         │
│                  Undo/Redo + <VisibilityDropdown> + Export button   │
└──────────────────────────────────────────────────────────────────────┘
```

**Height chain in one sentence:** root `<html>` → `DashboardShell` pins `fixed inset-0 flex flex-col` → `<main flex-1 min-h-0 overflow-y-auto>` scrolls → `SlideEditor` root sets a fixed `h-[calc(100vh-140px)]` → inner `grid flex-1 min-h-0 overflow-hidden` → the canvas column inherits height from the grid track. On mobile the grid is single-column so the canvas gets only whatever vertical space is left after the stacked left aside and right aside — i.e. very little. **No component "sets the canvas height" explicitly; it falls out of the flex/grid chain.** That's good news: collapsing the sibling chrome automatically gives the canvas room without touching `SlidePreview`.

---

## Answering the six questions

### Q1 — Where does `viewport-fit=cover` + safe-area handling belong?

**Belongs in exactly two places, applied globally, zero per-page duplication:**

1. **`src/app/layout.tsx` — add a `viewport` export** (the file has `metadata` but NO `viewport` export — confirmed). This is the only App-Router-supported way to emit `viewport-fit=cover`, and it's what *populates* the `env(safe-area-inset-*)` vars. One line, applies to every route.
   ```ts
   import type { Viewport } from 'next'
   export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }
   ```
   (Do NOT hand-write `<meta name="viewport">` into the existing `<head>` block — App Router owns it. Keep the Material Symbols `<link>`.)

2. **Consume the insets only on the ~3 fixed/edge bars** via Tailwind v4 arbitrary `env()` values (no plugin):
   - `src/components/layout/bottom-navbar.tsx:25` — `pb-6` → `pb-[max(1.5rem,env(safe-area-inset-bottom))]` (AUDIT X1).
   - `src/components/layout/dashboard-shell.tsx:19` — the `fixed inset-0` editor shell; its TopNavbar should clear `env(safe-area-inset-top)` and its bottom region clear `env(safe-area-inset-bottom)`.
   - The editor's pinned Export/Undo/Public portlet (`slide-editor.tsx:1999`) and, once it exists, the bottom-sheet container — anything anchored to a screen edge.

**Recommendation: do NOT introduce a global safe-area wrapper component.** There is no shared "AppFrame" that all surfaces pass through cleanly (auth pages, explore, admin, profile each render their own `min-h-screen` root — confirmed: 8+ independent `min-h-screen` roots). The right granularity is: viewport export (global, one line) + `env()` padding on the handful of `fixed` bars. A reusable `tailwindcss-safe-area` plugin (`pb-safe`) is optional DX sugar per STACK — skip unless the `env()` arbitrary syntax proves noisy.

**Also a foundation-phase fix in the same area:** `slide-editor.tsx:1498` uses static `100vh`. Swap to `dvh` (`h-[calc(100dvh-140px)]`) so the editor height tracks the iOS address bar. This is the only `100vh` in the editor; the `min-h-screen` roots on scrolling pages (auth/explore/profile) are acceptable but `min-h-dvh` is the safer swap there too (low priority).

---

### Q2 — Editor: cleanest seam to collapse chrome / introduce bottom sheets WITHOUT a rewrite

**The seam is the `grid-cols-1` mobile branch and the three direct grid children.** Concretely, the mobile editor layout becomes:

```
┌─────────────────────────────┐
│ slim top bar (back/title/⋯) │  ← compress LEFT aside's actions row into one row
├─────────────────────────────┤
│                             │
│      <SlideCanvas>          │  ← the existing middle child, now the dominant surface
│      (h-dvh-driven)         │     (single-finger = move element; tap = select+sheet)
│                             │
├─────────────────────────────┤
│ filmstrip strip (peek+fade) │  ← <SlideList> re-hosted as a thin horizontal rail
├─────────────────────────────┤
│ [Text][Elements][Images] ⤒  │  ← tab buttons become bottom-sheet triggers
└─────────────────────────────┘
       ↑ tapping a tab opens a BOTTOM SHEET hosting the SAME panel body
```

**What to MODIFY vs REUSE (explicit):**

| Component (path) | Action | How |
|---|---|---|
| `slide-editor.tsx` (root return, ~L1497–2046) | **MODIFY** | Add a mobile arrangement: render the three children in canvas-first order on small screens; route the three tab panels through a bottom sheet instead of the inline right-`<aside>` scroll body. This is JSX re-arrangement + a `useMediaQuery`/`lg:` conditional — NOT a logic rewrite. All the `dispatch`/handler wiring (the ~500 lines of callbacks L1603–1748) stays byte-identical. |
| `SlideCanvas` (`slide-canvas.tsx`) / `SlidePreview` (`slide-preview.tsx`) | **REUSE unchanged** | Per STACK, touch drag/select/rotate already work (Pointer Events + `setPointerCapture` + react-rnd + `touch-action:none`). The canvas gets more height *for free* once siblings collapse. The only canvas-area edits are tap-target sizing of handles (Q3) and the verify/repair of tap-to-edit-text (`onTextBoxSelect`/`onTextBoxTextEdit` already wired at L1629/L1644). |
| `TextEditorPanel` (`editor/text-editor-panel.tsx`) + `text-rail/*` internals | **REUSE as sheet body** | Re-host the component inside the sheet; its internals (`ActiveTextBoxCard`, `EffectRow`, `LayerStrip`, `AccentWordsDisclosure`, `decoration-card`) are container-agnostic. Same props, same callbacks. |
| `ElementsPanel` (`editor/elements-panel.tsx`) | **REUSE as sheet body** | Mount in the sheet; carries SlideSettings + WatermarkControls + decoration library/inspector. No prop change. |
| `ImagePickerPanel` (`editor/image-picker-panel.tsx`) | **REUSE as sheet body** | Mount in the sheet. No prop change. |
| `SlideList` (`editor/slide-list.tsx`) + `sortable-slide.tsx` | **MODIFY (host) / REUSE (item)** | Re-host as a thin horizontal filmstrip with edge-fade/peek affordance (FEATURES). The thumbnail item logic is reused; only the container layout + scroll affordance change. |
| `LayersPanel` (`editor/layers-panel/`) | **MODIFY (host)** | Demote from always-visible to on-demand on mobile (e.g. a second sheet tab or a toggle) — it currently sits below the filmstrip in the left aside and eats height. Reuse internals. |
| Pinned Undo/Redo/Public/Export portlet (`slide-editor.tsx:1999–2044`) | **MODIFY (placement + sizing)** | Becomes a persistent, safe-area-padded bottom action bar; Undo/Redo + Export must hit 44px (Q3). Logic (`undo`/`redo`/`setExportDialogOpen`/`VisibilityDropdown`) unchanged. |

**Why this is a re-host, not a rewrite:** every panel already receives its full prop surface and dispatches into the existing reducer. Moving `<TextEditorPanel … />` from an inline `<aside>` into `<Sheet><SheetContent><TextEditorPanel … /></SheetContent></Sheet>` changes the *container*, not the panel. The `activeTab` state (`setActiveTab`, L1759/1769/1779) already drives which panel shows — on mobile that same state drives which sheet content is shown, plus a "sheet open/closed" boolean.

**The one genuine risk (not a layout problem):** tap-to-edit-text on touch (AUDIT's #1 risk). The plumbing exists (`onTextBoxSelect` → `requestPanelFocus('text')` at L1635; double-click in-place edit `onTextBoxTextEdit` at L1644). The work is *verifying on a real device that the touch event path fires the keyboard and mirrors the rail/sheet*, and repairing if not — gate this BEFORE building the sheet rework, because the sheet's TEXT tab is worthless if selection doesn't fire.

---

### Q3 — Reusable tap-target / hit-area approach: shared component or ad hoc?

**Tap targets are almost entirely ad hoc today.** Two parallel realities:

1. There IS a shared `Button` primitive (`src/components/ui/button.tsx`, base-ui + cva). But its icon sizes top out at `size-9` = **36px** (`icon-lg`), and the smaller `icon`/`icon-sm`/`icon-xs` are 32/28/24px — all below the 44px HIG target. It also is **not what the editor uses**.
2. The **editor chrome uses raw `<button className="p-1.5 …"><Icon …/></button>`** — see `slide-editor.tsx:1532` (add slide), 1542 (dup), 1552 (del), 1560 (add text), 2001/2009 (undo/redo). `p-1.5` around a ~20px icon ≈ 32–36px hit area. This is the source of AUDIT X2's "46 sub-40px targets in the editor."

**Recommendation (matches STACK):** add ONE Tailwind v4 custom utility in `globals.css` (which already uses `@layer base` and `@theme inline`, so `@utility` is the idiomatic spot), and sweep it onto the editor's raw icon buttons + the `Button` primitive's icon sizes:

```css
/* src/app/globals.css */
@utility tap-44 { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
```

For dense affordances where 44px visual padding would break layout (filmstrip chips, rotation handle), reuse the **v2.10 inset-pseudo-expander pattern already in this repo** (`inset:-10px` wrapper, glyph stays small, hit area grows) — FEATURES and STACK both point at it; `decoration-rotation-handle.tsx` is the reference. Do NOT scale glyphs up.

**Do not try to funnel the editor's raw buttons through the `Button` primitive in this milestone** — that's a larger refactor with regression surface across the whole editor. The minimal, safe move is the `tap-44` utility + `min-h-11 min-w-11` applied to the ~10 editor chrome buttons and the public-viewer chevrons. Use the existing Playwright sub-44 probe (written for the AUDIT) as the regression gate.

**Also: input font-size.** The shared `Input` primitive (`ui/input.tsx`) already renders `text-base` (16px) on mobile and only `md:text-sm` on desktop — so it does NOT trigger iOS auto-zoom. Good. But the editor and the prompt textarea use raw inputs/textareas; audit those for `<16px` and the placeholder-contrast fix (AUDIT X3) as a foundation-phase chore.

---

### Q4 — Responsive breakpoint strategy: is the app already doing a mobile/desktop split, and where are the seams?

**Yes — the app already has an established, consistent mobile/desktop split. Follow it; do not invent a new system.** The seams:

- **`md:` (768px) = "is this a phone?"** boundary for navigation chrome. `BottomNavbar` is `md:hidden` (mobile-only tab bar). `sidebar-nav.tsx` is `hidden md:flex` (desktop-only sidebar). `dashboard-shell.tsx:22` uses `pb-24 md:pb-8` (clear the mobile bottom nav). This is the canonical "show mobile nav / show desktop nav" line.
- **`lg:` (1024px) = "is the editor wide enough for 3 panels?"** boundary inside the editor. `slide-editor.tsx:1501` `lg:grid-cols-[260px_1fr_340px]`, `lg:h-[calc(100vh-80px)]`, `lg:rounded-xl`, `lg:gap-3 lg:px-2 lg:py-2`. Below `lg` the editor is the stacked single-column mobile layout.
- **`isFullBleed` runtime branch** (`dashboard-shell.tsx:15`, `pathname.startsWith('/project/')`) — a JS (not CSS) seam that swaps the whole shell between scrolling-page mode and pinned-editor mode. The editor mobile work lives almost entirely inside this branch.

**Implication for the roadmapper:** the editor mobile rework hangs off the existing `lg:` seam (everything below `lg` is "mobile editor"). Cross-cutting nav/safe-area work hangs off the existing `md:` seam. No new breakpoint tokens needed — Tailwind v4 defaults (`sm/md/lg`) are already in use and consistent. Where a JS check is needed (e.g. "render the sheet vs the inline aside"), mirror the existing `usePathname`-based `isFullBleed` pattern with a small `useMediaQuery('(min-width: 1024px)')` or pass a server-detected hint — but prefer CSS `lg:` conditionals wherever the markup can simply reflow.

---

### Q5 — Bottom-sheet primitive: reuse or build?

**Verdict: BUILD a thin `Sheet` primitive on top of the already-installed `@radix-ui/react-dialog` — do NOT add a new heavy dependency, and do NOT hand-roll the overlay/focus-trap/scroll-lock from scratch.**

Evidence:
- There is **no existing sheet/drawer primitive** in `src/components/ui/` (confirmed: `dialog.tsx`, `card.tsx`, `input.tsx`, `switch.tsx`, `button.tsx`, `label.tsx`, plus loaders — no sheet).
- `@radix-ui/react-dialog@^1.1.15` **is already installed** and is already wrapped by `src/components/ui/dialog.tsx` (the team's shadcn-style Dialog). The Radix Dialog primitive is the standard base for a bottom sheet — the same `Root`/`Portal`/`Overlay`/`Content` parts, just positioned at `bottom-0` with a slide-up animation instead of centered zoom. shadcn's own `Sheet` is literally Radix Dialog restyled.
- This gives correct focus-trap, `Esc`-to-close, scroll-lock, and the close-without-leaving-a-blocking-overlay guarantee the existing `dialog.tsx` header comment already calls out — for free, with a primitive the team already maintains.

**Recommended new component: `src/components/ui/sheet.tsx`** — a sibling of `dialog.tsx` exporting `Sheet`, `SheetContent` (side="bottom", rounded-top, `max-h-[85dvh]`, `pb-[env(safe-area-inset-bottom)]`), `SheetHeader`, `SheetTitle`, `SheetClose`. Mirror `dialog.tsx` structure exactly so the codebase stays consistent.

**One caveat for FEATURES' "non-modal/persistent so the canvas stays interactive":** Radix Dialog is modal by default (overlay blocks the canvas). For the editor tool sheet you want the canvas to remain pannable while the sheet is open. Two options for the roadmapper:
- **v2.17 default (recommended):** ship a **modal** sheet (Radix default). Simpler, correct focus behavior; the user taps a tab → sheet opens → adjusts → dismisses. This is Canva/CapCut's actual behavior (the drawer is modal-ish; you dismiss to return to canvas). Lowest risk.
- **If true non-modal is required:** Radix Dialog supports `modal={false}` (no overlay, no scroll-lock, canvas stays live). Use this only if device testing shows the modal flow feels wrong. **OR** add `vaul` (the Radix-based drawer lib with drag-to-dismiss + non-modal support) — but treat that as an *optional upgrade*, not the v2.17 baseline. Default to building on the already-present Radix Dialog.

**Reuse for the Export flow specifically:** the editor already has `export-format-dialog.tsx` and `publish-modal.tsx` using the dialog pattern — these are fine as-is on mobile (centered dialogs read acceptably at 393px); they do not need to become sheets in v2.17.

---

### Q6 — Build order: foundation before editor rework

**Hard dependency:** safe-area insets must be populated (viewport export) before any fixed-bar or sheet placement is correct, and tap-to-edit-text must be *verified* before the sheet rework is worth building. Ordered sequence:

```
PHASE A — Cross-cutting foundation  (no editor structural change; unblocks everything)
  A1. layout.tsx: add `viewport` export (viewport-fit=cover)         [global, 1 line]
  A2. bottom-navbar.tsx + dashboard-shell.tsx + editor portlet:
      consume env(safe-area-inset-*) on fixed bars                    [AUDIT X1]
  A3. globals.css: add `@utility tap-44`; sweep editor chrome buttons
      + public-viewer chevrons to 44px (reuse v2.10 inset pattern)    [AUDIT X2]
  A4. input/textarea audit: ensure >=16px on mobile (Input primitive
      already ok); fix prompt placeholder contrast                    [AUDIT X3]
  A5. slide-editor.tsx:1498: 100vh -> 100dvh                          [iOS height]
        ▲ A1 must precede A2 (env vars are 0 until viewport-fit set)

PHASE B — Editor touch validation  (gate; mostly verify/repair, little new code)
  B1. Real-device/Simulator: verify tap a text element -> selection
      fires + keyboard opens (onTextBoxSelect/onTextBoxTextEdit paths)
  B2. Repair if broken (touch event path / requestPanelFocus / rail mirror)
        ▲ Depends on A (44px targets make the element tappable at all).
          MUST pass before C — the sheet's TEXT tab is useless otherwise.

PHASE C — Bottom-sheet primitive  (new component; reused by D)
  C1. Build src/components/ui/sheet.tsx on @radix-ui/react-dialog
      (side=bottom, max-h-[85dvh], safe-area padding)
        ▲ Depends on A1/A2 (sheet bottom padding needs the inset vars).

PHASE D — Editor mobile layout rework  (re-host, not rewrite)
  D1. slide-editor.tsx mobile arrangement: canvas-first; collapse left
      aside; re-host SlideList as thin filmstrip w/ peek affordance
  D2. Route TEXT/ELEMENTS/IMAGES panels through <Sheet> on mobile
      (reuse TextEditorPanel/ElementsPanel/ImagePickerPanel unchanged)
  D3. Demote LayersPanel to on-demand; persistent safe-area bottom
      action bar (Undo/Redo/Public/Export, 44px)
        ▲ Depends on B (verified selection) + C (the Sheet primitive).

PHASE E — App-wide polish  (parallelizable after A)
  E1. Template picker: horizontal row -> scannable grid (reuse
      TemplateTilePreview tiles)
  E2. Settings sub-nav affordance; filmstrip/chip sizing; public-viewer
      swipe-to-advance
  E3. Logged-out pass (landing + auth at 393px) — BLOCKED on a login
      credential (AUDIT "Not audited"); sequence last / independently
```

**Dependency rationale:** A unblocks B, C, D, E (you cannot correctly place a bottom bar or sheet, nor reliably tap a 36px element, until A lands). B is a *gate*, not a build — it must pass before D2's TEXT sheet is meaningful. C is a small new primitive D depends on. D is the heavy re-host work. E is independent polish that only needs A. E3 (logged-out) is externally blocked and should be sequenced so it doesn't stall the editor track.

---

## Component Inventory — new vs modified (consolidated for the roadmapper)

| Path | New / Modified / Reuse | Note |
|---|---|---|
| `src/app/layout.tsx` | **Modify** | Add `viewport` export (A1) |
| `src/components/layout/bottom-navbar.tsx` | **Modify** | `env(safe-area-inset-bottom)` (A2) |
| `src/components/layout/dashboard-shell.tsx` | **Modify** | Safe-area on editor shell top/bottom (A2); optional `min-h-dvh` |
| `src/app/globals.css` | **Modify** | `@utility tap-44`; tap-highlight reset; placeholder contrast (A3/A4) |
| `src/components/ui/sheet.tsx` | **NEW** | Bottom-sheet on Radix Dialog (C1) |
| `src/components/editor/slide-editor.tsx` | **Modify** | dvh swap (A5); mobile arrangement + sheet routing (D1/D2/D3); 44px chrome buttons (A3) |
| `src/components/editor/slide-list.tsx` + `sortable-slide.tsx` | **Modify (host)** | Thin filmstrip + peek affordance (D1) |
| `src/components/editor/layers-panel/*` | **Modify (host)** | Demote to on-demand (D3) |
| `src/components/editor/text-editor-panel.tsx` + `text-rail/*` | **Reuse** | Re-hosted into Sheet (D2) |
| `src/components/editor/elements-panel.tsx` | **Reuse** | Re-hosted into Sheet (D2) |
| `src/components/editor/image-picker-panel.tsx` | **Reuse** | Re-hosted into Sheet (D2) |
| `src/components/editor/slide-canvas.tsx` + `src/components/slides/slide-preview.tsx` | **Reuse** | Gains height for free; only handle hit-areas + tap-to-edit verify (B) |
| `src/components/slides/decoration-rotation-handle.tsx` | **Modify (hit area)** | Bigger touch target (reuse inset pattern) |
| `src/components/editor/export-format-dialog.tsx`, `publish-modal.tsx` | **Reuse** | Centered dialogs read fine at 393px; no sheet conversion needed |
| `src/components/slides/template-picker.tsx` | **Modify** | Row → grid (E1); reuse `template-tile-preview.tsx` |
| `src/components/ui/button.tsx` | **Optional modify** | Could add 44px icon size; NOT required (editor uses raw buttons). Defer. |

---

## Anti-patterns to avoid (codebase-specific)

| Anti-pattern | Why it's wrong HERE | Instead |
|---|---|---|
| Rewriting the editor's panel components for mobile | The 3 panels already take full props + dispatch into the reducer; rewriting risks the TPLREND-05 parity + reducer contracts the whole app depends on | Re-host the *containers* (aside → sheet, row → grid); keep internals byte-identical |
| Funneling all editor chrome buttons through `Button` primitive in v2.17 | Large refactor across the editor; `Button` icon sizes are also sub-44px anyway | Add `tap-44` utility + `min-h-11`/`inset:-10px` to the ~10 raw buttons only |
| Adding a new global "AppFrame" wrapper for safe-area | No single shell all surfaces pass through; 8+ independent `min-h-screen` roots | Viewport export (global) + `env()` on the handful of `fixed` bars |
| Porting marquee/group/multi-select to touch | FEATURES anti-feature: finger-imprecise, fights pan; the desktop-only layout already isolates this | Single-finger = move element; leave marquee desktop-only |
| Hand-rolling the bottom sheet's overlay/focus-trap | Radix Dialog (already installed) gives it correctly, incl. the no-residual-overlay guarantee dialog.tsx already documents | `src/components/ui/sheet.tsx` on `@radix-ui/react-dialog` |
| Static `100vh` anywhere editor-height-relevant | iOS overshoot hides the bottom edge (the bug this milestone exists to fix) | `dvh` (`slide-editor.tsx:1498`) |

---

## Open questions / flags for phase-specific research

- **Tap-to-edit-text on touch (B1)** — flagged unverified by the AUDIT; the plumbing exists but real-device behavior (does the keyboard open, does `requestPanelFocus`/sheet mirror selection) is unconfirmed. Budget a Simulator/device pass; Playwright will not reproduce iOS keyboard overlay (per STACK §6).
- **Modal vs non-modal sheet** — recommend modal for v2.17 (lowest risk); revisit `modal={false}`/`vaul` only if device testing shows the modal dismiss-to-canvas flow feels wrong.
- **Keyboard-aware sheet** — when the TEXT sheet is open and an input is focused, the iOS keyboard + the bottom sheet + safe-area interact. `interactiveWidget:'resizes-visual'` + `dvh` + `max-h-[85dvh]` should handle it, but verify on device (STACK §6).
- **react-rnd handles under the sheet** — confirm the sheet's portal z-index and the canvas's react-rnd handles don't fight pointer capture when the sheet is open (low risk; modal sheet blocks canvas anyway).

---

## Sources

- Repo files read directly (HIGH): `src/app/layout.tsx` (no viewport export), `src/components/layout/dashboard-shell.tsx` (isFullBleed `fixed inset-0` branch L15/L19/L21), `src/components/layout/bottom-navbar.tsx` (`md:hidden fixed bottom-0 pb-6` L25), `src/app/(dashboard)/project/[id]/page.tsx` (SlideEditor mount), `src/components/editor/slide-editor.tsx` (root `h-[calc(100vh-140px)]` L1498; `grid-cols-1 lg:grid-cols-[…]` L1500-1501; LEFT aside L1508 + SlideList L1576 + LayersPanel L1590; SlideCanvas L1603 with onTextBoxSelect L1629/onTextBoxTextEdit L1644; RIGHT aside L1755 with tab buttons L1757-1788 + panels TextEditorPanel L1803 / ElementsPanel L1895 / ImagePickerPanel L1977; pinned Undo/Redo/Public/Export portlet L1999-2044; raw `p-1.5` icon buttons L1532/1542/1552/1560/2001/2009), `src/components/editor/slide-canvas.tsx`, `src/components/ui/dialog.tsx` (Radix Dialog wrapper), `src/components/ui/button.tsx` (base-ui+cva, icon sizes ≤36px), `src/components/ui/input.tsx` (`text-base md:text-sm` → 16px on mobile), `src/components/ui/icon.tsx` (Material Symbols), `src/components/layout/sidebar-nav.tsx` (`hidden md:flex`), `package.json` (`@radix-ui/react-dialog@^1.1.15` present; no vaul; Tailwind v4; base-ui), `src/app/globals.css` (`@theme inline`, `@layer base`, no `@utility` yet), `src/components/editor/text-rail/*` listing.
- `.planning/research/STACK.md` (HIGH) — viewport export, dvh, env() Tailwind v4 wiring, Pointer Events / react-rnd reuse, no gesture lib, tap-44 utility, sheet caveats.
- `.planning/research/FEATURES.md` (HIGH) — re-host rails into bottom sheets (not rebuild), chrome-collapse, 44px taps, filmstrip affordance, picker grid, anti-features (no marquee on touch, no FAB).
- `.planning/mobile-audit/AUDIT.md` (HIGH, project-grounded) — X1 safe-area, X2 46 sub-40px editor targets, X3 contrast; editor as #1 risk; tap-to-edit unverified.

---
*Architecture research for: mobile-first integration into the existing Next.js 15 + React 19 + Tailwind v4 editor app (v2.17 Mobile Optimization)*
*Researched: 2026-05-31*
