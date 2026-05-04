'use client'

/**
 * PICKER-01..06 (Phase 70 Plan 02 Task 2): LucidePicker modal.
 *
 * The headline UI of Phase 70. A lazy-loaded modal — mirror publish-modal.tsx's
 * shell — containing:
 *   - Search input with 250ms debounce → ufuzzy fuzzy search (PICKER-03 + D-FUZZY)
 *   - 4-col virtualized grid of all 118 Lucide icons from
 *     LUCIDE_DECORATION_ALLOWLIST (Phase 69-01) via @tanstack/react-virtual
 *     (PICKER-02 + D-VIRT)
 *   - Click on tile → onAddDecoration(buildDefaultIconDecoration(name)) +
 *     onClose() (PICKER-05 D-CLICK-INSERT). Plan 70-03 wires the parent to
 *     auto-select the new decoration via selection.replaceWith([newId]).
 *   - Hover tooltip via native `title=` attribute — no custom tooltip component
 *     (PICKER-06)
 *
 * Mounting / lazy-load contract:
 *   This is the EAGER component. Consumers MUST import LucidePickerDynamic
 *   from `lucide-picker.dynamic.tsx` (Task 3) — that wrapper uses next/dynamic
 *   with `loading: () => null` + `ssr: false` to keep the lucide-static corpus
 *   (1,703 SVG strings) + tanstack-virtual + ufuzzy OUT of the editor route
 *   eager bundle (PICKER-08 + DEPS-05). The barrel `./index.ts` exports ONLY
 *   the dynamic wrapper.
 *
 * Keyboard scope (defense in depth):
 *   - This component calls e.stopPropagation() on every keydown so the editor
 *     tinykeys handlers receive nothing while the picker is open.
 *   - The AUTHORITATIVE firewall is the `isPickerOpenRef` second short-circuit
 *     added by Plan 70-03 to all 33 tinykeys sites in slide-editor.tsx — both
 *     layers must work; SWEEP-PICK tests in Plan 70-03 verify.
 *
 * Full WAI-ARIA grid keyboard navigation (arrows traverse, Tab focus trap)
 * lands in Task 3 (this file extended, no new component).
 *
 * PCL11 contract: NO `*selection*` / `*marquee*` / `*guide*` / `*lock-icon*` /
 * `*decoration-ring*` classNames anywhere in this DOM. The picker is editor
 * chrome OFF-canvas — none of those tokens belong here.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Decoration } from '@/lib/types/decoration'
import { renderDecoration } from '@/lib/render/decoration-renderer'
import {
  LUCIDE_PICKER_CORPUS,
  filterIcons,
  type PickerCorpusEntry,
} from './lucide-picker-corpus'
import { buildDefaultIconDecoration } from './icon-defaults'

/** 4-column responsive grid (PICKER-02 + CONTEXT D-VIRT). */
const COLS = 4

/** Estimated row height (px) used by useVirtualizer.estimateSize. Tile is 32px
 *  glyph + label + padding; round to 80px for headroom. Real height comes
 *  from the virtualizer's measured size cache after first paint. */
const ROW_HEIGHT_PX = 80

/** Scroll-container fixed height — matches publish-modal vertical proportion
 *  (max-h-[80vh] on the card, ~400px reserved for the grid below the search
 *  input). */
const GRID_HEIGHT_PX = 400

/** Search debounce window in ms. CONTEXT D-FUZZY locks 250ms; the debounce
 *  caps ufuzzy invocation rate to ~4 Hz under rapid typing (T-70-13 STRIDE
 *  mitigation). */
const SEARCH_DEBOUNCE_MS = 250

export interface LucidePickerProps {
  open: boolean
  onClose: () => void
  onAddDecoration: (decoration: Decoration) => void
}

export function LucidePicker({ open, onClose, onAddDecoration }: LucidePickerProps) {
  // ============================================================
  // Hooks — declared unconditionally so React's rules-of-hooks
  // is satisfied even though the component returns null when
  // !open. The early-return below sits AFTER all hook calls.
  // ============================================================
  const searchRef = useRef<HTMLInputElement | null>(null)
  const parentRef = useRef<HTMLDivElement | null>(null)

  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // 250ms debounce — pre-debounce keystrokes batch into one filter call.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [rawQuery])

  const filtered: PickerCorpusEntry[] = useMemo(
    () => filterIcons(debouncedQuery),
    [debouncedQuery],
  )

  const rowCount = Math.ceil(filtered.length / COLS)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 4,
    // PITFALL C.1: jsdom's ResizeObserver mock is a no-op, so the virtualizer
    // never receives a post-mount measurement. Seed `initialRect` with the
    // grid container dimensions so getVirtualItems() emits non-zero rows on
    // first render — under real browser conditions ResizeObserver fires
    // immediately after mount and the initialRect is overwritten before the
    // user sees a frame.
    initialRect: { width: 600, height: GRID_HEIGHT_PX },
  })

  // Auto-focus the search input on open. Mirrors publish-modal's
  // mount-time focus behavior (autoFocus on the first <input>).
  useEffect(() => {
    if (!open) return
    // schedule on a microtask so the input is mounted before .focus()
    const id = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  // Reset query on close so a re-open starts from the full corpus.
  useEffect(() => {
    if (!open) {
      setRawQuery('')
      setDebouncedQuery('')
    }
  }, [open])

  if (!open) return null

  // ============================================================
  // Handlers
  // ============================================================

  function handleTileClick(name: string) {
    const decoration = buildDefaultIconDecoration(name)
    if (decoration === null) return // closed-enum guard (T-70-09)
    onAddDecoration(decoration)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Defense in depth — the AUTHORITATIVE outer firewall is Plan 70-03's
    // isPickerOpenRef short-circuit on slide-editor.tsx tinykeys sites. This
    // inner stopPropagation ensures the editor tinykeys never see picker
    // events even if the outer firewall regresses.
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      data-testid="lucide-picker"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Insert icon"
        className="w-full max-w-2xl rounded-2xl bg-white p-6 border border-[#dbc1bc]/40 shadow-xl"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#3d0000]">Insert icon</h2>
            <p className="text-sm text-[#7d6161] mt-1">
              Pick a Lucide icon — click to insert at slide center.
            </p>
          </div>
          <button
            type="button"
            data-testid="lucide-picker-close"
            onClick={onClose}
            aria-label="Close icon picker"
            className="p-1 text-[#7d6161] hover:bg-[#fadbdb] rounded-lg"
          >
            ×
          </button>
        </div>

        {/* Search input */}
        <input
          ref={searchRef}
          type="text"
          data-testid="lucide-picker-search"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Search icons (e.g. heart, arrow)…"
          autoFocus
          className="w-full px-4 py-2.5 rounded-xl border border-[#dbc1bc]/60 bg-[#fff8f7] text-[#3d0000] focus:outline-none focus:ring-2 focus:ring-[#3d0000]/20"
        />

        {/* Results count for screen readers + visible status line */}
        <div
          className="mt-2 mb-3 text-xs text-[#7d6161]"
          aria-live="polite"
          data-testid="lucide-picker-status"
        >
          {filtered.length === 0
            ? 'No icons match'
            : filtered.length === LUCIDE_PICKER_CORPUS.length
              ? `${filtered.length} icons`
              : `${filtered.length} matching`}
        </div>

        {/* Virtualized 4-col grid */}
        <div
          ref={parentRef}
          style={{
            overflow: 'auto',
            height: GRID_HEIGHT_PX,
            // flex-grow inside the column shell so the modal scales with viewport
            flex: '1 1 auto',
          }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const start = row.index * COLS
              const rowEntries = filtered.slice(start, start + COLS)
              return (
                <div
                  key={row.key}
                  style={{
                    position: 'absolute',
                    top: row.start,
                    left: 0,
                    right: 0,
                    height: row.size,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                    gap: 8,
                  }}
                >
                  {rowEntries.map((entry) => (
                    <IconTile
                      key={entry.lucideName}
                      entry={entry}
                      onClick={() => handleTileClick(entry.lucideName)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// IconTile — single tile button with miniature glyph preview
// ============================================================

interface IconTileProps {
  entry: PickerCorpusEntry
  onClick: () => void
}

function IconTile({ entry, onClick }: IconTileProps) {
  return (
    <button
      type="button"
      data-testid={`lucide-tile-${entry.lucideName}`}
      title={entry.lucideName}
      aria-label={`Insert ${entry.displayName}`}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-md border border-transparent p-2 text-neutral-700 hover:border-[#dbc1bc] hover:bg-[#fff8f7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d0000]/40"
    >
      <IconGlyphPreview lucideName={entry.lucideName} />
      <span className="text-[10px] truncate max-w-full">{entry.displayName}</span>
    </button>
  )
}

/** Miniature preview — uses renderDecoration (Phase 69) so the picker tile is
 *  byte-identical to what the canvas will render (TPLREND-05 single source of
 *  truth). The wrapper sizes it at 32×32 via inline style; renderDecoration
 *  emits absolute-positioned children using % coords, so we pin the wrapper
 *  to position:relative + a fixed size box for the % math to resolve to px. */
function IconGlyphPreview({ lucideName }: { lucideName: string }) {
  const decoration = useMemo(
    () => buildDefaultIconDecoration(lucideName),
    [lucideName],
  )
  if (decoration === null) return null

  // Override the position so the icon fills the preview box.
  const previewDecoration = {
    ...decoration,
    position: { x: 0, y: 0, width: 100, height: 100 },
  }
  return (
    <div
      style={{ position: 'relative', width: 32, height: 32 }}
      aria-hidden="true"
    >
      {renderDecoration(previewDecoration, {})}
    </div>
  )
}
