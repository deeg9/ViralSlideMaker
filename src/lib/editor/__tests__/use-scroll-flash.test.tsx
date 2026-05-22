/**
 * Unit coverage for useScrollFlash — the right-rail click-to-focus hook.
 *
 * Contract:
 *   - A falsy nonce (undefined / 0) is inert: no scrollIntoView, no flash.
 *   - A truthy nonce scrolls the ref into view and sets `flashing` true.
 *   - `flashing` clears itself ~1s later.
 *   - Re-rendering with the SAME nonce does nothing (no re-scroll / re-flash).
 *   - Re-rendering with an INCREMENTED nonce re-fires both.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useScrollFlash } from '../use-scroll-flash'

function Probe({ nonce }: { nonce: number | undefined }) {
  const { ref, flashing } = useScrollFlash<HTMLDivElement>(nonce)
  return <div ref={ref} data-testid="probe" data-flashing={String(flashing)} />
}

describe('useScrollFlash', () => {
  let scrollSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    scrollSpy = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
  })

  afterEach(() => {
    scrollSpy.mockRestore()
    vi.useRealTimers()
  })

  it('is inert when the nonce is undefined', () => {
    const { getByTestId } = render(<Probe nonce={undefined} />)
    expect(getByTestId('probe').dataset.flashing).toBe('false')
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('is inert when the nonce is 0', () => {
    const { getByTestId } = render(<Probe nonce={0} />)
    expect(getByTestId('probe').dataset.flashing).toBe('false')
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it('scrolls into view and flashes when the nonce is truthy', () => {
    const { getByTestId } = render(<Probe nonce={1} />)
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(getByTestId('probe').dataset.flashing).toBe('true')
  })

  it('clears the flash after ~1s', () => {
    const { getByTestId } = render(<Probe nonce={1} />)
    expect(getByTestId('probe').dataset.flashing).toBe('true')
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(getByTestId('probe').dataset.flashing).toBe('false')
  })

  it('does not re-fire when re-rendered with the same nonce', () => {
    const { getByTestId, rerender } = render(<Probe nonce={2} />)
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    rerender(<Probe nonce={2} />)
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(getByTestId('probe').dataset.flashing).toBe('false')
  })

  it('re-fires when the nonce increments', () => {
    const { getByTestId, rerender } = render(<Probe nonce={1} />)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(getByTestId('probe').dataset.flashing).toBe('false')

    rerender(<Probe nonce={2} />)
    expect(scrollSpy).toHaveBeenCalledTimes(2)
    expect(getByTestId('probe').dataset.flashing).toBe('true')
  })
})
