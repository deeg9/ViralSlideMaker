import { describe, it, expect } from 'vitest'

describe('mcp-handler import gate (regression: v2.3 retirement cause)', () => {
  it('imports createMcpHandler and withMcpAuth as functions from mcp-handler', async () => {
    const mod = await import('mcp-handler')
    expect(typeof mod.createMcpHandler).toBe('function')
    expect(typeof mod.withMcpAuth).toBe('function')
  })

  it('imports OAuth error classes from @modelcontextprotocol/sdk', async () => {
    const errs = await import('@modelcontextprotocol/sdk/server/auth/errors.js')
    expect(typeof errs.InvalidTokenError).toBe('function')
    expect(typeof errs.TemporarilyUnavailableError).toBe('function')
    expect(typeof errs.ServerError).toBe('function')
  })
})
