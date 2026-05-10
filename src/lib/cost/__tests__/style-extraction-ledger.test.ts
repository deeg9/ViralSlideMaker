// Phase 73 (COST-06): tests for charge-then-refund extraction ledger helpers.
// Mocks deductCreditAdmin (composition target) + the Supabase admin .from() chain.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Hoisted mock for the underlying credit-deduction RPC.
const { mockDeduct } = vi.hoisted(() => ({
  mockDeduct: vi.fn<(...args: unknown[]) => Promise<boolean>>(),
}))

vi.mock('@/lib/credits/check-credits', () => ({
  deductCreditAdmin: mockDeduct,
}))

import {
  chargeExtractionCredit,
  refundExtractionCredit,
  EXTRACTION_CHARGE_TYPE,
} from '../style-extraction-ledger'

interface InsertCall {
  user_id: string
  type: string
  amount: number
  description: string
  reference_id: string
}

function makeFakeAdmin(insertResult: { error: Error | null } = { error: null }) {
  const insertCalls: InsertCall[] = []
  const insert = vi.fn(async (row: InsertCall) => {
    insertCalls.push(row)
    return { data: null, error: insertResult.error }
  })
  const from = vi.fn(() => ({ insert }))
  return { from, insert, insertCalls }
}

beforeEach(() => {
  mockDeduct.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Phase 73 (COST-06): chargeExtractionCredit', () => {
  it('happy path → calls deductCreditAdmin with the right args, returns true', async () => {
    mockDeduct.mockResolvedValueOnce(true)
    const admin = makeFakeAdmin()
    const result = await chargeExtractionCredit(
      admin as unknown as SupabaseClient,
      'user-abc',
      'project-xyz',
    )
    expect(result).toBe(true)
    expect(mockDeduct).toHaveBeenCalledOnce()
    expect(mockDeduct).toHaveBeenCalledWith(
      admin,
      'user-abc',
      EXTRACTION_CHARGE_TYPE,
      'Style-from-reference vision extraction',
      'project-xyz',
      1,
    )
  })

  it('insufficient balance → returns false', async () => {
    mockDeduct.mockResolvedValueOnce(false)
    const admin = makeFakeAdmin()
    const result = await chargeExtractionCredit(
      admin as unknown as SupabaseClient,
      'user-abc',
      'project-xyz',
    )
    expect(result).toBe(false)
  })

  it('propagates type "gemini_vision_extract_style" AND amount 1 into deductCreditAdmin', async () => {
    mockDeduct.mockResolvedValueOnce(true)
    const admin = makeFakeAdmin()
    await chargeExtractionCredit(admin as unknown as SupabaseClient, 'u', 'p')
    const args = mockDeduct.mock.calls[0]
    expect(args[2]).toBe('gemini_vision_extract_style')
    expect(args[5]).toBe(1)
  })
})

describe('Phase 73 (COST-06): refundExtractionCredit', () => {
  it('inserts a refund row with correct user_id, amount=1, reason in description, reference_id', async () => {
    const admin = makeFakeAdmin()
    await refundExtractionCredit(
      admin as unknown as SupabaseClient,
      'user-abc',
      'project-xyz',
      'gemini_5xx',
    )
    expect(admin.from).toHaveBeenCalledWith('credit_transactions')
    expect(admin.insert).toHaveBeenCalledOnce()
    const row = admin.insertCalls[0]
    expect(row).toMatchObject({
      user_id: 'user-abc',
      type: 'refund',
      amount: 1,
      reference_id: 'project-xyz',
    })
    expect(row.description).toBe('Refund: extract-style gemini_5xx')
  })

  it('insert errors → resolves (does NOT throw); console.warn called', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const admin = makeFakeAdmin({ error: new Error('insert failed') })
    await expect(
      refundExtractionCredit(
        admin as unknown as SupabaseClient,
        'user-abc',
        'project-xyz',
        'reason',
      ),
    ).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('insert throws → resolves (does NOT propagate); console.warn called', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const insert = vi.fn(async () => {
      throw new Error('network')
    })
    const admin = { from: vi.fn(() => ({ insert })) }
    await expect(
      refundExtractionCredit(
        admin as unknown as SupabaseClient,
        'u',
        'p',
        'r',
      ),
    ).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
