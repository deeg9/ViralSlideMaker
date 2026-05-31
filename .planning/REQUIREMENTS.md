# Requirements — v2.17 Mobile Optimization

**Goal:** Make the entire app feel native-quality on an iPhone 15 (393×852, iOS Safari) — every surface mobile-first, with the slide editor genuinely usable for touch editing.

**Grounding:** Empirical iPhone-15 Playwright audit (`.planning/mobile-audit/AUDIT.md`) + research synthesis (`.planning/research/SUMMARY.md`). Most public/view surfaces already reflow cleanly; the editor, iOS safe-areas, and sub-44px tap targets are the concentrated work. Zero new heavy dependencies required.

---

## v2.17 Requirements

### Cross-Cutting Foundation (FOUND)
*Must land first — `env(safe-area-inset-*)` reads 0 until `viewport-fit=cover` is set.*

- [x] **FOUND-01**: On iOS Safari, no fixed UI (bottom tab nav, editor action bars) is obscured by or collides with the home indicator or notch — safe-area insets respected app-wide (`viewport-fit=cover` + `env(safe-area-inset-*)`). *(Code complete Phase 91; on-device iPhone confirmation pending — insets read 0 in Playwright.)*
- [x] **FOUND-02**: Full-height screens fill the visible viewport without the iOS `100vh` overshoot — no content cut off under the collapsing URL bar (`dvh`/`svh`). *(Code complete Phase 91; on-device iPhone confirmation pending — URL-bar collapse not reproducible in Playwright.)*
- [x] **FOUND-03**: All interactive controls meet a ≥44×44px touch target across the app (currently pervasive 28–36px; the editor alone had 46 sub-40px controls). *(`tap-44` utility + editor chrome sweep landed Phase 91; per-surface sweeps continue as later phases rework those surfaces.)*
- [x] **FOUND-04**: Text inputs do not trigger iOS zoom-on-focus (≥16px effective font), and placeholder/label text meets WCAG AA contrast (the prompt placeholder is currently near-invisible). *(Landed Phase 91.)*

### Mobile Editor (EDIT)
*The concentrated work. EDIT-01 is a gate that must pass before the rest is built.*

- [~] **EDIT-01**: A user can tap a text element on a slide and edit its text on touch (iOS), with the on-screen keyboard not covering the field being edited. *(GATE — Phase 92 diagnosed; **Phase 93 repaired**: gesture-synchronous focus inside `onPointerUp`, single-tap-to-edit with a 10px drag threshold (`src/lib/editor/touch-edit.ts`), `scrollIntoView` + `interactiveWidget:'resizes-visual'` for occlusion. Code-complete; awaiting the consolidated physical-iPhone pass in 93-VERIFICATION.md.)*
- [~] **EDIT-02**: On a phone the slide canvas is the dominant element — editor chrome collapses so the canvas is not squeezed by stacked panels. *(Phase 93: both desktop asides `hidden lg:flex`, canvas dominates the mobile column, slim top bar + thin filmstrip + bottom bar. Code-complete; awaiting device pass.)*
- [~] **EDIT-03**: Editing tool panels (Text / Elements / Images and their controls) are reachable on mobile via thumb-friendly bottom sheets (re-hosting existing rails; no rebuild). *(Phase 93: new `src/components/ui/sheet.tsx` on `@radix-ui/react-dialog`; rails re-hosted via shared `toolPanelBody`. Code-complete; awaiting device pass.)*
- [~] **EDIT-04**: A user can navigate between slides on mobile via the filmstrip with a clear scroll/selection affordance (no hidden horizontal scroll). *(Phase 93: thin `SlideList` filmstrip + edge-fade mask + "n / total" counter. Code-complete; awaiting device pass.)*
- [~] **EDIT-05**: Destructive editor actions (delete slide/element) require confirmation or are undoable, and destructive controls are spaced away from primary tap targets — no accidental data loss on mis-tap. *(Phase 93: slide delete confirm-gated on both breakpoints; mobile delete spaced to the bottom of the layers sheet, away from add/export; undo covers it. Code-complete; awaiting device pass. Addresses the documented hard-delete-via-adjacent-control history.)*
- [~] **EDIT-06**: Core editor actions (Export, add, undo/redo, Public toggle) are reachable from a persistent, thumb-reachable bottom action area. *(Phase 93: persistent safe-area-padded bottom action bar. Code-complete; awaiting device pass.)*

### App-Wide Mobile Polish (POLISH)

- [ ] **POLISH-01**: The template picker presents all 16 templates in a mobile-friendly browsable grid (not a silently-hidden horizontal scroll).
- [ ] **POLISH-02**: Settings sub-navigation makes off-screen tabs discoverable on mobile (no silently hidden tabs).
- [ ] **POLISH-03**: The public carousel viewer supports swipe (in addition to chevrons) for slide navigation on touch.
- [ ] **POLISH-04**: Typography scale and spacing are tuned for 393px across surfaces (oversized headings no longer eat the fold; consistent mobile rhythm).

### Logged-Out & Auth (AUTH)
*Externally blocked on a login credential to round-trip the authed transitions.*

- [ ] **AUTH-01**: The logged-out landing page (`/`) is fully mobile-optimized at 393px — audited and fixed.
- [ ] **AUTH-02**: The auth screens (login, signup, onboarding/username, forgot/reset password) are fully mobile-optimized at 393px with mobile-correct form ergonomics (input types, autocomplete, ≥16px fonts, sticky submit).

---

## Milestone Exit Criteria (non-functional)

- **Real-device validation gate:** EDIT-01 and overall editor sign-off (EDIT-02/03 + iOS keyboard/safe-area behavior) are validated on the user's **physical iPhone** (confirmed available 2026-05-31) — Playwright cannot reproduce safe-area insets, the `100vh` URL-bar collapse, keyboard overlay, or real touch. Plan device-test checkpoints accordingly.
- **No new heavy dependencies:** bottom sheet builds on the already-installed `@radix-ui/react-dialog`; touch uses existing Pointer Events / react-rnd.

## External Dependencies (flagged at planning time)

1. **Login credential** — AUTH-01/AUTH-02 (and any authed-transition retest) are blocked without one.
2. ~~iOS device~~ — **resolved**: user has a physical iPhone for the EDIT validation gate and editor sign-off (confirmed 2026-05-31).

---

## Future Requirements (deferred)

- Pinch-to-zoom / multi-touch transform of text elements on canvas → v2.18+ (the only realistic trigger for a gesture library; deliberately deferred).
- Auto-collapsing editor chrome on scroll, haptic feedback (Vibration API support uneven on iOS) → later polish.
- "Remix on your phone" mobile-native creation differentiators → later.

## Out of Scope (explicit exclusions)

- **Native iOS app** — web-first remains the strategy; this milestone is iOS-Safari/PWA-quality, not a native shell.
- **`@use-gesture/react`, `vaul`, or other heavy mobile deps** — research found the platform + existing deps sufficient; adding them is the exception requiring a specific trigger.
- **Android-specific tuning** — primary target is iPhone 15; Android benefits incidentally but is not separately validated this milestone.
- **`user-scalable=no`** — never disable user zoom (accessibility).

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 91 | Code complete (device-confirm pending) |
| FOUND-02 | Phase 91 | Code complete (device-confirm pending) |
| FOUND-03 | Phase 91 | Satisfied |
| FOUND-04 | Phase 91 | Satisfied |
| EDIT-01 | Phase 92→93 | Code-complete (Phase 93 repair), awaiting device sign-off (GATE) |
| EDIT-02 | Phase 93 | Code-complete, awaiting device sign-off |
| EDIT-03 | Phase 93 | Code-complete, awaiting device sign-off |
| EDIT-04 | Phase 93 | Code-complete, awaiting device sign-off |
| EDIT-05 | Phase 93 | Code-complete, awaiting device sign-off |
| EDIT-06 | Phase 93 | Code-complete, awaiting device sign-off |
| POLISH-01 | Phase 94 | Pending |
| POLISH-02 | Phase 94 | Pending |
| POLISH-03 | Phase 94 | Pending |
| POLISH-04 | Phase 94 | Pending |
| AUTH-01 | Phase 95 | Pending |
| AUTH-02 | Phase 95 | Pending |

**Coverage:** 16/16 v2.17 requirements mapped to exactly one phase. No orphans, no duplicates.

*Note: the milestone brief referenced "14 requirements" but `REQUIREMENTS.md` enumerates 16 (FOUND×4, EDIT×6, POLISH×4, AUTH×2). All 16 are mapped above.*
