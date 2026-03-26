# Domain Pitfalls: Rich Text Editing (v1.3)

**Domain:** Adding font picker, bold/italic, alignment guides, and resizable text boxes to carousel slide editor
**Researched:** 2026-03-26
**Confidence:** HIGH (verified against codebase + Satori documentation)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken exports, or visual inconsistency between preview and download.

### Pitfall 1: Satori Does Not Use CSS Font Names -- It Needs Raw Font Files

**What goes wrong:** The browser preview renders fonts using CSS `fontFamily` strings (e.g., `'Playfair Display', serif`), which the browser resolves via Google Fonts `<link>` tags or `@font-face` rules. But Satori (used via `next/og` `ImageResponse`) completely ignores CSS font names. It requires raw font file ArrayBuffers passed in the `fonts` option. If you add a font picker to the browser but do not also fetch and pass the corresponding `.ttf`/`.otf` file to Satori, **every exported image will render in Satori's default font (Noto Sans), not the user's chosen font.**

**Why it happens:** Satori is not a browser. It has its own text layout engine (based on Yoga/Flexbox) and needs font binary data to measure and render glyphs. The current codebase already has this bug -- templates specify `fontFamily: "'Inter', sans-serif"` but the render route passes no `fonts` option to `ImageResponse`, meaning exports likely render in Noto Sans already.

**Consequences:** Users see one font in the editor, a different font in their downloaded images. This is a trust-destroying bug for a design tool.

**Prevention:**
1. Build a server-side font registry that maps font names to their `.ttf` file URLs (Google Fonts API provides these).
2. When rendering, fetch the required font files as ArrayBuffers and pass them in the `fonts` option of `ImageResponse`.
3. For each font weight/style variant (regular, bold, italic, bold-italic), you need a separate font file. Satori does NOT synthesize bold or italic -- it needs the actual variant file.
4. Cache font files aggressively (they are immutable). Store in memory or on disk, not fetched per-render.

**Detection:** Compare browser preview screenshot with downloaded PNG side-by-side. If fonts differ, this pitfall is active. The current codebase likely already has this issue.

**Phase:** Must be solved in the very first phase, before any font picker UI work. Fix the existing font loading gap first.

### Pitfall 2: Satori Cannot Synthesize Bold/Italic -- Each Variant Needs Its Own Font File

**What goes wrong:** In browsers, setting `font-weight: 700` on a font that only has a regular weight causes the browser to algorithmically "fake bold" the text (faux bold). Satori does NOT do this. If you pass only the regular weight file for Inter but set `fontWeight: 700`, Satori will render it in regular weight. The text will not look bold.

**Why it happens:** Satori uses a font matching algorithm that selects the closest available font file. If only weight 400 is loaded, weight 700 requests will silently fall back to 400. There is no warning or error.

**Consequences:** Bold text appears bold in the browser preview but renders as regular weight in exports. Italic text appears italic in browser but upright in exports. Users will report "my styling disappeared in the download."

**Prevention:**
1. For every font offered in the picker, pre-register which variants are available (regular, bold, italic, bold-italic).
2. When a user applies bold, load the bold variant file. When italic, load the italic variant.
3. Pass ALL needed variant files to `ImageResponse({ fonts: [...] })`.
4. If a font does not have a bold variant, either disable the bold button for that font or show a warning.
5. Google Fonts API provides variant availability metadata -- use it to gate the UI.

**Detection:** Apply bold to text in editor, export, compare. If bold is missing in export, this is active.

**Phase:** Must be solved alongside the font picker. Bold/italic UI controls and font file loading are tightly coupled.

### Pitfall 3: Browser Preview and Satori Render Text Layout Differently

**What goes wrong:** The browser preview uses standard CSS layout with `position: absolute` and percentage-based coordinates. Satori uses its own Yoga-based flexbox engine with pixel-based absolute positioning. Text wrapping, line breaking, letter spacing, and font metrics differ between the two engines. A text block that fits neatly in the browser preview may overflow or have different line breaks in the Satori render.

**Why it happens:** Satori explicitly notes it uses a subset of CSS. It does not support `z-index`, has different text shaping, no OpenType features, no kerning, and no ligatures. Line-height calculations, word-break behavior, and text measurement all differ from browser rendering.

**Consequences:** Text position drift between preview and export. Text that fits in preview overflows in export (or vice versa). Users perceive the tool as broken because "what I see is not what I get."

**Prevention:**
1. Use the SAME font files for both preview and export. Load Google Fonts via their `.ttf` files (not the CSS API) and use `@font-face` in the browser with the same files Satori will use.
2. Keep text styling simple -- avoid advanced CSS properties Satori does not support.
3. Add a "preview render" button that generates the actual Satori output so users can verify before downloading all slides.
4. Test every template with long text, short text, and multi-line text to identify layout drift.
5. Consider using Satori for both preview AND export (render SVG in browser) for pixel-perfect consistency, though this adds complexity and latency.

**Detection:** Overlay browser screenshot on Satori output at same resolution. Any text position or wrapping difference indicates this pitfall.

**Phase:** Ongoing concern. Initial fix: use identical font files. Long-term: consider Satori-based preview.

---

## High Pitfalls

Mistakes that cause significant UX issues or require substantial rework.

### Pitfall 4: Font Loading Race Conditions in Browser Preview

**What goes wrong:** User selects a font from the picker. The font CSS is injected via a `<link>` tag or `@font-face` rule. The slide preview re-renders immediately, but the font file has not finished downloading yet. The preview briefly shows the fallback font, then jumps to the correct font once loaded (FOUT -- Flash of Unstyled Text). During this flash, any text measurement (for resize handles, alignment guides) is wrong.

**Why it happens:** Google Fonts are loaded asynchronously. The browser does not block rendering to wait for fonts. React re-renders do not wait for font loads.

**Consequences:** Jarring visual flash on every font change. Incorrect text box dimensions during the flash. Alignment guides snap to wrong positions.

**Prevention:**
1. Use the `document.fonts.load()` API or `FontFace` API to preload fonts before applying them. Only update the slide's font after the promise resolves.
2. Show a loading indicator on the font picker while the font downloads.
3. Preload the most popular fonts (top 10-20) during initial page load so they are instant.
4. Use `font-display: block` in `@font-face` rules to prevent FOUT (the text will be invisible briefly instead of flashing).

**Detection:** Select a font on a slow connection (throttle in DevTools). Observe the preview for flashes or layout jumps.

**Phase:** Font picker implementation phase. Must be addressed when building the font selection UI.

### Pitfall 5: Data Model Migration Breaks Existing Projects

**What goes wrong:** Adding new fields to `SlideStyleOverrides` (e.g., `font_family`, `font_weight`, `font_style`) seems straightforward since they are optional fields on an interface. But existing slide data in Supabase has `style_overrides` as a JSON column. If the code starts reading new fields without defaults, existing projects may render differently or crash.

**Why it happens:** The current `SlideStyleOverrides` interface uses optional fields with nullish coalescing (`??`) to fall back to template values. This pattern is safe IF consistently applied. The risk is adding a new field and forgetting the fallback, or changing the default behavior.

**Consequences:** Existing projects render with wrong fonts/styles after code update. Users open old projects and they look different.

**Prevention:**
1. Every new field in `SlideStyleOverrides` MUST be optional and MUST have a fallback to the template value using `??`.
2. Write a migration test: load a slide with empty `style_overrides` and verify it renders identically to before the change.
3. Do NOT rename or restructure existing fields. Only add new ones.
4. The `deepCloneSlide` in the editor reducer uses `JSON.parse(JSON.stringify())` which handles new optional fields correctly (they will be `undefined` and thus omitted), but verify this.

**Detection:** Open an existing project after deploying new code. Compare with a screenshot taken before the deploy.

**Phase:** First phase, before any UI work. Define the data model extension upfront.

### Pitfall 6: Resizable Text Boxes -- Coordinate System Confusion

**What goes wrong:** The current system uses percentage-based positioning (`TextPosition` with `x: 0-100, y: 0-100`) but renders at a reference resolution of 1080x1920 with CSS `transform: scale()`. Adding resize handles introduces a width/height dimension to text boxes, which must also work in this scaled coordinate system. Resize drag deltas reported by the DOM are in screen pixels, but must be converted to reference pixels, then stored as percentages.

**Why it happens:** Three coordinate systems are in play: (1) screen pixels (what the user drags), (2) reference pixels (1080x1920 canvas), (3) percentages (stored in data model). The existing code handles this for position via the `scale` prop on `react-draggable`, but resize handles from a different library may not have built-in scale awareness.

**Consequences:** Resize handles feel "off" -- dragging 100 screen pixels moves the handle by a different visual amount depending on the canvas scale. On mobile (smaller canvas), the problem is worse. Text boxes jump or resize incorrectly.

**Prevention:**
1. Use `react-rnd` (react-resizable-and-draggable) which handles both drag and resize in a single component, with scale support.
2. OR continue with `react-draggable` and add `react-resizable`, but manually apply the scale factor to resize deltas.
3. Store text box dimensions as percentages of the canvas (width%, height%) in the data model, same as position.
4. Test at multiple canvas scales (mobile, tablet, desktop) to verify consistent behavior.
5. Add minimum size constraints to prevent text boxes from being resized to zero.

**Detection:** Resize a text box at different browser window sizes. If the resize feels faster/slower at different scales, the coordinate conversion is wrong.

**Phase:** Resizable text boxes phase. Must be carefully implemented with coordinate system awareness.

### Pitfall 7: Alignment Guides -- Snapping to Wrong Positions Due to Text Box Dimensions

**What goes wrong:** Alignment guides (snap lines like Canva/Figma) need to know the bounding box of each text element -- not just its position, but also its rendered width and height. Currently, text boxes have a position but no explicit size; their height depends on content and font size. If alignment guides calculate snapping based on the position point only (top-left corner), the visual alignment will be wrong -- elements will appear "close to center" but not actually centered.

**Why it happens:** Text box height is content-dependent and font-dependent. Without measuring the actual rendered text, the alignment system cannot know where the bottom or right edge of a text box is.

**Consequences:** "Center alignment" snaps the top-left corner to center, not the visual center of the text block. Users expect Canva-like precision but get approximate alignment.

**Prevention:**
1. Measure actual rendered text box dimensions using `getBoundingClientRect()` after the font loads and content renders.
2. Calculate snap points from the center and edges of the measured bounding box, not from the position origin.
3. Snap to: canvas center (H/V), other text box edges (top/bottom/left/right), other text box centers.
4. Use a threshold (e.g., 5-10 reference pixels) for snapping activation.
5. Show visual guide lines only when within snap threshold.

**Detection:** Add two text boxes with different content lengths. Try to center-align them. If they are visually offset, the bounding box measurement is wrong.

**Phase:** Alignment guides phase. Depends on text box dimensions being available (requires either explicit sizes from resize feature, or runtime measurement).

---

## Moderate Pitfalls

### Pitfall 8: Google Fonts API Rate Limiting and Loading Strategy

**What goes wrong:** Fetching font metadata and font files from Google Fonts on every render request (server-side) hits rate limits or adds latency. Each font family can have 10+ variants (weights x styles), and fetching all variants on every export is slow.

**Prevention:**
1. Cache the Google Fonts metadata (family list, available variants) at build time or in a long-lived server cache.
2. Cache font file ArrayBuffers in memory (they are immutable, ~50-200KB each).
3. Only fetch the specific variants used in the slide (not all variants of a family).
4. Bundle the 5-10 most popular fonts with the app to avoid network requests entirely.
5. The Google Fonts API key has a daily quota -- monitor usage.

**Phase:** Font picker + server-side rendering integration phase.

### Pitfall 9: Font Picker UI Overwhelming Users

**What goes wrong:** Google Fonts has 1,500+ families. Showing all of them in a dropdown creates an unusable UI. Loading font previews for all of them consumes bandwidth and memory.

**Prevention:**
1. Curate a list of 30-50 fonts that work well for social media content (readable at mobile sizes, have bold/italic variants).
2. Show font previews using the actual font (lazy-load font files as user scrolls).
3. Add a search/filter to find fonts by name.
4. Group by category: sans-serif, serif, display, handwriting.
5. Show which fonts have bold/italic variants available.

**Phase:** Font picker UI phase. Design decision, not a technical blocker.

### Pitfall 10: Undo/Redo Stack Bloat with Frequent Style Changes

**What goes wrong:** The current undo/redo system stores full slide array snapshots (`Slide[][]`). Every font change, color pick, or resize drag pushes a new snapshot. Using a color picker (which fires on every mouse move) can generate hundreds of undo states per second.

**Prevention:**
1. Debounce style changes before pushing to undo stack. Only commit to history on `onChangeComplete` (color picker), `onStop` (resize), or `onChange` with a 300ms debounce (font selector).
2. The current `MAX_HISTORY = 50` provides a cap, but rapid changes will flush meaningful history.
3. Consider coalescing consecutive changes of the same type (e.g., multiple font-size adjustments before moving on).

**Phase:** All phases. Must be considered when implementing any new interactive control.

### Pitfall 11: Bold/Italic Partial Text (Rich Text Within a Text Box)

**What goes wrong:** If bold/italic is implemented per-text-box (the whole box is bold or not), it is straightforward. If the intent is to allow bold/italic on individual words WITHIN a text box (rich text), the complexity explodes. Satori supports inline `<span>` elements with different styles, but the editor needs a rich text editing engine (contenteditable, Slate, TipTap, etc.).

**Prevention:**
1. Start with per-text-box styling: the entire hook or body text is bold/italic/normal. This maps cleanly to the current data model (`font_weight` and `font_style` on `SlideStyleOverrides`).
2. Do NOT add inline rich text (per-word bold) in v1.3. It requires a rich text editor, a more complex data model (serialized rich text nodes instead of plain strings), and Satori JSX generation from rich text nodes.
3. If rich text is needed later, use TipTap (modern, React-native, good API) and serialize to a portable format.

**Phase:** v1.3 should be per-text-box only. Rich text is a v2 feature.

---

## Minor Pitfalls

### Pitfall 12: Font Family String Format Inconsistency

**What goes wrong:** Templates store `fontFamily` as CSS strings like `"'Inter', sans-serif"`. The brand kit stores `font_family` as a plain name like `"Inter"`. The merge function wraps it: `'${brandKit.font_family}', sans-serif`. If the font picker stores the value differently (e.g., `"Inter"` vs `"inter"` vs `"'Inter'"` vs `"Inter, sans-serif"`), comparisons and lookups break.

**Prevention:** Normalize to a canonical format. Store the Google Fonts family name exactly as the API returns it (e.g., `"Inter"`, `"Playfair Display"`). Convert to CSS string only at render time.

### Pitfall 13: Mobile Touch Targets for Resize Handles

**What goes wrong:** Resize handles that work fine with a mouse cursor are too small for touch on mobile. The current app targets mobile-first (TikTok creators on phones).

**Prevention:** Make resize handles at least 44x44px touch target (iOS HIG). Consider showing handles only when the text box is selected, to avoid visual clutter.

### Pitfall 14: Template hookStyle Conflicts with New Bold/Italic Controls

**What goes wrong:** Templates already have `hookStyle: 'uppercase' | 'normal' | 'italic'` which forces italic on the hook text. If the user also has a bold/italic toggle, the interaction between template `hookStyle` and user `font_style` override is ambiguous. Does the user's choice override the template? Are they additive?

**Prevention:** Define clear precedence: `slide.style_overrides.font_style` overrides `template.hookStyle` for italic. If the user explicitly sets font_style, use it. If not set (undefined), fall back to template hookStyle. Document this in code comments.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Font picker UI | Font loading FOUT (Pitfall 4), overwhelming choices (Pitfall 9) | Preload popular fonts, curate list, use `document.fonts.load()` |
| Font rendering in export | Missing font files in Satori (Pitfall 1), no bold/italic synthesis (Pitfall 2) | Build server-side font registry, load variant files per-render |
| Bold/italic controls | Scope creep to inline rich text (Pitfall 11), template conflict (Pitfall 14) | Per-text-box only, clear override precedence |
| Data model changes | Breaking existing projects (Pitfall 5), format inconsistency (Pitfall 12) | All new fields optional with fallbacks, normalize font names |
| Resizable text boxes | Coordinate system confusion (Pitfall 6), undo stack bloat (Pitfall 10) | Use react-rnd with scale, debounce history pushes |
| Alignment guides | Wrong snap due to unknown box size (Pitfall 7) | Measure rendered bounding boxes, snap from center/edges |
| Browser/export parity | Text layout drift (Pitfall 3) | Use same font files, test extensively, consider Satori-based preview |

## Existing Codebase Issue (Pre-existing)

The current render route (`src/app/api/render/route.ts`) creates `ImageResponse` with **no `fonts` option**. Templates specify `fontFamily` strings like `'Inter', sans-serif` but no font files are loaded server-side. This means exports are already rendering in Satori's default font (Noto Sans), not the template's specified font. **This must be fixed before adding a font picker** -- it is the foundation that all font work builds on.

```typescript
// Current code (line 87-90 of route.ts) -- no fonts passed:
const imageResponse = new ImageResponse(element, {
  width: 1080,
  height: 1920,
})

// Required fix:
const imageResponse = new ImageResponse(element, {
  width: 1080,
  height: 1920,
  fonts: [
    { name: 'Inter', data: interRegularBuffer, weight: 400, style: 'normal' },
    { name: 'Inter', data: interBoldBuffer, weight: 700, style: 'normal' },
    // ... all needed variants
  ],
})
```

## Sources

- [Satori README -- supported CSS, font requirements](https://github.com/vercel/satori/blob/main/README.md)
- [Satori font weight resolution issue #263](https://github.com/vercel/satori/issues/263)
- [Satori text and fonts -- DeepWiki](https://deepwiki.com/vercel/satori/3.3-text-and-fonts)
- [Next.js ImageResponse docs](https://nextjs.org/docs/app/api-reference/functions/image-response)
- [Using custom fonts in OG Image -- Vercel KB](https://vercel.com/kb/guide/using-custom-font)
- [Custom Fonts causing fetch errors -- Satori discussion #662](https://github.com/vercel/satori/discussions/662)
- [react-rnd -- resizable and draggable component](https://github.com/bokuweb/react-rnd)
- [Satori CSS support -- DeepWiki](https://deepwiki.com/vercel/satori/4-advanced-usage)
