---
quick_id: 260517-iiy
title: Move Text Background control to Text tab, fix tight highlight + drop padding slider, add height control to Caption Card
mode: quick
type: execute
status: planned
created: 2026-05-17
tasks_total: 4
files_modified:
  - src/components/editor/elements-panel.tsx
  - src/components/editor/slide-editor.tsx
  - src/components/editor/text-rail/text-background-controls.tsx
  - src/components/editor/text-rail/ActiveTextBoxCard.tsx
  - src/components/editor/text-rail/__tests__/text-background-controls.test.tsx
  - src/components/editor/__tests__/elements-panel-decoration-card.test.tsx
  - src/components/editor/slide-background-controls.tsx
  - src/components/editor/__tests__/slide-background-controls.test.tsx
  - src/lib/types/slide.ts
  - src/lib/render/resolve-overlay.ts
  - src/lib/render/render-slide.ts
  - src/lib/render/render-slide-satori.tsx
  - src/components/slides/slide-preview.tsx
  - src/lib/render/__tests__/background-color-override.test.tsx
must_haves:
  truths:
    - "The Text Background (highlight) control appears ONLY on the TEXT tab — never on the ELEMENTS tab."
    - "The highlight control shows Tight + Full style pills and NO padding slider."
    - "Selecting Tight renders an inline pill that hugs each line of text — not a horizontal bar — identically on canvas and PNG export."
    - "The Caption Card (formerly 'Slide Background') has a height slider that moves the photo/panel boundary up and down."
    - "The renamed card's visible title reads 'Caption Card'."
  artifacts:
    - path: src/components/editor/text-rail/text-background-controls.tsx
      provides: "Highlight control with padding slider removed"
    - path: src/lib/types/slide.ts
      provides: "SlideStyleOverrides.news_image_height numeric override"
    - path: src/lib/render/resolve-overlay.ts
      provides: "Per-line tight-highlight pill rendering shared by canvas + Satori"
  key_links:
    - from: src/components/editor/elements-panel.tsx
      to: TEXT tab only
      via: "textBackgroundCard const deleted from both render modes"
    - from: src/components/editor/slide-background-controls.tsx
      to: NEWS_LAYOUT imageHeight
      via: "style_overrides.news_image_height resolved in all 3 render paths"
---

<objective>
Four reworks of two editor right-rail control cards added earlier today:

1. Remove the duplicate "Text Background" (highlight) card from the ELEMENTS tab so the highlight control lives in exactly ONE place — the TEXT tab's `ActiveTextBoxCard`.
2. On the highlight control: remove the padding SLIDER (keep `padding` in the data model with a fixed default), and fix the broken `tight` style so it renders inline per-line pills hugging the text instead of a horizontal bar — holding canvas↔Satori↔HTML render parity.
3. Add a HEIGHT slider to the (renamed) Caption Card that moves the constrained news-photo / caption-panel boundary.
4. Rename the "Slide Background" card title to "Caption Card".

Purpose: the user wants the highlight control where text editing lives, a working tight pill, control over the caption panel size, and a clearer card name.
Output: one TEXT-tab highlight control (no padding slider, working tight), an additive `news_image_height` override resolved in 3 render paths, and a renamed Caption Card with a height slider.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260517-fu9-surface-the-missing-text-background-colo/260517-fu9-SUMMARY.md
@.planning/quick/260517-h8z-add-a-control-to-edit-the-bottom-card-ba/260517-h8z-SUMMARY.md

<investigation_findings>
Grounded in code (file:line):

CHANGE 1 — current state of the highlight control:
- The highlight control ALREADY exists on the TEXT tab inside `ActiveTextBoxCard.tsx:590-604` — an `<EffectRow label="Highlight">` rendering `<TextBackgroundControls>` (`ActiveTextBoxCard.tsx:600-603`), with its own `DEFAULT_HIGHLIGHT` (`ActiveTextBoxCard.tsx:55-60`) and `setHighlight` merge (`ActiveTextBoxCard.tsx:148-156`).
- It ALSO renders on the ELEMENTS tab as `textBackgroundCard` (`elements-panel.tsx:160-182`), mounted at BOTH `elements-panel.tsx:257` (selection mode) and `:348` (library mode). Wired from `slide-editor.tsx` via `activeTextBox` + `onTextBoxHighlightUpdate` props (`elements-panel.tsx:122-126`).
- => CHANGE 1 = DELETE the ELEMENTS-tab copy. The TEXT-tab control is already present and clearly labeled "Highlight". No new card needed. The shared `TextBackgroundControls` component stays (TEXT tab uses it).

CHANGE 2a — padding slider removal:
- The padding slider is `text-background-controls.tsx:90-108` (`data-testid="highlight-padding"`, range 4-24 step 2).
- `DEFAULT_HIGHLIGHT.padding = 8` (`ActiveTextBoxCard.tsx:59`) and `DEFAULT_TEXT_BG.padding = 8` (`elements-panel.tsx:56`) — confirmed fixed default = 8.
- `TextHighlightEffect.padding` (`slide.ts:108`) STAYS in the model — legacy slides keep their stored padding; the UI just stops exposing the slider. New highlight edits via `setHighlight` already merge onto the existing effect, so `padding` is untouched when not in the partial.

CHANGE 2b — the `tight` bug ROOT CAUSE (the hard part):
- Canvas (`slide-preview.tsx`): `tight` wraps text in ONE `<span style={buildHighlightWrapperStyle(..., 'tight')}>` around `renderTextBlock(...)` — see `slide-preview.tsx:1194` (hook), `:1215` (body), `:1370` / `:1971` / `:2282` / `:2622` (other slots).
- `buildHighlightWrapperStyle(..., 'tight')` (`resolve-styles.ts:242-249`) returns `{ backgroundColor, padding, boxDecorationBreak:'clone' }` on that single span.
- `renderTextBlock` (`resolve-overlay.ts:250-308`) FAST-PATHS for non-list text (`resolve-overlay.ts:260-262`) to `renderSegments`, which for SEGMENT-LESS text returns the **bare text string** (`resolve-overlay.ts:168`). So the wrapper `<span>` contains a single text node and is a default-`display:inline` span.
- ROOT CAUSE: `box-decoration-break:clone` only yields per-line pills when the inline box ACTUALLY breaks across lines via inline flow. Here the wrapper span sits inside the hook/body `<div>` whose width comes from `hookWidth%` (`slide-preview.tsx:1185`); the plain text breaks by the CONTAINER's width, and the single inline span with `padding` on all four sides renders as one continuous padded inline run — visually a horizontal bar/strip — NOT one pill per visual line. (Multi-line `\n` text is even worse: `renderSegments` returns one string with `\n`, which collapses to a single line in flex/inline context.) `full` is unaffected because its background is on the container `<div>` (`slide-preview.tsx:1188-1190`).
- HTML renderer (`render-slide.ts:103-122`): `highlightCSS(..., 'native')` for `tight` sets `spanWrap:true` + `box-decoration-break:clone` on a span wrapping `renderSegments` output (`render-slide.ts:341-345`). Same single-span structure — same bug class.
- Satori (`render-slide-satori.tsx:94-106`): `satoriHighlightStyle` ALWAYS falls back to full-width for tight ("REND-04: tight not supported without box-decoration-break", `render-slide-satori.tsx:96-101`). So today tight ≠ parity: Satori draws full-width, canvas draws a bar.
- FIX DIRECTION: `tight` must wrap EACH visual line (split on `\n`) in its OWN `inline-block` padded span so each line is an independent hugging pill. This is line-deterministic (no reliance on inline flow / `box-decoration-break`), so canvas, HTML, and Satori can ALL produce identical per-line spans. Add a shared helper in `resolve-overlay.ts` (e.g. `renderTightHighlight(text, segments, ..., highlight)`) that returns a `flex-direction:column` container of one `inline-block` padded span per line — mirroring the existing list-rendering pattern at `resolve-overlay.ts:272-307`. All three render paths call the shared helper for `tight`; `full` paths are untouched. This satisfies TPLREND-05 (canvas == Satori == HTML) and removes the Satori full-width fallback.

CHANGE 3 — height control / NEWS_LAYOUT:
- `NEWS_LAYOUT` is triplicated, byte-identical: `slide-preview.tsx:101-104`, `render-slide-satori.tsx:48-51`, `render-slide.ts:33-36`. `cover: { imageTop:0, imageHeight:55, hookY:60, bodyY:84 }`.
- The constrained photo height is consumed at: `slide-preview.tsx:962` (`newsBgImageNode` `height: ${newsZone.imageHeight}%`), `render-slide-satori.tsx:380` (`height: pxY(newsZone.imageHeight)`), `render-slide.ts:242` (`height:${newsZone.imageHeight}%`). `newsZone` is `NEWS_LAYOUT[overrides.layout]` (`slide-preview.tsx:783-786`, `render-slide-satori.tsx:182-185`, `render-slide.ts:206-207`).
- The caption panel is whatever the photo does NOT cover (no separate panel element — the slide background shows through below the photo; recolored by h8z's `background_color`).
- DECISION: add additive optional `SlideStyleOverrides.news_image_height` (number, percent). Resolve in all 3 paths as `overrides.news_image_height ?? newsZone.imageHeight` so a slide WITHOUT the override renders byte-identically (TPLREND-05). Clamp to a sane range (e.g. 20-80) at resolve time to bound a hand-edited payload.
- DECISION (text Y-positions): keep text positions INDEPENDENT — `hookY`/`bodyY` continue to come from `NEWS_LAYOUT` preset (unchanged), and the user already drags text freely. Moving only the photo/panel boundary keeps scope tight and avoids touching `resolve-styles.ts` hookY/bodyY logic. State this explicitly in the Caption Card helper text is not required, but the slider only moves the boundary.

CHANGE 4 — rename:
- Card title string `Slide Background` is `slide-background-controls.tsx:78`. Helper text `slide-background-controls.tsx:82`.
- `data-testid="slide-background-controls"` (`:75`) and the swatch testids (`:98`, `:114`, `:127`) are referenced by `slide-background-controls.test.tsx` (h8z). DECISION: keep `data-testid` values STABLE (test-bearing — renaming them is churn with no user benefit; the user cares about the visible LABEL). Component filename stays `slide-background-controls.tsx` (optional polish skipped — judged not worth the import churn across `elements-panel.tsx`). Only the visible title + helper text change.
</investigation_findings>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove the Text Background card from the Elements tab (Change 1)</name>
  <files>src/components/editor/elements-panel.tsx, src/components/editor/slide-editor.tsx, src/components/editor/__tests__/elements-panel-decoration-card.test.tsx</files>
  <action>
The highlight control already lives on the TEXT tab (`ActiveTextBoxCard.tsx:590-604`). Delete the ELEMENTS-tab duplicate so it exists in exactly ONE place.

In `elements-panel.tsx`:
- Delete the `textBackgroundCard` const (`elements-panel.tsx:154-182`) and both `{textBackgroundCard}` mount sites (`:257` selection mode, `:348` library mode).
- Delete the now-unused `DEFAULT_TEXT_BG` const (`:51-56`).
- Delete the `activeTextBox` and `onTextBoxHighlightUpdate` props from `ElementsPanelProps` (`:118-126`), the destructure (`:151-152`), and the `TextBox` / `TextHighlightEffect` type imports if they become unused (check `:31` — `Slide` is still used; remove only the now-dead names).
- Delete the `TextBackgroundControls` import (`:25`) — it is only referenced by the deleted card. (The component file itself STAYS — the TEXT tab still imports it.)

In `slide-editor.tsx`:
- Remove the `activeTextBox` computation (the `currentSlide.text_boxes.find(tb => tb.id === selectedTextBoxId)` added by fu9) and the `onTextBoxHighlightUpdate` wiring at the `<ElementsPanel>` mount. Grep `slide-editor.tsx` for `onTextBoxHighlightUpdate` and `activeTextBox` to find the exact lines; delete the prop pass-through and the now-orphaned `activeTextBox` local if nothing else uses it.

In `elements-panel-decoration-card.test.tsx`:
- Delete the 5 tests fu9 added for the Text Background card (card visible with text box / absent without / appears without slide+template guard / merged highlight dispatch / coexists with selection mode — grep the file for `elements-text-background-card` and `Text Background`). The remaining decoration-card tests must still pass.

Do NOT touch `text-background-controls.tsx`, `ActiveTextBoxCard.tsx`, or any renderer in this task.
  </action>
  <verify>
    <automated>npx vitest run src/components/editor/__tests__/elements-panel-decoration-card.test.tsx && grep -rn "elements-text-background-card\|onTextBoxHighlightUpdate" src/components/editor/elements-panel.tsx src/components/editor/slide-editor.tsx | grep -v '^#' | wc -l | grep -qx '       0' && echo "no elements-tab highlight refs remain"</automated>
  </verify>
  <done>The Text Background card is gone from the Elements tab (both render modes); `elements-panel.tsx` and `slide-editor.tsx` have zero references to `textBackgroundCard` / `onTextBoxHighlightUpdate` / `elements-text-background-card`; decoration-card tests pass; the TEXT-tab "Highlight" EffectRow is untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Remove the padding slider from the highlight control (Change 2a)</name>
  <files>src/components/editor/text-rail/text-background-controls.tsx, src/components/editor/text-rail/__tests__/text-background-controls.test.tsx</files>
  <action>
Remove the padding SLIDER from the UI. The `TextHighlightEffect.padding` data field STAYS (`slide.ts:108`) — legacy slides keep their stored padding; new edits keep whatever `padding` is already on the effect (the `setHighlight` merge in `ActiveTextBoxCard.tsx:148-156` never includes `padding` in the partial unless the slider sends it, so removing the slider means new edits inherit the existing or default `padding` of 8).

In `text-background-controls.tsx`:
- Delete the entire padding `<div className="space-y-1">` block (`:90-108`) — the label, the px readout, and the `<input type="range" data-testid="highlight-padding">`.
- Update the file's top doc comment (`:3-18`) to drop the "+ a padding slider" claim — the control is now a color row + a Tight/Full toggle.
- The fixed default padding is 8 (already `DEFAULT_HIGHLIGHT.padding` at `ActiveTextBoxCard.tsx:59`) — no code change needed; just confirm `ActiveTextBoxCard.tsx`'s `DEFAULT_HIGHLIGHT` stays at `padding: 8`. New highlight effects created from that default get padding 8; the renderers (after Task 3) use a built-in inset so tight still has breathing room.

In `text-background-controls.test.tsx`:
- Delete the "padding change → onChange padding" test (grep for `highlight-padding`). Keep the swatch-render, swatch-click, and style-toggle tests.

Do NOT remove the `padding` field from `TextHighlightEffect`. Do NOT change `setHighlight`.
  </action>
  <verify>
    <automated>npx vitest run src/components/editor/text-rail/__tests__/text-background-controls.test.tsx src/components/editor/text-rail/__tests__/ActiveTextBoxCard.test.tsx && grep -c "highlight-padding" src/components/editor/text-rail/text-background-controls.tsx | grep -qx 0 && grep -q "padding: number" src/lib/types/slide.ts && echo "slider gone, data field kept"</automated>
  </verify>
  <done>The padding slider (`highlight-padding` testid) no longer exists in `text-background-controls.tsx`; `TextHighlightEffect.padding` still exists in `slide.ts`; `text-background-controls.test.tsx` and `ActiveTextBoxCard.test.tsx` pass; the Tight/Full toggle and color row remain.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Fix the broken tight highlight — per-line pills with canvas/Satori/HTML parity (Change 2b)</name>
  <files>src/lib/render/resolve-overlay.ts, src/components/slides/slide-preview.tsx, src/lib/render/render-slide.ts, src/lib/render/render-slide-satori.tsx</files>
  <behavior>
    - Tight highlight on a single-line text renders ONE inline-block padded pill hugging that line's text width (not the full container width).
    - Tight highlight on a multi-line (`\n`-separated) text renders ONE padded pill PER line, each hugging its own line — never a single full-width strip.
    - The same `tight` text produces structurally identical markup in slide-preview canvas, render-slide HTML, and render-slide-satori SVG (TPLREND-05).
    - A slide with `highlight.style === 'full'` is byte-identical before and after this task (no regression to the full path).
    - A slide with NO highlight effect is byte-identical before and after.
  </behavior>
  <action>
ROOT CAUSE (confirmed, see investigation_findings): today `tight` wraps text in ONE inline `<span>` with `box-decoration-break:clone`. For segment-less plain text `renderSegments` returns a bare string, so the span is a single padded inline run that renders as a horizontal bar — `box-decoration-break` never gets multiple inline line-boxes to clone onto. Satori has no `box-decoration-break` at all and silently falls back to full-width (`render-slide-satori.tsx:96-101`), so today tight is also non-parity.

FIX: render `tight` as one `inline-block` padded span PER VISUAL LINE, deterministically (split text on `\n`), in a `flex-direction:column` container — mirroring the existing list-rendering pattern at `resolve-overlay.ts:272-307`. This is line-exact and needs no `box-decoration-break`, so all three render paths produce identical structure.

Step 1 — shared helper in `resolve-overlay.ts`:
Add an exported `renderTightHighlight(text, segments, listType, listIndent, baseColor, accentColor, highlight)` that returns a React node: a `flex-direction:column` container (`display:flex`, `width:100%`, `gap` matching current line gap) whose children are, per `\n`-split line, an `inline-block`-equivalent span with `backgroundColor: highlight.color`, `padding: <FIXED_INSET>` (use a module const, e.g. `TIGHT_HIGHLIGHT_PADDING = 8` — the confirmed fixed default; the `highlight.padding` field is intentionally NOT read so the UI-removed slider has no rendered effect and legacy slides render with the consistent inset), `alignSelf` honoring text-align (left/center/right → flex-start/center/flex-end so the pill hugs and aligns correctly). Each line's text content is produced by `renderSegments(line, segmentsForLine, baseColor, accentColor)` — for segment-less text pass the line string. Reuse the per-line span construction style from `renderTextBlock` (`resolve-overlay.ts:282-306`). Keep it Satori-safe: `display:flex`, no `box-decoration-break`, span tags only (a `<div>` inside `<p>` trips hydration — see `resolve-overlay.ts:267-271`).

Step 2 — canvas (`slide-preview.tsx`):
At every `tight` branch (`:1193-1194` hook, `:1214-1215` body, `:1369-1370`, `:1970-1971`, `:2281-2282`, `:2621-2622`) replace `<span style={buildHighlightWrapperStyle(..., 'tight')}>{renderTextBlock(...)}</span>` with a call to the new `renderTightHighlight(...)` helper. The `full` branches (`:1188-1190`, `:1209-1211`, `:1916-1917`, `:2232-2233`) stay EXACTLY as-is.

Step 3 — HTML (`render-slide.ts`):
`highlightCSS(..., 'native')` tight branch (`:107-114`) currently sets `spanWrap` + `box-decoration-break`. Replace the tight rendering so the HTML path emits the same per-line padded inline-block spans (a string-building equivalent of `renderTightHighlight`). The `spanWrap` call sites are `:337-345` (hook) and `:347-355` (body) plus the custom-text site near `:266`. Keep `full` (`containerCSS` branch `:116-121`) untouched.

Step 4 — Satori (`render-slide-satori.tsx`):
`satoriHighlightStyle` (`:94-106`) currently forces full-width for tight. Change the call sites so `tight` uses the shared `renderTightHighlight` helper (Satori's CSS subset honors `display:flex` + `inline-block`, per the comment at `resolve-overlay.ts:270-271`), producing per-line pills identical to canvas. Update the `REND-04` comment to note tight is now supported via per-line spans. `full` stays on `satoriHighlightStyle`.

Step 5 — `buildHighlightWrapperStyle` in `resolve-styles.ts`: its `tight` branch (`resolve-styles.ts:242-249`) becomes dead once all callers move to `renderTightHighlight`. Leave the function (the `full-width-fallback` mode may still be referenced) but if grep confirms zero remaining `'tight'` callers, you may delete the `tight` branch — verify with grep before deleting.

TDD: write a render-parity test FIRST (RED). Extend `src/lib/render/__tests__/` with a test that, for a multi-line `tight` highlight slide, asserts (a) the canvas/Satori/HTML output each contains N per-line padded spans (not one full-width span), (b) a `full` slide and a no-highlight slide are byte-identical to the pre-change snapshots. Then implement Steps 1-5 (GREEN). Refactor only if needed.
  </action>
  <verify>
    <automated>npx vitest run src/lib/render/__tests__ src/__tests__/render src/__tests__/components/slide-preview-overlays.test.tsx && npx tsc --noEmit 2>&1 | grep -c 'error TS' | grep -qx 19 && echo "parity + 19-error baseline held"</automated>
  </verify>
  <done>Tight highlight renders one inline-block pill per visual line hugging the text in all three render paths; `full` and no-highlight slides are byte-identical to before; the render-parity test suite passes; tsc holds the 19-error baseline.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Add news-image-height override + rename card to "Caption Card" (Changes 3 & 4)</name>
  <files>src/lib/types/slide.ts, src/components/slides/slide-preview.tsx, src/lib/render/render-slide-satori.tsx, src/lib/render/render-slide.ts, src/lib/render/__tests__/background-color-override.test.tsx, src/components/editor/slide-background-controls.tsx, src/components/editor/__tests__/slide-background-controls.test.tsx</files>
  <action>
CHANGE 3 — adjustable caption-panel height via a constrained-photo-height override.

Step 1 — data model (`slide.ts`):
Add optional `news_image_height?: number` to `SlideStyleOverrides` (near `background_color`, around `slide.ts:189`). Doc-comment it mirroring `overlay_color` / `background_color`: percent height of the constrained news-carousel photo; overrides `NEWS_LAYOUT[layout].imageHeight`; falls back to the preset when unset (byte-identical legacy rendering). The caption panel is the remainder below the photo.

Step 2 — resolve in all 3 render paths (each currently reads `newsZone.imageHeight`):
- `slide-preview.tsx:962` — `newsBgImageNode` `height`: use `overrides.news_image_height ?? newsZone.imageHeight`.
- `render-slide-satori.tsx:380` — `height: pxY(...)`: same fallback.
- `render-slide.ts:242` — `height:${...}%`: same fallback.
Clamp the resolved value to [20, 80] at each site (or via a shared `clamp` — `resolve-overlay.ts:337` has one) so a hand-edited payload cannot push the photo off-canvas. When `news_image_height` is unset the expression equals the preset → byte-identical (TPLREND-05).
DECISION (text positions): do NOT touch `hookY`/`bodyY` or `resolve-styles.ts` — text positions stay independent of the boundary (the user drags text freely). The slider moves ONLY the photo/panel split.

Step 3 — height slider in the card (`slide-background-controls.tsx`):
Add a "Height" range slider ABOVE or BELOW the existing Color row, copying the preview-on-change / commit-on-release pattern from `caption-bar-controls.tsx:129-173` verbatim (local `useState` draft, `onChange` → preview patch via `onSlidePreview`, `onPointerUp`/`onMouseUp` → commit via `onSlideUpdate`). min=20 max=80 step=1, `data-testid="caption-card-height"`, `aria-label="Caption card height"`. The slider value is the PHOTO height percent; label it so the user understands larger photo = smaller caption panel (e.g. label "Photo height" with helper text, OR invert the displayed value to "Caption height" = 100 − photo% — pick whichever reads clearer and document the choice in a code comment; the stored field is always photo height percent). The draft seeds from `slide.style_overrides?.news_image_height ?? NEWS_LAYOUT.cover.imageHeight` (55) — import or inline the 55 default with a comment tying it to `NEWS_LAYOUT`.
The card needs `onSlidePreview` — `SlideBackgroundControlsProps` currently only has `onSlideUpdate` (`slide-background-controls.tsx:33-40`). Add an `onSlidePreview` prop and wire it in `elements-panel.tsx` (the panel already receives `onSlidePreview` — see `elements-panel.tsx:81`; pass `onSlidePreview ?? onSlideUpdate` to `<SlideBackgroundControls>` at `elements-panel.tsx:196-200`, mirroring how `CaptionBarControls` is wired at `:213-218`).

CHANGE 4 — rename "Slide Background" → "Caption Card":
- `slide-background-controls.tsx:78`: change the title text `Slide Background` → `Caption Card`.
- `slide-background-controls.tsx:82`: change the helper text to describe both controls, e.g. "Color and height of the panel your captions sit on."
- KEEP `data-testid="slide-background-controls"` and the swatch/palette testids (`:75`, `:98`, `:114`, `:127`) STABLE — they are test-bearing and the user cares about the visible label, not testids. Do NOT rename the component or file.

TDD: RED first. Extend `background-color-override.test.tsx` with parity tests: a slide with `news_image_height` set renders the photo at that height in all 3 paths; a slide WITHOUT it is byte-identical to the preset. Then implement (GREEN). Update `slide-background-controls.test.tsx`: change the title assertion `Slide Background` → `Caption Card`, add a test that the height slider (`caption-card-height`) dispatches a merged `style_overrides.news_image_height` patch (preview on change, commit on pointer-up) and seeds from the resolved value.
  </action>
  <verify>
    <automated>npx vitest run src/lib/render/__tests__/background-color-override.test.tsx src/components/editor/__tests__/slide-background-controls.test.tsx src/__tests__/render && npx tsc --noEmit 2>&1 | grep -c 'error TS' | grep -qx 19 && grep -q "news_image_height" src/lib/types/slide.ts && echo "height override + rename done"</automated>
  </verify>
  <done>`SlideStyleOverrides.news_image_height` exists and is resolved with a `?? preset` fallback in all 3 render paths (legacy slides byte-identical); the card title reads "Caption Card"; a working Height slider moves the photo/panel boundary; parity + control tests pass; tsc holds the 19-error baseline.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| stored project payload → renderer | A hand-edited / imported project JSON can carry out-of-range `style_overrides` values |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-iiy-01 | Tampering | `news_image_height` resolved in 3 render paths | mitigate | Clamp the resolved value to [20,80] at each render site (Task 4 Step 2) so a malicious/garbled payload cannot push the photo off-canvas or to 0/negative height. |
| T-iiy-02 | Tampering | `highlight.padding` stored field | accept | Field stays in the model but is no longer read by the renderer (Task 3 uses a fixed inset). Out-of-range stored padding has zero rendered effect — no clamp needed. |
| T-iiy-03 | Denial of Service | per-line tight-highlight rendering | accept | Line count is bounded by text length already constrained upstream; per-line span fan-out is O(lines), same order as the existing list renderer (`resolve-overlay.ts:272-307`). No new unbounded loop. |
</threat_model>

<verification>
- The highlight control exists on the TEXT tab only — `grep -rn "TextBackgroundControls" src/components/editor` shows imports in `ActiveTextBoxCard.tsx` only (not `elements-panel.tsx`).
- No `highlight-padding` testid anywhere in `src/components`.
- Render-parity suites green: `background-color-override.test.tsx`, `src/__tests__/render`, `slide-preview-overlays.test.tsx`.
- `npx tsc --noEmit` holds the documented 19-error baseline (0 new errors).
- `npm run lint:gates` passes (no closed-enum / token-budget regressions) if the project gate exists.
</verification>

<success_criteria>
- [ ] Text Background (highlight) control reachable from the TEXT tab and from nowhere else.
- [ ] Highlight control has Tight + Full pills and no padding slider; `TextHighlightEffect.padding` still in the data model.
- [ ] Tight highlight renders inline per-line pills hugging the text — identical on canvas and PNG export.
- [ ] Caption Card (renamed from "Slide Background") has a working Height slider that moves the photo/panel boundary.
- [ ] Slides without `news_image_height` render byte-identically to before (TPLREND-05).
- [ ] tsc 19-error baseline preserved; render-parity tests green.
</success_criteria>

<output>
After completion, create `.planning/quick/260517-iiy-move-text-background-control-to-text-tab/260517-iiy-SUMMARY.md`
</output>
