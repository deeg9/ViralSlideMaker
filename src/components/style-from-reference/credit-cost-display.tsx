'use client'

// Phase 76 Plan 02 (PREVIEW-11):
// Credit-cost display — visible label rendered next to the Generate CTA
// inside the credit-cost-slot. Default cost=1 (extraction-charge model);
// the prop is wired so Phase 77 can pass the actual emit cost without
// forking this component.
//
// Tooltip: a small "?" button with aria-describedby pointing to a
// visually-hidden tooltip span that explains the cost model. The tooltip
// is always present in the DOM (sr-only) so screen readers can describe
// the cost model on demand.

export interface CreditCostDisplayProps {
  /** Cost in credits. Defaults to 1 (extraction-charge model from
      src/lib/cost/style-extraction-ledger.ts EXTRACTION_CHARGE_TYPE). */
  cost?: number
}

const TOOLTIP_ID = 'credit-cost-tooltip'

export function CreditCostDisplay({ cost = 1 }: CreditCostDisplayProps) {
  const noun = cost === 1 ? 'credit' : 'credits'

  return (
    <div
      data-testid="credit-cost-display"
      className="flex items-center gap-2 text-[12px] text-[#7d6161]"
    >
      <span>
        Generating will use {cost} {noun}
      </span>
      <button
        type="button"
        aria-label="Credit cost details"
        aria-describedby={TOOLTIP_ID}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#7d6161] text-[10px] font-bold text-[#7d6161] hover:bg-[#fff0f0]"
      >
        ?
      </button>
      <span id={TOOLTIP_ID} role="tooltip" className="sr-only">
        Generating uses 1 credit per slideshow regardless of slide count. Re-extract retries are free up to 2 per generation.
      </span>
    </div>
  )
}
