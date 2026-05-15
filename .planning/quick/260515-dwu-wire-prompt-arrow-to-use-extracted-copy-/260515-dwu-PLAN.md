---
phase: quick-260515-dwu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/services/carousel.ts
  - src/lib/services/__tests__/carousel-from-references.test.ts
  - src/components/slides/generation-form.tsx
  - src/components/slides/__tests__/generation-form-routing.test.tsx
  - src/components/style-from-reference/spec-preview-panel.tsx
  - src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx
autonomous: true
requirements:
  - quick-260515-dwu — Wire prompt-arrow to use extracted Copy Style when present
must_haves:
  truths:
    - "Clicking the prompt-arrow on /project/[id] with an extracted Copy Style + uploaded references routes generation through regenerateAction → generateCarouselFromReferences (NOT generateCarousel)"
    - "After Copy Style generation, the project row in `public.projects` has style_spec (jsonb) AND reference_assets (jsonb) populated — both non-null"
    - "When no Copy Style has been extracted, clicking the prompt-arrow continues to route through the existing generateCarousel topic flow (unchanged)"
    - "The 'Style ready. Use Generate Carousel below to render.' string is replaced with copy that doesn't claim there's a button below; the actual entry point (prompt-arrow above) is what the user reads as authoritative"
    - "The just-shipped separateOverlappingTextBoxes helper and its callers in generate-from-style-spec.ts / generate-slides.ts are not touched"
    - "autoPublishOnGenerate remains called exactly once per generation (public-by-default invariant preserved)"
  artifacts:
    - path: "src/lib/services/carousel.ts"
      provides: "generateCarouselFromReferences UPDATEs slide_data + generation_status + title + style_spec + reference_assets"
      contains: "style_spec:"
    - path: "src/components/slides/generation-form.tsx"
      provides: "handleSubmit gates Copy Style routing on (inlineSpec.spec != null && inlineSpec.status === 'preview') AND references uploaded; passes reference_assets through to regenerateAction"
      contains: "useReferenceSpec"
    - path: "src/components/style-from-reference/spec-preview-panel.tsx"
      provides: "hideGenerateCta-mode helper line no longer says 'Generate Carousel below'"
      contains: "hideGenerateCta"
    - path: "src/lib/services/__tests__/carousel-from-references.test.ts"
      provides: "Asserts UPDATE payload includes style_spec + reference_assets"
    - path: "src/components/slides/__tests__/generation-form-routing.test.tsx"
      provides: "Asserts arrow routes to regenerateAction when spec extracted; routes to generateCarousel when not"
  key_links:
    - from: "src/components/slides/generation-form.tsx handleSubmit"
      to: "src/app/(dashboard)/style-from-reference/actions.ts regenerateAction"
      via: "useReferenceSpec branch + await regenerateAction(...)"
      pattern: "regenerateAction\\("
    - from: "src/app/(dashboard)/style-from-reference/actions.ts regenerateAction"
      to: "src/lib/services/carousel.ts generateCarouselFromReferences"
      via: "await generateCarouselFromReferences(admin, user.id, input)"
      pattern: "generateCarouselFromReferences\\("
    - from: "src/lib/services/carousel.ts generateCarouselFromReferences UPDATE"
      to: "public.projects row"
      via: "supabase.from('projects').update({ ..., style_spec, reference_assets })"
      pattern: "style_spec:\\s*"
---

<objective>
Wire the prompt-arrow button on /project/[id] to use the extracted Copy Style when one is present, and persist the spec + references on the generated project row so legacy/topic-only paths can no longer silently overwrite a Copy Style-extracted state.

Purpose: Diego diagnosed that even though `GenerationForm.handleSubmit` already branches on `inlineSpec.spec`, the resulting carousels still ship with `style_spec: NULL`, `reference_assets: NULL`, and a deprecated `template_id_override` (`magazine-bold`). Two confirmed root causes:
  1. `generateCarouselFromReferences` in `src/lib/services/carousel.ts` UPDATEs only `slide_data`, `generation_status`, `title` — it never writes `style_spec` or `reference_assets`. So even successful Copy Style runs leave those columns NULL.
  2. The "Style ready. Use Generate Carousel below to render." copy in `spec-preview-panel.tsx` misleads users into looking for a button that doesn't exist in inline-collapsible mode — the arrow at the top IS the entry point.

Output: Persisted spec + references on every Copy Style generation, a routing regression test for the arrow handler (covering both routing paths), and corrected helper copy.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md

# Routing — the prompt-arrow handler (already-wired branch we are hardening)
@src/components/slides/generation-form.tsx

# Persistence sink — the actual missing-columns site
@src/lib/services/carousel.ts

# Server action that calls the persistence sink
@src/app/(dashboard)/style-from-reference/actions.ts

# Misleading copy
@src/components/style-from-reference/spec-preview-panel.tsx

# State machine — for status='preview' invariant
@src/components/style-from-reference/state-machine.ts

# Public-by-default helper — must remain called exactly once per generation
@src/lib/services/auto-publish-on-generate.ts

<interfaces>
<!-- Key contracts the executor needs. Use these directly — do not re-explore. -->

From src/app/(dashboard)/style-from-reference/actions.ts:
```typescript
export interface RegenerateActionInput {
  projectId: string
  spec: StyleSpec
  aspects: SpecPreviewAspects
  useBrandKitRemix: boolean
  brandKit: BrandKit | null
  content: ContentSource          // { mode: 'ai-copy', topic } | { mode: 'user-copy', lines }
  imageSource?: 'stock' | 'ai' | 'none'
  slideCount?: number
}
export type RegenerateActionResult =
  | { ok: true; projectId: string; slideCount: number }
  | { ok: false; error: 'unauthenticated'|'no_spec'|'invalid_input'|'gemini_error'|'token_budget_exceeded'|'extraction_stale'; detail?: string }
```

From src/lib/services/carousel.ts:
```typescript
export interface CarouselFromReferencesInput {
  projectId: string
  spec: StyleSpec
  aspects: SpecPreviewAspects
  brandKit: BrandKit | null
  useBrandKitRemix: boolean
  content: ContentSource
  slideCount?: number
  imageSource?: 'stock' | 'ai' | 'none'
}
// CURRENT UPDATE shape (carousel.ts line ~326):
//   .update({ slide_data, generation_status: 'complete', title })
// MUST BECOME (this plan):
//   .update({ slide_data, generation_status: 'complete', title, style_spec, reference_assets })
```

From src/components/style-from-reference/state-machine.ts (existing — read-only):
```typescript
export type SpecPreviewStatus = 'idle'|'extracting'|'preview'|'generating'|'done'|'error'
export interface SpecPreviewState {
  status: SpecPreviewStatus
  references: ReferenceAssetRow[]    // <- this is the array the new column should mirror
  spec: StyleSpec | null
  aspects: SpecPreviewAspects
  useBrandKitRemix: boolean
  /* ... */
}
```

From src/components/slides/generation-form.tsx (already-wired branch — lines 155–181):
```typescript
const useReferenceSpec =
  inlineSpec?.spec != null && inlineSpec.status === 'preview'

if (useReferenceSpec && inlineSpec?.spec) {
  const result = await regenerateAction({
    projectId,
    spec: inlineSpec.spec,
    aspects: inlineSpec.aspects,
    useBrandKitRemix: inlineSpec.useBrandKitRemix,
    brandKit: brandKit ?? null,
    content: { mode: 'ai-copy', topic: topic.trim() },
    imageSource,
    slideCount: effectiveSlideCount,
  })
  // ...
}
```

From src/lib/services/auto-publish-on-generate.ts (read-only — must keep one call):
```typescript
export async function autoPublishOnGenerate(
  admin: SupabaseClient, userId: string, projectId: string, title: string
): Promise<void>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Persist style_spec + reference_assets on Copy Style generation</name>
  <files>
    src/lib/services/carousel.ts
    src/lib/services/__tests__/carousel-from-references.test.ts
  </files>
  <behavior>
    - Test 1 (RED first): After `generateCarouselFromReferences` resolves, the Supabase `.update(...)` call captured by the mock includes BOTH `style_spec` (the input.spec) AND `reference_assets` (an array — see Task 1.5 below) alongside the existing `slide_data`, `generation_status: 'complete'`, `title`.
    - Test 2: When `input` does not carry a `references` array (legacy callers — none exist in-tree but defend the surface), `reference_assets` is omitted from the update payload rather than written as `undefined`. (Use `expect.not.objectContaining({ reference_assets: undefined })` or assert the JSON shape directly.)
    - Test 3: `autoPublishOnGenerate` is called exactly once per generation (regression guard — public-by-default invariant from project memory).
    - Tests must mock the Supabase client + `searchPhotos` + `generateFromStyleSpec` + `autoPublishOnGenerate`. Do NOT call the real network.
  </behavior>
  <action>
**Step 1.0 — Extend the input shape.**

In `src/lib/services/carousel.ts`, extend `CarouselFromReferencesInput` to accept an optional `references` field:

```typescript
export interface CarouselFromReferencesInput {
  projectId: string
  spec: StyleSpec
  aspects: SpecPreviewAspects
  brandKit: BrandKit | null
  useBrandKitRemix: boolean
  content: ContentSource
  slideCount?: number
  imageSource?: 'stock' | 'ai' | 'none'
  /** quick-260515-dwu: reference rows from the spec-preview reducer. When
   *  present, persisted to projects.reference_assets so legacy/topic-flow
   *  regenerations can't silently overwrite Copy Style state. Optional to
   *  preserve existing callers (Phase 78 regenerateFromReferencesAction
   *  composes its own references separately). */
  references?: ReferenceAssetRow[]
}
```

Import `ReferenceAssetRow` from `@/lib/types/projects-storage-constants` (already used elsewhere in this file or in actions.ts — re-use the same source).

**Step 1.1 — Persist the spec + references in the UPDATE.**

Locate the existing UPDATE block (`carousel.ts` ~line 324-331). Modify the `.update({...})` payload to conditionally include `style_spec` and `reference_assets`:

```typescript
const updatePayload: Record<string, unknown> = {
  slide_data: withBackgrounds,
  generation_status: 'complete',
  title: carousel.title,
  // quick-260515-dwu: persist the spec used by this generation so the
  // project row stops looking like a topic-flow result (style_spec NULL +
  // reference_assets NULL). Pre-Copy-Style projects that re-generate via
  // the topic path leave style_spec untouched (that path doesn't call
  // this function). Fork/remix downstream of REMIX-04 already inherits
  // reference_assets via the fork RPC; this write does not regress it.
  style_spec: input.spec,
}
if (input.references && input.references.length > 0) {
  updatePayload.reference_assets = input.references
}

const { error } = await supabase
  .from('projects')
  .update(updatePayload)
  .eq('id', input.projectId)
  .eq('user_id', userId)
```

Do NOT touch the `searchPhotos` / `applyAspectFilter` / `applyBrandKitRemix` / `generateFromStyleSpec` / `separateOverlappingTextBoxes` composition above this point — that's the just-shipped overlap helper's wiring (quick-260515-8xx) and explicitly out of scope.

Keep the `autoPublishOnGenerate(supabase, userId, input.projectId, carousel.title)` call exactly as it is, one invocation after the UPDATE.

**Step 1.2 — Write the test file.**

Create `src/lib/services/__tests__/carousel-from-references.test.ts`. Mock the dependencies:

- `@/lib/ai/generate-from-style-spec` → return a deterministic carousel object with `slides: [{ image_query: 'x', ... }]` and `title: 'test-title'`. Match the shape currently returned (read the import in carousel.ts if needed for the exact return shape).
- `@/lib/services/auto-publish-on-generate` → spy.
- `@/lib/photos/search-photos` (or wherever `searchPhotos` lives — grep for it in carousel.ts) → return `[]` so background_url ends up null and we avoid mocking Pexels.
- Build a fake Supabase client with `from(...).update(payload).eq(...).eq(...)` returning `{ error: null }`; capture the `payload` for assertion.

Three tests:

1. `persists style_spec + reference_assets on the project row when references are provided`
   - Call with `input = { projectId, spec: STUB_SPEC, references: [STUB_REF_ROW], imageSource: 'none', ... }`.
   - Assert captured payload `expect.objectContaining({ slide_data: expect.any(Array), generation_status: 'complete', title: 'test-title', style_spec: STUB_SPEC, reference_assets: [STUB_REF_ROW] })`.

2. `omits reference_assets when input has no references array`
   - Call without `references`. Assert payload contains `style_spec` but NOT `reference_assets` (`expect(payload).not.toHaveProperty('reference_assets')`).

3. `calls autoPublishOnGenerate exactly once after persistence`
   - Assert the spy was called once with `(supabase, userId, projectId, 'test-title')`.

**Step 1.3 — Validate locally.**

Run the new test file:

```bash
npx vitest run src/lib/services/__tests__/carousel-from-references.test.ts
```

All 3 tests pass. No lint warnings.
  </action>
  <verify>
    <automated>npx vitest run src/lib/services/__tests__/carousel-from-references.test.ts && npx eslint src/lib/services/carousel.ts src/lib/services/__tests__/carousel-from-references.test.ts</automated>
  </verify>
  <done>
    `generateCarouselFromReferences` UPDATE payload includes `style_spec` (always) and `reference_assets` (when the caller provides them). Three new tests pass. ESLint clean on both modified files. No changes to `generateCarousel` (topic flow), `generateFromStyleSpec`, or `separateOverlappingTextBoxes`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Forward references through arrow handler + fix misleading panel copy</name>
  <files>
    src/components/slides/generation-form.tsx
    src/components/slides/__tests__/generation-form-routing.test.tsx
    src/components/style-from-reference/spec-preview-panel.tsx
    src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx
    src/app/(dashboard)/style-from-reference/actions.ts
  </files>
  <behavior>
    - Test 1 (routing — Copy Style branch): Render `GenerationForm` with a stubbed `StyleFromReferenceShell` that immediately fires `onSpecChange` with a `state.status === 'preview'`, non-null `spec`, and non-empty `references`. Type a topic. Click the arrow button. Assert `regenerateAction` was called with `spec` AND `references` (from `inlineSpec.references`), and `generateCarousel` (the topic action) was NOT called.
    - Test 2 (routing — topic-only branch): Render `GenerationForm` with the default `inlineSpec` (null). Type a topic. Click the arrow. Assert `generateCarousel` was called and `regenerateAction` was NOT called.
    - Test 3 (routing — extracted spec but zero references): With `inlineSpec.spec != null` and `inlineSpec.status === 'preview'` but `inlineSpec.references === []`, the arrow falls back to the topic flow (defensive — extraction without references is not a valid Copy Style emit). Assert `generateCarousel` called, `regenerateAction` NOT called.
    - Test 4 (panel copy): In `spec-preview-panel-integration.test.tsx`, render `SpecPreviewPanel` with `hideGenerateCta={true}`. Assert the helper text does NOT contain the substring "Generate Carousel below"; assert it contains the new copy ("Style will be applied" or your chosen phrasing — be specific in the test).
  </behavior>
  <action>
**Step 2.0 — Add `references` field to `RegenerateActionInput`.**

In `src/app/(dashboard)/style-from-reference/actions.ts`, extend `RegenerateActionInput`:

```typescript
export interface RegenerateActionInput {
  projectId: string
  spec: StyleSpec
  aspects: SpecPreviewAspects
  useBrandKitRemix: boolean
  brandKit: BrandKit | null
  content: ContentSource
  imageSource?: 'stock' | 'ai' | 'none'
  slideCount?: number
  /** quick-260515-dwu: forwarded into generateCarouselFromReferences so
   *  the project row's reference_assets column gets populated alongside
   *  style_spec. Inline-collapsible callers (the prompt-arrow handler)
   *  read these from the embedded shell's reducer state. */
  references?: ReferenceAssetRow[]
}
```

Import `ReferenceAssetRow` from `@/lib/types/projects-storage-constants` if not already imported (it is, line ~33).

In the `regenerateAction` body, pass `references` through to `generateCarouselFromReferences`:

```typescript
const result = await generateCarouselFromReferences(admin, user.id, {
  ...input,                // spreads spec, aspects, brandKit, useBrandKitRemix, content, imageSource, slideCount, references
})
```

(The current call already spreads or destructures `input` — confirm and keep the existing shape; just ensure `references` flows through.)

**Step 2.1 — Forward references from the form's handleSubmit.**

In `src/components/slides/generation-form.tsx` `handleSubmit`, the Copy Style branch already calls `regenerateAction`. Add `references` to the input:

```typescript
if (useReferenceSpec && inlineSpec?.spec) {
  const result = await regenerateAction({
    projectId,
    spec: inlineSpec.spec,
    aspects: inlineSpec.aspects,
    useBrandKitRemix: inlineSpec.useBrandKitRemix,
    brandKit: brandKit ?? null,
    content: { mode: 'ai-copy', topic: topic.trim() },
    imageSource,
    slideCount: effectiveSlideCount,
    // quick-260515-dwu: forward the extracted reference rows so the
    // generated project row gets reference_assets populated. Without
    // this the row carries style_spec but no reference_assets and the
    // remix/fork flow downstream of REMIX-04 has nothing to inherit.
    references: inlineSpec.references,
  })
  /* ...existing handling... */
}
```

Harden the `useReferenceSpec` predicate to require at least one reference. This defends the case where the reducer briefly held `status: 'preview'` with an empty references array (shouldn't happen per the state machine, but the bug report's DB evidence shows the routing branched wrong somewhere — belt-and-braces):

```typescript
const useReferenceSpec =
  inlineSpec?.spec != null &&
  inlineSpec.status === 'preview' &&
  inlineSpec.references.length > 0
```

**Step 2.2 — Fix the misleading panel copy.**

In `src/components/style-from-reference/spec-preview-panel.tsx`, locate the `hideGenerateCta` helper line (line ~113-116):

```typescript
{props.hideGenerateCta ? (
  <span className="text-[12px] text-[#7d6161]">
    Style ready. Use Generate Carousel below to render.
  </span>
) : (
  /* ... */
)}
```

Replace with:

```typescript
{props.hideGenerateCta ? (
  <span className="text-[12px] text-[#7d6161]">
    Style ready. Send your prompt above to apply it.
  </span>
) : (
  /* ... */
)}
```

(The arrow button at the top of the form IS the apply trigger; the copy now points to it instead of inventing a phantom button.)

**Step 2.3 — Write the routing tests.**

Create `src/components/slides/__tests__/generation-form-routing.test.tsx`. Mock:

- `@/app/(dashboard)/project/[id]/actions` → `generateCarousel` as a vitest spy returning `{ success: true }`.
- `@/app/(dashboard)/style-from-reference/actions` → `regenerateAction` as a vitest spy returning `{ ok: true, projectId: 'p1', slideCount: 5 }`. Also stub `regenerateAction` to be a function the test can assert on.
- `@/components/style-from-reference/style-from-reference-shell` → stub `StyleFromReferenceShell` to a component that, on mount, fires `onSpecChange` with whatever fixture the test passes (use a module-level mutable fixture or a context). Keep it simple: render `null` and fire the effect once.
- `next/navigation` → `useRouter` stub with `refresh` and `push` as spies.
- `@/app/(dashboard)/project/[id]/editor-actions` → `createUploadUrl` stub (form imports it but the routing tests don't exercise upload).

Tests:

1. `routes to regenerateAction when inlineSpec has spec + status preview + non-empty references`:
   - Configure shell stub to fire `onSpecChange` with `{ status: 'preview', spec: STUB_SPEC, references: [STUB_REF], aspects: {palette:true, typography:true, layout:true, decorations:true}, useBrandKitRemix: false }`.
   - Render `<GenerationForm projectId="p1" hasSlides={false} />`.
   - Open the Copy Style collapsible (or skip — the shell stub fires regardless; verify by setting `inlineSpec` state directly via the onSpecChange callback firing on mount).
   - Type "test topic" in the textarea.
   - Click the arrow button (`aria-label="Generate carousel"`).
   - `await waitFor(() => expect(regenerateAction).toHaveBeenCalledTimes(1))`.
   - Assert `regenerateAction` was called with payload containing `spec: STUB_SPEC`, `references: [STUB_REF]`, `content: { mode: 'ai-copy', topic: 'test topic' }`.
   - Assert `generateCarousel` was NOT called.

2. `routes to generateCarousel (topic flow) when inlineSpec is null`:
   - Shell stub fires `onSpecChange` with the initial `idle`-status state (or doesn't fire at all — same effect since `inlineSpec` defaults to null).
   - Type topic, click arrow.
   - Assert `generateCarousel` called once with `(projectId, topic, templateId, imageSource, slideCount, advancedOptions)`.
   - Assert `regenerateAction` was NOT called.

3. `falls back to generateCarousel when spec is extracted but references array is empty`:
   - Shell stub fires `onSpecChange` with `{ status: 'preview', spec: STUB_SPEC, references: [], ... }`.
   - Type topic, click arrow.
   - Assert `generateCarousel` called, `regenerateAction` NOT called.

The `StyleFromReferenceShell` mock should be implemented so the test can swap the fired state per-test — easiest pattern is a `let nextSpecPreviewState: SpecPreviewState | null = null` module variable; the mock fires `useEffect(() => { if (nextSpecPreviewState) onSpecChange?.(nextSpecPreviewState) }, [])` on mount.

**Step 2.4 — Update the panel integration test.**

In `src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx`, find any existing test that exercises `hideGenerateCta={true}` and asserts the old copy. If a test asserts the "Generate Carousel below" string, update its expected text to the new copy. If none exists, add a new test:

```typescript
it('Test N: hideGenerateCta helper text points to the prompt above, not a phantom button below', () => {
  render(<SpecPreviewPanel
    state={previewStateWithSpec()}
    dispatch={vi.fn()}
    brandKit={null}
    onGenerate={vi.fn()}
    onReExtract={vi.fn()}
    hideGenerateCta
  />)
  expect(screen.queryByText(/Generate Carousel below/)).toBeNull()
  expect(screen.getByText(/Send your prompt above to apply it/)).toBeInTheDocument()
})
```

**Step 2.5 — Validate.**

Run the affected test files plus lint:

```bash
npx vitest run \
  src/components/slides/__tests__/generation-form-routing.test.tsx \
  src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx \
  src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx \
&& npx eslint \
  src/components/slides/generation-form.tsx \
  src/components/style-from-reference/spec-preview-panel.tsx \
  src/app/\(dashboard\)/style-from-reference/actions.ts
```

The existing `style-from-reference-shell.test.tsx` source-grep firewall (Test 5 per the file's header) must still pass — we did NOT hoist the inner Generate CTA out of `SpecPreviewPanel`, and the helper copy change does not introduce mimicry-framing tokens (no "exactly like" / "clone" / "copy" / "duplicate").

All tests green; lint clean.
  </action>
  <verify>
    <automated>npx vitest run src/components/slides/__tests__/generation-form-routing.test.tsx src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx && npx eslint src/components/slides/generation-form.tsx src/components/style-from-reference/spec-preview-panel.tsx 'src/app/(dashboard)/style-from-reference/actions.ts'</automated>
  </verify>
  <done>
    - Arrow handler routes to `regenerateAction` when `inlineSpec.spec` + `status === 'preview'` + `references.length > 0`, and forwards `references` so the persistence sink (Task 1) writes the column.
    - Arrow falls back to `generateCarousel` (topic flow) when no spec OR no references.
    - Helper copy in `SpecPreviewPanel` no longer claims a button exists below.
    - Three routing tests + one copy-change test pass.
    - ESLint clean on all three modified TSX/TS files.
    - The PREVIEW-01 source-grep invariant in `style-from-reference-shell.test.tsx` Test 5 still passes (we didn't move the inner Generate CTA).
  </done>
</task>

</tasks>

<verification>
Final end-to-end check (run all test files modified by this plan + a focused regression set):

```bash
npx vitest run \
  src/lib/services/__tests__/carousel-from-references.test.ts \
  src/components/slides/__tests__/generation-form-routing.test.tsx \
  src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx \
  src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx \
  src/components/style-from-reference/__tests__/recovery-integration.test.tsx
```

All green. No new ESLint errors in any modified file:

```bash
npx eslint \
  src/lib/services/carousel.ts \
  src/lib/services/__tests__/carousel-from-references.test.ts \
  src/components/slides/generation-form.tsx \
  src/components/slides/__tests__/generation-form-routing.test.tsx \
  src/components/style-from-reference/spec-preview-panel.tsx \
  src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx \
  'src/app/(dashboard)/style-from-reference/actions.ts'
```

Source-grep invariant (PREVIEW-01) still holds:

```bash
grep -n "Generate Carousel below" src/components/style-from-reference/spec-preview-panel.tsx
# expected: no output (string removed)

grep -cE "magazine-bold|reference_artist|reference_brand|copy_exactly|style_freetext" src/components/slides/generation-form.tsx src/lib/services/carousel.ts 'src/app/(dashboard)/style-from-reference/actions.ts'
# expected: 0 0 0 (closed-enum + LEGAL-03 still clean)
```

Public-by-default still wired (regression guard):

```bash
grep -n "autoPublishOnGenerate" src/lib/services/carousel.ts
# expected: two matches (one import, one call inside generateCarouselFromReferences) — unchanged from baseline
```
</verification>

<success_criteria>
- `generateCarouselFromReferences` writes `style_spec` (always) and `reference_assets` (when provided) on the UPDATEd `public.projects` row.
- The prompt-arrow on `/project/[id]` routes to `regenerateAction` whenever a valid Copy Style extraction state is present (spec + `status==='preview'` + non-empty references), and forwards `references` end-to-end.
- The misleading "Generate Carousel below" copy is gone; the new helper points the user to the arrow above (the actual entry point).
- `autoPublishOnGenerate` is still called exactly once per Copy Style generation (public-by-default invariant intact).
- The just-shipped `separateOverlappingTextBoxes` helper and its callers are untouched.
- All four new tests pass; no existing test regresses; ESLint clean across all modified files.
- The PREVIEW-01 source-grep firewall in `style-from-reference-shell.test.tsx` Test 5 still passes (inner Generate CTA remains inside `SpecPreviewPanel`'s `status==='preview'` guard).
</success_criteria>

<output>
After completion, create `.planning/quick/260515-dwu-wire-prompt-arrow-to-use-extracted-copy-/260515-dwu-SUMMARY.md` capturing:
  - Files changed (5 source + 2 test files)
  - Test count delta (+4 new tests across 2 files)
  - DB row shape after a Copy Style generation: `style_spec` + `reference_assets` non-null; `template_id` left as `'bold-minimal'` default (template path is irrelevant in the Copy Style flow — spec drives rendering)
  - Any follow-ups (deprecated `template_id_override: 'magazine-bold'` from the AI emit is OUT OF SCOPE — separate medium-severity bug)
</output>
