---
quick_id: 260515-overlay-color-picker
created: 2026-05-15
completed: 2026-05-15
status: complete
---

# Summary — User-controlled overlay color

## What shipped
The Slide Settings "Overlay" section now exposes a color row beneath the opacity slider — 6 fixed swatches (black, white, brand dark, yellow, muted brown, cyan) plus a native palette opener for arbitrary hex. Previously the overlay was locked to the template's hardcoded `overlayColor` (e.g. yellow on `highlight-bar`, cyan on `y2k-pop`), which produced unreadable yellow-on-yellow tints that users had no control over.

## Files
- `src/lib/types/slide.ts` — added `overlay_color?: string` to `SlideStyleOverrides` next to `overlay_opacity`.
- `src/components/editor/text-rail/SlideSettings.tsx` — added swatch row + native `<input type="color">` palette opener under the opacity slider (mirrors `AccentWordsDisclosure` "Highlight color" pattern).
- `src/components/slides/slide-preview.tsx` — resolved `overlayColor` once next to `overlayOpacity`; threaded through `BackgroundLayers`; replaced all three inline `template.overlayColor` reads (the `BackgroundLayers` tint div + the two non-bg-mode fallback overlays).
- `src/lib/render/render-slide-satori.tsx` — same resolution + replaced the inline `template.overlayColor` at the Satori tint div.
- `src/lib/render/render-slide.ts` — same resolution + replaced `${template.overlayColor}` in the `.overlay` CSS template string.

## Render parity (TPLREND-05)
All three render paths (editor preview, Satori snapshot, HTML render) share the same resolution: `overrides.overlay_color ?? template.overlayColor`. Existing rows without `overlay_color` keep their template default → byte-identical legacy render preserved.

## Verification
- `npx tsc --noEmit` — no new errors on changed files
- `npx eslint` on the 5 changed files — only pre-existing warnings, no new errors

## Out of scope
- Brand-kit / derived-palette aware swatches (mirrored the fixed-set HIGHLIGHT_SWATCHES the user pointed at)
- Alpha control (opacity slider already covers blend)
