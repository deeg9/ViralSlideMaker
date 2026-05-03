/**
 * Phase 60 (KBD-02): The shortcut firewall.
 *
 * Returns true when the active focus target is a text-input surface
 * (input, textarea, or contentEditable). Every tinykeys binding in
 * slide-editor.tsx wraps its handler in `if (isEditingTarget(e.target)) return;`
 * to ensure shortcuts never override text-input behavior.
 *
 * Lifted from the existing inline guard at slide-editor.tsx:341-348 (per
 * RESEARCH SUMMARY §Critical Pitfall 7) — but with one carry-over from the
 * pre-tinykeys handler: if `target` is not an HTMLElement (e.g. it's the
 * Window / Document because the event was dispatched directly there, as
 * happens with `fireEvent.keyDown(window, ...)` in tests, OR because no
 * element has focus) fall back to `document.activeElement`. In real browser
 * usage the bubbled keydown's `e.target` is the focused element so the fast
 * path is taken; the fallback only matters for synthetic dispatches.
 *
 * No React, no state — safe to import from any layer.
 */
export function isEditingTarget(target: EventTarget | null): boolean {
  let el: HTMLElement | null = null
  if (target && typeof (target as { tagName?: unknown }).tagName === 'string') {
    el = target as HTMLElement
  } else if (typeof document !== 'undefined') {
    el = document.activeElement as HTMLElement | null
  }
  const tag = (el?.tagName ?? '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || el?.isContentEditable === true
}
