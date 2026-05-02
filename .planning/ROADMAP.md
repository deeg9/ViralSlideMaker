---
milestone: v2.10
milestone_name: Text Box Resize Handles
created: 2026-05-02
phases_total: 1
starting_phase: 59
---

# v2.10 Roadmap — Text Box Resize Handles

**Goal:** Ship Canva-style hybrid resize handles on text boxes — corner-drag scales font_size + width together, side handles preserve today's width-only behavior, top/bottom omitted, Shift+corner = width-only escape hatch. Zero schema diff, zero migration risk.

**Granularity:** coarse (per `.planning/config.json`)
**Phases:** 1 (Phase 59)
**Requirements:** 13/13 mapped (100% coverage)

**Locked engineering direction** (from `.planning/research/SUMMARY.md` + user confirmation 2026-05-02):
- Library: `react-rnd@10.5.3` (already installed) — 6-line `enableResizing` flip + callback extension.
- Schema: NO new field on `TextBoxPosition`. Persist via existing `font_size` + `position.width`.
- UX: Canva-style hybrid (corner = scale font + width; side = width only; top/bottom off; Shift+corner = width-only).
- Past-the-cap: box keeps growing, font caps at 240 (hook) / 120 (body).
- Single phase, 4 internal commits (C1-C4) — see Phase Details below.

---

## Phases

- [ ] **Phase 59: Corner Resize Handles + Font-Scale** — Ship corner-drag-to-scale-font-and-width on text boxes with side-handle width-only behavior preserved; route through existing `style_overrides.{hook,body}_font_size` precedence; single undo entry per gesture; 24x24 WCAG hit zone; renderer parity invariant preserved.

---

## Phase Details

### Phase 59: Corner Resize Handles + Font-Scale

**Goal**: Ship corner-drag-to-scale-font-and-width on text boxes (hook, body, custom) with side-handle width-only behavior preserved, top/bottom handles disabled, Shift+corner width-only escape hatch, single undo entry per gesture, WCAG 2.5.8 AA touch target compliance, and the v2.9 TPLREND-05 renderer parity invariant intact across all 3 render paths.

**Depends on**: v2.8 (`TextBox[]` schema + `applyDualWrite` reducer + `selectedTextBoxId` selection wiring); v2.9 (`resolve-overlay.ts` resolver pattern + `parity.test.tsx` invariant). Both consumed unchanged.

**Requirements**: RESIZE-01, RESIZE-02, RESIZE-03, RESIZE-04, FONTSCALE-01, FONTSCALE-02, FONTSCALE-03, FONTSCALE-04, PARITY-01, PARITY-02, UNDO-01, A11Y-01, A11Y-02 (13/13 active reqs)

**Success Criteria** (what must be TRUE — observable user behaviors):

1. User can grab any of 4 corner handles (TL, TR, BL, BR) on the active text box (hook, body, or custom) and drag — both the box width AND the font size grow proportionally in real time during the drag, with the right-rail font-size slider settling on the new value within one render frame after release.
2. User can drag left or right side handles and the box width changes WITHOUT the font size changing — muscle memory from v2.8 is preserved exactly.
3. User holding Shift while dragging a corner gets width-only behavior (no font scaling) — the corner handle behaves identically to a side handle for that gesture.
4. User dragging a corner past the font cap (240px on hooks, 120px on body) sees the box continue to grow while the font stops scaling — drag never feels "stuck."
5. User performing one drag gesture (60+ pointer ticks) sees exactly one undo step on Cmd+Z — the gesture round-trips as an atom, not 60 atoms; renderer output for the dragged slide is byte-identical across `slide-preview.tsx` (non-editable branch), `render-slide.ts`, and `render-slide-satori.tsx` (Satori PNG export); resize handle DOM never leaks into the PNG.

**Plans**: TBD (will be decomposed into ~4 plans by `/gsd-plan-phase 59` mirroring the C1-C4 internal commit shape from `.planning/research/ARCHITECTURE.md`):
- C1: Flip `enableResizing` (corners on, top/bottom off); capture `oldWidthPx` + `oldFontSize` in `onResizeStart`; extend handle styles + WCAG 24x24 hit zone + `nwse/nesw-resize` cursor.
- C2: Dispatch `font_size` alongside `width` on corner `onResizeStop`; route through existing `style_overrides.{hook,body}_font_size` (preserves `hook-fit.ts` precedence); custom-text path via `UPDATE_TEXT_BOX`.
- C3: Single-history-entry test (60-tick drag → history length = 1) + clamp to role bounds + `parity.test.tsx` extension + `editable={true}` Satori-leak regression test.
- C4: Shift+corner = width-only escape hatch (read `e.shiftKey` in `onResizeStop`).

**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 59. Corner Resize Handles + Font-Scale | 0/TBD | Not started | - |

---

## Coverage

**Total active v2.10 requirements:** 13
**Mapped to Phase 59:** 13 (100%)
**Orphaned:** 0

| Requirement | Phase | Notes |
|---|---|---|
| RESIZE-01 (4 corner handles drag-resize) | 59 | C1 |
| RESIZE-02 (left/right side handles preserve width-only) | 59 | C1 (config preservation) |
| RESIZE-03 (top/bottom explicitly disabled) | 59 | C1 (config) |
| RESIZE-04 (Shift+corner = width-only escape) | 59 | C4 |
| FONTSCALE-01 (corner-drag scales font_size proportionally) | 59 | C2 |
| FONTSCALE-02 (past-cap: box grows, font caps) | 59 | C2 (clamp) |
| FONTSCALE-03 (right-rail slider syncs within 1 frame) | 59 | C2 (single source of truth) |
| FONTSCALE-04 (corner-drag overrides hook-fit auto-shrink) | 59 | C2 (route through existing override) |
| PARITY-01 (3-renderer byte-identity) | 59 | C3 (parity.test.tsx extension) |
| PARITY-02 (handles render in editable branch only) | 59 | C3 (regression test) |
| UNDO-01 (single undo entry per gesture) | 59 | C3 (60-tick drag test) |
| A11Y-01 (WCAG 2.5.8 24x24 hit zone) | 59 | C1 (handle wrapper) |
| A11Y-02 (cursor changes on corner hover) | 59 | C1 (cursor styles) |

---

## Anti-Features Locked Out (per FEATURES.md / PITFALLS.md / REQUIREMENTS.md)

- Top/bottom resize handles (RESIZE-05 deferred — anti-feature for auto-fit text)
- Explicit `height` field on `TextBoxPosition` (HEIGHT-01 out of scope — auto-fit is the right design)
- `min_height` field (MIN_HEIGHT-01 out of scope — only earns its keep with top/bottom handles, which we don't ship)
- Rotation handles (ROTATE-01 — defer to v3.0+ if ever)
- Aspect-ratio-lock toggle in right rail (ASPECT-01 — Shift modifier covers it)
- Multi-select group resize (MULTISELECT-01 — reverses v2.8 single-element design)
- Auto-fit-text-to-box-on-type / Magic Resize (AUTOFIT-01 — conflicts with explicit slider model)
- Snap-to-alignment-guides during corner-resize (GUIDES-01 — v2.11 candidate)
- First-use onboarding toast (ONBOARD-01 — pre-PMF, cursor change is enough)

---

## Dependencies (External to Phase 59)

None. v2.8 + v2.9 surface is consumed unchanged. No new npm dependency. No DB migration. No legacy schema changes.

---

## Key Decisions Captured for v2.10

| Decision | Rationale | Source |
|---|---|---|
| Single phase (not 2+) | 13 reqs are tightly coupled — corners + dispatch + parity + undo + a11y must atomically ship to satisfy TPLREND-05 invariant | SUMMARY.md + ARCHITECTURE.md (both recommend single-phase) |
| No new schema field | Existing `font_size` + `position.width` cover the persistence need; eliminates migration risk and a 5-renderer parity broadening | SUMMARY.md (overrides ARCHITECTURE.md `height?` proposal) |
| Canva-style hybrid UX | 7-of-8 surveyed industry tools (Canva, Figma, CapCut, Keynote, Pages, Adobe Express, VEED) scale font on corner-drag by default | FEATURES.md (research-grounded) |
| Shift+corner = escape (ship in v2.10) | User confirmed 2026-05-02; ~30 min of code; matches Figma/Canva muscle memory | User confirmation per planning_context |
| Past-cap behavior: keep growing box | Forgiving > honest; user expects the gesture to never feel "stuck" | FEATURES.md |
| Route font-size through `style_overrides.{hook,body}_font_size` | Preserves existing `hook-fit.ts` precedence chain at `slide-preview.tsx:313` — no registry changes | PITFALLS.md #9 |
| Dispatch on `onResizeStop` only (never `onResize`) | 60-tick history pollution otherwise; matches existing position/width pattern | PITFALLS.md #8 |
| 24x24 hit zone via wrapper, 12x12 visual | WCAG 2.5.8 AA compliance + Figma small-handle aesthetic | PITFALLS.md #7 |

---

*Roadmap drafted 2026-05-02. Locks the engineering direction for v2.10. Phase decomposition by `/gsd-plan-phase 59`.*
