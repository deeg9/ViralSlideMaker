/**
 * PICKER-01..06 (Phase 70 Plan 02 Task 2): LucidePicker modal contract tests.
 *
 * Modal mount + virtualized 4-col grid + ufuzzy fuzzy search (250ms debounce)
 * + click-insert dispatch + native title= tooltips. Editor-only — never
 * appears in Satori path. Mounting/firewall handled by Plan 70-03 (slide-editor
 * isPickerOpenRef + tinykeys gate).
 *
 * Keyboard nav scope:
 *   - Esc / stopPropagation : asserted here (basic defense-in-depth check)
 *   - Full WAI-ARIA grid    : Task 3 (lucide-picker-keyboard.test.tsx)
 *
 * Virtualization: tanstack-virtual reads getBoundingClientRect; the global
 * setup.ts mock returns 1080×1920 by default — sufficient for our functional
 * assertions (filter narrows array, click dispatches, etc.). We do NOT assert
 * exact visible-row counts.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { LucidePicker } from '../lucide-picker'

// PITFALL C.1: jsdom returns 0 for offsetWidth/offsetHeight (no layout engine).
// @tanstack/react-virtual reads getRect(element) → element.offsetWidth/Height
// to compute outerSize; outerSize === 0 means calculateRange returns null and
// getVirtualItems() emits []. Override at the suite level so the virtualizer
// believes the scroll container has 600×400 of paintable area — sufficient
// for our functional assertions (filter + click + tooltip + dispatch).
// Real browsers report offsetWidth/Height correctly post-layout; this shim is
// jsdom-only.
let _origOffsetHeight: PropertyDescriptor | undefined
let _origOffsetWidth: PropertyDescriptor | undefined

beforeAll(() => {
  _origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  _origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return 400
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return 600
    },
  })
})

afterAll(() => {
  if (_origOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', _origOffsetHeight)
  if (_origOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', _origOffsetWidth)
})

describe('PICKER-01..06 LucidePicker modal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 1: open=false renders nothing', () => {
    const { container } = render(
      <LucidePicker open={false} onClose={vi.fn()} onAddDecoration={vi.fn()} />,
    )
    expect(container.querySelector('[data-testid="lucide-picker"]')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Test 2: open=true renders modal with role="dialog" + aria-label="Insert icon" + aria-modal="true"', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-label')?.toLowerCase()).toContain('insert icon')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // search input present
    expect(screen.getByTestId('lucide-picker-search')).toBeTruthy()
    // close button present
    expect(screen.getByTestId('lucide-picker-close')).toBeTruthy()
    // root data-testid
    expect(screen.getByTestId('lucide-picker')).toBeTruthy()
  })

  it('Test 3: search input is auto-focused on open', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const search = screen.getByTestId('lucide-picker-search')
    expect(document.activeElement).toBe(search)
  })

  it('Test 4: typing "heart" filters grid via 250ms debounce — pre-debounce shows full corpus, post-debounce shows filtered', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const search = screen.getByTestId('lucide-picker-search') as HTMLInputElement

    // Pre-debounce: Star tile is in the full corpus
    expect(screen.getByTestId('lucide-tile-Star')).toBeTruthy()

    // Type "heart" — should NOT filter immediately (debounce)
    fireEvent.change(search, { target: { value: 'heart' } })
    // Star is still rendered (debounce hasn't fired yet)
    expect(screen.queryByTestId('lucide-tile-Star')).toBeTruthy()

    // Advance past 250ms debounce
    act(() => {
      vi.advanceTimersByTime(260)
    })

    // Now the grid filtered to Heart-matching entries; Star is filtered out
    expect(screen.getByTestId('lucide-tile-Heart')).toBeTruthy()
    expect(screen.queryByTestId('lucide-tile-Star')).toBeNull()
  })

  it('Test 4b: clearing search restores the full corpus after debounce', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const search = screen.getByTestId('lucide-picker-search') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'heart' } })
    act(() => {
      vi.advanceTimersByTime(260)
    })
    expect(screen.queryByTestId('lucide-tile-Star')).toBeNull()

    fireEvent.change(search, { target: { value: '' } })
    act(() => {
      vi.advanceTimersByTime(260)
    })
    expect(screen.getByTestId('lucide-tile-Star')).toBeTruthy()
    expect(screen.getByTestId('lucide-tile-Heart')).toBeTruthy()
  })

  it('Test 5: virtualized grid renders only a SUBSET of the 118-icon corpus (≤80 tiles in DOM)', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const tiles = document.querySelectorAll('[data-testid^="lucide-tile-"]')
    // Virtualizer renders only visible rows + overscan; with 4 cols × ~5
    // visible rows + 4 overscan = ≤ ~36 tiles. Cap at 80 as a generous gate.
    expect(tiles.length).toBeLessThanOrEqual(80)
    // But > 0 — at least one row must render (else the grid is broken)
    expect(tiles.length).toBeGreaterThan(0)
  })

  it('Test 6: clicking a tile dispatches onAddDecoration ONCE with a buildDefaultIconDecoration() output and calls onClose ONCE', async () => {
    const onClose = vi.fn()
    const onAddDecoration = vi.fn()
    render(
      <LucidePicker open={true} onClose={onClose} onAddDecoration={onAddDecoration} />,
    )

    const heartTile = screen.getByTestId('lucide-tile-Heart')
    fireEvent.click(heartTile)

    expect(onAddDecoration).toHaveBeenCalledTimes(1)
    const decoration = onAddDecoration.mock.calls[0][0]
    expect(decoration.kind).toBe('icon')
    expect(decoration.lucideName).toBe('Heart')
    expect(decoration.color).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(decoration.id).toBeTruthy()
    expect(decoration.position.width).toBe(12)
    expect(decoration.position.height).toBe(12)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Test 7: hover over tile shows native title= attribute matching the lucide name', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const heart = screen.getByTestId('lucide-tile-Heart')
    expect(heart.getAttribute('title')).toBe('Heart')
  })

  it('Test 8: close button click → onClose called', () => {
    const onClose = vi.fn()
    render(<LucidePicker open={true} onClose={onClose} onAddDecoration={vi.fn()} />)
    fireEvent.click(screen.getByTestId('lucide-picker-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Test 9: corpus order preserves LUCIDE_DECORATION_ALLOWLIST insertion order — PTF13 fixtures (Heart, Star, ...) are present in initial render', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    // The first row (4 cols) of the allowlist is Heart, Star, Check, Zap — all
    // PTF13 fixtures. Virtualizer with overscan renders these initial rows.
    expect(screen.getByTestId('lucide-tile-Heart')).toBeTruthy()
    expect(screen.getByTestId('lucide-tile-Star')).toBeTruthy()
    expect(screen.getByTestId('lucide-tile-Check')).toBeTruthy()
    expect(screen.getByTestId('lucide-tile-Zap')).toBeTruthy()
  })

  it('Test 10: data-testid attributes follow the documented naming conventions', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    expect(screen.getByTestId('lucide-picker')).toBeTruthy()
    expect(screen.getByTestId('lucide-picker-search')).toBeTruthy()
    expect(screen.getByTestId('lucide-picker-close')).toBeTruthy()
    expect(screen.getByTestId('lucide-tile-Heart')).toBeTruthy()
  })

  it('Test 11: Esc on the modal calls onClose', () => {
    const onClose = vi.fn()
    render(<LucidePicker open={true} onClose={onClose} onAddDecoration={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Test 12: every keydown on the picker container calls e.stopPropagation() (defense in depth — outer firewall is Plan 70-03)', () => {
    const docHandler = vi.fn()
    document.addEventListener('keydown', docHandler)
    try {
      render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
      const dialog = screen.getByRole('dialog')
      // Fire a non-Escape key — picker shouldn't propagate it to the document
      fireEvent.keyDown(dialog, { key: 'g', metaKey: true })
      expect(docHandler).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', docHandler)
    }
  })

  it('Test 13: clicking the modal backdrop calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(
      <LucidePicker open={true} onClose={onClose} onAddDecoration={vi.fn()} />,
    )
    const backdrop = container.querySelector('[data-testid="lucide-picker"]') as HTMLElement
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Test 14: clicking inside the modal card does NOT call onClose (stopPropagation)', () => {
    const onClose = vi.fn()
    render(<LucidePicker open={true} onClose={onClose} onAddDecoration={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Test 15: query "xyznotreal" produces a NO_RESULTS state (zero tiles after debounce)', () => {
    render(<LucidePicker open={true} onClose={vi.fn()} onAddDecoration={vi.fn()} />)
    const search = screen.getByTestId('lucide-picker-search') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'xyznotreal' } })
    act(() => {
      vi.advanceTimersByTime(260)
    })
    const tiles = document.querySelectorAll('[data-testid^="lucide-tile-"]')
    expect(tiles.length).toBe(0)
  })
})

// ============================================================
// PICKER-08 Dynamic wrapper contract (Task 3)
// ============================================================

describe('PICKER-08 LucidePickerDynamic next/dynamic wrapper', () => {
  it('Test 16: LucidePickerDynamic is exported as a renderable component', async () => {
    const mod = await import('../lucide-picker.dynamic')
    // next/dynamic returns a React component (function OR forwardRef object
    // depending on Next.js version). Accept either: must be a usable React
    // component handle (truthy + not the eager component reference).
    expect(mod.LucidePickerDynamic).toBeTruthy()
    const t = typeof mod.LucidePickerDynamic
    expect(t === 'function' || t === 'object').toBe(true)
    // It must NOT be the eager LucidePicker function itself (would defeat the
    // lazy-load contract — that's a regression signal).
    const eager = await import('../lucide-picker')
    expect(mod.LucidePickerDynamic).not.toBe(eager.LucidePicker)
  })

  it('Test 17: barrel index.ts exports LucidePickerDynamic but NOT the eager LucidePicker', async () => {
    // Read the barrel source as text to assert the contract — runtime
    // exports might be bundled; the source-level contract is the shipped one.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const barrelPath = path.join(
      process.cwd(),
      'src/components/editor/decoration-picker/index.ts',
    )
    const barrelSrc = await fs.readFile(barrelPath, 'utf-8')

    // Must export the dynamic wrapper
    expect(barrelSrc).toMatch(/export\s+\{[^}]*LucidePickerDynamic[^}]*\}/)

    // Must NOT export the eager LucidePicker as a value (only the props type
    // is allowed via `export type`). The eager component would break the
    // PICKER-08 lazy-load contract if a consumer imported it from the barrel.
    const eagerExportRe = /export\s+\{[^}]*\bLucidePicker\b(?!Dynamic)[^}]*\}\s+from\s+['"]\.\/lucide-picker['"]/
    expect(barrelSrc).not.toMatch(eagerExportRe)
  })

  it('Test 18: dynamic wrapper source uses next/dynamic with loading: () => null + ssr: false', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const dynPath = path.join(
      process.cwd(),
      'src/components/editor/decoration-picker/lucide-picker.dynamic.tsx',
    )
    const dynSrc = await fs.readFile(dynPath, 'utf-8')
    expect(dynSrc).toMatch(/from\s+['"]next\/dynamic['"]/)
    expect(dynSrc).toMatch(/loading:\s*\(\)\s*=>\s*null/)
    expect(dynSrc).toMatch(/ssr:\s*false/)
    // Imports the eager picker via the dynamic () => import('./lucide-picker') form
    expect(dynSrc).toMatch(/import\(['"]\.\/lucide-picker['"]\)/)
  })
})
