---
quick_id: 260515-iu1
slug: restyle-reference-uploader-card
status: complete
completed: 2026-05-15
---

# Summary — Restyle Reference Uploader Dropzone (Copy Style card)

## What changed

Visual refresh of the dropzone inside the **Copy style** card on
`/project/[id]` ("What shall we create?" page). Single file touched:
`src/components/dashboard/reference-image-uploader.tsx`.

- Added imports for existing primitives: `Button` (`@/components/ui/button`)
  and `Icon` (`@/components/ui/icon`).
- Replaced the bare dropzone `<div>` (heading + subtext only) with a polished
  card layout:
  - Circular icon badge (`add_photo_alternate` Material Symbol) above the heading;
    swaps to filled `#3d0000` background on drag-over.
  - Same heading + subtext strings, tightened spacing.
  - Inline "Choose images" `<Button variant="outline" size="sm">` whose `onClick`
    stops propagation and calls `fileInputRef.current?.click()` (so clicking it
    fires the picker exactly once, not twice via card-bubble).
  - Drag-over branch keeps the `active` class (test contract) plus an added
    `ring-2 ring-[#3d0000]/10` for a stronger drop affordance.
  - `hover:border-[#3d0000]/40` adds a subtle hover cue on the dashed border.

## What didn't change

Every load-bearing contract held:

- `data-testid="reference-uploader-dropzone"` (anchors 10 + tests).
- Click → `fileInputRef.current?.click()` on the card itself.
- Drag-over flips a class matching `/active|drag/i`.
- `onDrop` → `gateAndUpload(Array.from(e.dataTransfer.files))`.
- Hidden file input: `accept="image/png,image/jpeg,image/webp,image/heic"`, `multiple`.
- Multi-file (1–3) upload pipeline, signed-URL mint, Supabase Storage PUT.
- Validation (`validateReferenceUpload`, `validateGalleryCount`).
- Phase 79 LEGAL-01 ToS clickwrap modal + `gateAndUpload` deferral.
- `onUploadComplete` / `onPreviewUrlReady` / `onExtractRequested` callbacks.
- Thumb grid, error display, and "Extract style" CTA.

The user-provided `useImageUpload` hook was intentionally NOT wired in: it is
single-file + local-blob only and would have silently dropped multi-file,
server persistence, ToS gating, and validation. Per the user's confirmed
"visual refresh only" choice we kept all logic intact.

The user-provided shadcn `Button` / `Input` snippets were also NOT installed
as duplicate primitives — the codebase already exports `Button` (base-ui) and
`Input`, and forking the UI library for parity with the snippet wasn't
warranted.

## Verification

- `npx vitest run --root . --dir src/components/dashboard/__tests__` → 3 files,
  17 tests pass (includes `reference-image-uploader.test.tsx`,
  `reference-image-uploader-tos.test.tsx`,
  `reference-image-uploader-tos-reroute.test.tsx`).
- `npx tsc --noEmit` → no errors in the modified file.
- Failures in `.claude/worktrees/agent-*` copies are pre-existing and unrelated
  (stale `MAX_REFERENCE_COUNT` mismatch in orphaned worktree trees).

## Files

- `src/components/dashboard/reference-image-uploader.tsx` (M)
