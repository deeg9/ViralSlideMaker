# Phase 57 Discussion Log

**Mode:** `--auto` (no interactive questions; Claude picks recommended defaults)
**Date:** 2026-04-30
**Phase:** 57 — Editor Controls + Palette Extraction

## Inputs loaded

- `.planning/REQUIREMENTS.md` §EDITOR-01..04 + §PALETTE-01..04 (8 requirements)
- `.planning/ROADMAP.md` §"Phase 57" (5 success criteria)
- `.planning/research/SUMMARY.md` Conflict #4 (vibrant/node timing) + Open Questions §2
- `.planning/phases/56-new-templates-decorative-library/56-VERIFICATION.md` (Phase 56 carry-forward; paletteMode left as 'fixed' for the 2 flips)
- `.planning/phases/55-schema-renderer-extensions/55-CONTEXT.md` (schema fields locked: `original_source_url`, `derived_palette`, `treatment_applied`)
- `.planning/phases/54-infrastructure-foundation/54-VERIFICATION.md` (treat.ts API + 7-day retention pg_cron `cleanup_orphan_treated_backgrounds_daily`)
- `src/lib/photo-treatment/treat.ts` (treatPhoto signature, 4 presets, SHA-256 cache)
- `src/lib/photo-treatment/sharp-config.ts` (sharp.cache(false) + concurrency(1))
- `src/components/editor/text-editor-panel.tsx` (current right-rail composition: LayerStrip → ActiveTextBoxCard → SlideSettings → CustomTextEditor)
- `src/components/editor/slide-canvas.tsx` (canvas wraps SlidePreview; counter pill at bottom)
- `src/app/(dashboard)/project/[id]/editor-actions.ts` (existing actions: saveSlideData, regenerateSlideText, etc.)
- `src/lib/render/templates/editorial-serif.ts` + `notes-app-chic.ts` (currently `paletteMode: 'fixed'`)
- `src/lib/render/resolve-overlay.ts` (renderDecorativeOverlay signature)
- `package.json` (radix-ui/react-switch already a dep — no extra UI dep needed)

## Gray areas analyzed (none escalated to user — `--auto` mode)

| # | Gray area | Auto-resolution | Anchor |
|---|---|---|---|
| 1 | Where does the server action live? | `editor-actions.ts` (co-located with stylize/regenerate per-slide ops) | D-01 |
| 2 | `extractPalette` return shape — named-role object vs. ordered array | Function returns NAMED object; SCHEMA stores ordered array (Phase 55 contract) — bridged by index helpers in resolve-overlay.ts | D-06, D-07 |
| 3 | Grain control — pre-bake (sharp) or render-time (renderGrain helper)? | Render-time per-slide override on top of Phase 56's template.grainMode — fast UX, no sharp roundtrip needed | D-09 |
| 4 | Per-slide grain field placement — schema migration or `style_overrides` JSONB? | New optional key in `style_overrides` blob (no migration; Phase 55 schema-additive pattern) | D-10 |
| 5 | Fast-preview CSS filter for B&W toggle? | NO — explicit ban (D-04). 3s cache-miss-then-hit acceptable per EDITOR-02 | D-04 |
| 6 | Vibrant `null` role fallback strategy | Cascade Vibrant→DarkVibrant→Muted→DarkMuted→LightVibrant→LightMuted; guarantees all 6 keys non-null | D-06 |
| 7 | notes-app-chic palette consumption target — recolor PNG halftone or new SVG? | New parameterized SVG `sticky-note-accent.svg`; resolver helper gains `tintColor?` arg | D-15 |
| 8 | IG grid overlay aspect ratio — 4:5 feed crop or 1:1 grid crop? | 4:5 (1080×1350); top-aligned (matches IG feed center-crop behavior); no alt-aspect toggle | D-23 |
| 9 | IG grid toggle persistence | Component-local React state in slide-canvas.tsx; per-session, not project-persisted | D-21 |
| 10 | TextEditorPanel breaking change risk | New prop `onSlideTreatmentChange?` is OPTIONAL — disabled-state fallback when omitted | D-29 |
| 11 | Palette extraction cost on non-palette-dominant templates | Skip extraction at generation time when `template.paletteMode !== 'palette-dominant'` (avoids 9 templates' wasted cost); but ALWAYS extract on editor override (template might change later) | D-18, D-19 |
| 12 | Bucket retention pg_cron audit scope | Read-only verification (live SQL query); fix only if errored or grain PNGs accidentally hit the bucket | D-24 |

## Locked decisions: 29 (D-01..D-29)

All 29 decisions recorded in `57-CONTEXT.md`. No open questions remain.

## Risk register

| Risk | Mitigation |
|---|---|
| `@vibrant/node` brings canvas/sharp deps via transitive | Use `/node` subpath (D-05); audit `npm ls --depth=2` after install |
| 3s cache-miss latency feels broken to users | Spinner + "Treating..." label during await; cache hit on second toggle is instant |
| Snapshot test for right-rail composition flakes on minor JSX change | Test asserts `data-testid` order ONLY; not full DOM tree |
| IG grid overlay covers SlidePreview pointer events | `pointer-events: none` on overlay div |
| Editor changes template later, palette goes stale | D-19: re-extract on every editor treatment override regardless of template |
| Legacy slides (pre-Phase-55) lack `original_source_url` | D-03 step 1: back-fill from `background_url` before treating |

## Next step

`/gsd-ui-phase 57` — design contract for photo-treatment-controls.tsx + IG grid chip.
