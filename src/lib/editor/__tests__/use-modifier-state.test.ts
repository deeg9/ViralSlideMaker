import { describe, test, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useModifierState } from '@/lib/editor/use-modifier-state'

// ─────────────────────────────────────────────────────────────────────────────
// useModifierState — KBD-04
//
// Tracks Shift / Cmd / Alt via window keydown/keyup events. Resets on
// window.blur AND document.visibilitychange so that "Cmd+Tab away" doesn't
// leave the editor stuck thinking Cmd is still held.
//
// Implementation must use refs (NOT useState) so consumers don't re-render
// at 60Hz when modifiers change — Phase 63's hold-Cmd-disable-snap will
// live on the snap hot path.
// ─────────────────────────────────────────────────────────────────────────────

describe('useModifierState — initial state', () => {
  test('Test 1: get() returns { shift:false, cmd:false, alt:false } on mount', () => {
    const { result } = renderHook(() => useModifierState())
    expect(result.current.get()).toEqual({ shift: false, cmd: false, alt: false })
  })
})

describe('useModifierState — keydown tracking', () => {
  test('Test 2: keydown with shiftKey=true → get().shift === true', () => {
    const { result } = renderHook(() => useModifierState())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { shiftKey: true, key: 'Shift' }))
    })
    expect(result.current.get().shift).toBe(true)
  })

  test('Test 3: keydown with metaKey=true → get().cmd === true (Mac path)', () => {
    const { result } = renderHook(() => useModifierState())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'Meta' }))
    })
    expect(result.current.get().cmd).toBe(true)
  })

  test('Test 3b: keydown with ctrlKey=true → get().cmd === true (Win/Linux path)', () => {
    const { result } = renderHook(() => useModifierState())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'Control' }))
    })
    expect(result.current.get().cmd).toBe(true)
  })

  test('Test 4: keydown with altKey=true → get().alt === true', () => {
    const { result } = renderHook(() => useModifierState())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key: 'Alt' }))
    })
    expect(result.current.get().alt).toBe(true)
  })
})

describe('useModifierState — KBD-04 reset on window.blur + visibilitychange', () => {
  test('Test 5: window.blur after modifiers held resets all three to false', () => {
    const { result } = renderHook(() => useModifierState())
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { shiftKey: true, metaKey: true, altKey: true, key: 'a' }),
      )
    })
    expect(result.current.get()).toEqual({ shift: true, cmd: true, alt: true })

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(result.current.get()).toEqual({ shift: false, cmd: false, alt: false })
  })

  test('Test 6: document.visibilitychange after modifiers held resets all three to false', () => {
    const { result } = renderHook(() => useModifierState())
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { shiftKey: true, metaKey: true, altKey: true, key: 'a' }),
      )
    })
    expect(result.current.get()).toEqual({ shift: true, cmd: true, alt: true })

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.get()).toEqual({ shift: false, cmd: false, alt: false })
  })
})

describe('useModifierState — keyup release', () => {
  test('Test 7: keyup with shiftKey=false (release) → get().shift === false', () => {
    const { result } = renderHook(() => useModifierState())
    // Press shift first
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { shiftKey: true, key: 'Shift' }))
    })
    expect(result.current.get().shift).toBe(true)

    // Release: keyup event reports shiftKey=false
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { shiftKey: false, key: 'Shift' }))
    })
    expect(result.current.get().shift).toBe(false)
  })
})

describe('useModifierState — stable get reference', () => {
  test('Test 8: get function reference is stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useModifierState())
    const firstGet = result.current.get
    rerender()
    const secondGet = result.current.get
    expect(secondGet).toBe(firstGet)
  })
})

describe('useModifierState — perf invariant', () => {
  test('Test 9: source file does NOT use useState (refs-only for perf)', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync('src/lib/editor/use-modifier-state.ts', 'utf8')
    expect(src).not.toMatch(/\buseState\b/)
  })
})
