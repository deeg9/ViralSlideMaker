'use client'

/**
 * SHAPES-02 (Phase 70 Plan 01 Task 3): ShapePicker popover.
 *
 * 8-tile grid (4 cols × 2 rows). Each tile is an <button> that, on click,
 * dispatches a default ShapeDecoration via onAddDecoration AND closes the
 * popover via onClose.
 *
 * Mounting + isPickerOpenRef firewall + auto-select-after-dispatch are
 * Plan 70-03 concerns (slide-canvas/slide-editor toolbar wiring). This
 * component is purely presentational — `onAddDecoration` and `onClose` are
 * the two outputs the parent uses to drive reducer dispatch + the active id.
 *
 * Tile preview rendering mirrors decoration-renderer.tsx's two paths:
 *   - SVG-backed kinds (triangle, polygon, star, arrow, line) render the
 *     filled manifest variant via <img src="/shapes/{kind}.svg"> tinted by
 *     CSS color → currentColor inheritance.
 *   - CSS-div kinds (rect, circle, ellipse) render via a sized <div> with
 *     border-radius wired by shapeKind (none / 50% / horizontal-50%).
 *
 * Editor-only — never imported into Satori-path code. PCL11 chrome contract:
 * the picker DOM contains zero canvas-chrome classNames or hooks (those live
 * on the canvas, not the popover); verified by the Plan 70-01 success-grep.
 */

import { useEffect, useRef } from 'react'
import type { Decoration, ShapeKind } from '@/lib/types/decoration'
import { buildDefaultShapeDecoration } from './shape-defaults'

interface ShapeTile {
  /** Discriminator for the shape this tile inserts. */
  shapeKind: ShapeKind
  /** Human label rendered under the preview glyph. */
  label: string
  /** Override `points` passed to buildDefaultShapeDecoration (polygon/star tiles). */
  points?: number
  /** Public URL of the SVG preview, or undefined for CSS-div previews. */
  previewSrc?: string
}

/**
 * The 8 tiles displayed in the popover. Order matches Canva's small-popover
 * layout (rect/circle/ellipse first row of geometry primitives, then polygons
 * and stars and arrow/line on the second row). Polygon and star count enums
 * are owned by DecorationCard (Plan 70-04 SHAPES-07) — picker emits the
 * default 5; the user picks 6/8 via the inspector after insert.
 */
const SHAPE_TILES: ShapeTile[] = [
  { shapeKind: 'rect', label: 'Rectangle' },
  { shapeKind: 'circle', label: 'Circle' },
  { shapeKind: 'ellipse', label: 'Ellipse' },
  { shapeKind: 'triangle', label: 'Triangle', previewSrc: '/shapes/triangle.svg' },
  { shapeKind: 'polygon', label: 'Polygon', points: 5, previewSrc: '/shapes/polygon-5.svg' },
  { shapeKind: 'star', label: 'Star', points: 5, previewSrc: '/shapes/star-5.svg' },
  { shapeKind: 'arrow', label: 'Arrow', previewSrc: '/shapes/arrow.svg' },
  { shapeKind: 'line', label: 'Line', previewSrc: '/shapes/line.svg' },
]

export interface ShapePickerProps {
  open: boolean
  onClose: () => void
  onAddDecoration: (decoration: Decoration) => void
}

export function ShapePicker({ open, onClose, onAddDecoration }: ShapePickerProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Restore focus to the first tile when the popover opens — keyboard users
  // need a focused element to start arrow-navigating from.
  useEffect(() => {
    if (!open) return
    const first = dialogRef.current?.querySelector<HTMLButtonElement>(
      '[data-testid^="shape-tile-"]',
    )
    first?.focus()
  }, [open])

  if (!open) return null

  function handleTileClick(tile: ShapeTile) {
    const decoration = buildDefaultShapeDecoration(tile.shapeKind, { points: tile.points })
    onAddDecoration(decoration)
    onClose()
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="Insert shape"
      data-testid="shape-picker"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
      onClick={(e) => {
        // Prevent picker clicks from bubbling to outer dismiss handlers
        // (the parent toolbar mount in Plan 70-03 will likely wire a
        // document-level click-outside dismiss; we own the popover region).
        e.stopPropagation()
      }}
      className="absolute z-50 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg"
      style={{ minWidth: 320 }}
    >
      <div className="grid grid-cols-4 gap-2">
        {SHAPE_TILES.map((tile) => (
          <button
            key={tile.shapeKind}
            type="button"
            data-testid={`shape-tile-${tile.shapeKind}`}
            aria-label={`Insert ${tile.label.toLowerCase()}`}
            onClick={() => handleTileClick(tile)}
            className="flex flex-col items-center justify-center gap-1 rounded-md border border-transparent p-2 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ShapeTilePreview tile={tile} />
            <span className="text-xs">{tile.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Tile preview glyph. Two paths mirror decoration-renderer.tsx:
 *   - SVG-backed: <img src="/shapes/{kind}.svg"> with CSS color → currentColor inheritance
 *   - CSS-div:   shaped <div> for rect / circle / ellipse
 */
function ShapeTilePreview({ tile }: { tile: ShapeTile }) {
  if (tile.previewSrc) {
    return (
      <img
        src={tile.previewSrc}
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        className="text-neutral-700"
        style={{ color: 'currentColor' }}
      />
    )
  }

  // CSS-div previews — sized 32×32, brand-fill so the tile reads at a glance.
  // The decoration this tile actually inserts uses DEFAULT_SHAPE_FILL; this
  // is just the menu glyph color (intentionally distinct from the dispatched
  // decoration's fill so a future themed picker can re-color tiles freely).
  let radius: string | number | undefined
  let width = 32
  let height = 32
  if (tile.shapeKind === 'circle') {
    radius = '50%'
  } else if (tile.shapeKind === 'ellipse') {
    radius = '50%'
    height = 22
  }

  return (
    <div
      data-shape-preview={tile.shapeKind}
      style={{
        width,
        height,
        backgroundColor: 'currentColor',
        borderRadius: radius,
      }}
    />
  )
}
