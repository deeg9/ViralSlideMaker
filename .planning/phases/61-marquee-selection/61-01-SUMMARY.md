---
phase: 61-marquee-selection
plan: 01
subsystem: ui
tags: [marquee, selection, geometry, pure-helpers, selecto, tdd]

# Dependency graph
requires:
  - phase: 60-multi-select-foundation-watermark-schema-lift
    provides: |
      selection model (use-selection-model.ts), modifier-state hook
      (use-modifier-state.ts), click-empty-canvas seam in
      slide-preview.tsx, selection-bounds pure helper pattern,
      MultiSelectTypeBar test pattern
provides:
  - normalizeRect(x0,y0,x1,y1) pure helper (canonicalizes rect from any 2 points)
  - elementsInRect(slide, rect) pure helper (Figma intersect mode, hitRate=0)
  - MarqueeOverlay render-only React component (data-testid="marquee-overlay")
  - selecto@1.26.3 dependency installed and importable
affects:
  - 61-02 (wires selecto handlers + onPointerDown swap + parity test extension)
  - 62 (group ops triggered from N>=2 marquee selections)
  - 63 (alignment will replace 1-px-strip TextBox-height approximation)

# Tech tracking
tech-stack:
  added: [selecto@1.26.3]
  patterns:
    - "Pure transforms in src/lib/editor/transforms/ (no React, no DOM)"
    - "Render-only components owning zero state — consumer wires events + props"
    - "Static-grep purity tests on pure-module source files"
    - "TDD per task: test (RED) commit -> impl (GREEN) commit"

key-files:
  created:
    - src/lib/editor/transforms/normalize-rect.ts
    - src/lib/editor/transforms/element-rect-intersect.ts
    - src/components/editor/marquee-overlay.tsx
    - src/lib/editor/__tests__/normalize-rect.test.ts
    - src/lib/editor/__tests__/element-rect-intersect.test.ts
    - src/components/editor/__tests__/marquee-overlay.test.tsx
    - .planning/phases/61-marquee-selection/deferred-items.md
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "TextBox custom-anchor height uses 1-px-strip approximation (h=1) — DOM ref unavailable in pure module; Phase 63 alignment will lift via shared height resolver"
  - "Selecto pinned to exact 1.26.3 (not ^1.26.3) — matches tinykeys pattern, locks supply chain"
  - "MarqueeOverlay owns NO state — Plan 61-02 owns selecto handlers + rect prop"
  - "Watermark + structural-anchor TextBoxes skipped (mirrors Plan 60-05 conservative scope)"
  - "Locked elements INCLUDED in Phase 61 marquee (Phase 64 ships locked semantics later; no UX consequence yet)"

patterns-established:
  - "Pure transforms in src/lib/editor/transforms/ with header comment naming the contract + skipped-elements rationale"
  - "Test 8/13 grep-purity invariant: readFileSync + 3 regex assertions (no react import, no use-client directive, no document/window access)"
  - "Render-only components carry 'use client' + data-testid + receive nullable shape prop; null prop returns null"

requirements-completed: [SEL-14]

# Metrics
duration: ~12min
completed: 2026-05-02
---

# Phase 61 Plan 01: Marquee Selection — Pure Helpers + Selecto + MarqueeOverlay Summary

**Pure rect-normalization + AABB-intersect helpers + render-only MarqueeOverlay component, plus selecto@1.26.3 install — Wave-1 foundation for Plan 61-02 to wire selecto event handlers and the canvas-root onPointerDown swap.**

## Performance

- **Duration:** ~12 min (single-pass, no rework)
- **Started:** 2026-05-03T02:21:09Z
- **Completed:** 2026-05-03T02:25:18Z
- **Tasks:** 3 (all TDD-eligible)
- **Files created:** 7 (3 source, 3 test, 1 deferred-items log)
- **Files modified:** 2 (package.json, package-lock.json)

## Accomplishments

- `normalizeRect(x0, y0, x1, y1)` pure helper handles all 4 drag directions + degenerate cases (zero-area, zero-width, negative coords). 8/8 tests passing. Closes SEL-14 end-to-end.
- `elementsInRect(slide, rect)` pure helper implements Figma intersect mode (hitRate=0). Walks `text_boxes` (only `role==='custom'` with `anchor==='custom'`) + `custom_images`; skips watermark + structural-anchor TextBoxes per Plan 60-05 conservative scope. Source-order traversal. 14/14 tests passing — including the 1px hit-rate assertion.
- `MarqueeOverlay` render-only React component renders a single absolute-positioned `<div>` with dashed cyan border + translucent fill + `pointer-events: none` (PITFALLS Cat-2.5 — clicks pass through). Owns NO state. 7/7 tests passing.
- `selecto@1.26.3` installed at exact pin (no caret) — verified importable via `node -e "require('selecto')"` and confirmed callable constructor in dynamic-import test.
- All three pure modules pass the static-grep purity invariant (zero matches for react / 'use client' / document / window).
- Phase 60 regression suite (`selection-bounds.test.ts` + `parity.test.tsx`) still 31/31 green.
- TypeScript baseline maintained: 17 pre-existing errors, no new errors introduced.

## Task Commits

Each task followed TDD (RED test commit → GREEN implementation commit):

1. **Task 1: normalizeRect (RED)** — `66513d6` (test)
2. **Task 1: normalizeRect (GREEN)** — `7db9555` (feat)
3. **Task 2: elementsInRect (RED)** — `099eda0` (test)
4. **Task 2: elementsInRect (GREEN)** — `9c9caa3` (feat)
5. **Task 3: selecto@1.26.3 install** — `61c65c7` (chore)
6. **Task 3: MarqueeOverlay (RED)** — `7bce1e3` (test)
7. **Task 3: MarqueeOverlay (GREEN)** — `cae384f` (feat)

7 atomic commits total (plan called out 6 — the +1 is the dedicated `chore` commit for the selecto install, which the plan describes as Step A of Task 3 separate from the RED + GREEN commits).

## Files Created/Modified

### Created
- `src/lib/editor/transforms/normalize-rect.ts` (34 LOC) — `normalizeRect(x0,y0,x1,y1) → {x,y,w,h}` canonicalizer; pure module.
- `src/lib/editor/transforms/element-rect-intersect.ts` (92 LOC) — `elementsInRect(slide, rect) → string[]` AABB intersect; pure module.
- `src/components/editor/marquee-overlay.tsx` (54 LOC) — render-only `<MarqueeOverlay rect={…} />` component; `'use client'`.
- `src/lib/editor/__tests__/normalize-rect.test.ts` (88 LOC) — 8 tests (4 directions + 3 degenerate + purity grep).
- `src/lib/editor/__tests__/element-rect-intersect.test.ts` (245 LOC) — 14 tests (intersect mode, watermark/anchor skip, defensive cases, purity grep, hitRate=0).
- `src/components/editor/__tests__/marquee-overlay.test.tsx` (91 LOC) — 7 tests (null-prop, geometry, pointer-events, dashed border, 'use client', selecto importable).
- `.planning/phases/61-marquee-selection/deferred-items.md` — logs out-of-scope housekeeping (stale repo-root PNGs) and the TextBox-height resolver follow-up for Phase 63.

### Modified
- `package.json` — added `"selecto": "1.26.3"` (exact pin) to dependencies.
- `package-lock.json` — selecto + transitive lockfile entries.

## Cross-phase seams set up for Plan 61-02

### `normalizeRect`

```ts
import { normalizeRect, type NormalizedRect } from '@/lib/editor/transforms/normalize-rect'
const rect = normalizeRect(pointerStartX, pointerStartY, pointerCurrentX, pointerCurrentY)
// → { x, y, w, h } with non-negative w, h regardless of drag direction
```

### `elementsInRect`

```ts
import { elementsInRect, type Rect } from '@/lib/editor/transforms/element-rect-intersect'
// CRITICAL — coordinate convention:
// rect.{x, y, w, h} are PERCENTAGES of REF_WIDTH (1080) × REF_HEIGHT (1920),
// matching the same coord space CustomImage and TextBox.position use.
// Plan 61-02 MUST convert selecto's pixel coords to % BEFORE calling this.
const ids: string[] = elementsInRect(slide, rect)
```

### `MarqueeOverlay` props

```tsx
import { MarqueeOverlay, type MarqueeRect } from '@/components/editor/marquee-overlay'
// rect coords are SCALED-CANVAS PIXELS (selecto native), NOT percentages —
// the overlay sits inside the same scale wrapper as elements (PITFALL-5.3).
// Plan 61-02 will use % for hit-testing (elementsInRect) but pass px to the overlay.
<MarqueeOverlay rect={marqueeRect /* MarqueeRect | null */} />
// Renders inside editable={true} branch of slide-preview.tsx (TPLREND-05 / PARITY-01).
// data-testid="marquee-overlay" — Plan 61-02 parity-test fixture asserts this is
// absent under editable={false}.
```

## Decisions Made

- **TextBox custom-anchor height: 1-px-strip approximation.** The schema does not carry an explicit height (text-driven via DOM ref). Pure modules cannot resolve DOM-derived heights, so `elementsInRect` uses `h = 1` for custom-anchor TextBoxes. Documented at the top of `element-rect-intersect.ts`. Phase 63 alignment will lift this into a shared height resolver consumed by both this helper and `selection-bounds.ts`. Logged in `deferred-items.md`.
- **selecto pinned to exact 1.26.3 (no caret).** Matches the existing `tinykeys: "3.0.0"` pin pattern in package.json. Supply-chain mitigation for threat T-61-01-04 (STRIDE-S).
- **MarqueeOverlay owns no state.** Render-only with a nullable `rect` prop. Plan 61-02 places it inside the `editable={true}` branch of `slide-preview.tsx` and owns selecto-event-driven state.
- **Selecto importability tested via `await import('selecto')`.** The dynamic-import path validates the same module-resolution surface the eventual Plan 61-02 wiring will use. Defaulted to `imported.default ?? imported` to handle CJS/ESM interop variance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Purity-grep regex matched comment text in `normalize-rect.ts`**
- **Found during:** Task 1 GREEN run (Test 8 failed despite the implementation being pure)
- **Issue:** The original module header comment said `Pure module — no react, no 'use client', no document/window access`, which the Test 8 grep `/['"]use client['"]/` matched against the comment string itself.
- **Fix:** Rewrote the header comment phrasing to `// Pure module — no React, no use-client directive, no DOM access.` (no embedded quoted directive). Mirrors the prose-style header in `selection-bounds.ts` from Plan 60-05.
- **Files modified:** `src/lib/editor/transforms/normalize-rect.ts`
- **Verification:** Re-ran `npx vitest run src/lib/editor/__tests__/normalize-rect.test.ts` — 8/8 pass. Purity grep on the source returns 0.
- **Committed in:** `7db9555` (the GREEN commit for Task 1; fix happened before the commit was made, so no separate hash).

**2. [Rule 3 — Blocking-adjacent] Documented out-of-scope repo-root PNGs**
- **Found during:** Task 3 self-check (`git status --short`)
- **Issue:** Seven untracked PNGs at the repo root (e.g., `dashboard-after.png`, `editor-numbered-list.png`) predate Phase 61 and are unrelated to the marquee plan.
- **Fix:** Logged to `.planning/phases/61-marquee-selection/deferred-items.md` (item 61-01.D-1) for a future housekeeping pass. NOT committed (per CLAUDE.md scope-boundary rule on out-of-scope discoveries).
- **Files modified:** `.planning/phases/61-marquee-selection/deferred-items.md` (new file)
- **Verification:** PNGs remain untracked; `git status --short` shows them but no other changes.
- **Committed in:** This will be picked up in the final docs commit alongside this SUMMARY.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 housekeeping log)
**Impact on plan:** Both deviations were correctness/process hygiene only. No scope creep; the plan's three tasks shipped exactly as specified.

## Issues Encountered

None — verification gates were straightforward, the TDD cycles were one-shot for both pure helpers and the component, and the selecto install was clean (only npm warned about pre-existing unrelated audit findings — none from selecto itself).

## Verification (verbatim)

```bash
$ npx vitest run src/lib/editor/__tests__/normalize-rect.test.ts \
                src/lib/editor/__tests__/element-rect-intersect.test.ts \
                src/components/editor/__tests__/marquee-overlay.test.tsx
 Test Files  3 passed (3)
      Tests  29 passed (29)

$ npx vitest run src/lib/editor/__tests__/selection-bounds.test.ts \
                src/lib/render/__tests__/parity.test.tsx
 Test Files  2 passed (2)
      Tests  31 passed (31)

$ npx tsc --noEmit 2>&1 | grep -c "error TS"
17  # baseline maintained — no new errors

$ grep -cE "(^|[^a-zA-Z])(react|'use client'|document\.|window\.)" \
    src/lib/editor/transforms/normalize-rect.ts \
    src/lib/editor/transforms/element-rect-intersect.ts
src/lib/editor/transforms/normalize-rect.ts:0
src/lib/editor/transforms/element-rect-intersect.ts:0

$ grep '"selecto":' package.json
    "selecto": "1.26.3",   # exact pin, no caret

$ node -e "require('selecto')"
# (no output, exit 0)
```

## Self-Check: PASSED

- `src/lib/editor/transforms/normalize-rect.ts` — FOUND
- `src/lib/editor/transforms/element-rect-intersect.ts` — FOUND
- `src/components/editor/marquee-overlay.tsx` — FOUND
- `src/lib/editor/__tests__/normalize-rect.test.ts` — FOUND
- `src/lib/editor/__tests__/element-rect-intersect.test.ts` — FOUND
- `src/components/editor/__tests__/marquee-overlay.test.tsx` — FOUND
- Commit `66513d6` (Task 1 RED) — FOUND
- Commit `7db9555` (Task 1 GREEN) — FOUND
- Commit `099eda0` (Task 2 RED) — FOUND
- Commit `9c9caa3` (Task 2 GREEN) — FOUND
- Commit `61c65c7` (Task 3 install) — FOUND
- Commit `7bce1e3` (Task 3 RED) — FOUND
- Commit `cae384f` (Task 3 GREEN) — FOUND

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Plan 61-02 has stable contracts to wire against:
- `normalizeRect` API signature locked + tested across 4 drag directions.
- `elementsInRect` API signature locked + intersect-mode semantics tested (hitRate=0, watermark/anchor skips).
- `MarqueeOverlay` props contract locked + `data-testid="marquee-overlay"` ready for the parity-test fixture extension.
- selecto@1.26.3 installed; Day-1 `setScale` + scaled-canvas verification still owed by Plan 61-02 Task 1.

No blockers. Plan 61-02 should focus on:
1. The canvas-root `onPointerDown` swap on `slide-preview.tsx` (replacing Plan 60-05's `onClick`).
2. selecto instantiation + `setScale` wiring against the existing `transform: scale(...)` wrapper.
3. Pixel→% coord conversion before calling `elementsInRect`.
4. Shift-additive vs replace-with selection dispatch via `useModifierState().get().shift`.
5. Parity-test fixture extension (PARITY-01 with marquee testid).

---
*Phase: 61-marquee-selection*
*Completed: 2026-05-02*
