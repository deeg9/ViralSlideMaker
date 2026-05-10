// Phase 73 (COST-01, COST-02, PARITY-04): deterministic image preprocessing
// for vision-call inputs. Phase 75's extract-style-spec.ts MUST call this
// before every Gemini Vision call. Output bytes are the cache key surface
// for the Phase 73 Plan 02 style_spec_cache table (COST-03).
//
// Determinism is load-bearing: same input bytes → same output bytes →
// same sha256 → cache hit. If you refactor this function, re-run
// style-reference-prep.test.ts AND extract-style-spec.test.ts (Phase 75)
// before merging — a non-deterministic change here silently breaks the
// cache hit rate, which silently doubles vision-call cost.
//
// Pipeline (do NOT reorder):
//   sharp(input)
//     .rotate()                                    // EXIF auto-orient first
//     .resize(1024, 1024, { fit: 'inside',
//                            withoutEnlargement: true })
//     .jpeg({ quality: 85, mozjpeg: true })
//     .toBuffer({ resolveWithObject: true })
//
// fit: 'inside' is the PARITY-04 invariant — non-9:16 references are
// downscaled in their NATIVE aspect, not stretched/cropped. Do not
// change to 'cover' or 'fill' without retiring the PARITY-04 regression
// suite (which would in turn re-open the v2.12 ASPECT-01 bug class).

import { createHash } from 'node:crypto'
import { sharp } from '@/lib/photo-treatment/sharp-config'

// Locked per CONTEXT.md decisions — do not parameterize without removing
// the corresponding lines from CONTEXT.md and REQUIREMENTS.md COST-01/COST-02.
export const MAX_DIMENSION = 1024
export const JPEG_QUALITY = 85

export interface PreparedReference {
  /** JPEG@85 output bytes; both dims ≤ MAX_DIMENSION. */
  bytes: Buffer
  /** Hex digest of the OUTPUT bytes (load-bearing on COST-03 cache key). */
  sha256: string
  /** Final output width in px (post-rotation, post-resize). */
  width: number
  /** Final output height in px (post-rotation, post-resize). */
  height: number
  /** Always literal 'image/jpeg' — Gemini wire format is deterministic. */
  mimeType: 'image/jpeg'
}

/**
 * Deterministic preprocessing primitive for vision-call inputs.
 *
 * Input: any sharp-readable image Buffer (PNG, JPEG, WebP, HEIC, etc.)
 * Output: { bytes, sha256, width, height, mimeType: 'image/jpeg' }
 *
 * Guarantees:
 *  - Output is JPEG@85, max dimension ≤ 1024 px (COST-01, COST-02)
 *  - Same input bytes → byte-identical output → identical sha256 (COST-03)
 *  - Aspect ratio is preserved (PARITY-04: fit: 'inside')
 *  - EXIF rotation is applied BEFORE resize (defends against iPhone HEIC)
 */
export async function prepareForVision(
  input: Buffer
): Promise<PreparedReference> {
  const { data, info } = await sharp(input)
    .rotate() // EXIF auto-orient — must run before resize
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true })

  const sha256 = createHash('sha256').update(data).digest('hex')

  return {
    bytes: data,
    sha256,
    width: info.width,
    height: info.height,
    mimeType: 'image/jpeg' as const,
  }
}
