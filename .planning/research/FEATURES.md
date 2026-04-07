# Feature Research: Rich Text Editing in Carousel Slide Editor

**Domain:** Design tool text editing (Canva/Figma-like carousel editor)
**Researched:** 2026-03-26
**Confidence:** HIGH (well-established UX patterns, mature ecosystem)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist when they see a text editor in a design tool. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Font picker dropdown with search | Every design tool (Canva, Figma, Adobe) has font search. Users choose fonts by name. | MEDIUM | Google Fonts API provides ~1,500 free fonts. Need curated subset (~30-50 popular fonts) for the dropdown, with search for the full library. Currently `fontFamily` is set per-template and brand kit but not per-text-box. |
| Bold toggle (B button) | Universal text formatting control. Users see it in every text editor from Google Docs to Canva. | LOW | Add `font_weight` to `SlideStyleOverrides`. Hook text is already `font-weight: 900`; need per-box override. Body text defaults to 400. Toggle between 400/700 (or 900 for hook). |
| Italic toggle (I button) | Universal text formatting control alongside bold. | LOW | Add `font_style` to `SlideStyleOverrides`. Currently `hookStyle: 'italic'` exists at template level but not user-togglable per text box. |
| Resizable text boxes with drag handles | Canva, Figma, and every design tool let you resize text boxes. Users drag corners/edges to control text width. | MEDIUM | Currently text width is calculated symmetrically from X position (`100 - hookX * 2`). Need independent width per text box. Corner handles for proportional resize, edge handles for width-only. |
| Text alignment buttons (left/center/right) | Already built. Confirming it as table stakes. | DONE | Already implemented in `text-editor-panel.tsx`. |
| Font size control | Already built via slider. Table stakes confirmed. | DONE | Already implemented for hook and body text. |
| Text color picker | Already built with swatches + custom color. | DONE | Already implemented in `text-editor-panel.tsx`. |

### Differentiators (Competitive Advantage)

Features that elevate beyond basic text editing. Not required for v1.3 but create a polished, professional feel.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Snap alignment guides (center/edge) | Visual guide lines appear when dragging text near canvas center or edges. Creates the "it just works" feel of Canva/Figma. Users feel precision without effort. | MEDIUM | Implement on `dragmove` events from existing `react-draggable`. Calculate proximity to canvas center (50%, 50%), edges, and other text boxes. Show dashed lines at 50% horizontal/vertical and at safe zone boundaries. Snap threshold ~5-10px. |
| Font preview in dropdown | Show each font name rendered in its own typeface inside the picker. Canva does this. Lets users visually browse without applying. | LOW | Lazy-load font preview CSS. Only load the font file when it appears in the scrollable list viewport. |
| Curated font categories | Group fonts by style: "Sans Serif", "Serif", "Display", "Handwritten". Faster than scrolling 1,500 fonts. | LOW | Static categorization of top ~50 fonts. Matches Canva's approach. |
| Recently used fonts | Show last 5-10 fonts at top of picker. Reduces repetitive searching. | LOW | Store in localStorage or user preferences. |
| Cross-text-box snapping | When dragging one text box, snap guides also show alignment with the other text box (hook aligns with body edge, etc.). | MEDIUM | Extension of basic snap guides. Calculate edges/centers of all text boxes, not just canvas. |
| Letter spacing control | Adjust tracking for design-forward titles. Common in Canva for headline styling. | LOW | Add `letter_spacing` to `SlideStyleOverrides`. Simple CSS property. |
| Line height control | Fine-tune vertical spacing within text blocks. | LOW | Already hardcoded (1.1 for hook, 1.5 for body). Expose as slider. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create significant complexity without proportional value for a carousel creator.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Rich text within a single text box (mixed bold/italic/color per word) | Power users want inline formatting like Google Docs. | Requires a rich text engine (Slate.js, ProseMirror, or Tiptap). Massively increases complexity. Server-side rendering with Satori becomes much harder -- Satori does not support rich text spans natively. The HTML renderer would need to parse styled spans. Undo/redo becomes complex (character-level vs box-level). For carousel slides with short text (5-15 words), per-word styling is rarely needed. | Apply bold/italic to entire text box. Users can split text into multiple boxes if they need mixed styles. |
| Custom font uploads | Users want to upload their own .ttf/.otf files. | Font hosting, validation, licensing concerns, server-side rendering needs font file access. Google Fonts covers 99% of use cases for social media carousels. | Offer 50-100 curated Google Fonts. Add brand kit font field for specific Google Font names. |
| Underline and strikethrough | Feels like a "complete" text editor should have these. | Almost never used in social media carousel design. Adds toolbar clutter. Underline is a web anti-pattern (looks like a link). | Omit. If users request, add underline only as a v2 feature. |
| Text on a path / curved text | Trendy design feature. | Very high complexity. Satori does not support SVG text paths. Would need entirely different rendering approach for server-side. | Not worth it for carousel use case. Defer indefinitely. |
| Full WYSIWYG text editing on canvas | Click text on canvas to edit inline, like Figma. | Current architecture uses separate text panel (textarea) + canvas preview. Inline editing requires contentEditable, which is notoriously buggy. The scaled canvas (`transform: scale()`) makes cursor positioning unreliable. | Keep the side-panel text editing approach. It works well for short carousel text. |
| Text effects (shadow, outline, glow) | Canva has these, users may expect them. | Each effect needs both client-side CSS preview AND server-side rendering parity. Satori supports `textShadow` but not all effects. Scope creep risk -- "just one more effect" compounds. | Defer to v1.4+. Add text shadow first (easiest, Satori-compatible), then evaluate demand. |

## Feature Dependencies

```
Font Picker
    |-- requires --> Google Fonts loading infrastructure
    |                    |-- requires --> Font loading in slide-preview.tsx (client)
    |                    |-- requires --> Font loading in render-slide.ts (server HTML)
    |                    |-- requires --> Font binary fetching for render-slide-satori.tsx (server Satori)
    |                    |-- requires --> getFontLink() update for dynamic fonts
    |
    |-- enhances --> Brand Kit font selection (existing font_family field)

Bold/Italic Toggles
    |-- requires --> SlideStyleOverrides type extension (font_weight, font_style)
    |-- requires --> slide-preview.tsx style application
    |-- requires --> render-slide.ts + render-slide-satori.tsx parity
    |-- independent of --> Font Picker (can ship separately)

Resizable Text Boxes
    |-- requires --> Per-text-box width in SlideStyleOverrides
    |-- requires --> Drag handle UI on canvas (new component)
    |-- enhances --> Existing draggable text positioning
    |-- conflicts with --> Symmetric text width calculation (100 - hookX * 2)
    |                      Must migrate to explicit width per box

Snap Alignment Guides
    |-- requires --> Draggable text boxes (already exists via react-draggable)
    |-- enhances --> Text positioning UX
    |-- independent of --> Resizable text boxes (but better together)
```

### Dependency Notes

- **Font Picker requires font loading infrastructure:** The hardest part is not the UI dropdown -- it is ensuring fonts load correctly in three places: (1) the client-side `slide-preview.tsx` for live preview, (2) the `render-slide.ts` HTML template for Puppeteer rendering, and (3) the `render-slide-satori.tsx` for Satori rendering (which requires font binary data, not CSS links). This is the riskiest dependency.
- **Bold/Italic is independent:** Can ship without font picker. Just extends `SlideStyleOverrides` and adds toolbar buttons. Low risk.
- **Resizable text boxes conflict with symmetric width:** Current `textWidth = 100 - hookX * 2` calculates width from position. Resizable boxes need independent width storage. This is a data model change that affects all three renderers.
- **Snap guides enhance dragging:** Works with existing `react-draggable` by adding visual feedback on `onDrag` events. Independent feature, no blockers.

## Milestone v1.3 Definition

### Must Ship (P1)

- [ ] **Bold/italic toggles** -- Lowest complexity, highest user expectation. Two buttons in toolbar, two new fields in `SlideStyleOverrides`. Ship first.
- [ ] **Font picker with Google Fonts** -- Core user request. Start with curated list of ~40 popular fonts with search. Must solve Satori font loading (fetch font binary from Google Fonts CDN and pass to Satori options).
- [ ] **Resizable text boxes** -- Users expect drag handles on selected text. Add width/height override to `SlideStyleOverrides`, render corner/edge handles on the canvas.
- [ ] **Snap alignment guides** -- Visual polish that makes positioning feel professional. Center lines + edge snap at minimum.

### Add After v1.3 Ships (v1.4)

- [ ] **Font preview in dropdown** -- Nice visual polish but requires lazy font loading. Add when core font picker works.
- [ ] **Letter spacing / line height controls** -- Low complexity, add when toolbar has room.
- [ ] **Text shadow** -- Most requested text effect, Satori-compatible. Evaluate demand first.
- [ ] **Recently used fonts** -- UX convenience, trivial to add once font picker exists.

### Future Consideration (v2+)

- [ ] **Custom font uploads** -- Requires font hosting infrastructure. Evaluate if Google Fonts coverage is insufficient.
- [ ] **Rich text (mixed formatting within a text box)** -- Requires rich text engine. Only if carousel text gets longer/more complex.
- [ ] **Text effects beyond shadow** -- Outline, glow, gradient text. Each needs render parity.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Bold/italic toggles | HIGH | LOW | LOW | P1 |
| Font picker (curated Google Fonts) | HIGH | MEDIUM | MEDIUM (Satori font loading) | P1 |
| Snap alignment guides | HIGH | MEDIUM | LOW | P1 |
| Resizable text boxes | HIGH | MEDIUM | MEDIUM (data model change) | P1 |
| Font preview in dropdown | MEDIUM | LOW | LOW | P2 |
| Letter spacing | MEDIUM | LOW | LOW | P2 |
| Line height control | MEDIUM | LOW | LOW | P2 |
| Recently used fonts | LOW | LOW | LOW | P2 |
| Text shadow | MEDIUM | MEDIUM | LOW | P3 |

**Priority key:**
- P1: Must have for v1.3 milestone
- P2: Should have, add in v1.4 when P1 is solid
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Canva | Figma | BigMotion (inspiration) | Our Approach |
|---------|-------|-------|------------------------|--------------|
| Font picker | Full Google Fonts + premium fonts, visual preview, categories, recently used | System fonts + Google Fonts, no preview | Limited/no font selection | Curated ~40 Google Fonts with search, visual preview deferred to P2 |
| Bold/italic | Per-character (rich text) | Per-character (rich text) | Basic/none | Per-text-box toggle (simpler, sufficient for carousel) |
| Text resize | Drag handles on all sides + corners, auto-resize option | Drag handles, auto-width/fixed-width modes | Unknown | Corner + edge handles, fixed height (auto based on content) |
| Snap guides | Center, edges, other elements, spacing guides, rotation snap | Center, edges, other elements, distribution guides | None observed | Canvas center + edges + other text box alignment |
| Text effects | Shadow, outline, glow, curved, neon, splice | Shadow only (via plugin) | None | Defer to v1.4+ (shadow first) |
| Inline editing | Click-to-edit on canvas | Click-to-edit on canvas | Unknown | Side-panel editing (simpler, avoids contentEditable bugs at scale) |

## Implementation Complexity Notes

### Font Picker -- Key Technical Challenge: Satori Font Loading

The `render-slide-satori.tsx` renderer uses Satori which requires font binary data (ArrayBuffer), not CSS `@font-face` declarations. For dynamic user-selected fonts:

1. Fetch the Google Fonts CSS to get the `.woff2` URL
2. Fetch the `.woff2` binary
3. Pass it to Satori's `fonts` option

This means the server-side render API needs to dynamically fetch and cache font files. The HTML renderer (`render-slide.ts`) is simpler -- just update the `getFontLink()` function.

**Recommendation:** Cache fetched font binaries on the server (filesystem or memory cache with LRU eviction). Google Fonts URLs are stable per font+weight combination.

### Resizable Text Boxes -- Data Model Impact

Current `SlideStyleOverrides` calculates text width from position. New model needs:

```typescript
// Add to SlideStyleOverrides
hook_width?: number    // percentage 0-100 (default: 78, matching current 100 - 11*2)
body_width?: number    // percentage 0-100
hook_height?: number   // percentage, optional (auto-height from content is usually better)
body_height?: number
```

All three renderers must honor these new fields. Existing slides without these fields should fall back to current symmetric calculation for backwards compatibility.

### Snap Guides -- Implementation Pattern

Use the `onDrag` callback from `react-draggable` (not just `onStop`):

1. On each drag frame, calculate distances to snap targets (canvas center, edges, other text box edges/centers)
2. If distance < threshold (~5px in reference coordinates), snap position to target
3. Render guide lines as absolutely-positioned `<div>` elements in the canvas layer
4. Remove guides on `onStop`

Snap targets for a 1080x1920 canvas:
- Horizontal center: x = 50%
- Vertical center: y = 50%
- Safe zone edges: x = 11%, x = 89%
- Top safe: y = 10.4%
- Other text box edges and centers

## Sources

- [Canva Help Center - Add and Edit Text](https://www.canva.com/help/add-and-edit-text/)
- [Canva Help Center - Format Text](https://www.canva.com/help/format-text/)
- [Canva Help Center - Text and Fonts](https://www.canva.com/help/text-fonts/)
- [Canva Apps SDK - Creating Text](https://www.canva.dev/docs/apps/creating-text/)
- [Canva Apps SDK - Fonts Example](https://www.canva.dev/docs/apps/examples/fonts/)
- [Next.js Font Optimization Docs](https://nextjs.org/docs/app/getting-started/fonts)
- [Next.js Dynamic Font Loading Discussion](https://github.com/vercel/next.js/discussions/40345)
- [React Konva Snap Guides Implementation](https://www.bigbinary.com/blog/shape-snapping-with-react-konva)
- [Fabric.js SnappyRect Snapping Guide](https://dinesh-rawat.medium.com/enhancing-object-snapping-in-fabric-js-introducing-the-snappyrect-class-2c406d8a4965)
- [Konva.js Resize Snapping Docs](https://konvajs.org/docs/select_and_transform/Resize_Snaps.html)
- [tldraw Infinite Canvas SDK](https://tldraw.dev/features/composable-primitives/layout-and-composition)

---
*Feature research for: Rich text editing in carousel slide editor (v1.3)*
*Researched: 2026-03-26*
