# Feature Research

**Domain:** Mobile-first touch UX for an AI carousel/slideshow creator (creation dashboard, slide editor, template picker, settings, public explore/viewer/profile) on iPhone 15 (393px)
**Researched:** 2026-05-31
**Confidence:** HIGH (interaction patterns grounded in current reference apps — Canva mobile, CapCut, Procreate, iOS HIG, Material 3, NN/g — and cross-checked against the empirical iPhone-15 audit at `.planning/mobile-audit/AUDIT.md`)

> **Scope note:** This file is about *how existing surfaces should BEHAVE on touch* — not new product features. "Features" below = mobile interaction behaviors / UX patterns. Every row is categorized as **Table stakes** (penalized if missing), **Differentiator** (competitive edge), or **Anti-feature** (deliberately do NOT do on mobile). Complexity and dependencies on the existing editor architecture are noted throughout.
>
> **Note for downstream:** this file replaces a stale v2.13 (Style-from-Reference) FEATURES.md.

---

## How to read the categories

- **Table stakes** = a touch user from TikTok expects this and the surface feels broken without it. These are the bulk of v2.17.
- **Differentiator** = makes the mobile editor feel native-quality vs a shrunk desktop site. Pick a few; don't chase all.
- **Anti-feature** = a tempting mobile pattern that hurts more than it helps *for this product* — documented to prevent scope creep and wasted effort.

The audit already establishes the baseline: public/view surfaces, dashboard, settings, and subscription **reflow cleanly with zero horizontal overflow**. The concentrated work is the **editor**, **iOS safe-areas**, and **sub-44px tap targets**. Categorization below reflects that — most "good on mobile" wins are polish on already-passing surfaces; the editor is the one surface needing genuine interaction rework.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = the surface feels broken / "this site isn't made for my phone."

#### Cross-cutting (all surfaces)

| Feature | Why Expected | Complexity | Notes / Dependency |
|---------|--------------|------------|--------------------|
| **44×44px minimum tap targets** | Apple HIG floor; finger pad can't reliably hit smaller. Audit found **46** sub-40px elements in the editor alone, plus 32px header icon, 28–32px carousel chevrons, 80×22 chips. | MEDIUM | Cross-cuts every surface. Editor chips/toolbar are the worst. Use hit-area expansion (`inset:-10px` wrapper, visual glyph stays small) — the v2.10 corner-handle pattern already does exactly this; reuse it. |
| **iOS safe-area insets honored** | Fixed bottom nav currently `pb-6` static 24px with no `env(safe-area-inset-bottom)`; no `viewport-fit=cover`. On iPhone 15 the tab bar collides with the home indicator. | LOW–MEDIUM | Foundational — must land before editor bar rework. Add `viewport-fit=cover` viewport export + `env(safe-area-inset-*)` on every fixed/sticky bar (`bottom-navbar.tsx`, editor Export/Public bar, editor bottom tabs). |
| **No input auto-zoom (≥16px font on inputs)** | iOS Safari force-zooms any input rendering <16px and doesn't reset cleanly. Jarring on every form: prompt box, rename, settings, auth. | LOW | Global: all `<input>`/`<textarea>` computed font-size ≥16px. NEVER use `user-scalable=no` (a11y violation). |
| **Readable placeholder contrast** | Audit X3: prompt textarea placeholder is light pink-grey on white, fails WCAG. The example prompt is the onboarding cue for first-time mobile users. | LOW | Single CSS fix; high leverage because it's the first thing a new user reads. |
| **No horizontal overflow / no pinch-to-read** | Content must fit 393px. Already largely true per audit — protect it with a regression guard. | LOW | Mostly a *don't-regress* requirement. |

#### Slide editor on touch (the heavy surface)

| Feature | Why Expected | Complexity | Notes / Dependency |
|---------|--------------|------------|--------------------|
| **Tap a text element on canvas → edit it** | This is THE core editing action. Every reference app (Canva, CapCut, drawio) does tap-(or double-tap)-to-edit text directly on canvas. Audit flags this as the **#1 unverified risk**. | HIGH | Depends on existing `selectedTextBoxId` + canvas click-to-select (v2.8 Phase 52) and the `editable={true}` gate. Must verify the touch event path actually fires the on-screen keyboard and that the rail mirrors selection. This is verify-and-repair, not greenfield. |
| **Collapse chrome to maximize canvas** | Canva mobile auto-hides its drawer when the canvas is selected; CapCut keeps only canvas + minimal controls. Audit: editor stacks header + title/toolbar + filmstrip + Layers + canvas + 3 tabs + undo/redo + Export bar + bottom nav — all fighting for height, squeezing the 9:16 canvas. | HIGH | The defining editor task. Demote secondary chrome (Layers panel, filmstrip) into on-demand surfaces; keep canvas + one active tool surface visible. Depends on current editor layout in `slide-editor.tsx` / `dashboard-shell.tsx` (editor already "manages its own viewport-fit height"). |
| **Bottom-sheet tool panels** | The canonical mobile pattern for tool panels (Canva's retractable bottom drawer; Material 3 / NN/g bottom sheets). Keeps the active tool thumb-reachable and dismissable without leaving the canvas. The existing TEXT/ELEMENTS/IMAGES tabs map naturally onto bottom-sheet contents. | HIGH | Convert the right-rail panels (which are desktop side-rails) into bottom sheets on mobile. Non-modal/persistent so the canvas stays interactive. Big dependency on the existing rail components (`text-rail/`, decoration cards, photo-treatment controls) — reuse their internals, re-host the container. |
| **Drag handles sized for fingers** | Move/resize handles must be ≥44px hit area. v2.10 already ships 24×24 CSS hit zones (WCAG 2.5.8 AA) for corner resize via `inset:-10px`; extend the same to mobile and bump toward 44. | MEDIUM | Reuse the existing `ROLE_FONT_BOUNDS` / corner-handle hit-zone pattern. Rotation handle (v2.12, 16px) also needs a bigger touch target. |
| **Pinch-to-zoom / pan the canvas** | Universal expectation from photo apps; lets users work on a small element on a small screen. Procreate/Konva/drawio all standardize pinch-zoom + two-finger pan. | MEDIUM–HIGH | New gesture layer on the canvas. Must `preventDefault` to stop page scroll. Coexists with element-drag (single-finger drag = move element; two-finger = pan/zoom canvas). Touches the canvas pointer state machine (marquee/drag from v2.11). |
| **Reachable undo/redo** | Universal in mobile editors (CapCut puts undo/redo at top of screen). Audit flags current undo/redo as sub-44px. | LOW–MEDIUM | Reducer already has full history (`pushHistory`). Just placement + sizing. Keep them persistent and thumb-reachable, not buried. |
| **Horizontal filmstrip with scroll affordance** | Slide reordering/selection. Audit: filmstrip is horizontal-scroll with **no scroll affordance** — users won't know more slides exist offscreen. | LOW | Add edge fade / peek-next-thumbnail so offscreen slides are discoverable. |
| **Tap target for slide/layer chips** | Currently 80×22 — too short to tap reliably. | LOW | Increase height to ≥44px tap zone. |

#### Navigation

| Feature | Why Expected | Complexity | Notes / Dependency |
|---------|--------------|------------|--------------------|
| **Persistent bottom tab bar, 3–5 items** | iOS HIG canon: bottom tab bar is the standard primary nav for thumb reach. Already exists (`bottom-navbar.tsx`) — needs safe-area + 44px sizing. | LOW | Keep to 3–5 destinations (nav, not actions). |
| **Primary action reachable, not in a corner** | Create/Generate and Export are *actions*, not nav. iOS pattern: keep them out of the tab bar itself but reachable — either an embedded prominent button (Instagram camera model) or a floating/sticky action near the thumb zone. | MEDIUM | Dashboard "Create/Generate" and editor "Export" are the two primary actions. Both should sit in the lower/center thumb zone, full-width or floating, not as a small top-corner link. |
| **Single primary action per screen** | Mobile users have one job per screen; competing CTAs reduce completion. | LOW | Editor: Export is primary; Public toggle secondary. Dashboard: Generate is primary. |

#### Forms / inputs

| Feature | Why Expected | Complexity | Notes / Dependency |
|---------|--------------|------------|--------------------|
| **Correct keyboard per field (`inputmode`/`type`)** | Email field → email keyboard; numeric → number pad. Reduces typing friction; standard mobile ergonomics. | LOW | Auth + settings fields. `type="email"`, `inputmode`, `autocomplete` hints. |
| **Auto-growing prompt textarea** | The prompt is the product's front door. On mobile it should grow with content, not be a tiny fixed box with internal scroll. | LOW | Single component. Pair with the contrast + ≥16px fixes above. |
| **Sticky submit above the keyboard** | When the iOS keyboard opens, the submit/Generate button must remain reachable, not be pushed below the fold. | MEDIUM | Affects prompt form + auth. Use a keyboard-aware sticky action region. |
| **`autocomplete` on auth fields** | Password managers / iOS autofill expected on login/signup. | LOW | Logged-out pass (blocked in audit — needs a credential to round-trip). |

#### Template picker on a phone

| Feature | Why Expected | Complexity | Notes / Dependency |
|---------|--------------|------------|--------------------|
| **Browse all 16 templates without hidden offscreen items** | Audit: current inline picker is a horizontal-scroll row of 160px tiles — discoverability of all 16 is "mediocre." NN/g / carousel research: beyond ~7–10 items in a carousel, users rarely reach the end; **grid wins for scanning many items**. | MEDIUM | Switch the phone layout to a **scrollable 2-up grid** (or a bottom-sheet grid) so all 16 photo-backed preview tiles are scannable. Reuses v2.16 `TemplateTilePreview` PNG tiles — container change, not new tiles. |
| **Tiles big enough to judge the design** | The v2.16 tiles are real photo-backed previews; they must render large enough on a phone to actually communicate the style. | LOW | 2-up grid gives larger tiles than a cramped horizontal row. |

#### Public / shared surfaces (landed on from a TikTok bio link)

These are *already "Good"* per audit — the table-stakes job is to **protect and convert**, because this is where cold TikTok traffic lands.

| Feature | Why Expected | Complexity | Notes / Dependency |
|---------|--------------|------------|--------------------|
| **Full-width 9:16 swipeable carousel viewer** | Already shipped and clean (`/explore/[slug]`): full-width 9:16, prev/next, slide counter. Matches the swipe gesture TikTok users arrive with. | LOW (protect) | Ensure swipe (not just chevron tap) advances slides — chevrons are currently 28–32px (sub-44px). |
| **Fast load (<2–3s) above the fold** | Link-in-bio traffic bounces fast; the first slide + CTA must be visible in seconds. | LOW–MEDIUM | The hero thumbnail is pre-rendered (v2.4) — good. Verify mobile payload. |
| **One clear primary CTA in the thumb zone** | Conversion research: one primary CTA, center/lower screen, repeated. Fork/Bookmark/"make your own" must be obvious and thumb-reachable for a logged-out visitor. | LOW | Fork/Bookmark already present and clean per audit — verify sizing + that the "create your own" path is the visible primary CTA for a cold visitor. |
| **Public profile reads as a landing page** | `/[username]` is what a creator links in their TikTok bio; avatar/bio/social links + carousel grid already reflow cleanly. | LOW (protect) | Single-column grid is good; ensure the "make your own" / follow-the-creator action is reachable. |

---

### Differentiators (Competitive Advantage)

Features that make the mobile editor feel native-quality rather than a shrunk desktop tool. Pick a subset — these align with the Core Value (edit AI carousels anywhere) but are not required to ship a usable v2.17.

| Feature | Value Proposition | Complexity | Notes / Dependency |
|---------|-------------------|------------|--------------------|
| **Auto-collapsing chrome on canvas focus** | Canva's signature mobile move: when you tap into the canvas, secondary UI recedes so the artboard breathes. Makes a cramped editor feel spacious. | HIGH | Builds on the chrome-collapse table-stakes work; the *auto* behavior on focus is the differentiator. |
| **Double-tap text → inline edit with live keyboard** | drawio/Canva pattern; feels direct and "native." Beyond bare table-stakes tap-select, this is select+edit in one gesture. | MEDIUM | Layers on top of the verified tap-to-edit path. |
| **Snap/alignment guides that work under touch** | The desktop editor already has smart guides (v2.11 Phase 63). Preserving them under finger-drag (with touch-appropriate hysteresis) is a real differentiator vs mobile competitors whose touch editors are dumbed down. | MEDIUM | Reuse existing smart-guide engine; tune thresholds for coarser touch input. |
| **Haptic feedback on snap / handle grab** | Subtle iOS haptic on snap-to-guide or handle engagement signals precision and feels premium. | LOW–MEDIUM | Web Vibration API support on iOS Safari is limited/uneven — verify before committing; treat as nice-to-have. |
| **Sticky mini-toolbar on the selected element** | A small contextual bar (duplicate/delete/style) floating near the selected element, à la Canva, saves trips to a panel. | MEDIUM | Maps to existing element actions in the reducer. |
| **"Remix this on your phone" one-tap from public viewer** | Converts cold TikTok traffic: a logged-out visitor on `/explore/[slug]` taps Fork and is dropped straight into the mobile editor. The fork RPC already exists (v2.4). | MEDIUM | Conversion-critical; ties the public surface to the editor. The editor must be genuinely usable on touch first (depends on all editor table-stakes work). |

---

### Anti-Features (Mobile things to deliberately NOT do)

Tempting mobile patterns that hurt this product. Documented to prevent wasted effort.

| Feature | Why Requested | Why Problematic | Better Approach |
|---------|---------------|-----------------|-----------------|
| **`user-scalable=no` / `maximum-scale=1` to kill input zoom** | Quick fix for iOS auto-zoom on inputs. | Disables pinch-zoom app-wide → WCAG violation, harms low-vision users; Safari also ignores it in modern versions. | Set input font-size ≥16px. That alone prevents the zoom with zero a11y cost. |
| **Full desktop multi-select / marquee / group on mobile** | Feature parity with desktop editor (v2.11). | Marquee-drag and group/ungroup are mouse-precision interactions; on a finger they fight pinch-pan and produce mis-selections. Low value on a phone. | Single-element tap-select + drag is the mobile model. Leave marquee/group as desktop-only; don't port the gesture. |
| **Cramming the full right-rail inspector onto the phone** | "Show all the same controls." | The rail has dozens of controls (effects, treatment, position, z-order); shown at once on 393px it's an unusable wall. | Bottom-sheet with progressive disclosure — show the active tool's controls only, expand on demand. |
| **Keyboard-shortcut-driven flows as the mobile model** | The editor is rich with shortcuts (⌘1-3, ⌘D, arrow nudge, align hotkeys from v2.11/v2.12). | No keyboard on a phone; shortcut-only actions become unreachable. | Ensure every shortcut-only action also has a tap affordance on mobile (toolbar/sheet/contextual bar). Audit the shortcut surface for mobile-orphaned actions. |
| **A floating "+" create button in the tab bar** | Looks like every social app. | HIG: tabs are nav, not actions; and the project already *removed* the top "+" button (commit `8ea7833`) in favor of promoting the real Create path. Re-adding a FAB contradicts that direction. | Keep Create/Generate as a prominent in-content primary action in the dashboard thumb zone, not a tab-bar FAB. |
| **Horizontal-scroll carousel for the 16 templates on mobile** | It's what's there now; minimal change. | Carousels hide items past ~5–7; users don't reach template 16; poor for comparing styles side-by-side (NN/g). | 2-up scannable grid (or bottom-sheet grid) so all 16 photo tiles are browsable. |
| **Tiny precision controls (1px nudge, thin sliders) as primary touch input** | Parity with desktop fine-tuning. | Fingers can't hit 1px nudge or thin slider thumbs; frustrating and error-prone. | Coarser touch defaults (drag + snap guides) for primary editing; keep fine numeric inputs available but secondary. |
| **Auto-focusing the prompt textarea on dashboard load** | "Get them typing immediately." | On mobile, auto-focus pops the keyboard on page load, covers the example prompt + template picker, and disorients. | Let the user tap in deliberately; keep the placeholder (now high-contrast) visible as the cue. |

---

## Feature Dependencies

```
[viewport-fit=cover + safe-area insets]   <- foundation, ships first
        |--required by--> [fixed bottom nav sizing]
        |--required by--> [editor Export/Public bar placement]
        |--required by--> [editor bottom-sheet tool panels]

[>=16px input font]  --prevents--> [iOS input auto-zoom]   (makes user-scalable=no unnecessary)

[44px tap-target pass]  --required by--> [reachable undo/redo]
                        --required by--> [filmstrip / layer chips]
                        --required by--> [carousel chevrons on public viewer]
                        --reuses--> [v2.10 inset:-10px hit-zone pattern]

[verified tap-to-edit-text on touch]   <- #1 risk; gates the whole editor
        |--required by--> [double-tap inline edit (differentiator)]
        |--required by--> [bottom-sheet TEXT panel being useful]

[chrome-collapse / maximize canvas]
        |--enables--> [bottom-sheet tool panels]   (sheets only work if canvas has room)
        |--enhanced by--> [pinch-zoom + pan]

[mobile editor genuinely usable]
        |--required by--> ["Remix on your phone" public->editor conversion]

[pinch-zoom/pan canvas]  --conflicts--> [single-finger marquee select]
        -> resolve: 1-finger = move element, 2-finger = pan/zoom, no marquee on mobile
```

### Dependency Notes

- **Safe-area foundation gates the editor bar rework:** you can't correctly place the bottom-sheet sheets or Export bar until `viewport-fit=cover` populates the inset env vars. Foundation phase must precede editor phase.
- **Tap-to-edit-text gates the editor's value:** if touch text editing doesn't work, none of the panel/sheet rework matters. Verify FIRST (it's flagged unverified in the audit), then build chrome-collapse + sheets around a known-good interaction.
- **Pinch-zoom conflicts with marquee select:** the existing canvas pointer state machine (v2.11 marquee) assumes single-finger drag = marquee. On mobile, single-finger must mean move-element and two-finger must mean pan/zoom. Don't port marquee to touch (also an anti-feature above).
- **Public-surface conversion depends on a usable mobile editor:** "Remix on your phone" only converts if the editor a cold visitor lands in is actually touch-usable — so it's downstream of all editor table-stakes work.
- **Reuse, don't rebuild:** the hit-zone pattern (v2.10), smart guides (v2.11), tile previews (v2.16), and rail component internals (v2.8) all already exist. Mobile work is mostly *re-hosting containers* (rail→sheet, row→grid) and *resizing hit areas*, not new feature logic.

---

## MVP Definition

### Launch With (v2.17 core)

The "good on mobile" floor — without these the app feels not-made-for-phones.

- [ ] `viewport-fit=cover` + safe-area insets on all fixed/sticky bars — **foundation; everything else sits on it**
- [ ] Global 44px tap-target pass (editor toolbar/chips, header icon, carousel chevrons, undo/redo) — **HIG floor; 46 violations in editor alone**
- [ ] ≥16px input font (no auto-zoom) + placeholder-contrast fix — **first impression on the front-door prompt**
- [ ] **Verify & repair tap-to-edit-text on touch** — **#1 risk; gates the editor**
- [ ] Editor chrome-collapse so the 9:16 canvas gets real height — **the defining editor task**
- [ ] Bottom-sheet tool panels (re-host TEXT/ELEMENTS/IMAGES + rail controls) — **canonical mobile pattern**
- [ ] Finger-sized drag/resize/rotate handles — **reuse v2.10 hit-zone pattern**
- [ ] Reachable, sized undo/redo
- [ ] Filmstrip scroll affordance + ≥44px slide/layer chips
- [ ] Template picker as scannable grid (all 16 visible) — **discoverability**
- [ ] Swipe-to-advance on public carousel viewer + sized chevrons — **protect the conversion surface**

### Add After Validation (v2.17.x)

- [ ] Pinch-zoom + two-finger pan on canvas — **trigger: small-element editing pain reported**
- [ ] Auto-collapse chrome on canvas focus (the Canva polish on top of manual collapse)
- [ ] Double-tap text → inline edit
- [ ] Sticky contextual mini-toolbar on selected element
- [ ] Keyboard-aware sticky submit (prompt + auth) — **needs logged-out pass; audit-blocked on credential**

### Future Consideration (v2.18+)

- [ ] Haptics on snap/handle grab — **defer: iOS Safari Vibration support is uneven; verify first**
- [ ] "Remix this on your phone" one-tap public→editor conversion — **defer until editor is proven touch-usable**
- [ ] Smart guides tuned for touch hysteresis — **defer: depends on stable pinch/pan gesture layer**

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Safe-area insets + viewport-fit | HIGH | LOW | P1 |
| 44px tap-target pass | HIGH | MEDIUM | P1 |
| ≥16px input font + placeholder contrast | HIGH | LOW | P1 |
| Verify/repair tap-to-edit-text on touch | HIGH | HIGH | P1 |
| Editor chrome-collapse (canvas room) | HIGH | HIGH | P1 |
| Bottom-sheet tool panels | HIGH | HIGH | P1 |
| Finger-sized handles | HIGH | MEDIUM | P1 |
| Reachable undo/redo | MEDIUM | LOW | P1 |
| Filmstrip affordance + chip sizing | MEDIUM | LOW | P1 |
| Template picker grid | MEDIUM | MEDIUM | P1 |
| Swipe + sized chevrons (public viewer) | HIGH | LOW | P1 |
| Pinch-zoom / pan canvas | HIGH | HIGH | P2 |
| Auto-collapse on canvas focus | MEDIUM | HIGH | P2 |
| Double-tap inline edit | MEDIUM | MEDIUM | P2 |
| Keyboard-aware sticky submit | MEDIUM | MEDIUM | P2 |
| Contextual mini-toolbar | MEDIUM | MEDIUM | P2 |
| "Remix on your phone" conversion | HIGH | MEDIUM | P3 (gated on editor) |
| Haptics | LOW | MEDIUM | P3 |
| Touch-tuned smart guides | LOW | MEDIUM | P3 |

**Priority key:** P1 = must have for v2.17 / P2 = should have, add when possible / P3 = defer.

---

## Competitor Feature Analysis

| Behavior | Canva (mobile) | CapCut (mobile) | Procreate / drawio | Our Approach |
|----------|----------------|-----------------|--------------------|--------------|
| Tool panels | Retractable bottom drawer w/ tabs (text/elements/photos/effects); auto-hides on canvas select | Bottom toolbar, tools expand into bottom sheets | Side palettes + gesture menu | Re-host existing right-rail (text/elements/images) as **bottom sheets**; collapse on canvas focus |
| Text editing | Tap element → edit + bottom edit bar | Tap text layer → edit overlay | drawio: double-tap → on-screen keyboard | **Verify** tap-to-edit fires keyboard + mirrors selection rail; add double-tap inline edit later |
| Undo/redo | Top of screen | Top of screen (curved arrows) | Two-finger tap / gesture | Persistent, sized, thumb-or-top reachable (reducer history already exists) |
| Canvas room | Chrome recedes on focus | Minimal chrome, canvas-first | Full-screen canvas, gesture-summoned UI | **Collapse chrome** to give the 9:16 canvas height |
| Zoom/pan | Pinch-zoom + pan | Pinch timeline + canvas | Pinch-zoom + two-finger pan | Add pinch/pan (P2); 1-finger = move element, 2-finger = pan/zoom |
| Browsing many items | Grid of templates | Grid of effects/templates | Grid galleries | **Grid** of 16 template tiles, not horizontal carousel |
| Primary action | Prominent in-content, not a tab FAB | Export top-right, sized | n/a | Create (dashboard) / Export (editor) as prominent thumb-zone action; **no tab-bar FAB** (project already removed the "+") |

---

## Sources

Reference apps & guidelines (interaction patterns):
- [Canva mobile bottom drawer / auto-hide on canvas select](https://www.lyfemarketing.com/blog/canva-mobile-app/)
- [Bottom Sheet UX guidelines — NN/g](https://www.nngroup.com/articles/bottom-sheet/)
- [Bottom sheets — Material Design 3](https://m3.material.io/components/bottom-sheets/overview)
- [Designing for Touch — UXmatters (44px handles, direct interaction)](https://www.uxmatters.com/mt/archives/2020/02/designing-for-touch.php)
- [drawio touch diagrams — double-tap to edit text, long-press drag, pinch zoom](https://www.drawio.com/blog/touch-screen-diagrams)
- [Konva mobile touch events / pinch-zoom](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html)
- [Procreate gesture handbook (pinch zoom, two-finger undo)](https://help.procreate.com/procreate/handbook/interface-gestures/gestures)
- [Apple HIG — Tab bars (3–5 items, nav not actions)](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Floating action buttons on iOS / primary-action tension](https://medium.com/@_sferrari/floating-action-buttons-on-ios-yes-theyre-here-78a7b944cf96)
- [iOS Tab Bar UX guide 2026](https://uiuxdesigning.com/ios-tab-bar/)
- [16px+ input font prevents iOS form zoom — CSS-Tricks](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/)
- [CapCut mobile undo/redo + bottom toolbar](https://www.videoproc.com/video-editor/how-to-use-capcut.htm)
- [Carousel vs grid for many items — Eleken](https://www.eleken.co/blog-posts/carousel-ui)
- [Mobile-first landing page conversion — Replo](https://www.replo.app/blog/mobile-first-landing-page-design-how-to-build-for-conversions)
- [Link-in-bio CTA best practices](https://creatorblog.direct.me/best-practices-for-link-in-bio-ctas/)

Internal grounding:
- `.planning/mobile-audit/AUDIT.md` (empirical iPhone-15 Playwright audit — surface verdicts, 46 sub-40px editor targets, safe-area gap, tap-to-edit unverified)
- `.planning/PROJECT.md` (existing surfaces, editor architecture history: v2.8 selection rail, v2.10 hit-zone pattern, v2.11 marquee/guides, v2.12 rotation handles, v2.16 tile previews, "+" button removal)

---
*Feature research for: mobile-first touch UX of an AI carousel creator (v2.17 Mobile Optimization)*
*Researched: 2026-05-31*
