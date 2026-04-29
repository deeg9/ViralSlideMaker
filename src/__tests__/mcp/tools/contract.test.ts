// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '@/lib/mcp/tools'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))

describe('MCP tools/list contract (MCP-TOOL-06)', () => {
  it('registers exactly 4 tools with the documented names', () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' })
    registerTools(server)
    const registered = ((server as unknown) as { _registeredTools: Record<string, unknown> })._registeredTools
    const names = Object.keys(registered).sort()
    expect(names).toEqual(['create_carousel', 'edit_slide', 'list_templates', 'render_carousel'])
  })

  it('every tool description is at least 200 characters and mentions credit cost (MCP-TOOL-05)', () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' })
    registerTools(server)
    const registered = ((server as unknown) as { _registeredTools: Record<string, { description: string }> })._registeredTools
    for (const [name, def] of Object.entries(registered)) {
      expect(def.description.length, `${name} description too short`).toBeGreaterThanOrEqual(200)
      expect(def.description.toLowerCase()).toMatch(/credit/)
    }
  })

  it('tool handlers read userId from extra.authInfo.extra.userId (Phase 40 cross-phase contract)', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' })
    registerTools(server)
    const registered = ((server as unknown) as { _registeredTools: Record<string, { callback: (args: unknown, extra: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }> })._registeredTools
    const editSlide = registered.edit_slide
    // Calling without authInfo should return UNAUTHORIZED
    const noAuth = await editSlide.callback(
      { projectId: '00000000-0000-0000-0000-000000000000', slideIndex: 0, patch: { hook_text: 'x' } },
      { authInfo: undefined }
    )
    expect(noAuth.isError).toBe(true)
    expect(noAuth.content[0].text).toContain('UNAUTHORIZED')
  })
})
