# Stack Research — v2.17 Mobile Optimization

**Domain:** Mobile-first / iOS-Safari correctness for an existing Next.js 15 + React 19 + Tailwind v4 web app (TikTok carousel editor). Primary target: iPhone 15 / iOS Safari, 393×852 logical, `viewport-fit=cover`.
**Researched:** 2026-05-31
**Confidence:** HIGH

> **Scope note (read this first).** This is a SUBSEQUENT-milestone (v2.17) stack pass, not a greenfield one. The framework stack is already fixed and out of scope: **Next.js 15.5.13 (App Router, Turbopack), React 19.1.0, TypeScript, Tailwind CSS v4 (CSS-first, no JS config — `@tailwindcss/postcss`), Supabase auth, Vercel.** This document only covers what to **add or change** to make the app correct on iOS Safari / iPhone 15.
>
> **The headline finding: this is overwhelmingly a CSS + one-line-config milestone, NOT a "add a library" milestone.** The editor canvas already drives drag/select/rotate through **Pointer Events + `setPointerCapture` + `touch-action: none`** (see `slide-preview.tsx`, `decoration-rotation-handle.tsx`) and **react-rnd** (already installed, touch-capable). The correct recommendation for almost every line item below is **add zero dependencies** and use the web platform + Tailwind utilities the project already has.

---

## Recommended Stack

### Core Technologies (already present — used differently, NOT added)

| Technology | Version (installed) | Purpose for this milestone | Why it's the right tool for iOS Safari |
|------------|--------------------|----------------------------|----------------------------------------|
| Next.js App Router `viewport` export | 15.5.13 | Emit `<meta name="viewport" … viewport-fit=cover>` so `env(safe-area-inset-*)` get populated | This is the **only** supported way to set `viewport-fit=cover` in App Router. Without it, the safe-area env vars are all `0` and the fixed bottom nav collides with the home indicator (AUDIT finding X1). |
| Tailwind CSS v4 | `^4` | Dynamic-viewport height utilities (`h-dvh`/`min-h-svh`), `touch-*` utilities, arbitrary `env()` values | v4 ships `h-dvh`/`h-svh`/`h-lvh` and `touch-pan-*`/`touch-none`/`touch-manipulation` **built in** (the repo already uses `touch-pan-y` in `showcase-carousel.tsx`). `env(safe-area-inset-*)` works via arbitrary values `pb-[env(safe-area-inset-bottom)]` or a theme token — no plugin needed. |
| Pointer Events API | platform | All touch drag/select/(optional pinch) on the editor canvas | Already the editor's foundation. One unified event model for mouse + touch + pen; `setPointerCapture` keeps a drag alive when the finger leaves the element. iOS Safari has shipped Pointer Events since iOS 13. **No gesture library needed.** |
| react-rnd | `^10.5.3` (latest 10.5.3) | Existing on-canvas text-box drag/resize | Already wired to "both mouse and touch handlers (react-rnd contract)" per `slide-preview.tsx:2044`. Touch already works; the milestone job is **tap-target sizing of its handles**, not replacing it. |
| CSS `env()` + `dvh` units | platform | Safe-area insets + correct full-height | Native iOS-Safari-correct primitives. `100dvh` is the documented fix for the iOS `100vh` "address-bar overshoot" bug. |
| VirtualKeyboard via `interactiveWidget` | platform / Next `viewport` | Keep editor chrome correct when the iOS keyboard opens | Next's `Viewport.interactiveWidget: 'resizes-visual'` + `dvh` units handle the common case without JS. The `visualViewport` API is the escape hatch if a pinned element must track the keyboard precisely. |

### Supporting Libraries

**Recommended default: add NOTHING.** Every requirement in the question is satisfiable with the platform + Tailwind v4 + existing deps. The table below is the *conditional* shortlist — add an item ONLY if the corresponding trigger fires during implementation.

| Library | Version | Purpose | Add ONLY if… |
|---------|---------|---------|--------------|
| `tailwindcss-safe-area` | `^0.6.0` (v4-compatible) | Sugar utilities `pb-safe`, `min-h-safe`, `bottom-safe`, `inset-safe` instead of `pb-[env(safe-area-inset-bottom)]` | …the team finds the arbitrary-value `env()` syntax too noisy across many files and wants named utilities. **Pure DX sugar — not a capability gap.** Default = skip it; arbitrary values are fine for the ~3 fixed bars. |
| `@use-gesture/react` | `10.3.1` | Declarative pinch/drag/wheel gesture binding | …you decide to ship **pinch-to-zoom / two-finger scale of text elements** AND the hand-rolled two-pointer math in Pointer Events proves error-prone. See the dedicated section below — **recommendation is to NOT add it for v2.17.** |

### Development / Verification Tools (already present)

| Tool | Purpose | Notes |
|------|---------|-------|
| Playwright `^1.58.2` | iPhone-15 viewport regression (the AUDIT was built with it) | Use 393×852 + `hasTouch`. Note the headed-window dpr clamp documented in AUDIT.md (request a pre-divided size). Playwright emulates touch but **does NOT reproduce the real iOS safe-area inset, the `100vh` bug, or keyboard-overlay behavior** — those need a real device or the iOS Simulator for final sign-off. |
| iOS Simulator (Xcode) / real iPhone 15 | Final visual sign-off for safe-area + keyboard | The only faithful check for `env(safe-area-inset-*)` rendering and VirtualKeyboard resize behavior. |

---

## The six questions, answered with exact syntax

### 1. iOS safe-area handling (`viewport-fit=cover` + `env()` + Tailwind wiring)

**Step A — set `viewport-fit=cover` via the App Router `viewport` export (HIGH, verified via Context7 `/vercel/next.js`).**
Add to `src/app/layout.tsx` (this file currently has `metadata` but **no `viewport` export** — confirmed):

```ts
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',          // → emits viewport-fit=cover; this is what populates env(safe-area-inset-*)
  // maximumScale: 1,            // see double-tap-zoom note in §3 before enabling — prefer NOT to
  // interactiveWidget: 'resizes-visual',  // see §6
}
```

The `viewportFit` key is a first-class property of Next's `Viewport` type (camelCase → rendered as `viewport-fit=cover`). This is the canonical, only-supported way in App Router — do **not** hand-write a `<meta name="viewport">` in `<head>`.

**Step B — consume the insets.** Pure CSS env vars become available: `env(safe-area-inset-top|right|bottom|left)`.

**Step C — wire into Tailwind v4.** Two interchangeable approaches; pick ONE for consistency.

- **Arbitrary values (recommended default, zero deps):**
  ```tsx
  // bottom-navbar.tsx — replace the static `pb-6`
  <nav className="… fixed bottom-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] …">
  ```
  Use `max(…)` so devices without an inset still keep the original 24px breathing room.

- **Theme tokens (optional, for reuse) — Tailwind v4 CSS-first in `globals.css`:**
  ```css
  @theme {
    --spacing-safe-b: env(safe-area-inset-bottom);
    --spacing-safe-t: env(safe-area-inset-top);
  }
  /* → enables `pb-safe-b`, `pt-safe-t`, etc. */
  ```

**Exact integration points in THIS codebase:**
- `src/app/layout.tsx` — add the `viewport` export (currently absent).
- `src/components/layout/bottom-navbar.tsx:25` — swap static `pb-6` → `pb-[max(1.5rem,env(safe-area-inset-bottom))]` (AUDIT X1).
- `src/components/layout/dashboard-shell.tsx:19` — the `fixed inset-0` editor shell should also respect top/bottom insets where its chrome bars sit.
- Any other `fixed`-positioned bar (editor Public/Export bar, top nav on iOS).

---

### 2. Dynamic viewport units (`dvh`/`svh`/`lvh`) vs the iOS `100vh` bug

**Problem (HIGH):** On iOS Safari, `100vh` equals the **largest** viewport (address bar retracted), so `height:100vh` elements are taller than the visible area and the bottom is cut off behind the toolbar — the classic "fixed bottom nav pushed off-screen" bug.

**Fix:** use dynamic viewport units. Tailwind v4 utilities map 1:1:
- `h-dvh` / `min-h-dvh` → `100dvh` — resizes live as the browser chrome shows/hides. **Use this for the editor's full-height shell and canvas column.**
- `h-svh` → `100svh` (smallest viewport — chrome visible). Use when you must guarantee content never hides behind the address bar even at first paint.
- `h-lvh` → `100lvh` (largest). Rarely what you want on iOS.

**Recommendation:**
- The editor shell (`dashboard-shell.tsx` `fixed inset-0` branch) and the 9:16 canvas height budget: use **`dvh`** (the `min-h-0` flex children are already in place; switch any `100vh`/`h-screen` to `h-dvh`).
- The fixed bottom nav itself is `bottom-0` anchored, so it doesn't need a height unit — but anything that computes "available height above the nav" should subtract from `100dvh`, not `100vh`.
- Grep the codebase for `h-screen`, `min-h-screen`, `100vh`, `vh]` and convert the mobile-relevant ones to `dvh`/`svh`. (`min-h-screen` is on the non-editor shell branch in `dashboard-shell.tsx:19` — acceptable for scrolling pages, but `min-h-dvh` is the safer swap on iOS.)

Browser support is fine: `dvh`/`svh`/`lvh` shipped in iOS Safari 15.4+ (well below the iPhone 15 / iOS 17+ baseline).

---

### 3. Touch correctness

All of these are **platform CSS / event-handling**, zero deps.

| Concern | Fix | Where / why for iOS Safari |
|---------|-----|----------------------------|
| **Drag must not scroll/zoom the page** | `touch-action: none` on draggable elements (Tailwind `touch-none`) | Already applied on `decoration-rotation-handle.tsx:221`. Extend the same discipline to the canvas drag surface and react-rnd handles. `touch-action: none` is what makes Pointer Events reliably win over native scroll on iOS. |
| **Allow page scroll but capture horizontal drag** | `touch-action: pan-y` (Tailwind `touch-pan-y`) | Already used on `showcase-carousel.tsx:92`. Pattern for horizontal filmstrips/carousels where vertical page scroll must still work. |
| **Double-tap zoom on buttons** | `touch-action: manipulation` (Tailwind `touch-manipulation`) on interactive controls | iOS Safari adds a ~300ms delay + double-tap-to-zoom on tappable elements. `manipulation` disables double-tap-zoom while **keeping** pinch-zoom of the page. **Prefer this over `maximumScale:1`/`userScalable:false`** — disabling user zoom globally is a WCAG 1.4.4 accessibility failure. Apply per-control (or to a base button class), not globally. |
| **Grey tap flash** | `-webkit-tap-highlight-color: transparent` | iOS draws a translucent grey box on tap. Set once globally in `globals.css` (e.g. on `html`/`body` or a base button rule). The app already uses `active:bg-*` states for press feedback, so the native highlight is redundant. |
| **Momentum / rubber-band on scroll containers** | `overflow-y: auto` already gives iOS momentum (legacy `-webkit-overflow-scrolling: touch` is no longer required on modern iOS); add `overscroll-behavior: contain` (Tailwind `overscroll-contain`) | On the editor's scroll panes and the `<main>` scroller (`dashboard-shell.tsx:21`), `overscroll-contain` stops the rubber-band from bubbling to the whole page and prevents the "pull past the end scroll-chains into the fixed shell" glitch. Use `overscroll-none` on the fixed editor shell so the canvas area can't rubber-band at all. |
| **Pointer vs Touch events** | Use **Pointer Events** (already the codebase choice) | Don't introduce raw `TouchEvent` handlers. Pointer Events unify mouse/touch/pen, support `setPointerCapture`, and are what react-rnd + the existing marquee/rotation code already use. Mixing in `onTouchStart` invites double-fire and passive-listener `preventDefault` headaches. |

**iOS gotcha to flag for the roadmap:** React attaches listeners as **passive** by default via JSX props, so `e.preventDefault()` inside an `onTouchMove`/`onWheel` JSX handler is silently ignored on iOS. The codebase sidesteps this by using Pointer Events + `touch-action` CSS (the correct approach). If any new code needs `preventDefault` on a scroll/touch/wheel event, it must attach a **non-passive** listener manually via `ref` + `addEventListener(..., { passive: false })` — not a JSX prop. (This is exactly why `@use-gesture` documents its `target` + `eventOptions:{passive:false}` option — verified via Context7.)

---

### 4. Tap-target sizing (44×44 CSS px minimum) — utility/pattern, not per-component hacks

AUDIT X2 found **46 sub-40px interactive elements in the editor alone** (header icon 32px, toolbar icons 36px, slide/layer chips 80×22, chevrons 28–32px). Apple HIG min is **44×44**; WCAG 2.5.8 AA min is **24×24** (the project already references WCAG 2.5.8 in v2.10). Target **44** for primary nav/controls, accept **24** hit-area as the floor for dense editor affordances.

**Recommended pattern (zero deps): a reusable hit-area utility, applied via className — not bespoke padding per component.**

Two equivalent mechanisms; choose one:

- **Tailwind v4 custom utility (CSS-first, recommended):**
  ```css
  /* globals.css */
  @utility tap-44 {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  ```
  Then `className="tap-44"` on icon buttons. For a 24px visual icon that must keep a 44px **hit** area without affecting layout, use an inset pseudo-expander (the v2.10 pattern already in this repo): visual glyph stays small, an `::before { position:absolute; inset:-10px }` grows the touch target.

- **Or compose existing utilities** (`min-h-11 min-w-11 inline-flex items-center justify-center`, since Tailwind `11` = 44px) where adding a custom utility is overkill.

**Anti-pattern to avoid:** scaling the visible icon up to 44px — it looks clumsy. Keep the glyph at its design size and expand the **hit area** (padding or inset pseudo-element). This is a global sweep concern; do it with the shared utility + a button base class, not ad-hoc per file. Use the Playwright sub-44 probe (already written for the AUDIT) as the regression gate.

---

### 5. Editor touch canvas — gesture library, or Pointer Events?

**Recommendation: do NOT add `@use-gesture/react` (or any gesture lib) for v2.17. Stay on Pointer Events + react-rnd.**

**Why (codebase evidence):** The editor canvas already implements a full touch-capable interaction layer with the platform:
- Marquee select: `onPointerDown/Move/Up` state machine on the canvas root with `setPointerCapture(e.pointerId)` so the drag survives the pointer leaving the canvas (`slide-preview.tsx` ~lines 1798–1851).
- Element drag/resize: **react-rnd**, explicitly wired for "both mouse and touch handlers (react-rnd contract)" (`slide-preview.tsx:2044`).
- Rotation: a self-contained Pointer-Events handle with `touch-action:none` (`decoration-rotation-handle.tsx`).

Single-pointer gestures (tap-select, drag-move, drag-resize, drag-rotate) — i.e. **everything v2.17 needs to make touch editing work** — are already covered. Adding a gesture library would mean **rewriting working, tested drag code** to gain nothing.

**The only thing Pointer Events doesn't give you "for free" is multi-touch pinch-to-zoom/scale** (two simultaneous pointers → distance delta). Tradeoff:

| Option | Pinch-zoom text elements | Cost | Verdict for v2.17 |
|--------|--------------------------|------|-------------------|
| **Pointer Events (status quo)** | Hand-roll: track two active `pointerId`s in a `Map`, compute distance ratio on `pointermove`. ~40–60 lines, well-documented pattern. | 0 deps, no rewrite of existing single-pointer code | **Recommended.** Corner-resize already scales font+width (v2.10); a two-finger pinch is a *nice-to-have*, not a table-stakes mobile fix. |
| **`@use-gesture/react` 10.3.1** | `usePinch`/`useDrag` declarative, handles two-pointer math + inertia | +1 dep, but you must still set `touch-action:none` yourself, manage non-passive listeners via its `target`/`eventOptions`, and reconcile it with react-rnd's own drag (risk of double-handling the same `pointerId`) | Add **later** (v2.18+) only if pinch becomes a real requirement and the hand-rolled version is unsatisfactory. Not for this milestone. |

**Bottom line:** v2.17's #1 editor risk (per AUDIT) is "**can a user tap a text element to edit it on touch?**" — that's a tap-target + selection + keyboard problem, **not** a gesture-engine problem. Solve it with the existing Pointer-Events plumbing and 44px hit areas. Defer pinch.

---

### 6. On-screen keyboard / VirtualKeyboard in a fixed-layout editor on iOS

This is the subtlest iOS issue and deserves an explicit research flag for the editor phase.

**The problem:** the editor shell is `position:fixed; inset:0` (`dashboard-shell.tsx:19`). On iOS Safari, when the soft keyboard opens, Safari by default **does NOT resize the layout viewport** — it scrolls the page and overlays the keyboard, which can shove a `fixed` bottom bar/canvas under the keyboard or leave the focused input hidden behind it.

**Layered fix (cheapest first):**

1. **`interactiveWidget: 'resizes-visual'`** in the `viewport` export (Next supports this key, confirmed via Context7). Combined with `dvh` heights, this is the lowest-effort improvement and the right default to ship.
2. **Use `dvh`/`svh`** for editor height (see §2) so the layout tracks viewport changes rather than assuming a static height.
3. **`visualViewport` API (escape hatch, only if needed):** if a specific element (e.g. a text-edit toolbar) must sit pinned directly above the keyboard, listen to `window.visualViewport`'s `resize`/`scroll` and translate the element by `visualViewport.height`/`offsetTop`. This is the platform-blessed way to track the keyboard precisely. **No library** — `visualViewport` is native and well-supported on iOS 13+.
4. **`scrollIntoView({ block: 'center' })` on focus** for text inputs that risk being occluded, as a robustness backstop.
5. The experimental **`VirtualKeyboard` API** (`navigator.virtualKeyboard.overlaysContent`) is **Chromium-only — NOT supported in iOS Safari.** Do **not** rely on it for the iPhone target; it's mentioned only to rule out. Stick with `interactiveWidget` + `dvh` + `visualViewport`.

**Roadmap flag:** the touch text-editing flow (AUDIT's "#1 risk to validate") intersects keyboard handling directly. Budget a real-device/Simulator verification pass here — Playwright will not faithfully reproduce iOS keyboard-overlay behavior.

---

## Installation

```bash
# DEFAULT PATH: nothing to install.
# Every requirement is met by the existing stack (Next viewport export,
# Tailwind v4 utilities, Pointer Events, react-rnd) + plain CSS env()/dvh.

# OPTIONAL — only if the team wants named safe-area utilities instead of
# arbitrary env() values (pure DX sugar):
npm install tailwindcss-safe-area      # v4-compatible

# OPTIONAL — only if pinch-to-zoom of text elements becomes a real requirement
# AND hand-rolled two-pointer math proves insufficient (defer past v2.17):
# npm install @use-gesture/react
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Pointer Events + react-rnd (existing) | `@use-gesture/react` 10.3.1 | Only if shipping multi-touch pinch/rotate gestures and the native two-pointer math is unmanageable. Not v2.17. |
| Arbitrary `env(safe-area-inset-*)` values | `tailwindcss-safe-area` plugin | If `env()` arbitrary syntax is repeated across many files and named utilities (`pb-safe`) materially improve readability. |
| `dvh`/`svh` units | JS `--vh` custom property (`window.innerHeight * 0.01` resize hack) | Legacy pre-iOS-15.4 only. **Obsolete** on the iPhone 15 target — `dvh` is native. Do not add the JS hack. |
| `touch-action: manipulation` (per control) | `maximumScale:1` + `userScalable:false` in viewport | Effectively never — disabling page zoom fails WCAG 1.4.4. Only consider `userScalable:false` if a hard product decision overrides accessibility (not recommended). |
| `interactiveWidget` + `dvh` + `visualViewport` | `VirtualKeyboard` API (`overlaysContent`) | Never for iOS — it's Chromium-only and absent in iOS Safari. |

---

## What NOT to Use / NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| A gesture library (`@use-gesture`, `hammerjs`, `interactjs`) for v2.17 | The editor's single-pointer drag/select/rotate already work via Pointer Events + react-rnd; adding one means rewriting tested code for no table-stakes gain | Existing Pointer Events + react-rnd |
| Hand-written `<meta name="viewport">` in `<head>` | App Router owns the viewport meta; a manual tag fights the framework and gets overridden | `export const viewport` in `layout.tsx` |
| The JS `--vh` / `window.innerHeight` resize hack | Obsolete since iOS 15.4; adds resize-listener jank | `h-dvh` / `min-h-dvh` |
| `userScalable: false` / `maximumScale: 1` to kill double-tap zoom | Disables pinch-zoom for low-vision users → WCAG 1.4.4 fail | `touch-action: manipulation` per interactive control |
| Raw `onTouchStart/Move/End` handlers in React | Passive-by-default → `preventDefault` silently ignored on iOS; double-fires alongside Pointer Events | Pointer Events (already the codebase standard) |
| `VirtualKeyboard` API for the iPhone target | Chromium-only; not in iOS Safari | `interactiveWidget:'resizes-visual'` + `dvh` + `visualViewport` |
| `-webkit-overflow-scrolling: touch` everywhere | No longer needed on modern iOS; momentum is default | Plain `overflow-y:auto` + `overscroll-contain` |
| Scaling icon glyphs up to 44px to meet tap targets | Looks clumsy, breaks visual rhythm | Keep glyph size; expand hit area via min-size utility or inset pseudo-element (the v2.10 pattern) |

---

## Stack Patterns by Variant

**If a fixed bar sits at a screen edge (bottom nav, editor export bar, top nav):**
- Pad with `env(safe-area-inset-*)` using `max(designPadding, env(...))`.
- Because the home indicator / notch / Dynamic Island will otherwise overlap the bar (AUDIT X1).

**If an element must fill the visible screen height (editor shell, canvas column):**
- Use `dvh` (`h-dvh`/`min-h-dvh`), not `vh`/`h-screen`.
- Because `100vh` overshoots the visible area on iOS and hides the bottom edge.

**If an element is draggable on touch (canvas, react-rnd handle, rotation handle):**
- Set `touch-action: none` (Tailwind `touch-none`) on it and drive it with Pointer Events.
- Because it stops iOS native scroll/zoom from stealing the gesture.

**If a container scrolls but is inside the fixed editor shell:**
- Add `overscroll-contain` (or `overscroll-none` on the fixed shell itself).
- Because it prevents rubber-band scroll-chaining to the body behind the fixed editor.

**If an interactive control is tappable but small (icon button, chip, chevron):**
- Apply the shared `tap-44` (or `min-h-11 min-w-11 inline-flex …`) hit-area utility.
- Because AUDIT X2 flags 46 sub-40px targets in the editor; do it once, globally.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next 15.5.13 `viewport` export | React 19.1.0 | `viewportFit` + `interactiveWidget` are stable `Viewport` keys (verified via Context7 `/vercel/next.js`). Server-Component export — `layout.tsx` is already a Server Component. |
| Tailwind v4 (`@tailwindcss/postcss`) | `h-dvh`/`h-svh`/`h-lvh`, `touch-*`, `overscroll-*`, arbitrary `env()` | All built into v4 core; no plugin. The repo already uses `touch-pan-y` (`showcase-carousel.tsx`), confirming utilities resolve. CSS-first config means custom utilities go in `globals.css` via `@utility`/`@theme`, **not** a `tailwind.config` (there is none). |
| `tailwindcss-safe-area` (if added) | Tailwind v4 | README documents explicit v4 support (`npm install tailwindcss-safe-area`, register in `globals.css`). Optional. |
| `@use-gesture/react` 10.3.1 (if added) | React 19 | Works with React 18/19. Must self-manage `touch-action` and non-passive listeners; reconcile with react-rnd to avoid double-handling the same `pointerId`. Defer. |
| react-rnd `^10.5.3` | React 19 | Already installed and touch-capable; no upgrade needed. |
| `dvh`/`svh`/`env(safe-area-inset-*)` | iOS Safari 15.4+ | Far below the iPhone 15 (iOS 17+) baseline — safe. |

---

## Sources

- Context7 `/vercel/next.js` — `generate-viewport.mdx`: confirmed `export const viewport: Viewport`, `viewportFit`, `width`, `initialScale`, `maximumScale`, `userScalable`, `interactiveWidget: 'resizes-visual'`, `themeColor`. **HIGH.**
- Context7 `/pmndrs/use-gesture` — `faq.mdx` / `options.mdx`: `touch-action:none` requirement, passive-listener limitation in React (must use `target` + `eventOptions:{passive:false}`), `touch-action:pan-y` for axis-locked drag. **HIGH.**
- Context7 `/mvllow/tailwindcss-safe-area` — confirmed Tailwind v4 support + `pb-safe`/`inset-safe`/`bottom-safe` utility surface. **HIGH.**
- `npm view` — `@use-gesture/react@10.3.1`, `react-rnd@10.5.3` (latest). **HIGH.**
- Repo evidence (read directly): `package.json` (Next 15.5.13, React 19.1.0, Tailwind v4, react-rnd 10.5.3, selecto 1.26.3, no `tailwind.config`); `src/app/layout.tsx` (no `viewport` export today); `src/app/globals.css` (`@import "tailwindcss"`, `@theme inline`, `@layer base`); `src/components/layout/bottom-navbar.tsx:25` (`pb-6`, no env inset); `src/components/layout/dashboard-shell.tsx` (`fixed inset-0` editor shell, `min-h-screen` non-editor, `<main>` scroller); `src/components/slides/slide-preview.tsx` (Pointer-Events marquee + `setPointerCapture` + react-rnd touch contract); `src/components/slides/decoration-rotation-handle.tsx:221` (`touch-action:none` + Pointer Events); `src/components/landing/showcase-carousel.tsx:92` (`touch-pan-y` proves Tailwind v4 touch utilities resolve). **HIGH.**
- `.planning/mobile-audit/AUDIT.md` — empirical iPhone-15 findings X1 (safe-area), X2 (46 sub-44px targets), X3 (contrast); editor as #1 risk. **HIGH (project-grounded).**
- iOS Safari platform behavior (`100vh` overshoot, passive listeners, `-webkit-tap-highlight-color`, `visualViewport`, `VirtualKeyboard` Chromium-only): widely-documented web-platform facts, cross-checked against the use-gesture/Next docs above. **MEDIUM-HIGH** — recommend one real-device/Simulator pass to confirm `env()` rendering + keyboard resize for final sign-off (Playwright does not reproduce these).

---
*Stack research for: mobile-first iOS-Safari correctness of an existing Next.js 15 + React 19 + Tailwind v4 editor app (v2.17 Mobile Optimization)*
*Researched: 2026-05-31*
