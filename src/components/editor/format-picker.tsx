'use client'

import {
  CAROUSEL_FORMATS,
  CAROUSEL_FORMAT_IDS,
  type CarouselFormatId,
} from '@/lib/render/carousel-formats'

interface FormatPickerProps {
  value: CarouselFormatId
  onChange: (next: CarouselFormatId) => void
}

/**
 * Phase 90: carousel output-format selector — a compact 3-segment control
 * (TikTok 9:16 / Instagram 4:5 / Square 1:1). Mounted in the editor's left
 * aside; switching it reflows the live preview and changes the dimensions of
 * the downloaded PNGs.
 */
export function FormatPicker({ value, onChange }: FormatPickerProps) {
  return (
    <div className="flex flex-col gap-1" data-testid="format-picker">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#7d6161] text-center">
        Format
      </span>
      <div
        role="group"
        aria-label="Carousel format"
        className="flex gap-1 rounded-lg bg-[#fadbdb]/40 p-1"
      >
        {CAROUSEL_FORMAT_IDS.map((id) => {
          const fmt = CAROUSEL_FORMATS[id]
          const active = id === value
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={active}
              title={`${fmt.label} — ${fmt.ratioLabel} (${fmt.w}×${fmt.h})`}
              data-testid={`format-option-${id}`}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 transition-colors ${
                active
                  ? 'bg-white text-[#3d0000] shadow-sm'
                  : 'text-[#7d6161] hover:bg-[#fff0f0]'
              }`}
            >
              <span className="text-[10px] font-bold leading-none">{fmt.label}</span>
              <span className="text-[9px] tabular-nums leading-none opacity-70">
                {fmt.ratioLabel}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
