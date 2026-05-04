# Research Summary — v2.12 Shapes & Icons (Decoration Primitives)

**Project:** ViralSlideMaker — TikTok/Instagram carousel image creator
**Domain:** Decoration primitives (Lucide icon picker + Canva-style shapes) added to a Satori-rendered hybrid editor
**Researched:** 2026-05-03
**Confidence:** HIGH

---

## Executive Summary

v2.12 adds a fourth addressable element kind — `decorations[]` — to the slide schema established in v2.11. The architecture is strictly additive: a discriminated union (`kind: 'icon' | 'shape'`) bolts onto `Slide` alongside `text_boxes[]`, `custom_images[]`, and `watermark`. Every v2.11 multi-element editor surface (multi-select, marquee, group, alignment, lock/hide, z-order, layers panel, keyboard nudge, alt-drag duplicate) gains a fourth routing branch via pattern replication, not redesign. The schema is greenfield with no legacy migration burden — unlike v2.8's dual-write ordeal, decorations have no predecessor field to mirror. This is a major scope win.

The single highest-risk element is the Satori SVG rendering contract. Lucide-react React components dropped directly into the Satori render path will silently produce blank output (vercel/satori#570, confirmed). The canonical solution — a shared `resolveDecorationSvg()` module that converts lucide names to inline SVG strings at render time and is consumed by BOTH renderers — is the non-negotiable foundation. Shapes follow the same proven two-path split used for v2.9 overlays: CSS-styled `<div>` for rect/circle/ellipse (Satori supports these CSS properties) and pre-baked SVG assets in `public/shapes/` for triangle/polygon/star/arrow/line (exact mirror of `public/overlays/`). TPLREND-05 byte-identity must hold across all 11 legacy templates; pinning parity fingerprints before any UI work is the discipline that keeps this honest.

The feature set is deliberately constrained. Beautiful.ai/Gamma research confirms that 0–2 decorations per slide, AI-selected from a curated token-color vocabulary, is the effective pattern for quality output. Vector path editing, boolean ops, gradient fills, and draw-on-canvas are all hard NO for v2.12 — they belong to a vector editor, not a carousel creator. The 5-phase build order (schema → reducer → renderers → UI → AI/audit) is driven by strict dependency, not preference.

---

## Key Findings

### Recommended Stack

Three net-new npm dependencies, one upgrade, zero tooling additions. Bundle delta is under 15KB gzipped on the editor route. `lucide-react` is already installed at `0.577.0`; upgrading to `^1.14.0` produces a NEGATIVE bundle delta (UMD dropped, 32.3% smaller) with zero breaking imports verified by grep.

**Core technologies — new for v2.12:**

| Package | Version | Purpose | Why this |
|---------|---------|---------|----------|
| `lucide-react` | `^1.14.0` (upgrade) | Icon library, 1,703 icons | Already in tree; v1 = React 19 peerDep declared; 32.3% smaller; brand-icon removal is only breaking change, none used in codebase |
| `@tanstack/react-virtual` | `^3.13.24` | Virtualized picker grid | Headless = jsdom-testable; first-class grid; same authorship as `@tanstack/react-table`; ~9KB gzipped |
| `@leeoniya/ufuzzy` | `^1.0.19` | Fuzzy search over icon corpus | 7.6KB minified; 78x faster than Fuse.js on benchmarks; zero index-build overhead |
| `react-colorful` | `^5.6.1` | Hex + alpha color picker | 2.8KB gzipped (13x lighter than react-color); tree-shakeable; hooks-only |

**What NOT to use (decided):**
- No `lucide-react/dynamic` `<DynamicIcon>` — maintainer-documented anti-pattern for non-CMS apps
- No inline `<svg><circle/>` JSX in Satori — `presets.ts` does not list SVG shape elements; pre-baked assets are the only parity-safe path
- No `react-xarrows` (unmaintained), no `konva`/`fabric.js` (wrong substrate, destroys TPLREND-05)
- No CSS `filter`/`backdrop-filter` on shapes (vercel/satori#573, silently drops — already burned in v2.9)

### Expected Features

**Must have (table stakes):**
- Search-first icon picker — all leading tools default to search, not category browse
- Virtualized infinite-scroll grid — 1,703 icons cannot all mount at once
- Debounced search at 250ms — industry consensus band 250–300ms
- Click icon → insert at slide center (Canva model)
- Keyboard nav: arrow keys = grid traversal, Enter = insert, Esc = close (WAI-ARIA grid pattern)
- 7 shape primitives: rect, circle/ellipse, triangle, polygon, star, arrow, line
- Fill color, stroke (color + width + solid/dashed/dotted), opacity 0–100%, corner radius (rect), drop shadow (reuse v2.1 TextShadowEffect verbatim)
- Decorations as first-class peers of text_boxes/custom_images/watermark in every v2.11 surface (D1–D22)
- Right-rail decoration card with full C1–C12 controls
- Gemini AI emit for `decorations[]` with maxItems=2 cap, closed-enum validation, named color token resolution

**Should have (competitive differentiators — ship in v2.12):**
- Keyboard shortcuts R/C/L for rect/circle/line insert (10-line tinykeys addition, massive power-user win)
- Shift+resize = constrain to square/circle (extends existing v2.10 react-rnd handler)
- Lazy-import lucide-react (per-icon path imports — prevents 7MB bundle bomb)
- Advisory monoculture gate for AI emit (mirrors v2.9 `hookOpeningTrigram` pattern)
- Hover tooltip on picker grid (icon disambiguation — pure CSS)
- Template-palette quick swatches in color picker (reuses existing `derived_palette[]`)

**Defer to v2.13+:**
- Icon favorites, recents, categories (pre-PMF; requires per-user Supabase state)
- Draw-on-canvas (conflicts with marquee pointer state machine)
- Rotation handles (deferred from v2.10 ROTATE-01; store `rotation` field in schema, numeric right-rail input only, drag to v3+)
- Line smart connectors with auto-routing (off-pattern for carousels)

**Hard NO (skip indefinitely):**
- Vector path editing, boolean ops (wrong product domain)
- Gradient fills (Satori gradient bugs unresolved)
- Image fill / mask (different feature category)
- Second icon library beyond Lucide
- Cross-slide decoration paste (TPLREND-05 invariant; same hard-NO as v2.11 J57)
- Nested groups (v2.11 hard-NO; decorations in flat groups only)

### Architecture Approach

`decorations[]` is a fourth scope on `Slide`, structurally symmetric to the existing three. `DecorationBase` carries the v2.11 meta-fields (`groupId?`, `locked?`, `hidden?`, `name?`) and position as a 4-tuple % mirroring `CustomImage`. The schema field is optional — `(slide.decorations ?? []).filter(...)` at every render site guarantees byte-identity on all 11 legacy templates. No dual-write adapter needed (no legacy field — greenfield).

**Major components:**

1. `src/lib/render/decoration-renderer.tsx` (NEW) — pure JSX emitter for one Decoration, consumed by BOTH renderers. Single source of truth for TPLREND-05.
2. `src/lib/render/decorations/registry.ts` (NEW) — closed-enum Lucide name registry with SVG path resolver; validates AI-emitted names at ingest; powers picker enumeration.
3. `src/components/editor/decoration-picker/` (NEW directory) — two-tab modal: Icons (tanstack-virtual + ufuzzy + lucide grid) + Shapes (8-primitive tile grid).
4. `src/components/editor/decoration-card.tsx` (NEW) — right-rail Inspector; mirrors `ActiveTextBoxCard` shell from v2.8.
5. `src/lib/editor/editor-reducer.ts` (MODIFIED) — 3 new actions + 13 cases extended with a fourth `decorations` branch; `AddressableScope` exhaustive type gates compile-time symmetry.

**Layer insertion point:** decorations render at layer 5.5 — between `custom_images` (5.0) and `watermark` (6.0). Z-ordering is internal to the `decorations` array via `Z_ORDER` reducer (array splice, never CSS z-index).

### Critical Pitfalls

**Top 8 ship-critical pitfalls with verified GitHub issues:**

1. **`lucide-react` React components → Satori = silent blank output** (vercel/satori#570, #281). Use `lucide-static` SVG strings via `resolveDecorationSvg()` shared resolver. Pin PTF13 parity test before any UI. Undetected discovery delay: 3–6 months.

2. **Naive barrel `import * as LucideIcons` → 7MB bundle bomb** (lucide-icons/lucide#1733, #1559). Per-icon static imports for template fixtures; `lucide`'s `dynamicIconImports` for picker UI; `lucide-static` strings for renderer path. CI bundle-size gate: editor chunk ≤ v2.11 baseline + 200KB.

3. **`currentColor` in SVG strings → Satori divergence** (vercel/satori#41). Store explicit hex for every color field. Grep gate: `rg "currentColor" src/lib/render/` returns zero hits in production code.

4. **SVG `<filter>` for shape shadow → Satori silent drop** (vercel/satori#573, #393 — burned in v2.9). Use CSS `box-shadow` on wrapping `<div>` — same as v2.1 text-shadow. Never SVG `<filter>`.

5. **TanStack Virtual renders 0 items in jsdom** (TanStack/virtual#419, jsdom/jsdom#3368). Add `ResizeObserver` + `IntersectionObserver` mocks in `vitest.setup.ts`; use `VirtuosoMockContext` or explicit `count`-prop mocking.

6. **Picker open + Cmd+G fires editor GROUP action** (keyboard firewall gap). Add `isPickerOpenRef` (`useRef`, not `useState`) and second short-circuit to all 33 tinykeys firewalls from v2.11 SWEEP-1..4.

7. **Reducer scope asymmetry — add decorations to BULK_TRANSLATE but forget Z_ORDER** (internal, extrapolated from v2.11 audit). `AddressableScope` exhaustive type-switch + PRA1..PRA12 source-grep audit gate asserting every multi-select action body mentions all four scopes.

8. **`getGroupMembers` / `synthesizeRows` / `computeAllLocked` skip `decorations[]` → ungroup leaves orphans** (internal). Canonical walker module for layers-panel helpers (`addressable-element-walkers.ts`); LP-NEW1..LP-NEW6 test gate.

---

## Resolved Cross-Document Tensions

### Phase count: 5 phases (Phases 67–71)

STACK suggests 6, FEATURES suggests 7 (A–G), ARCHITECTURE suggests 5, PITFALLS suggests 6 (A–F). **Canonical: 5 phases.** FEATURES A–G is a task checklist within those 5 phases; PITFALLS A–F are risk domains. 5 phases is right because each phase has a single clean output: schema baseline, reducer correctness, renderer parity, editor usability, AI integration.

### Lucide picker mount surface: Modal

ARCHITECTURE recommends modal matching `publish-modal.tsx` precedent. NOT right-rail tab (steals Inspector real estate), NOT floating popover (picker contains virtualized grid needing stable layout). Modal is the only existing full-UI overlay in the product and the correct pattern.

### Satori SVG strategy: Compatible — two paths for two decoration kinds

STACK ("pre-baked SVG assets in `public/shapes/`") and PITFALLS ("`lucide-static` SVG strings via shared resolver") are not in conflict:
- **Icons** (`kind: 'icon'`): `lucide-static` SVG strings via `resolveDecorationSvg()` at render time. Color substitution replaces any `currentColor` with explicit hex.
- **Complex shapes** (triangle/polygon/star/arrow/line): pre-baked `public/shapes/*.svg` assets with `currentColor` tokens; renderer sets CSS `color` on the `<img>` wrapper (proven pattern from `resolve-overlay.ts:455-458`).
- **Simple shapes** (rect/circle/ellipse): CSS-styled `<div>` — no SVG file needed.

All three paths route through the single `decoration-renderer.tsx` module.

### AI emit contract (synthesized)

| Constraint | Value |
|-----------|-------|
| `maxItems` per slide | 2 (enforced in Gemini schema AND server-side clamp) |
| AI icon names | ~100-icon PascalCase allowlist (not full 1,703); unknowns silently dropped |
| Color emit | Named tokens (`'accent'`, `'palette-vibrant'`) resolved server-side — never raw hex from AI |
| Position emit | Semantic anchors (`'top-right'`, etc.) resolved to safe-zone % coords (DIFF; strongly recommended) |
| Monoculture gate | Advisory: ≥60% of slides with same `lucideName` or `shapeKind` → log warning. Does NOT fail CI in v2.12. Wire to retry-once in v3.0+ if observed in production. Mirrors v2.9 `hookOpeningTrigram` pattern exactly. |
| Per-template guidance | Extend existing `aiVoiceNote` field for decoration tone |
| Per-template allowlist | Optional `SlideTemplate.decorationWhitelist?: string[]` |

### Reducer routing pattern: Verbose cases + AddressableScope exhaustive type

ARCHITECTURE says stay verbose (correct). PITFALLS says canonical walker module + exhaustive type (also correct, for different surfaces). Reconciliation:
- **Reducer cases**: verbose (13 cases written out). Per-case divergence (dual-write for text_boxes, anchor-skip for custom_images, single-slot for watermark) makes a case-compressor more confusing than the repetition.
- **`AddressableScope` type**: add as compile-time check only — one `type AddressableScope = 'text_boxes' | 'custom_images' | 'watermark' | 'decorations'` with exhaustive switch.
- **Layers-panel helpers**: canonical `addressable-element-walkers.ts` module for `synthesizeRows`, `computeAllLocked`, `computeAllHidden`, `getGroupMembers` — these are the right place for DRY-ness, not the reducer.

### TPLREND-05 parity test surfaces (PCL/PTF/PRS audit suite extension)

| New test ID | What it tests | Type |
|------------|---------------|------|
| PTF13 | ~10 Lucide icons (Heart, Star, Check, Zap, Arrow, X, Plus, Crown, Sparkles, Circle) — byte-identical React preview vs Satori PNG | Dual-renderer fingerprint |
| PTF14 | 8 shape kinds × filled + outlined = 16 shape fingerprints | Dual-renderer fingerprint |
| PTF15 | 45°-rotated arrow shape — byte-identical across renderers | Rotation edge case |
| PTF16 | Legacy template with `decorations === undefined` — PNG byte-identical to pre-v2.12 baseline | Idempotent-absence gate |
| PTF17 | AI-emitted decoration on decoration-bearing slide — dual-renderer byte-identical | AI-path parity |
| PTF18 | Non-uniform scale (1.5×1.0 icon) — byte-identical | Scale edge case |
| PCL11 | grep: decoration render paths contain no `*selection*`/`*marquee*`/`*guide*`/`*lock-icon*`/`*decoration-ring*` classNames | Chrome-leak gate |
| PCL12 | grep: no `currentColor` in `src/lib/render/` production code | Color-cascade gate |
| PCL13 | grep: no `filter:`/`backdrop-filter:` on any decoration render path | CSS-filter gate |
| PRS7 | Z_ORDER on a decoration id — `custom_images[]` array ref-equal before/after | Cross-scope isolation |
| PRS8 | BULK_TRANSLATE with locked decoration — locked decoration does NOT move | Lock-honor regression |
| LP-NEW1 | Decoration alone — appears in layers panel | Layers walk |
| LP-NEW2 | Decoration in group with text — both appear, same groupId | Layers walk |
| LP-NEW3 | Multi-decoration group — all appear with consistent group chip | Layers walk |

---

## Implications for Roadmap

Suggested phase structure: **5 phases (Phases 67–71)**

### Phase 67 — Schema + Null-Decoration TPLREND-05 Baseline

**Rationale:** All downstream work depends on stable types. Locking parity tests before any rendering or UI work means no later phase can silently break legacy template output.
**Delivers:** `decorations?: Decoration[]` on `Slide`. Both renderers gain null-safe `(slide.decorations ?? []).map(...)` iteration sites at layer 5.5. Lucide registry stub. PTF16 + PCL11-13 pinning byte-identity on all 11 legacy templates.
**Addresses:** FEATURES S10 schema design; ARCHITECTURE Phase 67 decomposition
**Avoids:** F.1 (schema drift), A.1 (parity untested until too late), R1/R2 (empty-Fragment regression on legacy renders)
**Research flag:** None — pure type-plumbing + idempotent null branches. Exact mirror of v2.11 Phase 60 watermark schema lift + Phase 65 parity baseline. Skip `/gsd-research-phase`.

### Phase 68 — Reducer Extensions + Selection Model

**Rationale:** All 13 reducer cases must know about decorations before any UI can dispatch correctly. Testing at the reducer layer — no UI dependency — keeps surface area small.
**Delivers:** ADD/UPDATE/REMOVE_DECORATION actions + 13 cases extended. `align.ts`, `selection-bounds.ts`, `element-rect-intersect.ts`, `group-membership.ts` extended. `AddressableScope` exhaustive type. Canonical `addressable-element-walkers.ts` module. `useSelectionModel.selectAll` + stale-id prune + `enterGroup` walk extended.
**Addresses:** ARCHITECTURE Phase 68, FEATURES D1–D22 multi-element parity
**Avoids:** Reducer scope asymmetry (G.1 — PRA1..PRA12 grep gate locked here); layers-panel orphan bug (G.2/G.3 — canonical walker)
**Research flag:** None — straightforward pattern replication of v2.11 Phase 64 (33 tests, 13 cases). Skip `/gsd-research-phase`.

### Phase 69 — Renderers + DecorationRenderer + First Parity Proof

**Rationale:** Before any editor UI, prove both renderers emit byte-identical output. A hand-crafted seed decoration in a test fixture drives this proof without requiring picker or card UI. Highest-risk phase for TPLREND-05.
**Delivers:** `decoration-renderer.tsx` shared primitive. `resolveDecorationSvg()` with LRU cache. Shape SVG emitters for all 8 shapeKinds. Editable Rnd wrapper. Selection click wiring. PTF13–PTF18 fingerprint suite passing.
**Uses:** `lucide-static` SVG strings, `public/shapes/*.svg` pre-baked assets, CSS `box-shadow` for shadow effects
**Avoids:** A.1 (lucide in Satori), A.2 (currentColor), A.3 (SVG filter), A.4 (viewBox/scale), J.2 (SVG parse cache)
**Research flag:** VERIFY AT PHASE START — confirm Satori support for `<svg>`, `<polygon>`, `transform: rotate`, `borderRadius` via Context7 lookup against `vercel/satori`. 15-minute check. Risk: HIGH if skipped.

### Phase 70 — Editor UI: Picker + DecorationCard + Layers Panel

**Rationale:** All prior phases have proven correctness without UI. Phase 70 is "make it usable." Heavy in component surface area; low in novel risk.
**Delivers:** `editor-toolbar.tsx` insert buttons. `<LucidePicker>` modal (tanstack-virtual + ufuzzy + keyboard nav + `isPickerOpenRef` firewall). `<ShapePicker>` popover. `<DecorationCard>` right-rail. Layers panel `synthesizeRows` decoration walk active. R/C/L shortcuts. Shift+resize constraint. Template-palette quick swatches.
**Uses:** `@tanstack/react-virtual`, `@leeoniya/ufuzzy`, `react-colorful`
**Avoids:** B.1 (7MB bundle — lazy imports locked here), B.2 (lucide vitest — `server.deps.inline`), C.1 (jsdom virtualization — ResizeObserver mocks), H.1/H.2 (picker keyboard scope conflict)
**Research flag:** None — conventional component composition. All primitives have official docs. Skip `/gsd-research-phase`.

### Phase 71 — AI Emit + Fork RPC + Comprehensive Parity Audit

**Rationale:** AI emit depends on stable schema + renderer. Terminal integration phase. Gemini schema lift mirrors v2.9 Phase 58. Fork RPC SQL mirrors v2.11 `20260502_fork_strip_locked.sql`.
**Delivers:** Gemini `decorations[]` schema lift. `validateDecorations()` with silent-drop fallback. Advisory monoculture gate. `20260YYY_fork_strip_decoration_locked.sql` migration. Final R1–R10 audit (PTF13–PTF18 + PCL11–13 + PRS7/8 + LP-NEW1–3). Bundle-size gate verification. Manual ship-gate: 5 legacy projects render byte-identical PNG pre/post v2.12.
**Avoids:** E.1 (monoculture), E.2 (hallucinated icon names), F.2 (fork RPC direction), D.1 (white-on-white — contrast advisory in right-rail)
**Research flag:** None — most formulaic phase. Skip `/gsd-research-phase`.

### Phase Ordering Rationale

- Schema must precede reducer (reducer cases reference decoration types)
- Reducer must precede renderers (renderer tests dispatch ADD_DECORATION to produce test state)
- Renderers must precede editor UI (picker dispatches ADD_DECORATION; card reads from render path)
- Editor UI must precede AI emit (AI integration tests require working editor round-trip)
- Dependency chain is strict — no phase can be parallelized except optional parallel work (Lucide registry research, picker UX wireframes) during Phase 67

### Research Flags

Needs `/gsd-research-phase`:
- **Phase 69 (Renderers):** Context7 lookup on `vercel/satori` for `<svg>`/`<polygon>`, `transform: rotate()`, `borderRadius`, `box-shadow` support matrix on the current Satori version in `next/og`. 15-minute check; HIGH risk if skipped.

Standard patterns (skip `/gsd-research-phase`):
- **Phase 67:** Mirror of v2.11 Phase 60 + 65 — no novel research needed
- **Phase 68:** Mirror of v2.11 Phase 64 — exact same reducer extension pattern
- **Phase 70:** `@tanstack/react-virtual`, `@leeoniya/ufuzzy`, `react-colorful` all have official docs; component composition is conventional
- **Phase 71:** Mirror of v2.9 Phase 58 (Gemini schema lift) + v2.11 Phase 65 (audit suite extension)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All 4 dep versions verified via `npm view`. Satori limitations verified against actual GitHub issues and `presets.ts` source. Codebase integration points enumerated by direct file inspection. |
| Features | HIGH | Canva/Figma/Beautiful.ai/Gamma feature claims cited per row with source URLs. AI-emit internals of Beautiful.ai/Gamma are MEDIUM (private systems; patterns inferred from observed behavior). |
| Architecture | HIGH | All integration points enumerated by reading actual codebase files: `editor-reducer.ts` (22 cases counted), `render-slide-satori.tsx` (layer order pinned), `slide-preview.tsx` (hidden-filter sites grepped), `layers-panel.tsx` (synthesizeRows walk inspected), fork RPC SQL migration inspected. |
| Pitfalls | MEDIUM-HIGH | GitHub issues verified for A.1/A.2/A.3/A.4/B.1/B.2/C.1. Reducer symmetry and layers-panel walker pitfalls (G.1/G.2/G.3) extrapolated from v2.11 audit experience — HIGH confidence on the failure modes, no external citation needed. |

**Overall confidence: HIGH**

### Gaps to Address

- **`lucide-static` vs `lucide` `dynamicIconImports` API surface:** Both are known-good for their respective use cases. Confirm exact function signatures at Phase 69 start via Context7. Not blocking — both approaches are resolved architecturally; this is just an API lookup.

- **Satori CSS property support matrix:** `borderRadius`, `box-shadow`, `transform: rotate()`, and inline `<svg>` elements all have documented support but behavior can vary across Satori patch versions. Verify at Phase 69 start. The correct answer is a 15-minute Context7 lookup, not pre-research.

- **TanStack Virtual vs react-virtuoso for picker jsdom tests:** STACK recommends tanstack-virtual; PITFALLS recommends react-virtuoso (for `VirtuosoMockContext`). Both work. Decide at Phase 70 start: if `ResizeObserver` mocking in `vitest.setup.ts` works cleanly with tanstack-virtual, use it. If not, swap to react-virtuoso. Not a Phase 67–69 concern.

- **`lucide-react` ESM transform in vitest:** Add `lucide-react` to `vitest.config.ts` `server.deps.inline` as Phase 70's first step; confirm smoke test passes before writing picker tests.

---

## Watch Out For (ship-critical checklist)

Eight items with the highest probability of silently breaking TPLREND-05 or causing production regressions:

1. `resolveDecorationSvg()` shared module consumed by BOTH renderers before ANY UI work (A.1 / TPLREND-05)
2. Explicit hex in every schema color field — no `currentColor`, no `inherit`, no CSS vars (A.2 + PCL12 grep gate)
3. CSS `box-shadow` on wrapping div for shadow effects — never SVG `<filter>` (A.3 + PCL13 grep gate)
4. Per-icon static imports OR `dynamicIconImports` for picker — never barrel `import * as LucideIcons` (B.1 + CI bundle gate)
5. `isPickerOpenRef` second short-circuit wired to all 33 tinykeys firewalls before picker ships (H.1)
6. `AddressableScope` exhaustive type + PRA1..PRA12 grep audit gate locked before reducer cases merge (G.1)
7. `(slide.decorations ?? []).map(...)` — never `slide.decorations.map(...)` — at EVERY render and transform site (F.1 idempotent-absence / TPLREND-05)
8. PTF16 (legacy templates byte-identical with `decorations === undefined`) must be GREEN before Phase 68 starts (R1/R2)

---

## Sources

### Primary (HIGH confidence)
- `npm view lucide-react@1.14.0` — version + peerDeps confirmed
- `npm view @tanstack/react-virtual`, `@leeoniya/ufuzzy`, `react-colorful` — versions confirmed
- vercel/satori#570 — lucide-react silent render failure
- vercel/satori#281 — React SVG component silent failure class
- vercel/satori#573 — CSS filter silently dropped
- vercel/satori#41 — CSS property support limitations
- vercel/satori#86 / PR #98 — `<svg>` element support mechanism
- lucide-icons/lucide#1733 — 7MB barrel import confirmed by maintainer
- lucide-icons/lucide#1559 — per-icon import path pattern
- lucide-icons/lucide#2366 — vitest ESM error
- TanStack/virtual#419 — ResizeObserver not defined in SSR/jsdom
- jsdom/jsdom#3368 — ResizeObserver not implemented
- bokuweb/react-rnd README — `lockAspectRatio` prop API
- Codebase: `editor-reducer.ts` (22 cases), `render-slide-satori.tsx` (layer order), `resolve-overlay.ts` (TPLREND-05 pattern), `layers-panel.tsx` (synthesizeRows), `20260502_fork_strip_locked.sql` (fork strip pattern)

### Secondary (MEDIUM confidence)
- Canva shape tools docs (fill/stroke/opacity/corner-radius, R/C/L shortcuts)
- Figma shape tools help (Polygon/Star/Arrow, boolean ops)
- Beautiful.ai Smart Slides + Icon Slide template docs
- Gamma AI deck generator product page
- shadcn-iconpicker (Next.js + Lucide + TanStack Virtual) — picker pattern reference
- Sanity Lucide Icon Picker plugin — virtualization + lazy-load pattern
- React Virtuoso mocking-in-tests docs — `VirtuosoMockContext`
- W3C WAI G207, WAI 1.4.11 — decorative icon a11y exemption
- uFuzzy npm package + benchmark — 7.6KB / 78x faster than Fuse

### Tertiary (LOW confidence)
- AI monoculture failure mode ("every slide gets a sparkle") — widely observed in AI presentation output; formally documented only via industry blog posts; mitigation mirrors v2.9 hookOpeningTrigram (HIGH confidence on the pattern)
- react-xarrows maintenance status — single source
- react-window v2 status — maintainer attentional shift, CHANGELOG accessible but not tightly verified

---

*Research completed: 2026-05-03*
*Ready for roadmap: yes*
*Phase count: 5 (Phases 67–71)*
*Net new deps: `@tanstack/react-virtual@^3.13.24`, `@leeoniya/ufuzzy@^1.0.19`, `react-colorful@^5.6.1`. Upgrade: `lucide-react` 0.577 → 1.14.*
