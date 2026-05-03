'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Phase 60 (KBD-04): Track Shift / Cmd / Alt state for the editor.
 *
 * Uses refs (not state) so consumers don't re-render at 60Hz during drag.
 * Per RESEARCH Q4: Phase 63's hold-Cmd-disable-snap will live on the snap
 * hot path — re-rendering on every keystroke would cascade through <Rnd>
 * and hit PITFALL-11.2.
 *
 * Resets all three modifiers to false on:
 *   - window.blur (Cmd+Tab away — keyup never fires)
 *   - document.visibilitychange (tab switch)
 *
 * Phase 60 only ships the hook + reset infrastructure. Hold-Cmd-disable-snap
 * (Phase 63) and additive-marquee (Phase 61) are the consumers.
 */
export interface ModifierState {
  shift: boolean
  /** metaKey on Mac, ctrlKey on Windows/Linux */
  cmd: boolean
  alt: boolean
}

export interface ModifierStateApi {
  /** Returns the current modifier state. Stable reference (useCallback). */
  get(): ModifierState
}

export function useModifierState(): ModifierStateApi {
  const stateRef = useRef<ModifierState>({ shift: false, cmd: false, alt: false })

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      stateRef.current = {
        shift: e.shiftKey,
        cmd: e.metaKey || e.ctrlKey,
        alt: e.altKey,
      }
    }
    function handleReset() {
      stateRef.current = { shift: false, cmd: false, alt: false }
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)
    window.addEventListener('blur', handleReset)
    document.addEventListener('visibilitychange', handleReset)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
      window.removeEventListener('blur', handleReset)
      document.removeEventListener('visibilitychange', handleReset)
    }
  }, [])

  const get = useCallback(() => stateRef.current, [])
  return { get }
}
