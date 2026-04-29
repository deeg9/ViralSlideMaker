// @vitest-environment node
// Use the node environment so Web Streams produce native Uint8Array chunks.
// jsdom's stream polyfills yield non-Uint8Array values that mcp-handler's internal
// node-bridge writer rejects with "Unexpected chunk type: object".
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

const mockSingle = vi.fn()
const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
const mockEqUpdate = vi.fn().mockReturnValue({ then: vi.fn((cb) => cb?.()) })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate })

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }),
}))

// Phase 41 regression guard: importing the route now transitively pulls in registerTools →
// src/lib/services/carousel.ts → src/lib/pexels/search-photos.ts which evaluates createClient()
// at module load and throws "An ApiKey must be provided" without PEXELS_API_KEY. Mock the
// heavy service modules so route module evaluation succeeds in the test env.
vi.mock('@/lib/services/carousel', () => ({ generateCarousel: vi.fn() }))
vi.mock('@/lib/services/projects', () => ({
  getProject: vi.fn(),
  updateProjectService: vi.fn(),
}))

// rate-limit env vars unset → checkRateLimit returns success:true (no Upstash calls in test)

describe('POST /api/mcp route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEqSelect.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEqSelect })
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
  })

  it('returns 401 with WWW-Authenticate header when Authorization is missing', async () => {
    const route = await import('@/app/api/[transport]/route')
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    })
    // mcp-handler@1.1.0's exported handler signature is (req: Request) => Promise<Response>;
    // Next.js App Router passes (req, { params }) but mcp-handler ignores the second arg.
    // Cast as any so TS doesn't complain about the documented Next.js signature.
    const res = await (route.POST as (req: Request, ctx: unknown) => Promise<Response>)(
      req,
      { params: Promise.resolve({ transport: 'mcp' }) }
    )
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')?.toLowerCase()).toContain('bearer')
  })

  it('returns 401 when Bearer token does not start with vsl_', async () => {
    const route = await import('@/app/api/[transport]/route')
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json, text/event-stream',
        Authorization: 'Bearer sk_other_xyz',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    })
    // mcp-handler@1.1.0's exported handler signature is (req: Request) => Promise<Response>;
    // Next.js App Router passes (req, { params }) but mcp-handler ignores the second arg.
    // Cast as any so TS doesn't complain about the documented Next.js signature.
    const res = await (route.POST as (req: Request, ctx: unknown) => Promise<Response>)(
      req,
      { params: Promise.resolve({ transport: 'mcp' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns server capabilities on initialize with valid Bearer', async () => {
    const rawKey = 'vsl_valid_test_key'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    mockSingle.mockResolvedValueOnce({
      data: { id: 'k1', user_id: 'u1', key_hash: keyHash },
      error: null,
    })

    const route = await import('@/app/api/[transport]/route')
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${rawKey}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } },
      }),
    })
    // mcp-handler@1.1.0's exported handler signature is (req: Request) => Promise<Response>;
    // Next.js App Router passes (req, { params }) but mcp-handler ignores the second arg.
    // Cast as any so TS doesn't complain about the documented Next.js signature.
    const res = await (route.POST as (req: Request, ctx: unknown) => Promise<Response>)(
      req,
      { params: Promise.resolve({ transport: 'mcp' }) }
    )
    expect(res.status).toBe(200)
    // Response is either application/json or text/event-stream depending on accept negotiation.
    // Read body as text and assert it contains the server name.
    const body = await res.text()
    expect(body).toContain('viralslidemaker-mcp')
  })
})
