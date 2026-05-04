# Phase 69: Renderers + DecorationRenderer + First Parity Proof - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss; phase has UI hint = yes but is render-side technical, not user-facing UI design)

<domain>
## Phase Boundary

Shared `src/lib/render/decoration-renderer.tsx` is consumed by both Satori PNG path AND React preview. `resolveDecorationSvg()` with LRU cache substitutes `currentColor` → explicit hex from lucide-static SVG strings. CSS `box-shadow` (never SVG `<filter>`) for shadow effects. CSS `transform: rotate(deg)` for rotation. Hand-crafted seed decorations in test fixtures render byte-identical across renderers for all 10 representative Lucide icons + all 8 shapeKinds.

**Requirements (12):** RENDER-01, RENDER-02, RENDER-03, RENDER-04, RENDER-05, RENDER-06, RENDER-07, PARITY-06 (PTF13), PARITY-07 (PTF14), PARITY-11 (PTF18 non-uniform scale), PARITY-13 (PCL12 currentColor grep), PARITY-14 (PCL13 filter grep)

**Out of scope this phase:** Picker UI, DecorationCard, layers panel chip rendering (Phase 70); AI emit (Phase 71); rotation drag handle interaction (Phase 72 — but CSS rotate render path lands here); R/C/L keyboard shortcuts (Phase 70).

</domain>

<decisions>
## Implementation Decisions

### CRITICAL Phase Start: Verify Satori support (15-min Context7 lookup before any code)
- Run Context7 (or WebFetch) on `vercel/satori` for SUPPORTED CSS/SVG list (current Satori version in use)
- Verify: `<svg>`, `<polygon>`, `<path>`, `<line>`, `transform: rotate()`, `borderRadius`, `box-shadow`, `opacity`, inline `style="..."` substitution
- Document findings in plan summary; HIGH risk if these aren't actually supported
- If `transform: rotate()` or inline `<svg>` polygons aren't fully supported, fall back to pre-baked rasterized PNG variants for shapes (e.g. 0°/15°/30°/45°/60°/75°/90° pre-rendered) — but this is a fallback, NOT default. Default = CSS transform.

### Shared `decoration-renderer.tsx` module (RENDER-01)
- NEW file: `src/lib/render/decoration-renderer.tsx`
- Exports `renderDecoration(d: Decoration, ctx: RenderContext): React.ReactNode` — pure function consumed by BOTH renderers
- Single source of truth for TPLREND-05 byte-identity invariant
- Discriminates on `d.kind`: 'icon' → IconDecoration render path; 'shape' → ShapeDecoration render path
- Wraps each decoration in a `<div>` with: position (absolute), size, transform: `rotate(${rotation}deg)` if rotation, opacity, box-shadow if effects.shadow
- Both renderers (`render-slide-satori.tsx` line ~501, `slide-preview.tsx` lines ~1059 + ~2630) replace their `(slide.decorations ?? []).filter(d => d.hidden !== true).map(_d => null)` stub with `.map(d => renderDecoration(d, ctx))`

### Lucide SVG resolver registry (RENDER-02)
- NEW: `src/lib/render/decorations/registry.ts`
- Imports from `lucide-static` (NOT `lucide-react` — Satori-incompatible per vercel/satori#570)
- `resolveDecorationSvg(name: string, color: string, strokeWidth: number): string` — returns inline SVG string
- LRU cache (cap 500 entries) to avoid repeat lookups during multi-slide render
- Substitutes `currentColor` token in SVG strings with explicit hex (PCL12 invariant)
- Closed-enum allowlist of ~100 PascalCase icon names (subset of Lucide's 1,703) — used for AI emit allowlist (Phase 71) AND picker enumeration (Phase 70)
- Unknown name → returns null (caller renders fallback `?` glyph or skips)

### Shape rendering strategy (RENDER-01, RENDER-04)
- **Simple primitives** (rect/circle/ellipse): CSS-styled `<div>` with width/height/borderRadius/border + box-shadow + opacity. NO SVG file.
- **Complex shapes** (triangle/polygon/star/arrow/line): pre-baked SVG files in `public/shapes/*.svg`. Rendered via `<img src="/shapes/star-5.svg" />` wrapped in `<div>` for color/transform/effects (Satori-compatible per v2.9 overlay pattern).
- Pre-baked SVGs use `currentColor` → resolver substitutes explicit hex at render time.
- Asset build script `scripts/build-shapes.ts` generates the SVG corpus reproducibly (Phase 70 — but stub the directory + 1-2 reference assets in Phase 69).

### Shadow effects via CSS box-shadow (RENDER-05)
- Use CSS `box-shadow: ${offsetX}px ${offsetY}px ${blur}px ${color}` on the wrapping `<div>`
- NEVER SVG `<filter>` — vercel/satori#573 silently drops, burned in v2.9
- Reuse v2.1 `TextShadowEffect` schema shape (color/offset/blur/opacity)
- Verified by PCL13 grep gate: zero `filter:` / `backdrop-filter:` in `src/lib/render/decoration-renderer.tsx` or `decorations/`

### Opacity (RENDER-06)
- CSS `opacity: ${opacity}` on wrapping `<div>` — both renderers
- Decoration.opacity is 0..1 (CSS-native; CONFIRMED in Phase 67 fix WR-01) — NEVER divide by 100

### Rotation (RENDER-07)
- CSS `transform: rotate(${rotation}deg)` on wrapping `<div>`
- Verified Satori support at phase start (Context7 lookup); fallback to pre-baked rotated SVG variants if unsupported
- Rotation drag handle interaction NOT in this phase (Phase 72) — only the render path

### Layer 5.5 placement (RENDER-03)
- Already pinned in Phase 67 stubs at `render-slide-satori.tsx` line 501 + `slide-preview.tsx` lines 1059 + 2630
- This phase swaps the `_d => null` stub for `d => renderDecoration(d, ctx)`
- Layer ordering verified: photo (0) → tint (1) → bottom-card (2) → overlays (3) → hook (4) → body (4.5) → custom_images (5) → **decorations (5.5)** → watermark (6)

### Test fixtures + parity baseline (PARITY-06/07/11/13/14)
- 10 representative Lucide icons: Heart, Star, Check, Zap, ArrowRight, X, Plus, Crown, Sparkles, Circle (PTF13)
- 8 shapeKinds × {filled, outlined} = 16 shape variants (PTF14)
- Non-uniform scale fixture: 1.5×1.0 icon (PTF18 — PARITY-11)
- Each fixture rendered through BOTH renderers; assert byte-identical via fingerprint string equality (NOT just snapshot — equiv assertion)
- PCL12 grep: `currentColor` zero hits in `src/lib/render/` production code
- PCL13 grep: `filter:` / `backdrop-filter:` zero hits on decoration render path

### Click-to-select wiring (NOT this phase)
- Phase 68 already extended Selection model + `replaceWith` for decoration ids
- Click handlers on the rendered decoration `<div>` are wired in Phase 70 (editor UI phase) — this phase ships PURE rendering, no event handlers

### Claude's Discretion
- Exact LRU cache implementation (write tiny in-house cache vs pull `lru-cache` package — recommend in-house, ~30 LOC; we don't have lru-cache currently)
- Stub asset count for `public/shapes/` in Phase 69 (1 reference per shapeKind = 8 stubs OR commit-as-WIP with Phase 70 asset build script populating the rest — Claude decides)
- ResizeObserver/IntersectionObserver mocks already added in Phase 67 setup? — verify in vitest.setup.ts; if not, add now (small)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/render/resolve-overlay.ts` — TPLREND-05 shared resolver pattern (renderGrain / renderVignette / renderDecorativeOverlay) — mirror this for decoration-renderer.tsx
- `src/lib/render/render-slide-satori.tsx` line 501 — Phase 67 stub site
- `src/components/slides/slide-preview.tsx` lines 1059 + 2630 — Phase 67 stub sites (TWO: non-editable + editable paths)
- `public/overlays/` — v2.9 decorative SVG asset pattern (currentColor → CSS color cascade); mirror for `public/shapes/`
- `scripts/build-textures.ts` — v2.9 asset build pattern; mirror for `scripts/build-shapes.ts`
- `src/lib/types/decoration.ts` (Phase 67) — discriminated union types
- `src/lib/render/__tests__/parity.template-fingerprint.test.tsx` — PTF1..12 baseline; PTF13/14/18 land here
- `parity-fingerprint-fixtures.ts` — fixture pattern; append decoration-bearing slides

### Established Patterns
- **Both renderers consume same module** (TPLREND-05 invariant): mirror `resolve-overlay.ts` ↔ `decoration-renderer.tsx`
- **Pre-baked SVG with currentColor token + render-time hex substitution** (v2.9 overlay pattern)
- **CSS box-shadow not SVG filter** (vercel/satori#573 burned in v2.9)
- **Fingerprint string equality** (not just snapshot stability) for byte-identity verification (Plan 65-03 PTF12 + Phase 67 PTF16 pattern)
- **Closed-enum allowlist for AI** (will be reused by Phase 71 emit) — define here, consume there

### Integration Points
- `src/lib/render/decoration-renderer.tsx` (NEW)
- `src/lib/render/decorations/registry.ts` (NEW)
- `src/lib/render/render-slide-satori.tsx` line 501 (swap stub)
- `src/components/slides/slide-preview.tsx` lines 1059 + 2630 (swap stubs — TWO sites)
- `public/shapes/*.svg` (NEW directory; 1-2 reference assets per shapeKind)
- `scripts/build-shapes.ts` (NEW; Phase 70 will fully populate)
- `src/lib/render/__tests__/parity.template-fingerprint.test.tsx` (extend with PTF13/14/18 — OR new file `parity.template-fingerprint-decorations.test.tsx`)
- `vitest.setup.ts` (verify ResizeObserver mocks — Phase 70 picker needs them but harmless to add early)

</code_context>

<specifics>
## Specific Ideas

- **Mirror `resolve-overlay.ts` ↔ `decoration-renderer.tsx`** structurally — same shape, same export pattern, same callsite signatures
- **Mirror v2.9 overlay-asset pattern** for shape SVG assets — `currentColor` token + CSS color cascade + `<img>` wrapper + render-time hex
- **Lucide-static is the renderer's truth source** (NOT lucide-react which is Satori-incompatible per #570)
- **PTF13/14/18 fingerprint suite is the merge gate** — must be GREEN before Phase 70 starts (research SUMMARY.md non-negotiable)
- **PCL12/13 grep gates land in this phase** — they enforce TPLREND-05 invariants going forward
- **Closed-enum icon allowlist defined here, consumed by Phase 71 AI emit + Phase 70 picker** — single source of truth

</specifics>

<deferred>
## Deferred Ideas

- Picker modal UI (Lucide grid, virtualized, fuzzy search) — Phase 70
- DecorationCard right-rail (color picker, stroke slider, etc.) — Phase 70
- Layers panel decoration chips visual rendering — Phase 70
- Click-to-select handler wiring on decoration `<div>` — Phase 70
- R/C/L direct-insert keyboard shortcuts — Phase 70
- Build script `scripts/build-shapes.ts` full corpus generation — Phase 70 (stub now, populate later)
- Gemini emit consumes registry allowlist — Phase 71
- Rotation drag handle interaction — Phase 72 (CSS rotate render path lands here)

</deferred>
