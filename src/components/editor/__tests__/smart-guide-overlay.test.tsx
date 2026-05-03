'use client'

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import * as fs from 'fs'
import * as path from 'path'
import {
  SmartGuideOverlay,
  type SmartGuideOverlayHandle,
} from '../smart-guide-overlay'

/**
 * Phase 63 Plan 04 Task 2 (SNAP-06, SNAP-07, PERF-03):
 * SmartGuideOverlay component contract tests.
 *
 * The component is a persistent pool of guide-line + equal-spacing-segment
 * <div>s. Updates flow through an imperative ref API (updateGuides / clear)
 * that mutates DOM directly via refs — NO React state, NO setState, NO
 * reconciliation per pointer-move. Verified by SG7.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Test harness — exposes the ref API to the test via a callback prop
// ─────────────────────────────────────────────────────────────────────────────

interface HarnessProps {
  onMount?: (api: SmartGuideOverlayHandle) => void
}

function Harness({ onMount }: HarnessProps) {
  const ref = useRef<SmartGuideOverlayHandle | null>(null)
  useEffect(() => {
    if (ref.current && onMount) onMount(ref.current)
  }, [onMount])
  return <SmartGuideOverlay ref={ref} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('SmartGuideOverlay — render contract', () => {
  it('SG1: mounts with persistent guide-line containers (data-testids present)', () => {
    render(<Harness />)
    expect(screen.getByTestId('smart-guide-overlay-x')).toBeInTheDocument()
    expect(screen.getByTestId('smart-guide-overlay-y')).toBeInTheDocument()
    expect(screen.getByTestId('smart-guide-overlay-equal')).toBeInTheDocument()
  })

  it('SG2: initial state — guide containers have no VISIBLE children', () => {
    render(<Harness />)
    const xRoot = screen.getByTestId('smart-guide-overlay-x')
    const yRoot = screen.getByTestId('smart-guide-overlay-y')
    const eqRoot = screen.getByTestId('smart-guide-overlay-equal')
    // Pool slots may exist but must be hidden (display:none).
    for (const root of [xRoot, yRoot, eqRoot]) {
      const visibleSlots = Array.from(root.children).filter((c) => {
        const el = c as HTMLElement
        return el.style.display !== 'none'
      })
      expect(visibleSlots.length).toBe(0)
    }
  })

  it('SG3: updateGuides via ref makes a vertical X-line visible at the right pos', () => {
    let api: SmartGuideOverlayHandle | null = null
    render(<Harness onMount={(a) => { api = a }} />)
    expect(api).not.toBeNull()
    api!.updateGuides({
      xLines: [{ pos: 540 }],
      yLines: [],
      equalSpacing: null,
    })
    const xRoot = screen.getByTestId('smart-guide-overlay-x')
    const visible = Array.from(xRoot.children).filter((c) => {
      const el = c as HTMLElement
      return el.style.display !== 'none'
    })
    expect(visible.length).toBe(1)
    const line = visible[0] as HTMLElement
    // translate3d should reference the position 540 (px).
    expect(line.style.transform).toMatch(/translate3d\(\s*540px/)
  })

  it('SG4: subsequent updateGuides({ ...empty... }) hides previously visible line', () => {
    let api: SmartGuideOverlayHandle | null = null
    render(<Harness onMount={(a) => { api = a }} />)
    api!.updateGuides({
      xLines: [{ pos: 540 }],
      yLines: [],
      equalSpacing: null,
    })
    api!.updateGuides({
      xLines: [],
      yLines: [],
      equalSpacing: null,
    })
    const xRoot = screen.getByTestId('smart-guide-overlay-x')
    const visible = Array.from(xRoot.children).filter((c) => {
      const el = c as HTMLElement
      return el.style.display !== 'none'
    })
    expect(visible.length).toBe(0)
  })

  it('SG5: visible guide lines use translate3d (PERF-03 GPU-composited path)', () => {
    let api: SmartGuideOverlayHandle | null = null
    render(<Harness onMount={(a) => { api = a }} />)
    api!.updateGuides({
      xLines: [{ pos: 200 }],
      yLines: [{ pos: 800 }],
      equalSpacing: null,
    })
    const xRoot = screen.getByTestId('smart-guide-overlay-x')
    const yRoot = screen.getByTestId('smart-guide-overlay-y')
    const xVis = Array.from(xRoot.children).find((c) => {
      const el = c as HTMLElement
      return el.style.display !== 'none'
    }) as HTMLElement
    const yVis = Array.from(yRoot.children).find((c) => {
      const el = c as HTMLElement
      return el.style.display !== 'none'
    }) as HTMLElement
    expect(xVis.style.transform).toMatch(/translate3d\(\s*200px,\s*0(?:px)?,\s*0(?:px)?\)/)
    expect(yVis.style.transform).toMatch(/translate3d\(\s*0(?:px)?,\s*800px,\s*0(?:px)?\)/)
  })

  it('SG6: equalSpacing payload renders pink "==" indicators in the segments', () => {
    let api: SmartGuideOverlayHandle | null = null
    render(<Harness onMount={(a) => { api = a }} />)
    api!.updateGuides({
      xLines: [],
      yLines: [],
      equalSpacing: {
        gapSize: 30,
        segments: [
          { from: 10, to: 40 },
          { from: 60, to: 90 },
        ],
        elementIds: ['a', 'b', 'c'],
      },
      equalSpacingAxis: 'horizontal',
    })
    const eqRoot = screen.getByTestId('smart-guide-overlay-equal')
    const visible = Array.from(eqRoot.children).filter((c) => {
      const el = c as HTMLElement
      return el.style.display !== 'none'
    }) as HTMLElement[]
    expect(visible.length).toBe(2)
    // Every visible segment must use pink (Figma signature).
    for (const el of visible) {
      const color = (el.style.color || el.style.backgroundColor).toUpperCase()
      // jsdom normalizes hex to rgb; accept either form.
      expect(
        color.includes('#FF00C7') ||
          color.toLowerCase().includes('rgb(255, 0, 199)'),
      ).toBe(true)
    }
  })

  it('SG7: PERF-03 — updateGuides does NOT trigger React reconciliation', () => {
    // Wrap the component so we can spy on render counts.
    let renderCount = 0
    let api: SmartGuideOverlayHandle | null = null
    function Wrapper() {
      renderCount++
      const ref = useRef<SmartGuideOverlayHandle | null>(null)
      useEffect(() => {
        if (ref.current) api = ref.current
      })
      return <SmartGuideOverlay ref={ref} />
    }
    render(<Wrapper />)
    const baseline = renderCount
    // Spam updateGuides 60 times — simulates a sustained drag.
    for (let i = 0; i < 60; i++) {
      api!.updateGuides({
        xLines: [{ pos: i * 5 }],
        yLines: [{ pos: i * 7 }],
        equalSpacing: null,
      })
    }
    // Render count must NOT have increased (no setState anywhere).
    expect(renderCount).toBe(baseline)
  })

  it('SG8: clear() hides all visible slots', () => {
    let api: SmartGuideOverlayHandle | null = null
    render(<Harness onMount={(a) => { api = a }} />)
    api!.updateGuides({
      xLines: [{ pos: 100 }, { pos: 200 }],
      yLines: [{ pos: 300 }],
      equalSpacing: {
        gapSize: 50,
        segments: [{ from: 0, to: 50 }],
        elementIds: ['a', 'b', 'c'],
      },
    })
    api!.clear()
    for (const id of [
      'smart-guide-overlay-x',
      'smart-guide-overlay-y',
      'smart-guide-overlay-equal',
    ]) {
      const root = screen.getByTestId(id)
      const visible = Array.from(root.children).filter((c) => {
        const el = c as HTMLElement
        return el.style.display !== 'none'
      })
      expect(visible.length).toBe(0)
    }
  })

  it('SG9: root container has pointer-events:none (so guides do not block clicks)', () => {
    render(<Harness />)
    const root = screen.getByTestId('smart-guide-overlay-root')
    expect((root as HTMLElement).style.pointerEvents).toBe('none')
  })

  it("SG10: source file declares 'use client'", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../smart-guide-overlay.tsx'),
      'utf-8',
    )
    const firstNonBlank = src
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0)
    expect(firstNonBlank).toMatch(/^['"]use client['"]\s*;?$/)
  })
})
