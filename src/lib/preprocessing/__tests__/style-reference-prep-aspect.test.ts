// PARITY-04 — defends against v2.12 ASPECT-01 bug class. sharp uses
// fit: 'inside' (NOT 'cover' / 'fill') so non-9:16 references are
// downscaled in their NATIVE aspect, not stretched/cropped. Phase 75's
// extract-style-spec.ts MUST NOT re-resize after this — Gemini Vision
// sees the natural aspect of the user's reference image.
//
// One test per aspect class so a regression failure pinpoints exactly
// which ratio class broke. Keep these as standalone assertions; do not
// fold into a parametrized suite — the legibility of "1:1 broke" vs
// "16:9 broke" is the point.

import { describe, it, expect } from 'vitest'
import { sharp } from '@/lib/photo-treatment/sharp-config'
import {
  prepareForVision,
  MAX_DIMENSION,
} from '@/lib/preprocessing/style-reference-prep'

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 90, b: 40 },
    },
  })
    .png()
    .toBuffer()
}

describe('PARITY-04: 9:16 aspect-normalize regression', () => {
  it('Test 1 (1:1 input — 1080×1080): preserves square aspect, both dims ≤ 1024', async () => {
    const input = await makePngBuffer(1080, 1080)
    const out = await prepareForVision(input)
    expect(out.width).toBeLessThanOrEqual(MAX_DIMENSION)
    expect(out.height).toBeLessThanOrEqual(MAX_DIMENSION)
    // square within ±1 px (sharp rounding)
    expect(Math.abs(out.width - out.height)).toBeLessThanOrEqual(1)
    // should bind to 1024 on the long side
    expect(Math.max(out.width, out.height)).toBe(MAX_DIMENSION)
  })

  it('Test 2 (16:9 landscape — 1920×1080): width === 1024, height ≈ 576, aspect within 0.5%', async () => {
    const input = await makePngBuffer(1920, 1080)
    const out = await prepareForVision(input)
    expect(out.width).toBe(1024)
    // expected height = 1024 * (1080/1920) = 576
    expect(Math.abs(out.height - 576)).toBeLessThanOrEqual(2)
    const inAspect = 1920 / 1080
    const outAspect = out.width / out.height
    expect(Math.abs(outAspect - inAspect) / inAspect).toBeLessThan(0.005)
  })

  it('Test 3 (4:3 portrait — 1500×2000): height === 1024, width ≈ 768, aspect within 0.5%', async () => {
    const input = await makePngBuffer(1500, 2000)
    const out = await prepareForVision(input)
    expect(out.height).toBe(1024)
    // expected width = 1024 * (1500/2000) = 768
    expect(Math.abs(out.width - 768)).toBeLessThanOrEqual(2)
    const inAspect = 1500 / 2000
    const outAspect = out.width / out.height
    expect(Math.abs(outAspect - inAspect) / inAspect).toBeLessThan(0.005)
  })

  it('Test 4 (already 9:16 — 1080×1920): both dims ≤ 1024, aspect 9:16 preserved', async () => {
    const input = await makePngBuffer(1080, 1920)
    const out = await prepareForVision(input)
    expect(out.width).toBeLessThanOrEqual(MAX_DIMENSION)
    expect(out.height).toBeLessThanOrEqual(MAX_DIMENSION)
    // tall: height binds to 1024
    expect(out.height).toBe(1024)
    // expected width = 1024 * (1080/1920) = 576
    expect(Math.abs(out.width - 576)).toBeLessThanOrEqual(1)
    const inAspect = 1080 / 1920
    const outAspect = out.width / out.height
    expect(Math.abs(outAspect - inAspect) / inAspect).toBeLessThan(0.005)
  })
})
