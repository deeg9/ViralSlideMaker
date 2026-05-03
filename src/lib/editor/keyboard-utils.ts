/**
 * Phase 60 (KBD-02): The shortcut firewall.
 *
 * Returns true when the active focus target is a text-input surface
 * (input, textarea, or contentEditable). Every tinykeys binding in
 * slide-editor.tsx wraps its handler in `if (isEditingTarget(e.target)) return;`
 * to ensure shortcuts never override text-input behavior.
 *
 * Lifted verbatim from the existing inline guard at slide-editor.tsx:341-348
 * (per RESEARCH SUMMARY §Critical Pitfall 7).
 *
 * No React, no state — safe to import from any layer.
 */
export function isEditingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = (el?.tagName ?? '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || el?.isContentEditable === true
}
