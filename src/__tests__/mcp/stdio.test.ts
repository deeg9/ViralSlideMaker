import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally before importing http-client
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('MCP HTTP Client', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VIRALSLIDEMAKER_API_KEY: 'vsl_test_key_123',
      VIRALSLIDEMAKER_BASE_URL: 'https://test.viralslidemaker.com',
    }
    mockFetch.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('createCarousel', () => {
    it('sends POST to /api/v1/carousel with correct body and auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, projectId: 'proj-123', slideCount: 7 }),
      })

      // Dynamic import to pick up env vars
      const { createCarousel } = await import('../../mcp/http-client')

      await createCarousel({ topic: 'Best coffee shops', slideCount: 5 })

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://test.viralslidemaker.com/api/v1/carousel')
      expect(options.method).toBe('POST')
      expect(options.headers.Authorization).toBe('Bearer vsl_test_key_123')
      expect(options.headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(options.body)
      expect(body.topic).toBe('Best coffee shops')
      expect(body.slideCount).toBe(5)
      expect(body.templateId).toBe('bold-minimal')
      expect(body.imageSource).toBe('stock')
    })

    it('uses default values for optional params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const { createCarousel } = await import('../../mcp/http-client')
      await createCarousel({ topic: 'Test topic' })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.templateId).toBe('bold-minimal')
      expect(body.imageSource).toBe('stock')
      expect(body.slideCount).toBe(7)
    })
  })

  describe('listTemplates', () => {
    it('sends GET to /api/v1/templates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'bold-minimal', name: 'Bold Minimal', textPosition: 'center', textAlign: 'center' }],
        }),
      })

      const { listTemplates } = await import('../../mcp/http-client')
      const result = await listTemplates()

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://test.viralslidemaker.com/api/v1/templates')
      expect(options.method).toBe('GET')
      expect(options.headers.Authorization).toBe('Bearer vsl_test_key_123')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('bold-minimal')
    })
  })

  describe('editSlide', () => {
    it('sends PATCH to /api/v1/projects/:id/slides/:index with snake_case body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { hook_text: 'New hook' } }),
      })

      const { editSlide } = await import('../../mcp/http-client')
      await editSlide({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        slideIndex: 2,
        hookText: 'New hook',
        bodyText: 'New body',
      })

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe(
        'https://test.viralslidemaker.com/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/slides/2'
      )
      expect(options.method).toBe('PATCH')

      const body = JSON.parse(options.body)
      expect(body.hook_text).toBe('New hook')
      expect(body.body_text).toBe('New body')
      // Should not have camelCase keys
      expect(body.hookText).toBeUndefined()
      expect(body.bodyText).toBeUndefined()
    })

    it('only sends provided fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      })

      const { editSlide } = await import('../../mcp/http-client')
      await editSlide({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        slideIndex: 0,
        hookText: 'Only hook',
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.hook_text).toBe('Only hook')
      expect(body).not.toHaveProperty('body_text')
      expect(body).not.toHaveProperty('image_query')
      expect(body).not.toHaveProperty('background_url')
    })
  })

  describe('renderCarousel', () => {
    it('sends POST to /api/v1/projects/:id/render', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            slides: [{ index: 0, download_url: '/api/v1/projects/proj-1/download/0' }],
            zip_url: '/api/v1/projects/proj-1/download',
          },
        }),
      })

      const { renderCarousel } = await import('../../mcp/http-client')
      const result = await renderCarousel('proj-1')

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://test.viralslidemaker.com/api/v1/projects/proj-1/render')
      expect(options.method).toBe('POST')
      expect(result.slides).toHaveLength(1)
      expect(result.zip_url).toBe('/api/v1/projects/proj-1/download')
    })
  })

  describe('error handling', () => {
    it('throws on non-ok response with masked API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '{"error":"Invalid key vsl_test_key_123"}',
      })

      const { createCarousel } = await import('../../mcp/http-client')

      await expect(createCarousel({ topic: 'test' })).rejects.toThrow(
        /API request failed \(401\)/
      )
      // API key should be masked in the error
      await expect(
        createCarousel({ topic: 'test' }).catch((e: Error) => {
          expect(e.message).not.toContain('vsl_test_key_123')
          expect(e.message).toContain('vsl_***')
          throw e
        })
      ).rejects.toThrow()
    })

    it('throws when API key is missing', async () => {
      delete process.env.VIRALSLIDEMAKER_API_KEY

      const { createCarousel } = await import('../../mcp/http-client')

      await expect(createCarousel({ topic: 'test' })).rejects.toThrow(
        /VIRALSLIDEMAKER_API_KEY environment variable is required/
      )
    })
  })

  describe('base URL handling', () => {
    it('strips trailing slash from base URL', async () => {
      process.env.VIRALSLIDEMAKER_BASE_URL = 'https://example.com/'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

      const { listTemplates } = await import('../../mcp/http-client')
      await listTemplates()

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('https://example.com/api/v1/templates')
    })

    it('defaults to viralslidemaker.com when base URL not set', async () => {
      delete process.env.VIRALSLIDEMAKER_BASE_URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

      const { listTemplates } = await import('../../mcp/http-client')
      await listTemplates()

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('https://viralslidemaker.com/api/v1/templates')
    })
  })
})
