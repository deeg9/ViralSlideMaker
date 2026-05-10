// Phase 74 Plan 03 (REF-03/REF-04/REF-05): shared upload validation for the
// reference-image upload pipeline. Used by BOTH the server route at
// /api/style-references/upload-url (defense-in-depth — server NEVER trusts the
// client) AND the <ReferenceImageUploader> React component (fail-fast UX —
// reject obviously bad inputs before round-tripping the network).
//
// Single source of truth — drift between client and server validation is a
// class of bug we don't want to ship. The route + component import the same
// `validateReferenceUpload` function and the same constants below.
//
// IMPORTANT: this module MUST stay runtime-agnostic — no `react`, no `next`,
// no Node-only APIs. It runs in browser AND server.

export const ALLOWED_REFERENCE_MIME = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
])

/** 20 MB pre-preprocessing cap (REF-05). Phase 73's prepareForVision will
 *  downscale to ≤1024×1024 before the vision call, so this cap is the upload
 *  ceiling, not the post-extraction ceiling. */
export const MAX_REFERENCE_SIZE_BYTES = 20 * 1024 * 1024

/** Per REF-03 + CONTEXT.md: 1–8 reference images per generation. */
export const MIN_REFERENCE_COUNT = 1
export const MAX_REFERENCE_COUNT = 8

export type ValidationResult =
  | { ok: true; safeFilename: string }
  | {
      ok: false
      code: 'INVALID_MIME' | 'FILE_TOO_LARGE' | 'INVALID_SIZE' | 'INVALID_FILENAME'
      message: string
    }

/** Map an allowed MIME type to the file extension we use when synthesising a
 *  fallback filename for an uploader that left filename blank. */
function extFromMime(contentType: string): string {
  switch (contentType) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/heic':
      return 'heic'
    default:
      return 'bin'
  }
}

/** Sanitize a user-supplied filename. Mirrors the brand-kit-logos route exactly:
 *  collapse anything outside [A-Za-z0-9_.-] to underscores, then truncate to 80
 *  characters. The truncation length matches the existing storage path budget
 *  (path = `{uuid}/{uuid}-{safeFilename}`). */
function sanitizeFilename(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80)
}

/**
 * Validate a single reference upload. Returns either:
 *   { ok: true, safeFilename }  — the caller may use safeFilename as the storage
 *                                  basename without further sanitization
 *   { ok: false, code, message } — the caller surfaces `message` to the user
 *
 * The shape is intentionally narrow: the validator does NOT touch the network,
 * does NOT inspect file bytes, and does NOT compute hashes — those concerns
 * live in the route + Phase 73's prepareForVision respectively.
 */
export function validateReferenceUpload(input: {
  filename: unknown
  contentType: unknown
  size_bytes: unknown
}): ValidationResult {
  const contentType = typeof input.contentType === 'string' ? input.contentType : ''
  if (!ALLOWED_REFERENCE_MIME.has(contentType)) {
    return {
      ok: false,
      code: 'INVALID_MIME',
      message: `Unsupported file type. Allowed: ${Array.from(ALLOWED_REFERENCE_MIME).join(', ')}.`,
    }
  }

  const size = typeof input.size_bytes === 'number' ? input.size_bytes : Number.NaN
  if (!Number.isFinite(size) || size <= 0) {
    return {
      ok: false,
      code: 'INVALID_SIZE',
      message: 'File appears to be empty or has an invalid size.',
    }
  }
  if (size > MAX_REFERENCE_SIZE_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `File too large. Max ${MAX_REFERENCE_SIZE_BYTES / (1024 * 1024)} MB per reference image.`,
    }
  }

  // Filename sanitization — mirrors brand-kit-logos. Empty / fully-stripped
  // result falls back to a contentType-derived default so the storage path
  // never ends with a trailing dash.
  const rawFilename = typeof input.filename === 'string' ? input.filename : ''
  let safeFilename = sanitizeFilename(rawFilename)
  if (safeFilename.length === 0 || safeFilename === '_'.repeat(safeFilename.length)) {
    safeFilename = `reference.${extFromMime(contentType)}`
  }

  return { ok: true, safeFilename }
}

export type GalleryValidationResult =
  | { ok: true }
  | {
      ok: false
      code: 'TOO_MANY_REFERENCES' | 'TOO_FEW_REFERENCES'
      message: string
    }

/**
 * Validate that adding `addingCount` to `currentCount` keeps the gallery
 * within [MIN_REFERENCE_COUNT, MAX_REFERENCE_COUNT]. Component uses this BEFORE
 * starting the upload loop so a 9th drop fails fast (no wasted signed-URL mint).
 */
export function validateGalleryCount(
  currentCount: number,
  addingCount: number,
): GalleryValidationResult {
  const next = currentCount + addingCount
  if (next > MAX_REFERENCE_COUNT) {
    return {
      ok: false,
      code: 'TOO_MANY_REFERENCES',
      message: `Max ${MAX_REFERENCE_COUNT} reference images per generation.`,
    }
  }
  if (next < MIN_REFERENCE_COUNT) {
    return {
      ok: false,
      code: 'TOO_FEW_REFERENCES',
      message: `At least ${MIN_REFERENCE_COUNT} reference image required.`,
    }
  }
  return { ok: true }
}
