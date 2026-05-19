import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

// Phase 87 Plan 02 Task 9 (WIRE-02): contract tests for the POST
// /api/v1/carousel templateId validation. The handler now rejects an unknown
// templateId (neither a code id nor a DB id) with HTTP 400 via the DB-aware
// isKnownTemplateId. The registry is NOT mocked — isKnownTemplateId runs REAL
// against injected fixture rows. The heavy boundaries (withApiAuth, the
// carousel service, credit helpers) are stubbed so the test exercises ONLY
// the validation branch.

// ---- Stub withApiAuth: pass through to the inner handler with a fake ctx ----
vi.mock('@/lib/api/with-api-auth', () => ({
  withApiAuth:
    (fn: (req: Request, ctx: unknown) => Promise<NextResponse>) =>
    (req: Request) =>
      fn(req, {
        userId: 'u1',
        keyId: 'k1',
        supabase: {
          from: vi.fn().mockReturnValue({
            insert: vi.fn().mockResolvedValue({ error: null }),
          }),
        },
        creditBalance: 5,
      }),
}))

// ---- apiSuccess / apiError pass through to NextResponse ----
vi.mock('@/lib/api/response', () => ({
  apiSuccess: <T,>(data: T, status = 200) => NextResponse.json(data, { status }),
}))
vi.mock('@/lib/api/errors', () => ({
  apiError: (code: string, message: string, status: number) =>
    NextResponse.json({ error: { code, message } }, { status }),
}))

// ---- Stub the carousel service: the happy path does no real work ----
vi.mock('@/lib/services/carousel', () => ({
  generateCarousel: vi.fn().mockResolvedValue({ projectId: 'p1', slideCount: 7 }),
}))

// ---- Stub credit helpers so the happy path reaches generateCarousel ----
vi.mock('@/lib/credits/check-credits', () => ({
  deductCreditAdmin: vi.fn().mockResolvedValue(true),
  getUserTier: vi.fn().mockResolvedValue('free'),
  checkProjectLimit: vi.fn().mockResolvedValue(true),
  FREE_TIER_PROJECT_LIMIT: 3,
}))

// Import AFTER mocks. The registry is intentionally NOT mocked.
import { POST } from '../route'
import {
  __setDbTemplateFetcher,
  __resetDbTemplateRegistry,
} from '@/lib/render/templates/registry'
import { TEMPLATE_IDS } from '@/lib/render/templates/index'
import type { DbTemplateRow } from '@/lib/render/templates/db-template-row'

function makeDbRow(id: string): DbTemplateRow {
  return {
    id,
    name: `DB ${id}`,
    category: 'news',
    flat_style: { textColor: '#111111', backgroundColor: '#eeeeee' },
    layout_recipe: null,
    preview: null,
    created_by: null,
    created_at: '2026-05-19T00:00:00Z',
    updated_at: '2026-05-19T00:00:00Z',
  }
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('https://example.com/api/v1/carousel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  __resetDbTemplateRegistry()
})

describe('WIRE-02 — POST /api/v1/carousel templateId validation', () => {
  it('rejects an unknown templateId with HTTP 400', async () => {
    // No DB rows injected — the id is neither a code nor a DB template.
    __setDbTemplateFetcher(async () => [])
    const res = await POST(makeRequest({
      topic: 'hello world',
      templateId: 'definitely-not-a-template',
    }))
    expect(res.status).toBe(400)
  })

  it('does NOT 400 a known code templateId — reaches the carousel service', async () => {
    __setDbTemplateFetcher(async () => [])
    const res = await POST(makeRequest({
      topic: 'hello world',
      templateId: TEMPLATE_IDS[0],
    }))
    expect(res.status).not.toBe(400)
    expect(res.status).toBe(200)
  })

  it('accepts a known DB templateId injected via the registry seam', async () => {
    __setDbTemplateFetcher(async () => [makeDbRow('db-ok')])
    const res = await POST(makeRequest({
      topic: 'hello world',
      templateId: 'db-ok',
    }))
    expect(res.status).not.toBe(400)
    expect(res.status).toBe(200)
  })
})
