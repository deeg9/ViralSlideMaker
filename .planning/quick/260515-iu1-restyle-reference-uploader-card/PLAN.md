---
quick_id: 260515-iu1
slug: restyle-reference-uploader-card
status: in-progress
created: 2026-05-15
---

# Restyle Reference Uploader Dropzone (Copy Style card)

## Problem

User shared three shadcn-style snippets (`useImageUpload` hook, `Button`, `Input`)
and asked us to "replace the area where you upload a photo on this page" — the
"Drop reference images here, or click to choose" dropzone inside the **Copy style**
section of the project page (`/project/[id]`).

Scope clarified with the user: **visual refresh only**. The provided
`useImageUpload` hook is single-file/local-blob and would silently kill:
- multi-file upload (1–3 references required for style extraction)
- server upload via signed URL → Supabase Storage
- file size / MIME / count validation
- Phase 79 LEGAL-01 ToS clickwrap gate
- `onUploadComplete` / `onPreviewUrlReady` / `onExtractRequested` callbacks
  that downstream code (Phase 75 extraction, REF-07 provenance) depends on

So we keep the existing logic in `src/components/dashboard/reference-image-uploader.tsx`
intact and only refresh the dropzone's visual presentation to match the
shadcn aesthetic of the provided primitives.

## Scope

**Touch:**
- `src/components/dashboard/reference-image-uploader.tsx` — replace the dropzone
  JSX (lines ~285–306) with a polished card pattern. Use existing UI primitives
  (`Button` from `@/components/ui/button`, `Icon` from `@/components/ui/icon`).
  No new packages, no duplicate primitives.

**Don't touch:**
- `handleFiles`, `gateAndUpload`, ToS modal wiring, error display, thumb grid,
  Extract style CTA, hidden file input, accept attribute, all callbacks.

## Contracts that MUST hold (anchored by tests in `__tests__/reference-image-uploader.test.tsx`)

- `data-testid="reference-uploader-dropzone"` stays on the click target.
- Clicking the dropzone calls `fileInputRef.current?.click()`.
- `dragOver` adds a class matching `/active|drag/i`; `dragLeave` removes it.
- `onDrop` calls `gateAndUpload(Array.from(e.dataTransfer.files))`.
- Hidden file input retains `accept="image/png,image/jpeg,image/webp,image/heic"`
  and `multiple`.
- `data-testid="thumb-row"` and `data-testid="extract-style-cta"` unchanged.
- Phase 79 LEGAL-01: ToS clickwrap modal still mounts when
  `!accepted && pendingFiles !== null`.

## Visual changes

- Rounded card (`rounded-2xl`), dashed border kept for "dropzone affordance".
- Added a Material Symbol icon (`add_photo_alternate`) in a soft circular
  badge above the heading.
- Tightened typography hierarchy; same theme colors (`#3d0000`, `#fff0f0`,
  `#e2cfcf`).
- Hover/drag-over states refined: stronger border + tinted background.
- A "Choose images" `<Button variant="outline" size="sm">` inside the card to
  match the shadcn pattern's explicit action affordance — clicks bubble to the
  card's `onClick` so behavior is identical to clicking anywhere in the zone.
- Drag-and-drop visual cues preserved.

## Out of scope

- Adding new primitives (the codebase already has Button using base-ui; not
  forking to radix-slot just for parity).
- Changing the multi-file model to single-file.
- Replacing the Extract style CTA — that's a separate concern.
- Page-level layout changes outside the dropzone.

## Verification

1. `pnpm test src/components/dashboard/__tests__/reference-image-uploader.test.tsx`
   (and the two ToS test files) — all must remain green.
2. `pnpm typecheck` — no new errors.
3. Visual sanity check at `/project/[id]` — Copy style section.
