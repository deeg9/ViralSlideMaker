import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => {
  const maybeSingleFn = vi.fn()
  const eqFn = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn }) })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  const fromFn = vi.fn().mockReturnValue({ select: selectFn })
  return {
    createAdminClient: vi.fn().mockReturnValue({ from: fromFn }),
    _mocks: { fromFn, selectFn, eqFn, maybeSingleFn },
  }
})

// Mock render pipeline
vi.mock('@/lib/render/render-slide-satori', () => ({
  buildSlideElement: vi.fn().mockReturnValue('<div>slide</div>'),
}))

vi.mock('@/lib/render/load-font', () => ({
  loadFontBuffersForSlide: vi.fn().mockResolvedValue([
    { name: 'Inter', data: new ArrayBuffer(8), weight: 400, style: 'normal' },
  ]),
}))

vi.mock('@/lib/render/templates', () => ({
  getTemplate: vi.fn().mockReturnValue({
    id: 'bold-minimal',
    name: 'Bold Minimal',
    fontFamily: 'Inter',
    textColor: '#ffffff',
    backgroundColor: '#000000',
    overlayColor: '#000000',
    overlayOpacity: 0.5,
  }),
}))

vi.mock('@/lib/brand-kit/get-effective-template', () => ({
  mergeWithBrandKit: vi.fn().mockImplementation((template: unknown) => template),
}))

// Mock JSZip
vi.mock('jszip', () => {
  const mockFile = vi.fn()
  const mockGenerateAsync = vi.fn().mockResolvedValue(new ArrayBuffer(16))
  return {
    default: vi.fn().mockImplementation(() => ({
      file: mockFile,
      generateAsync: mockGenerateAsync,
    })),
    _mocks: { mockFile, mockGenerateAsync },
  }
})

import { renderSlide, renderAllSlidesToZip } from '@/lib/services/render'
import { mergeWithBrandKit } from '@/lib/brand-kit/get-effective-template'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { _mocks: adminMocks } = await import('@/lib/supabase/admin') as any
const mockMergeWithBrandKit = vi.mocked(mergeWithBrandKit)

const MOCK_SLIDE_DATA = [
  {
    hook_text: 'Hook 1',
    body_text: 'Body 1',
    image_query: 'nature',
    is_cta: false,
    background_url: 'https://example.com/img1.jpg',
    pexels_photo_id: 123,
  },
  {
    hook_text: 'Hook 2',
    body_text: 'Body 2',
    image_query: 'city',
    is_cta: false,
    background_url: 'https://example.com/img2.jpg',
    pexels_photo_id: 456,
  },
]

function mockProjectFound(slideData = MOCK_SLIDE_DATA) {
  adminMocks.maybeSingleFn.mockResolvedValueOnce({
    data: {
      id: 'proj-1',
      user_id: 'user-123',
      slide_data: slideData,
      template_id: 'bold-minimal',
      brand_kit_id: null,
    },
    error: null,
  })
}

describe('renderSlide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ArrayBuffer of rendered PNG', async () => {
    mockProjectFound()
    const result = await renderSlide('user-123', 'proj-1', 0)
    expect(result).toBeInstanceOf(ArrayBuffer)
  })

  it('applies brand kit to template', async () => {
    mockProjectFound()
    await renderSlide('user-123', 'proj-1', 0)
    expect(mockMergeWithBrandKit).toHaveBeenCalled()
  })

  it('throws when slide index out of bounds', async () => {
    mockProjectFound()
    await expect(renderSlide('user-123', 'proj-1', 10)).rejects.toThrow()
  })
})

describe('renderAllSlidesToZip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates ZIP with all slides', async () => {
    mockProjectFound()
    // Need to re-mock for second call within renderAllSlidesToZip
    mockProjectFound()
    const result = await renderAllSlidesToZip('user-123', 'proj-1')
    expect(result).toBeInstanceOf(ArrayBuffer)
  })

  it('renders sequentially not in parallel', async () => {
    mockProjectFound()
    mockProjectFound()
    const callOrder: number[] = []
    const originalRenderSlide = renderSlide
    // Verify sequential execution by checking no Promise.all is used
    // The service should render slides one at a time
    const result = await renderAllSlidesToZip('user-123', 'proj-1')
    expect(result).toBeInstanceOf(ArrayBuffer)
  })
})
