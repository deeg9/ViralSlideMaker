import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Phase 86 (ADMIN-01, ADMIN-02) — POST /api/admin/templates contract tests.
 *
 * `requireAdmin` is NOT mocked — the real helper runs against a vi.stubEnv'd
 * ADMIN_USER_IDS, so the admin gate is exercised end to end. Everything heavy
 * (Supabase, recipe extraction, Satori render, registry) is mocked.
 */

const ADMIN_ID = 'admin-user-1'

// vi.mock factories are hoisted above const declarations — the shared mock fns
// must be created inside vi.hoisted() so they exist when the factories run.
const {
  mockGetUser,
  mockInsert,
  mockIdLookupMaybeSingle,
  mockUpload,
  mockRemove,
  mockGetPublicUrl,
  mockGetProject,
  mockExtract,
  mockRender,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockInsert: vi.fn(),
  mockIdLookupMaybeSingle: vi.fn(),
  mockUpload: vi.fn(),
  mockRemove: vi.fn(),
  mockGetPublicUrl: vi.fn(),
  mockGetProject: vi.fn(),
  mockExtract: vi.fn(),
  mockRender: vi.fn(),
}))

// ---- Mock session-aware client (drives requireAdmin via auth.getUser) ----
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))

// ---- Mock service-role admin client ----
function makeAdminClient() {
  return {
    from: vi.fn().mockImplementation(() => ({
      // id collision lookup: .select('id').eq('id', id).maybeSingle()
      select: vi.fn().mockImplementation((cols: string) => {
        if (cols === 'id') {
          return { eq: vi.fn().mockReturnValue({ maybeSingle: mockIdLookupMaybeSingle }) }
        }
        // insert(...).select('id').single()
        return { single: vi.fn().mockImplementation(() => mockInsert.mock.results.at(-1)?.value) }
      }),
      insert: vi.fn().mockImplementation((row: unknown) => {
        const result = mockInsert(row)
        return { select: vi.fn().mockReturnValue({ single: async () => result }) }
      }),
    })),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        remove: mockRemove,
      }),
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => makeAdminClient()),
}))

// ---- Mock the source-project loader ----
vi.mock('@/lib/services/projects', () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
}))

// ---- Mock recipe extraction + render + registry ----
vi.mock('@/lib/ai/layout-recipe-extract', () => ({
  extractLayoutRecipe: (...args: unknown[]) => mockExtract(...args),
}))
vi.mock('@/lib/render/preview-render', () => ({
  renderCoverPreviewPng: (...args: unknown[]) => mockRender(...args),
}))
vi.mock('@/lib/render/templates/registry', () => ({
  resolveTemplate: vi.fn().mockResolvedValue({ id: 'highlight-bar', name: 'Highlight Bar' }),
}))

import { POST } from '@/app/api/admin/templates/route'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ADMIN_USER_IDS', ADMIN_ID)
    // Default: an admin session.
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID, email: 'a@x.com' } } })
    mockGetProject.mockResolvedValue({
      slide_data: [
        { hook_text: 'Cover', body_text: 'B', is_cta: false },
        { hook_text: 'Body', body_text: 'B', is_cta: false },
      ],
      template_id: 'highlight-bar',
      topic: 'sleep',
    })
    mockExtract.mockReturnValue({ recipe: { schema_version: 1, roles: {} }, flatStyle: { text_align: 'left' } })
    mockRender.mockResolvedValue(Buffer.from('png'))
    mockIdLookupMaybeSingle.mockResolvedValue({ data: null }) // no DB collision
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://s/template-previews/p.png' } })
    mockInsert.mockReturnValue({ error: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ADMIN-01: a non-admin session is blocked with 403', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'not-admin', email: 'n@x.com' } } })
    const res = await POST(postRequest({ projectId: 'p1', name: 'My T', category: 'news' }))
    expect(res.status).toBe(403)
  })

  it('ADMIN-01: a request with no session is blocked with 403', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(postRequest({ projectId: 'p1', name: 'My T', category: 'news' }))
    expect(res.status).toBe(403)
  })

  it('rejects an out-of-enum category with 400 (closed-enum invariant)', async () => {
    const res = await POST(postRequest({ projectId: 'p1', name: 'My T', category: 'sports' }))
    expect(res.status).toBe(400)
  })

  it('rejects an empty name with 400', async () => {
    const res = await POST(postRequest({ projectId: 'p1', name: '   ', category: 'news' }))
    expect(res.status).toBe(400)
  })

  it('happy path: returns 201 and inserts the full row', async () => {
    const res = await POST(postRequest({ projectId: 'p1', name: 'Bold News', category: 'news' }))
    expect(res.status).toBe(201)
    expect(mockExtract).toHaveBeenCalledTimes(1)
    expect(mockRender).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.layout_recipe).toEqual({ schema_version: 1, roles: {} })
    expect(inserted.flat_style).toEqual({ text_align: 'left' })
    expect(inserted.created_by).toBe(ADMIN_ID)
    expect(inserted.category).toBe('news')
    expect(typeof inserted.preview).toBe('string')
    expect((inserted.preview as string).length).toBeGreaterThan(0)
  })

  it('appends a suffix when the slug id collides with an existing DB row', async () => {
    // First lookup: the bare slug exists. Second lookup: the suffixed id is free.
    mockIdLookupMaybeSingle
      .mockResolvedValueOnce({ data: { id: 'bold-news' } })
      .mockResolvedValue({ data: null })
    const res = await POST(postRequest({ projectId: 'p1', name: 'Bold News', category: 'news' }))
    expect(res.status).toBe(201)
    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.id).not.toBe('bold-news')
    expect(inserted.id).toMatch(/^bold-news-[a-z0-9]{6}$/)
  })
})
