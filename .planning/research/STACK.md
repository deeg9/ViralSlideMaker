# Stack Research: v1.3 Rich Text Editing

**Domain:** Slide editor -- font picker, text styling, alignment guides, resizable text boxes
**Researched:** 2026-03-26
**Confidence:** HIGH (core libraries verified, integration patterns confirmed against codebase)

> **Scope:** This document covers ONLY the new stack additions for v1.3 Rich Text Editing.
> The existing stack (Next.js 15, React 19, Supabase, Gemini 2.5 Flash, Satori/ImageResponse, react-draggable, dnd-kit, Tailwind 4, shadcn/ui) is validated and unchanged.

## Context: Current Architecture

The existing editor uses:
- `react-draggable` for text box positioning (drag only, no resize)
- `next/og` (`ImageResponse` / Satori) for server-side image rendering -- NOT Puppeteer
- Google Fonts loaded via `<link>` tags in the HTML render path (`render-slide.ts`)
- Satori render path in `render-slide-satori.tsx` (used by the actual `/api/render` route)
- CSS-based text styling (inline styles on absolutely positioned divs)
- No rich text editor -- text is plain strings (`hook_text`, `body_text`)
- Canvas reference size: 1080x1920 with CSS `transform: scale()` for preview

**Key constraint:** Any font/styling change must work in BOTH the client-side React preview AND the Satori-based server render. Satori requires font data as `ArrayBuffer` (TTF/OTF format), not CSS `@font-face`.

## Recommended Stack Additions

### Core: react-rnd (Draggable + Resizable)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-rnd` | ^10.5.3 | Draggable + resizable text boxes | Replaces existing `react-draggable` with a single component that handles both drag AND resize. Built on top of `react-draggable` + `re-resizable`, so migration is minimal. Published March 2026, actively maintained. Supports `scale` prop needed for the scaled canvas. |

**Migration from react-draggable:** The `<Rnd>` component uses the same `position` / `onDragStop` API pattern as `<Draggable>`. The main additions are `size`, `onResizeStop`, and resize handle configuration. The existing coordinate system (percentage-based positions, reference space math) remains unchanged.

### Everything Else: Custom (No New Packages)

The font picker, bold/italic toggles, and alignment snap guides require zero new npm packages. They are implemented with:
- Google Fonts CSS2 API (font loading)
- Google Fonts Developer API (font list)
- Existing shadcn/ui components (font picker UI)
- Simple geometry math (snap guides)
- CSS properties (bold/italic)

## Detailed Integration Plans

### 1. Font Picker -- Google Fonts API + Custom UI

**Client-side font loading (preview):**
- Fetch font list from Google Fonts Developer API: `https://www.googleapis.com/webfonts/v1/webfonts?key=API_KEY&sort=popularity`
- Cache the font list server-side (changes rarely -- refresh daily at most)
- When user selects a font, inject a `<link>` tag: `https://fonts.googleapis.com/css2?family=FontName:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap`
- Apply via inline `style={{ fontFamily: selectedFont }}` on the text box div

**Server-side font loading (Satori render):**
- Satori (used by `ImageResponse`) requires font data as TTF ArrayBuffer, not CSS
- Fetch Google Fonts CSS2 URL with `User-Agent` header requesting TTF format
- Extract the `.ttf` URL from the CSS response using regex
- Fetch the TTF file as ArrayBuffer
- Pass to `ImageResponse` via the `fonts` option array:
  ```typescript
  new ImageResponse(element, {
    width: 1080,
    height: 1920,
    fonts: [
      { name: 'Playfair Display', data: ttfBuffer, weight: 400, style: 'normal' },
      { name: 'Playfair Display', data: ttfBoldBuffer, weight: 700, style: 'normal' },
      { name: 'Playfair Display', data: ttfItalicBuffer, weight: 400, style: 'italic' },
      // ... more variants
    ],
  })
  ```
- Cache font ArrayBuffers in a server-side Map to avoid repeated fetches per render

**Why NOT next/font/google:** `next/font` requires static module-scope declarations at build time. It cannot load fonts dynamically at runtime based on user selection. This is a fundamental limitation confirmed by Next.js team discussions.

**Why NOT font-picker-react:** Abandoned (last update 2021), loads fonts via DOM `<link>` injection without Satori awareness, no TypeScript types, dubious React 19 support.

**Font picker UI:** Build with existing shadcn Popover + Command (combobox pattern). Show font name rendered in its own typeface for preview. Limit the displayed list to top 100-200 popular fonts + search. Use `react-window` or simple virtual scrolling if performance is an issue (unlikely with 200 items).

**API key:** Google Fonts Developer API requires a free API key from Google Cloud Console. Store in `.env` as `GOOGLE_FONTS_API_KEY`. The CSS2 endpoint (for loading actual font files) requires no key.

**Data model change:**
```typescript
// Add to SlideStyleOverrides
font_family?: string  // e.g. "'Playfair Display', serif"
```

### 2. Bold/Italic -- CSS Property Toggles

**Approach:** Per-text-box `fontWeight` and `fontStyle` toggles. NOT inline rich text.

The entire hook text is bold (or not), and the entire body text is italic (or not). This matches the Canva/BigMotion model for carousel slides -- each text element has uniform formatting. No need for mixed formatting like "Hello **world**" within a single text block.

**Data model changes:**
```typescript
// Add to SlideStyleOverrides
hook_font_weight?: number     // 400 | 700 | 900
hook_font_style?: 'normal' | 'italic'
body_font_weight?: number     // 400 | 700
body_font_style?: 'normal' | 'italic'
```

**Client preview:** Apply via inline styles (already the existing pattern in `slide-preview.tsx`).

**Satori render:** Satori requires separate font data for each weight+style combination. The font loader must fetch the appropriate variants.

**Font variant loading strategy:** Always load 5 variants for the selected font: 400, 400italic, 700, 700italic, 900. Google Fonts CSS2 supports multi-variant requests:
```
family=Font:ital,wght@0,400;0,700;0,900;1,400;1,700
```

### 3. Alignment Snap Guides -- Custom Implementation (~100 LOC)

**Why custom:** The slide canvas has a fixed 1080x1920 reference space with only 2-3 elements (hook text, body text, possibly a badge). This is trivial geometry, not a complex multi-element design canvas.

**Snap targets:**
- Horizontal center: element center X = canvas center (540px)
- Vertical center: element center Y = canvas center (960px)
- Edge alignment: element edges align with other element edges
- Safe zone boundaries: existing SAFE_ZONE constants (11% margins)

**Implementation:**
```typescript
interface Guide {
  orientation: 'horizontal' | 'vertical'
  position: number  // px in reference space
}

function getSnapGuides(
  movingBox: { x: number; y: number; w: number; h: number },
  otherBoxes: Array<{ x: number; y: number; w: number; h: number }>,
  threshold: number  // 8-10px in reference space
): { guides: Guide[]; snappedX: number; snappedY: number }
```

- On drag (from `react-rnd` `onDrag` callback), compute snap positions
- Render guide lines as absolutely positioned `<div>`s with `border: 1px dashed cyan`
- Snap the position when within threshold
- Remove guides on drag end

**No library needed.** `react-moveable` (last published 2+ years ago, 180KB, uncertain React 19 support) is designed for complex multi-element canvases with rotation, warping, and grouping. Extreme overkill for this use case.

### 4. Resizable Text Boxes -- react-rnd

**Replace `<Draggable>` with `<Rnd>` in `slide-preview.tsx`:**

```typescript
// Before (current)
<Draggable
  nodeRef={hookRef}
  bounds="parent"
  position={hookPixels}
  onStop={handleStop('hook')}
  scale={scale}
>
  <div ref={hookRef} style={textBoxStyle}>...</div>
</Draggable>

// After (react-rnd)
<Rnd
  position={hookPixels}
  size={{ width: hookWidth, height: 'auto' }}
  onDragStop={(e, d) => handleDragStop('hook', d)}
  onResizeStop={(e, dir, ref, delta, pos) => handleResizeStop('hook', ref, pos)}
  scale={scale}
  bounds="parent"
  enableResizing={{ left: true, right: true }}  // horizontal only
  minWidth={200}
  maxWidth={REF_WIDTH * 0.9}
>
  <div style={textBoxStyle}>...</div>
</Rnd>
```

**Resize behavior:** Horizontal only (left/right handles). Height is auto-determined by text content + font size. This prevents users from creating empty space or clipping text.

**Data model changes:**
```typescript
// Add to SlideStyleOverrides
hook_width?: number   // percentage of canvas width (default: 100 - hookX * 2)
body_width?: number   // percentage of canvas width
```

Currently `textWidth` is computed as `100 - hookX * 2` (symmetric margin). With resize, width becomes an independent user-controlled value.

**scale prop:** `react-rnd` supports a `scale` prop (inherited from `react-draggable`), so the existing coordinate math with CSS `transform: scale()` works correctly.

## Installation

```bash
# Add react-rnd (replaces react-draggable for text boxes in slide-preview)
npm install react-rnd

# After migration, remove react-draggable
# npm uninstall react-draggable
```

No other npm packages needed.

## Environment Variables (New)

```env
# Google Fonts Developer API (free, get from Google Cloud Console)
GOOGLE_FONTS_API_KEY=AIza...
```

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-moveable` | 180KB+, last published 2+ years ago (v0.56.0), uncertain React 19 support, designed for complex multi-element canvases with rotation/warping/grouping. Extreme overkill for 2-3 text boxes. | `react-rnd` for drag+resize, custom snap guides for alignment |
| `font-picker-react` | Abandoned (last update 2021), no TypeScript types, loads fonts by injecting `<link>` tags without Satori awareness, not compatible with React 19 | Custom font picker: Google Fonts API + shadcn Popover/Command |
| `@fontsource/*` packages | Requires installing a separate npm package per font. Not viable when users choose from 1600+ fonts at runtime. | Google Fonts CSS2 API for client-side, TTF fetch for Satori |
| `next/font/google` for dynamic fonts | Only works at build time with static module-scope declarations. Cannot load fonts dynamically at runtime. | Direct Google Fonts CSS2 API `<link>` injection for preview |
| Rich text editors (TipTap, Slate, Lexical) | Paragraph-level editors for mixed inline formatting. The slide editor needs per-text-box formatting toggles (bold/italic on the whole block), not mixed formatting within text. Adding one would massively overcomplicate the data model and break Satori rendering. | CSS `fontWeight` / `fontStyle` toggles stored in `style_overrides` |
| Fabric.js / Konva.js | Canvas-based rendering. The entire editor and export pipeline is HTML/CSS + Satori. Switching to canvas would require rewriting everything. | Keep HTML/CSS approach |
| `react-alignment-guides` | Barely maintained (last meaningful update years ago), designed for a different component model | Custom snap guide utility (~100 LOC) |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `react-rnd` | `react-moveable` | Only if you need rotation, warping, group selection, or 10+ interactive elements. Not this project. |
| Custom font picker | shadcn-font-picker (community) | If you want a drop-in. But it's an external dependency for something simple, and it may not handle Satori font loading. |
| Custom snap guides | `react-moveable` Snappable | Only if you already use react-moveable. Its snapping is not available standalone. |
| CSS fontWeight/fontStyle toggles | TipTap / Slate rich text | Only if users need mixed formatting within a single text block (e.g., "Hello **world** how *are* you"). Not needed for carousel slides. |
| Google Fonts CSS2 API | Bunny Fonts | Privacy-focused alternative (no Google tracking). Smaller selection. Consider if GDPR is a concern. |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-rnd@^10.5.3` | React 18 + 19 | Built on `react-draggable` + `re-resizable`. Published March 2026. Supports `scale` prop for scaled containers. |
| `ImageResponse` (next@15.5.13) | Custom fonts via `fonts` option | Accepts `{ name, data, weight, style }` array. Requires TTF/OTF format (not WOFF2). |
| Google Fonts CSS2 API | Any | Stable public API. CSS2 endpoint requires no API key. Developer API (font list) requires free API key. |

## Key Risks

1. **Satori font rendering fidelity:** Satori's text layout differs slightly from browser CSS. Some Google Fonts may render with minor kerning/spacing differences between preview and export. Mitigation: test with the 20 most popular fonts and document any that render poorly.

2. **Google Fonts API rate limits:** The Developer API (font list) has a default quota of 1000 requests/day. Mitigation: cache the font list server-side and refresh daily. The CSS2 endpoint (font file loading) has no practical rate limit.

3. **Font file caching for Satori:** Each font weight variant is ~100-300KB as TTF. Loading 5 variants per render adds ~0.5-1.5MB of fetches. Mitigation: cache font ArrayBuffers in a server-side `Map<string, ArrayBuffer>` keyed by `fontFamily:weight:style`. The cache persists for the lifetime of the serverless function instance.

4. **react-rnd and scaled coordinates:** The `scale` prop must match the CSS `transform: scale()` factor exactly. The existing codebase already handles this correctly for `react-draggable` via ResizeObserver -- the same pattern transfers directly.

## Sources

- [Next.js ImageResponse docs](https://nextjs.org/docs/app/api-reference/functions/image-response) -- font loading options for Satori (HIGH confidence)
- [Vercel custom font guide](https://vercel.com/kb/guide/using-custom-font) -- TTF ArrayBuffer approach for ImageResponse (HIGH confidence)
- [react-rnd GitHub](https://github.com/bokuweb/react-rnd) -- API reference, version 10.5.3 (HIGH confidence)
- [react-rnd npm](https://www.npmjs.com/package/react-rnd) -- published March 2026 (HIGH confidence)
- [Google Fonts CSS2 API](https://developers.google.com/fonts/docs/css2) -- font loading endpoint (HIGH confidence)
- [Google Fonts Developer API](https://developers.google.com/fonts/docs/developer_api) -- font list endpoint (HIGH confidence)
- [Next.js dynamic font loading discussion](https://github.com/vercel/next.js/discussions/40345) -- confirms next/font cannot load fonts at runtime (HIGH confidence)
- [react-moveable npm](https://www.npmjs.com/package/react-moveable) -- last published 2+ years ago, v0.56.0 (HIGH confidence)
- [Satori font format requirements](https://github.com/vercel/satori/discussions/662) -- TTF/OTF required, WOFF2 not supported (MEDIUM confidence)

---
*Stack research for: TikTok Slideshow Creator v1.3 -- Rich Text Editing*
*Researched: 2026-03-26*
