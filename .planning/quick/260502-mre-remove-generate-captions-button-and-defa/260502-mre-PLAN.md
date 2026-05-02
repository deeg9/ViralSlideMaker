---
phase: quick-260502-mre
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/editor/slide-editor.tsx
  - src/app/(dashboard)/project/[id]/actions.ts
autonomous: true
requirements:
  - QUICK-260502-MRE-01  # Remove "Generate Captions" entry point from slide editor
  - QUICK-260502-MRE-02  # Newly generated carousels default to Public (auto-publish)

must_haves:
  truths:
    - "The slide editor no longer renders a 'Generate Captions' button"
    - "The CaptionPanel is no longer reachable from the slide editor (no import, no state, no render block)"
    - "After generateCarousel completes successfully, the project has a row in published_carousels"
    - "The editor visibility dropdown shows 'Public' for a freshly generated carousel"
    - "If publishing fails post-generation, generateCarousel still returns { success: true, slideCount } and the slide_data is persisted"
  artifacts:
    - path: "src/components/editor/slide-editor.tsx"
      provides: "Slide editor without the Generate Captions entry point"
      must_not_contain:
        - "from '@/components/captions/caption-panel'"
        - "showCaptions"
        - "Generate Captions"
    - path: "src/app/(dashboard)/project/[id]/actions.ts"
      provides: "generateCarousel auto-publishes after persisting slide_data"
      contains: "publishProjectToExplore"
  key_links:
    - from: "src/app/(dashboard)/project/[id]/actions.ts"
      to: "src/app/(dashboard)/project/[id]/publish-actions.ts"
      via: "publishProjectToExplore(projectId, formData)"
      pattern: "publishProjectToExplore\\("
    - from: "generateCarousel try-block (post-projects.update)"
      to: "auto-publish call"
      via: "synthesized FormData with title=carousel.title, description='', tags=''"
      pattern: "publishFormData\\.set\\('title'"
---

<objective>
Two small UX corrections to the slide editor and carousel generation flow:

1. Remove the "Generate Captions" button (and its dead state/import/render block) from `slide-editor.tsx`. The captions feature itself stays in the codebase — only the entry point is removed.

2. Make freshly generated carousels Public by default by auto-invoking the existing `publishProjectToExplore` server action immediately after `generateCarousel` persists `slide_data`. Failures in the auto-publish step must NOT fail the generation.

Purpose: The captions UI is being deprecated from the editor surface, and the visibility dropdown advertises "Public (Default)" but the underlying data path leaves new carousels Private until the user manually publishes — fix that drift.

Output:
- Edited `src/components/editor/slide-editor.tsx` (4 deletions, no additions)
- Edited `src/app/(dashboard)/project/[id]/actions.ts` (auto-publish wired into `generateCarousel` with isolated try/catch)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<!-- Source files - read these directly, do not re-research -->
@src/components/editor/slide-editor.tsx
@src/app/(dashboard)/project/[id]/actions.ts
@src/app/(dashboard)/project/[id]/publish-actions.ts

<interfaces>
<!-- Key contracts the executor needs. Already verified in the orchestrator's codebase map. -->

From src/app/(dashboard)/project/[id]/publish-actions.ts:67:
```typescript
export async function publishProjectToExplore(
  projectId: string,
  formData: FormData,
): Promise<PublishResult>
```
- Reads title/description/tags from FormData
- Re-reads project from DB (slide_data must already be saved)
- Renders a hero PNG via Satori (~1-3s)
- Calls publish_carousel RPC, inserts into published_carousels
- Calls revalidatePath internally — caller must NOT double-call

From src/app/(dashboard)/project/[id]/actions.ts (current shape, lines 316-330):
```typescript
// 3. Save to database
await supabase
  .from('projects')
  .update({
    slide_data: slides,
    template_id: templateId,
    title: carousel.title,
    topic,
    generation_status: 'complete',
  })
  .eq('id', projectId)

revalidatePath(`/project/${projectId}`)
revalidatePath('/dashboard')
return { success: true, slideCount: slides.length }
```
`carousel.title` is already in scope at this point (line 322 reads it).

From src/components/editor/slide-editor.tsx:
- Line 14: `import { CaptionPanel } from '@/components/captions/caption-panel'` — REMOVE
- Line 82: `const [showCaptions, setShowCaptions] = useState(false)` — REMOVE
- Lines 950-956: "Generate Captions" button — REMOVE
- Lines 968-975: `{showCaptions && <CaptionPanel ... />}` — REMOVE
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Generate Captions entry point from slide editor</name>
  <files>src/components/editor/slide-editor.tsx</files>
  <action>
    Remove the four pieces of dead-after-removal code that wire up the "Generate Captions" button.

    Per QUICK-260502-MRE-01, delete (in this order, top-down):

    1. **Line 14 — import statement:**
       Delete: `import { CaptionPanel } from '@/components/captions/caption-panel'`

    2. **Line 82 — state hook:**
       Delete: `const [showCaptions, setShowCaptions] = useState(false)`

    3. **Lines 950-956 — the button:**
       Delete the entire `<button onClick={() => setShowCaptions(!showCaptions)} ...>...Generate Captions...</button>` element. Do not leave a stray comma, JSX fragment, or comment behind. Verify the surrounding JSX is still well-formed (sibling elements remain intact).

    4. **Lines 968-975 — the conditional render:**
       Delete the `{showCaptions && <CaptionPanel ... />}` block in its entirety.

    Do NOT touch:
    - `src/lib/captions/*`
    - `src/app/(dashboard)/project/[id]/caption-actions.ts`
    - `src/components/captions/caption-panel.tsx`
    - The `vi.mock('@/components/captions/caption-panel', ...)` calls in the three test files
      (`slide-editor.treatment-sync.test.tsx:78`, `slide-editor.shortcuts.test.tsx:57`,
      `slide-editor.watermark-sync.test.tsx:85`). Unused vi.mock is harmless and out of scope.

    Re-read the file after edits to confirm no orphaned `showCaptions` / `setShowCaptions` /
    `CaptionPanel` symbol references remain.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && grep -nE "showCaptions|setShowCaptions|CaptionPanel|Generate Captions" src/components/editor/slide-editor.tsx; test $(grep -cE "showCaptions|setShowCaptions|CaptionPanel|Generate Captions" src/components/editor/slide-editor.tsx) -eq 0 && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
    - `grep` returns zero matches for `showCaptions`, `setShowCaptions`, `CaptionPanel`, and `Generate Captions` in `slide-editor.tsx`
    - `npx tsc --noEmit` exits 0 (no type errors introduced)
    - The slide editor still renders all other panels (text/elements/images) unchanged in the JSX tree (visual diff: only the Generate Captions button gone)
  </done>
</task>

<task type="auto">
  <name>Task 2: Auto-publish newly generated carousels in generateCarousel</name>
  <files>src/app/(dashboard)/project/[id]/actions.ts</files>
  <action>
    Per QUICK-260502-MRE-02, wire `publishProjectToExplore` into `generateCarousel` so freshly
    generated carousels default to Public.

    **Why option (a) — `publishProjectToExplore`:**
    Reuses the production publish path (hero render + tag normalization + `publish_carousel` RPC),
    runs as the authenticated user (no admin client / RLS bypass), and is the same code path the
    user would hit by clicking "Publish" manually. Option (b) — `publishProjectAdmin` — bypasses
    RLS via `createAdminClient()` and is intended for the API-key path; wrong layer for a user
    server action.

    **Implementation:**

    1. Add the import at the top of the file (group with other server-action imports):
       ```ts
       import { publishProjectToExplore } from '@/app/(dashboard)/project/[id]/publish-actions'
       ```

    2. After the `await supabase.from('projects').update({...}).eq('id', projectId)` call (currently
       lines 317-326) and BEFORE the `revalidatePath(...)` calls (currently lines 328-329), insert
       an isolated try/catch that auto-publishes:

       ```ts
       // QUICK-260502-MRE-02: auto-publish so newly generated carousels default to Public.
       // Wrapped in its own try/catch — slide_data is already persisted above, so a publish
       // failure here must NOT mark the entire generation as failed. The user can publish
       // manually from the editor if this best-effort step fails.
       try {
         const publishFormData = new FormData()
         publishFormData.set('title', carousel.title)
         publishFormData.set('description', '')
         publishFormData.set('tags', '')
         const publishResult = await publishProjectToExplore(projectId, publishFormData)
         if (!publishResult.success) {
           console.error(
             '[generateCarousel] auto-publish failed (non-fatal):',
             publishResult.error,
           )
         }
       } catch (publishErr) {
         console.error('[generateCarousel] auto-publish threw (non-fatal):', publishErr)
       }
       ```

    3. Leave the existing `revalidatePath(...)` calls and `return { success: true, slideCount: slides.length }`
       in place. `publishProjectToExplore` already calls `revalidatePath` internally — the existing
       calls in `generateCarousel` cover paths that publish doesn't (e.g. `/dashboard`), so leave
       them. Do NOT add new revalidatePath calls.

    4. Do NOT change the outer try/catch at lines 331-341 — a publish error must not flow through
       the `generation_status: 'error'` branch.

    **Out of scope:**
    - Do NOT refactor `publishProjectToExplore`.
    - Do NOT change the visibility-dropdown or `initialPublishedState` plumbing.
    - Do NOT add a feature flag — this is the new default behavior.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && grep -nE "publishProjectToExplore" src/app/\(dashboard\)/project/\[id\]/actions.ts && grep -nE "publishFormData\.set\('title'" src/app/\(dashboard\)/project/\[id\]/actions.ts && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
    - `publishProjectToExplore` is imported and called inside `generateCarousel`
    - The auto-publish call is wrapped in its own try/catch with `console.error` on failure
    - `npx tsc --noEmit` exits 0
    - Manual smoke (deferred to Task 3): generate a carousel, observe it shows "Public" in the visibility dropdown without manually publishing
  </done>
</task>

<task type="auto">
  <name>Task 3: Build + test gate</name>
  <files>(no edits — verification only)</files>
  <action>
    Run the existing build and slide-editor unit tests to confirm Tasks 1 and 2 introduced no
    regressions. The three slide-editor test files (`treatment-sync`, `shortcuts`, `watermark-sync`)
    each contain a `vi.mock('@/components/captions/caption-panel', ...)` that becomes unused after
    Task 1; vitest does NOT fail on unused vi.mock so this is harmless.

    Steps:
    1. `npm run build` — ensures the App Router server actions and editor compile end-to-end.
    2. `npx vitest run src/components/editor/__tests__` — exercises the three slide-editor test
       suites that previously imported the (now removed) Generate Captions button context.
    3. `npx vitest run src/app/\(dashboard\)/project/\[id\]/__tests__ 2>/dev/null || true` —
       run actions/publish-actions tests if they exist (do not fail the gate if no tests exist
       at that path; the `|| true` is intentional).

    If build or unit tests fail, halt and surface the error — do not paper over with new tests.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow && npm run build && npx vitest run src/components/editor/__tests__</automated>
  </verify>
  <done>
    - `npm run build` exits 0
    - All slide-editor `__tests__` suites pass
    - No new `vi.mock` warnings escalated to failures
  </done>
</task>

</tasks>

<verification>
Whole-plan checks (run after all three tasks):

1. **Static**: `grep -nE "showCaptions|setShowCaptions|CaptionPanel|Generate Captions" src/components/editor/slide-editor.tsx` returns no lines.
2. **Static**: `grep -n "publishProjectToExplore" src/app/\(dashboard\)/project/\[id\]/actions.ts` shows both the import and the call site.
3. **Type**: `npx tsc --noEmit` exits 0.
4. **Build**: `npm run build` exits 0.
5. **Unit**: `npx vitest run src/components/editor/__tests__` all green.
6. **Manual smoke** (recommended, not gating): generate a carousel from the dashboard; the editor opens with "Public" selected in the visibility dropdown. The "Generate Captions" button is absent.
</verification>

<success_criteria>
- "Generate Captions" button + state + import + render block fully removed from `slide-editor.tsx`
- `generateCarousel` auto-publishes via `publishProjectToExplore` after persisting `slide_data`
- Auto-publish failure logs but does not flip `generation_status` to `error` and still returns `{ success: true, slideCount }`
- Type-check, build, and slide-editor unit tests all pass
- No changes to caption feature internals or publish-actions internals
</success_criteria>

<output>
After completion, create `.planning/quick/260502-mre-remove-generate-captions-button-and-defa/260502-mre-SUMMARY.md`
</output>
