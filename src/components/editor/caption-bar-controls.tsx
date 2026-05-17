'use client'

/**
 * quick-260515-k12: Caption Bar control card.
 *
 * Mounted in the editor right-rail ELEMENTS tab (inside ElementsPanel's
 * `slideLevelCards`). Lets the user customize the bottom caption-bar overlay
 * on `image-with-bottom-card` templates (magazine-bold, tr3nding-news):
 * height, color, opacity, and a Bottom/Top position toggle.
 *
 * Self-gates on `template.backgroundMode === 'image-with-bottom-card'` — the
 * card renders `null` for every other template, so the parent can mount it
 * unconditionally.
 *
 * quick-260517-h8z: the visibility gate MIRRORS the renderer's `useBottomCard`
 * condition (slide-preview.tsx:788-789, render-slide-satori.tsx:215-216) — both
 * are `backgroundMode === 'image-with-bottom-card'`. ElementsPanel passes the
 * PER-SLIDE-RESOLVED template (post `resolvePerSlideTemplate`), so the card
 * appears whenever the canvas actually draws the solid bottom-card panel —
 * including Style-from-Reference `caption-bar-bottom` archetype slides, which
 * carry `style_overrides.template_id_override = 'magazine-bold'` without
 * touching the project-level template. If the user can SEE the bottom panel,
 * the editing card is in the ELEMENTS tab; templates with no bottom card show
 * NO card (no false-positive). The card's Color row writes `caption_bar_color`
 * — the exact override `resolveCaptionBar` reads to color that panel.
 *
 * Writes per-slide `style_overrides` (the 4 caption_bar_* fields). The
 * renderers read those overrides through `resolveCaptionBar`. Slider drags
 * route through `onSlidePreview` (noHistory:true) on every tick and commit
 * once via `onSlideUpdate` on release so the gesture records exactly one undo
 * entry (KBD-09). The Color control is a swatch-row picker (quick-260515-nfb):
 * round `COLOR_SWATCHES` preset circles + a circular palette-icon button that
 * opens a hidden native `<input type="color">` for arbitrary hex — every path
 * emits explicit hex strings (PCL12).
 *
 * Visual shell mirrors WatermarkControls (the portlet pattern): white card,
 * brown border, top-left uppercase title.
 */

import { useEffect, useState } from 'react'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import { COLOR_SWATCHES } from './text-rail/color-swatches'

export interface CaptionBarControlsProps {
  slide: Slide
  /** Per-slide-RESOLVED template (post resolvePerSlideTemplate) — drives the
   *  visibility gate AND the color-picker default. */
  template: SlideTemplate
  /** Commit dispatch — records one undo entry. */
  onSlideUpdate: (updates: Partial<Slide>) => void
  /** Transient dispatch — noHistory:true; for slider drags. */
  onSlidePreview: (updates: Partial<Slide>) => void
}

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

export function CaptionBarControls({
  slide,
  template,
  onSlideUpdate,
  onSlidePreview,
}: CaptionBarControlsProps) {
  const o = slide.style_overrides ?? {}
  // Effective (resolved) values — same fallback chain resolveCaptionBar uses,
  // so the controls show what the slide actually renders.
  const heightPct = o.caption_bar_height_pct ?? 38
  const color = o.caption_bar_color ?? template.backgroundColor
  const opacity = o.caption_bar_opacity ?? 0.85
  const position: 'bottom' | 'top' = o.caption_bar_position ?? 'bottom'

  // Local drag drafts — a range <input> is driven from these so the thumb
  // tracks mid-gesture even before a committing dispatch re-renders the slide.
  // Sync back to the resolved value whenever the slide's override changes
  // (external edits, undo/redo, slide switch).
  const [heightDraft, setHeightDraft] = useState(heightPct)
  const [opacityDraft, setOpacityDraft] = useState(Math.round(opacity * 100))
  useEffect(() => {
    setHeightDraft(heightPct)
  }, [heightPct])
  useEffect(() => {
    setOpacityDraft(Math.round(opacity * 100))
  }, [opacity])

  // Visibility gate — the card is meaningless on any template without a
  // bottom caption bar. Render nothing so the parent can mount unconditionally.
  // Declared AFTER the hooks above so the hook order stays stable across the
  // gate flipping (rules-of-hooks).
  //
  // quick-260517-h8z: this is the EXACT condition the renderers use for
  // `useBottomCard` (slide-preview.tsx:788-789, render-slide-satori.tsx:215-216).
  // `template` here is the PER-SLIDE-RESOLVED template handed in by
  // ElementsPanel (`resolvePerSlideTemplate(slide, template)`), so the gate
  // tracks what the canvas actually draws — a Style-from-Reference
  // `caption-bar-bottom` slide (template_id_override = 'magazine-bold') resolves
  // to a bottom-card template and surfaces the card, while a `color` /
  // undefined backgroundMode template never does.
  const rendersBottomCard =
    template.backgroundMode === 'image-with-bottom-card'
  if (!rendersBottomCard) return null

  /** Emit a merged style_overrides patch. `commit` picks the history-recording
   *  dispatch vs the transient (noHistory) one. */
  function patch(p: Partial<SlideStyleOverrides>, commit: boolean) {
    const next = { ...(slide.style_overrides ?? {}), ...p }
    ;(commit ? onSlideUpdate : onSlidePreview)({ style_overrides: next })
  }

  return (
    <div
      className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-4"
      data-testid="caption-bar-controls"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
        Caption Bar
      </span>

      {/* Height — preview-on-change, commit-on-release (KBD-09). */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#3d0000]">
            Height
          </span>
          <span className="text-[11px] font-bold text-[#7d6161]">
            {Math.round(heightDraft)}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={90}
          step={1}
          value={heightDraft}
          data-testid="caption-bar-height"
          aria-label="Caption bar height"
          className="w-full accent-[#3d0000]"
          onChange={(e) => {
            const n = Number(e.target.value)
            setHeightDraft(n)
            patch({ caption_bar_height_pct: n }, false)
          }}
          onPointerUp={(e) =>
            patch(
              {
                caption_bar_height_pct: Number(
                  (e.target as HTMLInputElement).value,
                ),
              },
              true,
            )
          }
          onMouseUp={(e) =>
            patch(
              {
                caption_bar_height_pct: Number(
                  (e.target as HTMLInputElement).value,
                ),
              },
              true,
            )
          }
        />
      </div>

      {/* Color — swatch-row picker (quick-260515-nfb): round COLOR_SWATCHES
          preset circles + a circular palette-icon button wrapping a hidden
          native <input type="color"> for arbitrary hex. Both paths emit
          explicit hex strings (PCL12). Mirrors the AccentWordsDisclosure
          "Highlight color" row. */}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-[#3d0000]">Color</span>
        <div className="flex gap-3">
          {COLOR_SWATCHES.map((swatch) => {
            const active = color.toLowerCase() === swatch.toLowerCase()
            return (
              <button
                key={swatch}
                type="button"
                data-testid={`caption-bar-color-swatch-${swatch}`}
                onClick={() => patch({ caption_bar_color: swatch }, true)}
                className={`w-6 h-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 ${
                  active ? 'ring-2 ring-[#3d0000] ring-offset-1' : ''
                }`}
                style={{
                  backgroundColor: swatch,
                  border: swatch === '#ffffff' ? '1px solid #dbc1bc' : undefined,
                }}
                aria-label={`Set caption bar color to ${swatch}`}
                aria-pressed={active}
                title={swatch}
              />
            )
          })}
          <label
            className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1"
            data-testid="caption-bar-color-palette"
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
              data-testid="caption-bar-color"
              aria-label="Set custom caption bar color"
              className="sr-only"
              onChange={(e) => patch({ caption_bar_color: e.target.value }, true)}
            />
          </label>
        </div>
      </div>

      {/* Opacity — 0..100 UI scale, emitted as 0..1. Same preview/commit split. */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#3d0000]">
            Opacity
          </span>
          <span className="text-[11px] font-bold text-[#7d6161]">
            {opacityDraft}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={opacityDraft}
          data-testid="caption-bar-opacity"
          aria-label="Caption bar opacity"
          className="w-full accent-[#3d0000]"
          onChange={(e) => {
            const n = Number(e.target.value)
            setOpacityDraft(n)
            patch({ caption_bar_opacity: n / 100 }, false)
          }}
          onPointerUp={(e) =>
            patch(
              {
                caption_bar_opacity:
                  Number((e.target as HTMLInputElement).value) / 100,
              },
              true,
            )
          }
          onMouseUp={(e) =>
            patch(
              {
                caption_bar_opacity:
                  Number((e.target as HTMLInputElement).value) / 100,
              },
              true,
            )
          }
        />
      </div>

      {/* Position — Bottom / Top radiogroup (WatermarkControls button styling). */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
          Position
        </span>
        <div
          className="flex gap-2"
          role="radiogroup"
          aria-label="Caption bar position"
        >
          {(
            [
              { value: 'bottom', label: 'Bottom' },
              { value: 'top', label: 'Top' },
            ] as const
          ).map((opt) => {
            const active = position === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`caption-bar-position-${opt.value}`}
                onClick={() => patch({ caption_bar_position: opt.value }, true)}
                className={
                  active
                    ? 'flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-[#3d0000] text-white'
                    : 'flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white text-[#7d6161] border border-[#dbc1bc]/30 hover:bg-[#fadbdb]'
                }
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
