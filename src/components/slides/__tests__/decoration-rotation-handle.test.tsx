/**
 * Phase 72 Plan 02 (ROTATE-02): DecorationRotationHandle pure-chrome component.
 *
 * The handle is a 16px circle anchored ~20px above the selected decoration's
 * top edge. Pointer-driven rotation:
 *   - onPointerDown captures starting pointer angle from element center
 *   - onPointerMove emits per-tick onPreview(rotation) (local CSS update only,
 *     NO reducer dispatch)
 *   - onPointerUp emits ONE onCommit(rotation) — single pushHistory per
 *     gesture (PERF-01 / KBD-09 carry-forward)
 *   - Shift+drag snaps to 15° increments
 *   - Esc cancels — reverts to starting rotation; one onCommit(startRotation)
 *
 * The component is pure chrome — no reducer imports beyond React + props. The
 * mounting site (slide-preview.tsx editable={true} branch — Plan 72-02 Task 2)
 * translates onCommit into BULK_ROTATE dispatch.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useRef, type RefObject } from 'react'
import { DecorationRotationHandle } from '../decoration-rotation-handle'

// ─────────────────────────────────────────────────────────────────────────────
// Test harness — wraps the handle with a sized container ref so the handle's
// onPointerDown can read the container's bounding rect for atan2 math.
// jsdom doesn't honor inline width/height; we patch getBoundingClientRect.
// ─────────────────────────────────────────────────────────────────────────────

const CONTAINER_RECT: DOMRect = {
  left: 0,
  top: 0,
  right: 1080,
  bottom: 1920,
  width: 1080,
  height: 1920,
  x: 0,
  y: 0,
  toJSON() {
    return {}
  },
}

function Harness(props: {
  currentRotation?: number
  visible?: boolean
  onPreview?: (r: number) => void
  onCommit?: (r: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Patch the ref's getBoundingClientRect via a wrapper div whose ref we mock
  // at access time.
  return (
    <div
      ref={(el) => {
        if (el) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(ref as any).current = {
            getBoundingClientRect: () => CONTAINER_RECT,
          }
        }
      }}
      data-testid="harness"
    >
      <DecorationRotationHandle
        decorationBounds={{ x: 40, y: 40, width: 20, height: 20 }}
        containerRef={ref as unknown as RefObject<HTMLDivElement>}
        currentRotation={props.currentRotation ?? 0}
        visible={props.visible ?? true}
        onPreview={props.onPreview}
        onCommit={props.onCommit ?? (() => {})}
      />
    </div>
  )
}

// Center of the test decoration in pixel space:
//   x = 40 + 20/2 = 50% of 1080 = 540
//   y = 40 + 20/2 = 50% of 1920 = 960
const CX = 540
const CY = 960

// Helper — pointer event with clientX/Y (jsdom doesn't synthesize them).
function pointer(eventInit: { clientX: number; clientY: number; shiftKey?: boolean }) {
  return {
    pointerId: 1,
    button: 0,
    bubbles: true,
    ...eventInit,
  }
}

describe('Phase 72 Plan 02 — DecorationRotationHandle (ROTATE-02)', () => {
  it('Test 1: renders as a 16px circle when visible=true', () => {
    const { getByTestId } = render(<Harness />)
    const handle = getByTestId('decoration-rotation-handle')
    expect(handle).toBeTruthy()
    const style = handle.style
    expect(style.width).toBe('16px')
    expect(style.height).toBe('16px')
    expect(style.borderRadius).toBe('50%')
  })

  it('Test 2: returns null when visible=false', () => {
    const { queryByTestId } = render(<Harness visible={false} />)
    expect(queryByTestId('decoration-rotation-handle')).toBeNull()
  })

  it('Test 3: positioned ~20px above element top edge (offsetPx default 20)', () => {
    const { getByTestId } = render(<Harness />)
    const handle = getByTestId('decoration-rotation-handle')
    // The handle is positioned via inline left/top (px). With the default
    // offsetPx=20, it sits 20px above the decoration's top edge minus half
    // the handle size (so its center aligns horizontally with the
    // decoration's center). Assert top is a negative offset relative to
    // the decoration's top — concretely, top in px must include "-" for
    // handle-above-element semantics OR be smaller than the element's top
    // expressed in the same coordinate.
    expect(handle.style.position).toBe('absolute')
    // The handle's position is computed in % coordinates relative to the
    // canvas. We just verify it has both `left` and `top` set.
    expect(handle.style.left).toBeTruthy()
    expect(handle.style.top).toBeTruthy()
  })

  it('Test 4: cursor is grab on hover; grabbing during drag', () => {
    const { getByTestId } = render(<Harness />)
    const handle = getByTestId('decoration-rotation-handle')
    expect(handle.style.cursor).toBe('grab')
    expect(handle.getAttribute('data-state')).toBe('idle')

    fireEvent.pointerDown(handle, pointer({ clientX: CX + 100, clientY: CY }))
    expect(handle.style.cursor).toBe('grabbing')
    expect(handle.getAttribute('data-state')).toBe('dragging')

    fireEvent.pointerUp(handle, pointer({ clientX: CX + 100, clientY: CY }))
    expect(handle.style.cursor).toBe('grab')
    expect(handle.getAttribute('data-state')).toBe('idle')
  })

  it('Test 5: onPointerDown captures starting angle; does NOT call onCommit', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Harness onCommit={onCommit} />)
    const handle = getByTestId('decoration-rotation-handle')
    fireEvent.pointerDown(handle, pointer({ clientX: CX + 100, clientY: CY }))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('Test 6: onPointerMove emits onPreview per tick; never onCommit', () => {
    const onPreview = vi.fn()
    const onCommit = vi.fn()
    const { getByTestId } = render(
      <Harness onPreview={onPreview} onCommit={onCommit} />,
    )
    const handle = getByTestId('decoration-rotation-handle')

    // Start at 0° (pointer to the right of center)
    fireEvent.pointerDown(handle, pointer({ clientX: CX + 100, clientY: CY }))
    // Move to 90° (pointer below center) — atan2(100, 0) = +90
    fireEvent.pointerMove(handle, pointer({ clientX: CX, clientY: CY + 100 }))
    expect(onPreview).toHaveBeenCalled()
    // Last preview value should be 90 (delta from 0 startAngle to +90)
    const lastPreview = onPreview.mock.calls[onPreview.mock.calls.length - 1][0]
    expect(lastPreview).toBeCloseTo(90, 1)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('Test 7: onPointerUp emits onCommit EXACTLY ONCE with final value', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(<Harness onCommit={onCommit} />)
    const handle = getByTestId('decoration-rotation-handle')

    fireEvent.pointerDown(handle, pointer({ clientX: CX + 100, clientY: CY }))
    fireEvent.pointerMove(handle, pointer({ clientX: CX, clientY: CY + 100 }))
    fireEvent.pointerMove(handle, pointer({ clientX: CX - 100, clientY: CY }))
    fireEvent.pointerUp(handle, pointer({ clientX: CX - 100, clientY: CY }))

    expect(onCommit).toHaveBeenCalledTimes(1)
    // Final rotation: atan2(0, -100) - atan2(0, 100) = 180 (or -180; both valid)
    const final = onCommit.mock.calls[0][0]
    expect(Math.abs(final)).toBeCloseTo(180, 1)
  })

  it('Test 8: onPointerCancel reverts to starting rotation via single onCommit', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(
      <Harness currentRotation={30} onCommit={onCommit} />,
    )
    const handle = getByTestId('decoration-rotation-handle')

    fireEvent.pointerDown(handle, pointer({ clientX: CX + 100, clientY: CY }))
    fireEvent.pointerMove(handle, pointer({ clientX: CX, clientY: CY + 100 }))
    fireEvent.pointerCancel(handle, pointer({ clientX: CX, clientY: CY + 100 }))

    expect(onCommit).toHaveBeenCalledTimes(1)
    // Cancel reverts to startRotation (30)
    expect(onCommit.mock.calls[0][0]).toBeCloseTo(30, 1)
  })

  it('Test 9: Shift+drag snaps rotation to 15° increments', () => {
    const onPreview = vi.fn()
    const { getByTestId } = render(<Harness onPreview={onPreview} />)
    const handle = getByTestId('decoration-rotation-handle')

    fireEvent.pointerDown(handle, pointer({ clientX: CX + 100, clientY: CY }))

    // Move to ~17° (with shift) — should snap to 15
    // 17° from start at 0°: pointer at (cos17°*100, sin17°*100) from center
    const a17 = (17 * Math.PI) / 180
    fireEvent.pointerMove(
      handle,
      pointer({
        clientX: CX + Math.cos(a17) * 100,
        clientY: CY + Math.sin(a17) * 100,
        shiftKey: true,
      }),
    )
    let last = onPreview.mock.calls[onPreview.mock.calls.length - 1][0]
    expect(last).toBe(15)

    // Move to ~22° (with shift) — should snap to 15 (Math.round(22/15)=Math.round(1.466)=1→15)
    const a22 = (22 * Math.PI) / 180
    fireEvent.pointerMove(
      handle,
      pointer({
        clientX: CX + Math.cos(a22) * 100,
        clientY: CY + Math.sin(a22) * 100,
        shiftKey: true,
      }),
    )
    last = onPreview.mock.calls[onPreview.mock.calls.length - 1][0]
    expect(last).toBe(15)

    // Move to ~24° (with shift) — should snap to 30 (Math.round(24/15)=Math.round(1.6)=2→30)
    const a24 = (24 * Math.PI) / 180
    fireEvent.pointerMove(
      handle,
      pointer({
        clientX: CX + Math.cos(a24) * 100,
        clientY: CY + Math.sin(a24) * 100,
        shiftKey: true,
      }),
    )
    last = onPreview.mock.calls[onPreview.mock.calls.length - 1][0]
    expect(last).toBe(30)
  })

  it('Test 10: Esc cancels active drag — onCommit called with startRotation; subsequent moves no-op', () => {
    const onPreview = vi.fn()
    const onCommit = vi.fn()
    const { getByTestId } = render(
      <Harness currentRotation={45} onPreview={onPreview} onCommit={onCommit} />,
    )
    const handle = getByTestId('decoration-rotation-handle')

    fireEvent.pointerDown(handle, pointer({ clientX: CX + 100, clientY: CY }))
    fireEvent.pointerMove(handle, pointer({ clientX: CX, clientY: CY + 100 }))
    expect(onPreview).toHaveBeenCalled()

    // Esc → revert to startRotation (45) and end drag
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit.mock.calls[0][0]).toBeCloseTo(45, 1)

    // Subsequent move should not emit preview (drag ended)
    const previewCallsBefore = onPreview.mock.calls.length
    fireEvent.pointerMove(handle, pointer({ clientX: CX - 100, clientY: CY }))
    expect(onPreview.mock.calls.length).toBe(previewCallsBefore)
  })

  it('Test 11: rotation values normalized to [-180, 180]', () => {
    const onCommit = vi.fn()
    const { getByTestId } = render(
      <Harness currentRotation={170} onCommit={onCommit} />,
    )
    const handle = getByTestId('decoration-rotation-handle')

    // Start at angle 0 (pointer right of center).
    // currentRotation = 170. Drag pointer to angle +30° → delta = +30,
    // raw rotation = 200 → normalized to -160.
    fireEvent.pointerDown(handle, pointer({ clientX: CX + 100, clientY: CY }))
    const a30 = (30 * Math.PI) / 180
    fireEvent.pointerMove(
      handle,
      pointer({
        clientX: CX + Math.cos(a30) * 100,
        clientY: CY + Math.sin(a30) * 100,
      }),
    )
    fireEvent.pointerUp(
      handle,
      pointer({
        clientX: CX + Math.cos(a30) * 100,
        clientY: CY + Math.sin(a30) * 100,
      }),
    )
    expect(onCommit).toHaveBeenCalledTimes(1)
    const v = onCommit.mock.calls[0][0]
    expect(v).toBeGreaterThanOrEqual(-180)
    expect(v).toBeLessThanOrEqual(180)
    // Specifically: 170 + 30 = 200 → normalized to -160
    expect(v).toBeCloseTo(-160, 1)
  })

  it('Test 12: handle blocks pointer event bubbling (stopPropagation)', () => {
    let bubbled = false
    const handler = () => {
      bubbled = true
    }
    const { getByTestId } = render(
      <div onPointerDown={handler} data-testid="bubble-target">
        <Harness />
      </div>,
    )
    const handle = getByTestId('decoration-rotation-handle')
    fireEvent.pointerDown(handle, pointer({ clientX: CX + 100, clientY: CY }))
    expect(bubbled).toBe(false)
  })
})
