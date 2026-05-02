// Phase 58 (MATCH-01..05): tests for premium-gated match-photos flow.
// Mocks Gemini + Supabase. Asserts MAX_PHOTOS slice, 10s timeout fallback,
// cache hit short-circuit, and cache write on success.

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Slide } from '@/lib/types/slide'

// Hoisted mock for @google/genai — must be set up before importing the module.
// vi.hoisted() lets us share state between the mock factory (which is hoisted
// to top-of-file) and the test bodies.
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn<(...args: unknown[]) => Promise<{ text?: string }>>(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent }
    constructor() {}
  },
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    INTEGER: 'INTEGER',
    STRING: 'STRING',
  },
}))

// Hoisted mock for fetch — match-photos calls fetch() to get photo bytes.
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    headers: new Map([['content-type', 'image/jpeg']]),
  } as unknown as Response)
})

// Import AFTER mocks are set up.
import { matchPhotosToSlides, MAX_PHOTOS } from '../match-photos-to-slides'

function makeSlide(idx: number, isCta = false): Slide {
  return {
    hook_text: `Hook ${idx}`,
    body_text: `Body ${idx}`,
    image_query: `query ${idx}`,
    is_cta: isCta,
  } as Slide
}

interface FakeQueryBuilder {
  select: Mock
  eq: Mock
  maybeSingle: Mock
  insert: Mock
  upsert: Mock
}

interface FakeAdmin {
  from: Mock
  _builders: Map<string, FakeQueryBuilder>
}

function makeFakeAdmin(opts: {
  cacheHitResult?: (string | null)[] | null
} = {}): FakeAdmin {
  const builders = new Map<string, FakeQueryBuilder>()
  function builderFor(table: string): FakeQueryBuilder {
    if (builders.has(table)) return builders.get(table)!
    const b: FakeQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: opts.cacheHitResult ? { result_jsonb: opts.cacheHitResult } : null,
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    builders.set(table, b)
    return b
  }
  const from = vi.fn((table: string) => builderFor(table))
  return { from: from as Mock, _builders: builders }
}

describe('Phase 58 (MATCH-03): MAX_PHOTOS cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockReset()
  })

  it('exposes MAX_PHOTOS = 8', () => {
    expect(MAX_PHOTOS).toBe(8)
  })

  it('photos beyond MAX_PHOTOS are sliced before Gemini', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        assignments: [{ slideIndex: 0, photoIndex: 0 }],
      }),
    })
    const slides = [makeSlide(0), makeSlide(1)]
    const photoUrls = Array.from({ length: 12 }, (_, i) => `https://x.test/p${i}.jpg`)
    await matchPhotosToSlides(slides, photoUrls)

    // Inspect the prompt parts to assert only 8 photos were sent.
    const callArg = mockGenerateContent.mock.calls[0][0] as {
      contents: Array<{ parts: Array<{ text?: string }> }>
    }
    const parts = callArg.contents[0].parts
    const photoLabels = parts.filter((p) => p.text?.startsWith('Photo '))
    expect(photoLabels).toHaveLength(8)
  })
})

describe('Phase 58 (MATCH-04): 10s timeout fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockReset()
  })

  it('Gemini hang triggers 10s timeout and returns indexOrderFallback', async () => {
    // Simulate a Gemini call that never resolves.
    mockGenerateContent.mockImplementationOnce(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    )
    vi.useFakeTimers()
    const slides = [makeSlide(0), makeSlide(1)]
    const photoUrls = ['https://x.test/p0.jpg', 'https://x.test/p1.jpg']

    const promise = matchPhotosToSlides(slides, photoUrls)
    // Advance past the 10s timeout.
    await vi.advanceTimersByTimeAsync(10_001)
    const result = await promise

    expect(result).toEqual(photoUrls) // index-order fallback
    vi.useRealTimers()
  })
})

describe('Phase 58 (MATCH-03): cache hit short-circuit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockReset()
  })

  it('cache HIT returns cached result without Gemini call or credit charge', async () => {
    const slides = [makeSlide(0), makeSlide(1)]
    const photoUrls = ['https://x.test/p0.jpg', 'https://x.test/p1.jpg']
    const cachedResult: (string | null)[] = [photoUrls[1], photoUrls[0]] // swapped
    const admin = makeFakeAdmin({ cacheHitResult: cachedResult })

    const result = await matchPhotosToSlides(slides, photoUrls, {
      userId: 'user-123',
      admin: admin as unknown as SupabaseClient,
    })

    expect(result).toEqual(cachedResult)
    expect(mockGenerateContent).not.toHaveBeenCalled()
    // No credit charged on cache hit.
    const ctBuilder = admin._builders.get('credit_transactions')
    expect(ctBuilder?.insert).toBeUndefined()
  })

  it('cache MISS calls Gemini and writes result to cache via upsert', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        assignments: [
          { slideIndex: 0, photoIndex: 0 },
          { slideIndex: 1, photoIndex: 1 },
        ],
      }),
    })
    const slides = [makeSlide(0), makeSlide(1)]
    const photoUrls = ['https://x.test/p0.jpg', 'https://x.test/p1.jpg']
    const admin = makeFakeAdmin({ cacheHitResult: null })

    const result = await matchPhotosToSlides(slides, photoUrls, {
      userId: 'user-123',
      admin: admin as unknown as SupabaseClient,
    })

    expect(result).toEqual(photoUrls)
    expect(mockGenerateContent).toHaveBeenCalledOnce()
    // Cache write fired.
    const cacheBuilder = admin._builders.get('match_photo_cache')
    expect(cacheBuilder?.upsert).toHaveBeenCalledOnce()
    const upsertArg = cacheBuilder!.upsert.mock.calls[0][0]
    expect(upsertArg).toMatchObject({
      photo_set_sha256: expect.any(String),
      slide_manifest_sha256: expect.any(String),
      result_jsonb: photoUrls,
    })
    // Credit charged once (no refund — successful match).
    const ctBuilder = admin._builders.get('credit_transactions')
    expect(ctBuilder?.insert).toHaveBeenCalledOnce()
    expect(ctBuilder!.insert.mock.calls[0][0]).toMatchObject({
      user_id: 'user-123',
      type: 'gemini_vision_match',
      amount: 1,
    })
  })
})

describe('Phase 58 (MATCH-05, D-10): credit refund on failure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockReset()
  })

  it('zero-assignment outcome refunds credit + returns index-order', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ assignments: [] }), // zero assignments
    })
    const slides = [makeSlide(0)]
    const photoUrls = ['https://x.test/p0.jpg']
    const admin = makeFakeAdmin({ cacheHitResult: null })

    const result = await matchPhotosToSlides(slides, photoUrls, {
      userId: 'user-123',
      admin: admin as unknown as SupabaseClient,
    })

    expect(result).toEqual(photoUrls) // index-order fallback
    const ctBuilder = admin._builders.get('credit_transactions')
    // Two inserts: 1 charge + 1 refund.
    expect(ctBuilder?.insert).toHaveBeenCalledTimes(2)
    const refundCall = ctBuilder!.insert.mock.calls[1][0]
    expect(refundCall).toMatchObject({
      user_id: 'user-123',
      type: 'refund',
      amount: 1,
      description: expect.stringContaining('zero assignments'),
    })
  })
})

describe('Phase 58: backward-compat — no options arg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockReset()
  })

  it('without options arg, behaves identically to parked file (no cache, no credit)', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        assignments: [{ slideIndex: 0, photoIndex: 0 }],
      }),
    })
    const slides = [makeSlide(0)]
    const photoUrls = ['https://x.test/p0.jpg']

    // No options arg.
    const result = await matchPhotosToSlides(slides, photoUrls)

    expect(result).toEqual(photoUrls)
    expect(mockGenerateContent).toHaveBeenCalledOnce()
  })
})
