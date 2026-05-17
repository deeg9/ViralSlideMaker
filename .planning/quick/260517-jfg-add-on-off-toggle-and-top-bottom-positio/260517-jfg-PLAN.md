---
phase: quick-260517-jfg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/editor/slide-background-controls.tsx
  - src/components/editor/__tests__/slide-background-controls.test.tsx
autonomous: true
requirements: [QUICK-260517-jfg]
must_haves:
  truths:
    - "The Caption Card shows an on/off Switch labelled 'Caption panel'."
    - "The Caption Card shows a Bottom/Top radiogroup for panel position."
    - "Turning the toggle OFF removes the layout key — the slide reverts to a full-bleed photo."
    - "Turning the toggle ON sets layout to 'cover' (panel at bottom)."
    - "Selecting Top sets layout to 'body'; selecting Bottom sets layout to 'cover'."
    - "When the toggle is OFF the Color row and Photo-height slider are hidden."
  artifacts:
    - path: "src/components/editor/slide-background-controls.tsx"
      provides: "Caption Card with on/off Switch + Bottom/Top radiogroup"
      contains: "caption-card-toggle"
    - path: "src/components/editor/__tests__/slide-background-controls.test.tsx"
      provides: "Unit coverage for the toggle + position switch"
      contains: "caption-card-toggle"
  key_links:
    - from: "src/components/editor/slide-background-controls.tsx"
      to: "slide.style_overrides.layout"
      via: "patch() merging / deleting the layout key, dispatched through onSlideUpdate"
      pattern: "layout"
---

<objective>
Add two controls to the existing "Caption Card" control card (editor ELEMENTS
tab, `src/components/editor/slide-background-controls.tsx`):

1. An on/off **Switch** — turns the caption panel (the solid panel behind a
   constrained news-carousel photo) on or off. OFF = full-bleed photo, no panel.
2. A **Bottom/Top radiogroup** — chooses whether the panel sits at the bottom
   or top of the slide.

Purpose: re-surface the news-layout control that was removed with `SlideSettings`
(quick-260515-ju8), now living inside the Caption Card next to its Color +
Photo-height controls.

Output: a modified `SlideBackgroundControls` component plus expanded unit tests.
No render-path changes — both controls map onto the existing
`style_overrides.layout` field, which the 3 renderers already handle.
</objective>

<key_finding>
The existing `style_overrides.layout?: 'cover' | 'body'` field
(`src/lib/types/slide.ts:242`) carries on/off + top/bottom **cleanly** — no new
fields needed. Evidence:

- `NEWS_LAYOUT` is defined identically in all 3 render paths
  (`slide-preview.tsx:102-105`, `render-slide.ts:33-36`,
  `render-slide-satori.tsx:49-52`):
  - `cover: { imageTop: 0,  imageHeight: 55, ... }` — photo at the TOP →
    caption panel at the BOTTOM.
  - `body:  { imageTop: 50, imageHeight: 50, ... }` — photo at the BOTTOM →
    caption panel at the TOP.
- The `newsZone` gate in every renderer is truthy ONLY when `overrides.layout`
  is set: `render-slide.ts:259-260` (`overrides.layout ? NEWS_LAYOUT[...] : null`),
  `render-slide-satori.tsx:191-193`, `slide-preview.tsx:784-786`. When `layout`
  is undefined, `newsZone` is null and the slide renders the full-bleed
  background-image branch (`slide-preview.tsx:950`, `render-slide-satori.tsx:281`,
  `render-slide.ts:272`) — i.e. a full-bleed photo, NO caption panel. This is
  exactly the desired "OFF" behaviour and it is already well-defined across all
  3 paths.

So the mapping is exact and lossless:
- ON  + Bottom → `layout: 'cover'`
- ON  + Top    → `layout: 'body'`
- OFF          → `layout` key deleted (slide reverts to full-bleed photo)

No new render-path logic is required (renderers already handle
`cover`/`body`/undefined). TPLREND-05 render parity and byte-identical legacy
rendering are preserved because no renderer code changes.
</key_finding>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260517-iiy-move-text-background-control-to-text-tab/260517-iiy-SUMMARY.md

<interfaces>
<!-- Component under edit. Extracted from src/components/editor/slide-background-controls.tsx -->
SlideBackgroundControlsProps {
  slide: Slide
  template: SlideTemplate          // per-slide-resolved
  onSlideUpdate: (updates: Partial<Slide>) => void   // committing dispatch (one undo entry)
  onSlidePreview?: (updates: Partial<Slide>) => void // transient noHistory dispatch (slider drags)
}

<!-- Current merged-patch helper (slide-background-controls.tsx:104-107) -->
function patch(p: Partial<SlideStyleOverrides>) {
  const next = { ...(slide.style_overrides ?? {}), ...p }
  onSlideUpdate({ style_overrides: next })
}

<!-- Relevant field. src/lib/types/slide.ts:242 -->
// News-carousel: cover (image top, text bar bottom) vs body (text top, image bottom)
layout?: 'cover' | 'body'

<!-- Switch primitive. src/components/ui/switch.tsx — used by WatermarkControls -->
import { Switch } from '@/components/ui/switch'
// <Switch aria-label="..." checked={bool} disabled={bool} onCheckedChange={(checked) => ...} />

<!-- Bottom/Top radiogroup pattern. caption-bar-controls.tsx:273-309 — copy this markup verbatim.
     role="radiogroup" wrapper; each <button role="radio" aria-checked={active}>;
     active class: bg-[#3d0000] text-white; inactive: bg-white text-[#7d6161] border border-[#dbc1bc]/30 hover:bg-[#fadbdb] -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add on/off Switch + Bottom/Top radiogroup to the Caption Card</name>
  <files>src/components/editor/slide-background-controls.tsx, src/components/editor/__tests__/slide-background-controls.test.tsx</files>
  <behavior>
    Write/extend tests in slide-background-controls.test.tsx FIRST (RED), then implement (GREEN):
    - With `style_overrides` absent (no layout): the on/off Switch renders UNCHECKED;
      the Bottom/Top radiogroup is absent OR present-but-disabled (planner's call —
      hidden is simplest); the Color row and Photo-height slider (`caption-card-height`)
      are NOT in the DOM.
    - With `style_overrides: { layout: 'cover' }`: Switch is CHECKED; the Bottom radio
      has `aria-checked="true"`, Top has `aria-checked="false"`; Color swatches and the
      `caption-card-height` slider ARE rendered.
    - With `style_overrides: { layout: 'body' }`: Switch CHECKED; Top radio
      `aria-checked="true"`, Bottom `aria-checked="false"`.
    - Clicking the Switch while OFF → `onSlideUpdate` called once with
      `style_overrides` containing `layout: 'cover'`.
    - Clicking the Switch while ON (`layout: 'cover'`) → `onSlideUpdate` called once
      with `style_overrides` that has NO `layout` key (key deleted, not set to
      undefined — assert `'layout' in patch.style_overrides === false`). Any sibling
      override (e.g. `background_color`) is preserved in the emitted patch.
    - Clicking the "Top" radio while `layout: 'cover'` → `onSlideUpdate` with
      `style_overrides.layout === 'body'`.
    - Clicking the "Bottom" radio while `layout: 'body'` → `onSlideUpdate` with
      `style_overrides.layout === 'cover'`.
    - Existing tests (card always visible, "Caption Card" title, swatch picks,
      height slider) still pass — only gate them behind a slide that has
      `layout: 'cover'` where they assert on Color/height controls.
  </behavior>
  <action>
Modify `SlideBackgroundControls` in slide-background-controls.tsx:

1. Import the Switch: `import { Switch } from '@/components/ui/switch'`.

2. Derive state at the top of the component body (alongside the existing
   `color` / `photoHeight` derivations):
   - `const layout = slide.style_overrides?.layout` (type `'cover' | 'body' | undefined`)
   - `const captionPanelOn = layout != null`
   - `const position: 'cover' | 'body' = layout ?? 'cover'`

3. Add a `setLayout` helper next to the existing `patch()` (slide-background-controls.tsx:104):
   - ON→OFF: build `next = { ...(slide.style_overrides ?? {}) }`, then
     `delete next.layout`, then `onSlideUpdate({ style_overrides: next })`.
     DELETE the key (do not set `undefined`) so the slide is byte-identical to a
     slide that never had a caption panel.
   - OFF→ON or position change: reuse the existing `patch({ layout: value })`.

4. In the JSX, render the two new controls INSIDE the existing card `<div>`,
   placed directly under the helper `<p>` (slide-background-controls.tsx:127-129)
   and ABOVE the Color block — so the on/off + position controls are always
   visible while Color/Height move below them:

   a. **Caption panel toggle** — copy the WatermarkControls "Show watermark"
      row markup (watermark-controls.tsx:101-125): a `flex items-center
      justify-between` row with a `text-[11px] font-semibold text-[#3d0000]`
      label reading "Caption panel" and a `<Switch>`:
      ```
      <Switch
        aria-label="Caption panel"
        data-testid="caption-card-toggle"
        checked={captionPanelOn}
        onCheckedChange={(checked) =>
          checked ? patch({ layout: 'cover' }) : setLayoutOff()}
      />
      ```
      (If the `Switch` primitive does not forward `data-testid`, put the testid
      on a wrapping element or query the switch by its `aria-label` in tests —
      check `src/components/ui/switch.tsx` and adapt; do not block on it.)

   b. **Position radiogroup** — copy the Bottom/Top radiogroup verbatim from
      caption-bar-controls.tsx:273-309. Replace its values/labels with
      `{ value: 'cover', label: 'Bottom' }` and `{ value: 'body', label: 'Top' }`
      (cover = panel at bottom, body = panel at top — see <key_finding>).
      `aria-label="Caption panel position"`, `data-testid="caption-card-position-${value}"`,
      `onClick={() => patch({ layout: opt.value })}`, `active` = `position === opt.value`.
      Only render this block when `captionPanelOn` is true (hide it when OFF —
      position is meaningless with no panel).

5. **Conditionally hide the Color row and Photo-height slider when OFF.** Wrap
   the existing Color block (slide-background-controls.tsx:135-180) and the
   Photo-height block (lines 186-219) so they render only when `captionPanelOn`
   is true: `{captionPanelOn && ( ...Color... )}` and `{captionPanelOn && (
   ...Photo height... )}`. The on/off Switch and the position radiogroup stay
   visible regardless. The `heightDraft` `useState`/`useEffect` hooks
   (lines 97-100) MUST stay at the top of the component, unconditionally —
   only the JSX is gated, never the hook calls (rules-of-hooks).

Update the file's top doc comment block to note the two new controls and the
`layout`-field mapping (ON+Bottom→cover, ON+Top→body, OFF→key deleted).

Do NOT add any new field to `SlideStyleOverrides` — `layout` already exists
and already drives all 3 render paths.
  </action>
  <verify>
    <automated>npx vitest run src/components/editor/__tests__/slide-background-controls.test.tsx</automated>
  </verify>
  <done>
    All slide-background-controls tests pass: the new toggle + position tests
    plus the pre-existing card/title/swatch/height tests. The Switch flips
    `layout` on/off (OFF deletes the key), the radiogroup flips cover/body, and
    Color + Photo-height controls are hidden while OFF.
  </done>
</task>

<task type="auto">
  <name>Task 2: Typecheck + lint-gate regression check</name>
  <files>src/components/editor/slide-background-controls.tsx</files>
  <action>
Confirm no regressions outside the unit suite:

1. `npx tsc --noEmit` — must hold the documented 19-error baseline from
   quick-260517-iiy (0 NEW errors). If new errors appear, they are in this
   plan's changed file and must be fixed.
2. `npm run lint:gates` — must stay green (PARITY-05 closed-enum, token-budget,
   framing gates). No render-path files changed, so render-parity / byte-identity
   gates are unaffected — confirm anyway.
3. `grep -rn "caption_card_enabled\|caption_card_position" src/` — must return
   ZERO matches, proving no new field crept in (the `layout` field carries
   everything).

If tsc shows more than the 19 baseline errors, fix the new ones before
completing. Do not attempt to fix pre-existing baseline errors.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS" | grep -qx 19 && npm run lint:gates</automated>
  </verify>
  <done>
    tsc holds the 19-error baseline (0 new errors), lint:gates passes, and grep
    confirms no `caption_card_enabled` / `caption_card_position` field was added.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| editor UI → slide.style_overrides | User toggles write the closed-enum `layout` field |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-jfg-01 | Tampering | `style_overrides.layout` | accept | `layout` is a closed enum `'cover' \| 'body'`; the UI only ever emits those two values or deletes the key. A hand-edited payload with a bogus `layout` string falls through `NEWS_LAYOUT[overrides.layout]` to `undefined` at render time — no crash, degrades to full-bleed. No render-path change here, so the existing behaviour is unchanged. |
| T-jfg-02 | Denial of Service | full-bleed render path (OFF state) | accept | OFF deletes `layout`, routing to the pre-existing full-bleed background-image branch already exercised by every non-news slide. No new code path. |
</threat_model>

<verification>
- `npx vitest run src/components/editor/__tests__/slide-background-controls.test.tsx` — all green.
- `npx tsc --noEmit` — 19-error baseline held (0 new).
- `npm run lint:gates` — green.
- No file under `src/lib/render/` modified (confirm via `git diff --name-only`) —
  render parity / byte-identity untouched by construction.
- `grep -rn "caption_card" src/` returns nothing.
</verification>

<success_criteria>
- The Caption Card shows an on/off "Caption panel" Switch and a Bottom/Top
  position radiogroup, both reusing the established WatermarkControls /
  CaptionBarControls primitives.
- ON+Bottom → `layout: 'cover'`; ON+Top → `layout: 'body'`; OFF → `layout` key
  deleted.
- Color row and Photo-height slider are hidden while the panel is OFF.
- No new `SlideStyleOverrides` field; no render-path changes; TPLREND-05 parity
  and byte-identical legacy rendering preserved.
</success_criteria>

<output>
After completion, create
`.planning/quick/260517-jfg-add-on-off-toggle-and-top-bottom-positio/260517-jfg-SUMMARY.md`
</output>
