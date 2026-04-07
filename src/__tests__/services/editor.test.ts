import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => {
  const maybeSingleFn = vi.fn()
  const eqFn = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn }) })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  const fromFn = vi.fn().mockReturnValue({
    select: selectFn,
    update: updateFn,
  })
  return {
    createAdminClient: vi.fn().mockReturnValue({ from: fromFn }),
    _mocks: { fromFn, selectFn, eqFn, maybeSingleFn, updateFn },
  }
})

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock Pexels search
vi.mock('@/lib/pexels/search-photos', () => ({
  searchPhotos: vi.fn().mockResolvedValue([
    { id: 1, src: { large2x: 'https://images.pexels.com/photo1.jpg' } },
  ]),
}))

import { updateSlide, getSlide } from '@/lib/services/editor'
import { searchPhotos } from '@/lib/pexels/search-photos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { _mocks } = await import('@/lib/supabase/admin') as any
const mockSearchPhotos = vi.mocked(searchPhotos)

const MOCK_SLIDE_DATA = [
  {
    hook_text: 'Original hook',
    body_text: 'Original body',
    image_query: 'nature',
    is_cta: false,
    background_url: 'https://example.com/img.jpg',
    pexels_photo_id: 123,
  },
  {
    hook_text: 'Second slide',
    body_text: 'Second body',
    image_query: 'city',
    is_cta: false,
    background_url: 'https://example.com/img2.jpg',
    pexels_photo_id: 456,
  },
  {
    hook_text: 'CTA slide',
    body_text: 'Follow us!',
    image_query: '',
    is_cta: true,
    background_url: null,
    pexels_photo_id: null,
  },
]

function mockProjectFound(slideData = MOCK_SLIDE_DATA) {
  _mocks.maybeSingleFn.mockResolvedValueOnce({
    data: { id: 'proj-1', user_id: 'user-123', slide_data: slideData },
    error: null,
  })
}

function mockProjectNotFound() {
  _mocks.maybeSingleFn.mockResolvedValueOnce({ data: null, error: null })
}

describe('updateSlide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates text fields on a slide', async () => {
    mockProjectFound()
    const result = await updateSlide('user-123', 'proj-1', 0, {
      hook_text: 'Updated hook',
    })
    expect(result.hook_text).toBe('Updated hook')
  })

  it('triggers Pexels search when image_query provided', async () => {
    mockProjectFound()
    await updateSlide('user-123', 'proj-1', 0, {
      image_query: 'sunset beach',
    })
    expect(mockSearchPhotos).toHaveBeenCalledWith('sunset beach')
  })

  it('sets background_url directly when provided', async () => {
    mockProjectFound()
    const result = await updateSlide('user-123', 'proj-1', 0, {
      background_url: 'https://example.com/new-img.jpg',
    })
    expect(mockSearchPhotos).not.toHaveBeenCalled()
    expect(result.background_url).toBe('https://example.com/new-img.jpg')
  })

  it('throws NOT_FOUND when project not owned by user', async () => {
    mockProjectNotFound()
    await expect(
      updateSlide('user-123', 'proj-999', 0, { hook_text: 'test' })
    ).rejects.toThrow()
  })

  it('throws NOT_FOUND when slide index out of bounds', async () => {
    mockProjectFound()
    await expect(
      updateSlide('user-123', 'proj-1', 5, { hook_text: 'test' })
    ).rejects.toThrow()
  })

  it('rejects non-https background URLs', async () => {
    mockProjectFound()
    await expect(
      updateSlide('user-123', 'proj-1', 0, {
        background_url: 'http://insecure.com/img.jpg',
      })
    ).rejects.toThrow()
  })
})

describe('getSlide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns slide at given index', async () => {
    mockProjectFound()
    const result = await getSlide('user-123', 'proj-1', 1)
    expect(result.hook_text).toBe('Second slide')
  })
})
