import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock service layer
vi.mock('@/lib/services/carousel', () => ({
  generateCarouselService: vi.fn(),
}))

vi.mock('@/lib/services/project', () => ({
  createProjectService: vi.fn(),
  getProject: vi.fn(),
}))

vi.mock('@/lib/services/editor', () => ({
  updateSlide: vi.fn(),
  getSlide: vi.fn(),
}))

vi.mock('@/lib/services/render', () => ({
  getBrandKitForUser: vi.fn(),
  renderSlide: vi.fn(),
  renderAllSlidesToZip: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({}),
}))

import { registerTools } from '@/lib/mcp/tools'
import { generateCarouselService } from '@/lib/services/carousel'
import { createProjectService, getProject } from '@/lib/services/project'
import { updateSlide } from '@/lib/services/editor'
import { getBrandKitForUser } from '@/lib/services/render'

describe('registerTools', () => {
  it('is a function', () => {
    expect(typeof registerTools).toBe('function')
  })

  it('registers exactly 4 tools on the server', () => {
    const mockServer = {
      tool: vi.fn(),
    }
    registerTools(mockServer as any)
    expect(mockServer.tool).toHaveBeenCalledTimes(4)

    const toolNames = mockServer.tool.mock.calls.map((call: any[]) => call[0])
    expect(toolNames).toContain('create_carousel')
    expect(toolNames).toContain('edit_slide')
    expect(toolNames).toContain('render_carousel')
    expect(toolNames).toContain('list_templates')
  })
})

describe('tool handlers', () => {
  let handlers: Record<string, Function>

  beforeEach(() => {
    vi.clearAllMocks()

    const mockServer = {
      tool: vi.fn(),
    }
    registerTools(mockServer as any)

    handlers = {}
    for (const call of mockServer.tool.mock.calls) {
      // tool(name, description, schema, handler) or tool(name, description, handler)
      const name = call[0]
      const handler = call[call.length - 1] // last arg is always the handler
      handlers[name] = handler
    }
  })

  const mockExtra = {
    authInfo: {
      token: 'vsl_test',
      clientId: 'user-1',
      scopes: [],
      extra: { userId: 'user-1', keyId: 'key-1' },
    },
  }

  describe('list_templates', () => {
    it('returns template data without requiring auth params', async () => {
      const result = await handlers.list_templates({}, { ...mockExtra })
      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe('text')
      const data = JSON.parse(result.content[0].text)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
      expect(data[0]).toHaveProperty('id')
      expect(data[0]).toHaveProperty('name')
    })
  })

  describe('create_carousel', () => {
    it('creates project and generates carousel with correct params', async () => {
      vi.mocked(createProjectService).mockResolvedValue({ id: 'proj-1' })
      vi.mocked(generateCarouselService).mockResolvedValue({ success: true, slideCount: 7 })
      vi.mocked(getBrandKitForUser).mockResolvedValue(null)
      vi.mocked(getProject).mockResolvedValue({
        id: 'proj-1',
        title: 'Test',
        topic: 'test topic',
        template_id: 'bold-minimal',
        generation_status: 'complete',
        slide_data: Array(7).fill({ hook_text: 'test' }),
        created_at: '',
        updated_at: '',
      })

      const result = await handlers.create_carousel(
        { topic: 'AI trends 2025' },
        mockExtra
      )

      expect(createProjectService).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'MCP: AI trends 2025', topic: 'AI trends 2025' }),
        expect.any(Object)
      )
      expect(generateCarouselService).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          projectId: 'proj-1',
          topic: 'AI trends 2025',
          templateId: 'bold-minimal',
          imageSource: 'stock',
          slideCount: 7,
        }),
        expect.any(Object)
      )

      const data = JSON.parse(result.content[0].text)
      expect(data.projectId).toBe('proj-1')
      expect(data.slideCount).toBe(7)
      expect(data.downloadUrls).toHaveLength(7)
    })

    it('returns error when generation fails', async () => {
      vi.mocked(createProjectService).mockResolvedValue({ id: 'proj-1' })
      vi.mocked(generateCarouselService).mockResolvedValue({
        success: false,
        error: 'No credits remaining',
      })

      const result = await handlers.create_carousel(
        { topic: 'test' },
        mockExtra
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('No credits remaining')
    })
  })

  describe('edit_slide', () => {
    it('maps camelCase params to snake_case and calls updateSlide', async () => {
      const mockSlide = { hook_text: 'Updated', body_text: 'Body', image_query: 'q', is_cta: false, background_url: null, pexels_photo_id: null }
      vi.mocked(updateSlide).mockResolvedValue(mockSlide as any)

      const result = await handlers.edit_slide(
        { projectId: '123e4567-e89b-12d3-a456-426614174000', slideIndex: 0, hookText: 'Updated', bodyText: 'New body' },
        mockExtra
      )

      expect(updateSlide).toHaveBeenCalledWith(
        'user-1',
        '123e4567-e89b-12d3-a456-426614174000',
        0,
        expect.objectContaining({ hook_text: 'Updated', body_text: 'New body' }),
        expect.any(Object)
      )

      const data = JSON.parse(result.content[0].text)
      expect(data.hook_text).toBe('Updated')
    })
  })

  describe('render_carousel', () => {
    it('returns download URLs for all slides', async () => {
      vi.mocked(getProject).mockResolvedValue({
        id: 'proj-1',
        title: 'Test',
        topic: null,
        template_id: 'bold-minimal',
        generation_status: 'complete',
        slide_data: Array(5).fill({ hook_text: 'test' }),
        created_at: '',
        updated_at: '',
      })

      const result = await handlers.render_carousel(
        { projectId: '123e4567-e89b-12d3-a456-426614174000' },
        mockExtra
      )

      const data = JSON.parse(result.content[0].text)
      expect(data.projectId).toBe('123e4567-e89b-12d3-a456-426614174000')
      expect(data.slideCount).toBe(5)
      expect(data.downloadUrls).toHaveLength(5)
      expect(data.zipUrl).toContain('download')
    })

    it('returns error when project not found', async () => {
      vi.mocked(getProject).mockResolvedValue(null)

      const result = await handlers.render_carousel(
        { projectId: '123e4567-e89b-12d3-a456-426614174000' },
        mockExtra
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not found')
    })
  })
})
