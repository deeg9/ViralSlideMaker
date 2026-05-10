// Phase 74 Plan 02 (STYLESPEC-02, REF-01, REF-07): single-source-of-truth constants
// for the JSONB column names on projects + the slide-references storage bucket name.
// Phase 75/76/77/78 import these — never hardcode the strings. Source-grep tests
// (in __tests__) catch drift between code and migration files.

export const STYLE_SPEC_COLUMN = 'style_spec' as const
export const REFERENCE_ASSETS_COLUMN = 'reference_assets' as const
export const SLIDE_REFERENCES_BUCKET = 'slide-references' as const

export const SLIDE_REFERENCES_RLS_POLICIES = {
  select: 'Users can read own slide references',
  insert: 'Users can upload own slide references',
  update: 'Users can update own slide references',
  delete: 'Users can delete own slide references',
} as const

/** Per-row shape for projects.reference_assets jsonb. Application-layer enforced;
 *  the column itself is just jsonb in Postgres. Per CONTEXT.md Claude's-discretion
 *  enriched shape (mime_type / size_bytes / original_filename added for forensics).
 */
export interface ReferenceAssetRow {
  url: string                  // signed URL or storage path; resolution policy in Plan 03
  sha256: string               // hex SHA-256 of preprocessed bytes (Phase 73's prepareForVision output)
  uploaded_at: string          // ISO 8601
  mime_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/heic'
  size_bytes: number           // pre-preprocessing size; ≤ 20_000_000 (REF-05 cap)
  original_filename: string    // sanitized utf-8; ≤ 80 chars (mirrors brand-kit-logo path-safety)
}
