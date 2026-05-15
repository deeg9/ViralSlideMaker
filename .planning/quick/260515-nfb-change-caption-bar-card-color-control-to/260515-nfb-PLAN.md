---
phase: quick-260515-nfb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/editor/caption-bar-controls.tsx
  - src/components/editor/__tests__/caption-bar-controls.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "The Caption Bar card's Color control renders a row of round preset color circles plus a circular palette-icon button"
    - "Clicking a preset swatch writes that swatch's hex to caption_bar_color via the commit dispatch"
    - "The palette-icon button opens a native custom color picker; picking a color writes its hex to caption_bar_color"
    - "The swatch matching the currently-resolved caption bar color shows an active ring"
    - "The editor still compiles and renders without errors"
  artifacts:
    - path: "src/components/editor/caption-bar-controls.tsx"
      provides: "Caption Bar card with swatch-row color picker"
      contains: "rounded-full"
  key_links:
    - from: "src/components/editor/caption-bar-controls.tsx"
      to: "caption_bar_color override"
      via: "patch({ caption_bar_color: hex }, true)"
      pattern: "caption_bar_color"
---

<objective>
Replace the single native `<input type="color">` swatch in the Caption Bar
control card's "Color" row with a swatch-row picker: a row of round preset
color circles followed by a circular palette-icon button that opens a native
custom color picker.

Purpose: The current black-rectangle native swatch is visually inconsistent
with the rest of the editor. Every other in-app color control (the
`AccentWordsDisclosure` "Highlight color" row, the now-removed Slide Settings
overlay picker) uses the round-swatch + palette-icon pattern. This brings the
Caption Bar card in line.

Output: Restyled Color row inside `caption-bar-controls.tsx` + updated tests.
This is a pure UI control swap — NO data-model change.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@src/components/editor/caption-bar-controls.tsx
@src/components/editor/text-rail/AccentWordsDisclosure.tsx
@src/components/editor/text-rail/color-swatches.ts
@src/components/editor/__tests__/caption-bar-controls.test.tsx

<interfaces>
<!-- The data contract is UNCHANGED. The swatch row must write the same hex
     value to the same field via the same dispatch the native input used. -->

Current Color row in caption-bar-controls.tsx (lines 149-160) — the thing to replace:
```tsx
{/* Color — native picker emits an explicit hex string (PCL12). */}
<div className="flex items-center justify-between">
  <span className="text-[11px] font-semibold text-[#3d0000]">Color</span>
  <input
    type="color"
    value={toColorInputValue(color)}
    data-testid="caption-bar-color"
    aria-label="Caption bar color"
    className="h-8 w-12 rounded border border-[#dbc1bc]/30 bg-white cursor-pointer"
    onChange={(e) => patch({ caption_bar_color: e.target.value }, true)}
  />
</div>
```

The resolved color value already in scope (line 63):
```tsx
const color = o.caption_bar_color ?? template.backgroundColor
```

The commit dispatch already in scope (lines 88-91):
```tsx
function patch(p: Partial<SlideStyleOverrides>, commit: boolean) {
  const next = { ...(slide.style_overrides ?? {}), ...p }
  ;(commit ? onSlideUpdate : onSlidePreview)({ style_overrides: next })
}
```

`toColorInputValue(hex)` helper (lines 45-51) already coerces a hex to the
6-digit `#RRGGBB` form `<input type="color">` requires. Keep it; the palette
input still needs it.

The analog to mirror — `AccentWordsDisclosure` "Highlight color" row
(AccentWordsDisclosure.tsx lines 125-173): N round `<button>` swatches each
`w-6 h-6 rounded-full`, active swatch gets `ring-2 ring-[#3d0000] ring-offset-1`,
then a `<label>` palette tile wrapping a `material-symbols-outlined` "palette"
glyph + an `sr-only` `<input type="color">`.

The brand palette constant — `COLOR_SWATCHES` from `color-swatches.ts`:
`['#ffffff', '#3d0000', '#7d6161', '#fadbdb']` (white, brand maroon,
grey-brown, light pink). This is the exact white / dark-maroon / grey-brown /
light-pink set the user's reference screenshot shows.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Swap the Color row for a swatch-row picker</name>
  <files>src/components/editor/caption-bar-controls.tsx</files>
  <behavior>
    - Clicking a preset swatch button calls onSlideUpdate (commit dispatch) with style_overrides.caption_bar_color set to that swatch's hex
    - Picking a color via the palette-icon's native input calls onSlideUpdate with style_overrides.caption_bar_color set to the picked hex (explicit `#`-prefixed string — PCL12)
    - The swatch whose hex matches the currently-resolved `color` value renders with an active ring
    - The card still renders null for non-`image-with-bottom-card` templates (gate unchanged)
  </behavior>
  <action>
Replace ONLY the Color row block (the `{/* Color — native picker ... */}` div,
caption-bar-controls.tsx lines 149-160) with a swatch-row picker that mirrors
the `AccentWordsDisclosure` "Highlight color" row.

DECISION (Claude's discretion, recorded): Reuse the existing exported
`COLOR_SWATCHES` constant from `src/components/editor/text-rail/color-swatches.ts`
rather than defining a new palette. `COLOR_SWATCHES` is `['#ffffff', '#3d0000',
'#7d6161', '#fadbdb']` — white, brand maroon, grey-brown, light pink — which is
exactly the white/dark-maroon/grey-brown/light-pink set in the user's reference
screenshot. No new hex values needed. Add the import:
`import { COLOR_SWATCHES } from './text-rail/color-swatches'`.

Build the new Color row:
1. Keep the section label `<span className="text-[11px] font-semibold text-[#3d0000]">Color</span>`
   on its own line (use a vertical `space-y-1`/`space-y-2` container — the swatch
   row goes BELOW the label, like the AccentWordsDisclosure "Highlight color" row,
   NOT inline-right like the old native swatch).
2. A `<div className="flex gap-3">` containing:
   - `COLOR_SWATCHES.map(...)` → for each, a round swatch `<button type="button">`:
     - `w-6 h-6 rounded-full` with focus-visible ring classes
     - active when `color.toLowerCase() === swatch.toLowerCase()` →
       append `ring-2 ring-[#3d0000] ring-offset-1`
     - `style={{ backgroundColor: swatch, border: swatch === '#ffffff' ? '1px solid #dbc1bc' : undefined }}`
       (white swatch needs a border to be visible)
     - `data-testid={`caption-bar-color-swatch-${swatch}`}`
     - `aria-label={`Set caption bar color to ${swatch}`}`, `aria-pressed={active}`, `title={swatch}`
     - `onClick={() => patch({ caption_bar_color: swatch }, true)}`
   - A circular palette-icon `<label>` tile (mirror AccentWordsDisclosure lines 152-170):
     - `w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer`
       plus `focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1`
     - `data-testid="caption-bar-color-palette"`
     - inside: a `<span className="material-symbols-outlined text-[#7d6161]" style={{ fontSize: 14 }} aria-hidden>palette</span>`
     - and a hidden `<input type="color" className="sr-only" value={toColorInputValue(color)}
       aria-label="Set custom caption bar color" data-testid="caption-bar-color"
       onChange={(e) => patch({ caption_bar_color: e.target.value }, true)} />`

KEEP the `data-testid="caption-bar-color"` on the hidden `<input type="color">`
so the existing PCL12 test (`color picker emits an explicit hex string`) keeps
passing without rewrite — the native input is still the custom-color path, just
hidden behind the palette icon.

Do NOT touch: the `patch` helper, `toColorInputValue`, the Height/Opacity
sliders, the Position radiogroup, the visibility gate, or any prop. Do NOT
change the data model, the `caption_bar_color` field, `resolveCaptionBar`, or
any renderer.

Update the file-top doc comment's Color sentence to describe the swatch row
(currently "The color picker emits explicit hex strings (PCL12).").
  </action>
  <verify>
    <automated>npx vitest run src/components/editor/__tests__/caption-bar-controls.test.tsx</automated>
  </verify>
  <done>
caption-bar-controls.tsx renders a row of round `COLOR_SWATCHES` swatch buttons
plus a circular palette-icon button (hidden native color input). Existing
caption-bar-controls tests pass — the PCL12 test still resolves
`data-testid="caption-bar-color"` to the hidden native input.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add swatch-row test coverage</name>
  <files>src/components/editor/__tests__/caption-bar-controls.test.tsx</files>
  <action>
Add tests for the new swatch row to the existing `describe('CaptionBarControls')`
block. Do NOT remove the existing PCL12 test (`color picker emits an explicit
hex string`) — it still targets `data-testid="caption-bar-color"` (the hidden
palette input) and must keep passing.

Add at least these cases:
1. "clicking a preset swatch commits caption_bar_color" — render with
   `BOTTOM_CARD_TMPL`, `fireEvent.click(screen.getByTestId('caption-bar-color-swatch-#3d0000'))`,
   assert `onSlideUpdate` was called with
   `{ style_overrides: expect.objectContaining({ caption_bar_color: '#3d0000' }) }`.
2. "the palette-icon button is present" — assert
   `screen.getByTestId('caption-bar-color-palette')` is truthy.
3. "the swatch matching the resolved color is marked active" — render a slide
   whose `style_overrides.caption_bar_color` is one of the COLOR_SWATCHES values
   (e.g. `'#3d0000'`) via `makeSlide({ style_overrides: { caption_bar_color: '#3d0000' } })`,
   assert that swatch button has `aria-pressed="true"` and the others
   `aria-pressed="false"`.

Use the existing `makeSlide` / `BOTTOM_CARD_TMPL` helpers already in the file.
  </action>
  <verify>
    <automated>npx vitest run src/components/editor/__tests__/caption-bar-controls.test.tsx</automated>
  </verify>
  <done>
All caption-bar-controls tests pass, including the new swatch-row cases and the
preserved PCL12 test.
  </done>
</task>

</tasks>

<verification>
- `npx vitest run src/components/editor/__tests__/caption-bar-controls.test.tsx` — all green
- `npm run lint:gates` — grep gates still pass (PCL12: the hidden native input
  still emits explicit hex; no `currentColor`/`inherit`/CSS-var introduced)
- `npx tsc --noEmit` — no NEW errors beyond the ~19 pre-existing baseline
- Editor compiles; the Caption Bar card on a `magazine-bold` slide shows a
  swatch row of round circles + a palette-icon button instead of the black
  native rectangle
</verification>

<success_criteria>
- The Caption Bar card's Color control is a swatch-row: round `COLOR_SWATCHES`
  preset circles + a circular palette-icon custom-color button
- Clicking a swatch or picking via the palette writes the hex to
  `caption_bar_color` via the same commit dispatch as before
- The swatch matching the resolved caption bar color shows an active ring
- No data-model / `caption_bar_color` field / `resolveCaptionBar` / renderer
  change — pure UI control swap
- No other control card touched; tsc baseline (~19 errors) unchanged; lint
  gates pass
</success_criteria>

<output>
After completion, create `.planning/quick/260515-nfb-change-caption-bar-card-color-control-to/260515-nfb-SUMMARY.md`
</output>
