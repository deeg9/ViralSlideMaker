'use client'

import { useEffect, useRef, useState } from 'react'
import { Type, AlignLeft, Square, Plus, ChevronDown, Check } from 'lucide-react'
import type { TextBox, TextBoxRole } from '@/lib/types/slide'

interface LayerStripProps {
  textBoxes: TextBox[]
  selectedTextBoxId: string | null
  onSelect: (textBoxId: string) => void
  /** Dispatches ADD_TEXT_BOX with role='custom' at the parent. */
  onAdd: () => void
}

// quick-260514-l1p: shown in both the trigger button and the menu items.
// 24-char ceiling on the trigger lets a full hook fit on one line at typical
// right-rail width; menu rows can show a touch more (32) before truncating.
const TRIGGER_PREVIEW_CHARS = 24
const MENU_PREVIEW_CHARS = 32

function previewText(text: string, limit: number): string {
  const trimmed = text.trim()
  if (!trimmed) return '(empty)'
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, limit)}…`
}

function RoleIcon({ role }: { role: TextBoxRole }) {
  // lucide icons sized to match the rest of the right rail's small chrome.
  const cls = 'w-3.5 h-3.5 shrink-0'
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
 * quick-260514-l1p: dropdown at the top of the right rail for picking which
 * text box to edit. Replaces the previous horizontal-scroll chip row — users
 * with 3+ text boxes had to scroll left/right to find one; now they click the
 * dropdown and see every text box at once.
 *
 * Closed state: button shows the active text box (role icon + preview text +
 *               chevron). The chevron rotates 180° when open.
 * Open state:   listbox menu of text boxes, each row mirroring the trigger's
 *               role-icon + text shape; active row highlighted with a check
 *               glyph. Trailing "+ Add Text Box" item dispatches the add
 *               action through `onAdd`. Selecting a row OR adding closes the
 *               menu.
 *
 * Click-outside closes. Esc closes (keyboard a11y).
 *
 * Pure presentational — does NOT own selection state. Parent owns
 * `selectedTextBoxId` (Phase 49 D-16, lives in `useSlideEditor` React state).
 *
 * Test-id contract preserved across the redesign:
 *   - `layer-strip` on the wrapper
 *   - `layer-chip-${id}` on each menu row (formerly each chip)
 *   - `layer-strip-add` on the "+ Add Text Box" menu item (formerly the chip)
 *   - new `layer-strip-toggle` on the trigger button
 */
export function LayerStrip({
  textBoxes,
  selectedTextBoxId,
  onSelect,
  onAdd,
}: LayerStripProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Resolve the "active" box for the trigger label. Prefer the explicitly
  // selected box; fall back to the first box (matches ActiveTextBoxCard
  // resolution shape downstream) so the trigger never reads empty when the
  // slide has at least one text box.
  const activeBox =
    textBoxes.find((tb) => tb.id === selectedTextBoxId) ?? textBoxes[0] ?? null

  return (
    <div ref={wrapperRef} className="relative" data-testid="layer-strip">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="layer-strip-toggle"
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-full text-xs font-bold bg-[#3d0000] text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000] focus-visible:ring-offset-1"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {activeBox ? (
            <>
              <RoleIcon role={activeBox.role} />
              <span className="truncate">
                {previewText(activeBox.text, TRIGGER_PREVIEW_CHARS)}
              </span>
            </>
          ) : (
            <>
              <Square className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span className="truncate">No text box</span>
            </>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Text boxes"
          className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-lg ring-1 ring-black/5 py-1 max-h-72 overflow-y-auto"
        >
          {textBoxes.map((tb) => {
            const isActive = tb.id === selectedTextBoxId
            return (
              <button
                key={tb.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect(tb.id)
                  setOpen(false)
                }}
                data-testid={`layer-chip-${tb.id}`}
                data-active={isActive ? 'true' : 'false'}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold transition-colors focus-visible:outline-none focus-visible:bg-[#fff0f0]',
                  isActive
                    ? 'bg-[#fff0f0] text-[#3d0000]'
                    : 'text-[#7d6161] hover:bg-[#fff0f0] hover:text-[#3d0000]',
                ].join(' ')}
              >
                <RoleIcon role={tb.role} />
                <span className="flex-1 truncate">
                  {previewText(tb.text, MENU_PREVIEW_CHARS)}
                </span>
                {isActive && (
                  <Check className="w-3.5 h-3.5 shrink-0 text-[#3d0000]" aria-hidden />
                )}
              </button>
            )
          })}

          {textBoxes.length > 0 && (
            <div className="border-t border-[#dbc1bc]/20 my-1" />
          )}

          <button
            type="button"
            onClick={() => {
              onAdd()
              setOpen(false)
            }}
            data-testid="layer-strip-add"
            aria-label="Add text box"
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-[#3d0000] hover:bg-[#fff0f0] transition-colors focus-visible:outline-none focus-visible:bg-[#fff0f0]"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>Add Text Box</span>
          </button>
        </div>
      )}
    </div>
  )
}
