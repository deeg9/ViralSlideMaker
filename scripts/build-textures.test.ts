// Phase 56-01 (TPL-05, D-18): Determinism contract for grain + halftone PNG generators.
// Same seed string → byte-identical output across runs.
import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import {
  buildGrainSubtle,
  buildGrainMedium,
  buildGrainHeavy,
  buildPaperTexture,
  buildXeroxGrain,
  buildHalftoneDotsLight,
  buildHalftoneDotsDense,
} from './build-textures'

const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex')

describe('build-textures determinism (TPL-05, D-18)', () => {
  it('buildGrainSubtle is byte-identical across two invocations', async () => {
    const a = await buildGrainSubtle()
    const b = await buildGrainSubtle()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('buildGrainMedium is byte-identical across two invocations', async () => {
    const a = await buildGrainMedium()
    const b = await buildGrainMedium()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('buildGrainHeavy is byte-identical across two invocations', async () => {
    const a = await buildGrainHeavy()
    const b = await buildGrainHeavy()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('buildPaperTexture is byte-identical across two invocations', async () => {
    const a = await buildPaperTexture()
    const b = await buildPaperTexture()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('buildXeroxGrain is byte-identical across two invocations', async () => {
    const a = await buildXeroxGrain()
    const b = await buildXeroxGrain()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('buildHalftoneDotsLight is byte-identical across two invocations', async () => {
    const a = await buildHalftoneDotsLight()
    const b = await buildHalftoneDotsLight()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('buildHalftoneDotsDense is byte-identical across two invocations', async () => {
    const a = await buildHalftoneDotsDense()
    const b = await buildHalftoneDotsDense()
    expect(sha256(a)).toBe(sha256(b))
  })

  it('every PNG builder produces a unique SHA-256 (no two builders match)', async () => {
    const hashes = await Promise.all([
      buildGrainSubtle().then(sha256),
      buildGrainMedium().then(sha256),
      buildGrainHeavy().then(sha256),
      buildPaperTexture().then(sha256),
      buildXeroxGrain().then(sha256),
      buildHalftoneDotsLight().then(sha256),
      buildHalftoneDotsDense().then(sha256),
    ])
    expect(new Set(hashes).size).toBe(7)
  })
})
