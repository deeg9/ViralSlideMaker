// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  validateImageBuffer,
  isValidationError,
  UPLOAD_BUFFER_MAX_BYTES,
} from '@/lib/upload-validation'

// Minimal valid 1×1 grayscale-alpha PNG (68 bytes)
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='
const TINY_PNG = Buffer.from(TINY_PNG_B64, 'base64')

// JPEG SOI bytes — used for MIME-mismatch tests (claiming JPEG when buffer is
// PNG, or vice versa). We don't use a full valid JPEG fixture because
// constructing a minimal one that image-size can parse adds noise; the PNG
// happy path test covers the validation success branch.
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])

// Minimal valid 1×1 lossless WebP (~30 bytes)
// RIFF + size + WEBP + VP8L chunk for a 1×1 image
const TINY_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x1a, 0x00, 0x00, 0x00, // file size - 8
  0x57, 0x45, 0x42, 0x50, // "WEBP"
  0x56, 0x50, 0x38, 0x4c, // "VP8L"
  0x0d, 0x00, 0x00, 0x00, // VP8L chunk size
  0x2f, 0x00, 0x00, 0x00, 0x00, // VP8L signature + 1×1 dimensions
  0x88, 0x88, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, // pixel data
])

// Animated PNG: PNG signature + IHDR + acTL chunk before IDAT
// validateImageBuffer should detect acTL and reject before calling image-size
const ANIMATED_PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
  // IHDR chunk (length 13, type "IHDR", data, crc)
  Buffer.from([0x00, 0x00, 0x00, 0x0d]),
  Buffer.from('IHDR'),
  Buffer.from([
    0x00, 0x00, 0x00, 0x01, // width 1
    0x00, 0x00, 0x00, 0x01, // height 1
    0x08, 0x04, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
  ]),
  Buffer.from([0x00, 0x00, 0x00, 0x00]), // (dummy CRC — animation check doesn't validate CRCs)
  // acTL chunk (length 8, type "acTL", data: num_frames=2, num_plays=0)
  Buffer.from([0x00, 0x00, 0x00, 0x08]),
  Buffer.from('acTL'),
  Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0x00, 0x00, 0x00, 0x00]), // dummy CRC
])

// Animated WebP: RIFF + WEBP + ANIM chunk
const ANIMATED_WEBP = Buffer.concat([
  Buffer.from([0x52, 0x49, 0x46, 0x46]), // "RIFF"
  Buffer.from([0x20, 0x00, 0x00, 0x00]), // file size
  Buffer.from([0x57, 0x45, 0x42, 0x50]), // "WEBP"
  Buffer.from([0x56, 0x50, 0x38, 0x58]), // "VP8X" extended-format chunk
  Buffer.from([0x0a, 0x00, 0x00, 0x00]), // chunk size 10
  Buffer.from([0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // VP8X data
  Buffer.from([0x41, 0x4e, 0x49, 0x4d]), // "ANIM"
  Buffer.from([0x00, 0x00, 0x00, 0x00]), // size 0
])

describe('validateImageBuffer', () => {
  describe('happy path', () => {
    it('accepts a valid PNG and returns correct metadata', () => {
      const result = validateImageBuffer(TINY_PNG, 'image/png')
      expect(isValidationError(result)).toBe(false)
      if (!isValidationError(result)) {
        expect(result.mimeType).toBe('image/png')
        expect(result.width).toBe(1)
        expect(result.height).toBe(1)
      }
    })

    // Note: JPEG and WebP happy paths aren't tested with real fixtures here —
    // constructing minimal-but-image-size-parseable bytes adds noise. The
    // sniff path is exercised through the MIME-mismatch tests below (which
    // use real PNG/JPEG headers) and through the animation-detection tests
    // (which exercise the WebP sniff branch).
  })

  describe('format rejections', () => {
    it('rejects an empty buffer', () => {
      const result = validateImageBuffer(Buffer.alloc(0), 'image/png')
      expect(isValidationError(result)).toBe(true)
      if (isValidationError(result)) {
        expect(result.code).toBe('INVALID_FORMAT')
      }
    })

    it('rejects random non-image bytes', () => {
      const garbage = Buffer.from('hello world this is definitely not an image')
      const result = validateImageBuffer(garbage, 'image/png')
      expect(isValidationError(result)).toBe(true)
      if (isValidationError(result)) {
        expect(result.code).toBe('INVALID_FORMAT')
      }
    })

    it('rejects when claimed mimeType disagrees with sniffed format (PNG bytes claimed as JPEG)', () => {
      const result = validateImageBuffer(TINY_PNG, 'image/jpeg')
      expect(isValidationError(result)).toBe(true)
      if (isValidationError(result)) {
        expect(result.code).toBe('MIME_MISMATCH')
        expect(result.message).toContain('image/jpeg')
      }
    })

    it('rejects when claimed mimeType disagrees with sniffed format (JPEG bytes claimed as PNG)', () => {
      const result = validateImageBuffer(JPEG_HEADER, 'image/png')
      expect(isValidationError(result)).toBe(true)
      if (isValidationError(result)) {
        expect(result.code).toBe('MIME_MISMATCH')
      }
    })
  })

  describe('animation detection', () => {
    it('rejects animated PNG (acTL chunk present)', () => {
      const result = validateImageBuffer(ANIMATED_PNG, 'image/png')
      expect(isValidationError(result)).toBe(true)
      if (isValidationError(result)) {
        expect(result.code).toBe('ANIMATED')
      }
    })

    it('rejects animated WebP (ANIM chunk present)', () => {
      const result = validateImageBuffer(ANIMATED_WEBP, 'image/webp')
      expect(isValidationError(result)).toBe(true)
      if (isValidationError(result)) {
        expect(result.code).toBe('ANIMATED')
      }
    })
  })

  describe('size limits', () => {
    it('rejects buffer exceeding 5MB', () => {
      const oversized = Buffer.alloc(UPLOAD_BUFFER_MAX_BYTES + 1)
      // Write PNG signature so we hit the size check after format pass
      oversized[0] = 0x89
      oversized[1] = 0x50
      oversized[2] = 0x4e
      oversized[3] = 0x47
      const result = validateImageBuffer(oversized, 'image/png')
      expect(isValidationError(result)).toBe(true)
      if (isValidationError(result)) {
        expect(result.code).toBe('OVERSIZED')
      }
    })
  })
})
