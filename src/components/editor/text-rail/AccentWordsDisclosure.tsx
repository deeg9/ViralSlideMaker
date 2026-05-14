'use client'

import { useState } from 'react'
import { Collapsible } from '@base-ui/react'
import { ChevronDown } from 'lucide-react'
import type { TextSegment } from '@/lib/types/slide'
import { readableTextColor } from '@/lib/color/readable-text-color'

interface AccentWordsDisclosureProps {
  segments: TextSegment[]
  onToggle: (index: number) => void
  /** Effective color of accented words — `textBox.accent_color` falling back
   *  to `template.accentColor`. Drives the chip-wall fill AND the active
   *  swatch ring in the new color row below the chips. */
  accentColor: string
  /** quick-260514-laa: per-text-box accent-color override. When provided,
   *  the color row renders below the chip wall: brand swatches + a native
   *  `<input type="color">` palette opener (same shape as the active-text-box
   *  Color row). Calls `onChangeAccentColor(hex)` on every pick — parent
   *  dispatches UPDATE_TEXT_BOX with `{ accent_color: hex }`. Optional so
   *  callers that don't care about per-box override (legacy / read-only) can
   *  omit it and the color row stays hidden. */
  onChangeAccentColor?: (color: string) => void
}

// Brand-curated swatches for the highlight color row (mirrors the
// COLOR_SWATCHES set used by ActiveTextBoxCard's text-color row so the two
// pickers feel visually consistent).
const HIGHLIGHT_SWATCHES = [
  '#ffffff',
  '#3d0000',
  '#7d6161',
  '#fadbdb',
  '#A8E0B0',
  '#FFD166',
] as const

/**
 * Phase 50 (D-06): collapsible "Highlight words" section. Hidden by default
 * to keep the panel quiet for slides that don't use accent highlighting.
 * When expanded, shows a chip wall — one chip per word from `segments`,
 * each toggling its `accent` flag via `onToggle(index)`.
 *
 * Trigger: caret + "Highlight words" + count badge ("N highlighted") that
 * appears only when ≥ 1 segment has accent=true.
 */
export function AccentWordsDisclosure({
  segments,
  onToggle,
  accentColor,
  onChangeAccentColor,
}: AccentWordsDisclosureProps) {
  // Local controlled state so we can flip data-state attributes for tests
  // without depending on the headless library's internal animation timing.
  const [open, setOpen] = useState(false)
  const accentCount = segments.filter((s) => s.accent).length

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      data-testid="accent-words-disclosure"
      data-state={open ? 'open' : 'closed'}
      className="space-y-2"
    >
      <Collapsible.Trigger
        data-testid="accent-words-trigger"
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#7d6161] hover:text-[#3d0000] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 rounded-sm"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
          aria-hidden
        />
        <span>Highlight words</span>
        {accentCount > 0 && (
          <span
            data-testid="accent-words-count-badge"
            className="text-[9px] bg-[#fadbdb] text-[#3d0000] px-1.5 py-0.5 rounded-full font-bold"
          >
            {accentCount} highlighted
          </span>
        )}
      </Collapsible.Trigger>

      <Collapsible.Panel
        data-testid="accent-words-panel"
        // Render but visually hide while closed by relying on data-state when needed.
        // The library hides the panel via its internal logic; we additionally guard
        // chip rendering so the chips never appear when collapsed.
      >
        {open && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5" data-testid="accent-words-chips">
              {segments.map((seg, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onToggle(i)}
                  data-testid={`accent-word-chip-${i}`}
                  data-active={seg.accent ? 'true' : 'false'}
                  aria-label={seg.accent ? `Remove accent from "${seg.text}"` : `Add accent to "${seg.text}"`}
                  aria-pressed={!!seg.accent}
                  className="px-2 py-1 rounded text-xs font-bold uppercase border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1"
                  style={{
                    backgroundColor: seg.accent ? accentColor : '#fff0f0',
                    // Phase 50 (UI-REVIEW WARNING): hardcoded #000 fails contrast
                    // on dark accent fills (e.g. #3d0000). Compute readable text
                    // color from the accent's relative luminance instead.
                    color: seg.accent ? readableTextColor(accentColor) : '#7d6161',
                    borderColor: seg.accent ? accentColor : '#dbc1bc',
                  }}
                >
                  {seg.text}
                </button>
              ))}
            </div>

            {/* quick-260514-laa: highlight-color row. Brand swatches + native
                <input type="color"> palette opener. Click a swatch (or pick
                via palette) → onChangeAccentColor fires once → parent
                dispatches UPDATE_TEXT_BOX { accent_color }. The currently-
                applied color (effective accentColor) is ring-marked when it
                matches a swatch; the palette tile is always reachable for
                arbitrary hex. */}
            {onChangeAccentColor && (
              <div className="space-y-1" data-testid="accent-color-row">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7d6161]">
                  Highlight color
                </span>
                <div className="flex gap-3">
                  {HIGHLIGHT_SWATCHES.map((color) => {
                    const active = accentColor.toLowerCase() === color.toLowerCase()
                    return (
                      <button
                        key={color}
                        type="button"
                        data-testid={`accent-color-swatch-${color}`}
                        onClick={() => onChangeAccentColor(color)}
                        className={`w-6 h-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 ${
                          active ? 'ring-2 ring-[#3d0000] ring-offset-1' : ''
                        }`}
                        style={{
                          backgroundColor: color,
                          border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined,
                        }}
                        aria-label={`Set highlight color to ${color}`}
                        aria-pressed={active}
                        title={color}
                      />
                    )
                  })}
                  <label
                    className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1"
                    data-testid="accent-color-palette"
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
                      value={accentColor}
                      onChange={(e) => onChangeAccentColor(e.target.value)}
                      aria-label="Set custom highlight color"
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
