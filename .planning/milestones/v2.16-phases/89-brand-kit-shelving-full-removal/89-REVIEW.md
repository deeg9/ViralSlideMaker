---
phase: 89-brand-kit-shelving-full-removal
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/(dashboard)/project/[id]/page.tsx
  - src/app/(dashboard)/project/[id]/publish-actions.ts
  - src/app/(dashboard)/resources/page.tsx
  - src/app/(dashboard)/settings/layout.tsx
  - src/app/(dashboard)/style-from-reference/actions.ts
  - src/app/api/admin/seed-explore/route.ts
  - src/app/api/render/route.ts
  - src/app/api/v1/projects/[id]/download/route.ts
  - src/components/editor/elements-panel.tsx
  - src/components/editor/slide-canvas.tsx
  - src/components/editor/slide-editor.tsx
  - src/components/editor/slide-list.tsx
  - src/components/editor/sortable-slide.tsx
  - src/components/editor/text-editor-panel-legacy.tsx
  - src/components/editor/text-editor-panel.tsx
  - src/components/editor/text-rail/ActiveTextBoxCard.tsx
  - src/components/editor/text-rail/decoration-card.tsx
  - src/components/layout/app-header.tsx
  - src/components/projects/project-card.tsx
  - src/components/projects/project-list.tsx
  - src/components/slides/generation-form.tsx
  - src/components/slides/slide-preview.tsx
  - src/components/slides/template-picker.tsx
  - src/components/slides/template-tile-preview.tsx
  - src/components/style-from-reference/spec-preview-panel.tsx
  - src/components/style-from-reference/state-machine.ts
  - src/components/style-from-reference/style-from-reference-shell.tsx
  - src/lib/ai/generate-from-style-spec.ts
  - src/lib/ai/prompts.ts
  - src/lib/ai/style-spec-projector.ts
  - src/lib/api/openapi.ts
  - src/lib/render/preview-render.ts
  - src/lib/render/render-slide-satori.tsx
  - src/lib/render/render-slide.ts
  - src/lib/render/resolve-per-slide-template.ts
  - src/lib/render/templates/index.ts
  - src/lib/services/carousel.ts
  - src/lib/services/publish.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 89: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

Phase 89 removed the brand-kit feature (~79 files deleted). This review covers the 39 surviving source files that had brand-kit code stripped from them. The mechanical removal is, overall, clean and disciplined:

- The `brandKit` prop was correctly un-drilled through the entire editor/project component tree (`SlideEditor` → `SlideCanvas`/`SlideList`/`SortableSlide` → `SlidePreview`, plus `TextEditorPanel`/`ActiveTextBoxCard`/`ElementsPanel`/`DecorationCard`). No component still destructures, forwards, or references a removed `brandKit`/`useBrandKitRemix`/`brandKitAvailable` prop. The `ActiveTextBoxCard` `brandKit: _brandKit` placeholder destructure was also removed.
- The `buildSlideElement`/`buildSlideHtml` positional-arg-3 (`brandKit`) drop is consistent: all 6 call sites (`render/route.ts`, `download/route.ts`, `publish-actions.ts`, `publish.ts`, `seed-explore/route.ts`, `preview-render.ts`) bind the remaining positional args (`slide, template, tier, origin, ctx [, dbTemplates]`) correctly.
- The `TextPosition` relocation into `style-spec.ts` is correct: the old `BrandKitTextPosition = 'top' | 'center' | 'bottom'` is now `TextPosition = 'top' | 'center' | 'bottom'`, `StyleSpecLayout.hookPosition` consumes the local alias, and the import of the deleted `@/lib/types/brand-kit` is gone.
- The `style-from-reference` state machine cleanly dropped `useBrandKitRemix`/`brandKitAvailable` state, the two related actions, and the `applyBrandKitRemix` composition step in `generateCarouselFromReferences`.
- No remaining `brand_kits` table reads or brand-kit helper imports anywhere in `src/`.

The principal defect is a **behavior-drift inconsistency**: the new `getTemplate('brand-kit') → news-oracle` fallback only fires on code paths that call `getTemplate` directly. The four server render/publish paths actually call `resolveTemplate`, which does NOT carry the fallback — yet each carries a comment claiming it does. See WR-01.

## Warnings

### WR-01: `'brand-kit'` → `news-oracle` fallback is missing from the four `resolveTemplate` render/publish paths — comments claim otherwise

**File:** `src/app/api/render/route.ts:75`, `src/app/api/v1/projects/[id]/download/route.ts:48`, `src/app/(dashboard)/project/[id]/publish-actions.ts:38`, `src/app/(dashboard)/project/[id]/publish-actions.ts:75`, `src/lib/services/publish.ts:45`

**Issue:**
The new fallback lives ONLY in `getTemplate` (`src/lib/render/templates/index.ts:264`):
```ts
const resolvedId = id === 'brand-kit' ? 'news-oracle' : id
return templates.find((t) => t.id === resolvedId) ?? templates[0]
```
But the four server render/publish paths resolve the project template via `resolveTemplate` (from `templates/registry.ts`), not `getTemplate`. `resolveTemplate` (registry.ts:93-102) does NOT normalize `'brand-kit'`:
```ts
export async function resolveTemplate(id: string): Promise<SlideTemplate> {
  const codeTemplate = templates.find((t) => t.id === id)   // no 'brand-kit' code template → miss
  if (codeTemplate) return codeTemplate
  const rows = await getDbRows()
  const row = rows.find((r) => r.id === id)                  // 'brand-kit' is not a public.templates row → miss
  if (row) return dbRowToSlideTemplate(row)
  return templates[0]                                        // highlight-bar, NOT news-oracle
}
```
The migration `supabase/migrations/20260427_brand_kit_template.sql` confirms `brand_kits` is a separate dormant table — there is no `public.templates` row with id `brand-kit`. So a legacy project carrying `template_id === 'brand-kit'` resolves to:
- **`news-oracle`** in the dashboard grid + editor (`project-card.tsx:62` and `slide-editor.tsx` use `getTemplate`)
- **`highlight-bar`** (`templates[0]`) in the PNG export (`/api/render`), the ZIP download (`/api/v1/.../download`), and the publish hero (`publish-actions.ts`, `publish.ts`)

Each of these four files carries a comment asserting "A legacy template_id === 'brand-kit' resolves to news-oracle via getTemplate's defensive fallback" — that comment is factually wrong for the path it sits in. No crash results (highlight-bar is a valid template), but the same legacy project renders under two different templates depending on surface, violating the codebase's TPLREND-05 render-parity invariant. The brand-kit fallback test (`getTemplate-brand-kit-fallback.test.ts`) covers `getTemplate` only and would not catch this.

**Fix:** Make the normalization live where every path sees it. Add the `'brand-kit'` normalization to `resolveTemplate` so it mirrors `getTemplate`:
```ts
export async function resolveTemplate(id: string): Promise<SlideTemplate> {
  // Phase 89 (BKSHELVE-07): mirror getTemplate's 'brand-kit' sentinel fallback.
  const resolvedId = id === 'brand-kit' ? 'news-oracle' : id
  const codeTemplate = templates.find((t) => t.id === resolvedId)
  if (codeTemplate) return codeTemplate
  const rows = await getDbRows()
  const row = rows.find((r) => r.id === resolvedId)
  if (row) return dbRowToSlideTemplate(row)
  return templates[0]
}
```
Then either correct or keep the four call-site comments (they become accurate once `resolveTemplate` carries the fallback). Add a `resolveTemplate('brand-kit')` test asserting `.id === 'news-oracle'`.

### WR-02: Two distinct exported types both named `TextPosition` — collision risk across modules

**File:** `src/lib/types/style-spec.ts:77`

**Issue:**
Phase 89 relocated the brand-kit `BrandKitTextPosition` literal union into `style-spec.ts` as `export type TextPosition = 'top' | 'center' | 'bottom'`. But `src/lib/types/slide.ts:16` already exports a completely different shape under the same name:
```ts
// src/lib/types/slide.ts
export interface TextPosition { x: number; y: number }   // a coordinate pair
// src/lib/types/style-spec.ts  (new in Phase 89)
export type TextPosition = 'top' | 'center' | 'bottom'   // a placement enum
```
There is no compile error today because they live in separate modules and current consumers import from the correct one (`slide-preview.tsx`, `slide-editor.tsx`, `slide-canvas.tsx` pull the coordinate type from `slide.ts`; `style-spec.ts` uses its own). But the name reuse is a latent footgun: a future editor-side auto-import for `TextPosition` can silently resolve to the wrong module, and TypeScript will give a confusing structural-mismatch error far from the cause. The brand-kit module that originally owned this type avoided the collision precisely by name-prefixing it `BrandKitTextPosition`.

**Fix:** Rename the relocated enum to something non-colliding, e.g. `TextPlacement` or `VerticalTextPosition`, and update the single in-file consumer (`StyleSpecLayout.hookPosition`) plus the doc comments:
```ts
/** Coarse vertical text placement — a 3-value literal union. */
export type TextPlacement = 'top' | 'center' | 'bottom'
// ...
export interface StyleSpecLayout {
  hookPosition?: TextPlacement
  density?: 'tight' | 'medium' | 'airy'
}
```

### WR-03: `watermark` layer is now permanently dead code in both renderers

**File:** `src/lib/render/render-slide-satori.tsx:413`, `src/lib/render/render-slide.ts:385`

**Issue:**
With brand-kit removed, both renderers now call `resolveWatermark(null, slide, ...)` with a hard-coded `null` first arg. `resolveWatermark` (`resolve-watermark.ts:57`) short-circuits to `null` on a falsy `brandKit`, so `watermark` is provably always `null`. Consequently:
- `render-slide.ts:386-388` — `watermarkHtml` is always `''`; the layer never emits.
- `render-slide-satori.tsx:671-683` — the `{watermark && !slide.watermark?.hidden && (...)}` JSX branch is unreachable.

The phase chose to keep these branches with explicit "Kept for parity" comments, presumably anticipating the documented future brand-kit revival. That is a defensible call, but it leaves a non-trivial block of unreachable rendering code plus a now-pointless `resolveWatermark` import in each file. It will read as confusing dead code to anyone not aware of the shelving history, and the `slide.watermark?.hidden` gate in satori is now a no-op guarding nothing.

**Fix (optional — accept if the revival intent is firm):** If keeping, the comment is sufficient. If the team prefers a clean tree, delete the `watermark`/`watermarkHtml` computation, the unreachable JSX/HTML branches, and the `resolveWatermark` import in both files; the revival can re-add them from git history. At minimum, make the dead-ness explicit (e.g. `const watermark = null /* brand-kit shelved, Phase 89 */`) rather than routing through a resolver call whose only possible result is `null`.

## Info

### IN-01: `useReferenceSpec` regenerate path no longer passes brand-kit fields — verify `RegenerateActionInput` is fully aligned

**File:** `src/components/slides/generation-form.tsx:241-261`

**Issue:** `handleSubmit` builds the `regenerateAction` payload (`spec`, `aspects`, `content`, `imageSource`, `slideCount`, `references`) and no longer forwards `useBrandKitRemix`/`brandKit`. This correctly matches the updated `RegenerateActionInput` in `style-from-reference/actions.ts` (the two fields were removed there). No defect — noting only that this is a quietly load-bearing alignment: if `RegenerateActionInput` ever re-adds a required field, this call site must be updated in lockstep.

**Fix:** None required. Covered by TypeScript so long as the removed fields stay removed.

### IN-02: `resolvePerSlideTemplate` will not normalize a `template_id_override === 'brand-kit'`

**File:** `src/lib/render/resolve-per-slide-template.ts:65`

**Issue:** `resolvePerSlideTemplate` checks `TEMPLATE_IDS.includes(override)` before calling `getTemplate`. `'brand-kit'` is not a registered template, so it is not in `TEMPLATE_IDS`; a per-slide `template_id_override` of `'brand-kit'` therefore falls through `dbTemplates?.get('brand-kit')` (miss) to `projectTemplate`. This is benign — no crash, and the slide simply inherits the project template — but it means the `'brand-kit'` sentinel is normalized inconsistently: at the project level (`getTemplate`) it maps to `news-oracle`, while a per-slide override is silently dropped to the project template. In practice brand-kit was a project-level template choice, never a per-slide override, so this is unlikely to surface.

**Fix:** None required unless legacy data is found to carry `style_overrides.template_id_override === 'brand-kit'`. If desired, the cleanest fix is WR-01's approach plus normalizing the override string once at the top of `resolvePerSlideTemplate`.

### IN-03: Stale brand-kit phrasing in a `slide-preview.tsx` comment

**File:** `src/components/slides/slide-preview.tsx:934`

**Issue:** The diff updated the resolveCtx comment from "single-tile contexts (template-picker, brand-kit-form)" to "single-tile contexts (template-picker)". Good. No remaining functional brand-kit references in the file. Noting only that other survivor files still contain incidental brand-kit mentions in comments that are historically accurate context (e.g. `upload-reference-validation.ts` "mirrors the brand-kit-logos route", `projects-storage-constants.ts` "mirrors brand-kit-logo path-safety") — those describe a still-valid sanitization lineage and should NOT be scrubbed.

**Fix:** None required.

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
