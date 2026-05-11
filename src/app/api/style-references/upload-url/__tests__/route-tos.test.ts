// Phase 79 Plan 02 Task 2 (LEGAL-01):
// Server-side ToS enforcement on /api/style-references/upload-url.
// Defense-in-depth alongside the client clickwrap modal: even if a caller
// bypasses the UI (CLI scripts, direct API hits, malicious browser
// extensions), the route MUST refuse to mint a signed upload URL until the
// caller has accepted the current ToS version.
//
// What this pins:
//   T1: When `hasUserAcceptedCurrentTos` returns FALSE, the route returns
//       a 403 with `{ error: { code: 'TOS_REQUIRED' } }` and DOES NOT call
//       `createSignedUploadUrl`
//   T2: When `hasUserAcceptedCurrentTos` returns TRUE, the route falls
//       through to the existing happy path (200 + signed URL payload)
//   T3: The audit-log lookup is invoked with (admin, userId, current ToS
//       version) — proving the route routes the check through the
//       Plan 79-01 helper and the Plan 79-01 version constant
//   T4: The route source imports `hasUserAcceptedCurrentTos` and
//       `STYLE_FROM_REFERENCE_TOS_VERSION` from `@/lib/legal/*` — single
//       source of truth, no inline literals

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

// ---- Mocks ----
const mockHasAccepted = vi.fn()
const mockCreateSignedUploadUrl = vi.fn()
const mockAdminClient = { __admin__: true }

const mockCtx = {
  userId: 'user_test_123',
  keyId: 'key_test',
  supabase: {
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
      }),
    },
  },
  creditBalance: 10,
}

vi.mock('@/lib/api/with-api-auth', () => ({
  withApiAuth:
    (handler: (req: NextRequest, ctx: typeof mockCtx) => Promise<NextResponse>) =>
    async (req: NextRequest) => {
      if (req.headers.get('x-test-auth') === 'no') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
          { status: 401 },
        )
      }
      return handler(req, mockCtx)
    },
}))

vi.mock('@/lib/api/response', () => ({
  apiSuccess: <T,>(data: T, status = 200) => NextResponse.json(data, { status }),
}))
vi.mock('@/lib/api/errors', () => ({
  apiError: (code: string, message: string, status: number) =>
    NextResponse.json({ error: { code, message } }, { status }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
}))

vi.mock('@/lib/legal/audit-log', () => ({
  hasUserAcceptedCurrentTos: mockHasAccepted,
}))

import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'

describe('Phase 79 Plan 02 Task 2: POST /api/style-references/upload-url ToS enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: 'https://supabase.example/storage/v1/object/upload/signed/abc',
        token: 'tok_abc',
      },
      error: null,
    })
    mockCtx.supabase.storage.from.mockReturnValue({
      createSignedUploadUrl: mockCreateSignedUploadUrl,
    })
  })

  function makeReq(body: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/style-references/upload-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('Test T1: ToS not accepted → 403 TOS_REQUIRED, no signed URL minted', async () => {
    mockHasAccepted.mockResolvedValueOnce(false)
    const { POST } = await import('../route')

    const res = await POST(
      makeReq({ filename: 'ref.png', contentType: 'image/png', size_bytes: 1000 }),
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('TOS_REQUIRED')
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('Test T2: ToS accepted → 200 + signed URL payload (existing happy path preserved)', async () => {
    mockHasAccepted.mockResolvedValueOnce(true)
    const { POST } = await import('../route')

    const res = await POST(
      makeReq({ filename: 'ref.png', contentType: 'image/png', size_bytes: 1000 }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.uploadUrl).toBe(
      'https://supabase.example/storage/v1/object/upload/signed/abc',
    )
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledTimes(1)
  })

  it('Test T3: audit-log lookup invoked with (admin, userId, currentVersion)', async () => {
    mockHasAccepted.mockResolvedValueOnce(true)
    const { POST } = await import('../route')

    await POST(
      makeReq({ filename: 'ref.png', contentType: 'image/png', size_bytes: 1000 }),
    )

    expect(mockHasAccepted).toHaveBeenCalledTimes(1)
    expect(mockHasAccepted).toHaveBeenCalledWith(
      mockAdminClient,
      'user_test_123',
      STYLE_FROM_REFERENCE_TOS_VERSION,
    )
  })

  it('Test T4: route source imports hasUserAcceptedCurrentTos + version constant from @/lib/legal/*', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../route.ts'), 'utf-8')
    expect(src).toMatch(/from ['"]@\/lib\/legal\/audit-log['"]/)
    expect(src).toMatch(/hasUserAcceptedCurrentTos/)
    expect(src).toMatch(/from ['"]@\/lib\/legal\/tos-version['"]/)
    expect(src).toMatch(/STYLE_FROM_REFERENCE_TOS_VERSION/)
    // No inline version literal — single source of truth lives in tos-version.ts
    expect(src).not.toMatch(/['"]2026-05-10-v1['"]/)
  })
})
