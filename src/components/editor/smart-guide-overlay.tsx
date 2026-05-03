'use client'

/**
 * Phase 63 Plan 04 (SNAP-06, SNAP-07, PERF-03): SmartGuideOverlay component.
 *
 * Persistent pool of guide-line + equal-spacing-segment <div>s. Updates flow
 * through an IMPERATIVE ref API (updateGuides / clear) that mutates DOM
 * directly via refs — NO React state, NO setState, NO reconciliation per
 * pointer-move. The component never re-renders after mount; the pool of
 * slots is laid out once and slots toggle visibility + transform via raw
 * style mutation.
 *
 * Why imperative: PERF-03 budgets <2ms per pointer-move tick at N=30
 * elements; setState + reconciliation alone burns the budget. Mutating
 * `el.style.transform = 'translate3d(Xpx, Ypx, 0)'` runs on the GPU
 * compositor (PITFALL-5.4 spirit) and dodges the React diff entirely.
 *
 * Coord system (SNAP-06 + PITFALL-5.3): the root container is sized to the
 * REF canvas (1080×1920) and lives INSIDE the slide-preview's scaled
 * canvas wrapper. The CSS transform on the parent handles zoom — child
 * absolute positions are REF px and stay correct at any zoom level.
 *
 * Pool sizing: 8 X-line slots + 8 Y-line slots + 8 equal-spacing-segment
 * slots. Realistic snap states use at most ~3 X + ~3 Y simultaneously;
 * 8 is a generous overshoot that costs ~24 hidden divs (negligible).
 *
 * TPLREND-05 / PARITY-01: this component must be mounted ONLY downstream
 * of slide-preview's editable={true} branch. The component itself emits no
 * Satori-relevant markup (data-tplrend etc.) — it's purely cosmetic chrome.
 */

import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { EqualSpacingMatch } from '@/lib/editor/transforms/equal-spacing'

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface GuideLine {
  /** Reference px (0..1080 for X, 0..1920 for Y). */
  pos: number
  /** What contributed this line (informational; renders identically). */
  kind?: 'edge' | 'center' | 'canvas'
}

export interface SmartGuideUpdate {
  xLines: GuideLine[]
  yLines: GuideLine[]
  equalSpacing: EqualSpacingMatch | null
  /**
   * Axis the equal-spacing match was detected on. 'horizontal' = the
   * elements are spaced left-to-right (segments are X coords); 'vertical' =
   * top-to-bottom. Defaults to 'horizontal' when omitted.
   */
  equalSpacingAxis?: 'horizontal' | 'vertical'
}

export interface SmartGuideOverlayHandle {
  updateGuides(next: SmartGuideUpdate): void
  clear(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REF_WIDTH = 1080
const REF_HEIGHT = 1920
const POOL_SIZE = 8

/** Figma signature pink for smart-guide chrome. */
const GUIDE_COLOR = '#FF00C7'

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const SmartGuideOverlay = forwardRef<SmartGuideOverlayHandle, object>(
  function SmartGuideOverlay(_props, ref) {
    // Pool refs — array of HTMLDivElement | null. Set on mount via the
    // callback ref; never re-allocated.
    const xSlotsRef = useRef<Array<HTMLDivElement | null>>(
      Array.from({ length: POOL_SIZE }, () => null),
    )
    const ySlotsRef = useRef<Array<HTMLDivElement | null>>(
      Array.from({ length: POOL_SIZE }, () => null),
    )
    const eqSlotsRef = useRef<Array<HTMLDivElement | null>>(
      Array.from({ length: POOL_SIZE }, () => null),
    )

    useImperativeHandle(
      ref,
      (): SmartGuideOverlayHandle => ({
        updateGuides(next: SmartGuideUpdate) {
          // X-axis (vertical lines) — translate along X.
          const xSlots = xSlotsRef.current
          for (let i = 0; i < POOL_SIZE; i++) {
            const slot = xSlots[i]
            if (!slot) continue
            const line = next.xLines[i]
            if (line) {
              slot.style.display = 'block'
              slot.style.transform = `translate3d(${line.pos}px, 0, 0)`
            } else {
              slot.style.display = 'none'
            }
          }

          // Y-axis (horizontal lines) — translate along Y.
          const ySlots = ySlotsRef.current
          for (let i = 0; i < POOL_SIZE; i++) {
            const slot = ySlots[i]
            if (!slot) continue
            const line = next.yLines[i]
            if (line) {
              slot.style.display = 'block'
              slot.style.transform = `translate3d(0, ${line.pos}px, 0)`
            } else {
              slot.style.display = 'none'
            }
          }

          // Equal-spacing == indicators.
          const eqSlots = eqSlotsRef.current
          const segments = next.equalSpacing?.segments ?? []
          const axis = next.equalSpacingAxis ?? 'horizontal'
          for (let i = 0; i < POOL_SIZE; i++) {
            const slot = eqSlots[i]
            if (!slot) continue
            const seg = segments[i]
            if (seg) {
              slot.style.display = 'block'
              slot.style.color = GUIDE_COLOR
              slot.style.backgroundColor = GUIDE_COLOR
              const len = seg.to - seg.from
              const center = (seg.from + seg.to) / 2
              if (axis === 'horizontal') {
                // Segment is along X axis; render a thin pink bar
                // horizontally between elements at the gap's vertical
                // mid-line. We don't know Y here — caller can choose to
                // mount additional Y info; per the plan the indicator is
                // a small "==" glyph centered in each gap. Use a small
                // fixed-height bar at REF_HEIGHT/2 as a pragmatic default.
                slot.style.left = `${seg.from}px`
                slot.style.top = `${REF_HEIGHT / 2 - 1}px`
                slot.style.width = `${len}px`
                slot.style.height = '2px'
                slot.style.transform = 'none'
                slot.style.setProperty('--gap-center', `${center}px`)
              } else {
                slot.style.left = `${REF_WIDTH / 2 - 1}px`
                slot.style.top = `${seg.from}px`
                slot.style.width = '2px'
                slot.style.height = `${len}px`
                slot.style.transform = 'none'
                slot.style.setProperty('--gap-center', `${center}px`)
              }
            } else {
              slot.style.display = 'none'
            }
          }
        },
        clear() {
          for (const slot of xSlotsRef.current) {
            if (slot) slot.style.display = 'none'
          }
          for (const slot of ySlotsRef.current) {
            if (slot) slot.style.display = 'none'
          }
          for (const slot of eqSlotsRef.current) {
            if (slot) slot.style.display = 'none'
          }
        },
      }),
      [],
    )

    return (
      <div
        data-testid="smart-guide-overlay-root"
        style={{
          position: 'absolute',
          inset: 0,
          width: REF_WIDTH,
          height: REF_HEIGHT,
          pointerEvents: 'none',
          zIndex: 60, // above multi-selection-ring (50) and group-bounding-ring (51)
        }}
      >
        {/* X-axis pool — vertical lines (full canvas height). Each slot is
            initially translated to 0,0 + display:none; updateGuides toggles
            display + sets translate3d(Xpx, 0, 0). */}
        <div data-testid="smart-guide-overlay-x" style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: POOL_SIZE }, (_, i) => (
            <div
              key={`x-${i}`}
              ref={(el) => {
                xSlotsRef.current[i] = el
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 1,
                height: REF_HEIGHT,
                backgroundColor: GUIDE_COLOR,
                display: 'none',
                pointerEvents: 'none',
                willChange: 'transform',
              }}
            />
          ))}
        </div>

        {/* Y-axis pool — horizontal lines (full canvas width). updateGuides
            toggles display + sets translate3d(0, Ypx, 0). */}
        <div data-testid="smart-guide-overlay-y" style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: POOL_SIZE }, (_, i) => (
            <div
              key={`y-${i}`}
              ref={(el) => {
                ySlotsRef.current[i] = el
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: REF_WIDTH,
                height: 1,
                backgroundColor: GUIDE_COLOR,
                display: 'none',
                pointerEvents: 'none',
                willChange: 'transform',
              }}
            />
          ))}
        </div>

        {/* Equal-spacing == indicator pool. Each slot is positioned
            absolutely within its segment range and stays display:none until
            updateGuides places it. Per-axis sizing is decided in
            updateGuides (horizontal: bar across gap; vertical: bar down). */}
        <div data-testid="smart-guide-overlay-equal" style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: POOL_SIZE }, (_, i) => (
            <div
              key={`eq-${i}`}
              ref={(el) => {
                eqSlotsRef.current[i] = el
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                color: GUIDE_COLOR,
                backgroundColor: GUIDE_COLOR,
                display: 'none',
                pointerEvents: 'none',
                willChange: 'transform',
              }}
            />
          ))}
        </div>
      </div>
    )
  },
)

SmartGuideOverlay.displayName = 'SmartGuideOverlay'
