import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  STYLE_SPEC_COLUMN,
  REFERENCE_ASSETS_COLUMN,
  SLIDE_REFERENCES_BUCKET,
  SLIDE_REFERENCES_RLS_POLICIES,
  type ReferenceAssetRow,
} from '../projects-storage-constants'

// Phase 74 (STYLESPEC-02, REF-01, REF-07, Plan 02): contract tests for
// projects-storage-constants.ts. These tests are the single-source-of-truth
// link between code and the two SQL migrations:
//   - supabase/migrations/20260510_v213_style_spec_columns.sql
//   - supabase/migrations/20260510_v213_slide_references_bucket.sql
//
// Phase 75/76/77/78 import the constants module — never hardcode the strings.
// Tests 5+6 source-grep the migration files so any future rename of either side
// fails CI immediately.

describe('Phase 74 Plan 02 (STYLESPEC-02, REF-01, REF-07): projects-storage-constants', () => {
  it('Test 1: STYLE_SPEC_COLUMN is the literal "style_spec" (matches migration)', () => {
    expect(STYLE_SPEC_COLUMN).toBe('style_spec')
  })

  it('Test 2: REFERENCE_ASSETS_COLUMN is the literal "reference_assets" (matches migration)', () => {
    expect(REFERENCE_ASSETS_COLUMN).toBe('reference_assets')
  })

  it('Test 3: SLIDE_REFERENCES_BUCKET is the literal "slide-references" (matches migration)', () => {
    expect(SLIDE_REFERENCES_BUCKET).toBe('slide-references')
  })

  it('Test 4: SLIDE_REFERENCES_RLS_POLICIES exports the 4 policy names from the bucket migration', () => {
    expect(SLIDE_REFERENCES_RLS_POLICIES).toEqual({
      select: 'Users can read own slide references',
      insert: 'Users can upload own slide references',
      update: 'Users can update own slide references',
      delete: 'Users can delete own slide references',
    })
  })

  it('Test 5: SOURCE GREP — columns migration contains both column-name literals (drift guard)', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260510_v213_style_spec_columns.sql',
    )
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    expect(sql).toContain(STYLE_SPEC_COLUMN)
    expect(sql).toContain(REFERENCE_ASSETS_COLUMN)
  })

  it('Test 6: SOURCE GREP — bucket migration contains bucket name + all 4 policy names (drift guard)', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260510_v213_slide_references_bucket.sql',
    )
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    expect(sql).toContain(SLIDE_REFERENCES_BUCKET)
    expect(sql).toContain(SLIDE_REFERENCES_RLS_POLICIES.select)
    expect(sql).toContain(SLIDE_REFERENCES_RLS_POLICIES.insert)
    expect(sql).toContain(SLIDE_REFERENCES_RLS_POLICIES.update)
    expect(sql).toContain(SLIDE_REFERENCES_RLS_POLICIES.delete)
  })

  it('Test 7: ReferenceAssetRow interface — required fields compile, missing fields rejected', () => {
    // Happy path — full row literal compiles + assigns.
    const row: ReferenceAssetRow = {
      url: 'https://example.com/storage/v1/object/sign/slide-references/abc/xyz.png?token=t',
      sha256: 'a'.repeat(64),
      uploaded_at: '2026-05-10T12:34:56Z',
      mime_type: 'image/png',
      size_bytes: 1024 * 512,
      original_filename: 'photo.png',
    }
    expect(row.url).toMatch(/^https:/)
    expect(row.sha256).toHaveLength(64)
    expect(row.size_bytes).toBeLessThanOrEqual(20_000_000)

    // Closed-enum check on mime_type — only the 4 documented values are accepted.
    const mimeJpeg: ReferenceAssetRow['mime_type'] = 'image/jpeg'
    const mimeWebp: ReferenceAssetRow['mime_type'] = 'image/webp'
    const mimeHeic: ReferenceAssetRow['mime_type'] = 'image/heic'
    expect([mimeJpeg, mimeWebp, mimeHeic]).toHaveLength(3)

    // Missing required field is a type error — caught by tsc.
    // The error attaches to the literal as a whole, so we put @ts-expect-error
    // immediately before the property line where the missing key would belong
    // (TS reports object-literal completeness errors on the opening of the literal).
    const missingUrl = {
      sha256: 'b'.repeat(64),
      uploaded_at: '2026-05-10T12:34:56Z',
      mime_type: 'image/png' as const,
      size_bytes: 100,
      original_filename: 'x.png',
      // @ts-expect-error - assigning object missing required `url` to ReferenceAssetRow
    } satisfies ReferenceAssetRow
    expect(missingUrl).toBeDefined()

    // Invalid mime_type literal — error reports on the offending property line,
    // so @ts-expect-error sits directly above mime_type.
    const badMime: ReferenceAssetRow = {
      url: 'u',
      sha256: 'c'.repeat(64),
      uploaded_at: '2026-05-10T12:34:56Z',
      // @ts-expect-error - 'image/gif' is not in the closed mime_type union
      mime_type: 'image/gif',
      size_bytes: 100,
      original_filename: 'x.gif',
    }
    expect(badMime).toBeDefined()
  })
})
