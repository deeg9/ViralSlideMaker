'use client'

import { Type, AlignLeft, Square, Plus } from 'lucide-react'
import type { TextBox, TextBoxRole } from '@/lib/types/slide'

interface LayerStripProps {
  textBoxes: TextBox[]
  selectedTextBoxId: string | null
  onSelect: (textBoxId: string) => void
  /** Dispatches ADD_TEXT_BOX with role='custom' at the parent. */
  onAdd: () => void
}

const PREVIEW_CHARS = 16

function previewText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return '(empty)'
  if (trimmed.length <= PREVIEW_CHARS) return trimmed
  return `${trimmed.slice(0, PREVIEW_CHARS)}…`
}

function RoleIcon({ role }: { role: TextBoxRole }) {
  // lucide icons sized to match the rest of the right rail's small chrome.
  const cls = 'w-3.5 h-3.5'
  switch (role) {
    case 'hook':
      return <Type className={cls} aria-hidden />
    case 'body':
      return <AlignLeft className={cls} aria-hidden />
    case 'custom':
    default:
      return <Square className={cls} aria-hidden />
  }
}

/**
 * Phase 50 (D-02): horizontal chip row at the top of the right rail. Each
 * chip = role icon + first ~16 chars of text. Active chip is filled, inactive
 * chips are pink. Trailing dashed "+ Add Text Box" chip dispatches the add
 * action through the parent. Click on a chip swaps `selectedTextBoxId`.
 *
 * Pure presentational — does NOT own selection state. Parent owns
 * `selectedTextBoxId` (Phase 49 D-16, lives in `useSlideEditor` React state).
 */
export function LayerStrip({
  textBoxes,
  selectedTextBoxId,
  onSelect,
  onAdd,
}: LayerStripProps) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1"
      data-testid="layer-strip"
      role="tablist"
      aria-label="Text boxes"
    >
      {textBoxes.map((tb) => {
        const active = tb.id === selectedTextBoxId
        return (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tb.id)}
            data-testid={`layer-chip-${tb.id}`}
            data-active={active ? 'true' : 'false'}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors',
              active
                ? 'bg-[#3d0000] text-white'
                : 'bg-[#fadbdb] text-[#3d0000] hover:bg-[#fff0f0]',
            ].join(' ')}
          >
            <RoleIcon role={tb.role} />
            <span>{previewText(tb.text)}</span>
          </button>
        )
      })}

      <button
        type="button"
        onClick={onAdd}
        data-testid="layer-strip-add"
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-white border-2 border-dashed border-[#3d0000]/30 text-[#3d0000] hover:bg-[#fff0f0] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden />
        <span>Add Text Box</span>
      </button>
    </div>
  )
}
