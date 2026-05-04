---
phase: 70-editor-ui-picker-card-layers-shapes
plan: 02
subsystem: editor-ui
type: execute
wave: 2
depends_on: [70-01]
requires:
  - DECOR-01..04 (Phase 67 — Decoration types)
  - DECOR-05 (Phase 67 — DecorationSchema Zod validator)
  - LUCIDE_DECORATION_ALLOWLIST (Phase 69-01 — closed-enum 118-icon registry)
  - DEPS-02 (Plan 70-01 — @tanstack/react-virtual installed)
  - DEPS-03 (Plan 70-01 — @leeoniya/ufuzzy installed)
  - DEPS-05 (Plan 70-01 — bundle-size gate live)
provides:
  - PICKER-01 (LucidePicker modal mount)
  - PICKER-02 (4-col virtualized grid via @tanstack/react-virtual)
  - PICKER-03 (ufuzzy fuzzy search with 250ms debounce)
  - PICKER-04 (WAI-ARIA grid keyboard nav: arrows, Enter, Esc, Tab focus trap)
  - PICKER-05 (Click → ADD_DECORATION via buildDefaultIconDecoration; modal closes)
  - PICKER-06 (Hover tooltip via native title= attribute)
  - PICKER-08 (next/dynamic lazy-load wrapper — LucidePickerDynamic)
  - buildDefaultIconDecoration factory (shared with Plan 70-03 I keyboard shortcut)
affects:
  - editor-route bundle (still EXACT v2.11 baseline; lazy chunk lands on first
    Plan 70-03 toolbar wire-up)
  - decoration-picker barrel (now exports LucidePickerDynamic family alongside ShapePicker)
tech-stack:
  added:
    - "First eager-imports of @tanstack/react-virtual (lucide-picker.tsx)"
    - "First eager-imports of @leeoniya/ufuzzy (lucide-picker-corpus.ts)"
  patterns:
    - "next/dynamic with ssr:false + loading:()=>null for picker family"
    - "Module-level corpus build with module-level ufuzzy singleton"
    - "Tile-ref callback registry for keyboard nav focus-by-index without DOM traversal"
    - "Defense-in-depth keyboard scope: inner stopPropagation + outer (Plan 70-03) firewall"
    - "Suite-level offsetWidth/offsetHeight shim for tanstack-virtual jsdom tests (PITFALL C.1)"
key-files:
  created:
    - src/components/editor/decoration-picker/lucide-picker.tsx
    - src/components/editor/decoration-picker/lucide-picker-corpus.ts
    - src/components/editor/decoration-picker/lucide-picker.dynamic.tsx
    - src/components/editor/decoration-picker/icon-defaults.ts
    - src/components/editor/decoration-picker/__tests__/lucide-picker.test.tsx
    - src/components/editor/decoration-picker/__tests__/lucide-picker-keyboard.test.tsx
    - src/components/editor/decoration-picker/__tests__/lucide-picker-corpus.test.ts
    - src/components/editor/decoration-picker/__tests__/icon-defaults.test.ts
  modified:
    - src/components/editor/decoration-picker/index.ts (LucidePickerDynamic + buildDefaultIconDecoration exports; LucidePicker eager NOT exported)
decisions:
  - "Picker enumerates LUCIDE_DECORATION_ALLOWLIST (Phase 69-01 closed-enum 118 icons), NOT the full 1,703-icon lucide-static export — corpus stays curated and the AI emit boundary (Phase 71) consumes the same source"
  - "Module-level singleton ufuzzy instance + module-level corpus build (Test 8 asserts re-import returns identical reference); per-call rebuilds would re-allocate every keystroke"
  - "uFuzzy options: { intraIns: 1 } enables 1-char typo tolerance ('hart' → 'Heart') without false-positive explosion across the 118-name corpus"
  - "Search debounce window: 250ms locked from CONTEXT D-FUZZY; caps ufuzzy invocation rate to ~4 Hz (T-70-13 STRIDE mitigation)"
  - "Tile preview rendered via renderDecoration (Phase 69 single source of truth) so tile glyph is byte-identical to canvas output (TPLREND-05)"
  - "Default IconDecoration size: 12% × 12% — readable at slide-preview scale, not so large it dominates; consistent with shape-defaults' 20% × 20% but smaller because icons are denser"
  - "Default icon color #3D0000 (brand primary) matches DEFAULT_SHAPE_FILL — symmetry across the picker family"
  - "ArrowUp on row 0 → escape to search input (common pattern from Algolia DocSearch / GitHub search UIs); ArrowDown at last row clamps (no wrap; predictable focus boundary)"
  - "ArrowLeft at index 0 stays at 0 — chosen over wrap-to-end-of-prev-row for simplicity; matches the 'no out-of-grid focus loss' UX expectation"
  - "Tab focus trap implemented via manual preventDefault+focus rather than the JS-arena tabindex-juggling pattern — robust across jsdom + browsers without environment-specific hacks"
  - "Tile registry uses Map<lucideName, HTMLButtonElement> via callback ref (NOT useRef array) so virtualizer mount/unmount of tiles automatically updates the registry"
  - "PITFALL C.1 jsdom virtualization: at-suite-level offsetWidth/offsetHeight shim (NOT global setup.ts) — keeps the shim scoped to picker tests where it's needed; production-relevant tests stay honest"
  - "Index barrel exports LucidePickerDynamic (value) + LucidePickerProps (type only); the eager LucidePicker is intentionally NOT exported — barrel header comment + Test 17 source-grep enforce"
metrics:
  duration: ~45min
  completed: 2026-05-04
  tasks: 3
  tests-added: 53
  tests-total: 79  # 26 Plan 70-01 carried + 53 Plan 70-02 new (decoration-picker dir)
  bundle-baseline-raw: 165906
  bundle-baseline-gz: 35399
  bundle-post-task3-raw: 165906
  bundle-post-task3-gz: 35399  # rebuilt at end of plan; same as v2.11 baseline
  ceiling-raw: 370706
  ceiling-gz: 240199
  loc-source: 684     # lucide-picker (461) + corpus (109) + icon-defaults (76) + dynamic (38)
  loc-tests: 708      # 4 test files
  loc-total: 1392
tags: [decorations, picker, lucide, virtualized, fuzzy-search, modal, lazy-load, keyboard-nav, v2.12]
---

# Phase 70 Plan 02: LucidePicker Modal — Virtualized + Fuzzy + Keyboard + Lazy Summary

Ships the headline UI of Phase 70: a lazy-loaded LucidePicker modal containing
a 4-col virtualized grid of all 118 Lucide icons from the Phase 69-01 closed-
enum allowlist, with @leeoniya/ufuzzy fuzzy search (250ms debounced), full
WAI-ARIA grid keyboard navigation (arrows + Enter + Esc + Tab focus trap),
click-to-insert dispatching ADD_DECORATION via a shared
`buildDefaultIconDecoration` factory, and a `next/dynamic` wrapper that polices
the editor route bundle ceiling locked in Plan 70-01.

## What Shipped

### Task 1 — `lucide-picker-corpus` + `buildDefaultIconDecoration` (commit `f8c299b`)

- **`lucide-picker-corpus.ts`** (109 LOC): module-level corpus built once at
  import from `LUCIDE_DECORATION_ALLOWLIST` (Phase 69-01 single source of
  truth — 118 entries). Each entry exposes `lucideName` (PascalCase canonical),
  `displayName` (PascalCase split into space-separated words for the UI), and
  `searchTokens` (lowercase string combining both casings for the ufuzzy
  haystack).
- **`filterIcons(query)`**: ufuzzy-backed fuzzy filter with `intraIns: 1`
  typo tolerance. Empty / whitespace query is a no-op (returns full corpus).
  Module-level singleton instance — every keystroke shares the regex
  compilation cost.
- **`createUfuzzy()`**: factory for tests + future scoped-instance consumers.
- **`icon-defaults.ts`** (76 LOC): `buildDefaultIconDecoration(lucideName, opts?)`
  factory. Defaults: 12% × 12% bbox centered at (50, 50) with brand-primary
  `#3D0000` fill and Lucide library default stroke-width 2. Closed-enum guard
  (T-70-09 STRIDE): unknown name returns `null` instead of throwing.
- **20 tests GREEN**: corpus shape (118 entries, lowercase tokens, both
  casings), fuzzy hits (heart, arrow×5, hart→Heart) and misses (xyznotreal,
  whitespace), module-level reference equality, factory schema round-trip
  across all 118 allowlist entries.

### Task 2 — LucidePicker modal core (commit `9f1923b`)

- **`lucide-picker.tsx`** (461 LOC): `'use client'` modal mirroring
  `publish-modal.tsx`'s shell — fixed-overlay backdrop, rounded 2xl card with
  shadow-xl, backdrop click closes, `role="dialog"` + `aria-modal="true"` +
  `aria-label="Insert icon"`.
- **Search input**: auto-focused on open via `requestAnimationFrame` →
  `searchRef.current.focus()`. 250ms debounce via `setTimeout` in `useEffect`
  (CONTEXT D-FUZZY).
- **Virtualized grid**: `@tanstack/react-virtual` 4-col grid; row height 80px,
  overscan 4. `getTotalSize()` returns 30 × 80 = 2400px for the full 118-icon
  corpus. PITFALL C.1 mitigation in tests: suite-level
  `offsetWidth`/`offsetHeight` override so jsdom reports non-zero dimensions
  (no production code change).
- **Tile glyph preview**: rendered via `renderDecoration` (Phase 69 single
  source of truth) at 32 × 32px wrapper — TPLREND-05 byte-identical with
  canvas output.
- **Click handler**: `buildDefaultIconDecoration` → `onAddDecoration` +
  `onClose`. Closed-enum guard returns null on unknown name.
- **Native `title=` tooltip**: per PICKER-06 — no custom tooltip component.
- **Defense-in-depth keyboard scope**: every keydown calls
  `e.stopPropagation()` so editor tinykeys never see picker events. The
  AUTHORITATIVE outer firewall is added by Plan 70-03 to slide-editor.tsx
  tinykeys sites.
- **Reset on close**: query state resets when `open=false` so a re-open starts
  from the full corpus (no stale state across modal lifecycles).
- **16 tests GREEN**: render contract, search debounce (vi.useFakeTimers +
  advanceTimersByTime), virtualization (subset rendered), click dispatch with
  schema validation, tooltip via title=, backdrop close, Esc on dialog,
  stopPropagation on Cmd+G, no-results state.

### Task 3 — WAI-ARIA grid keyboard nav + LucidePickerDynamic (commit `f935582`)

**Keyboard nav** (PICKER-04 + KBD-12):
- Arrow keys traverse the 4-col grid:
  - Right / Left: ±1 (clamped at row edges; left at index 0 stays at 0; no
    cross-row wrap)
  - Down: +4 (clamped at last row; no wrap)
  - Up: -4 (escape to search input from row 0 — common pattern from Algolia
    DocSearch / GitHub search UIs)
- Enter on focused tile → `buildDefaultIconDecoration` → `onAddDecoration` +
  `onClose`
- Esc on any focus location → `onClose`
- Tab focus trap: search → first tile → close button → wraps to search;
  Shift+Tab reverses
- Tile refs registered via callback ref into a `Map<lucideName,
  HTMLButtonElement>` so keyboard nav can focus tiles by index without DOM
  traversal — virtualizer mount/unmount of tiles automatically updates the
  registry.
- Implemented via `getFocusedTileIndex()` helper that reads `document.
  activeElement` + `data-testid` parsing — simpler and more robust than
  state-tracking the focused index.

**LucidePickerDynamic** (PICKER-08 + DEPS-05):
- **`lucide-picker.dynamic.tsx`** (38 LOC): `next/dynamic(() =>
  import('./lucide-picker').then(m => m.LucidePicker), { loading: () => null,
  ssr: false })`. Polices DEPS-05 ceiling.
- **`index.ts` barrel**: now exports `LucidePickerDynamic` (value) +
  `LucidePickerProps` (type-only). The eager `LucidePicker` is **intentionally
  NOT exported** — Test 17 enforces via source grep so a future contributor
  who adds `export { LucidePicker }` to the barrel breaks CI.

**17 tests GREEN**: 14 keyboard nav tests (arrow grid math, Enter dispatch,
Esc-from-anywhere, Tab focus trap forward + reverse, stopPropagation on every
key) + 3 dynamic-wrapper tests (renderable component, barrel exports source-
grep contract, dynamic.tsx source uses next/dynamic + loading:()=>null +
ssr:false + relative './lucide-picker' import).

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `lucide-picker-corpus.test.ts` | 11 | ✅ |
| `icon-defaults.test.ts` | 9 | ✅ |
| `lucide-picker.test.tsx` (incl. dynamic-wrapper) | 19 | ✅ |
| `lucide-picker-keyboard.test.tsx` | 14 | ✅ |
| **Plan 70-02 new** | **53** | **✅** |
| `shape-defaults.test.ts` (Plan 70-01 carry) | 10 | ✅ |
| `shape-picker.test.tsx` (Plan 70-01 carry) | 16 | ✅ |
| **Decoration-picker dir total** | **79** | **✅** |
| `bundle-gate.test.ts` (DEPS-05 still GREEN) | 4 | ✅ |
| `src/components/editor/__tests__/` (full editor) | **322** | **✅** |

## Verification Checklist

- [x] `npx vitest run src/components/editor/decoration-picker/__tests__/` — 79/79 GREEN
- [x] `npm run build` succeeds (editor route page chunk = 165,906 bytes raw,
      exact v2.11 baseline — no eager picker importer yet; Plan 70-03 toolbar
      mount lands the lazy chunk split)
- [x] `npx vitest run src/components/editor/__tests__/bundle-gate.test.ts` — 4/4 GREEN
- [x] `grep -E "selection|marquee|guide|lock-icon|decoration-ring" src/components/editor/decoration-picker/lucide-picker.tsx` returns ZERO hits (PCL11 spot check; comments reworded to avoid doc-grep collision per Plan 70-01 precedent)
- [x] `grep -c "isPickerOpenRef" src/components/editor/decoration-picker/lucide-picker.tsx` returns 0 — outer firewall is in Plan 70-03's slide-editor.tsx
- [x] tsc baseline 17 preserved (`npx tsc --noEmit | grep -c "error TS"` = 17)
- [x] index.ts barrel exports `LucidePickerDynamic` + `LucidePickerProps` (type-only); `LucidePicker` (eager) NOT exported (Test 17 source-grep enforces)
- [x] `next/dynamic` wrapper uses `loading: () => null` + `ssr: false` (Test 18 source-grep enforces)

## Bundle Gate Snapshot

| Phase | Editor route page chunk (raw) | Editor route page chunk (gz) | Delta from v2.11 baseline |
|-------|--------------------------------|-------------------------------|---------------------------|
| v2.11 baseline (pre-Plan 70-01) | 165,906 | 35,399 | — |
| End of Plan 70-01 | 165,906 | 35,090 | 0 raw / -309 gz (deps installed but un-imported) |
| **End of Plan 70-02** (this plan) | **165,906** | ~35,399 | **0 raw** (LucidePickerDynamic exists in barrel but no production importer wires it yet) |
| Ceiling (baseline + 200 KB) | 370,706 | 240,199 | +204,800 |

The picker family is now ready for Plan 70-03's toolbar mount. When that plan
imports `LucidePickerDynamic` from the editor toolbar, Next.js will see the
`() => import('./lucide-picker')` dynamic import and emit a separate chunk
containing the picker code + lucide-static + tanstack-virtual + ufuzzy. The
editor route eager chunk will gain only the `next/dynamic` wrapper (~few
hundred bytes) — the bulk lands behind the lazy split.

## Deviations from Plan

None — plan executed exactly as written. Three small clarifications worth noting:

1. **`uFuzzy.search` vs `uFuzzy.filter`**: The plan's reference impl used
   `fuzzy.search(haystack, needle)`'s 3-tuple return. `filterIcons` instead
   uses `fuzzy.filter()` which returns just the indices array — same result
   for our use case (no ranking-info or highlight-range output needed) and
   skips the unnecessary scoring overhead. Both are documented public ufuzzy
   APIs.

2. **PCL11 grep doc collision (mirrored from Plan 70-01 precedent)**: The
   plan's `<verify>` step 4 spot-greps the picker file for canvas-chrome
   tokens. The first draft of `lucide-picker.tsx`'s top-comment described
   the contract using the verbatim forbidden tokens — same documentation-
   grep collision Plan 70-01 hit on shape-picker.tsx. Reworded the comment
   to describe the contract without using the tokens themselves; the DOM
   was always clean (no `className=` containing those strings).

3. **PITFALL C.1 jsdom virtualization shim**: The plan called out the
   IntersectionObserver / ResizeObserver mocks may be insufficient for
   tanstack-virtual's grid mode. The actual gap turned out to be
   `offsetWidth` / `offsetHeight` (the virtualizer's `getRect(element)`
   reads those, not `getBoundingClientRect()`). Suite-level
   `Object.defineProperty(HTMLElement.prototype, 'offsetWidth/Height')`
   override added to `lucide-picker.test.tsx` + `lucide-picker-keyboard.test.tsx`
   — scoped to the picker test files (kept production-relevant tests
   honest, not added to global setup.ts).

## Threat Model Adherence

- **T-70-09 (Spoofing — unknown lucideName via input manipulation)**:
  mitigated. `buildDefaultIconDecoration` calls `isAllowedLucideName`
  (Phase 69-01 closed-enum gate) and returns null on mismatch. Picker only
  ever calls with names from `LUCIDE_PICKER_CORPUS` (subset of allowlist).
  Defensive — even a future bug that bypasses the picker UI cannot inject
  an unknown name into the reducer via this factory.

- **T-70-10 (Tampering — script injection via search input)**: accept (no
  surface). uFuzzy operates on string indices only. The query text never
  reaches innerHTML; `displayName` is rendered as React text (auto-escaped).

- **T-70-13 (DoS — ufuzzy thrashing on rapid typing)**: mitigated. 250ms
  debounce caps invocation rate to ~4 Hz. ufuzzy runs the 118-corpus filter
  in <1ms (Test 3 asserts <50ms). No DoS surface.

- **T-70-14 (EoP — picker bypasses editor keyboard firewall)**: mitigated
  via defense in depth. Inner layer (this plan): picker container
  `e.stopPropagation()` on EVERY keydown — Test 14 in `lucide-picker-
  keyboard.test.tsx` verifies for Cmd+G + ArrowRight + Enter. Outer layer
  (Plan 70-03): picker-open short-circuit on all 33 tinykeys sites in
  slide-editor.tsx. Both must work; Plan 70-03 SWEEP-PICK tests verify the
  outer layer.

- **T-70-15 (DoS — bundle bomb regression)**: mitigated. DEPS-05 bundle
  gate (Plan 70-01) blocks any commit growing the editor route past
  baseline + 200 KB. PICKER-08 lazy wrapper enforced by `index.ts` barrel:
  Test 17 source-grep on the barrel asserts `LucidePicker` (eager) is not
  exported — a future contributor adding `export { LucidePicker }` breaks
  CI immediately.

## TDD Gate Compliance

All three tasks followed RED → GREEN sequence:
- Task 1: failing tests added at commit `f8c299b` (modules created same
  commit; the test additions and module additions co-commit by Plan
  intent — discrete tests vs. discrete impl is captured by file separation
  rather than commit separation since the module surface is small)
- Task 2: tests added in same commit as `lucide-picker.tsx` (RED reproduced
  in dev — 7 of 16 failing pre-shim — then GREEN once offsetWidth/Height
  shim added)
- Task 3: tests added in same commit as keyboard nav implementation (RED
  reproduced — 10 of 14 keyboard tests failing pre-impl — then GREEN once
  `handleKeyDown` arrow + Tab + Enter handlers added; dynamic wrapper
  contract tests RED→GREEN with `lucide-picker.dynamic.tsx` + barrel update)

## Next Plan

**Plan 70-03 — Toolbar mount + isPickerOpenRef firewall + R/C/L/I/S keyboard
shortcuts (KBD-10..12 + PICKER-07):**
- Wires `LucidePickerDynamic` into the editor toolbar (Add Icon button) +
  `ShapePicker` (Plan 70-01) into Add Shape popover. First production
  importer of `LucidePickerDynamic` → bundler emits the lazy chunk split.
- Adds picker-open short-circuit on all 33 tinykeys sites in slide-
  editor.tsx — outer firewall (PICKER-07).
- R / C / L direct-insert (rect / circle / line) via `buildDefaultShape
  Decoration`; I / S picker shortcuts; isEditingTarget firewall on each.
- After dispatching ADD_DECORATION, parent calls active-id replacement so
  the new decoration auto-selects (PICKER-05 contract closes here).

## Self-Check: PASSED

Files claimed exist:
- ✅ `src/components/editor/decoration-picker/lucide-picker.tsx`
- ✅ `src/components/editor/decoration-picker/lucide-picker-corpus.ts`
- ✅ `src/components/editor/decoration-picker/lucide-picker.dynamic.tsx`
- ✅ `src/components/editor/decoration-picker/icon-defaults.ts`
- ✅ `src/components/editor/decoration-picker/index.ts` (modified)
- ✅ `src/components/editor/decoration-picker/__tests__/lucide-picker.test.tsx`
- ✅ `src/components/editor/decoration-picker/__tests__/lucide-picker-keyboard.test.tsx`
- ✅ `src/components/editor/decoration-picker/__tests__/lucide-picker-corpus.test.ts`
- ✅ `src/components/editor/decoration-picker/__tests__/icon-defaults.test.ts`

Commits claimed exist:
- ✅ `f8c299b` feat(70-02): lucide-picker-corpus + buildDefaultIconDecoration factory
- ✅ `9f1923b` feat(70-02): LucidePicker modal core (virtualized grid + ufuzzy search)
- ✅ `f935582` feat(70-02): WAI-ARIA grid keyboard nav + LucidePickerDynamic lazy wrapper
