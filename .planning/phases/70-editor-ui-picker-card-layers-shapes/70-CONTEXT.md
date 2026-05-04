# Phase 70: Editor UI — Picker + DecorationCard + Layers Panel + Shapes Library - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss; phase has UI hint = yes; UI design grounded in research/FEATURES.md + research/STACK.md + locked CONTEXT.md decisions from Phase 67-69)

<domain>
## Phase Boundary

Users can create and edit decorations end-to-end. Lucide modal picker (virtualized 1,703-icon grid + ufuzzy search + WAI-ARIA keyboard nav) + 8-shape popover + DecorationCard right-rail Inspector (fill / stroke / size / position / shadow / opacity) + layers panel decoration chips (synthesizeRows from Phase 68) + R/C/L/I/S keyboard insert shortcuts. Picker keyboard scope does NOT bubble to editor (Cmd+G must NOT fire GROUP while picker open).

**Requirements (31):** DEPS-02..05, PICKER-01..08, SHAPES-01..09, KBD-10..12, CARD-01..05, PARITY-12, PARITY-18

**Out of scope this phase:** AI emit (Phase 71), rotation drag handle interaction (Phase 72), interactive rotation-aware AABB (Phase 72), CARD-06 numeric rotation input (Phase 72).

</domain>

<decisions>
## Implementation Decisions

### Picker UX (PICKER-01..08)
- **Mount surface:** Modal — mirror `publish-modal.tsx` pattern (NOT right-rail tab, NOT floating popover)
- **Lazy-loaded:** `next/dynamic` with `loading: () => null` — picker JS chunk loads only on first open (PICKER-08)
- **Virtualization:** `@tanstack/react-virtual@^3.13.24` — 4-col responsive grid, headless API, jsdom-testable (DEPS-02 + PICKER-02)
- **Fuzzy search:** `@leeoniya/ufuzzy@^1.0.19` — corpus = name + tags + categories from `lucide-static` metadata; 250ms debounce (DEPS-03 + PICKER-03)
- **Keyboard nav (PICKER-04):**
  - Arrow keys traverse grid (WAI-ARIA grid pattern; left/right/up/down)
  - Enter inserts at slide center; Esc closes
  - Tab cycles through search input → grid → close button
- **Click insert (PICKER-05):** dispatch `ADD_DECORATION` (Phase 68) → modal closes → new decoration auto-selected (`selection.replaceWith([newId])`)
- **Hover tooltip (PICKER-06):** native `title=` attribute — no custom tooltip component
- **Picker keyboard firewall (PICKER-07):** `isPickerOpenRef` (useRef NOT useState — refs-only contract from v2.11) wired as second short-circuit to all 33 tinykeys firewall sites from v2.11 SWEEP-1..4
  - When `isPickerOpenRef.current === true`: editor tinykeys handlers return early before any preventDefault/dispatch
  - Mirror v2.11 `isEditingTarget` firewall pattern

### Shapes library (SHAPES-01..09)
- **Shape picker (SHAPES-02):** Popover from canvas toolbar — 8-tile grid (mirror Canva); click inserts at slide center
- **8 primitives (SHAPES-01):**
  - rect (with cornerRadius 0–50px slider in DecorationCard — SHAPES-06)
  - circle, ellipse (CSS-styled `<div>` per Phase 69)
  - triangle, polygon (5/6/8-sided closed enum — SHAPES-07), star (5/6-pointed closed enum — SHAPES-07)
  - arrow, line (pre-baked SVG assets per Phase 69)
- **Stroke style (SHAPES-08):** solid / dashed / dotted closed enum — DecorationCard control
- **Aspect-ratio lock (SHAPES-09):** Shift+resize = lock aspect ratio for rect/circle/ellipse/star; toggle in DecorationCard — closes v2.10 ASPECT-01 deferred
- **scripts/build-shapes.ts (SHAPES-05):** full populate (Phase 69 shipped skeleton); reproducible build of the SVG corpus committed

### DecorationCard right-rail (CARD-01..05)
- **Mount (CARD-01):** `<DecorationCard>` mounted in TextEditorPanel composition when active selection is a decoration (mirror `ActiveTextBoxCard` shell from v2.8)
- **Fill color (CARD-02):** `react-colorful@^5.6.1` hex+alpha picker (DEPS-04); brand-kit + `derived_palette` quick swatches (reuse v2.9 palette extraction pattern)
- **Stroke (CARD-03):** color picker + width slider 1–8px + style enum (solid/dashed/dotted)
- **Size + position (CARD-04):** numeric W/H inputs in % of canvas + X/Y inputs (mirror v2.10 RnD wrapper pattern)
- **Effects (CARD-05):** drop shadow toggle (color/blur/offset; reuse v2.1 TextShadowEffect schema); opacity slider (0–100% UI; clamped to 0..1 for storage — Phase 67 WR-01)
- **CARD-06 (rotation numeric input):** OUT of this phase — Phase 72

### Keyboard shortcuts (KBD-10..12)
- **R / C / L direct-insert (KBD-10):** R=rect, C=circle, L=line — inserts at slide center (mirror Canva + Figma); inline `isEditingTarget` firewall (PITFALL-9.2)
- **I / S picker shortcuts (KBD-11):** I=icon picker, S=shape picker
- **Picker keyboard contract (KBD-12):** PICKER-04 contract (arrows traverse, Enter inserts, Esc closes — picker keyboard scope does NOT bubble to editor; PICKER-07 firewall)

### Layers panel chips (PARITY-18 = LP-NEW1..3)
- Phase 68 already wired `synthesizeRows` to walk decorations
- This phase: layers panel renders decoration chips visually (chip with icon glyph or shape silhouette label)
- Lock/hide/z-order toggle buttons wire to Phase 68 reducer actions (already shipped — UI just dispatches)
- LP-NEW1: solo decoration appears as chip
- LP-NEW2: decoration-in-group appears with shared groupId chip
- LP-NEW3: multi-decoration group renders consistent group chip

### Stack additions (DEPS-02..05)
- DEPS-02: `@tanstack/react-virtual@^3.13.24` (PICKER-02)
- DEPS-03: `@leeoniya/ufuzzy@^1.0.19` (PICKER-03)
- DEPS-04: `react-colorful@^5.6.1` (CARD-02)
- DEPS-05: CI bundle-size gate — editor route chunk ≤ v2.11 baseline + 200KB (mirror v2.6 triple-layer build-gate pattern)
  - Phase 67 DEPS-01 had -169 bytes baseline; this phase MUST NOT regress past +200KB
  - Document baseline + measurement methodology

### Chrome-leak gate (PARITY-12 = PCL11)
- All editor chrome (selection rings, marquee, smart guides, group-bbox, lock-icon, decoration-ring) gated `editable={true}` from v2.11
- This phase: extends gate to decoration-specific chrome (decoration selection ring, decoration drag handles)
- PCL11 grep gate: decoration render paths contain ZERO `*selection*` / `*marquee*` / `*guide*` / `*lock-icon*` / `*decoration-ring*` classNames in Satori path
- New test extends Plan 65-03 PCL gate suite

### Click-to-select wiring
- Phase 68 extended `Selection.replaceWith([id])` for decoration ids
- Phase 69 shipped pure rendering
- This phase: click handler on rendered decoration `<div>` (in editable={true} path only) dispatches `selection.replaceWith([d.id])`
- Mirrors v2.11 click-to-select pattern from Phase 60-05

### vitest.setup.ts mocks
- Phase 69-02 added IntersectionObserver + ResizeObserver mocks
- Verify present and sufficient for tanstack-virtual tests; extend if needed

### Claude's Discretion
- Picker modal vs Sheet vs Dialog component choice (likely shadcn/ui Dialog — already in tree)
- ShapePicker mount: toolbar popover vs canvas right-click vs always-visible toolbar button
- Color picker: react-colorful default vs custom-styled (recommend default with swatch-extension above; closer to Canva pattern)
- Stroke style icons (solid/dashed/dotted) — render via inline SVG vs character glyphs
- Layers panel chip glyph rendering: render miniature decoration via decoration-renderer.tsx (Phase 69 module) at 16×16px scale OR use a simpler label-based chip (Claude decides; recommend miniature for visual polish, label fallback if perf budget breached)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/editor/text-rail/ActiveTextBoxCard.tsx` — v2.8 right-rail Inspector pattern; mirror for DecorationCard
- `src/components/editor/publish-modal.tsx` — modal mount pattern (LucidePicker mirrors this)
- `src/components/editor/photo-treatment-controls.tsx` — v2.9 right-rail control card pattern
- `src/lib/editor/use-selection-model.ts` — extended in Phase 68 to handle decoration ids
- `src/lib/editor/editor-reducer.ts` — Phase 68 ADD/UPDATE/REMOVE_DECORATION + 10 extended cases
- `src/lib/editor/addressable-element-walkers.ts` (Phase 68) — synthesizeRows + getGroupMembers
- `src/components/editor/layers-panel/layers-panel.tsx` — Phase 68 walker migration; this phase adds visual chip rendering
- `src/lib/render/decoration-renderer.tsx` (Phase 69) — used to render miniature decoration in layers chip
- `src/lib/render/decorations/registry.ts` (Phase 69) — closed-enum 118-icon allowlist; picker enumerates this
- `src/components/editor/slide-editor.tsx` — tinykeys map (33 firewalls per v2.11 SWEEP); R/C/L/I/S bindings + isPickerOpenRef wired here
- `public/shapes/*.svg` (Phase 69) — 8 shape assets

### Established Patterns
- **Modal mount via shadcn/ui Dialog** — publish-modal.tsx pattern
- **Right-rail Inspector card** — ActiveTextBoxCard composition shell + EffectRow + Collapsible disclosure
- **react-colorful for color picking** — recommended; lightweight, hooks-only (DEPS-04)
- **Brand-kit + derived_palette quick swatches** — v2.9 pattern; consume from `slide.style_overrides.derived_palette`
- **isEditingTarget firewall** — PITFALL-9.2; arrow keys typed in input/textarea preserve native caret
- **isPickerOpenRef firewall** — NEW pattern for v2.12; mirror isEditingTarget but for modal-open state
- **Tinykeys map structure** — `$mod` for Cmd/Ctrl; chord support for Cmd+Alt+...
- **PCL grep gate** — Plan 65-03 + Phase 69-03 pattern; comment-stripping audit

### Integration Points
- `src/components/editor/decoration-picker/lucide-picker.tsx` (NEW)
- `src/components/editor/decoration-picker/shape-picker.tsx` (NEW)
- `src/components/editor/decoration-picker/index.ts` (NEW barrel)
- `src/components/editor/text-rail/decoration-card.tsx` (NEW)
- `src/components/editor/text-rail/text-editor-panel.tsx` (extend composition to include DecorationCard branch)
- `src/components/editor/slide-editor.tsx` (R/C/L/I/S bindings + isPickerOpenRef firewall on all 33 sites)
- `src/components/editor/layers-panel/layer-chip.tsx` (or equivalent) — extend chip rendering for decoration kind
- `src/components/slides/slide-preview.tsx` (click handlers on decoration <div> in editable path)
- `package.json` (DEPS-02..04 install)
- `vitest.setup.ts` (verify ResizeObserver mocks for tanstack-virtual)
- `scripts/build-shapes.ts` (full populate from Phase 69 skeleton)
- New test files for picker, card, layers chips, keyboard sweep, PCL11 extension

</code_context>

<specifics>
## Specific Ideas

- **Mirror v2.8 Phase 50** (Right-Rail Redesign) for DecorationCard composition shell pattern
- **Mirror v2.9 Phase 57** (photo-treatment-controls) for slot-in-right-rail pattern
- **Mirror v2.11 Phase 65** (Layers Panel) for chip rendering pattern
- **Mirror v2.6 build-gate** (DEPS-05 CI bundle-size triple-layer) — static import + vitest gate + npm run build
- **shadcn/ui Dialog** for LucidePicker modal mount; shadcn/ui Popover for ShapePicker
- **Closed-enum 118 icon allowlist** from Phase 69 registry — picker enumerates this; AI emit (Phase 71) consumes same source

</specifics>

<deferred>
## Deferred Ideas

- AI emit consumes Decoration schema (Gemini emit) — Phase 71
- Rotation drag handle interaction (BULK_ROTATE reducer + selection-bounds rotation-aware) — Phase 72
- CARD-06 numeric rotation input — Phase 72
- Custom SVG upload (premium) — v2.13+
- Icon favorites / recents / categories — v2.13+ (per Supabase per-user state)

</deferred>
