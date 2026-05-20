---
slug: 260519-cdf-news-oracle-caption-card-defaults
type: quick
date: 2026-05-19
status: complete
---

# news-oracle caption-card defaults — SUMMARY

## Changes

1. **`SlideTemplate` interface** (`src/lib/render/templates/index.ts`): added optional `captionCardDefaults?: { heightPct?, blendPct?, opacity? }`. Per-template caption-card baseline. Legacy templates leaving this undefined behave byte-identically.

2. **`news-oracle` template** (`src/lib/render/templates/news-oracle.ts`): set `captionCardDefaults: { heightPct: 42, blendPct: 15, opacity: 0.80 }` — the user-validated geometry.

3. **`resolveCaptionBar`** (`src/lib/render/resolve-overlay.ts`):
   - `heightPct` falls back to `template.captionCardDefaults?.heightPct ?? CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT`.
   - `blendPct` falls back to `template.captionCardDefaults?.blendPct ?? 0`.
   - Background: when a template ships `captionCardDefaults.opacity` AND the slide has no `caption_bar_color`/`caption_bar_opacity` override, routes through `hexToRgba(template.backgroundColor, defaults.opacity)`. Templates without defaults still use `bottomCardBackground(...)` verbatim (legacy parity preserved).
   - User-explicit `caption_bar_*` keys still win over template defaults (verified).

## Verification

Direct tsx eval of `resolveCaptionBar`:

- `({}, newsOracle, true)` → `{ heightPct: 42, blendPct: 15, backgroundColor: 'rgba(10, 10, 10, 0.8)', y: 58 }` ✓
- `({}, magazineBold, false)` → `{ heightPct: 38, blendPct: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', y: 62 }` — byte-identical to pre-cdf ✓
- `({ caption_bar_enabled: true, caption_bar_height_pct: 30 }, newsOracle, true)` → `{ heightPct: 30, blendPct: 15, backgroundColor: 'rgba(10, 10, 10, 0.8)' }` — user override wins on height, template defaults still apply for blend + opacity ✓

Test suites: `caption-bar-overrides.test.ts` (10 tests) + `legacy-templates-byte-identical.test.ts` (8 tests) all green — 18 passed.

## Out of scope

- BREAKING NEWS badge — next quick task (`260519-bkn`).
- news-cyan / news-drop — they keep current defaults per user.
- Migration of existing news-oracle slides: any saved slide without explicit `caption_bar_*` keys (the common case) picks up the new defaults on next load. That IS the desired retroactive behavior.
