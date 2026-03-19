import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createServerClient } from '@supabase/ssr'

// We need to import the module under test after mocks are set up
// The setup.ts file handles the @supabase/ssr mock

describe('signup action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.auth.signUp with email and password from FormData', async () => {
    // Import the signup action
    const { signup } = await import('@/app/(auth)/login/actions')

    // Create FormData with email and password
    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'password123')

    // Get the mock client instance
    const mockClient = (createServerClient as ReturnType<typeof vi.fn>)()

    // Call signup (will redirect which throws in test context)
    try {
      await signup(formData)
    } catch {
      // redirect() throws in test context -- that is expected
    }

    expect(mockClient.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })

  it('calls signUp and redirects to dashboard on success', async () => {
    const { redirect } = await import('next/navigation')
    const { signup } = await import('@/app/(auth)/login/actions')

    const formData = new FormData()
    formData.append('email', 'test@example.com')
    formData.append('password', 'password123')

    try {
      await signup(formData)
    } catch {
      // redirect throws
    }

    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects to /signup?error on signUp error', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    const mockClient = (createServerClient as ReturnType<typeof vi.fn>)()
    mockClient.auth.signUp.mockResolvedValueOnce({ data: null, error: { message: 'Email exists' } })

    const { redirect } = await import('next/navigation')
    const { signup } = await import('@/app/(auth)/login/actions')

    const formData = new FormData()
    formData.append('email', 'existing@example.com')
    formData.append('password', 'password123')

    try {
      await signup(formData)
    } catch {
      // redirect throws
    }

    expect(redirect).toHaveBeenCalledWith('/signup?error=Could not create account')
  })
})
