# quick-260517-k2n — FIX Pass Summary

Post-verification test-alignment pass. Quick task 260517-k2n reworked the
caption card into an opt-in draggable overlay; the executor missed updating
several test files, leaving the render + components suites red. This FIX pass
realigns those tests to the NEW shipped behavior — no runtime source changed.

**Commit:** `fceb8f6` — `test(quick-260517-k2n-fix): align render/component
tests with caption-card rework`

## The shipped behavior being asserted

1. Render testid renamed: `data-testid="bottom-card"` → `data-testid="caption-card"`.
2. The caption card is OPT-IN: it renders ONLY when
   `style_overrides.caption_bar_enabled === true` (via `resolveCaptionBar(...).enabled`).
   The previously always-on bottom card for `image-with-bottom-card` templates
   (`magazine-bold`, `tr3nding-news`) is gone by design.
3. The reworked caption-card div has NO `padding` (the retired bottom-card
   chrome had `padding: 80`). Geometry with default overrides: `top: 1190`
   (62% of 1920), `height: 730` (38%), `width: 1080`, `flexDirection: 'column'`,
   `backgroundColor` from `bottomCardBackground(template.backgroundColor)`.

## Before / after failure counts

Scope = `npx vitest run src/__tests__/render src/__tests__/components`
(13 test files, 112 tests).

| State                       | Failures | k2n-attributable | pre-existing |
| --------------------------- | -------- | ---------------- | ------------ |
| Before FIX (at base 513d0b1)| 23       | 16               | 7            |
| After FIX                   | 7        | 0                | 7            |

All 16 k2n-attributable failures fixed. The 7 remaining are pre-existing
baseline failures verified against clean base `513d0b1` — see
`k2n-fix-deferred.md`.

## Test files changed (5) — why

### `src/__tests__/render/per-slide-template-override.test.tsx`
3 hard-assertion failures (`[data-testid="bottom-card"]` queries returned null).
- Renamed all `bottom-card` testid queries → `caption-card`.
- `findBottomCardNode` → `findCaptionCardNode`: matches the new caption-card
  layer (drops the `padding === 80` check, adds `flexDirection === 'column'` +
  `height === 730` + `width === 1080`).
- `slideWithOverride` fixture gains `style_overrides: { caption_bar_enabled: true }`
  so the caption card renders. `slideWithoutOverride` deliberately left without
  the flag — the TPLREND-05 byte-identity gate (Tests 2 & 4) still asserts NO
  caption card. Test intent preserved: "override honored → card visible;
  no override → no card."

### `src/__tests__/render/premium-templates.test.tsx`
2 snapshot mismatches + `expect(bottomCardNode).toBeDefined()` failures.
- `magazine-bold` + `tr3nding-news` fixtures gain
  `style_overrides: { caption_bar_enabled: true }`. Both templates have
  `backgroundColor: '#000000'`, so `resolveCaptionBar` yields the same
  `rgba(0, 0, 0, 0.85)` fill the retired bottom-card used — the existing
  geometry detection (`height === 730`, `top === 1190`) still matches.
- `documentary` test retitled (NO bottom-card → NO caption-card); its fixture
  has no enable flag, so the NO-card assertion still holds.
- Local var `bottomCardNode` → `captionCardNode`; `it()` titles updated.

### `src/__tests__/render/render-slide-satori.test.tsx`
1 k2n hard-assertion failure (Test 3: `bottomCard` required `padding === 80`).
- Test 3 fixture gains `style_overrides: { caption_bar_enabled: true }`.
- Assertion `bottomCard` → `captionCard`: drops `padding === 80`, adds
  `flexDirection === 'column'`. Test retitled "...+ tint + caption card".
- Test 10 (mutex) comment clarified — its `toBeUndefined()` assertion already
  held (no enable flag + `height === '38%'` legacy check matches nothing).
  Other failures in this file were pure o75 snapshot drift (see snapshots
  section).

### `src/__tests__/components/premium-templates-preview.test.tsx`
1 failure (`screen.getByTestId('bottom-card')` threw).
- `magazine-bold` caption-card test: fixture gains `caption_bar_enabled: true`,
  testid `bottom-card` → `caption-card`, retitled.
- `documentary` NO-card test: testid query → `caption-card`, retitled.

### `src/__tests__/components/slide-preview-overlays.test.tsx`
1 failure (`screen.getByTestId('bottom-card')` threw).
- `image-with-bottom-card` card test: uses a per-test `slideWithCaption`
  variant with `caption_bar_enabled: true` (the shared module-scope
  `fixtureSlide` was NOT mutated — that would break the legacy test), testid
  → `caption-card`, retitled.
- Legacy test: testid query `bottom-card` → `caption-card`, retitled.

## Snapshots regenerated (2)

`vitest -u` was run scoped to the two genuinely-k2n-affected `.snap` files.
Each diff was eyeballed.

### `src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap`
- `magazine-bold` + `documentary` snapshot keys renamed (test titles changed).
- `padding: 80` removed ×2 — k2n caption-card has no padding.
- `textTransform: "uppercase"` removed ×2 — PRE-EXISTING quick-260515-o75
  hook-casing drift, co-located in the same snapshots, swept along (it cannot
  be excluded — o75 should have regenerated this file and did not).

### `src/__tests__/render/__snapshots__/render-slide-satori.test.tsx.snap`
- `image-with-bottom-card-no-overlays` (Test 3) key renamed; its card div
  retained but `padding: 80` dropped — now the caption-card layer.
- Bottom-card div fully removed from `mutex-news-layout-wins`,
  `image-with-bottom-card-with-overlays`, `overlay-slide-field-topic` — those
  fixtures set `backgroundMode: image-with-bottom-card` but no
  `caption_bar_enabled`, so the always-on card is correctly gone (k2n).
- `textTransform: "uppercase"` removed ×9 — PRE-EXISTING o75 drift, swept along.

### NOT regenerated (deliberate)
`src/__tests__/render/__snapshots__/legacy-templates-regression.test.tsx.snap`
— its only drift is the o75 `textTransform` change; ZERO k2n content. Reverted
and left stale per scope. Its 4 failing tests are recorded in
`k2n-fix-deferred.md`.

## Verification

| Gate                                                       | Result                          |
| ---------------------------------------------------------- | ------------------------------- |
| `vitest run src/__tests__/render src/__tests__/components`  | 0 k2n failures (7 pre-existing) |
| `npx tsc --noEmit`                                          | 19 errors — baseline, 0 new     |
| `npm run lint:gates`                                        | PASS                            |

No `src/**` runtime source file was modified — test-alignment only. No genuine
runtime bug was found.

## Deferred

See `k2n-fix-deferred.md`: 4 stale o75 hook-casing snapshot failures in
`legacy-templates-regression.test.tsx` + 3 pre-existing baseline failures
(`slide-preview.test.tsx`, `template-picker.test.tsx`,
`legacy-templates-byte-identical.test.ts`) + the 19-error tsc baseline. All
verified to fail identically at clean base `513d0b1`.
