# Roadmap — TikTok Slideshow Creator

## Milestones

- 📋 **v2.12 Shapes & Icons (Decoration Primitives)** — Phases 67–72 (planning, started 2026-05-04)
- ✅ **v2.11 Full Editor Parity** — Phases 60–66 (shipped 2026-05-03) — Multi-select, alignment, group/ungroup, smart guides, lock/hide, z-order, layers panel, power-user differentiators. See [archive](milestones/v2.11-ROADMAP.md).
- ✅ **v2.10 Text Box Resize Handles** — Phase 59 (shipped 2026-05-02). See [archive](milestones/v2.10-ROADMAP.md).
- ✅ **v2.9 Viral Visual Quality** — Phases 54–58 (shipped 2026-05-01). See [archive](milestones/v2.9-ROADMAP.md).
- ✅ **v2.8 Text Editor Right-Rail Redesign** — Phases 49–53 (shipped 2026-04-30).
- ✅ **v2.7 Premium Templates** — Phases 44–48 (shipped 2026-04-29).
- ✅ **v2.6 MCP Server** — Phases 40–43 (shipped 2026-04-28).
- ✅ **v2.5 Public REST API Parity** — Phases 34–39 (shipped 2026-04-28).
- ✅ **v2.4 Explore + Remix** — Phases 26–33 (shipped 2026-04-27).
- ✅ **v2.2 Public REST API** — Phases 20–25 (shipped 2026-04-09). See [archive](milestones/v2.2-ROADMAP.md).
- ✅ **v2.1 Text Effects** — Phases 17–19 (shipped 2026-04-07). See [archive](milestones/v2.1-ROADMAP.md).
- ✅ **v2.0 API & MCP Platform** — Phases 14–16 (shipped 2026-04-07). See [archive](milestones/v2.0-ROADMAP.md).

---

# v2.12 Shapes & Icons (Decoration Primitives)

**Goal:** Add Lucide-powered icon picker (1,703 icons) and editable Canva-style shapes (8 primitives + arrows + polygons/stars) as first-class slide elements — fully integrated with the v2.11 multi-element editor (multi-select, marquee, group, align, lock/hide, z-order, layers panel, alt-drag duplicate, arrow nudge) and Gemini AI generation, with TPLREND-05 byte-identity parity preserved across React preview + Satori PNG export. Adds interactive rotation handles for decorations + rotation-aware AABB across all selection-bounds surfaces.

**Phase numbering:** Continues from v2.11 (last phase: 66) → starts at **Phase 67**.

**Granularity:** coarse (per `.planning/config.json`).

**Total reqs:** 81 across 12 categories (DECOR / DEPS / PICKER / SHAPES / RENDER / EDITOR / CARD / ROTATE / KBD / AI / PARITY / MIGR).

**Coverage:** 81/81 requirements mapped (100% — no orphans, no duplicates).

## Phases

- [x] **Phase 67: Schema Foundation + Null-Decoration TPLREND-05 Baseline** — `decorations?: Decoration[]` schema + null-safe iteration sites in both renderers; pin byte-identity on legacy 11 templates BEFORE any feature work. **COMPLETE** (2026-05-04, 2/2 plans shipped — PTF16 GREEN, MIGR-02 + DEPS-01 documented, bundle-delta -169 bytes gz on editor route)
- [x] **Phase 68: Reducer Extensions + Selection Model** — Every multi-select reducer action + selection model + alignment + marquee + group + layers walkers know about decorations; reducer-level tests prove correctness without UI. (completed 2026-05-04)
- [ ] **Phase 69: Renderers + DecorationRenderer + First Parity Proof** — Shared `decoration-renderer.tsx` consumed by BOTH Satori + React preview; hand-injected fixture decorations render byte-identical PNG/DOM across all 8 shapeKinds + 10 representative Lucide icons.
- [x] **Phase 70: Editor UI — Picker + DecorationCard + Layers Panel + Shapes Library** — Lucide modal picker (virtualized + fuzzy + keyboard nav) + 8-shape popover + DecorationCard right-rail + layers panel chips + R/C/L/I/S keyboard insert shortcuts. (completed 2026-05-04)
- [ ] **Phase 71: AI Emit + Fork RPC + Comprehensive Parity Audit** — Gemini emits `decorations[]` per slide with closed-enum allowlist + named color tokens + semantic anchors + advisory monoculture gate; fork RPC migration; final R1–R10 parity audit.
- [ ] **Phase 72: Interactive Rotation Handles + Rotation-Aware AABB** — Drag-to-rotate handle on selected decoration; new `BULK_ROTATE` reducer action; rotation-aware AABB lift across `selection-bounds.ts` / alignment / smart guides / marquee intersect.

## Phase Details

### Phase 67: Schema Foundation + Null-Decoration TPLREND-05 Baseline
**Goal:** `decorations?: Decoration[]` lands on `Slide` as an optional discriminated-union array; both renderers gain null-safe iteration sites at layer 5.5 (between custom_images and watermark); legacy 11 templates render byte-identical PNG to pre-v2.12 baseline; lucide-react upgraded to v1 with zero breaking imports.
**Depends on:** Nothing (first phase of v2.12; locks the parity invariant before any feature work)
**Requirements:** DECOR-01, DECOR-02, DECOR-03, DECOR-04, DECOR-05, DEPS-01, PARITY-09, MIGR-02
**Success Criteria** (what must be TRUE):
  1. Every existing project across all 11 legacy templates renders a byte-identical PNG (Satori) and byte-identical React-preview DOM tree to pre-v2.12 — verified by PTF16 fingerprint snapshot suite running on all 53+ existing projects with `decorations === undefined`.
  2. A developer can construct a `Decoration` discriminated-union value (icon or shape) in TypeScript and have it pass Zod validation at the AI-ingest boundary; unknown lucideName values are silently dropped (graceful degradation, mirrors v2.9 `template_id_override` pattern).
  3. Both renderers (Satori + React preview) iterate `(slide.decorations ?? []).map(...)` at layer 5.5 — when the array is missing, zero DOM nodes are emitted (idempotent absence guarantee).
  4. `lucide-react` upgrade from `0.577.0` to `^1.14.0` produces a NEGATIVE bundle delta on the editor route; grep gate confirms zero brand-icon imports (Github / Slack / Figma / etc) in production code.
**Plans:** 2 plans (2/2 SHIPPED)
- [x] 67-01-PLAN.md — Decoration types + Zod schema + lucide-react v1 upgrade + null-safe iteration stubs in both renderers (DECOR-01..05, DEPS-01 grep) — SHIPPED 2026-05-03 (commits `71bd7b5`/`1d306ae`/`bbd93be`/`52f4ff1`)
- [x] 67-02-PLAN.md — PTF16 idempotent-absence parity baseline + MIGR-02 no-op migration doc + DEPS-01 bundle-delta verification (PARITY-09, MIGR-02, DEPS-01 bundle-delta) — SHIPPED 2026-05-04 (commits `6621612`/`e76f8fa`); 73 tests / 48 snapshots / 12 templates × 6 families + 1 sanity GREEN; bundle-delta -169 bytes gzipped on editor route
**UI hint**: no

### Phase 68: Reducer Extensions + Selection Model
**Goal:** Every multi-select reducer action + selection model + alignment + marquee + group walkers + layers panel helpers know about decorations as a 4th `AddressableScope`; PRA1..PRA12 source-grep audit gate enforces compile-time scope symmetry; reducer-level tests prove correctness without any UI surface.
**Depends on:** Phase 67 (schema)
**Requirements:** EDITOR-01, EDITOR-02, EDITOR-03, EDITOR-04, EDITOR-05, EDITOR-06, EDITOR-08, EDITOR-09, EDITOR-10, EDITOR-11, EDITOR-12, EDITOR-13, EDITOR-14, PARITY-15, PARITY-16, PARITY-17
**Success Criteria** (what must be TRUE):
  1. A multi-selection spanning [text_box + custom_image + watermark + decoration] dispatched to BULK_TRANSLATE / BULK_DELETE / GROUP / UNGROUP / SET_LOCKED / SET_HIDDEN / Z_ORDER / DUPLICATE_ELEMENTS_AT / ALIGN / DISTRIBUTE moves/deletes/groups/locks/hides/z-orders/duplicates/aligns ALL four element types correctly in a single dispatch with a single pushHistory entry.
  2. Cmd+A on a slide with decorations selects all addressable elements across all 4 scopes (text_boxes ∪ custom_images ∪ decorations ∪ watermark); stale-id prune on slide-switch walks decorations.
  3. Z_ORDER dispatched on a decoration id leaves `slide.custom_images` array reference-equal pre/post (PRS7 cross-scope isolation); BULK_TRANSLATE dispatched on a multi-selection containing a locked decoration does NOT move the locked decoration (PRS8 lock-honor regression).
  4. PRA1..PRA12 source-grep audit gate confirms every multi-select reducer action body mentions all 4 `AddressableScope` values (`text_boxes`, `custom_images`, `watermark`, `decorations`) — fails CI on any missing scope.
  5. Canonical `addressable-element-walkers.ts` module exports a single `synthesizeRows` / `computeAllLocked` / `computeAllHidden` / `getGroupMembers` walk; ungroup with [text + decoration] correctly clears groupId on both elements (no orphaned phantom groups).
**Plans:** 3/3 plans complete
- [x] 68-01-PLAN.md — AddressableScope exhaustive type + 3 NEW reducer actions (ADD/UPDATE/REMOVE_DECORATION) + selection-model extension (EDITOR-01, EDITOR-03, EDITOR-14)
- [x] 68-02-PLAN.md — Canonical addressable-element-walkers module + 4 transform extensions + 10 EXTENDED reducer cases with decorations branch (EDITOR-02, EDITOR-04, EDITOR-05, EDITOR-06, EDITOR-08, EDITOR-09, EDITOR-10, EDITOR-11, EDITOR-12, EDITOR-13)
- [x] 68-03-PLAN.md — PRA1..PRA12 source-grep audit gate + PRS7/PRS8 cross-scope isolation tests + final regression sweep (PARITY-15, PARITY-16, PARITY-17)
**UI hint**: no

### Phase 69: Renderers + DecorationRenderer + First Parity Proof
**Goal:** Shared `src/lib/render/decoration-renderer.tsx` is consumed by both Satori PNG path AND React preview; `resolveDecorationSvg()` with LRU cache substitutes `currentColor` to explicit hex; CSS `box-shadow` (never SVG `<filter>`) for shadow effects; CSS `transform: rotate(deg)` for rotation; hand-crafted seed decorations in test fixtures render byte-identical across renderers for all 10 representative Lucide icons + all 8 shapeKinds.
**Depends on:** Phase 67 (schema), Phase 68 (selection routing for click handlers)
**Requirements:** RENDER-01, RENDER-02, RENDER-03, RENDER-04, RENDER-05, RENDER-06, RENDER-07, PARITY-06, PARITY-07, PARITY-11, PARITY-13, PARITY-14
**Success Criteria** (what must be TRUE):
  1. A test fixture slide containing each of 10 representative Lucide icons (Heart / Star / Check / Zap / ArrowRight / X / Plus / Crown / Sparkles / Circle) renders byte-identical between Satori PNG export and React preview DOM tree (PTF13 fingerprint suite green).
  2. A test fixture slide containing each of 8 shapeKinds × {filled, outlined} = 16 shape variants renders byte-identical across both renderers (PTF14); a 1.5×1.0 non-uniformly-scaled icon also renders byte-identical (PTF18).
  3. Drop-shadow on any decoration is implemented via CSS `box-shadow` on the wrapping `<div>` — never SVG `<filter>` (verified by PCL13 source-grep gate); zero `filter:` / `backdrop-filter:` references on any decoration render path.
  4. Zero `currentColor` references in `src/lib/render/` production code (verified by PCL12 source-grep gate); resolver substitutes explicit hex into every emitted SVG before encoding.
  5. Decorations layer renders at layer 5.5 (between custom_images at 5.0 and watermark at 6.0) in BOTH renderer DOM stacks; rotation via CSS `transform: rotate(${deg}deg)` works in both renderers (verified at phase start via Context7 lookup against `vercel/satori`).
**Plans:** 2/3 plans executed
- [x] 69-01-PLAN.md — Lucide registry + decoration-renderer module + Satori support verification (Wave 1)
- [x] 69-02-PLAN.md — Both-renderer integration + 8 shape SVG assets + iteration site swap (Wave 2)
- [ ] 69-03-PLAN.md — PTF13/14/18 parity baseline + PCL12/13 grep gates + final regression sweep (Wave 3)
**UI hint**: yes

### Phase 70: Editor UI — Picker + DecorationCard + Layers Panel + Shapes Library
**Goal:** Users can create and edit decorations end-to-end. Lucide modal picker (virtualized 1,703-icon grid + ufuzzy search + WAI-ARIA keyboard nav) + 8-shape popover + DecorationCard right-rail Inspector (fill / stroke / size / position / shadow / opacity) + layers panel decoration chips + R/C/L/I/S keyboard insert shortcuts. Picker keyboard scope does NOT bubble to editor (Cmd+G must NOT fire GROUP while picker open).
**Depends on:** Phase 67 (schema), Phase 68 (selection + walkers), Phase 69 (renderers)
**Requirements:** DEPS-02, DEPS-03, DEPS-04, DEPS-05, PICKER-01, PICKER-02, PICKER-03, PICKER-04, PICKER-05, PICKER-06, PICKER-07, PICKER-08, SHAPES-01, SHAPES-02, SHAPES-03, SHAPES-04, SHAPES-05, SHAPES-06, SHAPES-07, SHAPES-08, SHAPES-09, KBD-10, KBD-11, KBD-12, CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, PARITY-12, PARITY-18
**Success Criteria** (what must be TRUE):
  1. User opens icon picker (modal mount, mirror `publish-modal.tsx`), types "heart" → fuzzy-search results filter within 250ms via `@leeoniya/ufuzzy`; arrow keys traverse the virtualized 4-col grid (WAI-ARIA grid pattern); Enter inserts at slide center; Esc closes; clicking any of 1,703 icons inserts at slide center and auto-selects the new decoration.
  2. User presses R / C / L while editor has focus → rect / circle / line shape inserts at slide center; user presses I / S → icon picker / shape picker opens; while picker is open, pressing Cmd+G does NOT fire editor's GROUP action (verified by `isPickerOpenRef` second short-circuit wired to all 33 tinykeys firewalls from v2.11 SWEEP-1..4).
  3. User selects a decoration on canvas → right rail switches to `<DecorationCard>` showing fill color (react-colorful hex+alpha picker with brand-kit + derived_palette quick swatches), stroke color + width slider (1–8px) + style enum (solid/dashed/dotted), size + position numeric inputs, drop shadow toggle, opacity slider (0–100%); editing any control updates the canvas in real time and produces a single undo entry per gesture.
  4. Selected decoration appears in the layers panel as a chip with proper icon glyph or shape silhouette label; lock/hide/z-order toggle buttons work via Plan 64 reducer actions (LP-NEW1..3 layers walk: solo decoration appears, decoration-in-group appears with shared groupId, multi-decoration group renders consistent group chip).
  5. Editor route bundle chunk size is ≤ v2.11 baseline + 200KB (verified by CI bundle-size gate, mirror v2.6 triple-layer build-gate pattern); decoration render paths contain zero `*selection*` / `*marquee*` / `*guide*` / `*lock-icon*` / `*decoration-ring*` classNames (PCL11 chrome-leak grep gate).
  6. Shape primitives — rect (with 0–50px corner radius slider), circle, ellipse (CSS-styled `<div>`s), triangle, polygon (5/6/8-sided), star (5/6-pointed), arrow, line (pre-baked `public/shapes/*.svg` assets via committed `scripts/build-shapes.ts`) — all 8 kinds insert via picker and render byte-identical across renderers; rect/circle/ellipse/star support Shift+resize aspect-ratio lock (closes v2.10 ASPECT-01).
**Plans:** 5/5 plans complete
- [x] 70-01-PLAN.md — Stack additions (DEPS-02..05) + DEPS-05 bundle-size gate baseline + ShapePicker popover (8-tile, SHAPES-01/02) + scripts/build-shapes.ts full populate (SHAPES-05) + manifest.json + 8 outlined SVG variants
- [x] 70-02-PLAN.md — Lucide picker modal: virtualized 4-col grid (PICKER-01/02) + ufuzzy fuzzy search 250ms debounce (PICKER-03) + WAI-ARIA grid keyboard nav (PICKER-04) + click-insert (PICKER-05) + tooltip (PICKER-06) + lazy-load via next/dynamic (PICKER-08); LUCIDE_PICKER_CORPUS + buildDefaultIconDecoration factory
- [x] 70-03-PLAN.md — R/C/L direct-insert shortcuts (KBD-10) + I/S picker open shortcuts (KBD-11) + isPickerOpenRef firewall on all 33 tinykeys binding sites (PICKER-07 + KBD-12) + SWEEP-PICK behavioral test grid + grep audit
- [x] 70-04-PLAN.md — DecorationCard right-rail Inspector (CARD-01..05) with react-colorful fill/stroke pickers + size+position inputs + drop shadow + opacity 0-100% UI clamped to 0..1 storage (WR-01); per-shape controls (cornerRadius/points/aspect-lock — SHAPES-06/07/09); stroke style enum (SHAPES-08); click-to-select on rendered decoration in editable view (EDITOR-14)
- [x] 70-05-PLAN.md — Layers panel decoration chip rendering with miniature 16×16 glyph via decoration-renderer (PARITY-18 LP-NEW1..3) + PCL11 chrome-leak grep gate (PARITY-12) + final phase-70 regression sweep (tsc baseline + bundle gate + SUMMARY existence + req traceability)
**UI hint**: yes

### Phase 71: AI Emit + Fork RPC + Comprehensive Parity Audit
**Goal:** Gemini's slide-generation schema lifts to emit `decorations[]` per slide with `maxItems: 2` cap, ~100-icon PascalCase allowlist, named color tokens (`'accent'` / `'palette-vibrant'`) resolved server-side to explicit hex, semantic position anchors (`'top-right'` / `'bottom-left'`) resolved to safe-zone % coords; advisory monoculture gate logs warning if ≥60% of slides share lucideName/shapeKind (does NOT fail CI in v2.12); fork RPC migration strips `locked` flag on decorations.
**Depends on:** Phase 67 (schema), Phase 68 (reducer), Phase 69 (renderers), Phase 70 (editor UI for QA round-trip)
**Requirements:** AI-01, AI-02, AI-03, AI-04, AI-05, PARITY-10, MIGR-01
**Success Criteria** (what must be TRUE):
  1. User generates a 5-slide carousel via Gemini → AI emits 0–2 decorations per slide; emitted decorations use named color tokens (never raw hex from AI) resolved server-side via `resolveAIColor(token, template, derived_palette)`; emitted positions use semantic anchors resolved server-side to safe-zone offsets that do NOT occlude hook text.
  2. AI-emitted decoration names outside the closed-enum allowlist (e.g. Phosphor `'arrow-right-circle-fill'`) are silently dropped at the AI-ingest boundary in `generate-slides.ts` post-Zod-parse; AI emitting >2 decorations per slide is server-side-clamped to the first 2; decoration on decoration-bearing slide renders byte-identical across renderers (PTF17).
  3. Across a 20-prompt diversity corpus, advisory `decorationDiversityCheck()` logs warning if ≥60% of generated slides share the same `lucideName` or `shapeKind` (mirror v2.9 `hookOpeningTrigram` pattern); does NOT fail CI in v2.12; carry-forward to fail-gate in v3.0+ if production data shows monoculture.
  4. User forks a published carousel containing locked decorations → `fork_published_carousel` RPC strips `locked` flag from decorations[] (mirror v2.11 `20260502_fork_strip_locked.sql` SQL helper); forker inherits decoration positions/colors but NOT lock state.
**Plans**: TBD
**UI hint**: no

### Phase 72: Interactive Rotation Handles + Rotation-Aware AABB
**Goal:** Power users can drag-rotate decorations via Figma/Canva-style handle (16px circle ~20px above selected element); new `BULK_ROTATE` reducer action with single pushHistory entry per gesture; `selection-bounds.ts` extended to compute rotation-aware corners via cos/sin transform; alignment + smart guides + marquee intersect honor rotated bounds; numeric rotation input in DecorationCard (–180° to 180°); 45°-rotated arrow shape renders byte-identical across renderers (PTF15).
**Depends on:** Phase 67 (schema includes rotation field), Phase 68 (reducer/selection foundation), Phase 69 (renderer rotation via CSS transform), Phase 70 (DecorationCard + canvas selection chrome)
**Requirements:** ROTATE-01, ROTATE-02, ROTATE-03, ROTATE-04, EDITOR-07, CARD-06, PARITY-08
**Success Criteria** (what must be TRUE):
  1. User selects a decoration → 16px circular rotation handle appears ~20px above the element bounds (Figma/Canva pattern); user drags the handle → decoration rotates around its center via CSS `transform: rotate(deg)`; releasing the drag dispatches `BULK_ROTATE` once and produces a single undo entry per gesture.
  2. User rotates an arrow decoration to 45° → React preview and Satori PNG export render byte-identical (PTF15 fingerprint snapshot green).
  3. User selects a multi-selection containing a 45°-rotated decoration + a non-rotated text_box → selection-bounds AABB encloses the rotated decoration's true rotated corners (cos/sin transform); alignment Alt+A aligns to the rotated AABB top edge correctly; smart guides snap to rotated edges; marquee intersect selects rotated decorations whose true (rotated) bounding box overlaps the marquee rect.
  4. User edits the numeric rotation input in DecorationCard (–180° to 180°) → decoration rotates instantly in the canvas preview; numeric input round-trips with the drag handle (handle and input always show the same value).
**Plans**: TBD
**UI hint**: yes

## Phase Dependency Graph

```
Phase 67 (Schema + Null Audit)
    │
    ├──► Phase 68 (Reducer + Selection Model)
    │       │
    │       └──► Phase 69 (Renderers + DecorationRenderer)
    │               │
    │               └──► Phase 70 (Editor UI: Picker + Card + Layers + Shapes)
    │                       │
    │                       ├──► Phase 71 (AI Emit + Fork RPC + Final Audit)
    │                       │
    │                       └──► Phase 72 (Rotation Handles + AABB Lift)
```

**Build-order constraints (non-negotiable):**

- Schema (DECOR) MUST precede reducer — reducer cases reference Decoration types
- Reducer MUST precede renderers — renderer tests dispatch ADD_DECORATION
- Renderers MUST precede editor UI — picker dispatches ADD_DECORATION; card reads from render path
- Editor UI MUST precede AI emit — AI integration tests require working editor round-trip
- DEPS-01 lands in earliest consumer (Phase 67); DEPS-02..05 land in Phase 70 (picker/card consumers)
- PARITY tests land in the phase whose code they validate (PCL11/12/13 + PTF13/14/16/18 + LP-NEW + PRA1..12 + PRS7/8 distributed by validation target)

**Why 6 phases instead of research's recommended 5:**
Research synthesis assumed `rotation` field as schema-only with deferral of interactive drag handles to v3+. v2.12 REQUIREMENTS.md instead opts for full interactive rotation (ROTATE-01..04). The rotation-aware AABB lift across `selection-bounds.ts` is significant cross-cutting work that affects multi-select alignment, marquee intersect, group bounds, and smart guides. Folding into Phase 70 would bloat the editor-UI phase past its UX-focused scope; folding into Phase 68 would pollute the reducer-extension phase with transform-math sub-work. Phase 72 is dedicated to rotation handles + AABB lift + final rotation parity proof — clean dependency edges, single coherent goal.

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 67. Schema Foundation + Null-Decoration TPLREND-05 Baseline | 2/2 | Complete | 2026-05-04 |
| 68. Reducer Extensions + Selection Model | 3/3 | Complete   | 2026-05-04 |
| 69. Renderers + DecorationRenderer + First Parity Proof | 2/3 | In Progress|  |
| 70. Editor UI — Picker + DecorationCard + Layers Panel + Shapes Library | 5/5 | Complete   | 2026-05-04 |
| 71. AI Emit + Fork RPC + Comprehensive Parity Audit | 0/0 | Not started | — |
| 72. Interactive Rotation Handles + Rotation-Aware AABB | 0/0 | Not started | — |

## Coverage Summary

**81/81 requirements mapped (100%) — no orphans, no duplicates.**

| Category | Count | Phase Distribution |
|----------|-------|--------------------|
| DECOR | 5 | All in Phase 67 |
| DEPS | 5 | DEPS-01 in 67; DEPS-02..05 in 70 |
| PICKER | 8 | All in Phase 70 |
| SHAPES | 9 | All in Phase 70 |
| RENDER | 7 | All in Phase 69 |
| EDITOR | 14 | EDITOR-01..06,08..14 in 68; EDITOR-07 in 72 |
| CARD | 6 | CARD-01..05 in 70; CARD-06 in 72 |
| ROTATE | 4 | All in Phase 72 |
| KBD | 3 | All in Phase 70 |
| AI | 5 | All in Phase 71 |
| PARITY | 13 | PARITY-09 in 67; PARITY-15/16/17 in 68; PARITY-06/07/11/13/14 in 69; PARITY-12/18 in 70; PARITY-10 in 71; PARITY-08 in 72 |
| MIGR | 2 | MIGR-02 in 67; MIGR-01 in 71 |

## Cross-Phase Constraints (carry-forward — every plan must honor)

| Constraint | Source | Notes |
|------------|--------|-------|
| `(slide.decorations ?? []).map(...)` at every render+transform site | TPLREND-05 + idempotent absence | Never `slide.decorations.map(...)` |
| Explicit hex in every schema color field | A.2 + PCL12 grep gate | No `currentColor`, no `inherit`, no CSS vars |
| CSS `box-shadow` for shadow effects | A.3 + PCL13 grep gate + v2.1 reuse | Never SVG `<filter>` |
| Per-icon static imports OR dynamicIconImports | B.1 + CI bundle gate | Never barrel `import * as LucideIcons` |
| `isPickerOpenRef` second short-circuit on all tinykeys firewalls | H.1 SWEEP-1..4 carry-forward | Picker keyboard scope MUST suspend editor scope |
| `AddressableScope` exhaustive type + PRA1..PRA12 source-grep audit | G.1 reducer symmetry | Locked before reducer cases merge |
| `onDragStop` / `onResizeStop` / `onRotateStop` only | v2.10 PERF-01 carry-forward | Never per-tick dispatch |
| `pushHistory` once per gesture | KBD-09 + ALIGN-08 carry-forward | Single undo step per multi-element op |
| Editor chrome gated `editable={true}` | TPLREND-05 + PARITY-01 carry-forward | Selection rings, marquee, smart guides, group bbox, layers panel, decoration handles — all gated |
| Z-order = array splice | ZORDER-05 + Satori invariant | Never CSS `z-index` |
| Selection state outside reducer history | SEL-15 + v2.8 pattern | React state only |

## Definitively Out of Scope (v2.12)

| Item | Reason |
|---|---|
| Vector path editing (anchor-point drag) | Wrong product domain — slide tool, not vector editor |
| Boolean shape ops (union/subtract/intersect) | Off-pattern; Beautiful.ai/Tome/Gamma do not ship |
| Gradient fills on shapes | vercel/satori gradient bugs unresolved (#162/#712) |
| Image fill / mask on shapes | Different feature category |
| Second icon library (Phosphor, Heroicons) | Lucide 1,703 icons sufficient; aesthetic drift risk |
| Cross-slide decoration paste | TPLREND-05 cross-slide invariant; same hard-NO as v2.11 J57 |
| Nested groups | v2.11 hard-NO carries forward; decorations join flat groups only |
| Draw-on-canvas free-form shapes | Conflicts with v2.11 marquee pointer state machine |
| Smart connector arrows with auto-routing | Off-pattern for carousel use case |
| Icon favorites / recents / categories | Pre-PMF; requires per-user Supabase state |
| Custom SVG upload | Premium tier; right-of-publicity legal review needed (v2.13+) |
| `lucide-react/dynamic` `<DynamicIcon>` | Maintainer-documented anti-pattern for non-CMS apps |
| Inline `<svg><circle/></svg>` JSX in Satori | Satori `presets.ts` does not list SVG shape elements |
| `react-xarrows` for connectors | Unmaintained; off-pattern |
| `konva` / `fabric.js` canvas substrate | Wrong substrate; destroys TPLREND-05 invariant |
| CSS `filter:` / `backdrop-filter:` on decorations | vercel/satori#573 silent drop (burned in v2.9) |
| Variable-font icon weight | Satori issues #162 / #712 unresolved |
