---
quick_task: inline-style-from-reference-flow-into-pr
quick_id: 260514-g7y
created: 2026-05-14
status: ready-for-planning
---

# Quick Task 260514-g7y: Inline style-from-reference flow into the prompt page — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Task Boundary

The style-from-reference flow currently lives at `/style-from-reference/new` as a
standalone page. The user wants this flow folded into the prompt page
(`/project/<id>`'s GenerationForm) as a fifth collapsible section alongside
SELECT VISUAL STYLE / NUMBER OF SLIDES / BACKGROUND IMAGES / ADVANCED OPTIONS.

After the change:
- The standalone `/style-from-reference/new` route is **deleted**.
- The References pill on the prompt page is **removed** (the collapsible
  replaces it).
- The user uploads reference images directly inside the prompt page,
  extracts a style spec, reviews it, and the single Generate Carousel
  button at the bottom of the form drives the final carousel emission
  using the extracted spec (when present) or the selected template (when
  no references uploaded).
- Max reference uploads drops from **8** to **3**.

</domain>

<decisions>
## Locked decisions

### Inline preview depth
**Full preview** — palette swatches, typography badges, layout sketch, style
notes blurb, 4 Apply checkboxes, Remix-with-Brand-Kit toggle. The inline
collapsible mirrors the standalone page's spec-preview UI verbatim, minus the
in-panel Generate button (the form's Generate Carousel is now the single CTA).

### Style precedence when both references AND a visual-style template are present
**Extracted spec wins.** When the user has uploaded references and a spec was
extracted, the prompt page's Generate Carousel button routes through
`regenerateAction` (the style-from-reference emission path) and the selected
template_id is ignored. Matches the "inspired by references" mental model —
references override the template choice.

### Fate of the standalone page
**Delete entirely.** Remove:
- `src/app/(dashboard)/style-from-reference/new/page.tsx`
- `src/app/(dashboard)/style-from-reference/new/back-button.tsx`
- The whole directory (`src/app/(dashboard)/style-from-reference/new/`)

The Server Action `extractStyleSpecAction` (and `regenerateAction`) in
`src/app/(dashboard)/style-from-reference/actions.ts` stays — those are
still called from the inline collapsible. Only the route handler + back
button are deleted.

### Max reference uploads
**3** (down from 8). Update the constant in
`src/lib/storage/upload-reference-validation.ts` (line 28) and the matching
assertion in `src/lib/storage/__tests__/upload-reference-validation.test.ts:31`.

### ToS clickwrap (Phase 79 LEGAL-01) — still in force
The clickwrap modal still fires on first reference upload per session. Move
the props plumbing from the standalone page into the prompt page
(`/project/[id]/page.tsx`) so `tosAlreadyAccepted` + `acceptTosAction` flow
through GenerationForm → InspiredByReferences collapsible →
ReferenceImageUploader.

</decisions>

<investigation_findings>
## Current state (verified before planning)

- `MAX_REFERENCE_COUNT` is defined once in
  `src/lib/storage/upload-reference-validation.ts:28` and consumed by:
  - `reference-image-uploader.tsx:304` (UI hint string — auto-updates)
  - `reference-image-uploader.tsx:281` (ctaDisabled guard — auto-updates)
  - `validateGalleryCount` enforcement in same file
- Two hardcoded "Upload up to 8 images" strings exist:
  - `src/app/(dashboard)/style-from-reference/new/page.tsx:109` (will be deleted)
  - `src/components/slides/generation-form.tsx:327` (will be removed with the pill)
- The standalone-page tests:
  - `src/lib/storage/__tests__/upload-reference-validation.test.ts:29-31` asserts
    `MAX_REFERENCE_COUNT === 8` — must flip to 3.
- `StyleFromReferenceShell` (`src/components/style-from-reference/style-from-reference-shell.tsx`)
  already owns: uploader + state machine + sticky strip + spec-preview panel.
  Reuse as-is by adding two new props:
  - `hideGenerateCta?: boolean` (default false) — when true the inline
    Generate button + credit-cost display in `SpecPreviewPanel` is hidden.
  - `onSpecChange?: (state: SpecPreviewState) => void` — fires whenever the
    reducer transitions; lets the parent form read the extracted spec +
    aspects + useBrandKitRemix to drive its own Generate button.
- `SpecPreviewPanel` needs a parallel `hideGenerateCta` prop (passed through
  from the shell) so the in-panel Generate button + credit-cost row are
  conditionally omitted.
- `GenerationForm` (`src/components/slides/generation-form.tsx`):
  - Accepts existing props `projectId`, `currentTopic`, `currentTemplateId`,
    `hasSlides`, `userTier`, `brandKit`.
  - Add new props: `tosAlreadyAccepted?: boolean`, `acceptTosAction?: …`.
  - Add new collapsible "INSPIRED BY REFERENCES" section between SELECT
    VISUAL STYLE and NUMBER OF SLIDES (or after BACKGROUND IMAGES — TBD by
    visual order; locked decision is "as one of the collapsed areas at the
    bottom"; ADVANCED OPTIONS stays last).
  - Local state: `inlineSpecState: SpecPreviewState | null` — set by the
    inline shell's `onSpecChange` callback.
  - Submit handler branches:
    - If `inlineSpecState?.spec` is non-null AND
      `inlineSpecState.status === 'preview'`: call `regenerateAction({
      projectId, spec, aspects, useBrandKitRemix, brandKit, content: {mode:
      'ai-copy', topic} })` and router.push to `/project/${projectId}`.
    - Else: existing `generateCarousel` action path (template + topic).
- `/project/[id]/page.tsx` passes props to GenerationForm. Update it to
  also fetch + forward `tosAlreadyAccepted` (via `hasUserAcceptedCurrentTos`)
  and `acceptTosAction` (currently in
  `src/app/(dashboard)/style-from-reference/actions.ts`).

## Out of scope

- Refactoring the StyleFromReferenceShell internals (state machine, error
  router, recovery surfaces). Only adding two new props.
- Changing the credit cost or rate-cap policy.
- Restyling the spec-preview panel or per-aspect toggles.
- Auto-extract-on-upload behavior. The user still clicks "Extract style"
  to trigger extraction inside the collapsible.
- Generate Carousel button copy/visual change. It stays as today; the
  routing decision is internal.
- Migrating existing published carousels or any DB schema change.

</investigation_findings>

<canonical_refs>
## References

- `src/components/style-from-reference/style-from-reference-shell.tsx` — embed via new props
- `src/components/style-from-reference/spec-preview-panel.tsx` — add `hideGenerateCta`
- `src/components/slides/generation-form.tsx` — new collapsible + submit branching
- `src/app/(dashboard)/project/[id]/page.tsx` — forward ToS props
- `src/app/(dashboard)/style-from-reference/actions.ts` — keep (called from inline)
- `src/lib/storage/upload-reference-validation.ts:28` — MAX_REFERENCE_COUNT
- `src/lib/storage/__tests__/upload-reference-validation.test.ts:29-31` — assertion to flip
- `src/components/style-from-reference/__tests__/dashboard-cta-smoke.test.tsx` — update/delete
</canonical_refs>
