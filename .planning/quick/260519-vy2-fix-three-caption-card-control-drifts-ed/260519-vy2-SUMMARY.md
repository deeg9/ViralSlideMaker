---
phase: 260519-vy2
plan: 01
status: complete
date: 2026-05-19
duration_minutes: 4
commits:
  - 2c15db1  # fix(quick-260519-vy2): mirror resolveCaptionBar in right-panel controls
  - fd52d97  # test(quick-260519-vy2): cover the four caption-card drift scenarios
files_modified:
  - src/components/editor/slide-background-controls.tsx
  - src/components/editor/__tests__/slide-background-controls.test.tsx
test_delta: +7  # 26 → 33 in slide-background-controls.test.tsx
typecheck: clean
renderer_touched: false
requirements_completed:
  - VY2-01  # Right-panel controls reflect resolved render state (parity with resolveCaptionBar)
---

# Quick Task 260519-vy2 — Fix Three Caption-Card Control Drifts (Right Panel)

## One-liner

Mirrored the canonical `resolveCaptionBar` resolver in the editor right-panel so the Edge blend toggle, Height slider, and Opacity slider read the RESOLVED render state — fixing the three drifts that left them showing `0 / 38 / 85%` on an unedited news-oracle / chrome-pulse slide that actually rendered `15 / 42 / 80%`.

## Problem

The renderer (`resolveCaptionBar` in `src/lib/render/resolve-overlay.ts`) already honored `template.captionCardDefaults` (added in quick-260519-cdf). The right-panel control card did not — it only consulted `slide.style_overrides`. Result: on an unedited news-oracle / chrome-pulse slide the canvas + Satori PNG + HTML export all painted a caption card with `heightPct: 42 / blendPct: 15 / opacity: 0.80`, but the right-panel sliders showed `38 / 0 / 85%` and the Edge blend toggle read OFF — a 3-way drift between panel ↔ resolver ↔ renderer that confused the editor UX.

The master `Caption card` toggle was already correct (it routed through `resolveCaptionBar` from quick-260518-8o0). The fix extends the same pattern to the other three derived values.

## What changed

### 1. `src/components/editor/slide-background-controls.tsx` — four derivations now route through the resolver

| Derivation | Before | After |
| ---------- | ------ | ----- |
| `captionPanelOn` (master toggle) | `resolveCaptionBar(...).enabled` ✓ (already correct) | `resolvedBar.enabled` (reuses single call) |
| `heightPct` (Height slider) | `o.caption_bar_height_pct ?? 38` (constant) | `resolvedBar.heightPct` |
| `blendPct` (Edge blend toggle + amount) | `o.caption_bar_blend_pct ?? 0` (constant) | `resolvedBar.blendPct` |
| `opacityPct` (Opacity slider) | `o.caption_bar_opacity ?? 0.85` | `o.caption_bar_opacity ?? template.captionCardDefaults?.opacity ?? 0.85` |

The `opacityPct` derivation does NOT route through `resolvedBar` — `resolvedBar.backgroundColor` is an `rgba(...)` string that bakes alpha into a single channel, and parsing it back is fragile. Instead the opacity gets its own fallback chain that mirrors the resolver's logic for that single dimension.

### 2. Removed `DEFAULT_CAPTION_BLEND` constant

Now-unused after `blendPct` flows through `resolvedBar.blendPct`. Kept:
- `DEFAULT_CAPTION_HEIGHT = 38` — still consumed by `snap()` at line ~226 (snap geometry is intentionally NOT mirrored — would change snap behavior on a news-oracle slide, out of scope).
- `DEFAULT_CAPTION_OPACITY = 0.85` — still consumed in the opacity fallback chain.

### 3. Renderer untouched

`src/lib/render/resolve-overlay.ts`, `src/lib/render/templates/*.ts`, `src/components/editor/slide-preview.tsx`, `src/lib/render/render-slide.ts`, and `src/lib/render/render-slide-satori.tsx` are byte-identical to the base commit. The panel mirrors the resolver — never the other way around. Confirmed by `git diff --name-only 451ec14..HEAD -- src/lib/render/ src/components/editor/slide-preview.tsx` returning empty.

## Tests added

Appended a `describe('quick-260519-vy2 — captionCardDefaults drift fix', ...)` block to `src/components/editor/__tests__/slide-background-controls.test.tsx` with a synthetic `tmplWithDefaults()` helper (shape `{heightPct:42, blendPct:15, opacity:0.80}` — same as real news-oracle and chrome-pulse, confirmed by `grep -E 'heightPct: 42' src/lib/render/templates/news-oracle.ts src/lib/render/templates/chrome-pulse.ts` returning 2 matches).

**+7 new tests (26 → 33), all green:**

- **A. NO captionCardDefaults, no overrides** (2 tests):
  - `caption-card-toggle` reads OFF on a non-news slide.
  - Master toggle ON → Height=38, Opacity=85, Edge blend OFF, blend-amount NOT in DOM.

- **B. Template WITH `{42, 15, 0.80}`, no overrides** (1 test, but asserts 5 derived values at once):
  - Toggle ON, Height=42, Opacity=80, Edge blend ON, blend-amount=15.

- **C. Per-slide overrides WIN over template defaults** (3 tests):
  - Explicit `caption_bar_height_pct: 50` → slider reads 50 (beats template 42).
  - Explicit `caption_bar_opacity: 0.90` → slider reads 90 (beats template 0.80).
  - Explicit `caption_bar_blend_pct: 0` → blend toggle reads OFF, amount NOT in DOM (the explicit 0 does NOT fall through to template 15 — locked resolver semantics).

- **D. Master-toggle regression** (1 test):
  - `highlight-bar` (no captionCardDefaults) + `style_overrides.layout: 'cover'` → master toggle reads ON (existing quick-260518-8o0 behavior preserved by routing through the same `resolveCaptionBar` call).

The pre-existing 26 tests are unchanged and still pass — the test fixture in those uses `getTemplate('highlight-bar')` which has no `captionCardDefaults`, so the source change is byte-identical for that suite.

## Verification

```
$ npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E 'slide-background-controls' | head -20
(empty — no errors in either file)

$ npx vitest run src/components/editor/__tests__/slide-background-controls.test.tsx 2>&1 | tail -10
 Test Files  1 passed (1)
      Tests  33 passed (33)
   Duration  786ms

$ git log --oneline -5
fd52d97 test(quick-260519-vy2): cover the four caption-card drift scenarios
2c15db1 fix(quick-260519-vy2): mirror resolveCaptionBar in right-panel controls
451ec14 docs(quick-260519-vy2): pre-dispatch plan for caption-card control drift fix
87ebc74 fix(quick-260519-bgr): sunset-tabloid + soft-sage at oracle scale
817cb99 fix(quick-260519-bgr): chrome-pulse headlines at oracle scale

$ git diff --name-only 451ec14..HEAD
src/components/editor/__tests__/slide-background-controls.test.tsx
src/components/editor/slide-background-controls.tsx

$ git diff --name-only 451ec14..HEAD -- src/lib/render/ src/components/editor/slide-preview.tsx
(empty — renderer + canvas untouched)
```

### Smoke greps (Task 1)

| Grep | Expected | Got |
| ---- | -------- | --- |
| `grep -n 'DEFAULT_CAPTION_BLEND' src/components/editor/slide-background-controls.tsx \| wc -l` | 0 | 0 |
| `grep -cE '^\s*const resolvedBar =' src/components/editor/slide-background-controls.tsx` | 1 | 1 |
| `grep -cE 'template\.captionCardDefaults\?\.opacity' src/components/editor/slide-background-controls.tsx` | 1 | 1 |
| `grep -cE 'resolvedBar\.(heightPct\|blendPct\|enabled)' src/components/editor/slide-background-controls.tsx` | 3 | 3 |

### Sanity greps (Task 2)

| Grep | Expected | Got |
| ---- | -------- | --- |
| `grep -cE 'quick-260519-vy2' src/components/editor/__tests__/slide-background-controls.test.tsx` | ≥1 | 1 |
| `grep -cE 'tmplWithDefaults' src/components/editor/__tests__/slide-background-controls.test.tsx` | ≥5 | 5 |

## Success criteria — all green

- [x] Panel and renderer agree on `enabled / heightPct / blendPct / opacity` for every (template, style_overrides) pair (verified by scenarios A/B/C/D).
- [x] On an unedited news-oracle or chrome-pulse slide: Edge blend toggle ON, amount=15, Height=42, Opacity=80% (asserted by Scenario B against the same `{42,15,0.80}` shape both templates ship).
- [x] Per-slide overrides still win — explicit 0 blend keeps blend OFF; explicit 50 height keeps height=50; explicit 0.90 opacity keeps opacity=90% (Scenario C).
- [x] Renderer (`resolveCaptionBar`) and all three render paths NOT modified — `git diff --name-only` shows only the two panel files.
- [x] All existing 26 tests still pass; 7 new tests added under the `quick-260519-vy2` describe block all pass.
- [x] TypeScript clean — no new `tsc --noEmit` errors in either file.
- [x] `DEFAULT_CAPTION_BLEND` removed; `DEFAULT_CAPTION_HEIGHT` + `DEFAULT_CAPTION_OPACITY` retained (still referenced by `snap()` and the opacity fallback).

## Deviations from plan

None — the plan executed exactly as written. Both tasks ran on the first attempt; no Rule 1/2/3 auto-fixes were needed.

## Deferred items / known stubs

None. The four caption-card panel derivations now agree with the resolver across every code template that ships `captionCardDefaults` (currently news-oracle and chrome-pulse — both `{42,15,0.80}`); future templates adding `captionCardDefaults` will inherit the correct panel display automatically because the panel reads from the resolver, not from any per-template branching.

## Self-Check: PASSED

- File exists: `src/components/editor/slide-background-controls.tsx` ✓
- File exists: `src/components/editor/__tests__/slide-background-controls.test.tsx` ✓
- Commit `2c15db1` (Task 1) — found in `git log` ✓
- Commit `fd52d97` (Task 2) — found in `git log` ✓
- vitest: 33/33 passing on target file ✓
- tsc: no errors in either file ✓
- renderer untouched: empty diff against `src/lib/render/` and `slide-preview.tsx` ✓
