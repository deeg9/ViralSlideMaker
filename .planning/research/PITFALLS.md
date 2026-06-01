# Pitfalls Research — v2.17 Mobile Optimization

**Domain:** Adding mobile-first / touch support to an EXISTING desktop-built Next.js 15 + React 19 + Tailwind v4 carousel editor, targeting iPhone 15 / iOS Safari (393×852, `viewport-fit=cover`).
**Researched:** 2026-05-31
**Confidence:** HIGH (iOS-Safari platform behavior + this project's audit and code history; STACK.md already verified the platform facts via Context7)

> **Scope note (read first).** This file catalogs the costly, *specific* mistakes teams make when retrofitting touch onto a desktop editor — NOT generic "make it responsive" advice. It is grounded in the empirical iPhone-15 audit (`.planning/mobile-audit/AUDIT.md`), this project's real destructive-mis-tap history (a dashboard card click hard-deleted a project), and iOS-Safari traps that **Playwright cannot reproduce**. Every pitfall maps to a proposed v2.17 phase and flags whether real-device / iOS-Simulator validation is mandatory.
>
> **Proposed phase vocabulary** (from AUDIT.md + PROJECT.md + FEATURES.md — the roadmapper will finalize names):
> - **Phase 1 — Cross-cutting foundation:** `viewport-fit=cover` + safe-area insets; global 44px tap targets; input contrast + ≥16px font (no auto-zoom).
> - **Phase 2 — Editor mobile pass:** chrome-collapse for canvas room; **verify & repair touch text-editing** (the #1 risk); bottom-sheet tool panels; finger-sized handles; keyboard handling.
> - **Phase 3 — App-wide mobile-first re-examination:** layout / spacing / typography / gestures across all surfaces; template-picker grid; public-viewer swipe.
> - **Phase 4 — Logged-out pass:** landing + auth (login/signup/onboarding/reset) at 393px. *Dependency: a login credential.*
> - **Phase 5 — Minor polish:** settings sub-nav affordance; template-picker discoverability.
> - **Cross-cutting gate — Real-device validation:** the iOS-Simulator / physical iPhone sign-off pass that the whole milestone funnels into.

---

## Critical Pitfalls

### Pitfall 1: `viewport-fit=cover` forgotten — `env(safe-area-inset-*)` silently reads `0`

**What goes wrong:**
The team adds `env(safe-area-inset-bottom)` padding to the fixed bottom nav and editor bars, tests in Playwright / desktop devtools where it *looks* applied, ships — and on a real iPhone 15 the insets are still `0`, so the bottom tab bar still collides with the home indicator and the top chrome still slides under the Dynamic Island. The `env()` work was a no-op.

**Why it happens:**
`env(safe-area-inset-*)` only return non-zero **after** the page declares `viewport-fit=cover`. This project currently has **no `viewport` export at all** (confirmed in AUDIT X1 + STACK.md), so the env vars are unpopulated. Worse: desktop browsers and Playwright report `env()` as `0` regardless, so the missing `cover` is invisible in every non-device test — the CSS *parses fine* and produces zero padding, looking identical to "no inset needed."

**How to avoid:**
- Set `viewport-fit=cover` the **App-Router-supported way** — `export const viewport: Viewport = { viewportFit: 'cover', width: 'device-width', initialScale: 1 }` in `src/app/layout.tsx`. Do **not** hand-write a `<meta name="viewport">` (App Router overrides it).
- Pad every fixed/edge bar with `max(designPadding, env(safe-area-inset-*))` so non-notch contexts keep their original spacing: e.g. `bottom-navbar.tsx` `pb-6` → `pb-[max(1.5rem,env(safe-area-inset-bottom))]`.
- Land this FIRST — it is the foundation the editor bar rework sits on.

**Warning signs:**
Bottom nav looks correct in Playwright but reviewers report "tab bar touches the home indicator" on a real phone; `getComputedStyle(...).paddingBottom` equals exactly the static design value on device.

**Phase to address:** Phase 1 (foundation). **MUST validate on real device / Simulator** — Playwright reports insets as 0 and cannot prove this works.

---

### Pitfall 2: The iOS `100vh` bug — content cut off / fixed bars pushed under the collapsing URL bar

**What goes wrong:**
The editor shell or canvas column uses `h-screen` / `100vh` / `min-h-screen`. On iOS Safari `100vh` equals the *largest* viewport (address bar retracted), so at first paint (address bar visible) the element is taller than the visible area — the bottom edge (Export bar, bottom tabs) is cut off behind the toolbar. Then as the user scrolls and the URL bar collapses, sticky/fixed elements **jump** because the viewport height changes underfoot.

**Why it happens:**
`100vh` on iOS is famously not "the height you can see." The desktop-built editor was authored with `h-screen` because on desktop `100vh` == visible height. Nobody re-checks it on a viewport whose chrome resizes dynamically.

**How to avoid:**
- Convert mobile-relevant heights to **dynamic viewport units**: `h-dvh` / `min-h-dvh` (Tailwind v4 ships these). Grep for `h-screen`, `min-h-screen`, `100vh`, `vh]` and convert the editor shell + canvas height budget to `dvh`.
- Use `svh` (`h-svh`) only where content must never hide behind the address bar even at first paint.
- Do **NOT** add the legacy JS `--vh = innerHeight * 0.01` resize hack — it's obsolete on the iPhone-15 baseline and reintroduces resize jank.

**Warning signs:**
Export/Public bar invisible until you scroll; a fixed bar "leaps" upward the moment you start scrolling; the 9:16 canvas is taller than the screen by exactly the URL-bar height (~60–115px).

**Phase to address:** Phase 1 for the global shells; Phase 2 for the editor canvas height budget. **MUST validate on real device** — Playwright uses a static viewport and never collapses a URL bar, so the jump and the overshoot are invisible in the audit harness.

---

### Pitfall 3: Touch text-editing silently broken — the #1 editor risk

**What goes wrong:**
On desktop, clicking a text element selects it and a click-or-double-click enters edit mode + focuses an input. On touch, the *same code path may never fire the on-screen keyboard*: the tap is absorbed by react-rnd's drag layer, or by the canvas marquee pointer state machine (v2.11), or by `touch-action` settings, or focus is called on an element iOS won't bring a keyboard up for (iOS requires `.focus()` inside a real user-gesture handler — a focus triggered after an async hop is ignored). The element looks selected but tapping does nothing, or selects-then-immediately-starts-a-drag.

**Why it happens:**
The selection/edit flow (v2.8 `selectedTextBoxId` + click-to-select, `editable={true}` gate) was built and tested with a mouse. The audit explicitly flags this as **UNVERIFIED and the #1 risk**. Touch introduces gesture contention (tap vs drag vs marquee) and iOS's strict "focus must originate in a user gesture" rule that mouse code never had to satisfy.

**How to avoid:**
- **Verify before building anything else in the editor.** Reproduce on a real device / Simulator: tap a text element → does the keyboard appear, does the rail mirror selection, can you type, does it persist on blur? This is verify-and-repair, not greenfield.
- Disambiguate tap-from-drag with a movement threshold (a pointer that moves <~8px before `pointerup` = tap → enter edit; more = drag). Don't let react-rnd start a drag on every touchstart.
- Ensure `.focus()`/edit-entry runs **synchronously inside the pointer/click handler**, not after an `await` or `setState`-then-effect — iOS drops keyboard summons that aren't in the gesture.
- Keep the existing Pointer-Events model; do NOT bolt on raw `onTouchStart` (passive-by-default → `preventDefault` ignored, double-fires alongside pointer events — see Pitfall 9).

**Warning signs:**
Tapping a text box selects it (ring appears) but no keyboard; or the box starts dragging the instant you touch it; rail shows the element but typing goes nowhere; edits revert on blur.

**Phase to address:** Phase 2, FIRST task — it gates every other editor change (bottom sheets, chrome-collapse are pointless if you can't edit text). **MUST validate on real device** — Playwright's synthetic touch fires events but does not invoke the real iOS soft keyboard or its gesture-origin focus rule.

---

### Pitfall 4: The on-screen keyboard covers the focused input in the `fixed inset-0` editor

**What goes wrong:**
The editor shell is `position: fixed; inset: 0` (`dashboard-shell.tsx`). On iOS Safari the soft keyboard by default does **not resize the layout viewport** — it overlays the bottom of the screen. So when a user focuses a text input low on the canvas (or a rename field, or a bottom-sheet control), the keyboard covers it, the page can't scroll it into view (it's a fixed, non-scrolling shell), and the user types blind. Bottom-sheet tool panels are *especially* exposed because they live exactly where the keyboard appears.

**Why it happens:**
`fixed inset-0` + iOS keyboard-overlay is a known hostile combination. On a normal scrolling page iOS auto-scrolls the focused field into view; inside a fixed shell there's nothing to scroll, so the field stays hidden. Desktop never had a keyboard eating half the screen.

**How to avoid (layered, cheapest first):**
1. `interactiveWidget: 'resizes-visual'` in the `viewport` export + `dvh` heights — lowest-effort, ship by default.
2. For an element that must sit pinned directly above the keyboard (e.g. an edit toolbar or the bottom sheet's input row), listen to `window.visualViewport` `resize`/`scroll` and translate it by `visualViewport.height`/`offsetTop`. `visualViewport` is native on iOS 13+, no library.
3. `scrollIntoView({ block: 'center' })` on focus as a robustness backstop for inputs at risk of occlusion.
4. Do **NOT** rely on the `VirtualKeyboard` API (`navigator.virtualKeyboard.overlaysContent`) — it is **Chromium-only, absent in iOS Safari**.

**Warning signs:**
Caret hidden behind the keyboard while typing; bottom sheet's text field disappears under the keyboard; rename field at the bottom of the screen unreachable.

**Phase to address:** Phase 2 (editor; intersects the bottom-sheet and tap-to-edit work). **MUST validate on real device** — Playwright does not render the iOS soft keyboard at all, so overlay/occlusion is 100% invisible in the audit.

---

### Pitfall 5: Input-zoom-on-focus — iOS force-zooms when an input's font is <16px

**What goes wrong:**
The user taps the prompt textarea / a rename field / a settings input and iOS Safari abruptly zooms the page in (and often doesn't cleanly zoom back out), shoving the layout sideways and breaking the fixed editor. Happens on *every* form across the app.

**Why it happens:**
iOS Safari auto-zooms to make any focused input with computed `font-size < 16px` readable. Desktop CSS frequently sets 13–15px inputs for density. The "fix" teams reach for — `user-scalable=no` / `maximum-scale=1` — is a **WCAG 1.4.4 accessibility failure** (disables pinch-zoom for low-vision users) and is ignored by modern Safari anyway.

**How to avoid:**
- Ensure **every** `<input>`/`<textarea>`/`<select>` has computed `font-size ≥ 16px` on mobile. That alone eliminates the zoom with zero a11y cost.
- NEVER use `user-scalable=no` / `maximumScale: 1` to suppress it (see Anti-pattern table).
- Audit all input surfaces: dashboard prompt, editor rename, bottom-sheet numeric inputs, settings, auth.

**Warning signs:**
Page visibly zooms when an input is focused; after dismissing the keyboard the page stays zoomed; horizontal scroll appears only after focusing a field.

**Phase to address:** Phase 1 (global input pass). Phase 4 re-checks auth inputs. Catchable in devtools/Playwright by asserting computed font-size, but the **zoom behavior itself only reproduces on device** — validate the no-zoom result there.

---

### Pitfall 6: Fat-finger destructive mis-taps — adjacent destructive controls (this project has real scars)

**What goes wrong:**
A tap meant for one control lands on an adjacent destructive one. **This project has a documented history:** clicking a dashboard project card once **hard-deleted a project** because a delete control sat adjacent to the card tap target (memory: `feedback_playwright_dashboard_cards.md`). On a 44px-fat-finger touch surface, mis-taps are *more* likely than with a mouse, and the editor is dense with destructive actions: delete slide, delete element (Delete key has no mobile equivalent so a button appears), remove text box, unpublish, delete project.

**Why it happens:**
Desktop layouts pack a delete affordance right next to a navigate/select target because a mouse is precise and hover reveals intent. Shrinking that layout to 393px and enlarging hit areas to 44px makes adjacent targets *overlap in finger space*. There's no hover to preview "you're about to hit delete."

**How to avoid:**
- **Separate destructive controls from primary tap targets** — don't place delete inside/adjacent to the element's main tap/select zone. Move destructive actions into an explicit overflow/long-press menu or a contextual sheet, not a corner icon you can graze.
- **Confirm destructive actions** (slide delete, project delete, element delete, unpublish) with an undo-toast or a confirm step — especially anything that hard-deletes. The reducer already has full undo history (`pushHistory`) for *element* edits; ensure delete is undoable or confirmed.
- Enforce **minimum spacing** between a tap target and any adjacent destructive target (gap so 44px hit areas don't overlap).
- **Mirror the known-bad lesson into the Playwright regression:** never let a single tap on a card/chip reach a delete control. Keep the existing "navigate by URL, never click dashboard cards in Playwright" rule (memory) — but the *fix* is in the UI: the card itself must not have a graze-able delete.

**Warning signs:**
A destructive icon shares a row/corner with a select/navigate target; deleting requires no confirmation; QA reports "I tapped the card and it deleted"; two 44px hit areas with <8px gap between centers of different-intent actions.

**Phase to address:** Phase 1 (global tap-target pass surfaces the adjacencies) + Phase 2 (editor destructive controls) + Phase 3 (dashboard card — the historical offender). Reproducible in Playwright by asserting hit-area separation; the *severity* (data loss) makes confirmation mandatory regardless of platform.

---

### Pitfall 7: `:hover`-only affordances that never trigger on touch

**What goes wrong:**
Controls that only appear or become usable on `:hover` are **permanently invisible/unreachable on touch** (touch has no hover). Tooltips with shortcut hints, hover-reveal toolbars, hover-to-show delete/duplicate icons, cursor-change-only affordances — all dead on a phone. This editor is *full* of them: v2.11 added tooltip shortcut hints on all 8 alignment toolbar buttons + group-row lock; hover cursors (`nwse-resize` etc.) on resize handles signal nothing on touch; many "reveal on hover" inspector affordances.

**Why it happens:**
The whole editor was built mouse-first with hover as a primary discovery channel. iOS Safari *fakes* a single hover on first tap for `:hover` styles (the "double-tap to activate" trap), which makes hover-reveal controls require **two taps** — first tap reveals, second activates — confusing and often read as "broken."

**How to avoid:**
- Audit for `:hover`-gated *functionality* (not just decoration). Anything that *reveals an action* on hover must have a touch-reachable equivalent: always-visible on mobile, or behind an explicit tap/long-press menu.
- Tooltips conveying shortcut hints (⌘D etc.) are meaningless on mobile (no keyboard) — replace shortcut-only actions with a visible tap affordance (see Pitfall 8).
- Don't rely on cursor changes to signal interactivity; use a visible handle/affordance.
- Test the "first tap only reveals" double-tap trap on device for any element that kept a `:hover` reveal.

**Warning signs:**
A control is reachable on desktop but reviewers can't find it on the phone; first tap "does nothing," second tap works; resize/rotate handles give no visual hint they're grabbable.

**Phase to address:** Phase 2 (editor hover-reveal controls, handles, tooltips) + Phase 3 (any app-wide hover affordances). Partially catchable in Playwright (no hover emulation) but **judgment of "is this discoverable by thumb" needs device review.**

---

### Pitfall 8: Shortcut-only actions become unreachable (no keyboard on a phone)

**What goes wrong:**
The editor is rich with keyboard-only flows — ⌘1/⌘2/⌘3 (switch active text box), ⌘D (duplicate), Delete (remove), arrow-key nudge, align hotkeys, Cmd+G group, Cmd+Z undo (v2.8/v2.11/v2.12). On a phone there is no keyboard, so any action whose *only* trigger is a shortcut is **unreachable** — the feature effectively doesn't exist on mobile.

**Why it happens:**
Power-user shortcuts were added as the *primary* (sometimes only) trigger because desktop users live on the keyboard. Nobody enumerated which actions lack a tap affordance.

**How to avoid:**
- Enumerate the shortcut surface and flag **mobile-orphaned actions** (shortcut with no button). Every shortcut-only action needs a tap affordance on mobile (toolbar / bottom sheet / contextual bar).
- Undo/redo is the most important: it has shortcut + (sub-44px) buttons today — keep them persistent, sized, and thumb-reachable.
- Don't try to port *all* shortcuts to buttons — marquee/group/multi-select are desktop-only anti-features on touch (FEATURES.md). Port the ones that matter (undo, duplicate, delete, switch element, nudge-via-drag).

**Warning signs:**
A documented editor capability has no on-screen control; "how do I duplicate/undo on mobile?" with no visible button.

**Phase to address:** Phase 2 (editor action affordances). Catchable by a static audit; verify reachability on device.

---

### Pitfall 9: Gesture conflicts — page scroll vs canvas drag vs browser back-swipe vs pull-to-refresh

**What goes wrong:**
Multiple native and app gestures compete on the same surface:
- **Canvas drag vs page scroll:** dragging an element scrolls the page instead (or vice-versa) because `touch-action` isn't set.
- **Edge back-swipe:** iOS Safari's left-edge swipe = "go back." A canvas element or horizontal filmstrip near the left edge that the user drags can trigger a navigation *away from the unsaved editor* instead of moving the element.
- **Pull-to-refresh:** a downward drag at the top of the editor triggers Safari's pull-to-refresh, reloading and **losing editor state**.
- **Double-tap zoom:** iOS double-tap-to-zoom (and the ~300ms tap delay) fires on editor buttons and on a double-tap-to-edit-text gesture, zooming the page instead of editing.
- **Horizontal filmstrip vs vertical page scroll:** the slide filmstrip swipe fights the page's vertical scroll.

**Why it happens:**
By default iOS owns these gestures; the app must explicitly opt out per-surface with `touch-action`. A desktop editor never declared `touch-action` because mouse doesn't trigger scroll/back-swipe/refresh.

**How to avoid:**
- Draggable canvas + handles: `touch-action: none` (Tailwind `touch-none`) so iOS scroll/zoom/back don't steal the gesture. (Already applied on `decoration-rotation-handle.tsx`; extend to the canvas drag surface + react-rnd handles.)
- Horizontal filmstrip / carousels: `touch-action: pan-y` (Tailwind `touch-pan-y`, already used on `showcase-carousel.tsx`) so vertical page scroll still works while horizontal swipe is captured.
- Buttons / tappable controls: `touch-action: manipulation` (`touch-manipulation`) — kills the double-tap-zoom + 300ms delay while **keeping** page pinch-zoom (do NOT disable zoom globally — WCAG).
- Editor scroll panes inside the fixed shell: `overscroll-behavior: contain` (Tailwind `overscroll-contain`), and `overscroll-none` on the fixed shell, to stop pull-to-refresh and rubber-band scroll-chaining that loses state.
- If shipping pinch-zoom of the canvas (P2): single-finger = move element, two-finger = pan/zoom; do NOT port marquee-select to touch (it fights pinch and mis-selects — FEATURES.md anti-feature).

**Warning signs:**
Dragging an element scrolls the page; a left-edge drag navigates back and loses work; pulling down at the top reloads the editor; tapping a button zooms; filmstrip swipe scrolls the page vertically.

**Phase to address:** Phase 2 (editor canvas/handles/filmstrip gestures) + Phase 3 (app-wide carousels, pull-to-refresh on scrolling surfaces). **MUST validate on real device** — Playwright's synthetic pointer does not reproduce iOS back-swipe, pull-to-refresh, or double-tap-zoom.

---

### Pitfall 10: Sticky/fixed elements jump when the URL bar shows/hides

**What goes wrong:**
A `sticky`/`fixed` bar (top nav, editor toolbar, Export bar) visibly jumps or detaches as the Safari URL bar collapses/expands on scroll, because layout was sized against a height that changes mid-scroll. Combined with Pitfall 2, fixed bars can briefly float in the wrong place or flicker.

**Why it happens:**
iOS resizes the visual viewport (and, with `interactiveWidget`, the layout) as chrome shows/hides. Elements positioned against `100vh` or against a snapshot height reflow on every chrome transition.

**How to avoid:**
- Anchor fixed bars to `bottom-0`/`top-0` (positional) rather than computing their offset from `100vh`.
- Size "available height" calculations against `dvh`, not `vh` (Pitfall 2).
- Combine with `interactiveWidget: 'resizes-visual'` so transitions are smooth rather than abrupt.

**Warning signs:**
Top/bottom bar flickers or hops during the first scroll; a sticky element overlaps content right as the URL bar collapses.

**Phase to address:** Phase 1 (global fixed bars) + Phase 2 (editor bars). **MUST validate on real device** — no URL bar in Playwright.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `user-scalable=no` / `maximumScale:1` to kill input-zoom | One-line fix for input zoom | WCAG 1.4.4 a11y failure; ignored by modern Safari anyway; disables pinch for everyone | **Never.** Use ≥16px input font instead. |
| JS `--vh = innerHeight*0.01` resize hack for height | Works on ancient iOS | Resize-listener jank; obsolete on iPhone-15 baseline; reinvents a native feature | **Never** for this target — use `dvh`. |
| Hand-written `<meta name="viewport">` in `<head>` | Feels direct | App Router overrides it; fights the framework; silently no-ops | **Never** in App Router — use the `viewport` export. |
| Scaling icon glyphs up to 44px to hit tap-target minimum | Quick way to pass the probe | Looks clumsy, breaks visual rhythm, bloats editor chrome that's already starved for height | Only if the icon was genuinely meant to be larger; otherwise expand hit area, keep glyph. |
| Cramming the full desktop right-rail onto 393px | "Feature parity" with no rework | Unusable wall of controls; thumb can't hit thin sliders / 1px nudge | **Never** — bottom-sheet + progressive disclosure (FEATURES.md). |
| Porting marquee/group/multi-select to touch | Parity with desktop editor | Fights pinch-pan, produces mis-selections, low mobile value | **Never** for v2.17 — single-element tap-select is the mobile model. |
| Skipping device validation, trusting the Playwright audit | Faster sign-off | Safe-area, `100vh`, keyboard overlay, real touch are ALL invisible in Playwright → ship broken | **Never** for the iOS-specific items — see device-validation gate. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Next.js App Router viewport | Setting `viewport-fit` via a manual `<meta>` tag | `export const viewport: Viewport = { viewportFit: 'cover', ... }` in `layout.tsx` |
| `env(safe-area-inset-*)` | Applying the inset twice (e.g. on the fixed bar AND a wrapping container) → double padding / dead space | Apply the inset **once**, at the element that actually touches the screen edge; use `max(design, env())` |
| iOS soft keyboard | Relying on `VirtualKeyboard` API (`overlaysContent`) | Chromium-only — use `interactiveWidget:'resizes-visual'` + `dvh` + `visualViewport` |
| React touch handlers | Adding `onTouchMove`/`onWheel` JSX props and calling `preventDefault()` | JSX touch/wheel handlers are **passive** on iOS → `preventDefault` ignored; attach a non-passive listener via `ref` + `addEventListener(..., {passive:false})`, or stay on Pointer Events + `touch-action` (the codebase standard) |
| react-rnd on touch | Assuming a tap is distinguishable from a drag-start | Add a movement threshold so a near-stationary touch = tap (edit), not a drag |
| Tailwind v4 safe-area | Expecting a `tailwind.config` to add utilities | No JS config exists — add custom utilities via `@utility`/`@theme` in `globals.css` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering full-res 9:16 source images in the canvas + every filmstrip thumbnail | Jank on drag, slow slide switch, memory pressure / tab reload on older iPhones | Use downscaled thumbnails in the filmstrip (not the full image); cap canvas image resolution to display size × dpr | Multi-slide carousels (5–10 slides) with large Pexels/Imagen images on a real phone — far below "scale," it's a per-session problem |
| Re-rendering the canvas/guides on every `pointermove` through React | Dropped frames during element drag on touch | Keep the existing ref-based `translate3d` smart-guide updates (v2.11 already does this — don't regress it on mobile) | Immediately, on any mid-range iPhone, during drag |
| Heavy bottom-sheet contents mounted even when collapsed | Sluggish sheet open/close; jank | Lazily mount sheet contents; keep the collapsed sheet cheap | As soon as sheets host the full rail internals |
| Filmstrip with no virtualization + large thumbnails | Scroll jank on long carousels | Cheap fixed-size thumbnails; consider windowing only if slide counts grow | 8–10+ slides with full-res thumbs |
| 1,703-icon picker / large grids on mobile | Scroll jank (already a known QA smoke item from v2.12) | Existing virtualization (`@tanstack/react-virtual`) must survive the bottom-sheet re-host | Opening the icon picker on a phone |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Disabling zoom (`user-scalable=no`) | WCAG 1.4.4 accessibility violation — low-vision users can't enlarge | ≥16px inputs + `touch-action: manipulation` per control; never disable page zoom |
| Destructive actions with no confirmation on a mis-tap-prone surface | **Data loss** (this project already hard-deleted a project via an adjacent control) | Confirm or make-undoable every hard-delete; separate destructive controls from primary tap targets |
| Low-contrast text/inputs (AUDIT X3) | WCAG contrast failure; first-time mobile user can't read the prompt cue | Fix placeholder/label/input contrast to AA in Phase 1 |

> *(Not a classic web-security milestone — the "security" risks here are accessibility-compliance and data-loss-via-mis-tap, both real for this product.)*

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Editor chrome stack squeezes the 9:16 canvas to a sliver | Can't actually see/edit the slide — the core job fails | Collapse secondary chrome (Layers, filmstrip) on demand; keep canvas + one active tool surface (FEATURES.md) |
| Horizontal-scroll template row / filmstrip with no affordance | Users never discover offscreen templates/slides | Scannable 2-up grid for templates; edge-fade / peek-next for filmstrip |
| Auto-focusing the prompt textarea on dashboard load | Keyboard pops on load, covers the example prompt + picker, disorients | Let the user tap in deliberately; keep the (now high-contrast) placeholder visible |
| Tiny precision controls (1px nudge, thin sliders) as primary touch input | Fingers can't hit them; frustration | Drag + snap-guides as primary; keep numeric inputs secondary |
| Primary action (Generate/Export) as a small top-corner link | Hard to reach in the thumb zone; low completion | Prominent full-width / thumb-zone action; one primary CTA per screen |
| Chevron-only carousel advance on public viewer (28–32px) | Cold TikTok traffic can't swipe like they expect | Swipe-to-advance + ≥44px chevrons (protect the conversion surface) |

## "Looks Done But Isn't" Checklist

- [ ] **Safe-area insets:** Looks padded in devtools — verify `env()` is actually non-zero **on a real iPhone** (needs `viewport-fit=cover` shipped; Playwright reports 0).
- [ ] **Full-height editor:** `h-dvh` applied — verify the bottom bar isn't cut off at first paint and doesn't jump when the URL bar collapses **on device**.
- [ ] **Tap-to-edit text:** Element selects — verify the **soft keyboard actually appears**, you can type, and it persists on blur **on device**.
- [ ] **Keyboard overlay:** Input focuses — verify it isn't **hidden behind the keyboard** in the fixed editor shell (test the lowest bottom-sheet input).
- [ ] **Input zoom:** Font is 16px in CSS — verify the page **doesn't zoom on focus** on device.
- [ ] **Tap targets:** Probe passes 44px — verify destructive controls aren't **graze-able** next to primary targets, and hard-deletes are confirmed/undoable.
- [ ] **Hover affordances:** Control works on desktop — verify it's **reachable and not double-tap-trapped** on touch.
- [ ] **Shortcut actions:** Feature exists — verify it has a **tap affordance** on mobile (no keyboard).
- [ ] **Gestures:** Drag works — verify it doesn't trigger **back-swipe, pull-to-refresh, or page scroll**; verify pull-to-refresh can't reload-and-lose editor state.
- [ ] **Performance:** Smooth in devtools — verify drag/filmstrip/icon-picker on a **real mid-range iPhone**, not just the dev machine.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shipped without `viewport-fit=cover` (insets read 0 on device) | LOW | Add the `viewport` export; re-verify on device. One-file change. |
| `100vh` cut-off / jump | LOW–MEDIUM | Grep + convert `h-screen`/`100vh` → `dvh`; re-test on device. |
| Touch text-edit broken | MEDIUM–HIGH | Trace the pointer/focus path; add tap-vs-drag threshold; move `.focus()` into the gesture; may require reworking event ordering with react-rnd/marquee. |
| Keyboard overlay hiding inputs | MEDIUM | Add `interactiveWidget` + `visualViewport` translation for pinned elements; `scrollIntoView` backstop. |
| Destructive mis-tap shipped (data loss) | HIGH (user trust + lost data) | Add confirmation/undo immediately; separate the controls; backfill is impossible if data is hard-deleted — prevention is the only real fix. |
| Disabled zoom for a11y | LOW | Remove `user-scalable=no`; set 16px inputs + `touch-manipulation`. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Real-device validation? | Verification |
|---------|------------------|-------------------------|--------------|
| 1. `viewport-fit=cover` / insets read 0 | Phase 1 | **YES (mandatory)** | On device: bottom nav clears home indicator; `env()` non-zero |
| 2. `100vh` cut-off / jump | Phase 1 (shells) + Phase 2 (canvas) | **YES (mandatory)** | On device: no bottom cut-off at first paint; no jump on URL-bar collapse |
| 3. Touch text-editing broken | Phase 2 (FIRST — gates editor) | **YES (mandatory)** | On device: tap text → keyboard up, type, rail mirrors, persists |
| 4. Keyboard covers focused input | Phase 2 | **YES (mandatory)** | On device: lowest bottom-sheet input stays visible while typing |
| 5. Input-zoom-on-focus (<16px) | Phase 1 (+ Phase 4 auth) | Partly (CSS check in Playwright; zoom only on device) | Computed font-size ≥16px everywhere; no zoom on device focus |
| 6. Destructive fat-finger mis-tap | Phase 1 (surface) + 2 (editor) + 3 (dashboard card) | No (logic/spacing testable) | No graze-able delete; hard-deletes confirmed/undoable; Playwright hit-separation assertion |
| 7. `:hover`-only affordances | Phase 2 (editor) + Phase 3 (app) | Partly (device review for discoverability) | No action gated solely on hover; no double-tap-reveal trap |
| 8. Shortcut-only actions unreachable | Phase 2 | No (static audit) | Every mobile-relevant action has a tap affordance |
| 9. Gesture conflicts (scroll/back/refresh/zoom) | Phase 2 (editor) + Phase 3 (app) | **YES (mandatory)** | On device: drag doesn't scroll/navigate-back/refresh; buttons don't zoom |
| 10. Sticky/fixed jump on URL-bar transition | Phase 1 + Phase 2 | **YES (mandatory)** | On device: bars don't flicker/hop during first scroll |
| Perf: large image / filmstrip jank | Phase 2 (editor) + Phase 3 | **YES (real mid-range iPhone)** | Smooth drag/switch/scroll on device, not dev machine |
| Low-contrast input (X3) | Phase 1 | No (contrast checker) | AA contrast on prompt placeholder/inputs |

### The process pitfall (call it out explicitly to the roadmapper)

**Playwright — used to build the audit — does NOT reproduce the iOS-specific traps.** It emulates a 393px viewport and synthetic touch, but it does **not** reproduce: safe-area insets (reports 0), the `100vh` bug / URL-bar collapse, the soft keyboard (overlay, occlusion, input-zoom *behavior*), real multi-touch gestures, iOS back-swipe, pull-to-refresh, or double-tap-zoom. **Therefore Pitfalls 1, 2, 3, 4, 9, 10 and the perf trap CANNOT be signed off in Playwright** — they require an iOS Simulator (Xcode) or a physical iPhone 15. Budget a dedicated **real-device validation gate** as a milestone exit criterion, and gate the editor phase (Phase 2) on a device pass of the tap-to-edit + keyboard flow before declaring it done. Use Playwright for what it *is* good at — the 393px no-horizontal-overflow regression and the sub-44px tap-target probe (both already written for the audit) — and treat those as necessary-but-not-sufficient.

## Sources

- `.planning/mobile-audit/AUDIT.md` — empirical iPhone-15 Playwright audit: X1 (no safe-area handling / no `viewport-fit`), X2 (46 sub-40px editor targets), X3 (low-contrast input), editor tap-to-edit flagged as the #1 unverified risk, Playwright dpr-clamp note. **HIGH (project-grounded).**
- `.planning/research/STACK.md` — Context7-verified Next.js `viewport` export (`viewportFit`, `interactiveWidget`), Tailwind v4 `dvh`/`touch-*`/`overscroll-*`, Pointer-Events + react-rnd existing model, `visualViewport` escape hatch, `VirtualKeyboard` Chromium-only, passive-listener `preventDefault` trap. **HIGH.**
- `.planning/research/FEATURES.md` — mobile interaction patterns + anti-features (no marquee/group on touch, no FAB, no full-rail cram, no auto-focus prompt, no `user-scalable=no`), bottom-sheet pattern, chrome-collapse, swipe viewer. **HIGH.**
- `.planning/PROJECT.md` — editor history: v2.8 selection rail + ⌘1-3/⌘D shortcuts, v2.10 `inset:-10px` hit-zone pattern + carried iPhone Safari touch-QA debt, v2.11 marquee/smart-guides/tooltips, v2.12 rotation handle + 1,703-icon virtualized picker, "+" button removal. **HIGH.**
- Project memory: `feedback_playwright_dashboard_cards.md` (a dashboard card click hard-deleted a project via adjacent delete control — the destructive-mis-tap scar); `feedback_playwright_react_clicks.md` (React 18 batches; use real clicks). **HIGH (lived experience).**
- iOS Safari platform behavior (`100vh` overshoot, `env()` requires `viewport-fit=cover`, keyboard overlay in fixed layouts, <16px input zoom, passive listeners, `-webkit-tap-highlight-color`, `visualViewport`, edge back-swipe, pull-to-refresh, double-tap-zoom): widely-documented web-platform facts, cross-checked against STACK.md's Context7 lookups. **MEDIUM-HIGH — final sign-off requires the real-device/Simulator gate (Playwright cannot reproduce).**

---
*Pitfalls research for: adding mobile-first/touch support to an existing desktop carousel editor on iOS Safari (v2.17 Mobile Optimization)*
*Researched: 2026-05-31*
