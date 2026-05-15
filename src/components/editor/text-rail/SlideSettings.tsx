'use client'

import { Icon } from '@/components/ui/icon'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'
import type { BrandKit } from '@/lib/types/brand-kit'

interface SlideSettingsProps {
  slide: Slide
  template: SlideTemplate
  onUpdate: (updates: Partial<Slide>) => void
  brandKit?: BrandKit | null
}

// quick-260515-overlay-color-picker: fixed-set swatches for the overlay tint
// color row. Mirrors AccentWordsDisclosure.HIGHLIGHT_SWATCHES shape so the
// two pickers feel visually consistent. Black is first (most common overlay).
const OVERLAY_SWATCHES = [
  '#000000',
  '#ffffff',
  '#3d0000',
  '#FFD166',
  '#7d6161',
  '#00BFFF',
] as const

/**
 * Phase 50 (D-07): slide-level controls separated from per-text-box card.
 * News Layout, Overlay opacity, and Watermark hide toggle are NOT
 * per-text-box — they belong here. Lighter framing (`bg-[#fff0f0]`) so the
 * white per-text-box card visually dominates the right rail.
 *
 * Handler shapes match the ones lifted from text-editor-panel.tsx
 * lines 68-91 (news layout), 425-449 (overlay), 481-505 (watermark).
 */
export function SlideSettings({
  slide,
  template,
  onUpdate,
  brandKit,
}: SlideSettingsProps) {
  const overrides = slide.style_overrides ?? {}
  const isNewsTemplate = !!template.accentColor
  const watermarkActive = !!brandKit?.logo_url && !!brandKit?.logo_position
  const watermarkHidden = overrides.hide_watermark === true

  return (
    <div
      className="bg-white border-2 border-[#3d0000]/20 rounded-2xl p-4 space-y-4"
      data-testid="slide-settings"
    >
      <span
        className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]"
        data-testid="slide-settings-heading"
      >
        Slide Settings
      </span>

      {/* News Layout — only when template advertises an accentColor (news templates).
          quick-260514-drop-news-layout-label: dropped the "News Layout" subsection
          label per user request; "Slide Settings" card title is enough context for
          the Cover / Body button pair. */}
      {isNewsTemplate && (
        <div className="space-y-2" data-testid="slide-settings-news-layout">
          <div className="flex gap-2">
            {(['cover', 'body'] as const).map((opt) => {
              const active = overrides.layout === opt
              return (
                <button
                  key={opt}
                  type="button"
                  data-testid={`slide-settings-news-layout-${opt}`}
                  data-active={active ? 'true' : 'false'}
                  onClick={() =>
                    onUpdate({
                      style_overrides: {
                        ...overrides,
                        layout: active ? undefined : opt,
                      },
                    })
                  }
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    active
                      ? 'bg-[#3d0000] text-white'
                      : 'bg-white text-[#7d6161] border border-[#dbc1bc]/30 hover:bg-[#fadbdb]'
                  }`}
                >
                  {opt === 'cover' ? 'Cover (image top)' : 'Body (image bottom)'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Overlay opacity — always shown */}
      <div className="space-y-2" data-testid="slide-settings-overlay">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Overlay
          </span>
          <span className="text-[10px] font-bold text-[#3d0000]">
            {overrides.overlay_opacity ?? Math.round(template.overlayOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          data-testid="slide-settings-overlay-slider"
          min={0}
          max={100}
          step={5}
          value={overrides.overlay_opacity ?? Math.round(template.overlayOpacity * 100)}
          onChange={(e) =>
            onUpdate({
              style_overrides: {
                ...overrides,
                overlay_opacity: Number(e.target.value),
              },
            })
          }
          className="w-full h-1 bg-[#fadbdb] rounded-lg appearance-none cursor-pointer accent-[#3d0000]"
        />
        <p className="text-[9px] text-[#7d6161]">
          Lower for vivid backgrounds, higher for readable text
        </p>

        {/* quick-260515-overlay-color-picker: overlay tint color. Mirrors the
            AccentWordsDisclosure "Highlight color" row — fixed swatches +
            native palette opener for arbitrary hex. */}
        <div className="space-y-1 pt-1" data-testid="slide-settings-overlay-color">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
            Color
          </span>
          <div className="flex gap-3">
            {OVERLAY_SWATCHES.map((color) => {
              const effective = (overrides.overlay_color ?? template.overlayColor).toLowerCase()
              const active = effective === color.toLowerCase()
              return (
                <button
                  key={color}
                  type="button"
                  data-testid={`slide-settings-overlay-color-swatch-${color}`}
                  onClick={() =>
                    onUpdate({
                      style_overrides: {
                        ...overrides,
                        overlay_color: color,
                      },
                    })
                  }
                  className={`w-6 h-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 ${
                    active ? 'ring-2 ring-[#3d0000] ring-offset-1' : ''
                  }`}
                  style={{
                    backgroundColor: color,
                    border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined,
                  }}
                  aria-label={`Set overlay color to ${color}`}
                  aria-pressed={active}
                  title={color}
                />
              )
            })}
            <label
              className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1"
              data-testid="slide-settings-overlay-color-palette"
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
                value={overrides.overlay_color ?? template.overlayColor}
                onChange={(e) =>
                  onUpdate({
                    style_overrides: {
                      ...overrides,
                      overlay_color: e.target.value,
                    },
                  })
                }
                aria-label="Set custom overlay color"
                className="sr-only"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Watermark hide toggle — only when brand kit has an active watermark */}
      {watermarkActive && (
        <div data-testid="slide-settings-watermark">
          <button
            type="button"
            data-testid="slide-settings-watermark-toggle"
            data-hidden={watermarkHidden ? 'true' : 'false'}
            onClick={() => {
              const next = { ...overrides }
              if (watermarkHidden) {
                delete next.hide_watermark
              } else {
                next.hide_watermark = true
              }
              onUpdate({ style_overrides: next })
            }}
            className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
              watermarkHidden
                ? 'bg-[#3d0000] text-white hover:opacity-90'
                : 'bg-white text-[#3d0000] border border-[#dbc1bc]/30 hover:bg-[#fadbdb]'
            }`}
          >
            <Icon name={watermarkHidden ? 'visibility' : 'visibility_off'} size="sm" />
            {watermarkHidden ? 'Show brand logo on this slide' : 'Hide brand logo on this slide'}
          </button>
        </div>
      )}
    </div>
  )
}
