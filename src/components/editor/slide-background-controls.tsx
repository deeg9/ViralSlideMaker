'use client'

/**
 * quick-260517-h8z: Slide Background control card.
 *
 * Mounted in the editor right-rail ELEMENTS tab (inside ElementsPanel's
 * `slideLevelCards`). Lets the user recolor the slide background — the panel
 * visible BEHIND a constrained news-carousel photo. On a `cover`-layout slide
 * the photo is an <img> covering only the top 55%; the bottom ~45% shows the
 * slide background color (the user's reported "yellow panel").
 *
 * UNLIKE CaptionBarControls, this card is NOT gated on `backgroundMode` — every
 * selected slide has a background color, so the card is ALWAYS visible (the
 * parent mounts it unconditionally, like WatermarkControls). The wrong gate is
 * exactly what made the prior h8z attempt fail.
 *
 * Writes the per-slide `style_overrides.background_color` hex string. All three
 * renderers (slide-preview.tsx, render-slide-satori.tsx, render-slide.ts) read
 * it via `overrides.background_color ?? template.backgroundColor`. A single
 * discrete pick is one undo entry — there is no slider, so no preview/commit
 * split is needed.
 *
 * Visual shell + Color swatch row mirror CaptionBarControls verbatim (the
 * portlet pattern): white card, brown border, top-left uppercase title; round
 * COLOR_SWATCHES preset circles + a circular palette-icon button wrapping a
 * hidden native <input type="color"> for arbitrary hex (PCL12).
 */

import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import { COLOR_SWATCHES } from './text-rail/color-swatches'

export interface SlideBackgroundControlsProps {
  slide: Slide
  /** Per-slide-RESOLVED template (post resolvePerSlideTemplate) — drives the
   *  color-picker default. */
  template: SlideTemplate
  /** Commit dispatch — records one undo entry. */
  onSlideUpdate: (updates: Partial<Slide>) => void
}

/**
 * Coerce a hex string to the 6-digit `#RRGGBB` form `<input type="color">`
 * requires. Expands 3-digit hex; strips an 8-digit hex's alpha; falls back to
 * '#000000' on anything malformed so the native picker never gets bad input.
 * (Copied from caption-bar-controls.tsx — the helper is local there.)
 */
function toColorInputValue(hex: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length === 8) h = h.slice(0, 6)
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return '#000000'
  return `#${h.toLowerCase()}`
}

export function SlideBackgroundControls({
  slide,
  template,
  onSlideUpdate,
}: SlideBackgroundControlsProps) {
  // Effective (resolved) value — same fallback chain the renderers use, so the
  // active swatch reflects what the slide actually renders.
  const color = slide.style_overrides?.background_color ?? template.backgroundColor

  /** Emit a merged style_overrides patch. A single discrete pick = one undo
   *  entry, so this always goes through the committing dispatch. */
  function patch(p: Partial<SlideStyleOverrides>) {
    const next = { ...(slide.style_overrides ?? {}), ...p }
    onSlideUpdate({ style_overrides: next })
  }

  return (
    <div
      className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-4"
      data-testid="slide-background-controls"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
        Slide Background
      </span>

      <p className="text-[11px] text-[#7d6161] leading-snug">
        Color the slide background behind the photo.
      </p>

      {/* Color — swatch-row picker copied verbatim from caption-bar-controls.tsx:
          round COLOR_SWATCHES preset circles + a circular palette-icon button
          wrapping a hidden native <input type="color"> for arbitrary hex. Both
          paths emit explicit hex strings (PCL12). */}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-[#3d0000]">Color</span>
        <div className="flex gap-3">
          {COLOR_SWATCHES.map((swatch) => {
            const active = color.toLowerCase() === swatch.toLowerCase()
            return (
              <button
                key={swatch}
                type="button"
                data-testid={`slide-background-color-swatch-${swatch}`}
                onClick={() => patch({ background_color: swatch })}
                className={`w-6 h-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 ${
                  active ? 'ring-2 ring-[#3d0000] ring-offset-1' : ''
                }`}
                style={{
                  backgroundColor: swatch,
                  border: swatch === '#ffffff' ? '1px solid #dbc1bc' : undefined,
                }}
                aria-label={`Set slide background color to ${swatch}`}
                aria-pressed={active}
                title={swatch}
              />
            )
          })}
          <label
            className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1"
            data-testid="slide-background-color-palette"
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
              value={toColorInputValue(color)}
              data-testid="slide-background-color"
              aria-label="Set custom slide background color"
              className="sr-only"
              onChange={(e) => patch({ background_color: e.target.value })}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
