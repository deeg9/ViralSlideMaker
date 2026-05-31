# Roadmap — TikTok Slideshow Creator

## Milestones

- 🚧 **v2.17 Mobile Optimization** — Phases 91–95 (in progress, started 2026-05-31)
- ✅ **v2.16 Picker Polish & Brand-Kit Shelving** — Phases 89–90 (shipped 2026-05-21)
- ✅ **v2.15 DB-Backed Template Wiring** — Phases 87–88 (shipped 2026-05-19)
- ✅ **v2.14 Save as Template** — Phases 83–86 (shipped 2026-05-19)
- ✅ **v2.13 Style-from-Reference Generation** — Phases 73–82 (shipped 2026-05-14)
- ✅ **v2.12 Shapes & Icons (Decoration Primitives)** — Phases 67–72 (shipped 2026-05-04)
- ✅ **v2.11 Full Editor Parity** — Phases 60–66 (shipped 2026-05-03)
- ✅ **v2.10 Text Box Resize Handles** — Phase 59 (shipped 2026-05-02)
- ✅ **v2.9 Viral Visual Quality** — Phases 54–58 (shipped 2026-05-01)
- ✅ **v2.8 Text Editor Right-Rail Redesign** — Phases 49–53 (shipped 2026-04-30)
- ✅ **v2.7 Premium Templates** — Phases 44–48 (shipped 2026-04-29)
- ✅ **v2.6 MCP Server** — Phases 40–43 (shipped 2026-04-28)
- ✅ **v2.5 Public REST API Parity** — Phases 34–39 (shipped 2026-04-28)
- ✅ **v2.4 Explore + Remix** — Phases 26–33 (shipped 2026-04-27)
- ✅ **v2.2 Public REST API** — Phases 20–25 (shipped 2026-04-09)
- ✅ **v2.1 Text Effects** — Phases 17–19 (shipped 2026-04-07)
- ✅ **v2.0 API & MCP Platform** — Phases 14–16 (shipped 2026-04-07)

---

## 🚧 v2.17 Mobile Optimization (In Progress)

**Milestone Goal:** Make the entire app feel native-quality on an iPhone 15 (393×852, iOS Safari) — every surface mobile-first, with the slide editor genuinely usable for touch editing. CSS-first retrofit, zero new heavy dependencies.

**Forced build order (from research):** `env(safe-area-inset-*)` reads `0` until `viewport-fit=cover` ships, so **Foundation must land first**. The **tap-to-edit-text touch gate (EDIT-01)** must be verified/repaired on a physical iPhone **before** the editor layout rework. The logged-out/auth pass is externally blocked on a login credential and is sequenced last so it can't stall the editor track.

## Phases

- [ ] **Phase 91: Cross-Cutting Mobile Foundation** — `viewport-fit=cover` + iOS safe-area insets, `dvh` shells, global 44px tap targets, input zoom/contrast fixes
- [ ] **Phase 92: Editor Touch-Edit Validation Gate** — verify (and repair if broken) tap-to-edit-text on a real iPhone before any layout rework
- [ ] **Phase 93: Editor Mobile Layout Rework** — bottom-sheet primitive + canvas-dominant re-host of editor chrome, persistent thumb-reachable action bar, safe destructive actions
- [ ] **Phase 94: App-Wide Mobile Polish** — template-picker grid, settings sub-nav, swipeable public viewer, 393px typography/spacing tuning
- [ ] **Phase 95: Logged-Out & Auth Mobile Pass** — landing + auth screens optimized at 393px *(externally blocked on a login credential)*

## Phase Details

### Phase 91: Cross-Cutting Mobile Foundation
**Goal**: Land the cross-cutting iOS-Safari correctness primitives that every other phase depends on — `viewport-fit=cover` so safe-area env vars populate, `dvh` full-height shells, a reusable 44px tap-target utility, no input zoom-on-focus, and readable input contrast.
**Depends on**: Nothing (first phase of the milestone; continues from Phase 90)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. On a physical iPhone 15, the fixed bottom tab nav and editor action bars clear the home indicator/notch — no UI is obscured by or colliding with safe-area zones (`viewport-fit=cover` + `env(safe-area-inset-*)` consumed on fixed/edge bars).
  2. Full-height screens (editor shell, canvas column) fill the visible viewport with no content cut off under the collapsing iOS URL bar (`100vh` → `dvh`/`svh`).
  3. A user can tap interactive controls (header icon, toolbar icons, chips, chevrons, undo/redo) that all meet a ≥44×44px touch target — the editor's documented 46 sub-40px controls are gone (regression-gated by the Playwright sub-44 probe).
  4. Focusing any text input does not trigger iOS zoom (≥16px effective font), and the prompt placeholder/label text is readable at WCAG AA contrast.
**Plans**: TBD

### Phase 92: Editor Touch-Edit Validation Gate
**Goal**: Confirm on a real iPhone that a user can tap a text element on a slide and edit it with the on-screen keyboard not covering the field — and if the flow is broken, diagnose and repair the tap/drag disambiguation and `.focus()` synchrony before any chrome rework is built. This is a verify-and-repair gate, not a construction phase.
**Depends on**: Phase 91 (44px hit areas make the element tappable at all; `dvh` + `viewport` export in place for keyboard behavior)
**Requirements**: EDIT-01
**Success Criteria** (what must be TRUE):
  1. On a physical iPhone 15, tapping a text element on a slide selects it and mirrors the selection in the editor rail.
  2. Tapping (vs dragging) a text element opens the iOS keyboard and lets the user edit its text, with the keyboard NOT covering the field being edited.
  3. Edited text persists on blur/save (no silent revert), and a short drag still moves the element rather than entering edit mode (movement-threshold disambiguation holds).
**Plans**: TBD
**UI hint**: yes

### Phase 93: Editor Mobile Layout Rework
**Goal**: Re-host the editor's vertical chrome at the single `grid-cols-1 lg:grid-cols-[260px_1fr_340px]` seam so the 9:16 canvas becomes the dominant surface on a phone — tool panels move into a thumb-friendly bottom sheet (new `sheet.tsx` on the already-installed `@radix-ui/react-dialog`, reusing existing rail internals byte-identical), core actions live in a persistent safe-area bottom bar, the filmstrip gets a clear scroll affordance, and destructive actions can't cause accidental data loss. Container re-host, not a rewrite.
**Depends on**: Phase 91 (safe-area + `dvh` + 44px), Phase 92 (verified touch tap-to-edit)
**Requirements**: EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06
**Success Criteria** (what must be TRUE):
  1. On a phone the 9:16 canvas is the dominant element — editor chrome collapses so the canvas is not squeezed by stacked filmstrip + Layers + tabs + bars.
  2. A user can open the Text / Elements / Images tool panels via thumb-reachable bottom sheets that reuse the existing rail panels, and (verified on device) the sheet coexists with the iOS keyboard without hiding the focused field.
  3. A user can navigate slides via a thin filmstrip with a clear scroll/selection affordance — no silently-hidden horizontal scroll.
  4. A user can reach Export, add, undo/redo, and the Public toggle from a persistent, safe-area-padded, thumb-reachable bottom action area.
  5. Deleting a slide or element requires confirmation or is undoable, and destructive controls are spaced away from primary tap targets so a 44px mis-tap can't silently destroy data (closes the documented hard-delete-via-adjacent-control scar).
**Plans**: TBD
**UI hint**: yes

### Phase 94: App-Wide Mobile Polish
**Goal**: Bring the remaining non-editor surfaces to mobile-first quality — the template picker becomes a scannable grid, settings sub-nav exposes off-screen tabs, the public carousel viewer gains swipe navigation, and typography/spacing are tuned for 393px across surfaces. Independent of the editor track; only depends on the Phase 91 foundation.
**Depends on**: Phase 91 (foundation; runs parallel with Phases 92–93)
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04
**Success Criteria** (what must be TRUE):
  1. A user can browse all 16 templates in a mobile-friendly grid in the picker — no silently-hidden horizontal scroll.
  2. On mobile, off-screen settings sub-nav tabs are discoverable (scroll affordance / no silently hidden tabs).
  3. A user can swipe (in addition to tapping chevrons) to move between slides in the public carousel viewer on touch.
  4. Headings and spacing read correctly at 393px across surfaces — oversized headings no longer eat the fold and mobile rhythm is consistent.
**Plans**: TBD
**UI hint**: yes

### Phase 95: Logged-Out & Auth Mobile Pass
**Goal**: Audit and fix the logged-out landing page and all auth screens at 393px with mobile-correct form ergonomics. Sequenced last and kept separable because it is externally blocked on a login credential needed to round-trip the authed transitions — it must not stall the editor track.
**Depends on**: Phase 91 (foundation). **External dependency:** a login credential to round-trip `/login` → `/signup` → onboarding → reset flows. Do not start the authed-transition retest until the credential is available.
**Requirements**: AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. The logged-out landing page (`/`) is fully mobile-optimized at 393px — no horizontal overflow, readable hierarchy, tap-sized controls.
  2. The auth screens (`/login`, `/signup`, `/onboarding/username`, `/forgot-password`, `/reset-password`) are fully mobile-optimized at 393px with mobile-correct form ergonomics (input types, autocomplete, ≥16px fonts, sticky submit).
**Plans**: TBD
**UI hint**: yes

## Milestone Exit Criteria (non-functional)

- **Real-device validation gate:** EDIT-01 (Phase 92) and overall editor sign-off (Phase 93: EDIT-02/03 + iOS keyboard/safe-area behavior) are validated on the user's **physical iPhone** (confirmed available 2026-05-31). Playwright cannot reproduce safe-area insets, the `100vh` URL-bar collapse, the keyboard overlay, or real touch — bake device-test checkpoints into Phases 91–93 (and mid-Phase-93, not only at the end).
- **No new heavy dependencies:** bottom sheet builds on the already-installed `@radix-ui/react-dialog`; touch uses existing Pointer Events / react-rnd. Adding `@use-gesture/react`, `vaul`, etc. is out of scope.

## Progress

**Execution Order:** Phases execute in numeric order: 91 → 92 → 93 → 94 → 95. Phase 94 may run in parallel with 92–93 (it only depends on 91). Phase 95 is sequenced last (credential-blocked) but only hard-depends on 91.

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 91. Cross-Cutting Mobile Foundation | v2.17 | 0/TBD | Not started | - |
| 92. Editor Touch-Edit Validation Gate | v2.17 | 0/TBD | Not started | - |
| 93. Editor Mobile Layout Rework | v2.17 | 0/TBD | Not started | - |
| 94. App-Wide Mobile Polish | v2.17 | 0/TBD | Not started | - |
| 95. Logged-Out & Auth Mobile Pass | v2.17 | 0/TBD | Not started | - |

_Phases 14–90 (v2.0–v2.16) complete — see milestone archives under `.planning/milestones/`._

---

## Shipped Milestones (archived detail)

<details>
<summary>✅ v2.16 Picker Polish & Brand-Kit Shelving (Phases 89–90) — SHIPPED 2026-05-21</summary>

Made the template picker visually represent what users actually generate (real photo-backed preview PNGs, no more text-on-solid-color), and fully shelved the brand-kit feature.

- [x] **Phase 89: Brand-Kit Shelving (Full Removal)** (4/4 plans) — completed 2026-05-21. Removed the brand-kit feature across ~79 files (picker tile, Settings page, `/api/v1/me/brand-kit/*` routes, render/publish/download wiring, AI prompts, style-from-reference flow, `src/lib/brand-kit/` + types); added the defensive `brand-kit → news-oracle` resolver fallback. Render parity 45/45 held; DB schema left dormant.
- [x] **Phase 90: Pre-Rendered Template Preview Pipeline** (3/3 plans) — completed 2026-05-21. Built `scripts/render-template-previews.ts`, ran it live (16 code-template cover PNGs sourced from `christopherfill9@gmail.com`'s carousels, uploaded to the `template-previews` Supabase bucket, `preview` URLs wired into all 16 template files); collapsed `<TemplateTilePreview>` to a single-branch `<img>`.

Full detail: `.planning/milestones/v2.16-ROADMAP.md` · Requirements: `.planning/milestones/v2.16-REQUIREMENTS.md` · Audit: `.planning/milestones/v2.16-MILESTONE-AUDIT.md`

</details>

<details>
<summary>✅ v2.15 DB-Backed Template Wiring (Phases 87–88) — SHIPPED 2026-05-19</summary>

Made a v2.14 DB-backed template usable end-to-end — pickable in the generation picker, preserved through generation, rendered identically across all three render paths, and preserved through publish/fork. Closed v2.14's TSTORE-02 / TSTORE-03, which previously passed only as isolated unit tests because Phase 83's merged code+DB registry was built but never wired into the app. App-layer wiring only — no schema migration. Verified by a live end-to-end Playwright dry-run.

- [x] **Phase 87: Picker + Generation Wiring** (2/2 plans) — completed 2026-05-19
- [x] **Phase 88: Render Paths + Per-Slide Override + Publish/Fork** (3/3 plans) — completed 2026-05-19

Full detail: `.planning/milestones/v2.15-ROADMAP.md` · Requirements: `.planning/milestones/v2.15-REQUIREMENTS.md` · Audit: `.planning/milestones/v2.15-MILESTONE-AUDIT.md`

</details>

<details>
<summary>✅ v2.14 Save as Template (Phases 83–86) — SHIPPED 2026-05-19</summary>

Admin-authored, DB-backed templates that capture a real carousel's full layout recipe — so the team can mint polished picker templates from real carousels with no code deploy, and new carousels generate pre-shaped to them. Closed-enum invariant + TPLREND-05 render parity + byte-identity back-compat preserved throughout.

- [x] **Phase 83: DB-Backed Template Storage + Registry Merge** (3/3 plans) — completed 2026-05-19
- [x] **Phase 84: LayoutRecipe Model + Extraction** (3/3 plans) — completed 2026-05-19
- [x] **Phase 85: Recipe-Driven Generation** (3/3 plans) — completed 2026-05-19
- [x] **Phase 86: Admin Save-as-Template Flow + Previews** (3/3 plans) — completed 2026-05-19

Full detail: `.planning/milestones/v2.14-ROADMAP.md` · Requirements: `.planning/milestones/v2.14-REQUIREMENTS.md` · Audit: `.planning/milestones/v2.14-MILESTONE-AUDIT.md`

</details>

<details>
<summary>✅ v2.13 Style-from-Reference Generation (Phases 73–82) — SHIPPED 2026-05-14</summary>

Vision-LLM-driven style extraction from uploaded slideshow images + spec preview + two content paths + remix/fork/publish snapshot + legal hardening + composition-aware archetype extraction (Phase 80) + first-run onboarding (Phase 81) + category-driven headline-first generation (Phase 82). Full detail: `.planning/milestones/v2.13-ROADMAP.md`.

</details>

<details>
<summary>✅ v2.0–v2.12 (Phases 14–72) — SHIPPED</summary>

- **v2.12 Shapes & Icons (Decoration Primitives)** — Phases 67–72 (shipped 2026-05-04). Lucide icon picker (118-icon allowlist) + 8 Canva-style shapes + full v2.11 editor parity + Gemini AI emit + interactive rotation handles + rotation-aware AABB.
- **v2.11 Full Editor Parity** — Phases 60–66 (shipped 2026-05-03). Multi-select, alignment, group/ungroup, smart guides, lock/hide, z-order, layers panel, power-user differentiators.
- **v2.10 Text Box Resize Handles** — Phase 59 (shipped 2026-05-02).
- **v2.9 Viral Visual Quality** — Phases 54–58 (shipped 2026-05-01).
- **v2.8 Text Editor Right-Rail Redesign** — Phases 49–53 (shipped 2026-04-30).
- **v2.7 Premium Templates** — Phases 44–48 (shipped 2026-04-29).
- **v2.6 MCP Server** — Phases 40–43 (shipped 2026-04-28).
- **v2.5 Public REST API Parity** — Phases 34–39 (shipped 2026-04-28).
- **v2.4 Explore + Remix** — Phases 26–33 (shipped 2026-04-27).
- **v2.2 Public REST API** — Phases 20–25 (shipped 2026-04-09).
- **v2.1 Text Effects** — Phases 17–19 (shipped 2026-04-07).
- **v2.0 API & MCP Platform** — Phases 14–16 (shipped 2026-04-07).

Archives under `.planning/milestones/`.

</details>
