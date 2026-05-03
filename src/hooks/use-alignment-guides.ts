'use client'

/**
 * @deprecated Phase 63 retired this hook. The replacement is the pure
 * sorted-edge-array implementation at src/lib/editor/transforms/snap-index.ts
 * (buildSnapIndex + findNearestSnap + snapWithHysteresis), wired through
 * src/components/slides/slide-preview.tsx via direct ref-based DOM updates
 * (PERF-03). Phase 66 will delete this file. Do NOT re-import.
 *
 * Migration:
 *   - Was:  const { calculateSnap, activeGuides, clearGuides } = useAlignmentGuides()
 *   - Now:  buildSnapIndex(slide, excludeIds) → snapWithHysteresis(value, edges, prev)
 *           with a SmartGuideOverlay component for the visual indicators.
 *
 * The legacy code below remains intact (not behaviorally changed) so any
 * stale test that still depends on the contract continues to compile.
 * Phase 63 Plan 04 retired the slide-preview.tsx consumer; Plan 63-05
 * verified zero production importers (DEP2 grep gate).
 */

import { useState, useCallback } from 'react'

const SNAP_THRESHOLD = 10 // reference pixels (~5 screen pixels at typical scale)

const CANVAS_CENTER_X = 540  // REF_WIDTH / 2
const CANVAS_CENTER_Y = 960  // REF_HEIGHT / 2

export interface TextBox {
  id: string           // 'hook' | 'body'
  x: number            // reference pixels (0-1080)
  y: number            // reference pixels (0-1920)
  width: number        // reference pixels
  height: number       // reference pixels
}

export interface GuideLine {
  orientation: 'horizontal' | 'vertical'
  position: number     // reference pixels
}

export interface SnapResult {
  snappedX: number
  snappedY: number
  guides: GuideLine[]
}

function snapAxis(
  edges: number[],          // dragging box edges/center for this axis
  guideSources: number[],   // snap targets for this axis
  position: number,         // current position (x or y)
): { snapped: number; matchedGuides: number[] } {
  let bestDelta: number | null = null
  let bestOffset = 0
  const matchedGuides: number[] = []

  for (const edge of edges) {
    for (const guide of guideSources) {
      const delta = Math.abs(edge - guide)
      if (delta <= SNAP_THRESHOLD) {
        if (bestDelta === null || delta < bestDelta) {
          bestDelta = delta
          bestOffset = guide - edge
        }
      }
    }
  }

  if (bestDelta !== null) {
    const snapped = position + bestOffset
    // Collect all guides that now match after snapping
    for (const edge of edges) {
      const adjustedEdge = edge + bestOffset
      for (const guide of guideSources) {
        if (Math.abs(adjustedEdge - guide) < 1 && !matchedGuides.includes(guide)) {
          matchedGuides.push(guide)
        }
      }
    }
    return { snapped, matchedGuides }
  }

  return { snapped: position, matchedGuides: [] }
}

/** @deprecated See file header. Phase 66 will delete this hook. */
export function useAlignmentGuides() {
  if (process.env.NODE_ENV === 'development') {
    // Hard runtime warning — if a future plan accidentally re-imports, dev
    // mode shouts. Silenced under test/production to avoid log noise on the
    // legacy contract tests that still exercise this hook.
    console.warn(
      'useAlignmentGuides is deprecated; use src/lib/editor/transforms/snap-index.ts. Phase 66 will delete this file.',
    )
  }
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([])

  const calculateSnap = useCallback(
    (dragging: TextBox, others: TextBox[]): SnapResult => {
      // Dragging box edges and center
      const dLeft = dragging.x
      const dRight = dragging.x + dragging.width
      const dCenterX = dragging.x + dragging.width / 2
      const dTop = dragging.y
      const dBottom = dragging.y + dragging.height
      const dCenterY = dragging.y + dragging.height / 2

      // Build guide sources for X axis
      const xSources: number[] = [CANVAS_CENTER_X]
      for (const other of others) {
        xSources.push(other.x)                         // left edge
        xSources.push(other.x + other.width)            // right edge
        xSources.push(other.x + other.width / 2)        // center
      }

      // Build guide sources for Y axis
      const ySources: number[] = [CANVAS_CENTER_Y]
      for (const other of others) {
        ySources.push(other.y)                          // top edge
        ySources.push(other.y + other.height)            // bottom edge
        ySources.push(other.y + other.height / 2)        // center
      }

      const xResult = snapAxis([dLeft, dRight, dCenterX], xSources, dragging.x)
      const yResult = snapAxis([dTop, dBottom, dCenterY], ySources, dragging.y)

      const guides: GuideLine[] = []
      for (const pos of xResult.matchedGuides) {
        guides.push({ orientation: 'vertical', position: pos })
      }
      for (const pos of yResult.matchedGuides) {
        guides.push({ orientation: 'horizontal', position: pos })
      }

      setActiveGuides(guides)

      return {
        snappedX: xResult.snapped,
        snappedY: yResult.snapped,
        guides,
      }
    },
    [],
  )

  const clearGuides = useCallback(() => {
    setActiveGuides([])
  }, [])

  return { calculateSnap, activeGuides, clearGuides }
}
