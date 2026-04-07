# Text Effects Design

Date: 2026-04-07

## Goal

Add text shadow, outline, and background highlight effects to the slide editor and all rendering pipelines. These are the highest-impact text styling features missing from the platform compared to competitors (Canva, Adobe Express), and can be implemented within the current Satori-based rendering pipeline without an architecture change.

## Competitive Context

- Canva offers 9+ text effects (shadow, hollow, splice, neon, glow, echo, glitch, curve, background)
- Carousel-specific competitors (PostNitro, aiCarousels, PostWaffle) have zero text effects
- Shipping shadow + outline + highlight puts us ahead of every carousel-focused tool

## Design Decisions

- **Rendering approach:** Stay on Satori. Fake effects using duplicate elements and inline styles. Use real CSS in the editor preview and HTML renderer. Reassess for gradient text, neon glow, and blur effects later (those require a Playwright/canvas switch).
- **Control granularity:** Moderate (toggle + 1-2 sliders/pickers per effect). Not minimal toggles, not full Canva-style multi-slider panels.
- **Per-element independence:** Every text element (hook, body, each custom text box) has its own independent effect settings.
- **Highlight styles:** Two options -- "tight" (hugs text like a marker) and "full-width" (banner behind text box).

## Data Model

New `TextEffects` interface added to `src/lib/types/slide.ts`:

```typescript
interface TextEffects {
  // Shadow
  shadow_enabled?: boolean
  shadow_color?: string        // hex with alpha, default "#00000099"
  shadow_intensity?: 'small' | 'medium' | 'large'  // maps to offset presets

  // Outline
  outline_enabled?: boolean
  outline_color?: string       // default "#000000"
  outline_thickness?: number   // 1-8px range, default 2

  // Background highlight
  highlight_enabled?: boolean
  highlight_color?: string     // default "#000000AA"
  highlight_style?: 'tight' | 'full-width'
  highlight_padding?: number   // 4-24px range, default 8
}
```

Applied to existing types:
- `SlideStyleOverrides` gains `hook_text_effects?: TextEffects` and `body_text_effects?: TextEffects`
- `CustomText` gains `text_effects?: TextEffects`

No database migration needed -- effects live inside the existing `slide_data` JSON column. All fields are optional so existing slides render unchanged.

## Rendering Strategy

### Editor Preview (`slide-preview.tsx`)
Uses real CSS since it renders in the browser:
- Shadow: `text-shadow` CSS property
- Outline: `-webkit-text-stroke` CSS property
- Highlight (tight): `<span>` with `background-color` + `box-decoration-break: clone` + padding
- Highlight (full-width): `<div>` with background color behind text, same width, vertical padding

### Satori PNG Export (`render-slide-satori.tsx`)
Satori has a limited CSS subset, so effects are faked:
- **Shadow:** Duplicate text element rendered before the original (Satori uses DOM order, no z-index). Offset by preset: small=2px, medium=4px, large=6px. Uses shadow color.
- **Outline:** Four duplicate text elements offset in cardinal directions (up/down/left/right) by the thickness value, all in outline color, rendered behind original. Classic "poor man's text stroke."
- **Highlight (tight):** `<span>` wrapping text content with background color and padding. Satori supports inline backgrounds.
- **Highlight (full-width):** Colored `<div>` behind text element, matching width, with vertical padding.

Known limitation: Satori shadows are sharp-edged (no blur). At 1080x1920 the visual difference from the blurred preview is minor.

### HTML Renderer (`render-slide.ts`)
Uses real CSS like the preview -- straightforward full HTML/CSS output.

## Editor UI

Each text element's section in `text-editor-panel.tsx` gets a collapsible "Effects" group:

```
> Effects
  Shadow        [toggle]
    Color       [swatches] [picker]
    Size        [S] [M] [L]

  Outline       [toggle]
    Color       [swatches] [picker]
    Thickness   [slider] 2px

  Highlight     [toggle]
    Color       [swatches] [picker]
    Style       [Tight] [Full]
    Padding     [slider] 8px
```

- Sub-controls only visible when their toggle is on
- Matches existing UI patterns: toggle buttons (dark red active / light pink inactive), 4-swatch + picker color controls, slider style from font-size control, button groups from text position presets
- Three instances: hook section, body section, custom text section (when selected)

## Implementation Order

1. `src/lib/types/slide.ts` -- Add `TextEffects` interface and fields
2. `src/lib/render/render-slide-satori.tsx` -- Duplicate-element helpers for shadow/outline, wrapping elements for highlights
3. `src/lib/render/render-slide.ts` -- CSS properties for shadow/outline/highlight in HTML output
4. `src/components/slides/slide-preview.tsx` -- Real CSS effects in React preview
5. `src/components/editor/text-editor-panel.tsx` -- Collapsible effects panel with controls

## Future Considerations

Effects that require a rendering pipeline switch (Satori to Playwright/canvas):
- Gradient text
- Neon glow with blur
- Blur/glass effects
- Curved text

These can be evaluated after shadow/outline/highlight are shipped and user feedback is collected.
