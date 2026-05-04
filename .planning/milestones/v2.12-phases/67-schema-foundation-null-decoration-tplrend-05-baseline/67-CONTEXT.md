# Phase 67: Schema Foundation + Null-Decoration TPLREND-05 Baseline - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss infrastructure detection — pure schema/types/parity-baseline phase, no user-facing behavior)

<domain>
## Phase Boundary

`decorations?: Decoration[]` lands on `Slide` as an optional discriminated-union array; both renderers gain null-safe iteration sites at layer 5.5 (between custom_images and watermark); legacy 11 templates render byte-identical PNG to pre-v2.12 baseline; lucide-react upgraded to v1 with zero breaking imports.

**Requirements (8):** DECOR-01..05 (schema), DEPS-01 (lucide-react upgrade), PARITY-09 (PTF16 idempotent-absence gate), MIGR-02 (eager-on-load schema migration).

**Out of scope this phase:** Reducer extensions, picker UI, AI emit, rotation handles, render of any non-undefined decorations[]. ALL of these belong to subsequent phases.

</domain>

<decisions>
## Implementation Decisions

### Schema Shape (locked from REQUIREMENTS.md + research/SUMMARY.md)
- `Slide.decorations?: Decoration[]` — optional field; absent = legacy templates render byte-identical
- `Decoration` is a discriminated union over `kind: 'icon' | 'shape'`
- `DecorationBase` carries shared meta-fields: `id`, `position` (x/y/width/height as % of canvas, 4-tuple), `size` (independent W/H or unified), `locked?`, `hidden?`, `groupId?`, `name?`, `rotation?` (default 0), `opacity?` (default 1), `effects?` (mirror v2.1 TextShadowEffect)
- `IconDecoration`: `lucideName: string` + `color: string` (explicit hex, NEVER `currentColor`) + `strokeWidth: number`
- `ShapeDecoration`: `shapeKind: 'rect' | 'circle' | 'ellipse' | 'triangle' | 'polygon' | 'star' | 'arrow' | 'line'` + `fill: string` + `stroke?: { color, width, style }` + per-kind params (`cornerRadius?` for rect, `points?` for polygon/star)

### Renderer Integration (idempotent absence)
- Both renderers wrap `(slide.decorations ?? []).map(...)` at layer 5.5 (between custom_images at 5.0 and watermark at 6.0)
- When `decorations === undefined` (all 53+ existing projects) → ZERO DOM nodes emitted → byte-identical PNG to pre-v2.12 baseline
- No actual decoration rendering this phase; just the iteration site + null-safe map

### lucide-react Upgrade (DEPS-01)
- Bump `0.577.0 → ^1.14.0` in package.json
- Grep gate: zero brand-icon imports (Github / Slack / Figma / Twitter / Facebook / etc.) in production code — those were removed in v1
- Verify NEGATIVE bundle delta on editor route via `next build` chunk-size diff

### Zod Validation (DECOR-05)
- `Decoration` discriminated union has Zod schema at AI-ingest boundary in `src/lib/ai/generate-slides.ts`
- Unknown lucideName → silent drop at validator (mirror v2.9 `template_id_override` defaulting pattern; never throws)
- Schema is registered but NOT yet consumed by Gemini emit (that lands in Phase 71)

### Parity Baseline (PTF16, PARITY-09)
- New test `parity.template-fingerprint-decorations-undefined.test.tsx` extends Plan 65-03 PTF12 fixture suite
- Iterates all 11 templates × `decorations === undefined` → assert byte-identical fingerprint to pre-v2.12 baseline (committed `__snapshots__/`)
- Snapshot files committed under `__snapshots__/parity.template-fingerprint-decorations-undefined.test.tsx.snap`
- Both renderers (Satori + React preview) covered

### Eager-on-Load Migration (MIGR-02)
- No backfill SQL needed — `decorations === undefined` is the natural baseline for all existing rows
- Schema is purely additive; v2.8 BL-01 dual-write trap deliberately avoided (no legacy field to mirror)
- New projects can land with `decorations: []` or omit the field entirely; both render identically

### Claude's Discretion
All implementation details below the schema shape are at Claude's discretion. Specifically:
- Exact file path for `Decoration` types (likely `src/lib/types/slide.ts` extension; possibly new `src/lib/types/decoration.ts` if size warrants split — Claude decides)
- Exact name of the parity-baseline test file (suggestion above; Claude may rename)
- Whether to include `effects?: { shadow?, ... }` on Decoration in this phase or defer to Phase 70 (recommendation: include in schema, leave unimplemented in renderers — Phase 69 will wire it)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/types/slide.ts`** — current Slide schema with text_boxes/custom_images/custom_texts/watermark; extend here
- **`src/lib/types/text-box.ts`** equivalent — TextBox interface (v2.8 reference) for shared-fields pattern
- **`src/lib/render/render-slide.ts`** — React preview renderer; layer order documented at lines 100-200 (last inspection)
- **`src/lib/render/render-slide-satori.tsx`** — Satori PNG renderer; layer order pinned
- **`src/lib/render/resolve-overlay.ts`** — TPLREND-05 shared resolver pattern (renderGrain / renderVignette / renderDecorativeOverlay) — Phase 69 mirrors this for decoration-renderer.tsx
- **`src/lib/render/__tests__/parity.template-fingerprint.test.tsx`** — Plan 65-03 PTF12 baseline; extend with PTF16 fixture
- **`src/lib/render/__tests__/__snapshots__/parity.template-fingerprint.test.tsx.snap`** — committed fingerprint snapshots

### Established Patterns
- **Optional schema lift pattern** (v2.11 watermark/groupId/locked/hidden): add field as optional, write null-safe consumers everywhere, commit fingerprint snapshots BEFORE any feature code lands
- **Discriminated union in Slide schema** — text_boxes use `role` field; CustomImage uses `id`; watermark is singleton — Decoration's `kind: 'icon' | 'shape'` follows the v2.8 TextSegment pattern (per-segment discriminated union)
- **Null-safe rendering**: all v2.11 schema-additive fields use `(slide.X ?? []).map(...)` — never `slide.X.map(...)` — reuse this exact pattern
- **TPLREND-05 invariant**: any divergence between React preview and Satori PNG = bug; chrome-leak / fingerprint / regression-sweep gates from Plan 65-03 are the canonical pattern

### Integration Points
- **Slide schema:** `src/lib/types/slide.ts` (or new `src/lib/types/decoration.ts`)
- **Both renderers:** `src/lib/render/render-slide.ts`, `src/lib/render/render-slide-satori.tsx` — add iteration site at layer 5.5 (between custom_images and watermark)
- **Zod validator:** `src/lib/ai/generate-slides.ts` (AI-ingest boundary; pattern at line ~184-188 from research)
- **Test suite:** `src/lib/render/__tests__/` — new fingerprint test file; extend snapshot baseline
- **package.json:** `lucide-react` version bump

</code_context>

<specifics>
## Specific Ideas

- **Mirror v2.11 Phase 60-01** (watermark schema lift): 39 LOC in commit `1164c73` was the minimum viable schema landing. Phase 67 should target similar surgical scope — 60–100 LOC of types + a few iteration sites + the parity test fixture.
- **PTF16 fingerprint suite is the gate** — must be GREEN before Phase 68 starts. Per research SUMMARY.md, this is non-negotiable.
- **Lucide-react v1 brand-icon grep gate**: research confirmed `grep` shows zero brand-icon imports in current codebase; verify in this phase as part of upgrade.
- **No DEPS-02..05 in this phase** — those are picker/card consumers and land in Phase 70.

</specifics>

<deferred>
## Deferred Ideas

- All actual decoration rendering (icons, shapes, color, stroke) — Phase 69
- Reducer ADD/UPDATE/REMOVE_DECORATION actions — Phase 68
- Picker UI, DecorationCard, layers panel chips — Phase 70
- AI emit + monoculture gate — Phase 71
- Rotation handles + AABB lift — Phase 72

</deferred>
