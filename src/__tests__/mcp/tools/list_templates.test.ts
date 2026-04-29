// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '@/lib/mcp/tools'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))

describe('list_templates tool (MCP-TOOL-01)', () => {
  it('returns templates with the same projection as REST GET /api/v1/templates', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' })
    registerTools(server)
    const registered = ((server as unknown) as { _registeredTools: Record<string, { callback: (args: unknown, extra: unknown) => Promise<{ content: { text: string }[] }> }> })._registeredTools
    const result = await registered.list_templates.callback({}, { authInfo: { extra: { userId: 'u', keyId: 'k' } } })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.templates).toBeInstanceOf(Array)
    expect(parsed.templates.length).toBeGreaterThan(0)
    // Each item must have the 5 projection keys (matches src/app/api/v1/templates/route.ts:6-12)
    for (const t of parsed.templates) {
      expect(t).toHaveProperty('id')
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('thumbnail')
      expect(t).toHaveProperty('textPosition')
      expect(t).toHaveProperty('textAlign')
    }
  })
})
