import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// Mock stripe client
const mockRetrieve = vi.fn()
const mockListLineItems = vi.fn()
vi.mock('@/lib/stripe/client', () => ({
  getStripeServer: vi.fn(() => ({
    subscriptions: { retrieve: mockRetrieve },
    checkout: { sessions: { listLineItems: mockListLineItems } },
  })),
}))

// Mock config with stable test values
vi.mock('@/lib/stripe/config', () => ({
  STRIPE_PRICES: {
    plus_monthly: 'price_plus',
    pro_monthly: 'price_pro',
    credit_pack_10: 'price_credits',
  },
  tierFromPriceId: (priceId: string) => {
    if (priceId === 'price_plus') return 'plus'
    if (priceId === 'price_pro') return 'pro'
    return null
  },
  CREDIT_PACK_AMOUNTS: {
    price_credits: 10,
  },
}))

import { handleStripeEvent } from '@/lib/stripe/sync-subscription'
import { TIER_CREDITS } from '@/lib/credits/types'

// Helper to create a chainable mock admin client
function createMockAdmin() {
  const insertFn = vi.fn().mockResolvedValue({ error: null })
  const updateFn = vi.fn()
  const selectFn = vi.fn()

  // Track calls per table
  const tables: Record<string, { insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> }> = {}

  function getTable(name: string) {
    if (!tables[name]) {
      const tInsert = vi.fn().mockResolvedValue({ error: null })
      const tUpdate = vi.fn()
      const tUpsert = vi.fn().mockResolvedValue({ error: null })
      const tSelect = vi.fn()
      tables[name] = { insert: tInsert, update: tUpdate, upsert: tUpsert, select: tSelect }
    }
    return tables[name]
  }

  const from = vi.fn((table: string) => {
    const t = getTable(table)
    const mockSingleResult = vi.fn().mockResolvedValue(
      t === tables['subscriptions']
        ? { data: { user_id: 'user_123', tier: 'pro' } }
        : { data: null }
    )
    // Create a chainable eq that supports multiple .eq() calls
    const terminalResult = {
      single: mockSingleResult,
      maybeSingle: mockSingleResult,
    }
    const chainableEq: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue({
      ...terminalResult,
      eq: vi.fn().mockReturnValue({
        ...terminalResult,
        eq: vi.fn().mockResolvedValue({ count: 0 }),
      }),
    })
    return {
      insert: t.insert,
      upsert: (...args: unknown[]) => {
        t.upsert(...args)
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        }
      },
      update: (...args: unknown[]) => {
        t.update(...args)
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        }
      },
      select: (...args: unknown[]) => {
        t.select(...args)
        return {
          eq: chainableEq,
        }
      },
    }
  })

  return {
    from,
    getTable,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('sync-subscription handleStripeEvent', () => {
  let admin: ReturnType<typeof createMockAdmin>

  beforeEach(() => {
    vi.clearAllMocks()
    admin = createMockAdmin()
  })

  describe('checkout.session.completed (subscription mode)', () => {
    it('updates subscriptions row with stripe IDs and tier', async () => {
      mockRetrieve.mockResolvedValue({
        items: { data: [{ price: { id: 'price_pro' } }] },
        start_date: 1700000000,
        cancel_at: null,
      })

      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            metadata: { supabase_user_id: 'user_123' },
            customer: 'cus_abc',
            subscription: 'sub_xyz',
          },
        },
      } as unknown as Stripe.Event

      await handleStripeEvent(event, admin)

      // Should retrieve the subscription
      expect(mockRetrieve).toHaveBeenCalledWith('sub_xyz')

      // Should upsert subscriptions table
      const subTable = admin.getTable('subscriptions')
      expect(subTable.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_123',
          stripe_customer_id: 'cus_abc',
          stripe_subscription_id: 'sub_xyz',
          tier: 'pro',
          status: 'active',
        }),
        expect.objectContaining({ onConflict: 'user_id' })
      )
    })
  })

  describe('checkout.session.completed (payment mode)', () => {
    it('inserts credit_pack_purchase transaction', async () => {
      mockListLineItems.mockResolvedValue({
        data: [{ price: { id: 'price_credits' } }],
      })

      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'payment',
            metadata: { supabase_user_id: 'user_123' },
            id: 'cs_session_123',
          },
        },
      } as unknown as Stripe.Event

      await handleStripeEvent(event, admin)

      expect(mockListLineItems).toHaveBeenCalledWith('cs_session_123')

      const txTable = admin.getTable('credit_transactions')
      expect(txTable.insert).toHaveBeenCalledWith({
        user_id: 'user_123',
        type: 'credit_pack_purchase',
        amount: 10,
        description: 'Credit pack purchase',
        reference_id: 'cs_session_123',
      })
    })
  })

  describe('customer.subscription.updated', () => {
    it('updates tier and period dates', async () => {
      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_xyz',
            items: { data: [{ price: { id: 'price_plus' } }] },
            status: 'active',
            start_date: 1700000000,
            cancel_at: null,
            cancel_at_period_end: false,
          },
        },
      } as unknown as Stripe.Event

      await handleStripeEvent(event, admin)

      const subTable = admin.getTable('subscriptions')
      expect(subTable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'plus',
          status: 'active',
          cancel_at_period_end: false,
        })
      )
    })
  })

  describe('customer.subscription.deleted', () => {
    it('sets tier to free and status to canceled', async () => {
      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_xyz',
          },
        },
      } as unknown as Stripe.Event

      await handleStripeEvent(event, admin)

      const subTable = admin.getTable('subscriptions')
      expect(subTable.update).toHaveBeenCalledWith({
        tier: 'free',
        status: 'canceled',
        stripe_subscription_id: null,
      })
    })
  })

  describe('invoice.paid', () => {
    it('inserts subscription_grant credit transaction with correct tier amount', async () => {
      const event = {
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_123',
            parent: {
              type: 'subscription_details',
              subscription_details: {
                subscription: 'sub_xyz',
              },
            },
          },
        },
      } as unknown as Stripe.Event

      await handleStripeEvent(event, admin)

      const txTable = admin.getTable('credit_transactions')
      expect(txTable.insert).toHaveBeenCalledWith({
        user_id: 'user_123',
        type: 'subscription_grant',
        amount: TIER_CREDITS['pro'], // admin mock returns tier: 'pro'
        description: 'Monthly credit grant (Pro tier)',
        reference_id: 'inv_123',
      })
    })

    it('skips non-subscription invoices', async () => {
      const event = {
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_456',
            parent: null,
          },
        },
      } as unknown as Stripe.Event

      await handleStripeEvent(event, admin)

      const txTable = admin.getTable('credit_transactions')
      expect(txTable.insert).not.toHaveBeenCalled()
    })
  })

  describe('invoice.payment_failed', () => {
    it('sets status to past_due', async () => {
      const event = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_789',
            parent: {
              type: 'subscription_details',
              subscription_details: {
                subscription: 'sub_xyz',
              },
            },
          },
        },
      } as unknown as Stripe.Event

      await handleStripeEvent(event, admin)

      const subTable = admin.getTable('subscriptions')
      expect(subTable.update).toHaveBeenCalledWith({ status: 'past_due' })
    })
  })
})
