// Phase 73 Plan 01 (COST-01, COST-02): contract tests for prepareForVision.
//
// These tests lock the deterministic preprocessing primitive that Phase 75's
// extract-style-spec.ts will consume on every Gemini Vision call. The
// determinism assertions are load-bearing on Phase 73 Plan 02's SHA-256
// cache (COST-03) — non-determinism here silently halves cache hit rate
// and silently doubles vision-call cost.
//
// All inputs are constructed in-memory via sharp.create() — no disk fixtures.

import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'node:crypto'
import { sharp } from '@/lib/photo-treatment/sharp-config'
import {
  prepareForVision,
  MAX_DIMENSION,
  JPEG_QUALITY,
} from '@/lib/preprocessing/style-reference-prep'

// ---------------------------------------------------------------------------
// In-memory fixture builders — every test input is generated fresh, no disk
// ---------------------------------------------------------------------------

async function makePngBuffer(
  width: number,
  height: number,
  background: { r: number; g: number; b: number } = { r: 200, g: 100, b: 50 }
): Promise<Buffer> {
  return await sharp({
    create: { width, height, channels: 3, background },
  })
    .png()
    .toBuffer()
}

async function makeWebpBuffer(width: number, height: number): Promise<Buffer> {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 50, g: 150, b: 200 },
    },
  })
    .webp({ quality: 90 })
    .toBuffer()
}

// HEIC encode is libvips-build dependent. We attempt encode at module scope
// once and gate the HEIC test on whether it succeeded. If encode failed, the
// test is filed as `it.todo` with a clear note instead of silently skipped.
let heicBuffer: Buffer | null = null
let heicEncodeError: string | null = null

beforeAll(async () => {
  try {
    heicBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .heif({ compression: 'hevc' })
      .toBuffer()
  } catch (err) {
    heicEncodeError = err instanceof Error ? err.message : String(err)
    heicBuffer = null
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('prepareForVision', () => {
  describe('COST-01: downscale ceiling (MAX_DIMENSION = 1024)', () => {
    it('downscales a 4096×4096 input so max(width,height) === 1024', async () => {
      const input = await makePngBuffer(4096, 4096)
      const out = await prepareForVision(input)
      expect(Math.max(out.width, out.height)).toBe(MAX_DIMENSION)
      expect(out.width).toBe(1024)
      expect(out.height).toBe(1024)
    })

    it('preserves an 800×800 input without enlargement (withoutEnlargement: true)', async () => {
      const input = await makePngBuffer(800, 800)
      const out = await prepareForVision(input)
      expect(out.width).toBe(800)
      expect(out.height).toBe(800)
    })

    it('fits a 2048×3640 (9:16-ish) input inside 1024×1024 with aspect preserved', async () => {
      const input = await makePngBuffer(2048, 3640)
      const out = await prepareForVision(input)
      expect(out.width).toBeLessThanOrEqual(MAX_DIMENSION)
      expect(out.height).toBeLessThanOrEqual(MAX_DIMENSION)
      // aspect preserved within ±1 px tolerance
      const inAspect = 2048 / 3640
      const outAspect = out.width / out.height
      expect(Math.abs(inAspect - outAspect)).toBeLessThan(0.01)
      // tall image: height should bind to 1024
      expect(out.height).toBe(1024)
    })
  })

  describe('COST-02: JPEG transcode (mimeType always image/jpeg)', () => {
    it('transcodes a PNG input to mimeType === image/jpeg', async () => {
      const input = await makePngBuffer(500, 500)
      const out = await prepareForVision(input)
      expect(out.mimeType).toBe('image/jpeg')
      // First 2 bytes of a JPEG are 0xFF 0xD8 (SOI marker)
      expect(out.bytes[0]).toBe(0xff)
      expect(out.bytes[1]).toBe(0xd8)
    })

    it('transcodes a WebP input to mimeType === image/jpeg', async () => {
      const input = await makeWebpBuffer(500, 500)
      const out = await prepareForVision(input)
      expect(out.mimeType).toBe('image/jpeg')
      expect(out.bytes[0]).toBe(0xff)
      expect(out.bytes[1]).toBe(0xd8)
    })

    if (heicBuffer === null) {
      // The HEIC fixture could not be constructed at beforeAll time; we
      // file the test as `todo` with the captured encode error so CI/devs
      // see exactly why and can re-verify before Phase 75 ships.
      it.todo(
        `HEIC encode unavailable in libvips build — verify in CI before Phase 75 ships (encode error: ${heicEncodeError ?? 'unknown'})`
      )
    } else {
      it('transcodes an HEIC input to mimeType === image/jpeg (decode path)', async () => {
        // heicBuffer is non-null inside this branch (checked above), but
        // narrow it via a local const for the type checker.
        const buf = heicBuffer as Buffer
        const out = await prepareForVision(buf)
        expect(out.mimeType).toBe('image/jpeg')
        expect(out.bytes[0]).toBe(0xff)
        expect(out.bytes[1]).toBe(0xd8)
      })
    }

    it('uses JPEG_QUALITY = 85 (locked per CONTEXT.md)', () => {
      expect(JPEG_QUALITY).toBe(85)
    })
  })

  describe('determinism (load-bearing on COST-03 cache hit invariant)', () => {
    it('produces byte-identical output on two calls with the same input bytes', async () => {
      const input = await makePngBuffer(1500, 1500)
      const out1 = await prepareForVision(input)
      const out2 = await prepareForVision(input)
      expect(out1.bytes.equals(out2.bytes)).toBe(true)
      expect(out1.sha256).toBe(out2.sha256)
    })

    it('output sha256 matches createHash(sha256).update(outputBytes).digest(hex)', async () => {
      const input = await makePngBuffer(700, 700)
      const out = await prepareForVision(input)
      const expected = createHash('sha256').update(out.bytes).digest('hex')
      expect(out.sha256).toBe(expected)
    })

    it('different input bytes yield different sha256 (red square vs blue square)', async () => {
      const red = await makePngBuffer(1024, 1024, { r: 220, g: 20, b: 20 })
      const blue = await makePngBuffer(1024, 1024, { r: 20, g: 20, b: 220 })
      const outRed = await prepareForVision(red)
      const outBlue = await prepareForVision(blue)
      expect(outRed.sha256).not.toBe(outBlue.sha256)
    })
  })
})
