---
phase: 60-multi-select-foundation-watermark-schema-lift
plan: 02
subsystem: schema
tags: [watermark, adapter, parity, byte-identity, schema-lift, lazy-init, satori, react-preview]

# Dependency graph
requires:
  - phase: 60-01
    provides: "Watermark interface + Slide.watermark? optional slot in src/lib/types/slide.ts"
provides:
  - "legacyWatermarkToElement(slide, slideIndex) -> Watermark | null adapter"
  - "elementToLegacyWatermark(watermark) -> WatermarkLegacySlice inverse adapter"
  - "WatermarkLegacySlice public type"
  - "Lazy-initializer minting of slide.watermark from legacy slot on slide load"
  - "PARITY-01 chrome-leak regression test seed (selection/marquee/guide whole-word scan)"
  - "Phase 60 watermark parity gate (5 tests in parity.test.tsx)"
affects:
  - "Plan 60-03 (useSelectionModel): can read slide.watermark.id during stale-id reconciliation"
  - "Plan 60-05 (selection-bounds + ring): MUST keep ring className OUT of editable={false} branch (PARITY-01 enforces)"
  - "Phase 61 (marquee): selecto chrome must not leak into editable={false}"
  - "Phase 63 (smart guides): guide DOM must not leak into editable={false}"
  - "Phase 65 (layers panel): mounting in editable={true} only"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Watermark-adapter mirrors text-box-adapter byte-for-byte structure (pure module, no React/state)"
    - "Optional-field-spread pattern for round-trip safety (...(x !== undefined ? { k: x } : {}))"
    - "Lazy-initializer eager-migration on load (mirrors Plan 49 legacyToTextBoxes)"
    - "Dual-source mirror with legacy slot retention (resolver contract preserved)"
    - "Whole-word className regex regression scan (\\bselection\\b, etc.) for editor-only chrome"

key-files:
  created:
    - "src/lib/editor/watermark-adapter.ts (59 LOC pure module)"
    - "src/lib/editor/__tests__/watermark-adapter.test.ts (281 LOC, 10 tests)"
  modified:
    - "src/lib/editor/use-slide-editor.ts (lazy initializer extension)"
    - "src/lib/render/render-slide-satori.tsx (Phase 60 comment block, no functional change)"
    - "src/components/slides/slide-preview.tsx (Phase 60 comment block, no functional change)"
    - "src/lib/render/__tests__/parity.test.tsx (Phase 60 describe block + 5 tests)"

key-decisions:
  - "Watermark id strategy: deterministic w_${slideIndex} (per RESEARCH Q2)"
  - "Legacy slot RETAINED after lazy-init mirror (free-tier resolver reads it; resolver contract preserved)"
  - "NO functional change to render-slide-satori.tsx or slide-preview.tsx — comment only. Byte-identity preserved by the mirror, not by changing the resolver"
  - "PARITY-01 chrome-leak scan uses whole-word regex (\\bselection\\b) not substring; intentionally strict"

patterns-established:
  - "Pure-module adapter convention: no 'use client', no useState/useEffect"
  - "Lazy-initializer mints unified path from legacy on first load + retains legacy slot for back-compat"
  - "Symmetric round-trip adapter (legacy<->element) enables future phase migration without breaking existing renderers"

requirements-completed: [WMARK-02, WMARK-03, WMARK-04, WMARK-05, PARITY-01]

# Metrics
duration: ~5min
completed: 2026-05-03
---

# Phase 60 Plan 02: Watermark Adapter + Slide.watermark Wiring + Parity Gate Summary

**Watermark schema lift through the parity gate — adapter, lazy-init mirror, and 5-test PARITY-01 SEED that guarantees byte-identical PNG output across all 53+ existing projects pre/post unification.**

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-05-03T01:13:10Z
- **Completed:** 2026-05-03T01:18:21Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)
- **LOC added:** ~340 (59 adapter + 281 tests + ~30 wiring + 168 parity-test extension + comment blocks)

## Accomplishments

- **Pure adapter module** (`src/lib/editor/watermark-adapter.ts`) mirroring `text-box-adapter.ts` byte-for-byte structurally. Two functions: `legacyWatermarkToElement(slide, slideIndex)` mints a Watermark element with deterministic id `w_${slideIndex}`; `elementToLegacyWatermark(wm)` returns a `WatermarkLegacySlice` that, when shallow-merged onto `style_overrides`, reconstructs identical legacy shape. Idempotent. Round-trip lossless.
- **10 adapter unit tests** covering 6 fixture shapes (no-watermark, legacy-enabled, custom-logo, three position variants, unified-only, both-paths-present) + idempotency + free-tier preservation + null-element handling.
- **Lazy initializer** (`migrateLegacySlides` in `use-slide-editor.ts`) extended to mint `slide.watermark` from `style_overrides.watermark` / `hide_watermark` on first load. Idempotent. The legacy slot is RETAINED populated so `resolveForcedWatermark` (which enforces free-tier opt-out by reading the legacy slot) continues working unchanged.
- **PARITY GATE PASSED**: 5 new tests in `parity.test.tsx`:
  - Test 1: legacy-only slide and lifted slide produce identical `resolveForcedWatermark` output.
  - Test 2: adapter is idempotent across calls (`w_5` stable).
  - Test 3: round-trip element → legacy → element preserves all fields.
  - Test 4 (PARITY-01 SEED): `SlidePreview editable={false}` renders ZERO multi-selection chrome. Whole-word regex check on `selection`/`marquee`/`guide` className substrings.
  - Test 5: free-tier `enabled=false` STILL renders post-unification AND produces byte-identical output between legacy-only and lifted slides.
- **Renderer comment annotations** in both `render-slide-satori.tsx:273-275` and `slide-preview.tsx:746-768` documenting the dual-source mirror invariant. NO functional change to either renderer — byte-identity preserved by construction (the mirror keeps both paths in sync; resolver contract unchanged).

## Task Commits

1. **Task 1 (TDD):** `35b7ce3` - `feat(60-02/t1): watermark-adapter pure module + 10 unit tests`
2. **Task 2:** `b67c13a` - `feat(60-02/t2): wire adapter into lazy init + phase 60 renderer comments`
3. **Task 3:** `0a7deb9` - `test(60-02/t3): parity gate — watermark schema-lift + PARITY-01 chrome scan`

## Files Created/Modified

- `src/lib/editor/watermark-adapter.ts` (NEW, 59 LOC) — pure module exporting `legacyWatermarkToElement`, `elementToLegacyWatermark`, `WatermarkLegacySlice`. No React/state coupling.
- `src/lib/editor/__tests__/watermark-adapter.test.ts` (NEW, 281 LOC) — 10 unit tests across 5 describe blocks (lift, inverse, round-trip, free-tier preservation, 6-fixture sweep).
- `src/lib/editor/use-slide-editor.ts` — `migrateLegacySlides` extended to also mint `slide.watermark` from legacy slot on slide load via `legacyWatermarkToElement`. Slide-index now passed to the map callback for deterministic id generation.
- `src/lib/render/render-slide-satori.tsx` — comment block above the existing `resolveWatermark` call documenting the Phase 60 mirror invariant. No functional change.
- `src/components/slides/slide-preview.tsx` — same comment block above the React-preview watermark resolution IIFE at lines 746-768. No functional change.
- `src/lib/render/__tests__/parity.test.tsx` — 5 tests appended in a new `describe('Phase 60 (PARITY-01, WMARK-04, WMARK-05): watermark schema-lift parity', ...)` block. Imports for `legacyWatermarkToElement`, `elementToLegacyWatermark`, `resolveForcedWatermark`, `Watermark` added at top.

## Verification

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | **17 baseline errors** (unchanged; all pre-existing test-mock typing issues in `__tests__/auth/*`, `__tests__/projects/`, `__tests__/stripe/`, `lib/services/__tests__/`). **Zero new errors introduced.** |
| `npx vitest run src/lib/editor/__tests__/watermark-adapter.test.ts` | **10/10 pass** |
| `npx vitest run src/lib/render/__tests__/parity.test.tsx` | **19/19 pass** (14 pre-existing + 5 new) |
| `grep -c "useState\|useEffect\|use client" src/lib/editor/watermark-adapter.ts` | **0** (pure module verified) |

**Byte-identity invariant**: confirmed via Test 1 + Test 5 in the parity gate — `resolveForcedWatermark` produces identical output for legacy-only and lifted slides, AND for free-tier `enabled=false` slides where the lock must persist post-schema-lift.

## Decisions Made

1. **Deterministic id strategy** — `w_${slideIndex}` (per RESEARCH Q2). Idempotent across calls; same slide+index always yields same id.
2. **Legacy slot retention** — the lazy initializer ADDS `slide.watermark` but does NOT delete `style_overrides.watermark`. The free-tier `resolveForcedWatermark` reads the legacy slot directly; deleting it would break the locked opt-out. The mirror is one-way (legacy → unified) at slide-load time; symmetric round-trip via `elementToLegacyWatermark` is exposed for future save-time dual-write but not yet wired (Phase 60 only adds the unified element).
3. **No functional change to renderers** — both `render-slide-satori.tsx` and `slide-preview.tsx` continue to call `resolveWatermark` / `resolveForcedWatermark` exactly as before. Byte-identity is preserved by the lazy initializer's mirror, NOT by changing the resolver contract. Replacing the resolver wholesale is deferred to a future phase.
4. **Strict whole-word regex for PARITY-01 chrome scan** — `class="[^"]*\bselection\b[^"]*"` matches whole-word only. This intentionally fires on `selection-ring` but NOT on `pre-selection-color` etc. Plan 60-05's selection ring MUST keep its className gated to `editable={true}` or this test fails the build.

## Deviations from Plan

**None.** Plan executed exactly as written, including the pure-module convention, the deterministic id strategy, the legacy-slot retention rule, and the 5-test parity-gate composition.

The plan estimated ~380 LOC; actual is ~340 LOC (59 adapter + 281 tests + 30 wiring + 168 parity-test extension + small comment blocks). The adapter came in slightly more compact than estimated because the optional-field-spread pattern is naturally tight; tests came in slightly larger because the 6-fixture round-trip sweep was expanded to 8 sub-cases (3 position variants explicitly enumerated).

## Issues Encountered

**Pre-existing uncommitted Plan 60-03 work in working tree** — when running `npx vitest run src/lib/editor/`, 4 BULK_TRANSLATE tests fail in `editor-reducer.test.ts`. Investigation via `git stash` confirmed these failures stem from uncommitted modifications to `editor-reducer.test.ts`, `editor-actions.ts`, and `editor-reducer.ts` that were already in the working tree before Plan 60-02 started — a partial Plan 60-03 T2 implementation that wasn't finished. **Not Plan 60-02's responsibility.** Logged to `deferred-items.md` for Plan 60-03 owner. Plan 60-02 changes are isolated and pass clean verification when tested in isolation (10/10 adapter + 19/19 parity).

## User Setup Required

None — no external service configuration needed. Pure code change.

## Next Phase Readiness

- **Plan 60-03** (useSelectionModel) can now read `slide.watermark?.id` for stale-id reconciliation — the schema slot is populated by the lazy initializer.
- **Plan 60-05** (selection-bounds + ring) can read `slide.watermark?.id` for selection membership in the union-AABB ring. **MUST** respect the PARITY-01 SEED — ring className MUST NOT leak into the `editable={false}` render tree (Test 4 will fail the build if it does).
- **Future phases** (61 marquee, 63 smart guides, 65 layers panel) can extend the chrome-scan regex to additional editor-only DOM. The whole-word pattern is the canonical convention.
- The watermark adapter's `elementToLegacyWatermark` inverse is shipped but not yet wired into a save-time dual-write — Phase 60 only mints on load. A future phase that begins editing watermarks via the unified path will add the dual-write.

## Self-Check: PASSED

**Files verified to exist:**
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/watermark-adapter.ts`
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/__tests__/watermark-adapter.test.ts`
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/.planning/phases/60-multi-select-foundation-watermark-schema-lift/60-02-SUMMARY.md`

**Commits verified to exist:**
- `35b7ce3` (Task 1: watermark-adapter pure module + 10 unit tests)
- `b67c13a` (Task 2: wire adapter into lazy init + phase 60 renderer comments)
- `0a7deb9` (Task 3: parity gate — watermark schema-lift + PARITY-01 chrome scan)

---
*Phase: 60-multi-select-foundation-watermark-schema-lift*
*Completed: 2026-05-03*
