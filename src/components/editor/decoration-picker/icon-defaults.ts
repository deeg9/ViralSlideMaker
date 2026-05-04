/**
 * PICKER (Phase 70 Plan 02 Task 1): default IconDecoration factory.
 *
 * Single source of truth for "what does a brand-new icon decoration look
 * like when a user clicks an Insert tile" — consumed by:
 *   - LucidePicker (this plan)            : grid tile click handler
 *   - I keyboard shortcut (Plan 70-03)    : direct-insert path (KBD-11)
 *   - DecorationCard (Plan 70-04)         : reset-to-defaults baseline
 *
 * Mirrors shape-defaults.ts's contract for symmetry across the picker family.
 *
 * Closed-enum guard (T-70-09 STRIDE mitigation): unknown lucideName returns
 * null. The picker UI only ever calls with names from LUCIDE_PICKER_CORPUS
 * (subset of LUCIDE_DECORATION_ALLOWLIST), so the null branch is defensive —
 * it catches any future drift between the picker corpus build and the
 * Phase 69-01 registry allowlist.
 *
 * Color: brand primary `#3D0000` (matches DEFAULT_SHAPE_FILL). Stroke width 2
 * is the Lucide library default (locked here so the picker tile preview
 * matches the canvas-rendered output byte-identically — TPLREND-05).
 *
 * NEVER returns 'currentColor', CSS named colors, or CSS variables — always
 * an explicit 6-digit hex string per Phase 67 PCL12 contract.
 */
import type { IconDecoration } from '@/lib/types/decoration'
import { isAllowedLucideName } from '@/lib/render/decorations/registry'

/** Brand primary; matches shape-defaults DEFAULT_SHAPE_FILL. */
export const DEFAULT_ICON_COLOR = '#3D0000'

/** Default bounding box (12% × 12%) — readable at slide-preview scale, not so
 *  large it dominates the canvas. */
export const DEFAULT_ICON_SIZE_PCT = { width: 12, height: 12 } as const

/** Lucide library default. Range 1..3 typical (Phase 67 IconDecoration spec). */
export const DEFAULT_ICON_STROKE_WIDTH = 2

interface BuildOpts {
  /** Slide-percent center (0..100). Defaults to slide geometric center (50,50). */
  center?: { x: number; y: number }
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value))
}

/**
 * Build a brand-new IconDecoration with sensible defaults. The returned id
 * is freshly minted via `crypto.randomUUID()` per call — never reuse one.
 *
 * Returns null if `lucideName` is not in the closed-enum allowlist (defensive
 * — picker corpus is built from the same allowlist).
 */
export function buildDefaultIconDecoration(
  lucideName: string,
  opts?: BuildOpts,
): IconDecoration | null {
  if (!isAllowedLucideName(lucideName)) return null

  const center = opts?.center ?? { x: 50, y: 50 }
  const w = DEFAULT_ICON_SIZE_PCT.width
  const h = DEFAULT_ICON_SIZE_PCT.height

  const x = clamp(center.x - w / 2, 0, 100 - w)
  const y = clamp(center.y - h / 2, 0, 100 - h)

  return {
    id: crypto.randomUUID(),
    kind: 'icon',
    lucideName,
    color: DEFAULT_ICON_COLOR,
    strokeWidth: DEFAULT_ICON_STROKE_WIDTH,
    position: { x, y, width: w, height: h },
    opacity: 1,
  }
}
