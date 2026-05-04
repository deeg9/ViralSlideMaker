/**
 * Phase 70 Plan 04 (CARD-05): DecorationEffects sub-component tests.
 *
 * Drop shadow + opacity slider. WR-01 contract is the critical invariant:
 *   UI shows 0-100% but storage is 0..1. Renderer reads d.opacity directly
 *   as CSS opacity (NEVER divides by 100).
 *
 * Sliders use onChangeEnd / mouseup ONLY — never per-tick (KBD-09).
 * Color picker uses 300ms debounced commit (mirrors Task 2 fill picker).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { DecorationEffects } from '../decoration-card-effects'
import type { ShapeDecoration } from '@/lib/types/decoration'

const baseShape: ShapeDecoration = {
  id: 'd1',
  kind: 'shape',
  shapeKind: 'rect',
  fill: '#FF0000',
  position: { x: 0, y: 0, width: 10, height: 10 },
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Phase 70 Plan 04 — DecorationEffects (CARD-05)', () => {
  describe('Drop shadow', () => {
    it('shadow off → only toggle visible; size enum + color hidden', () => {
      const { container } = render(
        <DecorationEffects decoration={baseShape} onUpdate={vi.fn()} />,
      )
      expect(
        container.querySelector('[data-testid="decoration-shadow-toggle"]'),
      ).toBeTruthy()
      expect(
        container.querySelector('[data-testid="decoration-shadow-size-md"]'),
      ).toBeNull()
    })

    it('toggling shadow on dispatches with default values', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationEffects decoration={baseShape} onUpdate={onUpdate} />,
      )
      const toggle = container.querySelector(
        '[data-testid="decoration-shadow-toggle"]',
      ) as HTMLElement
      fireEvent.click(toggle)
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const arg = onUpdate.mock.calls[0][0]
      expect(arg).toHaveProperty('effects')
      expect(arg.effects.shadow.enabled).toBe(true)
      expect(arg.effects.shadow.size).toBeDefined()
      expect(arg.effects.shadow.color).toBeDefined()
    })

    it('shadow enabled → size enum + color picker render', () => {
      const dec: ShapeDecoration = {
        ...baseShape,
        effects: { shadow: { enabled: true, color: '#00000080', size: 'md' } },
      }
      const { container } = render(
        <DecorationEffects decoration={dec} onUpdate={vi.fn()} />,
      )
      expect(
        container.querySelector('[data-testid="decoration-shadow-size-sm"]'),
      ).toBeTruthy()
      expect(
        container.querySelector('[data-testid="decoration-shadow-size-md"]'),
      ).toBeTruthy()
      expect(
        container.querySelector('[data-testid="decoration-shadow-size-lg"]'),
      ).toBeTruthy()
    })

    it('shadow size click dispatches preserving color', () => {
      const onUpdate = vi.fn()
      const dec: ShapeDecoration = {
        ...baseShape,
        effects: { shadow: { enabled: true, color: '#00000080', size: 'md' } },
      }
      const { container } = render(
        <DecorationEffects decoration={dec} onUpdate={onUpdate} />,
      )
      const lgBtn = container.querySelector(
        '[data-testid="decoration-shadow-size-lg"]',
      ) as HTMLElement
      fireEvent.click(lgBtn)
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const arg = onUpdate.mock.calls[0][0]
      expect(arg.effects.shadow.size).toBe('lg')
      expect(arg.effects.shadow.color).toBe('#00000080')
      expect(arg.effects.shadow.enabled).toBe(true)
    })

    it('toggling shadow off preserves color/size for re-enable', () => {
      const onUpdate = vi.fn()
      const dec: ShapeDecoration = {
        ...baseShape,
        effects: { shadow: { enabled: true, color: '#FF000080', size: 'lg' } },
      }
      const { container } = render(
        <DecorationEffects decoration={dec} onUpdate={onUpdate} />,
      )
      const toggle = container.querySelector(
        '[data-testid="decoration-shadow-toggle"]',
      ) as HTMLElement
      fireEvent.click(toggle)
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const arg = onUpdate.mock.calls[0][0]
      expect(arg.effects.shadow.enabled).toBe(false)
      expect(arg.effects.shadow.color).toBe('#FF000080')
      expect(arg.effects.shadow.size).toBe('lg')
    })

    it('shadow color hex input dispatches after 300ms debounce', () => {
      const onUpdate = vi.fn()
      const dec: ShapeDecoration = {
        ...baseShape,
        effects: { shadow: { enabled: true, color: '#00000080', size: 'md' } },
      }
      const { container } = render(
        <DecorationEffects decoration={dec} onUpdate={onUpdate} />,
      )
      const input = container.querySelector(
        '[data-testid="decoration-shadow-hex-input"]',
      ) as HTMLInputElement
      expect(input).toBeTruthy()
      fireEvent.change(input, { target: { value: '112233' } })
      expect(onUpdate).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const arg = onUpdate.mock.calls[0][0]
      expect(arg.effects.shadow.color.toLowerCase()).toContain('112233')
    })
  })

  describe('Opacity slider (WR-01)', () => {
    it('renders opacity slider with default 100% when d.opacity undefined', () => {
      const { container } = render(
        <DecorationEffects decoration={baseShape} onUpdate={vi.fn()} />,
      )
      const slider = container.querySelector(
        '[data-testid="decoration-opacity-slider"]',
      ) as HTMLInputElement
      expect(slider).toBeTruthy()
      expect(slider.min).toBe('0')
      expect(slider.max).toBe('100')
      expect(slider.step).toBe('1')
      // Default render shows 100%.
      expect(
        container.querySelector('[data-testid="decoration-opacity-value"]')!
          .textContent,
      ).toContain('100')
    })

    it('renders opacity slider with d.opacity * 100 displayed', () => {
      const dec: ShapeDecoration = { ...baseShape, opacity: 0.5 }
      const { container } = render(
        <DecorationEffects decoration={dec} onUpdate={vi.fn()} />,
      )
      expect(
        container.querySelector('[data-testid="decoration-opacity-value"]')!
          .textContent,
      ).toContain('50')
    })

    it('mid-drag (change only) does NOT dispatch', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationEffects decoration={baseShape} onUpdate={onUpdate} />,
      )
      const slider = container.querySelector(
        '[data-testid="decoration-opacity-slider"]',
      ) as HTMLInputElement
      fireEvent.change(slider, { target: { value: '60' } })
      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('mouseup commits opacity / 100 → 0..1 storage', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationEffects decoration={baseShape} onUpdate={onUpdate} />,
      )
      const slider = container.querySelector(
        '[data-testid="decoration-opacity-slider"]',
      ) as HTMLInputElement
      fireEvent.change(slider, { target: { value: '75' } })
      fireEvent.mouseUp(slider, { target: { value: '75' } })
      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect(onUpdate.mock.calls[0][0]).toEqual({ opacity: 0.75 })
    })

    it('opacity 0 → dispatched 0 (not undefined)', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationEffects decoration={baseShape} onUpdate={onUpdate} />,
      )
      const slider = container.querySelector(
        '[data-testid="decoration-opacity-slider"]',
      ) as HTMLInputElement
      fireEvent.change(slider, { target: { value: '0' } })
      fireEvent.mouseUp(slider, { target: { value: '0' } })
      expect(onUpdate).toHaveBeenCalledWith({ opacity: 0 })
    })

    it('opacity 100 → dispatched 1', () => {
      const onUpdate = vi.fn()
      const dec: ShapeDecoration = { ...baseShape, opacity: 0.5 }
      const { container } = render(
        <DecorationEffects decoration={dec} onUpdate={onUpdate} />,
      )
      const slider = container.querySelector(
        '[data-testid="decoration-opacity-slider"]',
      ) as HTMLInputElement
      fireEvent.change(slider, { target: { value: '100' } })
      fireEvent.mouseUp(slider, { target: { value: '100' } })
      expect(onUpdate).toHaveBeenCalledWith({ opacity: 1 })
    })
  })
})
