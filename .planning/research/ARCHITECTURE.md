# Architecture Research: Rich Text Editing Integration

**Domain:** Slide editor rich text features (font picker, bold/italic, alignment guides, resizable text boxes)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Current Architecture Summary

The slide editor has a clean three-layer rendering pipeline:

```
Data Layer (Slide type + SlideStyleOverrides)
    |
    v
Editor Layer (useSlideEditor reducer + TextEditorPanel controls)
    |
    v
Rendering Layer (two parallel renderers reading same data)
    |--- SlidePreview (React + react-draggable, client-side preview)
    |--- buildSlideElement (Satori JSX, server-side PNG via next/og ImageResponse)
    |--- buildSlideHtml (HTML string renderer, present but secondary)
```

**Critical constraint:** Any data model change must render identically in both `SlidePreview` (client React component) and `buildSlideElement` (Satori JSX for `next/og` ImageResponse). Satori has significant CSS limitations: no z-index, inline styles only, limited CSS subset (flexbox + absolute positioning). All style resolution logic is currently duplicated across these renderers.

### Current Data Model

```typescript
// src/lib/types/slide.ts
interface SlideStyleOverrides {
  hook_font_size?: number
  body_font_size?: number
  text_color?: string
  text_position?: 'top' | 'center' | 'bottom'
  text_align?: 'left' | 'center' | 'right'
  hook_position?: TextPosition   // { x: number, y: number } as percentages
  body_position?: TextPosition
  overlay_opacity?: number
}

interface Slide {
  hook_text: string              // plain string, NOT rich text
  body_text: string              // plain string, NOT rich text
  image_query: string
  is_cta: boolean
  background_url: string | null
  pexels_photo_id: number | null
  style_overrides?: SlideStyleOverrides
}
```

Slides are stored as `jsonb` in Postgres (`projects.slide_data`). New optional fields are backward-compatible -- existing slides without them render with template defaults.

### Current Rendering Coordinate System

The canvas uses a 1080x1920 reference space scaled down to the container width via CSS `transform: scale(factor)`. Text positions are stored as percentages (0-100). `react-draggable` handles position changes with the scale factor passed in. Text width is currently computed as `100 - hookX * 2` (symmetric margins, same width for both text boxes).

## Integration Analysis by Feature

### 1. Bold/Italic Text Styling

**Impact: LOW -- purely additive style fields, zero external dependencies**

| Layer | Component | Change Type | Details |
|-------|-----------|-------------|---------|
| Data | `SlideStyleOverrides` | ADD fields | `hook_font_weight?: number`, `hook_font_style?: 'normal' \| 'italic'`, same for `body_*` |
| Data | `SlideTemplate` | NO CHANGE | `hookStyle` already has `'uppercase' \| 'normal' \| 'italic'` at template level |
| Editor | `TextEditorPanel` | ADD controls | Bold (B) and Italic (I) toggle buttons per text box |
| Preview | `SlidePreview` | MODIFY | Apply `fontWeight` and `fontStyle` from overrides to text element styles |
| Render | `buildSlideElement` | MODIFY | Same override resolution for Satori inline styles |
| Render | Font loading | NOTE | Must ensure bold (700/900) and italic variants are loaded for selected font |

**Design decision -- whole-box styling, NOT inline rich text:**

Apply bold/italic to the entire hook or body text box. Do NOT implement inline rich text (e.g., "some **bold** words"). Reasons:
1. Satori cannot reliably render mixed-weight `<span>` elements within a text block
2. Current data model stores `hook_text` and `body_text` as plain strings -- inline formatting would require migrating to a rich text format (Slate nodes, ProseMirror doc, or HTML)
3. Inline rich text requires a full editor library (Slate, TipTap, ProseMirror) -- massive complexity for short slide text (1-3 sentences)
4. Canva-style slide editors apply formatting to entire text boxes, not inline -- this is the right UX for short-form carousel content

**Implementation:** Toggle buttons that set `fontWeight: 700` (bold on) / `undefined` (bold off, inherit from template) and `fontStyle: 'italic'` / `undefined`. User overrides compose with template's `hookStyle` -- if template says `hookStyle: 'italic'` and user toggles italic off, the override wins.

### 2. Font Picker (Google Fonts)

**Impact: MEDIUM -- requires font infrastructure for both client preview and server rendering**

| Layer | Component | Change Type | Details |
|-------|-----------|-------------|---------|
| Data | `SlideStyleOverrides` | ADD fields | `hook_font_family?: string`, `body_font_family?: string` |
| Data | `SlideTemplate` | NO CHANGE | Already has `fontFamily` field used as default |
| Editor | `TextEditorPanel` | ADD section | Font picker dropdown with search, grouped by category |
| Preview | `SlidePreview` | MODIFY | Dynamically inject Google Fonts `<link>` tag for custom font |
| Render | `buildSlideElement` | MODIFY | Read font family override, apply to Satori styles |
| Render | `render/route.ts` | MODIFY | Fetch font file buffers and pass to ImageResponse `fonts` option |
| New | `font-catalog.ts` | NEW | Static list of curated fonts with metadata |
| New | `load-font.ts` | NEW | Fetch Google Font .ttf buffers for Satori |
| New | `font-picker.tsx` | NEW | Searchable font dropdown component |

**Critical integration point -- Satori font loading:**

Satori (used by `next/og` ImageResponse) does NOT use CSS `@font-face` or Google Fonts `<link>` tags. It requires raw font file ArrayBuffers passed to the constructor:

```typescript
// Current -- no custom fonts, uses system fallback
new ImageResponse(element, { width: 1080, height: 1920 })

// Required for custom fonts
new ImageResponse(element, {
  width: 1080,
  height: 1920,
  fonts: [
    {
      name: 'Montserrat',
      data: fontBuffer,       // ArrayBuffer from .ttf/.woff file
      weight: 400,
      style: 'normal',
    },
    {
      name: 'Montserrat',
      data: boldFontBuffer,
      weight: 700,
      style: 'normal',
    },
  ],
})
```

**Font loading strategy for server rendering:**
1. Google Fonts CSS API returns `@font-face` declarations with URLs to `.woff2`/`.ttf` files
2. Parse those URLs from the CSS response
3. Fetch the binary font file
4. Cache the buffer (in-memory or on disk) -- fonts are immutable, cache indefinitely
5. Pass to ImageResponse

**Client preview font loading:** Inject a `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap">` tag into `<head>` dynamically. This is simple and well-supported.

**Curated font list -- not open search:**
Limit to 20-30 popular Google Fonts grouped by category (sans-serif, serif, display, handwriting). Reasons:
- Most of Google Fonts' 1400+ fonts are low quality
- Each unique font in a project requires a buffer fetch at render time
- Font previews for 1400 fonts would be slow to render
- A curated list provides a better UX (less choice paralysis)

### 3. Resizable Text Boxes

**Impact: MEDIUM -- modifies core text box rendering and breaks symmetric width assumption**

| Layer | Component | Change Type | Details |
|-------|-----------|-------------|---------|
| Data | `SlideStyleOverrides` | ADD fields | `hook_width?: number` (percentage 0-100), `body_width?: number` |
| Editor | `SlidePreview` | MODIFY | Replace symmetric width calc, add resize drag handles |
| Preview | `SlidePreview` (non-editable) | MODIFY | Read per-box width from overrides |
| Render | `buildSlideElement` | MODIFY | Read per-box width overrides |
| Render | `buildSlideHtml` | MODIFY | Same |
| New | Resize interaction code | NEW | Mouse/touch handlers for resize handles |

**Breaking the symmetric width assumption:**

Currently ALL renderers compute text width as `100 - hookX * 2` -- a symmetric margin. With per-box widths, this changes to:

```typescript
// Current (all renderers)
const textWidth = 100 - hookX * 2

// New
const hookWidth = overrides.hook_width ?? (100 - hookX * 2)  // fallback to symmetric
const bodyWidth = overrides.body_width ?? (100 - bodyX * 2)
```

This change touches `SlidePreview` (editable and non-editable modes) and both server renderers. All must be updated together.

**Width only, NOT height:** Text boxes auto-size height based on content (text wraps naturally). Users resize width; height follows. This matches Canva/Figma behavior for text boxes and avoids the complexity of overflow/truncation.

**Implementation -- custom resize handles, not a library:**

Do NOT add `react-resizable` or `re-resizable`. Reasons:
- The text boxes are already absolutely positioned in a scaled coordinate system with `react-draggable`
- Adding a resize library creates two competing coordinate/event systems on the same DOM elements
- The existing scale factor math (container width / 1080) must be applied to resize deltas too

Instead, add 8x8px drag handles at the left and right edges of each text box. On mousedown, track mouse movement, convert pixel deltas to percentage deltas using the same scale factor, and dispatch `UPDATE_SLIDE` with new width values.

### 4. Alignment Guides (Snap Lines)

**Impact: LOW -- purely visual, no data model or server rendering changes**

| Layer | Component | Change Type | Details |
|-------|-----------|-------------|---------|
| Data | None | NO CHANGE | Guides are ephemeral UI state, not persisted |
| Editor | `SlidePreview` | MODIFY | Add `onDrag` handler (currently only uses `onStop`), render guide overlays |
| New | `use-alignment-guides.ts` | NEW | Hook: calculate guide positions, detect proximity, return active guides |
| New | Overlay divs in `SlidePreview` | NEW | Thin colored lines shown during drag |

**Key change to react-draggable usage:**

Currently the component only uses `onStop` to persist final position. Must add `onDrag` handler to compute snap positions in real-time during drag. The `Draggable` component already supports both callbacks.

```
User drags text box
    |
    v
onDrag fires continuously
    |
    v
useAlignmentGuides calculates nearest guides from current position
    |
    v
If within snap threshold (e.g., 8-10px in reference space):
    - Snap position to guide
    - Show guide line overlay
    |
    v
onStop: persist final snapped position (existing flow)
```

**Guide lines to implement:**
- Canvas horizontal center (y = 50%)
- Canvas vertical center (x = 50%)
- Top/bottom safe zone boundaries (y = 12%, y = 75%)
- Left/right safe zone boundaries (x = 11%, x = 89%)
- Cross-box alignment: hook aligns to body's x position, and vice versa

## Data Model Changes (Complete)

```typescript
// Proposed SlideStyleOverrides for v1.3
export interface SlideStyleOverrides {
  // Existing fields (unchanged)
  hook_font_size?: number
  body_font_size?: number
  text_color?: string
  text_position?: 'top' | 'center' | 'bottom'
  text_align?: 'left' | 'center' | 'right'
  hook_position?: TextPosition
  body_position?: TextPosition
  overlay_opacity?: number

  // NEW: Font picker
  hook_font_family?: string       // Google Font name, e.g. "Montserrat"
  body_font_family?: string

  // NEW: Bold/italic
  hook_font_weight?: number       // 400 | 700 | 900
  hook_font_style?: 'normal' | 'italic'
  body_font_weight?: number
  body_font_style?: 'normal' | 'italic'

  // NEW: Resizable width
  hook_width?: number             // percentage 0-100
  body_width?: number             // percentage 0-100
}
```

**Database impact:** NONE. All fields are optional within the `style_overrides` object inside the `slide_data` jsonb column. Fully backward-compatible -- old slides render with template defaults for missing fields.

## Editor State Changes

The existing reducer pattern requires NO structural changes. All new fields flow through `SlideStyleOverrides`, which is already handled by the `UPDATE_SLIDE` action's merge logic:

```typescript
// Existing code in editor-reducer.ts -- already handles new fields
case 'UPDATE_SLIDE': {
  if (action.updates.style_overrides && slide.style_overrides) {
    updated.style_overrides = {
      ...slide.style_overrides,
      ...action.updates.style_overrides,
    }
  }
}
```

Undo/redo works automatically because the reducer snapshots the entire slide array in `past[]`. No new action types needed.

## Architectural Pattern: Shared Style Resolution

**This is the most important refactor before adding features.**

Currently, override resolution (e.g., `overrides.text_color ?? template.textColor`) is duplicated across three renderers:
1. `SlidePreview` (editable mode)
2. `SlidePreview` (non-editable/thumbnail mode)
3. `buildSlideElement` (Satori server render)
4. `buildSlideHtml` (HTML renderer)

With 8 new override fields, this duplication becomes a guaranteed source of preview-vs-export bugs.

**Solution:** Extract `resolveSlideStyles(slide, template)` that ALL renderers consume:

```typescript
// src/lib/render/resolve-styles.ts
export interface ResolvedSlideStyles {
  textColor: string
  textAlign: 'left' | 'center' | 'right'
  overlayOpacity: number

  hookFontSize: number
  hookFontFamily: string
  hookFontWeight: number
  hookFontStyle: 'normal' | 'italic'
  hookX: number           // percentage
  hookY: number           // percentage
  hookWidth: number       // percentage

  bodyFontSize: number
  bodyFontFamily: string
  bodyFontWeight: number
  bodyFontStyle: 'normal' | 'italic'
  bodyX: number
  bodyY: number
  bodyWidth: number
}

export function resolveSlideStyles(
  slide: Slide,
  template: SlideTemplate
): ResolvedSlideStyles {
  const overrides = slide.style_overrides ?? {}
  const posPreset = overrides.text_position ?? template.textPosition
  const defaults = SAFE_ZONE[posPreset] ?? SAFE_ZONE.center

  return {
    textColor: overrides.text_color ?? template.textColor,
    textAlign: overrides.text_align ?? template.textAlign,
    overlayOpacity: overrides.overlay_opacity != null
      ? overrides.overlay_opacity / 100
      : template.overlayOpacity,

    hookFontSize: overrides.hook_font_size ?? parseInt(template.hookFontSize),
    hookFontFamily: overrides.hook_font_family
      ? `'${overrides.hook_font_family}', sans-serif`
      : template.fontFamily,
    hookFontWeight: overrides.hook_font_weight ?? 900,
    hookFontStyle: overrides.hook_font_style
      ?? (template.hookStyle === 'italic' ? 'italic' : 'normal'),
    hookX: overrides.hook_position?.x ?? SAFE_ZONE.x,
    hookY: overrides.hook_position?.y ?? defaults.hookY,
    hookWidth: overrides.hook_width ?? (100 - (overrides.hook_position?.x ?? SAFE_ZONE.x) * 2),

    bodyFontSize: overrides.body_font_size ?? parseInt(template.bodyFontSize),
    bodyFontFamily: overrides.body_font_family
      ? `'${overrides.body_font_family}', sans-serif`
      : template.fontFamily,
    bodyFontWeight: overrides.body_font_weight ?? 400,
    bodyFontStyle: overrides.body_font_style ?? 'normal',
    bodyX: overrides.body_position?.x ?? SAFE_ZONE.x,
    bodyY: overrides.body_position?.y ?? defaults.bodyY,
    bodyWidth: overrides.body_width ?? (100 - (overrides.body_position?.x ?? SAFE_ZONE.x) * 2),
  }
}
```

## New Files

| File | Type | Purpose |
|------|------|---------|
| `src/lib/render/resolve-styles.ts` | NEW | Shared style resolution -- single source of truth for all renderers |
| `src/lib/fonts/font-catalog.ts` | NEW | Static array of 20-30 curated Google Fonts with metadata (name, weights, category) |
| `src/lib/fonts/load-font.ts` | NEW | Fetch Google Font .ttf buffer for Satori rendering, with in-memory cache |
| `src/components/editor/font-picker.tsx` | NEW | Searchable dropdown of curated fonts with live preview text |
| `src/lib/editor/use-alignment-guides.ts` | NEW | Hook: calculate snap guide positions, detect proximity, return active guide lines |

## Modified Files

| File | Change | Why |
|------|--------|-----|
| `src/lib/types/slide.ts` | Add 8 new optional fields to `SlideStyleOverrides` | Data model for all new features |
| `src/components/editor/text-editor-panel.tsx` | Add font picker component, bold/italic toggle buttons | Editor controls for new features |
| `src/components/slides/slide-preview.tsx` | Consume `resolveSlideStyles()`, add resize handles, add alignment guide overlay, add `onDrag` to Draggable, dynamic Google Font `<link>` injection | Preview rendering + interaction |
| `src/lib/render/render-slide-satori.tsx` | Consume `resolveSlideStyles()`, apply font family/weight/style to JSX styles | Server rendering parity |
| `src/lib/render/render-slide.ts` | Consume `resolveSlideStyles()`, apply new CSS properties | HTML renderer parity |
| `src/app/api/render/route.ts` | Detect custom fonts from slide overrides, fetch font buffers, pass to ImageResponse `fonts` option | Font loading for server-side PNG export |

## Recommended Build Order

Order is driven by dependencies. Each feature can ship independently.

### Step 0: Extract `resolveSlideStyles()` (prerequisite refactor)

**Why first:** This is a pure refactor with no behavior change. It eliminates the style resolution duplication BEFORE adding new fields. All subsequent features benefit from a single source of truth.

1. Create `src/lib/render/resolve-styles.ts` with current fields only
2. Refactor `SlidePreview` to consume it
3. Refactor `buildSlideElement` to consume it
4. Refactor `buildSlideHtml` to consume it
5. Verify all tests pass -- rendering should be byte-identical

**Risk:** LOW. Pure refactor, no new behavior.

### Step 1: Bold/Italic (simplest feature, validates override pattern)

**Why next:** Zero external dependencies. Tests the pattern of adding new override fields end-to-end through `resolveSlideStyles()`.

1. Add `hook_font_weight`, `hook_font_style`, `body_font_weight`, `body_font_style` to `SlideStyleOverrides`
2. Add resolution logic to `resolveSlideStyles()`
3. Add toggle buttons to `TextEditorPanel`
4. Verify preview and export render identically
5. Verify undo/redo works (automatic via existing reducer)

**Risk:** LOW. Identical pattern to existing `hook_font_size` override.

### Step 2: Font Picker (requires font infrastructure)

**Why next:** Builds the font loading infrastructure needed for proper bold/italic weight availability. Also the highest user-perceived-value feature.

1. Create `font-catalog.ts` with curated font list
2. Create `load-font.ts` for fetching/caching .ttf buffers
3. Build `FontPicker` component with search and category grouping
4. Add `hook_font_family`, `body_font_family` to `SlideStyleOverrides` and `resolveSlideStyles()`
5. Wire into `TextEditorPanel`
6. Update `SlidePreview` to dynamically load fonts via `<link>` tag
7. Update `render/route.ts` to fetch font buffers and pass to ImageResponse

**Risk:** MEDIUM. Satori font buffer loading is the trickiest integration point in the entire milestone. Test server-side rendering early with a single custom font before building the full picker UI.

### Step 3: Resizable Text Boxes

**Why next:** Modifies text box dimensions, which alignment guides need to understand.

1. Add `hook_width`, `body_width` to `SlideStyleOverrides` and `resolveSlideStyles()`
2. Update all renderers to use per-box width instead of symmetric calculation
3. Add resize handles (small squares) on left/right edges of text boxes in editable mode
4. Implement mousedown/mousemove/mouseup handlers with scale-factor conversion
5. Dispatch `UPDATE_SLIDE` with new width on resize end

**Risk:** MEDIUM. The scaled coordinate system makes pixel-to-percentage conversion non-trivial. Same pattern as existing drag, but adds the width dimension.

### Step 4: Alignment Guides

**Why last:** Purely visual polish. No data model impact. Benefits from stable text box dimensions (after resize is done).

1. Build `useAlignmentGuides` hook with guide line definitions and proximity detection
2. Add `onDrag` handler to existing `Draggable` components
3. Implement snap logic with 8-10px threshold (in 1080x1920 reference space)
4. Render guide line overlays as absolutely-positioned colored divs
5. Optional: snap during resize operations too

**Risk:** LOW. Client-side only, no persistence, no server rendering impact.

```
[Step 0: resolveSlideStyles refactor]
    |
    v
[Step 1: Bold/Italic] --> [Step 2: Font Picker] --> [Step 3: Resize] --> [Step 4: Guides]
                                                          |                    |
                                              (guides benefit from stable box sizes)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Inline Rich Text Editor

**What people do:** Add Slate.js, TipTap, or ProseMirror for inline bold/italic within text
**Why it's wrong:** Slide text is 1-3 sentences. Inline formatting requires: rich text serialization format, Satori rendering of mixed-style spans, migration of all existing plain string data, contenteditable bugs on mobile, and a complete data model redesign from `string` to a node tree. 10x the complexity for minimal value.
**Do this instead:** Whole-box bold/italic toggles. Apply to entire hook or body text box.

### Anti-Pattern 2: Open Font Search (All 1400+ Google Fonts)

**What people do:** Let users search the full Google Fonts library
**Why it's wrong:** Most fonts are low quality. Loading previews for 1400 fonts is slow. Each unique font requires a .ttf buffer fetch at render time. More fonts means more render failures and slower exports.
**Do this instead:** Curate 20-30 popular fonts grouped by category. Cover the 80% case. Can expand later if users request specific fonts.

### Anti-Pattern 3: Using a Resize Library (react-resizable, re-resizable)

**What people do:** Install a resize library alongside react-draggable
**Why it's wrong:** Two libraries competing over the same DOM element in a scaled coordinate system. The resize library won't know about the scale factor, producing incorrect sizes. Event handler conflicts between drag and resize.
**Do this instead:** Build resize handles with raw mouse event handlers, reusing the existing scale-factor math from the drag implementation.

### Anti-Pattern 4: Divergent Override Resolution

**What people do:** Add new override fields to one renderer but forget another, so preview and export look different
**Why it's wrong:** The current codebase already has 3 copies of style resolution logic. Adding 8 fields to 3 places creates 24 potential divergence points. Users see one thing in preview and get something different on export.
**Do this instead:** Extract `resolveSlideStyles()` BEFORE adding any new fields. All renderers consume the same resolved output.

## Satori-Specific Constraints

These constraints affect what is possible in server-side PNG rendering:

| Feature | Satori Support | Notes |
|---------|---------------|-------|
| `fontWeight` | YES | Requires matching weight in the `fonts` buffer array |
| `fontStyle: 'italic'` | YES | Requires italic variant in font buffers |
| Custom font families | YES | Requires font ArrayBuffer passed to ImageResponse |
| Per-box width | YES | Absolute positioning with explicit width works |
| Text alignment | YES | `textAlign` in inline styles works |
| Alignment guides | N/A | Editor-only feature, never rendered to PNG |
| `textTransform: uppercase` | YES | Already used for hook text |
| Inline `<span>` with mixed styles | PARTIAL | Works for simple cases but unreliable for complex mixed-weight text |

## Sources

- Codebase analysis: `src/lib/types/slide.ts`, `src/components/slides/slide-preview.tsx`, `src/lib/render/render-slide-satori.tsx`, `src/app/api/render/route.ts`, `src/lib/editor/editor-reducer.ts`, `src/components/editor/text-editor-panel.tsx`
- Satori limitations: Documented in `buildSlideElement` code comments -- no z-index, inline styles only, limited CSS subset
- `next/og` ImageResponse API: Font buffer loading via `fonts` option in ImageResponse constructor
- react-draggable: Already used in `SlidePreview`, supports `onDrag` callback in addition to `onStop`
- Google Fonts CSS API: Returns `@font-face` declarations with `.woff2`/`.ttf` URLs for font buffer fetching

---
*Architecture research for: v1.3 Rich Text Editing milestone*
*Researched: 2026-03-26*
