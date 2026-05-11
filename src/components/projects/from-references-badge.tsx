// Phase 77 Plan 03 (EDITOR-02): visible provenance chip on project cards.
// Pure presentation — no data fetching, no router, no state hooks.
// Conditional visibility on hasStyleSpec.
//
// LEGAL-03 framing: "Inspired by references" — NEVER "copied from" /
// "cloned from" / "exactly like" / "duplicate of". Tested via grep at the
// component level (Test 5) AND defended by the future Phase 79 repo-wide
// LEGAL-03 grep gate.

interface FromReferencesBadgeProps {
  hasStyleSpec: boolean
}

export function FromReferencesBadge({ hasStyleSpec }: FromReferencesBadgeProps) {
  if (!hasStyleSpec) return null
  return (
    <span
      data-testid="from-references-badge"
      aria-label="Inspired by references"
      className="inline-flex items-center gap-1 rounded-full bg-[#3d0000]/85 backdrop-blur px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
    >
      Inspired by references
    </span>
  )
}
