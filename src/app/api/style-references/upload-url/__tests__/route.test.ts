import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

// Phase 74 Plan 03 (REF-02): contract tests for POST /api/style-references/upload-url.
// Mocks `withApiAuth` so we can inject `ctx.userId` + `ctx.supabase.storage`
// without spinning up real auth/rate-limit/admin-client wiring. Mirrors the
// existing src/__tests__/api/with-api-auth.test.ts pattern.

// ---- Mock withApiAuth (pass through, inject ctx) ----
const mockCreateSignedUploadUrl = vi.fn()
const mockSupabaseStorage = {
  from: vi.fn().mockReturnValue({
    createSignedUploadUrl: mockCreateSignedUploadUrl,
  }),
}
const mockCtx = {
  userId: 'user_test_123',
  keyId: 'key_test',
  supabase: { storage: mockSupabaseStorage },
  creditBalance: 10,
}

vi.mock('@/lib/api/with-api-auth', () => ({
  withApiAuth:
    (handler: (req: NextRequest, ctx: typeof mockCtx) => Promise<NextResponse>) =>
    async (req: NextRequest) => {
      // Auth gate: tests pass an `x-test-auth` header to control whether we
      // simulate authenticated vs unauthenticated.
      if (req.headers.get('x-test-auth') === 'no') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
          { status: 401 },
        )
      }
      return handler(req, mockCtx)
    },
}))

// ---- Mock apiSuccess / apiError (pass through to NextResponse) ----
vi.mock('@/lib/api/response', () => ({
  apiSuccess: <T,>(data: T, status = 200) => NextResponse.json(data, { status }),
}))
vi.mock('@/lib/api/errors', () => ({
  apiError: (code: string, message: string, status: number) =>
    NextResponse.json({ error: { code, message } }, { status }),
}))

// Phase 79 Plan 02 Task 2 (LEGAL-01): the route now runs a defense-in-depth
// ToS check via createAdminClient + hasUserAcceptedCurrentTos. The existing
// REF-02 contract tests do not exercise that gate (sibling route-tos.test.ts
// owns it); we mock the helper to return TRUE so the original happy paths
// flow through unchanged.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({ __admin__: true }),
}))
vi.mock('@/lib/legal/audit-log', () => ({
  hasUserAcceptedCurrentTos: vi.fn().mockResolvedValue(true),
}))

describe('Phase 74 Plan 03 (REF-02): POST /api/style-references/upload-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: 'https://supabase.example/storage/v1/object/upload/signed/abc',
        token: 'tok_abc',
      },
      error: null,
    })
    // Restore the storage.from spy reference (vi.clearAllMocks resets spies but
    // the impl on mockSupabaseStorage.from is preserved via the inline object).
    mockSupabaseStorage.from.mockReturnValue({
      createSignedUploadUrl: mockCreateSignedUploadUrl,
    })
  })

  function makeReq(
    body: unknown,
    opts: { auth?: boolean; rawText?: string } = {},
  ): NextRequest {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (opts.auth === false) headers['x-test-auth'] = 'no'
    return new NextRequest('http://localhost:3000/api/style-references/upload-url', {
      method: 'POST',
      headers,
      body: opts.rawText ?? JSON.stringify(body),
    })
  }

  it('Test 1: valid request returns 200 with {uploadUrl, token, method:PUT, headers, path} and path matches userId/uuid-filename', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      makeReq({ filename: 'ref.png', contentType: 'image/png', size_bytes: 1_000_000 }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    // Top-level shape mirrors brand-kit-logos: NextResponse.json({ data: {...} })
    expect(body.data).toBeDefined()
    expect(body.data.uploadUrl).toBe(
      'https://supabase.example/storage/v1/object/upload/signed/abc',
    )
    expect(body.data.token).toBe('tok_abc')
    expect(body.data.method).toBe('PUT')
    expect(body.data.headers).toEqual({ 'Content-Type': 'image/png' })
    // Path: `${userId}/${uuid}-ref.png` — verify shape with regex
    expect(body.data.path).toMatch(
      /^user_test_123\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-ref\.png$/,
    )
  })

  it('Test 2: SVG (image/svg+xml) is rejected with VALIDATION_ERROR / 400', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      makeReq({ filename: 'evil.svg', contentType: 'image/svg+xml', size_bytes: 1000 }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('Test 3: oversized file (>20MB) is rejected with VALIDATION_ERROR + message names cap', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      makeReq({ filename: 'huge.png', contentType: 'image/png', size_bytes: 25_000_000 }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toMatch(/20/)
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('Test 4: unauthenticated request returns 401 (withApiAuth gate)', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      makeReq(
        { filename: 'ref.png', contentType: 'image/png', size_bytes: 1000 },
        { auth: false },
      ),
    )
    expect(res.status).toBe(401)
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('Test 5: malformed JSON body returns 400 + VALIDATION_ERROR', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeReq(undefined, { rawText: '{this is not json' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('Test 6: filename with path traversal chars is sanitized (no .. or / segments outside user folder)', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      makeReq({
        filename: '../etc/passwd',
        contentType: 'image/png',
        size_bytes: 1000,
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    // Expect path to be `user_test_123/<uuid>-.._etc_passwd` (sanitized — no
    // raw `/` or `..` segments leak outside the user folder).
    expect(body.data.path.startsWith('user_test_123/')).toBe(true)
    const tail = body.data.path.slice('user_test_123/'.length)
    // Tail must be `<uuid>-<safeFilename>` where safeFilename has no `/`
    expect(tail).not.toMatch(/\//)
    expect(tail).toContain('.._etc_passwd')
  })

  it('Test 7: when createSignedUploadUrl rejects, route returns 500 + INTERNAL_ERROR', async () => {
    mockCreateSignedUploadUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'storage exploded' },
    })
    const { POST } = await import('../route')
    const res = await POST(
      makeReq({ filename: 'ref.png', contentType: 'image/png', size_bytes: 1000 }),
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('Test 8: route source imports SLIDE_REFERENCES_BUCKET + validateReferenceUpload (single source of truth)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../route.ts'),
      'utf-8',
    )
    expect(src).toMatch(/from ['"]@\/lib\/types\/projects-storage-constants['"]/)
    expect(src).toMatch(/SLIDE_REFERENCES_BUCKET/)
    expect(src).toMatch(/from ['"]@\/lib\/storage\/upload-reference-validation['"]/)
    expect(src).toMatch(/validateReferenceUpload/)
    // Negative: the bucket name must NEVER be hardcoded as a string literal in
    // route.ts (must come from the constant)
    const literalHits = src.match(/['"]slide-references['"]/g) ?? []
    expect(literalHits.length).toBe(0)
  })

  it('Test 9: response shape has NO publicUrl field (bucket is private — public-URL-by-mistake would be a security regression)', async () => {
    const { POST } = await import('../route')
    const res = await POST(
      makeReq({ filename: 'ref.png', contentType: 'image/png', size_bytes: 1000 }),
    )
    const body = await res.json()
    expect(body.data).not.toHaveProperty('publicUrl')
    // Verify storage.from was called with the bucket constant — i.e., the
    // route routed the upload to slide-references, not brand-kit-logos.
    expect(mockSupabaseStorage.from).toHaveBeenCalledWith('slide-references')
  })
})
