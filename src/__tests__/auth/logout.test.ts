import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createServerClient } from '@supabase/ssr'

describe('logout action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.auth.signOut()', async () => {
    const { logout } = await import('@/app/(auth)/login/actions')
    const mockClient = (createServerClient as ReturnType<typeof vi.fn>)()

    try {
      await logout()
    } catch {
      // redirect throws in test context
    }

    expect(mockClient.auth.signOut).toHaveBeenCalled()
  })

  it('redirects to /login after signing out', async () => {
    const { redirect } = await import('next/navigation')
    const { logout } = await import('@/app/(auth)/login/actions')

    try {
      await logout()
    } catch {
      // redirect throws in test context
    }

    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
