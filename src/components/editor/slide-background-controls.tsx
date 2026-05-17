'use client'

/**
 * quick-260517-h8z / quick-260517-iiy: Caption Card control card.
 *
 * Mounted in the editor right-rail ELEMENTS tab (inside ElementsPanel's
 * `slideLevelCards`). Controls the caption panel a slide's captions sit on —
 * the area visible BEHIND a constrained news-carousel photo. On a `cover`-layout
 * slide the photo is an <img> covering the top portion; the remainder shows the
 * slide background color (the user's reported "yellow panel").
 *
 * Two controls:
 *   1. Color — recolors the panel (style_overrides.background_color hex).
 *   2. Height — moves the photo / caption-panel boundary
 *      (style_overrides.news_image_height, the PHOTO height percent). A LARGER
 *      photo means a SHORTER caption panel.
 *
 * UNLIKE CaptionBarControls, this card is NOT gated on `backgroundMode` — every
 * selected slide has a background color, so the card is ALWAYS visible (the
 * parent mounts it unconditionally, like WatermarkControls).
 *
 * quick-260517-iiy: renamed from "Slide Background" to "Caption Card". The
 * `data-testid` values (`slide-background-controls`, the swatch testids) are
 * KEPT STABLE — they are test-bearing and the user cares about the visible
 * label, not testids. The component + file name also stay unchanged to avoid
 * import churn across elements-panel.tsx.
 *
 * All three renderers (slide-preview.tsx, render-slide-satori.tsx,
 * render-slide.ts) read `background_color` via
 * `overrides.background_color ?? template.backgroundColor` and
 * `news_image_height` via `overrides.news_image_height ?? newsZone.imageHeight`
 * (clamped [20,80]).
 */

import { useEffect, useState } from 'react'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import { COLOR_SWATCHES } from './text-rail/color-swatches'

/**
 * Default constrained-photo height percent — `NEWS_LAYOUT.cover.imageHeight`.
 * NEWS_LAYOUT is a private const triplicated across the 3 render paths
 * (slide-preview.tsx / render-slide.ts / render-slide-satori.tsx) and is not
 * exported, so the value is inlined here with this comment tying it back. The
 * Height slider seeds from `style_overrides.news_image_height ?? this`.
 */
const NEWS_COVER_IMAGE_HEIGHT = 55

export interface SlideBackgroundControlsProps {
  slide: Slide
  /** Per-slide-RESOLVED template (post resolvePerSlideTemplate) — drives the
   *  color-picker default. */
  template: SlideTemplate
  /** Commit dispatch — records one undo entry. */
  onSlideUpdate: (updates: Partial<Slide>) => void
  /** quick-260517-iiy: transient live-preview dispatch for the Height slider —
   *  fires UPDATE_SLIDE with noHistory:true so a drag lands on the canvas
   *  without polluting the undo stack. The committing dispatch fires through
   *  `onSlideUpdate` on pointer-up. Optional so isolated unit tests can omit
   *  it; falls back to `onSlideUpdate` when absent. */
  onSlidePreview?: (updates: Partial<Slide>) => void
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
  onSlidePreview,
}: SlideBackgroundControlsProps) {
  // Effective (resolved) value — same fallback chain the renderers use, so the
  // active swatch reflects what the slide actually renders.
  const color = slide.style_overrides?.background_color ?? template.backgroundColor

  // quick-260517-iiy: resolved photo-height percent. Falls back to the
  // NEWS_LAYOUT cover preset (55). The slider stores PHOTO height — a larger
  // photo means a shorter caption panel.
  const photoHeight =
    slide.style_overrides?.news_image_height ?? NEWS_COVER_IMAGE_HEIGHT

  // Local drag draft — the range <input> is driven from this so the thumb
  // tracks mid-gesture before a committing dispatch re-renders the slide. Sync
  // back whenever the resolved value changes (undo/redo, slide switch).
  const [heightDraft, setHeightDraft] = useState(photoHeight)
  useEffect(() => {
    setHeightDraft(photoHeight)
  }, [photoHeight])

  /** Emit a merged style_overrides patch. A single discrete pick = one undo
   *  entry, so this always goes through the committing dispatch. */
  function patch(p: Partial<SlideStyleOverrides>) {
    const next = { ...(slide.style_overrides ?? {}), ...p }
    onSlideUpdate({ style_overrides: next })
  }

  /** Height-slider patch — `commit` picks the history-recording dispatch vs
   *  the transient (noHistory) preview one (KBD-09). */
  function patchHeight(value: number, commit: boolean) {
    const next = { ...(slide.style_overrides ?? {}), news_image_height: value }
    ;(commit ? onSlideUpdate : onSlidePreview ?? onSlideUpdate)({
      style_overrides: next,
    })
  }

  return (
    <div
      className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-4"
      data-testid="slide-background-controls"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
        Caption Card
      </span>

      <p className="text-[11px] text-[#7d6161] leading-snug">
        Color and height of the panel your captions sit on.
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

      {/* Height — moves the photo / caption-panel boundary. The slider value is
          the PHOTO height percent: dragging it UP grows the photo and shrinks
          the caption panel. Preview-on-change, commit-on-release (KBD-09).
          Pattern copied from caption-bar-controls.tsx. */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#3d0000]">
            Photo height
          </span>
          <span className="text-[11px] font-bold text-[#7d6161]">
            {Math.round(heightDraft)}%
          </span>
        </div>
        <input
          type="range"
          min={20}
          max={80}
          step={1}
          value={heightDraft}
          data-testid="caption-card-height"
          aria-label="Caption card height"
          className="w-full accent-[#3d0000]"
          onChange={(e) => {
            const n = Number(e.target.value)
            setHeightDraft(n)
            patchHeight(n, false)
          }}
          onPointerUp={(e) =>
            patchHeight(Number((e.target as HTMLInputElement).value), true)
          }
          onMouseUp={(e) =>
            patchHeight(Number((e.target as HTMLInputElement).value), true)
          }
        />
        <p className="text-[10px] text-[#7d6161] leading-snug">
          A taller photo leaves a shorter caption panel.
        </p>
      </div>
    </div>
  )
}
