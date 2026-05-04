'use client'

/**
 * Phase 70 Plan 04 (CARD-05): drop shadow + opacity sub-component for the
 * DecorationCard right-rail Inspector. Extracted from decoration-card.tsx
 * to keep each file under the context budget.
 *
 * KBD-09 contract: every dispatch is a single-pushHistory gesture.
 *   - Shadow color picker: 300ms debounced commit (mirror Task 2 fill picker).
 *   - Shadow size enum: discrete click → immediate dispatch.
 *   - Shadow toggle: discrete click → immediate dispatch.
 *   - Opacity slider: onMouseUp / onTouchEnd commit ONLY (NEVER per-tick).
 *
 * WR-01 contract (Phase 67): UI shows 0-100% but storage is 0..1. The
 * decoration renderer (Phase 69) reads d.opacity directly as CSS opacity —
 * this component multiplies/divides by 100 strictly at the UI boundary.
 */

import { useEffect, useState } from 'react'
import { HexAlphaColorPicker, HexColorInput } from 'react-colorful'
import type {
  Decoration,
  DecorationEffects as DecorationEffectsT,
  DecorationShadowEffect,
} from '@/lib/types/decoration'

export interface DecorationEffectsProps {
  decoration: Decoration
  onUpdate: (updates: Partial<Decoration>) => void
}

const SHADOW_SIZES = ['sm', 'md', 'lg'] as const
const DEFAULT_SHADOW: DecorationShadowEffect = {
  enabled: true,
  color: '#00000080',
  size: 'md',
}
const COMMIT_DEBOUNCE_MS = 300

export function DecorationEffects({
  decoration: d,
  onUpdate,
}: DecorationEffectsProps) {
  const shadow = d.effects?.shadow
  const shadowOn = shadow?.enabled === true
  const opacityPct = Math.round((d.opacity ?? 1) * 100)

  // Debounced shadow color draft. The HexAlphaColorPicker fires onChange on
  // every drag tick; we commit ONCE after 300ms of idle (KBD-09).
  const [shadowColorDraft, setShadowColorDraft] = useState<string>(
    shadow?.color ?? DEFAULT_SHADOW.color,
  )

  // Re-sync draft when the underlying shadow color changes from outside
  // (e.g., undo/redo, slide switch).
  useEffect(() => {
    setShadowColorDraft(shadow?.color ?? DEFAULT_SHADOW.color)
  }, [shadow?.color])

  // Debounced commit. Skip when draft equals the live value (avoids spurious
  // dispatch on initial mount or external re-sync).
  useEffect(() => {
    const live = shadow?.color ?? DEFAULT_SHADOW.color
    if (shadowColorDraft === live) return
    const t = setTimeout(() => {
      onUpdate({
        effects: {
          ...(d.effects ?? {}),
          shadow: {
            ...(shadow ?? DEFAULT_SHADOW),
            color: shadowColorDraft,
          },
        },
      })
    }, COMMIT_DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadowColorDraft])

  function setShadow(partial: Partial<DecorationShadowEffect>) {
    const nextEffects: DecorationEffectsT = {
      ...(d.effects ?? {}),
      shadow: {
        ...(shadow ?? DEFAULT_SHADOW),
        ...partial,
      },
    }
    onUpdate({ effects: nextEffects })
  }

  function commitOpacity(raw: string | number) {
    const n = typeof raw === 'string' ? Number(raw) : raw
    if (!Number.isFinite(n)) return
    const clamped = Math.max(0, Math.min(100, n))
    onUpdate({ opacity: clamped / 100 })
  }

  return (
    <div className="space-y-3" data-testid="decoration-effects">
      {/* Drop shadow */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Drop shadow
          </span>
          <button
            type="button"
            data-testid="decoration-shadow-toggle"
            aria-pressed={shadowOn}
            onClick={() => setShadow({ enabled: !shadowOn })}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              shadowOn
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
          >
            {shadowOn ? 'On' : 'Off'}
          </button>
        </div>
        {shadowOn && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {SHADOW_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  data-testid={`decoration-shadow-size-${size}`}
                  aria-pressed={shadow?.size === size}
                  onClick={() => setShadow({ size })}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    shadow?.size === size
                      ? 'bg-[#3d0000] text-white'
                      : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
                  }`}
                >
                  {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
                </button>
              ))}
            </div>
            <div data-testid="decoration-shadow-color-picker">
              <HexAlphaColorPicker
                color={shadowColorDraft}
                onChange={setShadowColorDraft}
              />
            </div>
            <HexColorInput
              data-testid="decoration-shadow-hex-input"
              color={shadowColorDraft}
              onChange={setShadowColorDraft}
              prefixed
              alpha
              className="w-full bg-white border border-[#dbc1bc]/30 focus:border-[#3d0000] rounded-lg px-3 py-2 text-xs text-[#3d0000] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#3d0000] focus:ring-offset-1"
            />
          </div>
        )}
      </div>

      {/* Opacity slider — WR-01: UI 0-100, storage 0..1. */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Opacity
          </span>
          <span
            data-testid="decoration-opacity-value"
            className="text-[10px] font-bold text-[#3d0000]"
          >
            {opacityPct}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          defaultValue={opacityPct}
          // Per KBD-09: NEVER dispatch on per-tick `change`. Commit only on
          // mouseup/touchend (final-value gesture).
          onMouseUp={(e) => commitOpacity(e.currentTarget.value)}
          onTouchEnd={(e) =>
            commitOpacity((e.currentTarget as HTMLInputElement).value)
          }
          data-testid="decoration-opacity-slider"
          aria-label="Opacity"
          className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
        />
      </div>
    </div>
  )
}
