---
phase: 45-renderer-composition
plan: 01
subsystem: ui
tags: [renderer, parity, resolver, slot-geometry, foundation, satori, react, vitest]

# Dependency graph
requires:
  - phase: 44-template-schema-foundation
    provides: OverlayContent / TemplateOverlay / OverlaySlot / SlideTemplate.overlays / SlideTemplate.backgroundMode types + module-load validator (validateTemplateRegistry)
provides:
  - resolveOverlayContent(content, ctx) — pure resolver shared by Satori and React preview
  - SLOT_GEOMETRY constant — pixel anchors for top-left/top-right/mid/bottom-card/free
  - CANVAS constant — 1080×1920 reference dimensions
  - renderSegments(text, segments, baseColor, accentColor) — inline <span> emitter with pill style for highlightColor segments
  - bottomCardBackground(hex) — composes rgba with default 0.85 alpha (8-digit hex passthrough)
  - OverlayResolveCtx interface
affects: [45-02-satori-renderer-wiring, 45-03-react-preview-wiring, 46-premium-template-authoring]

# Tech tracking
tech-stack:
  added: []   # zero new dependencies — vitest + react + react-dom already in tree
  patterns:
    - "Shared resolver pattern: pure function imported by both server (Satori) and client (React) renderers — guarantees zero preview/export drift"
    - "SLOT_GEOMETRY as const data constant — single source of truth for pixel anchors"
    - "renderSegments as React.createElement (not JSX) — keeps the resolver at .ts (no TSX transform required by importers)"
    - "Box-decoration-break ban as documented parity contract (TPLREND-05)"

key-files:
  created:
    - src/lib/render/resolve-overlay.ts
    - src/lib/render/resolve-overlay.test.ts
    - .planning/phases/45-renderer-composition/deferred-items.md
  modified: []

key-decisions:
  - "SLOT_GEOMETRY colocated in resolve-overlay.ts (not a separate slot-geometry.ts file) — Open Question 1 resolution"
  - "renderSegments extracted as shared helper in resolve-overlay.ts — Open Question 4 resolution; net code reduction across Satori + React + eliminates 'forgot to update the other one' drift"
  - "bottomCardBackground inlined in resolve-overlay.ts (no separate compose-background.ts) — Open Question 3 resolution; six-line helper colocated with shared concerns"
  - "<HighlightSpan> React component NOT extracted yet — Open Question 2 resolution; deferred per CONTEXT.md 'judge by code size after first wire-up'. renderSegments inlines the span builder; promote to a component if 45-02/45-03 wire-up proves duplication"
  - "resolve-overlay.ts at .ts extension (not .tsx) honored per plan must_haves — JSX emitted via React.createElement"
  - "Default counter format '{currentSlide}/{totalSlides}' — String.replace twice with literal token markers (no template engine)"
  - "Missing topic falls back to '' (graceful degradation per CONTEXT.md Area 4) — no thrown errors at the resolver layer"

patterns-established:
  - "Tier-neutral shared lib pattern: pure function with no DOM/Node deps, importable from server + client + test"
  - "RED→GREEN TDD with vitest module-not-found as the RED indicator (no test framework workaround needed)"
  - "Pre-existing baseline test failures logged to deferred-items.md, NOT fixed in current scope (executor scope-boundary rule)"

requirements-completed: [TPLREND-01, TPLREND-03]
# Note: both partially satisfied at the foundation layer (resolver + slot constant in place);
# full satisfaction lands when 45-02 (Satori) and 45-03 (React preview) wire them in.

# Metrics
duration: 5min
completed: 2026-04-29
---

# Phase 45 Plan 01: Renderer Composition Foundation Summary

**Shared overlay resolver, slot pixel-anchor constant, segment-to-span pill emitter, and bottom-card RGBA helper — the parity foundation Satori (45-02) and React preview (45-03) consume to guarantee zero preview/export drift.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-29T17:03:44Z
- **Completed:** 2026-04-29T17:08:16Z
- **Tasks:** 2 (RED + GREEN)
- **Files created:** 2 (resolve-overlay.ts, resolve-overlay.test.ts)
- **Tests added:** 26
- **Lines of code:** 169 (resolve-overlay.ts) + 248 (resolve-overlay.test.ts)

## Accomplishments

- `resolveOverlayContent` resolves all 3 OverlayContent discriminator branches (literal / page-counter / slide-field) with graceful '' fallback for missing topic and missing hook_text/body_text — no thrown errors at the resolver layer
- `SLOT_GEOMETRY` locks pixel anchors per CONTEXT.md Area 1 — top-left/right inset 60, mid centered at 55%, bottom-card 38% × 80px padding, free=null
- `renderSegments` ships TPLREND-05 parity-locked pill markup: backgroundColor + 4×12 padding + 8px borderRadius + 8px marginRight (default 'pill'); 4×8 / 0 / 8 marginRight ('block'); explicit ban on `box-decoration-break: clone` documented in code
- `bottomCardBackground` honors 8-digit hex passthrough (template-supplied alpha wins) and composes rgba with default 0.85 alpha for 6-digit and 3-digit hex inputs
- 26/26 unit tests pass; full vitest suite shows zero NEW regressions (7 pre-existing baseline failures verified unchanged before/after Phase 45-01)
- Renderer files (`render-slide-satori.tsx`, `slide-preview.tsx`) byte-identical to pre-Phase-45 state — zero callsite churn

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Write failing tests for resolveOverlayContent + SLOT_GEOMETRY + renderSegments** — `535b737` (test)
2. **Task 2 (GREEN): Implement resolveOverlayContent + SLOT_GEOMETRY + renderSegments + bottomCardBackground** — `b3a1384` (feat)
3. **Doc: Log pre-existing baseline failures** — `ec8f653` (docs, scope-boundary deviation log)

_TDD gate compliance: RED commit (`535b737`) precedes GREEN commit (`b3a1384`) in git log. No REFACTOR phase needed — implementation hit GREEN cleanly on first pass._

## Files Created/Modified

### Created

- `src/lib/render/resolve-overlay.ts` (169 lines) — Phase 45 shared resolver foundation
  - `CANVAS` (W/H = 1080/1920)
  - `SLOT_GEOMETRY` (5-slot pixel-anchor map)
  - `OverlayResolveCtx` interface
  - `resolveOverlayContent(content, ctx)` — 3-branch discriminator resolver
  - `renderSegments(text, segments, baseColor, accentColor)` — React.createElement-based span emitter
  - `bottomCardBackground(hex)` — 8/6/3-digit hex → rgba composer
- `src/lib/render/resolve-overlay.test.ts` (248 lines) — 26 unit tests across 4 describe blocks
  - resolveOverlayContent (9 cases)
  - SLOT_GEOMETRY (6 cases) + CANVAS (1 case)
  - renderSegments (7 cases including box-decoration-break parity check)
  - bottomCardBackground (3 cases)
- `.planning/phases/45-renderer-composition/deferred-items.md` (45 lines) — pre-existing baseline failure tracking

### Modified

None. Renderer files (`render-slide-satori.tsx`, `slide-preview.tsx`) are byte-identical to the pre-Phase-45-01 state (verified via `git diff HEAD~3 HEAD --stat -- ...` returning empty).

## Decisions Made

All four Open Questions from 45-RESEARCH.md resolved during execution:

| OQ | Decision | Rationale |
|----|----------|-----------|
| 1 — SLOT_GEOMETRY location | Colocated in `resolve-overlay.ts` | YAGNI — Phase 46 will only need a separate `slot-geometry.ts` if a template config legitimately imports the constant without the resolver. Promote later if that emerges. |
| 2 — Extract `<HighlightSpan>` component? | NO — inline span builder in `renderSegments` | CONTEXT.md says "judge by code size after first wire-up." 16 lines inside a single function is well below the extraction threshold. |
| 3 — `bottomCardBackground` location | Inline in `resolve-overlay.ts` | Six lines + one caller. A new file would be heavier than the helper. |
| 4 — Extract `renderSegments` shared? | YES — extracted as exported function in `resolve-overlay.ts` | Strong-recommend from RESEARCH: net code reduction across Satori + React + eliminates "forgot to update the other one" drift. Implementing the locked TPLREND-05 parity contract, not adding scope. |

Additional implementation decision:

- **`React.createElement` instead of JSX:** the plan locked file extension at `.ts` via `must_haves.artifacts[0].path`. Using `React.createElement` honors the locked extension without requiring the importer to enable a TSX transform. Functionally equivalent to JSX (same output, same React semantics).

## Deviations from Plan

None functionally — plan executed as written. Three minor fidelity-preserving adjustments worth noting (not deviations from intent):

1. **Test count:** plan said "≥26 `it()` blocks." Implementation has exactly 27 (`it()` lines): 9 + (6+1) + 7 + 3 = 26 cases as enumerated, plus one extra `describe('CANVAS', ...)` block was split out from the SLOT_GEOMETRY block for clarity (CANVAS test #16). Net: 27 `it()` blocks covering the 26 enumerated cases. Acceptance criterion satisfied (≥26).
2. **`React.createElement` vs JSX:** plan code samples used JSX. To honor the locked `.ts` extension, implementation uses `React.createElement('span', { key, style }, children)`. Output is byte-identical to JSX equivalent.
3. **Separator handling in renderSegments:** the implementation inlines `sep` into `children` (`${seg.text}${sep}`) instead of passing as a separate React child node. This produces the same DOM and the same serialized HTML — verified by test #23 (`expect(html).toContain('A ')`).

## Issues Encountered

**Pre-existing baseline test failures (out of scope, NOT caused by 45-01).**

During the GREEN-phase regression check, full `npx vitest run` reported 7 failed test files / 12 failed tests. Verified pre-existing by removing 45-01 files, re-running the suite, and observing identical failures (43→42 passed test files = the 1 file we removed; 313→287 passed tests = the 26 we removed). 0 new regressions introduced by Phase 45-01.

The 7 affected test files (rate-limit, slide-preview, responsive editor, slide-canvas Y-of-N indicator, projects CRUD, stripe checkout, stripe sync-subscription) span Stripe/Supabase mock drift and editor mock drift — all unrelated to Phase 45 renderer composition. Logged in `deferred-items.md` for triage in a separate quick-task or their respective subsystems' next active phase.

## TDD Gate Compliance

Plan declared `type: tdd` at the plan level + `tdd="true"` on both tasks. Gate sequence verified:

- ✓ RED commit (`535b737` — `test(45-01): add failing tests for resolve-overlay (RED)`) precedes GREEN
- ✓ GREEN commit (`b3a1384` — `feat(45-01): implement resolve-overlay foundation (GREEN)`) follows RED with implementation
- — REFACTOR phase: not applicable; implementation hit all 26 tests cleanly on first pass with no cleanup needed

The RED phase was confirmed by vitest output: `Failed to resolve import "./resolve-overlay" from "src/lib/render/resolve-overlay.test.ts"`. This is the canonical "module-not-found" RED state for TDD — the test file references a module that doesn't exist yet, so vitest cannot even start the suite.

## Threat Model Verification

Phase 45-01 plan declared 3 STRIDE threats; all dispositions honored in implementation:

- **T-45-01-01 (page-counter format string tampering, accept):** ✓ Only `{currentSlide}` and `{totalSlides}` tokens are substituted via `String.prototype.replace`. No eval, no template DSL. Unknown tokens passthrough verbatim.
- **T-45-01-02 (highlightColor CSS injection, accept):** ✓ `highlightColor` flows into `React.CSSProperties.backgroundColor` — React's CSS-property serialization escapes invalid values to browser defaults. No JS execution path.
- **T-45-01-03 (slide-field empty-string fallback, mitigate):** ✓ Documented in tests #6 (topic missing → `''`) and #9 (hook_text empty → `''`). Resolver does not throw, does not leak environment data, returns the closed-enum fallback only.

No new security-relevant surface introduced beyond the threat register — module is pure, no I/O, no parsing of untrusted strings.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for 45-02 (Satori renderer wiring):**
- `resolveOverlayContent`, `SLOT_GEOMETRY`, `CANVAS`, `renderSegments`, `bottomCardBackground` are exported and unit-tested
- Import path: `import { ... } from '@/lib/render/resolve-overlay'`
- Plan 45-02 can extend `buildSlideElement` to (a) accept optional `ctx?` param, (b) compose `template.overlays` using `SLOT_GEOMETRY` + `resolveOverlayContent`, (c) replace `renderSegmentChildren` callsites with `renderSegments`, (d) add `image-bleed` / `image-with-bottom-card` branches using `bottomCardBackground`

**Ready for 45-03 (React preview wiring) — parallelizable with 45-02 after 45-01 commits:**
- Same 5 exports available client-side (no server-only deps in resolve-overlay.ts)
- Plan 45-03 can extend `<SlidePreview>` with `slideIndex?: number = 0`, `totalSlides?: number = 1` props, replace inline `renderSegments` helper, add overlay JSX in BOTH editable + non-editable branches

**Blockers:** none.

## Self-Check: PASSED

Verified post-creation:

- ✓ FOUND: `src/lib/render/resolve-overlay.ts` (169 lines, 6 exports verified)
- ✓ FOUND: `src/lib/render/resolve-overlay.test.ts` (26 tests passing)
- ✓ FOUND: `.planning/phases/45-renderer-composition/deferred-items.md`
- ✓ FOUND commit: `535b737` (RED) in `git log --oneline -4`
- ✓ FOUND commit: `b3a1384` (GREEN) in `git log --oneline -4`
- ✓ FOUND commit: `ec8f653` (deferred-items doc) in `git log --oneline -4`
- ✓ Renderer files unchanged: `git diff HEAD~3 HEAD --stat -- src/lib/render/render-slide-satori.tsx src/components/slides/slide-preview.tsx` returns empty (no diff)
- ✓ Test verification: `npx vitest run src/lib/render/resolve-overlay.test.ts` → 26/26 passing
- ✓ TS verification: zero new TypeScript errors in resolve-overlay files (14 pre-existing baseline errors unchanged)

---
*Phase: 45-renderer-composition*
*Plan: 01*
*Completed: 2026-04-29*
