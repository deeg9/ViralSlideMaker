import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

describe('updateSession middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls getClaims to revalidate the auth token', async () => {
    const { updateSession } = await import('@/lib/supabase/middleware')
    const mockClient = (createServerClient as ReturnType<typeof vi.fn>)()

    const request = new NextRequest('http://localhost:3000/dashboard')
    await updateSession(request)

    // Should call getClaims (or getUser as fallback) to revalidate token
    const calledClaims = mockClient.auth.getClaims.mock.calls.length > 0
    const calledUser = mockClient.auth.getUser.mock.calls.length > 0
    expect(calledClaims || calledUser).toBe(true)
  })

  it('redirects unauthenticated users from protected paths to /login', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    const mockClient = (createServerClient as ReturnType<typeof vi.fn>)()

    // Simulate no authenticated user
    mockClient.auth.getClaims.mockResolvedValueOnce({ data: { claims: null }, error: null })
    mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    const { updateSession } = await import('@/lib/supabase/middleware')

    const request = new NextRequest('http://localhost:3000/dashboard')
    const response = await updateSession(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows unauthenticated users to access /login', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    const mockClient = (createServerClient as ReturnType<typeof vi.fn>)()

    mockClient.auth.getClaims.mockResolvedValueOnce({ data: { claims: null }, error: null })
    mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    const { updateSession } = await import('@/lib/supabase/middleware')

    const request = new NextRequest('http://localhost:3000/login')
    const response = await updateSession(request)

    // Should NOT redirect -- status 200 (NextResponse.next())
    expect(response.status).not.toBe(307)
  })

  it('allows unauthenticated users to access /signup', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    const mockClient = (createServerClient as ReturnType<typeof vi.fn>)()

    mockClient.auth.getClaims.mockResolvedValueOnce({ data: { claims: null }, error: null })
    mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    const { updateSession } = await import('@/lib/supabase/middleware')

    const request = new NextRequest('http://localhost:3000/signup')
    const response = await updateSession(request)

    expect(response.status).not.toBe(307)
  })

  it('allows unauthenticated users to access the root /', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    const mockClient = (createServerClient as ReturnType<typeof vi.fn>)()

    mockClient.auth.getClaims.mockResolvedValueOnce({ data: { claims: null }, error: null })
    mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    const { updateSession } = await import('@/lib/supabase/middleware')

    const request = new NextRequest('http://localhost:3000/')
    const response = await updateSession(request)

    expect(response.status).not.toBe(307)
  })
})

describe('middleware /api/v1 bypass', () => {
  it('skips updateSession for /api/v1/* routes', async () => {
    const { middleware } = await import('@/middleware')
    const request = new NextRequest('http://localhost:3000/api/v1/templates')
    const response = await middleware(request)
    // Should return undefined (early return, no updateSession called)
    expect(response).toBeUndefined()
  })
})
