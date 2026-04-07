---
phase: quick
plan: 260406-umb
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/editor/text-editor-panel.tsx
  - src/components/slides/slide-preview.tsx
  - src/lib/render/render-slide-satori.tsx
  - src/lib/render/render-slide.ts
  - src/lib/types/slide.ts
  - src/lib/render/resolve-styles.ts
autonomous: true
must_haves:
  truths:
    - "Body text size slider appears in the text editor panel alongside the existing Hook Size slider"
    - "Changing body size slider updates the body text size on the canvas in real time"
    - "Exported PNGs reflect the user-chosen body font size"
    - "Text on slides has a subtle shadow for readability over background images"
    - "Text shadow toggle is available in the editor panel to turn it on/off"
  artifacts:
    - path: "src/components/editor/text-editor-panel.tsx"
      provides: "Body Size slider UI and text shadow toggle"
    - path: "src/components/slides/slide-preview.tsx"
      provides: "Text shadow rendering on canvas preview"
    - path: "src/lib/render/render-slide-satori.tsx"
      provides: "Text shadow in Satori PNG export"
    - path: "src/lib/render/render-slide.ts"
      provides: "Text shadow in HTML renderer"
  key_links:
    - from: "text-editor-panel.tsx body size slider"
      to: "slide.style_overrides.body_font_size"
      via: "onUpdate callback"
      pattern: "body_font_size.*Number.*e\\.target\\.value"
    - from: "text-editor-panel.tsx text shadow toggle"
      to: "slide.style_overrides.text_shadow"
      via: "onUpdate callback"
      pattern: "text_shadow"
---

<objective>
Add a body text size slider to the carousel editor's text panel and improve text readability by adding configurable text shadows across all renderers (preview, Satori PNG export, and HTML export).

Purpose: Users currently cannot adjust body text size (only hook size has a slider), and text is often hard to read over busy background images without any shadow or outline.
Output: Updated text editor panel with body size slider and text shadow toggle; all three renderers (preview, Satori, HTML) apply text shadow when enabled.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/editor/text-editor-panel.tsx
@src/components/slides/slide-preview.tsx
@src/lib/render/render-slide-satori.tsx
@src/lib/render/render-slide.ts
@src/lib/types/slide.ts
@src/lib/render/resolve-styles.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add text_shadow to types and resolve-styles, then add Body Size slider and text shadow toggle to text editor panel</name>
  <files>src/lib/types/slide.ts, src/lib/render/resolve-styles.ts, src/components/editor/text-editor-panel.tsx</files>
  <action>
1. In `src/lib/types/slide.ts` `SlideStyleOverrides`, add:
   - `text_shadow?: boolean` (default undefined = false, for backward compat)

2. In `src/lib/render/resolve-styles.ts`:
   - Add `textShadow: boolean` to the `ResolvedSlideStyles` interface.
   - In `resolveSlideStyles`, resolve: `const textShadow = overrides.text_shadow ?? false`
   - Include `textShadow` in the return object.

3. In `src/components/editor/text-editor-panel.tsx`:
   - Add a "Body Size" slider section immediately after the existing "Hook Size" slider (around line 186). Mirror the Hook Size pattern exactly:
     ```
     <div className="space-y-4">
       <div className="flex justify-between items-center">
         <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Body Size</span>
         <span className="text-[10px] font-bold text-[#3d0000]">
           {overrides.body_font_size ?? template.bodyFontSize}
         </span>
       </div>
       <input type="range" min={12} max={56} step={2}
         value={overrides.body_font_size ?? parseInt(template.bodyFontSize)}
         onChange={(e) => onUpdate({ style_overrides: { ...overrides, body_font_size: Number(e.target.value) } })}
         className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
       />
     </div>
     ```
   - Add a "Text Shadow" toggle button after the "Text Align" section (before the Overlay section). Use a simple toggle button following the existing style pattern:
     ```
     <div className="space-y-3">
       <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">Text Shadow</span>
       <button
         onClick={() => onUpdate({ style_overrides: { ...overrides, text_shadow: !overrides.text_shadow } })}
         className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
           overrides.text_shadow
             ? 'bg-[#3d0000] text-white'
             : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
         }`}
       >
         {overrides.text_shadow ? 'On' : 'Off'}
       </button>
       <p className="text-[9px] text-[#7d6161]">Adds shadow behind text for readability over images</p>
     </div>
     ```
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Body Size slider and Text Shadow toggle render in the text editor panel; TypeScript compiles without errors; `text_shadow` field exists in SlideStyleOverrides and is resolved in resolve-styles.</done>
</task>

<task type="auto">
  <name>Task 2: Apply text shadow in all three renderers (preview, Satori, HTML)</name>
  <files>src/components/slides/slide-preview.tsx, src/lib/render/render-slide-satori.tsx, src/lib/render/render-slide.ts</files>
  <action>
The text shadow value to use: `0 2px 8px rgba(0,0,0,0.7)` -- this provides good readability without looking heavy.

Note: Satori supports textShadow but only a single shadow (no comma-separated multiples). Use `0 2px 8px rgba(0,0,0,0.7)` which Satori handles.

1. **slide-preview.tsx** (canvas preview):
   - Read `overrides.text_shadow` (already available via `const overrides = slide.style_overrides ?? {}`).
   - Define: `const textShadowStyle = overrides.text_shadow ? '0 2px 8px rgba(0,0,0,0.7)' : undefined`
   - Add `textShadow: textShadowStyle` to `hookTextStyle` (around line 148).
   - Add `textShadow: textShadowStyle` to `bodyTextStyle` (around line 155).
   - Also apply to custom text boxes in both editable and non-editable modes: add `textShadow: textShadowStyle` to each custom text `style` block (around lines 310 and 599).

2. **render-slide-satori.tsx** (Satori PNG export):
   - Read `overrides.text_shadow` from the overrides object already destructured at top.
   - Define: `const textShadowValue = overrides.text_shadow ? '0 2px 8px rgba(0,0,0,0.7)' : undefined`
   - Add `textShadow: textShadowValue` to `hookStyle` (around line 98).
   - Add `textShadow: textShadowValue` to `bodyStyle` (around line 118).
   - Add `textShadow: textShadowValue` to each custom text div style (around line 170).

3. **render-slide.ts** (HTML export):
   - In `buildSlideHtml`, read `overrides.text_shadow`.
   - Define: `const textShadowCss = overrides.text_shadow ? 'text-shadow: 0 2px 8px rgba(0,0,0,0.7);' : ''`
   - Add `${textShadowCss}` to the hook text CSS styles and body text CSS styles in the HTML template string.
   - Add `${textShadowCss}` to each custom text div's inline style.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npx tsc --noEmit 2>&1 | head -30 && npm test -- --run 2>&1 | tail -20</automated>
  </verify>
  <done>Text shadow renders on hook, body, and custom text in all three renderers when text_shadow override is true. Exported PNGs include text shadow. TypeScript compiles cleanly and existing tests pass.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles with no errors: `npx tsc --noEmit`
2. Existing tests pass: `npm test -- --run`
3. Visual verification: Open the editor, confirm Body Size slider appears below Hook Size, adjusting it changes body text size on canvas. Text Shadow toggle appears and applies shadow to all text when enabled.
</verification>

<success_criteria>
- Body Size slider visible in text editor panel between Hook Size and Hook Color sections
- Dragging Body Size slider updates body text font size in real-time on canvas
- Text Shadow toggle button appears in text editor panel
- When text shadow is on, hook text, body text, and custom texts all show shadow in preview
- Exported PNGs (via Satori) include text shadow when enabled
- All existing tests pass, no TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260406-umb-improve-text-readability-and-add-body-te/260406-umb-SUMMARY.md`
</output>
