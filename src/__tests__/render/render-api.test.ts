import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock node-html-to-image before importing route
vi.mock('node-html-to-image', () => ({
  default: vi.fn().mockResolvedValue(Buffer.from('fake-png-data')),
}))

// Mock supabase server client
const mockSingle = vi.fn()
const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}))

describe('render API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ single: mockSingle })
  })

  it('returns 400 if projectId query param is missing', async () => {
    const { GET } = await import('@/app/api/render/route')
    const request = new Request('http://localhost/api/render?slide=0')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 if slide query param is missing', async () => {
    const { GET } = await import('@/app/api/render/route')
    const request = new Request('http://localhost/api/render?projectId=abc')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })
})
