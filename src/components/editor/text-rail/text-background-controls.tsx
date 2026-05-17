'use client'

/**
 * quick-260517-fu9 — extracted from ActiveTextBoxCard's inner `HighlightControls`.
 *
 * Renders the "text background" (highlight) editor: a 4-swatch color row +
 * native palette opener and a Tight/Full style toggle. It edits
 * `TextBox.effects.highlight` — the fill rendered behind a text element.
 *
 * quick-260517-iiy — the padding slider was removed. `TextHighlightEffect.padding`
 * stays in the data model (legacy slides keep their stored value) but is no
 * longer exposed in the UI and no longer read by the renderer — the tight
 * highlight uses a fixed built-in inset.
 *
 * IMPORTANT: every remaining `data-testid` is preserved verbatim from the
 * original inner component (`highlight-color-row`, `highlight-style-tight`,
 * `highlight-style-full`) so the existing ActiveTextBoxCard tests keep
 * passing. The `+ '88'` alpha-suffix convention (8-digit hex the renderer
 * expects) is unchanged — zero render-path impact.
 */

import { Icon } from '@/components/ui/icon'
import { COLOR_SWATCHES } from './color-swatches'
import type { TextHighlightEffect } from '@/lib/types/slide'

// Copied verbatim from ActiveTextBoxCard.tsx:14-15 — the shared keyboard
// focus-visible ring. Browser default outlines are clipped by rounded-full /
// rounded-lg shapes; an explicit ring matching the brand primary fixes both
// contrast and shape.
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1'

export function TextBackgroundControls({
  highlight,
  onChange,
}: {
  highlight: TextHighlightEffect
  onChange: (partial: Partial<TextHighlightEffect>) => void
}) {
  return (
    <>
      <div className="flex gap-3" data-testid="highlight-color-row">
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ color: color + '88' })}
            className={`w-6 h-6 rounded-full ${FOCUS_RING} ${
              highlight.color === color + '88'
                ? 'ring-2 ring-[#3d0000] ring-offset-1'
                : ''
            }`}
            style={{
              backgroundColor: color,
              border: color === '#ffffff' ? '1px solid #dbc1bc' : undefined,
            }}
            aria-label={`Set highlight color to ${color}`}
            aria-pressed={highlight.color === color + '88'}
            title={color}
          />
        ))}
        <label className="w-6 h-6 rounded-full border border-[#dbc1bc]/30 flex items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-[#3d0000] focus-within:ring-offset-1">
          <Icon name="palette" size="sm" className="text-[#7d6161]" aria-hidden />
          <input
            type="color"
            value={highlight.color.slice(0, 7)}
            onChange={(e) => onChange({ color: e.target.value + '88' })}
            aria-label="Set custom highlight color"
            className="sr-only"
          />
        </label>
      </div>
      <div className="flex gap-2">
        {(['tight', 'full'] as const).map((style) => (
          <button
            key={style}
            type="button"
            data-testid={`highlight-style-${style}`}
            onClick={() => onChange({ style })}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${FOCUS_RING} ${
              highlight.style === style
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fff0f0] text-[#7d6161] hover:bg-[#fadbdb]'
            }`}
            aria-label={`Highlight style ${style}`}
            aria-pressed={highlight.style === style}
          >
            {style === 'tight' ? 'Tight' : 'Full'}
          </button>
        ))}
      </div>
    </>
  )
}
