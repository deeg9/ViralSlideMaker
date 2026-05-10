'use client'

// Phase 76 Plan 02 (PREVIEW-04):
// Pure SVG schematic — 9:16 frame indicating hook position, body density,
// and decoration density. NOT a full slide preview render.
//
// Deterministic positions (no Math.random) so tests are stable.

import type { StyleSpecLayout, StyleSpecDecorations } from '@/lib/types/style-spec'

export interface LayoutSketchProps {
  layout: StyleSpecLayout
  decorationsDensity?: StyleSpecDecorations['density']
}

// Hook rect y-coordinate by position. Bands: top 10–40, center 60–90, bottom 110–140.
const HOOK_Y: Record<NonNullable<StyleSpecLayout['hookPosition']>, number> = {
  top: 15,
  center: 70,
  bottom: 115,
}
const HOOK_HEIGHT = 25

// Body line counts by density.
const BODY_LINE_COUNT: Record<NonNullable<StyleSpecLayout['density']>, number> = {
  tight: 5,
  medium: 3,
  airy: 1,
}

// Decoration icon counts by density.
const DECORATION_COUNT: Record<NonNullable<StyleSpecDecorations['density']>, number> = {
  sparse: 0,
  moderate: 2,
  dense: 4,
}

// Decoration positions are deterministic — fixed corners/edges per index.
// Up to 4 positions used by 'dense'.
const DECORATION_POSITIONS: Array<{ cx: number; cy: number }> = [
  { cx: 78, cy: 12 },
  { cx: 12, cy: 12 },
  { cx: 78, cy: 148 },
  { cx: 12, cy: 148 },
]

export function LayoutSketch({ layout, decorationsDensity }: LayoutSketchProps) {
  const hookY = layout.hookPosition ? HOOK_Y[layout.hookPosition] : null
  const bodyLineCount = layout.density ? BODY_LINE_COUNT[layout.density] : 0
  const decorationCount = decorationsDensity ? DECORATION_COUNT[decorationsDensity] : 0

  // Body line vertical band: place lines below the hook rect (or in middle if no hook).
  // Use a fixed band y=85..145 split evenly across the count.
  const bodyBandTop = 85
  const bodyBandBottom = 145
  const bodyBandHeight = bodyBandBottom - bodyBandTop
  const bodyLineXStart = 14
  const bodyLineXEnd = 76

  return (
    <div className="space-y-1">
      <span className="text-[12px] font-semibold text-[#3d0000]">Layout</span>
      <svg
        data-testid="layout-sketch-svg"
        viewBox="0 0 90 160"
        role="img"
        aria-label="Layout sketch — schematic preview"
        className="block h-32 w-auto"
      >
        {/* Frame outline */}
        <rect
          data-testid="frame-outline"
          x={0}
          y={0}
          width={90}
          height={160}
          fill="none"
          stroke="#3d0000"
          strokeWidth={1}
        />

        {/* Hook rect */}
        {hookY !== null && (
          <rect
            data-testid="hook-rect"
            x={10}
            y={hookY}
            width={70}
            height={HOOK_HEIGHT}
            fill="#3d0000"
            opacity={0.85}
            rx={2}
          />
        )}

        {/* Body density lines */}
        {Array.from({ length: bodyLineCount }).map((_, i) => {
          // Distribute lines evenly across the band; if count=1, place at midpoint.
          const y =
            bodyLineCount === 1
              ? bodyBandTop + bodyBandHeight / 2
              : bodyBandTop + (bodyBandHeight / (bodyLineCount + 1)) * (i + 1)
          return (
            <line
              key={`body-line-${i}`}
              data-testid="body-line"
              x1={bodyLineXStart}
              x2={bodyLineXEnd}
              y1={y}
              y2={y}
              stroke="#7d6161"
              strokeWidth={1}
              opacity={0.6}
            />
          )
        })}

        {/* Decoration icon-circles */}
        {Array.from({ length: decorationCount }).map((_, i) => {
          const pos = DECORATION_POSITIONS[i]
          return (
            <circle
              key={`deco-${i}`}
              data-testid="decoration-icon"
              cx={pos.cx}
              cy={pos.cy}
              r={3}
              fill="#3d0000"
              opacity={0.5}
            />
          )
        })}
      </svg>
    </div>
  )
}
