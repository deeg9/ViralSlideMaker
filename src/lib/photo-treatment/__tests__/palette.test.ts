// Phase 57 (PALETTE-01, PALETTE-04): tests for extractPalette.
//
// Strategy:
// - Mock node-vibrant/node to avoid real image processing in unit tests
// - Mock global fetch to return a controlled buffer
// - Verify cascade fallback (D-06) and that 6 hex keys are always returned
// - sharp resize budget is verified by inspecting that sharp is invoked
//   (the actual resize bytes are not asserted — would require integration test)

import { describe, it, expect, vi, beforeEach } from 'vitest'

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

// --- Mocks ----------------------------------------------------------------

let mockPaletteResponse: Record<string, { hex: string } | null | undefined> = {}

vi.mock('node-vibrant/node', () => ({
  Vibrant: {
    from: () => ({
      getPalette: async () => mockPaletteResponse,
    }),
  },
}))

// global fetch returns a tiny PNG-shaped buffer (sharp will accept it
// but we mock sharp behavior below to skip real decoding).
const FAKE_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
])

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => FAKE_PNG.buffer.slice(
        FAKE_PNG.byteOffset,
        FAKE_PNG.byteOffset + FAKE_PNG.byteLength,
      ),
    })),
  )
})

// Mock sharp to skip actual image decoding (the FAKE_PNG above is too
// small to decode). We only need to assert that the pipeline is INVOKED
// with the expected resize options.
vi.mock('../sharp-config', () => {
  const fakeBuffer = Buffer.from('fake-thumb-output')
  return {
    sharp: vi.fn(() => ({
      resize: vi.fn().mockReturnThis(),
      png: vi.fn().mockReturnThis(),
      toBuffer: vi.fn(async () => fakeBuffer),
    })),
  }
})

// --- Tests ---------------------------------------------------------------

describe('extractPalette', () => {
  it('returns 6 hex keys when Vibrant returns full palette', async () => {
    mockPaletteResponse = {
      Vibrant: { hex: '#FF6347' },
      DarkVibrant: { hex: '#8B0000' },
      LightVibrant: { hex: '#FFD4CC' },
      Muted: { hex: '#998877' },
      DarkMuted: { hex: '#3d2222' },
      LightMuted: { hex: '#E0D5C8' },
    }
    const { extractPalette } = await import('../palette')
    const result = await extractPalette('https://example.com/treated.png')

    expect(result.Vibrant).toBe('#FF6347')
    expect(result.DarkVibrant).toBe('#8B0000')
    expect(result.LightVibrant).toBe('#FFD4CC')
    expect(result.Muted).toBe('#998877')
    expect(result.DarkMuted).toBe('#3d2222')
    expect(result.LightMuted).toBe('#E0D5C8')

    // All 6 keys are non-null hex
    for (const v of Object.values(result)) {
      expect(v).toMatch(HEX_REGEX)
    }
  })

  it('cascades fallback when Vibrant returns nulls (D-06)', async () => {
    mockPaletteResponse = {
      Vibrant: null,
      DarkVibrant: { hex: '#8B0000' },
      LightVibrant: undefined,
      Muted: { hex: '#998877' },
      DarkMuted: null,
      LightMuted: undefined,
    }
    const { extractPalette } = await import('../palette')
    const result = await extractPalette('https://example.com/treated.png')

    // Every key resolves to a hex (cascade fallback)
    for (const [key, val] of Object.entries(result)) {
      expect(val, `key ${key}`).toMatch(HEX_REGEX)
    }

    // First-found cascade is DarkVibrant (since Vibrant is null)
    expect(result.Vibrant).toBe('#8B0000')
    expect(result.DarkVibrant).toBe('#8B0000')
    // LightVibrant cascades through to next available
    expect(result.LightVibrant).toBe('#8B0000')
  })

  it('uses brand fallback when ALL roles are null', async () => {
    mockPaletteResponse = {
      Vibrant: null,
      DarkVibrant: null,
      LightVibrant: null,
      Muted: null,
      DarkMuted: null,
      LightMuted: null,
    }
    const { extractPalette } = await import('../palette')
    const result = await extractPalette('https://example.com/treated.png')

    // Brand fallback (#7d6161) for every role
    for (const v of Object.values(result)) {
      expect(v).toBe('#7d6161')
    }
  })

  it('throws on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        arrayBuffer: async () => new ArrayBuffer(0),
      })),
    )
    const { extractPalette } = await import('../palette')

    await expect(
      extractPalette('https://example.com/missing.png'),
    ).rejects.toThrow(/fetch failed 404/)
  })

  it('invokes sharp.resize with ≤256×256 inside fit (PALETTE-04)', async () => {
    mockPaletteResponse = {
      Vibrant: { hex: '#FF6347' },
      DarkVibrant: { hex: '#8B0000' },
      LightVibrant: { hex: '#FFD4CC' },
      Muted: { hex: '#998877' },
      DarkMuted: { hex: '#3d2222' },
      LightMuted: { hex: '#E0D5C8' },
    }
    const sharpModule = await import('../sharp-config')
    const sharpMock = sharpModule.sharp as unknown as ReturnType<typeof vi.fn>
    sharpMock.mockClear()

    // Build a fresh chain mock so we can capture resize args
    const resizeSpy = vi.fn().mockReturnThis()
    const pngSpy = vi.fn().mockReturnThis()
    const toBufferSpy = vi.fn(async () => Buffer.from('thumb'))
    sharpMock.mockReturnValueOnce({
      resize: resizeSpy,
      png: pngSpy,
      toBuffer: toBufferSpy,
    } as unknown as never)

    const { extractPalette } = await import('../palette')
    await extractPalette('https://example.com/treated.png')

    expect(resizeSpy).toHaveBeenCalledWith(
      256,
      256,
      expect.objectContaining({ fit: 'inside', withoutEnlargement: true }),
    )
  })
})
