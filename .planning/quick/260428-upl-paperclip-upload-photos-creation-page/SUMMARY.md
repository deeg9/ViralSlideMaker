---
name: paperclip-upload-photos-creation-page
slug: 260428-upl-paperclip-upload-photos-creation-page
date: 2026-04-28
status: complete
commit: 23050b4
---

# Summary — Paperclip + Arrow Icons on Creation Page

## What changed

**`src/components/slides/generation-form.tsx`**
- Paperclip button (bottom-left, inside the prompt textarea) opens a multi-file
  image picker. Files are validated with the existing `validateImageFile`.
- Arrow button (bottom-right, white circle with `#3d0000` border) is a submit
  shortcut for the form, matching the chat-input visual the user shared.
- Selected files render as a 16×16 thumbnail strip below the textarea, each with
  a `×` remove button. Helper text shows how many slides will use them.
- "AI Assisted" indicator moved out of the textarea bottom area to the label row
  above it, freeing the bottom row for the new icons.
- On submit the form uploads each selected file via the existing
  `createUploadUrl` signed-URL flow before calling `generateCarousel`.
- Cap of 20 simultaneous uploads (matches the slide-count cap).
- Object URLs for previews are revoked on unmount / on file-list change.

**`src/app/(dashboard)/project/[id]/actions.ts`**
- `generateCarousel` accepts an optional `uploadedImageUrls?: string[]` in
  `advancedOptions`.
- When present, the first N entries of `slides` get `background_url` set to the
  uploaded URLs and `pexels_photo_id` cleared. Slides past N keep their stock
  or AI-generated background as before.

## Why this scope

User asked for "a paperclip icon and an arrow icon, like this example here. To
our creation page so that a user can upload their photos they want to add to
the slide show." The minimum that delivers the stated outcome is:

1. The visual affordance (icons inside the prompt).
2. Working file selection + upload (so the photos actually get into storage).
3. A path for the photos to "add to the slide show" — implemented as background
   override for the first N slides, which reuses the existing slide schema and
   editor (the user can still rearrange in the editor afterwards).

## Verification

- `npx tsc --noEmit` clean for both changed files (pre-existing test-file
  errors unrelated).
- `npx next lint` clean for both changed files.
- Code path: submit with 0 files → unchanged behavior. With ≥1 file →
  `uploadedImageUrls` flows through `advancedOptions` into `generateCarousel`
  and overwrites `background_url` for slides `[0..N-1]`.

## Out of scope (future work)

- Per-slide drag-to-assign UI (currently photos go to slides 1..N in pick order).
- Treating uploaded photos as references for AI image generation rather than
  as direct backgrounds.
- Persisting selections across page reloads.
