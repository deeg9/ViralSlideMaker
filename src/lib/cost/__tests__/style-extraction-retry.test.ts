// Phase 73 (COST-07): tests for the single-retry-on-transient-error policy.
// Load-bearing assertion: withSingleRetry calls the wrapped fn AT MOST TWICE
// for any input. The "transient twice" test would fail if a third call ever
// occurred — guards against retry-compounding cost killer (Pitfalls 4 + 8).

import { describe, it, expect, vi } from 'vitest'
import { isTransientError, withSingleRetry } from '../style-extraction-retry'

describe('Phase 73 (COST-07): isTransientError', () => {
  it('timeout msg → true', () => {
    expect(isTransientError(new Error('Request timeout after 10s'))).toBe(true)
  })

  it('503 status → true', () => {
    expect(isTransientError({ status: 503, message: 'Service Unavailable' })).toBe(true)
  })

  it('429 status → false (rate limit is NOT transient — fail loud)', () => {
    expect(isTransientError({ status: 429, message: 'Too Many Requests' })).toBe(false)
  })

  it('400 status → false', () => {
    expect(isTransientError({ status: 400, message: 'Bad Request' })).toBe(false)
  })

  it('SAFETY block → false', () => {
    expect(isTransientError(new Error('Response blocked: SAFETY'))).toBe(false)
  })

  it('ZodError → false', () => {
    const err = new Error('ZodError: invalid_type at root')
    expect(isTransientError(err)).toBe(false)
  })

  it('unknown error → false (fail-loud default)', () => {
    expect(isTransientError(new Error('something weird happened'))).toBe(false)
  })

  it('null → false', () => {
    expect(isTransientError(null)).toBe(false)
  })

  it('ECONNRESET → true', () => {
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true)
  })

  it('"fetch failed" → true', () => {
    expect(isTransientError(new Error('fetch failed'))).toBe(true)
  })
})

describe('Phase 73 (COST-07): withSingleRetry', () => {
  it('fn succeeds first try → fn called once, returns value', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withSingleRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('fn throws transient then succeeds → fn called twice, returns second value', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Request timeout'))
      .mockResolvedValueOnce('ok-2')
    const result = await withSingleRetry(fn)
    expect(result).toBe('ok-2')
    expect(fn).toHaveBeenCalledTimes(2)
    warnSpy.mockRestore()
  })

  it('fn throws transient twice → fn called EXACTLY twice, throws second error (NOT three calls)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = new Error('Request timeout #1')
    const second = new Error('Request timeout #2')
    const fn = vi.fn().mockRejectedValueOnce(first).mockRejectedValueOnce(second)
    await expect(withSingleRetry(fn)).rejects.toBe(second)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn.mock.calls.length).toBeLessThanOrEqual(2)
    warnSpy.mockRestore()
  })

  it('fn throws permanent → fn called once, throws immediately (NO retry)', async () => {
    const err = { status: 400, message: 'Bad Request' }
    const fn = vi.fn().mockRejectedValueOnce(err)
    await expect(withSingleRetry(fn)).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('fn throws SAFETY block → fn called once, no retry', async () => {
    const err = new Error('Response blocked: SAFETY filter')
    const fn = vi.fn().mockRejectedValueOnce(err)
    await expect(withSingleRetry(fn)).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
