# Requirements — v2.12 Shapes & Icons (Decoration Primitives)

**Goal:** Add Lucide-powered icon picker (1,703 icons) and editable Canva-style shapes (8 primitives + arrows + polygons/stars) as first-class slide elements — fully integrated with the v2.11 multi-element editor (multi-select, marquee, group, align, lock/hide, z-order, layers panel) and Gemini AI generation, with TPLREND-05 byte-identity parity preserved across React preview + Satori PNG export.

**Phase numbering:** Continues from v2.11 (Phase 66 last shipped) → starts at **Phase 67**.

**Source of truth:** `.planning/research/SUMMARY.md` (synthesized 2026-05-03 from 4 parallel research agents). Stack/Features/Architecture/Pitfalls broken out in `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`.

---

## v2.12 Requirements

### Schema Foundation (DECOR)

- [ ] **DECOR-01**: `decorations?: Decoration[]` field added to `Slide` (optional; absent = legacy templates render byte-identical)
- [ ] **DECOR-02**: `Decoration` discriminated union type (`kind: 'icon' | 'shape'`) with shared `DecorationBase` (id, position, size, locked?, hidden?, groupId?, name?, rotation?, opacity?, effects?)
- [ ] **DECOR-03**: `IconDecoration` carries `lucideName: string` + `color: string` (explicit hex, never `currentColor`) + `strokeWidth: number`
- [ ] **DECOR-04**: `ShapeDecoration` carries `shapeKind: 'rect' | 'circle' | 'ellipse' | 'triangle' | 'polygon' | 'star' | 'arrow' | 'line'` + `fill: string` (hex) + `stroke?: { color: string; width: number; style: 'solid' | 'dashed' | 'dotted' }` + per-kind params (`cornerRadius?` for rect, `points?` for polygon/star)
- [ ] **DECOR-05**: Zod schema validates Decoration discriminated union at AI ingest + project load boundaries; unknown lucideName silently dropped (mirror v2.9 `template_id_override` defaulting pattern)

### Stack Additions (DEPS)

- [x] **DEPS-01**: `lucide-react` upgraded `0.577.0 → ^1.14.0` — verified zero breaking imports in codebase via grep gate
- [ ] **DEPS-02**: `@tanstack/react-virtual@^3.13.24` installed for picker virtualized grid (jsdom-testable headless API)
- [ ] **DEPS-03**: `@leeoniya/ufuzzy@^1.0.19` installed for picker fuzzy search (7.6KB, 78× faster than fuse.js benchmarked)
- [ ] **DEPS-04**: `react-colorful@^5.6.1` installed for hex+alpha color picker (2.8KB; tree-shakeable)
- [ ] **DEPS-05**: CI bundle-size gate — editor route chunk ≤ v2.11 baseline + 200KB (mirror v2.6 triple-layer build-gate pattern)

### Lucide Icon Picker UI (PICKER)

- [ ] **PICKER-01**: Modal-mount `<LucidePicker>` (mirror `publish-modal.tsx` pattern; NOT right-rail tab, NOT floating popover)
- [ ] **PICKER-02**: Virtualized grid (4-col responsive) using `@tanstack/react-virtual` — renders only visible rows + overscan; performant at 1,703 icons
- [ ] **PICKER-03**: Fuzzy search input via `@leeoniya/ufuzzy` over `name + tags + categories` corpus from `lucide-static` metadata; 250ms debounce
- [ ] **PICKER-04**: Full keyboard navigation — arrow keys traverse grid (WAI-ARIA grid pattern), Enter inserts at slide center, Esc closes picker
- [ ] **PICKER-05**: Click icon → ADD_DECORATION dispatched; modal closes; new decoration auto-selected
- [ ] **PICKER-06**: Hover tooltip shows icon name (CSS-only; pure native `title=`)
- [ ] **PICKER-07**: `isPickerOpenRef` (useRef) wired as second short-circuit to all 33 tinykeys firewalls from v2.11 SWEEP-1..4 — picker keyboard scope does NOT bubble to editor (Cmd+G must NOT fire GROUP while picker open)
- [ ] **PICKER-08**: Lazy-loaded — picker JS chunk loaded only on first open (next/dynamic + `loading: () => null`)

### Shapes Library (SHAPES)

- [ ] **SHAPES-01**: 8 shape primitives shipped: rect, circle, ellipse, triangle, polygon (5/6/8-sided), star (5/6-pointed), arrow, line
- [ ] **SHAPES-02**: `<ShapePicker>` popover — 8-tile grid; click inserts at slide center
- [ ] **SHAPES-03**: Pre-baked SVG assets in `public/shapes/*.svg` for triangle/polygon/star/arrow/line — `currentColor` substituted to explicit hex at render time (mirror `public/overlays/` pattern from v2.9)
- [ ] **SHAPES-04**: CSS-styled `<div>` for rect/circle/ellipse — no SVG file; verified Satori CSS support
- [ ] **SHAPES-05**: Asset build script `scripts/build-shapes.ts` generates the SVG corpus reproducibly (mirror `scripts/build-textures.ts` v2.9 pattern); committed to repo
- [ ] **SHAPES-06**: Per-shape `cornerRadius` for rect (0–50px slider in DecorationCard)
- [ ] **SHAPES-07**: Per-shape `points` for polygon (5/6/8) and star (5/6-pointed) — closed-enum picker
- [ ] **SHAPES-08**: Stroke style — solid / dashed / dotted (closed enum)
- [ ] **SHAPES-09**: Aspect-ratio lock toggle on rect/circle/ellipse/star (Shift+resize = lock; toggle in DecorationCard) — closes v2.10 ASPECT-01 deferred

### Both-Renderer Integration (RENDER)

- [x] **RENDER-01**: Shared `src/lib/render/decoration-renderer.tsx` — pure JSX emitter for one Decoration; consumed by BOTH `render-slide-satori.tsx` AND `slide-preview.tsx` (single source of truth — TPLREND-05 invariant)
- [ ] **RENDER-02**: `src/lib/render/decorations/registry.ts` — closed-enum Lucide name registry + `resolveDecorationSvg(name)` returning inline SVG string from `lucide-static`; LRU cache for repeat lookups
- [x] **RENDER-03**: Decoration layer inserted at layer 5.5 (between custom_images at 5.0 and watermark at 6.0) in BOTH renderer DOM stacks
- [x] **RENDER-04**: Both renderers wrap `(slide.decorations ?? []).map(...)` — null-safe; legacy templates with `decorations === undefined` render byte-identical
- [ ] **RENDER-05**: Drop-shadow effect uses CSS `box-shadow` on wrapping `<div>` — never SVG `<filter>` (vercel/satori#573 burned in v2.9; reuse v2.1 `TextShadowEffect` shape)
- [ ] **RENDER-06**: Opacity field rendered via CSS `opacity:` on wrapping `<div>` — both renderers
- [ ] **RENDER-07**: Rotation rendered via CSS `transform: rotate(${deg}deg)` on wrapping `<div>` — verified Satori support at Phase 69 start

### v2.11 Editor Parity (EDITOR)

- [ ] **EDITOR-01**: `decorations` becomes 4th `AddressableScope` ('text_boxes' | 'custom_images' | 'watermark' | 'decorations') — exhaustive switch type added; compile-time scope-symmetry gate
- [ ] **EDITOR-02**: 13 reducer cases extended with `decorations` branch: ADD/UPDATE/REMOVE_DECORATION (3 new) + BULK_TRANSLATE + BULK_DELETE + ALIGN + DISTRIBUTE + GROUP + UNGROUP + SET_LOCKED + SET_HIDDEN + Z_ORDER + DUPLICATE_ELEMENTS_AT (10 extended)
- [ ] **EDITOR-03**: Selection model — `Selection.ids[]` accept decoration ids; `useSelectionModel` extended; stale-id prune walks decorations
- [ ] **EDITOR-04**: Marquee selection (selecto) — decorations participate in `<MarqueeOverlay>` rect intersect alongside text_boxes/custom_images/watermark
- [ ] **EDITOR-05**: Group / Ungroup (Cmd+G / Cmd+Shift+G) — decorations participate in flat groups; `getGroupMembers` walks all 4 scopes
- [ ] **EDITOR-06**: Alignment + Distribute (Alt+A/H/D/W/V/S + Cmd+Alt+H/V) — decorations contribute to selection-bounds AABB; `align.ts` extended
- [ ] **EDITOR-07**: Smart guides + snapping — decorations participate in sorted-edge-array snap index; rotation-aware bounds for rotated decorations
- [ ] **EDITOR-08**: Lock / Hide (Cmd+Shift+L) — decoration locked = selectable but blocks drag/resize/edit; hidden = skipped by both renderers
- [ ] **EDITOR-09**: Z-order (Cmd+] / Cmd+[ / Cmd+Alt+] / Cmd+Alt+[) — Z_ORDER reducer routes per-scope; decoration array splice
- [ ] **EDITOR-10**: Layers panel — decorations appear as chips; `synthesizeRows` + `computeAllLocked` + `computeAllHidden` walk decorations; canonical `addressable-element-walkers.ts` module
- [ ] **EDITOR-11**: Alt-drag duplicate — DUPLICATE_ELEMENTS_AT routes to decoration deep-copy (skip locked/hidden)
- [ ] **EDITOR-12**: Arrow-key nudge (1px / Shift+10px) — BULK_TRANSLATE filter inherits decoration support automatically
- [ ] **EDITOR-13**: Selection bounds (union AABB) — decorations contribute; rotation-aware corners via cos/sin transform
- [ ] **EDITOR-14**: Click-to-select on canvas — decoration click dispatches selection.replaceWith([id]); editable={true} gated

### Right-Rail Decoration Controls (CARD)

- [ ] **CARD-01**: `<DecorationCard>` mounted in TextEditorPanel composition when active selection is a decoration (mirror `ActiveTextBoxCard` shell from v2.8)
- [ ] **CARD-02**: Fill color — `react-colorful` hex+alpha picker; brand-kit + `derived_palette` quick swatches (reuses v2.9 palette extraction)
- [ ] **CARD-03**: Stroke color + width slider (1–8px) + style enum (solid/dashed/dotted)
- [ ] **CARD-04**: Size + position (W/H inputs in % of canvas; X/Y inputs)
- [ ] **CARD-05**: Effect toggles — drop shadow (color/blur/offset; reuse v2.1 TextShadowEffect schema); opacity slider (0–100%)
- [ ] **CARD-06**: Rotation numeric input (–180° to 180°) AND interactive drag handle on canvas (see ROTATE-01..04)

### Rotation (ROTATE)

- [ ] **ROTATE-01**: `rotation: number` field on DecorationBase (degrees, default 0)
- [ ] **ROTATE-02**: Interactive rotation handle rendered on selected decoration in canvas (Figma/Canva pattern — 16px circle above element, ~20px gap)
- [ ] **ROTATE-03**: Drag-to-rotate dispatches BULK_ROTATE reducer action (new); single pushHistory entry per gesture
- [ ] **ROTATE-04**: Rotation-aware AABB — `selection-bounds.ts` extended to compute rotated corners via cos/sin; alignment + smart guides + marquee intersect honor rotated bounds

### Keyboard Shortcuts (KBD)

- [ ] **KBD-10**: Direct-insert shortcuts — R / C / L (rect / circle / line) inserts shape at slide center (mirror Canva + Figma); inline `isEditingTarget` firewall
- [ ] **KBD-11**: Picker open shortcut — `I` for icon picker, `S` for shape picker (configurable; documented in keyboard cheat sheet)
- [ ] **KBD-12**: Picker keyboard nav contract — arrow keys traverse grid (NOT bubble to editor); Enter inserts; Esc closes (PICKER-04)

### Gemini AI Emit (AI)

- [x] **AI-01**: Gemini schema lifts to emit `decorations[]` per slide — closed-enum `lucideName` allowlist (~100 PascalCase icons; subset of full 1,703); closed-enum `shapeKind`
- [x] **AI-02**: `maxItems: 2` per slide enforced in Gemini schema AND server-side clamp at AI-ingest boundary (`generate-slides.ts` post-Zod-parse, mirror `legacyToTextBoxes` adapter)
- [x] **AI-03**: AI emits color as named token (`'accent'` / `'palette-vibrant'` / `'palette-dark-muted'`) → resolved server-side to explicit hex via `resolveAIColor(token, slide.template, slide.style_overrides.derived_palette)` — never raw hex from AI
- [x] **AI-04**: AI emits position as semantic anchor (`'top-right'` / `'bottom-left'` / `'center'` / etc.) → resolved server-side to safe-zone % coords; falls back to slide-center on unknown anchor
- [x] **AI-05**: Advisory monoculture gate — `decorationDiversityCheck()` mirror v2.9 `hookOpeningTrigram` pattern; logs warning if ≥60% of slides share lucideName/shapeKind across the carousel; does NOT fail CI in v2.12

### TPLREND-05 Parity Audit Extension (PARITY)

- [ ] **PARITY-06**: PTF13 — ~10 representative Lucide icons (Heart/Star/Check/Zap/ArrowRight/X/Plus/Crown/Sparkles/Circle) byte-identical React preview vs Satori PNG fingerprint
- [ ] **PARITY-07**: PTF14 — 8 shape kinds × filled + outlined = 16 shape fingerprints byte-identical
- [x] **PARITY-08**: PTF15 — 45°-rotated arrow shape byte-identical (rotation edge case)
- [x] **PARITY-09**: PTF16 — `decorations === undefined` slide PNG byte-identical to pre-v2.12 baseline (idempotent-absence gate; verified across all 11 legacy templates)
- [x] **PARITY-10**: PTF17 — AI-emitted decoration on decoration-bearing slide dual-renderer byte-identical
- [ ] **PARITY-11**: PTF18 — Non-uniform scale (1.5×1.0 icon) byte-identical
- [x] **PARITY-12**: PCL11 — chrome-leak grep: decoration render paths contain no `*selection*` / `*marquee*` / `*guide*` / `*lock-icon*` / `*decoration-ring*` classNames
- [ ] **PARITY-13**: PCL12 — color-cascade grep: zero `currentColor` references in `src/lib/render/` production code
- [ ] **PARITY-14**: PCL13 — CSS-filter grep: zero `filter:` / `backdrop-filter:` on any decoration render path
- [x] **PARITY-15**: PRA1..PRA12 — reducer per-scope source-grep audit (every multi-select action body mentions all 4 AddressableScopes); pinned at Plan 65-03 PCL/PTF/PRS extension
- [x] **PARITY-16**: PRS7 — Z_ORDER on decoration id leaves custom_images[] array ref-equal (cross-scope isolation)
- [x] **PARITY-17**: PRS8 — BULK_TRANSLATE with locked decoration does NOT move (lock-honor regression)
- [x] **PARITY-18**: LP-NEW1..3 — layers panel walk: solo decoration appears, decoration-in-group appears with shared groupId, multi-decoration group renders consistent group chip

### Migration + Fork RPC (MIGR)

- [x] **MIGR-01**: Supabase migration `20260YYY_fork_strip_decoration_locked.sql` — fork RPC strips `locked` flag on decorations (mirror v2.11 `20260502_fork_strip_locked.sql` pattern)
- [x] **MIGR-02**: Eager-on-load schema migration handles existing 53+ projects transparently — `decorations === undefined` is the natural baseline; no backfill required (additive-only schema)

---

## Future Requirements (deferred to v2.13+)

- [ ] Icon favorites / recents / categories (requires per-user Supabase state; pre-PMF)
- [ ] Custom SVG upload (premium tier; right-of-publicity legal review needed)
- [ ] Draw-on-canvas for free-form shapes (conflicts with marquee pointer state machine)
- [ ] Smart connector arrows with auto-routing (off-pattern for carousel use case)
- [ ] Per-template `decorationWhitelist` enforcement (advisory monoculture gate covers v2.12; promote to template-level allowlist in v2.13 if needed)
- [ ] Live-wire monoculture retry (advisory only in v2.12; promote to fail-CI + retry-once if production data shows monoculture)
- [ ] Boolean shape ops (union/subtract/intersect — Figma pattern, off-pattern for slide tool)

## Out of Scope (definitively deferred to v3.0+ / never)

| Item | Reason |
|---|---|
| Vector path editing (anchor-point drag) | Wrong product domain — slide tool, not vector editor |
| Gradient fills on shapes | vercel/satori gradient bugs unresolved (#162/#712 since 2026-05) |
| Image fill / mask on shapes | Different feature category |
| Second icon library (Phosphor, Heroicons) | Lucide 1,703 icons is sufficient; adding sources risks aesthetic drift |
| Cross-slide decoration paste | TPLREND-05 cross-slide invariant; same hard-NO as v2.11 J57 |
| Nested groups | v2.11 hard-NO; decorations join flat groups only |
| `lucide-react/dynamic` `<DynamicIcon>` | Maintainer-documented anti-pattern for non-CMS apps; bundle bomb risk |
| Inline `<svg><circle/></svg>` JSX in Satori | Satori `presets.ts` does not list SVG shape elements; pre-baked assets is the only parity-safe path |
| `react-xarrows` for connectors | Unmaintained; off-pattern |
| `konva` / `fabric.js` canvas substrate | Wrong substrate; destroys TPLREND-05 invariant |
| CSS `filter:` / `backdrop-filter:` on decorations | vercel/satori#573 silent drop (burned in v2.9) |
| Variable-font icon weight | Satori issues #162 / #712 unresolved |

---

## Traceability

Every requirement maps to exactly one phase (100% coverage; 81/81 reqs).

| Requirement | Category | Phase | Status |
|---|---|---|---|
| DECOR-01 | Schema Foundation | Phase 67 | Pending |
| DECOR-02 | Schema Foundation | Phase 67 | Pending |
| DECOR-03 | Schema Foundation | Phase 67 | Pending |
| DECOR-04 | Schema Foundation | Phase 67 | Pending |
| DECOR-05 | Schema Foundation | Phase 67 | Pending |
| DEPS-01 | Stack Additions | Phase 67 | Pending |
| DEPS-02 | Stack Additions | Phase 70 | Pending |
| DEPS-03 | Stack Additions | Phase 70 | Pending |
| DEPS-04 | Stack Additions | Phase 70 | Pending |
| DEPS-05 | Stack Additions | Phase 70 | Pending |
| PICKER-01 | Lucide Icon Picker UI | Phase 70 | Pending |
| PICKER-02 | Lucide Icon Picker UI | Phase 70 | Pending |
| PICKER-03 | Lucide Icon Picker UI | Phase 70 | Pending |
| PICKER-04 | Lucide Icon Picker UI | Phase 70 | Pending |
| PICKER-05 | Lucide Icon Picker UI | Phase 70 | Pending |
| PICKER-06 | Lucide Icon Picker UI | Phase 70 | Pending |
| PICKER-07 | Lucide Icon Picker UI | Phase 70 | Pending |
| PICKER-08 | Lucide Icon Picker UI | Phase 70 | Pending |
| SHAPES-01 | Shapes Library | Phase 70 | Pending |
| SHAPES-02 | Shapes Library | Phase 70 | Pending |
| SHAPES-03 | Shapes Library | Phase 70 | Pending |
| SHAPES-04 | Shapes Library | Phase 70 | Pending |
| SHAPES-05 | Shapes Library | Phase 70 | Pending |
| SHAPES-06 | Shapes Library | Phase 70 | Pending |
| SHAPES-07 | Shapes Library | Phase 70 | Pending |
| SHAPES-08 | Shapes Library | Phase 70 | Pending |
| SHAPES-09 | Shapes Library | Phase 70 | Pending |
| RENDER-01 | Both-Renderer Integration | Phase 69 | Pending |
| RENDER-02 | Both-Renderer Integration | Phase 69 | Pending |
| RENDER-03 | Both-Renderer Integration | Phase 69 | Pending |
| RENDER-04 | Both-Renderer Integration | Phase 69 | Pending |
| RENDER-05 | Both-Renderer Integration | Phase 69 | Pending |
| RENDER-06 | Both-Renderer Integration | Phase 69 | Pending |
| RENDER-07 | Both-Renderer Integration | Phase 69 | Pending |
| EDITOR-01 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-02 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-03 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-04 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-05 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-06 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-07 | v2.11 Editor Parity | Phase 72 | Pending |
| EDITOR-08 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-09 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-10 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-11 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-12 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-13 | v2.11 Editor Parity | Phase 68 | Pending |
| EDITOR-14 | v2.11 Editor Parity | Phase 68 | Pending |
| CARD-01 | Right-Rail Decoration Controls | Phase 70 | Pending |
| CARD-02 | Right-Rail Decoration Controls | Phase 70 | Pending |
| CARD-03 | Right-Rail Decoration Controls | Phase 70 | Pending |
| CARD-04 | Right-Rail Decoration Controls | Phase 70 | Pending |
| CARD-05 | Right-Rail Decoration Controls | Phase 70 | Pending |
| CARD-06 | Right-Rail Decoration Controls | Phase 72 | Pending |
| ROTATE-01 | Rotation | Phase 72 | Pending |
| ROTATE-02 | Rotation | Phase 72 | Pending |
| ROTATE-03 | Rotation | Phase 72 | Pending |
| ROTATE-04 | Rotation | Phase 72 | Pending |
| KBD-10 | Keyboard Shortcuts | Phase 70 | Pending |
| KBD-11 | Keyboard Shortcuts | Phase 70 | Pending |
| KBD-12 | Keyboard Shortcuts | Phase 70 | Pending |
| AI-01 | Gemini AI Emit | Phase 71 | Complete |
| AI-02 | Gemini AI Emit | Phase 71 | Complete |
| AI-03 | Gemini AI Emit | Phase 71 | Complete |
| AI-04 | Gemini AI Emit | Phase 71 | Complete |
| AI-05 | Gemini AI Emit | Phase 71 | Complete |
| PARITY-06 | TPLREND-05 Parity Audit | Phase 69 | Pending |
| PARITY-07 | TPLREND-05 Parity Audit | Phase 69 | Pending |
| PARITY-08 | TPLREND-05 Parity Audit | Phase 72 | Complete |
| PARITY-09 | TPLREND-05 Parity Audit | Phase 67 | Pending |
| PARITY-10 | TPLREND-05 Parity Audit | Phase 71 | Complete |
| PARITY-11 | TPLREND-05 Parity Audit | Phase 69 | Pending |
| PARITY-12 | TPLREND-05 Parity Audit | Phase 70 | Pending |
| PARITY-13 | TPLREND-05 Parity Audit | Phase 69 | Pending |
| PARITY-14 | TPLREND-05 Parity Audit | Phase 69 | Pending |
| PARITY-15 | TPLREND-05 Parity Audit | Phase 68 | Pending |
| PARITY-16 | TPLREND-05 Parity Audit | Phase 68 | Pending |
| PARITY-17 | TPLREND-05 Parity Audit | Phase 68 | Pending |
| PARITY-18 | TPLREND-05 Parity Audit | Phase 70 | Pending |
| MIGR-01 | Migration + Fork RPC | Phase 71 | Complete |
| MIGR-02 | Migration + Fork RPC | Phase 67 | Pending |

### Reverse mapping (Phase → Requirements)

| Phase | Reqs | Count |
|---|---|---|
| **Phase 67** — Schema + Null-Decoration Baseline | DECOR-01, DECOR-02, DECOR-03, DECOR-04, DECOR-05, DEPS-01, PARITY-09, MIGR-02 | 8 |
| **Phase 68** — Reducer Extensions + Selection Model | EDITOR-01, EDITOR-02, EDITOR-03, EDITOR-04, EDITOR-05, EDITOR-06, EDITOR-08, EDITOR-09, EDITOR-10, EDITOR-11, EDITOR-12, EDITOR-13, EDITOR-14, PARITY-15, PARITY-16, PARITY-17 | 16 |
| **Phase 69** — Renderers + DecorationRenderer | RENDER-01, RENDER-02, RENDER-03, RENDER-04, RENDER-05, RENDER-06, RENDER-07, PARITY-06, PARITY-07, PARITY-11, PARITY-13, PARITY-14 | 12 |
| **Phase 70** — Editor UI: Picker + Card + Layers + Shapes | DEPS-02, DEPS-03, DEPS-04, DEPS-05, PICKER-01, PICKER-02, PICKER-03, PICKER-04, PICKER-05, PICKER-06, PICKER-07, PICKER-08, SHAPES-01, SHAPES-02, SHAPES-03, SHAPES-04, SHAPES-05, SHAPES-06, SHAPES-07, SHAPES-08, SHAPES-09, KBD-10, KBD-11, KBD-12, CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, PARITY-12, PARITY-18 | 31 |
| **Phase 71** — AI Emit + Fork RPC + Final Audit | AI-01, AI-02, AI-03, AI-04, AI-05, PARITY-10, MIGR-01 | 7 |
| **Phase 72** — Rotation Handles + AABB Lift | ROTATE-01, ROTATE-02, ROTATE-03, ROTATE-04, EDITOR-07, CARD-06, PARITY-08 | 7 |
| **Total** | | **81** |

**Coverage check:** 81/81 reqs mapped to exactly one phase. No orphans. No duplicates.

---

*Generated 2026-05-04 from `.planning/research/SUMMARY.md`. Continues phase numbering from v2.11 (last phase: 66). Total reqs: 81 across 12 categories. Roadmap: `.planning/ROADMAP.md` (Phases 67–72).*
