import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared mock objects so test and route see the same instances
const mockConstructEvent = vi.fn()
const mockStripe = { webhooks: { constructEvent: mockConstructEvent } }

const mockFrom = vi.fn()
const mockAdmin = { from: mockFrom }

vi.mock('@/lib/stripe/client', () => ({
  getStripeServer: () => mockStripe,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockAdmin,
}))

vi.mock('@/lib/stripe/sync-subscription', () => ({
  handleStripeEvent: vi.fn(),
}))

import { POST } from '@/app/api/webhooks/stripe/route'
import { handleStripeEvent } from '@/lib/stripe/sync-subscription'

function makeRequest(body: string, signature?: string) {
  const headers: Record<string, string> = {}
  if (signature !== undefined) {
    headers['stripe-signature'] = signature
  }
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers,
  })
}

describe('Stripe Webhook Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 with invalid signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await POST(makeRequest('{}', 'sig_test'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid signature')
  })

  it('returns 200 for duplicate event without calling handleStripeEvent', async () => {
    const event = { id: 'evt_dup', type: 'invoice.paid', data: { object: {} } }
    mockConstructEvent.mockReturnValue(event)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'stripe_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { event_id: 'evt_dup' } }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await POST(makeRequest('{}', 'sig_test'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(handleStripeEvent).not.toHaveBeenCalled()
  })

  it('processes new event: inserts into stripe_events and calls handleStripeEvent', async () => {
    const event = { id: 'evt_new', type: 'checkout.session.completed', data: { object: {} } }
    mockConstructEvent.mockReturnValue(event)

    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    let callCount = 0

    mockFrom.mockImplementation((table: string) => {
      if (table === 'stripe_events') {
        callCount++
        // First call is select (idempotency check), second is insert
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }
        }
        return { insert: mockInsert }
      }
      return {}
    })

    vi.mocked(handleStripeEvent).mockResolvedValue(undefined)

    const res = await POST(makeRequest('{}', 'sig_test'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)

    // Verify event was inserted
    expect(mockInsert).toHaveBeenCalledWith({
      event_id: 'evt_new',
      event_type: 'checkout.session.completed',
    })

    // Verify handler was called
    expect(handleStripeEvent).toHaveBeenCalledWith(event, mockAdmin)
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = makeRequest('{}')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Missing signature')
  })
})
