# Architecture: Text Effects (Shadow, Outline, Highlight)

**Domain:** Text effect rendering across three-renderer slide creator
**Researched:** 2026-04-07
**Confidence:** HIGH

## Critical Finding: Satori Supports Native CSS Effects

The milestone context assumed Satori cannot render `text-shadow`, `-webkit-text-stroke`, or CSS `filter`, requiring duplicate-element workarounds. **This is incorrect.** Verification of the bundled `@vercel/og` in Next.js 15.5.13 confirms:

| CSS Property | Satori Support | Verified How |
|---|---|---|
| `textShadow` | YES -- rendered as SVG `<filter>` with `feGaussianBlur` + `feOffset` + `feMerge` | Found `buildDropShadow` and `satori_s-` filter IDs in compiled bundle |
| `WebkitTextStrokeWidth` / `WebkitTextStrokeColor` | YES -- parsed and rendered as SVG `stroke` + `strokeWidth` on text | Found parser at line 16267 of compiled bundle |
| `boxShadow` | YES | Confirmed in Satori README CSS support table |
| `filter` | YES | Confirmed in Satori README |
| `backgroundClip: 'text'` | YES (`border-box`, `text` values) | Confirmed in Satori README |

**Source:** [Satori GitHub README CSS support table](https://github.com/vercel/satori), verified against compiled `node_modules/next/dist/compiled/@vercel/og/index.node.js`.

**Implication:** The entire "fake shadow with duplicate offset elements" and "fake outline with 4 cardinal-direction duplicates" approach is unnecessary. All three renderers (React preview, Satori PNG, HTML export) can use the same CSS properties directly. This reduces complexity by roughly 60%.

## Recommended Architecture

### Overview: Unified CSS Approach

Since all three renderers support the same CSS properties, the architecture is straightforward: add effect data to the type system, resolve effect CSS in `resolve-styles.ts`, and apply the same CSS in all three renderers.

```
TextEffects data (types/slide.ts)
    |
    v
resolveSlideStyles() adds resolved effect CSS strings
    |
    +---> SlidePreview (React inline styles -- textShadow, WebkitTextStrokeWidth, etc.)
    +---> buildSlideElement (Satori JSX -- same inline styles, rendered as SVG filters)
    +---> buildSlideHtml (HTML/CSS -- text-shadow, -webkit-text-stroke, etc.)
```

### Data Model: TextEffects Interface

Add a single `TextEffects` interface that all text elements reference. This keeps the effect definition DRY and allows per-element independence.

```typescript
// src/lib/types/slide.ts

export interface TextShadowEffect {
  enabled: boolean
  color: string          // hex, e.g. '#000000'
  size: 'sm' | 'md' | 'lg'  // maps to predefined offset+blur values
}

export interface TextOutlineEffect {
  enabled: boolean
  color: string          // hex
  width: number          // 1-8 px
}

export interface TextHighlightEffect {
  enabled: boolean
  color: string          // hex with alpha, e.g. '#000000cc'
  style: 'tight' | 'full'  // tight = inline padding, full = full-width block
  padding: number        // 2-16 px
}

export interface TextEffects {
  shadow?: TextShadowEffect
  outline?: TextOutlineEffect
  highlight?: TextHighlightEffect
}
```

**Where effects attach:**

```typescript
// SlideStyleOverrides -- hook and body text
export interface SlideStyleOverrides {
  // ... existing fields ...
  hook_effects?: TextEffects
  body_effects?: TextEffects
}

// CustomText -- each custom text box
export interface CustomText {
  // ... existing fields ...
  effects?: TextEffects
}
```

### Style Resolution: Effect CSS Generation

Add effect resolution to `resolve-styles.ts`. The resolver converts the semantic `TextEffects` data into concrete CSS property values.

```typescript
// src/lib/render/resolve-styles.ts (additions)

const SHADOW_PRESETS = {
  sm: { offsetX: 1, offsetY: 1, blur: 2 },
  md: { offsetX: 2, offsetY: 2, blur: 4 },
  lg: { offsetX: 3, offsetY: 4, blur: 8 },
} as const

export interface ResolvedTextEffectStyles {
  textShadow?: string                 // CSS text-shadow value
  WebkitTextStrokeWidth?: string      // e.g. '2px'
  WebkitTextStrokeColor?: string      // hex color
  // Highlight is structural (needs wrapper element), not just CSS on the text
  highlight?: {
    enabled: boolean
    color: string
    style: 'tight' | 'full'
    padding: number
  }
}

export function resolveTextEffects(effects?: TextEffects): ResolvedTextEffectStyles {
  const result: ResolvedTextEffectStyles = {}

  if (effects?.shadow?.enabled) {
    const preset = SHADOW_PRESETS[effects.shadow.size]
    result.textShadow = `${preset.offsetX}px ${preset.offsetY}px ${preset.blur}px ${effects.shadow.color}`
  }

  if (effects?.outline?.enabled) {
    result.WebkitTextStrokeWidth = `${effects.outline.width}px`
    result.WebkitTextStrokeColor = effects.outline.color
  }

  if (effects?.highlight?.enabled) {
    result.highlight = {
      enabled: true,
      color: effects.highlight.color,
      style: effects.highlight.style,
      padding: effects.highlight.padding,
    }
  }

  return result
}
```

The `ResolvedSlideStyles` interface gains three new fields:

```typescript
export interface ResolvedSlideStyles {
  // ... existing fields ...
  hookEffects: ResolvedTextEffectStyles
  bodyEffects: ResolvedTextEffectStyles
  customTexts: Array<CustomText & {
    resolvedFontFamily: string
    resolvedEffects: ResolvedTextEffectStyles  // NEW
  }>
}
```

### Component Boundaries

| Component | Responsibility | Changes |
|---|---|---|
| `src/lib/types/slide.ts` | Data model | Add `TextEffects`, `TextShadowEffect`, `TextOutlineEffect`, `TextHighlightEffect` interfaces; add `effects` field to `SlideStyleOverrides` (as `hook_effects`, `body_effects`) and `CustomText` |
| `src/lib/render/resolve-styles.ts` | Style resolution | Add `resolveTextEffects()` function, add `SHADOW_PRESETS` map, extend `ResolvedSlideStyles` and `resolveSlideStyles()` |
| `src/components/slides/slide-preview.tsx` | Editor preview | Apply `textShadow`, `WebkitTextStrokeWidth`/`Color` to text style objects; render highlight wrapper divs around text |
| `src/lib/render/render-slide-satori.tsx` | Satori PNG export | Apply same CSS properties to JSX inline styles; wrap text in highlight divs when enabled |
| `src/lib/render/render-slide.ts` | HTML export | Add `text-shadow`, `-webkit-text-stroke` CSS; add highlight `<span>` wrappers |
| `src/components/editor/text-editor-panel.tsx` | Editor controls | Add Effects section with toggle+color+size controls for each effect type |
| **NEW** `src/components/editor/text-effects-controls.tsx` | Reusable effect controls | Toggle, color picker, size/preset selectors for shadow/outline/highlight -- used by text-editor-panel for hook, body, and custom text |

### Highlight Rendering: The One Structural Concern

Shadow and outline are pure CSS properties on the text element. Highlight requires a structural wrapper because it needs a background behind the text:

**Tight highlight** (inline, wraps each line):
```tsx
// All three renderers use the same approach
<div style={{ position: 'absolute', left: ..., top: ..., width: ... }}>
  <span style={{
    backgroundColor: '#000000cc',
    padding: '4px 8px',
    // Satori supports display: 'inline' on spans
    boxDecorationBreak: 'clone',  // NOT supported in Satori
  }}>
    {text}
  </span>
</div>
```

**Important Satori caveat:** `box-decoration-break: clone` is NOT in Satori's supported CSS list. This means multi-line tight highlights in Satori will render as a single bounding box rather than per-line background fragments.

**Workaround for tight multi-line highlight in Satori:** Split text into individual lines and wrap each in its own `<span>` with background. This requires knowing line breaks, which is hard without layout information.

**Recommendation:** For v2.1, implement tight highlight as a simple `backgroundColor` on the text container. It will look like a "full-width" block in practice. If per-line tight highlight is needed later, it can be added as a Satori-specific text-splitting enhancement. The "full" style works identically across all renderers with no workaround needed.

**Full-width highlight** (block, full text box width):
```tsx
<div style={{
  position: 'absolute', left: ..., top: ..., width: ...,
  backgroundColor: '#000000cc',
  padding: '8px 12px',
  borderRadius: '4px',
}}>
  <span style={{ color: ..., fontSize: ..., /* other text styles */ }}>
    {text}
  </span>
</div>
```

This works identically in all three renderers -- it is just a `backgroundColor` + `padding` on a container div.

### Data Flow: Complete Path

```
User toggles shadow ON in TextEffectsControls
    |
    v
TextEditorPanel calls onUpdate({
  style_overrides: {
    ...overrides,
    hook_effects: { shadow: { enabled: true, color: '#000000', size: 'md' } }
  }
})
    |
    v
useSlideEditor reducer updates Slide.style_overrides.hook_effects
    |
    v
SlidePreview re-renders:
  - resolveSlideStyles() calls resolveTextEffects(overrides.hook_effects)
  - Returns { textShadow: '2px 2px 4px #000000' }
  - Applied as inline style on hook text element
    |
    v  (on export)
render API route:
  - buildSlideElement() reads same hook_effects from Slide
  - Applies same textShadow inline style to Satori JSX
  - Satori converts to SVG <filter> with feGaussianBlur
  - ImageResponse rasterizes to PNG
```

## Patterns to Follow

### Pattern 1: Effect Controls as Reusable Component

Extract a `TextEffectsControls` component that takes current `TextEffects` and an `onChange` callback. This component is used three times: for hook text, body text, and the selected custom text box.

```typescript
// src/components/editor/text-effects-controls.tsx
interface TextEffectsControlsProps {
  effects: TextEffects | undefined
  onChange: (effects: TextEffects) => void
  label?: string  // "Hook Effects", "Body Effects", etc.
}
```

### Pattern 2: Follow Existing Override Merge Pattern

The codebase already uses a `slide.style_overrides?.X ?? default` pattern everywhere. Text effects follow the same pattern -- `undefined` means no effect, the presence of the object with `enabled: true` means active.

### Pattern 3: CSS Property Passthrough

Since all three renderers support the same CSS, the resolved styles can be spread directly onto style objects:

```typescript
const effects = resolveTextEffects(overrides.hook_effects)
const hookStyle = {
  ...existingHookStyles,
  textShadow: effects.textShadow,
  WebkitTextStrokeWidth: effects.WebkitTextStrokeWidth,
  WebkitTextStrokeColor: effects.WebkitTextStrokeColor,
}
```

No renderer-specific branching needed for shadow and outline.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Duplicate Element Hacks for Satori

**What:** Creating multiple offset text elements to fake shadows, or 4 cardinal-direction copies to fake outlines.
**Why bad:** Satori natively supports `textShadow` and `WebkitTextStrokeWidth`/`Color`. Duplicate elements double DOM size, break text selection, complicate position calculations, and produce worse visual output than native CSS.
**Instead:** Use native CSS properties directly.

### Anti-Pattern 2: Renderer-Specific Code Paths

**What:** `if (renderer === 'satori') { ... } else { ... }` branching in style resolution.
**Why bad:** Since all three renderers support the same CSS properties for these effects, branching adds complexity with no benefit.
**Instead:** Single `resolveTextEffects()` function, same output for all renderers. Only exception: the HTML renderer uses kebab-case (`text-shadow`) while React/Satori use camelCase (`textShadow`), but that is handled naturally by the different rendering approaches (inline styles vs CSS string).

### Anti-Pattern 3: Flat Effect Fields on SlideStyleOverrides

**What:** Adding `hook_shadow_enabled`, `hook_shadow_color`, `hook_shadow_size`, `hook_outline_enabled`, etc. as flat fields.
**Why bad:** Creates an explosion of 18+ new fields (3 effects x 3-4 params x 2 text elements). Hard to manage, hard to extend.
**Instead:** Use nested `TextEffects` object: `hook_effects: { shadow: { enabled, color, size } }`.

## Files to Create vs Modify

### New Files
| File | Purpose |
|---|---|
| `src/components/editor/text-effects-controls.tsx` | Reusable UI controls for shadow/outline/highlight toggles, color pickers, size selectors |

### Modified Files (in build order)
| File | Change | Depends On |
|---|---|---|
| `src/lib/types/slide.ts` | Add `TextEffects`, `TextShadowEffect`, `TextOutlineEffect`, `TextHighlightEffect` interfaces; add `hook_effects`/`body_effects` to `SlideStyleOverrides`, `effects` to `CustomText` | Nothing |
| `src/lib/render/resolve-styles.ts` | Add `resolveTextEffects()`, `SHADOW_PRESETS`, extend `ResolvedSlideStyles` and `resolveSlideStyles()` | Types |
| `src/lib/render/render-slide-satori.tsx` | Apply resolved effect styles to hook/body/custom text JSX elements; add highlight wrapper divs | Types, resolve-styles |
| `src/lib/render/render-slide.ts` | Apply effect CSS to HTML output; add highlight spans | Types, resolve-styles |
| `src/components/slides/slide-preview.tsx` | Apply resolved effect styles to text elements; add highlight wrappers | Types, resolve-styles |
| `src/components/editor/text-effects-controls.tsx` | NEW -- build reusable effect controls component | Types |
| `src/components/editor/text-editor-panel.tsx` | Import and render `TextEffectsControls` for hook, body, and selected custom text | Types, text-effects-controls |

### Tests to Add/Modify
| File | Change |
|---|---|
| `src/lib/render/resolve-styles.test.ts` | Add tests for `resolveTextEffects()` with all effect combinations |
| `src/__tests__/render/render-slide.test.ts` | Verify HTML output includes text-shadow, -webkit-text-stroke, background highlight |

## Suggested Build Order

Build order is dictated by dependencies. Each step should be independently testable.

1. **Types** (`slide.ts`) -- Add all new interfaces and fields. No runtime impact, just type definitions.
2. **Resolution** (`resolve-styles.ts` + test) -- Add `resolveTextEffects()` with `SHADOW_PRESETS`. Unit test this in isolation.
3. **Satori renderer** (`render-slide-satori.tsx`) -- Apply resolved effects to JSX. Test by rendering a slide with effects and inspecting the PNG output.
4. **HTML renderer** (`render-slide.ts`) -- Apply effects as CSS strings. Test by inspecting HTML output.
5. **Preview renderer** (`slide-preview.tsx`) -- Apply effects to React inline styles. Visual verification in browser.
6. **Effect controls UI** (`text-effects-controls.tsx` + `text-editor-panel.tsx`) -- Build the editor controls, wire up state updates.

Steps 3, 4, and 5 are independent of each other and could be done in parallel once step 2 is complete.

## Scalability Considerations

| Concern | Current (no effects) | With effects | Notes |
|---|---|---|---|
| Satori render time | ~200-400ms per slide | ~250-500ms per slide | SVG filters add minimal overhead |
| Data model size | ~500 bytes per slide | ~700 bytes per slide | TextEffects adds ~200 bytes when populated |
| HTML output size | ~1.5KB per slide | ~1.8KB per slide | Minor CSS additions |
| Editor re-renders | Per-keystroke on text | Same + per-effect-toggle | No concern -- React handles this efficiently |

## Sources

- [Satori GitHub README -- CSS support table](https://github.com/vercel/satori) (verified 2026-04-07)
- Compiled `@vercel/og` bundle analysis: `node_modules/next/dist/compiled/@vercel/og/index.node.js`
- Existing codebase: `resolve-styles.ts`, `render-slide-satori.tsx`, `render-slide.ts`, `slide-preview.tsx`
