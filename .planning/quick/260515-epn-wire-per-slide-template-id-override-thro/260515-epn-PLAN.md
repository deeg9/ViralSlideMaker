---
phase: 260515-epn-wire-per-slide-template-id-override
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/render/resolve-per-slide-template.ts
  - src/lib/render/__tests__/resolve-per-slide-template.test.ts
  - src/components/editor/slide-editor.tsx
  - src/components/editor/slide-canvas.tsx
  - src/components/editor/slide-list.tsx
  - src/components/editor/sortable-slide.tsx
  - src/lib/render/render-slide-satori.tsx
  - src/lib/render/render-slide.ts
  - src/app/api/render/route.ts
  - src/app/api/v1/projects/[id]/download/route.ts
  - src/app/explore/explore-card.tsx
  - src/app/explore/[slug]/carousel-slideshow.tsx
  - src/components/projects/project-card.tsx
  - src/components/slides/slide-grid.tsx
  - src/__tests__/render/per-slide-template-override.test.tsx
autonomous: true
requirements:
  - quick-260515-epn (per-slide template_id_override final consumer wire)
  - PARITY-01 (preview ↔ Satori byte-identity preserved on non-override slides)
  - TPLREND-05 (byte-identity for slides without override)
  - STYLESPEC-10 / EMIT-08 / PARITY-03 (silent-drop on unknown ids — closed-enum hygiene)

must_haves:
  truths:
    - A slide with `template_id_override: "magazine-bold"` renders with `backgroundMode: 'image-with-bottom-card'` in BOTH browser preview and Satori PNG export (no behavior gap between paths).
    - A slide WITHOUT `template_id_override` renders byte-identical to current behavior — same template the project picked, same brand-kit synthesis when the project's template_id is the brand-kit sentinel.
    - When the project's `template_id === BRAND_KIT_TEMPLATE_ID` AND the slide HAS a per-slide override, the override wins (more specific decision).
    - When the project's `template_id === BRAND_KIT_TEMPLATE_ID` AND the slide has NO override, brand-kit synthesis still wins (current behavior preserved).
    - An unknown / non-registry `template_id_override` value is silently dropped at the render boundary (consumer falls back to project template); no exception thrown, mirrors the STYLESPEC-10 / EMIT-08 / PARITY-03 silent-drop pattern.
    - Explore-card published-carousel snapshot honors per-slide override the same way (a remixable explore card with `slide_data[i].template_id_override` on it visually matches the original project).
  artifacts:
    - path: src/lib/render/resolve-per-slide-template.ts
      provides: "Single helper that resolves a slide's effective SlideTemplate given (slide, projectTemplate, brandKit). All five render surfaces import this — single source of truth."
      exports: ["resolvePerSlideTemplate"]
    - path: src/lib/render/__tests__/resolve-per-slide-template.test.ts
      provides: "Unit coverage for the helper: override wins, override-with-brand-kit wins, unknown-id silent-drop, undefined returns project template (byte-identity gate)."
    - path: src/__tests__/render/per-slide-template-override.test.tsx
      provides: "Integration coverage across SlidePreview (DOM) and buildSlideElement (Satori VDOM) — DOM bottom-card marker present when override set; absent when not."
  key_links:
    - from: src/components/editor/slide-editor.tsx
      to: src/lib/render/resolve-per-slide-template.ts
      via: "per-slide template resolution at every SlidePreview call site (SlideList, SlideCanvas, TextEditorPanel/LegacyTextEditorPanel, ElementsPanel)"
      pattern: "resolvePerSlideTemplate\\("
    - from: src/lib/render/render-slide-satori.tsx
      to: src/lib/render/resolve-per-slide-template.ts
      via: "buildSlideElement reads slide.template_id_override and re-resolves before consuming template fields"
      pattern: "resolvePerSlideTemplate\\("
    - from: src/lib/render/render-slide.ts
      to: src/lib/render/resolve-per-slide-template.ts
      via: "buildSlideHtml reads slide.template_id_override and re-resolves"
      pattern: "resolvePerSlideTemplate\\("
    - from: src/app/api/render/route.ts
      to: src/lib/render/render-slide-satori.tsx
      via: "passes per-slide-resolved template (not project template) into buildSlideElement"
      pattern: "buildSlideElement"
    - from: src/app/api/v1/projects/[id]/download/route.ts
      to: src/lib/render/render-slide-satori.tsx
      via: "ZIP-loop resolves the per-slide template for each iteration before buildSlideElement"
      pattern: "resolvePerSlideTemplate"
    - from: src/app/explore/explore-card.tsx
      to: src/lib/render/resolve-per-slide-template.ts
      via: "published-carousel snapshot honors per-slide override on the snapshotted slide_data"
      pattern: "resolvePerSlideTemplate"
---

<objective>
Wire per-slide `slide.template_id_override` through ALL renderer surfaces so AI-projected templates (Copy Style → archetype → `magazine-bold` etc.) actually take effect at render time. This is the final consumer-side link in the Copy Style chain — everything upstream already writes the override; nothing downstream reads it.

Purpose: Close the documented-but-disconnected wire so vision-extracted slides render with their archetype-matched template (the `caption-bar-bottom` archetype → `magazine-bold`'s `image-with-bottom-card` mode → visible black bottom card) instead of silently falling back to the project's default template (`bold-minimal` / `highlight-bar`) and rendering full-bleed text-over-photo.

Output:
- New `src/lib/render/resolve-per-slide-template.ts` — single-source-of-truth helper that all five render surfaces use.
- Updates to ALL five render surfaces (editor preview, Satori PNG export, render-slide HTML path, single-slide `/api/render`, ZIP download, explore-card, carousel-slideshow, project-card, slide-grid).
- Two test files: a focused unit test on the helper + an integration test that asserts DOM presence/absence of the magazine-bold bottom-card marker.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/types/slide.ts
@src/components/editor/slide-editor.tsx
@src/components/editor/slide-canvas.tsx
@src/components/editor/slide-list.tsx
@src/components/editor/sortable-slide.tsx
@src/components/slides/slide-grid.tsx
@src/components/slides/slide-preview.tsx
@src/components/projects/project-card.tsx
@src/lib/render/render-slide-satori.tsx
@src/lib/render/render-slide.ts
@src/lib/render/templates/index.ts
@src/lib/render/templates/magazine-bold.ts
@src/lib/ai/style-spec-projector.ts
@src/lib/brand-kit/get-effective-template.ts
@src/app/explore/explore-card.tsx
@src/app/explore/[slug]/carousel-slideshow.tsx
@src/app/api/render/route.ts
@src/app/api/v1/projects/[id]/download/route.ts

<interfaces>
<!-- Extracted from codebase. Use these directly — do not re-explore. -->

From src/lib/types/slide.ts (lines 230-236, 262-296):
```ts
export interface SlideStyleOverrides {
  // ... other fields
  /** Phase 80 R6 — projector-emitted template routing decision. */
  template_id_override?: string
}

export interface Slide {
  // ...
  style_overrides?: SlideStyleOverrides
  /** v2.9 — per-slide template override. When set, renderer uses
      getTemplate(template_id_override) instead of project.template_id. */
  template_id_override?: string
  // ...
}
```

From src/lib/render/templates/index.ts (line 198-200):
```ts
export function getTemplate(id: string): SlideTemplate {
  return templates.find((t) => t.id === id) ?? templates[0]
}
export const TEMPLATE_IDS: readonly string[]   // closed enum at module load
```
NOTE: `getTemplate` is forgiving (falls back to `templates[0]` = `highlight-bar`)
when an id is not in the registry. The helper below MUST be stricter — it must
return the PROJECT template (not `templates[0]`) when the override is missing
from the registry, so byte-identity is preserved.

From src/lib/brand-kit/get-effective-template.ts:
```ts
export const BRAND_KIT_TEMPLATE_ID = 'brand-kit'
export function synthesizeBrandKitTemplate(brandKit: BrandKit): SlideTemplate
export function mergeWithBrandKit(template, brandKit): SlideTemplate  // currently a passthrough
```

From src/lib/render/render-slide-satori.tsx (line 110-117):
```ts
export function buildSlideElement(
  slide: Slide,
  template: SlideTemplate,
  brandKit?: BrandKit | null,
  tier?: ForcedWatermarkTier | null,
  origin?: string,
  ctx?: { slideIndex: number; totalSlides: number; topic?: string },
): React.ReactElement
```

From src/lib/render/render-slide.ts (line 116):
```ts
export function buildSlideHtml(
  slide: Slide,
  template: SlideTemplate,
  brandKit?: BrandKit | null,
  tier?: ForcedWatermarkTier | null,
): string
```

From src/lib/render/templates/index.ts:
```ts
export const TEMPLATE_IDS: readonly string[]   // closed runtime enum
```

From src/lib/ai/style-spec-projector.ts (line 314):
The projector writes `style_overrides.template_id_override = ARCHETYPE_TO_TEMPLATE[archetype]`.
The generator (generate-from-style-spec.ts) lifts this onto top-level `Slide.template_id_override`.
The renderer reads `slide.template_id_override` (top-level, not from style_overrides).
</interfaces>

<call_sites>
<!-- All SlidePreview call sites + Satori call sites that need updating. -->
Editor preview surface (slide-editor.tsx → slide-canvas.tsx / slide-list.tsx / sortable-slide.tsx → SlidePreview):
  - src/components/editor/slide-canvas.tsx:154 — center canvas (single selected slide)
  - src/components/editor/sortable-slide.tsx:68 — left slide list thumbnails

Other browser-preview surfaces (each passes one template for all slides today):
  - src/components/slides/slide-grid.tsx:28 — grid view
  - src/components/projects/project-card.tsx:152 — dashboard project-card preview
  - src/app/explore/explore-card.tsx:72 — explore feed card
  - src/app/explore/[slug]/carousel-slideshow.tsx:26 — explore detail viewer
  - src/components/brand-kit/brand-kit-form.tsx:424 — brand-kit preview (uses sample slide; out-of-scope guard below)
  - src/components/slides/template-picker.tsx:51, 118 — picker tiles (sample slide; out-of-scope guard below)

Satori PNG export surface:
  - src/lib/render/render-slide-satori.tsx — buildSlideElement reads `template` param
  - src/app/api/render/route.ts:102 — single-slide PNG endpoint, calls buildSlideElement
  - src/app/api/v1/projects/[id]/download/route.ts:79 — ZIP-of-all-slides endpoint, calls buildSlideElement in a for-loop

HTML render surface (legacy, kept for parity):
  - src/lib/render/render-slide.ts — buildSlideHtml; currently only consumed by tests but maintained for parity (no production runtime callers per grep).

OUT-OF-SCOPE call sites (do NOT modify):
  - src/components/brand-kit/brand-kit-form.tsx:424 — renders a single sample slide with no `template_id_override`; behavior unchanged.
  - src/components/slides/template-picker.tsx:51, 118 — renders the picker's own sample slides per template; per-slide override is not applicable.
</call_sites>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract `resolvePerSlideTemplate` helper + unit tests (RED→GREEN)</name>
  <files>src/lib/render/resolve-per-slide-template.ts, src/lib/render/__tests__/resolve-per-slide-template.test.ts</files>
  <behavior>
    The helper has signature:
    ```ts
    export function resolvePerSlideTemplate(
      slide: Pick<Slide, 'template_id_override' | 'style_overrides'>,
      projectTemplate: SlideTemplate,
    ): SlideTemplate
    ```
    Resolution rules (test these one-by-one):
    - **Test 1 (byte-identity gate, TPLREND-05):** `slide.template_id_override === undefined` AND `slide.style_overrides?.template_id_override === undefined` → returns `projectTemplate` by reference identity (`===`). Same object pointer, not a clone — guarantees zero behavior change for legacy slides.
    - **Test 2 (top-level override wins):** `slide.template_id_override === 'magazine-bold'` → returns the registry's `magazine-bold` template (look up via `getTemplate`, but assert the returned template's `id === 'magazine-bold'` AND its `backgroundMode === 'image-with-bottom-card'`).
    - **Test 3 (style_overrides fallback):** `slide.template_id_override === undefined` but `slide.style_overrides?.template_id_override === 'magazine-bold'` → returns `magazine-bold` template. This handles the transitional projector-emit shape (projector writes to `style_overrides.template_id_override`; generator lifts to top-level, but defensive readers honor both). Document this in a code comment as the projector-fusion transitional path.
    - **Test 4 (top-level wins over style_overrides when both set):** both fields set to different ids → top-level wins (mirror generator precedence).
    - **Test 5 (unknown id silent-drop, STYLESPEC-10/EMIT-08/PARITY-03):** `slide.template_id_override === 'this-template-does-not-exist'` → returns `projectTemplate` (NOT the registry's default fallback `templates[0]`). Do not throw. Do not log. Match the closed-enum silent-drop discipline from STATE.md. Implementation hint: check the id against `TEMPLATE_IDS` (the closed-enum constant from `templates/index.ts`) before calling `getTemplate`; if not in the enum, return `projectTemplate`.
    - **Test 6 (brand-kit-aware passthrough):** when `projectTemplate.id === BRAND_KIT_TEMPLATE_ID` and slide has NO override, helper returns the brand-kit synthesized template untouched (the caller is responsible for synthesis; the helper does not know about brand-kit, it just returns whatever `projectTemplate` was passed in).
    - **Test 7 (brand-kit override-wins):** when `projectTemplate.id === BRAND_KIT_TEMPLATE_ID` and slide has `template_id_override === 'magazine-bold'`, helper returns the registry's magazine-bold template (override wins over brand-kit synthesis).

    Implementation skeleton (do NOT inline more than this):
    ```ts
    import { getTemplate, TEMPLATE_IDS } from './templates/index'
    import type { SlideTemplate } from './templates/index'
    import type { Slide } from '@/lib/types/slide'

    /**
     * Resolve the effective SlideTemplate for one slide.
     *
     * Precedence (most-specific first):
     *   1. slide.template_id_override (top-level — generation pipeline lifts
     *      from style_overrides.template_id_override after PROJECTOR FUSION).
     *   2. slide.style_overrides?.template_id_override (defensive read for the
     *      pre-fusion projector emit shape).
     *   3. projectTemplate (caller-resolved: brand-kit synthesis OR registry
     *      lookup by project.template_id — the helper is brand-kit-agnostic).
     *
     * Unknown ids (not in TEMPLATE_IDS closed enum) silently fall back to
     * projectTemplate. Mirrors STATE.md silent-drop discipline
     * (STYLESPEC-10 / EMIT-08 / PARITY-03).
     *
     * TPLREND-05 byte-identity: when both override slots are undefined, the
     * RETURN VALUE is the EXACT projectTemplate reference passed in. Tests
     * assert `===` to lock this; do not clone or merge.
     */
    export function resolvePerSlideTemplate(
      slide: Pick<Slide, 'template_id_override' | 'style_overrides'>,
      projectTemplate: SlideTemplate,
    ): SlideTemplate {
      const override =
        slide.template_id_override ?? slide.style_overrides?.template_id_override
      if (!override) return projectTemplate
      if (!TEMPLATE_IDS.includes(override)) return projectTemplate
      return getTemplate(override)
    }
    ```
  </behavior>
  <action>
    1. Write `src/lib/render/__tests__/resolve-per-slide-template.test.ts` FIRST with all 7 tests above. Run it — RED. Use `getTemplate('magazine-bold')` to look up the magazine-bold registry entry; assert `backgroundMode === 'image-with-bottom-card'` on it (this also doubles as a self-check that the magazine-bold definition is unchanged — out-of-scope safety net).
    2. Create `src/lib/render/resolve-per-slide-template.ts` with the implementation above. Run tests — GREEN.
    3. Commit: `test(epn): add failing tests for resolvePerSlideTemplate` then `feat(epn): resolvePerSlideTemplate helper (single source of truth)`.
  </action>
  <verify>
    <automated>npx vitest run src/lib/render/__tests__/resolve-per-slide-template.test.ts</automated>
  </verify>
  <done>
    - File `src/lib/render/resolve-per-slide-template.ts` exists, exports `resolvePerSlideTemplate`.
    - All 7 unit tests pass.
    - Byte-identity test asserts `===` reference equality (not deep-equal) when no override is set.
    - Unknown-id test confirms silent-drop returns `projectTemplate` (NOT `templates[0]`).
    - `grep -n "resolvePerSlideTemplate" src/lib/render/resolve-per-slide-template.ts | grep -v '^#' | grep -c "export function"` returns 1.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire helper into all five render surfaces (editor, Satori, HTML, explore, dashboards)</name>
  <files>src/components/editor/slide-editor.tsx, src/components/editor/slide-canvas.tsx, src/components/editor/slide-list.tsx, src/components/editor/sortable-slide.tsx, src/lib/render/render-slide-satori.tsx, src/lib/render/render-slide.ts, src/app/api/render/route.ts, src/app/api/v1/projects/[id]/download/route.ts, src/app/explore/explore-card.tsx, src/app/explore/[slug]/carousel-slideshow.tsx, src/components/projects/project-card.tsx, src/components/slides/slide-grid.tsx</files>
  <behavior>
    After this task:
    - **Editor preview (slide-editor.tsx → slide-canvas.tsx → SlidePreview):** The currently-selected slide on the canvas uses `resolvePerSlideTemplate(currentSlide, template)` where `template` is the existing brand-kit-or-registry result computed at slide-editor.tsx:117-120. SlideCanvas receives a `template` prop that is per-slide-resolved BY the caller (slide-editor.tsx now resolves per the SELECTED slide before passing).
    - **Editor thumbnails (SlideList → SortableSlide → SlidePreview):** Each thumbnail resolves its own template via `resolvePerSlideTemplate(slide, baseTemplate)` inside SortableSlide (or inside SlideList's `.map((slide, index) => ...)`). The thumbnail must show the override too — otherwise users see a stale thumbnail of a slide that renders differently on the canvas.
    - **Other editor surfaces:** TextEditorPanel, LegacyTextEditorPanel, ElementsPanel currently receive the project-level `template` prop. They use `template.textColor` / `template.fontFamily` etc. for CONTROL DEFAULTS (color pickers, font selectors). These panels should KEEP receiving the project-level template — they are NOT renderers and changing them would change which control-default value the user sees on a per-slide-override slide. Document this decision in a one-line code comment at the call site in slide-editor.tsx. (Rationale: the override drives the visual canvas; the controls remain anchored to the user-selected template so toggling the override on/off is reversible from the control panel.)
    - **Satori path (buildSlideElement):** Re-resolves inside `buildSlideElement` so all server callers benefit without each having to call the helper. Add `import { resolvePerSlideTemplate } from './resolve-per-slide-template'` at the top; near the top of `buildSlideElement` (after the existing `const overrides = slide.style_overrides ?? {}` line), insert `const template = resolvePerSlideTemplate(slide, templateParam)` where `templateParam` is the renamed incoming arg. The rest of the function uses `template` unchanged — every existing `template.*` reference now resolves against the per-slide template.
    - **HTML path (buildSlideHtml):** Same pattern — re-resolve inside buildSlideHtml.
    - **API routes (`/api/render`, `/api/v1/projects/[id]/download`):** These already pass an `effectiveTemplate` (post-mergeWithBrandKit) into buildSlideElement. Because the Satori path now re-resolves internally, the routes need NO change to their own template-resolution logic — but verify by inspection that the per-slide override flows through. Add a comment in `/api/render/route.ts` near line 102 noting "buildSlideElement re-resolves per-slide override internally; effectiveTemplate is the project-level fallback."
    - **explore-card.tsx, carousel-slideshow.tsx, project-card.tsx, slide-grid.tsx:** Each wraps `<SlidePreview template={...} />` with a project-or-snapshot-level template. Update each so the `template` prop passed to `<SlidePreview>` is `resolvePerSlideTemplate(currentSlide, baseTemplate)`. In carousel-slideshow.tsx — which renders one slide at a time — resolve inside the component body using `currentSlide`. In explore-card.tsx — same. In slide-grid.tsx (loops over slides) — resolve inside the `.map`. In project-card.tsx — resolve for the single visible `currentSlide`.

    EXPLICIT NEGATIVE CASES (must NOT change):
    - SlidePreview's own internal `template` prop continues to behave the same way; no signature change.
    - `mergeWithBrandKit` continues to be called for the PROJECT-level template before per-slide resolution; brand-kit synthesis path is untouched.
    - SortableSlide's `template` prop signature is unchanged (still `SlideTemplate`). The resolution happens in the parent SlideList's `.map` (or inside SortableSlide if cleaner — pick one and be consistent; either works).
    - render-slide-satori `buildSlideElement` external signature is unchanged. The internal rename (`template` param → `templateParam` then local `const template = resolvePerSlideTemplate(slide, templateParam)`) is invisible to callers.
    - render-slide.ts `buildSlideHtml` external signature is unchanged.

    Brand-kit fallback chain (verify by inspection while editing slide-editor.tsx):
    - slide-editor.tsx still computes the project-level template at lines 117-120 (existing brand-kit-or-registry resolution). NO change there.
    - The per-slide resolution happens AFTER that, at every SlidePreview call site. The override wins because `resolvePerSlideTemplate` does not consult brand-kit — it just returns the registry template by id. This is correct per the architecture constraint: per-slide override beats brand-kit beats project template.
  </behavior>
  <action>
    Write tests FIRST in `src/__tests__/render/per-slide-template-override.test.tsx` (RED), then implement.

    **Tests to write:**
    1. **Browser preview override-active:** Render `<SlidePreview slide={slideWithOverride} template={boldMinimalProjectTemplate} />` where `slideWithOverride.template_id_override = 'magazine-bold'`. After resolution (via the helper, which the test calls directly to compute the template prop the same way callers will), assert the rendered DOM contains the bottom-card marker. Use `data-testid` if one exists; otherwise grep for the unique inline `backgroundColor` / `position: absolute; bottom: 0` block pattern from slide-preview.tsx lines 759, 1114, 1548. Best approach: import `bottomCardBackground` from `@/lib/render/resolve-overlay` and assert the rendered HTML contains the resulting style string.
    2. **Browser preview override-absent (TPLREND-05 byte-identity):** Render the same slide WITHOUT the override; assert the bottom-card marker is NOT present (the DOM matches the legacy `bold-minimal` / `highlight-bar` output). Snapshot the rendered output `container.innerHTML` and lock it.
    3. **Satori path override-active:** Call `buildSlideElement(slideWithOverride, boldMinimalProjectTemplate, ...)`. Walk the returned React element tree (it's a plain React element — `result.props.children`) to find a child whose inline style contains `position: 'absolute'` AND `bottom: 0` (the bottom-card div from render-slide-satori.tsx lines 372-394). Assert it exists.
    4. **Satori path override-absent:** Same call WITHOUT override on the slide; assert the bottom-card div does NOT exist in the returned element tree.
    5. **Brand-kit override-wins:** Construct a `brandKitTemplate` via `synthesizeBrandKitTemplate(mockBrandKit)`. Call `resolvePerSlideTemplate(slideWithOverride, brandKitTemplate)` — assert result is `magazine-bold` (override wins). Then call without override — assert result is `brandKitTemplate` by reference identity.
    6. **Explore-card override:** Render `<ExploreCard ... slides={[slideWithOverride]} templateId="bold-minimal" />` (or whatever the existing test scaffolding allows). Assert the bottom-card marker is present in the rendered DOM. If ExploreCard's test surface is too heavy (Next router etc.), simulate it inline: import `getTemplate`, then `resolvePerSlideTemplate(slideWithOverride, getTemplate('bold-minimal'))`, render `<SlidePreview ... template={resolved} />`, assert. The point is to lock the contract that the explore-card surface uses the same helper.

    **Implementation order:**
    1. Run the new test file — RED.
    2. **slide-editor.tsx:** Keep the existing project-template resolution at lines 117-120. At each `<SlidePreview template={template} />` call site (currently passed to SlideCanvas as the `template` prop, to SlideList as `template`, etc.), update the resolution model:
       - Pass `template` to SlideCanvas unchanged at its prop name (it forwards to SlidePreview for the CANVAS preview which is a SINGLE slide — `currentSlide` aka `slides[selectedIndex]`). Inside SlideCanvas, before the `<SlidePreview>` element (around line 154), compute `const perSlideTemplate = resolvePerSlideTemplate(currentSlide, template)` and pass `template={perSlideTemplate}`.
       - Pass `template` to SlideList unchanged at its prop name. Inside SlideList's `.map` (around line 71), forward `template={template}` to SortableSlide; inside SortableSlide (line 68), compute `const perSlideTemplate = resolvePerSlideTemplate(slide, template)` and pass `template={perSlideTemplate}` to `<SlidePreview>`.
       - The TextEditorPanel / LegacyTextEditorPanel / ElementsPanel branches at slide-editor.tsx lines 1645, 1726, 1795 are NOT renderers and KEEP the project-level `template` prop (one-line comment at each).
    3. **render-slide-satori.tsx:** Rename the `template` param of `buildSlideElement` to `templateParam`. After the destructure `const overrides = slide.style_overrides ?? {}` (around line 118), insert: `const template = resolvePerSlideTemplate(slide, templateParam)`. Add the import at the top. The rest of the function uses `template` unchanged.
    4. **render-slide.ts:** Same change to `buildSlideHtml`. Rename `template` → `templateParam`; immediately re-bind `const template = resolvePerSlideTemplate(slide, templateParam)` near the top.
    5. **api/render/route.ts + api/v1/projects/[id]/download/route.ts:** No code change required (the Satori path re-resolves internally). Add a one-line comment near the `buildSlideElement` call: `// buildSlideElement re-resolves slide.template_id_override internally; effectiveTemplate is the project-level fallback.`
    6. **explore-card.tsx:** Import `resolvePerSlideTemplate`. Replace `template={template}` at line 74 with `template={resolvePerSlideTemplate(currentSlide, template)}`.
    7. **carousel-slideshow.tsx:** Import the helper. Before line 26, compute `const perSlideTemplate = resolvePerSlideTemplate(currentSlide, template)`. Pass `template={perSlideTemplate}`.
    8. **project-card.tsx:** Import the helper. Before line 152, compute `const perSlideTemplate = currentSlide ? resolvePerSlideTemplate(currentSlide, template) : template`. Pass `template={perSlideTemplate}`. Leave line 173's `template.backgroundColor` (used for the lazy-load placeholder) unchanged — that fallback paint is a one-shot placeholder, not a slide render.
    9. **slide-grid.tsx:** Inside the `.map((slide, index) => ...)`, compute `const perSlideTemplate = resolvePerSlideTemplate(slide, template)` and pass `template={perSlideTemplate}` to `<SlidePreview>`.
    10. Run all tests — GREEN.
    11. Commit: `test(epn): integration tests for per-slide override across surfaces` then `feat(epn): wire template_id_override through all render surfaces`.

    **Lint check:** Run `npm run lint --silent -- --max-warnings=0` (or the project equivalent) — must stay green; no new ESLint errors.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/render/per-slide-template-override.test.tsx src/lib/render/__tests__/resolve-per-slide-template.test.ts src/__tests__/render/legacy-templates-regression.test.tsx src/__tests__/render/premium-templates.test.tsx src/__tests__/render/render-slide-satori.test.tsx src/__tests__/render/render-slide.test.ts && npm run lint --silent</automated>
  </verify>
  <done>
    - All 6 new integration tests in `src/__tests__/render/per-slide-template-override.test.tsx` pass.
    - All pre-existing render tests (legacy-templates-regression, premium-templates, render-slide-satori, render-slide, templates) still pass — TPLREND-05 / PTF baseline / PARITY-01 invariants confirmed by existing snapshot tests.
    - Lint stays green (`npm run lint` exits 0 with no new errors).
    - `grep -rn "resolvePerSlideTemplate" src --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v 'resolve-per-slide-template.ts' | grep -v '^#' | wc -l` returns ≥ 9 (slide-canvas + sortable-slide + render-slide-satori + render-slide + explore-card + carousel-slideshow + project-card + slide-grid + ≥1 import or call elsewhere). This is the wire-completeness gate.
    - `grep -rn "template_id_override" src/components/editor/slide-editor.tsx src/components/slides/slide-preview.tsx src/lib/render/render-slide.ts src/lib/render/render-slide-satori.tsx | grep -v '^#'` is now NON-ZERO (the inverse of the diagnosis grep). This is the missing-wire-fixed gate.
    - Manual verification (recorded in SUMMARY, not gated automated): load project `8e3bf9b2-e394-43d2-9916-fd49ef8e99b4` in the editor — slide(s) with `template_id_override = 'magazine-bold'` now show the black bottom caption card. Slides without override still render under the project's `bold-minimal` template.
  </done>
</task>

</tasks>

<verification>
1. **Unit tests:** `npx vitest run src/lib/render/__tests__/resolve-per-slide-template.test.ts` → all 7 pass.
2. **Integration tests:** `npx vitest run src/__tests__/render/per-slide-template-override.test.tsx` → all 6 pass.
3. **Regression suite (byte-identity / parity invariants):** `npx vitest run src/__tests__/render/legacy-templates-regression.test.tsx src/__tests__/render/premium-templates.test.tsx src/__tests__/render/render-slide-satori.test.tsx src/__tests__/render/render-slide.test.ts src/__tests__/render/templates.test.ts` → all pass. These existing tests are the TPLREND-05 / PTF baseline / PARITY-01 byte-identity gates; no new code is allowed to drift them.
4. **Lint:** `npm run lint` → exits 0 with no new errors (Vercel build gate).
5. **Wire-completeness grep:** `grep -rn "resolvePerSlideTemplate" src --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v 'resolve-per-slide-template.ts' | grep -v '^#' | wc -l` → ≥ 9.
6. **Missing-wire-fixed grep:** `grep -rn "template_id_override" src/components/editor/slide-editor.tsx src/components/slides/slide-preview.tsx src/lib/render/render-slide.ts src/lib/render/render-slide-satori.tsx | grep -v '^#' | wc -l` → ≥ 1 (was 0 per diagnosis).
7. **Manual DB-backed smoke (not gated; recorded in SUMMARY):** Load editor on project `8e3bf9b2-e394-43d2-9916-fd49ef8e99b4`; verify the magazine-bold bottom-card visually renders on slides where the projector wrote the override; verify other projects with no overrides render byte-identical to before.
</verification>

<success_criteria>
- A slide carrying `template_id_override = "magazine-bold"` renders with `image-with-bottom-card` in EVERY consumer surface: editor canvas, editor thumbnails, Satori PNG export (single + ZIP), `/api/render`, explore feed, explore detail viewer, dashboard project card, slide-grid.
- A slide WITHOUT the override renders byte-identical to current behavior (legacy regression tests pass; TPLREND-05 / PTF baseline preserved).
- Unknown / non-registry override id silently falls back to the project template — no thrown errors, mirrors the STYLESPEC-10 / EMIT-08 / PARITY-03 silent-drop discipline.
- Brand-kit fallback chain holds: per-slide override > brand-kit > project template.
- All renderer surfaces import from the single helper module `src/lib/render/resolve-per-slide-template.ts` — no inlined `getTemplate(slide.template_id_override)` patterns drift across files.
- Lint stays green; no new ESLint errors that would block the Vercel build.
- Out-of-scope items (extraction, projector, magazine-bold definition, `separateOverlappingTextBoxes`, Copy Style persistence, "INSPIRED BY" thumbnail bug, text-box overlap pill-padding bug, `caption.heightFraction` parameterization, deprecated-magazine-bold-being-picked) remain untouched.
</success_criteria>

<output>
After completion, create `.planning/quick/260515-epn-wire-per-slide-template-id-override-thro/260515-epn-SUMMARY.md` capturing:
- What was wired (helper + 12 surface updates).
- Grep-verified before/after for the diagnosis grep (`template_id_override` in renderer files: 0 → ≥1).
- Manual smoke result on project `8e3bf9b2-e394-43d2-9916-fd49ef8e99b4`.
- Confirmation that all pre-existing parity tests still pass (TPLREND-05 / PTF baseline / PARITY-01 holding).
- Known follow-ups (already in the "Out of scope" list of the kickoff context — repeat them here so the next session has the breadcrumb).
</output>
