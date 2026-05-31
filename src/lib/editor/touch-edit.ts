// Phase 93 (EDIT-01): gesture-synchronous tap-to-edit for touch.
//
// Phase 92 diagnosed the iOS keyboard break: edit-entry was `onDoubleClick →
// setEditingId(id)` (a setState) and `.focus()` ran LATER in a useEffect / rAF —
// OUTSIDE the user gesture. iOS Safari refuses to summon the soft keyboard when
// `.focus()` is not called synchronously inside the gesture handler.
//
// The fix: on a TOUCH tap, focus the contentEditable surface SYNCHRONOUSLY
// inside the same `pointerup` handler (in addition to flipping React edit state
// so the rich-text → editable swap happens). Because the wrapper's inner text
// node already exists in the DOM, we set `contentEditable=true` imperatively and
// focus it in the same gesture; React then reconciles to the same editable state
// on the next render (idempotent).
//
// Tap-vs-drag: react-rnd (react-draggable) has no movement threshold, so any
// finger move would otherwise start a drag. We track the pointer-down position
// and only treat a pointer-up as a TAP when the total movement stayed under
// TAP_THRESHOLD_PX. A larger move is a drag → react-rnd owns it, no edit.

/** Touch-slop: movement below this (px) between down/up is a tap, not a drag. */
export const TAP_THRESHOLD_PX = 10

type Point = { x: number; y: number }

/**
 * Per-element tap tracker. Call `onDown` in onPointerDown and `wasTap` in
 * onPointerUp. Returns true only for a touch pointer that moved < threshold.
 */
export function createTapTracker() {
  let start: Point | null = null
  let pointerType: string | null = null

  return {
    onDown(e: { clientX: number; clientY: number; pointerType: string }) {
      start = { x: e.clientX, y: e.clientY }
      pointerType = e.pointerType
    },
    /** True if this pointer-up completes a TOUCH tap (small movement). */
    wasTouchTap(e: { clientX: number; clientY: number; pointerType: string }): boolean {
      if (pointerType !== 'touch' || !start) {
        start = null
        return false
      }
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      start = null
      return Math.hypot(dx, dy) < TAP_THRESHOLD_PX
    },
    reset() {
      start = null
      pointerType = null
    },
  }
}

/**
 * Focus an editable surface SYNCHRONOUSLY inside the current user gesture so
 * iOS Safari opens the soft keyboard. `host` is the padding wrapper whose first
 * `[contenteditable]` child (or itself) is the editable surface.
 *
 * - Imperatively sets contentEditable=true (React will reconcile to the same
 *   value once edit-state setState lands — idempotent, no flicker).
 * - Places the caret at the end of existing text.
 * - scrollIntoView({block:'center'}) so the field rides above the iOS keyboard
 *   (the `fixed inset-0` dvh editor shell otherwise lets the keyboard overlay a
 *   low field — Phase 92 diagnosis #4).
 */
export function focusEditableSynchronously(host: HTMLElement | null): void {
  if (!host) return
  const el =
    (host.querySelector('[contenteditable]') as HTMLElement | null) ?? host
  // Make it focusable right now (this render may not have flipped it yet).
  if (el.getAttribute('contenteditable') !== 'true') {
    el.setAttribute('contenteditable', 'true')
  }
  el.focus()
  // Caret at end of existing text.
  try {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  } catch {
    // selection APIs can throw on detached nodes — focus already happened.
  }
  // Keep the focused field above the iOS keyboard.
  try {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch {
    /* older Safari: scrollIntoView(boolean) fallback not needed here */
  }
}
