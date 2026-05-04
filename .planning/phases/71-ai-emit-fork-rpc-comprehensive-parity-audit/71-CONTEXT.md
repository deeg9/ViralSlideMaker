# Phase 71: AI Emit + Fork RPC + Comprehensive Parity Audit - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss; mostly infrastructure — Gemini schema lift + SQL migration + audit; no novel UI surface)

<domain>
## Phase Boundary

Gemini's slide-generation schema lifts to emit `decorations[]` per slide with `maxItems: 2` cap, ~100-icon PascalCase allowlist (subset of Phase 69 registry), named color tokens (`'accent'` / `'palette-vibrant'`) resolved server-side to explicit hex, semantic position anchors (`'top-right'` / `'bottom-left'`) resolved to safe-zone % coords; advisory monoculture gate logs warning if ≥60% of slides share lucideName/shapeKind (does NOT fail CI in v2.12); fork RPC migration strips `locked` flag on decorations.

**Requirements (7):** AI-01..05, PARITY-10 (PTF17), MIGR-01

**Out of scope:** Rotation handles (Phase 72); CARD-06 (Phase 72); live-Gemini wiring (advisory only — promote to fail-CI in v3.0+ if production data shows monoculture).

</domain>

<decisions>
## Implementation Decisions

### AI Schema Lift (AI-01, AI-02)
- Gemini `slidesWithTextBoxes` JSON schema gains `decorations: array(maxItems: 2, items: DecorationEmitSchema)` per slide
- `DecorationEmitSchema` is a SUBSET of full DecorationSchema:
  - `kind: 'icon' | 'shape'` (closed enum)
  - For icon: `lucideName: enum(...closed-enum-100-PascalCase-allowlist...)` (subset of Phase 69's 118 registry; ~100 strict)
  - For shape: `shapeKind: enum('rect' | 'circle' | 'ellipse' | 'triangle' | 'polygon' | 'star' | 'arrow' | 'line')` + optional `points` enum + optional `cornerRadius`
  - `color: enum('accent' | 'palette-vibrant' | 'palette-dark-muted' | 'palette-light' | 'on-light' | 'on-dark')` — NAMED TOKENS, never raw hex from AI
  - `position: enum('top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'top-center' | 'bottom-center')` — semantic anchors, resolved server-side
  - `rotation?: number` (-180..180; optional)
- Server-side clamp: AI emitting >2 decorations per slide → first 2 kept, rest dropped
- Unknown lucideName → silent drop at AI-ingest boundary (mirror v2.9 `template_id_override` defaulting pattern)

### Server-Side Token Resolution (AI-03, AI-04)
- NEW: `src/lib/ai/resolve-ai-decoration.ts`
  - `resolveAIDecoration(emitted, slide, template)` returns full Decoration with explicit hex + % coords
  - Color resolution: `resolveAIColor(token, template, derived_palette)` returns hex
    - `'accent'` → template.accentColor
    - `'palette-vibrant'` → derived_palette.Vibrant
    - `'palette-dark-muted'` → derived_palette.DarkMuted
    - etc.
  - Position resolution: `resolveAIPosition(anchor, slideSize)` returns x/y/width/height in % coords
    - `'top-right'` → x=70%, y=10%, width=20%, height=15% (safe-zone offsets that don't occlude hook text)
    - etc.
- Validates resolved decoration via Phase 67 DecorationSchema; silent-drop on validation fail

### Advisory Monoculture Gate (AI-05)
- NEW: `src/lib/ai/decoration-diversity-check.ts`
- `decorationDiversityCheck(slides)` walks all slides; computes:
  - lucideName frequency map across all icon decorations
  - shapeKind frequency map across all shape decorations
- If any single name/kind ≥60% of total decorations across the carousel → log advisory warning (console.warn with carousel id + dominant name/count/total)
- Does NOT fail CI in v2.12 — purely advisory (mirror v2.9 hookOpeningTrigram pattern)
- Wire to retry-once-on-detection in v3.0+ if production data shows monoculture

### Fork RPC Migration (MIGR-01)
- NEW: Supabase migration `supabase/migrations/20260YYY_fork_strip_decoration_locked.sql`
- Function: `fork_published_carousel` extends to walk decorations[] and strip `locked: true` flag (mirror v2.11 `20260502_fork_strip_locked.sql` pattern)
- Forker inherits decoration positions/colors but NOT lock state
- Test: forking a project with locked decorations produces decoration array with locked=undefined for all entries

### PARITY-10 = PTF17 (Comprehensive Parity Audit)
- NEW test: `parity.template-fingerprint-decorations-ai-emit.test.tsx`
- Fixture: AI-emitted decoration on decoration-bearing slide
- Pipe through resolveAIDecoration + DecorationSchema validation + both renderers
- Assert byte-identical fingerprint between Satori PNG + React preview (string equality)
- ~5 tests

### Carry-Forward Audit (final Phase 71 sweep)
- All v2.12 audit gates GREEN: PTF13/14/16/17/18 + PCL11/12/13 + PRA1..12 + PRS7/8 + LP-NEW1..3 + SWEEP-PICK-1..6
- Phase 71 ship-gate doc enumerating each gate + test count + commit hash
- v2.12 ready-to-ship checklist (manual QA items deferred for user)

### Claude's Discretion
- Exact named-token list (recommend 6: accent / palette-vibrant / palette-dark-muted / palette-light / on-light / on-dark — covers Canva-pattern AI-emit dictionary)
- Exact semantic anchor list (recommend 7: top-left/right/center, center, bottom-left/right/center)
- Whether to write Vitest test for monoculture gate or just runtime advisory log (recommend test for the helper function + smoke for the integration boundary; don't over-test pure advisory)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/ai/generate-slides.ts` — AI ingest boundary; `legacyToTextBoxes` adapter pattern at line ~184-188
- `src/lib/ai/schemas.ts` — Phase 67 DecorationSchema + parseDecorationsArraySafe; this phase adds DecorationEmitSchema variant
- `src/lib/ai/resolve-ai-color.ts` (might exist as v2.9 helper) — extend or mirror for resolveAIDecoration
- `src/lib/render/decorations/registry.ts` — Phase 69 — 118-icon allowlist; this phase derives ~100-icon AI subset
- `src/lib/ai/__tests__/diversity-corpus.ts` — v2.9 — pattern for diversity gate
- `src/lib/ai/__tests__/decoration-schema.test.ts` — Phase 67
- `supabase/migrations/20260502_fork_strip_locked.sql` — v2.11 pattern for fork strip migration
- `src/lib/ai/match-photos-to-slides.ts` — v2.9 pattern for AI-emit silent-drop validation

### Established Patterns
- **Closed-enum AI emit** (mirror v2.9 `template_id_override`): server validates against enum; unknown silently dropped
- **Named tokens never raw hex from AI** — server-side resolution
- **Semantic anchors resolved to safe-zone coords** — never occlude hook text
- **Advisory diversity gate** — mirror v2.9 hookOpeningTrigram (console.warn, no CI fail)
- **Fork strip migration** — mirror v2.11 20260502_fork_strip_locked.sql

### Integration Points
- `src/lib/ai/generate-slides.ts` (Gemini schema lift; Decoration ingest adapter)
- `src/lib/ai/schemas.ts` (DecorationEmitSchema)
- NEW `src/lib/ai/resolve-ai-decoration.ts` + tests
- NEW `src/lib/ai/decoration-diversity-check.ts` + tests
- NEW `supabase/migrations/20260XXX_fork_strip_decoration_locked.sql`
- NEW `src/lib/render/__tests__/parity.template-fingerprint-decorations-ai-emit.test.tsx` (PTF17)
- Phase 71 ship-gate doc

</code_context>

<specifics>
## Specific Ideas

- **Mirror v2.9 Phase 58** — Gemini `role` enum + `template_id_override` enum + diversity-corpus pattern
- **Mirror v2.11 Phase 64-02** — fork-strip-locked SQL migration pattern
- **Test counts:** ~30 unit tests (resolve + diversity + schema) + 5 PTF17 + ~10 fork-RPC migration tests = ~45 net new

</specifics>

<deferred>
## Deferred Ideas

- Rotation handles + AABB lift (EDITOR-07, ROTATE-01..04, CARD-06) → Phase 72
- Live Gemini wiring for diversity gate retry-on-detection → v3.0+
- Per-template decoration whitelist (`SlideTemplate.decorationWhitelist?`) → v2.13+

</deferred>
