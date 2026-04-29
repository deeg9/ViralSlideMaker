# Phase 48 — Deferred items

## Latent /api/render bug — Satori multi-child constraint on segments

**Discovered during:** Plan 48-01 Task 2 (`npm run thumbs` execution).

**Symptom:** When `buildSlideElement` is fed through `next/og::ImageResponse` with a slide that carries `hook_segments` of length > 1 (e.g. news-drop's default sample with 5 accent-keyword segments), the rasterizer throws:

```
Expected <div> to have explicit "display: flex" or "display: none" if it has more than one child node.
```

**Root cause:** The hook / body / custom-text `<div>` containers in `src/lib/render/render-slide-satori.tsx` do not set `display: 'flex'`. When `renderSegmentChildren` returns more than one `<span>` child, Satori's strict layout rule trips. Single-segment hooks (or string-only hook_text with no segments) are unaffected.

**Why this slipped past existing snapshot tests:** `src/__tests__/render/premium-templates.test.tsx` and the legacy regression suite snapshot the React element tree returned by `buildSlideElement`. They never call `new ImageResponse(element, ...).arrayBuffer()` — that's the path that runs Satori's validator. So the trees serialize fine in vitest, but production `/api/render` would error if it ever received a slide with multi-segment hook/body. Phase 47 segment-emitting AI prompts make this latent, not theoretical.

**Plan 48-01 mitigation (script-side, not renderer-side):** `scripts/generate-template-thumbnails.ts` strips `hook_segments` and `body_segments` before calling `buildSlideElement`, so static thumbnails render cleanly. The picker UI is unaffected — it uses the live React `<SlidePreview>` (browser-side, no Satori constraint), so users still see accent-word highlights at runtime.

**Recommended follow-up:** A dedicated bug-fix plan in v2.7 or v2.8 to:
1. Add `display: 'flex'` + `flexWrap: 'wrap'` (or wrap segments in a single inline-flex container) to the hook / body / custom_text div styles in `render-slide-satori.tsx`.
2. Add an integration test that invokes `new ImageResponse(buildSlideElement(...)).arrayBuffer()` end-to-end with a multi-segment hook.
3. Re-run `npm run thumbs` without the segment-stripping mitigation to confirm parity is restored.

**Out of scope for Plan 48-01** — the plan goal is to ship 8 thumbnail PNGs + a picker regression test. Touching the production renderer would expand scope into architectural rendering changes (Rule 4 territory) and risks invalidating the Phase 46 snapshot suite without a dedicated plan.
