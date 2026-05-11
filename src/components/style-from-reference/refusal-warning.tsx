'use client'

// Phase 76 Plan 03 (PREVIEW-10):
// RefusalWarning — inline chip rendered next to a flagged reference
// thumbnail in the sticky strip. Renders only when at least one of
// flags.contains_{logo,face,watermark} is true.
//
// Copy contract (LEGAL-03 forward-compat — verbatim CONTEXT.md PREVIEW-10):
// "This reference contains a [logo/face/watermark] — generated output
//  will be inspired by the style, not the brand identity."
// Drift here breaks the legal-safety framing the v2.13 wedge depends on.
//
// Continue button dispatches CONFIRM_REFUSAL_WARNING. The reducer's
// refusalAcknowledged flag gates the SpecPreviewPanel Generate CTA via
// the panel's refusalAcknowledgedOrAbsent predicate (Plan 76-01 + 76-02).
// Once acknowledged the chip swaps to a small "Acknowledged" badge so
// the user gets a visible confirmation of the dismissal — without
// removing the framing copy (still relevant context).

import type { Dispatch } from 'react'
import type { RefusalFlags } from '@/lib/ai/refusal-pre-pass'
import type { SpecPreviewAction } from './state-machine'

export interface RefusalWarningProps {
  flags: RefusalFlags
  acknowledged: boolean
  dispatch: Dispatch<SpecPreviewAction>
}

export function RefusalWarning({ flags, acknowledged, dispatch }: RefusalWarningProps) {
  const hits: string[] = []
  if (flags.contains_logo) hits.push('logo')
  if (flags.contains_face) hits.push('face')
  if (flags.contains_watermark) hits.push('watermark')
  if (hits.length === 0) return null

  // Single preamble, joined categories (no per-category duplication).
  const subjects = hits.join(' + ')
  // PREVIEW-10 + LEGAL-03 verbatim copy:
  const message =
    `This reference contains a ${subjects} — generated output will be ` +
    `inspired by the style, not the brand identity.`

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="refusal-warning"
      className="absolute -bottom-1 left-0 right-0 translate-y-full mt-1 z-40 w-max max-w-[240px] text-[11px] bg-[#fff8e1] border border-[#f0c674] rounded-md px-2 py-1 shadow-sm text-[#3d0000]"
    >
      <p>{message}</p>
      {acknowledged ? (
        <span
          data-testid="refusal-acknowledged-badge"
          className="mt-0.5 inline-block text-[10px] font-semibold text-[#7d6161]"
        >
          Acknowledged ✓
        </span>
      ) : (
        <button
          type="button"
          data-testid="refusal-continue-cta"
          onClick={() => dispatch({ type: 'CONFIRM_REFUSAL_WARNING' })}
          className="mt-0.5 inline-block text-[11px] font-bold text-[#3d0000] underline"
        >
          Continue
        </button>
      )}
    </div>
  )
}
