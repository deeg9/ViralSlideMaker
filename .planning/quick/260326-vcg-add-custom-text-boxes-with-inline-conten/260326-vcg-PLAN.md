---
type: quick
tasks: 3
estimated_effort: 45min
files_modified:
  - src/lib/types/slide.ts
  - src/lib/editor/editor-actions.ts
  - src/lib/editor/editor-reducer.ts
  - src/components/slides/slide-preview.tsx
  - src/components/editor/slide-canvas.tsx
  - src/components/editor/slide-editor.tsx
  - src/components/editor/text-editor-panel.tsx
  - src/lib/render/resolve-styles.ts
  - src/lib/render/render-slide-satori.tsx
  - src/lib/render/render-slide.ts
---

<objective>
Add custom text boxes that users can create, position, drag/resize, and edit inline on the slide canvas with full export support.

Purpose: Let users add arbitrary text elements beyond the fixed hook/body structure -- essential for CTAs, captions, credits, and creative layouts.
Output: Working custom text boxes with inline editing, sidebar formatting, and correct Satori + HTML rendering.
</objective>

<context>
@src/lib/types/slide.ts
@src/lib/editor/editor-actions.ts
@src/lib/editor/editor-reducer.ts
@src/components/slides/slide-preview.tsx
@src/components/editor/slide-canvas.tsx
@src/components/editor/slide-editor.tsx
@src/components/editor/text-editor-panel.tsx
@src/lib/render/resolve-styles.ts
@src/lib/render/render-slide-satori.tsx
@src/lib/render/render-slide.ts

<interfaces>
From src/lib/types/slide.ts:
```typescript
export interface Slide {
  hook_text: string
  body_text: string
  image_query: string
  is_cta: boolean
  background_url: string | null
  pexels_photo_id: number | null
  style_overrides?: SlideStyleOverrides
}
```

From src/lib/editor/editor-actions.ts:
```typescript
export type EditorAction =
  | { type: 'ADD_SLIDE'; index: number }
  | { type: 'REMOVE_SLIDE'; index: number }
  | { type: 'DUPLICATE_SLIDE'; index: number }
  | { type: 'REORDER_SLIDES'; from: number; to: number }
  | { type: 'UPDATE_SLIDE'; index: number; updates: Partial<Slide> }
  | { type: 'SET_SLIDES'; slides: Slide[] }
  | { type: 'UNDO' }
  | { type: 'REDO' }
```

From src/lib/render/resolve-styles.ts:
```typescript
export interface ResolvedSlideStyles { ... }
export function resolveSlideStyles(slide: Slide, template: SlideTemplate): ResolvedSlideStyles
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Data model, reducer actions, and resolve-styles for custom texts</name>
  <files>
    src/lib/types/slide.ts
    src/lib/editor/editor-actions.ts
    src/lib/editor/editor-reducer.ts
    src/lib/render/resolve-styles.ts
  </files>
  <action>
1. In `src/lib/types/slide.ts`, add a `CustomText` interface:
```typescript
export interface CustomText {
  id: string
  text: string
  x: number        // percentage 0-100
  y: number        // percentage 0-100
  width: number    // percentage 0-100
  font_family?: string
  font_size?: number    // px in 1080x1920 reference
  font_weight?: number
  font_style?: 'normal' | 'italic'
  color?: string
  text_align?: 'left' | 'center' | 'right'
}
```
Add `custom_texts?: CustomText[]` to the `Slide` interface.

2. In `src/lib/editor/editor-actions.ts`, add three new action types:
```typescript
| { type: 'ADD_CUSTOM_TEXT'; slideIndex: number }
| { type: 'UPDATE_CUSTOM_TEXT'; slideIndex: number; textId: string; updates: Partial<CustomText> }
| { type: 'REMOVE_CUSTOM_TEXT'; slideIndex: number; textId: string }
```

3. In `src/lib/editor/editor-reducer.ts`, handle the three new actions:
- `ADD_CUSTOM_TEXT`: Creates a new CustomText with `id: crypto.randomUUID()`, text "New Text", x: 20, y: 50, width: 60, font_size: 48, font_weight: 400, color: template text color (use '#ffffff' as default since we don't have template in reducer -- the slide's existing text_color override or white). Appends to the slide's `custom_texts` array (create if undefined). Use `pushHistory` for undo support.
- `UPDATE_CUSTOM_TEXT`: Finds the custom text by id in the slide's `custom_texts`, merges updates. Use `pushHistory`.
- `REMOVE_CUSTOM_TEXT`: Filters out the custom text by id. Use `pushHistory`.
- Ensure `deepCloneSlide` handles `custom_texts` (it uses JSON.parse/stringify so it already does).

4. In `src/lib/render/resolve-styles.ts`, add to the `ResolvedSlideStyles` interface:
```typescript
customTexts: Array<CustomText & { resolvedFontFamily: string }>
```
In `resolveSlideStyles`, resolve custom texts: iterate `slide.custom_texts ?? []`, for each one resolve font_family using `getFontEntry`/`getCssFallback` the same way hook/body fonts are resolved. Default font_size to 48, font_weight to 400, font_style to 'normal', color to textColor, text_align to 'left'.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>CustomText type exists, three reducer actions work with undo/redo, resolveSlideStyles outputs resolved custom texts</done>
</task>

<task type="auto">
  <name>Task 2: Canvas rendering with react-rnd drag/resize and inline contentEditable editing</name>
  <files>
    src/components/slides/slide-preview.tsx
    src/components/editor/slide-canvas.tsx
    src/components/editor/slide-editor.tsx
    src/components/editor/text-editor-panel.tsx
  </files>
  <action>
1. **slide-preview.tsx** -- Add custom text box rendering in both non-editable and editable modes:

**Non-editable mode:** After the body text block, iterate `slide.custom_texts ?? []` and render each as an absolutely positioned div with the custom text's x/y/width/font settings (same pattern as hook/body text rendering).

**Editable mode:** After the body Rnd block, iterate `slide.custom_texts ?? []` and render each as a `<Rnd>` component:
- Position: `{ x: (ct.x / 100) * REF_WIDTH, y: (ct.y / 100) * REF_HEIGHT }`
- Size: `{ width: (ct.width / 100) * REF_WIDTH, height: 'auto' }`
- Same `scale`, `bounds="parent"`, `enableResizing` (left+right only), `resizeHandleStyles` as hook/body.
- `onDragStop` calls new `onCustomTextPositionChange?(id, position)` callback.
- `onResizeStop` calls new `onCustomTextWidthChange?(id, width)` callback.
- Use alignment guides: include custom texts in the `others` array for snap calculations (also update hook/body snap to include custom texts as others).
- **Double-click to edit:** Track `editingCustomTextId` state. On double-click of a custom text Rnd, set it as editing. When editing, render a `contentEditable` div instead of plain text. The contentEditable div should:
  - Have `suppressContentEditableWarning={true}`
  - Use `onBlur` to save the `innerText` via `onCustomTextUpdate?(id, { text: innerText })`
  - Set `editingCustomTextId` to null on blur
  - Auto-focus on mount (use a ref + useEffect)
  - Prevent drag while editing by setting `disableDragging={editingCustomTextId === ct.id}` on the Rnd
- **Selected state:** Track `selectedCustomTextId` state. Clicking a custom text sets it as selected (with a visible blue outline-2). Clicking the canvas background or hook/body text clears selection. Pass `selectedCustomTextId` up via `onCustomTextSelect?(id: string | null)` callback.
- **Delete key:** When a custom text is selected (not editing), listen for Delete/Backspace keydown and call `onCustomTextRemove?(id)`.

Add new callback props to `SlidePreviewProps`:
```typescript
onCustomTextPositionChange?: (id: string, position: TextPosition) => void
onCustomTextWidthChange?: (id: string, width: number) => void
onCustomTextUpdate?: (id: string, updates: Partial<CustomText>) => void
onCustomTextSelect?: (id: string | null) => void
onCustomTextRemove?: (id: string) => void
```

2. **slide-canvas.tsx** -- Pass through the new custom text callbacks from SlideCanvas to SlidePreview. Add the same new callback props to `SlideCanvasProps` and forward them.

3. **slide-editor.tsx** -- Wire everything:
- Add `selectedCustomTextId` state (string | null, default null).
- Create handler functions that dispatch the reducer actions:
  - `handleAddCustomText`: dispatches `ADD_CUSTOM_TEXT` with `slideIndex: selectedIndex`
  - `handleCustomTextPositionChange(id, position)`: dispatches `UPDATE_CUSTOM_TEXT`
  - `handleCustomTextWidthChange(id, width)`: dispatches `UPDATE_CUSTOM_TEXT`
  - `handleCustomTextUpdate(id, updates)`: dispatches `UPDATE_CUSTOM_TEXT`
  - `handleRemoveCustomText(id)`: dispatches `REMOVE_CUSTOM_TEXT`, clears `selectedCustomTextId`
- Pass all callbacks to SlideCanvas.
- Pass `selectedCustomTextId` and the current slide's `custom_texts` to TextEditorPanel.
- Add an "Add Text" button in the slide actions bar (left panel, next to the Add Slide button). Use icon `text_fields`. On click, call `handleAddCustomText`.

4. **text-editor-panel.tsx** -- Add a "Custom Texts" section at the bottom of the panel:
- Only show when `custom_texts` exists and has items.
- Accept new props: `selectedCustomTextId?: string | null`, `customTexts?: CustomText[]`, `onCustomTextUpdate?: (id: string, updates: Partial<CustomText>) => void`, `onCustomTextRemove?: (id: string) => void`.
- When a custom text is selected (`selectedCustomTextId` matches one), show formatting controls for it:
  - Font size slider (16-120, step 2)
  - Color swatches (same `colorSwatches` array) + color picker
  - Bold toggle (400 vs 700 font_weight)
  - Italic toggle
  - Text align (left/center/right)
  - FontPicker for font family
  - Delete button (red, calls `onCustomTextRemove`)
- When no custom text is selected, show a label "Tap a custom text box on the canvas to edit its style"
- Section header: "CUSTOM TEXTS" with count badge
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Custom text boxes render on canvas, can be dragged/resized with react-rnd, double-click enables inline contentEditable editing, sidebar shows formatting controls for selected custom text, Delete key removes selected custom text, "Add Text" button creates new custom text boxes</done>
</task>

<task type="auto">
  <name>Task 3: Export rendering in Satori and HTML renderers</name>
  <files>
    src/lib/render/render-slide-satori.tsx
    src/lib/render/render-slide.ts
  </files>
  <action>
1. **render-slide-satori.tsx** (`buildSlideElement`): After the body text div, iterate `slide.custom_texts ?? []` and render each as an absolutely positioned div:
```tsx
{(slide.custom_texts ?? []).map((ct) => (
  <div
    key={ct.id}
    style={{
      position: 'absolute',
      left: pxX(ct.x),
      top: pxY(ct.y),
      width: pxX(ct.width),
      textAlign: ct.text_align ?? 'left',
      fontSize: ct.font_size ?? 48,
      fontWeight: ct.font_weight ?? 400,
      fontStyle: ct.font_style ?? 'normal',
      lineHeight: 1.3,
      color: ct.color ?? textColor,
      fontFamily: ct.font_family ?? template.fontFamily,
    }}
  >
    {ct.text}
  </div>
))}
```
Place these AFTER the body text div so they render on top (Satori has no z-index, DOM order = layer order).

2. **render-slide.ts** (`buildSlideHtml`): After the body div in the HTML template, add custom text divs:
- Add CSS classes `.custom-text-N` for each custom text in the `<style>` block (use inline styles instead for simplicity since each is unique).
- After `<div class="body">...</div>`, iterate `slide.custom_texts ?? []` and output:
```html
<div style="position:absolute; left:${ct.x}%; top:${ct.y}%; width:${ct.width}%; text-align:${ct.text_align ?? 'left'}; font-size:${ct.font_size ?? 48}px; font-weight:${ct.font_weight ?? 400}; font-style:${ct.font_style ?? 'normal'}; line-height:1.3; color:${ct.color ?? textColor}; z-index:2; font-family:${ct.font_family ?? template.fontFamily};">${escapeHtml(ct.text)}</div>
```
- Also update `getFontLink` usage: if custom texts use different font families, generate additional `<link>` tags for those fonts. Add a helper that collects all unique font families from slide (template + custom texts) and generates font links.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Custom text boxes appear in exported PNG images (Satori) and HTML renders at correct positions with correct styling. Additional font links generated for custom text font families.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit`
2. Dev server runs: `npm run dev` -- navigate to editor, create a slide
3. Add custom text: Click "Add Text" button, see new text box on canvas
4. Drag and resize: Drag the custom text box, resize width handles
5. Inline edit: Double-click custom text, type new content, click away
6. Sidebar formatting: Click custom text, adjust font/size/color/bold/italic in sidebar
7. Delete: Select custom text, press Delete key
8. Export: Download slide as PNG, verify custom text appears correctly
9. Undo/redo: Add text, undo, verify it disappears, redo, verify it returns
</verification>

<success_criteria>
- Users can add, edit, drag, resize, format, and delete custom text boxes
- Custom texts persist in slide data and survive undo/redo
- PNG export (Satori) renders custom texts at correct positions
- HTML renderer includes custom texts with correct styling
- No regressions to existing hook/body text functionality
</success_criteria>
