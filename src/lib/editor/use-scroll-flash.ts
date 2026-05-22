import { useEffect, useRef, useState } from 'react'

/**
 * Scroll a section into view and flash a highlight ring when `nonce` changes.
 *
 * Used by the right-rail control cards (caption card, watermark, decoration) so
 * that clicking the matching element on the canvas visibly surfaces its controls
 * — the panel switches tab, the card scrolls into view, and a ring pulses for
 * ~1s so the user can see which element they just picked.
 *
 * `nonce` is an incrementing counter (NOT a boolean): re-clicking the same
 * element produces a new nonce, so the flash re-triggers. A falsy nonce
 * (undefined / 0) is inert — untargeted cards never scroll or flash on mount.
 *
 * Returns a ref to attach to the section root and a `flashing` boolean to drive
 * the ring class.
 */
export function useScrollFlash<T extends HTMLElement>(nonce: number | undefined) {
  const ref = useRef<T>(null)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (!nonce) return
    const el = ref.current
    if (!el) return
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    setFlashing(true)
    const timer = setTimeout(() => setFlashing(false), 1000)
    return () => clearTimeout(timer)
  }, [nonce])

  return { ref, flashing }
}
