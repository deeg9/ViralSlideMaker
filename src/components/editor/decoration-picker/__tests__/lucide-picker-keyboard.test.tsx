/**
 * PICKER-04 + KBD-12 (Phase 70 Plan 02 Task 3): full WAI-ARIA grid keyboard
 * nav contract for LucidePicker.
 *
 * Grid math:
 *   - 4 cols (CONTEXT D-VIRT)
 *   - ArrowRight  : focus + 1 (clamp at filtered.length - 1)
 *   - ArrowLeft   : focus - 1 (clamp at 0)
 *   - ArrowDown   : focus + 4 (clamp at last row; no wrap)
 *   - ArrowUp     : focus - 4 (escape-to-search if would go negative)
 *   - Enter       : insert focused tile + onClose
 *   - Esc         : onClose (from any focus location)
 *   - Tab         : search → first tile → close button → wrap to search
 *   - Shift+Tab   : reverse cycle
 *   - stopPropagation called on every keydown (defense in depth — Plan 70-03
 *     outer firewall is the authoritative one)
 *
 * Left-at-start-of-row chosen behavior: clamp to focusedIndex - 1 with no
 * wrap. Reaching index 0 stays at index 0 — simplest model and matches the
 * "no out-of-grid focus loss" UX expectation.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { LucidePicker } from '../lucide-picker'

// PITFALL C.1 (mirrored from lucide-picker.test.tsx): jsdom returns 0 for
// offsetWidth/Height; tanstack-virtual reports outerSize === 0 and
// getVirtualItems() emits []. Force non-zero dimensions so the grid renders.
let _origOffsetHeight: PropertyDescriptor | undefined
let _origOffsetWidth: PropertyDescriptor | undefined

beforeAll(() => {
  _origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  _origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() { return 400 },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() { return 600 },
  })
})

afterAll(() => {
  if (_origOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', _origOffsetHeight)
  if (_origOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', _origOffsetWidth)
})

/** Focus a tile by lucideName + return the element. Walks the rendered DOM
 *  (virtualizer renders only some rows; the tile must be within the visible
 *  range — the helper throws if missing). */
function focusTile(name: string): HTMLButtonElement {
  const tile = screen.getByTestId(`lucide-tile-${name}`) as HTMLButtonElement
  tile.focus()
  return tile
}

describe('PICKER-04 LucidePicker keyboard nav', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 1: ArrowRight on a focused tile moves focus to the next tile', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    // Allowlist row 0 = [Heart, Star, Check, Zap]
    const heart = focusTile('Heart')
    fireEvent.keyDown(heart, { key: 'ArrowRight' })
    const star = screen.getByTestId('lucide-tile-Star')
    expect(document.activeElement).toBe(star)
  })

  it('Test 2: ArrowLeft on a focused tile moves focus to the previous tile (clamped at 0)', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const star = focusTile('Star')
    fireEvent.keyDown(star, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-tile-Heart'))

    // ArrowLeft at index 0 → stays at 0 (no wrap)
    const heart = focusTile('Heart')
    fireEvent.keyDown(heart, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-tile-Heart'))
  })

  it('Test 3: ArrowDown on a focused tile moves focus DOWN by 4 (one row)', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    // Allowlist row 0 = [Heart, Star, Check, Zap]; row 1 starts with index 4
    // = ArrowRight (5th in allowlist after PTF13: CheckCheck — wait, the
    // status/nav cluster begins at index 10. PTF13 fixtures are 0..9 so
    // row 0 = Heart,Star,Check,Zap; row 1 = ArrowRight,X,Plus,Crown;
    // row 2 = Sparkles,Circle,CheckCheck,CircleCheck; ...
    // ArrowDown from Heart (index 0) → focus index 4 = ArrowRight.
    const heart = focusTile('Heart')
    fireEvent.keyDown(heart, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-tile-ArrowRight'))
  })

  it('Test 4: ArrowUp on a focused tile (row >= 1) moves focus UP by 4', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const arrowRight = focusTile('ArrowRight') // index 4 (row 1 col 0)
    fireEvent.keyDown(arrowRight, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-tile-Heart'))
  })

  it('Test 5: ArrowDown at last row stays at last row (clamp; no wrap)', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    // For this test: focus a tile in the last visible row, then ArrowDown.
    // Use Heart for simplicity, then jump to filtered.length - 1 by typing
    // a query that produces a small result set — "tag" matches "Tag".
    const search = screen.getByTestId('lucide-picker-search') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'tag' } })
    // Advance past debounce
    act(() => { vi.advanceTimersByTime(260) })
    const tag = focusTile('Tag')
    // ArrowDown from the last (and only) tile should stay on Tag
    fireEvent.keyDown(tag, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-tile-Tag'))
  })

  it('Test 6: ArrowUp on row 0 escapes to the search input', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const heart = focusTile('Heart')
    fireEvent.keyDown(heart, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-picker-search'))
  })

  it('Test 7: Enter on a focused tile dispatches onAddDecoration + calls onClose', () => {
    const onClose = vi.fn()
    const onAddDecoration = vi.fn()
    render(<LucidePicker open={true} onClose={onClose} onAddDecoration={onAddDecoration} />)
    const star = focusTile('Star')
    fireEvent.keyDown(star, { key: 'Enter' })
    expect(onAddDecoration).toHaveBeenCalledTimes(1)
    expect(onAddDecoration.mock.calls[0][0].lucideName).toBe('Star')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Test 8: Esc on the search input calls onClose', () => {
    const onClose = vi.fn()
    render(<LucidePicker open={true} onClose={onClose} onAddDecoration={vi.fn()} />)
    const search = screen.getByTestId('lucide-picker-search')
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Test 9: Esc on a focused tile calls onClose', () => {
    const onClose = vi.fn()
    render(<LucidePicker open={true} onClose={onClose} onAddDecoration={vi.fn()} />)
    const heart = focusTile('Heart')
    fireEvent.keyDown(heart, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Test 10: Tab on the search input moves focus to the first visible tile', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const search = screen.getByTestId('lucide-picker-search')
    ;(search as HTMLInputElement).focus()
    fireEvent.keyDown(search, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-tile-Heart'))
  })

  it('Test 11: Tab on a focused tile moves focus to the close button', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const heart = focusTile('Heart')
    fireEvent.keyDown(heart, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-picker-close'))
  })

  it('Test 12: Tab on the close button wraps focus back to the search input', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const close = screen.getByTestId('lucide-picker-close') as HTMLButtonElement
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-picker-search'))
  })

  it('Test 13: Shift+Tab from search input moves focus to the close button (reverse trap)', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const search = screen.getByTestId('lucide-picker-search') as HTMLInputElement
    search.focus()
    fireEvent.keyDown(search, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByTestId('lucide-picker-close'))
  })

  it('Test 14: every keydown calls e.stopPropagation() (defense in depth)', () => {
    const docHandler = vi.fn()
    document.addEventListener('keydown', docHandler)
    try {
      render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
      const heart = focusTile('Heart')
      // Cmd+G should NOT bubble to the editor tinykeys (would fire GROUP)
      fireEvent.keyDown(heart, { key: 'g', metaKey: true })
      // ArrowRight should not bubble
      fireEvent.keyDown(heart, { key: 'ArrowRight' })
      // Enter should not bubble
      fireEvent.keyDown(heart, { key: 'Enter' })
      expect(docHandler).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', docHandler)
    }
  })
})

