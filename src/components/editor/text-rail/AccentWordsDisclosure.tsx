'use client'

import { useState } from 'react'
import { Collapsible } from '@base-ui/react'
import { ChevronDown } from 'lucide-react'
import type { TextSegment } from '@/lib/types/slide'

interface AccentWordsDisclosureProps {
  segments: TextSegment[]
  onToggle: (index: number) => void
  /** Color of accented words (typically template.accentColor). */
  accentColor: string
}

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
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#7d6161] hover:text-[#3d0000] transition-colors"
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
          <div className="flex flex-wrap gap-1.5" data-testid="accent-words-chips">
            {segments.map((seg, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onToggle(i)}
                data-testid={`accent-word-chip-${i}`}
                data-active={seg.accent ? 'true' : 'false'}
                className="px-2 py-1 rounded text-xs font-bold uppercase border transition-all"
                style={{
                  backgroundColor: seg.accent ? accentColor : '#fff0f0',
                  color: seg.accent ? '#000' : '#7d6161',
                  borderColor: seg.accent ? accentColor : '#dbc1bc',
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
