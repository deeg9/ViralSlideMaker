'use client'

import { useState } from 'react'
import { Collapsible } from '@base-ui/react'
import { ChevronDown } from 'lucide-react'
import type { TextSegment } from '@/lib/types/slide'

interface BoldWordsDisclosureProps {
  segments: TextSegment[]
  onToggle: (index: number) => void
}

/**
 * quick-260502-pw8: collapsible "Bold words" section. Mirrors
 * AccentWordsDisclosure's chip-toggle UX — one chip per word from `segments`,
 * each toggling its `bold` flag via `onToggle(index)`. Hidden by default to
 * keep the panel quiet for slides that don't use per-word bolding.
 *
 * Trigger: caret + "Bold words" + count badge ("N bolded") that appears only
 * when ≥ 1 segment has bold=true. Active chips render at fontWeight 700 so
 * the chip itself previews the result.
 */
export function BoldWordsDisclosure({
  segments,
  onToggle,
}: BoldWordsDisclosureProps) {
  const [open, setOpen] = useState(false)
  const boldCount = segments.filter((s) => s.bold).length

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      data-testid="bold-words-disclosure"
      data-state={open ? 'open' : 'closed'}
      className="space-y-2"
    >
      <Collapsible.Trigger
        data-testid="bold-words-trigger"
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#7d6161] hover:text-[#3d0000] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1 rounded-sm"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
          aria-hidden
        />
        <span>Bold words</span>
        {boldCount > 0 && (
          <span
            data-testid="bold-words-count-badge"
            className="text-[9px] bg-[#fadbdb] text-[#3d0000] px-1.5 py-0.5 rounded-full font-bold"
          >
            {boldCount} bolded
          </span>
        )}
      </Collapsible.Trigger>

      <Collapsible.Panel data-testid="bold-words-panel">
        {open && (
          <div className="flex flex-wrap gap-1.5" data-testid="bold-words-chips">
            {segments.map((seg, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onToggle(i)}
                data-testid={`bold-word-chip-${i}`}
                data-active={seg.bold ? 'true' : 'false'}
                aria-label={seg.bold ? `Remove bold from "${seg.text}"` : `Bold "${seg.text}"`}
                aria-pressed={!!seg.bold}
                className="px-2 py-1 rounded text-xs uppercase border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1"
                style={{
                  backgroundColor: seg.bold ? '#3d0000' : '#fff0f0',
                  color: seg.bold ? '#ffffff' : '#7d6161',
                  borderColor: seg.bold ? '#3d0000' : '#dbc1bc',
                  fontWeight: seg.bold ? 700 : 500,
                }}
              >
                {seg.text}
              </button>
            ))}
          </div>
        )}
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
