---
quick_id: 260515-overlay-color-picker
created: 2026-05-15
status: in-progress
---

# User-controlled overlay color (Slide Settings)

## Problem
The overlay color is locked to each template's hardcoded `overlayColor` (yellow on `highlight-bar`, black on `bold-yellow`, cyan on `y2k-pop`, etc.). Users get whatever the template picked and can only tune opacity. UX feels random — yellow tint on yellow-toned backgrounds is unreadable.

## Fix
Add an "Overlay color" swatch row + native palette opener beneath the existing Overlay opacity slider, mirroring the `AccentWordsDisclosure` "HIGHLIGHT COLOR" pattern (6 swatches + `<input type="color">`).

## Files
- `src/lib/types/slide.ts` — add `overlay_color?: string` to `SlideStyleOverrides` next to `overlay_opacity`.
- `src/components/editor/text-rail/SlideSettings.tsx` — add the swatch + palette row.
- `src/components/slides/slide-preview.tsx` — resolve `overlay_color` once (alongside `overlayOpacity` at line 708) and replace all three `template.overlayColor` reads (lines 170, 1122, 1557).
- `src/lib/render/render-slide-satori.tsx` — resolve + replace `template.overlayColor` at line 362.
- `src/lib/render/render-slide.ts` — resolve + replace `template.overlayColor` at line 258.

## Pattern
Mirror `AccentWordsDisclosure.tsx:118-173`:
- Fixed `OVERLAY_SWATCHES` set: black, white, brand dark, yellow, muted brown, cyan
- Active swatch ring on the currently-applied color (`overrides.overlay_color ?? template.overlayColor`)
- Palette `<label>` wrapping a hidden `<input type="color">` for arbitrary hex
- Dispatch: `onUpdate({ style_overrides: { ...overrides, overlay_color: hex } })`

## Out of scope
- Brand-kit / derived-palette aware swatches (the user pointed at the fixed HIGHLIGHT_SWATCHES pattern specifically)
- Per-template default override
- Animation / alpha control (opacity already covers blend)
