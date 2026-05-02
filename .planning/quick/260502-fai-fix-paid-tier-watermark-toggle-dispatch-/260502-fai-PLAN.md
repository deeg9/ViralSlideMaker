---
phase: quick-260502-fai
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/editor/slide-editor.tsx
  - src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx
autonomous: true
requirements:
  - QUICK-260502-FAI-01
must_haves:
  truths:
    - "Paid-tier user toggling 'Show watermark' on flips the Switch visually without a refresh"
    - "Paid-tier user toggling 'Show watermark' on causes the watermark to render in <SlidePreview> immediately"
    - "Paid-tier user toggling 'Show watermark' off hides the watermark immediately"
    - "Uploading a custom logo updates the WatermarkControls preview thumbnail without a refresh"
    - "Removing a custom logo clears the preview thumbnail without a refresh"
    - "The server action updateSlideWatermark still runs (DB persistence preserved)"
  artifacts:
    - path: "src/components/editor/slide-editor.tsx"
      provides: "Three watermark handlers that BOTH dispatch UPDATE_SLIDE and call the server action"
      contains: "dispatch({ type: 'UPDATE_SLIDE'"
    - path: "src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx"
      provides: "Vitest coverage proving the toggle handler updates local state"
      contains: "handleSlideWatermarkChange"
  key_links:
    - from: "handleSlideWatermarkChange"
      to: "editor reducer"
      via: "dispatch({ type: 'UPDATE_SLIDE', index: selectedIndex, updates: { style_overrides: { ..., watermark: { ...existing, ...spec } } } })"
      pattern: "dispatch\\(\\{\\s*type:\\s*'UPDATE_SLIDE'"
    - from: "handleWatermarkLogoUpload"
      to: "editor reducer"
      via: "dispatch UPDATE_SLIDE with style_overrides.watermark.customLogoUrl after successful PUT"
      pattern: "customLogoUrl:\\s*uploadInfo\\.publicUrl"
    - from: "handleWatermarkLogoRemove"
      to: "editor reducer"
      via: "dispatch UPDATE_SLIDE with style_overrides.watermark.customLogoUrl: undefined"
      pattern: "customLogoUrl:\\s*undefined"
---

<objective>
Fix the paid-tier watermark toggle in the slide editor right rail. Today, clicking the toggle on a plus/pro account persists to the DB but never updates local React state, so the Switch visually stays off and the preview never shows the watermark until a hard refresh. Three handlers in `slide-editor.tsx` (`handleSlideWatermarkChange`, `handleWatermarkLogoUpload`, `handleWatermarkLogoRemove`) currently call the server action only — they must additionally dispatch `UPDATE_SLIDE` to the editor reducer so `slides[selectedIndex].style_overrides.watermark` reflects the change immediately.

Purpose: Restore the paid-tier watermark UX (the feature shipped in quick-260502-er5 is currently invisible to users without a refresh — pre-PMF, this looks like a broken feature).
Output: Three patched handlers that mirror the server-side merge shape, plus a vitest case proving local state syncs.

Out of scope (do NOT touch — noted as follow-up):
- `handleSlideTreatmentChange` (lines 92-99) has the same shape bug but is not user-reported. Leave it alone for this quick fix.
- `updateSlideWatermark` server action — tier enforcement is correct.
- `resolveForcedWatermark` and `WatermarkControls` — they read `slide` correctly; the bug is upstream.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@src/components/editor/slide-editor.tsx
@src/components/editor/watermark-controls.tsx
@src/lib/editor/editor-reducer.ts
@src/components/editor/__tests__/watermark-controls.test.tsx

<interfaces>
<!-- The exact merge shape the server uses — client must match for client+server agreement. -->

From src/app/(dashboard)/project/[id]/editor-actions.ts (lines 399-403, do NOT modify):
```typescript
const existing = slide.style_overrides?.watermark ?? {}
slide.style_overrides = {
  ...(slide.style_overrides ?? {}),
  watermark: { ...existing, ...patch },
}
```

From src/lib/editor/editor-reducer.ts (UPDATE_SLIDE case, lines 141-155):
```typescript
case 'UPDATE_SLIDE': {
  const slides = state.present.map((slide, i) => {
    if (i !== action.index) return slide
    const updated = { ...slide, ...action.updates }
    // NOTE: reducer ALREADY merges style_overrides shallowly when both sides exist.
    if (action.updates.style_overrides && slide.style_overrides) {
      updated.style_overrides = {
        ...slide.style_overrides,
        ...action.updates.style_overrides,
      }
    }
    return updated
  })
  return pushHistory(state, slides)
}
```

IMPORTANT: The reducer's shallow merge means if you pass `updates.style_overrides = { watermark: { enabled: true } }` WITHOUT spreading the existing overrides, the reducer's `...slide.style_overrides` spread will preserve sibling keys (e.g., `hook_position`) — but the `watermark` sub-object will be REPLACED by yours, NOT deep-merged. So the action's `updates.style_overrides.watermark` MUST already contain `{ ...existing, ...spec }`. Mirror exactly what the server does.

Reference patterns already in slide-editor.tsx:
- `handleUpdate` (lines 304-306): simplest dispatch example
- `handlePositionChange` (lines 308-334): dispatch merging into style_overrides correctly
- `handleWidthChange` (lines 336-357): same merge pattern
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Dispatch UPDATE_SLIDE in the three watermark handlers (toggle, upload, remove)</name>
  <files>src/components/editor/slide-editor.tsx</files>
  <behavior>
    - When `handleSlideWatermarkChange(spec)` is invoked, the editor's React state for `slides[selectedIndex].style_overrides.watermark` reflects `{ ...existingWatermark, ...spec }` synchronously (before/alongside the server action), and the existing `updateSlideWatermark` server call still fires inside the `useTransition`.
    - When `handleWatermarkLogoUpload(file)` succeeds (PUT 2xx), `slides[selectedIndex].style_overrides.watermark.customLogoUrl` is set to `uploadInfo.publicUrl` in local state. The server action is still called.
    - When `handleWatermarkLogoRemove()` is invoked, `slides[selectedIndex].style_overrides.watermark.customLogoUrl` becomes `undefined` in local state. The server action is still called with `{ customLogoUrl: undefined }`.
    - Existing spinner behavior via `isWatermarkPending` is preserved (server work still runs inside `startWatermarkTransition`).
    - Free-tier callers are not affected — the WatermarkControls Switch is `disabled` for free; these handlers never fire (and the server still rejects defensively).
    - Other slide state is untouched — sibling `style_overrides` keys (e.g., `hook_position`, `body_position`, `treatment`) survive the dispatch.
  </behavior>
  <action>
    Patch three `useCallback` handlers in `src/components/editor/slide-editor.tsx`:

    1. **`handleSlideWatermarkChange`** (currently lines ~103-110): before calling `updateSlideWatermark`, dispatch UPDATE_SLIDE with the merged watermark. Use the exact merge shape the server uses:
       ```ts
       const handleSlideWatermarkChange = useCallback((spec: WatermarkSpec) => {
         if (!currentSlide) return
         const existing = currentSlide.style_overrides?.watermark ?? {}
         dispatch({
           type: 'UPDATE_SLIDE',
           index: selectedIndex,
           updates: {
             style_overrides: {
               ...(currentSlide.style_overrides ?? {}),
               watermark: { ...existing, ...spec },
             },
           },
         })
         startWatermarkTransition(async () => {
           const result = await updateSlideWatermark(projectId, selectedIndex, spec)
           if (!result.success) {
             console.warn('[updateSlideWatermark] failed:', result.error)
           }
         })
       }, [projectId, selectedIndex, currentSlide, dispatch])
       ```

    2. **`handleWatermarkLogoUpload`** (currently lines ~112-135): after the PUT succeeds and BEFORE/ALONGSIDE the server-action call, dispatch UPDATE_SLIDE setting `customLogoUrl: uploadInfo.publicUrl`. Keep the dispatch inside the transition's async block (post-PUT) so we never optimistically advertise a logo that didn't upload. Pattern:
       ```ts
       const handleWatermarkLogoUpload = useCallback((file: File) => {
         startWatermarkTransition(async () => {
           try {
             const uploadInfo = await createUploadUrl(projectId, file.name)
             const putRes = await fetch(uploadInfo.signedUrl, {
               method: 'PUT',
               headers: { 'Content-Type': file.type },
               body: file,
             })
             if (!putRes.ok) {
               console.warn('[watermarkLogoUpload] PUT failed:', putRes.status)
               return
             }
             // Sync local state BEFORE awaiting the server action so the UI flips immediately.
             if (currentSlide) {
               const existing = currentSlide.style_overrides?.watermark ?? {}
               dispatch({
                 type: 'UPDATE_SLIDE',
                 index: selectedIndex,
                 updates: {
                   style_overrides: {
                     ...(currentSlide.style_overrides ?? {}),
                     watermark: { ...existing, customLogoUrl: uploadInfo.publicUrl },
                   },
                 },
               })
             }
             const result = await updateSlideWatermark(projectId, selectedIndex, {
               customLogoUrl: uploadInfo.publicUrl,
             })
             if (!result.success) {
               console.warn('[watermarkLogoUpload] persist failed:', result.error)
             }
           } catch (e) {
             console.warn('[watermarkLogoUpload] error:', (e as Error).message)
           }
         })
       }, [projectId, selectedIndex, currentSlide, dispatch])
       ```

    3. **`handleWatermarkLogoRemove`** (currently lines ~137-146): dispatch UPDATE_SLIDE clearing `customLogoUrl`, then call the server action. Pattern:
       ```ts
       const handleWatermarkLogoRemove = useCallback(() => {
         if (currentSlide) {
           const existing = currentSlide.style_overrides?.watermark ?? {}
           dispatch({
             type: 'UPDATE_SLIDE',
             index: selectedIndex,
             updates: {
               style_overrides: {
                 ...(currentSlide.style_overrides ?? {}),
                 watermark: { ...existing, customLogoUrl: undefined },
               },
             },
           })
         }
         startWatermarkTransition(async () => {
           const result = await updateSlideWatermark(projectId, selectedIndex, {
             customLogoUrl: undefined,
           })
           if (!result.success) {
             console.warn('[watermarkLogoRemove] failed:', result.error)
           }
         })
       }, [projectId, selectedIndex, currentSlide, dispatch])
       ```

    Constraints:
    - Add `currentSlide` and `dispatch` to the dep arrays of all three handlers.
    - Note: `currentSlide` is declared at line 232 — these handlers (lines ~103-146) are declared BEFORE `currentSlide`. You can either (a) move `currentSlide` above the handlers, or (b) inline the read with `slides[selectedIndex]` in each handler. Prefer (a) — moving `const currentSlide = slides[selectedIndex]` from line 232 up to immediately before the first useTransition (around line 91) — and add `slides` to the dep array of any other consumer that already references `currentSlide` (none should need changes since `currentSlide` is just `slides[selectedIndex]`). Verify by running the existing test suites in <verify>.
    - Do NOT touch `handleSlideTreatmentChange` (out of scope — has same bug shape but is a separate quick).
    - Do NOT modify the server action `updateSlideWatermark` or `resolveForcedWatermark`.
    - Add a `// quick-260502-fai:` comment above each modified handler citing the bug ("local-state sync"), per project commit conventions.

    Add a comment at the top of the watermark handler block citing the follow-up:
    ```ts
    // quick-260502-fai: NOTE — handleSlideTreatmentChange (above) has the same
    // local-state-sync bug shape but is not user-reported. Fix in a separate
    // quick if/when surfaced.
    ```
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow &amp;&amp; npm run lint -- --file src/components/editor/slide-editor.tsx 2>&amp;1 | tail -20 &amp;&amp; npx vitest run src/components/editor/__tests__/watermark-controls.test.tsx src/components/editor/__tests__/slide-editor.shortcuts.test.tsx 2>&amp;1 | tail -30 &amp;&amp; grep -c "dispatch({" src/components/editor/slide-editor.tsx | awk '{ if ($1 < 7) { print "FAIL: expected at least 7 dispatch calls (3 new + existing), got " $1; exit 1 } else { print "OK: " $1 " dispatch calls" } }' &amp;&amp; grep -c "watermark: { ...existing" src/components/editor/slide-editor.tsx | awk '{ if ($1 != 3) { print "FAIL: expected exactly 3 watermark merge sites, got " $1; exit 1 } else { print "OK: 3 watermark merge sites" } }'</automated>
  </verify>
  <done>
    - Three handlers each dispatch UPDATE_SLIDE with `{ ...existing, ...patch }` semantics.
    - `currentSlide` and `dispatch` appear in the `useCallback` dep arrays of all three handlers.
    - `npm run lint` reports no new errors on the modified file.
    - Existing `watermark-controls.test.tsx` and `slide-editor.shortcuts.test.tsx` still pass.
    - Server action call sites (`updateSlideWatermark(...)`) remain untouched.
    - The `handleSlideTreatmentChange` handler is unchanged.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Vitest case proving the toggle dispatches UPDATE_SLIDE locally</name>
  <files>src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx</files>
  <behavior>
    Three test cases exercising the toggle/upload/remove paths so future regressions are caught:
    - **Test A — toggle on (paid):** Render `<SlideEditor>` for a paid (plus/pro) user with a single slide that has no watermark set. Click the "Show watermark" Switch. Assert the Switch becomes `aria-checked="true"` (i.e., the React-state slide now has `enabled: true`) WITHOUT awaiting any network. Assert the mocked `updateSlideWatermark` server action was called once with `{ enabled: true }`.
    - **Test B — toggle off (paid):** Same setup but slide starts with `style_overrides.watermark.enabled = true`. Click the Switch. Assert it flips to `aria-checked="false"` and the mock was called with `{ enabled: false }`.
    - **Test C — logo remove:** Slide starts with `customLogoUrl: 'https://x.test/logo.png'`. Click "Remove". Assert the preview thumbnail disappears (the upload-button reappears, i.e., `customLogoUrl` is gone from local state) and the server action is called with `{ customLogoUrl: undefined }`.

    All three tests must run without a real server: mock `@/app/(dashboard)/project/[id]/editor-actions` (`updateSlideWatermark` returns `{ success: true, slide }`; other exports stubbed if imported). Mock `createUploadUrl` only if Task A actually invokes it (it shouldn't — toggle and remove don't upload).

    If wiring `<SlideEditor>` end-to-end in tests proves awkward (heavy props, many imports), the executor MAY instead extract a tiny pure helper `mergeWatermarkPatch(slide, spec): Partial<Slide>` from the toggle handler and unit-test it directly — but only if the helper genuinely reads cleaner; otherwise keep the dispatch inline and test through the component.
  </behavior>
  <action>
    Create `src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx`. Mirror the import/setup style of the existing `slide-editor.shortcuts.test.tsx` (same component under test, same render scaffolding).

    Mocking strategy:
    - `vi.mock('@/app/(dashboard)/project/[id]/editor-actions', () => ({ updateSlideWatermark: vi.fn(async () => ({ success: true, slide: makeSlide() })), updateSlideTreatment: vi.fn(async () => ({ success: true, slide: makeSlide() })), saveSlideData: vi.fn(async () => ({ success: true })), saveTemplateId: vi.fn(async () => ({ success: true })), createUploadUrl: vi.fn(async () => ({ signedUrl: 'https://x.test/sig', publicUrl: 'https://x.test/pub.png' })) }))` — adjust to match what `slide-editor.tsx` actually imports (read the file, mock everything the component reaches at module load).

    Helper:
    ```ts
    function makeSlide(watermark?: NonNullable<SlideStyleOverrides['watermark']>): Slide {
      return {
        hook_text: '', body_text: '', image_query: '', is_cta: false,
        background_url: 'https://example.com/photo.png', pexels_photo_id: null,
        ...(watermark ? { style_overrides: { watermark } } : {}),
      }
    }
    ```

    Render with the minimum props `<SlideEditor>` requires (read the component's prop types from `slide-editor.tsx`). Pass `userTier="pro"` so the WatermarkControls Switch is enabled.

    Assertions:
    - For toggle tests: locate the watermark Switch via `screen.getByLabelText('Show watermark')` (the WatermarkControls already sets `aria-label="Show watermark"`), `fireEvent.click(switchEl)`, then assert `switchEl.getAttribute('aria-checked') === 'true'` (or false for off). Then `expect(updateSlideWatermark).toHaveBeenCalledWith(<projectId>, 0, { enabled: true })`.
    - For remove test: `fireEvent.click(screen.getByText(/^Remove$/))`, then assert `screen.queryByAltText('Custom watermark logo')` is null (preview gone) and `screen.getByText(/Upload logo/i)` is back, plus `expect(updateSlideWatermark).toHaveBeenCalledWith(<projectId>, 0, { customLogoUrl: undefined })`.

    Use `await waitFor(...)` if React commits asynchronously after the click. Server-action mocks return immediately so no real timing is needed.

    If `<SlideEditor>` requires too many props or pulls in heavy modules that can't be cleanly mocked (Supabase client at module scope, etc.) and tests turn into yak-shaving, fall back to the helper-extraction option:
    1. Lift the merge logic into `function buildWatermarkUpdate(slide: Slide, spec: WatermarkSpec): Partial<Slide>` exported from `slide-editor.tsx` (or a sibling util module).
    2. Use it inside the three handlers.
    3. Unit-test `buildWatermarkUpdate` directly with three cases (toggle on, toggle off, customLogoUrl set/cleared).

    Pick the path that keeps the test file under ~120 lines and free of pseudo-integration plumbing.
  </action>
  <verify>
    <automated>cd /Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow &amp;&amp; npx vitest run src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx 2>&amp;1 | tail -30 &amp;&amp; grep -v '^[[:space:]]*//' src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx | grep -c "updateSlideWatermark" | awk '{ if ($1 &lt; 3) { print "FAIL: expected updateSlideWatermark referenced in &gt;=3 places (mock + 3 assertions), got " $1; exit 1 } else { print "OK: " $1 " references" } }'</automated>
  </verify>
  <done>
    - New test file exists and all three (or three helper-style) cases pass.
    - Existing `watermark-controls.test.tsx` and `slide-editor.shortcuts.test.tsx` still pass.
    - Test file is &lt;120 lines and reads cleanly.
    - No real network or Supabase calls — all server actions are mocked.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual Playwright verification of paid-tier watermark UX</name>
  <what-built>Three watermark handlers in slide-editor.tsx now dispatch UPDATE_SLIDE alongside the server action. Vitest covers the dispatch path; Playwright is the only way to confirm SlidePreview actually re-renders the watermark in the browser.</what-built>
  <how-to-verify>
    Diego will run this via Playwright MCP after implementation lands. Steps:

    1. Sign in as a paid (plus or pro) user. Open an existing project's editor page.
    2. In the right rail, scroll to the "Watermark" section. Confirm:
       - "Show watermark" Switch is initially OFF.
       - The watermark is NOT visible in <SlidePreview>.
    3. Click the "Show watermark" Switch.
       - **Expected:** Switch flips to ON immediately. The "ViralSlideMaker" watermark appears in the slide preview within ~200ms (no refresh needed). A "Saving…" spinner may flash next to the Watermark heading and clear.
    4. Click the Switch again to turn off.
       - **Expected:** Switch flips OFF immediately. Watermark disappears from preview.
    5. Toggle ON again, then click "Upload logo" and pick a small PNG.
       - **Expected:** After upload completes, the custom-logo thumbnail appears in WatermarkControls AND the preview shows the custom logo (replacing the ViralSlideMaker text) without a refresh.
    6. Click "Remove" on the custom logo.
       - **Expected:** Thumbnail disappears, "Upload logo" button returns. Preview reverts to the default ViralSlideMaker watermark (Switch still ON).
    7. Hard-refresh the page.
       - **Expected:** Final state from step 6 persists — Switch ON, default watermark visible, no custom logo. Confirms the server action also saved correctly.
    8. Sign out, sign in as a FREE user. Open editor.
       - **Expected:** Switch is disabled, "Pro" chip visible, watermark renders unconditionally in preview. (Sanity check that this fix didn't regress free-tier behavior.)
  </how-to-verify>
  <resume-signal>Type "approved" to mark this quick complete, or describe what you saw if anything diverged from expectations.</resume-signal>
</task>

</tasks>

<verification>
- `npm run lint` clean for `src/components/editor/slide-editor.tsx`.
- `npx vitest run src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx src/components/editor/__tests__/watermark-controls.test.tsx src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` all pass.
- Static checks confirm three new `dispatch({ type: 'UPDATE_SLIDE'` call sites exist with the `{ ...existing, ...spec/...patch }` merge shape.
- Server action `updateSlideWatermark` body in `editor-actions.ts` is byte-identical before/after.
- Manual Playwright verification (Task 3) confirms the user-visible behavior.
</verification>

<success_criteria>
- Paid-tier user can toggle the watermark Switch and see it flip + the preview update within one render frame, with no page refresh.
- Custom-logo upload and remove also reflect locally without a refresh.
- Free-tier behavior unchanged (watermark always renders, Switch disabled).
- DB persistence still works — hard refresh shows the persisted state.
- New vitest case is the regression net for the dispatch path.
</success_criteria>

<output>
After completion, create `.planning/quick/260502-fai-fix-paid-tier-watermark-toggle-dispatch-/260502-fai-SUMMARY.md` summarizing:
- Files changed (slide-editor.tsx + new test file)
- The three handlers patched and the merge shape used
- Whether the helper-extraction fallback was taken in Task 2 (yes/no, with reasoning)
- Note re: out-of-scope `handleSlideTreatmentChange` follow-up (still has same shape bug — separate quick if user reports)
- Manual Playwright verification result (pasted from checkpoint resume)
</output>
