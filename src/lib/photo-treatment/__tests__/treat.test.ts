// Phase 54-01 (TREAT-05): pure unit tests for treatPhoto()
// Verifies cache-key determinism, byte-identical output, preset coverage,
// storage-path format, and cache-hit short-circuit (no upload on hit).

import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- Supabase admin client mock ---------------------------------------------
// Captures upload/list/getPublicUrl calls so tests can assert on the path.
type ListEntry = {
  name: string
  id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  metadata: Record<string, unknown>
}
type ListResult = { data: ListEntry[]; error: null | { message: string } }
const uploadMock = vi.fn<(path: string, body: Buffer, opts?: unknown) => Promise<{ data: { path: string }; error: null }>>(
  async () => ({ data: { path: '' }, error: null }),
)
const listMock = vi.fn<(prefix: string, opts?: { search?: string }) => Promise<ListResult>>(
  async () => ({ data: [], error: null }),
)
const getPublicUrlMock = vi.fn((p: string) => ({
  data: { publicUrl: `https://example.test/storage/v1/object/public/slide-backgrounds-treated/${p}` },
}))
const fromMock = vi.fn(() => ({
  upload: uploadMock,
  list: listMock,
  getPublicUrl: getPublicUrlMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: { from: fromMock },
  }),
}))

// --- Source fixture ---------------------------------------------------------
// 32x32 solid red PNG generated with sharp at test time. Captured into the
// fetch mock so each treatPhoto call returns the same source bytes.
import { sharp } from '../sharp-config'

let fixturePng: Buffer

beforeEach(async () => {
  vi.clearAllMocks()
  fixturePng = await sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 200, g: 60, b: 60 } },
  })
    .png()
    .toBuffer()

  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () =>
      // Return a fresh ArrayBuffer view of the fixture each call.
      fixturePng.buffer.slice(
        fixturePng.byteOffset,
        fixturePng.byteOffset + fixturePng.byteLength,
      ),
  })) as unknown as typeof fetch

  // Default list response = empty (cache miss). Tests that exercise cache
  // hits override this in-place.
  listMock.mockResolvedValue({ data: [], error: null })
})

describe('photo-treatment / buildCacheKey', () => {
  it('returns identical cache key for identical (sourceUrl, spec)', async () => {
    const { buildCacheKey } = await import('../treat')
    const a = buildCacheKey('https://x/1.jpg', { kind: 'bw' })
    const b = buildCacheKey('https://x/1.jpg', { kind: 'bw' })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns different cache keys for different specs', async () => {
    const { buildCacheKey } = await import('../treat')
    const a = buildCacheKey('https://x/1.jpg', { kind: 'bw' })
    const b = buildCacheKey('https://x/1.jpg', { kind: 'duotone-cream' })
    expect(a).not.toBe(b)
  })
})

describe('photo-treatment / applyPreset', () => {
  it('produces byte-identical output for identical bw spec on the same source', async () => {
    const { applyPreset } = await import('../treat')
    const a = await applyPreset(fixturePng, { kind: 'bw' })
    const b = await applyPreset(fixturePng, { kind: 'bw' })
    expect(Buffer.compare(a, b)).toBe(0)
  })

  it('produces byte-identical output for identical duotone-cream spec', async () => {
    const { applyPreset } = await import('../treat')
    const a = await applyPreset(fixturePng, { kind: 'duotone-cream' })
    const b = await applyPreset(fixturePng, { kind: 'duotone-cream' })
    expect(Buffer.compare(a, b)).toBe(0)
  })
})

describe('photo-treatment / treatPhoto', () => {
  it('handles all 4 preset kinds without throwing', async () => {
    const { treatPhoto } = await import('../treat')
    const presets = [
      { kind: 'bw' as const },
      { kind: 'duotone-cream' as const },
      { kind: 'duotone-cobalt' as const },
      { kind: 'contrast-bump' as const },
    ]
    for (const spec of presets) {
      const res = await treatPhoto('https://x/1.jpg', spec, 'u-test')
      expect(res.url).toContain('slide-backgrounds-treated')
      expect(res.palette.dominant.hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('uploads to slide-backgrounds-treated/{userId}/treated/{sha}.png', async () => {
    const { treatPhoto } = await import('../treat')
    await treatPhoto('https://x/1.jpg', { kind: 'bw' }, 'u-test')
    expect(uploadMock).toHaveBeenCalledTimes(1)
    const firstCall = uploadMock.mock.calls[0] as [string, Buffer, unknown?] | undefined
    expect(firstCall).toBeDefined()
    const path = firstCall![0]
    expect(path).toMatch(/^u-test\/treated\/[0-9a-f]{64}\.png$/)
    expect(fromMock).toHaveBeenCalledWith('slide-backgrounds-treated')
  })

  it('skips upload on cache hit', async () => {
    const { treatPhoto, buildCacheKey } = await import('../treat')
    const sha = buildCacheKey('https://x/1.jpg', { kind: 'bw' })
    listMock.mockResolvedValueOnce({
      data: [{ name: `${sha}.png`, id: 'fake', updated_at: '', created_at: '', last_accessed_at: '', metadata: {} }],
      error: null,
    })
    const res = await treatPhoto('https://x/1.jpg', { kind: 'bw' }, 'u-test')
    expect(uploadMock).not.toHaveBeenCalled()
    expect(res.url).toContain(`u-test/treated/${sha}.png`)
  })

  it('palette has dominant + cluster1..3 with valid hex', async () => {
    const { treatPhoto } = await import('../treat')
    const res = await treatPhoto('https://x/1.jpg', { kind: 'bw' }, 'u-test')
    expect(res.palette.dominant.hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(res.palette.cluster1.hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(res.palette.cluster2.hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(res.palette.cluster3.hex).toMatch(/^#[0-9a-f]{6}$/)
  })
})
