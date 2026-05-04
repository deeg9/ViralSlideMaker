/**
 * Phase 70 Plan 04 (CARD-01..05, SHAPES-06..09): DecorationCard right-rail
 * Inspector tests.
 *
 * Tests cover:
 *   - Fill control: HexAlphaColorPicker (shape) / HexColorPicker (icon)
 *     + brand-kit + derived_palette swatches above + 300ms debounced commit
 *   - Stroke control: color picker + width slider + style enum (shape only)
 *   - Size + position: 4 numeric inputs (W/H/X/Y) clamped [0, 100]
 *   - Per-shape: cornerRadius (rect), points (polygon/star), aspect-lock
 *     (rect/circle/ellipse/star)
 *   - DecorationEffects sub-component mounts (full effects assertions live
 *     in decoration-card-effects.test.tsx)
 *
 * KBD-09 contract: every dispatch is a single-pushHistory gesture. Color
 * pickers debounce 300ms; sliders use onChangeEnd / mouseup; numeric inputs
 * commit on blur/Enter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { DecorationCard } from '../decoration-card'
import type { IconDecoration, ShapeDecoration } from '@/lib/types/decoration'
import type { BrandKit } from '@/lib/types/brand-kit'

const baseShape: ShapeDecoration = {
  id: 'd1',
  kind: 'shape',
  shapeKind: 'rect',
  fill: '#FF0000',
  position: { x: 10, y: 20, width: 30, height: 40 },
}

const baseIcon: IconDecoration = {
  id: 'd2',
  kind: 'icon',
  lucideName: 'Heart',
  color: '#3D0000',
  strokeWidth: 2,
  position: { x: 5, y: 10, width: 15, height: 15 },
}

const FAKE_BRAND_KIT: BrandKit = {
  id: 'bk',
  user_id: 'u',
  name: 'b',
  primary_color: '#AA0000',
  secondary_color: '#00AA00',
  text_color: '#000000',
  background_color: '#FFFFFF',
  accent_color: '#0000AA',
  font_family: null,
  logo_url: null,
  logo_position: null,
  logo_size_pct: null,
  logo_opacity_pct: null,
  heading_font_family: null,
  body_font_family: null,
  text_align: null,
  text_position: null,
  hook_style: null,
  overlay_opacity_pct: null,
  created_at: '',
  updated_at: '',
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Phase 70 Plan 04 — DecorationCard (CARD-01..05, SHAPES-06..09)', () => {
  describe('Header (CARD-01)', () => {
    it('renders the card with data-testid="decoration-card" and a label', () => {
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={vi.fn()} />,
      )
      expect(container.querySelector('[data-testid="decoration-card"]')).toBeTruthy()
      expect(
        container.querySelector('[data-testid="decoration-card-label"]'),
      ).toBeTruthy()
    })
  })

  describe('Fill control (CARD-02)', () => {
    it('shape decoration renders alpha-capable fill picker initialized with d.fill', () => {
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={vi.fn()} />,
      )
      expect(
        container.querySelector('[data-testid="decoration-fill-picker"]'),
      ).toBeTruthy()
      const input = container.querySelector(
        '[data-testid="decoration-fill-hex-input"]',
      ) as HTMLInputElement | null
      expect(input).toBeTruthy()
      // HexColorInput strips '#' from displayed value.
      expect(input!.value.toLowerCase()).toContain('ff0000')
    })

    it('icon decoration renders fill picker initialized with d.color', () => {
      const { container } = render(
        <DecorationCard decoration={baseIcon} onUpdate={vi.fn()} />,
      )
      const input = container.querySelector(
        '[data-testid="decoration-fill-hex-input"]',
      ) as HTMLInputElement | null
      expect(input).toBeTruthy()
      expect(input!.value.toLowerCase()).toContain('3d0000')
    })

    it('hex input edit dispatches UPDATE_DECORATION after 300ms debounce', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
      )
      const input = container.querySelector(
        '[data-testid="decoration-fill-hex-input"]',
      ) as HTMLInputElement
      fireEvent.change(input, { target: { value: '00FF00' } })
      // Before debounce window: no dispatch.
      expect(onUpdate).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const arg = onUpdate.mock.calls[0][0]
      expect(arg).toHaveProperty('fill')
      expect(String(arg.fill).toLowerCase()).toContain('00ff00')
    })

    it('icon hex input commits to color (NOT fill) after debounce', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard decoration={baseIcon} onUpdate={onUpdate} />,
      )
      const input = container.querySelector(
        '[data-testid="decoration-fill-hex-input"]',
      ) as HTMLInputElement
      fireEvent.change(input, { target: { value: '0000FF' } })
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const arg = onUpdate.mock.calls[0][0]
      expect(arg).toHaveProperty('color')
      expect(arg).not.toHaveProperty('fill')
    })

    it('renders brand-kit swatches above the picker', () => {
      const { container } = render(
        <DecorationCard
          decoration={baseShape}
          onUpdate={vi.fn()}
          brandKit={FAKE_BRAND_KIT}
        />,
      )
      const swatches = container.querySelectorAll(
        '[data-testid^="decoration-fill-swatch-"]',
      )
      // brand-kit contributes primary/secondary/text/background/accent (5 non-null).
      expect(swatches.length).toBeGreaterThanOrEqual(5)
    })

    it('renders derived_palette swatches above the picker', () => {
      const { container } = render(
        <DecorationCard
          decoration={baseShape}
          onUpdate={vi.fn()}
          derivedPalette={['#112233', '#445566', '#778899']}
        />,
      )
      expect(
        container.querySelector('[data-testid="decoration-fill-swatch-#112233"]'),
      ).toBeTruthy()
      expect(
        container.querySelector('[data-testid="decoration-fill-swatch-#445566"]'),
      ).toBeTruthy()
    })

    it('clicking a swatch dispatches UPDATE_DECORATION immediately (no debounce)', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard
          decoration={baseShape}
          onUpdate={onUpdate}
          derivedPalette={['#112233']}
        />,
      )
      const sw = container.querySelector(
        '[data-testid="decoration-fill-swatch-#112233"]',
      ) as HTMLElement
      fireEvent.click(sw)
      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect(onUpdate.mock.calls[0][0]).toEqual({ fill: '#112233' })
    })
  })

  describe('Stroke control (CARD-03 + SHAPES-08)', () => {
    it('renders stroke section for shape decoration', () => {
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={vi.fn()} />,
      )
      expect(
        container.querySelector('[data-testid="decoration-stroke-section"]'),
      ).toBeTruthy()
    })

    it('does NOT render stroke section for icon decoration', () => {
      const { container } = render(
        <DecorationCard decoration={baseIcon} onUpdate={vi.fn()} />,
      )
      expect(
        container.querySelector('[data-testid="decoration-stroke-section"]'),
      ).toBeNull()
    })

    it('stroke width slider commits via onChangeEnd / mouseup', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
      )
      const slider = container.querySelector(
        '[data-testid="decoration-stroke-width"]',
      ) as HTMLInputElement
      // change-only should NOT dispatch.
      fireEvent.change(slider, { target: { value: '5' } })
      expect(onUpdate).not.toHaveBeenCalled()
      // mouseup commits.
      fireEvent.mouseUp(slider, { target: { value: '5' } })
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const arg = onUpdate.mock.calls[0][0]
      expect(arg).toHaveProperty('stroke')
      expect(arg.stroke.width).toBe(5)
    })

    it('stroke style buttons (solid/dashed/dotted) dispatch on click', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
      )
      const dashed = container.querySelector(
        '[data-testid="decoration-stroke-style-dashed"]',
      ) as HTMLElement
      fireEvent.click(dashed)
      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect(onUpdate.mock.calls[0][0].stroke.style).toBe('dashed')
    })
  })

  describe('Size + position (CARD-04)', () => {
    it('renders 4 numeric inputs for W, H, X, Y', () => {
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={vi.fn()} />,
      )
      expect(container.querySelector('[data-testid="decoration-input-w"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="decoration-input-h"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="decoration-input-x"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="decoration-input-y"]')).toBeTruthy()
    })

    it('blur on W input dispatches with new width clamped [0, 100]', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
      )
      const w = container.querySelector(
        '[data-testid="decoration-input-w"]',
      ) as HTMLInputElement
      fireEvent.change(w, { target: { value: '55' } })
      // pre-blur: no dispatch.
      expect(onUpdate).not.toHaveBeenCalled()
      fireEvent.blur(w)
      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect(onUpdate.mock.calls[0][0].position.width).toBe(55)
    })

    it('out-of-range value (>100) clamps to 100', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
      )
      const w = container.querySelector(
        '[data-testid="decoration-input-w"]',
      ) as HTMLInputElement
      fireEvent.change(w, { target: { value: '150' } })
      fireEvent.blur(w)
      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect(onUpdate.mock.calls[0][0].position.width).toBe(100)
    })

    it('NaN input does NOT dispatch (revert)', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
      )
      const w = container.querySelector(
        '[data-testid="decoration-input-w"]',
      ) as HTMLInputElement
      fireEvent.change(w, { target: { value: 'abc' } })
      fireEvent.blur(w)
      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('Enter key on numeric input commits same as blur', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
      )
      const x = container.querySelector(
        '[data-testid="decoration-input-x"]',
      ) as HTMLInputElement
      fireEvent.change(x, { target: { value: '42' } })
      fireEvent.keyDown(x, { key: 'Enter' })
      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect(onUpdate.mock.calls[0][0].position.x).toBe(42)
    })

    it('aspect-lock on + W edit also updates H to preserve ratio', () => {
      const onUpdate = vi.fn()
      const startW = baseShape.position.width // 30
      const startH = baseShape.position.height // 40
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
      )
      // Toggle aspect lock on.
      const lock = container.querySelector(
        '[data-testid="decoration-aspect-lock"]',
      ) as HTMLElement
      expect(lock).toBeTruthy()
      fireEvent.click(lock)
      const w = container.querySelector(
        '[data-testid="decoration-input-w"]',
      ) as HTMLInputElement
      const newW = 60
      fireEvent.change(w, { target: { value: String(newW) } })
      fireEvent.blur(w)
      expect(onUpdate).toHaveBeenCalledTimes(1)
      const arg = onUpdate.mock.calls[0][0]
      expect(arg.position.width).toBe(newW)
      // H scales: newH = startH * (newW / startW) = 40 * (60/30) = 80
      const expectedH = startH * (newW / startW)
      expect(arg.position.height).toBeCloseTo(expectedH, 1)
    })
  })

  describe('Per-shape controls (SHAPES-06..09)', () => {
    it('rect shape renders cornerRadius slider [0, 50]', () => {
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={vi.fn()} />,
      )
      const slider = container.querySelector(
        '[data-testid="decoration-corner-radius"]',
      ) as HTMLInputElement
      expect(slider).toBeTruthy()
      expect(slider.min).toBe('0')
      expect(slider.max).toBe('50')
    })

    it('non-rect shape does NOT render cornerRadius slider', () => {
      const circle: ShapeDecoration = { ...baseShape, shapeKind: 'circle' }
      const { container } = render(
        <DecorationCard decoration={circle} onUpdate={vi.fn()} />,
      )
      expect(
        container.querySelector('[data-testid="decoration-corner-radius"]'),
      ).toBeNull()
    })

    it('cornerRadius slider commits via mouseup', () => {
      const onUpdate = vi.fn()
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
      )
      const slider = container.querySelector(
        '[data-testid="decoration-corner-radius"]',
      ) as HTMLInputElement
      fireEvent.change(slider, { target: { value: '24' } })
      expect(onUpdate).not.toHaveBeenCalled()
      fireEvent.mouseUp(slider, { target: { value: '24' } })
      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect(onUpdate.mock.calls[0][0].cornerRadius).toBe(24)
    })

    it('polygon renders points enum buttons [5, 6, 8]', () => {
      const polygon: ShapeDecoration = {
        ...baseShape,
        shapeKind: 'polygon',
        points: 5,
      }
      const { container } = render(
        <DecorationCard decoration={polygon} onUpdate={vi.fn()} />,
      )
      expect(container.querySelector('[data-testid="decoration-points-5"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="decoration-points-6"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="decoration-points-8"]')).toBeTruthy()
    })

    it('polygon points click dispatches', () => {
      const onUpdate = vi.fn()
      const polygon: ShapeDecoration = {
        ...baseShape,
        shapeKind: 'polygon',
        points: 5,
      }
      const { container } = render(
        <DecorationCard decoration={polygon} onUpdate={onUpdate} />,
      )
      const btn = container.querySelector(
        '[data-testid="decoration-points-8"]',
      ) as HTMLElement
      fireEvent.click(btn)
      expect(onUpdate).toHaveBeenCalledTimes(1)
      expect(onUpdate.mock.calls[0][0]).toEqual({ points: 8 })
    })

    it('star renders points enum [5, 6] only', () => {
      const star: ShapeDecoration = {
        ...baseShape,
        shapeKind: 'star',
        points: 5,
      }
      const { container } = render(
        <DecorationCard decoration={star} onUpdate={vi.fn()} />,
      )
      expect(container.querySelector('[data-testid="decoration-points-5"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="decoration-points-6"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="decoration-points-8"]')).toBeNull()
    })

    it('aspect-lock toggle present for rect/circle/ellipse/star', () => {
      for (const kind of ['rect', 'circle', 'ellipse', 'star'] as const) {
        const dec: ShapeDecoration = {
          ...baseShape,
          shapeKind: kind,
          ...(kind === 'star' ? { points: 5 } : {}),
        }
        const { container, unmount } = render(
          <DecorationCard decoration={dec} onUpdate={vi.fn()} />,
        )
        expect(
          container.querySelector('[data-testid="decoration-aspect-lock"]'),
          `aspect-lock should render for ${kind}`,
        ).toBeTruthy()
        unmount()
      }
    })

    it('aspect-lock toggle absent for triangle/polygon/arrow/line', () => {
      for (const kind of ['triangle', 'polygon', 'arrow', 'line'] as const) {
        const dec: ShapeDecoration = {
          ...baseShape,
          shapeKind: kind,
          ...(kind === 'polygon' ? { points: 5 } : {}),
        }
        const { container, unmount } = render(
          <DecorationCard decoration={dec} onUpdate={vi.fn()} />,
        )
        expect(
          container.querySelector('[data-testid="decoration-aspect-lock"]'),
          `aspect-lock should NOT render for ${kind}`,
        ).toBeNull()
        unmount()
      }
    })
  })

  describe('Effects sub-component mount (CARD-05)', () => {
    it('renders DecorationEffects placeholder', () => {
      const { container } = render(
        <DecorationCard decoration={baseShape} onUpdate={vi.fn()} />,
      )
      expect(
        container.querySelector('[data-testid="decoration-effects"]'),
      ).toBeTruthy()
    })
  })
})
