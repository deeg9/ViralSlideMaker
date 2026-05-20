'use client'

/**
 * quick-260519-o55: extracted from SlideBackgroundControls. Owns the Photo
 * overlay portlet — Switch + opacity slider + color swatches + palette hex
 * input. UI ONLY — drives style_overrides.overlay_opacity (0..100 INT) and
 * style_overrides.overlay_color (hex). Render pipeline
 * (render-slide-satori.tsx:263–271) is unchanged.
 */

import { useEffect, useRef, useState } from 'react'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import { Switch } from '@/components/ui/switch'
import { COLOR_SWATCHES } from './text-rail/color-swatches'

/** quick-260519-k14: lower floor for "Switch ON from a zero-effective slide" —
 *  small enough to be a tint, large enough to be visible at all. */
const PHOTO_OVERLAY_MIN_PCT_ON = 1

/**
 * Coerce a hex string to the 6-digit `#RRGGBB` form `<input type="color">`
 * requires. Expands 3-digit hex; strips an 8-digit hex's alpha; falls back to
 * '#000000' on anything malformed so the native picker never gets bad input.
 */
function toColorInputValue(hex: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length === 8) h = h.slice(0, 6)
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return '#000000'
  return `#${h.toLowerCase()}`
}

export interface SlidePhotoOverlayControlsProps {
  slide: Slide
  /** Per-slide-RESOLVED template — drives the template-default swatch and the
   *  fallback overlayOpacity seed. */
  template: SlideTemplate
  /** Commit dispatch — records one undo entry. */
  onSlideUpdate: (updates: Partial<Slide>) => void
  /** Transient live-preview dispatch for the Opacity slider (KBD-09).
   *  Falls back to onSlideUpdate when absent. */
  onSlidePreview?: (updates: Partial<Slide>) => void
}

export function SlidePhotoOverlayControls({
  slide,
  template,
  onSlideUpdate,
  onSlidePreview,
}: SlidePhotoOverlayControlsProps) {
  // quick-260519-k14: Photo-overlay panel — effective values + drag draft.
  // Override is 0..100 percent; template.overlayOpacity is 0..1 fraction —
  // the seed must convert the template value through ×100. Mirrors the
  // already-wired render contract (render-slide-satori.tsx:263–271).
  const effectiveOverlayOpacityPct =
    slide.style_overrides?.overlay_opacity ??
    Math.round(template.overlayOpacity * 100)
  const effectiveOverlayColor =
    slide.style_overrides?.overlay_color ?? template.overlayColor
  const photoOverlayOn = effectiveOverlayOpacityPct > 0

  const [overlayOpacityDraft, setOverlayOpacityDraft] = useState(
    effectiveOverlayOpacityPct,
  )
  useEffect(() => {
    setOverlayOpacityDraft(effectiveOverlayOpacityPct)
  }, [effectiveOverlayOpacityPct])

  // "Toggle ON restores last-known" — track the most recent non-zero value the
  // user produced so toggling OFF -> ON does not collapse to the template fallback
  // if the slide already had a custom value. Seeded with the effective non-zero
  // value or the minimum-on floor.
  const lastNonZeroOverlayOpacityPctRef = useRef<number>(
    effectiveOverlayOpacityPct > 0
      ? effectiveOverlayOpacityPct
      : Math.max(
          PHOTO_OVERLAY_MIN_PCT_ON,
          Math.round(template.overlayOpacity * 100),
        ),
  )
  useEffect(() => {
    if (effectiveOverlayOpacityPct > 0) {
      lastNonZeroOverlayOpacityPctRef.current = effectiveOverlayOpacityPct
    }
  }, [effectiveOverlayOpacityPct])

  /** Emit a merged style_overrides patch. A single discrete pick = one undo
   *  entry, so this always goes through the committing dispatch. */
  function patch(p: Partial<SlideStyleOverrides>) {
    const next = { ...(slide.style_overrides ?? {}), ...p }
    onSlideUpdate({ style_overrides: next })
  }

  /** quick-260519-k14: Photo-overlay opacity slider patch — mirrors patchOpacity's
   *  preview-on-change / commit-on-release pattern (KBD-09), but writes the
   *  INT percent directly (overlay_opacity is 0..100, NOT 0..1). */
  function patchOverlayOpacity(valuePct: number, commit: boolean) {
    const next = {
      ...(slide.style_overrides ?? {}),
      overlay_opacity: valuePct,
    }
    ;(commit ? onSlideUpdate : onSlidePreview ?? onSlideUpdate)({
      style_overrides: next,
    })
  }

  /** quick-260519-k14: Photo-overlay Switch ON restores the last-known non-zero
   *  overlay_opacity (or the template fallback when none). OFF persists an
   *  EXPLICIT `overlay_opacity: 0` — NOT a deleted key. Mirrors caption-card's
   *  setCaptionOff precedent so any future renderer fallback cannot silently
   *  re-enable the overlay. */
  function setPhotoOverlayOn() {
    patch({ overlay_opacity: lastNonZeroOverlayOpacityPctRef.current })
  }
  function setPhotoOverlayOff() {
    patch({ overlay_opacity: 0 })
  }

  return (
    <section
      className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-3"
      data-testid="slide-photo-overlay-controls"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
        Photo overlay
      </span>
      <p className="text-[11px] text-[#7d6161] leading-snug">
        A colored tint over the photo — control color and how strong it is.
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#3d0000]">
          Photo overlay
        </span>
        <Switch
          aria-label="Photo overlay"
          data-testid="photo-overlay-toggle"
          checked={photoOverlayOn}
          onCheckedChange={(checked) =>
            checked ? setPhotoOverlayOn() : setPhotoOverlayOff()
          }
        />
      </div>

      {photoOverlayOn && (
        <>
          {/* Color — template-default swatch first, then COLOR_SWATCHES, then a
              palette button with a hidden <input type="color">. Both paths emit
              explicit hex strings (PCL12). */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-[#3d0000]">
              Color
            </span>
            <div className="flex gap-3">
              {/* Template-default swatch — always present so users can revert. */}
              {(() => {
                const swatch = template.overlayColor
                const active =
                  effectiveOverlayColor.toLowerCase() === swatch.toLowerCase()
                return (
                  <button
                    type="button"
                    data-testid="photo-overlay-color-swatch-template"
                    onClick={() => patch({ overlay_color: swatch })}
                    className={`w-6 h-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 ${
                      active ? 'ring-2 ring-[#3d0000] ring-offset-1' : ''
                    }`}
                    style={{
                      backgroundColor: swatch,
                      border:
                        swatch.toLowerCase() === '#ffffff'
                          ? '1px solid #dbc1bc'
                          : undefined,
                    }}
                    aria-label={`Set photo overlay color to template default ${swatch}`}
                    aria-pressed={active}
                    title={`Template default (${swatch})`}
                  />
                )
              })()}
              {COLOR_SWATCHES.filter(
                (s) => s.toLowerCase() !== template.overlayColor.toLowerCase(),
              ).map((swatch) => {
                const active =
                  effectiveOverlayColor.toLowerCase() === swatch.toLowerCase()
                return (
                  <button
                    key={swatch}
                    type="button"
                    data-testid={`photo-overlay-color-swatch-${swatch}`}
                    onClick={() => patch({ overlay_color: swatch })}
                    className={`w-6 h-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 ${
                      active ? 'ring-2 ring-[#3d0000] ring-offset-1' : ''
                    }`}
                    style={{
                      backgroundColor: swatch,
                      border:
                        swatch === '#ffffff' ? '1px solid #dbc1bc' : undefined,
                    }}
                    aria-label={`Set photo overlay color to ${swatch}`}
                    aria-pressed={active}
                    title={swatch}
                  />
                )
              })}
              <label
                className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1"
                data-testid="photo-overlay-color-palette"
              >
                <span
                  className="material-symbols-outlined text-[#7d6161]"
                  style={{ fontSize: 14 }}
                  aria-hidden
                >
                  palette
                </span>
                <input
                  type="color"
                  value={toColorInputValue(effectiveOverlayColor)}
                  data-testid="photo-overlay-color"
                  aria-label="Set custom photo overlay color"
                  className="sr-only"
                  onChange={(e) => patch({ overlay_color: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* Opacity — 0..100 INT. Preview-on-change, commit-on-release (KBD-09). */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#3d0000]">
                Opacity
              </span>
              <span className="text-[11px] font-bold text-[#7d6161]">
                {Math.round(overlayOpacityDraft)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={overlayOpacityDraft}
              data-testid="photo-overlay-opacity"
              aria-label="Photo overlay opacity"
              className="w-full accent-[#3d0000]"
              onChange={(e) => {
                const n = Number(e.target.value)
                setOverlayOpacityDraft(n)
                patchOverlayOpacity(n, false)
              }}
              onPointerUp={(e) =>
                patchOverlayOpacity(
                  Number((e.target as HTMLInputElement).value),
                  true,
                )
              }
              onMouseUp={(e) =>
                patchOverlayOpacity(
                  Number((e.target as HTMLInputElement).value),
                  true,
                )
              }
            />
            <p className="text-[10px] text-[#7d6161] leading-snug">
              A higher opacity darkens or tints the photo more strongly.
            </p>
          </div>
        </>
      )}
    </section>
  )
}
