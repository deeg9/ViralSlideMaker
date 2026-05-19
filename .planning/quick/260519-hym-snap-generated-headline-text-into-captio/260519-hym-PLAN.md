---
phase: quick-260519-hym
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/ai/caption-card-text-snap.ts
  - src/lib/ai/__tests__/caption-card-text-snap.test.ts
  - src/lib/ai/generate-slides.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "A generated slide with caption_bar_enabled === true has its headline (hook) text box positioned inside the caption card's geometry"
    - "The headline is anchored toward the top of the caption card; body text sits below it"
    - "The snap works for both caption_bar_position: 'bottom' and 'top' cards"
    - "Slides without caption_bar_enabled render byte-identical to pre-change (no hook_position/body_position injected)"
    - "The snap targets the same y-geometry the renderer's resolveCaptionBar produces"
  artifacts:
    - path: "src/lib/ai/caption-card-text-snap.ts"
      provides: "Pure reusable caption-card -> hook/body text-position helper"
      contains: "computeCaptionCardTextPositions"
    - path: "src/lib/ai/__tests__/caption-card-text-snap.test.ts"
      provides: "Vitest coverage for the snap helper + the generate-slides wiring"
    - path: "src/lib/ai/generate-slides.ts"
      provides: "Post-generation snap pass wired into the code-template path"
      contains: "computeCaptionCardTextPositions"
  key_links:
    - from: "src/lib/ai/generate-slides.ts"
      to: "src/lib/ai/caption-card-text-snap.ts"
      via: "import + post-CarouselSchema.parse snap pass"
      pattern: "computeCaptionCardTextPositions"
    - from: "src/lib/ai/caption-card-text-snap.ts"
      to: "src/lib/ai/style-spec-projector-constants.ts"
      via: "reuse of CAPTION_BAR_BOTTOM_* ratios for the in-card hook/body bands"
      pattern: "CAPTION_BAR_BOTTOM"
---

<objective>
When a generated slide has a caption card enabled (`caption_bar_enabled === true`),
deterministically snap the headline (hook) text box — and the body text box — into
the caption card's geometry, so the text always sits over the card on every
caption-card template.

Purpose: Fixes a user-reported bug — generated headline text boxes are positioned
independently of the caption card (card snapped to the bottom edge, headline
floating at the top of the slide). A prompt rule cannot fix this reliably; the fix
is a deterministic post-process snap. Code owns geometry, Gemini owns the words.

Output:
- A new pure, extraction-ready helper `computeCaptionCardTextPositions` in
  `src/lib/ai/caption-card-text-snap.ts`.
- A post-generation snap pass in `generateSlideContent` (code-template path only).
- Vitest coverage for the helper and the wiring.
</objective>

<root_cause>
Investigation of the generation pipeline (per the spec's "Where to investigate"):

- `resolveCaptionBar` (`src/lib/render/resolve-overlay.ts`) is the SINGLE source of
  truth for the card. It runs at RENDER time. For news-layout slides it auto-seeds
  an `enabled` card (height 38%, `position: 'bottom'`, `y = 100 - heightPct`) even
  when no `caption_bar_*` keys are stored — the quick-260518-8o0 news black-headline
  -backdrop migration. So the card geometry exists at render time.

- `computeCaptionBarBottomPositions` (`style-spec-projector-constants.ts`) IS the
  deterministic positioner — but it is only called from `style-spec-projector.ts`
  in the `archetype === 'caption-bar-bottom'` branch. That branch is the
  **style-from-reference / LayoutRecipe projection path**, NOT the normal
  code-template generation path.

- `generateSlideContent` (`generate-slides.ts`) is the code-template generation
  path. For `category === 'news'` it calls `promoteNewsHeadline`, which sizes the
  headline against `NEWS_DEFAULT_HEADLINE_BOX` but **sets no position at all**. The
  hook text box therefore keeps its default `anchor: 'top'` (via `hookPosition()`
  in `text-box-adapter.ts`, which reads `style_overrides.text_position ?? 'top'`).

ROOT CAUSE: the code-template generation path never positions the headline relative
to the caption card. The card is auto-seeded by the renderer; the headline is left
at its default top anchor. Card and text are fully decoupled — exactly the bug.

THE FIX: after `CarouselSchema.parse` in `generateSlideContent`, for every slide
whose effective caption card is enabled, compute `hook_position` / `body_position`
from the card geometry and write them into `style_overrides`. This runs BEFORE
`legacyToTextBoxes`, so the computed positions flow into both the legacy slide
fields and the derived `text_boxes` (the `anchor: 'custom'` shape the adapter
produces from `hook_position`). `applyLayoutRecipe` (Phase 85) is left untouched —
the DB recipe path already carries caption-card geometry.
</root_cause>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/CAPTION-CARD-TEXT-PLACEMENT-SPEC.md
@.planning/quick/260519-hym-snap-generated-headline-text-into-captio/260519-hym-CONTEXT.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase — use directly. -->

From src/lib/ai/style-spec-projector-constants.ts (REUSE these — do NOT invent new numbers):
```typescript
// horizontal anchor + width for caption-card text boxes
export const CAPTION_BAR_BOTTOM_X = 11        // percent (0..100)
export const CAPTION_BAR_BOTTOM_WIDTH = 78    // percent (0..100)
// the deterministic positioner for a bottom-snapped card (heightFraction-based)
export function computeCaptionBarBottomPositions(heightFraction?: number): {
  hook: { x: number; y: number; width: number }
  body: { x: number; y: number; width: number }
}
// Internal math it uses (mirror this for a top-snapped card):
//   barTopY  = (1 - heightFraction) * 100
//   hookY    = barTopY + barHeightPct * 0.25   // hook 25% into the card
//   bodyY    = barTopY + barHeightPct * 0.60   // body 60% into the card
//   results rounded to 1 decimal place
```

From src/lib/render/resolve-overlay.ts — `resolveCaptionBar` is the renderer's
source of truth. The snap MUST target the SAME geometry it produces:
```typescript
// caption card geometry the renderer derives:
//   heightPct = caption_bar_height_pct ?? CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT (38)
//   position  = caption_bar_position ?? 'bottom'
//   y (card top edge, percent) = caption_bar_y ?? (position === 'top' ? 0 : 100 - heightPct)
// So: cardTopY = caption_bar_y when present, else derived from position+height.
//     The card spans [cardTopY, cardTopY + heightPct] in percent of the 1920 frame.
```

From src/lib/types/slide.ts — `SlideStyleOverrides` fields the snap writes/reads:
```typescript
interface TextPosition { x: number; y: number }  // percent 0..100
interface SlideStyleOverrides {
  text_position?: 'top' | 'center' | 'bottom'
  hook_position?: TextPosition   // anchor:'custom' once set
  body_position?: TextPosition
  hook_width?: number            // percent 0..100
  body_width?: number
  caption_bar_enabled?: boolean
  caption_bar_height_pct?: number   // 10..90; default 38
  caption_bar_y?: number            // top edge percent; default from position
  caption_bar_position?: 'bottom' | 'top'  // default 'bottom'
  // ...other caption_bar_* fields
}
```

From src/lib/ai/text-box-adapter.ts — once `hook_position` is set, `legacyToTextBoxes`
produces a TextBox with `position: { anchor: 'custom', x, y, width }`. Setting
`hook_position`/`body_position` is therefore sufficient; do NOT also touch
`text_boxes` directly.

From src/lib/ai/generate-slides.ts — wiring point. `generateSlideContent` flow:
```
callGemini -> validateAndRepair -> CarouselSchema.parse (parsedCarousel)
  -> [news] promoteNewsHeadline(parsedCarousel, accentHex)   <-- snap goes AFTER this
  -> decorations ingest (slidesWithDecorations)
  -> legacyToTextBoxes per slide (slidesWithTextBoxes)        <-- snap MUST be BEFORE this
  -> return { ...parsedCarousel, slides: slidesWithTextBoxes }
```
The snap pass belongs after `promoteNewsHeadline` and before the decorations/
`legacyToTextBoxes` mapping — so the computed positions flow into `text_boxes`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create the reusable caption-card text-snap helper</name>
  <files>src/lib/ai/caption-card-text-snap.ts, src/lib/ai/__tests__/caption-card-text-snap.test.ts</files>
  <behavior>
    Pure function `computeCaptionCardTextPositions(cardGeometry)` where
    `cardGeometry = { heightPct: number; cardTopY: number; position: 'bottom' | 'top' }`.
    Returns `{ hook: { x, y, width }, body: { x, y, width } }` — all percent (0..100).

    - Test 1 (bottom card, default 38% height): for `heightPct = 38`, `position = 'bottom'`,
      `cardTopY = 62` — hook.y is 25% into the card (62 + 38*0.25 = 71.5), body.y is 60%
      into the card (62 + 38*0.60 = 84.8). Both rounded to 1 decimal. hook.x === body.x ===
      CAPTION_BAR_BOTTOM_X (11), hook.width === body.width === CAPTION_BAR_BOTTOM_WIDTH (78).
    - Test 2 (parity with the existing positioner): for a bottom card the helper output
      MUST equal `computeCaptionBarBottomPositions(heightPct / 100)` — same hook/body x/y/width.
      This proves the helper does not drift from the projector's source of truth.
    - Test 3 (top card mirrors the relationship): for `heightPct = 38`, `position = 'top'`,
      `cardTopY = 0` — hook anchored toward the top of the card (0 + 38*0.25 = 9.5), body
      below it (0 + 38*0.60 = 22.8). Headline still on top, body below — same hook-top/
      body-below relationship as the bottom card.
    - Test 4 (explicit caption_bar_y respected): when `cardTopY` is an explicit value
      (not the position default), the in-card offsets are computed from that `cardTopY`,
      not from `100 - heightPct`. E.g. `cardTopY = 50`, `heightPct = 40`, `position = 'bottom'`
      -> hook.y = 50 + 40*0.25 = 60.
    - Test 5 (output is in-frame): for any valid input the returned hook.y and body.y are
      within [cardTopY, cardTopY + heightPct] — the text always lands inside the card span.
    - Test 6 (purity/determinism): two calls with the same input return deep-equal results;
      the function does not mutate its argument.
  </behavior>
  <action>
Create `src/lib/ai/caption-card-text-snap.ts`.

Export a single pure function:
```typescript
export interface CaptionCardGeometry {
  heightPct: number              // card height, percent of the 1920 frame (10..90)
  cardTopY: number               // card TOP edge, percent (0..100)
  position: 'bottom' | 'top'     // snap preset — retained for symmetry/clarity
}
export interface CaptionCardTextPositions {
  hook: { x: number; y: number; width: number }
  body: { x: number; y: number; width: number }
}
export function computeCaptionCardTextPositions(
  geom: CaptionCardGeometry,
): CaptionCardTextPositions
```

Implementation:
- Import `CAPTION_BAR_BOTTOM_X`, `CAPTION_BAR_BOTTOM_WIDTH` from
  `./style-spec-projector-constants` — REUSE them; do NOT redeclare the numbers.
- Compute in-card offsets from `cardTopY` (NOT `100 - heightPct`), so an explicit
  `caption_bar_y` is honored:
    `hookY = round1(cardTopY + heightPct * 0.25)`  — hook 25% into the card (top-anchored)
    `bodyY = round1(cardTopY + heightPct * 0.60)`  — body 60% into the card (below the hook)
  where `round1(n) = Math.round(n * 10) / 10`.
- The 0.25 / 0.60 ratios are the SAME ratios `computeCaptionBarBottomPositions` uses
  (CAPTION_BAR_BOTTOM_HOOK_Y_RANGE / CAPTION_BAR_BOTTOM_BODY_Y_RANGE bands are produced
  by exactly those ratios per that file's documented math). The hook-top / body-below
  relationship is identical for `position: 'top'` — both branches use the same offsets
  relative to `cardTopY`, so a top-snapped card gets headline-on-top automatically.
- `position` is accepted for clarity/extension symmetry; the math is `cardTopY`-driven
  so no per-position branch is needed. Document this with a brief comment.
- Return `x` / `width` as `CAPTION_BAR_BOTTOM_X` / `CAPTION_BAR_BOTTOM_WIDTH` for both
  hook and body.
- Pure — no I/O, no mutation, never throws. Add a file-header comment explaining this
  helper is intentionally extraction-ready (a pure function over caption-card geometry)
  so the LayoutRecipe path (Phase 85) can adopt it later WITHOUT a rewrite, but that
  this task does NOT retrofit `applyLayoutRecipe` (per CONTEXT.md locked decision).

Create `src/lib/ai/__tests__/caption-card-text-snap.test.ts` covering the six
behaviors above. For Test 2, import `computeCaptionBarBottomPositions` and assert the
deep-equality against the helper output for at least two height fractions (0.38 and 0.40).
  </action>
  <verify>
    <automated>npx vitest run src/lib/ai/__tests__/caption-card-text-snap.test.ts</automated>
  </verify>
  <done>The helper file exists with `computeCaptionCardTextPositions` exported; all six test cases pass; the bottom-card output is byte-equal to `computeCaptionBarBottomPositions` for the tested height fractions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire the post-generation snap pass into the code-template generation path</name>
  <files>src/lib/ai/generate-slides.ts, src/lib/ai/__tests__/caption-card-text-snap.test.ts</files>
  <behavior>
    A new exported pure helper `snapHeadlineToCaptionCard(slides)` in
    `caption-card-text-snap.ts` (add to the same file as Task 1) iterates slides and,
    for any slide whose caption card is effectively enabled, writes
    `hook_position` / `body_position` / `hook_width` / `body_width` into
    `style_overrides`.

    - Test 7 (enabled card -> headline snapped): a slide with
      `style_overrides.caption_bar_enabled === true` and `caption_bar_height_pct: 38`
      (default bottom) gets `hook_position.y === 71.5`, `body_position.y === 84.8`,
      and `hook_position.x === body_position.x === 11`.
    - Test 8 (no caption card -> untouched): a slide with no `caption_bar_*` keys is
      returned with `hook_position` / `body_position` STILL undefined (byte-identical —
      no positions injected).
    - Test 9 (explicit caption_bar_enabled: false -> untouched): a slide with
      `caption_bar_enabled: false` gets NO `hook_position` (the snap triggers only on
      `=== true`).
    - Test 10 (top card): a slide with `caption_bar_enabled: true`,
      `caption_bar_position: 'top'`, `caption_bar_height_pct: 38` gets hook.y < body.y
      and both within the top card span [0, 38].
    - Test 11 (explicit caption_bar_y wins): a slide with `caption_bar_enabled: true`,
      `caption_bar_y: 50`, `caption_bar_height_pct: 40` gets `hook_position.y === 60`.
    - Test 12 (idempotent + non-mutating shape): running the helper twice yields the
      same result.
  </behavior>
  <action>
Add a second export to `src/lib/ai/caption-card-text-snap.ts`:

```typescript
export function snapHeadlineToCaptionCard<
  T extends { style_overrides?: Record<string, unknown> | undefined },
>(slides: T[]): T[]
```

Behavior:
- For each slide, read `style_overrides` (default `{}`).
- Determine whether the caption card is effectively enabled. SCOPE per CONTEXT.md is
  TEMPLATE-AGNOSTIC: trigger off `caption_bar_enabled === true` ONLY. Do NOT replicate
  the renderer's news-layout auto-seed (`caption_bar_enabled == null && isNewsLayoutSlide`)
  — that auto-seed lives in `resolveCaptionBar` and is render-time only; the snap fires
  on the explicit flag alone. (See note below — generation must STAMP the flag.)
- When NOT enabled: return the slide unchanged (no `hook_position` injected) — preserves
  byte-identity for non-caption-card slides (CONTEXT.md locked: absent != false; an
  explicit `false` also does NOT trigger).
- When enabled: derive the card geometry the SAME way `resolveCaptionBar` does:
    `heightPct = caption_bar_height_pct ?? 38`  (CAPTION_CARD_FIT_REFERENCE_HEIGHT_PCT default)
    `position  = caption_bar_position ?? 'bottom'`
    `cardTopY  = caption_bar_y ?? (position === 'top' ? 0 : 100 - heightPct)`
  Then call `computeCaptionCardTextPositions({ heightPct, cardTopY, position })` and
  write `hook_position`, `body_position`, `hook_width`, `body_width` into a NEW
  `style_overrides` object (spread the existing one — do not mutate the input;
  mirror `promoteNewsHeadline`'s in-place contract is acceptable but a non-mutating
  spread is cleaner and matches the test expectation). Return the new slide objects.
- Pure, never throws.

Then wire it into `src/lib/ai/generate-slides.ts`:
- Import `snapHeadlineToCaptionCard` (and, if needed for stamping below, the geometry
  helper) from `./caption-card-text-snap`.
- INSERT the snap pass AFTER the `promoteNewsHeadline` block (the `if (category === 'news')`
  block ends ~line 305) and BEFORE the `slidesWithDecorations` mapping (~line 320), so
  the computed `hook_position` flows through `legacyToTextBoxes` into `text_boxes`.

  CRITICAL — the snap fires only on `caption_bar_enabled === true`, but the current
  code-template news path never stamps that flag (the renderer auto-seeds the card at
  render time). For the snap to fire on NEW news generations, generation must STAMP
  `caption_bar_enabled: true` onto news-category slides whose card the renderer would
  auto-seed. Do this in the SAME pass:
    * For `category === 'news'`: before the snap, set
      `style_overrides.caption_bar_enabled = true` on every slide that does not already
      have an explicit `caption_bar_enabled` key (i.e. `caption_bar_enabled == null`).
      This makes the auto-seeded news card EXPLICIT in the persisted data, which is what
      the template-agnostic snap then reads. An explicit `false` is left untouched.
    * For non-news categories: do NOT stamp — those slides have no caption card unless
      one was explicitly enabled, and the snap already handles an explicit
      `caption_bar_enabled: true` correctly.
  Implement the news-stamp as a small explicit step in `generate-slides.ts` (or as an
  optional second arg to `snapHeadlineToCaptionCard`, e.g. `{ stampNewsDefault: boolean }`
  — your discretion; keep the helper pure either way). Document WHY with a comment
  referencing the renderer's `resolveCaptionBar` news auto-seed and quick-260518-8o0.

  Do NOT touch `applyLayoutRecipe` / the style-spec-projector path (CONTEXT.md locked).

Add Tests 7-12 to `src/lib/ai/__tests__/caption-card-text-snap.test.ts`. Also add an
integration-style assertion: construct a minimal parsed-carousel-shaped object with one
news slide that has `caption_bar_enabled: true`, run `snapHeadlineToCaptionCard`, then
run it through `legacyToTextBoxes` and assert the resulting hook TextBox has
`position.anchor === 'custom'` with the expected `x`/`y` — proving the computed position
survives the adapter into `text_boxes`.
  </action>
  <verify>
    <automated>npx vitest run src/lib/ai/__tests__/caption-card-text-snap.test.ts && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>`snapHeadlineToCaptionCard` is exported and wired into `generateSlideContent` after `promoteNewsHeadline` and before the decorations/`legacyToTextBoxes` mapping; news slides get `caption_bar_enabled: true` stamped; Tests 7-12 plus the `legacyToTextBoxes` integration assertion pass; `tsc --noEmit` is clean.</done>
</task>

<task type="auto">
  <name>Task 3: Regression check — full caption / generation test surface stays green</name>
  <files>src/lib/ai/__tests__/caption-card-text-snap.test.ts</files>
  <action>
Run the existing caption-card and generation-adjacent test suites to confirm the snap
pass introduced ZERO regressions:
- `src/lib/render/__tests__/caption-bar-overrides.test.ts` — renderer caption-bar resolution
- `src/lib/ai/__tests__/promote-news-headline.test.ts` — the news promotion pass the snap runs after
- `src/lib/ai/__tests__/style-spec-projector-caption-bar-bottom.test.ts` — the projector
  path that must remain UNTOUCHED (proves `applyLayoutRecipe`/projector were not retrofitted)
- `src/lib/ai/__tests__/style-spec-projector.test.ts`

If any pre-existing failures appear that are unrelated to this change, note them in the
SUMMARY as pre-existing baseline (per STATE.md the project carries a known unrelated
failing baseline — auth/stripe/legal/api-keys); do NOT attempt to fix unrelated failures.
The bar is: the four suites above show no NEW failures attributable to this plan.
  </action>
  <verify>
    <automated>npx vitest run src/lib/render/__tests__/caption-bar-overrides.test.ts src/lib/ai/__tests__/promote-news-headline.test.ts src/lib/ai/__tests__/style-spec-projector-caption-bar-bottom.test.ts src/lib/ai/__tests__/style-spec-projector.test.ts src/lib/ai/__tests__/caption-card-text-snap.test.ts</automated>
  </verify>
  <done>All five suites pass with no new failures; the projector caption-bar-bottom suite is unchanged (confirms the projector path was not modified).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Gemini response → generation pipeline | AI-emitted slide JSON crosses into the generation pipeline; already validated by `validateAndRepair` + `CarouselSchema.parse` before the snap runs |
| Persisted slide payload → renderer | `caption_bar_*` overrides may be hand-edited in a stored project payload |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-hym-01 | Tampering | `snapHeadlineToCaptionCard` — `caption_bar_height_pct` / `caption_bar_y` read from a hand-edited payload could be out of range | accept | The renderer's `resolveCaptionBar` already clamps `heightPct` to [10,90] and `y` to [0,100] at render time (existing `clamp` calls). The snap computes positions; the worst case is an off-card hook_position, which the renderer's own clamps and the box-fit logic bound. No new attack surface — generation input is already schema-validated upstream. |
| T-hym-02 | Denial of Service | `computeCaptionCardTextPositions` called per slide in the generation hot path | accept | Pure arithmetic, O(1) per slide, no I/O — negligible cost; mirrors the existing `promoteNewsHeadline` per-slide pass. |
| T-hym-03 | Tampering | An explicit `caption_bar_enabled: false` on an AI/hand-edited payload | mitigate | The snap triggers ONLY on `caption_bar_enabled === true` (strict equality) and the news-stamp only fires on `caption_bar_enabled == null`; an explicit `false` is preserved untouched (CONTEXT.md locked: absent != false). Covered by Test 9. |
</threat_model>

<verification>
- `npx vitest run src/lib/ai/__tests__/caption-card-text-snap.test.ts` — all 12+ cases pass.
- `npx tsc --noEmit -p tsconfig.json` — clean.
- The four existing caption/generation suites show no new failures.
- Manual confirmation (optional, post-merge): generate a fresh News carousel; the
  headline text box now sits inside the bottom caption card rather than at the top of
  the slide.
</verification>

<success_criteria>
- A generated slide with `caption_bar_enabled === true` has `hook_position` /
  `body_position` computed from the caption card's geometry (headline anchored toward
  the top of the card, body below it).
- The snap works for both `caption_bar_position: 'bottom'` and `'top'` cards.
- New News-category generations get `caption_bar_enabled: true` stamped, so the
  template-agnostic snap fires and the headline lands inside the auto-seeded card.
- Slides without an enabled caption card render byte-identical to pre-change — no
  `hook_position` / `body_position` injected.
- The reusable helper is a pure function over caption-card geometry (extraction-ready
  for the LayoutRecipe path), but `applyLayoutRecipe` / the style-spec-projector path
  are NOT modified.
- `tsc --noEmit` clean; no new test failures across the caption/generation surface.
</success_criteria>

<output>
After completion, create
`.planning/quick/260519-hym-snap-generated-headline-text-into-captio/260519-hym-SUMMARY.md`.
</output>
