import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock redirect to capture calls (Next.js redirect throws NEXT_REDIRECT)
const mockRedirect = vi.fn().mockImplementation(() => {
  throw new Error('NEXT_REDIRECT')
})

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

// Mock Stripe
const mockCheckoutSessionsCreate = vi.fn()
const mockCustomersCreate = vi.fn()
const mockBillingPortalSessionsCreate = vi.fn()

vi.mock('@/lib/stripe/client', () => ({
  getStripeServer: () => ({
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    customers: { create: mockCustomersCreate },
    billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
  }),
}))

vi.mock('@/lib/stripe/config', () => ({
  STRIPE_PRICES: {
    plus_monthly: 'price_plus_test',
    pro_monthly: 'price_pro_test',
    credit_pack_10: 'price_credits_test',
  },
}))

// Mock Supabase server client
const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

// Mock Supabase admin client
const mockAdminFrom = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
}))

// Set env var
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

import {
  createCheckoutSession,
  createPortalSession,
  createCreditPackCheckout,
} from '@/app/(dashboard)/settings/subscription/actions'

function setupAuthenticatedUser(overrides?: { id?: string; email?: string }) {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: overrides?.id ?? 'user_test_123',
        email: overrides?.email ?? 'test@example.com',
      },
    },
  })
}

function setupUnauthenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: null } })
}

function setupAdminWithCustomer(customerId: string | null) {
  const mockEq = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: customerId ? { stripe_customer_id: customerId } : { stripe_customer_id: null },
    }),
  })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

  mockAdminFrom.mockImplementation(() => ({
    select: mockSelect,
    update: mockUpdate,
  }))

  return { mockSelect, mockEq, mockUpdate, mockUpdateEq }
}

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates checkout session with existing stripe_customer_id and redirects', async () => {
    setupAuthenticatedUser()
    setupAdminWithCustomer('cus_existing')
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    })

    await expect(createCheckoutSession('price_plus_test')).rejects.toThrow('NEXT_REDIRECT')

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing',
        mode: 'subscription',
        line_items: [{ price: 'price_plus_test', quantity: 1 }],
        metadata: { supabase_user_id: 'user_test_123' },
      })
    )
    expect(mockRedirect).toHaveBeenCalledWith('https://checkout.stripe.com/test')
  })

  it('creates Stripe customer first when stripe_customer_id is null', async () => {
    setupAuthenticatedUser()
    setupAdminWithCustomer(null)
    mockCustomersCreate.mockResolvedValue({ id: 'cus_new_123' })
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/test2',
    })

    await expect(createCheckoutSession('price_pro_test')).rejects.toThrow('NEXT_REDIRECT')

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'test@example.com',
      metadata: { supabase_user_id: 'user_test_123' },
    })

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_new_123',
        mode: 'subscription',
      })
    )
  })

  it('throws Not authenticated for unauthenticated user', async () => {
    setupUnauthenticatedUser()

    await expect(createCheckoutSession('price_plus_test')).rejects.toThrow('Not authenticated')
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled()
  })
})

describe('createPortalSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates portal session and redirects for user with existing customer', async () => {
    setupAuthenticatedUser()
    setupAdminWithCustomer('cus_existing')
    mockBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/test',
    })

    await expect(createPortalSession()).rejects.toThrow('NEXT_REDIRECT')

    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_existing',
      return_url: 'http://localhost:3000/settings/subscription',
    })
    expect(mockRedirect).toHaveBeenCalledWith('https://billing.stripe.com/test')
  })

  it('throws No active subscription found when stripe_customer_id is null', async () => {
    setupAuthenticatedUser()
    setupAdminWithCustomer(null)

    await expect(createPortalSession()).rejects.toThrow('No active subscription found')
    expect(mockBillingPortalSessionsCreate).not.toHaveBeenCalled()
  })
})

describe('createCreditPackCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates payment-mode checkout session with credit_pack_10 price', async () => {
    setupAuthenticatedUser()
    setupAdminWithCustomer('cus_existing')
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/credits',
    })

    await expect(createCreditPackCheckout()).rejects.toThrow('NEXT_REDIRECT')

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing',
        mode: 'payment',
        line_items: [{ price: 'price_credits_test', quantity: 1 }],
        metadata: { supabase_user_id: 'user_test_123' },
      })
    )
    expect(mockRedirect).toHaveBeenCalledWith('https://checkout.stripe.com/credits')
  })
})
