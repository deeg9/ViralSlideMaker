import { imageSize } from 'image-size'

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function validateImageFile(file: File): string | null {
  if (!file || file.size === 0) return 'No file provided'
  if (file.size > MAX_FILE_SIZE) return 'File must be under 5MB'
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return 'Only PNG, JPG, WebP, and GIF images are allowed'
  return null
}

export function validateFileName(fileName: string): string | null {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(ext)) return 'Only PNG, JPG, WebP, and GIF files are allowed'
  return null
}

// ===== Buffer-based validation for API/MCP upload paths =====
//
// validateImageFile (above) takes a browser File for the web upload UI.
// validateImageBuffer takes a raw Buffer + claimed MIME type for server-
// side validation of base64-decoded payloads from the API/MCP. It enforces
// stricter rules than the File path because the source is untrusted.

export const UPLOAD_BUFFER_MAX_BYTES = 5 * 1024 * 1024 // 5MB binary
export const UPLOAD_BASE64_MAX_LENGTH = 7_000_000 // ~5MB binary inflated 33% — pre-decode size cap
export const UPLOAD_MAX_PIXEL_BYTES = 50_000_000 // 50MB raw pixel size — decompression bomb defense
export const UPLOAD_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type UploadMimeType = (typeof UPLOAD_ALLOWED_MIME_TYPES)[number]

export type ImageMetadata = {
  mimeType: UploadMimeType
  width: number
  height: number
}

export type ImageValidationError = {
  code: 'INVALID_FORMAT' | 'MIME_MISMATCH' | 'ANIMATED' | 'OVERSIZED' | 'TOO_LARGE_PIXELS'
  message: string
}

export function isValidationError(
  result: ImageMetadata | ImageValidationError,
): result is ImageValidationError {
  return 'code' in result
}

/**
 * Detect MIME type from the leading bytes of an image buffer.
 * Returns null if no allowed format matches — this is the trust anchor:
 * we never trust client-provided MIME types over magic bytes.
 */
function sniffMimeType(buffer: Buffer): UploadMimeType | null {
  if (buffer.length < 12) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png'
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'image/webp'
  }

  return null
}

/**
 * Detect an animated PNG (APNG) by scanning for the `acTL` chunk.
 * Per spec, acTL appears before the first IDAT chunk in animated PNGs.
 * Static PNGs never contain acTL.
 */
function isAnimatedPng(buffer: Buffer): boolean {
  // Skip 8-byte PNG signature
  let offset = 8
  // Need 8 bytes (length + type) for each chunk header read; <= covers the
  // case where the chunk header sits exactly at the end of the buffer.
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    if (type === 'acTL') return true
    if (type === 'IDAT') return false // acTL must precede IDAT — done scanning
    offset += 12 + length // length(4) + type(4) + data + CRC(4)
    if (length > buffer.length) return false // malformed; bail
  }
  return false
}

/**
 * Detect an animated WebP by scanning for the `ANIM` chunk.
 * RIFF chunk layout: 4-byte FourCC + 4-byte little-endian size + data.
 */
function isAnimatedWebp(buffer: Buffer): boolean {
  // Skip "RIFF" + size(4) + "WEBP" = 12 bytes
  let offset = 12
  // Need 8 bytes (fourCC + size) for each chunk header read; <= covers the
  // case where the chunk header sits exactly at the end of the buffer.
  while (offset + 8 <= buffer.length) {
    const fourCC = buffer.toString('ascii', offset, offset + 4)
    if (fourCC === 'ANIM') return true
    const size = buffer.readUInt32LE(offset + 4)
    offset += 8 + size + (size % 2) // chunks are word-aligned
    if (size > buffer.length) return false // malformed; bail
  }
  return false
}

/**
 * Validate a base64-decoded image buffer for safe use as a slide background.
 *
 * Returns ImageMetadata on success, or ImageValidationError on any rejection.
 * Use isValidationError() to discriminate.
 *
 * Checks performed:
 *   1. Magic-byte sniff (defeats client-provided MIME spoofing)
 *   2. Sniffed type matches claimedMimeType (defense in depth)
 *   3. Animation rejection (APNG acTL / animated WebP ANIM)
 *   4. Dimension extraction via image-size
 *   5. Decompression-bomb cap: width × height × 4 ≤ 50MB raw pixel size
 */
export function validateImageBuffer(
  buffer: Buffer,
  claimedMimeType: string,
): ImageMetadata | ImageValidationError {
  if (buffer.length === 0) {
    return { code: 'INVALID_FORMAT', message: 'Empty image buffer' }
  }
  if (buffer.length > UPLOAD_BUFFER_MAX_BYTES) {
    return { code: 'OVERSIZED', message: `Image exceeds ${UPLOAD_BUFFER_MAX_BYTES / 1024 / 1024}MB limit` }
  }

  const sniffed = sniffMimeType(buffer)
  if (!sniffed) {
    return {
      code: 'INVALID_FORMAT',
      message: 'Unrecognized image format. Only static PNG, JPEG, and WebP are allowed.',
    }
  }
  if (sniffed !== claimedMimeType) {
    return {
      code: 'MIME_MISMATCH',
      message: `Claimed MIME type "${claimedMimeType}" does not match detected format "${sniffed}".`,
    }
  }

  if (sniffed === 'image/png' && isAnimatedPng(buffer)) {
    return {
      code: 'ANIMATED',
      message: 'Animated PNGs are not supported. Convert to a static PNG.',
    }
  }
  if (sniffed === 'image/webp' && isAnimatedWebp(buffer)) {
    return {
      code: 'ANIMATED',
      message: 'Animated WebPs are not supported. Convert to a static format.',
    }
  }

  let dimensions: { width?: number; height?: number }
  try {
    dimensions = imageSize(buffer)
  } catch {
    return { code: 'INVALID_FORMAT', message: 'Could not parse image dimensions' }
  }
  const { width, height } = dimensions
  if (!width || !height) {
    return { code: 'INVALID_FORMAT', message: 'Image has no readable dimensions' }
  }
  if (width * height * 4 > UPLOAD_MAX_PIXEL_BYTES) {
    return {
      code: 'TOO_LARGE_PIXELS',
      message: `Image is too large: ${width}×${height} exceeds the maximum decoded pixel budget.`,
    }
  }

  return { mimeType: sniffed, width, height }
}
