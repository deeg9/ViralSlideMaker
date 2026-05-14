import { describe, it, expect } from 'vitest'
import {
  validateReferenceUpload,
  validateGalleryCount,
  ALLOWED_REFERENCE_MIME,
  MAX_REFERENCE_SIZE_BYTES,
  MIN_REFERENCE_COUNT,
  MAX_REFERENCE_COUNT,
} from '../upload-reference-validation'

// Phase 74 Plan 03 (REF-03/REF-04/REF-05): contract tests for the shared upload
// validator. Both the server route and the React component import this module —
// drift between client and server is a class of bug we don't want to ship.
//
// 10 tests per the PLAN behavior block.

describe('Phase 74 Plan 03 (REF-03/REF-04/REF-05): upload-reference-validation', () => {
  it('Test 1: ALLOWED_REFERENCE_MIME is exactly the 4-element image set (NOT image/svg+xml)', () => {
    const arr = Array.from(ALLOWED_REFERENCE_MIME).sort()
    expect(arr).toEqual(['image/heic', 'image/jpeg', 'image/png', 'image/webp'])
    expect(ALLOWED_REFERENCE_MIME.has('image/svg+xml')).toBe(false)
    expect(ALLOWED_REFERENCE_MIME.size).toBe(4)
  })

  it('Test 2: MAX_REFERENCE_SIZE_BYTES === 20 * 1024 * 1024 (20 MB per REF-05)', () => {
    expect(MAX_REFERENCE_SIZE_BYTES).toBe(20 * 1024 * 1024)
  })

  it('Test 3: MIN_REFERENCE_COUNT === 1 and MAX_REFERENCE_COUNT === 3 (quick-260514-g7y: lowered from 8 when the flow inlined)', () => {
    expect(MIN_REFERENCE_COUNT).toBe(1)
    expect(MAX_REFERENCE_COUNT).toBe(3)
  })

  it('Test 4: validateReferenceUpload returns ok=true for a valid PNG within size cap', () => {
    const r = validateReferenceUpload({
      filename: 'pic.png',
      contentType: 'image/png',
      size_bytes: 1_000_000,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.safeFilename).toBe('pic.png')
  })

  it('Test 5: validateReferenceUpload rejects non-allowlisted MIME types', () => {
    for (const bad of ['image/gif', 'image/svg+xml', 'application/pdf', 'text/html']) {
      const r = validateReferenceUpload({
        filename: 'evil.bin',
        contentType: bad,
        size_bytes: 100,
      })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.code).toBe('INVALID_MIME')
        expect(typeof r.message).toBe('string')
        expect(r.message.length).toBeGreaterThan(0)
      }
    }
  })

  it('Test 6: validateReferenceUpload rejects files > 20MB and the message names the cap', () => {
    const r = validateReferenceUpload({
      filename: 'huge.png',
      contentType: 'image/png',
      size_bytes: 25_000_000,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('FILE_TOO_LARGE')
      // Message must name the cap so the user knows why
      expect(r.message).toMatch(/20/)
      expect(r.message.toLowerCase()).toMatch(/mb|megabyte|max/)
    }
  })

  it('Test 7: validateReferenceUpload rejects size_bytes ≤ 0 (defends against empty uploads)', () => {
    for (const bad of [0, -1, -100]) {
      const r = validateReferenceUpload({
        filename: 'empty.png',
        contentType: 'image/png',
        size_bytes: bad,
      })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_SIZE')
    }
    // Non-numeric size also rejected
    const nan = validateReferenceUpload({
      filename: 'x.png',
      contentType: 'image/png',
      size_bytes: 'big' as unknown,
    })
    expect(nan.ok).toBe(false)
  })

  it('Test 8: filenames with path traversal characters are sanitized (mirrors brand-kit-logos)', () => {
    const cases: Array<{ input: string; expectedSafe: string }> = [
      { input: '../etc/passwd', expectedSafe: '.._etc_passwd' },
      { input: '/abs/path.png', expectedSafe: '_abs_path.png' },
      { input: 'a\\b\\c.png', expectedSafe: 'a_b_c.png' },
      { input: 'with space.png', expectedSafe: 'with_space.png' },
    ]
    for (const c of cases) {
      const r = validateReferenceUpload({
        filename: c.input,
        contentType: 'image/png',
        size_bytes: 1000,
      })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.safeFilename).toBe(c.expectedSafe)
        // No path separators or NUL bytes survive
        expect(r.safeFilename).not.toMatch(/[/\\]/)
        expect(r.safeFilename).not.toMatch(/\x00/)
      }
    }

    // NUL byte handling
    const nulCase = validateReferenceUpload({
      filename: 'a\x00b.png',
      contentType: 'image/png',
      size_bytes: 1000,
    })
    expect(nulCase.ok).toBe(true)
    if (nulCase.ok) {
      expect(nulCase.safeFilename).not.toMatch(/\x00/)
    }

    // Length cap (≤ 80 chars)
    const longName = 'a'.repeat(200) + '.png'
    const longCase = validateReferenceUpload({
      filename: longName,
      contentType: 'image/png',
      size_bytes: 1000,
    })
    expect(longCase.ok).toBe(true)
    if (longCase.ok) expect(longCase.safeFilename.length).toBeLessThanOrEqual(80)
  })

  it('Test 9: empty filename falls back to contentType-derived default', () => {
    const cases: Array<{ ct: string; expectedExt: string }> = [
      { ct: 'image/png', expectedExt: 'png' },
      { ct: 'image/jpeg', expectedExt: 'jpg' },
      { ct: 'image/webp', expectedExt: 'webp' },
      { ct: 'image/heic', expectedExt: 'heic' },
    ]
    for (const c of cases) {
      const r = validateReferenceUpload({
        filename: '',
        contentType: c.ct,
        size_bytes: 1000,
      })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.safeFilename).toBe(`reference.${c.expectedExt}`)
      }
    }
  })

  it('Test 10: validateGalleryCount enforces 1–3 cap arithmetic at boundaries (quick-260514-g7y)', () => {
    // 2 + 1 = 3 → ok (lands at cap)
    expect(validateGalleryCount(2, 1)).toEqual({ ok: true })
    // 2 + 2 = 4 → too many
    const tooMany = validateGalleryCount(2, 2)
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok) expect(tooMany.code).toBe('TOO_MANY_REFERENCES')
    // 0 + 0 = 0 → too few
    const tooFew = validateGalleryCount(0, 0)
    expect(tooFew.ok).toBe(false)
    if (!tooFew.ok) expect(tooFew.code).toBe('TOO_FEW_REFERENCES')
    // 0 + 1 = 1 → ok (lands at min)
    expect(validateGalleryCount(0, 1)).toEqual({ ok: true })
    // 0 + 3 = 3 → ok (full add)
    expect(validateGalleryCount(0, 3)).toEqual({ ok: true })
    // 0 + 4 = 4 → too many
    const tooManyAtOnce = validateGalleryCount(0, 4)
    expect(tooManyAtOnce.ok).toBe(false)
    if (!tooManyAtOnce.ok) expect(tooManyAtOnce.code).toBe('TOO_MANY_REFERENCES')
  })
})
