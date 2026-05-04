'use client'

/**
 * Phase 72 Plan 02 (ROTATE-02): DecorationRotationHandle.
 *
 * Pure-chrome rotation handle for a selected decoration. Renders a 16px
 * circular pin ~20px above the decoration's top edge (Figma/Canva pattern).
 * Pointer-driven rotation:
 *   - onPointerDown captures starting pointer angle from element center +
 *     starting rotation; calls e.stopPropagation() so the underlying
 *     decoration click-target overlay does not receive the event (T-72-12).
 *   - onPointerMove (during active drag) computes delta angle from start;
 *     emits per-tick onPreview(rotation) for local CSS preview ONLY — never
 *     dispatches to a reducer (PERF-01 carry-forward).
 *   - onPointerUp emits ONE onCommit(rotation) with the final value — single
 *     pushHistory entry per gesture (KBD-09 / PERF-01 carry-forward).
 *   - Shift+drag snaps rotation to 15° increments.
 *   - Esc cancels — onCommit(startRotation) once + drag terminates.
 *   - All rotation values normalized to [-180, 180] before any callback fires
 *     (T-72-04 mitigation: NaN/Infinity guard via `Number.isFinite` fallback).
 *
 * The component is pure chrome: no reducer or editor-state imports beyond
 * React + props. The mounting site (slide-preview.tsx editable={true} branch
 * — Plan 72-02 Task 2) translates onCommit into BULK_ROTATE dispatch.
 *
 * TPLREND-05 / PARITY-01 carry-forward: this component is mounted ONLY in
 * the editable={true} branch of slide-preview.tsx. It NEVER reaches the
 * Satori PNG export path (render-slide-satori.tsx) or non-editable preview
 * paths (TPLREND-05 chrome gate; T-72-05 mitigation).
 */

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react'

export interface DecorationRotationHandleProps {
  /** Element bounds in % of canvas. Mirrors Decoration.position semantics. */
  decorationBounds: { x: number; y: number; width: number; height: number }
  /** Container ref — used to translate % bounds → px for atan2 math. */
  containerRef: RefObject<HTMLDivElement | null>
  /** Current rotation in degrees, [-180, 180]. */
  currentRotation: number
  /** Render gate. When false, returns null. */
  visible: boolean
  /** Gap between handle and decoration top edge, in px. Default 20. */
  offsetPx?: number
  /** Per-tick local CSS preview callback. Never dispatches to a reducer. */
  onPreview?: (rotation: number) => void
  /** Single dispatch on pointerup / esc — translates to BULK_ROTATE upstream. */
  onCommit: (rotation: number) => void
}

const HANDLE_SIZE_PX = 16
const SNAP_DEGREES = 15

/** Normalize a rotation value to [-180, 180]. NaN/Infinity → fallback caller-supplied default. */
function normalizeRotation(r: number, fallback: number): number {
  if (!Number.isFinite(r)) return fallback
  if (r >= -180 && r <= 180) return r
  return ((r % 360) + 540) % 360 - 180
}

/** Compute pointer angle (degrees) from element center. */
function angleFromCenter(
  clientX: number,
  clientY: number,
  cx: number,
  cy: number,
): number {
  return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
}

export function DecorationRotationHandle({
  decorationBounds,
  containerRef,
  currentRotation,
  visible,
  offsetPx = 20,
  onPreview,
  onCommit,
}: DecorationRotationHandleProps) {
  const handleRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<{
    startAngle: number
    startRotation: number
  } | null>(null)

  // Esc cancel — only attach the listener while a drag is active.
  useEffect(() => {
    if (!drag) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCommit(drag!.startRotation)
        setDrag(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drag, onCommit])

  if (!visible) return null

  // Compute handle's position in % coordinates. Center horizontally over the
  // decoration; offsetPx above its top edge. The offset is converted to a %
  // approximation by treating the canvas as REF_HEIGHT=1920 (consistent with
  // the rest of slide-preview's coord system). The handle box is offset by
  // half its size so its center aligns with the decoration's horizontal
  // center.
  const REF_HEIGHT = 1920
  const REF_WIDTH = 1080
  const offsetPct = (offsetPx / REF_HEIGHT) * 100
  const halfHandlePctX = (HANDLE_SIZE_PX / 2 / REF_WIDTH) * 100
  const halfHandlePctY = (HANDLE_SIZE_PX / 2 / REF_HEIGHT) * 100

  const leftPct =
    decorationBounds.x + decorationBounds.width / 2 - halfHandlePctX
  const topPct = decorationBounds.y - offsetPct - halfHandlePctY

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const target = handleRef.current
    if (target && target.setPointerCapture) {
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        // jsdom may not implement pointer capture — non-fatal.
      }
    }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx =
      rect.left +
      ((decorationBounds.x + decorationBounds.width / 2) / 100) * rect.width
    const cy =
      rect.top +
      ((decorationBounds.y + decorationBounds.height / 2) / 100) * rect.height
    const startAngle = angleFromCenter(e.clientX, e.clientY, cx, cy)
    setDrag({ startAngle, startRotation: currentRotation })
  }

  function computeRotation(
    e: ReactPointerEvent<HTMLDivElement> | PointerEvent,
    d: { startAngle: number; startRotation: number },
  ): number | null {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    const cx =
      rect.left +
      ((decorationBounds.x + decorationBounds.width / 2) / 100) * rect.width
    const cy =
      rect.top +
      ((decorationBounds.y + decorationBounds.height / 2) / 100) * rect.height
    const currentAngle = angleFromCenter(e.clientX, e.clientY, cx, cy)
    const delta = currentAngle - d.startAngle
    let raw = d.startRotation + delta
    if (e.shiftKey) {
      raw = Math.round(raw / SNAP_DEGREES) * SNAP_DEGREES
    }
    return normalizeRotation(raw, d.startRotation)
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return
    const next = computeRotation(e, drag)
    if (next === null) return
    onPreview?.(next)
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return
    const target = handleRef.current
    if (target && target.releasePointerCapture) {
      try {
        target.releasePointerCapture(e.pointerId)
      } catch {
        // Non-fatal in jsdom.
      }
    }
    const next = computeRotation(e, drag)
    onCommit(next ?? drag.startRotation)
    setDrag(null)
  }

  function handlePointerCancel(_e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return
    onCommit(drag.startRotation)
    setDrag(null)
  }

  const isDragging = drag !== null

  return (
    <div
      ref={handleRef}
      role="button"
      data-testid="decoration-rotation-handle"
      data-state={isDragging ? 'dragging' : 'idle'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${HANDLE_SIZE_PX}px`,
        height: `${HANDLE_SIZE_PX}px`,
        borderRadius: '50%',
        background: '#ffffff',
        border: '1px solid #3D0000',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
        cursor: isDragging ? 'grabbing' : 'grab',
        // Sit above the click-target overlay (zIndex 13).
        zIndex: 14,
        pointerEvents: 'auto',
        touchAction: 'none',
      }}
    />
  )
}
