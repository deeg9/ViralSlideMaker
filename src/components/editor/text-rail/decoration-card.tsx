'use client'

/**
 * Phase 70 Plan 04 (CARD-01..05, SHAPES-06..09): right-rail Inspector for
 * the active decoration. Mirrors the v2.8 ActiveTextBoxCard composition shell
 * (`bg-[#fff0f0] border-2 border-[#3d0000]/20 focus-within:border-[#3d0000]
 * rounded-2xl`) and replaces ActiveTextBoxCard when the active selection's
 * primary id resolves to a decoration on the slide.
 *
 * Sections (top-to-bottom):
 *   1. Header — decorationLabel + ROLE label
 *   2. Fill (CARD-02) — react-colorful HexAlphaColorPicker (shape) /
 *      HexColorPicker (icon) + derived_palette swatches above +
 *      hex input. 300ms debounced commit.
 *   3. Stroke (CARD-03 + SHAPES-08) — color picker + width slider 1-8px +
 *      style enum buttons solid/dashed/dotted. SHAPE only.
 *   4. Size + position (CARD-04) — 4 numeric inputs W/H (% of canvas) and
 *      X/Y. Clamped [0, 100]; commit on blur/Enter.
 *   5. Per-shape (SHAPES-06..09):
 *        - rect → cornerRadius slider [0, 50]
 *        - polygon → points enum [5, 6, 8]
 *        - star → points enum [5, 6]
 *        - rect/circle/ellipse/star → aspect-ratio lock toggle
 *   6. Delete (trash icon, right-aligned).
 *
 * quick-260514-ks0: removed the drop-shadow + opacity controls
 * (DecorationEffects) from this card per user request — those toggles were
 * adding noise without clear user value at the current product stage.
 *
 * KBD-09 contract: every dispatch is a single-pushHistory gesture.
 *   - Color pickers: 300ms debounced commit (smooth-update UX).
 *   - Sliders (cornerRadius, strokeWidth): onMouseUp / onChangeEnd commit
 *     ONLY (NEVER per-tick).
 *   - Numeric inputs (W/H/X/Y): commit on blur / Enter.
 *   - Enum buttons (style, points, aspect-lock toggle): immediate commit
 *     (discrete user action).
 */

import { useEffect, useMemo, useState } from 'react'
import { HexAlphaColorPicker, HexColorPicker, HexColorInput } from 'react-colorful'
import { Icon } from '@/components/ui/icon'
import { decorationLabel } from '@/lib/editor/addressable-element-walkers'
import type {
  Decoration,
  DecorationStroke,
  IconDecoration,
  ShapeDecoration,
  ShapeKind,
} from '@/lib/types/decoration'
import { renderDecoration } from '@/lib/render/decoration-renderer'
import { useScrollFlash } from '@/lib/editor/use-scroll-flash'

export interface DecorationCardProps {
  decoration: Decoration
  onUpdate: (updates: Partial<Decoration>) => void
  /** Optional removal handler. Parent dispatches REMOVE_DECORATION + clears
   *  selection.primary so the ring doesn't linger on a stale id. When omitted
   *  the Delete button does not render. */
  onRemove?: () => void
  /** When provided AND the decoration is an icon, the header label becomes a
   *  clickable pill (thumbnail + name + chevron) that opens the icon picker
   *  in swap-mode. Parent is responsible for setting picker mode + dispatching
   *  UPDATE_DECORATION when the user picks a replacement. */
  onSwapIcon?: () => void
  /** Transient live-preview callback. Wired by ElementsPanel to dispatch
   *  UPDATE_DECORATION with noHistory:true so the canvas tracks per-keystroke
   *  / per-tick gestures without polluting the undo stack. The final commit
   *  still flows through `onUpdate` and pushes ONE history entry per gesture
   *  (KBD-09 invariant). */
  onPreview?: (updates: Partial<Decoration>) => void
  derivedPalette?: string[]
  /** Incrementing counter set when a decoration is clicked on the canvas.
   *  A change scrolls this card into view and flashes its highlight ring. */
  focusNonce?: number
}

const KINDS_WITH_ASPECT_LOCK: ReadonlySet<ShapeKind> = new Set([
  'rect',
  'circle',
  'ellipse',
  'star',
])
const POLYGON_POINTS = [5, 6, 8] as const
const STAR_POINTS = [5, 6] as const
const STROKE_STYLES = ['solid', 'dashed', 'dotted'] as const
const COMMIT_DEBOUNCE_MS = 300
const MAX_SWATCHES = 8

const DEFAULT_STROKE: DecorationStroke = {
  color: '#3D0000',
  width: 1,
  style: 'solid',
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n))
}

function roleLabel(d: Decoration): string {
  return d.kind === 'icon' ? 'ICON' : 'SHAPE'
}

export function DecorationCard({
  decoration: d,
  onUpdate,
  onRemove,
  onSwapIcon,
  onPreview,
  derivedPalette,
  focusNonce,
}: DecorationCardProps) {
  const { ref: flashRef, flashing } = useScrollFlash<HTMLDivElement>(focusNonce)
  const isShape = d.kind === 'shape'
  const isIcon = d.kind === 'icon'
  const liveColor = isIcon ? (d as IconDecoration).color : (d as ShapeDecoration).fill

  // ─────────────────────────────────────────────────────────────────────
  // Fill — react-colorful + 300ms debounced commit (KBD-09).
  // ─────────────────────────────────────────────────────────────────────
  const [colorDraft, setColorDraft] = useState<string>(liveColor)

  // Re-sync draft when the underlying value changes from outside (undo/redo,
  // slide switch, swatch click — which dispatches immediately and the parent
  // re-renders us with the new value).
  useEffect(() => {
    setColorDraft(liveColor)
  }, [liveColor])

  // Debounced commit. Skip when draft equals live (avoid spurious dispatch
  // on mount / external re-sync).
  useEffect(() => {
    if (colorDraft === liveColor) return
    const t = setTimeout(() => {
      const update: Partial<Decoration> = isIcon
        ? ({ color: colorDraft } as Partial<IconDecoration>)
        : ({ fill: colorDraft } as Partial<ShapeDecoration>)
      onUpdate(update)
    }, COMMIT_DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorDraft])

  // Swatches: derived_palette, capped at MAX_SWATCHES.
  // Phase 89 (BKSHELVE): brand-kit colors removed from the swatch row —
  // only the extracted derived_palette feeds it now.
  const swatches = useMemo(() => {
    const arr = [...(derivedPalette ?? [])]
    // Dedupe by lowercased hex.
    const seen = new Set<string>()
    const out: string[] = []
    for (const hex of arr) {
      const key = hex.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(hex)
      if (out.length >= MAX_SWATCHES) break
    }
    return out
  }, [derivedPalette])

  function pickSwatch(hex: string) {
    // Discrete user action — commit immediately (no debounce). Sync draft
    // so the picker UI reflects the choice.
    setColorDraft(hex)
    const update: Partial<Decoration> = isIcon
      ? ({ color: hex } as Partial<IconDecoration>)
      : ({ fill: hex } as Partial<ShapeDecoration>)
    onUpdate(update)
  }

  // ─────────────────────────────────────────────────────────────────────
  // Position numeric inputs — commit on blur / Enter (KBD-09).
  // ─────────────────────────────────────────────────────────────────────
  const [aspectLocked, setAspectLocked] = useState(false)

  function commitPositionField(
    field: 'width' | 'height' | 'x' | 'y',
    raw: string,
  ) {
    const n = Number(raw)
    if (!Number.isFinite(n)) return // revert (no dispatch)
    const value = clampPct(n)
    const nextPosition = { ...d.position, [field]: value }
    // Aspect-lock: when on AND editing W/H AND shape kind ∈ {rect, circle,
    // ellipse, star}, scale the OTHER axis to preserve ratio.
    if (
      aspectLocked &&
      d.kind === 'shape' &&
      KINDS_WITH_ASPECT_LOCK.has((d as ShapeDecoration).shapeKind) &&
      (field === 'width' || field === 'height')
    ) {
      const startW = d.position.width
      const startH = d.position.height
      if (field === 'width' && startW > 0) {
        nextPosition.height = clampPct(startH * (value / startW))
      } else if (field === 'height' && startH > 0) {
        nextPosition.width = clampPct(startW * (value / startH))
      }
    }
    onUpdate({ position: nextPosition })
  }

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={flashRef}
      className={`bg-[#fff0f0] border-2 border-[#3d0000]/20 focus-within:border-[#3d0000] rounded-2xl p-5 space-y-4 transition ${
        flashing ? 'ring-4 ring-[#3d0000]/60 ring-offset-2 ring-offset-[#fff0f0]' : ''
      }`}
      data-testid="decoration-card"
      data-kind={d.kind}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]"
          data-testid="decoration-card-role"
        >
          {roleLabel(d)}
        </span>
        {isIcon && onSwapIcon ? (
          <button
            type="button"
            onClick={onSwapIcon}
            data-testid="decoration-card-swap-icon"
            aria-label={`Swap ${decorationLabel(d)} for a different icon`}
            className="group flex items-center gap-1.5 max-w-[70%] rounded-full border border-[#dbc1bc]/40 bg-[#fdf7f2] hover:bg-[#fff0f0] hover:border-[#3d0000]/40 px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000]/40"
          >
            <span
              style={{ position: 'relative', width: 16, height: 16, flexShrink: 0 }}
              aria-hidden="true"
            >
              {renderDecoration(
                { ...(d as IconDecoration), position: { x: 0, y: 0, width: 100, height: 100 } },
                {},
              )}
            </span>
            <span
              className="text-xs font-bold text-[#3d0000] truncate"
              data-testid="decoration-card-label"
            >
              {decorationLabel(d)}
            </span>
            <span
              className="text-[#7d6161] group-hover:text-[#3d0000] text-xs leading-none flex-shrink-0"
              aria-hidden="true"
            >
              ▾
            </span>
          </button>
        ) : (
          <span
            className="text-xs font-bold text-[#3d0000] truncate max-w-[60%]"
            data-testid="decoration-card-label"
          >
            {decorationLabel(d)}
          </span>
        )}
      </div>

      {/* Fill */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          {isIcon ? 'Color' : 'Fill'}
        </span>
        {swatches.length > 0 && (
          <div className="flex gap-2 flex-wrap" data-testid="decoration-fill-swatches">
            {swatches.map((hex) => (
              <button
                key={hex}
                type="button"
                data-testid={`decoration-fill-swatch-${hex}`}
                aria-label={`Use ${hex}`}
                onClick={() => pickSwatch(hex)}
                style={{ backgroundColor: hex }}
                className={`w-6 h-6 rounded-full border ${
                  liveColor.toLowerCase() === hex.toLowerCase()
                    ? 'ring-2 ring-[#3d0000] ring-offset-1'
                    : 'border-[#dbc1bc]/30'
                }`}
                title={hex}
              />
            ))}
          </div>
        )}
        <div data-testid="decoration-fill-picker">
          {isShape ? (
            <HexAlphaColorPicker color={colorDraft} onChange={setColorDraft} />
          ) : (
            <HexColorPicker color={colorDraft} onChange={setColorDraft} />
          )}
        </div>
        <HexColorInput
          data-testid="decoration-fill-hex-input"
          color={colorDraft}
          onChange={setColorDraft}
          prefixed
          alpha={isShape}
          className="w-full bg-white border border-[#dbc1bc]/30 focus:border-[#3d0000] rounded-lg px-3 py-2 text-xs text-[#3d0000] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#3d0000] focus:ring-offset-1"
        />
      </div>

      {/* Stroke (shape only) */}
      {isShape && (
        <ShapeStrokeControls
          decoration={d as ShapeDecoration}
          onUpdate={onUpdate}
        />
      )}

      {/* Size + position */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Size & position
        </span>
        <div className="grid grid-cols-2 gap-2">
          <PositionField
            label="W"
            testid="decoration-input-w"
            initial={d.position.width}
            onCommit={(raw) => commitPositionField('width', raw)}
            onPreview={
              onPreview
                ? (value) => onPreview({ position: { ...d.position, width: value } })
                : undefined
            }
          />
          <PositionField
            label="H"
            testid="decoration-input-h"
            initial={d.position.height}
            onCommit={(raw) => commitPositionField('height', raw)}
            onPreview={
              onPreview
                ? (value) => onPreview({ position: { ...d.position, height: value } })
                : undefined
            }
          />
          <PositionField
            label="X"
            testid="decoration-input-x"
            initial={d.position.x}
            onCommit={(raw) => commitPositionField('x', raw)}
            onPreview={
              onPreview
                ? (value) => onPreview({ position: { ...d.position, x: value } })
                : undefined
            }
          />
          <PositionField
            label="Y"
            testid="decoration-input-y"
            initial={d.position.y}
            onCommit={(raw) => commitPositionField('y', raw)}
            onPreview={
              onPreview
                ? (value) => onPreview({ position: { ...d.position, y: value } })
                : undefined
            }
          />
        </div>
        {/* Aspect-ratio lock toggle (rect/circle/ellipse/star only) */}
        {d.kind === 'shape' &&
          KINDS_WITH_ASPECT_LOCK.has((d as ShapeDecoration).shapeKind) && (
            <button
              type="button"
              data-testid="decoration-aspect-lock"
              aria-pressed={aspectLocked}
              onClick={() => setAspectLocked((v) => !v)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                aspectLocked
                  ? 'bg-[#3d0000] text-white'
                  : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb] border border-[#dbc1bc]/30'
              }`}
            >
              {aspectLocked ? 'Aspect locked' : 'Lock aspect'}
            </button>
          )}
      </div>

      {/* CARD-06: Rotation numeric input. Range -180..180; commits on blur/Enter
          (KBD-09 carry-forward — NEVER per-keystroke). Round-trips with the
          canvas drag handle (DecorationRotationHandle / Plan 72-02 Task 2):
          handle drag commits via BULK_ROTATE; this input commits via the
          existing onUpdate({rotation}) → UPDATE_DECORATION channel. Both
          produce single pushHistory entries per gesture. */}
      <RotationField
        rotation={typeof d.rotation === 'number' ? d.rotation : 0}
        onCommit={(rotation) => onUpdate({ rotation })}
        onPreview={onPreview ? (rotation) => onPreview({ rotation }) : undefined}
      />

      {/* Per-shape extras */}
      {d.kind === 'shape' && (
        <PerShapeControls decoration={d as ShapeDecoration} onUpdate={onUpdate} />
      )}

      {/* Delete — small trash icon, right-aligned. Single dispatch via the
          parent's REMOVE_DECORATION channel (KBD-09 — one history entry per
          gesture). quick-260514-ks0: replaced the "Delete shape/icon" pill
          with an icon-only button; drop-shadow + opacity controls removed
          from this card per the same task. */}
      {onRemove && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            data-testid="decoration-card-delete"
            aria-label={`Delete ${roleLabel(d) === 'ICON' ? 'icon' : 'shape'}`}
            title={`Delete ${roleLabel(d) === 'ICON' ? 'icon' : 'shape'}`}
            className="p-2 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Icon name="delete" size="sm" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PositionField — local controlled-uncontrolled hybrid. Holds a string draft;
// commits on blur OR Enter. Resets draft when `initial` changes from outside.
// ─────────────────────────────────────────────────────────────────────────────
function PositionField({
  label,
  testid,
  initial,
  onCommit,
  onPreview,
}: {
  label: string
  testid: string
  initial: number
  onCommit: (raw: string) => void
  /** Optional per-keystroke preview callback. Called with the parsed
   *  numeric value when the draft is finite + in-range. Caller is expected
   *  to dispatch with noHistory:true so the canvas tracks live without
   *  polluting the undo stack. */
  onPreview?: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(Math.round(initial)))
  useEffect(() => {
    setDraft(String(Math.round(initial)))
  }, [initial])

  function commit() {
    onCommit(draft)
    // Reset draft on commit failure (non-numeric) — onCommit is a no-op in
    // that case, and `initial` won't change, so the effect above doesn't
    // re-sync. Force reset here.
    if (!Number.isFinite(Number(draft))) {
      setDraft(String(Math.round(initial)))
    }
  }

  function handleChange(next: string) {
    setDraft(next)
    if (!onPreview) return
    const n = Number(next)
    if (!Number.isFinite(n)) return
    onPreview(clampPct(n))
  }

  return (
    <label className="flex items-stretch overflow-hidden rounded-lg border border-[#dbc1bc]/30 bg-white focus-within:border-[#3d0000] focus-within:ring-2 focus-within:ring-[#3d0000]/20">
      <span className="flex items-center justify-center px-2.5 bg-[#fff0f0] border-r border-[#dbc1bc]/30 text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        data-testid={testid}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        className="flex-1 min-w-0 px-2 py-1.5 text-xs text-[#3d0000] tabular-nums focus:outline-none bg-transparent"
      />
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RotationField (CARD-06) — Phase 72 Plan 02. Numeric rotation input with
// commit-on-blur/Enter, [-180, 180] clamp, and round-trip prop re-sync. Mirrors
// the PositionField shape so the visual/interaction grammar is identical to
// W/H/X/Y. Empty input = no-op revert (don't dispatch). Out-of-range = clamp
// BEFORE dispatch (T-72-03 mitigation — defense-in-depth against future
// non-React dispatch sources at the reducer boundary).
// ─────────────────────────────────────────────────────────────────────────────
function RotationField({
  rotation,
  onCommit,
  onPreview,
}: {
  rotation: number
  onCommit: (rotation: number) => void
  /** Optional per-keystroke preview callback. Mirrors PositionField — called
   *  with the clamped numeric value when the draft is finite. Caller dispatches
   *  with noHistory:true so live typing doesn't pollute undo. */
  onPreview?: (rotation: number) => void
}) {
  const [draft, setDraft] = useState<string>(String(Math.round(rotation)))

  // Round-trip: re-sync draft when the prop changes (handle drag commits etc).
  useEffect(() => {
    setDraft(String(Math.round(rotation)))
  }, [rotation])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed === '') {
      // Revert to current value — never dispatch on empty input.
      setDraft(String(Math.round(rotation)))
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      setDraft(String(Math.round(rotation)))
      return
    }
    const clamped = Math.max(-180, Math.min(180, parsed))
    if (clamped === rotation) {
      // No-op when value unchanged — don't pollute history.
      setDraft(String(Math.round(rotation)))
      return
    }
    onCommit(clamped)
    setDraft(String(clamped))
  }

  function handleChange(next: string) {
    setDraft(next)
    if (!onPreview) return
    const n = Number(next.trim())
    if (!Number.isFinite(n)) return
    onPreview(Math.max(-180, Math.min(180, n)))
  }

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
        Rotation (°)
      </span>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-stretch overflow-hidden rounded-lg border border-[#dbc1bc]/30 bg-white focus-within:border-[#3d0000] focus-within:ring-2 focus-within:ring-[#3d0000]/20">
          <span
            className="flex items-center justify-center px-2.5 bg-[#fff0f0] border-r border-[#dbc1bc]/30 text-xs text-[#7d6161]"
            aria-hidden="true"
          >
            ↻
          </span>
          <input
            type="number"
            min={-180}
            max={180}
            step={1}
            data-testid="decoration-input-rotation"
            aria-label="Decoration rotation in degrees"
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
            }}
            className="flex-1 min-w-0 px-2 py-1.5 text-xs text-[#3d0000] tabular-nums focus:outline-none bg-transparent"
          />
        </label>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ShapeStrokeControls (CARD-03 + SHAPES-08)
// ─────────────────────────────────────────────────────────────────────────────
function ShapeStrokeControls({
  decoration: d,
  onUpdate,
}: {
  decoration: ShapeDecoration
  onUpdate: (updates: Partial<Decoration>) => void
}) {
  const stroke = d.stroke ?? DEFAULT_STROKE
  const [colorDraft, setColorDraft] = useState<string>(stroke.color)

  useEffect(() => {
    setColorDraft(stroke.color)
  }, [stroke.color])

  useEffect(() => {
    if (colorDraft === stroke.color) return
    const t = setTimeout(() => {
      onUpdate({ stroke: { ...stroke, color: colorDraft } })
    }, COMMIT_DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorDraft])

  function commitWidth(raw: string | number) {
    const n = typeof raw === 'string' ? Number(raw) : raw
    if (!Number.isFinite(n)) return
    const w = Math.max(1, Math.min(8, Math.round(n)))
    onUpdate({ stroke: { ...stroke, width: w } })
  }

  return (
    <div className="space-y-2" data-testid="decoration-stroke-section">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
        Stroke
      </span>
      <HexColorInput
        data-testid="decoration-stroke-hex-input"
        color={colorDraft}
        onChange={setColorDraft}
        prefixed
        className="w-full bg-white border border-[#dbc1bc]/30 focus:border-[#3d0000] rounded-lg px-3 py-2 text-xs text-[#3d0000] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#3d0000] focus:ring-offset-1"
      />
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Width
          </span>
          <span className="text-[10px] font-bold text-[#3d0000]">{stroke.width}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          defaultValue={stroke.width}
          // Commit on mouseup ONLY (KBD-09).
          onMouseUp={(e) => commitWidth(e.currentTarget.value)}
          onTouchEnd={(e) => commitWidth((e.currentTarget as HTMLInputElement).value)}
          data-testid="decoration-stroke-width"
          aria-label="Stroke width"
          className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
        />
      </div>
      <div className="flex gap-2">
        {STROKE_STYLES.map((style) => (
          <button
            key={style}
            type="button"
            data-testid={`decoration-stroke-style-${style}`}
            aria-pressed={stroke.style === style}
            onClick={() => onUpdate({ stroke: { ...stroke, style } })}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              stroke.style === style
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
          >
            {style}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PerShapeControls (SHAPES-06, SHAPES-07)
// ─────────────────────────────────────────────────────────────────────────────
function PerShapeControls({
  decoration: d,
  onUpdate,
}: {
  decoration: ShapeDecoration
  onUpdate: (updates: Partial<Decoration>) => void
}) {
  return (
    <div className="space-y-2">
      {d.shapeKind === 'rect' && (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
              Corner radius
            </span>
            <span className="text-[10px] font-bold text-[#3d0000]">
              {d.cornerRadius ?? 0}px
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            defaultValue={d.cornerRadius ?? 0}
            // Commit on mouseup ONLY (KBD-09).
            onMouseUp={(e) => {
              const n = Number(e.currentTarget.value)
              if (!Number.isFinite(n)) return
              onUpdate({ cornerRadius: Math.max(0, Math.min(50, n)) })
            }}
            onTouchEnd={(e) => {
              const n = Number((e.currentTarget as HTMLInputElement).value)
              if (!Number.isFinite(n)) return
              onUpdate({ cornerRadius: Math.max(0, Math.min(50, n)) })
            }}
            data-testid="decoration-corner-radius"
            aria-label="Corner radius"
            className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
          />
        </div>
      )}
      {d.shapeKind === 'polygon' && (
        <PointsEnum
          options={POLYGON_POINTS}
          current={d.points}
          onPick={(n) => onUpdate({ points: n })}
        />
      )}
      {d.shapeKind === 'star' && (
        <PointsEnum
          options={STAR_POINTS}
          current={d.points}
          onPick={(n) => onUpdate({ points: n })}
        />
      )}
    </div>
  )
}

function PointsEnum({
  options,
  current,
  onPick,
}: {
  options: ReadonlyArray<number>
  current: number | undefined
  onPick: (n: number) => void
}) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
        Points
      </span>
      <div className="flex gap-2">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`decoration-points-${n}`}
            aria-pressed={current === n}
            onClick={() => onPick(n)}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              current === n
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
