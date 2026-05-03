'use client'

/**
 * Phase 63 Plan 02 (ALIGN-06, ALIGN-07): Floating Alignment Toolbar.
 *
 * Renders a Figma-style toolbar above (or below, when clamped) the multi-
 * select union AABB with 6 align buttons + 2 distribute buttons. Caller
 * (slide-preview.tsx editable={true} branch) is responsible for the structural
 * TPLREND-05 / PARITY-01 gate — this component does not check `editable` itself.
 *
 * Render gate (component-internal):
 *   - selectionCount < 2 → returns null (single-select uses keyboard align-to-canvas).
 *   - bounds === null → returns null (defensive — caller already filtered, but
 *     duplicate guard avoids accidental NaN style values).
 *
 * Distribute disable (ALIGN-06):
 *   - selectionCount < 3 → distribute buttons carry `disabled` + tooltip
 *     "Select 3+ elements to distribute". Click is a no-op (disabled
 *     `<button>` swallows onClick natively).
 *
 * Dispatch contract:
 *   - Caller passes `onAction(action)`; this component calls it with
 *     `{ kind: 'align', axis }` or `{ kind: 'distribute', axis }`. The caller
 *     (slide-editor.tsx handleAlign callback) is responsible for resolving
 *     N=1→canvas vs N>=2→selection target and dispatching ALIGN/DISTRIBUTE.
 *     This separation keeps the toolbar pure-display.
 *
 * Positioning:
 *   - Position is expressed as % of canvas (REF coordinate system 1080×1920).
 *     Inline style `position: absolute; left: X%; top: Y%` so the toolbar
 *     stays correctly placed under any CSS scale of the parent canvas.
 *   - Default: ABOVE bounds (top = bounds.y - TOOLBAR_HEIGHT_PCT - 1).
 *   - Clamp: when top < 0 (no room above), drop BELOW (top = bounds.y + bounds.height + 1).
 *   - Horizontal: centered above bounds AABB; clamped to [0, canvasWidthPct - TOOLBAR_WIDTH_PCT].
 *
 * No key-object UX (PITFALL-12.3): no "primary" or "key object" affordance.
 * Multi-select alignment uses union-bounds math, not a key element.
 */

import {
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react'
import type { AlignAxis, DistributeAxis } from '@/lib/editor/transforms/align'
import type { AABB } from '@/lib/editor/transforms/selection-bounds'

export type ToolbarAction =
  | { kind: 'align'; axis: AlignAxis }
  | { kind: 'distribute'; axis: DistributeAxis }

export interface FloatingAlignmentToolbarProps {
  /** Number of currently selected ids. Toolbar is hidden when < 2. */
  selectionCount: number
  /** Union AABB of the current selection in % of canvas. Null hides the toolbar. */
  bounds: AABB | null
  /** Caller-provided action handler. Component is pure-display. */
  onAction: (action: ToolbarAction) => void
  /** Canvas width in % (typically 100). Used to clamp horizontal position. */
  canvasWidthPct: number
  /** Canvas height in % (typically 100). Reserved for future bottom-edge clamps. */
  canvasHeightPct: number
}

// Toolbar dimensions in % of canvas. Sized so the bar stays readable at the
// editor's typical preview scale (~30% horizontal, ~4% vertical of a 1080×1920
// canvas ≈ 324×77 px at 1:1, scaled down with the canvas).
const TOOLBAR_WIDTH_PCT = 30
const TOOLBAR_HEIGHT_PCT = 4

// Phase 66 Plan 02 (KBD-08): tooltip shortcut hints. Each align/distribute
// button's `title` attribute embeds the matching keyboard shortcut so power
// users discover it on hover. We use the LITERAL spelling ("Alt+A",
// "Cmd+Alt+H") rather than the ⌘ / ⌥ symbols to match the alignment
// shortcut research literature (Figma + Canva docs use literal in
// tooltips; symbol form is for menu bars). The layers panel uses the
// symbol form (⌘⇧L) — documented divergence; both styles are valid and
// tests accept either via a regex gate.
// aria-label is UNCHANGED (no shortcut embedded) so screen readers don't
// read the keystroke twice.

interface AlignButtonSpec {
  axis: AlignAxis
  label: string
  shortcut: string
  Icon: typeof AlignLeft
}

const ALIGN_BUTTONS: AlignButtonSpec[] = [
  { axis: 'left', label: 'Align left', shortcut: 'Alt+A', Icon: AlignLeft },
  { axis: 'center-h', label: 'Align horizontal center', shortcut: 'Alt+H', Icon: AlignCenterHorizontal },
  { axis: 'right', label: 'Align right', shortcut: 'Alt+D', Icon: AlignRight },
  { axis: 'top', label: 'Align top', shortcut: 'Alt+W', Icon: AlignStartHorizontal },
  { axis: 'center-v', label: 'Align vertical center', shortcut: 'Alt+V', Icon: AlignCenterVertical },
  { axis: 'bottom', label: 'Align bottom', shortcut: 'Alt+S', Icon: AlignEndHorizontal },
]

interface DistributeButtonSpec {
  axis: DistributeAxis
  label: string
  shortcut: string
  Icon: typeof AlignHorizontalDistributeCenter
}

const DISTRIBUTE_BUTTONS: DistributeButtonSpec[] = [
  { axis: 'horizontal', label: 'Distribute horizontally', shortcut: 'Cmd+Alt+H', Icon: AlignHorizontalDistributeCenter },
  { axis: 'vertical', label: 'Distribute vertically', shortcut: 'Cmd+Alt+V', Icon: AlignVerticalDistributeCenter },
]

const DISTRIBUTE_DISABLED_HINT = 'Select 3+ elements to distribute'

function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo
  if (value > hi) return hi
  return value
}

export function FloatingAlignmentToolbar({
  selectionCount,
  bounds,
  onAction,
  canvasWidthPct,
  canvasHeightPct: _canvasHeightPct,
  // canvasHeightPct intentionally unused — reserved for symmetric bottom clamps.
}: FloatingAlignmentToolbarProps) {
  // Render gate (FT1, FT2, FT2b).
  if (selectionCount < 2 || !bounds) return null

  const distributeDisabled = selectionCount < 3

  // Horizontal: center the toolbar over the bounds, clamp to canvas.
  const rawLeft = bounds.x + bounds.width / 2 - TOOLBAR_WIDTH_PCT / 2
  const left = clamp(rawLeft, 0, canvasWidthPct - TOOLBAR_WIDTH_PCT)

  // Vertical: prefer above; drop below when no room.
  const aboveTop = bounds.y - TOOLBAR_HEIGHT_PCT - 1
  const top =
    aboveTop < 0 ? bounds.y + bounds.height + 1 : aboveTop

  return (
    <div
      data-testid="floating-alignment-toolbar"
      role="toolbar"
      aria-label="Alignment"
      style={{
        position: 'absolute',
        left: `${left}%`,
        top: `${top}%`,
        width: `${TOOLBAR_WIDTH_PCT}%`,
        height: `${TOOLBAR_HEIGHT_PCT}%`,
        // Pointer-events:auto overrides any pointer-events:none on parent
        // chrome (e.g. multi-selection-ring at slide-preview.tsx:2223).
        pointerEvents: 'auto',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4%',
        padding: '0 8%',
        background: '#fff',
        border: '1px solid rgba(61, 0, 0, 0.12)',
        borderRadius: '999px',
        boxShadow: '0 4px 12px rgba(61, 0, 0, 0.10)',
        // Buttons render at a constant logical px size; the canvas-scale
        // transform on the parent shrinks/grows them with the rest of the chrome.
      }}
    >
      {ALIGN_BUTTONS.map(({ axis, label, shortcut, Icon }) => (
        <button
          key={`align-${axis}`}
          type="button"
          data-testid={`align-${axis}`}
          aria-label={label}
          title={`${label} (${shortcut})`}
          onClick={() => onAction({ kind: 'align', axis })}
          style={{
            flex: '1 1 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: '#3d0000',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}

      {/* Subtle visual divider between align + distribute groups. */}
      <span
        aria-hidden="true"
        style={{
          width: 1,
          alignSelf: 'stretch',
          background: 'rgba(61, 0, 0, 0.12)',
        }}
      />

      {DISTRIBUTE_BUTTONS.map(({ axis, label, shortcut, Icon }) => {
        // KBD-08: tooltip embeds shortcut even when disabled, so power users
        // still learn the keystroke. aria-label keeps the disabled hint as
        // its primary content (screen-reader friendly state announcement)
        // while sighted users see the shortcut in the title popover.
        const baseTip = `${label} (${shortcut})`
        const tooltip = distributeDisabled
          ? `${baseTip} — ${DISTRIBUTE_DISABLED_HINT}`
          : baseTip
        return (
          <button
            key={`distribute-${axis}`}
            type="button"
            data-testid={`distribute-${axis}`}
            aria-label={distributeDisabled ? DISTRIBUTE_DISABLED_HINT : label}
            title={tooltip}
            disabled={distributeDisabled}
            onClick={() => onAction({ kind: 'distribute', axis })}
            style={{
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: distributeDisabled ? 'rgba(61, 0, 0, 0.35)' : '#3d0000',
              cursor: distributeDisabled ? 'not-allowed' : 'pointer',
              padding: 0,
            }}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
