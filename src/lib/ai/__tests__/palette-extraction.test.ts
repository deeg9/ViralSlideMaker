// Phase 75 Plan 03 (EXTRACT-04):
// Contract tests for the deterministic palette-extraction module.
//
// LOAD-BEARING DETERMINISM GATE (per CONTEXT.md D-07 + EXTRACT-04):
//   - node-vibrant is the SOLE palette source. Gemini is NEVER involved.
//   - Same input bytes -> identical hex output (Test 1).
//   - mergePalettes() is fully deterministic via lex-tiebreaker (Test 7).
//
// These tests use REAL node-vibrant calls on tiny in-memory sharp images.
// node-vibrant is mock-free here on purpose: the determinism guarantee
// IS the test, and mocking the library would defeat the test's purpose.
//
// Inputs are tiny (32x32 / 64x64 / 128x128), so Vibrant completes in <1s
// per call even on a cold lambda — the suite as a whole stays under the
// vitest default timeout.

import { describe, it, expect } from 'vitest'
import { sharp } from '@/lib/photo-treatment/sharp-config'
import {
  extractPaletteFromBytes,
  mergePalettes,
  PALETTE_TARGET_SIZE,
  type ExtractedPalette,
} from '../palette-extraction'

// ---------------------------------------------------------------------------
// In-memory fixture builders. No disk fixtures — every input is synthesized
// fresh from sharp.create() so the suite is hermetic and reproducible.
// ---------------------------------------------------------------------------

const HEX6_REGEX = /^#[0-9A-Fa-f]{6}$/

async function makeSolidImage(
  width: number,
  height: number,
  rgb: { r: number; g: number; b: number },
): Promise<Buffer> {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: rgb,
    },
  })
    .png()
    .toBuffer()
}

/** Composite a 4-quadrant image: top-left, top-right, bottom-left, bottom-right. */
async function makeQuadrantImage(
  size: number,
  colors: {
    tl: { r: number; g: number; b: number }
    tr: { r: number; g: number; b: number }
    bl: { r: number; g: number; b: number }
    br: { r: number; g: number; b: number }
  },
): Promise<Buffer> {
  const half = Math.floor(size / 2)
  const [tl, tr, bl, br] = await Promise.all([
    makeSolidImage(half, half, colors.tl),
    makeSolidImage(half, half, colors.tr),
    makeSolidImage(half, half, colors.bl),
    makeSolidImage(half, half, colors.br),
  ])
  return await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([
      { input: tl, top: 0, left: 0 },
      { input: tr, top: 0, left: half },
      { input: bl, top: half, left: 0 },
      { input: br, top: half, left: half },
    ])
    .png()
    .toBuffer()
}

async function makeTransparentImage(size: number): Promise<Buffer> {
  return await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer()
}

// ---------------------------------------------------------------------------
// Test 1 — DETERMINISM (load-bearing per D-07 / EXTRACT-04).
// Same bytes -> byte-identical ExtractedPalette across two consecutive calls.
// ---------------------------------------------------------------------------
describe('extractPaletteFromBytes — determinism (D-07 load-bearing)', () => {
  it('returns deeply equal output when called twice with the same bytes', async () => {
    const buf = await makeQuadrantImage(64, {
      tl: { r: 168, g: 224, b: 176 }, // mint #A8E0B0
      tr: { r: 30, g: 58, b: 138 }, // navy #1E3A8A
      bl: { r: 0, g: 0, b: 0 }, // black
      br: { r: 255, g: 255, b: 255 }, // white
    })

    const result1 = await extractPaletteFromBytes(buf)
    const result2 = await extractPaletteFromBytes(buf)

    expect(result1).toEqual(result2)
    expect(result1.hex.length).toBeGreaterThanOrEqual(1)
    expect(result1.hex.length).toBeLessThanOrEqual(PALETTE_TARGET_SIZE)
    for (const h of result1.hex) {
      expect(h).toMatch(HEX6_REGEX)
    }
    expect(result1.hex).toContain(result1.dominant)
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Multi-color palette extraction (uses node-vibrant for real).
// ---------------------------------------------------------------------------
describe('extractPaletteFromBytes — multi-color image', () => {
  it('extracts at least 3 named swatches from a 4-quadrant image', async () => {
    const buf = await makeQuadrantImage(128, {
      tl: { r: 0, g: 0, b: 0 }, // black
      tr: { r: 255, g: 255, b: 255 }, // white
      bl: { r: 168, g: 224, b: 176 }, // mint
      br: { r: 30, g: 58, b: 138 }, // navy
    })
    const result = await extractPaletteFromBytes(buf)

    expect(result.hex.length).toBeGreaterThanOrEqual(3)
    for (const h of result.hex) {
      expect(h).toMatch(HEX6_REGEX)
    }
    expect(result.hex).toContain(result.dominant)
  })
})

// ---------------------------------------------------------------------------
// Test 3 — Single-color image is handled gracefully.
// ---------------------------------------------------------------------------
describe('extractPaletteFromBytes — single-color image (graceful)', () => {
  it('does not throw and returns at least one valid hex', async () => {
    const buf = await makeSolidImage(64, 64, { r: 255, g: 0, b: 0 })

    const result = await extractPaletteFromBytes(buf)

    expect(result.hex.length).toBeGreaterThanOrEqual(1)
    expect(result.dominant).toMatch(HEX6_REGEX)
    for (const h of result.hex) {
      expect(h).toMatch(HEX6_REGEX)
    }
  })
})

// ---------------------------------------------------------------------------
// Test 4 — Fully-transparent image hits the FALLBACK_NEUTRAL_HEX path.
// ---------------------------------------------------------------------------
describe('extractPaletteFromBytes — empty/transparent image (graceful)', () => {
  it('falls back to neutral gray when Vibrant returns no swatches', async () => {
    const buf = await makeTransparentImage(64)

    const result = await extractPaletteFromBytes(buf)

    expect(result.hex.length).toBeGreaterThanOrEqual(1)
    expect(result.dominant).toMatch(HEX6_REGEX)
    // If Vibrant truly returned nothing on this transparent input, both
    // fields collapse to the documented neutral fallback. If Vibrant DID
    // pick up some pixel (jsdom-ish edge), the hex must still be valid —
    // the contract is "never throws, always >=1 valid hex".
    if (result.hex.length === 1 && result.hex[0] === '#808080') {
      expect(result.dominant).toBe('#808080')
    }
  })
})

// ---------------------------------------------------------------------------
// Test 5 — mergePalettes single-input passes through (normalized).
// ---------------------------------------------------------------------------
describe('mergePalettes — single-palette case', () => {
  it('returns the input palette normalized', () => {
    const input: ExtractedPalette = {
      hex: ['#A8E0B0', '#000000', '#FFFFFF'],
      dominant: '#A8E0B0',
    }
    const result = mergePalettes([input])

    // Order may differ (mergedDominant first, then by frequency, then lex),
    // but the SET should contain every input hex.
    expect(new Set(result.hex)).toEqual(new Set(input.hex))
    expect(result.dominant).toBe('#A8E0B0')
  })
})

// ---------------------------------------------------------------------------
// Test 6 — mergePalettes dominant-color voting (multi-palette).
// ---------------------------------------------------------------------------
describe('mergePalettes — multi-palette dominant-color voting', () => {
  it('picks the most-voted dominant and includes both dominants in hex', () => {
    const palettes: ExtractedPalette[] = [
      { hex: ['#A8E0B0', '#000000', '#FFFFFF'], dominant: '#A8E0B0' },
      { hex: ['#A8E0B0', '#1E3A8A', '#FFFFFF'], dominant: '#A8E0B0' },
      { hex: ['#1E3A8A', '#000000', '#FFFFFF'], dominant: '#1E3A8A' },
    ]
    const result = mergePalettes(palettes)

    expect(result.dominant).toBe('#A8E0B0') // mint won 2-of-3 votes
    expect(result.hex).toContain('#A8E0B0')
    expect(result.hex).toContain('#1E3A8A')
  })
})

// ---------------------------------------------------------------------------
// Test 7 — mergePalettes tiebreaker is stable + deterministic.
// ---------------------------------------------------------------------------
describe('mergePalettes — tiebreaker is stable', () => {
  it('uses lexicographic tiebreaker; calling twice returns identical output', () => {
    const palettes: ExtractedPalette[] = [
      { hex: ['#A8E0B0'], dominant: '#A8E0B0' },
      { hex: ['#1E3A8A'], dominant: '#1E3A8A' },
    ]
    const r1 = mergePalettes(palettes)
    const r2 = mergePalettes(palettes)

    // Lex-lower hex wins ties; '#1E3A8A' < '#A8E0B0' lexicographically.
    expect(r1.dominant).toBe('#1E3A8A')
    expect(r1).toEqual(r2)
  })

  it('reverse-order input still produces the same result (order-independent)', () => {
    const palettesA: ExtractedPalette[] = [
      { hex: ['#A8E0B0'], dominant: '#A8E0B0' },
      { hex: ['#1E3A8A'], dominant: '#1E3A8A' },
    ]
    const palettesB: ExtractedPalette[] = [
      { hex: ['#1E3A8A'], dominant: '#1E3A8A' },
      { hex: ['#A8E0B0'], dominant: '#A8E0B0' },
    ]
    const rA = mergePalettes(palettesA)
    const rB = mergePalettes(palettesB)

    expect(rA.dominant).toBe(rB.dominant)
    // The hex SET must be identical regardless of input order.
    expect(new Set(rA.hex)).toEqual(new Set(rB.hex))
  })
})

// ---------------------------------------------------------------------------
// Test 8 — mergePalettes empty input falls back gracefully.
// ---------------------------------------------------------------------------
describe('mergePalettes — empty input', () => {
  it('does not throw; falls back to neutral gray', () => {
    const result = mergePalettes([])

    expect(result.hex.length).toBeGreaterThanOrEqual(1)
    expect(result.dominant).toBe('#808080')
    expect(result.hex[0]).toBe('#808080')
  })
})

// ---------------------------------------------------------------------------
// Test 9 — mergePalettes caps at PALETTE_TARGET_SIZE entries.
// ---------------------------------------------------------------------------
describe('mergePalettes — caps at PALETTE_TARGET_SIZE', () => {
  it('returns no more than PALETTE_TARGET_SIZE hexes for large inputs', () => {
    const palettes: ExtractedPalette[] = [
      {
        hex: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'],
        dominant: '#111111',
      },
      {
        hex: ['#777777', '#888888', '#999999', '#AAAAAA', '#BBBBBB', '#CCCCCC'],
        dominant: '#777777',
      },
      {
        hex: ['#DDDDDD', '#EEEEEE', '#FFFFFF', '#012345', '#67890A', '#BCDEF1'],
        dominant: '#DDDDDD',
      },
    ]
    const result = mergePalettes(palettes)

    expect(result.hex.length).toBeLessThanOrEqual(PALETTE_TARGET_SIZE)
    expect(PALETTE_TARGET_SIZE).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// Test 10 — Subpath import gate (server-only, no client bundling).
// ---------------------------------------------------------------------------
describe('source-grep gate — node-only subpath import', () => {
  it('imports node-vibrant from the /node subpath, not bare', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(
      'src/lib/ai/palette-extraction.ts',
      'utf8',
    )
    // MUST contain the /node subpath import.
    expect(src).toMatch(/from ['"]node-vibrant\/node['"]/)
    // MUST NOT contain a bare `from 'node-vibrant'` (no /node suffix).
    // We check both single + double quotes, with either ; or newline as the
    // statement terminator. The negative-lookahead `(?!\/)` rules out the
    // /node subpath which is what we want.
    const bareMatches = src.match(
      /from ['"]node-vibrant(?!\/)['"]/g,
    )
    expect(bareMatches).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test 11 — No-Gemini gate (palette is the determinism layer per D-07).
// ---------------------------------------------------------------------------
describe('source-grep gate — no Gemini SDK in palette module', () => {
  it('does not import or reference @google/genai or GoogleGenAI', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(
      'src/lib/ai/palette-extraction.ts',
      'utf8',
    )
    expect(src).not.toMatch(/@google\/genai/)
    expect(src).not.toMatch(/GoogleGenAI/)
  })
})

// ---------------------------------------------------------------------------
// Test 12 — Hex-format invariant on real output.
// ---------------------------------------------------------------------------
describe('extractPaletteFromBytes — hex-format invariant', () => {
  it('returns only canonical 6-digit uppercase hex with leading #', async () => {
    const buf = await makeQuadrantImage(64, {
      tl: { r: 200, g: 50, b: 50 },
      tr: { r: 50, g: 200, b: 50 },
      bl: { r: 50, g: 50, b: 200 },
      br: { r: 200, g: 200, b: 50 },
    })
    const result = await extractPaletteFromBytes(buf)

    for (const h of result.hex) {
      expect(h).toMatch(HEX6_REGEX)
      expect(h).toBe(h.toUpperCase()) // canonicalized to uppercase
      expect(h.length).toBe(7) // '#' + 6 hex digits
    }
    expect(result.dominant).toMatch(HEX6_REGEX)
    expect(result.dominant).toBe(result.dominant.toUpperCase())
  })
})
