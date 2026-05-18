---
phase: quick-260518-htt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/slides/slide-preview.tsx
  - src/components/slides/__tests__/slide-preview.selection.test.tsx
autonomous: false
requirements: [HTT-01]
must_haves:
  truths:
    - "When nothing is selected, NO element on the editable canvas shows resize handles or a resize bounding box"
    - "Only the currently-selected element shows its resize handles / bounding box"
    - "Clicking an unselected element still selects it (and then its handles appear)"
    - "The selected element resizes and drags exactly as before"
    - "Non-editable render paths (Satori PNG / HTML export / thumbnails) still show NO chrome"
  artifacts:
    - path: "src/components/slides/slide-preview.tsx"
      provides: "Per-element selection-gated enableResizing for hook, body, custom-text, custom-image, decoration <Rnd> wrappers"
    - path: "src/components/slides/__tests__/slide-preview.selection.test.tsx"
      provides: "Regression coverage: handles hidden when unselected, shown when selected"
  key_links:
    - from: "slide-preview.tsx editable branch <Rnd> wrappers"
      to: "selection prop (Selection.ids)"
      via: "enableResizing gated on selection.ids.includes(elementId)"
      pattern: "selection.*\\.ids.*includes"
---

<objective>
In the carousel editor canvas, resize chrome (corner/edge handle dots + the resize
bounding box) currently renders on EVERY text box, custom image, and decoration at
once — regardless of what is selected. The user wants this chrome to appear ONLY on
the currently-selected element, and on NOTHING when selection is empty.

Purpose: Fixes a visual-clutter bug — the screenshot shows dashed boxes + handle dots
on the caption card AND both headline text boxes simultaneously with nothing actively
selected. This is standard Figma/Canva behavior the user expects.

Output: The 5 editable-branch `<Rnd>` wrappers in `slide-preview.tsx` gate their
`enableResizing` on per-element selection. Clicking remains the way to select.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<investigation_findings>
File under change: `src/components/slides/slide-preview.tsx` (~3400 lines). The
component has TWO render branches: a non-editable branch (early `return` at the
`if (!editable)` guard, ~line 1209) and the editable branch below it. ALL editor
chrome lives in the editable branch — non-editable paths render plain `<div>`s with
no `<Rnd>` and no handles. The fix MUST stay inside the editable branch so the
Satori PNG / HTML export / thumbnail paths remain byte-identical (STATE.md
TPLREND-05 / PARITY-01).

The editable branch renders FIVE `<Rnd>`-wrapped element types. Each has an
`enableResizing` prop. The CURRENT state of each:

1. Caption card (~line 1709..1785) — `data-testid="caption-card"`.
   ALREADY CORRECT: `enableResizing={captionCardSelected ? {top:true,...} : false}`
   and outline `captionCardSelected ? '2px solid #3d0000' : undefined`. It uses its
   OWN local state `captionCardSelected` (a `useState`, set true by the card's
   `onMouseDown`, cleared by the canvas `onPointerDownCapture`). DO NOT TOUCH the
   caption card — it is not a bug source. (The screenshot shows the card with chrome
   because it WAS selected in that capture; once the other elements stop showing
   chrome, only the card's correct gated behavior remains.)

2. Hook text `<Rnd>` (~line 1807) — `enableResizing={hookLocked || hookEditing ? false : enableResizing}`.
   BUG: never gated on selection. `enableResizing` here is the local const object
   defined at ~line 1488 (corners on, top/bottom off). `hookLocked`/`hookEditing`
   are resolved just above the `<Rnd>` in the IIFE at ~line 1791.

3. Body text `<Rnd>` (~line 2209) — `enableResizing={bodyLocked || bodyEditing ? false : enableResizing}`.
   BUG: never gated on selection. `bodyLocked`/`bodyEditing` resolved in the IIFE
   at ~line 2200.

4. Custom-text `<Rnd>` (~line 2537, inside `.map((ct) => ...)`) —
   `enableResizing={ctLocked ? false : enableResizing}`.
   BUG: never gated on selection. `ct.id` is the element id; `ctLocked` resolved
   at ~line 2534. Note `isSelected = selectedCustomTextId === ct.id` already exists
   at ~line 2522 (used only for the legacy blue outline ring).

5. Custom-image `<Rnd>` (~line 2878, inside `.map((ci) => ...)`) —
   `enableResizing={ciLocked ? false : {top:true,...}}`.
   BUG: never gated on selection. `ci.id` is the element id; `ciLocked` at
   ~line 2866; `isImageSelected = selectedCustomImageId === ci.id` at ~line 2858.

6. Decoration `<Rnd>` (~line 3188, inside `.map((d) => ...)`) —
   `data-testid={`decoration-click-target-${d.id}`}`,
   `enableResizing={d.locked === true ? false : {top:true,...}}`.
   BUG: never gated on selection. `d.id` is the element id. The decoration
   ROTATION handle (`showRotationHandle`, ~line 3163) is ALREADY correctly gated
   on `selection.primary === d.id` — leave it as-is.

THE UNIVERSAL SELECTION STATE — the `selection` prop:
The component already receives a `selection?: Selection` prop (type imported from
`@/lib/editor/use-selection-model`; shape `{ ids: string[]; primary: string | null }`).
It is destructured at ~line 585. EVERY one of the 5 element types pushes its own id
into `selection.ids` via `onSelectionChange` on click:
  - hook  onMouseDown → `onSelectionChange?.({ ids: [hookBox.id], primary: hookBox.id })`
  - body  onMouseDown → `onSelectionChange?.({ ids: [bodyBox.id], primary: bodyBox.id })`
  - custom-text  onMouseDown → `onSelectionChange?.({ ids: [ct.id], primary: ct.id })`
  - custom-image onMouseDown → `onSelectionChange?.({ ids: [ci.id], primary: ci.id })`
  - decoration   onMouseDown → `onSelectionChange?.({ ids: [d.id], primary: d.id })`
And the empty-canvas pointer-up clears it: `onSelectionChange?.({ ids: [], primary: null })`.
So `selection.ids.includes(<elementId>)` is the single correct, already-wired gate
for ALL FIVE element types. `selection` lives in React state outside reducer
history (STATE.md SEL-15) — using it as a read-only gate keeps that invariant.

BACKCOMPAT — `selection` may be undefined: Some callers (older tests, Storybook)
do not pass `selection`. The hook/body dashed ring already tolerates this. The gate
expression MUST therefore be selection-optional. Decision for this plan: when
`selection` is undefined, FALL BACK to the legacy per-element selected-id slots so
those callers keep working — see the per-element fallback in Task 1. When
`selection` IS passed (the real editor — `slide-editor.tsx` always passes it),
`selection.ids` is authoritative.

THE BOUNDING BOX vs THE HANDLE DOTS: they are NOT one mechanism.
  - The handle DOTS are rendered by react-rnd itself, driven entirely by the
    `enableResizing` prop. `enableResizing={false}` → react-rnd renders zero
    handle DOM nodes. Gating `enableResizing` fully removes the dots.
  - The dashed BOUNDING BOX outline is a CSS `outline` on the `<Rnd>` (hook/body
    via `selectionRingClass` keyed on `selectedTextBoxId`; custom-text/custom-image
    via `outline-2 outline-blue-400` keyed on `selectedCustomTextId`/
    `selectedCustomImageId`; caption card via inline `outline`). These outline
    classes are ALREADY keyed on a selected-id — they only show on the selected
    element. The decoration `<Rnd>` has NO outline class at all (its only chrome
    is the handle dots). So the bounding-box outlines are NOT a bug source; the
    bug is purely the ungated `enableResizing` handle dots. This plan therefore
    changes ONLY `enableResizing` props — no className/outline edits needed.

`resizeHandleStyles` may be left as-is on every `<Rnd>`: when `enableResizing` is
`false`, react-rnd renders no handle nodes, so the style objects are inert. Do not
remove them.
</investigation_findings>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Gate enableResizing on per-element selection for the 5 editable-branch Rnd wrappers</name>
  <files>src/components/slides/slide-preview.tsx, src/components/slides/__tests__/slide-preview.selection.test.tsx</files>
  <behavior>
    Add to src/components/slides/__tests__/slide-preview.selection.test.tsx a new
    describe block "SlidePreview — resize chrome gated on selection (quick-260518-htt)":
    - Test 1 (hook, unselected → no handles): render `<SlidePreview editable ...>`
      with a slide that has hook + body text, passing `selection={{ ids: [], primary: null }}`.
      Assert the hook `<Rnd>` exposes NO resize-handle nodes. Detection: react-rnd
      renders resize handles as descendant elements with inline `cursor` resize
      values; assert `container.querySelectorAll('[class*="resizable"] span, .react-draggable [style*="cursor: nwse-resize"], [style*="cursor: nesw-resize"], [style*="cursor: col-resize"], [style*="cursor: ew-resize"]')` is empty — OR mirror the existing caption-card test's detection (`querySelectorAll('div[style*="width: 8px"]')` for the 8px square handles; the hook/body corner handles use the 24x24 `cornerHandleHitStyle` hit zone + side `resizeHandleStyle`, so also probe for handle DOM via the resize-cursor inline styles). During RED, FIRST inspect the rendered DOM of an unselected element to choose the exact selector, then write the assertion against the real react-rnd output. The assertion must distinguish "handles present" from "handles absent".
    - Test 2 (hook, selected → handles present): same render but
      `selection={{ ids: [<hookBoxId>], primary: <hookBoxId> }}`. Assert the hook
      `<Rnd>` DOES render resize-handle nodes (the selector from Test 1 is non-empty).
    - Test 3 (decoration, unselected → no handles / selected → handles): render a
      slide with one decoration. With `selection={{ ids: [], primary: null }}` the
      decoration `<Rnd>` (`[data-testid^="decoration-click-target-"]`) has no handle
      nodes; with the decoration id in `selection.ids` it does.
    - Test 4 (custom-image, unselected → no handles): render a slide with one
      custom_image; with empty `selection`, the custom-image `<Rnd>` has no
      `div[style*="width: 8px"]` handle squares.
    Reuse the existing test file's render helpers / makeSlide-style fixtures
    (read the top of slide-preview.selection.test.tsx and the sibling
    slide-preview-caption-card.test.tsx for the established fixture + detection
    patterns — match them, do not invent a new harness).
    Run the new block — it MUST FAIL (RED) before the implementation edit, because
    today every element renders handles unconditionally.
  </behavior>
  <action>
    Implement HTT-01: gate resize-handle chrome on per-element selection.

    For EACH of the FIVE editable-branch `<Rnd>` wrappers in
    `src/components/slides/slide-preview.tsx`, change ONLY the `enableResizing`
    prop so it additionally requires the element to be selected. Compute a local
    boolean `<x>Selected` immediately before each `<Rnd>` (inside the existing IIFE
    / `.map` callback that already resolves the locked flag), then AND it into the
    existing gate.

    The selection check (selection-optional, with legacy fallback per
    investigation_findings):
      hook:   `const hookRndSelected = selection ? selection.ids.includes(hookBox.id) : (hookSelected || hookEditing)`
              where `hookBox` is the already-resolved `slide.text_boxes?.find(tb => tb.role === 'hook')`
              (the IIFE already resolves `hookLockedBox` — reuse it; its `.id` is the hook id).
              `hookSelected` is the existing const at ~line 1459.
      body:   `const bodyRndSelected = selection ? selection.ids.includes(bodyBox.id) : (bodySelected || bodyEditing)`
              using the already-resolved `bodyLockedBox.id`. `bodySelected` is the existing const at ~line 1460.
      custom-text:   `const ctRndSelected = selection ? selection.ids.includes(ct.id) : (selectedTextBoxId === ct.id || isSelected)`
      custom-image:  `const ciRndSelected = selection ? selection.ids.includes(ci.id) : isImageSelected`
      decoration:    `const dRndSelected = selection ? selection.ids.includes(d.id) : (selection?.primary === d.id)`
                     — for the no-`selection` legacy path a decoration simply
                       cannot be "selected" (decorations have no legacy single-id
                       slot), so it resolves false; that is acceptable since the
                       real editor always passes `selection`.

    Then update each `enableResizing` expression to AND the locked/editing gate
    with the selected gate. The element shows handles ONLY when it is BOTH
    unlocked/not-editing AND selected:
      hook:          `enableResizing={hookLocked || hookEditing || !hookRndSelected ? false : enableResizing}`
      body:          `enableResizing={bodyLocked || bodyEditing || !bodyRndSelected ? false : enableResizing}`
      custom-text:   `enableResizing={ctLocked || !ctRndSelected ? false : enableResizing}`
      custom-image:  `enableResizing={ciLocked || !ciRndSelected ? false : {top:true,bottom:true,left:true,right:true,topLeft:true,topRight:true,bottomLeft:true,bottomRight:true}}`
                     (keep the existing inline object literal — just add the `|| !ciRndSelected` to the false-branch condition)
      decoration:    `enableResizing={d.locked === true || !dRndSelected ? false : {top:true,bottom:true,left:true,right:true,topLeft:true,topRight:true,bottomLeft:true,bottomRight:true}}`
                     (keep the existing inline object literal — just add `|| !dRndSelected`)

    DO NOT change:
      - The caption card `<Rnd>` (~line 1709) — already correctly gated on
        `captionCardSelected`. Leave it untouched.
      - `disableDragging` on any `<Rnd>` — dragging the element body is preserved
        per the constraints; only the resize HANDLES are gated. (Click-to-select
        via `onMouseDown` is also unaffected — the element stays interactive.)
      - `resizeHandleStyles` props — inert when `enableResizing` is false; leave them.
      - The dashed/blue `outline` className expressions and the caption-card inline
        outline — already keyed on a selected-id, not a bug source.
      - The decoration rotation handle `showRotationHandle` — already gated.
      - Anything in the non-editable branch (above the `if (!editable)` return).
      - Snapping, smart guides, group bounding box, marquee, keyboard handlers.

    Add a brief comment at each edited `<Rnd>` referencing `quick-260518-htt` and
    HTT-01 explaining the per-element selection gate, matching the existing
    comment style in the file.
  </action>
  <verify>
    <automated>npx vitest run src/components/slides/__tests__/slide-preview.selection.test.tsx src/components/slides/__tests__/slide-preview-caption-card.test.tsx src/components/slides/__tests__/slide-preview-lock.test.tsx src/components/slides/__tests__/slide-preview.test.tsx</automated>
  </verify>
  <done>
    New "resize chrome gated on selection" tests pass (were RED before the
    implementation edit). Existing slide-preview, caption-card, and lock test
    suites still pass (no regression to drag/lock/caption-card behavior).
    `npx tsc --noEmit` shows no NEW errors beyond the documented 19-error baseline.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human-verify resize chrome only shows on the selected element</name>
  <what-built>
    The 5 editable-canvas `<Rnd>` element wrappers (hook text, body text, custom
    text, custom image, decoration) now render their resize handle dots ONLY when
    that specific element is selected. Clicking an element selects it; clicking
    empty canvas / off the page deselects everything. The caption card was already
    correct and is unchanged.
  </what-built>
  <how-to-verify>
    1. Start the dev server (`npm run dev`) and open a project in the carousel editor.
    2. Open a slide that has multiple elements (the headline text boxes + caption
       card, ideally also a custom image or decoration).
    3. Click on EMPTY canvas (or off the page) so nothing is selected.
       EXPECTED: NO element shows resize-handle dots or a resize bounding box —
       the canvas is clean chrome-free.
    4. Click ONE text box.
       EXPECTED: ONLY that text box shows its corner/edge handle dots + dashed
       bounding outline. Every other element shows no handles.
    5. Click a different element (another text box / image / decoration).
       EXPECTED: handles move to the newly-clicked element; the previous one goes
       chrome-free.
    6. With an element selected, drag a corner/edge handle to RESIZE it, and drag
       the element body to MOVE it.
       EXPECTED: resize + drag work exactly as before; smart-guide snapping lines
       still appear.
    7. Click empty canvas again.
       EXPECTED: all chrome disappears.
    8. (Parity sanity) Confirm exported PNG / non-editable previews still show no
       chrome — unchanged from before.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what still shows chrome incorrectly</resume-signal>
</task>

</tasks>

<verification>
- `npx vitest run src/components/slides/__tests__/` for the slide-preview suites passes.
- `npx tsc --noEmit` introduces no new errors beyond the 19-error baseline.
- Manual editor check (Task 2): chrome appears only on the selected element; empty
  selection shows no chrome anywhere; resize + drag + snapping unaffected.
</verification>

<success_criteria>
- With empty selection, no element on the editable canvas shows resize handles or
  a resize bounding box.
- Resize handles appear ONLY on the currently-selected element.
- Clicking an unselected element still selects it (and then reveals its handles).
- The selected element resizes and drags exactly as before; snapping/guides/group
  bbox/keyboard behavior unchanged.
- Non-editable render paths (Satori PNG, HTML export, thumbnails) still show no
  chrome — unchanged.
- The caption card behavior is unchanged (it was already correctly gated).
</success_criteria>

<output>
After completion, create `.planning/quick/260518-htt-hide-resize-handles-on-unselected-text-b/260518-htt-SUMMARY.md`
</output>
