---
name: paperclip-upload-photos-creation-page
slug: 260428-upl-paperclip-upload-photos-creation-page
created: 2026-04-28
status: in-progress
---

# Paperclip + Arrow Icons on Creation Page (Photo Upload)

## Goal

Let users upload their own photos directly from the "What shall we create?" prompt
on the project creation page. Match the chat-input visual the user shared:
paperclip icon (left) inside the textarea opens a file picker; arrow icon (right)
inside the textarea is an alternate submit. Selected photos are uploaded and used
as the backgrounds for the first N slides of the generated carousel.

## Scope

1. **`src/components/slides/generation-form.tsx`**
   - Hidden `<input type="file" multiple accept="image/*">` driven by a paperclip button.
   - Paperclip button (bottom-left, inside textarea container).
   - Arrow button (bottom-right, white circle) — alternate submit for the form.
   - Selected files held in component state; show small thumbnail strip below the
     textarea with a `×` remove control per file.
   - Validates each file via existing `validateImageFile`.
   - On submit, upload each file via existing `createUploadUrl` / signed PUT flow,
     pass the resulting public URLs to `generateCarousel` as `uploadedImageUrls`.
   - Disable both icons while pending.
   - "AI Assisted" badge moved out of the textarea bottom row (kept as a small
     label above the textarea) so the bottom row is reserved for the new icons.

2. **`src/app/(dashboard)/project/[id]/actions.ts` — `generateCarousel`**
   - New optional `uploadedImageUrls?: string[]` parameter.
   - When present and non-empty, after stock/AI background fetch runs, overwrite
     `background_url` on slides `[0..min(uploadedImageUrls.length, slides.length)-1]`
     with the uploaded URLs and clear `pexels_photo_id` for those slides.
   - Slides past the uploaded count keep their stock/AI background as configured.

## Out of Scope

- AI-driven layout choices that "know" an image is user-supplied.
- Per-slide assignment UI (reordering uploaded images to specific slides).
- Persisting uploaded files between attempts / outside this generation request.

## Verification

- `npx tsc --noEmit` passes.
- Manual UI sanity: paperclip opens picker, selected files show as thumbnails,
  `×` removes them, arrow submits the form, big "Generate Carousel" button still
  works.
- Code-level: when `uploadedImageUrls` is non-empty, slides[0..N-1] in the saved
  `slide_data` have `background_url` set to the uploaded URLs and
  `pexels_photo_id: null`.
