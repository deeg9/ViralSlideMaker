---
slug: 260519-cdf-news-oracle-caption-card-defaults
type: quick
date: 2026-05-19
---

# news-oracle caption-card defaults (height 42% / blend 15% / opacity 80%)

## Goal

Make `news-oracle` slides default to the user-validated card geometry without requiring per-slide overrides. Today every news-oracle slide starts at the global defaults (heightPct 38, blend 0, opacity 0.85). The user wants 42 / 15 / 0.80 to be the baseline for the template.

## Plan

1. **Add `captionCardDefaults` to the `SlideTemplate` interface** (`src/lib/render/templates/index.ts`):
   ```ts
   captionCardDefaults?: {
     heightPct?: number   // overrides CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT
     blendPct?: number    // overrides the 0 default
     opacity?: number     // overrides the 0.85 default
   }
   ```
   Field is optional; legacy templates leaving it undefined keep their current behavior (zero behavior change for them).

2. **Populate it on `news-oracle`** (`src/lib/render/templates/news-oracle.ts`):
   ```ts
   captionCardDefaults: {
     heightPct: 42,
     blendPct: 15,
     opacity: 0.80,
   }
   ```

3. **Update `resolveCaptionBar`** (`src/lib/render/resolve-overlay.ts`):
   - `heightPct` falls back to `template.captionCardDefaults?.heightPct ?? CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT`.
   - `blendPct` falls back to `template.captionCardDefaults?.blendPct ?? 0`.
   - For background: keep the existing `bottomCardBackground` no-color/no-opacity branch UNCHANGED for templates without defaults. When `captionCardDefaults.opacity` is set AND no user override, compute `hexToRgba(template.backgroundColor, defaults.opacity)`.

4. **Resolver invariants preserved:**
   - User-explicit overrides (`caption_bar_height_pct`, `caption_bar_blend_pct`, `caption_bar_opacity`, `caption_bar_color`) still win over template defaults.
   - Clamps `[10, 90]`, `[0, 50]`, `[0, 100]` still apply.
   - All three render surfaces (slide-preview, render-slide-satori, render-slide) consume the same resolver so TPLREND-05 parity holds.
   - Legacy templates without `captionCardDefaults` behave byte-identically (the no-color/no-opacity branch still uses `bottomCardBackground` verbatim).

## Out of scope

- The BREAKING NEWS badge — separate task (`260519-bkn`).
- Migration of EXISTING news-oracle slides. They have `caption_bar_*` keys absent → on next load the new defaults apply automatically. That IS the desired retroactive behavior.
- Other news templates (news-cyan, news-drop) — keep their current defaults per the user.
- The `CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT` constant — stays, still the global fallback.

## Verification

- Unit test: `resolveCaptionBar({}, newsOracle, true)` returns `heightPct: 42`, `blendPct: 15`, background opacity 0.80 in the rgba string.
- Unit test: `resolveCaptionBar({}, magazineBold, false)` unchanged (still `heightPct: CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT`, `blendPct: 0`, `bottomCardBackground(...)`).
- Manual: open a news-oracle slide → caption card sits taller (42%) with a softer top edge (blend 15) and slightly less coverage (opacity 0.80) — matches the user's screenshot.
- Existing tests: `legacy-templates-byte-identical.test.ts` only checks the 5 legacy ids (none are news-oracle), so the hash fixture is unaffected.
